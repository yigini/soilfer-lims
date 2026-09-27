const crypto = require('crypto');
const prisma = require('../prisma');
const { normalizeUnit } = require('../services/interpretationService');
const { formatSampleV1, extractCoordinates } = require('../services/sisAdapterService');
const { buildSampleWhere, buildSpectralWhere, toPrismaSpectralWhere, AUTHORIZED_RELEASE_STATUSES } = require('../services/exchangePolicyService');

// Helper to build scoped database query based on SIS Auth permissions
function buildSisWhere(sisAuth, query = {}) {
    return buildSampleWhere(sisAuth, query);
}

let cachedAnalysisMap = null;
let cachedMethodMap = null;
let lastFetchTime = 0;

async function getAnalysisMap() {
    const now = Date.now();
    if (cachedAnalysisMap && (now - lastFetchTime < 60000)) {
        return { analysisMap: cachedAnalysisMap, methodMap: cachedMethodMap };
    }
    try {
        const [analyses, methodologies] = await Promise.all([
            prisma.analysis.findMany(),
            prisma.methodology.findMany()
        ]);

        const aMap = {};
        const mMap = {};

        methodologies.forEach(m => {
            mMap[m.id] = m;
            if (m.isDefault) mMap[`default_${m.analysisCode}`] = m;
        });

        analyses.forEach(a => {
            aMap[a.code] = {
                ...a,
                defaultMethod: mMap[`default_${a.code}`] || null
            };
        });

        cachedAnalysisMap = aMap;
        cachedMethodMap = mMap;
        lastFetchTime = now;
        return { analysisMap: aMap, methodMap: mMap };
    } catch (e) {
        return { analysisMap: cachedAnalysisMap || {}, methodMap: cachedMethodMap || {} };
    }
}

// Helper to format a sample into harmonized SIS JSON structure (SOSA/SSN & GloSIS compliant)
function formatSampleForSis(sample, { analysisMap = {}, methodMap = {} } = {}, options = {}) {
    return formatSampleV1(sample, { analysisMap, methodMap }, options);
}

// ─── 1. GET /api/v1/sis/samples (Paginated Registry) ───
exports.getSamples = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;

        const where = buildSisWhere(req.sisAuth, req.query);

        const [total, samples, maps] = await Promise.all([
            prisma.sample.count({ where }),
            prisma.sample.findMany({
                where,
                include: { results: true },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit
            }),
            getAnalysisMap()
        ]);

        const formatted = samples.map(s => formatSampleForSis(s, maps, { auth: req.sisAuth }));

        res.json({
            status: 'success',
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                timestamp: new Date().toISOString()
            },
            data: formatted
        });
    } catch (err) {
        console.error('[SIS_GET_SAMPLES_ERR]', err);
        res.status(500).json({ error: 'Failed to query SIS samples dataset.' });
    }
};

// ─── 2. GET /api/v1/sis/samples/:id (Single Sample Detail) ───
exports.getSampleById = async (req, res) => {
    try {
        const { id } = req.params;
        const baseWhere = buildSisWhere(req.sisAuth, {});
        const [sample, maps] = await Promise.all([
            prisma.sample.findFirst({
                where: {
                    AND: [
                        baseWhere,
                        { OR: [{ id }, { originalId: id }, { labId: id }] }
                    ]
                },
                include: {
                    results: true,
                    project: true
                }
            }),
            getAnalysisMap()
        ]);

        if (!sample) {
            return res.status(404).json({ error: 'Sample not found in SoilFER registry.' });
        }

        // Check spectral data with parent authorization & release constraints (Finding 4)
        const { isRestrictedConsumer } = require('../services/exchangePolicyService');
        const spectralWhere = {
            sampleId: sample.id,
            isCurrent: true
        };
        if (isRestrictedConsumer(req.sisAuth)) {
            spectralWhere.status = { in: ['APPROVED', 'VALIDATED'] };
        }

        const spectra = await prisma.spectralData.findMany({
            where: spectralWhere,
            select: {
                id: true,
                modality: true,
                filename: true,
                qcStatus: true,
                status: true,
                timestamp: true
            }
        });

        const formatted = formatSampleForSis(sample, maps, { auth: req.sisAuth });
        formatted.spectralRecords = spectra;

        res.json({
            status: 'success',
            data: formatted
        });
    } catch (err) {
        console.error('[SIS_GET_SAMPLE_DETAIL_ERR]', err);
        res.status(500).json({ error: 'Failed to retrieve sample detail.' });
    }
};

// ─── 3. GET /api/v1/sis/geojson (OGC-compliant GeoJSON) ───
exports.getGeoJson = async (req, res) => {
    try {
        const limit = Math.min(5000, parseInt(req.query.limit) || 2000);
        const where = buildSisWhere(req.sisAuth, req.query);

        const [samples, maps] = await Promise.all([
            prisma.sample.findMany({
                where,
                include: { results: true },
                take: limit,
                orderBy: { updatedAt: 'desc' }
            }),
            getAnalysisMap()
        ]);

        const features = [];

        samples.forEach(s => {
            const formatted = formatSampleForSis(s, maps, { auth: req.sisAuth });
            const coords = formatted.provenance.coordinates;

            if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
                // Filter by bbox if supplied minLng,minLat,maxLng,maxLat
                if (req.query.bbox) {
                    const [minLng, minLat, maxLng, maxLat] = req.query.bbox.split(',').map(Number);
                    if (coords.longitude < minLng || coords.longitude > maxLng || coords.latitude < minLat || coords.latitude > maxLat) {
                        return;
                    }
                }

                // Flatten analytical results for GIS attributes
                const flatProperties = {
                    id: formatted.id,
                    labId: formatted.labId,
                    originalId: formatted.originalId,
                    country: formatted.country,
                    project: formatted.projectCode,
                    collectionDate: formatted.provenance.collectionDate,
                    depth: formatted.provenance.depthHorizon.depthRange,
                    landUse: formatted.provenance.site.landUse,
                    crop: formatted.provenance.site.currentCrop
                };

                // Add analytical keys (WP-22 dual export schema)
                Object.entries(formatted.analyticalResults).forEach(([param, resObj]) => {
                    const p = param.toLowerCase();
                    flatProperties[p] = resObj.normalized !== undefined ? resObj.normalized : resObj.value;
                    flatProperties[`${p}_as_measured`] = resObj.as_measured !== undefined ? resObj.as_measured : resObj.value;
                    flatProperties[`${p}_unit`] = resObj.unit;
                    flatProperties[`${p}_normalized`] = resObj.normalized !== undefined ? resObj.normalized : resObj.value;
                    flatProperties[`${p}_controlled_unit`] = resObj.controlled_unit;
                });

                features.push({
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [coords.longitude, coords.latitude]
                    },
                    properties: flatProperties
                });
            }
        });

        res.json({
            type: 'FeatureCollection',
            crs: {
                type: 'name',
                properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
            },
            features
        });
    } catch (err) {
        console.error('[SIS_GEOJSON_ERR]', err);
        res.status(500).json({ error: 'Failed to generate GeoJSON FeatureCollection.' });
    }
};

// ─── 4. GET /api/v1/sis/results (Flat Matrix for Statistics/CSV) ───
exports.getResultsMatrix = async (req, res) => {
    try {
        const limit = Math.min(2000, parseInt(req.query.limit) || 500);
        const where = buildSisWhere(req.sisAuth, req.query);

        const samples = await prisma.sample.findMany({
            where,
            include: { results: true },
            take: limit,
            orderBy: { updatedAt: 'desc' }
        });

        const rows = samples.map(s => {
            const formatted = formatSampleForSis(s, {}, { auth: req.sisAuth });
            const row = {
                sample_id: formatted.id,
                lab_id: formatted.labId,
                original_id: formatted.originalId,
                country: formatted.country,
                project: formatted.projectCode,
                latitude: formatted.provenance.coordinates?.latitude || null,
                longitude: formatted.provenance.coordinates?.longitude || null,
                depth: formatted.provenance.depthHorizon.depthRange,
                collection_date: formatted.provenance.collectionDate,
                land_use: formatted.provenance.site.landUse,
                crop: formatted.provenance.site.currentCrop
            };

            Object.entries(formatted.analyticalResults).forEach(([param, obj]) => {
                row[param] = obj.value;
            });

            return row;
        });

        res.json({
            status: 'success',
            count: rows.length,
            data: rows
        });
    } catch (err) {
        console.error('[SIS_RESULTS_MATRIX_ERR]', err);
        res.status(500).json({ error: 'Failed to extract results matrix.' });
    }
};

// ─── 5. GET /api/v1/sis/spectra (Spectroscopy Dataset) ───
exports.getSpectra = async (req, res) => {
    try {
        const { modality, limit = 50, cursor, instrument, equipmentId, qcStatus, withReference } = req.query;
        const take = Math.min(200, parseInt(limit) || 50);

        const where = {
            status: { in: ['APPROVED', 'VALIDATED'] },
            isCurrent: true
        };

        if (modality) where.modality = modality.toUpperCase();
        if (qcStatus) where.qcStatus = qcStatus.toUpperCase();
        if (instrument || equipmentId) where.equipmentId = instrument || equipmentId;

        // SL-22: Strict Scope Enforcement for API Keys (absent scope defaults to DENY)
        const keyLabs = req.sisAuth?.labs;
        const isGlobalLab = Array.isArray(keyLabs) && keyLabs.includes('*');

        if (!isGlobalLab) {
            if (!Array.isArray(keyLabs) || keyLabs.length === 0) {
                // Deny: key lacks laboratory access
                return res.json({
                    status: 'success',
                    meta: { cursor: null, hasMore: false, schema: "spectra/v1", total: 0 },
                    data: []
                });
            }
            where.labId = { in: keyLabs };
        }

        // Bounded Parent Specimen Traversal & Policy Enforcement (Finding 4)
        const { buildSampleWhere, isRestrictedConsumer } = require('../services/exchangePolicyService');
        const parentSampleWhere = buildSampleWhere(req.sisAuth, req.query);

        // SL-24: Cursor Pagination on (timestamp, id)
        if (cursor) {
            try {
                const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
                if (decoded && decoded.timestamp && decoded.id) {
                    where.AND = [
                        ...(where.AND || []),
                        {
                            OR: [
                                { timestamp: { lt: new Date(decoded.timestamp) } },
                                {
                                    timestamp: new Date(decoded.timestamp),
                                    id: { lt: decoded.id }
                                }
                            ]
                        }
                    ];
                }
            } catch (e) {
                console.warn('[SIS_SPECTRA] Invalid cursor ignored:', e.message);
            }
        }

        const restricted = isRestrictedConsumer(req.sisAuth);
        const pageRecords = [];
        let hasMore = false;
        let lastCandidate = null;
        const maxScanLimit = Math.max(take * 10, 100);
        let scanned = 0;
        let authorizedParentMap = {};

        // Bounded authorized traversal over candidates avoiding hidden-page starvation (Finding 4)
        while (pageRecords.length < take && scanned < maxScanLimit) {
            const batchTake = Math.min(take * 2, maxScanLimit - scanned);
            const batchWhere = { ...where };
            if (lastCandidate) {
                batchWhere.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { timestamp: { lt: lastCandidate.timestamp } },
                            {
                                timestamp: lastCandidate.timestamp,
                                id: { lt: lastCandidate.id }
                            }
                        ]
                    }
                ];
            }

            const candidates = await prisma.spectralData.findMany({
                where: batchWhere,
                take: batchTake + 1,
                orderBy: [
                    { timestamp: 'desc' },
                    { id: 'desc' }
                ],
                include: {
                    equipment: {
                        select: { id: true, name: true, model: true, manufacturer: true }
                    }
                }
            });

            if (candidates.length === 0) break;
            const batchHasMore = candidates.length > batchTake;
            const batchItems = batchHasMore ? candidates.slice(0, batchTake) : candidates;
            lastCandidate = batchItems[batchItems.length - 1];
            scanned += batchItems.length;

            const sampleIds = [...new Set(batchItems.map(r => r.sampleId).filter(Boolean))];
            if (sampleIds.length > 0) {
                const authorizedParents = await prisma.sample.findMany({
                    where: {
                        AND: [
                            parentSampleWhere,
                            { id: { in: sampleIds } }
                        ]
                    },
                    select: { id: true, labId: true, originalId: true, status: true, assignedLab: true, country: true, projectCode: true }
                });
                for (const p of authorizedParents) {
                    authorizedParentMap[p.id] = p;
                }
            }

            for (const cand of batchItems) {
                const isAuth = !restricted ? true : Boolean(cand.sampleId && authorizedParentMap[cand.sampleId]);
                if (isAuth) {
                    pageRecords.push(cand);
                    if (pageRecords.length === take) {
                        hasMore = batchHasMore || (scanned < maxScanLimit);
                        break;
                    }
                }
            }

            if (!batchHasMore) {
                hasMore = false;
                break;
            }
        }

        let nextCursor = null;
        if (hasMore && pageRecords.length > 0) {
            const lastItem = pageRecords[pageRecords.length - 1];
            nextCursor = Buffer.from(JSON.stringify({
                timestamp: lastItem.timestamp,
                id: lastItem.id
            })).toString('base64');
        }

        // SL-23: Paired Reference Chemistry (strictly for authorized released parents)
        const shouldAttachRef = withReference === true || withReference === 'true' || withReference === '1';
        let refMap = {};
        const validRefSampleIds = Object.keys(authorizedParentMap);
        if (shouldAttachRef && validRefSampleIds.length > 0) {
            const refResults = await prisma.result.findMany({
                where: {
                    sampleId: { in: validRefSampleIds },
                    isCurrent: true,
                    provenance: 'MEASURED'
                },
                select: {
                    id: true,
                    sampleId: true,
                    param: true,
                    value: true,
                    numericValue: true,
                    unit: true,
                    methodologyId: true,
                    basis: true,
                    provenance: true
                }
            });
            for (const rf of refResults) {
                if (!refMap[rf.sampleId]) refMap[rf.sampleId] = [];
                const val = rf.numericValue !== null && rf.numericValue !== undefined ? rf.numericValue : (parseFloat(rf.value) || rf.value);
                refMap[rf.sampleId].push({
                    param: rf.param,
                    value: val,
                    unit: rf.unit,
                    method: rf.methodologyId,
                    basis: rf.basis || 'AIR_DRY',
                    provenance: rf.provenance || 'MEASURED',
                    resultId: rf.id
                });
            }
        }

        // SL-23: Rich Payload Format
        const formatted = pageRecords.map(r => {
            const smp = authorizedParentMap[r.sampleId] || null;
            const axis = r.wavelengths ? JSON.parse(r.wavelengths) : [];
            const values = r.values ? JSON.parse(r.values) : [];
            const sampleRefs = refMap[r.sampleId] || [];

            return {
                id: r.id,
                sha256: r.sha256,
                sampleId: r.sampleId,
                labId: r.labId,
                signal: {
                    quantity: r.quantity,
                    axisUnit: r.axisUnit,
                    axisDirection: r.axisDirection,
                    isRaw: r.isRaw,
                    nPoints: axis.length
                },
                acquisition: {
                    equipmentId: r.equipmentId,
                    model: r.equipment ? (r.equipment.model || r.equipment.name) : null,
                    accessory: r.accessory,
                    resolution: r.resolution,
                    coAddedScans: r.coAddedScans,
                    background: r.backgroundRef,
                    backgroundRef: r.backgroundRef,
                    backgroundAt: r.backgroundAt,
                    scannedAt: r.timestamp
                },
                preparation: {
                    preparation: r.preparation,
                    moistureState: r.moistureState,
                    windowMaterial: r.windowMaterial,
                    replicateNo: r.replicateNo
                },
                qc: {
                    status: r.qcStatus,
                    flags: r.qcFlags ? JSON.parse(r.qcFlags) : [],
                    approvedAt: r.reviewedAt,
                    reviewedBy: r.reviewedBy
                },
                ...(shouldAttachRef ? {
                    reference: sampleRefs
                } : {}),
                axis,
                values
            };
        });

        // SL-24: ETag & 304 Validation
        const payloadJson = JSON.stringify(formatted);
        const etag = crypto.createHash('sha256').update(payloadJson).digest('hex');

        if (req.headers['if-none-match'] === etag) {
            return res.status(304).end();
        }

        res.setHeader('ETag', etag);
        res.json({
            status: 'success',
            meta: {
                cursor: nextCursor,
                hasMore,
                schema: "spectra/v1",
                count: formatted.length
            },
            data: formatted
        });
    } catch (err) {
        console.error('[SIS_SPECTRA_ERR]', err);
        res.status(500).json({ error: 'Failed to retrieve spectral dataset: ' + err.message });
    }
};

// ─── 6. GET /api/v1/sis/sync (Delta Sync ETL) ───
exports.syncDelta = async (req, res) => {
    try {
        const { updatedSince, limit } = req.query;
        if (!updatedSince) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Missing required updatedSince query parameter (e.g. ?updatedSince=2026-08-01T00:00:00Z).'
            });
        }

        const sinceDate = new Date(updatedSince);
        if (isNaN(sinceDate.getTime())) {
            return res.status(400).json({ error: 'Invalid ISO-8601 date format for updatedSince.' });
        }

        const maxTake = Math.min(1000, Math.max(1, parseInt(limit) || 1000));
        const where = buildSampleWhere(req.sisAuth, { updatedSince });
        const spectralWhere = {
            ...toPrismaSpectralWhere(buildSpectralWhere(req.sisAuth, {})),
            timestamp: { gte: sinceDate }
        };

        const [samples, candidateSpectra, maps] = await Promise.all([
            prisma.sample.findMany({
                where,
                include: { results: true },
                orderBy: { updatedAt: 'asc' },
                take: maxTake
            }),
            prisma.spectralData.findMany({
                where: spectralWhere,
                take: maxTake,
                orderBy: { timestamp: 'asc' }
            }),
            getAnalysisMap()
        ]);

        const candidateSampleIds = candidateSpectra.map(s => s.sampleId).filter(Boolean);
        let authorizedSpectra = [];
        if (candidateSampleIds.length > 0) {
            const authorizedParents = await prisma.sample.findMany({
                where: { AND: [where, { id: { in: candidateSampleIds } }] },
                select: { id: true }
            });
            const authParentSet = new Set(authorizedParents.map(s => s.id));
            authorizedSpectra = candidateSpectra.filter(s => s.sampleId && authParentSet.has(s.sampleId));
        }

        const hasMoreSamples = samples.length >= maxTake;
        const hasMoreSpectra = candidateSpectra.length >= maxTake;

        res.json({
            status: 'success',
            syncTimestamp: new Date().toISOString(),
            samplesCount: samples.length,
            spectraCount: authorizedSpectra.length,
            hasMore: hasMoreSamples || hasMoreSpectra,
            samples: samples.map(s => formatSampleForSis(s, maps, { auth: req.sisAuth })),
            spectra: authorizedSpectra.map(s => ({
                id: s.id,
                sampleId: s.sampleId,
                modality: s.modality,
                qcStatus: s.qcStatus,
                timestamp: s.timestamp
            }))
        });
    } catch (err) {
        console.error('[SIS_SYNC_ERR]', err);
        res.status(500).json({ error: 'Failed to perform delta sync.' });
    }
};

// ─── 7. GET /api/v1/sis/stats (Global / Regional Metrics) ───
exports.getStats = async (req, res) => {
    try {
        const sampleWhere = buildSampleWhere(req.sisAuth, {});
        const spectralWhere = toPrismaSpectralWhere(buildSpectralWhere(req.sisAuth, {}));

        const keyLabs = req.sisAuth?.labs || [];
        const isApiKey = req.sisAuth?.type === 'API_KEY';
        const hasGlobalLab = keyLabs.includes('*') || (!isApiKey && req.sisAuth?.role === 'SUPER_ADMIN');
        const labWhere = hasGlobalLab ? {} : { id: { in: keyLabs } };

        const [totalSamples, releasedSamples, totalResults, labsCount] = await Promise.all([
            prisma.sample.count({ where: sampleWhere }),
            prisma.sample.count({ where: { ...sampleWhere, status: { in: AUTHORIZED_RELEASE_STATUSES } } }),
            prisma.result.count({ where: { sample: sampleWhere, isCurrent: true } }),
            prisma.lab.count({ where: labWhere })
        ]);

        let totalSpectra = 0;
        if (sampleWhere.assignedLab !== '__denied__' && sampleWhere.status !== '__denied_unapproved__') {
            const authorizedParents = await prisma.sample.findMany({
                where: { ...sampleWhere, status: { in: AUTHORIZED_RELEASE_STATUSES } },
                select: { id: true }
            });
            const authorizedIds = authorizedParents.map(s => s.id);
            if (authorizedIds.length > 0) {
                totalSpectra = await prisma.spectralData.count({
                    where: { ...spectralWhere, sampleId: { in: authorizedIds } }
                });
            }
        }

        res.json({
            status: 'success',
            metrics: {
                totalSamples,
                completedSamples: releasedSamples, // legacy alias for backward compatibility
                approvedSamples: releasedSamples,
                totalResults,
                totalSpectra,
                registeredLabs: labsCount,
                standardsCompliant: 'GLOSOLAN / ISO 17025',
                timestamp: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('[SIS_STATS_ERR]', err);
        res.status(500).json({ error: 'Failed to compile SIS statistics.' });
    }
};

// ─── 8. API KEY MANAGEMENT (Admin Only) ───

exports.listApiKeys = async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can list SIS API keys.' });
    }

    try {
        const keys = await prisma.apiKey.findMany({
            orderBy: { createdAt: 'desc' }
        });

        const safeKeys = keys.map(k => ({
            id: k.id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            role: k.role,
            connectionId: k.connectionId || `conn_${k.id}`,
            capabilities: k.capabilities ? (typeof k.capabilities === 'string' ? JSON.parse(k.capabilities) : k.capabilities) : [],
            countries: k.countries ? JSON.parse(k.countries) : ['*'],
            projects: k.projects ? JSON.parse(k.projects) : ['*'],
            labs: k.labs ? JSON.parse(k.labs) : [],
            isActive: k.isActive,
            createdBy: k.createdBy,
            lastUsedAt: k.lastUsedAt,
            expiresAt: k.expiresAt,
            createdAt: k.createdAt
        }));

        res.json({ status: 'success', data: safeKeys });
    } catch (err) {
        console.error('[SIS_LIST_KEYS_ERR]', err);
        res.status(500).json({ error: 'Failed to retrieve API Keys.' });
    }
};

exports.createApiKey = async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can create SIS API keys.' });
    }

    try {
        const { name, role = 'NSIS_CONSUMER', countries, projects, labs, capabilities, connectionId, expiresDays = 365 } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'API Key name or consumer label is required.' });
        }

        // Generate high-entropy API key
        const rawSecret = crypto.randomBytes(24).toString('hex');
        const fullApiKey = `slims_live_${rawSecret}`;
        const keyHash = crypto.createHash('sha256').update(fullApiKey).digest('hex');
        const keyPrefix = `slims_live_${rawSecret.substring(0, 8)}...`;

        const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000) : null;

        // LG-28 / IR-14: Validate explicit non-empty lab scope (no country or wildcard inference)
        if (!labs || !Array.isArray(labs) || labs.length === 0) {
            return res.status(400).json({
                error: 'INVALID_LAB_SCOPE',
                message: 'Explicit lab scope (non-empty labs array) is required when issuing an SIS API key.'
            });
        }
        const effectiveLabs = labs;

        if (!effectiveLabs.includes('*')) {
            const existingLabs = await prisma.lab.findMany({
                where: { id: { in: effectiveLabs } },
                select: { id: true }
            });
            const existingLabIds = new Set(existingLabs.map(l => l.id));
            const missing = effectiveLabs.filter(l => !existingLabIds.has(l));
            if (missing.length > 0) {
                return res.status(400).json({
                    error: 'INVALID_LAB_ID',
                    message: `Specified laboratories do not exist: ${missing.join(', ')}`
                });
            }
        }

        const effectiveConnectionId = connectionId || `conn_${crypto.randomUUID()}`;
        const effectiveCaps = Array.isArray(capabilities) ? capabilities : (capabilities ? [capabilities] : []);
        const newKeyId = crypto.randomUUID();
        const now = new Date();
        const nowIso = now.toISOString();

        const { getDb } = require('../services/exchangeStateService');
        const db = getDb();

        // Atomic provisioning transaction: ApiKey, _exchange_connections, _exchange_connection_keys, AuditLog
        const provisionTx = db.transaction(() => {
            // 1. Ensure managed connection exists
            const hasConnTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_connections'").get());
            if (hasConnTable) {
                const existingConn = db.prepare('SELECT id FROM _exchange_connections WHERE id = ?').get(effectiveConnectionId);
                if (!existingConn) {
                    db.prepare(`
                        INSERT INTO _exchange_connections (id, name, capabilities, countries, projects, labs, auth_version, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
                    `).run(
                        effectiveConnectionId,
                        name,
                        JSON.stringify(effectiveCaps),
                        countries ? JSON.stringify(countries) : null,
                        projects ? JSON.stringify(projects) : null,
                        JSON.stringify(effectiveLabs),
                        nowIso,
                        nowIso
                    );
                }
            }

            // 2. Insert ApiKey
            db.prepare(`
                INSERT INTO ApiKey (id, name, keyHash, keyPrefix, role, connectionId, capabilities, countries, projects, labs, isActive, createdBy, createdAt, updatedAt, expiresAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
            `).run(
                newKeyId,
                name,
                keyHash,
                keyPrefix,
                role,
                effectiveConnectionId,
                JSON.stringify(effectiveCaps),
                countries && Array.isArray(countries) ? JSON.stringify(countries) : null,
                projects && Array.isArray(projects) ? JSON.stringify(projects) : null,
                JSON.stringify(effectiveLabs),
                req.user?.username || 'admin',
                nowIso,
                nowIso,
                expiresAt ? expiresAt.toISOString() : null
            );

            // 3. Link key in _exchange_connection_keys
            const hasKeysTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_connection_keys'").get());
            if (hasKeysTable) {
                db.prepare(`
                    INSERT INTO _exchange_connection_keys (id, connection_id, api_key_id, key_status, created_at)
                    VALUES (?, ?, ?, 'ACTIVE', ?)
                `).run(`conn_key_${crypto.randomUUID()}`, effectiveConnectionId, newKeyId, nowIso);
            }

            // 4. Audit Log
            const hasAuditTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='AuditLog'").get());
            if (hasAuditTable) {
                db.prepare(`
                    INSERT INTO AuditLog (id, entity, entityId, action, details, performedBy, timestamp)
                    VALUES (?, 'SIS_API_KEY', ?, 'SIS_KEY_CREATED', ?, ?, ?)
                `).run(
                    `audit-sis-key-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
                    newKeyId,
                    `Created API key '${name}' with connectionId: ${effectiveConnectionId}, capabilities: ${JSON.stringify(effectiveCaps)}, labs: ${JSON.stringify(effectiveLabs)}`,
                    req.user?.username || 'admin',
                    nowIso
                );
            }
        });

        provisionTx();

        // RETURN THE FULL API KEY ONLY ONCE ON CREATION
        res.json({
            status: 'success',
            message: 'API Key created successfully. Store this secret key safely as it will not be shown again.',
            apiKey: fullApiKey,
            keyInfo: {
                id: newKeyId,
                name,
                connectionId: effectiveConnectionId,
                capabilities: effectiveCaps,
                keyPrefix,
                role,
                labs: effectiveLabs,
                expiresAt
            }
        });
    } catch (err) {
        console.error('[SIS_CREATE_KEY_ERR]', err);
        res.status(500).json({ error: 'Failed to generate API Key.', message: err.message });
    }
};

exports.revokeApiKey = async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can revoke SIS API keys.' });
    }

    try {
        const { id } = req.params;
        const updatedKey = await prisma.apiKey.update({
            where: { id },
            data: { isActive: false }
        });

        // Update connection keys mapping
        try {
            const { getDb } = require('../services/exchangeStateService');
            const db = getDb();
            db.prepare('UPDATE _exchange_connection_keys SET key_status = "REVOKED", rotated_at = ? WHERE api_key_id = ?').run(new Date().toISOString(), id);
        } catch (e) {}

        await prisma.auditLog.create({
            data: {
                id: `audit-sis-revoke-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
                entity: 'SIS_API_KEY',
                entityId: id,
                action: 'SIS_KEY_REVOKED',
                details: `Revoked API key '${updatedKey.name}'`,
                performedBy: req.user?.username || 'admin',
                timestamp: new Date()
            }
        });

        res.json({ status: 'success', message: 'API Key revoked successfully.' });
    } catch (err) {
        console.error('[SIS_REVOKE_KEY_ERR]', err);
        res.status(500).json({ error: 'Failed to revoke API Key.' });
    }
};

const rotationReplayCache = new Map(); // idempotencyKey -> { timestamp, responseBody }

exports.rotateApiKey = async (req, res) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can rotate SIS API keys.' });
    }

    try {
        const { id } = req.params;
        const idempotencyKey = req.headers?.['idempotency-key'] || req.headers?.['x-idempotency-key'] || req.body?.idempotencyKey;

        // Idempotency check: short-lived cache replay for operator recovery (R10)
        if (idempotencyKey) {
            const cached = rotationReplayCache.get(idempotencyKey);
            if (cached && (Date.now() - cached.timestamp < 15 * 60 * 1000)) {
                return res.status(200).json(cached.responseBody);
            }
        }

        const oldKey = await prisma.apiKey.findUnique({ where: { id } });
        if (!oldKey) {
            return res.status(404).json({ error: 'API Key not found.' });
        }
        if (!oldKey.isActive) {
            return res.status(400).json({ error: 'Cannot rotate an inactive or revoked API Key.' });
        }

        const { getDb } = require('../services/exchangeStateService');
        const db = getDb();

        // Generate new key token
        const rawSecret = crypto.randomBytes(24).toString('hex');
        const fullApiKey = `slims_live_${rawSecret}`;
        const keyHash = crypto.createHash('sha256').update(fullApiKey).digest('hex');
        const keyPrefix = `slims_live_${rawSecret.substring(0, 8)}...`;
        const newKeyId = crypto.randomUUID();
        const effectiveConnectionId = oldKey.connectionId || `conn_${oldKey.id}`;
        const newKeyName = `${oldKey.name} (Rotated ${new Date().toISOString().slice(0, 10)})`;
        const now = new Date();
        const nowIso = now.toISOString();

        // Execute rotation as a single atomic transaction with CAS precondition inside transaction
        const rotateTransaction = db.transaction(() => {
            // 1. CAS: Atomic retirement of old key verifying exactly 1 row affected
            const casRes = db.prepare(`
                UPDATE ApiKey
                SET isActive = 0, updatedAt = ?
                WHERE id = ? AND isActive = 1
            `).run(nowIso, oldKey.id);

            if (casRes.changes === 0) {
                const err = new Error('API key has already been rotated or is no longer active.');
                err.code = 'KEY_ALREADY_ROTATED';
                throw err;
            }

            // 2. Insert new replacement key
            db.prepare(`
                INSERT INTO ApiKey (id, name, keyHash, keyPrefix, role, connectionId, capabilities, countries, projects, labs, isActive, createdBy, createdAt, updatedAt, expiresAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
            `).run(
                newKeyId,
                newKeyName,
                keyHash,
                keyPrefix,
                oldKey.role,
                effectiveConnectionId,
                oldKey.capabilities,
                oldKey.countries,
                oldKey.projects,
                oldKey.labs,
                req.user?.username || 'admin',
                nowIso,
                nowIso,
                oldKey.expiresAt ? new Date(oldKey.expiresAt).toISOString() : null
            );

            // 3. Link keys in _exchange_connection_keys
            db.prepare(`
                UPDATE _exchange_connection_keys
                SET key_status = 'RETIRED', rotated_at = ?
                WHERE connection_id = ? AND api_key_id = ?
            `).run(nowIso, effectiveConnectionId, oldKey.id);

            db.prepare(`
                INSERT INTO _exchange_connection_keys (id, connection_id, api_key_id, key_status, created_at)
                VALUES (?, ?, ?, 'ACTIVE', ?)
            `).run(`conn_key_${crypto.randomUUID()}`, effectiveConnectionId, newKeyId, nowIso);

            // 4. Audit log
            db.prepare(`
                INSERT INTO AuditLog (id, entity, entityId, action, details, performedBy, timestamp)
                VALUES (?, 'SIS_API_KEY', ?, 'SIS_KEY_ROTATED', ?, ?, ?)
            `).run(
                `audit-sis-rotate-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
                newKeyId,
                `Rotated API key from '${oldKey.id}' to '${newKeyId}' for connection '${effectiveConnectionId}'`,
                req.user?.username || 'admin',
                nowIso
            );
        });

        // Run atomic transaction
        rotateTransaction();

        const successResponse = {
            status: 'success',
            message: 'API Key rotated successfully. The old key has been revoked and the new key is active.',
            apiKey: fullApiKey,
            keyInfo: {
                id: newKeyId,
                name: newKeyName,
                connectionId: effectiveConnectionId,
                keyPrefix,
                role: oldKey.role,
                capabilities: oldKey.capabilities ? (typeof oldKey.capabilities === 'string' ? JSON.parse(oldKey.capabilities) : oldKey.capabilities) : [],
                expiresAt: oldKey.expiresAt
            }
        };

        if (idempotencyKey) {
            rotationReplayCache.set(idempotencyKey, {
                timestamp: Date.now(),
                responseBody: successResponse
            });
        }

        res.json(successResponse);
    } catch (err) {
        if (err.code === 'KEY_ALREADY_ROTATED') {
            return res.status(409).json({
                error: 'CONFLICT',
                code: 'KEY_ALREADY_ROTATED',
                message: 'API Key has already been rotated or is no longer active.'
            });
        }
        console.error('[SIS_ROTATE_KEY_ERR]', err);
        res.status(500).json({ error: 'Failed to rotate API Key.', message: err.message });
    }
};

exports.listConnections = async (req, res) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can list exchange connections.' });
    }

    try {
        const { getDb } = require('../services/exchangeStateService');
        const db = getDb();
        const connections = db.prepare('SELECT * FROM _exchange_connections ORDER BY created_at DESC').all();
        const keys = db.prepare('SELECT * FROM _exchange_connection_keys WHERE key_status = "ACTIVE"').all();
        const keysByConn = {};
        keys.forEach(k => {
            if (!keysByConn[k.connection_id]) keysByConn[k.connection_id] = [];
            keysByConn[k.connection_id].push(k.api_key_id);
        });

        let receiptsSummary = {};
        try {
            // Find most recent receipt by chronological ordering (created_at DESC, rowid DESC)
            // and compute receiver-reported totals (R11)
            const latestReceipts = db.prepare(`
                SELECT r.connection_id,
                       r.checkpoint as last_checkpoint,
                       r.created_at as last_receipt_at
                FROM _exchange_receipts r
                INNER JOIN (
                    SELECT connection_id, MAX(rowid) as max_rowid
                    FROM _exchange_receipts
                    GROUP BY connection_id
                ) latest ON r.rowid = latest.max_rowid
            `).all();

            const sumTotals = db.prepare(`
                SELECT connection_id,
                       SUM(COALESCE(imported_count, 0)) as total_imported,
                       SUM(COALESCE(quarantined_count, 0)) as total_quarantined
                FROM _exchange_receipts
                GROUP BY connection_id
            `).all();

            const sumsByConn = {};
            sumTotals.forEach(s => { sumsByConn[s.connection_id] = s; });

            latestReceipts.forEach(r => {
                const s = sumsByConn[r.connection_id] || {};
                receiptsSummary[r.connection_id] = {
                    lastReceiptAt: r.last_receipt_at,
                    totalImported: s.total_imported || 0,
                    totalQuarantined: s.total_quarantined || 0,
                    lastCheckpoint: r.last_checkpoint,
                    receiverReportedImported: s.total_imported || 0,
                    receiverReportedQuarantined: s.total_quarantined || 0,
                    lastReportedCheckpoint: r.last_checkpoint
                };
            });
        } catch (e) {}

        const data = connections.map(c => ({
            id: c.id,
            name: c.name,
            clientCode: c.client_code,
            organization: c.organization,
            contactEmail: c.contact_email,
            status: c.status,
            capabilities: c.capabilities ? JSON.parse(c.capabilities) : [],
            countries: c.countries ? JSON.parse(c.countries) : ['*'],
            projects: c.projects ? JSON.parse(c.projects) : ['*'],
            labs: c.labs ? JSON.parse(c.labs) : [],
            authVersion: c.auth_version,
            activeKeyIds: keysByConn[c.id] || [],
            telemetry: receiptsSummary[c.id] || {
                lastReceiptAt: null,
                totalImported: 0,
                totalQuarantined: 0,
                lastCheckpoint: null,
                receiverReportedImported: 0,
                receiverReportedQuarantined: 0,
                lastReportedCheckpoint: null
            },
            createdAt: c.created_at,
            updatedAt: c.updated_at
        }));

        res.json({ status: 'success', data });
    } catch (err) {
        console.error('[SIS_LIST_CONNS_ERR]', err);
        res.status(500).json({ error: 'Failed to list exchange connections.' });
    }
};

exports.createConnection = async (req, res) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can create exchange connections.' });
    }

    try {
        const { name, clientCode, organization, contactEmail, capabilities = [], countries, projects, labs = [] } = req.body;
        if (!name) return res.status(400).json({ error: 'Connection name is required.' });

        const id = `conn_${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const { getDb } = require('../services/exchangeStateService');
        const db = getDb();

        db.prepare(`
            INSERT INTO _exchange_connections (id, name, client_code, organization, contact_email, status, capabilities, countries, projects, labs, auth_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, 1, ?, ?)
        `).run(
            id,
            name,
            clientCode || null,
            organization || null,
            contactEmail || null,
            JSON.stringify(capabilities),
            countries ? JSON.stringify(countries) : null,
            projects ? JSON.stringify(projects) : null,
            JSON.stringify(labs),
            now,
            now
        );

        res.json({
            status: 'success',
            message: 'Exchange connection created successfully.',
            data: { id, name, clientCode, organization, capabilities, labs, status: 'ACTIVE', createdAt: now }
        });
    } catch (err) {
        console.error('[SIS_CREATE_CONN_ERR]', err);
        res.status(500).json({ error: 'Failed to create exchange connection.' });
    }
};

exports.updateConnection = async (req, res) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can update exchange connections.' });
    }

    try {
        const { id } = req.params;
        const { name, status, capabilities, contactEmail, organization, countries, projects, labs } = req.body;
        const { getDb } = require('../services/exchangeStateService');
        const db = getDb();

        const conn = db.prepare('SELECT * FROM _exchange_connections WHERE id = ?').get(id);
        if (!conn) return res.status(404).json({ error: 'Exchange connection not found.' });

        const now = new Date().toISOString();
        const updates = [];
        const params = [];

        if (name !== undefined) { updates.push('name = ?'); params.push(name); }
        if (status !== undefined) { updates.push('status = ?'); params.push(status); }
        if (capabilities !== undefined) { updates.push('capabilities = ?'); params.push(JSON.stringify(capabilities)); }
        if (contactEmail !== undefined) { updates.push('contact_email = ?'); params.push(contactEmail); }
        if (organization !== undefined) { updates.push('organization = ?'); params.push(organization); }
        if (countries !== undefined) { updates.push('countries = ?'); params.push(countries ? JSON.stringify(countries) : null); }
        if (projects !== undefined) { updates.push('projects = ?'); params.push(projects ? JSON.stringify(projects) : null); }
        if (labs !== undefined) { updates.push('labs = ?'); params.push(JSON.stringify(labs)); }

        updates.push('auth_version = auth_version + 1');
        updates.push('updated_at = ?');
        params.push(now);
        params.push(id);

        db.prepare(`UPDATE _exchange_connections SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        res.json({ status: 'success', message: 'Exchange connection updated successfully.' });
    } catch (err) {
        console.error('[SIS_UPDATE_CONN_ERR]', err);
        res.status(500).json({ error: 'Failed to update exchange connection.' });
    }
};

exports.buildSisWhere = buildSisWhere;
