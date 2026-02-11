const express = require('express');
const router = express.Router();
const workItemController = require('../controllers/workItemController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Get my work / managerial view
router.get('/', workItemController.getWorkItems);

// Manager assigns work (batch)
router.post('/assign', checkPermission('ASSIGN_LAB_ID'), workItemController.assignWork);

// Manager assigns single work item
router.post('/:id/assign', checkPermission('ASSIGN_LAB_ID'), workItemController.assignSingle);

// Manager reassigns work item
router.post('/:id/reassign', checkPermission('ASSIGN_LAB_ID'), workItemController.reassignWork);

// Technician updates status/result
router.put('/:id/status', checkPermission('CHANGE_STATUS'), workItemController.updateWorkItemStatus);

// Manager Reviews (Bulk)
router.post('/review/bulk', checkPermission('APPROVE_RESULTS'), workItemController.reviewWorkItemsBulk);

// Manager Reviews (Approve/Reject)
router.post('/:id/review', checkPermission('APPROVE_RESULTS'), workItemController.reviewWorkItem);

module.exports = router;
