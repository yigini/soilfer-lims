const express = require('express');
const router = express.Router();
const workItemController = require('../controllers/workItemController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

// Get my work / managerial view
router.get('/', workItemController.getWorkItems);
router.get('/eligible-assignees', checkPermission('ASSIGN_WORK'), workItemController.getEligibleAssignees);

// Manager assigns work (batch)
router.post('/assign', checkPermission('ASSIGN_WORK'), workItemController.assignWork);

// Manager assigns single work item
router.post('/:id/assign', checkPermission('ASSIGN_WORK'), workItemController.assignSingle);

// Manager reassigns work item
router.post('/:id/reassign', checkPermission('ASSIGN_WORK'), workItemController.reassignWork);

// Technician updates status/result
router.put('/:id/status', checkPermission('CHANGE_STATUS'), workItemController.updateWorkItemStatus);

// Technician starts work (SD-05)
router.post('/:id/start', checkPermission('CHANGE_STATUS'), workItemController.startWork);
router.post('/:id/repeats', checkPermission('MANAGE_WORK_ATTEMPTS'), require('../controllers/workRepeatController').requestRepeat);

// Manager Reviews (Bulk)
router.post('/review/bulk', checkPermission('APPROVE_RESULTS'), workItemController.reviewWorkItemsBulk);

// Manager Reviews (Approve/Reject)
router.post('/:id/review', checkPermission('APPROVE_RESULTS'), workItemController.reviewWorkItem);

const reportedValues = require('../controllers/reportedValueController');
router.get('/:id/reported-value', checkPermission('APPROVE_RESULTS'), reportedValues.inspect);
router.post('/:id/reported-value/preview', checkPermission('APPROVE_RESULTS'), reportedValues.preview);
router.post('/:id/reported-value', checkPermission('APPROVE_RESULTS'), reportedValues.select);

module.exports = router;
