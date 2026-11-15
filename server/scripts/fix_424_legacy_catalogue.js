#!/usr/bin/env node
'use strict';

// Manual catalogue maintenance only. Never import this from startup or an installer.
// A production apply needs an approved release window and its stopped backup.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const Database = require('better-sqlite3');

const EXTRA_DEFAULTS = Object.freeze({
    'meth-std-4': 'pH',
    'meth-std-9': 'electricalConductivity',
    'meth-std-12': 'carbonOrganic',
    'meth-std-15': 'nitrogenTotal',
    'meth-std-21': 'cationExchangeCapacitySoil'
});
const RETIRE_CODES = Object.freeze(['carbonInorganic', 'carbonTotal', 'coarseFragments',
    'hydraulicConductivity', 'organicMatter', 'phosphorusRetention', 'textureSum', 'totalElements']);
const CODE_HOLDERS = [
    [
        "WorkItem",
        "analysis"
    ],
    [
        "WorkItemDraft",
        "analysis"
    ],
    [
        "QcRule",
        "analysisCode"
    ],
    [
        "Batch",
        "analysis"
    ],
    [
        "BatchAnalyte",
        "analysisCode"
    ],
    [
        "BatchPositionWorkItem",
        "analysisCode"
    ],
    [
        "BatchPositionReference",
        "analysisCode"
    ],
    [
        "QcMeasurement",
        "analysisCode"
    ],
    [
        "QcEvaluation",
        "analysisCode"
    ],
    [
        "BatchDisposition",
        "analysisCode"
    ],
    [
        "AuditLog",
        "analysisCode"
    ],
    [
        "LabPolicyOverride",
        "analysisCode"
    ],
    [
        "ProficiencyRound",
        "analysisCode"
    ],
    [
        "InventoryTransaction",
        "analysisCode"
    ],
    [
        "MethodRequirement",
        "analysisCode"
    ],
    [
        "EquipmentMethodEligibility",
        "analysisCode"
    ],
    [
        "Result",
        "param"
    ],
    [
        "LabMethodDefault",
        "analysisCode"
    ],
    [
        "Methodology",
        "analysisCode"
    ],
    [
        "CalcTemplate",
        "analysisCode"
    ],
    [
        "CalcTemplateActivation",
        "analysisCode"
    ],
    [
        "ControlLimitProposal",
        "analysisCode"
    ],
    [
        "ControlLimitSet",
        "analysisCode"
    ],
    [
        "ReferenceValue",
        "analysisCode"
    ],
    [
        "OrderLine",
        "analysis"
    ],
    [
        "ReportedValueSelection",
        "analysisCode"
    ],
    [
        "ResultOverrideRequest",
        "analysisCode"
    ]
];
const METHOD_HOLDERS = [
    [
        "WorkItem",
        "methodologyId"
    ],
    [
        "WorkItemDraft",
        "methodologyId"
    ],
    [
        "QcRule",
        "methodologyId"
    ],
    [
        "BatchAnalyte",
        "methodologyId"
    ],
    [
        "LabPolicyOverride",
        "methodologyId"
    ],
    [
        "MethodRequirement",
        "methodId"
    ],
    [
        "EquipmentMethodEligibility",
        "methodId"
    ],
    [
        "Result",
        "methodologyId"
    ],
    [
        "LabMethodDefault",
        "methodologyId"
    ],
    [
        "CalcTemplate",
        "methodologyId"
    ],
    [
        "CalcTemplateActivation",
        "methodologyId"
    ],
    [
        "CalibrationCurve",
        "methodologyId"
    ],
    [
        "ControlLimitProposal",
        "methodologyId"
    ],
    [
        "ControlLimitSet",
        "methodologyId"
    ],
    [
        "ReferenceValue",
        "methodologyId"
    ],
    [
        "OrderLine",
        "methodologyId"
    ],
    [
        "ReportedValueSelection",
        "methodologyId"
    ],
    [
        "ResultOverrideRequest",
        "methodologyId"
    ]
];
const JSON_HOLDERS = [
    [
        "Analysis",
        "prerequisites"
    ],
    [
        "AnalysisGroup",
        "analyses"
    ],
    [
        "Sample",
        "requiredAnalyses"
    ],
    [
        "Sample",
        "history"
    ],
    [
        "WorkItem",
        "history"
    ],
    [
        "Batch",
        "history"
    ],
    [
        "BatchAnalyte",
        "criteriaSnapshot"
    ],
    [
        "BatchPositionReference",
        "referenceSnapshot"
    ],
    [
        "WorkAttempt",
        "rawData"
    ],
    [
        "WorkAttempt",
        "evidenceData"
    ],
    [
        "CalcTemplate",
        "inputs"
    ],
    [
        "CalcTemplate",
        "parameters"
    ],
    [
        "ResultCalculation",
        "inputs"
    ],
    [
        "ResultCalculation",
        "parameters"
    ],
    [
        "ResultCalculation",
        "intermediate"
    ],
    [
        "ReportedValueSelection",
        "qcRuleSnapshot"
    ],
    [
        "ReportedValueSelection",
        "evidenceSnapshot"
    ],
    [
        "ReportedValueSelection",
        "lineageSnapshot"
    ],
    [
        "ReportedValueSelection",
        "outputParams"
    ],
    [
        "ReportedValueSelection",
        "derivation"
    ],
    [
        "SampleAmendment",
        "impactAssessment"
    ],
    [
        "SampleAmendment",
        "requestPayload"
    ],
    [
        "ControlLimitProposal",
        "selectionSnapshot"
    ],
    [
        "ControlLimitProposal",
        "policySnapshot"
    ],
    [
        "QcEvaluation",
        "details"
    ],
    [
        "Report",
        "content"
    ]
];
const PARTNERS = {
    "baseSaturation": [],
    "nitrogenTotal": [
        "TN"
    ],
    "availableWaterHoldingCapacity": [
        "AWC"
    ],
    "carbonInorganic": [],
    "effectiveCec": [
        "ECEC"
    ],
    "totalElements": [
        "HM_CD",
        "HM_PB",
        "HM_AS",
        "HM_CR",
        "HM_NI",
        "HM_HG",
        "HM_CU",
        "HM_ZN",
        "HM_CO",
        "HM_SE",
        "HM_BA",
        "HM_V",
        "HM_MO",
        "HM_TL",
        "HM_SB",
        "HM_BE",
        "HM_SN",
        "HM_AG",
        "HM_U",
        "HM_TH"
    ],
    "solubleSalts": [],
    "totalCarbonateEquivalent": [
        "CACO3"
    ],
    "textureSum": [],
    "coarseFragments": [
        "COARSE_FRAG"
    ],
    "pH": [
        "PH_H2O",
        "PH_KCL",
        "PH_CACL2"
    ],
    "phosphorusRetention": [
        "P_RETENTION"
    ],
    "bulkDensityWholeSoil": [
        "BD_WHOLE"
    ],
    "cationExchangeCapacitySoil": [
        "CEC"
    ],
    "moistureContent": [
        "SOIL_MOISTURE",
        "VOL_MOISTURE"
    ],
    "electricalConductivity": [
        "EC",
        "EC_E"
    ],
    "exchangeableBases": [
        "EXCH_CA",
        "EXCH_MG",
        "EXCH_K",
        "EXCH_NA"
    ],
    "carbonOrganic": [
        "SOC"
    ],
    "acidityExchangeable": [
        "EXCH_ACID"
    ],
    "organicMatter": [
        "SOM"
    ],
    "bulkDensityFineEarth": [
        "BD_FINE"
    ],
    "hydraulicConductivity": [
        "K_SAT"
    ],
    "extractableElements": [
        "EXT_S",
        "EXT_ZN",
        "EXT_FE",
        "EXT_CU",
        "EXT_MN",
        "EXT_B",
        "EXT_MO",
        "EXT_CO",
        "EXT_SI"
    ],
    "carbonTotal": [],
    "pSA": [
        "SAND",
        "SILT",
        "CLAY"
    ]
};
const AUDIT_ENTITIES = ['ANALYSIS', 'METHODOLOGY', 'GROUP', 'WORKITEM', 'WORK_ITEM', 'QC_RULE', 'BATCH'];
const ACTOR = 'system:issue-424';

class Refusal extends Error {
    constructor(code, context = {}) { super(code); this.code = code; this.context = context; }
}
const quote = name => '"' + name.replace(/"/g, '""') + '"';
const hash = text => createHash('sha256').update(text).digest('hex');
const fileHash = filename => hash(fs.readFileSync(filename));
const totalSqlChanges = db => db.prepare('SELECT total_changes() AS n').get().n;

function schemaOf(db) {
    const tables = new Map();
    for (const { name } of db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
        tables.set(name, new Set(db.pragma(`table_info(${quote(name)})`).map(c => c.name)));
    }
    return tables;
}
function requireColumns(schema, table, columns) {
    for (const column of columns) {
        if (!schema.get(table)?.has(column)) throw new Refusal('MISSING_USAGE_HOLDER', { holder: `${table}.${column}` });
    }
}
function integrity(db) {
    if (db.pragma('integrity_check').some(row => Object.values(row)[0] !== 'ok')) throw new Refusal('INTEGRITY_CHECK_FAILED');
    if (db.pragma('foreign_key_check').length) throw new Refusal('FOREIGN_KEY_CHECK_FAILED');
    return { integrityCheck: 'ok', foreignKeyCheckRows: 0 };
}
function hitsIn(value, targets) {
    const found = new Set(), stack = [value];
    while (stack.length) {
        const next = stack.pop();
        if (typeof next === 'string') { if (targets.has(next)) found.add(next); }
        else if (Array.isArray(next)) stack.push(...next);
        else if (next && typeof next === 'object') {
            for (const [key, val] of Object.entries(next)) { if (targets.has(key)) found.add(key); stack.push(val); }
        }
    }
    return found;
}
function usage(db, schema) {
    const codes = RETIRE_CODES, methods = Object.keys(EXTRA_DEFAULTS), targets = new Set([...codes, ...methods]);
    const counts = {}, textRows = {};
    const add = (holder, key, count = 1) => {
        if (count) (counts[holder] ||= {})[key] = (counts[holder]?.[key] || 0) + count;
    };
    const scalar = (table, column, values, predicate = '') => {
        requireColumns(schema, table, [column]);
        const sql = `SELECT ${quote(column)} AS target, COUNT(*) AS n FROM ${quote(table)} WHERE ${quote(column)} IN (${values.map(() => '?').join(',')})${predicate ? ' AND ' + predicate : ''} GROUP BY ${quote(column)}`;
        for (const row of db.prepare(sql).all(...values)) add(`${table}.${column}${predicate ? ':' + predicate : ''}`, row.target, row.n);
    };
    const codeFields = new Map(CODE_HOLDERS.map(([t, c]) => [`${t}.${c}`, [t, c]]));
    const methodFields = new Map(METHOD_HOLDERS.map(([t, c]) => [`${t}.${c}`, [t, c]]));
    // Cover additional installed holders rather than silently ignoring schema drift.
    for (const [table, columns] of schema) for (const col of columns) {
        if (['analysisCode', 'analysis', 'param'].includes(col)) codeFields.set(`${table}.${col}`, [table, col]);
        if (['methodologyId', 'methodId'].includes(col)) methodFields.set(`${table}.${col}`, [table, col]);
    }
    for (const [table, col] of codeFields.values()) {
        // Methodology rows are retained definitions, not uses of a retired analysis.
        if (table === 'Methodology' && col === 'analysisCode') continue;
        scalar(table, col, codes);
    }
    for (const [table, col] of methodFields.values()) scalar(table, col, methods);
    requireColumns(schema, 'ExternalMapping', ['entityType', 'entityKey']);
    scalar('ExternalMapping', 'entityKey', codes, "UPPER(entityType)='ANALYSIS'");
    scalar('ExternalMapping', 'entityKey', methods, "UPPER(entityType)='METHODOLOGY'");
    const jsonFields = [...JSON_HOLDERS, ['AuditLog', 'before'], ['AuditLog', 'after']];
    for (const [table, col] of jsonFields) {
        requireColumns(schema, table, [col]);
        const where = table === 'AuditLog' ? ` AND entity IN (${AUDIT_ENTITIES.map(() => '?').join(',')})` : '';
        const sql = `SELECT ${quote(col)} AS body FROM ${quote(table)} WHERE ${quote(col)} IS NOT NULL AND ${quote(col)} != ''${where}`;
        for (const { body } of db.prepare(sql).iterate(...(table === 'AuditLog' ? AUDIT_ENTITIES : []))) {
            if (typeof body !== 'string' || Buffer.byteLength(body) > 4 * 1024 * 1024) throw new Refusal('UNREADABLE_USAGE_HOLDER', { holder: `${table}.${col}` });
            let parsed;
            try { parsed = JSON.parse(body); }
            catch {
                // Historical impact assessments can be plain prose, not encoded code arrays.
                // Encoded/malformed JSON remains a refusal; no payload is printed.
                if (table !== 'SampleAmendment' || col !== 'impactAssessment' || /[\[\]{}\\]/.test(body)) {
                    throw new Refusal('UNREADABLE_USAGE_HOLDER', { holder: `${table}.${col}` });
                }
                textRows[`${table}.${col}`] = (textRows[`${table}.${col}`] || 0) + 1;
                for (const target of targets) if (body.includes(target)) add(`${table}.${col}:plain-text`, target);
                continue;
            }
            for (const target of hitsIn(parsed, targets)) add(`${table}.${col}`, target);
        }
    }
    const usedBy = target => Object.entries(counts).filter(([, perTarget]) => perTarget[target]).map(([holder, perTarget]) => ({ holder, count: perTarget[target] }));
    return { counts, textRows, usedBy, checkedCodeHolders: [...codeFields.keys()].filter(x => x !== 'Methodology.analysisCode'), checkedMethodHolders: [...methodFields.keys()], checkedJsonHolders: jsonFields.map(([t, col]) => `${t}.${col}`) };
}
function makePlan(db) {
    const schema = schemaOf(db);
    requireColumns(schema, 'Analysis', ['code', 'status', 'labId']);
    requireColumns(schema, 'Methodology', ['id', 'analysisCode', 'labId', 'isDefault']);
    requireColumns(schema, 'AuditLog', ['id', 'entity', 'entityId', 'action', 'details', 'performedBy', 'timestamp', 'analysisCode', 'before', 'after']);
    const used = usage(db, schema), records = [], failures = [];
    const fail = (code, target, extra = {}) => failures.push({ code, target, ...extra });
    for (const [id, code] of Object.entries(EXTRA_DEFAULTS)) {
        const before = db.prepare('SELECT * FROM Methodology WHERE id=?').get(id);
        if (!before) { fail('METHOD_MISSING', id); continue; }
        if (before.analysisCode !== code) { fail('METHOD_ANALYSIS_MISMATCH', id); continue; }
        if (before.labId !== null) { fail('METHOD_NOT_GLOBAL', id); continue; }
        if (![0, 1].includes(before.isDefault)) { fail('INVALID_DEFAULT_FLAG', id); continue; }
        const already = before.isDefault === 0;
        const count = db.prepare('SELECT COUNT(*) AS n FROM Methodology WHERE analysisCode=? AND labId IS NULL AND isDefault=1').get(code).n;
        if (count !== (already ? 1 : 2)) fail('UNEXPECTED_GLOBAL_DEFAULT_COUNT', id, { expected: already ? 1 : 2, actual: count });
        if (!already && used.usedBy(id).length) fail('METHOD_IN_USE', id, { holders: used.usedBy(id) });
        records.push({ step: 'A', table: 'Methodology', target: id, analysisCode: code, state: already ? 'already_done' : 'planned', before, after: { ...before, isDefault: 0 } });
    }
    for (const code of RETIRE_CODES) {
        const before = db.prepare('SELECT * FROM Analysis WHERE code=?').get(code);
        if (!before) { fail('ANALYSIS_MISSING', code); continue; }
        if (before.labId !== null) { fail('ANALYSIS_NOT_GLOBAL', code); continue; }
        if (!['active', 'inactive'].includes(before.status)) { fail('UNEXPECTED_ANALYSIS_STATUS', code); continue; }
        const already = before.status === 'inactive';
        if (!already && used.usedBy(code).length) fail('ANALYSIS_IN_USE', code, { holders: used.usedBy(code) });
        records.push({ step: 'B', table: 'Analysis', target: code, analysisCode: code, state: already ? 'already_done' : 'planned', before, after: { ...before, status: 'inactive' } });
    }
    const definitions = db.prepare(`SELECT * FROM Methodology WHERE analysisCode IN (${RETIRE_CODES.map(() => '?').join(',')}) ORDER BY id`).all(...RETIRE_CODES);
    return { records, failures, usageCounts: used.counts, plainTextAssessmentRows: used.textRows, checkedCodeHolders: used.checkedCodeHolders, checkedMethodHolders: used.checkedMethodHolders, checkedJsonHolders: used.checkedJsonHolders, retainedMethodDefinitions: { rows: definitions.length, sha256: hash(JSON.stringify(definitions)) } };
}
function open(filename, readonly) {
    const db = new Database(filename, { readonly, fileMustExist: true, timeout: 5000 });
    db.pragma('foreign_keys = ON');
    return db;
}
function readPlan(filename, apply) {
    const db = open(filename, true);
    try {
        // Read-only preflight avoids a writable connection checkpointing an existing WAL on refusal.
        db.exec(apply ? 'BEGIN' : 'BEGIN IMMEDIATE');
        const health = integrity(db), plan = makePlan(db);
        db.exec('ROLLBACK');
        return { ...plan, ...health };
    } finally { if (db.inTransaction) db.exec('ROLLBACK'); db.close(); }
}
function listPackages(filename) {
    const db = open(filename, true);
    try {
        db.exec('BEGIN IMMEDIATE');
        const schema = schemaOf(db);
        requireColumns(schema, 'AnalysisGroup', ['id', 'name', 'labId', 'analyses']);
        requireColumns(schema, 'Lab', ['id', 'name']);
        const packages = [];
        for (const group of db.prepare('SELECT id,name,labId,analyses FROM AnalysisGroup ORDER BY id').iterate()) {
            let codes;
            try { codes = JSON.parse(group.analyses); } catch { throw new Refusal('UNREADABLE_PACKAGE'); }
            if (!Array.isArray(codes) || codes.some(c => typeof c !== 'string')) throw new Refusal('UNREADABLE_PACKAGE');
            const legacy = codes.filter(code => Object.hasOwn(PARTNERS, code));
            if (!legacy.length) continue;
            const lab = group.labId ? db.prepare('SELECT name FROM Lab WHERE id=?').get(group.labId) : null;
            packages.push({ id: group.id, name: group.name, scope: group.labId ? 'LAB' : 'GLOBAL', labId: group.labId, labName: lab?.name || null,
                legacy: legacy.map(code => ({ code, proposedPartners: PARTNERS[code], partnersAlreadyInPackage: PARTNERS[code].filter(p => codes.includes(p)) })) });
        }
        requireColumns(schema, 'OrderLine', ['id', 'analysis', 'status', 'revisionId']);
        requireColumns(schema, 'SampleOrderRevision', ['id', 'sampleId']);
        requireColumns(schema, 'Sample', ['id', 'labId', 'assignedLab']);
        const orderLines = db.prepare(`SELECT line.id,line.status,line.revisionId,rev.sampleId,s.labId AS sampleLabNumber,s.assignedLab
            FROM OrderLine line LEFT JOIN SampleOrderRevision rev ON rev.id=line.revisionId LEFT JOIN Sample s ON s.id=rev.sampleId
            WHERE line.analysis='pSA' ORDER BY line.id`).all();
        db.exec('ROLLBACK');
        return { ok: true, issue: 424, mode: 'LIST_PACKAGES', totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: totalSqlChanges(db), packages, pSAOrderLines: orderLines,
            qualification: 'Read-only operational identifiers for the package decision. No automatic mapping or publication.' };
    } finally { if (db.inTransaction) db.exec('ROLLBACK'); db.close(); }
}
function execute({ dbPath, apply = false, listOnly = false }) {
    const receipt = { ok: false, issue: 424, mode: listOnly ? 'LIST_PACKAGES' : apply ? 'APPLY' : 'DRY_RUN', totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0 };
    let db;
    try {
        if (!dbPath || (apply && listOnly)) throw new Refusal('INVALID_ARGUMENTS');
        const filename = path.resolve(dbPath);
        if (!fs.statSync(filename).isFile()) throw new Refusal('DATABASE_FILE_REQUIRED');
        receipt.databaseBeforeSha256 = fileHash(filename);
        if (listOnly) return listPackages(filename);
        const preflight = readPlan(filename, apply);
        Object.assign(receipt, preflight, { plannedChanges: preflight.records.filter(r => r.state === 'planned').length });
        if (preflight.failures.length) return { ...receipt, error: { code: 'PRECONDITION_FAILED' }, databaseAfterSha256: fileHash(filename) };
        if (!apply || !receipt.plannedChanges) return { ...receipt, ok: true, databaseAfterSha256: fileHash(filename) };
        db = open(filename, false);
        db.exec('BEGIN IMMEDIATE');
        const plan = makePlan(db);
        if (plan.failures.length) throw new Refusal('PRECONDITION_FAILED', { failures: plan.failures });
        const beforeChanges = totalSqlChanges(db), auditsBefore = db.prepare('SELECT COUNT(*) AS n FROM AuditLog').get().n;
        for (const row of plan.records) {
            if (row.state === 'already_done') continue;
            const changed = row.step === 'A'
                ? db.prepare('UPDATE Methodology SET isDefault=0 WHERE id=? AND analysisCode=? AND labId IS NULL AND isDefault=1').run(row.target, row.analysisCode)
                : db.prepare("UPDATE Analysis SET status='inactive' WHERE code=? AND status='active' AND labId IS NULL").run(row.target);
            if (changed.changes !== 1) throw new Refusal('TARGET_CHANGED', { target: row.target });
            const after = db.prepare(`SELECT * FROM ${row.table} WHERE ${row.step === 'A' ? 'id' : 'code'}=?`).get(row.target);
            if (JSON.stringify(after) !== JSON.stringify(row.after)) throw new Refusal('UNEXPECTED_TARGET_CHANGE', { target: row.target });
            db.prepare(`INSERT INTO AuditLog(id,entity,entityId,action,details,performedBy,timestamp,analysisCode,before,after)
                VALUES(?,?,?,?,?,?,?,?,?,?)`).run(randomUUID(), row.step === 'A' ? 'METHODOLOGY' : 'ANALYSIS', row.target, 'UPDATE',
                JSON.stringify({ issue: 424, step: row.step }), ACTOR, new Date().toISOString(), row.analysisCode, JSON.stringify(row.before), JSON.stringify(after));
        }
        const post = makePlan(db);
        if (post.failures.length || post.records.some(row => row.state !== 'already_done')) throw new Refusal('POSTCONDITION_FAILED');
        if (post.retainedMethodDefinitions.sha256 !== plan.retainedMethodDefinitions.sha256) throw new Refusal('RETAINED_METHODS_CHANGED');
        const changedCount = plan.records.filter(r => r.state === 'planned').length;
        const auditRowsCreated = db.prepare('SELECT COUNT(*) AS n FROM AuditLog').get().n - auditsBefore;
        const sqliteTotalChanges = totalSqlChanges(db) - beforeChanges;
        if (auditRowsCreated !== changedCount || sqliteTotalChanges !== changedCount + auditRowsCreated) throw new Refusal('UNEXPECTED_WRITE_COUNT');
        const health = integrity(db);
        db.exec('COMMIT');
        Object.assign(receipt, plan, health, { ok: true, records: plan.records.map(row => ({ ...row, state: row.state === 'planned' ? 'changed' : row.state })), totalChanges: changedCount, auditRowsCreated, sqliteTotalChanges,
            retainedMethodDefinitions: post.retainedMethodDefinitions, countQualification: 'totalChanges counts target records; AuditLog inserts and physical SQLite changes are separate.' });
        return receipt;
    } catch (error) {
        if (db?.inTransaction) db.exec('ROLLBACK');
        return { ...receipt, ok: false, totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0, rolledBack: Boolean(db), error: error instanceof Refusal ? { code: error.code, ...error.context } : { code: error.code || 'SCRIPT_FAILED' } };
    } finally { if (db) db.close(); }
}
function cli(args) {
    let dbPath, apply = false, listOnly = false;
    try {
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--db' && args[i + 1] && !dbPath) dbPath = args[++i];
            else if (args[i] === '--apply' && !apply) apply = true;
            else if (args[i] === '--list-packages' && !listOnly) listOnly = true;
            else throw new Refusal('INVALID_ARGUMENTS');
        }
        return execute({ dbPath, apply, listOnly });
    } catch (error) { return { ok: false, issue: 424, totalChanges: 0, auditRowsCreated: 0, sqliteTotalChanges: 0, error: { code: error.code || 'INVALID_ARGUMENTS' } }; }
}
module.exports = { execute, cli, EXTRA_DEFAULTS, RETIRE_CODES, CODE_HOLDERS, METHOD_HOLDERS, JSON_HOLDERS, PARTNERS };
if (require.main === module) {
    const receipt = cli(process.argv.slice(2));
    process.stdout.write(JSON.stringify(receipt, null, 2) + '\n');
    process.exitCode = receipt.ok ? 0 : 1;
}
