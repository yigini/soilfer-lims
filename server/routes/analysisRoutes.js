const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// Read-Only (any authenticated user)
router.get('/analyses', verifyToken, analysisController.getAnalyses);
router.get('/groups', verifyToken, analysisController.getGroups);
router.get('/methodologies', verifyToken, analysisController.getMethodologies);
router.get('/categories', verifyToken, analysisController.getCategories);
router.get('/gates', verifyToken, analysisController.getOperationalGates);

// Analyses — MANAGE_ANALYSES permission
router.post('/analyses', verifyToken, checkPermission('MANAGE_ANALYSES'), analysisController.createAnalysis);
router.put('/analyses/:code', verifyToken, checkPermission('MANAGE_ANALYSES'), analysisController.updateAnalysis);
router.delete('/analyses/:code', verifyToken, checkPermission('MANAGE_ANALYSES'), analysisController.deleteAnalysis);

// Groups — MANAGE_ANALYSES permission
router.post('/groups', verifyToken, checkPermission('MANAGE_ANALYSES'), analysisController.createGroup);
router.put('/groups/:id', verifyToken, checkPermission('MANAGE_ANALYSES'), analysisController.updateGroup);
router.delete('/groups/:id', verifyToken, checkPermission('MANAGE_ANALYSES'), analysisController.deleteGroup);

// Methodologies — MANAGE_ANALYSES permission
router.post('/methodologies', verifyToken, checkPermission('MANAGE_ANALYSES'), analysisController.createMethodology);
router.put('/methodologies/:id', verifyToken, checkPermission('MANAGE_ANALYSES'), analysisController.updateMethodology);
router.delete('/methodologies/:id', verifyToken, checkPermission('MANAGE_ANALYSES'), analysisController.deleteMethodology);

// Categories — MANAGE_BRANDING permission (Global configuration)
router.post('/categories', verifyToken, checkPermission('MANAGE_BRANDING'), analysisController.createCategory);
router.put('/categories/:id', verifyToken, checkPermission('MANAGE_BRANDING'), analysisController.updateCategory);
router.delete('/categories/:id', verifyToken, checkPermission('MANAGE_BRANDING'), analysisController.deleteCategory);

module.exports = router;
