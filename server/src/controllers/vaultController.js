const prisma = require('../config/database');
const s3Service = require('../services/s3Service');
const config = require('../config/index');
const { AppError } = require('../middleware/errorHandler');
const { asTrimmedString, serializeBigInt, paginate, buildPaginationResponse } = require('../utils/helpers');
const { getUserStorageUsage, syncUserStorageUsed } = require('../utils/storageHelper');

exports.getVaultFiles = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const search = asTrimmedString(req.query.search, 200);
    const folder = asTrimmedString(req.query.folder, 255);
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
    const id = parseInt(req.params.id, 10);
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
    const { fileName, fileSize, fileType } = req.body;

    if (!s3Service.isAllowedFileType(fileName)) {
      throw new AppError('File type not allowed. Allowed: ' + config.allowedFileTypes.join(', '), 400);
    }

    const parsedSize = parseInt(fileSize, 10);
    if (!Number.isInteger(parsedSize) || parsedSize <= 0) {
      throw new AppError('File size must be a positive integer', 400);
    }

    if (config.upload.maxFileSize && parsedSize > config.upload.maxFileSize) {
      throw new AppError('Single file size cannot exceed 5 GB', 413);
    }

    const [user, usage] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        select: { storageQuota: true },
      }),
      getUserStorageUsage(req.user.id),
    ]);

    const userStorageUsed = usage.totalBytes;
    const userStorageQuota = Number(user?.storageQuota ?? config.upload.maxVaultStorage);

    if (userStorageUsed + parsedSize > userStorageQuota) {
      const remaining = Math.max(0, userStorageQuota - userStorageUsed);
      const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
      throw new AppError(`Storage quota exceeded. You have ${remainingMB} MB remaining.`, 413);
    }

    const stagingKey = s3Service.generateStagingVaultKey(req.user.id, fileName);
    const contentType = s3Service.getContentType(fileName) || fileType || 'application/octet-stream';
    const uploadUrl = await s3Service.generateUploadPresignedUrl(stagingKey, contentType, parsedSize);

    res.status(200).json({
      success: true,
      data: {
        uploadUrl,
        s3Key: stagingKey,
        contentType,
        fileName,
        fileSize: parsedSize,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.completeVaultUpload = async (req, res, next) => {
  let copiedFinalKey = null;
  try {
    const { fileName, fileType, s3Key, folder, name } = req.body;
    const userId = req.user.id;
    const expectedStagingPrefix = `staging/vault/users/${userId}/`;

    if (!s3Service.isValidS3Key(s3Key, expectedStagingPrefix)) {
      throw new AppError('Invalid S3 storage key for this vault', 400);
    }

    if (!s3Service.isAllowedFileType(fileName)) {
      await s3Service.deleteS3Object(s3Key).catch(() => {});
      throw new AppError('File type not allowed. Allowed: ' + config.allowedFileTypes.join(', '), 400);
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

    const resolvedContentType = s3Service.getContentType(fileName) || fileType || 'application/octet-stream';
    const finalS3Key = s3Service.generateVaultKey(userId, fileName);

    // Promote from staging -> immutable final key so presigned PUT URL can never overwrite it
    await s3Service.copyS3Object(s3Key, finalS3Key, resolvedContentType, fileName);
    copiedFinalKey = finalS3Key;
    await s3Service.deleteS3Object(s3Key).catch(() => {});

    const safeFileName = asTrimmedString(fileName, 255) || 'file';
    const safeName = asTrimmedString(name, 255) || safeFileName;
    const safeFolder = asTrimmedString(folder, 255) || '/';

    const newFile = await prisma.$transaction(async (tx) => {
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

      const file = await tx.vaultFile.create({
        data: {
          name: safeName,
          fileName: safeFileName,
          fileType: resolvedContentType.slice(0, 150),
          fileSize: actualFileSize,
          s3Key: finalS3Key,
          folder: safeFolder,
          ownerId: userId,
        },
      });

      await syncUserStorageUsed(tx, userId);

      await tx.activity.create({
        data: {
          action: 'VAULT_FILE_UPLOADED',
          userId,
          details: `Uploaded vault file: ${safeFileName}`,
          metadata: { fileName: safeFileName, fileId: file.id },
        },
      });

      return file;
    });

    copiedFinalKey = null;

    res.status(201).json({
      success: true,
      data: serializeBigInt(newFile),
    });
  } catch (error) {
    if (copiedFinalKey) {
      await s3Service.deleteS3Object(copiedFinalKey).catch(() => {});
    }
    next(error);
  }
};

exports.getVaultDownloadUrl = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
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
      config.upload.downloadPresignedUrlExpiry || 120,
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
    const id = parseInt(req.params.id, 10);
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

      await syncUserStorageUsed(tx, req.user.id);

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
