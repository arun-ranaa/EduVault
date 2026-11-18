const {
    PutObjectCommand,
    GetObjectCommand,
    CopyObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const s3Client = require('../config/s3');
const config = require('../config/index');
const { sanitizeFileName } = require('../utils/helpers');

const S3_DELETE_BATCH_SIZE = 1000;

const generateUploadPresignedUrl = async (
    key,
    contentType,
    contentLength,
    expiresIn = config.upload.uploadPresignedUrlExpiry || 300
) => {
    const params = {
        Bucket: config.aws.s3BucketName,
        Key: key,
        ContentType: contentType,
    };
    // Lock exact Content-Length into the SigV4 signature so S3 rejects oversized uploads immediately
    if (Number.isInteger(contentLength) && contentLength > 0) {
        params.ContentLength = contentLength;
    }
    const command = new PutObjectCommand(params);
    return getSignedUrl(s3Client, command, { expiresIn });
};

const buildContentDisposition = (disposition, originalFileName) => {
    const fallbackName = String(originalFileName || 'file')
        .replace(/["\\\r\n]/g, '_')
        .replace(/[^\x20-\x7E]/g, '_');
    const encodedName = encodeURIComponent(String(originalFileName || 'file'));
    return `${disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
};

const generateDownloadPresignedUrl = async (
    key,
    expiresIn = config.upload.downloadPresignedUrlExpiry || 120,
    originalFileName
) => {
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

const readS3ObjectHeaderBytes = async (key, byteCount = 64) => {
    const command = new GetObjectCommand({
        Bucket: config.aws.s3BucketName,
        Key: key,
        Range: `bytes=0-${Math.max(1, byteCount - 1)}`,
    });
    const response = await s3Client.send(command);
    if (!response.Body) return Buffer.alloc(0);

    if (typeof response.Body.transformToByteArray === 'function') {
        const bytes = await response.Body.transformToByteArray();
        return Buffer.from(bytes);
    }

    const chunks = [];
    for await (const chunk of response.Body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
};

const startsWithBytes = (buf, sig, offset = 0) => {
    if (buf.length < offset + sig.length) return false;
    for (let i = 0; i < sig.length; i += 1) {
        if (buf[offset + i] !== sig[i]) return false;
    }
    return true;
};

/**
 * Validates the uploaded object's leading magic bytes against its declared extension
 * and blocks disguised executables or active web scripts (HTML/SVG/PHP).
 */
const validateFileHeaderSignature = (fileName, buf) => {
    if (!buf || buf.length === 0) {
        return { valid: false, reason: 'Uploaded file is empty' };
    }

    // Always block common native executable formats (PE/EXE/DLL, ELF, Mach-O)
    const isPE = startsWithBytes(buf, [0x4d, 0x5a]); // MZ
    const isELF = startsWithBytes(buf, [0x7f, 0x45, 0x4c, 0x46]); // \x7fELF
    const isMachO =
        startsWithBytes(buf, [0xfe, 0xed, 0xfa, 0xce]) ||
        startsWithBytes(buf, [0xfe, 0xed, 0xfa, 0xcf]) ||
        startsWithBytes(buf, [0xce, 0xfa, 0xed, 0xfe]) ||
        startsWithBytes(buf, [0xcf, 0xfa, 0xed, 0xfe]) ||
        startsWithBytes(buf, [0xca, 0xfe, 0xba, 0xbe]);

    if (isPE || isELF || isMachO) {
        return { valid: false, reason: 'Executable binaries are not permitted' };
    }

    const ext = getFileExtension(fileName);
    const textSnippet = buf.toString('utf8', 0, Math.min(buf.length, 64)).trimStart().toLowerCase();

    // Block HTML, SVG, script, or PHP payloads masquerading as other formats
    if (
        textSnippet.startsWith('<!doctype html') ||
        textSnippet.startsWith('<html') ||
        textSnippet.startsWith('<script') ||
        textSnippet.startsWith('<svg') ||
        textSnippet.startsWith('<?php')
    ) {
        return { valid: false, reason: 'Active HTML/SVG/script content is not permitted' };
    }

    // Strict magic-byte checks for common binary formats
    switch (ext) {
        case 'pdf':
            if (!startsWithBytes(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
                return { valid: false, reason: 'File content does not match PDF format' };
            }
            break;
        case 'png':
            if (!startsWithBytes(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
                return { valid: false, reason: 'File content does not match PNG format' };
            }
            break;
        case 'jpg':
        case 'jpeg':
            if (!startsWithBytes(buf, [0xff, 0xd8, 0xff])) {
                return { valid: false, reason: 'File content does not match JPEG format' };
            }
            break;
        case 'gif':
            if (!startsWithBytes(buf, [0x47, 0x49, 0x46, 0x38])) {
                return { valid: false, reason: 'File content does not match GIF format' };
            }
            break;
        case 'webp':
            if (!(startsWithBytes(buf, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(buf, [0x57, 0x45, 0x42, 0x50], 8))) {
                return { valid: false, reason: 'File content does not match WebP format' };
            }
            break;
        case 'bmp':
            if (!startsWithBytes(buf, [0x42, 0x4d])) {
                return { valid: false, reason: 'File content does not match BMP format' };
            }
            break;
        case 'zip':
        case 'docx':
        case 'xlsx':
        case 'pptx':
        case 'epub':
        case 'odt':
        case 'ods':
        case 'odp':
            if (
                !startsWithBytes(buf, [0x50, 0x4b, 0x03, 0x04]) &&
                !startsWithBytes(buf, [0x50, 0x4b, 0x05, 0x06]) &&
                !startsWithBytes(buf, [0x50, 0x4b, 0x07, 0x08])
            ) {
                return { valid: false, reason: `File content does not match .${ext} archive/document format` };
            }
            break;
        case 'rar':
            if (!startsWithBytes(buf, [0x52, 0x61, 0x72, 0x21])) {
                return { valid: false, reason: 'File content does not match RAR format' };
            }
            break;
        case '7z':
            if (!startsWithBytes(buf, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) {
                return { valid: false, reason: 'File content does not match 7z format' };
            }
            break;
        case 'gz':
            if (!startsWithBytes(buf, [0x1f, 0x8b])) {
                return { valid: false, reason: 'File content does not match GZIP format' };
            }
            break;
        case 'flac':
            if (!startsWithBytes(buf, [0x66, 0x4c, 0x61, 0x43])) {
                return { valid: false, reason: 'File content does not match FLAC format' };
            }
            break;
        case 'ogg':
        case 'ogv':
        case 'opus':
            if (!startsWithBytes(buf, [0x4f, 0x67, 0x67, 0x53])) {
                return { valid: false, reason: `File content does not match .${ext} Ogg format` };
            }
            break;
        case 'wav':
            if (!(startsWithBytes(buf, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(buf, [0x57, 0x41, 0x56, 0x45], 8))) {
                return { valid: false, reason: 'File content does not match WAV format' };
            }
            break;
        case 'avi':
            if (!(startsWithBytes(buf, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(buf, [0x41, 0x56, 0x49, 0x20], 8))) {
                return { valid: false, reason: 'File content does not match AVI format' };
            }
            break;
        case 'mkv':
        case 'webm':
            if (!startsWithBytes(buf, [0x1a, 0x45, 0xdf, 0xa3])) {
                return { valid: false, reason: `File content does not match .${ext} format` };
            }
            break;
        default:
            break;
    }

    return { valid: true };
};

const validateS3ObjectSignature = async (key, fileName) => {
    const header = await readS3ObjectHeaderBytes(key, 64);
    return validateFileHeaderSignature(fileName, header);
};

/**
 * Copies a verified staging object to an immutable final key so the original presigned PUT URL
 * can never be reused to overwrite the finalized object.
 */
const copyS3Object = async (sourceKey, destinationKey, contentType, originalFileName) => {
    const encodedSource = `${config.aws.s3BucketName}/${sourceKey}`
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');

    const command = new CopyObjectCommand({
        Bucket: config.aws.s3BucketName,
        CopySource: encodedSource,
        Key: destinationKey,
        ContentType: contentType,
        ContentDisposition: buildContentDisposition('attachment', originalFileName),
        MetadataDirective: 'REPLACE',
    });
    return s3Client.send(command);
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

    const results = [];
    for (let i = 0; i < keys.length; i += S3_DELETE_BATCH_SIZE) {
        const batch = keys.slice(i, i + S3_DELETE_BATCH_SIZE);
        const command = new DeleteObjectsCommand({
            Bucket: config.aws.s3BucketName,
            Delete: {
                Objects: batch.map((key) => ({ Key: key })),
                Quiet: false,
            },
        });
        results.push(await s3Client.send(command));
    }
    return results;
};

const generateStagingResourceKey = (userId, originalFileName) => {
    const safeName = sanitizeFileName(originalFileName);
    return `staging/resources/users/${userId}/${uuidv4()}-${safeName}`;
};

const generateStagingVaultKey = (userId, originalFileName) => {
    const safeName = sanitizeFileName(originalFileName);
    return `staging/vault/users/${userId}/${uuidv4()}-${safeName}`;
};

const generateResourceKey = (userId, resourceType, originalFileName) => {
    const safeType = String(resourceType || 'OTHER').replace(/[^A-Z0-9_]/g, '') || 'OTHER';
    const safeName = sanitizeFileName(originalFileName);
    return `resources/users/${userId}/${safeType}/${uuidv4()}-${safeName}`;
};

const generateVaultKey = (userId, originalFileName) => {
    const safeName = sanitizeFileName(originalFileName);
    return `private/users/${userId}/${uuidv4()}-${safeName}`;
};

const getFileExtension = (fileName) => {
    const parts = String(fileName || '').split('.');
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
    validateS3ObjectSignature,
    validateFileHeaderSignature,
    copyS3Object,
    isValidS3Key,
    deleteS3Object,
    deleteMultipleS3Objects,
    generateStagingResourceKey,
    generateStagingVaultKey,
    generateResourceKey,
    generateVaultKey,
    getFileExtension,
    isAllowedFileType,
    getContentType
};
