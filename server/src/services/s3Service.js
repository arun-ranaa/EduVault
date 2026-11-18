const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const s3Client = require('../config/s3');
const config = require('../config/index');

const generateUploadPresignedUrl = async (key, contentType, expiresIn = config.upload.presignedUrlExpiry || 3600) => {
    const command = new PutObjectCommand({
        Bucket: config.aws.s3BucketName,
        Key: key,
        ContentType: contentType,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
};

const buildContentDisposition = (disposition, originalFileName) => {
    const fallbackName = String(originalFileName || 'file')
        .replace(/["\\\r\n]/g, '_')
        .replace(/[^\x20-\x7E]/g, '_');
    const encodedName = encodeURIComponent(String(originalFileName || 'file'));
    return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
};

const generateDownloadPresignedUrl = async (key, expiresIn = config.upload.presignedUrlExpiry || 3600, originalFileName) => {
    const command = new GetObjectCommand({
        Bucket: config.aws.s3BucketName,
        Key: key,
        ResponseContentDisposition: buildContentDisposition('attachment', originalFileName),
    });
    return getSignedUrl(s3Client, command, { expiresIn });
};

const getS3ObjectMetadata = async (key) => {
    try {
        const command = new HeadObjectCommand({
            Bucket: config.aws.s3BucketName,
            Key: key,
        });
        const response = await s3Client.send(command);
        return {
            contentLength: Number(response.ContentLength || 0),
            contentType: response.ContentType || 'application/octet-stream',
        };
    } catch (error) {
        if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey') {
            return null;
        }
        throw error;
    }
};

const isValidS3Key = (key, expectedPrefix) => {
    if (typeof key !== 'string' || !key.trim()) return false;
    if (key.length > 500) return false;
    if (key.includes('..') || key.includes('\\') || key.startsWith('/') || /[\r\n\0]/.test(key)) {
        return false;
    }
    if (expectedPrefix && !key.startsWith(expectedPrefix)) {
        return false;
    }
    return true;
};

const deleteS3Object = async (key) => {
    const command = new DeleteObjectCommand({
        Bucket: config.aws.s3BucketName,
        Key: key,
    });
    return s3Client.send(command);
};

const deleteMultipleS3Objects = async (keys) => {
    if (!keys || keys.length === 0) return;
    
    const command = new DeleteObjectsCommand({
        Bucket: config.aws.s3BucketName,
        Delete: {
            Objects: keys.map(key => ({ Key: key })),
            Quiet: false,
        },
    });
    return s3Client.send(command);
};

const generateResourceKey = (resourceType, originalFileName) => {
    const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    return `resources/${resourceType}/${uuidv4()}-${sanitizedFileName}`;
};

const generateVaultKey = (userId, originalFileName) => {
    const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    return `private/users/${userId}/${uuidv4()}-${sanitizedFileName}`;
};

const getFileExtension = (fileName) => {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const isAllowedFileType = (fileName) => {
    const ext = `.${getFileExtension(fileName)}`;
    return config.allowedFileTypes.includes(ext);
};

const getContentType = (fileName) => {
    const ext = getFileExtension(fileName);
    const mimeMap = {
        // Documents, E-Books & Data
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'md': 'text/markdown',
        'rtf': 'application/rtf',
        'epub': 'application/epub+zip',
        'odt': 'application/vnd.oasis.opendocument.text',
        'ods': 'application/vnd.oasis.opendocument.spreadsheet',
        'odp': 'application/vnd.oasis.opendocument.presentation',
        'json': 'application/json',
        'xml': 'application/xml',
        'yaml': 'application/x-yaml',
        'yml': 'application/x-yaml',
        // Archives
        'zip': 'application/zip',
        'rar': 'application/vnd.rar',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
        // Images
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'heic': 'image/heic',
        'heif': 'image/heif',
        'tiff': 'image/tiff',
        'tif': 'image/tiff',
        'avif': 'image/avif',
        // Audio
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'aac': 'audio/aac',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
        'wma': 'audio/x-ms-wma',
        'opus': 'audio/opus',
        'aiff': 'audio/aiff',
        'amr': 'audio/amr',
        // Video
        'mp4': 'video/mp4',
        'mkv': 'video/x-matroska',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'webm': 'video/webm',
        'wmv': 'video/x-ms-wmv',
        'flv': 'video/x-flv',
        'm4v': 'video/x-m4v',
        '3gp': 'video/3gpp',
        'mpeg': 'video/mpeg',
        'mpg': 'video/mpeg',
        'ogv': 'video/ogg'
    };
    return mimeMap[ext] || 'application/octet-stream';
};

module.exports = {
    generateUploadPresignedUrl,
    generateDownloadPresignedUrl,
    getS3ObjectMetadata,
    isValidS3Key,
    deleteS3Object,
    deleteMultipleS3Objects,
    generateResourceKey,
    generateVaultKey,
    getFileExtension,
    isAllowedFileType,
    getContentType
};
