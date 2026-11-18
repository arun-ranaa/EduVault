const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const s3Service = require('../services/s3Service');
const config = require('../config/index');
const { asTrimmedString, asValidEnum } = require('../utils/helpers');
const { getUserStorageUsage, syncUserStorageUsed } = require('../utils/storageHelper');
const {
    RESOURCE_TYPES,
    findMatchingCategoryId,
    getCategoriesWithCounts,
    buildCategoryFilterCondition,
    getResourceTypeForCategoryName,
} = require('../utils/categoryHelper');

const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'title', 'downloadCount', 'fileSize']);
const VALID_RESOURCE_TYPES = new Set(RESOURCE_TYPES);
const MAX_RESOURCE_LIMIT = 100;
const MAX_TAGS_PER_RESOURCE = 15;

const getCategories = async (req, res, next) => {
    try {
        const categories = await getCategoriesWithCounts(prisma);
        res.json({
            success: true,
            data: categories
        });
    } catch (error) {
        next(error);
    }
};

const getResources = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 12), MAX_RESOURCE_LIMIT);
        const search = asTrimmedString(req.query.search, 200);
        const subject = asTrimmedString(req.query.subject, 100);
        const tag = asTrimmedString(req.query.tag, 50);
        const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
        const resourceType = asValidEnum(req.query.resourceType, VALID_RESOURCE_TYPES);
        const sortBy = typeof req.query.sortBy === 'string' && ALLOWED_SORT_FIELDS.has(req.query.sortBy)
            ? req.query.sortBy
            : 'createdAt';
        const order = req.query.order === 'asc' ? 'asc' : 'desc';

        const where = {};
        const andConditions = [];

        // MySQL is case-insensitive by default for contains
        if (search) {
            andConditions.push({
                OR: [
                    { title: { contains: search } },
                    { description: { contains: search } }
                ]
            });
        }

        if (category) {
            const categoryCondition = await buildCategoryFilterCondition(prisma, category);
            if (categoryCondition) {
                andConditions.push(categoryCondition);
            }
        }
        if (andConditions.length > 0) {
            where.AND = andConditions;
        }
        if (resourceType) where.resourceType = resourceType;
        if (subject) where.subject = { contains: subject };

        if (tag) {
            const foundTag = await prisma.tag.findFirst({ where: { name: tag.toLowerCase() } });
            if (foundTag) {
                where.tags = { some: { tagId: foundTag.id } };
            } else {
                return res.json({ success: true, data: [], pagination: { page, limit, total: 0, pages: 0 } });
            }
        }

        const skip = (page - 1) * limit;

        const [resources, total] = await Promise.all([
            prisma.resource.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortBy]: order },
                include: {
                    category: true,
                    uploadedBy: { select: { id: true, name: true } },
                    tags: { include: { tag: true } }
                }
            }),
            prisma.resource.count({ where })
        ]);

        const serialized = resources.map(r => ({
            ...r,
            fileSize: Number(r.fileSize)
        }));

        res.json({
            success: true,
            data: serialized,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

const getResourceById = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) throw new AppError('Invalid resource ID', 400);

        const resource = await prisma.resource.findUnique({
            where: { id },
            include: {
                category: true,
                // Do not expose uploader email address to other users
                uploadedBy: { select: { id: true, name: true } },
                tags: { include: { tag: true } },
                _count: { select: { bookmarks: true } }
            }
        });

        if (!resource) {
            throw new AppError('Resource not found', 404);
        }

        res.json({
            success: true,
            data: {
                ...resource,
                fileSize: Number(resource.fileSize)
            }
        });
    } catch (error) {
        next(error);
    }
};

const createResourcePresign = async (req, res, next) => {
    try {
        const { title, description, resourceType, categoryId, semester, subject, tags, fileName, fileSize, fileType } = req.body;

        const parsedSize = parseInt(fileSize, 10);
        const parsedCategoryId = parseInt(categoryId, 10);

        if (isNaN(parsedCategoryId)) {
            throw new AppError('Category is required', 400);
        }

        if (!Number.isInteger(parsedSize) || parsedSize <= 0) {
            throw new AppError('File size must be a positive integer', 400);
        }

        if (config.upload.maxFileSize && parsedSize > config.upload.maxFileSize) {
            throw new AppError('Single file size cannot exceed 5 GB', 413);
        }

        if (!s3Service.isAllowedFileType(fileName)) {
            throw new AppError('File type not allowed. Allowed types: ' + config.allowedFileTypes.join(', '), 400);
        }

        const [category, user, usage] = await Promise.all([
            prisma.category.findUnique({
                where: { id: parsedCategoryId },
                select: { id: true, name: true },
            }),
            prisma.user.findUnique({
                where: { id: req.user.id },
                select: { storageQuota: true },
            }),
            getUserStorageUsage(req.user.id),
        ]);

        if (!category) {
            throw new AppError('Selected category not found', 400);
        }

        const userStorageQuota = Number(user?.storageQuota ?? config.upload.maxVaultStorage);
        if (usage.totalBytes + parsedSize > userStorageQuota) {
            const remaining = Math.max(0, userStorageQuota - usage.totalBytes);
            const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
            throw new AppError(`Storage quota exceeded. You have ${remainingMB} MB remaining.`, 413);
        }

        const safeRequestedType = asValidEnum(resourceType, VALID_RESOURCE_TYPES);
        const derivedResourceType = getResourceTypeForCategoryName(category.name) || safeRequestedType || 'OTHER';
        const stagingKey = s3Service.generateStagingResourceKey(req.user.id, fileName);
        const contentType = s3Service.getContentType(fileName) || fileType || 'application/octet-stream';
        const uploadUrl = await s3Service.generateUploadPresignedUrl(stagingKey, contentType, parsedSize);

        res.json({
            success: true,
            data: {
                uploadUrl,
                s3Key: stagingKey,
                contentType,
                fields: {
                    title,
                    description,
                    resourceType: derivedResourceType,
                    categoryId: category.id,
                    semester,
                    subject,
                    tags,
                    fileName,
                    fileType: contentType,
                    fileSize: parsedSize
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

const completeResourceUpload = async (req, res, next) => {
    let copiedFinalKey = null;
    try {
        const { title, description, resourceType, categoryId, semester, subject, tags, fileName, fileType, s3Key } = req.body;
        const userId = req.user.id;
        const expectedStagingPrefix = `staging/resources/users/${userId}/`;

        if (!s3Service.isValidS3Key(s3Key, expectedStagingPrefix)) {
            throw new AppError('Invalid S3 storage key for resource', 400);
        }

        if (!s3Service.isAllowedFileType(fileName)) {
            await s3Service.deleteS3Object(s3Key).catch(() => {});
            throw new AppError('File type not allowed. Allowed types: ' + config.allowedFileTypes.join(', '), 400);
        }

        const s3Meta = await s3Service.getS3ObjectMetadata(s3Key);
        if (!s3Meta || s3Meta.contentLength <= 0) {
            throw new AppError('Uploaded file was not found in storage. Please upload again.', 400);
        }

        const actualFileSize = s3Meta.contentLength;
        if (config.upload.maxFileSize && actualFileSize > config.upload.maxFileSize) {
            await s3Service.deleteS3Object(s3Key).catch(() => {});
            throw new AppError('Uploaded file exceeds maximum allowed single file size', 413);
        }

        // Verify magic bytes and reject disguised executables / active web content
        const signatureCheck = await s3Service.validateS3ObjectSignature(s3Key, fileName);
        if (!signatureCheck.valid) {
            await s3Service.deleteS3Object(s3Key).catch(() => {});
            throw new AppError(signatureCheck.reason || 'File content failed security verification', 400);
        }

        // Validate category before promoting from staging
        let resolvedCategoryId = null;
        let resolvedCategoryName = null;
        if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
            const parsedCatId = parseInt(categoryId, 10);
            if (!isNaN(parsedCatId)) {
                const cat = await prisma.category.findUnique({
                    where: { id: parsedCatId },
                    select: { id: true, name: true },
                });
                if (cat) {
                    resolvedCategoryId = cat.id;
                    resolvedCategoryName = cat.name;
                }
            }
        }
        const safeRequestedType = asValidEnum(resourceType, VALID_RESOURCE_TYPES);
        if (!resolvedCategoryId && safeRequestedType) {
            resolvedCategoryId = await findMatchingCategoryId(prisma, safeRequestedType);
        }
        if (!resolvedCategoryId) {
            await s3Service.deleteS3Object(s3Key).catch(() => {});
            throw new AppError('A valid category is required', 400);
        }

        const derivedResourceType = getResourceTypeForCategoryName(resolvedCategoryName) || safeRequestedType || 'OTHER';
        const resolvedContentType = s3Service.getContentType(fileName) || fileType || 'application/octet-stream';
        const finalS3Key = s3Service.generateResourceKey(userId, derivedResourceType, fileName);

        // Move object from staging -> immutable final key so the presigned PUT URL can never overwrite it
        await s3Service.copyS3Object(s3Key, finalS3Key, resolvedContentType, fileName);
        copiedFinalKey = finalS3Key;
        await s3Service.deleteS3Object(s3Key).catch(() => {});

        const uniqueTags = Array.from(
            new Set(
                (Array.isArray(tags) ? tags : [])
                    .slice(0, MAX_TAGS_PER_RESOURCE)
                    .map((t) => String(t || '').trim().toLowerCase().slice(0, 50))
                    .filter(Boolean)
            )
        );

        const resource = await prisma.$transaction(async (tx) => {
            // Row-level lock on user serializes concurrent uploads and prevents TOCTOU quota bypass
            const lockedRows = await tx.$queryRaw`SELECT id, storageQuota FROM users WHERE id = ${userId} FOR UPDATE`;
            const lockedUser = lockedRows[0];
            if (!lockedUser) {
                throw new AppError('User not found', 404);
            }

            const usage = await getUserStorageUsage(userId, tx);
            const userStorageQuota = Number(lockedUser.storageQuota ?? config.upload.maxVaultStorage);

            if (usage.totalBytes + actualFileSize > userStorageQuota) {
                const remaining = Math.max(0, userStorageQuota - usage.totalBytes);
                const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
                throw new AppError(`Storage quota exceeded. You have ${remainingMB} MB remaining.`, 413);
            }

            const newResource = await tx.resource.create({
                data: {
                    title: asTrimmedString(title, 255),
                    description: description ? String(description).slice(0, 5000) : null,
                    resourceType: derivedResourceType,
                    subject: subject ? asTrimmedString(subject, 100) || null : null,
                    categoryId: resolvedCategoryId,
                    semester: semester ? asTrimmedString(semester, 20) || null : null,
                    fileName: asTrimmedString(fileName, 255),
                    fileType: resolvedContentType.slice(0, 150),
                    fileSize: actualFileSize,
                    s3Key: finalS3Key,
                    uploadedById: userId,
                }
            });

            for (const normalizedName of uniqueTags) {
                const tag = await tx.tag.upsert({
                    where: { name: normalizedName },
                    update: {},
                    create: { name: normalizedName }
                });

                await tx.resourceTag.create({
                    data: {
                        resourceId: newResource.id,
                        tagId: tag.id
                    }
                });
            }

            await syncUserStorageUsed(tx, userId);

            await tx.activity.create({
                data: {
                    userId,
                    action: 'RESOURCE_UPLOADED',
                    details: `Uploaded resource: ${newResource.title}`,
                    metadata: { resourceId: newResource.id, title: newResource.title }
                }
            });

            return newResource;
        });

        // Clear cleanup guard once committed
        copiedFinalKey = null;

        const fullResource = await prisma.resource.findUnique({
            where: { id: resource.id },
            include: {
                category: true,
                uploadedBy: { select: { id: true, name: true } },
                tags: { include: { tag: true } }
            }
        });

        res.status(201).json({
            success: true,
            data: {
                ...fullResource,
                fileSize: Number(fullResource.fileSize)
            }
        });
    } catch (error) {
        if (copiedFinalKey) {
            await s3Service.deleteS3Object(copiedFinalKey).catch(() => {});
        }
        next(error);
    }
};

const deleteResource = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) throw new AppError('Invalid resource ID', 400);

        const resource = await prisma.resource.findUnique({ where: { id } });

        if (!resource) {
            throw new AppError('Resource not found', 404);
        }

        if (resource.uploadedById !== req.user.id && req.user.role !== 'ADMIN') {
            throw new AppError('Not authorized to delete this resource', 403);
        }

        // Delete from S3
        await s3Service.deleteS3Object(resource.s3Key);

        // Delete from DB
        await prisma.$transaction(async (tx) => {
            await tx.resourceTag.deleteMany({ where: { resourceId: id } });
            await tx.bookmark.deleteMany({ where: { resourceId: id } });
            await tx.resource.delete({ where: { id } });

            await syncUserStorageUsed(tx, resource.uploadedById);

            await tx.activity.create({
                data: {
                    userId: req.user.id,
                    action: 'RESOURCE_DELETED',
                    details: `Deleted resource: ${resource.title}`,
                    metadata: { resourceId: id, title: resource.title }
                }
            });
        });

        res.json({ success: true, message: 'Resource deleted successfully' });
    } catch (error) {
        next(error);
    }
};

const getMyResources = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 12), MAX_RESOURCE_LIMIT);
        const skip = (page - 1) * limit;

        const where = { uploadedById: req.user.id };

        const [resources, total] = await Promise.all([
            prisma.resource.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    category: true,
                    tags: { include: { tag: true } }
                }
            }),
            prisma.resource.count({ where })
        ]);

        const serialized = resources.map(r => ({
            ...r,
            fileSize: Number(r.fileSize)
        }));

        res.json({
            success: true,
            data: serialized,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCategories,
    getResources,
    getResourceById,
    createResourcePresign,
    completeResourceUpload,
    deleteResource,
    getMyResources
};
