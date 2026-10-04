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
        const intake = require('../services/intakeService');
        const expectedSnapshot = await intake.snapshot(prisma, req.body);
        const result = await prisma.$transaction(tx => intake.intake(tx, { body: req.body, user: req.user, expectedSnapshot }), { timeout: 30000 });
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
        const expectedSnapshots = Array.isArray(req.body.samples) ? await Promise.all(req.body.samples.map(body => require('../services/intakeService').snapshot(prisma, body))) : [];
        const result = await prisma.$transaction(tx => require('../services/consignmentIntakeService').receiveConsignment(tx, { body: req.body, user: req.user, expectedSnapshots }), { timeout: 60000 });
        return res.status(201).json(result);
    } catch (error) { return require('../services/intakeErrors').respond(res, error); }
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


