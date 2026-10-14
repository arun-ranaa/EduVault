const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const getBookmarks = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const [bookmarks, total] = await Promise.all([
            prisma.bookmark.findMany({
                where: { userId: req.user.id },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    resource: {
                        include: {
                            category: true,
                            uploadedBy: { select: { id: true, name: true } },
                            tags: { include: { tag: true } }
                        }
                    }
                }
            }),
            prisma.bookmark.count({ where: { userId: req.user.id } })
        ]);

        // Serialize BigInt fileSize in nested resources
        const serialized = bookmarks.map(b => ({
            ...b,
            resource: b.resource ? {
                ...b.resource,
                fileSize: Number(b.resource.fileSize)
            } : null
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

const addBookmark = async (req, res, next) => {
    try {
        const resourceId = parseInt(req.params.resourceId);
        if (isNaN(resourceId)) throw new AppError('Invalid resource ID', 400);
        const userId = req.user.id;

        const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
        if (!resource) {
            throw new AppError('Resource not found', 404);
        }

        const existingBookmark = await prisma.bookmark.findFirst({
            where: { userId, resourceId }
        });

        if (existingBookmark) {
            throw new AppError('Resource already bookmarked', 409);
        }

        const bookmark = await prisma.$transaction(async (tx) => {
            const newBookmark = await tx.bookmark.create({
                data: {
                    userId,
                    resourceId
                }
            });

            await tx.activity.create({
                data: {
                    userId,
                    action: 'BOOKMARK_ADDED',
                    details: `Bookmarked resource: ${resource.title}`,
                    metadata: { resourceId, title: resource.title }
                }
            });

            return newBookmark;
        });

        res.status(201).json({ success: true, data: bookmark });
    } catch (error) {
        next(error);
    }
};

const removeBookmark = async (req, res, next) => {
    try {
        const resourceId = parseInt(req.params.resourceId);
        if (isNaN(resourceId)) throw new AppError('Invalid resource ID', 400);
        const userId = req.user.id;

        const existingBookmark = await prisma.bookmark.findFirst({
            where: { userId, resourceId }
        });

        if (!existingBookmark) {
            throw new AppError('Bookmark not found', 404);
        }

        await prisma.$transaction(async (tx) => {
            await tx.bookmark.delete({
                where: { id: existingBookmark.id }
            });

            const resource = await tx.resource.findUnique({ where: { id: resourceId } });

            await tx.activity.create({
                data: {
                    userId,
                    action: 'BOOKMARK_REMOVED',
                    details: `Removed bookmark: ${resource ? resource.title : 'Unknown'}`,
                    metadata: { resourceId, title: resource ? resource.title : 'Unknown' }
                }
            });
        });

        res.json({ success: true, message: 'Bookmark removed successfully' });
    } catch (error) {
        next(error);
    }
};

const checkBookmark = async (req, res, next) => {
    try {
        const resourceId = parseInt(req.params.resourceId);
        if (isNaN(resourceId)) throw new AppError('Invalid resource ID', 400);
        const userId = req.user.id;

        const existingBookmark = await prisma.bookmark.findFirst({
            where: { userId, resourceId }
        });

        res.json({
            success: true,
            data: { isBookmarked: !!existingBookmark }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getBookmarks,
    addBookmark,
    removeBookmark,
    checkBookmark
};
