require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3BucketName: process.env.S3_BUCKET_NAME,
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  upload: {
    maxFileSize: null, // No per-file size limit (bounded by user's storage quota)
    maxVaultStorage: parseInt(process.env.MAX_VAULT_STORAGE, 10) || 5368709120,
    presignedUrlExpiry: parseInt(process.env.PRESIGNED_URL_EXPIRY, 10) || 3600,
  },
  allowedFileTypes: [
    // Documents, E-Books & Data
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt',
    '.csv', '.md', '.rtf', '.epub', '.odt', '.ods', '.odp',
    '.json', '.xml', '.yaml', '.yml',
    // Archives & Project Bundles
    '.zip', '.rar', '.7z', '.tar', '.gz',
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.heic', '.heif', '.tiff', '.tif', '.avif',
    // Audio
    '.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.wma', '.opus', '.aiff', '.amr',
    // Video
    '.mp4', '.mkv', '.mov', '.avi', '.webm', '.wmv', '.flv', '.m4v', '.3gp', '.mpeg', '.mpg', '.ogv'
  ],
  allowedMimeTypes: [
    // Documents, E-Books & Data
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/rtf',
    'text/rtf',
    'application/epub+zip',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet',
    'application/vnd.oasis.opendocument.presentation',
    'application/json',
    'application/xml',
    'text/xml',
    'application/x-yaml',
    'text/yaml',
    // Archives
    'application/zip',
    'application/x-zip-compressed',
    'application/vnd.rar',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    'application/x-tar',
    'application/gzip',
    // Images
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/heic',
    'image/heif',
    'image/tiff',
    'image/avif',
    // Audio
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/ogg',
    'audio/flac',
    'audio/x-ms-wma',
    'audio/opus',
    'audio/aiff',
    'audio/amr',
    // Video
    'video/mp4',
    'video/x-matroska',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/x-m4v',
    'video/3gpp',
    'video/mpeg',
    'video/ogg'
  ]
};
