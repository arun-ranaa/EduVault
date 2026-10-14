const prisma = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const s3Service = require('../services/s3Service');

const getResourceDownloadUrl = async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
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
            3600, // Expires in 1 hour
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
