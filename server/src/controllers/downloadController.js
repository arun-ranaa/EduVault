const prisma = require('../config/database');
const config = require('../config/index');
const { AppError } = require('../middleware/errorHandler');
const s3Service = require('../services/s3Service');

const getResourceDownloadUrl = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) throw new AppError('Invalid resource ID', 400);

        const resource = await prisma.resource.findUnique({
            where: { id }
        });

        if (!resource) {
            throw new AppError('Resource not found', 404);
        }

        // Increment download count
        await prisma.resource.update({
            where: { id },
            data: { downloadCount: { increment: 1 } }
        });

        const downloadUrl = await s3Service.generateDownloadPresignedUrl(
            resource.s3Key,
            config.upload.downloadPresignedUrlExpiry || 120,
            resource.fileName
        );

        res.json({
            success: true,
            data: { downloadUrl }
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getResourceDownloadUrl
};
