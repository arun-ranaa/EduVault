const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate, categoryRules } = require('../middleware/validate');

// All routes require authentication and ADMIN role
router.use(authenticate, authorize('ADMIN'));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.patch('/users/:id/toggle-status', adminController.toggleUserStatus);
router.patch('/users/:id/quota', adminController.updateUserQuota);

router.get('/resources', adminController.getAdminResources);
router.delete('/resources/:id', adminController.deleteAdminResource);

router.get('/categories', adminController.getCategories);
router.post('/categories', categoryRules, validate, adminController.createCategory);
router.put('/categories/:id', categoryRules, validate, adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

router.get('/activities', adminController.getActivities);
router.get('/storage', adminController.getStorageStats);

module.exports = router;
