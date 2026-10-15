'use strict';

/**
 * SoilFER LIMS - Canonical Sample Origin and Provenance Service
 *
 * Single source of truth for:
 * 1. Detecting sample provenance (Project vs External Import vs Desk Walk-in)
 * 2. Enforcing immutable origin across draft saves (preventing client flags from downgrading project samples or stripping walk-in desk draft status)
 * 3. Conservative discard/deletion policy (only demonstrably unattached desk drafts may be hard deleted; all others safely revert to EXPECTED)
 */

const ORIGIN_TYPES = {
    DESK_WALKIN: 'DESK_WALKIN',         // Ad-hoc desk walk-in draft created at reception desk without project
    PROJECT_SAMPLE: 'PROJECT_SAMPLE',   // Sample associated with a project (pre-registered / expected)
    EXTERNAL_IMPORT: 'EXTERNAL_IMPORT', // Sample with external provenance (Kobo, manifest, SoilFER sheet)
    AMBIGUOUS: 'AMBIGUOUS'              // Origin cannot be proven definitively; handled conservatively as pre-registered
};

/**
 * Checks whether a sample contains external intake provenance metadata
 * (e.g. Kobo submission, field site ID, manifest import, Google Sheet sync).
 */
function hasExternalProvenance(sample) {
    if (!sample) return false;

    if (sample.fieldMetadata) {
        try {
            const fm = typeof sample.fieldMetadata === 'string' ? JSON.parse(sample.fieldMetadata) : sample.fieldMetadata;
            if (fm && (fm.kobo_submission_id || fm.site_id || fm.source === 'KOBO' || fm.source === 'MANIFEST' || fm.source === 'EXTERNAL')) {
                return true;
            }
        } catch (e) {}
    }

    if (sample.metadata) {
        try {
            const m = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : sample.metadata;
            if (m && (m.kobo_id || m.kobo_uuid || m.manifest || m.preRegistered || m.externalSource || m._uuid || m['Country'])) {
                return true;
            }
        } catch (e) {}
    }

    return false;
}

/**
 * Authoritatively determines the origin of a sample from its persisted fields.
 *
 * @param {object|null} sample - Sample database record
 * @returns {string} One of ORIGIN_TYPES
 */
function detectSampleOrigin(sample) {
    if (!sample) return ORIGIN_TYPES.AMBIGUOUS;

    // 1. Any sample linked to a project (by ID or code) is authoritatively a project sample
    if (sample.projectId || sample.projectCode) {
        return ORIGIN_TYPES.PROJECT_SAMPLE;
    }

    // 2. Any sample with external intake metadata is an external import
    if (hasExternalProvenance(sample)) {
        return ORIGIN_TYPES.EXTERNAL_IMPORT;
    }

    // 3. Inspect persisted origin markers in metadata and receptionData
    let hasWalkInOriginMarker = false;
    if (sample.metadata) {
        try {
            const m = typeof sample.metadata === 'string' ? JSON.parse(sample.metadata) : sample.metadata;
            if (m && (m.origin === ORIGIN_TYPES.DESK_WALKIN || m.sampleType === 'WALKIN')) {
                hasWalkInOriginMarker = true;
            }
        } catch (e) {}
    }

    if (sample.receptionData) {
        try {
            const rd = typeof sample.receptionData === 'string' ? JSON.parse(sample.receptionData) : sample.receptionData;
            if (rd && (rd.origin === ORIGIN_TYPES.DESK_WALKIN || rd.isWalkIn === true)) {
                hasWalkInOriginMarker = true;
            }
        } catch (e) {}
    }

    // Only if born as a desk walk-in without project or external provenance
    if (hasWalkInOriginMarker) {
        return ORIGIN_TYPES.DESK_WALKIN;
    }

    // 4. Conservative fallback: treat as ambiguous (reverts to EXPECTED, never deleted)
    return ORIGIN_TYPES.AMBIGUOUS;
}

/**
 * Evaluates whether a sample is a legitimate disposable desk draft.
 * ONLY unattached ad-hoc desk walk-ins with no project and no external provenance may be deleted.
 *
 * @param {object|null} sample - Sample database record
 * @returns {boolean}
 */
function isDisposableDeskDraft(sample) {
    return detectSampleOrigin(sample) === ORIGIN_TYPES.DESK_WALKIN;
}

/**
 * Resolves trusted immutable origin fields to persist during intake draft saves.
 *
 * - New desk walk-ins are stamped as DESK_WALKIN.
 * - Existing desk walk-ins preserve their DESK_WALKIN origin across repeated saves.
 * - Existing project samples CANNOT be converted into walk-ins by client flags.
 *
 * @param {object|null} existingSample - Persisted sample record (or null if brand new)
 * @param {boolean} isNewlyCreated - True if sample was created during this request
 * @param {object} reqBody - Intake request body
 * @returns {{ isWalkIn: boolean, origin: string }}
 */
function resolveOriginForSave(existingSample, isNewlyCreated, reqBody = {}) {
    const requestedWalkIn = reqBody.isWalkIn === true;
    const requestedProjectId = reqBody.projectId || null;

    if (isNewlyCreated || !existingSample) {
        // Brand new sample creation at desk
        if (!requestedProjectId && requestedWalkIn) {
            return {
                isWalkIn: true,
                origin: ORIGIN_TYPES.DESK_WALKIN
            };
        }
        return {
            isWalkIn: false,
            origin: requestedProjectId ? ORIGIN_TYPES.PROJECT_SAMPLE : ORIGIN_TYPES.AMBIGUOUS
        };
    }

    // Existing sample: origin is IMMUTABLE
    const existingOrigin = detectSampleOrigin(existingSample);

    if (existingOrigin === ORIGIN_TYPES.DESK_WALKIN) {
        // Legitimate desk walk-in: preserves walk-in status across subsequent draft saves
        return {
            isWalkIn: true,
            origin: ORIGIN_TYPES.DESK_WALKIN
        };
    }

    // Project samples or external records CANNOT be downgraded to walk-in by client flags
    return {
        isWalkIn: false,
        origin: existingOrigin
    };
}

module.exports = {
    ORIGIN_TYPES,
    hasExternalProvenance,
    detectSampleOrigin,
    isDisposableDeskDraft,
    resolveOriginForSave
};
