const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const sanitizeFileName = (fileName) => {
  return String(fileName || 'file')
    .replace(/[^a-zA-Z0-9.\-_]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^\.+/, '_')
    .slice(0, 200) || 'file';
};

const asTrimmedString = (value, maxLength = 255) => {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
};

const asValidEnum = (value, allowedValues) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return allowedValues.has(trimmed) ? trimmed : null;
};

const serializeBigInt = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === 'object') {
    if (obj instanceof Date) return obj;
    const result = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = serializeBigInt(obj[key]);
      }
    }
    return result;
  }
  return obj;
};

const MAX_PAGE_LIMIT = 100;

const paginate = (page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(Math.max(1, parseInt(limit, 10) || 10), MAX_PAGE_LIMIT);
  return { skip: (p - 1) * l, take: l };
};

const buildPaginationResponse = (total, page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(Math.max(1, parseInt(limit, 10) || 10), MAX_PAGE_LIMIT);
  return { page: p, limit: l, total, pages: Math.ceil(total / l) };
};

module.exports = {
  formatFileSize,
  sanitizeFileName,
  asTrimmedString,
  asValidEnum,
  serializeBigInt,
  paginate,
  buildPaginationResponse,
};
