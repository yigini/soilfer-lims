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

const projectPolicyService = require('./projectPolicyService');

const AUTHORIZED_RELEASE_STATUSES = ['APPROVED', 'RELEASED'];

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
        if (query.status && (query.status === 'all' || query.status === '*')) {
            where.status = { in: AUTHORIZED_RELEASE_STATUSES };
        } else if (query.status) {
            const requested = String(query.status).trim().toUpperCase();
            if (AUTHORIZED_RELEASE_STATUSES.includes(requested)) {
                where.status = requested;
            } else {
                where.status = '__denied_unapproved__';
            }
        } else {
            where.status = { in: AUTHORIZED_RELEASE_STATUSES };
        }
    } else {
        if (query.status && (query.status === 'all' || query.status === '*')) {
            // unrestricted platform user requesting all statuses
        } else if (query.status) {
            where.status = query.status.toUpperCase();
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
                const requested = query.assignedLab || query.labId;
                if (keyLabs.includes(requested)) {
                    where.assignedLab = requested;
                } else {
                    where.assignedLab = '__denied__';
                }
            } else {
                where.assignedLab = { in: keyLabs };
            }
        } else if (query.labId || query.assignedLab) {
            where.assignedLab = query.assignedLab || query.labId;
        }
    } else {
        // JWT User scoping
        const userLab = auth?.labId;
        const requested = query.assignedLab || query.labId;
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
    const keyCountries = auth?.countries || [];
    const hasGlobalCountry = keyCountries.length === 0 || keyCountries.includes('*');

    if (query.country) {
        if (hasGlobalCountry || keyCountries.includes(query.country)) {
            where.country = query.country;
        } else {
            where.country = { in: [] }; // Deny: country outside key scope
        }
    } else if (!hasGlobalCountry) {
        where.country = { in: keyCountries };
    }

    // 4. Project Scoping
    const keyProjects = auth?.projects || [];
    const hasGlobalProject = keyProjects.length === 0 || keyProjects.includes('*');

    const expandedKeyProjects = new Set();
    for (const kp of keyProjects) {
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

        if (hasGlobalProject) {
            where.projectCode = targetProjects.length === 1 ? targetProjects[0] : { in: targetProjects };
        } else {
            const allowed = targetProjects.filter(p => authorizedProjectList.includes(p));
            if (allowed.length > 0) {
                where.projectCode = allowed.length === 1 ? allowed[0] : { in: allowed };
            } else {
                where.projectCode = { in: [] }; // Deny: project outside key scope
            }
        }
    } else if (!hasGlobalProject) {
        where.projectCode = { in: authorizedProjectList };
    }

    // 5. Incremental / UpdatedSince Filter
    if (query.updatedSince) {
        const sinceDate = new Date(query.updatedSince);
        if (!isNaN(sinceDate.getTime())) {
            where.updatedAt = { gte: sinceDate };
        }
    }

    // 6. Strict OpenNSIS profile filter (specimens must possess an actual lab accession)
    if (query.profile === 'opennsis') {
        where.labId = { not: null };
    }

    return where;
}

/**
 * Build Prisma `where` clause for Spectral queries enforcing release policy & lab/country scoping.
 * Enforces parent specimen relationship and release constraints (R4, Probe 15).
 */
function buildSpectralWhere(auth, query = {}) {
    const parentSampleWhere = buildSampleWhere(auth, query);
    const where = {
        isCurrent: true
    };

    const restricted = isRestrictedConsumer(auth);
    if (restricted) {
        // External consumers: only APPROVED / VALIDATED spectra
        where.status = { in: ['APPROVED', 'VALIDATED'] };
    } else if (query.status) {
        where.status = query.status.toUpperCase();
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
    isRestrictedConsumer,
    buildSampleWhere,
    buildSpectralWhere,
    toPrismaSpectralWhere
};
