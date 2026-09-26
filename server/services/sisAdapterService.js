/**
 * Soil Information System (SIS) / National SIS (NSIS) Data Exchange Adapter
 * Pure adapter service for harmonized SOSA/SSN & GloSIS data transformation.
 * 
 * Implements Issue #140 Work Package P1:
 * - Pure, non-mutating transformation of LIMS specimens and analytical results.
 * - Robust unwrapping of nested/wrapped fieldMetadata ({ value, source, ... }).
 * - Truthful dates: field collectionDate is distinct from laboratory receptionDate.
 * - Truthful depths: preserves decimals, zero, and null (no invented 0-20 cm defaults).
 * - Truthful coordinates: preserves zero (prime meridian / equator), validates WGS84 bounds.
 * - Profile and plot identification: exposes site_id / profile_id with deterministic namespacing.
 * - Distinct chain-of-custody identities: sourceSystemId, specimenId, fieldSampleId, labSampleId, laboratoryId.
 * - Lossless observation arrays preserving replicates, censoring, basis, and methodologies.
 */

const { normalizeUnit } = require('./interpretationService');

// Source System Identifier (stable across hostnames / migrations)
const SOURCE_SYSTEM_ID = process.env.SOURCE_SYSTEM_ID || 'soilfer-lims-core';

/**
 * Safely unwrap metadata values that may be primitive scalars, JSON strings, or { value, source, ... } wrappers.
 */
function unwrapValue(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
            try {
                const parsed = JSON.parse(trimmed);
                return unwrapValue(parsed);
            } catch (e) {
                return trimmed;
            }
        }
        return trimmed;
    }
    if (typeof val === 'object') {
        if (val instanceof Date) return val.toISOString();
        if (Array.isArray(val)) return val.map(unwrapValue);
        if (val.value !== undefined) return unwrapValue(val.value);
        if (val.raw !== undefined) return unwrapValue(val.raw);
        if (val.val !== undefined) return unwrapValue(val.val);
        // If object has no standard value property, check if it's empty
        const keys = Object.keys(val);
        if (keys.length === 0) return null;
        return val;
    }
    return val;
}

/**
 * Safely parse JSON object or string
 */
function safeParseJson(data) {
    if (!data) return {};
    if (typeof data === 'object') return data;
    if (typeof data === 'string') {
        try {
            return JSON.parse(data) || {};
        } catch (e) {
            return {};
        }
    }
    return {};
}

/**
 * Validates numeric coordinate and range
 */
function isValidCoordinate(val, min, max) {
    if (val === null || val === undefined) return false;
    const num = Number(val);
    return !isNaN(num) && isFinite(num) && num >= min && num <= max;
}

/**
 * Extracts verified WGS84 point coordinates without losing zero or failing on object wrappers.
 */
function extractCoordinates(sample, field = {}, meta = {}) {
    // Check candidates in order of precedence: Sample first-class columns > fieldMetadata > metadata
    const rawLatCandidates = [
        sample.latitude,
        unwrapValue(field.latitude),
        unwrapValue(field.lat),
        unwrapValue(field.gps_lat),
        unwrapValue(field.coordinates?.lat),
        unwrapValue(field.coordinates?.latitude),
        unwrapValue(meta.latitude),
        unwrapValue(meta.lat),
        unwrapValue(meta.gpsY)
    ];

    const rawLngCandidates = [
        sample.longitude,
        unwrapValue(field.longitude),
        unwrapValue(field.lng),
        unwrapValue(field.gps_lng),
        unwrapValue(field.coordinates?.lng),
        unwrapValue(field.coordinates?.longitude),
        unwrapValue(meta.longitude),
        unwrapValue(meta.lng),
        unwrapValue(meta.gpsX)
    ];

    let lat = null;
    for (const cand of rawLatCandidates) {
        if (cand !== null && cand !== undefined && cand !== '') {
            const unwrapped = unwrapValue(cand);
            if (isValidCoordinate(unwrapped, -90, 90)) {
                lat = Number(unwrapped);
                break;
            }
        }
    }

    let lng = null;
    for (const cand of rawLngCandidates) {
        if (cand !== null && cand !== undefined && cand !== '') {
            const unwrapped = unwrapValue(cand);
            if (isValidCoordinate(unwrapped, -180, 180)) {
                lng = Number(unwrapped);
                break;
            }
        }
    }

    // Positional accuracy / uncertainty
    const rawAccuracy = sample.positionalUncertaintyM ??
        unwrapValue(field.accuracy) ??
        unwrapValue(field.gps_accuracy) ??
        unwrapValue(field.coordinates?.accuracy) ??
        unwrapValue(meta.accuracy) ??
        null;
    const accuracy = (rawAccuracy !== null && !isNaN(Number(rawAccuracy))) ? Number(rawAccuracy) : null;

    // Elevation
    const rawElevation = sample.elevation ??
        unwrapValue(field.elevation) ??
        unwrapValue(field.altitude) ??
        unwrapValue(field.gps_elevation) ??
        null;
    const elevation = (rawElevation !== null && !isNaN(Number(rawElevation))) ? Number(rawElevation) : null;

    if (lat !== null && lng !== null) {
        return {
            latitude: lat,
            longitude: lng,
            elevationMeters: elevation,
            accuracyMeters: accuracy,
            source: sample.locationSource || unwrapValue(field.locationSource) || (accuracy ? 'FIELD_GPS' : 'UNKNOWN'),
            srid: 4326
        };
    }

    return null;
}

/**
 * Extracts depth interval truthfully without inventing 0-20 cm defaults.
 */
function extractDepths(sample, field = {}, reception = {}) {
    const rawTop = sample.depthTopCm ??
        sample.depthTop ??
        unwrapValue(field.depthTopCm) ??
        unwrapValue(field.depthTop) ??
        unwrapValue(field.depth_top) ??
        null;

    const rawBottom = sample.depthBottomCm ??
        sample.depthBottom ??
        unwrapValue(field.depthBottomCm) ??
        unwrapValue(field.depthBottom) ??
        unwrapValue(field.depth_bottom) ??
        null;

    let topCm = (rawTop !== null && rawTop !== undefined && rawTop !== '' && !isNaN(Number(rawTop))) ? Number(rawTop) : null;
    let bottomCm = (rawBottom !== null && rawBottom !== undefined && rawBottom !== '' && !isNaN(Number(rawBottom))) ? Number(rawBottom) : null;

    // If still null, attempt parsing from string range e.g. "0-20", "0-20 cm", "0–30"
    if (topCm === null || bottomCm === null) {
        const textCand = unwrapValue(field.depthRange) || unwrapValue(field.depth) || unwrapValue(reception.depth) || sample.horizon || null;
        if (typeof textCand === 'string') {
            const m = textCand.match(/([0-9]+(?:\.[0-9]+)?)\s*[-–_]\s*([0-9]+(?:\.[0-9]+)?)/);
            if (m) {
                if (topCm === null) topCm = Number(m[1]);
                if (bottomCm === null) bottomCm = Number(m[2]);
            }
        }
    }

    const horizon = sample.horizon || unwrapValue(field.horizon) || null;
    let depthRange = null;
    if (topCm !== null && bottomCm !== null) {
        depthRange = `${topCm}–${bottomCm} cm`;
    } else if (topCm !== null) {
        depthRange = `>= ${topCm} cm`;
    } else if (bottomCm !== null) {
        depthRange = `<= ${bottomCm} cm`;
    } else if (horizon) {
        depthRange = horizon;
    }

    return {
        topCm,
        bottomCm,
        horizon,
        depthRange,
        unit: 'cm'
    };
}

/**
 * Formats a valid date as YYYY-MM-DD or null.
 */
function formatIsoDate(raw) {
    if (!raw) return null;
    const unwrapped = unwrapValue(raw);
    if (!unwrapped) return null;

    if (typeof unwrapped === 'string') {
        const m = unwrapped.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
    }

    const d = new Date(unwrapped);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
}

/**
 * Formats a full ISO 8601 timestamp.
 */
function formatIsoTimestamp(raw) {
    if (!raw) return null;
    const unwrapped = unwrapValue(raw);
    if (!unwrapped) return null;
    const d = new Date(unwrapped);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
}

/**
 * Extracts truthful field dates and distinguishes from lab reception date.
 */
function extractDates(sample, field = {}, reception = {}) {
    const rawCollectionDate = unwrapValue(field.collectionDate) ||
        unwrapValue(field.sampling_date) ||
        unwrapValue(field.date_sampled) ||
        unwrapValue(field.survey_date) ||
        unwrapValue(field.collection_date) ||
        null;

    const collectionDate = formatIsoDate(rawCollectionDate);
    const collectionTimestamp = formatIsoTimestamp(rawCollectionDate);

    const receptionDate = formatIsoDate(sample.receptionDate || unwrapValue(reception.receptionDate) || unwrapValue(reception.collectionDate));
    const receptionTimestamp = formatIsoTimestamp(sample.receptionDate || unwrapValue(reception.receptionDate) || unwrapValue(reception.collectionDate));

    return {
        collectionDate,
        collectionTimestamp,
        receptionDate,
        receptionTimestamp
    };
}

/**
 * Extracts and namespaces source profile/plot reference.
 * Prevents namespace collision between projects while preserving verified field links.
 */
function extractProfileReference(sample, field = {}, meta = {}) {
    const rawCode = unwrapValue(field.site_id) ||
        unwrapValue(field.siteId) ||
        unwrapValue(field.plot_id) ||
        unwrapValue(field.plotId) ||
        unwrapValue(field.profile_id) ||
        unwrapValue(field.profileId) ||
        unwrapValue(field.profile_code) ||
        unwrapValue(field.profileCode) ||
        unwrapValue(field.pit_id) ||
        unwrapValue(field.pitId) ||
        unwrapValue(meta.site_id) ||
        unwrapValue(meta.plot_id) ||
        null;

    const profileCode = (rawCode !== null && rawCode !== undefined) ? String(rawCode).trim() : null;

    // Stable programme/project namespace
    const namespace = sample.projectCode ? String(sample.projectCode).trim() : (sample.country ? `SOILFER-${sample.country}` : 'SOILFER-GLOBAL');
    const profileKey = profileCode ? `${namespace}:${profileCode}` : null;

    // Relation classification
    let relation = 'UNKNOWN';
    if (profileCode) {
        if (field.isComposite || sample.compositeRadiusM) {
            relation = 'COMPOSITE';
        } else if (sample.horizon || (sample.depthTopCm != null && sample.depthBottomCm != null)) {
            relation = 'CONFIRMED_PROFILE';
        } else {
            relation = 'SAMPLING_POINT';
        }
    }

    return {
        profileCode,
        profileNamespace: namespace,
        profileKey,
        profileRelation: relation
    };
}

/**
 * Lossless Observation Extractor.
 * Retains every current result record without parameter-name clobbering.
 */
function extractObservations(sample, { analysisMap = {}, methodMap = {} } = {}) {
    const observations = [];
    if (!sample.results || !Array.isArray(sample.results)) {
        return observations;
    }

    const currentResults = sample.results.filter(r => r.isCurrent !== false);

    currentResults.forEach(r => {
        const aMeta = analysisMap[r.param] || {};
        const methodObj = (r.methodologyId && methodMap[r.methodologyId]) ? methodMap[r.methodologyId] : aMeta.defaultMethod;

        const procedureUri = methodObj?.glosisUri || aMeta.glosisUri || null;
        const propertyUri = aMeta.glosisPropertyUri || (aMeta.glosisProperty ? `http://glosis.org/ont/property/${aMeta.glosisProperty}` : null);
        const qudtUnit = methodObj?.qudtUnit || aMeta.qudtUnit || null;

        const rawUnit = r.unit || aMeta.units || null;
        const norm = normalizeUnit(r.param, r.value, rawUnit);
        const numVal = (r.numericValue !== null && r.numericValue !== undefined) ? r.numericValue : (isNaN(Number(r.value)) ? null : Number(r.value));
        const normVal = norm.normalizedValue !== null ? norm.normalizedValue : numVal;
        const controlledUnit = norm.standardUnit || rawUnit;

        observations.push({
            observationId: r.id,
            specimenId: sample.id,
            fieldSampleId: sample.originalId,
            labSampleId: sample.labId || null,
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
            analysedAt: r.analysedAt ? formatIsoTimestamp(r.analysedAt) : null,
            updatedAt: r.updatedAt ? formatIsoTimestamp(r.updatedAt) : null
        });
    });

    return observations;
}

/**
 * Builds legacy analyticalResults map for backward compatibility (v1).
 */
function buildLegacyAnalyticalResultsMap(observations = []) {
    const map = {};
    observations.forEach(obs => {
        // In v1 legacy, parameter is key.
        map[obs.parameter] = {
            value: obs.normalized.value !== null ? obs.normalized.value : obs.asMeasured.value,
            as_measured: obs.asMeasured.value,
            unit: obs.asMeasured.unit,
            normalized: obs.normalized.value,
            controlled_unit: obs.controlledUnit,
            rawEntry: obs.asMeasured.rawEntry,
            qudtUnit: obs.qudtUnit,
            basis: obs.basis,
            censoring: obs.censoring,
            replicateNo: obs.replicateNo,
            isValid: obs.isValid,
            method: obs.method.name,
            glosis: obs.glosis,
            analysedAt: obs.analysedAt,
            updatedAt: obs.updatedAt
        };
    });
    return map;
}

/**
 * Evaluates quality issues on a sample for downstream exchange validation.
 */
function evaluateQualityIssues(sample, coords, depths, dates, profile) {
    const issues = [];
    if (!sample.labId) issues.push('MISSING_LAB_ACCESSION');
    if (!coords) issues.push('MISSING_COORDINATES');
    if (depths.topCm === null || depths.bottomCm === null) issues.push('MISSING_DEPTH_INTERVAL');
    if (!dates.collectionDate) issues.push('MISSING_COLLECTION_DATE');
    if (!profile.profileCode) issues.push('MISSING_PROFILE_REFERENCE');
    if (sample.rejectionReason) issues.push('REJECTION_REASON_RECORDED');
    if (sample.status === 'AMBIGUOUS_PROVENANCE_HOLD') issues.push('PROVENANCE_HOLD');
    return issues;
}

/**
 * Main Harmonized Formatter for v1 API (with additive non-breaking fields).
 */
function formatSampleV1(sample, maps = {}) {
    const field = safeParseJson(sample.fieldMetadata);
    const meta = safeParseJson(sample.metadata);
    const reception = safeParseJson(sample.receptionData);

    const coords = extractCoordinates(sample, field, meta);
    const depths = extractDepths(sample, field, reception);
    const dates = extractDates(sample, field, reception);
    const profile = extractProfileReference(sample, field, meta);
    const observations = extractObservations(sample, maps);
    const analyticalResults = buildLegacyAnalyticalResultsMap(observations);
    const qualityIssues = evaluateQualityIssues(sample, coords, depths, dates, profile);

    return {
        // Legacy identity fields
        id: sample.originalId || sample.id,
        sampleId: sample.originalId || sample.id,
        originalId: sample.originalId,
        labId: sample.labId || null,

        // Additive explicit identities (Issue #140 P1)
        sourceSystemId: SOURCE_SYSTEM_ID,
        specimenId: sample.id,
        fieldSampleId: sample.originalId,
        labSampleId: sample.labId || null,
        laboratoryId: sample.assignedLab || sample.labId || null,

        // Scoping & classification
        country: sample.country || sample.countryName || 'UNKNOWN',
        projectCode: sample.projectCode || null,
        status: sample.status,

        // Additive profile metadata
        profileCode: profile.profileCode,
        profileNamespace: profile.profileNamespace,
        profileKey: profile.profileKey,
        profileRelation: profile.profileRelation,

        provenance: {
            // Truthful collectionDate; preserves legacy fallback for v1 if strictly null
            collectionDate: dates.collectionDate || sample.receptionDate || null,
            collectionTimestamp: dates.collectionTimestamp,
            receptionDate: dates.receptionDate,
            receptionTimestamp: dates.receptionTimestamp,
            collectorName: unwrapValue(field.collector) || unwrapValue(field.surveyor_name) || unwrapValue(reception.deliveredBy) || null,
            depthHorizon: {
                depthRange: depths.depthRange || '0–20 cm', // preserve v1 string compatibility
                topCm: depths.topCm ?? 0, // legacy fallback for v1
                bottomCm: depths.bottomCm ?? 20, // legacy fallback for v1
                horizon: depths.horizon || `${depths.topCm ?? 0}-${depths.bottomCm ?? 20} cm`,
                unit: 'cm'
            },
            coordinates: coords ? {
                latitude: coords.latitude,
                longitude: coords.longitude,
                accuracyMeters: coords.accuracyMeters,
                srid: coords.srid
            } : null,
            site: {
                siteName: unwrapValue(field.siteName) || unwrapValue(field.farm_name) || unwrapValue(reception.organization) || null,
                village: unwrapValue(field.village) || unwrapValue(field.area) || unwrapValue(reception.areaVillage) || null,
                district: unwrapValue(field.district) || unwrapValue(reception.district) || null,
                landUse: unwrapValue(field.landUse) || unwrapValue(field.land_cover) || unwrapValue(reception.landUse) || null,
                currentCrop: unwrapValue(field.crop) || unwrapValue(field.current_crop) || unwrapValue(reception.crop) || null,
                previousCrop: unwrapValue(field.previousCrop) || unwrapValue(reception.previousCrop) || null,
                fertilizerHistory: unwrapValue(field.management) || unwrapValue(field.fertilizer) || unwrapValue(reception.management) || null
            }
        },

        analyticalResults,
        qualityControl: {
            dryingStatus: sample.dryingStatus || 'DONE',
            preparationStatus: sample.preparationStatus || 'DONE',
            approvedBy: sample.approvedBy || null,
            approvedAt: sample.approvedAt || null
        },
        qualityIssues,
        createdAt: sample.createdAt,
        updatedAt: sample.updatedAt
    };
}

/**
 * Pure V2 Data Exchange Formatter (Strict, Lossless, Truthful).
 */
function formatSampleV2(sample, maps = {}) {
    const field = safeParseJson(sample.fieldMetadata);
    const meta = safeParseJson(sample.metadata);
    const reception = safeParseJson(sample.receptionData);

    const coords = extractCoordinates(sample, field, meta);
    const depths = extractDepths(sample, field, reception);
    const dates = extractDates(sample, field, reception);
    const profile = extractProfileReference(sample, field, meta);
    const observations = extractObservations(sample, maps);
    const qualityIssues = evaluateQualityIssues(sample, coords, depths, dates, profile);

    return {
        schemaVersion: '2026-09-issue140-v2',
        sourceSystemId: SOURCE_SYSTEM_ID,

        // Core Specimen Identifiers
        specimenId: sample.id,
        fieldSampleId: sample.originalId,
        labSampleId: sample.labId || null,
        laboratoryId: sample.assignedLab || sample.labId || null,

        // Classification
        country: sample.country || sample.countryName || 'UNKNOWN',
        projectCode: sample.projectCode || null,
        matrix: sample.matrix || 'SOIL',
        status: sample.status,
        publicationStatus: 'RELEASED',

        // Profile & Sampling Hierarchy
        profile: {
            code: profile.profileCode,
            namespace: profile.profileNamespace,
            key: profile.profileKey,
            relation: profile.profileRelation
        },

        // Truthful Spatiotemporal Sampling
        sampling: {
            collectionDate: dates.collectionDate,
            collectionTimestamp: dates.collectionTimestamp,
            collectorName: unwrapValue(field.collector) || unwrapValue(field.surveyor_name) || null,
            depths: {
                topCm: depths.topCm,
                bottomCm: depths.bottomCm,
                horizon: depths.horizon,
                intervalLabel: depths.depthRange,
                unit: 'cm'
            },
            location: coords ? {
                type: 'Point',
                coordinates: [coords.longitude, coords.latitude], // GeoJSON order: [lng, lat]
                elevationMeters: coords.elevationMeters,
                accuracyMeters: coords.accuracyMeters,
                source: coords.source,
                srid: 4326
            } : null,
            site: {
                siteName: unwrapValue(field.siteName) || unwrapValue(field.farm_name) || null,
                village: unwrapValue(field.village) || unwrapValue(field.area) || null,
                district: unwrapValue(field.district) || null,
                admin1: sample.admin1 || unwrapValue(field.admin1) || null,
                admin2: sample.admin2 || unwrapValue(field.admin2) || null,
                landUse: unwrapValue(field.landUse) || unwrapValue(field.land_cover) || null,
                currentCrop: unwrapValue(field.crop) || unwrapValue(field.current_crop) || null,
                previousCrop: unwrapValue(field.previousCrop) || null,
                fertilizerHistory: unwrapValue(field.management) || unwrapValue(field.fertilizer) || null
            }
        },

        // Laboratory Reception Facts
        receipt: {
            receptionDate: dates.receptionDate,
            receptionTimestamp: dates.receptionTimestamp,
            receivedBy: sample.receivedBy || unwrapValue(reception.deliveredBy) || null,
            receivedMassGrams: sample.receivedMass || null,
            moistureOnArrival: sample.moistureOnArrival || null
        },

        // Quality & Compliance
        qualityControl: {
            dryingStatus: sample.dryingStatus || null,
            preparationStatus: sample.preparationStatus || null,
            approvedBy: sample.approvedBy || null,
            approvedAt: sample.approvedAt ? formatIsoTimestamp(sample.approvedAt) : null
        },
        qualityIssues,

        // Lossless Analytical Chemistry Observations
        observations,

        // Audit Timestamps
        createdAt: formatIsoTimestamp(sample.createdAt),
        updatedAt: formatIsoTimestamp(sample.updatedAt),
        publishedAt: formatIsoTimestamp(sample.approvedAt || sample.updatedAt)
    };
}

module.exports = {
    SOURCE_SYSTEM_ID,
    unwrapValue,
    safeParseJson,
    extractCoordinates,
    extractDepths,
    extractDates,
    extractProfileReference,
    extractObservations,
    buildLegacyAnalyticalResultsMap,
    evaluateQualityIssues,
    formatSampleV1,
    formatSampleV2
};
