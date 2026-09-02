const crypto = require('crypto');
const prisma = require('../prisma');
const { normalizeUnit } = require('../services/interpretationService');

// Helper to build scoped database query based on SIS Auth permissions
function buildSisWhere(sisAuth, query = {}) {
    const where = {};

    // 1. Status Filter
    if (query.status && (query.status === 'all' || query.status === '*')) {
        // Return all statuses
    } else if (query.status) {
        where.status = query.status.toUpperCase();
    } else {
        where.status = { not: 'CANCELLED' };
    }

    // 2. Country scoping - Intersect key permissions with query parameters
    const keyCountries = sisAuth?.countries || [];
    const hasGlobalCountry = keyCountries.length === 0 || keyCountries.includes('*');

    if (query.country) {
        if (hasGlobalCountry || keyCountries.includes(query.country)) {
            where.country = query.country;
        } else {
            where.country = { in: [] }; // Deny: requested country outside authorized key scope
        }
    } else if (!hasGlobalCountry) {
        where.country = { in: keyCountries };
    }

    // 3. Project scoping - Intersect key permissions with query parameters
    const keyProjects = sisAuth?.projects || [];
    const hasGlobalProject = keyProjects.length === 0 || keyProjects.includes('*');

    if (query.project) {
        if (hasGlobalProject || keyProjects.includes(query.project)) {
            where.projectCode = query.project;
        } else {
            where.projectCode = { in: [] }; // Deny: requested project outside authorized key scope
        }
    } else if (!hasGlobalProject) {
        where.projectCode = { in: keyProjects };
    }

    // 4. Lab scoping (SL-22: API keys without explicit lab access are strictly DENIED)
    const isApiKey = sisAuth?.type === 'API_KEY';
    const keyLabs = sisAuth?.labs || [];
    const hasGlobalLab = keyLabs.includes('*') || (!isApiKey && sisAuth?.role === 'SUPER_ADMIN');

    if (isApiKey) {
        if (!hasGlobalLab) {
            if (keyLabs.length === 0) {
                // Deny: API key lacks explicit laboratory authorization
                where.OR = [{ labId: '__denied__' }, { assignedLab: '__denied__' }];
            } else if (query.labId) {
                if (keyLabs.includes(query.labId)) {
                    where.OR = [{ labId: query.labId }, { assignedLab: query.labId }];
                } else {
                    where.OR = [{ labId: '__denied__' }, { assignedLab: '__denied__' }];
                }
            } else {
                where.OR = [{ labId: { in: keyLabs } }, { assignedLab: { in: keyLabs } }];
            }
        } else if (query.labId) {
            where.OR = [{ labId: query.labId }, { assignedLab: query.labId }];
        }
    } else {
        // JWT User scoping
        if (query.labId) {
            if (hasGlobalLab || keyLabs.includes(query.labId) || sisAuth?.labId === query.labId) {
                where.OR = [{ labId: query.labId }, { assignedLab: query.labId }];
            } else {
                where.OR = [{ labId: '__denied__' }, { assignedLab: '__denied__' }];
            }
        } else if (!hasGlobalLab) {
            const allowedLabs = keyLabs.length > 0 ? keyLabs : (sisAuth?.labId ? [sisAuth.labId] : []);
            if (allowedLabs.length > 0) {
                where.OR = [{ labId: { in: allowedLabs } }, { assignedLab: { in: allowedLabs } }];
            } else {
                where.OR = [{ labId: '__denied__' }, { assignedLab: '__denied__' }];
            }
        }
    }

    // 5. Incremental sync timestamp filter
    if (query.updatedSince) {
        const sinceDate = new Date(query.updatedSince);
        if (!isNaN(sinceDate.getTime())) {
            where.updatedAt = { gte: sinceDate };
        }
    }

    return where;
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
function formatSampleForSis(sample, { analysisMap = {}, methodMap = {} } = {}) {
    let field = {};
    try { field = typeof sample.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : (sample.fieldMetadata || {}); } catch(e) {}
    
    let meta = {};
    try { meta = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {}); } catch(e) {}

    let reception = {};
    try { reception = typeof sample.receptionData === 'string' ? JSON.parse(sample.receptionData) : (sample.receptionData || {}); } catch(e) {}

    // Extract GPS
    const lat = field.latitude || field.lat || field.gps_lat || (field.coordinates ? field.coordinates.lat : null) || meta.latitude || meta.lat || meta.gpsY || null;
    const lng = field.longitude || field.lng || field.gps_lng || (field.coordinates ? field.coordinates.lng : null) || meta.longitude || meta.lng || meta.gpsX || null;
    const accuracy = field.accuracy || field.gps_accuracy || (field.coordinates ? field.coordinates.accuracy : null) || meta.accuracy || null;

    // Depth resolution (Sample columns > field metadata > reception)
    const topCm = sample.depthTop ?? (field.depthTop !== undefined ? Number(field.depthTop) : 0);
    const bottomCm = sample.depthBottom ?? (field.depthBottom !== undefined ? Number(field.depthBottom) : 20);
    const horizonDesig = sample.horizon || field.horizon || field.depth || reception.depth || `${topCm}-${bottomCm} cm`;

    // Build Results Map with genuine GloSIS Property & Used Procedure separation
    const analyticalResults = {};
    if (sample.results && Array.isArray(sample.results)) {
        // Filter only current active results if present
        const currentResults = sample.results.filter(r => r.isCurrent !== false);
        currentResults.forEach(r => {
            const aMeta = analysisMap[r.param] || {};
            const methodObj = (r.methodologyId && methodMap[r.methodologyId]) ? methodMap[r.methodologyId] : aMeta.defaultMethod;

            const procedureUri = methodObj?.glosisUri || aMeta.glosisUri || null;
            const propertyUri = aMeta.glosisPropertyUri || (aMeta.glosisProperty ? `http://glosis.org/ont/property/${aMeta.glosisProperty}` : null);
            const qudtUnit = methodObj?.qudtUnit || aMeta.qudtUnit || null;

            const rawUnit = r.unit || aMeta.units || null;
            const norm = normalizeUnit(r.param, r.value, rawUnit);
            const numVal = r.numericValue !== null && r.numericValue !== undefined ? r.numericValue : (isNaN(Number(r.value)) ? r.value : Number(r.value));
            const normVal = norm.normalizedValue !== null ? norm.normalizedValue : numVal;
            const controlledUnit = norm.standardUnit || rawUnit;

            analyticalResults[r.param] = {
                value: normVal, // legacy alias points to normalised value
                as_measured: numVal,
                unit: rawUnit,
                normalized: normVal,
                controlled_unit: controlledUnit,
                rawEntry: r.value,
                qudtUnit: qudtUnit,
                basis: r.basis || 'AIR_DRY',
                censoring: r.censoring || 'NONE',
                replicateNo: r.replicateNo || 1,
                isValid: r.isValid !== false,
                method: methodObj?.name || r.method || aMeta.methodLabel || null,
                glosis: (propertyUri || procedureUri || aMeta.glosisAttribute) ? {
                    propertyCode: aMeta.glosisProperty || null,
                    propertyUri: propertyUri,
                    usedProcedure: methodObj?.glosisProcedure || aMeta.glosisAttribute || null,
                    usedProcedureUri: procedureUri,
                    methodLabel: methodObj?.name || aMeta.methodLabel || null,
                    standard: methodObj?.standard || null,
                    citation: methodObj?.glosisCitation || aMeta.methodCitation || null
                } : null,
                analysedAt: r.analysedAt || r.updatedAt,
                updatedAt: r.updatedAt
            };
        });
    }

    return {
        id: sample.originalId || sample.id,
        sampleId: sample.originalId || sample.id,
        originalId: sample.originalId,
        labId: sample.labId || null,
        country: sample.country || sample.countryName || 'UNKNOWN',
        projectCode: sample.projectCode || null,
        status: sample.status,
        provenance: {
            collectionDate: field.collectionDate || field.sampling_date || reception.collectionDate || sample.receptionDate || null,
            collectorName: field.collector || field.surveyor_name || reception.deliveredBy || null,
            depthHorizon: {
                depthRange: `${topCm}–${bottomCm} cm`,
                topCm: topCm,
                bottomCm: bottomCm,
                horizon: horizonDesig,
                unit: 'cm'
            },
            coordinates: lat !== null && lng !== null ? {
                latitude: Number(lat),
                longitude: Number(lng),
                accuracyMeters: accuracy ? Number(accuracy) : null,
                srid: 4326
            } : null,
            site: {
                siteName: field.siteName || field.farm_name || reception.organization || null,
                village: field.village || field.area || reception.areaVillage || null,
                district: field.district || reception.district || null,
                landUse: field.landUse || field.land_cover || reception.landUse || null,
                currentCrop: field.crop || field.current_crop || reception.crop || null,
                previousCrop: field.previousCrop || reception.previousCrop || null,
                fertilizerHistory: field.management || field.fertilizer || reception.management || null
            }
        },
        analyticalResults,
        qualityControl: {
            dryingStatus: sample.dryingStatus || 'DONE',
            preparationStatus: sample.preparationStatus || 'DONE',
            approvedBy: sample.approvedBy || null,
            approvedAt: sample.approvedAt || null
        },
        createdAt: sample.createdAt,
        updatedAt: sample.updatedAt
    };
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

        const formatted = samples.map(s => formatSampleForSis(s, maps));

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

        // Check spectral data
        const spectra = await prisma.spectralData.findMany({
            where: {
                OR: [{ sampleId: sample.id }, { sampleId: sample.originalId }]
            },
            select: {
                id: true,
                modality: true,
                filename: true,
                qcStatus: true,
                status: true,
                timestamp: true
            }
        });

        const formatted = formatSampleForSis(sample, maps);
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
            const formatted = formatSampleForSis(s, maps);
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
            const formatted = formatSampleForSis(s);
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

        // Country scoping
        const keyCountries = req.sisAuth?.countries || [];
        const hasGlobalCountry = keyCountries.length === 0 || keyCountries.includes('*');
        if (!hasGlobalCountry) {
            const scopedSamples = await prisma.sample.findMany({
                where: { country: { in: keyCountries } },
                select: { id: true, labId: true, originalId: true }
            });
            const allowedIds = [];
            scopedSamples.forEach(s => {
                if (s.id) allowedIds.push(s.id);
                if (s.labId) allowedIds.push(s.labId);
                if (s.originalId) allowedIds.push(s.originalId);
            });
            where.sampleId = { in: allowedIds };
        }

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

        // Fetch take + 1 to determine hasMore
        const records = await prisma.spectralData.findMany({
            where,
            take: take + 1,
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

        const hasMore = records.length > take;
        const pageRecords = hasMore ? records.slice(0, take) : records;

        let nextCursor = null;
        if (hasMore && pageRecords.length > 0) {
            const lastItem = pageRecords[pageRecords.length - 1];
            nextCursor = Buffer.from(JSON.stringify({
                timestamp: lastItem.timestamp,
                id: lastItem.id
            })).toString('base64');
        }

        // SL-23: Paired Reference Chemistry
        const shouldAttachRef = withReference === true || withReference === 'true' || withReference === '1';
        let refMap = {};
        if (shouldAttachRef) {
            const sampleIds = [...new Set(pageRecords.map(r => r.sampleId).filter(Boolean))];
            if (sampleIds.length > 0) {
                const refResults = await prisma.result.findMany({
                    where: {
                        sampleId: { in: sampleIds },
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
        }

        // SL-23: Rich Payload Format
        const formatted = pageRecords.map(r => {
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
        const { updatedSince } = req.query;
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

        const spectralWhere = { timestamp: { gte: sinceDate } };
        const isApiKey = req.sisAuth?.type === 'API_KEY';
        const keyLabs = req.sisAuth?.labs || [];
        const hasGlobalLab = keyLabs.includes('*') || (!isApiKey && req.sisAuth?.role === 'SUPER_ADMIN');

        if (isApiKey) {
            if (!hasGlobalLab) {
                if (keyLabs.length === 0) {
                    spectralWhere.labId = '__denied__';
                } else {
                    spectralWhere.labId = { in: keyLabs };
                }
            }
        } else if (!hasGlobalLab) {
            const allowedLabs = keyLabs.length > 0 ? keyLabs : (req.sisAuth?.labId ? [req.sisAuth.labId] : []);
            if (allowedLabs.length > 0) {
                spectralWhere.labId = { in: allowedLabs };
            } else {
                spectralWhere.labId = '__denied__';
            }
        }

        const where = buildSisWhere(req.sisAuth, { updatedSince });

        const [samples, spectra] = await Promise.all([
            prisma.sample.findMany({
                where,
                include: { results: true },
                orderBy: { updatedAt: 'asc' },
                take: 1000
            }),
            prisma.spectralData.findMany({
                where: spectralWhere,
                take: 1000,
                orderBy: { timestamp: 'asc' }
            })
        ]);

        res.json({
            status: 'success',
            syncTimestamp: new Date().toISOString(),
            samplesCount: samples.length,
            spectraCount: spectra.length,
            samples: samples.map(formatSampleForSis),
            spectra: spectra.map(s => ({
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
        const sampleWhere = buildSisWhere(req.sisAuth, {});
        const spectralWhere = {};
        const isApiKey = req.sisAuth?.type === 'API_KEY';
        const keyLabs = req.sisAuth?.labs || [];
        const hasGlobalLab = keyLabs.includes('*') || (!isApiKey && req.sisAuth?.role === 'SUPER_ADMIN');

        if (isApiKey) {
            if (!hasGlobalLab) {
                if (keyLabs.length === 0) {
                    spectralWhere.labId = '__denied__';
                } else {
                    spectralWhere.labId = { in: keyLabs };
                }
            }
        } else if (!hasGlobalLab) {
            const allowedLabs = keyLabs.length > 0 ? keyLabs : (req.sisAuth?.labId ? [req.sisAuth.labId] : []);
            if (allowedLabs.length > 0) {
                spectralWhere.labId = { in: allowedLabs };
            } else {
                spectralWhere.labId = '__denied__';
            }
        }

        const [totalSamples, completedSamples, totalResults, totalSpectra, labsCount] = await Promise.all([
            prisma.sample.count({ where: sampleWhere }),
            prisma.sample.count({ where: { ...sampleWhere, status: 'COMPLETED' } }),
            prisma.result.count({ where: { sample: sampleWhere } }),
            prisma.spectralData.count({ where: spectralWhere }),
            prisma.lab.count()
        ]);

        res.json({
            status: 'success',
            metrics: {
                totalSamples,
                completedSamples,
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
    try {
        const keys = await prisma.apiKey.findMany({
            orderBy: { createdAt: 'desc' }
        });

        const safeKeys = keys.map(k => ({
            id: k.id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            role: k.role,
            countries: k.countries ? JSON.parse(k.countries) : ['*'],
            projects: k.projects ? JSON.parse(k.projects) : ['*'],
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
    try {
        const { name, role = 'NSIS_CONSUMER', countries, projects, expiresDays = 365 } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'API Key name or consumer label is required.' });
        }

        // Generate high-entropy API key
        const rawSecret = crypto.randomBytes(24).toString('hex');
        const fullApiKey = `slims_live_${rawSecret}`;
        const keyHash = crypto.createHash('sha256').update(fullApiKey).digest('hex');
        const keyPrefix = `slims_live_${rawSecret.substring(0, 8)}...`;

        const expiresAt = expiresDays ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000) : null;

        const newKey = await prisma.apiKey.create({
            data: {
                id: crypto.randomUUID(),
                name,
                keyHash,
                keyPrefix,
                role,
                countries: countries && Array.isArray(countries) ? JSON.stringify(countries) : null,
                projects: projects && Array.isArray(projects) ? JSON.stringify(projects) : null,
                isActive: true,
                createdBy: req.user?.username || 'admin',
                expiresAt
            }
        });

        // RETURN THE FULL API KEY ONLY ONCE ON CREATION
        res.json({
            status: 'success',
            message: 'API Key created successfully. Store this secret key safely as it will not be shown again.',
            apiKey: fullApiKey,
            keyInfo: {
                id: newKey.id,
                name: newKey.name,
                keyPrefix: newKey.keyPrefix,
                role: newKey.role,
                expiresAt: newKey.expiresAt
            }
        });
    } catch (err) {
        console.error('[SIS_CREATE_KEY_ERR]', err);
        res.status(500).json({ error: 'Failed to generate API Key.' });
    }
};

exports.revokeApiKey = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.apiKey.update({
            where: { id },
            data: { isActive: false }
        });
        res.json({ status: 'success', message: 'API Key revoked successfully.' });
    } catch (err) {
        console.error('[SIS_REVOKE_KEY_ERR]', err);
        res.status(500).json({ error: 'Failed to revoke API Key.' });
    }
};
