const crypto = require('crypto');
const prisma = require('../prisma');
const { normalizeUnit } = require('../services/interpretationService');
const { formatSampleV1, extractCoordinates } = require('../services/sisAdapterService');
const {
    buildSampleWhere,
    buildSpectralWhere,
    toPrismaSpectralWhere,
    AUTHORIZED_RELEASE_STATUSES,
    ExchangeEligibilityUnavailableError,
    handleExchangeError
} = require('../services/exchangePolicyService');

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
exports.getSamples = async (req, res, next) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;

        if (typeof req.startPhase === 'function') req.startPhase('eligibility');
        const where = buildSisWhere(req.sisAuth, req.query);
        if (typeof req.endPhase === 'function') req.endPhase('eligibility');

        if (typeof req.startPhase === 'function') req.startPhase('count');
        const total = await prisma.sample.count({ where });
        if (typeof req.endPhase === 'function') req.endPhase('count');

        if (typeof req.startPhase === 'function') req.startPhase('list');
        const [samples, maps] = await Promise.all([
            prisma.sample.findMany({
                where,
                include: { results: true },
                orderBy: { updatedAt: 'desc' },
                skip,
                take: limit
            }),
            getAnalysisMap()
        ]);
        if (typeof req.endPhase === 'function') req.endPhase('list');

        if (typeof req.startPhase === 'function') req.startPhase('mapping');
        const formatted = samples.map(s => formatSampleForSis(s, maps, { auth: req.sisAuth }));
        if (typeof req.endPhase === 'function') req.endPhase('mapping');

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
        return handleExchangeError(err, req, res, next, 'Failed to query SIS samples dataset.');
    }
};

// ─── 2. GET /api/v1/sis/samples/:id (Single Sample Detail) ───
exports.getSampleById = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (typeof req.startPhase === 'function') req.startPhase('eligibility');
        const baseWhere = buildSisWhere(req.sisAuth, {});
        if (typeof req.endPhase === 'function') req.endPhase('eligibility');

        if (typeof req.startPhase === 'function') req.startPhase('list');
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
        if (typeof req.endPhase === 'function') req.endPhase('list');

        if (!sample) {
            return res.status(404).json({ error: 'Sample not found in SoilFER registry.' });
        }

        if (typeof req.startPhase === 'function') req.startPhase('mapping');
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
        if (typeof req.endPhase === 'function') req.endPhase('mapping');

        res.json({
            status: 'success',
            data: formatted
        });
    } catch (err) {
        return handleExchangeError(err, req, res, next, 'Failed to retrieve sample detail.');
    }
};

// ─── 3. GET /api/v1/sis/geojson (OGC-compliant GeoJSON) ───
exports.getGeoJson = async (req, res, next) => {
    try {
        const limit = Math.min(5000, parseInt(req.query.limit) || 2000);
        if (typeof req.startPhase === 'function') req.startPhase('eligibility');
        const where = buildSisWhere(req.sisAuth, req.query);
        if (typeof req.endPhase === 'function') req.endPhase('eligibility');

        if (typeof req.startPhase === 'function') req.startPhase('list');
        const [samples, maps] = await Promise.all([
            prisma.sample.findMany({
                where,
                include: { results: true },
                take: limit,
                orderBy: { updatedAt: 'desc' }
            }),
            getAnalysisMap()
        ]);
        if (typeof req.endPhase === 'function') req.endPhase('list');

        if (typeof req.startPhase === 'function') req.startPhase('mapping');
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
        if (typeof req.endPhase === 'function') req.endPhase('mapping');

        res.json({
            type: 'FeatureCollection',
            crs: {
                type: 'name',
                properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
            },
            features
        });
    } catch (err) {
        return handleExchangeError(err, req, res, next, 'Failed to generate GeoJSON FeatureCollection.');
    }
};

// ─── 4. GET /api/v1/sis/results (Flat Matrix for Statistics/CSV) ───
exports.getResultsMatrix = async (req, res, next) => {
    try {
        const limit = Math.min(2000, parseInt(req.query.limit) || 500);
        if (typeof req.startPhase === 'function') req.startPhase('eligibility');
        const where = buildSisWhere(req.sisAuth, req.query);
        if (typeof req.endPhase === 'function') req.endPhase('eligibility');

        if (typeof req.startPhase === 'function') req.startPhase('list');
        const samples = await prisma.sample.findMany({
            where,
            include: { results: true },
            take: limit,
            orderBy: { updatedAt: 'desc' }
        });
        if (typeof req.endPhase === 'function') req.endPhase('list');

        if (typeof req.startPhase === 'function') req.startPhase('mapping');
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
        if (typeof req.endPhase === 'function') req.endPhase('mapping');

        res.json({
            status: 'success',
            count: rows.length,
            data: rows
        });
    } catch (err) {
        return handleExchangeError(err, req, res, next, 'Failed to extract results matrix.');
    }
};

// ─── 5. GET /api/v1/sis/spectra (Spectroscopy Dataset) ───
exports.getSpectra = async (req, res, next) => {
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
        if (typeof req.startPhase === 'function') req.startPhase('eligibility');
        const parentSampleWhere = buildSampleWhere(req.sisAuth, req.query);
        if (typeof req.endPhase === 'function') req.endPhase('eligibility');

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

        if (typeof req.startPhase === 'function') req.startPhase('list');
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

        if (typeof req.endPhase === 'function') req.endPhase('list');

        if (typeof req.startPhase === 'function') req.startPhase('mapping');
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
        if (typeof req.endPhase === 'function') req.endPhase('mapping');

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
        return handleExchangeError(err, req, res, next, 'Failed to retrieve spectral dataset.');
    }
};

// ─── 6. GET /api/v1/sis/sync (Delta Sync ETL) ───
exports.syncDelta = async (req, res, next) => {
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
        if (typeof req.startPhase === 'function') req.startPhase('eligibility');
        const where = buildSampleWhere(req.sisAuth, { updatedSince });
        const spectralWhere = {
            ...toPrismaSpectralWhere(buildSpectralWhere(req.sisAuth, {}, where)),
            timestamp: { gte: sinceDate }
        };
        if (typeof req.endPhase === 'function') req.endPhase('eligibility');

        if (typeof req.startPhase === 'function') req.startPhase('list');
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
        if (typeof req.endPhase === 'function') req.endPhase('list');

        if (typeof req.startPhase === 'function') req.startPhase('mapping');
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

        const responsePayload = {
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
        };
        if (typeof req.endPhase === 'function') req.endPhase('mapping');

        res.json(responsePayload);
    } catch (err) {
        return handleExchangeError(err, req, res, next, 'Failed to perform delta sync.');
    }
};

// ─── 7. GET /api/v1/sis/stats (Global / Regional Metrics) ───
exports.getStats = async (req, res, next) => {
    try {
        if (typeof req.startPhase === 'function') req.startPhase('eligibility');
        const sampleWhere = buildSampleWhere(req.sisAuth, {});
        const spectralWhere = toPrismaSpectralWhere(buildSpectralWhere(req.sisAuth, {}, sampleWhere));
        if (typeof req.endPhase === 'function') req.endPhase('eligibility');

        const keyLabs = req.sisAuth?.labs || [];
        const isApiKey = req.sisAuth?.type === 'API_KEY';
        const hasGlobalLab = keyLabs.includes('*') || (!isApiKey && req.sisAuth?.role === 'SUPER_ADMIN');
        const labWhere = hasGlobalLab ? {} : { id: { in: keyLabs } };

        if (typeof req.startPhase === 'function') req.startPhase('count');
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
        if (typeof req.endPhase === 'function') req.endPhase('count');

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
        return handleExchangeError(err, req, res, next, 'Failed to compile SIS statistics.');
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

        const { getDb } = require('../services/exchangeStateService');
        const db = getDb();
        const hasKeysTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_connection_keys'").get());
        const linkMap = new Map();
        if (hasKeysTable) {
            try {
                const links = db.prepare('SELECT api_key_id, key_status, rotated_at FROM _exchange_connection_keys').all();
                links.forEach(l => linkMap.set(l.api_key_id, l));
            } catch (e) {}
        }

        const safeKeys = keys.map(k => {
            const link = linkMap.get(k.id);
            const keyStatus = link?.key_status || (k.isActive ? 'ACTIVE' : 'REVOKED');
            const isRotating = keyStatus === 'ROTATING';
            return {
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
                keyStatus,
                isRotating,
                createdBy: k.createdBy,
                lastUsedAt: k.lastUsedAt,
                expiresAt: k.expiresAt,
                createdAt: k.createdAt
            };
        });

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
            db.prepare("UPDATE _exchange_connection_keys SET key_status = 'REVOKED', rotated_at = ? WHERE api_key_id = ?").run(new Date().toISOString(), id);
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

const rotationReplayCache = new Map(); // idempotencyKey -> { keyId, actorId, connectionId, fingerprint, timestamp, responseBody }

function cleanRotationReplayCache() {
    const now = Date.now();
    for (const [k, v] of rotationReplayCache.entries()) {
        if (now - v.timestamp > 24 * 60 * 60 * 1000) {
            rotationReplayCache.delete(k);
        }
    }
    if (rotationReplayCache.size > 500) {
        const oldestKeys = Array.from(rotationReplayCache.keys()).slice(0, 100);
        oldestKeys.forEach(k => rotationReplayCache.delete(k));
    }
}

exports.rotateApiKey = async (req, res) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can rotate SIS API keys.' });
    }

    try {
        const { id } = req.params;
        const idempotencyKey = req.headers?.['idempotency-key'] || req.headers?.['x-idempotency-key'] || req.body?.idempotencyKey;
        const actorId = req.user?.id || req.user?.username || 'admin';
        const requestFingerprint = crypto.createHash('sha256').update(JSON.stringify({
            actorId,
            keyId: id,
            body: req.body || {}
        })).digest('hex');

        const { getDb } = require('../services/exchangeStateService');
        const db = getDb();
        const hasOpsTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_rotation_operations'").get());

        // 1. Durable operation recovery & idempotency binding check (R3, R10, R11)
        if (idempotencyKey) {
            let existingOp = null;
            if (hasOpsTable) {
                try {
                    existingOp = db.prepare('SELECT * FROM _exchange_rotation_operations WHERE idempotency_key = ?').get(idempotencyKey);
                } catch (e) {}
            }

            if (existingOp) {
                // Check if operation has expired (24h retention)
                if (existingOp.expires_at && new Date(existingOp.expires_at) < new Date()) {
                    db.prepare('DELETE FROM _exchange_rotation_operations WHERE idempotency_key = ?').run(idempotencyKey);
                } else {
                    // Strictly bind to requested key, authenticated actor, and request fingerprint
                    if (existingOp.old_key_id !== id || existingOp.actor_id !== actorId || existingOp.request_fingerprint !== requestFingerprint) {
                        return res.status(409).json({
                            error: 'CONFLICT',
                            code: 'IDEMPOTENCY_CONFLICT',
                            message: `Idempotency key '${idempotencyKey}' has already been used for a different rotation operation or resource.`
                        });
                    }

                    // Revalidate replacement key lifecycle (R3, R10)
                    if (existingOp.replacement_key_id) {
                        const replKey = db.prepare('SELECT id, isActive FROM ApiKey WHERE id = ?').get(existingOp.replacement_key_id);
                        const replLink = db.prepare('SELECT key_status FROM _exchange_connection_keys WHERE api_key_id = ?').get(existingOp.replacement_key_id);
                        if (!replKey) {
                            return res.status(404).json({
                                error: 'NOT_FOUND',
                                code: 'REPLACEMENT_KEY_NOT_FOUND',
                                message: 'Replacement API key generated by this operation does not exist.'
                            });
                        }
                        if (replKey.isActive !== 1 || replLink?.key_status === 'REVOKED') {
                            return res.status(409).json({
                                error: 'CONFLICT',
                                code: 'KEY_REVOKED',
                                message: 'The replacement API key generated by this rotation operation has subsequently been revoked or retired.'
                            });
                        }
                    }

                    try {
                        const payload = JSON.parse(existingOp.response_payload);
                        const currentOldKey = db.prepare('SELECT isActive FROM ApiKey WHERE id = ?').get(existingOp.old_key_id);
                        const currentOldLink = db.prepare('SELECT key_status FROM _exchange_connection_keys WHERE api_key_id = ?').get(existingOp.old_key_id);
                        const isOldActive = Boolean(currentOldKey?.isActive && currentOldLink?.key_status === 'ROTATING');
                        payload.oldKeyActive = isOldActive;
                        payload.rotating = (currentOldLink?.key_status === 'ROTATING');
                        if (!isOldActive) {
                            payload.message = 'API key rotation completed. Prior key has been retired.';
                        }
                        return res.status(200).json(payload);
                    } catch (e) {}
                }
            } else {
                // Secondary check against memory cache
                const memCached = rotationReplayCache.get(idempotencyKey);
                if (memCached) {
                    if (memCached.keyId !== id || memCached.actorId !== actorId || memCached.fingerprint !== requestFingerprint) {
                        return res.status(409).json({
                            error: 'CONFLICT',
                            code: 'IDEMPOTENCY_CONFLICT',
                            message: `Idempotency key '${idempotencyKey}' has already been used for a different rotation operation or resource.`
                        });
                    }

                    // Revalidate replacement key lifecycle in memory cache path
                    if (memCached.replacementKeyId) {
                        const replKey = db.prepare('SELECT id, isActive FROM ApiKey WHERE id = ?').get(memCached.replacementKeyId);
                        const replLink = db.prepare('SELECT key_status FROM _exchange_connection_keys WHERE api_key_id = ?').get(memCached.replacementKeyId);
                        if (!replKey) {
                            return res.status(404).json({
                                error: 'NOT_FOUND',
                                code: 'REPLACEMENT_KEY_NOT_FOUND',
                                message: 'Replacement API key generated by this operation does not exist.'
                            });
                        }
                        if (replKey.isActive !== 1 || replLink?.key_status === 'REVOKED') {
                            return res.status(409).json({
                                error: 'CONFLICT',
                                code: 'KEY_REVOKED',
                                message: 'The replacement API key generated by this rotation operation has subsequently been revoked or retired.'
                            });
                        }
                    }

                    if (Date.now() - memCached.timestamp < 24 * 60 * 60 * 1000) {
                        const currentOldKey = db.prepare('SELECT isActive FROM ApiKey WHERE id = ?').get(memCached.keyId);
                        const currentOldLink = db.prepare('SELECT key_status FROM _exchange_connection_keys WHERE api_key_id = ?').get(memCached.keyId);
                        const isOldActive = Boolean(currentOldKey?.isActive && currentOldLink?.key_status === 'ROTATING');
                        const body = { ...memCached.responseBody, oldKeyActive: isOldActive, rotating: (currentOldLink?.key_status === 'ROTATING') };
                        return res.status(200).json(body);
                    } else {
                        rotationReplayCache.delete(idempotencyKey);
                    }
                }
            }
        }

        const oldKey = await prisma.apiKey.findUnique({ where: { id } });
        if (!oldKey) {
            return res.status(404).json({ error: 'API Key not found.' });
        }
        if (!oldKey.isActive) {
            return res.status(400).json({ error: 'Cannot rotate an inactive or revoked API Key.' });
        }

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
        const expiresAtIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

        let successResponse = null;
        let durablePayload = null;

        // Execute rotation as a single atomic transaction with CAS precondition inside transaction
        const rotateTransaction = db.transaction(() => {
            // Step 0: Check idempotency uniqueness inside committing transaction to prevent concurrent race
            if (idempotencyKey && hasOpsTable) {
                const conflictOp = db.prepare('SELECT * FROM _exchange_rotation_operations WHERE idempotency_key = ?').get(idempotencyKey);
                if (conflictOp) {
                    const err = new Error(`Idempotency key '${idempotencyKey}' has already been used.`);
                    err.code = 'IDEMPOTENCY_CONFLICT';
                    throw err;
                }
            }

            // 1. CAS: Atomic transition of old key to ROTATING with bounded overlap verifying exactly 1 row affected
            const hasKeysTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_connection_keys'").get());
            if (hasKeysTable) {
                const casRes = db.prepare(`
                    UPDATE _exchange_connection_keys
                    SET key_status = 'ROTATING', rotated_at = ?
                    WHERE connection_id = ? AND api_key_id = ? AND key_status = 'ACTIVE'
                `).run(nowIso, effectiveConnectionId, oldKey.id);

                if (casRes.changes === 0) {
                    const existingLink = db.prepare('SELECT key_status FROM _exchange_connection_keys WHERE connection_id = ? AND api_key_id = ?').get(effectiveConnectionId, oldKey.id);
                    if (existingLink?.key_status === 'REVOKED') {
                        const err = new Error('API key has been revoked.');
                        err.code = 'KEY_REVOKED';
                        throw err;
                    }
                    const err = new Error('API key has already been rotated or is no longer active.');
                    err.code = 'KEY_ALREADY_ROTATED';
                    throw err;
                }
            } else {
                const casRes = db.prepare(`
                    UPDATE ApiKey
                    SET updatedAt = ?
                    WHERE id = ? AND isActive = 1
                `).run(nowIso, oldKey.id);
                if (casRes.changes === 0) {
                    const err = new Error('API key has already been rotated or is no longer active.');
                    err.code = 'KEY_ALREADY_ROTATED';
                    throw err;
                }
            }

            // 2. Insert new replacement key (old key in ApiKey table remains isActive = 1 during bounded overlap!)
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

            // 3. Link replacement key in _exchange_connection_keys
            if (hasKeysTable) {
                db.prepare(`
                    INSERT INTO _exchange_connection_keys (id, connection_id, api_key_id, key_status, created_at)
                    VALUES (?, ?, ?, 'ACTIVE', ?)
                `).run(`conn_key_${crypto.randomUUID()}`, effectiveConnectionId, newKeyId, nowIso);
            }

            // 4. Audit log
            const hasAudit = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='AuditLog'").get());
            if (hasAudit) {
                db.prepare(`
                    INSERT INTO AuditLog (id, entity, entityId, action, details, performedBy, timestamp)
                    VALUES (?, 'SIS_API_KEY', ?, 'SIS_KEY_ROTATED', ?, ?, ?)
                `).run(
                    `audit-sis-rotate-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
                    newKeyId,
                    `Rotated API key from '${oldKey.id}' to '${newKeyId}' for connection '${effectiveConnectionId}' with bounded overlap`,
                    req.user?.username || 'admin',
                    nowIso
                );
            }

            // Safe metadata payload for replay/recovery: excludes plaintext secret token (R3, R10)
            durablePayload = {
                status: 'success',
                message: 'API Key rotation is pending confirmation with bounded overlap. Old key remains active.',
                alreadyRotated: true,
                rotating: true,
                oldKeyActive: true,
                overlapGraceHours: 24,
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

            // Full response with one-time display secret returned strictly on initial creation
            successResponse = {
                status: 'success',
                message: 'API Key rotated successfully with bounded overlap. Old key remains active for up to 24 hours awaiting verification.',
                apiKey: fullApiKey,
                oldKeyActive: true,
                overlapGraceHours: 24,
                keyInfo: durablePayload.keyInfo
            };

            // 5. Durable operation record (R3, R10): stores durablePayload without raw secrets
            const effectiveOpId = idempotencyKey || `rot_op_${crypto.randomUUID()}`;
            if (hasOpsTable) {
                db.prepare(`
                    INSERT INTO _exchange_rotation_operations (
                        idempotency_key, actor_id, old_key_id, connection_id, request_fingerprint,
                        status, replacement_key_id, response_payload, created_at, expires_at
                    ) VALUES (?, ?, ?, ?, ?, 'COMMITTED', ?, ?, ?, ?)
                `).run(
                    effectiveOpId,
                    actorId,
                    oldKey.id,
                    effectiveConnectionId,
                    requestFingerprint,
                    newKeyId,
                    JSON.stringify(durablePayload),
                    nowIso,
                    expiresAtIso
                );

                // Prune expired operations
                db.prepare('DELETE FROM _exchange_rotation_operations WHERE expires_at < ?').run(nowIso);
            }
        });

        // Run atomic transaction
        rotateTransaction();

        // Memory cache update & pruning: store durablePayload without raw secret
        if (idempotencyKey) {
            cleanRotationReplayCache();
            rotationReplayCache.set(idempotencyKey, {
                keyId: id,
                replacementKeyId: newKeyId,
                actorId,
                connectionId: effectiveConnectionId,
                fingerprint: requestFingerprint,
                timestamp: Date.now(),
                responseBody: durablePayload
            });
        }

        res.json(successResponse);
    } catch (err) {
        if (err.code === 'IDEMPOTENCY_CONFLICT') {
            return res.status(409).json({
                error: 'CONFLICT',
                code: 'IDEMPOTENCY_CONFLICT',
                message: err.message || `Idempotency key '${idempotencyKey}' has already been used.`
            });
        }
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
        const keys = db.prepare("SELECT * FROM _exchange_connection_keys WHERE key_status = 'ACTIVE'").all();
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

/**
 * Confirm API Key rotation (Plan Section 9, R3, R11).
 * Completes replacement verification: retires old rotating key, leaving only replacement active.
 */
exports.confirmRotation = async (req, res) => {
    try {
        const { id } = req.params;
        const { getDb } = require('../services/exchangeStateService');
        const db = getDb();
        const key = await prisma.apiKey.findUnique({ where: { id } });
        if (!key) return res.status(404).json({ error: 'API Key not found.' });

        const hasOpsTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_rotation_operations'").get());

        if (hasOpsTable) {
            const op = db.prepare(`
                SELECT idempotency_key, old_key_id, replacement_key_id, connection_id, status
                FROM _exchange_rotation_operations
                WHERE (old_key_id = ? OR replacement_key_id = ? OR idempotency_key = ?)
                ORDER BY created_at DESC LIMIT 1
            `).get(id, id, id);

            if (op) {
                if (op.status === 'CONFIRMED') {
                    return res.status(200).json({
                        status: 'success',
                        message: 'Key rotation already confirmed. Prior key has been retired.',
                        connectionId: op.connection_id
                    });
                }
                if (op.status === 'ABORTED') {
                    return res.status(409).json({
                        error: 'CONFLICT',
                        code: 'ROTATION_ALREADY_ABORTED',
                        message: 'Cannot confirm rotation: rotation operation was previously aborted.'
                    });
                }

                // Verify replacement key preconditions: cannot resurrect revoked, inactive, or expired keys
                if (op.replacement_key_id) {
                    const replKey = db.prepare('SELECT id, isActive, expiresAt FROM ApiKey WHERE id = ?').get(op.replacement_key_id);
                    const replLink = db.prepare('SELECT key_status FROM _exchange_connection_keys WHERE api_key_id = ?').get(op.replacement_key_id);
                    if (!replKey || replKey.isActive !== 1 || replLink?.key_status !== 'ACTIVE') {
                        return res.status(409).json({
                            error: 'CONFLICT',
                            code: 'KEY_REVOKED',
                            message: 'Cannot confirm rotation: replacement API key has been revoked or is no longer active.'
                        });
                    }
                    if (replKey.expiresAt && new Date(replKey.expiresAt) <= new Date()) {
                        return res.status(409).json({
                            error: 'CONFLICT',
                            code: 'KEY_EXPIRED',
                            message: 'Cannot confirm rotation: replacement API key has expired.'
                        });
                    }
                }

                const confirmTx = db.transaction(() => {
                    db.prepare("UPDATE _exchange_rotation_operations SET status = 'CONFIRMED' WHERE idempotency_key = ?").run(op.idempotency_key);
                    if (op.old_key_id) {
                        db.prepare("UPDATE _exchange_connection_keys SET key_status = 'RETIRED' WHERE api_key_id = ? AND key_status = 'ROTATING'").run(op.old_key_id);
                        db.prepare("UPDATE ApiKey SET isActive = 0 WHERE id = ?").run(op.old_key_id);
                    }
                    if (op.replacement_key_id) {
                        db.prepare("UPDATE _exchange_connection_keys SET key_status = 'ACTIVE' WHERE api_key_id = ? AND key_status = 'ACTIVE'").run(op.replacement_key_id);
                        db.prepare("UPDATE ApiKey SET isActive = 1 WHERE id = ? AND isActive = 1").run(op.replacement_key_id);
                    }
                });
                confirmTx();

                return res.status(200).json({
                    status: 'success',
                    message: 'Key rotation confirmed. Prior key has been retired.',
                    connectionId: op.connection_id
                });
            }
        }

        return res.status(404).json({
            error: 'NOT_FOUND',
            code: 'ROTATION_NOT_FOUND',
            message: 'No pending rotation operation found for this key.'
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to confirm rotation: ' + err.message });
    }
};

/**
 * Abort API Key rotation (Plan Section 9, R3, R11).
 * Restores original rotating key to ACTIVE and revokes ONLY the unconfirmed replacement key.
 */
exports.abortRotation = async (req, res) => {
    try {
        const { id } = req.params;
        const { getDb } = require('../services/exchangeStateService');
        const db = getDb();
        const key = await prisma.apiKey.findUnique({ where: { id } });
        if (!key) return res.status(404).json({ error: 'API Key not found.' });

        const hasOpsTable = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_exchange_rotation_operations'").get());

        if (hasOpsTable) {
            const op = db.prepare(`
                SELECT idempotency_key, old_key_id, replacement_key_id, connection_id, status
                FROM _exchange_rotation_operations
                WHERE (old_key_id = ? OR replacement_key_id = ? OR idempotency_key = ?)
                ORDER BY created_at DESC LIMIT 1
            `).get(id, id, id);

            if (op) {
                if (op.status === 'CONFIRMED') {
                    return res.status(409).json({
                        error: 'CONFLICT',
                        code: 'ROTATION_ALREADY_CONFIRMED',
                        message: 'Cannot abort rotation: rotation operation has already been confirmed and retired the prior key.'
                    });
                }
                if (op.status === 'ABORTED') {
                    return res.status(200).json({
                        status: 'success',
                        message: 'Key rotation already aborted. Prior key remains active and replacement key has been revoked.',
                        connectionId: op.connection_id
                    });
                }

                // Verify original key preconditions: cannot resurrect revoked, retired, or expired keys
                if (op.old_key_id) {
                    const oldKey = db.prepare('SELECT id, isActive, expiresAt FROM ApiKey WHERE id = ?').get(op.old_key_id);
                    const oldLink = db.prepare('SELECT key_status, rotated_at FROM _exchange_connection_keys WHERE api_key_id = ?').get(op.old_key_id);
                    if (!oldKey || oldKey.isActive !== 1 || oldLink?.key_status !== 'ROTATING') {
                        return res.status(409).json({
                            error: 'CONFLICT',
                            code: 'KEY_REVOKED',
                            message: 'Cannot abort rotation: original API key has been revoked or is no longer eligible for reactivation.'
                        });
                    }
                    if (oldKey.expiresAt && new Date(oldKey.expiresAt) <= new Date()) {
                        return res.status(409).json({
                            error: 'CONFLICT',
                            code: 'KEY_EXPIRED',
                            message: 'Cannot abort rotation: original API key has expired.'
                        });
                    }
                    if (oldLink?.rotated_at) {
                        const age = Date.now() - new Date(oldLink.rotated_at).getTime();
                        if (age > 24 * 3600 * 1000) {
                            return res.status(409).json({
                                error: 'CONFLICT',
                                code: 'ROTATION_EXPIRED',
                                message: 'Cannot abort rotation: rotation grace window has expired.'
                            });
                        }
                    }
                }

                const abortTx = db.transaction(() => {
                    db.prepare("UPDATE _exchange_rotation_operations SET status = 'ABORTED' WHERE idempotency_key = ?").run(op.idempotency_key);
                    if (op.old_key_id) {
                        db.prepare("UPDATE _exchange_connection_keys SET key_status = 'ACTIVE', rotated_at = NULL WHERE api_key_id = ? AND key_status = 'ROTATING'").run(op.old_key_id);
                        db.prepare("UPDATE ApiKey SET isActive = 1 WHERE id = ?").run(op.old_key_id);
                    }
                    if (op.replacement_key_id) {
                        db.prepare("UPDATE _exchange_connection_keys SET key_status = 'REVOKED' WHERE api_key_id = ?").run(op.replacement_key_id);
                        db.prepare("UPDATE ApiKey SET isActive = 0 WHERE id = ?").run(op.replacement_key_id);
                    }
                });
                abortTx();

                return res.status(200).json({
                    status: 'success',
                    message: 'Key rotation aborted. Prior key remains active and replacement key has been revoked.',
                    connectionId: op.connection_id
                });
            }
        }

        return res.status(404).json({
            error: 'NOT_FOUND',
            code: 'ROTATION_NOT_FOUND',
            message: 'No pending rotation operation found for this key.'
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to abort rotation: ' + err.message });
    }
};

exports.buildSisWhere = buildSisWhere;
