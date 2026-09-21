'use strict';

function parseArray(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }
    return [];
}

/**
 * Checks whether an actor can view/read a project.
 *
 * Rules:
 * - Inactive actors are denied.
 * - SUPER_ADMIN and ADMIN have global read access.
 * - MASTER_USER / COUNTRY_ADMIN can read if project is in their authorized countries or explicitly granted.
 * - PROJECT_MANAGER can read if project code or ID is in their projects list.
 * - Lab roles (LAB_MANAGER, SAMPLE_RECEPTION, LAB_TECHNICIAN, SURVEYOR) can read if their lab is the owner or a servicing member.
 * - VIEWER / EXTERNAL_VIEWER / AUDIT_USER can read within assigned lab or explicit project grant.
 */
function canReadProject(actor, project, { memberLabIds = null, labCountries = {} } = {}) {
    if (!actor || actor.isActive === false) return false;
    if (!project) return false;

    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'MASTER_USER' || role === 'COUNTRY_ADMIN') {
        const actorCountries = parseArray(actor.countries);
        if (actorCountries.length === 0) return false;

        // Check explicit user projects
        const userProjects = parseArray(actor.projects);
        if (userProjects.includes(project.code) || userProjects.includes(project.id)) {
            return true;
        }

        // Check project countries
        const projectCountries = parseArray(project.countries);
        if (projectCountries.some(c => actorCountries.includes(c))) {
            return true;
        }

        // Check owner lab country
        if (project.labId && labCountries[project.labId] && actorCountries.includes(labCountries[project.labId])) {
            return true;
        }

        // Check member lab countries
        if (Array.isArray(memberLabIds) && memberLabIds.some(lid => labCountries[lid] && actorCountries.includes(labCountries[lid]))) {
            return true;
        }

        return false;
    }

    if (role === 'PROJECT_MANAGER') {
        const userProjects = parseArray(actor.projects);
        return userProjects.includes(project.code) || userProjects.includes(project.id);
    }

    if (['LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR'].includes(role)) {
        if (!actor.labId) return false;

        if (project.labId && project.labId === actor.labId) return true;

        if (Array.isArray(memberLabIds) && memberLabIds.includes(actor.labId)) return true;

        // Check assignedLabIds JSON field
        const assigned = parseArray(project.assignedLabIds);
        if (assigned.includes(actor.labId)) return true;

        return false;
    }

    if (['AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'].includes(role)) {
        const userProjects = parseArray(actor.projects);
        if (userProjects.includes(project.code) || userProjects.includes(project.id)) return true;

        if (actor.labId) {
            if (project.labId && project.labId === actor.labId) return true;
            if (Array.isArray(memberLabIds) && memberLabIds.includes(actor.labId)) return true;
            const assigned = parseArray(project.assignedLabIds);
            if (assigned.includes(actor.labId)) return true;
        }
        return false;
    }

    return false;
}

/**
 * Checks whether an actor can edit project plan and metadata.
 */
function canEditProjectPlan(actor, project) {
    if (!actor || actor.isActive === false || !project) return false;
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'LAB_MANAGER') {
        return Boolean(actor.labId && project.labId === actor.labId);
    }

    if (role === 'PROJECT_MANAGER') {
        const userProjects = parseArray(actor.projects);
        return userProjects.includes(project.code) || userProjects.includes(project.id);
    }

    return false;
}

/**
 * Checks whether an actor can manage lab access and servicing memberships for a project.
 */
function canManageProjectAccess(actor, project) {
    if (!actor || actor.isActive === false || !project) return false;
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'LAB_MANAGER') {
        return Boolean(actor.labId && project.labId === actor.labId);
    }

    return false;
}

/**
 * Checks whether an actor can transition project lifecycle status (PAUSE, CLOSE, ARCHIVE, RESTORE).
 */
function canTransitionProject(actor, project, targetStatus) {
    if (!actor || actor.isActive === false || !project) return false;
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'LAB_MANAGER') {
        return Boolean(actor.labId && project.labId === actor.labId);
    }

    return false;
}

/**
 * Checks whether an actor can import samples into a project.
 */
function canImportProjectSamples(actor, project, targetLabId = null) {
    if (!actor || actor.isActive === false || !project) return false;
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;

    if (role === 'LAB_MANAGER' || role === 'SAMPLE_RECEPTION') {
        if (!actor.labId) return false;
        if (targetLabId && targetLabId !== actor.labId) return false;

        if (project.labId === actor.labId) return true;

        const assigned = parseArray(project.assignedLabIds);
        return assigned.includes(actor.labId);
    }

    if (role === 'PROJECT_MANAGER') {
        const userProjects = parseArray(actor.projects);
        return userProjects.includes(project.code) || userProjects.includes(project.id);
    }

    return false;
}

/**
 * Builds the scoped sample query predicate for a project and actor.
 * Guarantees that servicing lab staff only see their own lab's sample slice.
 */
function buildProjectSampleScope(actor, project, { authorizedLabIds = null } = {}) {
    const baseQuery = {
        OR: [
            { projectId: project.id },
            { projectCode: project.code }
        ]
    };

    if (!actor) return { id: '__DENIED__' };
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
        return baseQuery;
    }

    if (role === 'PROJECT_MANAGER') {
        const userProjects = parseArray(actor.projects);
        if (userProjects.includes(project.code) || userProjects.includes(project.id)) {
            return baseQuery;
        }
        return { id: '__DENIED__' };
    }

    if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(role)) {
        if (Array.isArray(authorizedLabIds) && authorizedLabIds.length > 0) {
            return {
                AND: [
                    baseQuery,
                    {
                        OR: [
                            { assignedLab: { in: authorizedLabIds } },
                            { labId: { in: authorizedLabIds } }
                        ]
                    }
                ]
            };
        }
        return { id: '__DENIED__' };
    }

    if (['LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR', 'AUDIT_USER', 'EXTERNAL_VIEWER', 'VIEWER'].includes(role)) {
        if (!actor.labId) return { id: '__DENIED__' };

        // Both owner and servicing labs see only their own lab's samples unless super-admin
        return {
            AND: [
                baseQuery,
                {
                    OR: [
                        { assignedLab: actor.labId },
                        { labId: actor.labId }
                    ]
                }
            ]
        };
    }

    return { id: '__DENIED__' };
}

const PROJECT_TEMPLATES = {
    SOILFER_V1: 'SOILFER_V1',
    GENERIC_KOBO: 'GENERIC_KOBO',
    GENERIC_OPEN_INTAKE: 'GENERIC_OPEN_INTAKE',
    GENERIC_MANIFEST: 'GENERIC_MANIFEST',
    WALK_IN: 'WALK_IN'
};

const TEMPLATE_DEFINITIONS = {
    [PROJECT_TEMPLATES.SOILFER_V1]: {
        id: PROJECT_TEMPLATES.SOILFER_V1,
        version: '1.0.0',
        allowedChannels: ['KOBO'],
        requiresExceptionForDesk: true,
        requiresExceptionForManifest: true,
        allowDirectRegistration: false
    },
    [PROJECT_TEMPLATES.GENERIC_KOBO]: {
        id: PROJECT_TEMPLATES.GENERIC_KOBO,
        version: '1.0.0',
        allowedChannels: ['KOBO'],
        requiresExceptionForDesk: true,
        requiresExceptionForManifest: false,
        allowDirectRegistration: false
    },
    [PROJECT_TEMPLATES.GENERIC_MANIFEST]: {
        id: PROJECT_TEMPLATES.GENERIC_MANIFEST,
        version: '1.0.0',
        allowedChannels: ['MANIFEST'],
        requiresExceptionForDesk: true,
        requiresExceptionForManifest: false,
        allowDirectRegistration: false
    },
    [PROJECT_TEMPLATES.GENERIC_OPEN_INTAKE]: {
        id: PROJECT_TEMPLATES.GENERIC_OPEN_INTAKE,
        version: '1.0.0',
        allowedChannels: ['DESK', 'WALK_IN', 'MANIFEST', 'KOBO'],
        requiresExceptionForDesk: false,
        requiresExceptionForManifest: false,
        allowDirectRegistration: true
    },
    [PROJECT_TEMPLATES.WALK_IN]: {
        id: PROJECT_TEMPLATES.WALK_IN,
        version: '1.0.0',
        allowedChannels: ['WALK_IN', 'DESK'],
        requiresExceptionForDesk: false,
        requiresExceptionForManifest: false,
        allowDirectRegistration: true
    }
};

const PROGRAMME_CHILD_PROJECTS = {
    'SOILFER-US': ['SOILFER-GTM', 'SOILFER-HND', 'SOILFER-GHA', 'SOILFER-KEN', 'SOILFER-ZMB'],
    'SOILFER-USA': ['SOILFER-GTM', 'SOILFER-HND', 'SOILFER-GHA', 'SOILFER-KEN', 'SOILFER-ZMB'],
    'SOILFER-JPN': ['SOILFER-MOZ', 'SOILFER-TUN']
};

function getProgrammeChildProjectCodes(programmeCode) {
    if (!programmeCode) return [];
    const codeUpper = String(programmeCode).trim().toUpperCase();
    return PROGRAMME_CHILD_PROJECTS[codeUpper] || [];
}

/**
 * Returns the effective policy configuration for a project.
 */
function getEffectivePolicy(projectOrCode) {
    const templateId = getEffectiveTemplate(projectOrCode);
    const base = TEMPLATE_DEFINITIONS[templateId] || TEMPLATE_DEFINITIONS.GENERIC_OPEN_INTAKE;
    let custom = {};
    if (projectOrCode && typeof projectOrCode === 'object' && projectOrCode.policyConfig) {
        try {
            custom = typeof projectOrCode.policyConfig === 'string'
                ? JSON.parse(projectOrCode.policyConfig)
                : projectOrCode.policyConfig;
        } catch {
            custom = {};
        }
    }
    return {
        templateId,
        templateVersion: (projectOrCode && projectOrCode.templateVersion) || base.version,
        allowedChannels: Array.isArray(custom.allowedChannels) ? custom.allowedChannels : base.allowedChannels,
        requiresExceptionForDesk: custom.requiresExceptionForDesk !== undefined ? custom.requiresExceptionForDesk : base.requiresExceptionForDesk,
        requiresExceptionForManifest: custom.requiresExceptionForManifest !== undefined ? custom.requiresExceptionForManifest : base.requiresExceptionForManifest,
        allowDirectRegistration: custom.allowDirectRegistration !== undefined ? custom.allowDirectRegistration : base.allowDirectRegistration
    };
}

/**
 * Returns the effective template ID for a project record or code.
 */
function getEffectiveTemplate(projectOrCode) {
    if (!projectOrCode) return PROJECT_TEMPLATES.GENERIC_OPEN_INTAKE;

    const canonicalSoilFerCodes = [
        'SOILFER-US', 'SOILFER-USA', 'SOILFER-JPN',
        'SOILFER-GTM', 'SOILFER-HND', 'SOILFER-GHA', 'SOILFER-KEN',
        'SOILFER-ZMB', 'SOILFER-MOZ', 'SOILFER-TUN'
    ];

    if (typeof projectOrCode === 'string') {
        const codeUpper = projectOrCode.toUpperCase().trim();
        if (canonicalSoilFerCodes.includes(codeUpper)) {
            return PROJECT_TEMPLATES.SOILFER_V1;
        }
        return PROJECT_TEMPLATES.GENERIC_OPEN_INTAKE;
    }

    const explicitTemplate = projectOrCode.templateId || projectOrCode.template;
    if (explicitTemplate && explicitTemplate !== PROJECT_TEMPLATES.GENERIC_OPEN_INTAKE && Object.values(PROJECT_TEMPLATES).includes(explicitTemplate)) {
        return explicitTemplate;
    }

    const type = (projectOrCode.projectType || '').toUpperCase().trim();
    if (type === 'SOILFER_V1' || type === 'SOILFER') return PROJECT_TEMPLATES.SOILFER_V1;
    if (type === 'KOBO_LINKED' || type === 'GENERIC_KOBO') return PROJECT_TEMPLATES.GENERIC_KOBO;
    if (type === 'TEMPLATE_PREDEFINED_IDS' || type === 'PREDEFINED_MANIFEST' || type === 'GENERIC_MANIFEST') return PROJECT_TEMPLATES.GENERIC_MANIFEST;
    if (type === 'WALK_IN') return PROJECT_TEMPLATES.WALK_IN;
    if (type === 'OPEN_INTAKE' || type === 'GENERIC_OPEN_INTAKE') return PROJECT_TEMPLATES.GENERIC_OPEN_INTAKE;

    if (explicitTemplate && Object.values(PROJECT_TEMPLATES).includes(explicitTemplate)) {
        return explicitTemplate;
    }

    // Only if projectType is completely absent / empty, check canonical legacy codes
    const code = (projectOrCode.code || projectOrCode.id || '').toUpperCase().trim();
    if (canonicalSoilFerCodes.includes(code)) {
        return PROJECT_TEMPLATES.SOILFER_V1;
    }

    return PROJECT_TEMPLATES.GENERIC_OPEN_INTAKE;
}

/**
 * Checks whether a project uses the SoilFER template.
 */
function isSoilFerTemplate(projectOrCode) {
    return getEffectiveTemplate(projectOrCode) === PROJECT_TEMPLATES.SOILFER_V1;
}

/**
 * Resolves a project identifier (id or code) to canonical id, code, and project record.
 */
async function resolveProject(idOrCode, tx = null) {
    if (!idOrCode) return null;
    const client = tx || require('../prisma');
    const str = String(idOrCode).trim();
    const proj = await client.project.findFirst({
        where: {
            OR: [
                { id: str },
                { code: str },
                { code: str.toUpperCase() }
            ]
        }
    });
    if (!proj) return null;
    return {
        id: proj.id,
        code: proj.code,
        name: proj.name,
        status: proj.status,
        templateId: proj.templateId,
        projectType: proj.projectType,
        policyConfig: proj.policyConfig,
        labId: proj.labId,
        assignedLabIds: proj.assignedLabIds,
        project: proj,
        rawProject: proj
    };
}

/**
 * Checks whether an actor has authority to authorize an admission exception.
 */
function canAuthorizeException(actor, project = null, labId = null) {
    if (!actor || actor.isActive === false) return false;
    const role = actor.role ? actor.role.trim() : '';

    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
    if (role === 'LAB_MANAGER') {
        const targetLab = labId || (project ? project.labId : null) || actor.labId;
        return Boolean(actor.labId && (actor.labId === targetLab || actor.labId === labId));
    }
    return false;
}

/**
 * Validates whether an exception is genuinely authorized by an authenticated authority
 * or a stored, validated approval bound to the operation. A client-supplied string alone is rejected.
 */
function validateExceptionAuthorization(actor, project, labId, exceptionRecord) {
    if (!actor || actor.isActive === false) {
        return { authorized: false, code: 'EXCEPTION_NOT_AUTHORIZED', reason: 'Inactive or unauthenticated actor cannot submit exceptions.' };
    }

    // If an explicit stored approval was evaluated and failed, fail closed
    if (exceptionRecord && exceptionRecord.isStoredApprovalVerified === false) {
        return {
            authorized: false,
            code: 'EXCEPTION_NOT_AUTHORIZED',
            subCode: exceptionRecord.code || 'APPROVAL_NOT_VERIFIED',
            reason: exceptionRecord.reason || 'Stored exception approval is not verified.'
        };
    }

    // 1. Direct authority: actor is manager or admin (requires explicit non-empty reason)
    if (canAuthorizeException(actor, project, labId)) {
        const reason = exceptionRecord && (typeof exceptionRecord === 'string' ? exceptionRecord : exceptionRecord.reason);
        if (!reason || String(reason).trim().length < 5) {
            return {
                authorized: false,
                code: 'APPROVAL_EMPTY_REASON',
                reason: 'Direct exception authorization requires an explicit justification reason (minimum 5 characters).'
            };
        }
        return {
            authorized: true,
            authorizedBy: actor.username || actor.id,
            authorizerRole: actor.role,
            mode: 'ACTOR_AUTHORIZED'
        };
    }

    // 2. Stored / validated approval bound to the operation
    if (exceptionRecord && exceptionRecord.isStoredApprovalVerified === true && exceptionRecord.verifiedAuthorizer) {
        return {
            authorized: true,
            authorizedBy: exceptionRecord.verifiedAuthorizer,
            mode: 'STORED_APPROVAL'
        };
    }

    // Client-supplied string or unverified claimed authorizer is strictly rejected
    return {
        authorized: false,
        code: 'EXCEPTION_NOT_AUTHORIZED',
        reason: `Actor '${actor.username || actor.role}' is not authorized to grant admission exceptions, and no validated stored approval was provided.`
    };
}

/**
 * Verifies a stored exception approval record from the database.
 * Never trusts client verification flags.
 *
 * @param {object} params
 * @param {string} params.approvalId - Stored approval ID or amendment ID
 * @param {object} [params.project] - Target Project record
 * @param {string} [params.labId] - Target Lab ID
 * @param {object} [params.prismaClient] - Prisma client or transaction
 * @returns {Promise<{ isStoredApprovalVerified: boolean, verifiedAuthorizer?: string, reason?: string, approvalRecord?: object }>}
 */
/**
 * Verifies a persisted exception approval from the database.
 * Stored approval is strictly bound to the requested operation:
 * - Target sample identity (sampleId / sampleIds)
 * - Target project (project.id / project.code)
 * - Target laboratory (labId)
 * - Explicit non-empty justification reason
 *
 * @param {object} params
 * @param {string} params.approvalId - Stored approval ID or amendment ID
 * @param {object} [params.project] - Target Project record
 * @param {string} [params.labId] - Target Lab ID
 * @param {string} [params.sampleId] - Target single sample ID
 * @param {string[]} [params.sampleIds] - Target batch sample IDs
/**
 * Verifies a persisted exception approval from the database.
 * Stored approval is strictly bound to the requested operation:
 * - Target sample identity (sampleId / sampleIds) - mandatory, never inferred from untrusted client input
 * - Target channel & purpose (amendment.type must authorize the specific admission channel; routine amendments like CLERICAL, ORDER, REPORT are rejected)
 * - Target project (bound via sample.projectId / projectCode)
 * - Target laboratory (bound via sample.assignedLab / labId)
 * - Explicit non-empty justification reason (minimum 5 characters)
 * - Authorizer role and scope on the target project/lab
 * - Bare historical audit events are rejected as admission authorizations
 *
 * @param {object} params
 * @param {string} params.approvalId - Stored approval ID or amendment ID
 * @param {object} [params.project] - Target Project record
 * @param {string} [params.labId] - Target Lab ID
 * @param {string} [params.sampleId] - Target single sample ID
 * @param {string[]} [params.sampleIds] - Target batch sample IDs
 * @param {string} [params.channel] - Admission channel ('DESK', 'MANIFEST', etc.)
 * @param {object} [params.prismaClient] - Prisma client or transaction
 * @returns {Promise<{ isStoredApprovalVerified: boolean, verifiedAuthorizer?: string, reason?: string, approvalRecord?: object, code?: string }>}
 */
async function verifyStoredExceptionApproval({
    approvalId,
    project = null,
    labId = null,
    sampleId = null,
    sampleIds = null,
    channel = null,
    prismaClient = null
}) {
    if (!approvalId) {
        return { isStoredApprovalVerified: false, code: 'MISSING_APPROVAL_ID', reason: 'No approval ID provided.' };
    }
    const client = prismaClient || require('../prisma');
    const idStr = String(approvalId).trim();

    // 1. Mandatory Target Sample Binding: Caller MUST specify authoritative target sample identity
    const hasTargetSample = Boolean(sampleId || (Array.isArray(sampleIds) && sampleIds.length > 0));
    if (!hasTargetSample) {
        return {
            isStoredApprovalVerified: false,
            code: 'TARGET_SAMPLE_REQUIRED',
            reason: 'Stored exception approval verification requires explicit authoritative target sample identity.'
        };
    }

    // 2. Mandatory Channel Binding
    if (!channel) {
        return {
            isStoredApprovalVerified: false,
            code: 'CHANNEL_REQUIRED',
            reason: 'Stored exception approval verification requires an explicit admission channel.'
        };
    }

    // Check SampleAmendment table
    try {
        if (client.sampleAmendment && typeof client.sampleAmendment.findUnique === 'function') {
            const amendment = await client.sampleAmendment.findUnique({
                where: { id: idStr },
                include: { sample: true }
            });

            if (amendment && amendment.status === 'APPROVED' && amendment.authorizedBy) {
                // Replay / Consumption check: resolved or consumed approvals cannot be replayed
                if (amendment.resolution === 'CONSUMED' || amendment.status === 'RESOLVED') {
                    return {
                        isStoredApprovalVerified: false,
                        code: 'APPROVAL_ALREADY_CONSUMED',
                        reason: `Stored approval '${idStr}' has already been consumed and cannot be replayed.`
                    };
                }

                // Expiry check: check if impactAssessment contains an expiration timestamp
                if (amendment.impactAssessment) {
                    try {
                        const assessment = typeof amendment.impactAssessment === 'string'
                            ? JSON.parse(amendment.impactAssessment)
                            : amendment.impactAssessment;
                        if (assessment?.expiresAt && new Date(assessment.expiresAt).getTime() < Date.now()) {
                            return {
                                isStoredApprovalVerified: false,
                                code: 'APPROVAL_EXPIRED',
                                reason: `Stored approval '${idStr}' expired at ${assessment.expiresAt}.`
                            };
                        }
                    } catch {
                        // Non-JSON impactAssessment
                    }
                }

                // Operation binding: Purpose / Channel Check
                const amdType = String(amendment.type || '').toUpperCase().trim();
                const routineTypes = ['CLERICAL', 'SCIENTIFIC', 'ORDER', 'REPORT'];
                if (routineTypes.includes(amdType)) {
                    return {
                        isStoredApprovalVerified: false,
                        code: 'APPROVAL_TYPE_MISMATCH',
                        reason: `Stored approval '${idStr}' is a routine '${amdType}' amendment and cannot authorize ${channel} admission exceptions.`
                    };
                }

                // Explicit persisted allowed operation/channel mapping (no substring matching)
                const CHANNEL_ALLOWED_TYPES = {
                    'DESK': ['DESK_ADMISSION_EXCEPTION', 'DIRECT_DESK_ADMISSION', 'DESK_ADMISSION', 'DESK'],
                    'MANIFEST': ['MANIFEST_ADMISSION_EXCEPTION', 'PREDEFINED_MANIFEST_EXCEPTION', 'MANIFEST_INTAKE_EXCEPTION', 'MANIFEST_ADMISSION', 'MANIFEST'],
                    'PHYSICAL_RECEIPT': ['PHYSICAL_RECEIPT_EXCEPTION', 'RECEIPT_ADMISSION_EXCEPTION', 'PHYSICAL_RECEIPT_ADMISSION', 'PHYSICAL_RECEIPT'],
                    'WALK_IN': ['WALK_IN_ADMISSION_EXCEPTION', 'WALK_IN_EXCEPTION', 'WALK_IN_ADMISSION', 'WALK_IN']
                };

                const allowedTypes = CHANNEL_ALLOWED_TYPES[channel] || [];
                let isChannelMatch = allowedTypes.includes(amdType);

                // If impactAssessment contains structured channel/operation scope, enforce it strictly
                if (amendment.impactAssessment) {
                    try {
                        const assessment = typeof amendment.impactAssessment === 'string'
                            ? JSON.parse(amendment.impactAssessment)
                            : amendment.impactAssessment;
                        if (assessment?.allowedChannel) {
                            isChannelMatch = assessment.allowedChannel === channel;
                        } else if (Array.isArray(assessment?.allowedChannels)) {
                            isChannelMatch = assessment.allowedChannels.includes(channel);
                        }
                    } catch {
                        // Non-JSON
                    }
                }

                if (!isChannelMatch) {
                    return {
                        isStoredApprovalVerified: false,
                        code: 'APPROVAL_CHANNEL_MISMATCH',
                        reason: `Stored approval '${idStr}' type '${amdType}' does not authorize ${channel} admission exceptions.`
                    };
                }

                // Operation binding: Resolve Sample Relation
                let linkedSample = amendment.sample;
                if (!linkedSample && amendment.sampleId && client.sample && typeof client.sample.findUnique === 'function') {
                    linkedSample = await client.sample.findUnique({
                        where: { id: amendment.sampleId }
                    });
                }

                // Operation binding: Target Sample Binding
                if (sampleId && amendment.sampleId !== sampleId) {
                    return {
                        isStoredApprovalVerified: false,
                        code: 'APPROVAL_SAMPLE_MISMATCH',
                        reason: `Stored approval '${idStr}' is bound to sample '${amendment.sampleId}', not requested sample '${sampleId}'.`
                    };
                }
                if (Array.isArray(sampleIds) && sampleIds.length > 0) {
                    // Every batch member must be authorized
                    const isAllMatching = sampleIds.every(sId => sId === amendment.sampleId);
                    if (!isAllMatching) {
                        return {
                            isStoredApprovalVerified: false,
                            code: 'APPROVAL_BATCH_NOT_COVERED',
                            reason: `Stored approval '${idStr}' only covers sample '${amendment.sampleId}'. Every member in requested batch must have verified authorization.`
                        };
                    }
                }

                // Resolve bound project & lab from the actual linked sample
                const boundProjectId = linkedSample?.projectId || linkedSample?.projectCode || amendment.projectId || amendment.projectCode || null;
                const boundProjectCode = linkedSample?.projectCode || linkedSample?.projectId || amendment.projectCode || amendment.projectId || null;
                const boundLabId = linkedSample?.assignedLab || linkedSample?.labId || amendment.labId || null;

                // Operation binding: Target Project Binding
                if (project && (project.id || project.code)) {
                    const targetProjId = project.id || project.code;
                    const targetProjCode = project.code || project.id;
                    if (!boundProjectId && !boundProjectCode) {
                        return {
                            isStoredApprovalVerified: false,
                            code: 'APPROVAL_PROJECT_MISMATCH',
                            reason: `Stored approval '${idStr}' sample is not associated with project '${targetProjCode}'.`
                        };
                    }
                    const isProjectMatch = (boundProjectId === targetProjId || boundProjectId === targetProjCode ||
                                            boundProjectCode === targetProjCode || boundProjectCode === targetProjId);
                    if (!isProjectMatch) {
                        return {
                            isStoredApprovalVerified: false,
                            code: 'APPROVAL_PROJECT_MISMATCH',
                            reason: `Stored approval '${idStr}' is bound to project '${boundProjectCode || boundProjectId}', not requested project '${targetProjCode}'.`
                        };
                    }
                }

                // Operation binding: Target Lab Binding
                if (labId) {
                    if (!boundLabId) {
                        return {
                            isStoredApprovalVerified: false,
                            code: 'APPROVAL_LAB_MISMATCH',
                            reason: `Stored approval '${idStr}' sample is not associated with lab '${labId}'.`
                        };
                    }
                    if (boundLabId !== labId) {
                        return {
                            isStoredApprovalVerified: false,
                            code: 'APPROVAL_LAB_MISMATCH',
                            reason: `Stored approval '${idStr}' is bound to lab '${boundLabId}', not requested lab '${labId}'.`
                        };
                    }
                }

                // Operation binding: Explicit documented reason
                const effectiveReason = String(amendment.reason || '').trim();
                if (!effectiveReason || effectiveReason.length < 5) {
                    return {
                        isStoredApprovalVerified: false,
                        code: 'APPROVAL_EMPTY_REASON',
                        reason: `Stored approval '${idStr}' lacks an explicit documented reason (minimum 5 characters required).`
                    };
                }

                // Operation binding: Verify authorizer user's role and lab scope
                const authorizerUser = await client.user.findUnique({
                    where: { username: amendment.authorizedBy }
                });
                if (!authorizerUser || !canAuthorizeException(authorizerUser, project, labId)) {
                    return {
                        isStoredApprovalVerified: false,
                        code: 'AUTHORIZER_UNAUTHORIZED',
                        reason: `Authorizer '${amendment.authorizedBy}' lacks manager/admin authority on target project/lab.`
                    };
                }

                return {
                    isStoredApprovalVerified: true,
                    verifiedAuthorizer: amendment.authorizedBy,
                    reason: effectiveReason,
                    approvalRecord: amendment
                };
            }
        }
    } catch (e) {
        // Fall through
    }

    return {
        isStoredApprovalVerified: false,
        code: 'APPROVAL_NOT_FOUND',
        reason: `Stored approval '${idStr}' not found, not in APPROVED status, or does not match requested operation.`
    };
}

/**
 * Resolves and sanitizes exception records at the HTTP trust boundary.
 * Client-supplied boolean flags (such as isStoredApprovalVerified) are strictly stripped.
 * Never infers consent from an empty exception object or client-supplied sampleId.
 */
async function resolveAndVerifyExceptionRecord({
    rawExceptionRecord,
    rawExceptionReason,
    authorizer,
    approvalId,
    actor,
    project,
    labId,
    sampleId = null,
    sampleIds = null,
    channel = null,
    prismaClient = null
}) {
    const hasExceptionClaim = Boolean(rawExceptionRecord || rawExceptionReason || approvalId);
    if (!hasExceptionClaim) {
        return { hasException: false, exceptionRecord: null };
    }

    // 1. Stored approval: verify against persisted DB record with strict operation binding
    const effectiveApprovalId = (rawExceptionRecord && (rawExceptionRecord.approvalId || rawExceptionRecord.amendmentId)) || approvalId || null;
    if (effectiveApprovalId) {
        // Authoritative target sample binding: NEVER fall back to rawExceptionRecord.sampleId!
        const verification = await verifyStoredExceptionApproval({
            approvalId: effectiveApprovalId,
            project,
            labId,
            sampleId: sampleId || null,
            sampleIds: sampleIds || null,
            channel,
            prismaClient
        });
        if (verification.isStoredApprovalVerified) {
            return {
                hasException: true,
                exceptionRecord: {
                    reason: verification.reason,
                    isStoredApprovalVerified: true,
                    verifiedAuthorizer: verification.verifiedAuthorizer,
                    approvalId: effectiveApprovalId,
                    mode: 'STORED_APPROVAL',
                    approvalRecord: verification.approvalRecord
                }
            };
        }

        return {
            hasException: true,
            exceptionRecord: {
                reason: verification.reason || (rawExceptionRecord && rawExceptionRecord.reason) || rawExceptionReason || '',
                isStoredApprovalVerified: false,
                code: verification.code || 'APPROVAL_NOT_VERIFIED',
                mode: 'REJECTED_STORED_APPROVAL'
            }
        };
    }

    // 2. Direct authority: actor is manager or admin (requires explicit non-empty reason)
    if (canAuthorizeException(actor, project, labId)) {
        const directReason = String((rawExceptionRecord && rawExceptionRecord.reason) || rawExceptionReason || '').trim();
        if (!directReason || directReason.length < 5) {
            return {
                hasException: true,
                exceptionRecord: {
                    reason: directReason,
                    isStoredApprovalVerified: false,
                    code: 'APPROVAL_EMPTY_REASON',
                    mode: 'REJECTED_EMPTY_REASON'
                }
            };
        }
        return {
            hasException: true,
            exceptionRecord: {
                reason: directReason,
                isStoredApprovalVerified: true,
                verifiedAuthorizer: actor.username || actor.id,
                mode: 'ACTOR_AUTHORIZED'
            }
        };
    }

    // 3. Client supplied isStoredApprovalVerified or authorizer without database verification: STRIP and mark unverified!
    const fallbackReason = String((rawExceptionRecord && rawExceptionRecord.reason) || rawExceptionReason || '').trim();
    return {
        hasException: true,
        exceptionRecord: {
            reason: fallbackReason,
            isStoredApprovalVerified: false,
            code: 'UNVERIFIED_CLAIM',
            claimedAuthorizer: authorizer || (rawExceptionRecord && (rawExceptionRecord.verifiedAuthorizer || rawExceptionRecord.claimedAuthorizer)) || null,
            mode: 'UNVERIFIED'
        }
    };
}

/**
 * Evaluates whether a sample can be admitted to a project through the requested channel.
 *
 * @param {object} params
 * @param {object} params.project - Project record
 * @param {string} params.channel - Channel: 'KOBO', 'DESK', 'MANUAL', 'CSV', 'MANIFEST', 'WALK_IN', 'PHYSICAL_RECEIPT'
 * @param {object} params.actor - Authenticated user
 * @param {string} [params.labId] - Target laboratory ID
 * @param {boolean} [params.hasException] - Whether an exception was claimed
 * @param {object} [params.exceptionRecord] - Exception details { reason, authorizer, approvedAt }
 * @returns {{ allowed: boolean, reason?: string, code?: string, exceptionRequired?: boolean }}
 */
function canAdmitSample({ project, channel = 'DESK', actor, labId = null, hasException = false, exceptionRecord = null }) {
    // Projectless walk-in work is always permitted in an authorized lab
    if (!project) {
        return { allowed: true };
    }

    const status = (project.status || 'ACTIVE').toUpperCase().trim();

    // 1. Lifecycle checks
    if (['CLOSED', 'ARCHIVED', 'CANCELLED', 'DELETED', 'COMPLETED'].includes(status)) {
        return {
            allowed: false,
            code: 'PROJECT_CLOSED',
            reason: `Admissions for project ${project.code || project.id} are ${status.toLowerCase()}. Sample admission blocked.`
        };
    }

    if (status === 'PAUSED') {
        return {
            allowed: false,
            code: 'PROJECT_PAUSED',
            reason: `Admissions for project ${project.code || project.id} are temporarily paused.`
        };
    }

    if (['DRAFT', 'PENDING_MANIFEST'].includes(status)) {
        if (channel === 'MANIFEST') {
            return { allowed: true }; // Manifest upload allowed for draft staging
        }
        return {
            allowed: false,
            code: 'PROJECT_INACTIVE',
            reason: `Project ${project.code || project.id} is in ${status.toLowerCase()} status. Activate project before sample intake or physical receipt.`
        };
    }

    // 2. Physical receipt of an already-registered sample (lifecycle check passed)
    if (channel === 'PHYSICAL_RECEIPT') {
        return { allowed: true };
    }

    // 3. Channel policy checks based on effective policy
    const policy = getEffectivePolicy(project);

    if (policy.allowedChannels.includes(channel)) {
        return { allowed: true };
    }

    const requiresException = (channel === 'DESK' && policy.requiresExceptionForDesk) ||
                              (channel === 'MANIFEST' && policy.requiresExceptionForManifest) ||
                              (!policy.allowedChannels.includes(channel));

    if (requiresException) {
        if (hasException) {
            const reason = exceptionRecord && (typeof exceptionRecord === 'string' ? exceptionRecord : exceptionRecord.reason);
            const trimmedReason = String(reason || '').trim();
            if (!trimmedReason || trimmedReason.length < 5) {
                return {
                    allowed: false,
                    exceptionRequired: true,
                    code: 'EXCEPTION_REASON_REQUIRED',
                    reason: `An explicit justification reason (minimum 5 characters) is required for ${channel} exception intake on project '${project.code}'.`
                };
            }

            const authCheck = validateExceptionAuthorization(actor, project, labId, exceptionRecord);
            if (!authCheck.authorized) {
                return {
                    allowed: false,
                    exceptionRequired: true,
                    code: authCheck.code || 'EXCEPTION_NOT_AUTHORIZED',
                    reason: authCheck.reason
                };
            }

            return { allowed: true, isException: true, authorizedBy: authCheck.authorizedBy };
        }

        const errCode = policy.templateId === PROJECT_TEMPLATES.GENERIC_KOBO
            ? 'KOBO_REQUIRED'
            : (policy.templateId === PROJECT_TEMPLATES.GENERIC_MANIFEST ? 'MANIFEST_REQUIRED' : 'EXCEPTION_REQUIRED');

        return {
            allowed: false,
            exceptionRequired: true,
            code: errCode,
            reason: `Project '${project.code}' requires ${policy.allowedChannels.join(' or ')} registration. ${channel} registration requires an authorized exception record.`
        };
    }

    return { allowed: true };
}

/**
 * Returns exact capabilities object for an actor on a project.
 */
function getProjectCapabilities(actor, project, { memberLabIds = null, labCountries = {} } = {}) {
    if (!actor || actor.isActive === false || !project) {
        return {
            canRead: false,
            canEditPlan: false,
            canManageAccess: false,
            canManageConnections: false,
            canTransition: false,
            canImport: false,
            canAuthorizeException: false
        };
    }

    const role = actor.role ? actor.role.trim() : '';
    const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
    const isOwnerManager = role === 'LAB_MANAGER' && Boolean(actor.labId && project.labId === actor.labId);
    const isServicingManager = role === 'LAB_MANAGER' && Boolean(actor.labId && (
        (Array.isArray(memberLabIds) && memberLabIds.includes(actor.labId)) ||
        parseArray(project.assignedLabIds).includes(actor.labId)
    ));

    return {
        canRead: canReadProject(actor, project, { memberLabIds, labCountries }),
        canEditPlan: canEditProjectPlan(actor, project),
        canManageAccess: canManageProjectAccess(actor, project),
        canManageConnections: isAdmin || isOwnerManager || isServicingManager,
        canTransition: canTransitionProject(actor, project),
        canImport: canImportProjectSamples(actor, project),
        canAuthorizeException: canAuthorizeException(actor, project)
    };
}

module.exports = {
    parseArray,
    canReadProject,
    canAccessProject: canReadProject,
    canEditProjectPlan,
    canEditProject: canEditProjectPlan,
    canManageProjectAccess,
    canTransitionProject,
    canImportProjectSamples,
    buildProjectSampleScope,
    PROJECT_TEMPLATES,
    TEMPLATE_DEFINITIONS,
    getEffectivePolicy,
    getEffectiveTemplate,
    isSoilFerTemplate,
    getProgrammeChildProjectCodes,
    resolveProject,
    canAuthorizeException,
    verifyStoredExceptionApproval,
    resolveAndVerifyExceptionRecord,
    canAdmitSample,
    getProjectCapabilities
};
