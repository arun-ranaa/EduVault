require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isDevOrTest = nodeEnv === 'development' || nodeEnv === 'test';
const jwtSecret = process.env.JWT_SECRET;

if (!isDevOrTest && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set (min 32 characters) in production.');
}

if (isDevOrTest && (!jwtSecret || jwtSecret.length < 16)) {
  throw new Error('FATAL: JWT_SECRET environment variable must be set (min 16 characters in development, min 32 in production).');
}

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

const buildAllowedOrigins = () => {
  const origins = new Set();

  const addOrigin = (rawOrigin) => {
    if (!rawOrigin) return;
    const normalized = rawOrigin.trim().replace(/\/+$/, '');
    if (!normalized) return;
    // Block insecure HTTP origins in production
    if (!isDevOrTest && normalized.startsWith('http://')) {
      return;
    }
    origins.add(normalized);
  };

  addOrigin(frontendUrl);

  if (process.env.CORS_ORIGINS) {
    process.env.CORS_ORIGINS.split(',').forEach(addOrigin);
  }

  if (isDevOrTest) {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
  }

  return Array.from(origins);
};

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  host: process.env.HOST || '127.0.0.1',
  nodeEnv,
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  aws: {
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    s3BucketName: process.env.S3_BUCKET_NAME,
  },
  frontendUrl,
  corsOrigins: buildAllowedOrigins(),
  upload: {
    maxFileSize: 5 * 1024 * 1024 * 1024, // 5 GB S3 single-PUT hard cap (further bounded by user quota)
    maxVaultStorage: parseInt(process.env.MAX_VAULT_STORAGE, 10) || 5368709120,
    uploadPresignedUrlExpiry: Math.min(parseInt(process.env.UPLOAD_PRESIGNED_URL_EXPIRY, 10) || 300, 900),
    downloadPresignedUrlExpiry: Math.min(parseInt(process.env.DOWNLOAD_PRESIGNED_URL_EXPIRY, 10) || 120, 300),
    presignedUrlExpiry: Math.min(parseInt(process.env.PRESIGNED_URL_EXPIRY, 10) || 300, 900),
  },
  allowedFileTypes: [
    // Documents, E-Books & Data (.xml excluded to prevent XSS/XXE vectors)
    '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt',
    '.csv', '.md', '.rtf', '.epub', '.odt', '.ods', '.odp',
    '.json', '.yaml', '.yml',
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
