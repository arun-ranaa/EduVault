import { format, parseISO } from 'date-fns';

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    return format(date, 'MMM dd, yyyy');
  } catch {
    return String(dateString);
  }
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  try {
    const date = typeof dateString === 'string' ? parseISO(dateString) : new Date(dateString);
    return format(date, 'MMM dd, yyyy hh:mm a');
  } catch {
    return String(dateString);
  }
};

export const getFileIcon = (fileType) => {
  if (!fileType) return 'default';
  const type = fileType.toLowerCase();

  if (type.includes('pdf')) return 'pdf';
  if (type.includes('word') || type.includes('doc')) return 'doc';
  if (type.includes('excel') || type.includes('sheet') || type.includes('xls')) return 'xls';
  if (type.includes('powerpoint') || type.includes('presentation') || type.includes('ppt')) return 'ppt';
  if (type.includes('image') || type.match(/\.(jpg|jpeg|png|gif)$/i)) return 'image';
  if (type.includes('text') || type.includes('txt')) return 'txt';

  return 'default';
};

export const getResourceTypeLabel = (type) => {
  const labels = {
    NOTES: 'Notes',
    BOOK: 'Book',
    QUESTION_PAPER: 'Question Paper',
    ASSIGNMENT: 'Assignment',
    STUDY_MATERIAL: 'Study Material',
    QUESTION_BANK: 'Question Bank',
    LAB_RESOURCE: 'Lab Resource',
    OTHER: 'Other',
  };
  return labels[type] || type;
};

export const getResourceTypeColor = (type) => {
  const colors = {
    NOTES: 'bg-green-100 text-green-800',
    BOOK: 'bg-blue-100 text-blue-800',
    QUESTION_PAPER: 'bg-purple-100 text-purple-800',
    ASSIGNMENT: 'bg-yellow-100 text-yellow-800',
    STUDY_MATERIAL: 'bg-indigo-100 text-indigo-800',
    QUESTION_BANK: 'bg-pink-100 text-pink-800',
    LAB_RESOURCE: 'bg-orange-100 text-orange-800',
    OTHER: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
};

export const RESOURCE_TYPES = [
  { value: 'NOTES', label: 'Notes' },
  { value: 'BOOK', label: 'Book' },
  { value: 'QUESTION_PAPER', label: 'Question Paper' },
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'STUDY_MATERIAL', label: 'Study Material' },
  { value: 'QUESTION_BANK', label: 'Question Bank' },
  { value: 'LAB_RESOURCE', label: 'Lab Resource' },
  { value: 'OTHER', label: 'Other' },
];

export const SEMESTERS = [
  '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'
];

export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const calculateStoragePercentage = (used, total) => {
  if (!total || total === 0) return 0;
  const percentage = (used / total) * 100;
  return Math.min(Math.round(percentage * 100) / 100, 100);
};

export const getActivityLabel = (action) => {
  const labels = {
    USER_REGISTERED: 'User Registered',
    USER_LOGIN: 'User Login',
    RESOURCE_UPLOADED: 'Resource Uploaded',
    RESOURCE_DELETED: 'Resource Deleted',
    VAULT_FILE_UPLOADED: 'Vault File Uploaded',
    VAULT_FILE_DELETED: 'Vault File Deleted',
    BOOKMARK_ADDED: 'Bookmark Added',
    BOOKMARK_REMOVED: 'Bookmark Removed',
    CATEGORY_CREATED: 'Category Created',
    CATEGORY_UPDATED: 'Category Updated',
    CATEGORY_DELETED: 'Category Deleted',
  };
  return labels[action] || action;
};

export const getActivityColor = (action) => {
  const colors = {
    USER_REGISTERED: 'bg-green-100 text-green-800',
    USER_LOGIN: 'bg-blue-100 text-blue-800',
    RESOURCE_UPLOADED: 'bg-indigo-100 text-indigo-800',
    RESOURCE_DELETED: 'bg-red-100 text-red-800',
    VAULT_FILE_UPLOADED: 'bg-purple-100 text-purple-800',
    VAULT_FILE_DELETED: 'bg-orange-100 text-orange-800',
    BOOKMARK_ADDED: 'bg-yellow-100 text-yellow-800',
    BOOKMARK_REMOVED: 'bg-gray-100 text-gray-800',
    CATEGORY_CREATED: 'bg-teal-100 text-teal-800',
    CATEGORY_UPDATED: 'bg-cyan-100 text-cyan-800',
    CATEGORY_DELETED: 'bg-rose-100 text-rose-800',
  };
  return colors[action] || 'bg-gray-100 text-gray-800';
};
