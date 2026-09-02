const prisma = require('../prisma');
const { success, error } = require('../i18n/response');
const idGenerator = require('../services/idGenerator');
const workflow = require('../workflowContract');

const COUNTRY_MAP = {
    'Afghanistan': 'AFG',
    'Bangladesh': 'BGD',
    'Guatemala': 'GTM',
    'Honduras': 'HND',
    'Peru': 'PER',
    'Uganda': 'UGA',
    'Zambia': 'ZMB',
    'Mozambique': 'MOZ',
    'Tunisia': 'TUN',
    'Unknown': 'GEN'
};

const LAB_MAPPING = {
    'GTM': 'GTM-LAB1',
    'HND': 'HND-LAB1',
    'GHA': 'GHA-LAB1',
    'KEN': 'KEN-LAB1',
    'ZMB': 'ZMB-LAB1',
    'TUN': 'TUN-LAB1',
    'MOZ': 'MOZ-LAB1',
    'AFG': 'AFG-LAB1',
    'PER': 'PER-LAB1',
    'UGA': 'UGA-LAB1',
    'BGD': 'BGD-LAB1'
};

// NOTE: syncFromExternal has been removed - sync is now handled by koboController.syncAll


/**
 * SEARCH EXPECTED SAMPLES - For Reception Autocomplete
 * GET /api/samples/expected?q=searchTerm&projectId=optional
 * 
 * Returns lightweight list of EXPECTED samples matching search term
 * for fast autocomplete in the reception interface.
 */
exports.searchExpectedSamples = async (req, res) => {
    const { q, projectId, limit = 10 } = req.query;
    const user = req.user;

    console.log(`[DEBUG] searchExpectedSamples: START. q="${q}", projectId="${projectId}", user="${user?.username}"`);

    try {
        const scopeGuard = require('../utils/scopeGuard');

        // Final conditions array
        const andConditions = [];

        // 1. Status Filter
        andConditions.push({ status: 'EXPECTED' });

        // 2. Lab Scope
        console.log(`[DEBUG] Building scope for user: ${user?.username}`);
        const scopedWhere = scopeGuard.buildScopedWhere(user, {}, { entityType: 'Sample', labField: 'assignedLab', altLabField: 'labId' });
        if (scopedWhere.OR) {
            andConditions.push({ OR: scopedWhere.OR });
        } else if (Object.keys(scopedWhere).length > 0) {
            andConditions.push(scopedWhere);
        }

        // 3. Project Filter
        if (projectId) {
            andConditions.push({
                OR: [
                    { projectId },
                    { projectCode: projectId }
                ]
            });
        }

        // 4. Search Filter
        if (q && q.trim()) {
            const searchTerm = q.trim();
            // Use both originalId and potentially other fields if needed, but originalId is primary
            andConditions.push({
                originalId: { contains: searchTerm }
            });
        }

        const where = { AND: andConditions };

        const samples = await prisma.sample.findMany({
            where,
            select: {
                id: true,
                originalId: true,
                projectId: true,
                projectCode: true,
                status: true,
                fieldMetadata: true,
                country: true
            },
            take: parseInt(limit),
            orderBy: { originalId: 'asc' }
        });

        // Parse fieldMetadata and extract coordinates
        const results = samples.map(s => {
            let coords = null;
            let location = null;
            // Helper to extract value from either {value: 'x'} objects or plain strings
            const v = (obj) => obj && typeof obj === 'object' ? obj.value : obj;
            try {
                const fm = typeof s.fieldMetadata === 'string' ? JSON.parse(s.fieldMetadata) : s.fieldMetadata;
                if (fm) {
                    const lat = v(fm.latitude) || v(fm.lat) || v(fm.gps_latitude);
                    const lng = v(fm.longitude) || v(fm.lng) || v(fm.gps_longitude) || v(fm.lon);
                    if (lat && lng) {
                        coords = { lat: parseFloat(lat), lng: parseFloat(lng) };
                    }
                    location = v(fm.location) || v(fm.site) || v(fm.village) || v(fm.district) || v(fm.site_id);
                }
            } catch (e) { }

            return {
                id: s.id,
                originalId: s.originalId,
                projectId: s.projectId,
                projectCode: s.projectCode,
                status: s.status,
                country: s.country,
                coordinates: coords,
                location
            };
        });

        res.json(results);
    } catch (err) {
        console.error('[DEBUG] searchExpectedSamples CRASH:', err);
        return error(res, 500, 'SAMPLE_SEARCH_ERROR', null, err.message || 'Internal Server Error');
    }
};

exports.getSamples = async (req, res) => {
    const {
        page = 1, limit = 50, sort = 'attention', order = 'desc', search: qSearch,
        status: qStatus, projects: qProjects, countries: qCountries,
        assignedLab: qAssignedLab, labs: qLabs, originalId: qOriginalId
    } = req.query;

    try {
        const user = req.user;
        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 100); // Cap at 100
        const skip = (pageNum - 1) * limitNum;

        // --- 1. BUILD WHERE CLAUSE ---
        const scopeGuard = require('../utils/scopeGuard');

        // Base lab-scoped query
        let where = scopeGuard.buildScopedWhere(user, {}, {
            entityType: 'Sample',
            labField: 'labId',
            altLabField: 'assignedLab'
        });

        // Status filter (most common)
        if (qStatus) {
            where.status = { in: qStatus.split(',').map(s => s.trim()) };
        }

        // Lab filter - explicit override
        if (qLabs) {
            const list = qLabs.split(',').map(s => s.trim());
            where.assignedLab = { in: list };
        }

        // Project filter
        if (qProjects) {
            const list = qProjects.split(',').map(s => s.trim());
            where.projectCode = { in: list };
        }

        // Country filter
        if (qCountries) {
            const list = qCountries.split(',').map(s => s.trim());
            where.country = { in: list };
        }

        // Original ID exact match
        if (qOriginalId) {
            where.originalId = qOriginalId;
        }

        // Search by originalId OR labId
        // SECURITY FIX: Wrap in AND to preserve scope guard OR conditions
        if (qSearch && qSearch.trim()) {
            const term = qSearch.trim();
            if (!where.AND) where.AND = [];
            where.AND.push({
                OR: [
                    { originalId: { contains: term, mode: 'insensitive' } },
                    { labId: { contains: term, mode: 'insensitive' } }
                ]
            });
        }

        // Auto-hide uncollected EXPECTED samples (never sampled in field)
        // Only applies when user hasn't explicitly filtered by status
        // Hides any EXPECTED sample with no fieldMetadata and no metadata
        if (!qStatus) {
            where.NOT = {
                AND: [
                    { status: 'EXPECTED' },
                    { fieldMetadata: null },
                    { metadata: null }
                ]
            };
        }

        // --- 2. SORT ALLOWLIST & ATTENTION-FIRST ORDERING ---
        const ALLOWED_SORTS = ['labId', 'projectCode', 'status', 'updatedAt', 'createdAt', 'attention'];
        const safeSort = ALLOWED_SORTS.includes(sort) ? sort : 'createdAt';
        const safeOrder = order === 'asc' ? 'asc' : 'desc';

        // For attention sort, we need work item statuses to compute rank
        const needsAttentionSort = safeSort === 'attention';

        const [total, samples, statusCounts, projectCounts, countryCounts, labCounts] = await Promise.all([
            prisma.sample.count({ where }),
            // --- Phase 1: Lightweight ranking query (ALL matching rows, minimal fields) ---
            prisma.sample.findMany({
                where,
                select: { id: true, status: true, updatedAt: true, workItems: { select: { status: true } } },
                orderBy: { updatedAt: 'desc' }
            }),
            prisma.sample.groupBy({
                by: ['status'],
                where,
                _count: true
            }),
            // P1: Facets for project/country/lab
            prisma.sample.groupBy({
                by: ['projectCode'],
                where,
                _count: true
            }),
            prisma.sample.groupBy({
                by: ['country'],
                where,
                _count: true
            }),
            prisma.sample.groupBy({
                by: ['assignedLab'],
                where,
                _count: true
            })
        ]);

        // --- 3. BUILD FACETS ---
        const lifecycle = { EXPECTED: 0, RECEIVED: 0, ACCEPTED: 0, ONGOING: 0, COMPLETED: 0, HISTORY: 0 };
        statusCounts.forEach(sc => {
            if (sc.status === 'EXPECTED') lifecycle.EXPECTED = sc._count;
            else if (sc.status === 'RECEIVED') lifecycle.RECEIVED = sc._count;
            else if (sc.status === 'ACCEPTED') lifecycle.ACCEPTED = sc._count;
            else if (['PROCESSING', 'SUBMITTED_PARTIAL'].includes(sc.status)) lifecycle.ONGOING += sc._count;
            else if (['SUBMITTED_FULL', 'APPROVED'].includes(sc.status)) lifecycle.COMPLETED += sc._count;
            else if (['ARCHIVED', 'DISPOSED'].includes(sc.status)) lifecycle.HISTORY += sc._count;
        });

        // P1: Project/Country/Lab facets for advanced filters
        const projects = {};
        projectCounts.forEach(pc => { if (pc.projectCode) projects[pc.projectCode] = pc._count; });
        const countries = {};
        countryCounts.forEach(cc => { if (cc.country) countries[cc.country] = cc._count; });
        const labs = {};
        labCounts.forEach(lc => { if (lc.assignedLab) labs[lc.assignedLab] = lc._count; });

        // --- 4. RESOLVE PAGE DATA ---
        // For attention sort: rank ALL lightweight rows, sort, slice page IDs, then fetch full data.
        // For normal sort: Phase 1 already has all rows but we need a separate full fetch with proper pagination.
        let pageSamples; // Full records for this page
        let attentionRanks = {}; // id → rank map (only for attention sort)

        if (needsAttentionSort) {
            // Phase 1b: Compute attention rank on lightweight data (no cap — operates on ALL matching rows)
            const ranked = samples.map(s => {
                const wis = s.workItems || [];
                const hasInProgress = wis.some(wi => wi.status === 'IN_PROGRESS');
                const hasAssigned = wis.some(wi => wi.status === 'ASSIGNED');
                const hasReanalysis = wis.some(wi => wi.status === 'REANALYSIS_REQUIRED');
                const pendingReview = ['SUBMITTED_PARTIAL', 'SUBMITTED_FULL'].includes(s.status);
                let rank = 5;
                if (hasInProgress) rank = 0;
                else if (hasAssigned || hasReanalysis) rank = 1;
                else if (pendingReview) rank = 2;
                else if (s.status === 'PROCESSING') rank = 3;
                else if (['RECEIVED', 'COLLECTED', 'ACCEPTED'].includes(s.status)) rank = 4;
                return { id: s.id, rank, updatedAt: s.updatedAt };
            });

            // Sort all rows by attention rank, then updatedAt desc
            ranked.sort((a, b) => {
                if (a.rank !== b.rank) return a.rank - b.rank;
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            });

            // Slice for current page
            const pageSlice = ranked.slice(skip, skip + limitNum);
            const pageIds = pageSlice.map(r => r.id);

            // Save ranks for re-ordering after Phase 2
            pageSlice.forEach((r, idx) => { attentionRanks[r.id] = idx; });

            // Phase 2: Fetch full data for just this page's IDs
            pageSamples = pageIds.length > 0 ? await prisma.sample.findMany({
                where: { id: { in: pageIds } },
                select: {
                    id: true, originalId: true, labId: true, assignedLab: true,
                    projectCode: true, country: true, countryName: true,
                    status: true, dryingStatus: true, preparationStatus: true,
                    depthTop: true, depthBottom: true, horizon: true,
                    receptionDate: true, createdAt: true, updatedAt: true,
                    fieldMetadata: true, metadata: true,
                    workItems: { select: { analysis: true, status: true, category: true } }
                }
            }) : [];

            // Re-order to match the ranked sort order
            pageSamples.sort((a, b) => attentionRanks[a.id] - attentionRanks[b.id]);
        } else {
            // Non-attention sort: standard paginated query with full data
            pageSamples = await prisma.sample.findMany({
                where,
                select: {
                    id: true, originalId: true, labId: true, assignedLab: true,
                    projectCode: true, country: true, countryName: true,
                    status: true, dryingStatus: true, preparationStatus: true,
                    depthTop: true, depthBottom: true, horizon: true,
                    receptionDate: true, createdAt: true, updatedAt: true,
                    fieldMetadata: true, metadata: true,
                    workItems: { select: { analysis: true, status: true, category: true } }
                },
                orderBy: { [safeSort]: safeOrder },
                skip,
                take: limitNum
            });
        }

        // --- 5. ENRICH page data ---
        const enriched = pageSamples.map(s => {
            let siteId = null;
            try {
                const fm = typeof s.fieldMetadata === 'string' ? JSON.parse(s.fieldMetadata) : s.fieldMetadata;
                if (fm?.site_id) siteId = fm.site_id.value || fm.site_id;
            } catch (e) { }
            let metadata = null;
            try {
                metadata = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : s.metadata;
            } catch (e) { }

            const workItems = s.workItems || [];
            const categorizeWI = (analysis) => {
                if (!analysis) return null;
                const a = analysis.toUpperCase();
                if (['DRYING', 'PREPARATION'].includes(a)) return 'Operational Gates';
                if (['ARCHIVING', 'DISPOSING', 'ARCHIVE', 'DISPOSE'].includes(a)) return null;
                if (a.startsWith('SPEC_') || a.startsWith('SPECTRAL') || ['MIR', 'NIR', 'VIS_NIR', 'XRF'].includes(a)) return 'Spectroscopy';
                if (['SAND', 'SILT', 'CLAY', 'TEXTURE'].includes(a)) return 'Texture';
                return 'Wet Chemistry';
            };
            const progressItems = workItems
                .map(wi => ({ analysis: wi.analysis, category: categorizeWI(wi.analysis), status: wi.status }))
                .filter(wi => wi.category !== null);
            const totalWI = progressItems.length;
            const completedWI = progressItems.filter(wi => ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(wi.status)).length;

            const hasInProgressWork = workItems.some(wi => wi.status === 'IN_PROGRESS');
            const hasAssignedWork = workItems.some(wi => wi.status === 'ASSIGNED');
            const hasReanalysisWork = workItems.some(wi => wi.status === 'REANALYSIS_REQUIRED');
            const pendingReview = ['SUBMITTED_PARTIAL', 'SUBMITTED_FULL'].includes(s.status);
            let attentionRank = 5;
            if (hasInProgressWork) attentionRank = 0;
            else if (hasAssignedWork || hasReanalysisWork) attentionRank = 1;
            else if (pendingReview) attentionRank = 2;
            else if (s.status === 'PROCESSING') attentionRank = 3;
            else if (['RECEIVED', 'COLLECTED', 'ACCEPTED'].includes(s.status)) attentionRank = 4;

            return {
                ...s,
                workItems: undefined,
                fieldMetadata: undefined,
                metadata,
                siteId,
                workItemProgress: { total: totalWI, completed: completedWI, items: progressItems },
                hasInProgressWork, hasAssignedWork, hasReanalysisWork, pendingReview, attentionRank,
                gatesComplete: s.dryingStatus === 'DONE' && s.preparationStatus === 'DONE',
                nextAction: s.status === 'EXPECTED' ? 'Receive' :
                    s.status === 'RECEIVED' ? 'Accept' :
                        s.status === 'ACCEPTED' ? 'Process' : 'View'
            };
        });

        res.json({
            data: enriched,
            meta: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
            facets: { lifecycle, projects, countries, labs }
        });
    } catch (err) {
        console.error("[getSamples] ERROR:", err);
        return error(res, 500, 'SAMPLE_FETCH_ERROR', null, "Internal Server Error", { message: err.message });
    }
};

const ROLE_PERMISSIONS = {
    'RECEIVED': ['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'],
    'ACCEPTED': ['LAB_MANAGER', 'SUPER_ADMIN'],
    'LAB_ID_ASSIGNED': ['LAB_MANAGER', 'SUPER_ADMIN'],
    'PROCESSING': ['LAB_MANAGER', 'SUPER_ADMIN'],
    'APPROVED': ['LAB_MANAGER', 'SUPER_ADMIN'],
    'ARCHIVED': ['LAB_MANAGER', 'SUPER_ADMIN'],
    'DISPOSED': ['LAB_MANAGER', 'SUPER_ADMIN']
};

exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user;
    const userRole = user ? user.role : 'GUEST';

    try {
        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return error(res, 404, 'SAMPLE_NOT_FOUND', { id }, 'Sample not found');

        // SECURITY: Enforce Lab Scope
        const scopeGuard = require('../utils/scopeGuard');
        try {
            scopeGuard.ensureScope(user, sample, { altLabField: 'assignedLab' });
        } catch (e) {
            return error(res, 403, 'ACCESS_DENIED_LAB', null, 'Access Denied: You cannot modify samples from another lab.');
        }

        // STRICT: Reject legacy/unknown statuses
        if (workflow.isLegacySampleState(status)) {
            return res.status(400).json({
                error: `Legacy status '${status}' is not allowed.`,
                validStates: workflow.SAMPLE_STATE_LIST
            });
        }
        if (!workflow.isValidSampleState(status)) {
            return res.status(400).json({
                error: `Unknown status '${status}'.`
            });
        }

        // 1. Validate Transition
        const isManagerOverride = ['LAB_MANAGER', 'SUPER_ADMIN'].includes(userRole) &&
            ['APPROVED', 'ARCHIVED', 'DISPOSED'].includes(status);

        if (!isManagerOverride && !workflow.isValidSampleTransition(sample.status, status)) {
            return res.status(400).json({
                error: `Invalid transition from ${sample.status} to ${status}.`
            });
        }

        // 2. Validate Permissions
        const requiredRoles = ROLE_PERMISSIONS[status];
        if (requiredRoles && !requiredRoles.includes(userRole)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const updates = { status };
        if (status === 'RECEIVED' && !sample.receptionDate) {
            updates.receptionDate = new Date();
        }

        // Critical: Generate Lab ID on transition to LAB_ID_ASSIGNED or ACCEPTED
        if ((status === 'LAB_ID_ASSIGNED' || status === 'ACCEPTED') && !sample.labId) {
            updates.labId = await idGenerator.generateLabId(sample.projectCode || 'GEN');

            // --- AUTOMATION: Enforce SoilFER Bundle ---
            const SOILFER_COUNTRIES = ['GTM', 'HND', 'GHA', 'KEN', 'ZMB', 'TUN', 'MOZ', 'AFG', 'PER', 'UGA'];
            const isSoilFer = SOILFER_COUNTRIES.includes(sample.projectCode) ||
                (sample.projectId && sample.projectId.includes('SoilFER'));

            if (isSoilFer) {
                // Load analysis groups from database
                const analysisGroupsRaw = await prisma.analysisGroup.findMany({ where: { id: 'std-soil' } });
                const stdGroup = analysisGroupsRaw[0];
                if (stdGroup) {
                    const groupAnalyses = stdGroup.analyses ? JSON.parse(stdGroup.analyses) : [];
                    // Finding #7: Start from existing analyses to avoid overwriting on partial payloads
                    const existingAnalyses = sample.requiredAnalyses
                        ? (typeof sample.requiredAnalyses === 'string' ? JSON.parse(sample.requiredAnalyses) : sample.requiredAnalyses)
                        : [];
                    let requiredAnalyses = new Set(existingAnalyses);
                    groupAnalyses.forEach(code => requiredAnalyses.add(code));
                    updates.requiredAnalyses = JSON.stringify(Array.from(requiredAnalyses));
                }
            }
        }

        if (status === 'ACCEPTED') {
            updates.dryingStatus = 'PENDING';
            updates.preparationStatus = 'PENDING';
        }

        const { transitionSample } = require('../services/sampleStateService');
        const nextStatus = status;
        delete updates.status;
        const updated = await transitionSample(id, nextStatus, user, updates.notes || updates.reason || 'Status updated via API', updates);

        // Post-Update Hook for Work Items
        if (nextStatus === 'ACCEPTED') {
            try {
                const workItemController = require('./workItemController');
                await workItemController.generateWorkItemsForSample(updated);
            } catch (e) {
                console.error('Failed to generate work items', e);
            }
        }

        await prisma.auditLog.create({
            data: {
                id: `audit-status-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'STATUS_CHANGE',
                details: `Status changed from ${sample.status} to ${status}`,
                performedBy: user ? user.username : 'UNKNOWN',
                performedByName: user ? (user.name || user.username) : 'System',
                timestamp: new Date(),
                before: JSON.stringify({ status: sample.status }),
                after: JSON.stringify({ status: status }),
                sampleId: String(id)
            }
        });

        res.json(updated);
    } catch (err) {
        console.error('[updateStatus] Error:', err);
        return error(res, 500, 'SAMPLE_UPDATE_ERROR', null, 'Failed to update status');
    }
};

exports.updatePhaseStatus = async (req, res) => {
    const { id } = req.params;
    const { phase, status, reason } = req.body;
    const user = req.user;

    try {
        if (!['LAB_TECHNICIAN', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return error(res, 403, 'INSUFFICIENT_PERMISSIONS', null, 'Only Lab Technicians and Managers can update drying/preparation gates');
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return error(res, 404, 'SAMPLE_NOT_FOUND', { id }, 'Sample not found');

        // SECURITY: Enforce Lab Scope
        const scopeGuard = require('../utils/scopeGuard');
        try {
            scopeGuard.ensureScope(user, sample, { altLabField: 'assignedLab' });
        } catch (e) {
            return res.status(403).json({ error: 'Access Denied: You cannot update phases for samples from another lab.' });
        }

        const beforeDrying = sample.dryingStatus;
        const beforePrep = sample.preparationStatus;

        if (!['DRYING', 'PREPARATION'].includes(phase)) {
            return res.status(400).json({ error: 'Invalid phase. Must be DRYING or PREPARATION' });
        }

        if (phase === 'DRYING') {
            if (!workflow.isValidDryingStatus(status)) {
                return res.status(400).json({ error: `Invalid drying status '${status}'.` });
            }
            if (status === 'FAILED' && !reason) {
                return res.status(400).json({ error: 'Reason required for FAILED drying status' });
            }
        } else if (phase === 'PREPARATION') {
            if (status === 'FAILED') {
                return res.status(400).json({ error: "preparationStatus=FAILED is not allowed." });
            }
            if (!workflow.isValidPreparationStatus(status)) {
                return res.status(400).json({ error: `Invalid preparation status '${status}'.` });
            }
        }

        const updates = {};
        if (phase === 'DRYING') {
            updates.dryingStatus = status;
            if (status === 'FAILED') {
                const meta = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
                meta.dryingFailedReason = reason;
                updates.metadata = JSON.stringify(meta);
                updates.status = 'ON_HOLD';
                await prisma.auditLog.create({
                    data: {
                        id: `audit-nc-${Date.now()}`,
                        entity: 'SAMPLE',
                        entityId: id,
                        action: 'NON_CONFORMANCE',
                        details: `Drying FAILED: ${reason}`,
                        performedBy: user.username,
                        timestamp: new Date(),
                        sampleId: String(id)
                    }
                });
            }
        } else if (phase === 'PREPARATION') {
            if (status === 'DONE' && sample.dryingStatus !== 'DONE') {
                return res.status(400).json({
                    error: `Cannot complete PREPARATION. Drying must be DONE first.`
                });
            }
            updates.preparationStatus = status;
        }

        if (status === 'DONE') {
            const gateItem = await prisma.workItem.findFirst({
                where: {
                    sampleId: String(id),
                    analysis: phase
                }
            });
            if (gateItem) {
                await prisma.workItem.update({
                    where: { id: gateItem.id },
                    data: {
                        status: 'ACCEPTED',
                        result: 'Gate Passed',
                        completedAt: new Date()
                    }
                });
            }
        }

        const newDrying = updates.dryingStatus || sample.dryingStatus;
        const newPrep = updates.preparationStatus || sample.preparationStatus;
        if (newDrying === 'DONE' && newPrep === 'DONE' && sample.status === 'ACCEPTED') {
            updates.status = 'PROCESSING';
        }

        const updated = await prisma.sample.update({
            where: { id: String(id) },
            data: updates
        });

        const auditEvent = phase === 'DRYING' ? 'DRYING_STATUS_CHANGED' : 'PREP_STATUS_CHANGED';
        const beforeValue = phase === 'DRYING' ? beforeDrying : beforePrep;

        await prisma.auditLog.create({
            data: {
                id: `audit-phase-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: auditEvent,
                details: `${phase} status changed from ${beforeValue || 'PENDING'} to ${status}`,
                performedBy: user.username,
                timestamp: new Date(),
                sampleId: String(id),
                before: JSON.stringify({ [phase.toLowerCase() + 'Status']: beforeValue || 'PENDING' }),
                after: JSON.stringify({ [phase.toLowerCase() + 'Status']: status })
            }
        });

        res.json(updated);
    } catch (err) {
        console.error('[updatePhaseStatus] Error:', err);
        return error(res, 500, 'PHASE_UPDATE_ERROR', null, 'Failed to update phase status');
    }
};

// =============================================================================
// STEP 2: RECEPTION → ACCEPTANCE WORKFLOW
// =============================================================================

const workItemController = require('./workItemController');

const userHasScopeForSample = async (user, sample) => {
    if (user.role === 'SUPER_ADMIN') return true;

    // 1. Mandatory Lab Match for Lab Staff
    if (['LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN'].includes(user.role)) {
        if (user.labId && (sample.assignedLab === user.labId || sample.labId === user.labId)) {
            return true;
        }

        // Technicians can see samples they are assigned to, even if they've changed labs? 
        // No, keep it strict to Current Lab.
        if (user.role === 'LAB_TECHNICIAN') {
            const hasAssignment = await prisma.workItem.findFirst({
                where: {
                    sampleId: String(sample.id),
                    assignedTo: user.username,
                    labId: user.labId // Must be in their CURRENT lab
                }
            });
            if (hasAssignment) return true;
        }

        return false; // If lab staff and context doesn't match, DENIED.
    }

    // 2. High Level Roles (Country / Project scope)
    const userCountries = user.countries || [];
    const sampleCountry = sample.projectCode || sample.country;
    if (userCountries.includes(sampleCountry)) return true;

    const userProjects = user.projects || [];
    if (userProjects.includes(sample.projectCode)) return true;

    return false;
};

/**
 * RECEIVE SAMPLE - Transition to RECEIVED state
 * POST /api/samples/:id/receive
 */
exports.receiveSample = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    try {
        // Permission check
        if (!['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Only Intake Officers and Managers can receive samples' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // RBAC Scope check
        if (!(await userHasScopeForSample(user, sample))) {
            return res.status(403).json({ error: 'Sample is outside your lab scope' });
        }

        // Validate transition
        const currentStatus = sample.status;
        if (currentStatus !== workflow.SAMPLE_STATES.EXPECTED && currentStatus !== 'COLLECTED') {
            return res.status(400).json({
                error: `Cannot receive. Sample must be EXPECTED. Current: ${currentStatus}`
            });
        }

        const beforeState = sample.status;
        const now = new Date();

        const { transitionSample } = require('../services/sampleStateService');
        const updated = await transitionSample(id, workflow.SAMPLE_STATES.RECEIVED, user, 'Sample received at lab', {
            receptionDate: now,
            receivedBy: user.username
        });

        // Audit: SAMPLE_RECEIVED
        await prisma.auditLog.create({
            data: {
                id: `audit-rec-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'SAMPLE_RECEIVED',
                details: `Sample received at lab by ${user.name || user.username}`,
                performedBy: user.username,
                performedByName: user.name || user.username,
                timestamp: now,
                before: JSON.stringify({ status: beforeState }),
                after: JSON.stringify({ status: workflow.SAMPLE_STATES.RECEIVED }),
                sampleId: String(id)
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('[receiveSample] Error:', error);
        res.status(500).json({ error: 'Failed to receive sample' });
    }
};

/**
 * CREATE WALK-IN SAMPLE - For samples not in project/Google Sheet
 * POST /api/samples/walkin
 * Body: { submitter, submitterContact, description, analyses: [...], countryCode? }
 */
exports.createWalkInSample = async (req, res) => {
    const { submitter, submitterContact, description, analyses, countryCode = 'GEN', sampleType, ptRound, expectedValues } = req.body;
    const user = req.user;

    // Permission check
    if (!['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
        return res.status(403).json({ error: 'Only Intake Officers and Managers can create walk-in samples' });
    }

    // Validation
    if (!submitter) {
        return res.status(400).json({ error: 'submitter is required' });
    }

    // STRICT: PT Validation
    if (sampleType === 'PT') {
        if (!ptRound) return res.status(400).json({ error: 'ptRound is required for PT samples' });
        // expectedValues are optional at creation (might be blind)
    }

    try {
        // Determine lab from user
        const assignedLab = user.labId || `LAB-${countryCode}`;

        // Automated Short Sample ID for Walk-ins / PT
        const prefix = sampleType === 'PT' ? 'P' : 'W';
        const autoId = await idGenerator.generateWalkInId(countryCode, prefix);
        const originalId = sampleType === 'PT' && ptRound ? `PT-${ptRound}-${autoId}` : autoId;
        const sampleId = autoId;
        const now = new Date();

        const sampleMeta = {
            sampleType: sampleType || 'WALKIN',
            ptRound: ptRound || null,
            expectedValues: expectedValues || null
        };

        // Create sample
        const newSample = await prisma.sample.create({
            data: {
                id: sampleId,
                originalId: originalId,
                status: 'RECEIVED', // Walk-ins start as RECEIVED
                projectCode: countryCode,
                countryName: countryCode, // Using projectCode as country proxy
                assignedLab: assignedLab,
                receptionDate: now,
                receivedBy: user.username,
                requiredAnalyses: analyses ? JSON.stringify(analyses) : '[]',
                labId: autoId, // Walk-ins use their short ID as Lab ID (Finding #5)
                metadata: JSON.stringify(sampleMeta),
                fieldMetadata: JSON.stringify({
                    submitterName: { value: submitter, source: 'WALK_IN_INTAKE', lastUpdatedAt: now, lastUpdatedBy: user.username },
                    submitterContact: { value: submitterContact, source: 'WALK_IN_INTAKE', lastUpdatedAt: now, lastUpdatedBy: user.username },
                    description: { value: description, source: 'WALK_IN_INTAKE', lastUpdatedAt: now, lastUpdatedBy: user.username },
                    sampleType: { value: sampleType || 'WALKIN', source: 'WALK_IN_INTAKE', lastUpdatedAt: now, lastUpdatedBy: user.username }
                }),
                history: JSON.stringify([{
                    status: 'RECEIVED',
                    timestamp: now,
                    changedBy: user.username,
                    note: 'Walk-in/PT Sample Created'
                }])
            }
        });

        // Audit: SAMPLE_RECEIVED
        await prisma.auditLog.create({
            data: {
                id: `audit-walkin-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: sampleId,
                action: 'SAMPLE_RECEIVED',
                details: `Walk-in sample created and received by ${user.name || user.username}`,
                performedBy: user.username,
                performedByName: user.name || user.username,
                timestamp: now,
                sampleId: sampleId
            }
        });

        res.status(201).json({
            sample: {
                ...newSample,
                sampleType: sampleMeta.sampleType,
                ptRound: sampleMeta.ptRound,
                expectedValues: sampleMeta.expectedValues
            }
        });
    } catch (error) {
        console.error('Create Walk-in Error:', error);
        res.status(500).json({ error: 'Failed to create walk-in sample' });
    }
};

/**
 * UNDO INTAKE - Revert from ACCEPTED to RECEIVED
 * POST /api/samples/:id/undo-intake
 */
exports.undoIntake = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    // RBAC: Only Managers/Admins
    if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
        return res.status(403).json({ error: 'Only Managers can undo intake' });
    }

    try {
        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // Lab scope guard — prevent cross-lab mutations (Finding #1)
        if (user.role !== 'SUPER_ADMIN' && sample.assignedLab && sample.assignedLab !== user.labId) {
            return res.status(403).json({ error: 'Access denied: this sample belongs to another lab.' });
        }

        // Validate State
        if (sample.status !== 'ACCEPTED' && sample.status !== 'LAB_ID_ASSIGNED') {
            return res.status(400).json({
                error: `Cannot undo intake. Sample must be ACCEPTED or LAB_ID_ASSIGNED. Current: ${sample.status}`
            });
        }

        // Safety Check: Are there completed work items?
        const items = await prisma.workItem.findMany({ where: { sampleId: String(id) } });
        const hasProgress = items.some(w => w.status !== 'PENDING');

        if (hasProgress) {
            console.warn(`[Undo Intake] deleting work items with progress for sample ${id}`);
        }

        // Transaction: Delete WorkItems, Update Sample, Audit
        await prisma.workItem.deleteMany({ where: { sampleId: String(id) } });

        const { transitionSample } = require('../services/sampleStateService');
        await transitionSample(id, 'RECEIVED', user, `Intake undone. Status reverted to RECEIVED. ${items.length} work items deleted.`, {
            dryingStatus: null,
            preparationStatus: null,
            acceptedBy: null,
            acceptedAt: null
        });
            prisma.auditLog.create({
                data: {
                    id: `audit-undo-${Date.now()}`,
                    entity: 'SAMPLE',
                    entityId: id,
                    action: 'UNDO_INTAKE',
                    details: `Intake undone. Status reverted to RECEIVED. ${items.length} work items deleted.`,
                    performedBy: user.username,
                    timestamp: new Date(),
                    sampleId: String(id)
                }
            })
        ]);

        const updatedSample = await prisma.sample.findUnique({ where: { id: String(id) } });
        res.json({ message: 'Intake undone successfully', sample: updatedSample });

    } catch (error) {
        console.error('[undoIntake] Error:', error);
        res.status(500).json({ error: 'Failed to undo intake' });
    }
};


/**
 * GET SAMPLE DETAIL - Extended view with work items
 * GET /api/samples/:id/detail
 */
exports.getSampleDetail = async (req, res) => {
    const { id } = req.params;

    try {
        let sample = await prisma.sample.findUnique({
            where: { id: String(id) },
            include: {
                workItems: true
            }
        });

        if (!sample) {
            sample = await prisma.sample.findFirst({
                where: {
                    OR: [
                        { labId: String(id) },
                        { originalId: String(id) }
                    ]
                },
                include: {
                    workItems: true
                }
            });
        }

        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // Lab Isolation Check (Phase 1 - Scope Guard)
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample belongs to another lab.' });
        }

        // Get Audit Log
        const auditLog = await prisma.auditLog.findMany({
            where: {
                OR: [
                    { entityId: String(id) },
                    { sampleId: String(id) }
                ]
            },
            orderBy: { timestamp: 'desc' }
        });

        // Parse JSON fields
        const parseJson = (str) => {
            try { return typeof str === 'string' ? JSON.parse(str) : (str || null); }
            catch (e) { return null; }
        };

        const enrichedSample = {
            ...sample,
            metadata: parseJson(sample.metadata),
            fieldMetadata: parseJson(sample.fieldMetadata),
            requiredAnalyses: parseJson(sample.requiredAnalyses),
            analysisGroupIds: parseJson(sample.analysisGroupIds),
            receptionData: parseJson(sample.receptionData)
        };

        // Parse JSON in Audit Log
        const parsedAuditLog = auditLog.map(a => ({
            ...a,
            before: parseJson(a.before),
            after: parseJson(a.after)
        }));

        const parsedWorkItems = sample.workItems.map(wi => {
            let status = wi.status;
            let assignedLab = wi.assignedLab;

            // Self-healing 1: Status repair
            if (status === 'ASSIGNED' && !wi.assignedTo) {
                status = 'NOT_ASSIGNED';
            }

            // Self-healing 2: AssignedLab repair (copy from sample if missing)
            if (!assignedLab && sample.assignedLab) {
                assignedLab = sample.assignedLab;
                // Async update in background for persistence
                prisma.workItem.update({
                    where: { id: wi.id },
                    data: { assignedLab: sample.assignedLab }
                }).catch(err => console.error(`[SELF-HEALING] Failed to update WI ${wi.id}:`, err));
            }

            return {
                ...wi,
                status,
                assignedLab,
                labId: sample.labId,  // Include labId for spectral lookups
                history: parseJson(wi.history)
            };
        });

        // Enrich work items with analysis metadata (display names + units)
        const wiAnalysisCodes = [...new Set(parsedWorkItems.map(wi => wi.analysis).filter(Boolean))];
        const analysisMetadata = await prisma.analysis.findMany({
            where: { code: { in: wiAnalysisCodes } },
            select: { code: true, name: true, units: true }
        });
        const analysisMap = {};
        analysisMetadata.forEach(a => { analysisMap[a.code] = a; });
        parsedWorkItems.forEach(wi => {
            const meta = analysisMap[wi.analysis];
            wi.unit = meta?.units || null;
            wi.analysisName = meta?.name || null;
        });

        // Calculate workflow summary using the Workflow Engine
        const workflowEngine = require('../utils/workflowEngine');
        const workflowSummary = workflowEngine.getWorkflowSummary(sample, parsedWorkItems);

        // Check if this sample has a Kobo connection
        // Walk-in samples should NEVER show Kobo sync — they are manual by definition
        let hasKoboConnection = false;

        // Detect walk-in samples: null/empty projectCode, or isWalkIn flag in receptionData
        let isWalkInSample = !sample.projectCode;
        if (!isWalkInSample) {
            try {
                const rd = typeof sample.receptionData === 'string' ? JSON.parse(sample.receptionData) : sample.receptionData;
                isWalkInSample = rd?.isWalkIn === true;
            } catch (e) { }
        }

        if (sample.assignedLab && !isWalkInSample) {
            // Check if fieldMetadata was created by DRAFT (intake) — if so, it's manual
            let isDraft = false;
            try {
                const fm = typeof sample.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : sample.fieldMetadata;
                if (fm) {
                    const firstVal = Object.values(fm)[0];
                    isDraft = firstVal?.source === 'DRAFT' || firstVal?.source === 'WALK_IN_INTAKE';
                }
            } catch (e) { }

            if (!isDraft) {
                const koboConfig = await prisma.koboConfig.findFirst({
                    where: { labId: sample.assignedLab, isActive: true },
                    select: { id: true }
                });
                hasKoboConnection = !!koboConfig;
            }
        }

        // Fetch equipment eligibility for this lab
        const equipmentEligibility = await prisma.equipmentMethodEligibility.findMany({
            where: { labId: sample.assignedLab || sample.labId }
        });

        res.json({
            sample: enrichedSample,
            workItems: parsedWorkItems,
            auditLog: parsedAuditLog,
            workflowSummary,  // Phase 2: Centralized workflow state
            hasKoboConnection,
            equipmentEligibility, // Phase 5: Workflow Integration
            identifiers: {
                sampleId: sample.id,
                labId: sample.labId,
                originalId: sample.originalId
            }
        });
    } catch (error) {
        console.error('[getSampleDetail] Error:', error);
        res.status(500).json({ error: 'Failed to fetch sample details' });
    }
};

/**
 * GET /api/samples/:id/map-state
 * 
 * Returns the unified map-state contract for the workflow map.
 * This is the SINGLE SOURCE OF TRUTH — the client renders from this payload only.
 */
exports.getMapState = async (req, res) => {
    const { id } = req.params;

    try {
        const sample = await prisma.sample.findUnique({
            where: { id: String(id) },
            include: { workItems: true }
        });

        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // Lab Isolation Check
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(req.user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample belongs to another lab.' });
        }

        // Get Audit Log (for SLA computation)
        const auditLog = await prisma.auditLog.findMany({
            where: {
                OR: [
                    { entityId: String(id) },
                    { sampleId: String(id) }
                ]
            },
            orderBy: { timestamp: 'desc' }
        });

        // Self-heal work item statuses
        const workItems = sample.workItems.map(wi => {
            let status = wi.status;
            if (status === 'ASSIGNED' && !wi.assignedTo) status = 'NOT_ASSIGNED';
            return { ...wi, status };
        });

        // Build map-state from engine
        const workflowEngine = require('../utils/workflowEngine');
        const mapState = workflowEngine.buildMapState(sample, workItems, auditLog);

        res.json(mapState);
    } catch (error) {
        console.error('[getMapState] Error:', error);
        res.status(500).json({ error: 'Failed to build map state' });
    }
};

// =============================================================================
// STEP 6: FINAL APPROVAL + CLOSURE
// =============================================================================

// [REMOVED DUPLICATE APPROVE/ARCHIVE/DISPOSE FUNCTIONS - See end of file]

/**
 * ACCEPT INTAKE - Phase 1 Atomic Transaction
 * POST /api/samples/:id/accept
 * - Verifies Manager
 * - Assigns Lab ID
 * - Inits Gates
 * - Generates WorkItems
 */
exports.acceptSample = async (req, res) => {
    const { id } = req.params;
    const { user } = req;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Only Managers can accept intakes.' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // Lab scope guard — prevent cross-lab mutations (Finding #1)
        if (user.role !== 'SUPER_ADMIN' && sample.assignedLab && sample.assignedLab !== user.labId) {
            return res.status(403).json({ error: 'Access denied: this sample belongs to another lab.' });
        }

        if (sample.status !== 'RECEIVED' && sample.status !== 'COLLECTED') {
            return res.status(400).json({
                error: `Sample must be in RECEIVED state to accept. Current: ${sample.status}`
            });
        }

        // IDENTITY VERIFICATION
        // Lab ID is now assigned at reception to facilitate immediate labeling.
        const labId = sample.labId;
        if (!labId) {
            return res.status(500).json({ error: 'Sample is missing a Lab ID. Please contact support or re-intake.' });
        }
        console.log(`[ACCEPT] Verifying Lab ID ${labId} for sample ${sample.id}`);

        const now = new Date();

        const history = typeof sample.history === 'string' ? JSON.parse(sample.history) : (sample.history || []);
        history.push({
            status: 'ACCEPTED',
            timestamp: now,
            user: user.username,
            note: `Intake Accepted. Assigned Lab ID: ${labId}`
        });

        const { transitionSample } = require('../services/sampleStateService');
        const updated = await transitionSample(id, 'ACCEPTED', user, `Intake Accepted. Assigned Lab ID: ${labId}`, {
            labId: labId,
            dryingStatus: 'PENDING',
            preparationStatus: 'PENDING',
            acceptedBy: user.username,
            acceptedAt: now,
            history: JSON.stringify(history)
        });

        let workItemWarning = null;
        try {
            const workItemController = require('./workItemController');
            await workItemController.generateWorkItemsForSample(updated);
        } catch (e) {
            // Finding #4: Don't silently suppress — track the failure
            console.error('[ACCEPT] Failed to generate work items during acceptance:', e);
            workItemWarning = `Sample accepted but work item generation failed: ${e.message}. Please contact support.`;
        }

        await prisma.auditLog.create({
            data: {
                id: `audit-accept-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'SAMPLE_ACCEPTED',
                details: `Assigned Lab ID ${labId}`,
                performedBy: user.username,
                timestamp: now,
                sampleId: String(id)
            }
        });

        let workItems = [];
        try {
            workItems = await prisma.workItem.findMany({
                where: { sampleId: String(id) }
            });
        } catch (e) {
            console.error('[ACCEPT] Failed to fetch generated work items:', e);
        }

        res.json({ ...updated, workItems, warning: workItemWarning || undefined });
    } catch (error) {
        console.error('[acceptSample] Error:', error);
        res.status(500).json({ error: 'Failed to accept sample' });
    }
};
exports.deleteSample = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    try {
        // PERMISSION CHECK
        // SUPER_ADMIN/MASTER_USER can delete anything.
        // LAB_MANAGER and SAMPLE_RECEPTION can delete drafts/errors.
        const deletableRoles = ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'];
        const canDelete = deletableRoles.includes(user.role);

        if (!canDelete) {
            return res.status(403).json({ error: 'You do not have permission to delete samples.' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // ROLE-BASED STATUS & ISOLATION CHECK
        if (user.role !== 'SUPER_ADMIN' && user.role !== 'MASTER_USER') {
            // Only allow deleting DRAFT, EXPECTED or RECEIVED (not yet approved)
            const deletableStatuses = ['DRAFT', 'EXPECTED', 'RECEIVED'];
            if (!deletableStatuses.includes(sample.status)) {
                return res.status(403).json({ error: `Cannot discard sample in ${sample.status} status. Only drafts or received samples can be discarded.` });
            }

            // Lab isolation: Managers/Reception can only delete their own lab's samples
            if (user.labId && sample.labId && user.labId !== sample.labId) {
                return res.status(403).json({ error: 'Access denied: Sample belongs to another lab.' });
            }
        }

        const metadata = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
        if (metadata._uuid || metadata['Country']) {
            return res.status(403).json({ error: 'Cannot delete SoilFER (Google Sheet) samples.' });
        }

        // CHECK PROJECT TYPE: Kobo/Template samples should be REVERTED, not deleted
        let isPreRegistered = false;
        if (sample.projectId || sample.projectCode) {
            const project = await prisma.project.findFirst({
                where: sample.projectId
                    ? { id: sample.projectId }
                    : { code: sample.projectCode }
            });
            if (project && (project.projectType === 'KOBO_LINKED' || project.projectType === 'TEMPLATE_PREDEFINED_IDS')) {
                isPreRegistered = true;
            }
        }

        if (isPreRegistered) {
            // REVERT to EXPECTED: Clear intake data but keep the sample record
            await prisma.$transaction([
                prisma.workItem.deleteMany({ where: { sampleId: String(id) } }),
                prisma.submission.deleteMany({ where: { sampleId: String(id) } }),
                prisma.result.deleteMany({ where: { sampleId: String(id) } })
            ]);

            const { transitionSample } = require('../services/sampleStateService');
            await transitionSample(id, 'EXPECTED', user, 'Sample reset/reverted to EXPECTED by manager', {
                receptionData: null,
                receptionDate: null,
                receivedBy: null,
                dryingStatus: null,
                preparationStatus: null,
                acceptedBy: null,
                acceptedAt: null,
                approvedBy: null,
                approvedAt: null,
                requiredAnalyses: null,
                analysisGroupIds: null,
                lastSubmissionId: null,
                lastSubmissionType: null,
                lastSubmissionAt: null
            });
                prisma.auditLog.create({
                    data: {
                        id: `audit-revert-${Date.now()}`,
                        entity: 'SAMPLE',
                        entityId: id,
                        action: 'REVERT_TO_EXPECTED',
                        performedBy: user.username,
                        details: `Reverted pre-registered sample ${sample.originalId} back to EXPECTED (cleared intake data). Sample record preserved.`,
                        timestamp: new Date()
                    }
                })
            ]);

            return res.json({ message: 'Sample intake discarded. Sample reverted to EXPECTED status.', reverted: true });
        }

        // HARD DELETE for walk-in / open-intake samples
        await prisma.$transaction([
            prisma.workItem.deleteMany({ where: { sampleId: String(id) } }),
            prisma.submission.deleteMany({ where: { sampleId: String(id) } }),
            prisma.spectralData.deleteMany({ where: { sampleId: String(id) } }),
            prisma.result.deleteMany({ where: { sampleId: String(id) } }),
            prisma.sample.delete({ where: { id: String(id) } }),
            prisma.auditLog.create({
                data: {
                    id: `audit-del-${Date.now()}`,
                    entity: 'SAMPLE',
                    entityId: id,
                    action: 'DELETE',
                    performedBy: user.username,
                    details: `Hard deleted sample ${sample.labId || sample.originalId} and associated data.`,
                    timestamp: new Date()
                }
            })
        ]);

        res.json({ message: 'Sample deleted successfully' });
    } catch (error) {
        console.error('[deleteSample] Error:', error);
        res.status(500).json({ error: 'Failed to delete sample' });
    }
};

exports.batchDeleteSamples = async (req, res) => {
    const { ids } = req.body;
    const user = req.user;

    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'No sample IDs provided' });
    }

    try {
        const isSuperAdmin = ['SUPER_ADMIN', 'MASTER_USER'].includes(user.role);
        const isLabStaff = ['LAB_MANAGER', 'SAMPLE_RECEPTION', 'ADMIN'].includes(user.role);

        const samples = await prisma.sample.findMany({
            where: { id: { in: ids.map(id => String(id)) } }
        });

        if (samples.length === 0) {
            return res.status(404).json({ error: 'No valid samples found for the provided IDs.' });
        }

        // Lab staff can only discard DRAFT or RECEIVED samples from their own lab
        if (!isSuperAdmin) {
            if (!isLabStaff) {
                return res.status(403).json({ error: 'Permission Denied: You do not have permission to delete samples.' });
            }

            const invalidSamples = samples.filter(s => {
                const isDiscardable = ['DRAFT', 'RECEIVED', 'COLLECTED'].includes(s.status);
                const isOwnLab = s.assignedLab === user.labId;
                return !isDiscardable || !isOwnLab;
            });

            if (invalidSamples.length > 0) {
                const lockedIds = invalidSamples.map(s => s.id || s.originalId).join(', ');
                return res.status(403).json({
                    error: `Permission Denied: You can only discard Draft/Received samples from your own lab. Blocked: ${lockedIds}`
                });
            }
        }

        // Check if any sample is protected (SoilFER)
        if (isSuperAdmin) {
            const protectedSamples = samples.filter(s => {
                const metadata = typeof s.metadata === 'string' ? JSON.parse(s.metadata) : (s.metadata || {});
                return metadata._uuid || metadata['Country'];
            });

            if (protectedSamples.length > 0) {
                return res.status(403).json({
                    error: `Action blocked: ${protectedSamples.length} samples in your selection are protected (SoilFER/Google Sheet). Please deselect them.`
                });
            }
        }

        // Separate samples: project-linked (revert to EXPECTED) vs walk-in/open (hard delete)
        const toRevert = [];
        const toDelete = [];

        for (const sample of samples) {
            let isPreRegistered = false;
            if (sample.projectId || sample.projectCode) {
                const project = await prisma.project.findFirst({
                    where: sample.projectId
                        ? { id: sample.projectId }
                        : { code: sample.projectCode }
                });
                if (project && (project.projectType === 'KOBO_LINKED' || project.projectType === 'TEMPLATE_PREDEFINED_IDS')) {
                    isPreRegistered = true;
                }
            }

            if (isPreRegistered) {
                toRevert.push(sample);
            } else {
                toDelete.push(sample);
            }
        }

        const txOps = [];

        // REVERT: Project samples → back to EXPECTED
        for (const sample of toRevert) {
            const { transitionSample } = require('../services/sampleStateService');
            await transitionSample(sample.id, 'EXPECTED', user, 'Draft/intake discarded. Sample reverted to EXPECTED status.', {
                labId: null,
                receptionData: null,
                fieldMetadata: null,
                requiredAnalyses: null,
                analysisGroupIds: null,
                metadata: null,
                assignedLab: sample.assignedLab,
                history: JSON.stringify([{
                    status: 'EXPECTED',
                    action: 'REVERT_TO_EXPECTED',
                    changedBy: user.username,
                    timestamp: new Date(),
                    note: 'Draft/intake discarded. Sample reverted to EXPECTED status.'
                }])
            }).catch(e => console.warn('[undoReception] Warning reverting sample:', e.message));

            txOps.push(prisma.workItem.deleteMany({ where: { sampleId: String(sample.id) } }));
            txOps.push(prisma.result.deleteMany({ where: { sampleId: String(sample.id) } }));
        }

        // HARD DELETE: Walk-in/open samples
        if (toDelete.length > 0) {
            const deleteIds = toDelete.map(s => s.id);
            txOps.push(prisma.workItem.deleteMany({ where: { sampleId: { in: deleteIds } } }));
            txOps.push(prisma.submission.deleteMany({ where: { sampleId: { in: deleteIds } } }));
            txOps.push(prisma.spectralData.deleteMany({ where: { sampleId: { in: deleteIds } } }));
            txOps.push(prisma.result.deleteMany({ where: { sampleId: { in: deleteIds } } }));
            txOps.push(prisma.sample.deleteMany({ where: { id: { in: deleteIds } } }));
        }

        // Audit log
        txOps.push(
            prisma.auditLog.create({
                data: {
                    id: `audit-batch-del-${Date.now()}`,
                    entity: 'SAMPLE',
                    entityId: 'BATCH',
                    action: toRevert.length > 0 ? 'BATCH_DISCARD' : 'BATCH_DELETE',
                    performedBy: user.username,
                    details: `Discarded ${samples.length} samples (${toRevert.length} reverted to EXPECTED, ${toDelete.length} hard deleted).`,
                    timestamp: new Date(),
                    before: JSON.stringify(samples.map(s => s.id))
                }
            })
        );

        await prisma.$transaction(txOps);

        const msg = toRevert.length > 0
            ? `${samples.length} samples discarded (${toRevert.length} reverted to EXPECTED, ${toDelete.length} removed).`
            : `${samples.length} samples deleted successfully.`;

        res.json({ message: msg, reverted: toRevert.length, deleted: toDelete.length });
    } catch (error) {
        console.error('[batchDeleteSamples] Error:', error);
        res.status(500).json({ error: 'Failed to batch delete samples' });
    }
};

/**
 * UPDATE SAMPLE METADATA
 
     * UPDATE SAMPLE METADATA
     * PUT /api/samples/:id/metadata
     * Body: { metadata: { key: value, ... } }
     */
exports.updateSampleMetadata = async (req, res) => {
    const { id } = req.params;
    const { metadata } = req.body;
    const user = req.user;

    try {
        if (!['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to edit metadata.' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        if (!(await userHasScopeForSample(user, sample))) {
            return res.status(403).json({ error: 'Sample is outside your scope' });
        }

        const currentMeta = typeof sample.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : (sample.fieldMetadata || {});
        const now = new Date();

        Object.keys(metadata).forEach(key => {
            currentMeta[key] = {
                value: metadata[key],
                source: 'MANUAL_EDIT',
                lastUpdatedBy: user.username,
                lastUpdatedAt: now
            };
        });

        const updated = await prisma.sample.update({
            where: { id: String(id) },
            data: { fieldMetadata: JSON.stringify(currentMeta) }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-meta-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'METADATA_UPDATE',
                details: `Updated metadata fields: ${Object.keys(metadata).join(', ')}`,
                performedBy: user.username,
                timestamp: now,
                sampleId: String(id)
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('[updateSampleMetadata] Error:', error);
        res.status(500).json({ error: 'Failed to update metadata' });
    }
};

/**
 * UPDATE SAMPLE PROJECT
 * PUT /api/samples/:id/project
 * Body: { projectId, projectCode }
 */
exports.updateSampleProject = async (req, res) => {
    const { id } = req.params;
    const { projectId, projectCode } = req.body;
    const user = req.user;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Only Managers can move samples between projects.' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(user, sample, { labField: 'assignedLab', altLabField: 'labId' })) {
            return res.status(403).json({ error: 'Sample is outside your scope' });
        }

        const now = new Date();
        const history = typeof sample.history === 'string' ? JSON.parse(sample.history) : (sample.history || []);
        history.push({
            status: sample.status,
            timestamp: now,
            user: user.username,
            note: `Project changed from ${sample.projectId || sample.projectCode} to ${projectId || projectCode}`
        });

        const updated = await prisma.sample.update({
            where: { id: String(id) },
            data: {
                projectId: projectId || sample.projectId,
                projectCode: projectCode || sample.projectCode,
                history: JSON.stringify(history)
            }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-proj-move-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'PROJECT_CHANGE',
                details: `Moved sample to project ${projectId || projectCode}`,
                performedBy: user.username,
                timestamp: now,
                sampleId: String(id)
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('[updateSampleProject] Error:', error);
        res.status(500).json({ error: 'Failed to update sample project' });
    }
};

/**
 * UPDATE SAMPLE ANALYSES
 * PUT /api/samples/:id/analyses
 * Body: { analyses, analysisGroupIds }
 * Allows adding/editing analyses at any time (even after archiving)
 */
exports.updateSampleAnalyses = async (req, res) => {
    const { id } = req.params;
    const { analyses, analysisGroupIds } = req.body;
    const user = req.user;

    try {
        if (!['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to edit analyses.' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        if (!(await userHasScopeForSample(user, sample))) {
            return res.status(403).json({ error: 'Sample is outside your scope' });
        }

        const before = {
            analyses: sample.requiredAnalyses,
            groups: sample.analysisGroupIds,
            status: sample.status
        };

        const updates = {
            requiredAnalyses: analyses ? JSON.stringify(analyses) : sample.requiredAnalyses,
            analysisGroupIds: analysisGroupIds ? JSON.stringify(analysisGroupIds) : sample.analysisGroupIds
        };

        // If sample was in a final/history state, and new analyses are added, 
        // we move it back to PROCESSING status. 
        if (['APPROVED', 'ARCHIVED', 'DISPOSED'].includes(sample.status) && analyses && analyses.length > 0) {
            updates.status = 'PROCESSING';
            // Ensure processing flags allow technicians to see it
            if (sample.dryingStatus === null) updates.dryingStatus = 'DONE';
            if (sample.preparationStatus === null) updates.preparationStatus = 'DONE';
        }

        const updated = await prisma.sample.update({
            where: { id: String(id) },
            data: updates
        });

        // Generate new work items (this is idempotent for existing ones)
        const newItems = await workItemController.generateWorkItemsForSample(updated);

        await prisma.auditLog.create({
            data: {
                id: `audit-analyses-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'ANALYSES_UPDATE',
                details: `Updated required analyses. New items generated: ${newItems.length}`,
                performedBy: user.username,
                timestamp: new Date(),
                sampleId: String(id),
                before: JSON.stringify(before),
                after: JSON.stringify(updates)
            }
        });

        res.json({
            message: 'Analyses updated successfully',
            sample: updated,
            newItemsCount: newItems.length
        });
    } catch (error) {
        console.error('[updateSampleAnalyses] Error:', error);
        res.status(500).json({ error: 'Failed to update analyses' });
    }
};

exports.approveSample = async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;

    try {
        if (userRole !== 'LAB_MANAGER' && userRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only Managers can approve samples.' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // Check if there are unapproved/pending work items
        const workItems = await prisma.workItem.findMany({ where: { sampleId: String(id) } });
        const unapprovedItems = workItems.filter(w => !['ACCEPTED', 'COMPLETED', 'CANCELLED'].includes(w.status));
        if (unapprovedItems.length > 0) {
            return res.status(409).json({
                error: 'Work items pending approval or completion',
                blockers: unapprovedItems.map(w => ({ id: w.id, analysis: w.analysis, status: w.status }))
            });
        }

        const now = new Date();
        const { transitionSample } = require('../services/sampleStateService');
        const updated = await transitionSample(id, 'APPROVED', req.user, 'Final Approval by Manager', {
            approvedBy: req.user.username,
            approvedAt: now
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-appr-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'SAMPLE_APPROVED',
                details: 'Final Approval by Manager',
                performedBy: req.user.username,
                timestamp: now,
                sampleId: String(id)
            }
        });

        // Also approve any pending/validated spectral records for this sample
        await prisma.spectralData.updateMany({
            where: {
                sampleId: String(id),
                status: { in: ['PENDING', 'VALIDATED'] }
            },
            data: {
                status: 'APPROVED',
                reviewedBy: req.user.username,
                reviewedAt: now
            }
        });

        res.json({ ...updated, success: true, status: 'APPROVED' });
    } catch (error) {
        console.error('[approveSample] Error:', error);
        res.status(500).json({ error: 'Failed to approve sample' });
    }
};

exports.undoApproval = async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;

    try {
        if (userRole !== 'LAB_MANAGER' && userRole !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only Managers can undo approval.' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample || !['APPROVED', 'ARCHIVED', 'DISPOSED'].includes(sample.status)) {
            return res.status(400).json({ error: 'Sample not in a reversible state (must be Approved, Archived, or Disposed).' });
        }

        const previousStatus = sample.status;
        const now = new Date();
        const { transitionSample } = require('../services/sampleStateService');
        await transitionSample(id, 'PROCESSING', user, 'Approval revoked by manager', {
            approvedBy: null,
            approvedAt: null
        });

        // Reset all ACCEPTED work items to SUBMITTED
        const { count } = await prisma.workItem.updateMany({
            where: {
                sampleId: String(id),
                status: 'ACCEPTED'
            },
            data: { status: 'SUBMITTED' }
        });

        // Cleanup: Remove any Post-Analytical work items (Archiving/Disposal)
        // because the sample is no longer approved.
        await prisma.workItem.deleteMany({
            where: {
                sampleId: String(id),
                category: 'Post-Analytical'
            }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-unappr-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'UNDO_APPROVAL',
                details: `Reverted from ${previousStatus} to ACCEPTED. Reset ${count} work items to SUBMITTED and removed post-analytical tasks.`,
                performedBy: req.user.username,
                timestamp: now,
                sampleId: String(id)
            }
        });

        res.json({ success: true, resetItems: count });
    } catch (error) {
        console.error('[undoApproval] Error:', error);
        res.status(500).json({ error: 'Failed to undo approval' });
    }
};

exports.archiveSample = async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const { archiveLocation, notes } = req.body;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to archive.' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        if (sample.status !== 'APPROVED') {
            return res.status(409).json({ error: 'Sample must be in APPROVED status before archiving.' });
        }

        const meta = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
        if (archiveLocation) meta.archiveLocation = archiveLocation;
        if (notes) meta.archiveNotes = notes;

        const now = new Date();
        const { transitionSample } = require('../services/sampleStateService');
        const updated = await transitionSample(id, 'ARCHIVED', user, `Sample archived at location ${archiveLocation || 'ARCHIVE'}`, {
            metadata: JSON.stringify(meta)
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-arch-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'SAMPLE_ARCHIVED',
                details: `Sample archived at location ${archiveLocation || 'ARCHIVE'}`,
                performedBy: user.username,
                timestamp: now,
                sampleId: String(id)
            }
        });

        res.json({
            ...updated,
            success: true,
            status: 'ARCHIVED',
            archiveLocation: archiveLocation || meta.archiveLocation || 'ARCHIVE'
        });
    } catch (error) {
        console.error('[archiveSample] Error:', error);
        res.status(500).json({ error: 'Failed to archive sample' });
    }
};

exports.disposeSample = async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const { disposalMethod, notes } = req.body;

    try {
        if (!['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions to dispose.' });
        }

        const sample = await prisma.sample.findUnique({ where: { id: String(id) } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        if (sample.status !== 'APPROVED') {
            return res.status(409).json({ error: 'Sample must be in APPROVED status before disposal.' });
        }

        const meta = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {});
        if (disposalMethod) meta.disposalMethod = disposalMethod;
        if (notes) meta.disposalNotes = notes;

        const now = new Date();
        const { transitionSample } = require('../services/sampleStateService');
        const updated = await transitionSample(id, 'DISPOSED', user, `Sample disposed via ${disposalMethod || 'STANDARD'}`, {
            metadata: JSON.stringify(meta)
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-disp-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: id,
                action: 'SAMPLE_DISPOSED',
                details: `Sample disposed via ${disposalMethod || 'STANDARD'}`,
                performedBy: user.username,
                timestamp: now,
                sampleId: String(id)
            }
        });

        res.json({
            ...updated,
            success: true,
            status: 'DISPOSED',
            disposalMethod: disposalMethod || meta.disposalMethod || 'STANDARD'
        });
    } catch (error) {
        console.error('[disposeSample] Error:', error);
        res.status(500).json({ error: 'Failed to dispose sample' });
    }
};

// ─── GET /api/samples/locations ─── (Globe GPS data)
exports.getSampleLocations = async (req, res) => {
    try {
        const user = req.user;
        const { project, status } = req.query;
        const where = {};

        // Lab isolation
        if (user.labId) {
            where.assignedLab = user.labId;
        }
        if (project) where.projectCode = project;
        if (status) where.status = status;

        const samples = await prisma.sample.findMany({
            where,
            select: {
                id: true,
                originalId: true,
                projectCode: true,
                status: true,
                country: true,
                fieldMetadata: true
            }
        });

        const v = (obj) => obj && typeof obj === 'object' ? obj.value : obj;

        const results = samples.map(s => {
            let lat = null, lng = null, location = null;
            try {
                const fm = typeof s.fieldMetadata === 'string' ? JSON.parse(s.fieldMetadata) : s.fieldMetadata;
                if (fm) {
                    lat = parseFloat(v(fm.latitude) || v(fm.lat) || v(fm.gps_latitude)) || null;
                    lng = parseFloat(v(fm.longitude) || v(fm.lng) || v(fm.gps_longitude) || v(fm.lon)) || null;
                    location = v(fm.location) || v(fm.site) || v(fm.village) || v(fm.district) || null;
                }
            } catch (e) { }

            return {
                id: s.id,
                originalId: s.originalId,
                projectCode: s.projectCode,
                status: s.status,
                country: s.country,
                lat,
                lng,
                location
            };
        }).filter(s => s.lat && s.lng); // Only return samples with coordinates

        res.json(results);
    } catch (error) {
        console.error('[getSampleLocations] Error:', error);
        res.status(500).json({ error: 'Failed to fetch locations' });
    }
};
