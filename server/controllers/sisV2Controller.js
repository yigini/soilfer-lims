/**
 * Soil Information System (SIS) / Data Exchange V2 Controller
 * Clean, Lossless, Resumable National Data Exchange API (v2)
 * 
 * Implements Issue #140 Work Packages P3 & P4:
 * - Versioned /api/v2/data-exchange endpoints
 * - Capabilities advertisement
 * - Lossless observation arrays with GloSIS ontology procedures and QUDT units
 * - RFC 7946 compliant GeoJSON (WGS84 [lng, lat], stable feature IDs, no obsolete crs)
 * - Strict OpenNSIS import profile validation (mandates genuine lab accessions)
 * - Durable snapshots with high-water sequence boundaries and TTL
 * - Ordered cursor-based change feed for continuous synchronization
 * - Authenticated receiver delivery receipts
 */

const crypto = require('crypto');
const prisma = require('../prisma');
const {
    SOURCE_SYSTEM_ID,
    formatSampleV2,
    extractCoordinates,
    extractDepths,
    extractDates,
    extractProfileReference,
    extractObservations,
    hasSpatialCapability,
    safeParseJson
} = require('../services/sisAdapterService');
const exchangePolicyService = require('../services/exchangePolicyService');
const {
    buildSampleWhere,
    buildSpectralWhere,
    toPrismaSpectralWhere,
    isRestrictedConsumer,
    AUTHORIZED_RELEASE_STATUSES
} = exchangePolicyService;
const exchangeStateService = require('../services/exchangeStateService');
const getSourceSystemId = () => (exchangeStateService.getSourceSystemId ? exchangeStateService.getSourceSystemId() : SOURCE_SYSTEM_ID);

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

// ─── 1. GET /api/v2/data-exchange/capabilities ───
exports.getCapabilities = (req, res) => {
    res.json({
        status: 'success',
        contractVersion: '2.0.0',
        schemaVersion: '2026-09-issue140-v2',
        sourceSystemId: getSourceSystemId(),
        supportedProfiles: ['core-lossless-v2', 'opennsis', 'glosis', 'default'],
        supportedMatrices: ['SOIL', 'PLANT', 'WATER', 'FERTILIZER'],
        limits: {
            defaultLimit: 50,
            maxLimit: 500,
            maxBboxFeatures: 5000,
            snapshotTtlHours: 24,
            cursorRetentionHours: 72
        },
        endpoints: {
            capabilities: '/api/v2/data-exchange/capabilities',
            samples: '/api/v2/data-exchange/samples',
            observations: '/api/v2/data-exchange/observations',
            geojson: '/api/v2/data-exchange/geojson',
            stats: '/api/v2/data-exchange/stats',
            spectra: '/api/v2/data-exchange/spectra',
            snapshots: '/api/v2/data-exchange/snapshots',
            changes: '/api/v2/data-exchange/changes',
            receipts: '/api/v2/data-exchange/receipts'
        },
        features: {
            resumableSnapshots: true,
            cursorChangeFeed: true,
            losslessObservations: true,
            strictProfileFiltering: true,
            deliveryReceipts: true
        }
    });
};

function checkConnectionActive(req, res) {
    if (req.sisAuth?.connectionStatus && req.sisAuth.connectionStatus !== 'ACTIVE') {
        res.status(403).json({
            error: 'Forbidden',
            code: 'CONNECTION_DISABLED',
            message: `Exchange connection '${req.sisAuth.connectionId}' is ${req.sisAuth.connectionStatus}.`
        });
        return false;
    }
    return true;
}

// ─── 2. GET /api/v2/data-exchange/samples (Paginated Registry) ───
exports.getSamples = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const ctx = exchangeStateService.buildCanonicalQueryContext(req.query, 'samples');
        if (!ctx.ok) {
            return res.status(400).json({
                error: 'Bad Request',
                code: ctx.code,
                message: ctx.error
            });
        }
        const canonicalQuery = ctx.query;
        const limit = Math.min(500, Math.max(1, parseInt(canonicalQuery.limit) || 50));
        const cursor = canonicalQuery.cursor;
        const where = buildSampleWhere(req.sisAuth, canonicalQuery);

        // Validate and decode cursor (R2, R8, R11)
        if (cursor) {
            const cursorVal = exchangeStateService.validateLiveListCursor(cursor, req.sisAuth, 'samples', canonicalQuery);
            if (!cursorVal.ok) {
                return res.status(cursorVal.status).json({
                    error: cursorVal.status === 410 ? 'Gone' : 'Bad Request',
                    code: cursorVal.code,
                    message: cursorVal.message
                });
            }
            const decoded = cursorVal.decoded;
            if (decoded && decoded.lastUpdatedAt && decoded.lastId) {
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { updatedAt: { lt: new Date(decoded.lastUpdatedAt) } },
                            {
                                updatedAt: new Date(decoded.lastUpdatedAt),
                                id: { lt: decoded.lastId }
                            }
                        ]
                    }
                ];
            }
        }

        const [total, samples, maps] = await Promise.all([
            prisma.sample.count({ where: buildSampleWhere(req.sisAuth, canonicalQuery) }),
            prisma.sample.findMany({
                where,
                include: { results: true },
                orderBy: [
                    { updatedAt: 'desc' },
                    { id: 'desc' }
                ],
                take: limit + 1
            }),
            getAnalysisMap()
        ]);

        const hasMore = samples.length > limit;
        const pageItems = hasMore ? samples.slice(0, limit) : samples;

        let nextCursor = null;
        if (hasMore && pageItems.length > 0) {
            const last = pageItems[pageItems.length - 1];
            const currentConn = exchangeStateService.getConnectionId(req.sisAuth);
            nextCursor = exchangeStateService.encodeCursor({
                type: 'live_list',
                endpoint: 'samples',
                connectionId: currentConn,
                profile: canonicalQuery.profile || 'default',
                filter: ctx.filter,
                lastUpdatedAt: last.updatedAt.toISOString(),
                lastId: last.id
            });
        }

        const eligibleSamples = isRestrictedConsumer(req.sisAuth) ? pageItems.filter(s => exchangeStateService.isSpecimenEligible(s)) : pageItems;
        const data = eligibleSamples.map(s => formatSampleV2(s, maps, { auth: req.sisAuth }));

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            boundaryTimestamp: new Date().toISOString(),
            count: data.length,
            total,
            hasMore,
            nextCursor,
            data
        });
    } catch (err) {
        console.error('[SIS_V2_GET_SAMPLES_ERR]', err);
        res.status(500).json({ error: 'Failed to retrieve v2 exchange samples.' });
    }
};

// ─── 3. GET /api/v2/data-exchange/samples/:specimenId (Single Detail) ───
exports.getSampleById = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const { specimenId } = req.params;
        const baseWhere = buildSampleWhere(req.sisAuth, {});

        const [sample, maps] = await Promise.all([
            prisma.sample.findFirst({
                where: {
                    AND: [
                        baseWhere,
                        { id: specimenId }
                    ]
                },
                include: { results: true, project: true }
            }),
            getAnalysisMap()
        ]);

        if (!sample || (isRestrictedConsumer(req.sisAuth) && !exchangeStateService.isSpecimenEligible(sample))) {
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: `Specimen '${specimenId}' not found or not authorized for publication.`
            });
        }

        const formatted = formatSampleV2(sample, maps, { auth: req.sisAuth });

        // Check spectral records with shared spectral authorization (R4, F4)
        const spectralWhere = toPrismaSpectralWhere({
            ...buildSpectralWhere(req.sisAuth, {}),
            sampleId: sample.id
        });
        const spectra = await prisma.spectralData.findMany({
            where: spectralWhere,
            select: {
                id: true,
                modality: true,
                qcStatus: true,
                status: true,
                timestamp: true
            }
        });

        formatted.spectralRecords = spectra;

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            data: formatted
        });
    } catch (err) {
        console.error('[SIS_V2_GET_SAMPLE_DETAIL_ERR]', err);
        res.status(500).json({ error: 'Failed to retrieve specimen detail.' });
    }
};

// ─── 4. GET /api/v2/data-exchange/observations (Lossless Results Array) ───
exports.getObservations = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const ctx = exchangeStateService.buildCanonicalQueryContext(req.query, 'observations');
        if (!ctx.ok) {
            return res.status(400).json({
                error: 'Bad Request',
                code: ctx.code,
                message: ctx.error
            });
        }
        const canonicalQuery = ctx.query;
        const limit = Math.min(1000, Math.max(1, parseInt(canonicalQuery.limit) || 100));
        const cursor = canonicalQuery.cursor;
        const sampleWhere = buildSampleWhere(req.sisAuth, canonicalQuery);

        const resultWhere = {
            isCurrent: true,
            OR: [{ isValid: true }, { isValid: null }],
            sample: sampleWhere
        };

        if (canonicalQuery.param) {
            resultWhere.param = canonicalQuery.param;
        }
        if (canonicalQuery.censoring) {
            resultWhere.censoring = canonicalQuery.censoring;
        }
        if (canonicalQuery.basis) {
            resultWhere.basis = canonicalQuery.basis;
        }

        // Validate and decode cursor (R2, R8, R11)
        if (cursor) {
            const cursorVal = exchangeStateService.validateLiveListCursor(cursor, req.sisAuth, 'observations', canonicalQuery);
            if (!cursorVal.ok) {
                return res.status(cursorVal.status).json({
                    error: cursorVal.status === 410 ? 'Gone' : 'Bad Request',
                    code: cursorVal.code,
                    message: cursorVal.message
                });
            }
            const decoded = cursorVal.decoded;
            if (decoded && decoded.lastUpdatedAt && decoded.lastId) {
                resultWhere.AND = [
                    ...(resultWhere.AND || []),
                    {
                        OR: [
                            { updatedAt: { lt: new Date(decoded.lastUpdatedAt) } },
                            {
                                updatedAt: new Date(decoded.lastUpdatedAt),
                                id: { lt: decoded.lastId }
                            }
                        ]
                    }
                ];
            }
        }

        const countWhere = {
            isCurrent: true,
            OR: [{ isValid: true }, { isValid: null }],
            sample: sampleWhere
        };
        if (canonicalQuery.param) {
            countWhere.param = canonicalQuery.param;
        }
        if (canonicalQuery.censoring) {
            countWhere.censoring = canonicalQuery.censoring;
        }
        if (canonicalQuery.basis) {
            countWhere.basis = canonicalQuery.basis;
        }

        const [total, results, maps] = await Promise.all([
            prisma.result.count({ where: countWhere }),
            prisma.result.findMany({
                where: resultWhere,
                include: { sample: true },
                orderBy: [
                    { updatedAt: 'desc' },
                    { id: 'desc' }
                ],
                take: limit + 1
            }),
            getAnalysisMap()
        ]);

        const hasMore = results.length > limit;
        const pageItems = hasMore ? results.slice(0, limit) : results;

        let nextCursor = null;
        if (hasMore && pageItems.length > 0) {
            const last = pageItems[pageItems.length - 1];
            const currentConn = exchangeStateService.getConnectionId(req.sisAuth);
            nextCursor = exchangeStateService.encodeCursor({
                type: 'live_list',
                endpoint: 'observations',
                connectionId: currentConn,
                profile: canonicalQuery.profile || 'default',
                filter: ctx.filter,
                lastUpdatedAt: last.updatedAt.toISOString(),
                lastId: last.id
            });
        }

        const observations = pageItems.map(r => {
            const s = r.sample;
            const aMeta = maps.analysisMap[r.param] || {};
            const methodObj = (r.methodologyId && maps.methodMap[r.methodologyId]) ? maps.methodMap[r.methodologyId] : aMeta.defaultMethod;

            const procedureUri = methodObj?.glosisUri || aMeta.glosisUri || null;
            const propertyUri = aMeta.glosisPropertyUri || (aMeta.glosisProperty ? `http://glosis.org/ont/property/${aMeta.glosisProperty}` : null);
            const qudtUnit = methodObj?.qudtUnit || aMeta.qudtUnit || null;

            const { normalizeUnit } = require('../services/interpretationService');
            const rawUnit = r.unit || aMeta.units || null;
            const norm = normalizeUnit(r.param, r.value, rawUnit);

            let numVal = null;
            const rawVal = r.value;
            const isBlankStr = (typeof rawVal === 'string' && rawVal.trim() === '');
            if (!isBlankStr && r.numericValue !== null && r.numericValue !== undefined && typeof r.numericValue !== 'boolean') {
                const parsed = Number(r.numericValue);
                if (!isNaN(parsed) && isFinite(parsed)) numVal = parsed;
            } else if (!isBlankStr && rawVal !== null && rawVal !== undefined && typeof rawVal !== 'boolean') {
                const parsed = Number(rawVal);
                if (!isNaN(parsed) && isFinite(parsed)) numVal = parsed;
            }

            const normVal = norm.normalizedValue !== null ? norm.normalizedValue : numVal;
            const controlledUnit = norm.standardUnit || rawUnit;

            const lodVal = (r.lod !== undefined && r.lod !== null && typeof r.lod !== 'boolean' && !isNaN(Number(r.lod))) ? Number(r.lod) : null;
            const loqVal = (r.loq !== undefined && r.loq !== null && typeof r.loq !== 'boolean' && !isNaN(Number(r.loq))) ? Number(r.loq) : null;

            return {
                observationId: r.id,
                specimenId: s.id,
                fieldSampleId: s.originalId,
                labSampleId: s.labId || null,
                laboratoryId: s.assignedLab || null,
                country: s.country,
                projectCode: s.projectCode,
                parameter: r.param,
                parameterCode: aMeta.code || r.param,
                parameterName: aMeta.name || r.param,
                asMeasured: {
                    value: numVal,
                    rawEntry: r.value,
                    unit: rawUnit
                },
                normalized: {
                    value: normVal,
                    unit: controlledUnit
                },
                controlledUnit,
                qudtUnit,
                lod: lodVal,
                loq: loqVal,
                provenance: r.provenance || 'MEASURED',
                basis: r.basis || 'AIR_DRY',
                censoring: r.censoring || 'NONE',
                replicateNo: r.replicateNo || 1,
                isValid: r.isValid !== false,
                method: {
                    id: r.methodologyId || null,
                    code: methodObj?.code || null,
                    name: methodObj?.name || r.method || aMeta.methodLabel || null,
                    standard: methodObj?.standard || null,
                    procedureUri,
                    citation: methodObj?.glosisCitation || aMeta.methodCitation || null
                },
                glosis: (propertyUri || procedureUri || aMeta.glosisAttribute) ? {
                    propertyCode: aMeta.glosisProperty || null,
                    propertyUri,
                    usedProcedure: methodObj?.glosisProcedure || aMeta.glosisAttribute || null,
                    usedProcedureUri: procedureUri,
                    methodLabel: methodObj?.name || aMeta.methodLabel || null,
                    standard: methodObj?.standard || null,
                    citation: methodObj?.glosisCitation || aMeta.methodCitation || null
                } : null,
                analysedAt: r.analysedAt ? r.analysedAt.toISOString() : null,
                updatedAt: r.updatedAt.toISOString()
            };
        });

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            boundaryTimestamp: new Date().toISOString(),
            count: observations.length,
            total,
            hasMore,
            nextCursor,
            data: observations
        });
    } catch (err) {
        console.error('[SIS_V2_GET_OBSERVATIONS_ERR]', err);
        res.status(500).json({ error: 'Failed to retrieve analytical chemistry observations.' });
    }
};

async function computeSpatialTotal(auth, canonicalQuery, bboxBounds) {
    const baseWhere = buildSampleWhere(auth, canonicalQuery);

    const directWhere = { ...baseWhere };
    directWhere.AND = [
        ...(directWhere.AND || []),
        bboxBounds ? {
            latitude: { gte: bboxBounds.minLat, lte: bboxBounds.maxLat },
            longitude: { gte: bboxBounds.minLng, lte: bboxBounds.maxLng }
        } : {
            latitude: { not: null },
            longitude: { not: null }
        }
    ];
    const directCount = await prisma.sample.count({ where: directWhere });

    let jsonCount = 0;
    const notEmptyMeta = { not: null, notIn: ['', '{}', 'null'] };
    const jsonCandidateWhere = { ...baseWhere, latitude: null };
    jsonCandidateWhere.AND = [
        ...(jsonCandidateWhere.AND || []),
        {
            OR: [
                { metadata: notEmptyMeta },
                { fieldMetadata: notEmptyMeta }
            ]
        }
    ];

    const jsonCandidatesTotal = await prisma.sample.count({ where: jsonCandidateWhere });
    if (jsonCandidatesTotal > 0) {
        if (jsonCandidatesTotal <= 5000) {
            const candidates = await prisma.sample.findMany({
                where: jsonCandidateWhere,
                select: {
                    latitude: true,
                    longitude: true,
                    fieldMetadata: true,
                    metadata: true
                }
            });
            for (const s of candidates) {
                const coords = extractCoordinates(s, safeParseJson(s.fieldMetadata), safeParseJson(s.metadata));
                if (!coords || coords.latitude === null || coords.longitude === null) continue;
                if (bboxBounds) {
                    if (
                        coords.longitude < bboxBounds.minLng ||
                        coords.longitude > bboxBounds.maxLng ||
                        coords.latitude < bboxBounds.minLat ||
                        coords.latitude > bboxBounds.maxLat
                    ) {
                        continue;
                    }
                }
                jsonCount++;
            }
        } else {
            const db = exchangeStateService.getDb();
            if (db && db.open) {
                try {
                    const row = db.prepare(`
                        SELECT count(*) as c FROM Sample
                        WHERE latitude IS NULL
                        AND (
                            (metadata IS NOT NULL AND metadata NOT IN ('', '{}', 'null'))
                            OR (fieldMetadata IS NOT NULL AND fieldMetadata NOT IN ('', '{}', 'null'))
                        )
                        AND (
                            json_extract(metadata, '$.latitude') IS NOT NULL
                            OR json_extract(metadata, '$.lat') IS NOT NULL
                            OR json_extract(fieldMetadata, '$.latitude') IS NOT NULL
                            OR json_extract(fieldMetadata, '$.lat') IS NOT NULL
                        )
                    `).get();
                    if (row && row.c) jsonCount = row.c;
                } catch (e) {}
            }
        }
    }

    return directCount + jsonCount;
}

// ─── 5. GET /api/v2/data-exchange/geojson (RFC 7946 GeoJSON) ───
exports.getGeoJson = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const ctx = exchangeStateService.buildCanonicalQueryContext(req.query, 'geojson');
        if (!ctx.ok) {
            return res.status(400).json({
                error: 'Bad Request',
                code: ctx.code,
                message: ctx.error
            });
        }
        const canonicalQuery = ctx.query;
        const limit = Math.min(500, Math.max(1, parseInt(canonicalQuery.limit) || 100));

        // Strict BBox validation (rejects empty components, non-finite, out of range) (R4, R7, R11)
        let bboxBounds = null;
        if (canonicalQuery.bbox !== undefined && canonicalQuery.bbox !== null) {
            const rawBbox = String(canonicalQuery.bbox);
            const parts = rawBbox.split(',').map(s => s.trim());
            if (parts.length !== 4 || parts.some(p => p === '' || isNaN(Number(p)) || !isFinite(Number(p)))) {
                return res.status(400).json({
                    error: 'Bad Request',
                    code: 'INVALID_BBOX',
                    message: "Invalid 'bbox' parameter. Must be 'minLng,minLat,maxLng,maxLat' formatted as 4 valid decimal numbers."
                });
            }
            const [minLng, minLat, maxLng, maxLat] = parts.map(Number);
            if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90 || minLng > maxLng || minLat > maxLat) {
                return res.status(400).json({
                    error: 'Bad Request',
                    code: 'INVALID_BBOX',
                    message: "Invalid 'bbox' coordinates. Must satisfy -180 <= minLng <= maxLng <= 180 and -90 <= minLat <= maxLat <= 90."
                });
            }
            bboxBounds = { minLng, minLat, maxLng, maxLat };
        }

        // Validate and decode cursor (R2, R8, R11)
        const cursor = canonicalQuery.cursor;
        let decoded = null;
        if (cursor) {
            const cursorVal = exchangeStateService.validateLiveListCursor(cursor, req.sisAuth, 'geojson', canonicalQuery);
            if (!cursorVal.ok) {
                return res.status(cursorVal.status).json({
                    error: cursorVal.status === 410 ? 'Gone' : 'Bad Request',
                    code: cursorVal.code,
                    message: cursorVal.message
                });
            }
            decoded = cursorVal.decoded;
        }

        // Spatial authorization check
        if (!hasSpatialCapability(req.sisAuth)) {
            return res.json({
                type: 'FeatureCollection',
                schemaVersion: '2026-09-issue140-v2',
                sourceSystemId: getSourceSystemId(),
                total: 0,
                count: 0,
                hasMore: false,
                nextCursor: null,
                features: []
            });
        }

        // Candidate query matching authorization and filter criteria
        const candidateBaseWhere = buildSampleWhere(req.sisAuth, canonicalQuery);
        candidateBaseWhere.AND = candidateBaseWhere.AND || [];

        const notEmptyMeta = { not: null, notIn: ['', '{}', 'null'] };
        if (bboxBounds) {
            candidateBaseWhere.AND.push({
                OR: [
                    {
                        AND: [
                            { latitude: { gte: bboxBounds.minLat, lte: bboxBounds.maxLat } },
                            { longitude: { gte: bboxBounds.minLng, lte: bboxBounds.maxLng } }
                        ]
                    },
                    { metadata: notEmptyMeta },
                    { fieldMetadata: notEmptyMeta }
                ]
            });
        } else {
            candidateBaseWhere.AND.push({
                OR: [
                    { latitude: { not: null } },
                    { metadata: notEmptyMeta },
                    { fieldMetadata: notEmptyMeta }
                ]
            });
        }

        const total = await computeSpatialTotal(req.sisAuth, canonicalQuery, bboxBounds);

        // Bounded seek/scan traversal across candidate batches (F1, R1/R4/R7/R11)
        const BATCH_SIZE = 5000;
        const MAX_SCAN_ROWS = 15000;
        const validSpatialCandidates = [];
        let scannedCount = 0;
        let exhausted = false;
        let lastScannedCandidate = null;

        let seekUpdatedAt = decoded?.lastUpdatedAt ? new Date(decoded.lastUpdatedAt) : null;
        let seekId = decoded?.lastId || null;

        while (scannedCount < MAX_SCAN_ROWS) {
            const whereClause = {
                AND: [
                    candidateBaseWhere
                ]
            };
            if (seekUpdatedAt && seekId) {
                whereClause.AND.push({
                    OR: [
                        { updatedAt: { lt: seekUpdatedAt } },
                        { id: { lt: seekId } }
                    ]
                });
            } else if (seekId) {
                whereClause.AND.push({ id: { lt: seekId } });
            }

            const queryArgs = {
                where: whereClause,
                select: {
                    id: true,
                    updatedAt: true,
                    latitude: true,
                    longitude: true,
                    fieldMetadata: true,
                    metadata: true
                },
                orderBy: [
                    { updatedAt: 'desc' },
                    { id: 'desc' }
                ],
                take: BATCH_SIZE
            };

            const batch = await prisma.sample.findMany(queryArgs);

            if (batch.length === 0) {
                exhausted = true;
                break;
            }

            scannedCount += batch.length;
            lastScannedCandidate = batch[batch.length - 1];
            seekUpdatedAt = lastScannedCandidate.updatedAt;
            seekId = lastScannedCandidate.id;

            for (const s of batch) {
                if (decoded && (decoded.lastUpdatedAt || decoded.lastId)) {
                    const sTime = s.updatedAt instanceof Date ? s.updatedAt.getTime() : new Date(s.updatedAt).getTime();
                    const targetTime = decoded.lastUpdatedAt ? new Date(decoded.lastUpdatedAt).getTime() : null;
                    if (targetTime !== null) {
                        if (sTime > targetTime) continue;
                        if (sTime === targetTime && decoded.lastId && s.id >= decoded.lastId) continue;
                    } else if (decoded.lastId && s.id >= decoded.lastId) {
                        continue;
                    }
                }
                const coords = extractCoordinates(s, safeParseJson(s.fieldMetadata), safeParseJson(s.metadata));
                if (!coords || coords.latitude === null || coords.longitude === null) {
                    continue;
                }
                if (bboxBounds) {
                    if (
                        coords.longitude < bboxBounds.minLng ||
                        coords.longitude > bboxBounds.maxLng ||
                        coords.latitude < bboxBounds.minLat ||
                        coords.latitude > bboxBounds.maxLat
                    ) {
                        continue;
                    }
                }
                validSpatialCandidates.push({
                    id: s.id,
                    updatedAt: s.updatedAt,
                    coords
                });
                if (validSpatialCandidates.length >= limit + 1) {
                    break;
                }
            }

            if (validSpatialCandidates.length >= limit + 1) {
                break;
            }

            if (batch.length < BATCH_SIZE) {
                exhausted = true;
                break;
            }
        }

        const pageCandidates = validSpatialCandidates.slice(0, limit);
        const hasMore = (total > 0 && validSpatialCandidates.length > limit) || (total > 0 && !exhausted && scannedCount >= MAX_SCAN_ROWS);
        const pageIds = pageCandidates.map(c => c.id);

        let nextCursor = null;
        if (hasMore) {
            const currentConn = exchangeStateService.getConnectionId(req.sisAuth);
            const anchorCandidate = pageCandidates.length > 0 ? pageCandidates[pageCandidates.length - 1] : lastScannedCandidate;
            if (anchorCandidate) {
                nextCursor = exchangeStateService.encodeCursor({
                    type: 'live_list',
                    endpoint: 'geojson',
                    connectionId: currentConn,
                    profile: canonicalQuery.profile || 'default',
                    filter: ctx.filter,
                    lastUpdatedAt: (anchorCandidate.updatedAt instanceof Date ? anchorCandidate.updatedAt : new Date(anchorCandidate.updatedAt)).toISOString(),
                    lastId: anchorCandidate.id
                });
            }
        }

        const detailWhere = buildSampleWhere(req.sisAuth, canonicalQuery);
        detailWhere.AND = [
            ...(detailWhere.AND || []),
            { id: { in: pageIds } }
        ];

        const [pageSamples, maps] = await Promise.all([
            pageIds.length > 0 ? prisma.sample.findMany({
                where: detailWhere,
                include: { results: true }
            }) : Promise.resolve([]),
            getAnalysisMap()
        ]);

        const sampleMap = new Map(pageSamples.map(s => [s.id, s]));
        const orderedSamples = pageCandidates.map(c => sampleMap.get(c.id)).filter(Boolean);

        const features = [];
        for (const s of orderedSamples) {
            if (!s || !exchangeStateService.isSpecimenEligible(s)) continue;
            const v2 = formatSampleV2(s, maps, { auth: req.sisAuth });
            const loc = v2.sampling.location;

            if (loc && Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
                const [lng, lat] = loc.coordinates;

                // Re-verify against bboxBounds on the fresh detail coordinates (F1, consistency race check)
                if (bboxBounds) {
                    if (
                        lng < bboxBounds.minLng ||
                        lng > bboxBounds.maxLng ||
                        lat < bboxBounds.minLat ||
                        lat > bboxBounds.maxLat
                    ) {
                        continue;
                    }
                }

                // Lossless analytical observations array preserving replicates (F6)
                const observationsList = v2.observations.map(obs => ({
                    observationId: obs.observationId,
                    parameter: obs.parameter,
                    value: obs.normalized.value !== null ? obs.normalized.value : obs.asMeasured.value,
                    unit: obs.controlledUnit || obs.asMeasured.unit,
                    replicateNo: obs.replicateNo || 1,
                    basis: obs.basis,
                    censoring: obs.censoring
                }));

                features.push({
                    type: 'Feature',
                    id: v2.specimenId,
                    geometry: {
                        type: 'Point',
                        coordinates: [lng, lat]
                    },
                    properties: {
                        specimenId: v2.specimenId,
                        fieldSampleId: v2.fieldSampleId,
                        labSampleId: v2.labSampleId,
                        laboratoryId: v2.laboratoryId,
                        country: v2.country,
                        projectCode: v2.projectCode,
                        profile: v2.profile,
                        collectionDate: v2.sampling.collectionDate,
                        depthRange: v2.sampling.depths.intervalLabel,
                        topCm: v2.sampling.depths.topCm,
                        bottomCm: v2.sampling.depths.bottomCm,
                        qualityIssues: v2.qualityIssues,
                        observations: observationsList
                    }
                });
            }
        }

        // RFC 7946 strictly omits the obsolete crs object
        res.json({
            type: 'FeatureCollection',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            total,
            count: features.length,
            hasMore,
            nextCursor,
            features
        });
    } catch (err) {
        console.error('[SIS_V2_GEOJSON_ERR]', err);
        res.status(500).json({ error: 'Failed to generate RFC 7946 GeoJSON FeatureCollection.' });
    }
};

// ─── 6. GET /api/v2/data-exchange/stats (Scoped Metrics) ───
exports.getStats = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const ctx = exchangeStateService.buildCanonicalQueryContext(req.query, 'stats');
        if (!ctx.ok) {
            return res.status(400).json({
                error: 'Bad Request',
                code: ctx.code,
                message: ctx.error
            });
        }
        const canonicalQuery = ctx.query;
        const sampleWhere = buildSampleWhere(req.sisAuth, canonicalQuery);
        const spectralWhere = toPrismaSpectralWhere(buildSpectralWhere(req.sisAuth, canonicalQuery));

        const keyLabs = req.sisAuth?.labs || [];
        const isApiKey = req.sisAuth?.type === 'API_KEY';
        const hasGlobalLab = keyLabs.includes('*') || (!isApiKey && req.sisAuth?.role === 'SUPER_ADMIN');
        const labWhere = hasGlobalLab ? {} : { id: { in: keyLabs } };

        const [totalEligibleSamples, publishedSamples, publishedObservations, labsCount] = await Promise.all([
            prisma.sample.count({ where: sampleWhere }),
            prisma.sample.count({ where: { ...sampleWhere, status: { in: AUTHORIZED_RELEASE_STATUSES } } }),
            prisma.result.count({ where: { isCurrent: true, OR: [{ isValid: true }, { isValid: null }], sample: sampleWhere } }),
            prisma.lab.count({ where: labWhere })
        ]);

        let publishedSpectra = 0;
        if (sampleWhere.assignedLab !== '__denied__' && sampleWhere.status !== '__denied_unapproved__') {
            const authorizedParents = await prisma.sample.findMany({
                where: { ...sampleWhere, status: { in: AUTHORIZED_RELEASE_STATUSES } },
                select: { id: true }
            });
            const authorizedIds = authorizedParents.map(s => s.id);
            if (authorizedIds.length > 0) {
                publishedSpectra = await prisma.spectralData.count({
                    where: { ...spectralWhere, sampleId: { in: authorizedIds } }
                });
            }
        }

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            metrics: {
                totalEligibleSamples,
                publishedSamples,
                publishedObservations,
                publishedSpectra,
                registeredLabs: labsCount,
                timestamp: new Date().toISOString()
            }
        });
    } catch (err) {
        console.error('[SIS_V2_STATS_ERR]', err);
        res.status(500).json({ error: 'Failed to compile v2 exchange statistics.' });
    }
};

// ─── 7. GET /api/v2/data-exchange/spectra (Spectroscopy Records) ───
exports.getSpectra = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const ctx = exchangeStateService.buildCanonicalQueryContext(req.query, 'spectra');
        if (!ctx.ok) {
            return res.status(400).json({
                error: 'Bad Request',
                code: ctx.code,
                message: ctx.error
            });
        }
        const canonicalQuery = ctx.query;
        const limit = Math.min(200, Math.max(1, parseInt(canonicalQuery.limit) || 50));
        const cursor = canonicalQuery.cursor;
        const spectralWhere = toPrismaSpectralWhere(buildSpectralWhere(req.sisAuth, canonicalQuery));
        const where = { ...spectralWhere };

        // Validate and decode cursor (R2, R8, R11)
        if (cursor) {
            const cursorVal = exchangeStateService.validateLiveListCursor(cursor, req.sisAuth, 'spectra', canonicalQuery);
            if (!cursorVal.ok) {
                return res.status(cursorVal.status).json({
                    error: cursorVal.status === 410 ? 'Gone' : 'Bad Request',
                    code: cursorVal.code,
                    message: cursorVal.message
                });
            }
            const decoded = cursorVal.decoded;
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
        }

        const parentSampleWhere = buildSampleWhere(req.sisAuth, canonicalQuery);

        let total = 0;
        if (parentSampleWhere.assignedLab !== '__denied__' && parentSampleWhere.status !== '__denied_unapproved__') {
            const isRestricted = exchangePolicyService.isRestrictedConsumer(req.sisAuth);
            if (isRestricted) {
                const allAuthParents = await prisma.sample.findMany({
                    where: parentSampleWhere,
                    select: { id: true }
                });
                const allAuthIds = allAuthParents.map(s => s.id);
                if (allAuthIds.length > 0) {
                    total = await prisma.spectralData.count({
                        where: {
                            ...toPrismaSpectralWhere(spectralWhere),
                            sampleId: { in: allAuthIds }
                        }
                    });
                }
            } else {
                total = await prisma.spectralData.count({ where: toPrismaSpectralWhere(spectralWhere) });
            }
        }

        const spectra = await prisma.spectralData.findMany({
            where,
            orderBy: [
                { timestamp: 'desc' },
                { id: 'desc' }
            ],
            take: limit + 1
        });

        const hasMore = spectra.length > limit;
        const candidateItems = hasMore ? spectra.slice(0, limit) : spectra;

        const sampleIds = candidateItems.map(s => s.sampleId).filter(Boolean);
        let sampleMap = {};
        if (sampleIds.length > 0) {
            const linkedSamples = await prisma.sample.findMany({
                where: {
                    AND: [
                        parentSampleWhere,
                        { id: { in: sampleIds } }
                    ]
                },
                select: { id: true, labId: true, originalId: true, status: true, assignedLab: true, country: true, projectCode: true }
            });
            sampleMap = Object.fromEntries(linkedSamples.map(s => [s.id, s]));
        }

        // External consumers: strictly only retain spectra linked to authorized released parent specimens (F4)
        const isRestricted = exchangePolicyService.isRestrictedConsumer(req.sisAuth);
        const pageItems = isRestricted
            ? candidateItems.filter(s => s.sampleId && sampleMap[s.sampleId])
            : candidateItems;

        let nextCursor = null;
        if (hasMore && candidateItems.length > 0) {
            const last = candidateItems[candidateItems.length - 1];
            const currentConn = exchangeStateService.getConnectionId(req.sisAuth);
            nextCursor = exchangeStateService.encodeCursor({
                type: 'live_list',
                endpoint: 'spectra',
                connectionId: currentConn,
                profile: canonicalQuery.profile || 'default',
                filter: ctx.filter,
                timestamp: last.timestamp ? last.timestamp.toISOString() : new Date().toISOString(),
                id: last.id
            });
        }

        const data = pageItems.map(s => {
            const smp = sampleMap[s.sampleId] || null;
            return {
                id: s.id,
                specimenId: smp?.id || s.sampleId,
                fieldSampleId: smp?.originalId || null,
                labSampleId: smp?.labId || s.labId || null,
                modality: s.modality,
                instrument: s.equipmentId || null,
                qcStatus: s.qcStatus,
                status: s.status,
                wavenumbers: s.wavelengths ? JSON.parse(s.wavelengths) : [],
                absorbance: s.values ? JSON.parse(s.values) : [],
                timestamp: s.timestamp ? s.timestamp.toISOString() : null
            };
        });

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            count: data.length,
            total,
            hasMore,
            nextCursor,
            data
        });
    } catch (err) {
        console.error('[SIS_V2_SPECTRA_ERR]', err);
        res.status(500).json({ error: 'Failed to retrieve spectral records.' });
    }
};

// ─── 8. POST /api/v2/data-exchange/snapshots (Create Snapshot) ───
exports.createSnapshot = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const ttlHours = req.body?.ttlHours ? Number(req.body.ttlHours) : 24;
        const profile = req.body?.profile || req.query?.profile || 'core-lossless-v2';

        // Validate profile (R2, R8)
        const allowedProfiles = ['core-lossless-v2', 'opennsis', 'glosis', 'default'];
        if (profile && !allowedProfiles.includes(profile)) {
            return res.status(400).json({
                error: 'INVALID_PROFILE',
                message: `Unsupported profile '${profile}'. Supported profiles: ${allowedProfiles.join(', ')}.`
            });
        }

        const filter = req.body?.filter || {};
        const maps = await getAnalysisMap();

        const snapshot = await exchangeStateService.createSnapshot(req.sisAuth, {
            ttlHours,
            profile,
            filter,
            maps
        });

        if (snapshot.error) {
            return res.status(snapshot.status || 400).json({
                error: snapshot.error,
                code: snapshot.code || snapshot.error,
                message: snapshot.message
            });
        }

        res.status(201).json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            profile,
            ...snapshot
        });
    } catch (err) {
        console.error('[SIS_V2_CREATE_SNAPSHOT_ERR]', err.message, err.stack);
        res.status(500).json({ error: 'Failed to create export snapshot.', details: err.message });
    }
};

// ─── 9. GET /api/v2/data-exchange/snapshots/:snapshotId/pages (Read Snapshot Pages) ───
exports.getSnapshotPages = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const { snapshotId } = req.params;
        const { limit, cursor } = req.query;

        const result = await exchangeStateService.getSnapshotPage(snapshotId, req.sisAuth, { limit, cursor });
        if (result.error) {
            return res.status(result.status || 400).json({
                error: result.error,
                code: result.code || result.error,
                message: result.message
            });
        }

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            ...result
        });
    } catch (err) {
        console.error('[SIS_V2_SNAPSHOT_PAGES_ERR]', err);
        res.status(500).json({ error: 'Failed to read snapshot pages.' });
    }
};

// ─── 10. GET /api/v2/data-exchange/changes (Change Feed / Continuous Sync) ───
exports.getChanges = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const { cursor, limit, profile, country, project, labId, assignedLab } = req.query;
        const maps = await getAnalysisMap();

        const result = await exchangeStateService.getChanges(req.sisAuth, {
            cursor,
            limit,
            profile,
            filter: { country, project, labId: labId || assignedLab },
            maps
        });
        if (result.error) {
            return res.status(result.status || 400).json({
                error: result.error,
                code: result.code || result.error,
                message: result.message
            });
        }

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            ...result
        });
    } catch (err) {
        console.error('[SIS_V2_CHANGES_ERR]', err.message, err.stack);
        res.status(500).json({ error: 'Failed to read change feed.', details: err.message });
    }
};

// ─── 11. POST /api/v2/data-exchange/receipts (Delivery Receipts) ───
exports.submitReceipt = async (req, res) => {
    if (!checkConnectionActive(req, res)) return;
    try {
        const receipt = exchangeStateService.recordReceipt(req.sisAuth, req.body || {});
        if (receipt.error) {
            return res.status(receipt.status || 400).json({
                error: receipt.error,
                code: receipt.code || receipt.error,
                message: receipt.message
            });
        }
        res.status(200).json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: getSourceSystemId(),
            receipt
        });
    } catch (err) {
        console.error('[SIS_V2_RECEIPT_ERR]', err);
        res.status(500).json({ error: 'Failed to record delivery receipt.' });
    }
};
