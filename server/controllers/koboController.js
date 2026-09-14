/**
 * Kobo Integration Controller
 * Handles API endpoints for Kobo configuration and sync
 */
const prisma = require('../prisma');
const koboService = require('../services/koboService');
const workflow = require('../workflowContract');
const crypto = require('crypto');

async function assertLabAccess(actor, targetLabId) {
    if (!actor) return false;
    if (actor.role === 'SUPER_ADMIN') return true;
    if (actor.role === 'MASTER_USER') {
        const countries = Array.isArray(actor.countries)
            ? actor.countries
            : (typeof actor.countries === 'string' ? JSON.parse(actor.countries) : []);
        const lab = await prisma.lab.findUnique({ where: { id: targetLabId } });
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
        const { koboServerUrl, formId, apiToken, labName, fieldMapping, syncIntervalMins, isActive } = req.body;

        if (!formId || !apiToken) {
            return res.status(400).json({ error: 'Form ID and API Token are required' });
        }

        const existing = await prisma.koboConfig.findFirst({
            where: { labId, projectCode: null }
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

        const config = await prisma.koboConfig.findFirst({
            where: { labId, isActive: true }
        });

        if (!config) {
            return res.status(404).json({ error: 'Kobo not configured for this lab' });
        }

        const result = await syncLabSubmissions(config, req.user?.username || 'SYSTEM');

        res.json(result);
    } catch (error) {
        console.error('[KOBO] Sync error:', error);
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
                results.push({ labId: config.labId, ...result });
            } catch (error) {
                results.push({ labId: config.labId, error: error.message });
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

    // Fetch submissions from Kobo
    const submissions = await koboService.fetchSubmissions(
        config.koboServerUrl,
        config.formId,
        config.apiToken,
        config.lastSubmissionId
    );

    if (submissions.length === 0) {
        return { newSamples: 0, skipped: 0, message: 'No new submissions' };
    }

    // Get existing sample IDs to avoid duplicates
    const existingSamples = await prisma.sample.findMany({
        select: { originalId: true }
    });
    const existingIds = new Set(existingSamples.map(s => s.originalId?.trim().toUpperCase()));

    // Parse field mapping
    const fieldMapping = config.fieldMapping ? JSON.parse(config.fieldMapping) : null;

    // Resolve lab and country info from database
    const lab = await prisma.lab.findFirst({
        where: { OR: [{ id: config.labId }, { code: config.labId }] },
        include: { projectLabs: { include: { project: true } } }
    });
    const labInfo = {
        iso: lab?.code?.split('-')[0] || lab?.country || 'GEN',
        name: lab?.name || config.labName || 'Unknown'
    };

    // Use config.projectCode if available, else derive from lab's assigned projects in database
    let projectCode = config.projectCode;
    if (!projectCode && lab?.projectLabs && lab.projectLabs.length > 0) {
        projectCode = lab.projectLabs[0].project?.code || lab.projectLabs[0].projectCode;
    }

    if (!projectCode) {
        throw new Error(`[KOBO] Laboratory '${config.labId}' has no assigned project configured. Import aborted.`);
    }

    // Get project by code
    const project = await prisma.project.findUnique({ where: { code: projectCode } });
    if (!project) {
        throw new Error(`[KOBO] Configured project '${projectCode}' does not exist in the database.`);
    }

    // Verify servicing laboratory is authorized for this project
    const projectMembershipService = require('../services/projectMembershipService');
    const { allMemberLabIds } = await projectMembershipService.resolveProjectLabs(project);
    if (!allMemberLabIds.includes(config.labId)) {
        throw new Error(`[KOBO] Laboratory '${config.labId}' is not an authorized servicing laboratory for project '${projectCode}'.`);
    }

    // Admissions policy check: skip intake if admissions are paused or closed
    if (['PAUSED', 'COMPLETED', 'ARCHIVED', 'CLOSED', 'DELETED'].includes(project.status)) {
        console.warn(`[KOBO] Admissions ${project.status.toLowerCase()} for project '${projectCode}'. Skipping new sample intake.`);
        return {
            newSamples: 0,
            skipped: submissions.length,
            message: `Project admissions ${project.status.toLowerCase()}`,
            lastSubmissionId: config.lastSubmissionId
        };
    }

    let newCount = 0;
    let skippedCount = 0;
    let lastSubmissionId = config.lastSubmissionId;

    for (const submission of submissions) {
        // Transform submission to samples (could be 1 or 2 per submission)
        const samples = koboService.transformSubmission(submission, fieldMapping, config.labId);

        for (const sampleData of samples) {
            const normalizedId = sampleData.original_id?.trim().toUpperCase();

            if (!normalizedId || existingIds.has(normalizedId)) {
                skippedCount++;
                continue;
            }

            // Create sample in database
            const sampleId = crypto.randomUUID();

            // Build rich attachment data with categories (matches resync_kobo_data.js)
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

            // Build compact metadata with attachments accessible by frontend
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
                attachments: processedAttachments
            };

            await prisma.$transaction(async (tx) => {
                await tx.sample.create({
                    data: {
                        id: sampleId,
                        originalId: sampleData.original_id,
                        projectCode: projectCode,
                        projectId: project?.id || null,
                        country: labInfo.iso,
                        countryName: labInfo.name,
                        labId: null,
                        assignedLab: config.labId,
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
            });

            newCount++;
            existingIds.add(normalizedId);
        }

        // Track last submission ID
        if (submission._id > (lastSubmissionId || 0)) {
            lastSubmissionId = String(submission._id);
        }
    }

    // Update last sync info (use id for unique lookup, not labId which is not unique)
    await prisma.koboConfig.update({
        where: { id: config.id },
        data: {
            lastSyncAt: new Date(),
            lastSubmissionId: lastSubmissionId
        }
    });

    // Send notification to lab managers if new samples were synced
    if (newCount > 0) {
        const managers = await prisma.user.findMany({
            where: { labId: config.labId, role: 'LAB_MANAGER', isActive: true }
        });

        if (managers.length > 0) {
            const notifications = managers.map(m => ({
                id: crypto.randomUUID(),
                userId: m.id,
                title: '🌾 New Field Samples Collected',
                message: `${newCount} new sample${newCount > 1 ? 's' : ''} synced from Kobo (${labInfo.name})`,
                type: 'SUCCESS',
                link: `/samples?project=${projectCode}&lab=${config.labId}`,
                createdAt: new Date()
            }));
            await prisma.notification.createMany({ data: notifications });
        }
    }

    console.log(`[KOBO] Sync complete for ${config.labId}: ${newCount} new, ${skippedCount} skipped`);

    return { newSamples: newCount, skipped: skippedCount, lastSubmissionId };
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

        // 2. Find the Kobo config for this lab
        const labId = sample.assignedLab || sample.labId || req.user?.labId;
        if (!labId) return res.status(400).json({ error: 'Cannot determine lab for this sample' });

        const config = await prisma.koboConfig.findFirst({
            where: { labId, isActive: true }
        });
        if (!config) return res.status(404).json({ error: `No active Kobo config for lab ${labId}` });

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
        const fm = (value) => ({ value, source: 'KOBO', lastUpdatedAt: now, lastUpdatedBy: 'FORCE_SYNC' });
        const fieldMetadata = {
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

        await prisma.sample.update({
            where: { id: sampleId },
            data: {
                metadata: JSON.stringify(compactMeta),
                fieldMetadata: JSON.stringify(fieldMetadata)
            }
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

