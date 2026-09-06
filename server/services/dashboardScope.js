/**
 * Dashboard Scope Resolution Service
 * 
 * Provides pure scope resolution, role boundary enforcement,
 * lab-local timezone interval calculation, and safe AND query composition.
 * Complies with Section 1 of implementation-plan.md, contracts.md, and Review R2, R3.
 */
'use strict';

const prisma = require('../prisma');

function parseJsonArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val.map(String).map(s => s.trim()).filter(Boolean);
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
        } catch {
            return val.split(',').map(s => s.trim()).filter(Boolean);
        }
    }
    return [];
}

/**
 * Validate an IANA timezone string
 */
function isValidTimezone(tz) {
    if (!tz || typeof tz !== 'string') return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}

/**
 * Get half-open local day interval [dayStart, dayEnd) in the given timezone.
 */
function getLocalDayInterval(timezone = 'UTC', referenceDate = new Date()) {
    const tz = isValidTimezone(timezone) ? timezone : 'UTC';
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const localDateStr = formatter.format(referenceDate); // YYYY-MM-DD

    const getTzOffsetMs = (d, timeZone) => {
        const utcDate = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
        const tzDate = new Date(d.toLocaleString('en-US', { timeZone }));
        return utcDate.getTime() - tzDate.getTime();
    };

    const midnightUtc = new Date(`${localDateStr}T00:00:00Z`);
    const offsetMs = getTzOffsetMs(midnightUtc, tz);
    const dayStart = new Date(midnightUtc.getTime() + offsetMs);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    return {
        localDate: localDateStr,
        dayStart,
        dayEnd,
        timezone: tz,
        isUtcFallback: !isValidTimezone(timezone) || timezone === 'UTC'
    };
}

/**
 * Pure safe query condition composer.
 * Composes [authorizedScope, queueCriteria, selectedFilters] using AND,
 * ensuring top-level OR clauses from scopeGuard are never overwritten.
 */
function scopedWhere(authorizedScope, queueCriteria = {}, selectedFilters = {}) {
    if (!authorizedScope || typeof authorizedScope !== 'object') {
        throw new Error('An explicit authorized scope is required');
    }
    const clauses = [];
    if (Object.keys(authorizedScope).length > 0) clauses.push(authorizedScope);
    if (queueCriteria && Object.keys(queueCriteria).length > 0) clauses.push(queueCriteria);
    if (selectedFilters && Object.keys(selectedFilters).length > 0) clauses.push(selectedFilters);

    if (clauses.length === 0) return {};
    if (clauses.length === 1) return clauses[0];
    return { AND: clauses };
}

/**
 * Resolve the actor's scope context from session user object (req.user)
 * and optional requested filters (selectedLabId, selectedProjectId).
 */
async function resolveActorScope(user, options = {}) {
    if (!user || !user.role) {
        throw new Error('Authentication required to resolve dashboard scope');
    }

    const { selectedLabId = null, selectedProjectId = null } = options;
    const userLabId = user.labId || null;
    const userProjects = parseJsonArray(user.projects);
    const userCountries = parseJsonArray(user.countries);

    let activeLabId = userLabId;
    let labRecord = null;

    // For Super Admin or Master User, allow selecting an authorized lab
    if (selectedLabId) {
        if (user.role === 'SUPER_ADMIN') {
            activeLabId = selectedLabId;
        } else if (user.role === 'MASTER_USER') {
            activeLabId = selectedLabId;
        } else if (userLabId === selectedLabId) {
            activeLabId = selectedLabId;
        }
    }

    if (activeLabId) {
        try {
            labRecord = await prisma.lab.findUnique({
                where: { id: activeLabId },
                select: { id: true, name: true, code: true, timezone: true, country: true }
            });
        } catch {
            labRecord = null;
        }
    }

    // Determine timezone context
    let timezone = 'UTC';
    let isUtcFallback = true;
    if (labRecord?.timezone && isValidTimezone(labRecord.timezone)) {
        timezone = labRecord.timezone;
        isUtcFallback = false;
    }

    const dayInterval = getLocalDayInterval(timezone);

    let displayLabel = 'Demonstration scope';
    if (labRecord) {
        displayLabel = `${labRecord.name || labRecord.code || labRecord.id} · ${labRecord.country || 'Laboratory'}`;
    } else if (userProjects.length > 0) {
        displayLabel = `Project: ${userProjects.join(', ')}`;
    } else if (userCountries.length > 0) {
        displayLabel = `Country: ${userCountries.join(', ')}`;
    } else if (user.role === 'SUPER_ADMIN') {
        displayLabel = 'All authorized laboratories · Global administration';
    }

    return {
        role: user.role,
        username: user.username,
        userId: user.id,
        userLabId,
        activeLabId,
        labName: labRecord?.name || null,
        labCode: labRecord?.code || null,
        projects: userProjects,
        countries: userCountries,
        selectedLabId: activeLabId,
        selectedProjectId: selectedProjectId && userProjects.includes(selectedProjectId) ? selectedProjectId : (userProjects[0] || selectedProjectId || null),
        timezone,
        isUtcFallback,
        localDate: dayInterval.localDate,
        dayStart: dayInterval.dayStart,
        dayEnd: dayInterval.dayEnd,
        displayLabel
    };
}

/**
 * Build Prisma WHERE clause for Sample queries based on resolved actor scope.
 */
function buildSampleScopeWhere(scope, options = {}) {
    const { allowGlobalSearch = false } = options;

    if (scope.role === 'SUPER_ADMIN') {
        if (scope.activeLabId) {
            return {
                OR: [
                    { labId: scope.activeLabId },
                    { assignedLab: scope.activeLabId }
                ]
            };
        }
        return {}; // Global administrative view
    }

    if (['SAMPLE_RECEPTION', 'LAB_MANAGER'].includes(scope.role)) {
        if (!scope.activeLabId) return { id: '__DENIED_NO_LAB__' };

        const labMatch = {
            OR: [
                { labId: scope.activeLabId },
                { assignedLab: scope.activeLabId }
            ]
        };

        if (allowGlobalSearch) {
            const searchOr = [labMatch];
            if (scope.projects.length > 0) {
                searchOr.push({ projectCode: { in: scope.projects } });
            }
            if (scope.countries.length > 0) {
                searchOr.push({ countryName: { in: scope.countries } });
                searchOr.push({ country: { in: scope.countries } });
            }
            return { OR: searchOr };
        }

        return labMatch;
    }

    if (scope.role === 'LAB_TECHNICIAN') {
        if (!scope.activeLabId) return { id: '__DENIED_NO_LAB__' };
        return {
            AND: [
                {
                    OR: [
                        { labId: scope.activeLabId },
                        { assignedLab: scope.activeLabId }
                    ]
                },
                {
                    workItems: {
                        some: { assignedTo: scope.username }
                    }
                }
            ]
        };
    }

    if (scope.role === 'MASTER_USER') {
        if (scope.activeLabId) {
            return {
                OR: [
                    { labId: scope.activeLabId },
                    { assignedLab: scope.activeLabId }
                ]
            };
        }
        const orList = [];
        if (scope.countries.length > 0) {
            orList.push({ countryName: { in: scope.countries } });
            orList.push({ country: { in: scope.countries } });
        }
        if (scope.projects.length > 0) {
            orList.push({ projectCode: { in: scope.projects } });
        }
        return orList.length > 0 ? { OR: orList } : { id: '__DENIED_NO_GRANTS__' };
    }

    if (scope.role === 'PROJECT_MANAGER') {
        if (scope.projects.length === 0) return { id: '__DENIED_NO_PROJECTS__' };
        return { projectCode: { in: scope.projects } };
    }

    if (scope.role === 'SURVEYOR') {
        const orConditions = [];
        if (scope.projects.length > 0) {
            orConditions.push({ projectCode: { in: scope.projects } });
        }
        if (scope.username) {
            orConditions.push({ locationCapturedBy: scope.username });
        }
        return orConditions.length > 0 ? { OR: orConditions } : { id: '__DENIED_NO_SURVEY_RECORDS__' };
    }

    if (['EXTERNAL_VIEWER', 'VIEWER'].includes(scope.role)) {
        const orList = [];
        if (scope.projects.length > 0) {
            orList.push({ projectCode: { in: scope.projects } });
        }
        if (scope.activeLabId) {
            orList.push({ labId: scope.activeLabId });
            orList.push({ assignedLab: scope.activeLabId });
        }
        return orList.length > 0 ? { OR: orList } : { id: '__DENIED_RESTRICTED_VIEWER__' };
    }

    if (scope.role === 'AUDIT_USER') {
        const orList = [];
        if (scope.activeLabId) {
            orList.push({ labId: scope.activeLabId });
            orList.push({ assignedLab: scope.activeLabId });
        }
        if (scope.projects.length > 0) {
            orList.push({ projectCode: { in: scope.projects } });
        }
        if (scope.countries.length > 0) {
            orList.push({ countryName: { in: scope.countries } });
        }
        return orList.length > 0 ? { OR: orList } : { id: '__DENIED_AUDIT_NO_SCOPE__' };
    }

    return { id: '__DENIED_UNKNOWN_ROLE__' };
}

/**
 * Build Prisma WHERE clause for WorkItem queries based on resolved actor scope.
 */
function buildWorkItemScopeWhere(scope) {
    if (scope.role === 'SUPER_ADMIN') {
        if (scope.activeLabId) {
            return {
                OR: [
                    { labId: scope.activeLabId },
                    { assignedLab: scope.activeLabId }
                ]
            };
        }
        return {};
    }

    if (scope.role === 'LAB_TECHNICIAN') {
        if (!scope.activeLabId) return { id: '__DENIED_NO_LAB__' };
        return {
            AND: [
                {
                    OR: [
                        { labId: scope.activeLabId },
                        { assignedLab: scope.activeLabId }
                    ]
                },
                { assignedTo: scope.username }
            ]
        };
    }

    if (['LAB_MANAGER', 'SAMPLE_RECEPTION'].includes(scope.role)) {
        if (!scope.activeLabId) return { id: '__DENIED_NO_LAB__' };
        return {
            OR: [
                { labId: scope.activeLabId },
                { assignedLab: scope.activeLabId }
            ]
        };
    }

    if (scope.role === 'MASTER_USER') {
        if (scope.activeLabId) {
            return {
                OR: [
                    { labId: scope.activeLabId },
                    { assignedLab: scope.activeLabId }
                ]
            };
        }
        if (scope.projects.length > 0) {
            return { sample: { projectCode: { in: scope.projects } } };
        }
        return { id: '__DENIED_NO_GRANTS__' };
    }

    if (scope.role === 'PROJECT_MANAGER') {
        if (scope.projects.length === 0) return { id: '__DENIED_NO_PROJECTS__' };
        return { sample: { projectCode: { in: scope.projects } } };
    }

    return { id: '__DENIED_ROLE__' };
}

module.exports = {
    parseJsonArray,
    isValidTimezone,
    getLocalDayInterval,
    scopedWhere,
    resolveActorScope,
    buildSampleScopeWhere,
    buildWorkItemScopeWhere
};
