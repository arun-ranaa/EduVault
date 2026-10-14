const prisma = require('../config/database');
const s3Service = require('../services/s3Service');
const config = require('../config/index');
const { AppError } = require('../middleware/errorHandler');
const { serializeBigInt, paginate, buildPaginationResponse } = require('../utils/helpers');

exports.getVaultFiles = async (req, res, next) => {
  try {
    const { page, limit, search, folder } = req.query;
    const { skip, take } = paginate(page, limit);

    const where = {
      ownerId: req.user.id,
    };

    if (search) {
      where.name = { contains: search };
    }

    if (folder) {
      where.folder = folder;
    }

    const [total, files] = await Promise.all([
      prisma.vaultFile.count({ where }),
      prisma.vaultFile.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: serializeBigInt(files),
      pagination: buildPaginationResponse(total, page, limit),
    });
  } catch (error) {
    next(error);
  }
};

exports.getVaultFileById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('Invalid file ID', 400);

    const file = await prisma.vaultFile.findFirst({
      where: {
        id,
        ownerId: req.user.id,
      },
    });

    if (!file) {
      throw new AppError('Vault file not found or access denied', 404);
    }

    res.status(200).json({
      success: true,
      data: serializeBigInt(file),
    });
  } catch (error) {
    next(error);
  }
};

exports.createVaultPresign = async (req, res, next) => {
  try {
    const { fileName, fileSize, fileType, folder = '/' } = req.body;

    if (!s3Service.isAllowedFileType(fileName)) {
      throw new AppError('File type not allowed. Allowed: ' + config.allowedFileTypes.join(', '), 400);
    }

    const parsedSize = parseInt(fileSize);
    if (parsedSize > config.upload.maxFileSize) {
      throw new AppError(`File exceeds maximum size of ${(config.upload.maxFileSize / (1024 * 1024)).toFixed(0)}MB`, 400);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { storageUsed: true, storageQuota: true },
    });

    const userStorageUsed = Number(user.storageUsed || 0);
    const userStorageQuota = Number(user.storageQuota || config.upload.maxVaultStorage);

    if (userStorageUsed + parsedSize > userStorageQuota) {
      const remaining = Math.max(0, userStorageQuota - userStorageUsed);
      const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
      throw new AppError(`Storage quota exceeded. You have ${remainingMB} MB remaining.`, 413);
    }

    const s3Key = s3Service.generateVaultKey(req.user.id, fileName);
    const contentType = s3Service.getContentType(fileName) || fileType;
    const uploadUrl = await s3Service.generateUploadPresignedUrl(s3Key, contentType);

    res.status(200).json({
      success: true,
      data: {
        uploadUrl,
        s3Key,
        fileName,
        fileSize: parsedSize,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.completeVaultUpload = async (req, res, next) => {
  try {
    const { fileName, fileType, fileSize, s3Key, folder, name } = req.body;

    const newFile = await prisma.$transaction(async (tx) => {
      const file = await tx.vaultFile.create({
        data: {
          name: name || fileName,
          fileName,
          fileType,
          fileSize: parseInt(fileSize),
          s3Key,
          folder: folder || '/',
          ownerId: req.user.id,
        },
      });

      await tx.user.update({
        where: { id: req.user.id },
        data: {
          storageUsed: { increment: parseInt(fileSize) },
        },
      });

      await tx.activity.create({
        data: {
          action: 'VAULT_FILE_UPLOADED',
          userId: req.user.id,
          details: `Uploaded vault file: ${fileName}`,
          metadata: { fileName, fileId: file.id },
        },
      });

      return file;
    });

    res.status(201).json({
      success: true,
      data: serializeBigInt(newFile),
    });
  } catch (error) {
    next(error);
  }
};

exports.getVaultDownloadUrl = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('Invalid file ID', 400);

    const file = await prisma.vaultFile.findFirst({
      where: {
        id,
        ownerId: req.user.id,
      },
    });

    if (!file) {
      throw new AppError('Vault file not found or access denied', 404);
    }

    const downloadUrl = await s3Service.generateDownloadPresignedUrl(
      file.s3Key,
      config.upload.presignedUrlExpiry,
      file.fileName
    );

    res.status(200).json({
      success: true,
      data: { downloadUrl },
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteVaultFile = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new AppError('Invalid file ID', 400);

    const file = await prisma.vaultFile.findFirst({
      where: {
        id,
        ownerId: req.user.id,
      },
    });

    if (!file) {
      throw new AppError('Vault file not found or access denied', 404);
    }

    await s3Service.deleteS3Object(file.s3Key);

    await prisma.$transaction(async (tx) => {
      await tx.vaultFile.delete({
        where: { id: file.id },
      });

      const user = await tx.user.findUnique({ where: { id: req.user.id }, select: { storageUsed: true } });
      const newStorageUsed = Math.max(0, Number(user.storageUsed) - Number(file.fileSize));

      await tx.user.update({
        where: { id: req.user.id },
        data: {
          storageUsed: BigInt(newStorageUsed),
        },
      });

      await tx.activity.create({
        data: {
          action: 'VAULT_FILE_DELETED',
          userId: req.user.id,
          details: `Deleted vault file: ${file.name}`,
          metadata: { fileName: file.name, fileId: file.id },
        },
      });
    });

    res.status(200).json({
      success: true,
      message: 'Vault file deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

exports.getVaultFolders = async (req, res, next) => {
  try {
    const files = await prisma.vaultFile.findMany({
      where: { ownerId: req.user.id },
      select: { folder: true },
      distinct: ['folder'],
    });

    const folders = files.map(f => f.folder).filter(Boolean);
    if (!folders.includes('/')) {
      folders.unshift('/');
    }

    res.status(200).json({
      success: true,
      data: folders,
    });
  } catch (error) {
    next(error);
  }
};
