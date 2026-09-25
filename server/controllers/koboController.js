/**
 * Kobo Integration Controller
 * Handles API endpoints for Kobo configuration and sync
 */
const prisma = require('../prisma');
const koboService = require('../services/koboService');
const projectPolicyService = require('../services/projectPolicyService');
const workflow = require('../workflowContract');
const crypto = require('crypto');

async function assertLabAccess(actor, targetLabId) {
    if (!actor) return false;
    if (['SUPER_ADMIN', 'ADMIN'].includes(actor.role)) return true;
    if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(actor.role)) {
        const countries = Array.isArray(actor.countries)
            ? actor.countries
            : (typeof actor.countries === 'string' ? JSON.parse(actor.countries) : []);
        const lab = await prisma.lab.findFirst({
            where: { OR: [{ id: targetLabId }, { code: targetLabId }] }
        });
        return !!(lab && countries.includes(lab.country));
    }
    return actor.labId === targetLabId;
}


/**
 * GET /api/kobo/configs
 * Get all Kobo configurations (admin only)
 */
exports.getAllConfigs = async (req, res) => {
    try {
        const actor = req.user;
        let where = {};
        if (actor.role === 'SUPER_ADMIN') {
            where = {};
        } else if (actor.role === 'MASTER_USER') {
            const countries = Array.isArray(actor.countries)
                ? actor.countries
                : (typeof actor.countries === 'string' ? JSON.parse(actor.countries) : []);
            const labs = await prisma.lab.findMany({
                where: { country: { in: countries } },
                select: { id: true }
            });
            where = { labId: { in: labs.map(l => l.id) } };
        } else if (actor.labId) {
            where = { labId: actor.labId };
        } else {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Unauthorized to list Kobo configurations' });
        }

        const configs = await prisma.koboConfig.findMany({
            where,
            orderBy: { labId: 'asc' }
        });

        const maskedConfigs = configs.map(c => ({
            ...c,
            apiToken: c.apiToken ? '••••••••' + c.apiToken.slice(-4) : null
        }));

        res.json(maskedConfigs);
    } catch (error) {
        console.error('[KOBO] Error fetching configs:', error);
        res.status(500).json({ error: 'Failed to fetch Kobo configurations' });
    }
};

/**
 * GET /api/kobo/config/:labId
 * Get Kobo configuration for a specific lab
 */
exports.getConfig = async (req, res) => {
    try {
        const { labId } = req.params;
        const allowed = await assertLabAccess(req.user, labId);
        if (!allowed) {
            return res.status(403).json({ error: 'TARGET_OUTSIDE_SCOPE', message: 'Target laboratory outside authorized scope' });
        }

        const config = await prisma.koboConfig.findFirst({
            where: { labId, isActive: true }
        });

        if (!config) {
            return res.json({ configured: false, labId });
        }

        res.json({
            ...config,
            apiToken: config.apiToken ? '••••••••' + config.apiToken.slice(-4) : null,
            configured: true
        });
    } catch (error) {
        console.error('[KOBO] Error fetching config:', error);
        res.status(500).json({ error: 'Failed to fetch configuration' });
    }
};

/**
 * PUT /api/kobo/config/:labId
 * Create or update Kobo configuration for a lab
 */
exports.upsertConfig = async (req, res) => {
    try {
        const { labId } = req.params;
        const allowed = await assertLabAccess(req.user, labId);
        if (!allowed) {
            return res.status(403).json({ error: 'TARGET_OUTSIDE_SCOPE', message: 'Target laboratory outside authorized scope' });
        }
        const { koboServerUrl, formId, apiToken, labName, fieldMapping, syncIntervalMins, isActive, projectCode } = req.body;

        if (!formId || !apiToken) {
            return res.status(400).json({ error: 'Form ID and API Token are required' });
        }

        if (!projectCode || !String(projectCode).trim()) {
            return res.status(400).json({
                error: 'PROJECT_CODE_REQUIRED',
                message: 'Explicit projectCode is required for Kobo configuration. Null-project mappings are retired.'
            });
        }

        const targetProjectCode = String(projectCode).trim();
        const linkedProject = await prisma.project.findFirst({
            where: { OR: [{ code: targetProjectCode }, { id: targetProjectCode }] }
        });
        if (!linkedProject) {
            return res.status(404).json({
                error: 'PROJECT_NOT_FOUND',
                message: `Project '${targetProjectCode}' not found.`
            });
        }

        const existing = await prisma.koboConfig.findFirst({
            where: {
                labId,
                projectCode: targetProjectCode
            }
        });

        let config;
        if (existing) {
            config = await prisma.koboConfig.update({
                where: { id: existing.id },
                data: {
                    koboServerUrl: koboServerUrl || 'https://kf.kobotoolbox.org',
                    formId,
                    apiToken,
                    labName,
                    projectCode: targetProjectCode || existing.projectCode,
                    fieldMapping: fieldMapping ? JSON.stringify(fieldMapping) : null,
                    syncIntervalMins: syncIntervalMins || 15,
                    isActive: isActive !== false
                }
            });
        } else {
            config = await prisma.koboConfig.create({
                data: {
                    labId,
                    koboServerUrl: koboServerUrl || 'https://kf.kobotoolbox.org',
                    formId,
                    apiToken,
                    labName,
                    projectCode: targetProjectCode,
                    fieldMapping: fieldMapping ? JSON.stringify(fieldMapping) : null,
                    syncIntervalMins: syncIntervalMins || 15,
                    isActive: isActive !== false
                }
            });
        }

        res.json({
            success: true,
            message: `Kobo configuration saved for ${labId}`,
            config: { ...config, apiToken: '••••••••' + config.apiToken.slice(-4) }
        });
    } catch (error) {
        console.error('[KOBO] Error saving config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
};

/**
 * POST /api/kobo/test
 * Test Kobo connection with provided credentials
 */
exports.testConnection = async (req, res) => {
    try {
        const { koboServerUrl, formId, apiToken } = req.body;

        if (!formId || !apiToken) {
            return res.status(400).json({ error: 'Form ID and API Token are required' });
        }

        const result = await koboService.testConnection(
            koboServerUrl || 'https://kf.kobotoolbox.org',
            formId,
            apiToken
        );

        res.json(result);
    } catch (error) {
        console.error('[KOBO] Test connection error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * GET /api/kobo/form-fields/:labId
 * Get form field structure for mapping configuration
 */
exports.getFormFields = async (req, res) => {
    try {
        const { labId } = req.params;
        const allowed = await assertLabAccess(req.user, labId);
        if (!allowed) {
            return res.status(403).json({ error: 'TARGET_OUTSIDE_SCOPE', message: 'Target laboratory outside authorized scope' });
        }

        const config = await prisma.koboConfig.findFirst({
            where: { labId, isActive: true }
        });

        if (!config) {
            return res.status(404).json({ error: 'Kobo not configured for this lab' });
        }

        const fields = await koboService.getFormFields(
            config.koboServerUrl,
            config.formId,
            config.apiToken
        );

        res.json({ fields });
    } catch (error) {
        console.error('[KOBO] Error getting form fields:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/kobo/sync/:labId
 * Manually trigger sync for a specific lab
 */
exports.syncLab = async (req, res) => {
    try {
        const { labId } = req.params;
        const allowed = await assertLabAccess(req.user, labId);
        if (!allowed) {
            return res.status(403).json({ error: 'TARGET_OUTSIDE_SCOPE', message: 'Target laboratory outside authorized scope' });
        }

        const lab = await prisma.lab.findFirst({
            where: { OR: [{ id: labId }, { code: labId }] }
        });
        if (!lab) {
            return res.status(404).json({ error: 'NOT_FOUND', message: 'Target laboratory does not exist' });
        }
        if (!lab.isActive) {
            return res.status(400).json({ error: 'LAB_INACTIVE', message: `Laboratory '${lab.name || labId}' is inactive. Sample intake is disallowed for inactive laboratories.` });
        }

        const configId = req.query?.configId || req.body?.configId;
        const projectCode = req.query?.projectCode || req.body?.projectCode;

        const whereClause = { labId: lab.id, isActive: true };
        if (configId) whereClause.id = configId;
        if (projectCode) whereClause.projectCode = projectCode;

        const configs = await prisma.koboConfig.findMany({
            where: whereClause
        });

        if (configs.length === 0) {
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: 'No active Kobo configuration found for this laboratory matching the specified parameters'
            });
        }

        if (configs.length > 1) {
            return res.status(400).json({
                error: 'AMBIGUOUS_CONFIG_TARGET',
                message: 'Multiple active Kobo configurations exist for this laboratory. Explicit configId or projectCode is required.'
            });
        }

        const result = await syncLabSubmissions(configs[0], req.user?.username || 'SYSTEM');

        res.json(result);
    } catch (error) {
        console.error('[KOBO] Sync error:', error);
        if (error.message?.includes('LAB_INACTIVE') || error.message?.includes('CONFIG_INACTIVE') || error.message?.includes('CONFIG_REVOKED')) {
            return res.status(400).json({ error: 'PRECONDITION_FAILED', message: error.message });
        }
        if (error.message?.includes('MEMBERSHIP_NOT_AUTHORIZED') || error.message?.includes('MEMBERSHIP_REVOKED')) {
            return res.status(403).json({ error: 'FORBIDDEN', message: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};

/**
 * POST /api/kobo/sync-all
 * Sync all active Kobo configurations (used by scheduler)
 */
exports.syncAll = async (req, res) => {
    try {
        if (req.user && req.user.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'FORBIDDEN', message: 'Global sync-all is restricted to Super Administrators' });
        }
        const configs = await prisma.koboConfig.findMany({
            where: { isActive: true }
        });

        const results = [];
        for (const config of configs) {
            try {
                const result = await syncLabSubmissions(config, 'SCHEDULER');
                results.push({ labId: config.labId, configId: config.id, projectCode: config.projectCode, ...result });
            } catch (error) {
                results.push({ labId: config.labId, configId: config.id, projectCode: config.projectCode, error: error.message });
            }
        }

        res.json({ synced: results.length, results });
    } catch (error) {
        console.error('[KOBO] Sync all error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Internal: Sync submissions for a specific lab config
 */
async function syncLabSubmissions(config, performedBy) {
    console.log(`[KOBO] Starting sync for ${config.labId}...`);

    // 1. Pre-fetch verification of active configuration
    const currentConfig = await prisma.koboConfig.findUnique({
        where: { id: config.id }
    });
    if (!currentConfig || !currentConfig.isActive) {
        throw new Error(`CONFIG_INACTIVE: Kobo configuration '${config.id}' is inactive or has been revoked.`);
    }

    // 2. Pre-fetch verification of active laboratory
    const lab = await prisma.lab.findFirst({
        where: { OR: [{ id: currentConfig.labId }, { code: currentConfig.labId }] },
        include: { projectLabs: { include: { project: true } } }
    });
    if (!lab) {
        throw new Error(`LAB_NOT_FOUND: Laboratory '${currentConfig.labId}' not found.`);
    }
    if (!lab.isActive) {
        throw new Error(`LAB_INACTIVE: Laboratory '${lab.name || currentConfig.labId}' is inactive. Intake disallowed.`);
    }

    const labInfo = {
        iso: lab.code?.split('-')[0] || lab.country || 'GEN',
        name: lab.name || currentConfig.labName || 'Unknown'
    };

    // PM-15 / A17: First-project fallback is disallowed. Explicit config.projectCode is required.
    if (!currentConfig.projectCode) {
        throw new Error(`[KOBO] Configuration '${currentConfig.id || currentConfig.formId}' for laboratory '${currentConfig.labId}' lacks an explicit project mapping (projectCode). First-project fallback is disallowed.`);
    }
    const projectCode = currentConfig.projectCode;

    // 3. Pre-fetch verification of project existence and admissions status
    const project = await prisma.project.findUnique({ where: { code: projectCode } });
    if (!project) {
        throw new Error(`[KOBO] Configured project '${projectCode}' does not exist in the database.`);
    }

    // 4. Pre-fetch verification of servicing laboratory authorization
    const projectMembershipService = require('../services/projectMembershipService');
    const { allMemberLabIds } = await projectMembershipService.resolveProjectLabs(project);
    if (!allMemberLabIds.includes(currentConfig.labId)) {
        throw new Error(`MEMBERSHIP_NOT_AUTHORIZED: Laboratory '${currentConfig.labId}' is not an authorized servicing laboratory for project '${projectCode}'.`);
    }

    // Admissions policy check: skip intake if admissions are paused, closed, or project inactive
    const preAdmission = projectPolicyService.canAdmitSample({
        project,
        channel: 'KOBO',
        labId: currentConfig.labId
    });
    if (!preAdmission.allowed) {
        console.warn(`[KOBO] Admission blocked for project '${projectCode}': ${preAdmission.reason}`);
        return {
            newSamples: 0,
            skipped: 0,
            message: preAdmission.reason,
            lastSubmissionId: currentConfig.lastSubmissionId
        };
    }

    // Fetch submissions from Kobo
    const submissions = await koboService.fetchSubmissions(
        currentConfig.koboServerUrl,
        currentConfig.formId,
        currentConfig.apiToken,
        currentConfig.lastSubmissionId
    );

    if (!submissions || submissions.length === 0) {
        await prisma.koboConfig.update({
            where: { id: currentConfig.id },
            data: { lastSyncAt: new Date() }
        });
        return { newSamples: 0, skipped: 0, message: 'No new submissions', lastSubmissionId: currentConfig.lastSubmissionId };
    }

    // Get existing sample IDs to avoid duplicates
    const existingSamples = await prisma.sample.findMany({
        select: { originalId: true }
    });
    const existingIds = new Set(existingSamples.map(s => s.originalId?.trim().toUpperCase()).filter(Boolean));

    // Parse field mapping
    const fieldMapping = currentConfig.fieldMapping ? JSON.parse(currentConfig.fieldMapping) : null;

    let newCount = 0;
    let skippedCount = 0;
    const skippedReasons = [];
    let lastCommittedSubmissionId = currentConfig.lastSubmissionId;
    let hasRetriableSkip = false;

    for (const submission of submissions) {
        // Transform submission to samples (could be 1 or 2 per submission)
        const rawSamples = koboService.transformSubmission(submission, fieldMapping, currentConfig.labId);
        const samples = Array.isArray(rawSamples) ? rawSamples : (rawSamples ? [rawSamples] : []);

        const candidateSamples = [];
        const seenInSub = new Map();
        const intraSubDuplicates = [];
        const crossSubDuplicates = [];

        for (const sampleData of samples) {
            const normalizedId = sampleData.original_id?.trim().toUpperCase();

            if (!normalizedId) {
                skippedCount++;
                continue;
            }

            // Detect intra-submission duplicate barcode (e.g. surveyor entered same barcode for D1 and D2)
            if (seenInSub.has(normalizedId)) {
                skippedCount++;
                intraSubDuplicates.push({
                    primarySample: seenInSub.get(normalizedId),
                    duplicateSample: sampleData
                });
                continue;
            }

            // Detect cross-submission duplicate (already exists in DB or prior committed batch)
            if (existingIds.has(normalizedId)) {
                skippedCount++;
                crossSubDuplicates.push(sampleData);
                continue;
            }

            seenInSub.set(normalizedId, sampleData);
            candidateSamples.push(sampleData);
        }

        // Attach intra-submission duplicate occurrences to primary candidate sample
        for (const dup of intraSubDuplicates) {
            if (!dup.primarySample.intraSubDuplicates) {
                dup.primarySample.intraSubDuplicates = [];
            }
            dup.primarySample.intraSubDuplicates.push({
                depth: dup.duplicateSample.depth,
                site_id: dup.duplicateSample.site_id,
                collected_at: dup.duplicateSample.collected_at,
                kobo_submission_id: submission._id,
                reason: 'INTRA_SUBMISSION_DUPLICATE_BARCODE'
            });
        }

        // If all candidate samples were permanent duplicates
        if (candidateSamples.length === 0) {
            // Preserve conflicting duplicate provenance for cross-submission duplicate records
            if (crossSubDuplicates.length > 0 && !hasRetriableSkip) {
                try {
                    await prisma.$transaction(async (tx) => {
                        for (const dupSample of crossSubDuplicates) {
                            const normId = dupSample.original_id?.trim().toUpperCase();
                            const existingSample = await tx.sample.findFirst({
                                where: { originalId: normId }
                            });
                            if (existingSample) {
                                let meta = {};
                                try { meta = JSON.parse(existingSample.metadata || '{}'); } catch (e) {}
                                if (String(meta.kobo_id) !== String(submission._id)) {
                                    const conflicting = meta.conflictingSubmissions || [];
                                    conflicting.push({
                                        kobo_id: submission._id,
                                        kobo_uuid: submission._uuid,
                                        submission_time: submission._submission_time,
                                        surveyor: koboService.findValue(submission, ['surveyor_name', 'username']),
                                        site_id: dupSample.site_id,
                                        depth: dupSample.depth,
                                        lat: dupSample.lat,
                                        lng: dupSample.lng,
                                        collected_at: dupSample.collected_at,
                                        attachments: (submission._attachments || []).map(a => a.filename),
                                        recordedAt: new Date().toISOString()
                                    });
                                    meta.conflictingSubmissions = conflicting;
                                    await tx.sample.update({
                                        where: { id: existingSample.id },
                                        data: { metadata: JSON.stringify(meta) }
                                    });
                                    await tx.auditLog.create({
                                        data: {
                                            id: crypto.randomUUID(),
                                            entity: 'SAMPLE',
                                            entityId: existingSample.id,
                                            action: 'KOBO_CONFLICTING_PROVENANCE',
                                            performedBy: performedBy,
                                            timestamp: new Date()
                                        }
                                    });
                                }
                            }
                        }
                    });
                } catch (dupAuditErr) {
                    console.warn('[KOBO] Conflicting duplicate provenance preservation notice:', dupAuditErr.message);
                }
            }

            if (!hasRetriableSkip) {
                const subIdNum = Number(submission._id);
                const lastIdNum = Number(lastCommittedSubmissionId || 0);
                if (!isNaN(subIdNum) && !isNaN(lastIdNum)) {
                    if (subIdNum > lastIdNum) lastCommittedSubmissionId = String(submission._id);
                } else {
                    lastCommittedSubmissionId = String(submission._id);
                }
            }
            continue;
        }

        // If an earlier submission in this batch suffered a retriable skip, halt cursor progression
        if (hasRetriableSkip) {
            skippedCount += candidateSamples.length;
            for (const sampleData of candidateSamples) {
                skippedReasons.push({
                    originalId: sampleData.original_id,
                    reason: 'RETRIABLE_SKIP_CASCADE: Cursor halted due to earlier uncommitted specimens'
                });
            }
            continue;
        }

        try {
            await prisma.$transaction(async (tx) => {
                // 1. Commit-time verification of active laboratory inside transaction
                const commitLab = await tx.lab.findFirst({
                    where: { OR: [{ id: currentConfig.labId }, { code: currentConfig.labId }] }
                });
                if (!commitLab || !commitLab.isActive) {
                    throw new Error(`LAB_INACTIVE: Laboratory '${currentConfig.labId}' is inactive`);
                }

                // 2. Commit-time verification of active & non-remapped configuration
                const commitConfig = await tx.koboConfig.findUnique({
                    where: { id: currentConfig.id }
                });
                if (!commitConfig || !commitConfig.isActive || commitConfig.projectCode !== projectCode) {
                    throw new Error(`CONFIG_REVOKED: Kobo configuration '${currentConfig.id}' is inactive or remapped`);
                }

                // 3. Commit-time verification of active project admissions and lab membership
                const currentProject = await tx.project.findUnique({
                    where: { code: projectCode },
                    include: { projectLabs: true }
                });
                if (!currentProject) {
                    throw new Error(`PROJECT_NOT_FOUND: Project '${projectCode}' does not exist`);
                }
                const admission = projectPolicyService.canAdmitSample({
                    project: currentProject,
                    channel: 'KOBO',
                    labId: currentConfig.labId
                });
                if (!admission.allowed) {
                    throw new Error(`ADMISSION_POLICY_BLOCKED: Project '${projectCode}' admissions are ${currentProject?.status || 'BLOCKED'}: ${admission.reason}`);
                }
                const currentMembers = [currentProject.labId, ...(currentProject.projectLabs || []).map(pl => pl.labId)].filter(Boolean);
                if (!currentMembers.includes(currentConfig.labId)) {
                    throw new Error(`MEMBERSHIP_REVOKED: Laboratory '${currentConfig.labId}' is not an authorized servicing laboratory for project '${projectCode}'`);
                }

                for (const sampleData of candidateSamples) {
                    const sampleId = crypto.randomUUID();

                    const processedAttachments = (submission._attachments || []).map(a => ({
                        filename: a.filename?.split('/').pop() || a.filename,
                        category: categorizePhoto(a.question_xpath),
                        categoryLabel: photoLabel(categorizePhoto(a.question_xpath)),
                        question: a.question_xpath,
                        download_url: a.download_url,
                        download_small: a.download_small_url,
                        download_medium: a.download_medium_url,
                        download_large: a.download_large_url,
                        mimetype: a.mimetype
                    }));

                    const now = new Date().toISOString();
                    const fm = (value) => ({ value, source: 'KOBO', lastUpdatedAt: now, lastUpdatedBy: 'SYNC' });

                    const fieldMetadata = {
                        site_id: fm(sampleData.site_id),
                        depth: fm(sampleData.depth),
                        latitude: fm(sampleData.lat),
                        longitude: fm(sampleData.lng),
                        collectionDate: fm(sampleData.collected_at),
                        kobo_submission_id: fm(sampleData.kobo_submission_id),
                        surveyor: fm(koboService.findValue(submission, ['surveyor_name', 'username'])),
                        province: fm(koboService.findValue(submission, ['selected_province', 'provincia'])),
                        land_cover: fm(koboService.findValue(submission, ['land_cover_types', 'landcover', 'cobertura_terreno'])),
                        attachments: fm(processedAttachments)
                    };

                    const compactMeta = {
                        kobo_id: submission._id,
                        kobo_uuid: submission._uuid,
                        surveyor: koboService.findValue(submission, ['surveyor_name', 'username']),
                        site_id: sampleData.site_id,
                        province: koboService.findValue(submission, ['selected_province', 'provincia']),
                        land_cover: koboService.findValue(submission, ['land_cover_types', 'landcover', 'cobertura_terreno']),
                        accessibility: koboService.findValue(submission, ['accessibility_status']),
                        sampling_succeeded: koboService.findValue(submission, ['sampling_succeeded', 'muestreo_exitoso']),
                        submission_time: submission._submission_time,
                        attachments: processedAttachments,
                        intraSubDuplicates: sampleData.intraSubDuplicates || undefined
                    };

                    await tx.sample.create({
                        data: {
                            id: sampleId,
                            originalId: sampleData.original_id,
                            projectCode: projectCode,
                            projectId: currentProject.id,
                            country: labInfo.iso,
                            countryName: labInfo.name,
                            labId: null,
                            assignedLab: currentConfig.labId,
                            status: workflow.SAMPLE_STATES.EXPECTED,
                            metadata: JSON.stringify(compactMeta),
                            fieldMetadata: JSON.stringify(fieldMetadata),
                            receptionDate: null
                        }
                    });

                    await tx.auditLog.create({
                        data: {
                            id: crypto.randomUUID(),
                            entity: 'SAMPLE',
                            entityId: sampleId,
                            action: 'CREATE_KOBO_SYNC',
                            performedBy: performedBy,
                            timestamp: new Date()
                        }
                    });

                    if (sampleData.intraSubDuplicates && sampleData.intraSubDuplicates.length > 0) {
                        await tx.auditLog.create({
                            data: {
                                id: crypto.randomUUID(),
                                entity: 'SAMPLE',
                                entityId: sampleId,
                                action: 'KOBO_INTRA_SUBMISSION_DUPLICATE',
                                performedBy: performedBy,
                                timestamp: new Date()
                            }
                        });
                    }
                }

                for (const dupSample of crossSubDuplicates) {
                    const normId = dupSample.original_id?.trim().toUpperCase();
                    const existingSample = await tx.sample.findFirst({
                        where: { originalId: normId }
                    });
                    if (existingSample) {
                        let meta = {};
                        try { meta = JSON.parse(existingSample.metadata || '{}'); } catch (e) {}
                        if (String(meta.kobo_id) !== String(submission._id)) {
                            const conflicting = meta.conflictingSubmissions || [];
                            conflicting.push({
                                kobo_id: submission._id,
                                kobo_uuid: submission._uuid,
                                submission_time: submission._submission_time,
                                surveyor: koboService.findValue(submission, ['surveyor_name', 'username']),
                                site_id: dupSample.site_id,
                                depth: dupSample.depth,
                                lat: dupSample.lat,
                                lng: dupSample.lng,
                                collected_at: dupSample.collected_at,
                                attachments: (submission._attachments || []).map(a => a.filename),
                                recordedAt: new Date().toISOString()
                            });
                            meta.conflictingSubmissions = conflicting;
                            await tx.sample.update({
                                where: { id: existingSample.id },
                                data: { metadata: JSON.stringify(meta) }
                            });
                            await tx.auditLog.create({
                                data: {
                                    id: crypto.randomUUID(),
                                    entity: 'SAMPLE',
                                    entityId: existingSample.id,
                                    action: 'KOBO_CONFLICTING_PROVENANCE',
                                    performedBy: performedBy,
                                    timestamp: new Date()
                                }
                            });
                        }
                    }
                }
            });

            newCount += candidateSamples.length;
            for (const sampleData of candidateSamples) {
                existingIds.add(sampleData.original_id.trim().toUpperCase());
            }

            const subIdNum = Number(submission._id);
            const lastIdNum = Number(lastCommittedSubmissionId || 0);
            if (!isNaN(subIdNum) && !isNaN(lastIdNum)) {
                if (subIdNum > lastIdNum) lastCommittedSubmissionId = String(submission._id);
            } else {
                lastCommittedSubmissionId = String(submission._id);
            }
        } catch (err) {
            if (
                err.message?.includes('ADMISSION_POLICY_BLOCKED') ||
                err.message?.includes('MEMBERSHIP_REVOKED') ||
                err.message?.includes('LAB_INACTIVE') ||
                err.message?.includes('CONFIG_REVOKED')
            ) {
                skippedCount += candidateSamples.length;
                for (const sampleData of candidateSamples) {
                    skippedReasons.push({ originalId: sampleData.original_id, reason: err.message });
                }
                hasRetriableSkip = true;
                continue;
            }
            throw err;
        }
    }

    // Update last sync info: only advance lastSubmissionId if it successfully progressed
    const configUpdate = { lastSyncAt: new Date() };
    if (lastCommittedSubmissionId && lastCommittedSubmissionId !== currentConfig.lastSubmissionId) {
        configUpdate.lastSubmissionId = lastCommittedSubmissionId;
    }
    await prisma.koboConfig.update({
        where: { id: currentConfig.id },
        data: configUpdate
    });

    // Send notification to lab managers if new samples were synced
    if (newCount > 0) {
        const managers = await prisma.user.findMany({
            where: { labId: currentConfig.labId, role: 'LAB_MANAGER', isActive: true }
        });

        if (managers.length > 0) {
            const notifications = managers.map(m => ({
                id: crypto.randomUUID(),
                userId: m.id,
                title: '🌾 New Field Samples Collected',
                message: `${newCount} new sample${newCount > 1 ? 's' : ''} synced from Kobo (${labInfo.name})`,
                type: 'SUCCESS',
                link: `/samples?view=expected&projects=${encodeURIComponent(projectCode)}&labs=${encodeURIComponent(currentConfig.labId)}`,
                createdAt: new Date()
            }));
            await prisma.notification.createMany({ data: notifications });
        }
    }

    console.log(`[KOBO] Sync complete for ${currentConfig.labId}: ${newCount} new, ${skippedCount} skipped`);

    return {
        newSamples: newCount,
        skipped: skippedCount,
        lastSubmissionId: lastCommittedSubmissionId || currentConfig.lastSubmissionId,
        skippedReasons: skippedReasons.length > 0 ? skippedReasons : undefined
    };
}

// Helper: categorize photo by Kobo question_xpath
function categorizePhoto(xpath) {
    if (!xpath) return 'other';
    const x = xpath.toLowerCase();
    if (x.includes('photo_north') || x.includes('foto_norte')) return 'north';
    if (x.includes('photo_south') || x.includes('foto_sur')) return 'south';
    if (x.includes('photo_east') || x.includes('foto_este')) return 'east';
    if (x.includes('photo_west') || x.includes('foto_oeste')) return 'west';
    if (x.includes('photo_soil') || x.includes('foto_suelo')) return 'soil';
    if (x.includes('photo_sample') || x.includes('foto_muestra')) return 'sample';
    if (x.includes('participant_signature') || x.includes('firma_participante')) return 'participant_signature';
    if (x.includes('surveyor_signature') || x.includes('firma_encuestador')) return 'surveyor_signature';
    if (x.includes('photo') || x.includes('foto') || x.includes('image')) return 'site_photo';
    if (x.includes('signature') || x.includes('firma')) return 'signature';
    return 'other';
}

function photoLabel(cat) {
    const labels = {
        north: '📷 North View', south: '📷 South View', east: '📷 East View', west: '📷 West View',
        soil: '🌍 Soil Sample', sample: '🧪 Sample Photo', site_photo: '📷 Site Photo',
        participant_signature: '✍️ Participant Signature', surveyor_signature: '✍️ Surveyor Signature',
        signature: '✍️ Signature', other: '📎 Other'
    };
    return labels[cat] || cat;
}

exports.categorizePhoto = categorizePhoto;
exports.photoLabel = photoLabel;

/**
 * POST /api/kobo/sync-sample/:sampleId
 * Force-sync a specific sample from Kobo data
 * Finds the matching submission and backfills metadata
 */
exports.syncSample = async (req, res) => {
    try {
        const { sampleId } = req.params;

        // 1. Get the sample
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // Actor authorization check (F09)
        const scopeGuard = require('../utils/scopeGuard');
        try {
            scopeGuard.ensureScope(req.user, sample, { altLabField: 'assignedLab' });
        } catch (authErr) {
            return res.status(403).json({ error: 'FORBIDDEN_SCOPE', message: authErr.message });
        }

        // Protected / released record check (F09)
        if (['RELEASED', 'APPROVED', 'ARCHIVED'].includes(sample.status)) {
            return res.status(409).json({
                error: 'SAMPLE_RELEASED',
                message: `Sample ${sample.id} is in status '${sample.status}'. Field metadata cannot be overwritten without an authorized amendment.`
            });
        }

        // 2. Find the Kobo config scoped strictly to project and lab (F09 & Finding 2)
        const labId = sample.assignedLab || sample.labId || req.user?.labId;
        if (!labId) return res.status(400).json({ error: 'Cannot determine lab for this sample' });

        const projectIdentifier = sample.projectCode || sample.projectId;
        if (!projectIdentifier) {
            return res.status(400).json({
                error: 'UNASSIGNED_PROJECT',
                message: `Sample ${sample.originalId || sampleId} has no assigned project. Kobo resync requires an explicit project connection.`
            });
        }

        const config = await prisma.koboConfig.findFirst({
            where: {
                labId,
                isActive: true,
                OR: [
                    { projectCode: projectIdentifier },
                    { projectCode: sample.projectCode || '' },
                    { projectCode: sample.projectId || '' }
                ]
            }
        });

        if (!config) {
            return res.status(404).json({
                error: 'NO_CONFIG_MATCH',
                message: `No active Kobo configuration matches laboratory '${labId}' and project '${projectIdentifier}'. Arbitrary laboratory form fallback is prohibited.`
            });
        }

        // 3. Fetch ALL submissions from Kobo
        console.log(`[KOBO] Force sync sample ${sample.originalId} from ${config.labId}...`);
        const submissions = await koboService.fetchSubmissions(
            config.koboServerUrl, config.formId, config.apiToken, null
        );

        if (submissions.length === 0) {
            return res.json({ success: false, message: 'No submissions found in Kobo form' });
        }

        // 4. Depth-Aware ID matching (Fix SCI-02: Do NOT strip depth suffixes!)
        const normalizeId = (id) => {
            if (!id) return '';
            return id.trim().toUpperCase().replace(/[_\s-]/g, ''); // normalize separators without stripping depth
        };

        const targetOriginal = sample.originalId?.trim().toUpperCase();
        const targetNormalized = normalizeId(sample.originalId);

        const fieldMapping = config.fieldMapping ? JSON.parse(config.fieldMapping) : null;
        let matchedSubmission = null;
        let matchedSampleData = null;

        for (const submission of submissions) {
            const samples = koboService.transformSubmission(submission, fieldMapping, config.labId);

            for (const sampleData of samples) {
                const koboId = sampleData.original_id?.trim().toUpperCase();
                const koboSiteId = sampleData.site_id?.trim().toUpperCase();

                // Tier 1: Exact match
                if (koboId === targetOriginal) {
                    matchedSubmission = submission;
                    matchedSampleData = sampleData;
                    break;
                }

                // Tier 2: Normalized separator match (depth intact)
                if (normalizeId(koboId) === targetNormalized) {
                    matchedSubmission = submission;
                    matchedSampleData = sampleData;
                    break;
                }

                // Tier 3: Site ID match with explicit depth verification
                if (koboSiteId && (normalizeId(koboSiteId) === targetNormalized || koboSiteId === targetOriginal)) {
                    // Check if sample depth matches kobo depth (e.g. D1/T vs D2/S)
                    const sampleDepth = (sample.horizon || sample.depthTop === 0 ? 'D1' : 'D2');
                    if (!sampleData.depth || sampleData.depth === sampleDepth || sampleData.depth === sample.horizon) {
                        matchedSubmission = submission;
                        matchedSampleData = sampleData;
                        break;
                    }
                }
            }
            if (matchedSubmission) break;
        }

        // Tier 4: Raw site_id fallback (for submissions where transformSubmission returns 0 samples)
        if (!matchedSubmission) {
            const targetUnderscore = targetOriginal?.replace(/-/g, '_');
            for (const submission of submissions) {
                const rawSiteId = koboService.findValue(submission, ['site_id', 'codigo_sitio'])?.trim().toUpperCase();
                if (rawSiteId === targetOriginal || rawSiteId === targetUnderscore || normalize(rawSiteId) === targetNormalized) {
                    matchedSubmission = submission;
                    // Create minimal sampleData from raw submission
                    let lat = 0, lng = 0;
                    if (submission._geolocation && Array.isArray(submission._geolocation)) {
                        lat = submission._geolocation[0] || 0;
                        lng = submission._geolocation[1] || 0;
                    }
                    matchedSampleData = {
                        site_id: rawSiteId,
                        original_id: sample.originalId,
                        depth: null,
                        lat, lng,
                        collected_at: submission.today || submission.start || submission._submission_time,
                        kobo_submission_id: submission._id
                    };
                    break;
                }
            }
        }

        if (!matchedSubmission) {
            return res.json({
                success: false,
                message: `Sample ${sample.originalId} not found in ${submissions.length} Kobo submissions for ${config.labId}`
            });
        }

        // 5. Build rich metadata from matched submission
        const attachments = (matchedSubmission._attachments || []).map(a => ({
            filename: a.filename?.split('/').pop() || a.filename,
            category: categorizePhoto(a.question_xpath),
            categoryLabel: photoLabel(categorizePhoto(a.question_xpath)),
            question: a.question_xpath,
            download_url: a.download_url,
            download_small: a.download_small_url,
            download_medium: a.download_medium_url,
            download_large: a.download_large_url,
            mimetype: a.mimetype
        }));

        const compactMeta = {
            kobo_id: matchedSubmission._id,
            kobo_uuid: matchedSubmission._uuid,
            surveyor: koboService.findValue(matchedSubmission, ['surveyor_name', 'username']),
            site_id: matchedSampleData.site_id,
            province: koboService.findValue(matchedSubmission, ['selected_province', 'provincia']),
            land_cover: koboService.findValue(matchedSubmission, ['land_cover_types', 'landcover', 'cobertura_terreno']),
            accessibility: koboService.findValue(matchedSubmission, ['accessibility_status']),
            sampling_succeeded: koboService.findValue(matchedSubmission, ['sampling_succeeded', 'muestreo_exitoso']),
            submission_time: matchedSubmission._submission_time,
            attachments
        };

        const now = new Date().toISOString();
        const fm = (value) => ({ value, source: 'KOBO', lastUpdatedAt: now, lastUpdatedBy: req.user?.username || 'FORCE_SYNC' });
        const freshFieldMetadata = {
            site_id: fm(matchedSampleData.site_id),
            depth: fm(matchedSampleData.depth),
            latitude: fm(matchedSampleData.lat),
            longitude: fm(matchedSampleData.lng),
            collectionDate: fm(matchedSampleData.collected_at),
            kobo_submission_id: fm(matchedSampleData.kobo_submission_id),
            surveyor: fm(compactMeta.surveyor),
            province: fm(compactMeta.province),
            land_cover: fm(compactMeta.land_cover),
            attachments: fm(attachments)
        };

        const parseJson = (val, fallback = {}) => {
            if (!val) return fallback;
            if (typeof val === 'object') return val;
            try { return JSON.parse(val); } catch { return fallback; }
        };

        const existingFieldMeta = parseJson(sample.fieldMetadata, {});
        const existingCompactMeta = parseJson(sample.metadata, {});

        // Merge field metadata while strictly preserving manual overrides (Finding 2)
        const mergedFieldMeta = { ...existingFieldMeta };
        for (const [key, freshEntry] of Object.entries(freshFieldMetadata)) {
            const existingEntry = existingFieldMeta[key];
            if (existingEntry && (existingEntry.source === 'MANUAL' || existingEntry.isManualOverride || existingEntry.manuallyOverridden)) {
                // Preserve manual override
                continue;
            }
            mergedFieldMeta[key] = freshEntry;
        }

        const mergedMeta = { ...existingCompactMeta, ...compactMeta };

        // Atomic transaction: commit sample update and audit log together (Finding 2)
        await prisma.$transaction(async (tx) => {
            const currentSample = await tx.sample.findUnique({ where: { id: sampleId } });
            if (!currentSample) {
                throw new Error(`SAMPLE_NOT_FOUND: Sample '${sampleId}' was removed.`);
            }

            if (currentSample.projectId || currentSample.projectCode) {
                const curProject = await tx.project.findFirst({
                    where: { OR: [{ id: currentSample.projectId || '' }, { code: currentSample.projectCode || '' }] }
                });
                if (curProject && ['PAUSED', 'CLOSED', 'ARCHIVED', 'DELETED'].includes(curProject.status)) {
                    throw new Error(`PROJECT_${curProject.status}: Cannot resync sample; project admissions are ${curProject.status.toLowerCase()}.`);
                }
            }

            await tx.sample.update({
                where: { id: sampleId },
                data: {
                    metadata: JSON.stringify(mergedMeta),
                    fieldMetadata: JSON.stringify(mergedFieldMeta)
                }
            });

            await tx.auditLog.create({
                data: {
                    id: `audit-kobo-resync-${Date.now()}`,
                    entity: 'SAMPLE',
                    entityId: sample.id,
                    action: 'KOBO_SAMPLE_RESYNC',
                    details: `Resynced field metadata from Kobo form ${config.formId} for sample ${sample.originalId}`,
                    performedBy: req.user?.username || 'SYSTEM',
                    timestamp: new Date()
                }
            });
        });

        console.log(`[KOBO] ✅ Force synced ${sample.originalId} (matched ${matchedSampleData.original_id}): ${attachments.length} attachments`);
        res.json({ success: true, message: `Successfully synced ${sample.originalId} from Kobo` });
    } catch (error) {
        console.error('[KOBO] Force sync sample error:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * GET /api/kobo/media?url=<encodedKoboUrl>
 * Proxy Kobo attachment images through our server (adds auth token)
 */
exports.proxyMedia = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: 'Missing url parameter' });

        // SSRF protection: only allow HTTPS URLs to external hosts
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:') {
            return res.status(400).json({ error: 'Only HTTPS URLs are allowed' });
        }
        const hostname = parsedUrl.hostname;
        if (['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(hostname) ||
            hostname.startsWith('10.') || hostname.startsWith('172.') || hostname.startsWith('192.168.')) {
            return res.status(403).json({ error: 'Internal addresses are not allowed' });
        }

        // Find a KoboConfig with a matching server URL
        const configs = await prisma.koboConfig.findMany({
            where: { isActive: true },
            select: { koboServerUrl: true, apiToken: true }
        });

        const config = configs.find(c => {
            const configHost = new URL(c.koboServerUrl).host;
            return configHost === parsedUrl.host;
        });

        if (!config) {
            return res.status(404).json({ error: 'No Kobo config found for this server' });
        }

        // Fetch the image from Kobo with authentication
        const axios = require('axios');
        const response = await axios.get(url, {
            headers: { 'Authorization': `Token ${config.apiToken}` },
            responseType: 'stream',
            timeout: 15000
        });

        // Forward content type and cache for 1 hour
        res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=3600');
        response.data.pipe(res);
    } catch (error) {
        console.error('[KOBO] Media proxy error:', error.message);
        res.status(500).json({ error: 'Failed to fetch media' });
    }
};

// Expose internal functions for cross-controller use (auto-sync on project creation)
exports._syncLabSubmissions = syncLabSubmissions;

module.exports = exports;

