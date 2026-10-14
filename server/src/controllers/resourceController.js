const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const s3Service = require('../services/s3Service');
const config = require('../config/index');

const getResources = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const { search, category, resourceType, subject, tag, sortBy = 'createdAt', order = 'desc' } = req.query;

        const where = {};
        
        // MySQL is case-insensitive by default for contains
        if (search) {
            where.OR = [
                { title: { contains: search } },
                { description: { contains: search } }
            ];
        }
        
        if (category) where.categoryId = parseInt(category);
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
                orderBy: { [sortBy]: order === 'desc' ? 'desc' : 'asc' },
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
        const { title, description, resourceType, subject, categoryId, semester, tags, fileName, fileSize, fileType } = req.body;

        if (parseInt(fileSize) > config.upload.maxFileSize) {
            throw new AppError(`File size exceeds the maximum limit of ${(config.upload.maxFileSize / (1024 * 1024)).toFixed(0)}MB`, 400);
        }

        if (!s3Service.isAllowedFileType(fileName)) {
            throw new AppError('File type not allowed. Allowed types: ' + config.allowedFileTypes.join(', '), 400);
        }

        const s3Key = s3Service.generateResourceKey(resourceType, fileName);
        const contentType = s3Service.getContentType(fileName) || fileType;
        const uploadUrl = await s3Service.generateUploadPresignedUrl(s3Key, contentType);

        res.json({
            success: true,
            data: {
                uploadUrl,
                s3Key,
                fields: { title, description, resourceType, subject, categoryId, semester, tags, fileName, fileType: contentType, fileSize }
            }
        });
    } catch (error) {
        next(error);
    }
};

const completeResourceUpload = async (req, res, next) => {
    try {
        const { title, description, resourceType, subject, categoryId, semester, tags, fileName, fileType, fileSize, s3Key } = req.body;
        const userId = req.user.id;

        const resource = await prisma.$transaction(async (tx) => {
            const newResource = await tx.resource.create({
                data: {
                    title,
                    description: description || null,
                    resourceType,
                    subject: subject || null,
                    categoryId: categoryId ? parseInt(categoryId) : null,
                    semester: semester || null,
                    fileName,
                    fileType,
                    fileSize: parseInt(fileSize),
                    s3Key,
                    uploadedById: userId,
                }
            });

            if (tags && Array.isArray(tags) && tags.length > 0) {
                for (const tagName of tags) {
                    const normalizedName = tagName.trim().toLowerCase();
                    if (!normalizedName) continue;

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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
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
    getResources,
    getResourceById,
    createResourcePresign,
    completeResourceUpload,
    deleteResource,
    getMyResources
};
