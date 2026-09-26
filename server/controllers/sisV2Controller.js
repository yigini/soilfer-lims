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
    extractObservations
} = require('../services/sisAdapterService');
const {
    buildSampleWhere,
    buildSpectralWhere,
    AUTHORIZED_RELEASE_STATUSES
} = require('../services/exchangePolicyService');
const exchangeStateService = require('../services/exchangeStateService');

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
        sourceSystemId: SOURCE_SYSTEM_ID,
        supportedProfiles: ['opennsis', 'glosis', 'default'],
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

// ─── 2. GET /api/v2/data-exchange/samples (Paginated Registry) ───
exports.getSamples = async (req, res) => {
    try {
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
        const cursor = req.query.cursor;
        const where = buildSampleWhere(req.sisAuth, req.query);

        // Cursor decoding
        const decoded = exchangeStateService.decodeCursor(cursor);
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

        const [total, samples, maps] = await Promise.all([
            prisma.sample.count({ where: buildSampleWhere(req.sisAuth, req.query) }),
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
            nextCursor = exchangeStateService.encodeCursor({
                lastUpdatedAt: last.updatedAt.toISOString(),
                lastId: last.id
            });
        }

        const data = pageItems.map(s => formatSampleV2(s, maps));

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: SOURCE_SYSTEM_ID,
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
    try {
        const { specimenId } = req.params;
        const baseWhere = buildSampleWhere(req.sisAuth, {});

        const [sample, maps] = await Promise.all([
            prisma.sample.findFirst({
                where: {
                    AND: [
                        baseWhere,
                        { OR: [{ id: specimenId }, { originalId: specimenId }, { labId: specimenId }] }
                    ]
                },
                include: { results: true, project: true }
            }),
            getAnalysisMap()
        ]);

        if (!sample) {
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: `Specimen '${specimenId}' not found or not authorized for publication.`
            });
        }

        const formatted = formatSampleV2(sample, maps);

        // Check spectral records
        const spectra = await prisma.spectralData.findMany({
            where: {
                OR: [{ sampleId: sample.id }, { sampleId: sample.originalId }]
            },
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
            sourceSystemId: SOURCE_SYSTEM_ID,
            data: formatted
        });
    } catch (err) {
        console.error('[SIS_V2_GET_SAMPLE_DETAIL_ERR]', err);
        res.status(500).json({ error: 'Failed to retrieve specimen detail.' });
    }
};

// ─── 4. GET /api/v2/data-exchange/observations (Lossless Results Array) ───
exports.getObservations = async (req, res) => {
    try {
        const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 100));
        const cursor = req.query.cursor;
        const sampleWhere = buildSampleWhere(req.sisAuth, req.query);

        const resultWhere = {
            isCurrent: true,
            sample: sampleWhere
        };

        if (req.query.param) {
            resultWhere.param = req.query.param.toUpperCase();
        }
        if (req.query.censoring) {
            resultWhere.censoring = req.query.censoring.toUpperCase();
        }
        if (req.query.basis) {
            resultWhere.basis = req.query.basis.toUpperCase();
        }

        const decoded = exchangeStateService.decodeCursor(cursor);
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

        const [total, results, maps] = await Promise.all([
            prisma.result.count({ where: { isCurrent: true, sample: sampleWhere } }),
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
            nextCursor = exchangeStateService.encodeCursor({
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
            const numVal = (r.numericValue !== null && r.numericValue !== undefined) ? r.numericValue : (isNaN(Number(r.value)) ? null : Number(r.value));
            const normVal = norm.normalizedValue !== null ? norm.normalizedValue : numVal;
            const controlledUnit = norm.standardUnit || rawUnit;

            return {
                observationId: r.id,
                specimenId: s.id,
                fieldSampleId: s.originalId,
                labSampleId: s.labId || null,
                laboratoryId: s.assignedLab || s.labId || null,
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
            sourceSystemId: SOURCE_SYSTEM_ID,
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

// ─── 5. GET /api/v2/data-exchange/geojson (RFC 7946 GeoJSON) ───
exports.getGeoJson = async (req, res) => {
    try {
        const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 2000));
        const where = buildSampleWhere(req.sisAuth, req.query);

        const [samples, maps] = await Promise.all([
            prisma.sample.findMany({
                where,
                include: { results: true },
                orderBy: [
                    { updatedAt: 'desc' },
                    { id: 'desc' }
                ],
                take: limit
            }),
            getAnalysisMap()
        ]);

        const features = [];

        samples.forEach(s => {
            const v2 = formatSampleV2(s, maps);
            const loc = v2.sampling.location;

            if (loc && Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
                const [lng, lat] = loc.coordinates;

                if (req.query.bbox) {
                    const [minLng, minLat, maxLng, maxLat] = req.query.bbox.split(',').map(Number);
                    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) {
                        return;
                    }
                }

                // Summary of analytical parameters for GIS mapping
                const resultsSummary = {};
                v2.observations.forEach(obs => {
                    const p = obs.parameter.toLowerCase();
                    resultsSummary[p] = obs.normalized.value !== null ? obs.normalized.value : obs.asMeasured.value;
                    resultsSummary[`${p}_unit`] = obs.controlledUnit || obs.asMeasured.unit;
                });

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
                        observations: resultsSummary
                    }
                });
            }
        });

        // RFC 7946 strictly omits the obsolete crs object
        res.json({
            type: 'FeatureCollection',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: SOURCE_SYSTEM_ID,
            count: features.length,
            features
        });
    } catch (err) {
        console.error('[SIS_V2_GEOJSON_ERR]', err);
        res.status(500).json({ error: 'Failed to generate RFC 7946 GeoJSON FeatureCollection.' });
    }
};

// ─── 6. GET /api/v2/data-exchange/stats (Scoped Metrics) ───
exports.getStats = async (req, res) => {
    try {
        const sampleWhere = buildSampleWhere(req.sisAuth, {});
        const spectralWhere = buildSpectralWhere(req.sisAuth, {});

        const keyLabs = req.sisAuth?.labs || [];
        const isApiKey = req.sisAuth?.type === 'API_KEY';
        const hasGlobalLab = keyLabs.includes('*') || (!isApiKey && req.sisAuth?.role === 'SUPER_ADMIN');
        const labWhere = hasGlobalLab ? {} : { id: { in: keyLabs } };

        const [totalEligibleSamples, publishedSamples, publishedObservations, publishedSpectra, labsCount] = await Promise.all([
            prisma.sample.count({ where: sampleWhere }),
            prisma.sample.count({ where: { ...sampleWhere, status: { in: AUTHORIZED_RELEASE_STATUSES } } }),
            prisma.result.count({ where: { isCurrent: true, sample: sampleWhere } }),
            prisma.spectralData.count({ where: spectralWhere }),
            prisma.lab.count({ where: labWhere })
        ]);

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: SOURCE_SYSTEM_ID,
            metrics: {
                totalEligibleSamples,
                publishedSamples,
                publishedObservations,
                publishedSpectra,
                registeredLabs: labsCount,
                standardsCompliant: 'GLOSOLAN / ISO 17025',
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
    // Delegate to existing spectral query with v2 formatting
    const sisController = require('./sisController');
    return sisController.getSpectra(req, res);
};

// ─── 8. POST /api/v2/data-exchange/snapshots (Create Snapshot) ───
exports.createSnapshot = async (req, res) => {
    try {
        const ttlHours = req.body?.ttlHours ? Number(req.body.ttlHours) : 24;
        const snapshot = await exchangeStateService.createSnapshot(req.sisAuth, { ttlHours });
        res.status(201).json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: SOURCE_SYSTEM_ID,
            ...snapshot
        });
    } catch (err) {
        console.error('[SIS_V2_CREATE_SNAPSHOT_ERR]', err);
        res.status(500).json({ error: 'Failed to create export snapshot.' });
    }
};

// ─── 9. GET /api/v2/data-exchange/snapshots/:snapshotId/pages (Read Snapshot Pages) ───
exports.getSnapshotPages = async (req, res) => {
    try {
        const { snapshotId } = req.params;
        const { limit, cursor } = req.query;
        const maps = await getAnalysisMap();

        const result = await exchangeStateService.getSnapshotPage(snapshotId, req.sisAuth, { limit, cursor, maps });
        if (result.error) {
            return res.status(result.status || 400).json({
                error: result.error,
                message: result.message
            });
        }

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: SOURCE_SYSTEM_ID,
            ...result
        });
    } catch (err) {
        console.error('[SIS_V2_SNAPSHOT_PAGES_ERR]', err);
        res.status(500).json({ error: 'Failed to read snapshot pages.' });
    }
};

// ─── 10. GET /api/v2/data-exchange/changes (Change Feed / Continuous Sync) ───
exports.getChanges = async (req, res) => {
    try {
        const { cursor, limit } = req.query;
        const maps = await getAnalysisMap();

        const result = await exchangeStateService.getChanges(req.sisAuth, { cursor, limit, maps });
        if (result.error) {
            return res.status(result.status || 400).json({
                error: result.error,
                code: result.error,
                message: result.message
            });
        }

        res.json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: SOURCE_SYSTEM_ID,
            ...result
        });
    } catch (err) {
        console.error('[SIS_V2_CHANGES_ERR]', err);
        res.status(500).json({ error: 'Failed to read change feed.' });
    }
};

// ─── 11. POST /api/v2/data-exchange/receipts (Delivery Receipts) ───
exports.submitReceipt = async (req, res) => {
    try {
        const receipt = exchangeStateService.recordReceipt(req.sisAuth, req.body || {});
        res.status(200).json({
            status: 'success',
            schemaVersion: '2026-09-issue140-v2',
            sourceSystemId: SOURCE_SYSTEM_ID,
            receipt
        });
    } catch (err) {
        console.error('[SIS_V2_RECEIPT_ERR]', err);
        res.status(500).json({ error: 'Failed to record delivery receipt.' });
    }
};
