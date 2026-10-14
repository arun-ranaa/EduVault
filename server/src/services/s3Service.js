const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
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

const generateDownloadPresignedUrl = async (key, expiresIn = config.upload.presignedUrlExpiry || 3600, originalFileName) => {
    const command = new GetObjectCommand({
        Bucket: config.aws.s3BucketName,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${originalFileName}"`
    });
    return getSignedUrl(s3Client, command, { expiresIn });
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
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif'
    };
    return mimeMap[ext] || 'application/octet-stream';
};

module.exports = {
    generateUploadPresignedUrl,
    generateDownloadPresignedUrl,
    deleteS3Object,
    deleteMultipleS3Objects,
    generateResourceKey,
    generateVaultKey,
    getFileExtension,
    isAllowedFileType,
    getContentType
};
