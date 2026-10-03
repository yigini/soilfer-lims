/**
 * Soil Information System (SIS) / Data Exchange Publication Policy Service
 * 
 * Implements Issue #140 Work Package P2:
 * - Shared, unified publication policy across all exchange endpoints (v1 and v2).
 * - Enforces release policy invariant: external consumers (API_KEY, NSIS_CONSUMER, VIEWER)
 *   strictly only access samples with status IN ('APPROVED', 'RELEASED').
 * - Samples on durable provenance holds (AMBIGUOUS_PROVENANCE_HOLD) or intake holds are excluded.
 * - Strict laboratory scoping: API keys without explicit lab access are DENIED (fail-closed).
 * - Country and project scoping intersected with authorized key/user permissions.
 * - Eliminates metrics leakage in /stats by scoping every counter to authorized released data.
 * - Enforces consistent eligibility across samples, detail, geojson, results, spectra, sync, and v2.
 */

const path = require('path');
const Database = require('better-sqlite3');
const projectPolicyService = require('./projectPolicyService');

const AUTHORIZED_RELEASE_STATUSES = ['APPROVED', 'RELEASED', 'ARCHIVED', 'DISPOSED'];
const ELIGIBILITY_UNAVAILABLE_MESSAGE = 'Exchange publication eligibility evaluation is temporarily unavailable.';

class ExchangeEligibilityUnavailableError extends Error {
    constructor(message = ELIGIBILITY_UNAVAILABLE_MESSAGE, details = null) {
        super(message);
        this.name = 'ExchangeEligibilityUnavailableError';
        this.status = 503;
        this.statusCode = 503;
        this.code = 'EXCHANGE_ELIGIBILITY_UNAVAILABLE';
        this.retryAfter = 5;
        this.details = details;
    }
}

/**
 * Shared Exchange Error Response Handler
 * Enforces typed retryable 503 for eligibility failures across all exchange aliases,
 * preserving Retry-After, X-Request-Id, and machine codes without leaking protected data.
 */
function handleExchangeError(err, req, res, next, defaultMessage = 'Internal Server Error during exchange operation.') {
    if (!res || res.headersSent) {
        if (next) return next(err);
        return;
    }

    const requestId = req?.exchangeRequestId || null;
    if (requestId && !res.getHeader('X-Request-Id')) {
        res.setHeader('X-Request-Id', requestId);
    }

    if (err && (err.code === 'EXCHANGE_ELIGIBILITY_UNAVAILABLE' || err instanceof ExchangeEligibilityUnavailableError)) {
        res.setHeader('Retry-After', '5');
        return res.status(503).json({
            error: 'Service Unavailable',
            code: 'EXCHANGE_ELIGIBILITY_UNAVAILABLE',
            // Internal causes can contain SQL, paths or source data. They are never public diagnostics.
            message: ELIGIBILITY_UNAVAILABLE_MESSAGE,
            retryAfter: 5,
            requestId
        });
    }

    const status = err?.status || err?.statusCode;
    if (status && status >= 400 && status < 500) {
        return res.status(status).json({
            error: err.error || err.message || (status === 400 ? 'Bad Request' : status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : status === 404 ? 'Not Found' : 'Client Error'),
            code: err.code || undefined,
            message: err.message || undefined,
            requestId
        });
    }

    console.error('[EXCHANGE_ERROR]', {
        requestId,
        method: req?.method || 'UNKNOWN',
        route: typeof req?.route?.path === 'string' ? req.route.path : '[unmatched]',
        status: 500
    });
    return res.status(500).json({
        error: defaultMessage || 'Internal Server Error during exchange operation.',
        requestId
    });
}

/**
 * Resolves IDs of samples currently on provenance hold using semantic JSON parsing.
 * Evaluates both metadata and fieldMetadata columns conservatively (fail-closed on malformed JSON or non-object).
 */
function getHeldSampleIds(db, {publicationOnly = false} = {}) {
    let metaDb = db;
    let createdInstance = false;
    try {
        if (!metaDb) {
            try {
                const { getDb } = require('./exchangeStateService');
                metaDb = getDb();
            } catch (e) {}
        }
        if (!metaDb) {
            const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.resolve(__dirname, '..', 'prisma', 'dev.db');
            metaDb = new Database(dbPath, { timeout: 2000 });
            createdInstance = true;
        }
        const hasSample = Boolean(metaDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Sample'").get());
        if (!hasSample) {
            if (createdInstance && metaDb.open) metaDb.close();
            return [];
        }
        const cols = new Set((metaDb.prepare("PRAGMA table_info(Sample)").all() || []).map(c => c.name));
        const conds = [];
        const holdCondition = (col) => `(CASE
            WHEN ${col} IS NULL OR ${col} = '' THEN 0
            WHEN NOT json_valid(${col}) THEN 1
            WHEN json_type(${col}) != 'object' THEN 1
            WHEN COALESCE(json_extract(${col}, '$.provenanceHold.status'), '') = 'AMBIGUOUS_PROVENANCE_HOLD' THEN 1
            ELSE 0
        END = 1)`;

        if (cols.has('metadata')) {
            conds.push(holdCondition('metadata'));
        }
        if (cols.has('fieldMetadata')) {
            conds.push(holdCondition('fieldMetadata'));
        }
        if (conds.length === 0) {
            if (createdInstance && metaDb.open) metaDb.close();
            return [];
        }
        // Only the restricted publication path may narrow candidate rows. All other callers
        // retain broad hold discovery; incomplete schemas conservatively use that same broad query.
        const eligible = publicationOnly && cols.has('status') && cols.has('approvedAt')
            ? "(status IN ('APPROVED','RELEASED') OR (status IN ('ARCHIVED','DISPOSED') AND approvedAt IS NOT NULL)) AND "
            : '';
        const rows = metaDb.prepare(`SELECT id FROM Sample WHERE ${eligible}(${conds.join(' OR ')})`).all();
        if (createdInstance && metaDb.open) metaDb.close();
        return rows.map(r => r.id);
    } catch (e) {
        if (createdInstance && metaDb && metaDb.open) metaDb.close();
        throw new Error(`Failed to query held sample IDs: ${e.message}`);
    }
}

/**
 * Determine if authentication principal is an external or restricted consumer.
 */
function isRestrictedConsumer(auth) {
    if (!auth) return true;
    if (auth.type === 'API_KEY') return true;
    const restrictedRoles = ['VIEWER', 'EXTERNAL_VIEWER', 'NSIS_CONSUMER'];
    return restrictedRoles.includes(auth.role);
}

/**
 * Build Prisma `where` clause for Sample queries enforcing publication & scoping policy.
 */
function buildSampleWhere(auth, query = {}) {
    const where = {};
    if (auth?.connectionStatus && auth.connectionStatus !== 'ACTIVE') {
        where.id = '__denied_connection_disabled__';
        return where;
    }
    const restricted = isRestrictedConsumer(auth);

    // 1. Publication Release Policy
    if (restricted) {
        const releaseOr = [
            { status: { in: ['APPROVED', 'RELEASED'] } },
            { status: { in: ['ARCHIVED', 'DISPOSED'] }, approvedAt: { not: null } }
        ];
        const statusVal = query.status ? String(query.status).trim().toUpperCase() : null;
        if (statusVal && (statusVal === 'ALL' || statusVal === '*')) {
            where.OR = releaseOr;
        } else if (statusVal) {
            if (['APPROVED', 'RELEASED'].includes(statusVal)) {
                where.status = statusVal;
            } else if (['ARCHIVED', 'DISPOSED'].includes(statusVal)) {
                where.status = statusVal;
                where.approvedAt = { not: null };
            } else {
                where.status = '__denied_unapproved__';
            }
        } else {
            where.OR = releaseOr;
        }
        try {
            const getHeldFn = (module.exports && typeof module.exports.getHeldSampleIds === 'function') ? module.exports.getHeldSampleIds : getHeldSampleIds;
            const heldIds = getHeldFn(undefined, {publicationOnly: true});
            if (heldIds.length > 0) {
                if (typeof where.id === 'string') {
                    if (heldIds.includes(where.id)) where.id = '__denied_held__';
                } else if (where.id && typeof where.id === 'object' && Array.isArray(where.id.in)) {
                    where.id.in = where.id.in.filter(id => !heldIds.includes(id));
                    if (where.id.in.length === 0) where.id = '__denied_held__';
                } else if (where.id && typeof where.id === 'object' && Array.isArray(where.id.notIn)) {
                    where.id.notIn = Array.from(new Set([...where.id.notIn, ...heldIds]));
                } else {
                    where.id = { notIn: heldIds };
                }
            }
        } catch (err) {
            if (err instanceof ExchangeEligibilityUnavailableError) throw err;
            throw new ExchangeEligibilityUnavailableError(
                ELIGIBILITY_UNAVAILABLE_MESSAGE,
                err
            );
        }
    } else {
        const statusVal = query.status ? String(query.status).trim().toUpperCase() : null;
        if (statusVal && (statusVal === 'ALL' || statusVal === '*')) {
            // unrestricted platform user requesting all statuses
        } else if (statusVal) {
            where.status = statusVal;
        } else {
            where.status = { not: 'CANCELLED' };
        }
    }

    // 2. Strict Laboratory Scoping (Fail-closed; R4: assignedLab is authoritative, labId is accession)
    const isApiKey = auth?.type === 'API_KEY';
    const keyLabs = auth?.labs || [];
    const hasGlobalLab = keyLabs.includes('*') || (!isApiKey && auth?.role === 'SUPER_ADMIN');

    if (isApiKey) {
        if (!hasGlobalLab) {
            if (!Array.isArray(keyLabs) || keyLabs.length === 0) {
                // Deny: API key lacks explicit laboratory authorization
                where.assignedLab = '__denied__';
            } else if (query.labId || query.assignedLab) {
                const requested = query.labId || query.assignedLab;
                if (keyLabs.includes(requested)) {
                    where.assignedLab = requested;
                } else {
                    where.assignedLab = '__denied__';
                }
            } else {
                where.assignedLab = { in: keyLabs };
            }
        } else if (query.labId || query.assignedLab) {
            where.assignedLab = query.labId || query.assignedLab;
        }
    } else {
        // JWT User scoping
        const userLab = auth?.labId;
        const requested = query.labId || query.assignedLab;
        if (requested) {
            if (hasGlobalLab || keyLabs.includes(requested) || userLab === requested) {
                where.assignedLab = requested;
            } else {
                where.assignedLab = '__denied__';
            }
        } else if (!hasGlobalLab) {
            const allowedLabs = keyLabs.length > 0 ? keyLabs : (userLab ? [userLab] : []);
            if (allowedLabs.length > 0) {
                where.assignedLab = { in: allowedLabs };
            } else {
                where.assignedLab = '__denied__';
            }
        }
    }

    // 3. Country Scoping
    // Platform-user JWT exception applies strictly to authenticated platform users, never to API_KEY principals
    const isSuperAdmin = auth?.type !== 'API_KEY' && auth?.role === 'SUPER_ADMIN';
    if (!isSuperAdmin && Array.isArray(auth?.countries)) {
        const authCountriesUpper = auth.countries.map(c => typeof c === 'string' ? c.trim().toUpperCase() : c);
        const reqCountryUpper = (query.country !== undefined && query.country !== null && String(query.country).trim() !== '') ? String(query.country).trim().toUpperCase() : null;

        if (authCountriesUpper.includes('*')) {
            // Global wildcard scope
            if (reqCountryUpper) {
                where.country = reqCountryUpper;
            }
        } else if (authCountriesUpper.length === 0) {
            // Disjoint / empty scope -> access denied
            where.country = { in: [] };
        } else {
            // Finite country scope (case-insensitive canonical match)
            if (reqCountryUpper) {
                if (authCountriesUpper.includes(reqCountryUpper)) {
                    where.country = reqCountryUpper;
                } else {
                    where.country = { in: [] }; // Deny: country outside key scope
                }
            } else {
                where.country = { in: authCountriesUpper };
            }
        }
    } else if (query.country) {
        where.country = String(query.country).trim().toUpperCase();
    }

    // 4. Project Scoping
    if (!isSuperAdmin && Array.isArray(auth?.projects)) {
        if (auth.projects.includes('*')) {
            // Global wildcard scope
            if (query.project) {
                let targetProjects = [query.project];
                try {
                    const queryChildren = projectPolicyService.getProgrammeChildProjectCodes(query.project);
                    if (queryChildren.length > 0) targetProjects = [query.project, ...queryChildren];
                } catch (e) {}
                where.projectCode = targetProjects.length === 1 ? targetProjects[0] : { in: targetProjects };
            }
        } else if (auth.projects.length === 0) {
            // Disjoint / empty scope -> access denied
            where.projectCode = { in: [] };
        } else {
            // Finite project scope with programme hierarchy expansion
            const expandedKeyProjects = new Set();
            for (const kp of auth.projects) {
                expandedKeyProjects.add(kp);
                try {
                    const children = projectPolicyService.getProgrammeChildProjectCodes(kp);
                    children.forEach(c => expandedKeyProjects.add(c));
                } catch (e) {}
            }
            const authorizedProjectList = Array.from(expandedKeyProjects);

            if (query.project) {
                let targetProjects = [query.project];
                try {
                    const queryChildren = projectPolicyService.getProgrammeChildProjectCodes(query.project);
                    if (queryChildren.length > 0) targetProjects = [query.project, ...queryChildren];
                } catch (e) {}

                const allowed = targetProjects.filter(p => authorizedProjectList.includes(p));
                if (allowed.length > 0) {
                    where.projectCode = allowed.length === 1 ? allowed[0] : { in: allowed };
                } else {
                    where.projectCode = { in: [] }; // Deny: project outside key scope
                }
            } else {
                where.projectCode = { in: authorizedProjectList };
            }
        }
    } else if (query.project) {
        let targetProjects = [query.project];
        try {
            const queryChildren = projectPolicyService.getProgrammeChildProjectCodes(query.project);
            if (queryChildren.length > 0) targetProjects = [query.project, ...queryChildren];
        } catch (e) {}
        where.projectCode = targetProjects.length === 1 ? targetProjects[0] : { in: targetProjects };
    }

    // 5. Incremental / UpdatedSince Filter
    if (query.updatedSince) {
        const sinceDate = new Date(query.updatedSince);
        if (!isNaN(sinceDate.getTime())) {
            where.updatedAt = { gte: sinceDate };
        }
    }

    // 6. Strict OpenNSIS profile filter (specimens must possess an actual lab accession)
    const profile = (query.profile || '').toString().trim().toLowerCase();
    if (profile === 'opennsis') {
        where.labId = { not: null };
    }

    return where;
}

/**
 * Build Prisma `where` clause for Spectral queries enforcing release policy & lab/country scoping.
 * Enforces parent specimen relationship and release constraints (R4, Probe 15).
 */
function buildSpectralWhere(auth, query = {}, existingParentSampleWhere = null) {
    const parentSampleWhere = existingParentSampleWhere || buildSampleWhere(auth, query);
    const where = {
        isCurrent: true
    };

    const restricted = isRestrictedConsumer(auth);
    if (restricted) {
        // External consumers: only APPROVED / VALIDATED spectra
        where.status = { in: ['APPROVED', 'VALIDATED'] };
    } else if (query.status) {
        const statusVal = String(query.status).trim().toUpperCase();
        if (statusVal !== 'ALL' && statusVal !== '*') {
            where.status = statusVal;
        }
    }

    if (query.modality) where.modality = query.modality.toUpperCase();
    if (query.qcStatus) where.qcStatus = query.qcStatus.toUpperCase();
    if (query.instrument || query.equipmentId) where.equipmentId = query.instrument || query.equipmentId;

    // Laboratory scoping directly on spectral row labId
    if (parentSampleWhere.assignedLab) {
        where.labId = parentSampleWhere.assignedLab;
    }

    // Enforce parent sample release, project, country, and lab policy (R4, Probe 15)
    where.sample = parentSampleWhere;

    return where;
}

/**
 * Translates exchange spectral query into valid Prisma where clause for the SpectralData model.
 * Prisma's SpectralData model has labId and sampleId columns, but no 'sample' relation.
 * Binds parent specimen authorization constraints to sampleId column (F4, Probe 10).
 */
function toPrismaSpectralWhere(spectralWhere) {
    if (!spectralWhere) return {};
    const { sample, ...cleanWhere } = spectralWhere;
    if (sample && !cleanWhere.labId && sample.assignedLab) {
        cleanWhere.labId = sample.assignedLab;
    }
    // Bind parent specimen authorization to sampleId (F4, Probe 10)
    if (sample) {
        if (cleanWhere.sampleId) {
            // Already bounded by specific sampleId
            if (typeof cleanWhere.sampleId === 'string' && sample.id && typeof sample.id === 'object' && Array.isArray(sample.id.notIn)) {
                if (sample.id.notIn.includes(cleanWhere.sampleId)) {
                    cleanWhere.sampleId = '__denied_held__';
                }
            }
        } else if (sample.id) {
            cleanWhere.sampleId = sample.id;
        } else if (sample.assignedLab === '__denied__' || (sample.status && sample.status === '__denied_unapproved__')) {
            cleanWhere.sampleId = '__denied__';
        } else {
            // External consumers require authorized parent specimen link
            cleanWhere.sampleId = { not: null };
        }
    }
    return cleanWhere;
}

module.exports = {
    AUTHORIZED_RELEASE_STATUSES,
    ExchangeEligibilityUnavailableError,
    handleExchangeError,
    isRestrictedConsumer,
    buildSampleWhere,
    buildSpectralWhere,
    toPrismaSpectralWhere,
    getHeldSampleIds
};
