
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);
// 1. Public/Common Routes (Authenticated Only)
router.get('/directory', userController.getDirectory);

// 2. Restricted Management Routes
// Enforce MANAGE_USERS for all user operations below
router.use(checkPermission('MANAGE_USERS'));

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);


module.exports = router;
