const express = require('express');
const { authenticate } = require('../middleware/auth');
const bookmarkController = require('../controllers/bookmarkController');

const router = express.Router();

router.use(authenticate);

router.get('/', bookmarkController.getBookmarks);
router.post('/:resourceId', bookmarkController.addBookmark);
router.delete('/:resourceId', bookmarkController.removeBookmark);
router.get('/:resourceId/check', bookmarkController.checkBookmark);

module.exports = router;
