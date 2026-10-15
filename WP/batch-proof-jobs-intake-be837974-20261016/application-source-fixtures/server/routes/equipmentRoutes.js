const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');
const equipmentEventController = require('../controllers/equipmentEventController');
const equipmentEligibilityController = require('../controllers/equipmentEligibilityController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Authentication required for all equipment routes
router.use(verifyToken);

// Events (static paths first, before /:id)
router.post('/events', checkPermission('MANAGE_EQUIPMENT'), equipmentEventController.logEvent);
router.patch('/events/:eventId/disposition', checkPermission('MANAGE_EQUIPMENT'), equipmentEventController.approveDisposition);

// Eligibility (static paths first, before /:id)
router.get('/eligibility', checkPermission('VIEW_EQUIPMENT'), equipmentEligibilityController.getEligibility);
router.post('/eligibility', checkPermission('MANAGE_EQUIPMENT'), equipmentEligibilityController.updateEligibility);
router.get('/eligibility/:analysisCode', checkPermission('VIEW_EQUIPMENT'), equipmentEligibilityController.getEligibleInstruments);

// Audit (static paths first, before /:id)
router.get('/audit/mismatches', checkPermission('MANAGE_EQUIPMENT'), equipmentController.getAuditMismatches);

// Registry (parameterized routes last)
router.get('/', checkPermission('VIEW_EQUIPMENT'), equipmentController.getEquipment);
router.post('/', checkPermission('MANAGE_EQUIPMENT'), equipmentController.addEquipment);
router.get('/:id', checkPermission('VIEW_EQUIPMENT'), equipmentController.getEquipmentDetails);
router.put('/:id', checkPermission('MANAGE_EQUIPMENT'), equipmentController.updateEquipment);
router.patch('/:id/status', checkPermission('MANAGE_EQUIPMENT'), equipmentController.updateStatus);
router.get('/:equipmentId/events', checkPermission('VIEW_EQUIPMENT'), equipmentEventController.getEquipmentEvents);

module.exports = router;
