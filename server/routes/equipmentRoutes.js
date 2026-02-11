const express = require('express');
const router = express.Router();
const equipmentController = require('../controllers/equipmentController');
const equipmentEventController = require('../controllers/equipmentEventController');
const equipmentEligibilityController = require('../controllers/equipmentEligibilityController');
const { verifyToken } = require('../middleware/authMiddleware');

// All equipment routes require authentication
router.use(verifyToken);

// Events (static paths first, before /:id)
router.post('/events', equipmentEventController.logEvent);
router.patch('/events/:eventId/disposition', equipmentEventController.approveDisposition);

// Eligibility (static paths first, before /:id)
router.get('/eligibility', equipmentEligibilityController.getEligibility);
router.post('/eligibility', equipmentEligibilityController.updateEligibility);
router.get('/eligibility/:analysisCode', equipmentEligibilityController.getEligibleInstruments);

// Registry (parameterized routes last)
router.get('/', equipmentController.getEquipment);
router.post('/', equipmentController.addEquipment);
router.get('/:id', equipmentController.getEquipmentDetails);
router.put('/:id', equipmentController.updateEquipment);
router.patch('/:id/status', equipmentController.updateStatus);
router.get('/:equipmentId/events', equipmentEventController.getEquipmentEvents);

module.exports = router;
