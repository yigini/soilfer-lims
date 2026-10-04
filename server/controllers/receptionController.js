const cataloguePolicy = require('../services/cataloguePolicy');
const prisma = require('../prisma');
const workflow = require('../workflowContract');
const idGenerator = require('../services/idGenerator');
const sampleCodes = require('../services/sampleCodeService');
const { parseCoordinates } = require('../utils/coordParser');
const adminBoundaries = require('../data/adminBoundaries.json');
const crypto = require('crypto');
const sampleOriginService = require('../services/sampleOriginService');
const sampleStateService = require('../services/sampleStateService');
const projectPolicyService = require('../services/projectPolicyService');
const profileIdentity = require('../services/profileIdentityService');
const intakeProfile = require('../services/intakeProfileService');
const { massRequirement, massDeficit } = require('../services/intakeMassService');
const batchObservations = require('../services/batchIntakeObservationsService');

// In-memory cache for reverse geocoding (24hr TTL)
const geocodeCache = new Map();

const { LOCKED_INTAKE_STATUSES, deriveLocationConfidence, resolveAnalysisGroup, evaluateChecklistCompliance } = require('../services/intakeValidationService');
Object.assign(exports, { LOCKED_INTAKE_STATUSES, deriveLocationConfidence, resolveAnalysisGroup, evaluateChecklistCompliance });

exports.processIntake = async (req, res) => {
    try {
        const result = await prisma.$transaction(tx => require('../services/intakeService').intake(tx, { body: req.body, user: req.user }), { timeout: 30000 });
        return res.json(result.response);
    } catch (error) {
        return require('../services/intakeErrors').respond(res, error);
    }
};

/**
 * POST /api/reception/discard
 * Discard a DRAFT or RECEIVED sample from the reception console.
 * - Project samples (pre-registered) → revert to EXPECTED
 * - Walk-in / open samples → hard delete
 */
exports.discardDraft = async (req, res) => {
    const { id } = req.body;
    const user = req.user;

    if (!id) {
        return res.status(400).json({ error: 'Sample ID is required.' });
    }

    try {
        const sample = await prisma.sample.findFirst({
            where: { id: String(id) }
        });

        if (!sample) {
            return res.status(404).json({ error: 'Sample not found.' });
        }

        // Only initial intake stages can be discarded
        const discardableStatuses = ['DRAFT', 'RECEIVED', 'COLLECTED', 'EXPECTED'];
        if (!discardableStatuses.includes(sample.status)) {
            return res.status(409).json({
                error: 'ILLEGAL_STATUS_TRANSITION',
                message: `Cannot discard sample in status '${sample.status}'. Only draft or unreceived samples can be discarded.`
            });
        }

        // Lab scope check
        if (sample.assignedLab && sample.assignedLab !== user.labId) {
            return res.status(403).json({ error: 'You can only discard samples from your own lab.' });
        }

        // Determine if this is a disposable desk walk-in draft vs pre-registered/project sample
        const isDeskWalkIn = sampleOriginService.isDisposableDeskDraft(sample);

        if (!isDeskWalkIn) {
            // REVERT to EXPECTED — fully atomic transaction with canonical workflow validation (I04)
            await prisma.$transaction(async (tx) => {
                const current = await tx.sample.findUnique({ where: { id: String(sample.id) } });
                if (!current) throw new sampleStateService.TransitionError('Sample not found', 404, 'SAMPLE_NOT_FOUND');

                if (!discardableStatuses.includes(current.status)) {
                    throw new sampleStateService.TransitionError(
                        `Cannot discard sample in status '${current.status}'. Samples in progress or completed cannot be reset.`,
                        409,
                        'ILLEGAL_STATUS_TRANSITION'
                    );
                }

                // Check for results or completed work
                const resultCount = await tx.result.count({ where: { sampleId: String(sample.id) } });
                if (resultCount > 0) {
                    throw new sampleStateService.TransitionError('Cannot discard sample with existing analytical results.', 409, 'CANNOT_DELETE_SAMPLE_WITH_RESULTS');
                }
                const activeWork = await tx.workItem.findMany({
                    where: {
                        sampleId: String(sample.id),
                        status: { in: ['COMPLETED', 'SUBMITTED', 'ACCEPTED'] }
                    }
                });
                if (activeWork.length > 0) {
                    throw new sampleStateService.TransitionError('Cannot discard sample with analytical work completed or submitted.', 409, 'ACTIVE_WORK_IN_PROGRESS');
                }

                await tx.workItem.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.result.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.submission.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.spectralData.deleteMany({ where: { sampleId: String(sample.id) } });

                const sampleHistory = typeof current.history === 'string'
                    ? JSON.parse(current.history)
                    : (current.history || []);
                sampleHistory.push({
                    status: 'EXPECTED',
                    action: 'REVERT_TO_EXPECTED',
                    changedBy: user.username,
                    timestamp: new Date(),
                    note: 'Draft/intake discarded by reception. Sample reverted to EXPECTED.'
                });

                // Canonical transition inside transaction (enforces workflowContract graph and logs transition audit)
                await sampleStateService.transitionSample(
                    current.id,
                    'EXPECTED',
                    user,
                    'Draft/intake discarded by reception. Sample reverted to EXPECTED.',
                    {
                        labId: null,
                        receptionData: null,
                        receptionDate: null,
                        receivedBy: null,
                        requiredAnalyses: null,
                        analysisGroupIds: null,
                        dryingStatus: null,
                        preparationStatus: null,
                        acceptedBy: null,
                        acceptedAt: null,
                        approvedBy: null,
                        approvedAt: null,
                        lastSubmissionId: null,
                        lastSubmissionType: null,
                        lastSubmissionAt: null,
                        assignedLab: current.assignedLab,
                        history: JSON.stringify(sampleHistory)
                    },
                    tx
                );

                await tx.auditLog.create({
                    data: {
                        id: crypto.randomUUID(),
                        entity: 'SAMPLE',
                        entityId: String(sample.id),
                        action: 'DRAFT_DISCARDED',
                        details: `Project sample ${sample.originalId} reverted to EXPECTED by reception.`,
                        performedBy: user.username,
                        timestamp: new Date(),
                        sampleId: String(sample.id)
                    }
                });
            });

            console.log(`[DISCARD] Reverted project sample ${sample.id} to EXPECTED`);
            return res.json({ success: true, message: `Sample ${sample.originalId} reverted to EXPECTED.` });
        } else {
            // HARD DELETE walk-in — fully atomic transaction with safety validation
            await prisma.$transaction(async (tx) => {
                const current = await tx.sample.findUnique({ where: { id: String(sample.id) } });
                if (!current) throw new sampleStateService.TransitionError('Sample not found', 404, 'SAMPLE_NOT_FOUND');

                if (!discardableStatuses.includes(current.status)) {
                    throw new sampleStateService.TransitionError(
                        `Cannot delete walk-in sample in status '${current.status}'.`,
                        409,
                        'ILLEGAL_STATUS_TRANSITION'
                    );
                }

                const resultCount = await tx.result.count({ where: { sampleId: String(sample.id) } });
                if (resultCount > 0) {
                    throw new sampleStateService.TransitionError('Cannot delete sample with existing analytical results.', 409, 'CANNOT_DELETE_SAMPLE_WITH_RESULTS');
                }

                await tx.workItem.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.result.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.submission.deleteMany({ where: { sampleId: String(sample.id) } });
                await tx.spectralData.deleteMany({ where: { sampleId: String(sample.id) } });

                await tx.auditLog.create({
                    data: {
                        id: crypto.randomUUID(),
                        entity: 'SAMPLE',
                        entityId: String(sample.id),
                        action: 'SAMPLE_DELETED',
                        details: `Walk-in sample ${sample.originalId} hard deleted by reception.`,
                        performedBy: user.username,
                        timestamp: new Date()
                    }
                });

                await tx.sample.delete({ where: { id: String(sample.id) } });
            });

            console.log(`[DISCARD] Hard deleted walk-in sample ${sample.id}`);
            return res.json({ success: true, message: `Sample ${sample.originalId} deleted.` });
        }
    } catch (error) {
        if (error.name === 'TransitionError' || error.code === 'ILLEGAL_STATUS_TRANSITION' || error.statusCode) {
            return res.status(error.statusCode || 409).json({
                error: error.code || 'ILLEGAL_STATUS_TRANSITION',
                message: error.message
            });
        }
        console.error('[discardDraft] ERROR:', error);
        res.status(500).json({ error: 'Failed to discard: ' + error.message });
    }
};

/**
 * GET /api/reception/check-duplicate?originalId=...&sampleId=...
 * RC-04: Duplicate and Re-submission Detection
 */
exports.checkDuplicate = async (req, res) => {
    const { originalId, sampleId } = req.query;
    if (!originalId && !sampleId) {
        return res.status(400).json({ error: 'Missing originalId or sampleId parameter' });
    }

    try {
        const queryTerm = String(originalId || sampleId).trim();
        const sample = await prisma.sample.findFirst({
            where: {
                OR: [
                    { originalId: queryTerm },
                    { id: queryTerm }
                ]
            },
            select: {
                id: true,
                originalId: true,
                labId: true,
                status: true,
                receptionDate: true,
                receivedBy: true,
                assignedLab: true,
                projectCode: true,
                receivedMass: true,
                moistureOnArrival: true
            }
        });

        if (!sample) {
            return res.json({ exists: false });
        }

        const priorReceiptStatuses = [
            'RECEIVED', 'ACCEPTED', 'PROCESSING', 'COMPLETED',
            'APPROVED', 'SUBMITTED_PARTIAL', 'SUBMITTED_FULL', 'IN_PROGRESS'
        ];
        const isPriorReceipt = priorReceiptStatuses.includes(sample.status);

        return res.json({
            exists: true,
            isPriorReceipt,
            sample
        });
    } catch (err) {
        console.error('[checkDuplicate] ERROR:', err);
        return res.status(500).json({ error: 'Failed to check duplicate: ' + err.message });
    }
};

/**
 * POST /api/reception/mass-check
 * RC-01: Analytical Mass Sufficiency Calculation
 */
exports.calculateMassRequirement = async (req, res) => {
    const { analysisCodes = [], analysisGroupIds = [], retentionMass } = req.body;

    try {
        const codes = new Set(Array.isArray(analysisCodes) ? analysisCodes : []);

        if (Array.isArray(analysisGroupIds) && analysisGroupIds.length > 0) {
            const groups = await prisma.analysisGroup.findMany({
                where: { id: { in: analysisGroupIds } }
            });
            groups.forEach(g => {
                const arr = g.analyses ? JSON.parse(g.analyses) : [];
                arr.forEach(c => codes.add(c));
            });
        }

        const analysisList = await prisma.analysis.findMany({
            where: { code: { in: Array.from(codes) } },
            select: { code: true, name: true, sampleMassRequired: true }
        });

        return res.json({
            success: true,
            ...await massRequirement(req.user?.labId, analysisList, retentionMass)
        });
    } catch (err) {
        console.error('[calculateMassRequirement] ERROR:', err);
        return res.status(500).json({ error: 'Failed to calculate mass requirement: ' + err.message });
    }
};

/**
 * POST /api/reception/upload-photo
 * RC-03: Upload Intake or Non-Conformance Photographs
 */
exports.uploadIntakePhoto = (req, res) => {
    try {
        const files = req.files || (req.file ? [req.file] : []);
        if (files.length === 0) {
            return res.status(400).json({ success: false, error: 'No image file uploaded' });
        }

        const urls = files.map(f => `/uploads/intake/${f.filename}`);
        return res.json({
            success: true,
            urls,
            url: urls[0]
        });
    } catch (err) {
        console.error('[uploadIntakePhoto] ERROR:', err);
        return res.status(500).json({ error: 'Photo upload failed: ' + err.message });
    }
};

/**
 * GET /api/reception/admin-units
 * RC-05 & RC-08: Administrative hierarchy picker
 */
exports.getAdminUnits = (req, res) => {
    try {
        const { country } = req.query;
        if (country) {
            const data = adminBoundaries[country.toUpperCase()];
            if (!data) return res.status(404).json({ error: `No administrative data for country: ${country}` });
            return res.json({ success: true, country: country.toUpperCase(), ...data });
        }
        return res.json({ success: true, countries: adminBoundaries });
    } catch (err) {
        console.error('[getAdminUnits] ERROR:', err);
        return res.status(500).json({ error: 'Failed to fetch admin units: ' + err.message });
    }
};

/**
 * POST /api/reception/parse-coordinates
 * RC-05: Parse any coordinate string (DD, DMS, UTM)
 */
exports.parseCoordinatesEndpoint = (req, res) => {
    try {
        const { coordinates } = req.body;
        if (!coordinates) {
            return res.status(400).json({ error: 'Coordinates string is required' });
        }
        const parsed = parseCoordinates(coordinates);
        if (!parsed) {
            return res.status(400).json({ error: 'Could not parse coordinates. Accepted formats: DD, DMS, UTM with Zone.' });
        }
        return res.json({ success: true, ...parsed });
    } catch (err) {
        console.error('[parseCoordinatesEndpoint] ERROR:', err);
        return res.status(500).json({ error: 'Failed to parse coordinates: ' + err.message });
    }
};

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function findNearestOfflineAdmin(lat, lng) {
    let nearest = null;
    let minDistance = Infinity;

    for (const [countryCode, cData] of Object.entries(adminBoundaries)) {
        for (const dept of cData.departments || []) {
            for (const mun of dept.municipalities || []) {
                const [cLat, cLng] = mun.center;
                const d = haversineDistanceKm(lat, lng, cLat, cLng);
                if (d < minDistance) {
                    minDistance = d;
                    nearest = {
                        village: mun.name,
                        municipality: mun.name,
                        district: dept.name,
                        country: cData.name,
                        countryCode,
                        displayName: `${mun.name}, ${dept.name}, ${cData.name}`,
                        distanceKm: parseFloat(d.toFixed(1))
                    };
                }
            }
        }
    }
    return { nearest, minDistance };
}

/**
 * GET /api/reception/reverse-geocode
 * RC-08: Server-side geocoding proxy with caching & offline fallback
 */
exports.reverseGeocode = async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);

        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ error: 'Valid lat and lng query parameters are required' });
        }

        const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
        if (geocodeCache.has(cacheKey)) {
            const cached = geocodeCache.get(cacheKey);
            return res.json({ success: true, ...cached, source: 'CACHE' });
        }

        const { nearest, minDistance } = findNearestOfflineAdmin(lat, lng);

        let onlineResult = null;
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'SoilFER-LIMS/1.0 (+https://soilfer.org; FAO Technical Cooperation Program)'
                },
                signal: AbortSignal.timeout(3500)
            });

            if (response.ok) {
                const data = await response.json();
                if (data && data.address) {
                    const addr = data.address;
                    const town = addr.village || addr.town || addr.city || addr.suburb || addr.municipality || nearest?.municipality || '';
                    const district = addr.county || addr.state_district || addr.state || nearest?.district || '';
                    const country = addr.country || nearest?.country || '';
                    const countryCode = (addr.country_code || nearest?.countryCode || '').toUpperCase();

                    onlineResult = {
                        village: town,
                        municipality: town,
                        district,
                        country,
                        countryCode,
                        displayName: data.display_name || `${town}, ${district}, ${country}`
                    };
                }
            }
        } catch (osmErr) {
            console.warn('[reverseGeocode] OSM Nominatim unavailable, falling back to catalog:', osmErr.message);
        }

        if (onlineResult) {
            geocodeCache.set(cacheKey, onlineResult);
            return res.json({ success: true, ...onlineResult, source: 'ONLINE' });
        }

        if (nearest && minDistance <= 80) {
            geocodeCache.set(cacheKey, nearest);
            return res.json({ success: true, ...nearest, source: 'OFFLINE_BOUNDARY' });
        }

        return res.json({
            success: true,
            village: '',
            municipality: '',
            district: '',
            country: nearest?.country || '',
            countryCode: nearest?.countryCode || '',
            displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            source: 'FALLBACK'
        });
    } catch (err) {
        console.error('[reverseGeocode] ERROR:', err);
        return res.status(500).json({ error: 'Reverse geocode failed: ' + err.message });
    }
};

/**
 * GET /api/reception/batch-geometry-check
 * RC-10: Batch geometry outlier check
 */
exports.batchGeometryCheck = async (req, res) => {
    try {
        const { projectId, lat: latStr, lng: lngStr, sampleId } = req.query;
        const candLat = parseFloat(latStr);
        const candLng = parseFloat(lngStr);

        if (isNaN(candLat) || isNaN(candLng)) {
            return res.status(400).json({ error: 'Valid candidate lat and lng are required' });
        }

        if (!projectId) {
            return res.json({ isOutlier: false, reason: 'No project specified' });
        }

        const projectSamples = await prisma.sample.findMany({
            where: {
                OR: [
                    { projectId },
                    { projectCode: projectId }
                ],
                latitude: { not: null },
                longitude: { not: null },
                ...(sampleId ? { id: { not: sampleId } } : {})
            },
            select: { id: true, originalId: true, latitude: true, longitude: true }
        });

        if (projectSamples.length < 2) {
            return res.json({
                isOutlier: false,
                sampleCount: projectSamples.length,
                reason: 'Insufficient existing sample points for cluster outlier calculation'
            });
        }

        const count = projectSamples.length;
        const avgLat = projectSamples.reduce((sum, s) => sum + s.latitude, 0) / count;
        const avgLng = projectSamples.reduce((sum, s) => sum + s.longitude, 0) / count;

        const distances = projectSamples.map(s => haversineDistanceKm(avgLat, avgLng, s.latitude, s.longitude));
        distances.sort((a, b) => a - b);
        const medianClusterRadiusKm = distances[Math.floor(distances.length / 2)];

        const candDistToCentroid = haversineDistanceKm(avgLat, avgLng, candLat, candLng);
        const isOutlier = candDistToCentroid > 40.0 || (candDistToCentroid > 20.0 && candDistToCentroid > 3 * medianClusterRadiusKm);

        return res.json({
            success: true,
            isOutlier,
            distanceKm: parseFloat(candDistToCentroid.toFixed(1)),
            clusterMedianRadiusKm: parseFloat(medianClusterRadiusKm.toFixed(1)),
            clusterCentroid: { lat: parseFloat(avgLat.toFixed(5)), lng: parseFloat(avgLng.toFixed(5)) },
            sampleCount: count,
            warning: isOutlier
                ? `Spatial Outlier Warning: Coordinate is ${candDistToCentroid.toFixed(1)} km from project cluster centroid (median radius: ${medianClusterRadiusKm.toFixed(1)} km across ${count} samples). Verify against label transposition.`
                : null
        });
    } catch (err) {
        console.error('[batchGeometryCheck] ERROR:', err);
        return res.status(500).json({ error: 'Batch geometry check failed: ' + err.message });
    }
};

/**
 * POST /api/reception/consignments
 * RC-12: Consignment Record
 * RC-13: High-Throughput Batch Receive
 * RC-14: Per-Sample Exception Handling in Batch Intake
 */
exports.processBatchConsignmentIntake = async (req, res) => {
    try {
        const user = req.user;
        const { consignment: csgInput = {}, defaults = {}, samples = [], bulkApplications = [] } = req.body;

        if (!Array.isArray(samples) || samples.length === 0) {
            return res.status(400).json({ error: 'At least one sample is required for batch intake' });
        }

        const userLab = user?.labId || 'GEN';
        const receivedBy = user?.username || 'reception_staff';
        const now = new Date();

        // Validate project admission policy for consignment and batch samples (PM-14)
        const projectRefs = new Set();
        if (csgInput.projectCode) projectRefs.add(String(csgInput.projectCode));
        if (csgInput.projectId) projectRefs.add(String(csgInput.projectId));
        for (const s of samples) {
            if (s.projectCode) projectRefs.add(String(s.projectCode));
            if (s.projectId) projectRefs.add(String(s.projectId));
        }

        const sampleOriginalIds = samples.map(s => String(s.originalId || s.id || '')).filter(Boolean);
        if (sampleOriginalIds.length > 0) {
            const existingSamplesWithProj = await prisma.sample.findMany({
                where: {
                    OR: [
                        { originalId: { in: sampleOriginalIds } },
                        { id: { in: sampleOriginalIds } }
                    ]
                },
                select: { id: true, originalId: true, projectId: true, projectCode: true, metadata: true }
            });
            for (const es of existingSamplesWithProj) {
                // Check for active provenance hold (Finding 4: Ambiguous specimen identity must remain visibly unresolved)
                let esMeta = {};
                try {
                    esMeta = typeof es.metadata === 'string' ? JSON.parse(es.metadata) : (es.metadata || {});
                } catch (e) {}
                if (esMeta.provenanceHold && esMeta.provenanceHold.status === 'AMBIGUOUS_PROVENANCE_HOLD') {
                    return res.status(409).json({
                        error: 'PROVENANCE_HOLD',
                        code: 'AMBIGUOUS_PROVENANCE_HOLD',
                        message: `Cannot process batch consignment intake: Sample '${es.originalId || es.id}' has an active provenance hold (${esMeta.provenanceHold.reason}). Physical intake is blocked pending field reconciliation.`
                    });
                }

                if (es.projectId) projectRefs.add(String(es.projectId));
                if (es.projectCode) projectRefs.add(String(es.projectCode));

                const csgProj = csgInput.projectId || csgInput.projectCode;
                const sampleProj = es.projectId || es.projectCode;
                if (csgProj && sampleProj && String(csgProj) !== String(es.projectId) && String(csgProj) !== String(es.projectCode)) {
                    return res.status(400).json({
                        error: 'CROSS_PROJECT_CONFLICT',
                        message: `Sample ${es.originalId || es.id} is already registered to project ${sampleProj}. Direct project reassignment via consignment intake is not permitted.`
                    });
                }
            }
        }

        if (projectRefs.size > 0) {
            const allReferencedProjects = await prisma.project.findMany({
                where: {
                    OR: [
                        { id: { in: Array.from(projectRefs) } },
                        { code: { in: Array.from(projectRefs) } }
                    ]
                }
            });

            for (const proj of allReferencedProjects) {
                const { hasException, exceptionRecord } = await projectPolicyService.resolveAndVerifyExceptionRecord({
                    rawExceptionRecord: req.body.exceptionRecord,
                    rawExceptionReason: req.body.exceptionReason,
                    authorizer: req.body.authorizer,
                    approvalId: req.body.approvalId || req.body.approvalToken,
                    actor: user,
                    project: proj,
                    labId: userLab,
                    channel: 'MANIFEST',
                    prismaClient: prisma
                });

                const admission = projectPolicyService.canAdmitSample({
                    project: proj,
                    channel: 'MANIFEST',
                    actor: user,
                    labId: userLab,
                    hasException,
                    exceptionRecord
                });
                if (!admission.allowed) {
                    return res.status(422).json({
                        error: (admission.code === 'PROJECT_CLOSED' || admission.code === 'PROJECT_PAUSED') ? 'PROJECT_ADMISSIONS_PAUSED' : (admission.code || 'PROJECT_ADMISSIONS_BLOCKED'),
                        message: `Cannot receive consignment: ${admission.reason}`,
                        exceptionRequired: Boolean(admission.exceptionRequired)
                    });
                }
            }
        }

        // 1. Generate unique sequential consignment code CSG-YYYYMMDD-XXX
        const todayStr = now.toISOString().slice(0, 10).replace(/-/g, '');
        const csgPrefix = `CSG-${todayStr}-`;
        const countToday = await prisma.consignment.count({
            where: { code: { startsWith: csgPrefix } }
        });
        const consignmentCode = `${csgPrefix}${String(countToday + 1).padStart(3, '0')}`;

        // 2. Count statuses
        let acceptedCount = 0;
        let rejectedCount = 0;
        samples.forEach(s => {
            if (s.status === 'REJECTED') rejectedCount++;
            else acceptedCount++;
        });

        const consignmentStatus = rejectedCount === samples.length ? 'REJECTED' : (rejectedCount > 0 ? 'PARTIAL' : 'RECEIVED');

        // 3. Preload all analyses for mass requirement calculation
        const allAnalysesDb = await prisma.analysis.findMany({
            select: { code: true, name: true, sampleMassRequired: true, category: true }
        });
        const analysisMap = new Map(allAnalysesDb.map(a => [a.code, a]));
        const appliedObservations = batchObservations.normalizeApplications(bulkApplications, samples);
        const observedRows = [];
        const massWarnings = [];

        // Validate every sample before creating the consignment or any sample records.
        for (const [index, sample] of samples.entries()) {
            const observed = batchObservations.observations(sample, appliedObservations);
            observedRows.push(observed);
            if (sample.status === 'REJECTED') continue;
            const selected = await cataloguePolicy.validateSelection(sample.requiredAnalyses ?? defaults.requiredAnalyses ?? [], { labId: userLab });
            if (!selected.valid) return res.status(400).json({ error: selected.error, message: selected.error, row: index + 1, issues: selected.issues });
            const analyses = allAnalysesDb.filter(analysis => (sample.requiredAnalyses ?? defaults.requiredAnalyses ?? []).includes(analysis.code));
            observed.massDeficitInfo = massDeficit(observed.receivedMass, await massRequirement(userLab, analyses));
            if (observed.massDeficitInfo && sample.massWarningAcknowledged !== true) massWarnings.push({ row: index + 1,
                originalId: sample.originalId || sample.id, code: 'MASS_DEFICIT', massDeficitInfo: observed.massDeficitInfo });
        }
        if (massWarnings.length) {
            return res.status(400).json({ success: false, error: 'MASS_DEFICIT', code: 'MASS_DEFICIT',
                message: 'Received mass is insufficient for the ordered tests and archive retention. Review and acknowledge each affected row.',
                massDeficitInfo: massWarnings[0].massDeficitInfo, warnings: massWarnings });
        }

        // Canonical project resolution (F11)
        const candidateConsignmentProject = csgInput.projectCode || csgInput.projectId;
        const resolvedConsignmentProject = candidateConsignmentProject
            ? await projectPolicyService.resolveProject(candidateConsignmentProject, prisma)
            : null;

        // Gate consignment intake through centralized admission policy
        if (resolvedConsignmentProject) {
            const { hasException, exceptionRecord } = await projectPolicyService.resolveAndVerifyExceptionRecord({
                rawExceptionRecord: req.body.exceptionRecord,
                rawExceptionReason: req.body.exceptionReason,
                authorizer: req.body.authorizer,
                approvalId: req.body.approvalId || req.body.approvalToken,
                actor: user,
                project: resolvedConsignmentProject.project,
                labId: userLab,
                channel: 'MANIFEST',
                prismaClient: prisma
            });

            const admission = projectPolicyService.canAdmitSample({
                project: resolvedConsignmentProject.project,
                channel: 'MANIFEST',
                actor: user,
                labId: userLab,
                hasException,
                exceptionRecord
            });

            if (!admission.allowed) {
                return res.status(422).json({
                    error: (admission.code === 'PROJECT_CLOSED' || admission.code === 'PROJECT_PAUSED') ? 'PROJECT_ADMISSIONS_PAUSED' : (admission.code || 'PROJECT_ADMISSIONS_BLOCKED'),
                    message: admission.reason,
                    exceptionRequired: Boolean(admission.exceptionRequired)
                });
            }
        }

        // 4. Atomic transaction across consignment and all samples
        const result = await prisma.$transaction(async (tx) => {
            // A. Create Consignment Record (RC-12)
            const consignment = await tx.consignment.create({
                data: {
                    id: crypto.randomUUID(),
                    code: consignmentCode,
                    labId: userLab,
                    projectCode: resolvedConsignmentProject ? resolvedConsignmentProject.code : (csgInput.projectCode || null),
                    submitterName: csgInput.submitterName || csgInput.submitter?.name || null,
                    submitterOrg: csgInput.submitterOrg || csgInput.submitter?.organization || null,
                    submitterPhone: csgInput.submitterPhone || csgInput.submitter?.phone || null,
                    submitterEmail: csgInput.submitterEmail || csgInput.submitter?.email || null,
                    deliveredBy: csgInput.deliveredBy || null,
                    deliveredAt: csgInput.deliveredAt ? new Date(csgInput.deliveredAt) : null,
                    receivedBy,
                    receivedAt: now,
                    deliveryNoteRef: csgInput.deliveryNoteRef || null,
                    expectedCount: parseInt(csgInput.expectedCount) || samples.length,
                    sampleCount: samples.length,
                    acceptedCount,
                    rejectedCount,
                    status: consignmentStatus,

                    // Stage E: Chain of Custody & Handover (RC-19)
                    custodyHandoverAt: csgInput.custodyHandoverAt ? new Date(csgInput.custodyHandoverAt) : (csgInput.deliveredAt ? new Date(csgInput.deliveredAt) : now),
                    custodyCarrierName: csgInput.custodyCarrierName || csgInput.deliveredBy || null,
                    custodyTrackingNumber: csgInput.custodyTrackingNumber || csgInput.deliveryNoteRef || null,
                    custodySenderSignature: csgInput.custodySenderSignature || null,
                    receivingOfficerId: user?.id ? String(user.id) : null,
                    receivingOfficerName: user?.name || user?.username || receivedBy,
                    receivingOfficerSignature: csgInput.receivingOfficerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`,

                    notes: csgInput.notes || null,
                    metadata: csgInput.metadata ? JSON.stringify(csgInput.metadata) : null
                }
            });

            // B. Process each sample
            const processedSamples = [];

            for (let i = 0; i < samples.length; i++) {
                const s = samples[i];
                const originalId = String(s.originalId || s.id || `SMP-${i + 1}`).trim();
                const isRejected = s.status === 'REJECTED';
                const status = isRejected ? 'RECEIVED_REJECTED' : workflow.SAMPLE_STATES.ACCEPTED;
                const rejectionReason = isRejected ? (s.rejectionReason || 'Sample non-conformance recorded during batch reception') : null;

                const observed = observedRows[i];
                const parsedMass = observed.receivedMass;
                const moisture = observed.moistureOnArrival;
                const foreignMat = s.foreignMaterial || defaults.foreignMaterial || [];
                const photos = s.intakePhotos || [];
                const reqAnalyses = s.requiredAnalyses ?? defaults.requiredAnalyses ?? [];

                // Geodesy / Location
                let lat = null, lng = null, elev = null;
                if (s.latitude !== undefined && s.latitude !== null && s.latitude !== '') {
                    lat = parseFloat(s.latitude);
                    lng = s.longitude !== undefined && s.longitude !== null ? parseFloat(s.longitude) : null;
                    elev = s.elevation !== undefined && s.elevation !== null ? parseFloat(s.elevation) : null;
                } else if (s.coordinates) {
                    lat = parseFloat(s.coordinates.lat);
                    lng = parseFloat(s.coordinates.lng);
                    elev = parseFloat(s.coordinates.elevation);
                }

                const uncertaintyM = observed.positionalUncertaintyM;

                const compRadius = s.compositeRadiusM !== undefined && s.compositeRadiusM !== null && s.compositeRadiusM !== ''
                    ? parseFloat(s.compositeRadiusM)
                    : (defaults.compositeRadiusM ? parseFloat(defaults.compositeRadiusM) : null);

                const depthTop = s.depthTopCm !== undefined && s.depthTopCm !== null && s.depthTopCm !== ''
                    ? parseFloat(s.depthTopCm)
                    : (defaults.depthTopCm !== undefined && defaults.depthTopCm !== null ? parseFloat(defaults.depthTopCm) : null);

                const depthBottom = s.depthBottomCm !== undefined && s.depthBottomCm !== null && s.depthBottomCm !== ''
                    ? parseFloat(s.depthBottomCm)
                    : (defaults.depthBottomCm !== undefined && defaults.depthBottomCm !== null ? parseFloat(defaults.depthBottomCm) : null);

                const locSource = s.locationSource || (lat && lng ? 'DESK_PASTE' : 'TEXT_ONLY');

                // Check if sample already exists (e.g. EXPECTED sample in Project)
                const existing = await tx.sample.findFirst({
                    where: {
                        OR: [
                            { originalId },
                            { id: originalId }
                        ]
                    }
                });
                if (existing && resolvedConsignmentProject && ((existing.projectCode && existing.projectCode !== resolvedConsignmentProject.code) || (existing.projectId && existing.projectId !== resolvedConsignmentProject.id))) throw new profileIdentity.ProfileReferenceConflictError('CROSS_PROJECT_CONFLICT');
                if (existing) {
                    require('../utils/scopeGuard').ensureScope(user, existing, {altLabField: 'assignedLab'});
                    if (LOCKED_INTAKE_STATUSES.includes(existing.status) || existing.approvedAt) throw new profileIdentity.ProfileReferenceConflictError('SAMPLE_LOCKED');
                    const currentMeta = intakeProfile.parseFieldMetadata(existing.metadata);
                    if (currentMeta.provenanceHold?.status === 'AMBIGUOUS_PROVENANCE_HOLD') throw new profileIdentity.ProfileReferenceConflictError('PROVENANCE_HOLD');
                }

                const labId = existing && await sampleCodes.issuedCode(existing, tx) || await idGenerator.generateLabId(userLab, 'S', tx,
                    { projectCode: resolvedConsignmentProject?.code || consignment.projectCode || existing?.projectCode, issuedAt: now });

                const historyNote = isRejected
                    ? `Rejected during batch reception under Consignment ${consignment.code}. Reason: ${rejectionReason}`
                    : `Batch accepted under Consignment ${consignment.code} (${consignment.deliveryNoteRef || 'no ref'}). Lab ID assigned: ${labId}`;

                let sampleRecord;

                const sampleDataCommon = {
                    labId,
                    labSampleCode: labId,
                    status,
                    assignedLab: userLab,
                    projectCode: resolvedConsignmentProject ? resolvedConsignmentProject.code : (consignment.projectCode || (existing?.projectCode || null)),
                    projectId: resolvedConsignmentProject ? resolvedConsignmentProject.id : (existing?.projectId || null),
                    fieldMetadata: JSON.stringify(await intakeProfile.captureConfigured(
                        {...existing, assignedLab: userLab, projectCode: resolvedConsignmentProject?.code || existing?.projectCode || null},
                        existing?.fieldMetadata || s.fieldMetadata || (s.collectionDate ? {collectionDate: s.collectionDate} : {}),
                        s, {actor: user.id || receivedBy, source: 'MANIFEST_INTAKE', isNew: !existing, recordedAt: now.toISOString()}, tx
                    )),
                    receptionDate: now,
                    receivedBy,
                    acceptedBy: isRejected ? null : receivedBy,
                    acceptedAt: isRejected ? null : now,
                    dryingStatus: isRejected ? null : 'PENDING',
                    preparationStatus: isRejected ? null : 'PENDING',
                    receivedMass: parsedMass,
                    massWarningAcknowledged: Boolean(observed.massDeficitInfo && s.massWarningAcknowledged === true),
                    moistureOnArrival: moisture,
                    foreignMaterial: typeof foreignMat === 'string' ? foreignMat : JSON.stringify(foreignMat),
                    intakePhotos: JSON.stringify(photos),
                    rejectionReason,
                    latitude: lat,
                    longitude: lng,
                    elevation: elev,
                    positionalUncertaintyM: uncertaintyM,
                    locationSource: locSource,
                    locationCapturedAt: (lat && lng) ? now : null,
                    locationCapturedBy: (lat && lng) ? receivedBy : null,
                    compositeRadiusM: compRadius,
                    depthTopCm: depthTop,
                    depthBottomCm: depthBottom,
                    admin1: s.admin1 || defaults.admin1 || null,
                    admin2: s.admin2 || defaults.admin2 || null,
                    village: s.village || defaults.village || null,
                    siteName: s.siteName || defaults.siteName || null,

                    // Stage E: Chain of Custody & Handover (RC-19)
                    custodyHandoverAt: s.custodyHandoverAt ? new Date(s.custodyHandoverAt) : (csgInput.custodyHandoverAt ? new Date(csgInput.custodyHandoverAt) : (csgInput.deliveredAt ? new Date(csgInput.deliveredAt) : now)),
                    custodyCarrierName: s.custodyCarrierName || csgInput.custodyCarrierName || csgInput.deliveredBy || null,
                    custodyTrackingNumber: s.custodyTrackingNumber || csgInput.custodyTrackingNumber || csgInput.deliveryNoteRef || null,
                    custodySenderSignature: s.custodySenderSignature || csgInput.custodySenderSignature || null,
                    receivingOfficerId: user?.id ? String(user.id) : null,
                    receivingOfficerName: user?.name || user?.username || receivedBy,
                    receivingOfficerSignature: s.receivingOfficerSignature || csgInput.receivingOfficerSignature || `CONFIRMED:${receivedBy}:${now.toISOString()}`,

                    requiredAnalyses: JSON.stringify(reqAnalyses),
                    consignmentId: consignment.id,
                    receptionData: JSON.stringify({
                        consignmentCode: consignment.code,
                        deliveryNoteRef: consignment.deliveryNoteRef,
                        deliveredBy: consignment.deliveredBy,
                        batchIndex: i + 1,
                        massNotRecorded: parsedMass === null,
                        massStatus: parsedMass === null ? 'MASS_NOT_RECORDED' : observed.massDeficitInfo ? 'MASS_DEFICIT' : 'RECORDED',
                        massDeficitInfo: observed.massDeficitInfo || null,
                        notes: s.notes || null,
                        checklist: s.checklist || defaults.checklist || {}
                    })
                };

                if (existing) {
                    sampleDataCommon.fieldMetadata = JSON.stringify(intakeProfile.preserveForContextChange(existing, sampleDataCommon.fieldMetadata, sampleDataCommon, user.id || receivedBy));
                    const existingHist = typeof existing.history === 'string' ? JSON.parse(existing.history) : (existing.history || []);
                    existingHist.push({ status: isRejected ? 'RECEIVED_REJECTED' : 'ACCEPTED', changedBy: receivedBy, timestamp: now, note: historyNote });

                    sampleRecord = await tx.sample.update({
                        where: { id: existing.id },
                        data: {
                            ...sampleDataCommon,
                            history: JSON.stringify(existingHist)
                        }
                    });
                } else {
                    const newHist = [{ status: isRejected ? 'RECEIVED_REJECTED' : 'ACCEPTED', changedBy: receivedBy, timestamp: now, note: historyNote }];
                    sampleRecord = await tx.sample.create({
                        data: {
                            id: crypto.randomUUID(),
                            originalId,
                            ...sampleDataCommon,
                            history: JSON.stringify(newHist)
                        }
                    });
                }

                // If sample accepted, create WorkItems for drying, preparation, and analyses
                if (!isRejected) {
                    const workItemsToCreate = [];
                    workItemsToCreate.push({
                        id: crypto.randomUUID(),
                        sampleId: sampleRecord.id,
                        labId: userLab,
                        assignedLab: userLab,
                        analysis: 'DRYING',
                        category: 'Operational Gates',
                        status: 'NOT_ASSIGNED'
                    });
                    workItemsToCreate.push({
                        id: crypto.randomUUID(),
                        sampleId: sampleRecord.id,
                        labId: userLab,
                        assignedLab: userLab,
                        analysis: 'PREPARATION',
                        category: 'Operational Gates',
                        status: 'NOT_ASSIGNED'
                    });

                    for (const code of reqAnalyses) {
                        const meta = analysisMap.get(code);
                        const cat = typeof meta?.category === 'object'
                            ? (meta?.category?.name || meta?.category?.id || 'General Chemistry')
                            : (meta?.category || 'General Chemistry');
                        workItemsToCreate.push({
                            id: crypto.randomUUID(),
                            sampleId: sampleRecord.id,
                            labId: userLab,
                            assignedLab: userLab,
                            analysis: code,
                            category: String(cat),
                            status: 'NOT_ASSIGNED'
                        });
                    }

                    await tx.workItem.createMany({
                        data: workItemsToCreate
                    });
                }

                // Resolve truthful collectionDate from fieldMetadata or metadata
                const resolvedSampleCollectionDate = (function() {
                    try {
                        const fm = sampleRecord.fieldMetadata ? (typeof sampleRecord.fieldMetadata === 'string' ? JSON.parse(sampleRecord.fieldMetadata) : sampleRecord.fieldMetadata) : null;
                        const fmDate = fm?.collectionDate || fm?.samplingDate || fm?.collection_date || fm?.date;
                        if (fmDate) return fmDate;
                        const m = sampleRecord.metadata ? (typeof sampleRecord.metadata === 'string' ? JSON.parse(sampleRecord.metadata) : sampleRecord.metadata) : null;
                        return m?.collectionDate || m?.samplingDate || m?.collection_date || m?.date || null;
                    } catch {
                        return null;
                    }
                })();

                processedSamples.push({
                    id: sampleRecord.id,
                    originalId: sampleRecord.originalId,
                    labId: sampleRecord.labId,
                    labSampleCode: sampleRecord.labSampleCode,
                    status: sampleRecord.status,
                    rejectionReason: sampleRecord.rejectionReason,
                    receivedMass: sampleRecord.receivedMass,
                    assignedLab: sampleRecord.assignedLab || userLab || null,
                    projectCode: sampleRecord.projectCode || null,
                    projectId: sampleRecord.projectId || null,
                    receptionDate: sampleRecord.receptionDate ? (sampleRecord.receptionDate instanceof Date ? sampleRecord.receptionDate.toISOString() : sampleRecord.receptionDate) : null,
                    custodyHandoverAt: sampleRecord.custodyHandoverAt ? (sampleRecord.custodyHandoverAt instanceof Date ? sampleRecord.custodyHandoverAt.toISOString() : sampleRecord.custodyHandoverAt) : null,
                    collectionDate: resolvedSampleCollectionDate,
                    fieldMetadata: sampleRecord.fieldMetadata || null,
                    receptionData: sampleRecord.receptionData || null
                });
            }

            // C. Audit log (RC-12, RC-13)
            await tx.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    entity: 'CONSIGNMENT',
                    entityId: consignment.id,
                    action: 'CONSIGNMENT_BATCH_RECEIVED',
                    details: JSON.stringify({ summary: `Consignment ${consignment.code} received with ${samples.length} samples (${acceptedCount} accepted, ${rejectedCount} rejected). Delivery Note: ${consignment.deliveryNoteRef || 'None'}.`,
                        bulkApplications: appliedObservations, massDeficitAcknowledgements: samples.filter((sample, index) => observedRows[index].massDeficitInfo && sample.massWarningAcknowledged === true).map(sample => sample.originalId || sample.id) }),
                    performedBy: receivedBy,
                    timestamp: now
                }
            });

            return { consignment, samples: processedSamples };
        });

        return res.status(201).json({
            success: true,
            consignment: result.consignment,
            samples: result.samples,
            message: `Batch received ${samples.length} samples under Consignment ${result.consignment.code}.`
        });
    } catch (err) {
        console.error('[processBatchConsignmentIntake] ERROR:', err);
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
        if (err instanceof profileIdentity.ProfileReferenceConflictError) return res.status(409).json({error: err.code, code: err.code, message: err.message});
        return res.status(500).json({ error: 'Batch consignment intake failed: ' + err.message });
    }
};

/**
 * GET /api/reception/consignments
 * RC-12: List Consignment records
 */
exports.getConsignments = async (req, res) => {
    try {
        const { search, projectCode, status, page = 1, limit = 50 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const where = {};
        if (projectCode) where.projectCode = projectCode;
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { code: { contains: search } },
                { deliveryNoteRef: { contains: search } },
                { submitterName: { contains: search } },
                { submitterOrg: { contains: search } },
                { deliveredBy: { contains: search } }
            ];
        }

        const [total, consignments] = await Promise.all([
            prisma.consignment.count({ where }),
            prisma.consignment.findMany({
                where,
                orderBy: { receivedAt: 'desc' },
                skip,
                take: limitNum,
                include: {
                    _count: {
                        select: { samples: true }
                    }
                }
            })
        ]);

        return res.json({
            success: true,
            data: consignments,
            total,
            page: pageNum,
            limit: limitNum
        });
    } catch (err) {
        console.error('[getConsignments] ERROR:', err);
        return res.status(500).json({ error: 'Failed to fetch consignments: ' + err.message });
    }
};

/**
 * GET /api/reception/consignments/:id
 * RC-12: Consignment Detail
 */
exports.getConsignmentDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const consignment = await prisma.consignment.findFirst({
            where: {
                OR: [
                    { id },
                    { code: id }
                ]
            },
            include: {
                samples: {
                    select: {
                        id: true,
                        originalId: true,
                        labId: true,
                        status: true,
                        rejectionReason: true,
                        receivedMass: true,
                        moistureOnArrival: true,
                        latitude: true,
                        longitude: true,
                        positionalUncertaintyM: true,
                        depthTopCm: true,
                        depthBottomCm: true,
                        siteName: true,
                        village: true,
                        admin1: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!consignment) {
            return res.status(404).json({ error: 'Consignment not found' });
        }

        return res.json({ success: true, consignment });
    } catch (err) {
        console.error('[getConsignmentDetail] ERROR:', err);
        return res.status(500).json({ error: 'Failed to fetch consignment detail: ' + err.message });
    }
};

/**
 * POST /api/reception/parse-manifest
 * RC-15: Validate & Parse Client Manifest rows
 */
exports.parseManifestEndpoint = async (req, res) => {
    try {
        const { rows, mapping } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ error: 'Array of manifest rows is required' });
        }

        const idCol = mapping?.sampleId || 'sample_id';
        const latCol = mapping?.latitude || 'latitude';
        const lngCol = mapping?.longitude || 'longitude';
        const coordCol = mapping?.coordinates || 'coordinates';
        const depthTopCol = mapping?.depthTop || 'depth_top';
        const depthBottomCol = mapping?.depthBottom || 'depth_bottom';
        const massCol = mapping?.receivedMass || 'mass';
        const uncertaintyCol = mapping?.positionalUncertaintyM || 'positional_uncertainty_m';
        const siteCol = mapping?.siteName || 'site';
        const villageCol = mapping?.village || 'village';
        const admin1Col = mapping?.admin1 || 'admin1';

        const parsedRows = [];
        const errors = [];

        for (let i = 0; i < rows.length; i++) {
            const raw = rows[i];
            const sampleId = String(raw[idCol] || raw['id'] || raw['ID'] || raw['Sample ID'] || '').trim();
            if (!sampleId) {
                errors.push({ row: i + 1, error: 'Missing sample identifier' });
                continue;
            }

            let lat = null, lng = null, uncertaintyM = null, format = null;

            // Direct lat/lng
            if (raw[latCol] !== undefined && raw[lngCol] !== undefined) {
                const parsedLat = parseFloat(raw[latCol]);
                const parsedLng = parseFloat(raw[lngCol]);
                if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                    lat = parsedLat;
                    lng = parsedLng;
                    format = 'DD';
                }
            }

            // Or unified coordinates string
            if ((!lat || !lng) && (raw[coordCol] || raw['coords'] || raw['Coordinates'])) {
                const cStr = String(raw[coordCol] || raw['coords'] || raw['Coordinates']);
                const parsed = parseCoordinates(cStr);
                if (parsed) {
                    lat = parsed.lat;
                    lng = parsed.lng;
                    format = parsed.format;
                }
            }

            uncertaintyM = batchObservations.nullableNumber(raw[uncertaintyCol], 'positionalUncertaintyM');

            parsedRows.push({
                ...(mapping?.profileCode ? {
                    profileReference: {code: profileIdentity.scalar(raw[mapping.profileCode], 255, true),
                        relation: profileIdentity.scalar(raw[mapping.profileCode], 255, true) === null ? 'UNSPECIFIED' : mapping.profileRelation ? profileIdentity.scalar(raw[mapping.profileRelation], 40) : 'SITE_POINT',
                        ...(mapping.profileNamespace && raw[mapping.profileNamespace] != null && String(raw[mapping.profileNamespace]).trim() ? {namespace: profileIdentity.scalar(raw[mapping.profileNamespace], 512)} : {})},
                    profileSourceEvidence: {column: mapping.profileCode, record:`row:${i + 1}`}
                } : {}),
                collectionDate: mapping?.collectionDate ? raw[mapping.collectionDate] ?? null : null,
                rowIndex: i + 1,
                originalId: sampleId,
                status: 'ACCEPTED',
                latitude: lat,
                longitude: lng,
                positionalUncertaintyM: uncertaintyM,
                coordFormat: format,
                depthTopCm: raw[depthTopCol] !== undefined ? parseFloat(raw[depthTopCol]) : null,
                depthBottomCm: raw[depthBottomCol] !== undefined ? parseFloat(raw[depthBottomCol]) : null,
                receivedMass: raw[massCol] !== undefined ? parseFloat(raw[massCol]) : null,
                siteName: raw[siteCol] || null,
                village: raw[villageCol] || null,
                admin1: raw[admin1Col] || null,
                raw
            });
        }

        return res.json({
            success: true,
            total: rows.length,
            validCount: parsedRows.length,
            errorCount: errors.length,
            errors,
            parsedRows
        });
    } catch (err) {
        console.error('[parseManifestEndpoint] ERROR:', err);
        if (err.statusCode) return res.status(err.statusCode).json({ error: err.message, code: err.code });
        if (err instanceof profileIdentity.ProfileReferenceConflictError) return res.status(409).json({error: err.code, code: err.code, message: err.message});
        return res.status(500).json({ error: 'Failed to parse manifest: ' + err.message });
    }
};

/**
 * GET /api/reception/sample-context/:id or ?originalId=...
 * Scoped, pure read-only intake detail resolver.
 * Loads complete intake context (fieldMetadata, receptionData, project,
 * resolved coordinates) without side effects or mutating self-healing writes.
 */
exports.getSampleIntakeContext = async (req, res) => {
    const identifier = req.params.id || req.query.id || req.query.originalId || req.query.identifier || req.query.code;
    if (!identifier || !String(identifier).trim()) {
        return res.status(400).json({
            success: false,
            error: 'MISSING_IDENTIFIER',
            message: 'Sample identifier is required.'
        });
    }
    const cleanId = String(identifier).trim();
    const user = req.user;

    try {
        const sample = await prisma.sample.findFirst({
            where: {
                OR: [
                    { id: cleanId },
                    { originalId: cleanId },
                    { labId: cleanId }
                ]
            },
            include: {
                project: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        projectType: true,
                        status: true,
                        defaultAnalysisBundle: true
                    }
                }
            }
        });

        if (!sample) {
            return res.status(404).json({
                success: false,
                error: 'SAMPLE_NOT_FOUND',
                message: `Sample '${cleanId}' not found.`
            });
        }

        // Scope check
        const scopeGuard = require('../utils/scopeGuard');
        try {
            scopeGuard.ensureScope(user, sample, { altLabField: 'assignedLab' });
        } catch (scopeErr) {
            return res.status(403).json({
                success: false,
                error: 'ACCESS_DENIED',
                message: 'Access denied: sample belongs to another laboratory.'
            });
        }

        const parseJson = (val) => {
            if (!val) return null;
            if (typeof val === 'object') return val;
            try { return JSON.parse(val); } catch { return null; }
        };

        const fieldMetadata = parseJson(sample.fieldMetadata) || {};
        const receptionData = parseJson(sample.receptionData) || {};
        const requiredAnalyses = parseJson(sample.requiredAnalyses) || [];
        const analysisGroupIds = parseJson(sample.analysisGroupIds) || [];
        const intakePhotos = parseJson(sample.intakePhotos) || [];
        const foreignMaterial = parseJson(sample.foreignMaterial) || [];
        const history = parseJson(sample.history) || [];

        // Coordinate resolution
        const { resolveCoordinates } = require('../utils/coordinateResolver');
        const coordinates = resolveCoordinates({
            ...sample,
            fieldMetadata,
            receptionData
        });

        return res.json({
            success: true,
            sample: {
                ...sample,
                fieldMetadata,
                receptionData,
                requiredAnalyses,
                analysisGroupIds,
                intakePhotos,
                foreignMaterial,
                history
            },
            coordinates,
            project: sample.project || null
        });
    } catch (err) {
        console.error('[getSampleIntakeContext] Error:', err);
        return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
    }
};


