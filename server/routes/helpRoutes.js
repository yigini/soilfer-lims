const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { JWT_SECRET: SECRET_KEY } = require('../config/auth');
const { getPermissionsForRole } = require('../config/roles');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');

const helpController = require('../controllers/helpController');
const adminHelpController = require('../controllers/adminHelpController');

/**
 * Optional token verification middleware.
 * If token is provided, attaches authenticated user to req.user.
 * If not provided, proceeds with req.user = null (public access).
 */
async function optionalAuth(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await prisma.user.findUnique({
            where: { id: String(decoded.id) }
        });

        if (user && user.isActive !== false) {
            const { password: _, ...safeUser } = user;
            req.user = {
                ...safeUser,
                permissions: getPermissionsForRole(user.role)
            };
            if (user.language) {
                req.locale = user.language;
            }
        } else {
            req.user = null;
        }
    } catch (e) {
        req.user = null;
    }
    next();
}

// ─── Public / Scoped Reader & Context Endpoints ───
router.get('/topics', optionalAuth, helpController.getTopics);
router.get('/articles', optionalAuth, helpController.getArticles);
router.get('/articles/:articleId', optionalAuth, helpController.getArticleById);
router.get('/search', optionalAuth, helpController.searchHelp);
router.get('/context', optionalAuth, helpController.getContextHelp);
router.get('/pack', optionalAuth, helpController.getOfflinePack);
router.get('/support-config', optionalAuth, helpController.getSupportConfig);
router.post('/feedback', optionalAuth, helpController.recordFeedback);

// ─── Administration & Content Governance Endpoints ───
router.get('/admin/articles', verifyToken, checkPermission('HELP_EDIT_LAB'), adminHelpController.listAdminArticles);
router.post('/admin/articles/:articleId/revisions', verifyToken, checkPermission('HELP_EDIT_GLOBAL'), adminHelpController.createDraftRevision);
router.put('/admin/articles/:articleId/revisions/:revisionNumber/locales/:locale', verifyToken, checkPermission('HELP_EDIT_GLOBAL'), adminHelpController.updateLocaleDraft);
router.post('/admin/articles/:articleId/publish', verifyToken, checkPermission('HELP_PUBLISH_GLOBAL'), adminHelpController.publishArticleRevision);
router.put('/admin/articles/:articleId/lab-note', verifyToken, checkPermission('HELP_EDIT_LAB'), adminHelpController.saveLabNote);

module.exports = router;
