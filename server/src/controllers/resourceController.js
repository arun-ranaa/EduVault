const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const s3Service = require('../services/s3Service');
const config = require('../config/index');
const { getUserStorageUsage, syncUserStorageUsed } = require('../utils/storageHelper');
const {
    findMatchingCategoryId,
    getCategoriesWithCounts,
    buildCategoryFilterCondition,
    getResourceTypeForCategoryName,
} = require('../utils/categoryHelper');

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

const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'title', 'downloadCount', 'fileSize']);
const MAX_RESOURCE_LIMIT = 100;

const getResources = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(Math.max(1, parseInt(req.query.limit, 10) || 12), MAX_RESOURCE_LIMIT);
        const { search, category, resourceType, subject, tag, sortBy = 'createdAt', order = 'desc' } = req.query;
        const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
        const safeOrder = order === 'asc' ? 'asc' : 'desc';

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
                orderBy: { [safeSortBy]: safeOrder },
                include: {
                    category: true,
                    uploadedBy: { select: { id: true, name: true } },
                    tags: { include: { tag: true } }
                }
            }),
            prisma.resource.count({ where })
        ]);

        // Serialize BigInt fields
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
        const id = parseInt(req.params.id);
        if (isNaN(id)) throw new AppError('Invalid resource ID', 400);

        const resource = await prisma.resource.findUnique({
            where: { id },
            include: {
                category: true,
                uploadedBy: { select: { id: true, name: true, email: true } },
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
        const { title, description, resourceType, categoryId, semester, tags, fileName, fileSize, fileType } = req.body;

        const parsedSize = parseInt(fileSize, 10);
        const parsedCategoryId = parseInt(categoryId, 10);

        if (isNaN(parsedCategoryId)) {
            throw new AppError('Category is required', 400);
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

        const userStorageQuota = Number(user?.storageQuota || config.upload.maxVaultStorage);
        if (usage.totalBytes + parsedSize > userStorageQuota) {
            const remaining = Math.max(0, userStorageQuota - usage.totalBytes);
            const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
            throw new AppError(`Storage quota exceeded. You have ${remainingMB} MB remaining.`, 413);
        }

        const derivedResourceType = getResourceTypeForCategoryName(category.name) || resourceType || 'OTHER';
        const s3Key = s3Service.generateResourceKey(derivedResourceType, fileName);
        const contentType = s3Service.getContentType(fileName) || fileType || 'application/octet-stream';
        const uploadUrl = await s3Service.generateUploadPresignedUrl(s3Key, contentType);

        res.json({
            success: true,
            data: {
                uploadUrl,
                s3Key,
                contentType,
                fields: { title, description, resourceType: derivedResourceType, categoryId: category.id, semester, tags, fileName, fileType: contentType, fileSize: parsedSize }
            }
        });
    } catch (error) {
        next(error);
    }
};

const completeResourceUpload = async (req, res, next) => {
    try {
        const { title, description, resourceType, categoryId, semester, tags, fileName, fileType, s3Key } = req.body;
        const userId = req.user.id;

        if (!s3Service.isValidS3Key(s3Key, 'resources/')) {
            throw new AppError('Invalid S3 storage key for resource', 400);
        }

        if (!s3Service.isAllowedFileType(fileName)) {
            throw new AppError('File type not allowed. Allowed types: ' + config.allowedFileTypes.join(', '), 400);
        }

        // Verify s3Key is not already registered and fetch true object size from S3
        const [existingResource, existingVault, s3Meta, user, usage] = await Promise.all([
            prisma.resource.findFirst({ where: { s3Key }, select: { id: true } }),
            prisma.vaultFile.findFirst({ where: { s3Key }, select: { id: true } }),
            s3Service.getS3ObjectMetadata(s3Key),
            prisma.user.findUnique({ where: { id: userId }, select: { storageQuota: true } }),
            getUserStorageUsage(userId),
        ]);

        if (existingResource || existingVault) {
            throw new AppError('This uploaded file has already been registered', 409);
        }

        if (!s3Meta || s3Meta.contentLength <= 0) {
            throw new AppError('Uploaded file was not found in storage. Please upload again.', 400);
        }

        const actualFileSize = s3Meta.contentLength;
        const userStorageQuota = Number(user?.storageQuota || config.upload.maxVaultStorage);

        if (usage.totalBytes + actualFileSize > userStorageQuota) {
            // Remove oversized S3 object immediately
            await s3Service.deleteS3Object(s3Key).catch(() => {});
            const remaining = Math.max(0, userStorageQuota - usage.totalBytes);
            const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
            throw new AppError(`Storage quota exceeded. You have ${remainingMB} MB remaining.`, 413);
        }

        const resolvedContentType = s3Service.getContentType(fileName) || fileType || 'application/octet-stream';

        const resource = await prisma.$transaction(async (tx) => {
            let resolvedCategoryId = null;
            let resolvedCategoryName = null;

            if (categoryId !== undefined && categoryId !== null && categoryId !== '') {
                const parsedCatId = parseInt(categoryId, 10);
                if (!isNaN(parsedCatId)) {
                    const cat = await tx.category.findUnique({
                        where: { id: parsedCatId },
                        select: { id: true, name: true },
                    });
                    if (cat) {
                        resolvedCategoryId = cat.id;
                        resolvedCategoryName = cat.name;
                    }
                }
            }
            if (!resolvedCategoryId && resourceType) {
                resolvedCategoryId = await findMatchingCategoryId(tx, resourceType);
            }

            if (!resolvedCategoryId) {
                throw new AppError('A valid category is required', 400);
            }

            const derivedResourceType = getResourceTypeForCategoryName(resolvedCategoryName) || resourceType || 'OTHER';

            const newResource = await tx.resource.create({
                data: {
                    title: title.trim().slice(0, 255),
                    description: description ? String(description).slice(0, 5000) : null,
                    resourceType: derivedResourceType,
                    subject: null,
                    categoryId: resolvedCategoryId,
                    semester: semester ? String(semester).slice(0, 20) : null,
                    fileName: fileName.trim().slice(0, 255),
                    fileType: resolvedContentType.slice(0, 150),
                    fileSize: actualFileSize,
                    s3Key,
                    uploadedById: userId,
                }
            });

            if (tags && Array.isArray(tags) && tags.length > 0) {
                const uniqueTags = Array.from(
                    new Set(
                        tags
                            .map((t) => String(t || '').trim().toLowerCase().slice(0, 50))
                            .filter(Boolean)
                    )
                );

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

        // Fetch with relations
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
        next(error);
    }
};

const deleteResource = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
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
