const crypto = require('crypto');
const prisma = require('../prisma');

const sha256 = (data) => crypto.createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');

const sanitizeHtml = (str = '') => {
    return String(str)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/**
 * GET /api/help/admin/articles
 * List all articles with revision history, active publications, and translation matrix
 */
async function listAdminArticles(req, res) {
    try {
        const user = req.user;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const userPermissions = user.permissions || [];

        const canEditGlobal = isSuperAdmin || userPermissions.includes('HELP_EDIT_GLOBAL');
        const canPublishGlobal = isSuperAdmin || userPermissions.includes('HELP_PUBLISH_GLOBAL');
        const canEditLab = isSuperAdmin || userPermissions.includes('HELP_EDIT_LAB') || !!user.labId;
        const canPublishLab = isSuperAdmin || userPermissions.includes('HELP_PUBLISH_LAB') || !!user.labId;

        const articles = await prisma.helpArticle.findMany({
            where: { archivedAt: null },
            include: {
                publications: {
                    where: { isCurrent: true },
                    include: {
                        revision: {
                            include: { locales: true }
                        }
                    }
                },
                revisions: {
                    orderBy: { revisionNumber: 'desc' },
                    take: 5,
                    include: { locales: true }
                },
                labNotes: user.labId ? {
                    where: { labId: user.labId }
                } : false
            },
            orderBy: { category: 'asc' }
        });

        const items = articles.map(a => {
            const currentPub = a.publications[0];
            const currentRev = currentPub?.revision;
            const latestRev = a.revisions[0];

            // Locale review matrix for latest revision
            const localeStatus = {};
            ['en', 'es', 'es-419', 'fr', 'pt'].forEach(loc => {
                const locRev = latestRev?.locales?.find(l => l.locale === loc);
                localeStatus[loc] = locRev ? locRev.reviewStatus : 'TRANSLATION_REQUIRED';
            });

            // Parse steps, success, caution
            let steps = [];
            try { steps = JSON.parse(latestRev?.steps || '[]'); } catch (e) { steps = []; }
            let related = [];
            try { related = JSON.parse(latestRev?.related || '[]'); } catch (e) { related = []; }

            return {
                id: a.id,
                category: a.category,
                kind: a.kind,
                feature: a.feature,
                reviewOwner: a.reviewOwner,
                visibility: a.visibility,
                currentRevisionNumber: currentRev?.revisionNumber || null,
                latestRevisionNumber: latestRev?.revisionNumber || null,
                isPublished: !!currentPub,
                publishedLocales: currentPub?.approvedLocales ? JSON.parse(currentPub.approvedLocales) : [],
                title: latestRev?.title || a.id,
                summary: latestRev?.summary || '',
                steps,
                success: latestRev?.success || '',
                caution: latestRev?.caution || '',
                related,
                locales: localeStatus,
                labNote: a.labNotes?.[0] ? {
                    id: a.labNotes[0].id,
                    noteText: a.labNotes[0].noteText,
                    isActive: a.labNotes[0].isActive,
                    updatedAt: a.labNotes[0].updatedAt
                } : null
            };
        });

        res.json({
            success: true,
            articles: items,
            userScope: {
                username: user.username,
                role: user.role,
                labId: user.labId || null,
                canEditGlobal,
                canPublishGlobal,
                canEditLab,
                canPublishLab
            }
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] listAdminArticles error:', err);
        res.status(500).json({ error: 'Failed to list articles for administration' });
    }
}

/**
 * GET /api/help/admin/articles/:articleId/revisions/:revisionNumber
 * Get full structured details of a specific revision and its locale variants
 */
async function getRevisionDetails(req, res) {
    try {
        const { articleId, revisionNumber } = req.params;
        const rev = await prisma.helpRevision.findFirst({
            where: {
                articleId,
                revisionNumber: parseInt(revisionNumber)
            },
            include: {
                locales: true,
                publications: true
            }
        });

        if (!rev) {
            return res.status(404).json({ error: 'Revision not found' });
        }

        let steps = [];
        try { steps = JSON.parse(rev.steps || '[]'); } catch (e) { steps = []; }
        let related = [];
        try { related = JSON.parse(rev.related || '[]'); } catch (e) { related = []; }

        const isPublished = rev.publications && rev.publications.length > 0;

        res.json({
            success: true,
            revision: {
                id: rev.id,
                articleId: rev.articleId,
                revisionNumber: rev.revisionNumber,
                title: rev.title,
                summary: rev.summary,
                steps,
                success: rev.success,
                caution: rev.caution,
                related,
                sourceLocale: rev.sourceLocale,
                sourceHash: rev.sourceHash,
                changeReason: rev.changeReason,
                authorId: rev.authorId,
                createdAt: rev.createdAt,
                isPublished,
                locales: rev.locales.map(l => ({
                    id: l.id,
                    locale: l.locale,
                    title: l.title,
                    summary: l.summary,
                    steps: JSON.parse(l.steps || '[]'),
                    success: l.success,
                    caution: l.caution,
                    reviewStatus: l.reviewStatus,
                    reviewedBy: l.reviewedBy,
                    reviewedAt: l.reviewedAt
                }))
            }
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] getRevisionDetails error:', err);
        res.status(500).json({ error: 'Failed to fetch revision details' });
    }
}

/**
 * POST /api/help/admin/articles/:articleId/revisions
 * Create a new draft revision preserving all fields (Super Admin / HELP_EDIT_GLOBAL)
 */
async function createDraftRevision(req, res) {
    try {
        const { articleId } = req.params;
        const {
            expectedRevisionNumber,
            title,
            summary,
            steps,
            success,
            caution,
            related,
            changeReason
        } = req.body;

        const article = await prisma.helpArticle.findUnique({
            where: { id: articleId },
            include: {
                revisions: {
                    orderBy: { revisionNumber: 'desc' },
                    take: 1,
                    include: { locales: true }
                }
            }
        });

        if (!article) {
            return res.status(404).json({ error: 'Help article not found' });
        }

        const latestRev = article.revisions[0];
        const currentRevNum = latestRev ? latestRev.revisionNumber : 0;

        // Optimistic concurrency check
        if (expectedRevisionNumber !== undefined && expectedRevisionNumber !== currentRevNum) {
            return res.status(409).json({
                error: 'CONCURRENCY_CONFLICT',
                message: `Article was modified by another user. Latest revision is ${currentRevNum}.`,
                latestRevisionNumber: currentRevNum
            });
        }

        const newRevisionNumber = currentRevNum + 1;
        const sanitizedTitle = sanitizeHtml(title || latestRev?.title || articleId);
        const sanitizedSummary = sanitizeHtml(summary || latestRev?.summary || '');
        const sanitizedSuccess = sanitizeHtml(success !== undefined ? success : (latestRev?.success || ''));
        const sanitizedCaution = sanitizeHtml(caution !== undefined ? caution : (latestRev?.caution || ''));

        let stepsArray = [];
        if (Array.isArray(steps)) {
            stepsArray = steps.map(sanitizeHtml);
        } else if (latestRev?.steps) {
            try { stepsArray = JSON.parse(latestRev.steps); } catch (e) { stepsArray = []; }
        }

        let relatedArray = [];
        if (Array.isArray(related)) {
            relatedArray = related;
        } else if (latestRev?.related) {
            try { relatedArray = JSON.parse(latestRev.related); } catch (e) { relatedArray = []; }
        }

        const sourceHash = sha256({
            id: articleId,
            title: sanitizedTitle,
            summary: sanitizedSummary,
            steps: stepsArray,
            success: sanitizedSuccess,
            caution: sanitizedCaution
        });

        const locales = ['en', 'es', 'es-419', 'fr', 'pt'];

        const newRev = await prisma.helpRevision.create({
            data: {
                articleId,
                revisionNumber: newRevisionNumber,
                title: sanitizedTitle,
                summary: sanitizedSummary,
                steps: JSON.stringify(stepsArray),
                success: sanitizedSuccess,
                caution: sanitizedCaution,
                related: JSON.stringify(relatedArray),
                sourceLocale: 'en',
                sourceHash,
                changeReason: changeReason ? sanitizeHtml(changeReason) : 'Updated draft revision',
                authorId: req.user.username || req.user.id,
                locales: {
                    create: locales.map(loc => {
                        const prevLocaleRev = latestRev?.locales?.find(l => l.locale === loc);
                        return {
                            locale: loc,
                            title: loc === 'en' ? sanitizedTitle : (prevLocaleRev?.title || sanitizedTitle),
                            summary: loc === 'en' ? sanitizedSummary : (prevLocaleRev?.summary || sanitizedSummary),
                            steps: loc === 'en' ? JSON.stringify(stepsArray) : (prevLocaleRev?.steps || JSON.stringify(stepsArray)),
                            success: loc === 'en' ? sanitizedSuccess : (prevLocaleRev?.success || sanitizedSuccess),
                            caution: loc === 'en' ? sanitizedCaution : (prevLocaleRev?.caution || sanitizedCaution),
                            // Source edit invalidates dependent translations
                            reviewStatus: loc === 'en' ? 'EDITORIAL_DRAFT' : 'TRANSLATION_REQUIRED'
                        };
                    })
                }
            }
        });

        res.json({
            success: true,
            revisionNumber: newRev.revisionNumber,
            revisionId: newRev.id,
            message: `Draft revision ${newRev.revisionNumber} created. All locales require review before publication.`
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] createDraftRevision error:', err);
        res.status(500).json({ error: 'Failed to create draft revision' });
    }
}

/**
 * PUT /api/help/admin/articles/:articleId/revisions/:revisionNumber/locales/:locale
 * Update a translation draft for a specific locale.
 * Rejects edits if revision is already published (Finding 1: Immutability of published guidance).
 */
async function updateLocaleDraft(req, res) {
    try {
        const { articleId, revisionNumber, locale } = req.params;
        const { title, summary, steps, success, caution, reviewStatus } = req.body;

        const rev = await prisma.helpRevision.findFirst({
            where: {
                articleId,
                revisionNumber: parseInt(revisionNumber)
            },
            include: {
                publications: true
            }
        });

        if (!rev) {
            return res.status(404).json({ error: 'Revision not found' });
        }

        // IMMUTABILITY CHECK (Finding 1): Published revisions are immutable!
        const isPublished = rev.publications && rev.publications.length > 0;
        if (isPublished) {
            return res.status(409).json({
                error: 'IMMUTABLE_PUBLISHED_REVISION',
                message: `Revision ${revisionNumber} has been published and is immutable. Create a new draft revision to propose changes.`
            });
        }

        // Draft editing endpoint does NOT accept APPROVED directly without dedicated review action (Finding 1)
        const allowedStatuses = ['EDITORIAL_DRAFT', 'TRANSLATION_REQUIRED', 'IN_REVIEW'];
        const targetStatus = allowedStatuses.includes(reviewStatus) ? reviewStatus : 'EDITORIAL_DRAFT';

        const updated = await prisma.helpLocaleRevision.upsert({
            where: {
                revisionId_locale: {
                    revisionId: rev.id,
                    locale
                }
            },
            update: {
                title: sanitizeHtml(title),
                summary: sanitizeHtml(summary),
                steps: JSON.stringify(Array.isArray(steps) ? steps.map(sanitizeHtml) : []),
                success: sanitizeHtml(success),
                caution: sanitizeHtml(caution),
                reviewStatus: targetStatus
            },
            create: {
                revisionId: rev.id,
                locale,
                title: sanitizeHtml(title),
                summary: sanitizeHtml(summary),
                steps: JSON.stringify(Array.isArray(steps) ? steps.map(sanitizeHtml) : []),
                success: sanitizeHtml(success),
                caution: sanitizeHtml(caution),
                reviewStatus: targetStatus
            }
        });

        res.json({
            success: true,
            localeRevision: updated,
            message: `Locale ${locale} updated for revision ${revisionNumber}.`
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] updateLocaleDraft error:', err);
        res.status(500).json({ error: 'Failed to update locale translation draft' });
    }
}

/**
 * POST /api/help/admin/articles/:articleId/request-review
 * Submit draft for review (transitions status to IN_REVIEW)
 */
async function requestReview(req, res) {
    try {
        const { articleId } = req.params;
        const { revisionNumber, locales = ['en'] } = req.body;

        const rev = await prisma.helpRevision.findFirst({
            where: {
                articleId,
                revisionNumber: revisionNumber ? parseInt(revisionNumber) : undefined
            },
            orderBy: { revisionNumber: 'desc' },
            include: { locales: true }
        });

        if (!rev) {
            return res.status(404).json({ error: 'Revision not found' });
        }

        const targetLocales = Array.isArray(locales) ? locales : [locales];

        await prisma.helpLocaleRevision.updateMany({
            where: {
                revisionId: rev.id,
                locale: { in: targetLocales }
            },
            data: {
                reviewStatus: 'IN_REVIEW'
            }
        });

        res.json({
            success: true,
            message: `Revision ${rev.revisionNumber} submitted for review for locales: ${targetLocales.join(', ')}.`
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] requestReview error:', err);
        res.status(500).json({ error: 'Failed to submit review request' });
    }
}

/**
 * POST /api/help/admin/articles/:articleId/approve
 * Approve locale revision (requires HELP_PUBLISH_GLOBAL or SUPER_ADMIN)
 */
async function approveLocale(req, res) {
    try {
        const { articleId } = req.params;
        const { revisionNumber, locale = 'en' } = req.body;

        const user = req.user;
        const canApprove = user.role === 'SUPER_ADMIN' || user.permissions?.includes('HELP_PUBLISH_GLOBAL');
        if (!canApprove) {
            return res.status(403).json({ error: 'UNAUTHORIZED', message: 'You do not have permission to approve article translations.' });
        }

        const rev = await prisma.helpRevision.findFirst({
            where: {
                articleId,
                revisionNumber: revisionNumber ? parseInt(revisionNumber) : undefined
            },
            orderBy: { revisionNumber: 'desc' },
            include: { locales: true }
        });

        if (!rev) {
            return res.status(404).json({ error: 'Revision not found' });
        }

        const updated = await prisma.helpLocaleRevision.update({
            where: {
                revisionId_locale: {
                    revisionId: rev.id,
                    locale
                }
            },
            data: {
                reviewStatus: 'APPROVED',
                reviewedBy: user.username || user.id,
                reviewedAt: new Date()
            }
        });

        res.json({
            success: true,
            localeRevision: updated,
            message: `Locale ${locale} approved by ${user.username} for revision ${rev.revisionNumber}.`
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] approveLocale error:', err);
        res.status(500).json({ error: 'Failed to approve locale revision' });
    }
}

/**
 * POST /api/help/admin/articles/:articleId/publish
 * Publish a revision atomically with strict approval gate (Finding 1 & 2)
 */
async function publishArticleRevision(req, res) {
    try {
        const { articleId } = req.params;
        const { revisionNumber, approvedLocales, expectedRevisionNumber } = req.body;

        const user = req.user;
        const canPublish = user.role === 'SUPER_ADMIN' || user.permissions?.includes('HELP_PUBLISH_GLOBAL');
        if (!canPublish) {
            return res.status(403).json({ error: 'UNAUTHORIZED', message: 'You do not have permission to publish articles.' });
        }

        const rev = await prisma.helpRevision.findFirst({
            where: {
                articleId,
                revisionNumber: parseInt(revisionNumber)
            },
            include: { locales: true }
        });

        if (!rev) {
            return res.status(404).json({ error: 'Revision not found' });
        }

        // Optimistic concurrency check
        if (expectedRevisionNumber !== undefined && expectedRevisionNumber !== rev.revisionNumber) {
            return res.status(409).json({
                error: 'CONCURRENCY_CONFLICT',
                message: `Publication conflict: expected revision ${expectedRevisionNumber} but target is ${rev.revisionNumber}.`
            });
        }

        // Validate approvedLocales list
        const localesList = Array.isArray(approvedLocales) && approvedLocales.length > 0
            ? approvedLocales
            : ['en'];

        // STRICT PUBLICATION GATE (Finding 1):
        // Every single locale in approvedLocales MUST have reviewStatus === 'APPROVED'
        for (const loc of localesList) {
            const locRev = rev.locales.find(l => l.locale === loc);
            if (!locRev) {
                return res.status(422).json({
                    error: 'MISSING_LOCALE_REVISION',
                    message: `Cannot publish: locale '${loc}' does not exist in revision ${revisionNumber}.`
                });
            }
            if (locRev.reviewStatus !== 'APPROVED') {
                return res.status(422).json({
                    error: 'UNREVIEWED_DRAFT_PUBLICATION_REJECTED',
                    message: `Cannot publish: locale '${loc}' has review status '${locRev.reviewStatus}'. All published locales must be APPROVED before release.`,
                    locale: loc,
                    status: locRev.reviewStatus
                });
            }
        }

        // Transactionally supersede older publications and set new current publication
        await prisma.$transaction([
            prisma.helpPublication.updateMany({
                where: { articleId, isCurrent: true },
                data: { isCurrent: false }
            }),
            prisma.helpPublication.create({
                data: {
                    articleId,
                    revisionId: rev.id,
                    approvedLocales: JSON.stringify(localesList),
                    publishedBy: req.user.username || req.user.id,
                    isCurrent: true
                }
            })
        ]);

        res.json({
            success: true,
            message: `Article ${articleId} revision ${revisionNumber} published atomically for locales: ${localesList.join(', ')}.`
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] publishArticleRevision error:', err);
        res.status(500).json({ error: 'Failed to publish article revision' });
    }
}

/**
 * PUT /api/help/admin/articles/:articleId/lab-note
 * Save or update lab-scoped procedural note (Lab Manager / Super Admin)
 */
async function saveLabNote(req, res) {
    try {
        const { articleId } = req.params;
        const { noteText, isActive = true } = req.body;
        const user = req.user;

        // Lab Manager can only edit note for their assigned labId
        const targetLabId = user.role === 'SUPER_ADMIN' ? (req.body.labId || user.labId) : user.labId;

        if (!targetLabId) {
            return res.status(400).json({ error: 'No labId specified or associated with user account' });
        }

        const sanitizedNote = sanitizeHtml(noteText);

        const labNote = await prisma.helpLabNote.upsert({
            where: {
                articleId_labId: {
                    articleId,
                    labId: targetLabId
                }
            },
            update: {
                noteText: sanitizedNote,
                authorId: user.username || user.id,
                isActive: !!isActive
            },
            create: {
                articleId,
                labId: targetLabId,
                noteText: sanitizedNote,
                authorId: user.username || user.id,
                isActive: !!isActive
            }
        });

        res.json({
            success: true,
            labNote,
            message: `Laboratory note saved for lab ${targetLabId}.`
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] saveLabNote error:', err);
        res.status(500).json({ error: 'Failed to save lab note' });
    }
}

module.exports = {
    listAdminArticles,
    getRevisionDetails,
    createDraftRevision,
    updateLocaleDraft,
    requestReview,
    approveLocale,
    publishArticleRevision,
    saveLabNote
};
