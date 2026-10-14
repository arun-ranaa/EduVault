import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('eduvault_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('eduvault_token');
      localStorage.removeItem('eduvault_user');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
};

// User API
export const userAPI = {
  getProfile: () => api.get('/users/me'),
  updateProfile: (data) => api.put('/users/me', data),
  changePassword: (data) => api.put('/users/me/password', data),
  getStorage: () => api.get('/users/me/storage'),
};

// Resource API
export const resourceAPI = {
  getAll: (params) => api.get('/resources', { params }),
  getById: (id) => api.get(`/resources/${id}`),
  getMine: (params) => api.get('/resources/my', { params }),
  presign: (data) => api.post('/resources/presign', data),
  complete: (data) => api.post('/resources/complete', data),
  delete: (id) => api.delete(`/resources/${id}`),
  getDownloadUrl: (id) => api.get(`/resources/${id}/download`),
};

// Bookmark API
export const bookmarkAPI = {
  getAll: (params) => api.get('/bookmarks', { params }),
  add: (resourceId) => api.post(`/bookmarks/${resourceId}`),
  remove: (resourceId) => api.delete(`/bookmarks/${resourceId}`),
  check: (resourceId) => api.get(`/bookmarks/${resourceId}/check`),
};

// Vault API
export const vaultAPI = {
  getFiles: (params) => api.get('/vault', { params }),
  getFileById: (id) => api.get(`/vault/${id}`),
  getFolders: () => api.get('/vault/folders'),
  presign: (data) => api.post('/vault/presign', data),
  complete: (data) => api.post('/vault/complete', data),
  getDownloadUrl: (id) => api.get(`/vault/${id}/download`),
  delete: (id) => api.delete(`/vault/${id}`),
};

// Admin API
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserById: (id) => api.get(`/admin/users/${id}`),
  toggleUserStatus: (id) => api.patch(`/admin/users/${id}/toggle-status`),
  updateUserQuota: (id, data) => api.patch(`/admin/users/${id}/quota`, data),
  getResources: (params) => api.get('/admin/resources', { params }),
  deleteResource: (id) => api.delete(`/admin/resources/${id}`),
  getCategories: () => api.get('/admin/categories'),
  createCategory: (data) => api.post('/admin/categories', data),
  updateCategory: (id, data) => api.put(`/admin/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/admin/categories/${id}`),
  getActivities: (params) => api.get('/admin/activities', { params }),
  getStorage: () => api.get('/admin/storage'),
};

// S3 Direct Upload
export const uploadToS3 = async (presignedUrl, file, onProgress) => {
  return axios.put(presignedUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });
};

export default api;
