/**
 * Report Routes
 * Maps endpoints to the report controller with RBAC guards.
 */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

// ─── Internal (authenticated) endpoints ──────────────────

// Generate report for a sample
router.post('/generate/:sampleId', verifyToken, checkPermission('GENERATE_REPORT'), ctrl.generateReport);

// Get a specific report
router.get('/search', verifyToken, ctrl.searchReports);

// Get report by ID
router.get('/:reportId', verifyToken, ctrl.getReport);

// Get latest report for a sample
router.get('/sample/:sampleId', verifyToken, ctrl.getReportBySample);

// ─── Sharing (manager-only) ─────────────────────────────

// Create share link
router.post('/:reportId/share', verifyToken, checkPermission('SHARE_REPORT'), ctrl.createShareLink);

// List share links
router.get('/:reportId/links', verifyToken, ctrl.listShareLinks);

// Revoke share link
router.post('/links/:linkId/revoke', verifyToken, checkPermission('SHARE_REPORT'), ctrl.revokeShareLink);

// ─── Public (unauthenticated) endpoints ──────────────────

// Public HTML report view
router.get('/public/:token', ctrl.getPublicReport);

// Public PDF download
router.get('/public/:token/pdf', ctrl.getPublicReportPdf);

module.exports = router;
