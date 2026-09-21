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
router.post('/:id/imports/preview', checkPermission('MANAGE_PROJECTS'), projectController.previewImport);
router.get('/:id/stats', checkPermission('VIEW_SAMPLES'), projectController.getProjectStats);
router.get('/:id/samples', checkPermission('VIEW_SAMPLES'), projectController.getProjectSamples);
router.get('/:id/activity', projectController.getProjectActivity);
router.get('/:id/kobo-config', checkPermission('MANAGE_PROJECTS'), projectController.getProjectKoboConfig);
router.get('/:id/kobo/config', checkPermission('MANAGE_PROJECTS'), projectController.getProjectKoboConfig);
router.get('/:id/kobo-connections', checkPermission('MANAGE_PROJECTS'), projectController.listProjectKoboConnections);
router.get('/:id/kobo/connections', checkPermission('MANAGE_PROJECTS'), projectController.listProjectKoboConnections);
router.post('/:id/kobo-connections', checkPermission('MANAGE_PROJECTS'), projectController.createProjectKoboConnection);
router.put('/:id/kobo-connections/:configId', checkPermission('MANAGE_PROJECTS'), projectController.updateProjectKoboConnection);
router.post('/:id/kobo-connections/:configId/toggle', checkPermission('MANAGE_PROJECTS'), projectController.toggleProjectKoboConnection);
router.post('/:id/kobo-connections/:configId/sync', checkPermission('MANAGE_PROJECTS'), projectController.syncProjectKoboConnection);

router.get('/:id/lab-access', checkPermission('MANAGE_PROJECTS'), projectController.getProjectLabAccess);
router.patch('/:id/lab-access', checkPermission('MANAGE_PROJECTS'), projectController.updateProjectLabAccess);
router.get('/:id/operations/:key', checkPermission('MANAGE_PROJECTS'), projectController.getProjectOperationReceipt);

module.exports = router;
