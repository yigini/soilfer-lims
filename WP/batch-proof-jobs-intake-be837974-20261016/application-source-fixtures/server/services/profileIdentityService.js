'use strict';

// Pure provenance rules: no permissions, database initialization or analytical status changes.
const SCHEMA_VERSION = '2026-10-issue140-v1';
const RELATIONS = new Set(['SITE_POINT','COMPOSITE','CONFIRMED_PROFILE','UNSPECIFIED']);
const PIT_KEYS = ['pit_id','pitId','profile_id','profileId','profile_code','profileCode'];
const SITE_KEYS = ['site_id','siteId','plot_id','plotId'];
const IDENTITY_KEYS = new Set([...PIT_KEYS,...SITE_KEYS,'profileReference','profileCompatibility','profileConfirmed','isConfirmedProfile','isComposite','composite','compositeRadiusM','profileNamespace','profile_namespace']);

class ProfileReferenceConflictError extends Error {
    constructor(reason = 'INVALID_REFERENCE') {
        super('The soil profile reference needs review. Existing laboratory work is preserved.');
        this.name = 'ProfileReferenceConflictError';
        this.code = 'PROFILE_REFERENCE_CONFLICT';
        this.status = 409;
        this.reason = reason;
    }
}
function unwrap(value, depth = 0) {
    if (depth > 8) throw new ProfileReferenceConflictError('INVALID_SCALAR');
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const key of ['value','raw','val']) if (Object.hasOwn(value,key)) return unwrap(value[key],depth+1);
    }
    return value;
}
function scalar(value, max = 255, optional = false) {
    value = unwrap(value);
    if (value == null || (typeof value === 'string' && !value.trim())) {
        if (optional) return null;
        throw new ProfileReferenceConflictError('MISSING_CODE');
    }
    if (!['string','number'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) throw new ProfileReferenceConflictError('INVALID_SCALAR');
    const result = String(value).trim();
    if (result.length > max || /[\u0000-\u001f\u007f]/.test(result) || result === '[object Object]') throw new ProfileReferenceConflictError('INVALID_SCALAR');
    return result;
}
function parseBoolean(value) {
    value = unwrap(value);
    if (value == null || value === '') return false;
    if ([true,1,'1'].includes(value)) return true;
    if ([false,0,'0'].includes(value)) return false;
    if (typeof value === 'string') {
        if (['true','yes'].includes(value.trim().toLowerCase())) return true;
        if (['false','no'].includes(value.trim().toLowerCase())) return false;
    }
    throw new ProfileReferenceConflictError('INVALID_FLAG');
}
function namespaceFor(sample) {
    const country = scalar(sample.country || sample.countryName,255,true);
    const project = scalar(sample.projectCode,255,true);
    if (country && project) return project.toUpperCase().includes(country.toUpperCase()) ? project : `${country}:${project}`;
    return project || (country ? `SOILFER-${country}` : 'SOILFER-GLOBAL');
}
function uniqueAlias(objects, keys) {
    const found = [];
    for (const [source,obj] of objects) for (const key of keys) if (Object.hasOwn(obj || {},key)) {
        const code = scalar(obj[key],255,true);
        if (code !== null) found.push({code,path:`${source}.${key}`});
    }
    if (new Set(found.map(x=>x.code)).size > 1) throw new ProfileReferenceConflictError('CONFLICTING_PROFILE_ALIASES');
    return found[0] || null;
}
function validateReference(ref) {
    if (!ref || typeof ref !== 'object' || Array.isArray(ref) || ref.schemaVersion !== SCHEMA_VERSION || !Object.hasOwn(ref,'code') || !Object.hasOwn(ref,'namespace')) throw new ProfileReferenceConflictError();
    if (!Number.isSafeInteger(ref.revision) || ref.revision < 1 || typeof ref.recordedAt !== 'string' || !Number.isFinite(Date.parse(ref.recordedAt))) throw new ProfileReferenceConflictError('INVALID_PROVENANCE');
    const code = scalar(ref.code,255,true), namespace = scalar(ref.namespace,512,true);
    if (!RELATIONS.has(ref.relation) || typeof ref.source !== 'string' || !scalar(ref.source,100,true)) throw new ProfileReferenceConflictError('INVALID_PROVENANCE');
    if (ref.code === null) {
        if (ref.namespace !== null || ref.relation !== 'UNSPECIFIED' || ref.key != null || ref.isUnknown === false) throw new ProfileReferenceConflictError('INVALID_UNKNOWN');
    } else if (!code || !namespace || ref.isUnknown === true || (ref.key !== undefined && ref.key !== `${namespace}:${code}`)) throw new ProfileReferenceConflictError();
    for (const key of ['sourcePath','sourceRecordId','recordedBy']) if (ref[key] != null) scalar(ref[key],key === 'recordedBy' ? 100 : 512);
    return {...ref,code,namespace,key:code === null ? null : `${namespace}:${code}`};
}
function output(ref,state) {
    return {profileCode:ref.code,profileNamespace:ref.namespace,profileKey:ref.key,profileRelation:ref.relation,state};
}
function resolveProfileReference(sample,field,meta,legacy) {
    if (Object.hasOwn(field || {},'profileReference')) {
        const ref = validateReference(field.profileReference);
        return output(ref,ref.code === null ? 'UNKNOWN' : 'CANONICAL');
    }
    if (Object.hasOwn(field || {},'profileCompatibility')) {
        const ref = field.profileCompatibility;
        if (!ref || ref.schemaVersion !== SCHEMA_VERSION || ref.kind !== 'EXACT_LEGACY_PRESERVATION') throw new ProfileReferenceConflictError('INVALID_COMPATIBILITY_REFERENCE');
        const code = scalar(ref.code,255,true), namespace = scalar(ref.namespace,512,true);
        if ((code && (!namespace || ref.key !== `${namespace}:${code}`)) || (!code && ref.key !== null) || !RELATIONS.has(ref.relation)) throw new ProfileReferenceConflictError('INVALID_COMPATIBILITY_REFERENCE');
        return output({code,namespace,key:ref.key,relation:ref.relation},'LEGACY_PRESERVED');
    }
    return {...legacy(sample,field,meta),state:'ABSENT'};
}
function captureReference(input,context) {
    const {sample,actor,source='MANUAL',sourceRecordId=null,recordedAt=new Date().toISOString(),revision=1,authorizedNamespace=namespaceFor(sample)} = context;
    let candidate,relation = 'UNSPECIFIED';
    if (Object.hasOwn(input,'profileReference')) {
        const ref = input.profileReference;
        if (!ref || typeof ref !== 'object' || Array.isArray(ref) || !Object.hasOwn(ref,'code')) throw new ProfileReferenceConflictError();
        candidate = {code:scalar(ref.code,255,true),path:'profileReference.code'};
        if (ref.code !== null && candidate.code === null) throw new ProfileReferenceConflictError('INVALID_UNKNOWN');
        relation = ref.relation || (candidate.code === null ? 'UNSPECIFIED' : 'SITE_POINT');
        if (ref.namespace != null && scalar(ref.namespace,512) !== authorizedNamespace) throw new ProfileReferenceConflictError('UNAUTHORIZED_NAMESPACE');
        const explicit = uniqueAlias([['input',input]],PIT_KEYS);
        if (explicit && explicit.code !== candidate.code) throw new ProfileReferenceConflictError('CONFLICTING_PROFILE_ALIASES');
    } else {
        const pit = uniqueAlias([['input',input]],PIT_KEYS), site = uniqueAlias([['input',input]],SITE_KEYS);
        candidate = pit || site || {code:null,path:null};
        if (candidate.code !== null) relation = parseBoolean(input.isComposite) || parseBoolean(input.composite) ? 'COMPOSITE' : pit && (parseBoolean(input.profileConfirmed) || parseBoolean(input.isConfirmedProfile)) ? 'CONFIRMED_PROFILE' : 'SITE_POINT';
    }
    if (!RELATIONS.has(relation) || (candidate.code === null && relation !== 'UNSPECIFIED')) throw new ProfileReferenceConflictError('INVALID_RELATION');
    return validateReference({schemaVersion:SCHEMA_VERSION,code:candidate.code,namespace:candidate.code === null ? null : scalar(authorizedNamespace,512),relation,source,sourcePath:candidate.path,sourceRecordId:sourceRecordId == null ? null : scalar(sourceRecordId,512),recordedAt,recordedBy:actor || null,revision});
}
function preserveLegacyBeforeContextChange(sample,field,meta,legacy,{actor,recordedAt=new Date().toISOString()}) {
    if (Object.hasOwn(field,'profileReference') || Object.hasOwn(field,'profileCompatibility')) {
        resolveProfileReference(sample,field,meta,legacy);
        return field;
    }
    const old = legacy(sample,field,meta),code = scalar(old.profileCode,255,true);
    return {...field,profileCompatibility:{schemaVersion:SCHEMA_VERSION,kind:'EXACT_LEGACY_PRESERVATION',code,namespace:old.profileNamespace,key:old.profileKey,relation:old.profileRelation,recordedAt,recordedBy:actor}};
}
module.exports = {SCHEMA_VERSION,PIT_KEYS,SITE_KEYS,IDENTITY_KEYS,ProfileReferenceConflictError,scalar,parseBoolean,namespaceFor,validateReference,resolveProfileReference,captureReference,preserveLegacyBeforeContextChange};
