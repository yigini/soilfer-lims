
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

router.use(verifyToken);

router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProject);
router.post('/', checkPermission('MANAGE_PROJECTS'), projectController.createProject);
router.put('/:id', checkPermission('MANAGE_PROJECTS'), projectController.updateProject);
router.delete('/:id', checkPermission('ARCHIVE_PROJECTS'), projectController.deleteProject);
router.post('/:id/archive', checkPermission('ARCHIVE_PROJECTS'), projectController.archiveProject);
router.post('/:id/restore', checkPermission('ARCHIVE_PROJECTS'), projectController.restoreProject);
router.post('/:id/manifest', checkPermission('MANAGE_PROJECTS'), projectController.uploadManifest);
router.get('/:id/stats', checkPermission('VIEW_SAMPLES'), projectController.getProjectStats);
router.get('/:id/samples', checkPermission('VIEW_SAMPLES'), projectController.getProjectSamples);
router.get('/:id/kobo-config', checkPermission('MANAGE_PROJECTS'), projectController.getProjectKoboConfig);

module.exports = router;
