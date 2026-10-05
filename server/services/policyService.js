const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { registry, PRESETS, clone, definition, strict, valid } = require('../config/policyRegistry');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');

function error(statusCode, code, message) { return Object.assign(new Error(message), { statusCode, code }); }
function getStrict(name) { return strict(name); }
function getStrictNumberFormat() { return { decimal: strict('numbers.decimalSeparator'), thousands: strict('numbers.thousandsSeparator') }; }
async function resolveLab(reference, db = require('../prisma')) {
    if (!reference) return null;
    return await db.lab.findUnique({ where: { id: reference } }) || await db.lab.findUnique({ where: { code: reference } });
}
function loadProfile(context = {}) {
    const name = process.env.DEPLOYMENT_PROFILE || 'soilfer';
    let data = context.profile;
    if (data === undefined) {
        if (!/^[A-Za-z0-9_-]+$/.test(name)) throw error(409, 'POLICY_PROFILE_INVALID', 'Invalid deployment profile name.');
        const filename = path.resolve(__dirname, '../../profiles', name, 'policy.json');
        if (!fs.existsSync(filename)) return { name, configured: false, preset: null, overrides: {} };
        try { data = JSON.parse(fs.readFileSync(filename, 'utf8')); }
        catch (_) { throw error(409, 'POLICY_PROFILE_INVALID', 'Deployment policy must be valid JSON.'); }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => !['preset', 'overrides'].includes(k)) ||
        (data.preset != null && !PRESETS.includes(data.preset)) || (data.overrides != null && (typeof data.overrides !== 'object' || Array.isArray(data.overrides)))) {
        throw error(409, 'POLICY_PROFILE_INVALID', 'Invalid deployment policy.');
    }
    for (const [key, value] of Object.entries(data.overrides || {})) {
        try { if (!valid(key, value)) throw new Error('Invalid value'); }
        catch (_) { throw error(409, 'POLICY_PROFILE_INVALID', `Invalid deployment policy: ${key}.`); }
    }
    const effective = Object.fromEntries(Object.keys(registry).map(key => [key, data.overrides && Object.hasOwn(data.overrides, key)
        ? data.overrides[key] : registry[key].presets[data.preset || 'ISO17025_STRICT']]));
    validatePairs(effective, 409, 'POLICY_PROFILE_INVALID');
    return { name, configured: true, preset: data.preset || null, overrides: data.overrides || {} };
}
async function state(reference, context = {}) {
    const db = context.db || require('../prisma');
    // Standalone readers freeze the version and its overrides together. Write
    // paths supply their existing transaction so they see the same decision.
    if (!context.db) return db.$transaction(tx => state(reference, { ...context, db: tx }));
    const lab = await resolveLab(reference, db);
    const [policy, overrides] = lab ? await Promise.all([
        db.labPolicy.findUnique({ where: { labId: lab.id } }),
        db.labPolicyOverride.findMany({ where: { labId: lab.id, revokedAt: null }, orderBy: { setAt: 'asc' } })
    ]) : [null, []];
    return { lab, policy, overrides, profile: loadProfile(context) };
}
function resolvedFromState(current, key, context = {}) {
    const d = definition(key), version = current.policy?.version || 0;
    const analysisCode = context.analysisCode || null, methodologyId = context.methodologyId || null;
    const candidates = d.scope === 'LAB+METHOD' ? [
        ...(analysisCode && methodologyId ? [[analysisCode, methodologyId, 'METHOD_OVERRIDE']] : []),
        ...(analysisCode ? [[analysisCode, null, 'ANALYSIS_OVERRIDE']] : []), [null, null, 'LAB_OVERRIDE']
    ] : [
        ...(d.analysisOverrides?.includes(analysisCode) ? [[analysisCode, null, 'ANALYSIS_OVERRIDE']] : []),
        [null, null, 'LAB_OVERRIDE']
    ];
    for (const [analysis, method, source] of candidates) {
        const rows = current.overrides.filter(row => row.key === key && (row.analysisCode || null) === analysis && (row.methodologyId || null) === method);
        if (rows.length > 1) throw error(409, 'POLICY_SCOPE_CONFLICT', 'Multiple current overrides exist for the same policy scope.');
        if (rows.length) {
            let value;
            try { value = JSON.parse(rows[0].value); }
            catch (_) { throw error(409, key.startsWith('numbers.') ? 'NUMBER_FORMAT_POLICY_INVALID' : 'POLICY_STORED_VALUE_INVALID', 'Invalid stored policy JSON.'); }
            if (!valid(key, value)) throw error(409, key.startsWith('numbers.') ? 'NUMBER_FORMAT_POLICY_INVALID' : 'POLICY_STORED_VALUE_INVALID', 'Invalid stored policy value.');
            return { value: clone(value), source, scope: { analysisCode: analysis, methodologyId: method }, version, overrideId: rows[0].id };
        }
    }
    const preset = current.policy?.presetCode;
    if (preset) {
        if (!PRESETS.includes(preset)) throw error(409, 'POLICY_STORED_VALUE_INVALID', 'Invalid stored lab preset.');
        return { value: clone(d.presets[preset]), source: 'LAB_PRESET', presetCode: preset, scope: null, version };
    }
    if (Object.hasOwn(current.profile.overrides, key)) return {
        value: clone(current.profile.overrides[key]), source: 'PROFILE_OVERRIDE', profile: current.profile.name, scope: null, version
    };
    if (current.profile.preset) return {
        value: clone(d.presets[current.profile.preset]), source: 'PROFILE_PRESET', profile: current.profile.name,
        presetCode: current.profile.preset, scope: null, version
    };
    return { value: strict(key), source: 'REGISTRY_DEFAULT', presetCode: 'ISO17025_STRICT', scope: null, version };
}
function snapshotFromState(current, context = {}) {
    const resolved = Object.fromEntries(Object.keys(registry).map(key => [key, resolvedFromState(current, key, context)]));
    return { labId: current.lab?.id || null, version: current.policy?.version || 0,
        presetCode: current.policy?.presetCode || null, profileName: current.profile.name, profileConfigured: current.profile.configured,
        inheritedPreset: current.profile.preset || 'ISO17025_STRICT',
        values: Object.fromEntries(Object.entries(resolved).map(([key, row]) => [key, row.value])), resolved };
}
async function resolve(reference, key, context = {}) { return resolvedFromState(await state(reference, context), key, context); }
async function get(reference, key, context = {}) {
    definition(key);
    return context.snapshot ? clone(context.snapshot.values[key]) : (await resolve(reference, key, context)).value;
}
async function snapshot(reference, context = {}) { return snapshotFromState(await state(reference, context), context); }

function validatePairs(values, status = 400, code = 'POLICY_VALUE_INVALID') {
    if (!require('../../shared/numberParse').validateNumberFormat({ decimal: values['numbers.decimalSeparator'], thousands: values['numbers.thousandsSeparator'] })) {
        throw error(status, code, 'Decimal and thousands separators must differ.');
    }
    if (values['qc.controlMinRecovery'] > values['qc.controlMaxRecovery'] || values['results.phMin'] > values['results.phMax']) {
        throw error(status, code, 'A policy lower bound cannot exceed its upper bound.');
    }
}
async function assertScope(actor, lab, edit = false, db = require('../prisma')) {
    if (!lab) throw error(404, 'LAB_NOT_FOUND', 'Laboratory not found.');
    if (!hasPermission(actor, edit ? 'MANAGE_LAB_POLICIES' : 'VIEW_LAB_POLICIES')) throw error(403, 'POLICY_PERMISSION_DENIED', 'Policy permission required.');
    const actorLab = actor.labId ? await resolveLab(actor.labId, db) : null;
    const scopedActor = { ...actor, labId: actorLab?.id || actor.labId };
    if (!scopeGuard.canAccessEntity(scopedActor, lab, { labField: 'id', altLabField: null }) || (edit && !scopeGuard.canManageLab(scopedActor, lab.id))) {
        throw error(403, 'TARGET_OUTSIDE_SCOPE', 'Laboratory is outside your scope.');
    }
}
async function validateChange(change, db) {
    if (!change || typeof change !== 'object') throw error(400, 'POLICY_VALUE_INVALID', 'Invalid policy change.');
    const d = definition(change.key);
    const analysisCode = change.analysisCode ?? null, methodologyId = change.methodologyId ?? null;
    if ((analysisCode !== null && (typeof analysisCode !== 'string' || !analysisCode.trim())) ||
        (methodologyId !== null && (typeof methodologyId !== 'string' || !methodologyId.trim())) ||
        (d.scope === 'LAB' && (methodologyId !== null || (analysisCode !== null && !d.analysisOverrides?.includes(analysisCode)))) ||
        (methodologyId !== null && analysisCode === null)) {
        throw error(422, 'POLICY_SCOPE_INVALID', 'Invalid policy scope.');
    }
    if (analysisCode !== null && !await db.analysis.findUnique({ where: { code: analysisCode }, select: { code: true } })) {
        throw error(422, 'POLICY_SCOPE_INVALID', 'Unknown analysis scope.');
    }
    if (methodologyId !== null) {
        const method = await db.methodology.findUnique({ where: { id: methodologyId }, select: { analysisCode: true } });
        if (!method || method.analysisCode !== analysisCode) throw error(422, 'POLICY_SCOPE_INVALID', 'Methodology must belong to the analysis.');
    }
    if (change.clear !== true && !valid(change.key, change.value)) throw error(400, 'POLICY_VALUE_INVALID', 'Policy value is outside its allowed range.');
    return { ...change, analysisCode, methodologyId };
}
async function mutateInTransaction(actor, reference, request, tx, options = {}) {
    const current = await state(reference, { ...options, db: tx });
    await assertScope(actor, current.lab, true, tx);
    if (typeof request.reason !== 'string' || !request.reason.trim()) throw error(400, 'POLICY_REASON_REQUIRED', 'A reason is required for policy changes.');
    const version = current.policy?.version || 0;
    if (request.expectedVersion !== undefined && (!Number.isSafeInteger(request.expectedVersion) || request.expectedVersion !== version)) {
        throw error(409, 'POLICY_VERSION_CONFLICT', 'Policy changed. Refresh before saving.');
    }
    const hasPreset = Object.hasOwn(request, 'presetCode');
    if (hasPreset && request.presetCode !== null && !PRESETS.includes(request.presetCode)) throw error(400, 'POLICY_VALUE_INVALID', 'Unknown policy preset.');
    if (request.changes !== undefined && !Array.isArray(request.changes)) throw error(400, 'POLICY_VALUE_INVALID', 'Policy changes must be a list.');
    const changes = [];
    for (const change of request.changes || []) changes.push(await validateChange(change, tx));
    const scopes = changes.map(c => JSON.stringify([c.key, c.analysisCode, c.methodologyId]));
    if (new Set(scopes).size !== scopes.length || (!changes.length && !hasPreset)) throw error(400, 'POLICY_VALUE_INVALID', 'Specify distinct policy changes.');
    const before = snapshotFromState(current);
    const prospective = { ...current, policy: { ...(current.policy || {}), presetCode: hasPreset ? request.presetCode : current.policy?.presetCode || null, version: version + 1 },
        overrides: current.overrides.filter(row => !changes.some(c => c.key === row.key && c.analysisCode === row.analysisCode && c.methodologyId === row.methodologyId)) };
    for (const c of changes.filter(c => !c.clear)) prospective.overrides.push({ ...c, id: 'prospective', value: JSON.stringify(c.value) });
    const affectedContexts = [{}, ...changes.map(c => ({ analysisCode: c.analysisCode, methodologyId: c.methodologyId })),
        ...current.overrides.map(c => ({ analysisCode: c.analysisCode, methodologyId: c.methodologyId }))];
    for (const context of affectedContexts) validatePairs(snapshotFromState(prospective, context).values);
    const after = snapshotFromState(prospective);
    let compatibilityCopy = { written: false };
    let compatibilitySettings;
    if (!options.preserveLegacySettings && ['numbers.decimalSeparator', 'numbers.thousandsSeparator'].some(key => before.values[key] !== after.values[key])) {
        let settings;
        try { settings = current.lab.settings == null ? {} : JSON.parse(current.lab.settings); }
        catch (_) { throw error(409, 'LAB_SETTINGS_INVALID', 'Stored laboratory settings must be valid JSON.'); }
        if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw error(409, 'LAB_SETTINGS_INVALID', 'Stored laboratory settings must be an object.');
        const values = { decimalSeparator: after.values['numbers.decimalSeparator'], thousandsSeparator: after.values['numbers.thousandsSeparator'] };
        compatibilityCopy = { written: true, before: {
            decimalSeparator: settings.decimalSeparator ?? null, thousandsSeparator: settings.thousandsSeparator ?? null,
            presentKeys: ['decimalSeparator', 'thousandsSeparator'].filter(key => Object.hasOwn(settings, key))
        }, after: values };
        compatibilitySettings = JSON.stringify({ ...settings, ...values });
    }
    const reason = request.reason.trim(), now = new Date();
    if (current.policy) {
        const written = await tx.labPolicy.updateMany({ where: { labId: current.lab.id, version }, data: {
            ...(hasPreset ? { presetCode: request.presetCode } : {}), version: { increment: 1 }, updatedBy: actor.username, updatedAt: now
        } });
        if (written.count !== 1) throw error(409, 'POLICY_VERSION_CONFLICT', 'Policy changed. Refresh before saving.');
    } else await tx.labPolicy.create({ data: { id: crypto.randomUUID(), labId: current.lab.id,
        presetCode: hasPreset ? request.presetCode : null, version: 1, updatedBy: actor.username, updatedAt: now } });
    for (const c of changes) {
        await tx.labPolicyOverride.updateMany({ where: { labId: current.lab.id, key: c.key, analysisCode: c.analysisCode,
            methodologyId: c.methodologyId, revokedAt: null }, data: { revokedAt: now, revokedBy: actor.username } });
        if (!c.clear) await tx.labPolicyOverride.create({ data: { id: crypto.randomUUID(), labId: current.lab.id,
            key: c.key, analysisCode: c.analysisCode, methodologyId: c.methodologyId, value: JSON.stringify(c.value), reason, setBy: actor.username, setAt: now } });
    }
    if (compatibilityCopy.written) await tx.lab.update({ where: { id: current.lab.id }, data: { settings: compatibilitySettings } });
    await tx.auditLog.create({ data: { id: crypto.randomUUID(), entity: 'LAB', entityId: current.lab.id, labId: current.lab.id,
        action: options.auditAction || 'UPDATE_POLICY', performedBy: actor.username, timestamp: now,
        before: JSON.stringify({ ...before, overrides: current.overrides }), after: JSON.stringify({ ...after,
            changes: changes.map(c => ({ ...c, value: c.clear ? null : c.value })) }),
        details: JSON.stringify({ kind: 'LAB_POLICY_CHANGE', reason, policyVersion: version + 1,
            compatibilityCopy, compatibilityFields: [...new Set([...(options.compatibilityFields || []), ...(compatibilityCopy.written ? ['settings'] : [])])],
            changedKeys: changes.map(c => c.key), presetChanged: hasPreset }) } });
    return snapshot(current.lab.id, { ...options, db: tx });
}
async function change(actor, reference, request, options = {}) {
    const db = options.db || require('../prisma');
    try { return await db.$transaction(tx => mutateInTransaction(actor, reference, request, tx, options)); }
    catch (e) {
        if (['P2002', 'P2034'].includes(e.code)) throw error(409, 'POLICY_VERSION_CONFLICT', 'Policy changed. Refresh before saving.');
        throw e;
    }
}
module.exports = { get, resolve, snapshot, getStrict, getStrictNumberFormat, resolveLab, loadProfile, assertScope, change, mutateInTransaction, validatePairs };
