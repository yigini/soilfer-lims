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

        // Transactionally supersede older publications and set new current publication with concurrency defense
        try {
            await prisma.$transaction(async (tx) => {
                if (expectedRevisionNumber !== undefined) {
                    const currentPub = await tx.helpPublication.findFirst({
                        where: { articleId, isCurrent: true },
                        include: { revision: true }
                    });
                    if (currentPub && currentPub.revision?.revisionNumber !== expectedRevisionNumber) {
                        throw new Error('CONCURRENCY_CONFLICT');
                    }
                }

                await tx.helpPublication.updateMany({
                    where: { articleId, isCurrent: true },
                    data: { isCurrent: false }
                });

                await tx.helpPublication.create({
                    data: {
                        articleId,
                        revisionId: rev.id,
                        approvedLocales: JSON.stringify(localesList),
                        publishedBy: req.user.username || req.user.id,
                        isCurrent: true
                    }
                });
            });
        } catch (txErr) {
            if (txErr.message === 'CONCURRENCY_CONFLICT') {
                return res.status(409).json({
                    error: 'CONCURRENCY_CONFLICT',
                    message: `Publication conflict: revision was concurrently updated.`
                });
            }
            throw txErr;
        }

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
 * Save or publish lab-scoped procedural note with governed draft vs publish workflow
 */
async function saveLabNote(req, res) {
    try {
        const { articleId } = req.params;
        const { noteText, action = 'save_draft', isActive = true } = req.body;
        const user = req.user;

        // Verify lab scope
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        const targetLabId = isSuperAdmin ? (req.body.labId || user.labId) : user.labId;

        if (!targetLabId) {
            return res.status(400).json({ error: 'No labId specified or associated with user account' });
        }

        // Capability and role checks
        const userPermissions = user.permissions || [];
        const canEditLab = isSuperAdmin || user.role === 'LAB_MANAGER' || userPermissions.includes('HELP_EDIT_LAB');
        const canPublishLab = isSuperAdmin || user.role === 'LAB_MANAGER' || userPermissions.includes('HELP_PUBLISH_LAB');

        if (!canEditLab) {
            return res.status(403).json({ error: 'UNAUTHORIZED', message: 'You do not have permission to edit lab guidance.' });
        }

        // Action determines publishing vs draft saving
        const isPublishing = action === 'publish' || (action !== 'save_draft' && isActive === true);
        if (isPublishing && !canPublishLab) {
            return res.status(403).json({
                error: 'UNAUTHORIZED',
                message: 'You do not have permission to publish laboratory guidance. You may save drafts for Lab Manager approval.'
            });
        }

        const sanitizedNote = sanitizeHtml(noteText);
        const shouldBeActive = isPublishing;

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
                isActive: shouldBeActive
            },
            create: {
                articleId,
                labId: targetLabId,
                noteText: sanitizedNote,
                authorId: user.username || user.id,
                isActive: shouldBeActive
            }
        });

        res.json({
            success: true,
            action: isPublishing ? 'publish' : 'save_draft',
            labNote,
            status: shouldBeActive ? 'PUBLISHED' : 'DRAFT',
            message: shouldBeActive
                ? `Laboratory note published for lab ${targetLabId}.`
                : `Laboratory note draft saved for lab ${targetLabId} (pending review/publication).`
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] saveLabNote error:', err);
        res.status(500).json({ error: 'Failed to save lab note' });
    }
}

/**
 * GET /api/help/admin/release-preview
 * Previews all articles and their locale review states for release management
 */
async function getReleasePreview(req, res) {
    try {
        const articles = await prisma.helpArticle.findMany({
            where: { archivedAt: null },
            include: {
                publications: {
                    where: { isCurrent: true },
                    include: { revision: true }
                },
                revisions: {
                    orderBy: { revisionNumber: 'desc' },
                    take: 1,
                    include: { locales: true }
                }
            },
            orderBy: { id: 'asc' }
        });

        const locales = ['en', 'es', 'es-419', 'fr', 'pt'];
        const approvedCounts = { en: 0, es: 0, 'es-419': 0, fr: 0, pt: 0 };

        const items = articles.map(a => {
            const currentPub = a.publications[0];
            const latestRev = a.revisions[0];
            const localeStatus = {};

            locales.forEach(loc => {
                const locRev = latestRev?.locales?.find(l => l.locale === loc);
                const status = locRev ? locRev.reviewStatus : 'TRANSLATION_REQUIRED';
                localeStatus[loc] = status;
                if (status === 'APPROVED') {
                    approvedCounts[loc] = (approvedCounts[loc] || 0) + 1;
                }
            });

            const currentPublishedLocales = currentPub?.approvedLocales
                ? (typeof currentPub.approvedLocales === 'string' ? JSON.parse(currentPub.approvedLocales) : currentPub.approvedLocales)
                : [];

            return {
                id: a.id,
                category: a.category,
                title: latestRev?.title || a.id,
                revisionNumber: latestRev?.revisionNumber || 1,
                revisionId: latestRev?.id || null,
                isPublished: !!currentPub,
                currentlyPublishedLocales,
                locales: localeStatus,
                readyToPublishLocales: locales.filter(loc => localeStatus[loc] === 'APPROVED')
            };
        });

        res.json({
            success: true,
            totalArticles: articles.length,
            approvedCounts,
            items
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] getReleasePreview error:', err);
        res.status(500).json({ error: 'Failed to generate release preview' });
    }
}

/**
 * POST /api/help/admin/batch-publish
 * Batch publish reviewed articles with manifest validation and transactional execution
 */
async function batchPublish(req, res) {
    try {
        const user = req.user;
        const canPublish = user.role === 'SUPER_ADMIN' || user.permissions?.includes('HELP_PUBLISH_GLOBAL');
        if (!canPublish) {
            return res.status(403).json({ error: 'UNAUTHORIZED', message: 'You do not have permission to batch publish articles.' });
        }

        const { releases, dryRun = false } = req.body;
        if (!Array.isArray(releases) || releases.length === 0) {
            return res.status(400).json({ error: 'releases must be a non-empty array' });
        }

        const validationErrors = [];
        const validatedReleases = [];

        for (const item of releases) {
            const { articleId, revisionNumber, approvedLocales } = item;
            if (!articleId) {
                validationErrors.push({ articleId: 'unknown', error: 'Missing articleId' });
                continue;
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
                validationErrors.push({ articleId, error: `Revision ${revisionNumber || 'latest'} not found` });
                continue;
            }

            const localesList = Array.isArray(approvedLocales) && approvedLocales.length > 0
                ? approvedLocales
                : ['en'];

            // Validate that every requested locale is APPROVED
            let allApproved = true;
            for (const loc of localesList) {
                const locRev = rev.locales.find(l => l.locale === loc);
                if (!locRev) {
                    validationErrors.push({ articleId, locale: loc, error: `Locale ${loc} does not exist on revision ${rev.revisionNumber}` });
                    allApproved = false;
                } else if (locRev.reviewStatus !== 'APPROVED') {
                    validationErrors.push({ articleId, locale: loc, status: locRev.reviewStatus, error: `Locale ${loc} status is ${locRev.reviewStatus}, must be APPROVED` });
                    allApproved = false;
                }
            }

            if (allApproved) {
                validatedReleases.push({
                    articleId,
                    revisionId: rev.id,
                    revisionNumber: rev.revisionNumber,
                    approvedLocales: localesList
                });
            }
        }

        if (dryRun) {
            return res.json({
                success: true,
                dryRun: true,
                valid: validationErrors.length === 0,
                totalRequested: releases.length,
                validCount: validatedReleases.length,
                errorsCount: validationErrors.length,
                errors: validationErrors,
                manifest: validatedReleases
            });
        }

        if (validationErrors.length > 0) {
            return res.status(422).json({
                error: 'BATCH_PUBLICATION_VALIDATION_FAILED',
                message: `Cannot publish release: ${validationErrors.length} validation errors encountered.`,
                errors: validationErrors
            });
        }

        // Execute batch publication atomically in transaction
        const publishedRecords = await prisma.$transaction(async (tx) => {
            const results = [];
            for (const item of validatedReleases) {
                // Supersede existing current publications
                await tx.helpPublication.updateMany({
                    where: { articleId: item.articleId, isCurrent: true },
                    data: { isCurrent: false }
                });

                // Create new publication
                const pub = await tx.helpPublication.create({
                    data: {
                        articleId: item.articleId,
                        revisionId: item.revisionId,
                        publishedBy: user.username || user.id,
                        publishedAt: new Date(),
                        approvedLocales: JSON.stringify(item.approvedLocales),
                        isCurrent: true
                    }
                });
                results.push(pub);
            }
            return results;
        });

        const localeCounts = {};
        validatedReleases.forEach(r => {
            r.approvedLocales.forEach(loc => {
                localeCounts[loc] = (localeCounts[loc] || 0) + 1;
            });
        });

        res.json({
            success: true,
            publishedCount: publishedRecords.length,
            publishedAt: new Date().toISOString(),
            publishedBy: user.username || user.id,
            localeCounts,
            message: `Successfully published ${publishedRecords.length} articles across languages: ${Object.keys(localeCounts).join(', ')}.`
        });
    } catch (err) {
        console.error('[ADMIN_HELP_CONTROLLER] batchPublish error:', err);
        res.status(500).json({ error: 'Failed to execute batch publication' });
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
    saveLabNote,
    getReleasePreview,
    batchPublish
};
