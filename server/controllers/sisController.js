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

    // 4. Lab scoping
    const keyLabs = sisAuth?.labs || [];
    const hasGlobalLab = keyLabs.length === 0 || keyLabs.includes('*');

    if (query.labId) {
        if (hasGlobalLab || keyLabs.includes(query.labId)) {
            where.OR = [{ labId: query.labId }, { assignedLab: query.labId }];
        } else {
            where.OR = [{ labId: '__impossible__' }, { assignedLab: '__impossible__' }];
        }
    } else if (!hasGlobalLab) {
        where.OR = [{ labId: { in: keyLabs } }, { assignedLab: { in: keyLabs } }];
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
    const lat = field.latitude || field.lat || field.gps_lat || (field.coordinates ? field.coordinates.lat : null) || null;
    const lng = field.longitude || field.lng || field.gps_lng || (field.coordinates ? field.coordinates.lng : null) || null;
    const accuracy = field.accuracy || field.gps_accuracy || (field.coordinates ? field.coordinates.accuracy : null) || null;

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

            analyticalResults[r.param] = {
                value: r.numericValue !== null && r.numericValue !== undefined ? r.numericValue : (isNaN(Number(r.value)) ? r.value : Number(r.value)),
                rawEntry: r.value,
                unit: r.unit || aMeta.units || null,
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
        const [sample, maps] = await Promise.all([
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

        // Scope spectra by key permissions
        const keyLabs = req.sisAuth?.labs || [];
        const hasGlobalLab = keyLabs.length === 0 || keyLabs.includes('*');
        if (!hasGlobalLab) {
            where.labId = { in: keyLabs };
        }

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
        const sampleWhere = buildSisWhere(req.sisAuth, {});
        const [totalSamples, completedSamples, totalResults, totalSpectra, labsCount] = await Promise.all([
            prisma.sample.count({ where: sampleWhere }),
            prisma.sample.count({ where: { ...sampleWhere, status: 'COMPLETED' } }),
            prisma.result.count({ where: { sample: sampleWhere } }),
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
