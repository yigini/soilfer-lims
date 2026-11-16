#!/usr/bin/env node
'use strict';

// Manual catalogue maintenance. Not an installer or an application startup hook.
// Production execution needs its own approval after review of the rehearsal lists.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { GATE_CODES } = require('../services/workItemKinds');

const PACKAGE_IDS = Object.freeze(['BASIC_FERTILITY', 'CATION_EXCHANGE_SUITE',
    'FULL_CHARACTERIZATION', 'PHYSICAL_PROPERTIES', 'SALINITY_SODICITY']);
const REPLACEMENTS = Object.freeze({
    pH: ['PH_H2O'], electricalConductivity: ['EC'], carbonOrganic: ['SOC'],
    nitrogenTotal: ['TN'], cationExchangeCapacitySoil: ['CEC'], effectiveCec: ['ECEC'],
    acidityExchangeable: ['EXCH_ACID'], exchangeableBases: ['EXCH_CA', 'EXCH_MG', 'EXCH_K', 'EXCH_NA'],
    pSA: ['SAND', 'SILT', 'CLAY'], bulkDensityWholeSoil: ['BD_WHOLE'],
    bulkDensityFineEarth: ['BD_FINE'], moistureContent: ['SOIL_MOISTURE'],
    availableWaterHoldingCapacity: ['AWC'], totalCarbonateEquivalent: ['CACO3']
});
for (const replacements of Object.values(REPLACEMENTS)) Object.freeze(replacements);
const DEFERRED_CODES = Object.freeze(['extractableElements', 'baseSaturation', 'solubleSalts']);
// Pin 4 permits existing gaps, never a new one or an invented method choice.
const RETAINED_WITHOUT_DEFAULT = Object.freeze(['porosity', 'gypsum', ...DEFERRED_CODES]);
const ACTOR = 'system:issue-424';
const PARTNERS = Object.freeze([...new Set(Object.values(REPLACEMENTS).flat())]);
class Refusal extends Error {
    constructor(code, context = {}) { super(code); this.code = code; this.context = context; }
}
const stableStringify = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash('sha256').update(value).digest('hex');
const rowHash = value => hash(stableStringify(value));
function fileHash(filename) {
    const digest = createHash('sha256'), buffer = Buffer.alloc(1024 * 1024), fd = fs.openSync(filename, 'r');
    try { let size; while ((size = fs.readSync(fd, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, size)); }
    finally { fs.closeSync(fd); }
    return digest.digest('hex');
}
function open(filename, readonly) {
    const db = new Database(filename, { readonly, fileMustExist: true, timeout: 5000 });
    db.pragma('foreign_keys=ON');
    return db;
}
function integrity(db) {
    if (db.pragma('integrity_check').some(row => Object.values(row)[0] !== 'ok')) throw new Refusal('INTEGRITY_CHECK_FAILED');
    if (db.pragma('foreign_key_check').length) throw new Refusal('FOREIGN_KEY_CHECK_FAILED');
    return { integrityCheck: 'ok', foreignKeyCheckRows: 0 };
}
function requireSchema(db) {
    const columns = {
        Analysis: ['code', 'name', 'status', 'labId', 'isGlobal', 'units', 'validation'],
        AnalysisGroup: ['id', 'name', 'analyses', 'labId'],
        Methodology: ['id', 'analysisCode', 'labId', 'isDefault'],
        Lab: ['id'], LabMethodDefault: ['labId', 'analysisCode', 'methodologyId'],
        Result: ['param'], WorkItem: ['analysis'], OrderLine: ['analysis', 'status'],
        AuditLog: ['id', 'entity', 'entityId', 'action', 'details', 'performedBy', 'timestamp', 'analysisCode', 'before', 'after']
    };
    for (const [table, required] of Object.entries(columns)) {
        const actual = new Set(db.pragma(`table_info("${table}")`).map(row => row.name));
        for (const name of required) if (!actual.has(name)) throw new Refusal('MISSING_REQUIRED_COLUMN', { holder: `${table}.${name}` });
    }
}
function parsePackage(row) {
    if ((row.analyses == null || row.analyses === '') && !PACKAGE_IDS.includes(row.id)) return [];
    let codes;
    try { codes = JSON.parse(row.analyses); } catch { throw new Refusal('INVALID_PACKAGE_LIST', { target: row.id }); }
    if (!Array.isArray(codes) || (PACKAGE_IDS.includes(row.id) && !codes.length) || codes.some(code => typeof code !== 'string' || !code.trim())) {
        throw new Refusal('INVALID_PACKAGE_LIST', { target: row.id });
    }
    return codes;
}
function replaceCodes(codes) {
    const seen = new Set(), result = [];
    for (const code of codes) for (const replacement of REPLACEMENTS[code] || [code]) {
        if (!seen.has(replacement)) { seen.add(replacement); result.push(replacement); }
    }
    return result;
}
// The same new-selection definition checks as cataloguePolicy, without importing
// its application-wide Prisma singleton or opening any implicit database path.
function configurationIssues(analysis) {
    const issues = [];
    if (!analysis.name?.trim() || analysis.name === analysis.code || /^https?:/i.test(analysis.name)) issues.push('A descriptive parameter name is required.');
    if (/^SPEC_PARAM_\d+$/i.test(analysis.code)) issues.push('Placeholder parameter: define a real measurand and method before ordering.');
    if (analysis.name === `${analysis.code} Determination`) issues.push('Imported definition has not been curated: verify the parameter name, measurement unit and applicable method.');
    if (['pH', 'PH_H2O', 'PH_KCL', 'PH_CACL2', 'WATER_PH', 'hydraulicConductivity', 'availableWaterHoldingCapacity', 'textureSum'].includes(analysis.code) && analysis.units === 'mg/kg') issues.push('The configured mass-concentration unit does not describe this quantity. Correct the definition before new orders.');
    if (GATE_CODES.has(analysis.code)) issues.push('Operational work is created through the preparation workflow, not ordered as an analysis.');
    if (analysis.validation != null) {
        let rules;
        try { rules = typeof analysis.validation === 'string' ? JSON.parse(analysis.validation) : analysis.validation; } catch { rules = false; }
        if (!rules || typeof rules !== 'object' || Array.isArray(rules)) issues.push('Validation must be a JSON object.');
        else {
            for (const key of ['min', 'max', 'decimalPlaces']) if (rules[key] != null && (typeof rules[key] !== 'number' || !Number.isFinite(rules[key]))) issues.push(`${key} must be a finite number or left blank.`);
            if (rules.min != null && rules.max != null && rules.min > rules.max) issues.push('Minimum cannot exceed maximum.');
            if (rules.decimalPlaces != null && (!Number.isInteger(rules.decimalPlaces) || rules.decimalPlaces < 0 || rules.decimalPlaces > 10)) issues.push('Display decimals must be an integer between 0 and 10.');
        }
    }
    return issues;
}
function resolveSelection(code, labId, methods, overrides) {
    const candidates = methods.filter(row => row.analysisCode === code && (!row.labId || row.labId === labId));
    const selected = overrides.filter(row => row.labId === labId && row.analysisCode === code);
    if (labId && selected.length) {
        if (selected.length !== 1) return { error: 'DUPLICATE_LAB_OVERRIDE' };
        const method = candidates.find(row => row.id === selected[0].methodologyId);
        return method ? { methodId: method.id } : { error: 'INVALID_LAB_OVERRIDE' };
    }
    const local = candidates.filter(row => labId && row.labId === labId && row.isDefault === 1);
    const defaults = local.length ? local : candidates.filter(row => !row.labId && row.isDefault === 1);
    return defaults.length > 1 ? { error: 'DEFAULT_CONFLICT' } : { methodId: defaults[0]?.id || null };
}
function missingDefaultEntries(groups, contents, labs, methods, overrides) {
    const missing = [];
    for (const group of groups) for (const labId of group.labId === null ? [null, ...labs] : [group.labId]) {
        for (const code of new Set(contents.get(group.id))) {
            const selection = resolveSelection(code, labId, methods, overrides);
            if (!selection.methodId) missing.push({ packageId: group.id, labId, code, error: selection.error || null });
        }
    }
    return missing;
}
function planStepC(db) {
    requireSchema(db);
    const allGroups = db.prepare('SELECT * FROM AnalysisGroup ORDER BY id').all();
    const contents = new Map(allGroups.map(row => [row.id, parsePackage(row)]));
    const analyses = new Map(db.prepare('SELECT * FROM Analysis ORDER BY code').all().map(row => [row.code, row]));
    const labs = db.prepare('SELECT id FROM Lab ORDER BY id').all().map(row => row.id);
    if (!labs.length) throw new Refusal('NO_LAB_CONTEXTS');
    const methods = db.prepare('SELECT * FROM Methodology ORDER BY id').all();
    const overrides = db.prepare('SELECT * FROM LabMethodDefault ORDER BY labId,analysisCode').all();
    const availabilityBefore = missingDefaultEntries(allGroups, contents, labs, methods, overrides);
    const failures = [], records = [], packages = [], eligibility = [], retainedWithoutDefault = [];
    const fail = (code, target, extra = {}) => failures.push({ code, target, ...extra });
    const normalizeName = value => String(value || '').trim().toLowerCase();
    const reservedNames = new Set(PACKAGE_IDS.map(normalizeName));
    for (const row of allGroups.filter(row => PACKAGE_IDS.includes(row.id))) reservedNames.add(normalizeName(row.name));
    for (const row of allGroups) if (row.labId !== null && (PACKAGE_IDS.includes(row.id) || reservedNames.has(normalizeName(row.name)))) {
        fail('LAB_OWNED_TARGET_PACKAGE_COPY', row.id, { labId: row.labId });
    }
    for (const code of DEFERRED_CODES) {
        const row = analyses.get(code);
        if (!row || row.status !== 'active' || row.labId !== null || row.isGlobal !== 1) fail('DEFERRED_CODE_NOT_ACTIVE_GLOBAL', code);
    }
    for (const id of PACKAGE_IDS) {
        const before = allGroups.find(row => row.id === id);
        if (!before) { fail('PACKAGE_MISSING', id); continue; }
        if (before.labId !== null) { fail('PACKAGE_NOT_GLOBAL', id); continue; }
        const original = contents.get(id), afterCodes = replaceCodes(original);
        contents.set(id, afterCodes);
        const changed = stableStringify(original) !== stableStringify(afterCodes);
        const after = changed ? { ...before, analyses: JSON.stringify(afterCodes) } : before;
        records.push({ kind: 'package', table: 'AnalysisGroup', target: id, state: changed ? 'planned' : 'already_done', before, after,
            beforeRowSha256: rowHash(before), afterRowSha256: rowHash(after) });
        packages.push({ id, name: before.name, beforeCodes: original, afterCodes, duplicatesRemoved: original.flatMap(code => REPLACEMENTS[code] || [code]).length - afterCodes.length });
    }
    const availabilityAfter = missingDefaultEntries(allGroups, contents, labs, methods, overrides);
    const beforeMissing = new Set(availabilityBefore.map(stableStringify));
    for (const entry of availabilityAfter) if (!beforeMissing.has(stableStringify(entry))) {
        fail('NEW_MISSING_DEFAULT', entry.code, { packageId: entry.packageId, labId: entry.labId });
    }
    for (const [phase, entries] of [['before', availabilityBefore], ['after', availabilityAfter]]) {
        for (const entry of entries) if (PACKAGE_IDS.includes(entry.packageId) && !RETAINED_WITHOUT_DEFAULT.includes(entry.code)) {
            fail('UNAPPROVED_PACKAGE_DEFAULT_GAP', entry.code, { phase, packageId: entry.packageId, labId: entry.labId });
        }
    }
    const finalCodes = [...new Set(packages.flatMap(row => row.afterCodes))];
    const checkedCodes = [...new Set([...PARTNERS, ...finalCodes])];
    for (const code of checkedCodes) {
        const row = analyses.get(code), isPartner = PARTNERS.includes(code);
        if (!row) { fail('PARAMETER_MISSING', code); continue; }
        if (row.status !== 'active' || row.labId !== null || row.isGlobal !== 1) fail('PARAMETER_NOT_ACTIVE_GLOBAL', code);
        if (configurationIssues(row).length) fail('PARAMETER_CONFIGURATION_INVALID', code, { issueCount: configurationIssues(row).length });
        for (const labId of [null, ...labs]) {
            const selection = resolveSelection(code, labId, methods, overrides);
            if (selection.error) fail(selection.error, code, { labId });
            else if (!selection.methodId) {
                if (!isPartner && RETAINED_WITHOUT_DEFAULT.includes(code)) retainedWithoutDefault.push({ code, labId });
                else fail('DEFAULT_METHOD_MISSING', code, { labId });
            }
            eligibility.push({ code, labId, methodId: selection.methodId || null, error: selection.error || null });
        }
    }
    const retirements = [];
    for (const code of Object.keys(REPLACEMENTS)) {
        const before = analyses.get(code);
        if (!before) { fail('LEGACY_PARAMETER_MISSING', code); continue; }
        if (before.labId !== null || before.isGlobal !== 1 || !['active', 'inactive'].includes(before.status)) { fail('LEGACY_PARAMETER_SCOPE_OR_STATUS', code); continue; }
        const remainingPackages = [...contents].filter(([, codes]) => codes.includes(code)).map(([id]) => id);
        const results = db.prepare('SELECT COUNT(*) n FROM Result WHERE param=?').get(code).n;
        const workItems = db.prepare('SELECT COUNT(*) n FROM WorkItem WHERE analysis=?').get(code).n;
        const activeOrderLines = db.prepare("SELECT COUNT(*) n FROM OrderLine WHERE analysis=? AND status='ACTIVE'").get(code).n;
        const reasons = [];
        if (remainingPackages.length) reasons.push('packages');
        if (results) reasons.push('results');
        if (workItems) reasons.push('work items');
        if (activeOrderLines) reasons.push('order lines');
        if (code === 'pSA' && before.status !== 'active' && activeOrderLines) fail('PSA_MUST_STAY_ACTIVE', code);
        const state = before.status === 'inactive' ? 'already_done' : reasons.length ? 'kept_active' : 'planned';
        const after = state === 'planned' ? { ...before, status: 'inactive' } : before;
        retirements.push({ code, state, reasons, remainingPackages, results, workItems, activeOrderLines });
        records.push({ kind: 'retirement', table: 'Analysis', target: code, state, before, after,
            beforeRowSha256: rowHash(before), afterRowSha256: rowHash(after) });
    }
    const retainedState = {
        otherPackages: allGroups.filter(row => !PACKAGE_IDS.includes(row.id)),
        methodologies: methods, overrides,
        deferred: DEFERRED_CODES.map(code => analyses.get(code))
    };
    const plannedChanges = records.filter(row => row.state === 'planned').length;
    const value = { packages, retirements, records, failures, eligibility, retainedWithoutDefault,
        availabilityBefore, availabilityAfter,
        labContexts: labs.length, globalContextAlsoChecked: true, partnerCount: PARTNERS.length,
        plannedChanges, unchangedDefinitionsSha256: rowHash(retainedState) };
    return { ...value, planSha256: rowHash(value) };
}
function withReadOnlyPlan(filename, dryRun) {
    const db = open(filename, true);
    try {
        db.exec(dryRun ? 'BEGIN IMMEDIATE' : 'BEGIN');
        const health = integrity(db), plan = planStepC(db);
        db.exec('ROLLBACK');
        return { ...plan, ...health };
    } finally { if (db.inTransaction) db.exec('ROLLBACK'); db.close(); }
}
function runStepCPackages({ dbPath, apply = false }) {
    const receipt = { ok: false, issue: 424, step: 'C', mode: apply ? 'APPLY' : 'DRY_RUN',
        totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 };
    let db;
    try {
        if (!dbPath || typeof dbPath !== 'string') throw new Refusal('DATABASE_PATH_REQUIRED');
        const filename = path.resolve(dbPath);
        if (!fs.lstatSync(filename).isFile() || fs.lstatSync(filename).isSymbolicLink()) throw new Refusal('EXISTING_REGULAR_DATABASE_REQUIRED');
        receipt.databaseBeforeSha256 = fileHash(filename);
        const preflight = withReadOnlyPlan(filename, !apply);
        Object.assign(receipt, preflight);
        if (preflight.failures.length) return { ...receipt, error: { code: 'PRECONDITION_FAILED' }, databaseAfterSha256: fileHash(filename) };
        if (!apply || !preflight.plannedChanges) return { ...receipt, ok: true, databaseAfterSha256: fileHash(filename) };
        db = open(filename, false);
        db.exec('BEGIN IMMEDIATE');
        const plan = planStepC(db);
        if (plan.failures.length || plan.planSha256 !== preflight.planSha256) throw new Refusal('PLAN_CHANGED_BEFORE_WRITE');
        const changesBefore = db.prepare('SELECT total_changes() n').get().n;
        const auditsBefore = db.prepare('SELECT COUNT(*) n FROM AuditLog').get().n;
        const newAuditIds = [];
        for (const record of plan.records.filter(row => row.state === 'planned')) {
            const result = record.kind === 'package'
                ? db.prepare('UPDATE AnalysisGroup SET analyses=? WHERE id=? AND labId IS NULL AND analyses=?').run(record.after.analyses, record.target, record.before.analyses)
                : db.prepare("UPDATE Analysis SET status='inactive' WHERE code=? AND labId IS NULL AND status='active'").run(record.target);
            if (result.changes !== 1) throw new Refusal('TARGET_CHANGED', { target: record.target });
            const actual = db.prepare(`SELECT * FROM ${record.table} WHERE ${record.kind === 'package' ? 'id' : 'code'}=?`).get(record.target);
            if (stableStringify(actual) !== stableStringify(record.after)) throw new Refusal('UNEXPECTED_TARGET_CHANGE', { target: record.target });
            const auditId = randomUUID(); newAuditIds.push(auditId);
            db.prepare(`INSERT INTO AuditLog(id,entity,entityId,action,details,performedBy,timestamp,analysisCode,before,after)
                VALUES(?,?,?,?,?,?,?,?,?,?)`).run(auditId, record.kind === 'package' ? 'GROUP' : 'ANALYSIS', record.target,
                'UPDATE', JSON.stringify({ issue: 424, step: 'C', kind: record.kind }), ACTOR, new Date().toISOString(),
                record.kind === 'package' ? null : record.target, JSON.stringify(record.before), JSON.stringify(actual));
        }
        const post = planStepC(db);
        if (post.failures.length || post.plannedChanges) throw new Refusal('POSTCONDITION_FAILED');
        if (stableStringify(post.availabilityBefore) !== stableStringify(plan.availabilityAfter)) throw new Refusal('AVAILABILITY_AFTER_DIFFERS');
        if (post.unchangedDefinitionsSha256 !== plan.unchangedDefinitionsSha256) throw new Refusal('UNRELATED_DEFINITIONS_CHANGED');
        const auditRowsCreated = db.prepare('SELECT COUNT(*) n FROM AuditLog').get().n - auditsBefore;
        const sqliteTotalChanges = db.prepare('SELECT total_changes() n').get().n - changesBefore;
        if (auditRowsCreated !== plan.plannedChanges || sqliteTotalChanges !== plan.plannedChanges * 2) throw new Refusal('UNEXPECTED_WRITE_COUNT');
        const health = integrity(db);
        db.exec('COMMIT');
        Object.assign(receipt, plan, health, { ok: true, totalChanges: plan.plannedChanges, auditRowsCreated, sqliteTotalChanges,
            records: plan.records.map(row => ({ ...row, state: row.state === 'planned' ? 'changed' : row.state })),
            retiredCodes: plan.retirements.filter(row => row.state === 'planned').map(row => row.code),
            auditActor: ACTOR, newAuditIds, countQualification: 'Target records and audit inserts are counted separately.' });
        return receipt;
    } catch (error) {
        if (db?.inTransaction) db.exec('ROLLBACK');
        return { ...receipt, ok: false, totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0,
            rolledBack: Boolean(db), error: error instanceof Refusal ? { code: error.code, ...error.context }
                : { code: /^[A-Z0-9_]{2,80}$/.test(error.code || '') ? error.code : 'SCRIPT_FAILED' } };
    } finally { if (db) db.close(); }
}
function cli(args) {
    let dbPath, apply = false;
    try {
        for (let index = 0; index < args.length; index++) {
            if (args[index] === '--db' && args[index + 1] && !dbPath) dbPath = args[++index];
            else if (args[index] === '--apply' && !apply) apply = true;
            else throw new Refusal('INVALID_ARGUMENTS');
        }
        return runStepCPackages({ dbPath, apply });
    } catch (error) { return { ok: false, issue: 424, step: 'C', totalChanges: 0, auditRowsCreated: 0,
        sqliteTotalChanges: 0, error: { code: error.code || 'INVALID_ARGUMENTS' } }; }
}
module.exports = { runStepCPackages, cli, planStepC, replaceCodes, configurationIssues,
    resolveSelection, missingDefaultEntries, stableStringify, rowHash, PACKAGE_IDS, REPLACEMENTS, DEFERRED_CODES, PARTNERS, RETAINED_WITHOUT_DEFAULT };
if (require.main === module) {
    const result = cli(process.argv.slice(2));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.ok ? 0 : 1;
}
