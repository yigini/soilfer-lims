'use strict';
const identity = require('./profileIdentityService');

function parseFieldMetadata(value) {
    if (value === '') return {};
    let parsed = value;
    if (typeof value === 'string') {
        try {parsed = JSON.parse(value);} catch {throw new identity.ProfileReferenceConflictError('INVALID_STORED_METADATA');}
    }
    if (parsed == null) return {};
    if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new identity.ProfileReferenceConflictError('INVALID_STORED_METADATA');
    return {...parsed};
}

function capture(sample, fieldMetadata, payload, {actor, source = 'INTAKE', isNew = false, recordedAt = new Date().toISOString(), authorizedNamespace = null}) {
    const field = parseFieldMetadata(fieldMetadata);
    if (Object.hasOwn(payload || {}, 'profileCompatibility')) throw new identity.ProfileReferenceConflictError('SERVER_MANAGED_COMPATIBILITY');
    if (isNew && Object.hasOwn(field, 'profileCompatibility')) throw new identity.ProfileReferenceConflictError('SERVER_MANAGED_COMPATIBILITY');
    const hasInput = Object.hasOwn(payload || {}, 'profileReference');
    if (!hasInput && !isNew) return field; // Omission never erases or reinterprets a saved source reference.
    if (sample.approvedAt || ['APPROVED', 'RELEASED', 'ARCHIVED', 'DISPOSED'].includes(sample.status)) throw new identity.ProfileReferenceConflictError('PROFILE_AMENDMENT_REQUIRED');
    const previous = !isNew && Object.hasOwn(field, 'profileReference') ? identity.validateReference(field.profileReference) : null;
    const namespace = previous?.namespace || (field.profileCompatibility ? identity.resolveProfileReference(sample, field, {},()=>({})).profileNamespace : null) || authorizedNamespace || identity.namespaceFor(sample);
    const ref = identity.captureReference(hasInput ? {profileReference: payload.profileReference} : field, {sample, actor, source, recordedAt, revision: (previous?.revision || 0) + 1, authorizedNamespace: namespace});
    if (previous && previous.code === ref.code && previous.namespace === ref.namespace && previous.relation === ref.relation) return field;
    const evidence = payload.profileSourceEvidence;
    if (evidence != null) {
        if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new identity.ProfileReferenceConflictError('INVALID_PROVENANCE');
        ref.sourcePath = evidence.column == null ? ref.sourcePath : identity.scalar(evidence.column, 512);
        ref.sourceRecordId = evidence.record == null ? null : identity.scalar(evidence.record, 512);
    }
    field.profileReference = ref;
    return field;
}

function preserveForContextChange(sample, fieldMetadata, nextContext, actor) {
    const field = parseFieldMetadata(fieldMetadata);
    if (['projectCode', 'country', 'countryName'].some(key => Object.hasOwn(nextContext, key) && nextContext[key] !== undefined && nextContext[key] !== sample[key])) {
        return identity.preserveLegacyBeforeContextChange(sample, field, parseFieldMetadata(sample.metadata), require('./sisAdapterService').extractLegacyProfileReference, {actor});
    }
    return field;
}

module.exports = {parseFieldMetadata, capture, preserveForContextChange};
async function captureConfigured(sample, fieldMetadata, payload, options, db) {
    let authorizedNamespace = null;
    if ((options.isNew || Object.hasOwn(payload || {}, 'profileReference')) && sample.projectCode && sample.assignedLab && db.koboConfig) {
        const configs = await db.koboConfig.findMany({where:{projectCode: sample.projectCode, labId: sample.assignedLab, isActive:true},select:{fieldMapping:true}});
        const namespaces = [...new Set(configs.map(config=>{
            if (!config.fieldMapping) return null;
            const mapping = JSON.parse(config.fieldMapping);
            return require('./koboProfileService').validateMapping(mapping)?.namespace || null;
        }).filter(Boolean))];
        const requested = payload.profileReference?.namespace;
        if (requested != null && namespaces.includes(identity.scalar(requested, 512))) authorizedNamespace = requested;
        else if (namespaces.length === 1) authorizedNamespace = namespaces[0];
        else if (namespaces.length > 1 && payload.profileReference?.code != null) throw new identity.ProfileReferenceConflictError('PROFILE_NAMESPACE_SELECTION_REQUIRED');
    }
    return capture(sample, fieldMetadata, payload, {...options, authorizedNamespace});
}
module.exports.captureConfigured = captureConfigured;
