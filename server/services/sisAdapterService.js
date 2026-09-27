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
function resolveSourceSystemId(db) {
    if (process.env.SOURCE_SYSTEM_ID) return process.env.SOURCE_SYSTEM_ID;
    try {
        const { getSourceSystemId } = require('./exchangeStateService');
        return getSourceSystemId(db);
    } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND' || (e.message && e.message.includes('Unexpected dependency'))) {
            return 'soilfer-lims-core';
        }
        throw e;
    }
}

const SOURCE_SYSTEM_ID = process.env.SOURCE_SYSTEM_ID || 'soilfer-lims-core';

function hasSpatialCapability(auth) {
    if (!auth) return false;
    if (auth.role === 'SUPER_ADMIN') return true;
    const caps = auth.capabilities;
    if (!Array.isArray(caps)) return false;
    return caps.includes('SPATIAL') || caps.includes('*');
}

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

function sanitizeText(val, maxLength = 255) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'object') return null;
    const str = String(val).trim();
    if (!str) return null;
    return str.slice(0, maxLength);
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
 * Validates numeric coordinate and range (rejects booleans and empty strings)
 */
function isValidCoordinate(val, min, max) {
    if (val === null || val === undefined || typeof val === 'boolean') return false;
    if (typeof val === 'string' && val.trim() === '') return false;
    const num = Number(val);
    return !isNaN(num) && isFinite(num) && num >= min && num <= max;
}

/**
 * Extracts verified WGS84 point coordinates without losing zero or failing on object wrappers.
 */
function extractCoordinates(sample = {}, field = {}, meta = {}) {
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
function extractDepths(sample = {}, field = {}, reception = {}) {
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

    const parseNum = (v) => {
        if (v === null || v === undefined || typeof v === 'boolean') return null;
        if (typeof v === 'string' && v.trim() === '') return null;
        const n = Number(v);
        return (!isNaN(n) && isFinite(n) && n >= 0) ? n : null;
    };

    let topCm = parseNum(rawTop);
    let bottomCm = parseNum(rawBottom);

    // If still null, attempt parsing from string range e.g. "0-20", "0-20 cm", "0–30"
    if (topCm === null || bottomCm === null) {
        const textCand = unwrapValue(field.depthRange) || unwrapValue(field.depth) || unwrapValue(reception.depth) || sample.horizon || null;
        if (typeof textCand === 'string') {
            const m = textCand.match(/([0-9]+(?:\.[0-9]+)?)\s*[-–_]\s*([0-9]+(?:\.[0-9]+)?)/);
            if (m) {
                if (topCm === null) topCm = parseNum(m[1]);
                if (bottomCm === null) bottomCm = parseNum(m[2]);
            }
        }
    }

    if (topCm !== null && bottomCm !== null && bottomCm < topCm) {
        const temp = topCm;
        topCm = bottomCm;
        bottomCm = temp;
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
    if (!unwrapped || typeof unwrapped === 'boolean') return null;

    let str = String(unwrapped).trim();
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
        const year = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const day = parseInt(m[3], 10);
        if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
            return null;
        }
        const d = new Date(Date.UTC(year, month - 1, day));
        if (isNaN(d.getTime())) return null;
        if (d.getUTCFullYear() !== year || d.getUTCMonth() !== (month - 1) || d.getUTCDate() !== day) {
            return null;
        }
        return `${m[1]}-${m[2]}-${m[3]}`;
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
    if (!unwrapped || typeof unwrapped === 'boolean') return null;

    if (typeof unwrapped === 'string') {
        const m = unwrapped.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
            const year = parseInt(m[1], 10);
            const month = parseInt(m[2], 10);
            const day = parseInt(m[3], 10);
            if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
                return null;
            }
        }
    }

    const d = new Date(unwrapped);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
}

/**
 * Extracts truthful field dates and distinguishes from lab reception date.
 */
function extractDates(sample = {}, field = {}, reception = {}) {
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
 * Disambiguates with country:project namespace and avoids false confirmed profile inference.
 */
function extractProfileReference(sample = {}, field = {}, meta = {}) {
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

    const profileCode = (rawCode !== null && rawCode !== undefined && typeof rawCode !== 'boolean') ? String(rawCode).trim() : null;

    // Disambiguate namespace with country and projectCode (R5)
    const countryPart = (sample.country || sample.countryName) ? String(sample.country || sample.countryName).trim() : null;
    const projectPart = sample.projectCode ? String(sample.projectCode).trim() : null;
    let namespace = 'SOILFER-GLOBAL';
    if (countryPart && projectPart) {
        if (projectPart.toUpperCase().includes(countryPart.toUpperCase())) {
            namespace = projectPart;
        } else {
            namespace = `${countryPart}:${projectPart}`;
        }
    } else if (projectPart) {
        namespace = projectPart;
    } else if (countryPart) {
        namespace = `SOILFER-${countryPart}`;
    }

    const profileKey = profileCode ? `${namespace}:${profileCode}` : null;

    // Truthful Relation classification (R5: no CONFIRMED_PROFILE inference from depths/horizons alone)
    let relation = 'UNSPECIFIED';
    if (profileCode) {
        const isComp = Boolean(field.isComposite || sample.compositeRadiusM || field.composite === true);
        const isConfirmed = Boolean(field.profileConfirmed === true || sample.isConfirmedProfile === true);
        if (isComp) {
            relation = 'COMPOSITE';
        } else if (isConfirmed) {
            relation = 'CONFIRMED_PROFILE';
        } else {
            relation = 'SITE_POINT';
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

    const currentResults = sample.results.filter(r => r.isCurrent !== false && r.isCurrent !== 0 && r.isValid !== false && r.isValid !== 0);

    currentResults.forEach(r => {
        const aMeta = analysisMap[r.param] || {};
        const methodObj = (r.methodologyId && methodMap[r.methodologyId]) ? methodMap[r.methodologyId] : aMeta.defaultMethod;

        const procedureUri = methodObj?.glosisUri || aMeta.glosisUri || null;
        const propertyUri = aMeta.glosisPropertyUri || (aMeta.glosisProperty ? `http://glosis.org/ont/property/${aMeta.glosisProperty}` : null);
        const qudtUnit = methodObj?.qudtUnit || aMeta.qudtUnit || null;

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

        const normVal = (norm.normalizedValue !== null && norm.normalizedValue !== undefined) ? norm.normalizedValue : numVal;
        const controlledUnit = norm.standardUnit || rawUnit;

        const lodVal = (r.lod !== undefined && r.lod !== null && typeof r.lod !== 'boolean' && !isNaN(Number(r.lod))) ? Number(r.lod) : null;
        const loqVal = (r.loq !== undefined && r.loq !== null && typeof r.loq !== 'boolean' && !isNaN(Number(r.loq))) ? Number(r.loq) : null;

        let parsedFlags = null;
        if (r.flags !== undefined && r.flags !== null) {
            if (typeof r.flags === 'string') {
                try { parsedFlags = JSON.parse(r.flags); } catch (e) { parsedFlags = [r.flags]; }
            } else if (Array.isArray(r.flags)) {
                parsedFlags = r.flags;
            } else {
                parsedFlags = [r.flags];
            }
        }

        const uncVal = (r.uncertainty !== undefined && r.uncertainty !== null && typeof r.uncertainty !== 'boolean' && !isNaN(Number(r.uncertainty))) ? Number(r.uncertainty) : null;
        const detDate = r.determinationDate ? formatIsoDate(r.determinationDate) : (r.analysedAt ? formatIsoDate(r.analysedAt) : null);

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
                rawEntry: r.value !== undefined ? r.value : null,
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
            uncertainty: uncVal,
            flags: parsedFlags,
            determinationDate: detDate,
            provenance: (r.provenance !== undefined && r.provenance !== null && r.provenance !== '') ? r.provenance : 'MEASURED',
            basis: (r.basis !== undefined && r.basis !== null && r.basis !== '') ? r.basis : 'AIR_DRY',
            censoring: (r.censoring !== undefined && r.censoring !== null && r.censoring !== '') ? r.censoring : 'NONE',
            replicateNo: (r.replicateNo !== undefined && r.replicateNo !== null && !isNaN(Number(r.replicateNo))) ? Number(r.replicateNo) : 1,
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
        map[obs.parameter] = {
            value: obs.normalized.value !== null ? obs.normalized.value : obs.asMeasured.value,
            as_measured: obs.asMeasured.value,
            unit: obs.asMeasured.unit,
            normalized: obs.normalized.value,
            controlled_unit: obs.controlledUnit,
            rawEntry: obs.asMeasured.rawEntry,
            qudtUnit: obs.qudtUnit,
            lod: obs.lod,
            loq: obs.loq,
            provenance: obs.provenance,
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
function formatSampleV1(sample, maps = {}, options = {}) {
    const auth = options.auth || options.sisAuth;
    const canAccessSpatial = options.internal === true || hasSpatialCapability(auth);

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
        sourceSystemId: sample.sourceSystemId || resolveSourceSystemId(),
        specimenId: sample.id,
        fieldSampleId: sample.originalId,
        labSampleId: sample.labId || null,
        laboratoryId: sample.assignedLab || null,

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
            collectorName: null,
            depthHorizon: {
                depthRange: depths.depthRange || '0–20 cm', // preserve v1 string compatibility
                topCm: depths.topCm ?? 0, // legacy fallback for v1
                bottomCm: depths.bottomCm ?? 20, // legacy fallback for v1
                horizon: depths.horizon || `${depths.topCm ?? 0}-${depths.bottomCm ?? 20} cm`,
                unit: 'cm'
            },
            coordinates: (coords && canAccessSpatial) ? {
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
            approvedBy: null,
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
function formatSampleV2(sample, maps = {}, options = {}) {
    const auth = options.auth || options.sisAuth;
    const canAccessSpatial = options.internal === true || hasSpatialCapability(auth);

    const field = safeParseJson(sample.fieldMetadata);
    const meta = safeParseJson(sample.metadata);
    const reception = safeParseJson(sample.receptionData);

    const coords = extractCoordinates(sample, field, meta);
    const depths = extractDepths(sample, field, reception);
    const dates = extractDates(sample, field, reception);
    const profile = extractProfileReference(sample, field, meta);
    const observations = extractObservations(sample, maps);
    const qualityIssues = evaluateQualityIssues(sample, coords, depths, dates, profile);

    // Truthful publicationStatus (R1, R6)
    let publicationStatus = 'DRAFT';
    if (['APPROVED', 'RELEASED', 'REPORTED', 'COMPLETED'].includes(sample.status) || (['ARCHIVED', 'DISPOSED'].includes(sample.status) && sample.approvedAt)) {
        publicationStatus = 'RELEASED';
    } else if (['CANCELLED', 'REJECTED', 'RECEIVED_REJECTED'].includes(sample.status)) {
        publicationStatus = 'WITHDRAWN';
    } else if (sample.status === 'AMBIGUOUS_PROVENANCE_HOLD') {
        publicationStatus = 'HOLD';
    }

    return {
        schemaVersion: '2026-09-issue140-v2',
        sourceSystemId: sample.sourceSystemId || resolveSourceSystemId(),

        // Core Specimen Identifiers (R4, R5: laboratoryId strictly assignedLab, no labId fallback)
        specimenId: sample.id,
        fieldSampleId: sample.originalId,
        labSampleId: sample.labId || null,
        laboratoryId: sample.assignedLab || null,

        // Classification
        country: sample.country || sample.countryName || 'UNKNOWN',
        projectCode: sample.projectCode || null,
        matrix: sample.matrix || 'SOIL',
        status: sample.status,
        publicationStatus,

        // Profile & Sampling Hierarchy
        profile: {
            code: profile.profileCode,
            namespace: profile.profileNamespace,
            key: profile.profileKey,
            relation: profile.profileRelation
        },

        // Truthful Spatiotemporal Sampling (R6: no collectorName PII in default public exchange)
        sampling: {
            collectionDate: dates.collectionDate,
            collectionTimestamp: dates.collectionTimestamp,
            collectorName: null,
            depths: {
                topCm: depths.topCm,
                bottomCm: depths.bottomCm,
                horizon: depths.horizon,
                intervalLabel: depths.depthRange,
                unit: 'cm'
            },
            location: (coords && canAccessSpatial) ? {
                type: 'Point',
                coordinates: [coords.longitude, coords.latitude], // GeoJSON order: [lng, lat]
                elevationMeters: coords.elevationMeters,
                accuracyMeters: coords.accuracyMeters,
                source: coords.source,
                srid: 4326
            } : null,
            site: {
                siteName: sanitizeText(sample.siteName || unwrapValue(field.siteName) || unwrapValue(field.farm_name)),
                village: sanitizeText(sample.village || unwrapValue(field.village) || unwrapValue(field.area)),
                district: sanitizeText(unwrapValue(field.district)),
                admin1: sanitizeText(sample.admin1 || unwrapValue(field.admin1)),
                admin2: sanitizeText(sample.admin2 || unwrapValue(field.admin2)),
                landUse: sanitizeText(unwrapValue(field.landUse) || unwrapValue(field.land_cover)),
                currentCrop: sanitizeText(unwrapValue(field.crop) || unwrapValue(field.current_crop)),
                previousCrop: sanitizeText(unwrapValue(field.previousCrop)),
                fertilizerHistory: sanitizeText(unwrapValue(field.management) || unwrapValue(field.fertilizer))
            }
        },

        // Laboratory Reception Facts (R6: no receivedBy PII)
        receipt: {
            receptionDate: dates.receptionDate,
            receptionTimestamp: dates.receptionTimestamp,
            receivedBy: null,
            receivedMassGrams: sample.receivedMass || null,
            moistureOnArrival: sample.moistureOnArrival || null
        },

        // Quality & Compliance (R6: no approvedBy PII)
        qualityControl: {
            dryingStatus: sample.dryingStatus || null,
            preparationStatus: sample.preparationStatus || null,
            approvedBy: null,
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
    resolveSourceSystemId,
    hasSpatialCapability,
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
