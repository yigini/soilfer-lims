const crypto = require('crypto');
const prisma = require('../prisma');

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

    // 2. Country scoping
    if (query.country) {
        where.country = query.country;
    } else if (sisAuth && sisAuth.countries && sisAuth.countries.length > 0 && !sisAuth.countries.includes('*')) {
        where.country = { in: sisAuth.countries };
    }

    // 3. Project scoping
    if (query.project) {
        where.projectCode = query.project;
    } else if (sisAuth && sisAuth.projects && sisAuth.projects.length > 0 && !sisAuth.projects.includes('*')) {
        where.projectCode = { in: sisAuth.projects };
    }

    // 4. Lab scoping
    if (query.labId) {
        where.OR = [{ labId: query.labId }, { assignedLab: query.labId }];
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
let lastFetchTime = 0;

async function getAnalysisMap() {
    const now = Date.now();
    if (cachedAnalysisMap && (now - lastFetchTime < 60000)) {
        return cachedAnalysisMap;
    }
    try {
        const analyses = await prisma.analysis.findMany();
        const map = {};
        analyses.forEach(a => {
            map[a.code] = a;
            if (a.glosisAttribute && !map[a.glosisAttribute]) {
                map[a.glosisAttribute] = a;
            }
        });
        cachedAnalysisMap = map;
        lastFetchTime = now;
        return map;
    } catch (e) {
        return cachedAnalysisMap || {};
    }
}

// Helper to format a sample into harmonized SIS JSON structure
function formatSampleForSis(sample, analysisMap = {}) {
    let field = {};
    try { field = typeof sample.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : (sample.fieldMetadata || {}); } catch(e) {}
    
    let meta = {};
    try { meta = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : (sample.metadata || {}); } catch(e) {}

    let reception = {};
    try { reception = typeof sample.receptionData === 'string' ? JSON.parse(sample.receptionData) : (sample.receptionData || {}); } catch(e) {}

    // Extract GPS
    const lat = field.latitude || field.lat || field.gps_lat || (field.coordinates ? field.coordinates.lat : null) || null;
    const lng = field.longitude || field.lng || field.gps_lng || (field.coordinates ? field.coordinates.lng : null) || null;
    const accuracy = field.accuracy || field.gps_accuracy || (field.coordinates ? field.coordinates.accuracy : null) || null;

    // Build Results Map with GloSIS Linked Data enrichment
    const analyticalResults = {};
    if (sample.results && Array.isArray(sample.results)) {
        sample.results.forEach(r => {
            const aMeta = analysisMap[r.param] || {};
            analyticalResults[r.param] = {
                value: isNaN(Number(r.value)) ? r.value : Number(r.value),
                unit: r.unit || aMeta.units || null,
                isValid: r.isValid !== false,
                method: r.method || aMeta.methodLabel || null,
                glosis: {
                    attribute: aMeta.glosisAttribute || r.param,
                    methodLabel: aMeta.methodLabel || null,
                    definition: aMeta.methodDefinition || null,
                    citation: aMeta.methodCitation || null,
                    uri: aMeta.glosisUri || `http://glosis.org/ont/glosis#${aMeta.glosisAttribute || r.param}`
                },
                updatedAt: r.updatedAt
            };
        });
    }

    return {
        id: sample.id,
        labId: sample.labId || null,
        originalId: sample.originalId,
        country: sample.country || sample.countryName || 'UNKNOWN',
        projectCode: sample.projectCode || null,
        status: sample.status,
        provenance: {
            collectionDate: field.collectionDate || field.sampling_date || reception.collectionDate || sample.receptionDate || null,
            collectorName: field.collector || field.surveyor_name || reception.deliveredBy || null,
            depthHorizon: {
                depthRange: field.depth || field.depthType || reception.depth || '0-20 cm',
                topCm: field.depthTop || 0,
                bottomCm: field.depthBottom || 20,
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

        const [total, samples, analysisMap] = await Promise.all([
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

        const formatted = samples.map(s => formatSampleForSis(s, analysisMap));

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
        const [sample, analysisMap] = await Promise.all([
            prisma.sample.findFirst({
                where: {
                    OR: [{ id }, { originalId: id }, { labId: id }]
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

        const formatted = formatSampleForSis(sample, analysisMap);
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

        const [samples, analysisMap] = await Promise.all([
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
            const formatted = formatSampleForSis(s, analysisMap);
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

                // Add analytical keys
                Object.entries(formatted.analyticalResults).forEach(([param, resObj]) => {
                    flatProperties[param.toLowerCase()] = resObj.value;
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
        const { modality, limit = 50, page = 1 } = req.query;
        const take = Math.min(200, parseInt(limit) || 50);
        const skip = (Math.max(1, parseInt(page) || 1) - 1) * take;

        const where = { status: 'APPROVED' };
        if (modality) where.modality = modality.toUpperCase();

        const [total, records] = await Promise.all([
            prisma.spectralData.count({ where }),
            prisma.spectralData.findMany({
                where,
                take,
                skip,
                orderBy: { timestamp: 'desc' }
            })
        ]);

        const formatted = records.map(r => ({
            id: r.id,
            sampleId: r.sampleId,
            labId: r.labId,
            modality: r.modality,
            filename: r.filename,
            timestamp: r.timestamp,
            qcStatus: r.qcStatus,
            wavelengths: r.wavelengths ? JSON.parse(r.wavelengths) : [],
            values: r.values ? JSON.parse(r.values) : []
        }));

        res.json({
            status: 'success',
            meta: { total, page: parseInt(page) || 1, limit: take },
            data: formatted
        });
    } catch (err) {
        console.error('[SIS_SPECTRA_ERR]', err);
        res.status(500).json({ error: 'Failed to retrieve spectral dataset.' });
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

        const where = buildSisWhere(req.sisAuth, { updatedSince });

        const [samples, spectra] = await Promise.all([
            prisma.sample.findMany({
                where,
                include: { results: true },
                orderBy: { updatedAt: 'asc' },
                take: 1000
            }),
            prisma.spectralData.findMany({
                where: { timestamp: { gte: sinceDate } },
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
        const [totalSamples, completedSamples, totalResults, totalSpectra, labsCount] = await Promise.all([
            prisma.sample.count(),
            prisma.sample.count({ where: { status: 'COMPLETED' } }),
            prisma.result.count(),
            prisma.spectralData.count(),
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
