#!/usr/bin/env node
'use strict';

// Manual, separately approved catalogue maintenance; never an application hook.
// Start with a dry-run on an owned copy. Production needs separate approval.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');
const { configurationIssues, resolveSelection, missingDefaultEntries, stableStringify, rowHash, PACKAGE_IDS } = require('./fix_424_step_c_packages');

const ACTOR = 'system:issue-424';
const RETIRED_CODES = Object.freeze(['extractableElements', 'solubleSalts', 'porosity', 'gypsum']);
const FULL_EXTRACTABLES = Object.freeze(['P_OLSEN', 'EXT_ZN', 'EXT_FE', 'EXT_MN', 'EXT_CU', 'EXT_B']);
const REFERENCES = Object.freeze(['ISO 11272:2017', 'ISO 11508:2017']);
const GYPSUM_METHOD_NAME = 'Acetone precipitation + electrical conductivity';
const GYPSUM_VALIDATION_BEFORE = Object.freeze({ min: 0.1, max: 800, decimalPlaces: 1 });
const GYPSUM_VALIDATION_AFTER = Object.freeze({ min: 0.01, max: 80, decimalPlaces: 2 });
const SAR_UNIT_BEFORE = '(mmol/L)⁰˙⁵';
class Refusal extends Error {
    constructor(code, context = {}) { super(code); this.code = code; this.context = context; }
}
function fileHash(filename) {
    const digest = createHash('sha256'), buffer = Buffer.alloc(1024 * 1024), fd = fs.openSync(filename, 'r');
    try { let length; while ((length = fs.readSync(fd, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, length)); }
    finally { fs.closeSync(fd); }
    return digest.digest('hex');
}
function integrity(db) {
    if (db.pragma('integrity_check').some(row => Object.values(row)[0] !== 'ok')) throw new Refusal('INTEGRITY_CHECK_FAILED');
    if (db.pragma('foreign_key_check').length) throw new Refusal('FOREIGN_KEY_CHECK_FAILED');
    return { integrityCheck: 'ok', foreignKeyCheckRows: 0 };
}
function requireSchema(db) {
    const required = {
        Analysis: ['code', 'name', 'status', 'labId', 'isGlobal', 'units', 'unitCode', 'validation', 'decimalPlaces'],
        AnalysisGroup: ['id', 'name', 'analyses', 'labId'],
        Methodology: ['id', 'analysisCode', 'name', 'standard', 'labId', 'isDefault'],
        Lab: ['id'], LabMethodDefault: ['labId', 'analysisCode', 'methodologyId'], Unit: ['code'],
        Result: ['param'], WorkItem: ['analysis'], OrderLine: ['analysis', 'status'],
        AuditLog: ['id', 'entity', 'entityId', 'action', 'details', 'performedBy', 'timestamp', 'analysisCode', 'before', 'after']
    };
    for (const [table, columns] of Object.entries(required)) {
        const actual = new Set(db.pragma(`table_info("${table}")`).map(row => row.name));
        for (const column of columns) if (!actual.has(column)) throw new Refusal('MISSING_REQUIRED_COLUMN', { holder: `${table}.${column}` });
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
function replaceCodes(id, codes) {
    const replaced = codes.flatMap(code => {
        if (code === 'extractableElements' && id === 'BASIC_FERTILITY') return ['P_OLSEN'];
        if (code === 'extractableElements' && id === 'FULL_CHARACTERIZATION') return FULL_EXTRACTABLES;
        if (code === 'solubleSalts' && id === 'SALINITY_SODICITY') return codes.includes('SAR') ? [] : ['SAR'];
        if (code === 'VOL_MOISTURE' && id === 'FULL_CHARACTERIZATION') return [];
        const replacement = { porosity: 'POROSITY', gypsum: 'GYPSUM' }[code];
        return replacement ? (codes.includes(replacement) ? [] : [replacement]) : [code];
    });
    let result = [...new Set(replaced)];
    if (id === 'PHYSICAL_PROPERTIES' && result.includes('VOL_MOISTURE')) {
        result = result.filter(code => code !== 'SOIL_MOISTURE');
        result.splice(result.indexOf('VOL_MOISTURE') + 1, 0, 'SOIL_MOISTURE');
    }
    return result;
}
function addReferences(value) {
    const existing = value || '';
    return [existing, ...REFERENCES.filter(reference => !existing.includes(reference))].filter(Boolean).join('; ');
}
function planStepD(db, extraPackageIds = []) {
    requireSchema(db);
    const analyses = new Map(db.prepare('SELECT * FROM Analysis ORDER BY code').all().map(row => [row.code, row]));
    const groups = db.prepare('SELECT * FROM AnalysisGroup ORDER BY id').all();
    const methods = db.prepare('SELECT * FROM Methodology ORDER BY id').all();
    const overrides = db.prepare('SELECT * FROM LabMethodDefault ORDER BY labId,analysisCode,methodologyId').all();
    const labs = db.prepare('SELECT id FROM Lab ORDER BY id').all().map(row => row.id);
    const original = new Map(groups.map(row => [row.id, parsePackage(row)])), contents = new Map(original);
    const failures = [], records = [], packages = [], eligibility = [];
    const fail = (code, target, context = {}) => failures.push({ code, target, ...context });
    const record = (kind, table, key, before, after, extra = {}) => records.push({ kind, table, key, target: before[key],
        state: extra.state || (stableStringify(before) === stableStringify(after) ? 'already_done' : 'planned'), ...extra, before, after,
        beforeRowSha256: rowHash(before), afterRowSha256: rowHash(after) });
    for (const id of PACKAGE_IDS) {
        const group = groups.find(row => row.id === id);
        if (!group) fail('PACKAGE_MISSING', id);
        else if (group.labId !== null) fail('PACKAGE_NOT_GLOBAL', id);
    }
    const physical = original.get('PHYSICAL_PROPERTIES');
    if (physical && !physical.includes('VOL_MOISTURE')) fail('VOLUMETRIC_MISSING_FROM_PHYSICAL', 'PHYSICAL_PROPERTIES');
    if (original.has('CATION_EXCHANGE_SUITE') && !original.get('CATION_EXCHANGE_SUITE').includes('baseSaturation')) fail('BASE_SATURATION_MISSING', 'CATION_EXCHANGE_SUITE');
    for (const before of groups) {
        if (before.labId !== null) continue;
        const beforeCodes = original.get(before.id);
        if (!PACKAGE_IDS.includes(before.id) && !extraPackageIds.includes(before.id) && !beforeCodes.some(code => code === 'porosity' || code === 'gypsum')) continue;
        const afterCodes = replaceCodes(before.id, beforeCodes);
        contents.set(before.id, afterCodes);
        const after = stableStringify(beforeCodes) === stableStringify(afterCodes) ? before : { ...before, analyses: JSON.stringify(afterCodes) };
        record('package', 'AnalysisGroup', 'id', before, after);
        packages.push({ id: before.id, beforeCodes, afterCodes });
    }
    const resultCounts = Object.fromEntries(['SAR', 'GYPSUM'].map(code => [code, db.prepare('SELECT count(*) n FROM Result WHERE param=?').get(code).n]));
    if (resultCounts.GYPSUM) fail('GYPSUM_HAS_RESULTS', 'GYPSUM', { results: resultCounts.GYPSUM });
    if (resultCounts.SAR) fail('SAR_HAS_RESULTS', 'SAR', { results: resultCounts.SAR });
    const retirements = RETIRED_CODES.map(code => {
        const before = analyses.get(code);
        const usage = { orderLines: db.prepare('SELECT count(*) n FROM OrderLine WHERE analysis=?').get(code).n,
            workItems: db.prepare('SELECT count(*) n FROM WorkItem WHERE analysis=?').get(code).n,
            results: db.prepare('SELECT count(*) n FROM Result WHERE param=?').get(code).n };
        const remainingPackages = [...contents].filter(([, codes]) => codes.includes(code)).map(([id]) => id);
        if (remainingPackages.length) fail('LEGACY_STILL_IN_PACKAGE', code, { packageIds: remainingPackages });
        let state = null;
        if (!before) fail('LEGACY_PARAMETER_MISSING', code);
        else if (before.labId !== null || before.isGlobal !== 1 || !['active', 'inactive'].includes(before.status)) fail('LEGACY_PARAMETER_SCOPE_OR_STATUS', code);
        else if (before.status === 'active' && Object.values(usage).some(Boolean)) {
            state = 'retirement_skipped_in_use';
            record('retirement', 'Analysis', 'code', before, before, { state, usage });
        } else {
            const after = { ...before, status: 'inactive' };
            state = stableStringify(before) === stableStringify(after) ? 'already_done' : 'planned';
            record('retirement', 'Analysis', 'code', before, after);
        }
        return { code, state, ...usage, remainingPackages };
    });
    const gypsum = analyses.get('GYPSUM');
    if (!gypsum) fail('PARAMETER_MISSING', 'GYPSUM');
    else {
        let validation;
        try { validation = JSON.parse(gypsum.validation); } catch { validation = null; }
        const before = gypsum.units === 'g/kg' && gypsum.unitCode === 'g/kg' && gypsum.decimalPlaces === 1 && rowHash(validation) === rowHash(GYPSUM_VALIDATION_BEFORE);
        const after = gypsum.units === '%' && gypsum.unitCode === '%' && gypsum.decimalPlaces === 2 && rowHash(validation) === rowHash(GYPSUM_VALIDATION_AFTER);
        if (!before && !after) fail('GYPSUM_UNIT_OR_VALIDATION_UNEXPECTED', 'GYPSUM');
        else record('unit', 'Analysis', 'code', gypsum, after ? gypsum : { ...gypsum, units: '%', unitCode: '%', decimalPlaces: 2, validation: JSON.stringify(GYPSUM_VALIDATION_AFTER) });
    }
    if (!db.prepare("SELECT 1 FROM Unit WHERE code='%'").get()) fail('PERCENT_UNIT_MISSING', 'GYPSUM');
    const dimensionlessCode = analyses.get('MUNSELL_COLOR')?.unitCode;
    if (dimensionlessCode !== 'dimensionless' || !db.prepare('SELECT 1 FROM Unit WHERE code=?').get(dimensionlessCode)) fail('DIMENSIONLESS_UNIT_MISSING_OR_CHANGED', 'SAR');
    const sar = analyses.get('SAR');
    if (!sar) fail('PARAMETER_MISSING', 'SAR');
    else if (!((sar.units === SAR_UNIT_BEFORE && sar.unitCode === SAR_UNIT_BEFORE) || (sar.units === 'dimensionless' && sar.unitCode === dimensionlessCode))) fail('SAR_UNIT_UNEXPECTED', 'SAR');
    else record('unit', 'Analysis', 'code', sar, { ...sar, units: 'dimensionless', unitCode: dimensionlessCode });
    for (const [id, code, change] of [
        ['POROSITY_CALC', 'POROSITY', row => ({ ...row, standard: addReferences(row.standard) })],
        ['USDA_HB60_GYPSUM', 'GYPSUM', row => ({ ...row, name: GYPSUM_METHOD_NAME })]
    ]) {
        const before = methods.find(row => row.id === id);
        if (!before || before.analysisCode !== code || before.labId !== null || before.isDefault !== 1) fail('CANONICAL_METHOD_MISSING_OR_CHANGED', id);
        else record('method', 'Methodology', 'id', before, change(before));
    }
    const porosity = analyses.get('POROSITY');
    if (!porosity || porosity.units !== '%' || porosity.unitCode !== '%') fail('POROSITY_UNIT_UNEXPECTED', 'POROSITY');
    const checked = new Set(packages.flatMap(row => row.afterCodes));
    for (const code of checked) {
        const row = analyses.get(code);
        if (!row) { fail('PARAMETER_MISSING', code); continue; }
        if (row.status !== 'active' || row.labId !== null || row.isGlobal !== 1) fail('PARAMETER_NOT_ACTIVE_GLOBAL', code);
        if (configurationIssues(row).length) fail('PARAMETER_CONFIGURATION_INVALID', code);
        for (const labId of [null, ...labs]) {
            const selection = resolveSelection(code, labId, methods, overrides);
            if (selection.error) fail(selection.error, code, { labId });
            else if (!selection.methodId) fail('DEFAULT_METHOD_MISSING', code, { labId });
            eligibility.push({ code, labId, methodId: selection.methodId || null, error: selection.error || null });
        }
    }
    for (const [code, id] of [['POROSITY', 'POROSITY_CALC'], ['GYPSUM', 'USDA_HB60_GYPSUM'], ['SAR', 'SAR_CALC'], ['SOIL_MOISTURE', 'ISO_11465_GRAV'], ['baseSaturation', 'BS_CALCULATION']]) {
        const selection = resolveSelection(code, null, methods, overrides);
        if (selection.error || selection.methodId !== id) fail('GLOBAL_DEFAULT_DIFFERS_FROM_PIN', code);
    }
    const availabilityBefore = missingDefaultEntries(groups, original, labs, methods, overrides);
    const availabilityAfter = missingDefaultEntries(groups, contents, labs, methods, overrides);
    const beforeMissing = new Set(availabilityBefore.map(stableStringify));
    for (const entry of availabilityAfter) if (!beforeMissing.has(stableStringify(entry))) fail('NEW_MISSING_DEFAULT', entry.code, { packageId: entry.packageId, labId: entry.labId });
    const targetKeys = new Set(records.filter(row => row.state !== 'retirement_skipped_in_use').map(row => `${row.table}:${row.target}`));
    const unchanged = {
        analyses: [...analyses.values()].filter(row => !targetKeys.has(`Analysis:${row.code}`)),
        methods: methods.filter(row => !targetKeys.has(`Methodology:${row.id}`)),
        packages: groups.filter(row => !targetKeys.has(`AnalysisGroup:${row.id}`)), overrides
    };
    const labOwnedPackages = groups.filter(row => row.labId !== null).map(row => ({ ...row, codes: original.get(row.id) }));
    const value = { packages, retirements, resultCounts, records, failures, eligibility, availabilityBefore, availabilityAfter,
        labOwnedPackages, labOverrideCount: overrides.length, labContexts: labs.length, globalContextAlsoChecked: true,
        sarUnit: { before: sar && { units: sar.units, unitCode: sar.unitCode }, after: { units: 'dimensionless', unitCode: dimensionlessCode } },
        plannedChanges: records.filter(row => row.state === 'planned').length, unchangedDefinitionsSha256: rowHash(unchanged) };
    return { ...value, planSha256: rowHash(value) };
}
function open(filename, readonly) {
    const db = new Database(filename, { readonly, fileMustExist: true, timeout: 5000 });
    db.pragma('foreign_keys=ON');
    return db;
}
function runStepDCatalogue({ dbPath, apply = false, expectedPlanSha256 } = {}) {
    const receipt = { ok: false, issue: 424, step: 'D', mode: apply ? 'APPLY' : 'DRY_RUN', totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 };
    let db;
    try {
        if (!dbPath || typeof dbPath !== 'string') throw new Refusal('DATABASE_PATH_REQUIRED');
        if (apply && !/^[a-f0-9]{64}$/.test(expectedPlanSha256 || '')) throw new Refusal('EXPECTED_PLAN_SHA256_REQUIRED');
        const filename = path.resolve(dbPath), stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Refusal('EXISTING_REGULAR_DATABASE_REQUIRED');
        receipt.databaseBeforeSha256 = fileHash(filename);
        const reader = open(filename, true);
        let preflight;
        try { reader.exec('BEGIN'); preflight = { ...planStepD(reader), ...integrity(reader) }; }
        finally { if (reader.inTransaction) reader.exec('ROLLBACK'); reader.close(); }
        Object.assign(receipt, preflight);
        if (preflight.failures.length) return { ...receipt, error: { code: 'PRECONDITION_FAILED' }, databaseAfterSha256: fileHash(filename) };
        if (expectedPlanSha256 && expectedPlanSha256 !== preflight.planSha256) throw new Refusal('EXPECTED_PLAN_DIFFERS');
        if (!apply || !preflight.plannedChanges) return { ...receipt, ok: true, databaseAfterSha256: fileHash(filename) };
        db = open(filename, false); db.exec('BEGIN IMMEDIATE');
        const plan = planStepD(db);
        if (plan.failures.length || plan.planSha256 !== preflight.planSha256) throw new Refusal('PLAN_CHANGED_BEFORE_WRITE');
        const changesBefore = db.prepare('SELECT total_changes() n').get().n, auditsBefore = db.prepare('SELECT count(*) n FROM AuditLog').get().n;
        const newAuditIds = [];
        for (const record of plan.records.filter(row => row.state === 'planned')) {
            const fields = Object.keys(record.after).filter(key => stableStringify(record.before[key]) !== stableStringify(record.after[key]));
            const allowed = { package: ['analyses'], retirement: ['status'], unit: ['units', 'unitCode', 'validation', 'decimalPlaces'], method: ['name', 'standard'] }[record.kind];
            if (fields.some(field => !allowed.includes(field))) throw new Refusal('UNAPPROVED_FIELD_CHANGE');
            const actualBefore = db.prepare(`SELECT * FROM ${record.table} WHERE ${record.key}=?`).get(record.target);
            if (rowHash(actualBefore) !== record.beforeRowSha256) throw new Refusal('TARGET_CHANGED', { target: record.target });
            // Keep each writable catalogue table and column explicit. This
            // script has no authority to update workflow or result tables.
            let result;
            if (record.kind === 'package') result = db.prepare('UPDATE AnalysisGroup SET analyses=? WHERE id=? AND labId IS NULL').run(record.after.analyses, record.target);
            else if (record.kind === 'retirement') result = db.prepare('UPDATE Analysis SET status=? WHERE code=? AND labId IS NULL').run(record.after.status, record.target);
            else if (record.kind === 'unit' && record.target === 'GYPSUM') result = db.prepare('UPDATE Analysis SET units=?,unitCode=?,validation=?,decimalPlaces=? WHERE code=? AND labId IS NULL')
                .run(record.after.units, record.after.unitCode, record.after.validation, record.after.decimalPlaces, record.target);
            else if (record.kind === 'unit' && record.target === 'SAR') result = db.prepare('UPDATE Analysis SET units=?,unitCode=? WHERE code=? AND labId IS NULL').run(record.after.units, record.after.unitCode, record.target);
            else if (record.kind === 'method' && record.target === 'POROSITY_CALC') result = db.prepare('UPDATE Methodology SET standard=? WHERE id=? AND labId IS NULL').run(record.after.standard, record.target);
            else if (record.kind === 'method' && record.target === 'USDA_HB60_GYPSUM') result = db.prepare('UPDATE Methodology SET name=? WHERE id=? AND labId IS NULL').run(record.after.name, record.target);
            else throw new Refusal('UNAPPROVED_TARGET');
            if (result.changes !== 1) throw new Refusal('TARGET_CHANGED', { target: record.target });
            const actual = db.prepare(`SELECT * FROM ${record.table} WHERE ${record.key}=?`).get(record.target);
            if (rowHash(actual) !== record.afterRowSha256) throw new Refusal('UNEXPECTED_TARGET_CHANGE', { target: record.target });
            const id = randomUUID(); newAuditIds.push(id);
            db.prepare(`INSERT INTO AuditLog(id,entity,entityId,action,details,performedBy,timestamp,analysisCode,before,after) VALUES(?,?,?,?,?,?,?,?,?,?)`)
                .run(id, record.table === 'AnalysisGroup' ? 'GROUP' : record.table === 'Methodology' ? 'METHODOLOGY' : 'ANALYSIS', record.target,
                    'UPDATE', JSON.stringify({ issue: 424, step: 'D', kind: record.kind }), ACTOR, new Date().toISOString(),
                    record.table === 'Analysis' ? record.target : record.table === 'Methodology' ? record.before.analysisCode : null,
                    JSON.stringify(record.before), JSON.stringify(actual));
        }
        const post = planStepD(db, plan.packages.map(row => row.id));
        if (post.failures.length || post.plannedChanges) throw new Refusal('POSTCONDITION_FAILED');
        if (post.unchangedDefinitionsSha256 !== plan.unchangedDefinitionsSha256) throw new Refusal('UNRELATED_DEFINITIONS_CHANGED');
        if (stableStringify(post.availabilityBefore) !== stableStringify(plan.availabilityAfter)) throw new Refusal('AVAILABILITY_AFTER_DIFFERS');
        const auditRowsCreated = db.prepare('SELECT count(*) n FROM AuditLog').get().n - auditsBefore;
        const sqliteTotalChanges = db.prepare('SELECT total_changes() n').get().n - changesBefore;
        if (auditRowsCreated !== plan.plannedChanges || sqliteTotalChanges !== plan.plannedChanges * 2) throw new Refusal('UNEXPECTED_WRITE_COUNT');
        const health = integrity(db); db.exec('COMMIT');
        return { ...receipt, ...health, ok: true, totalChanges: plan.plannedChanges, auditRowsCreated, sqliteTotalChanges, auditActor: ACTOR, newAuditIds,
            records: plan.records.map(row => ({ ...row, state: row.state === 'planned' ? 'changed' : row.state })) };
    } catch (error) {
        if (db?.inTransaction) db.exec('ROLLBACK');
        return { ...receipt, ok: false, totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0, rolledBack: Boolean(db),
            error: error instanceof Refusal ? { code: error.code, ...error.context } : { code: /^[A-Z0-9_]{2,80}$/.test(error.code || '') ? error.code : 'SCRIPT_FAILED' } };
    } finally {
        if (db) db.close();
    }
}
function cli(args) {
    let dbPath, apply = false, expectedPlanSha256;
    try {
        for (let index = 0; index < args.length; index++) {
            if (args[index] === '--db' && args[index + 1] && !dbPath) dbPath = args[++index];
            else if (args[index] === '--apply' && !apply) apply = true;
            else if (args[index] === '--expected-plan-sha256' && args[index + 1] && !expectedPlanSha256) expectedPlanSha256 = args[++index];
            else throw new Refusal('INVALID_ARGUMENTS');
        }
        return runStepDCatalogue({ dbPath, apply, expectedPlanSha256 });
    } catch (error) { return { ok: false, issue: 424, step: 'D', totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0, error: { code: error.code || 'INVALID_ARGUMENTS' } }; }
}
module.exports = { runStepDCatalogue, planStepD, cli, replaceCodes, addReferences, ACTOR, RETIRED_CODES, FULL_EXTRACTABLES, GYPSUM_METHOD_NAME };
if (require.main === module) {
    const result = cli(process.argv.slice(2));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.ok ? 0 : 1;
}
