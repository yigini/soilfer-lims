const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const policy = require('../../services/policyService');
const { registry, valid, DEFAULT_RUN_PROFILES } = require('../../config/policyRegistry');
const { getAuthToken } = require('../setup');
const { getNumberFormat } = require('../../services/numberFormatService');
const { evaluateBlank, evaluateControl, evaluateDuplicate } = require('../../services/qcService');
const id = prefix => `${prefix}-${crypto.randomUUID()}`;

describe('Audit 1.0: persistent lab policies', () => {
    let labId, manager, actor, technician, analysisCode, methodologyId;
    beforeEach(async () => {
        labId = id('POL-LAB');
        await prisma.lab.create({ data: { id: labId, code: id('CODE'), name: 'Policy laboratory', country: 'GTM' } });
        manager = await getAuthToken('LAB_MANAGER', labId); actor = jwt.decode(manager);
        technician = await getAuthToken('LAB_TECHNICIAN', labId);
        analysisCode = id('POL-ANALYSIS'); methodologyId = id('POL-METHOD');
        await prisma.analysis.create({ data: { code: analysisCode, name: 'Policy analysis' } });
        await prisma.methodology.create({ data: { id: methodologyId, analysisCode, name: 'Policy method' } });
    });
    const edit = (changes, extra = {}) => policy.change(actor, labId, { changes, reason: 'Laboratory approved policy', ...extra });
    test('untouched lab defines every key and does not create a policy row', async () => {
        const current = await policy.snapshot(labId);
        expect(current.version).toBe(0); expect(current.presetCode).toBeNull();
        for (const key of Object.keys(registry)) {
            expect(current.values[key]).not.toBeUndefined();
            expect(await policy.get(labId, key)).toEqual(registry[key].presets.ISO17025_STRICT);
        }
        expect(await prisma.labPolicy.count({ where: { labId } })).toBe(0);
        const lab = await prisma.lab.findUnique({ where: { id: labId } });
        expect(await policy.get(lab.code, 'qc.mode')).toBe('REQUIRED_BLOCKING');
    });
    test('resolution follows method, analysis, lab, preset, profile, Strict', async () => {
        const profile = { preset: 'BASIC', overrides: { 'qc.duplicateMaxRpd': 22 } };
        const options = { profile }, context = { profile, analysisCode, methodologyId };
        expect(await policy.get(labId, 'qc.duplicateMaxRpd')).toBe(10);
        expect(await policy.get(labId, 'qc.duplicateMaxRpd', context)).toBe(22);
        await policy.change(actor, labId, { presetCode: 'ADVISORY', reason: 'Preset choice' }, options);
        expect(await policy.get(labId, 'qc.duplicateMaxRpd', context)).toBe(10);
        await policy.change(actor, labId, { changes: [{ key: 'qc.duplicateMaxRpd', value: 12 }], reason: 'Lab limit' }, options);
        expect(await policy.get(labId, 'qc.duplicateMaxRpd', context)).toBe(12);
        await policy.change(actor, labId, { changes: [{ key: 'qc.duplicateMaxRpd', value: 13, analysisCode }], reason: 'Analysis limit' }, options);
        expect((await policy.resolve(labId, 'qc.duplicateMaxRpd', context)).source).toBe('ANALYSIS_OVERRIDE');
        expect(await policy.get(labId, 'qc.duplicateMaxRpd', context)).toBe(13);
        await policy.change(actor, labId, { changes: [{ key: 'qc.duplicateMaxRpd', value: 14, analysisCode, methodologyId }], reason: 'Method limit' }, options);
        expect(await policy.resolve(labId, 'qc.duplicateMaxRpd', context)).toMatchObject({ value: 14, source: 'METHOD_OVERRIDE', version: 4, scope: { analysisCode, methodologyId } });
        expect(await policy.get(labId, 'qc.duplicateMaxRpd', { profile, analysisCode })).toBe(13);
        expect(await policy.get(labId, 'qc.duplicateMaxRpd', { profile })).toBe(12);
    });
    test('first override preserves profile inheritance, explicit preset wins, reset restores inheritance and preserves overrides', async () => {
        const options = { profile: { preset: 'BASIC', overrides: { 'bench.idleLockMinutes': 27 } } };
        const first = await policy.change(actor, labId, { changes: [{ key: 'qc.duplicateMaxRpd', value: 17 }], reason: 'First override' }, options);
        expect(first).toMatchObject({ version: 1, presetCode: null }); expect(first.values['bench.idleLockMinutes']).toBe(27);
        const explicit = await policy.change(actor, labId, { presetCode: 'ISO17025_STRICT', reason: 'Accreditation' }, options);
        expect(explicit.values['bench.idleLockMinutes']).toBe(5);
        const inherited = await policy.change(actor, labId, { presetCode: null, reason: 'Restore deployment policy' }, options);
        expect(inherited.values['bench.idleLockMinutes']).toBe(27); expect(inherited.values['qc.duplicateMaxRpd']).toBe(17);
        expect(await prisma.labPolicyOverride.count({ where: { labId, revokedAt: null } })).toBe(1);
    });
    test('changes append immutable overrides, increment once and write one reasoned before/after audit', async () => {
        await edit([{ key: 'qc.duplicateMaxRpd', value: 12 }], { expectedVersion: 0 });
        const old = await prisma.labPolicyOverride.findFirst({ where: { labId } });
        const second = await edit([{ key: 'qc.duplicateMaxRpd', value: 13 }], { expectedVersion: 1 });
        expect(second.version).toBe(2);
        const historical = await prisma.labPolicyOverride.findUnique({ where: { id: old.id } });
        expect(historical).toMatchObject({ value: old.value, reason: old.reason, setBy: old.setBy, setAt: old.setAt });
        expect(historical.revokedAt).toBeInstanceOf(Date);
        const logs = await prisma.auditLog.findMany({ where: { labId, action: 'UPDATE_POLICY' }, orderBy: { timestamp: 'asc' } });
        expect(logs).toHaveLength(2);
        expect(JSON.parse(logs[1].before).values['qc.duplicateMaxRpd']).toBe(12);
        expect(JSON.parse(logs[1].after).values['qc.duplicateMaxRpd']).toBe(13);
        expect(JSON.parse(logs[1].details)).toMatchObject({ reason: 'Laboratory approved policy', policyVersion: 2 });
        await expect(edit([{ key: 'qc.duplicateMaxRpd', value: 14 }], { expectedVersion: 1 })).rejects.toMatchObject({ statusCode: 409, code: 'POLICY_VERSION_CONFLICT' });
        expect(await prisma.auditLog.count({ where: { labId } })).toBe(2);
    });
    test.each([['qc.maxBatchSize', -1], ['qc.duplicateEvery', 0.5], ['qc.mode', 'UNKNOWN'], ['numbers.decimalSeparator', ';'],
        ['qc.westgardRules', { reject: ['1-3s'], warn: ['1-3s'] }], ['qc.runProfiles', { tray: { name: 'Tray', capacity: 2, qcSlots: [{ position: 3, type: 'BLANK', label: 'Blank' }] } }],
        ['qc.runProfiles', { tray: { name: 'Tray', capacity: 2, qcSlots: [null] } }], ['qc.runProfiles', { tray: { name: 'Tray', capacity: 2, qcSlots: [] } }]])('invalid %s returns 400 without writes', async (key, value) => {
        const result = await request(app).patch(`/api/labs/${labId}/policies`).set('Authorization', `Bearer ${manager}`).send({ reason: 'Invalid value', expectedVersion: 0, changes: [{ key, value }] });
        expect(result.status).toBe(400); expect(result.body.code).toBe('POLICY_VALUE_INVALID');
        expect(await prisma.labPolicy.count({ where: { labId } })).toBe(0); expect(await prisma.auditLog.count({ where: { labId } })).toBe(0);
    });
    test('missing reason refuses; analysis-only works; invalid methodology and lab-only scopes refuse', async () => {
        await expect(edit([{ key: 'qc.mode', value: 'ADVISORY' }], { reason: '' })).rejects.toMatchObject({ statusCode: 400, code: 'POLICY_REASON_REQUIRED' });
        await edit([{ key: 'qc.mode', value: 'ADVISORY', analysisCode }]);
        await expect(edit([{ key: 'qc.mode', value: 'OFF', methodologyId }])).rejects.toMatchObject({ statusCode: 422, code: 'POLICY_SCOPE_INVALID' });
        await expect(edit([{ key: 'qc.mode', value: 'OFF', analysisCode, methodologyId: 'foreign' }])).rejects.toMatchObject({ code: 'POLICY_SCOPE_INVALID' });
        await expect(edit([{ key: 'numbers.decimalSeparator', value: ',', analysisCode }])).rejects.toMatchObject({ code: 'POLICY_SCOPE_INVALID' });
    });
    test('lab scope isolation and technician read-only permission apply to API and service', async () => {
        const foreign = id('FOREIGN'); await prisma.lab.create({ data: { id: foreign, code: foreign, name: foreign, country: 'GTM' } });
        await edit([], { presetCode: 'ADVISORY' });
        expect(await policy.get(labId, 'qc.mode')).toBe('ADVISORY'); expect(await policy.get(foreign, 'qc.mode')).toBe('REQUIRED_BLOCKING');
        expect((await request(app).get(`/api/labs/${labId}/policies`).set('Authorization', `Bearer ${technician}`)).body.canEdit).toBe(false);
        expect((await request(app).patch(`/api/labs/${labId}/policies`).set('Authorization', `Bearer ${technician}`).send({ presetCode: 'BASIC', reason: 'No permission' })).status).toBe(403);
        expect((await request(app).get(`/api/labs/${foreign}/policies`).set('Authorization', `Bearer ${manager}`)).status).toBe(403);
        await expect(policy.change(actor, foreign, { presetCode: 'BASIC', reason: 'Foreign change' })).rejects.toMatchObject({ statusCode: 403 });
    });
    test('profile editor writes policies, keeps compatibility metadata, requires reason and rejects stale version', async () => {
        const patch = body => request(app).patch(`/api/labs/${labId}/profile`).set('Authorization', `Bearer ${manager}`).send(body);
        expect((await patch({ decimalSeparator: ',' })).body.code).toBe('POLICY_REASON_REQUIRED');
        expect((await patch({ decimalSeparator: ',', thousandsSeparator: '.', reason: 'Local number format', expectedVersion: 0 })).status).toBe(200);
        expect(await getNumberFormat(labId)).toEqual({ decimal: ',', thousands: '.' });
        expect(await prisma.auditLog.count({ where: { labId } })).toBe(1);
        await prisma.lab.update({ where: { id: labId }, data: { settings: '{"decimalSeparator":".","thousandsSeparator":null}' } });
        expect(await getNumberFormat(labId)).toEqual({ decimal: ',', thousands: '.' });
        expect((await patch({ decimalSeparator: '.', thousandsSeparator: null, reason: 'Stale editor', expectedVersion: 0 })).body.code).toBe('POLICY_VERSION_CONFLICT');
        expect(await getNumberFormat(labId)).toEqual({ decimal: ',', thousands: '.' });
    });
    test('legacy migration is dry-run by default, additive, inherited and idempotent', async () => {
        const { migrateLegacyNumberPolicies } = require('../../scripts/migrate_legacy_number_policies');
        const untouched = id('UNTOUCHED'); await prisma.lab.create({ data: { id: untouched, code: untouched, name: untouched, country: 'GTM' } });
        const settings = '{"language":"fr","decimalSeparator":",","thousandsSeparator":"."}';
        await prisma.lab.update({ where: { id: labId }, data: { settings } });
        const db = { ...prisma, lab: { ...prisma.lab, findMany: options => prisma.lab.findMany({ ...options, where: { id: { in: [labId, untouched] } } }) } };
        const dry = await migrateLegacyNumberPolicies({ db });
        expect(dry).toMatchObject({ mode: 'DRY_RUN', counts: { labsScanned: 2, labsToChange: 1, inheritedRowsToCreate: 1, explicitRowsToCreate: 0, overridesToCreate: 2, invalidLabs: 0 } });
        expect(await prisma.labPolicy.count({ where: { labId } })).toBe(0);
        const applied = await migrateLegacyNumberPolicies({ db, apply: true });
        expect(applied.auditRowsCreated).toBe(1);
        expect(await prisma.labPolicy.findUnique({ where: { labId } })).toMatchObject({ presetCode: null, version: 1 });
        expect(await prisma.labPolicy.count({ where: { labId: untouched } })).toBe(0);
        expect((await prisma.lab.findUnique({ where: { id: labId } })).settings).toBe(settings);
        expect(await getNumberFormat(labId)).toEqual({ decimal: ',', thousands: '.' });
        expect((await migrateLegacyNumberPolicies({ db })).counts).toMatchObject({ labsToChange: 0, overridesToCreate: 0, existingKeysSkipped: 2 });
        expect((await migrateLegacyNumberPolicies({ db, apply: true })).auditRowsCreated).toBe(0);
        const row = await prisma.labPolicyOverride.findFirst({ where: { labId } });
        expect(row.reason).toBe('migrated from Lab.settings');
    });
    test('audit write failure rolls back version, revocation and replacement together', async () => {
        await edit([{ key: 'qc.duplicateMaxRpd', value: 12 }]);
        const previous = await prisma.labPolicyOverride.findFirst({ where: { labId } });
        const originalTransaction = prisma.$transaction.bind(prisma);
        const fail = jest.spyOn(prisma, '$transaction').mockImplementationOnce(fn => originalTransaction(tx => fn({ ...tx,
            auditLog: { ...tx.auditLog, create: async () => { throw new Error('Simulated audit storage failure'); } } })));
        try { await expect(edit([{ key: 'qc.duplicateMaxRpd', value: 13 }])).rejects.toThrow('Simulated audit storage failure'); }
        finally { fail.mockRestore(); }
        expect((await policy.snapshot(labId)).version).toBe(1);
        expect(await prisma.labPolicyOverride.findUnique({ where: { id: previous.id } })).toEqual(previous);
        expect(await prisma.labPolicyOverride.count({ where: { labId } })).toBe(1);
        expect(await prisma.auditLog.count({ where: { labId } })).toBe(1);
    });
    test('Policies number override and clear share the write-only rollback copy and one audit', async () => {
        await prisma.lab.update({ where: { id: labId }, data: { settings: '{ "language": "fr", "unrelated": 42 }' } });
        await edit([{ key: 'numbers.decimalSeparator', value: ',' }]);
        let lab = await prisma.lab.findUnique({ where: { id: labId } });
        expect(JSON.parse(lab.settings)).toEqual({ language: 'fr', unrelated: 42, decimalSeparator: ',', thousandsSeparator: null });
        const log = await prisma.auditLog.findFirst({ where: { labId } });
        expect(JSON.parse(log.details).compatibilityCopy).toMatchObject({ written: true, after: { decimalSeparator: ',', thousandsSeparator: null } });
        await edit([{ key: 'numbers.decimalSeparator', clear: true }]);
        lab = await prisma.lab.findUnique({ where: { id: labId } });
        expect(JSON.parse(lab.settings)).toEqual({ language: 'fr', unrelated: 42, decimalSeparator: '.', thousandsSeparator: null });
        expect(await prisma.auditLog.count({ where: { labId } })).toBe(2); expect((await policy.snapshot(labId)).version).toBe(2);
    });
    test('a frozen parsing decision keeps both separators from its policy version', async () => {
        await edit([{ key: 'numbers.decimalSeparator', value: ',' }, { key: 'numbers.thousandsSeparator', value: '.' }]);
        const recorded = await policy.snapshot(labId);
        await edit([{ key: 'numbers.decimalSeparator', value: '.' }, { key: 'numbers.thousandsSeparator', value: ',' }]);
        expect(await getNumberFormat(labId, { snapshot: recorded })).toEqual({ decimal: ',', thousands: '.' });
        expect(await getNumberFormat(labId)).toEqual({ decimal: '.', thousands: ',' });
        expect(recorded.version).toBe(1);
    });
    test('preset change copies an altered inherited format and leaves unchanged settings byte-identical', async () => {
        const settings = '{ "language": "fr", "decimalSeparator": ",", "thousandsSeparator": null }';
        await prisma.lab.update({ where: { id: labId }, data: { settings } });
        const options = { profile: { overrides: { 'numbers.decimalSeparator': ',' } } };
        await policy.change(actor, labId, { presetCode: 'BASIC', reason: 'Preset replaces profile' }, options);
        const copied = (await prisma.lab.findUnique({ where: { id: labId } })).settings;
        expect(JSON.parse(copied)).toEqual({ language: 'fr', decimalSeparator: '.', thousandsSeparator: null });
        await policy.change(actor, labId, { presetCode: 'ADVISORY', reason: 'Same number format' }, options);
        expect((await prisma.lab.findUnique({ where: { id: labId } })).settings).toBe(copied);
        await policy.change(actor, labId, { presetCode: null, reason: 'Restore profile format' }, options);
        expect(JSON.parse((await prisma.lab.findUnique({ where: { id: labId } })).settings).decimalSeparator).toBe(',');
    });
    test.each(['not-json', '[]', 'null', ''])('malformed settings %s fail with no policy, audit or legacy writes', async settings => {
        await prisma.lab.update({ where: { id: labId }, data: { settings } });
        await expect(edit([{ key: 'numbers.decimalSeparator', value: ',' }])).rejects.toMatchObject({ statusCode: 409, code: 'LAB_SETTINGS_INVALID' });
        expect((await prisma.lab.findUnique({ where: { id: labId } })).settings).toBe(settings);
        expect(await prisma.labPolicy.count({ where: { labId } })).toBe(0); expect(await prisma.labPolicyOverride.count({ where: { labId } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { labId } })).toBe(0);
    });
    test('reported-value export stores the exact resolved version and selection rule without changing old selections', async () => {
        const sampleId = id('POL-EXPORT'), project = id('POL-PROJECT');
        await edit([{ key: 'results.reportedValueRule', value: 'LATEST_VALID' }]);
        await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, assignedLab: labId, projectCode: project, status: 'APPROVED', requiredAnalyses: '["SOC"]' } });
        await prisma.workItem.create({ data: { id: id('POL-EXPORT-WI'), sampleId, assignedLab: labId, analysis: 'SOC', status: 'ACCEPTED', result: '9999' } });
        for (const value of [10, 20]) await prisma.result.create({ data: { id: id('POL-EXPORT-RES'), sampleId, param: 'SOC', value: String(value), unit: 'g/kg', isValid: true, isCurrent: true,
            createdAt: new Date(`2026-10-0${value / 10}T12:00:00Z`) } });
        const response = await request(app).post('/api/exports/data').set('Authorization', `Bearer ${manager}`).send({ type: 'WET_CHEM', project });
        expect(response.status).toBe(200); expect(response.body.data[0].SOC).toBe(20);
        expect(response.body.meta.selectionPolicies).toEqual([expect.objectContaining({ labId, version: 1, rule: 'LATEST_VALID', source: 'LAB_OVERRIDE' })]);
        const log = await prisma.auditLog.findUnique({ where: { id: response.body.meta.exportId } });
        expect(JSON.parse(log.details).selectionPolicies[0]).toMatchObject({ labId, version: 1, rule: 'LATEST_VALID' });
        await edit([{ key: 'results.reportedValueRule', value: 'MEAN_IF_WITHIN_R' }]);
        expect(await prisma.auditLog.findUnique({ where: { id: log.id } })).toEqual(log);
    });
    test('QC evaluates persisted lab and method limits and leaves old evaluations unchanged on a policy edit', async () => {
        const batch = await prisma.batch.create({ data: { id: id('POL-BATCH'), labId, analysis: analysisCode, profile: 'RACK_40', status: 'OPEN', createdBy: 'fixture' } });
        const sampleId = id('POL-SAMPLE');
        await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, assignedLab: labId, status: 'PROCESSING' } });
        await prisma.workItem.create({ data: { id: id('POL-WORK'), sampleId, assignedLab: labId, analysis: analysisCode, methodologyId, batchId: batch.id, status: 'COMPLETED' } });
        await edit([{ key: 'qc.blankMaxAllowed', value: .2 }, { key: 'qc.controlMinRecovery', value: 80 },
            { key: 'qc.controlMaxRecovery', value: 120 }, { key: 'qc.duplicateMaxRpd', value: 30, analysisCode, methodologyId }]);
        const response = await request(app).post(`/api/qc/batches/${batch.id}/evaluate`).set('Authorization', `Bearer ${technician}`)
            .send({ blanks: [{ value: '0.1' }], controls: [{ expected: '100', measured: '85' }], duplicates: [{ value1: '100', value2: '120' }] });
        expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 });
        const evaluated = await prisma.batch.findUnique({ where: { id: batch.id } });
        expect(JSON.parse(evaluated.qcResults)).toMatchObject({ overallStatus: 'QC_PASS', policyVersion: 1,
            policyValues: { 'qc.blankMaxAllowed': .2, 'qc.controlMinRecovery': 80, 'qc.controlMaxRecovery': 120, 'qc.duplicateMaxRpd': 30 } });
        const typed = await prisma.batchQcResult.findMany({ where: { batchId: batch.id }, orderBy: { id: 'asc' } });
        await edit([{ key: 'qc.blankMaxAllowed', value: .01 }]);
        expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(evaluated);
        expect(await prisma.batchQcResult.findMany({ where: { batchId: batch.id }, orderBy: { id: 'asc' } })).toEqual(typed);
    });
    test('batch creation uses the lab tray layout and keeps analytical batch size separate', async () => {
        const profiles = { CUSTOM: { name: 'Small tray', capacity: 7, qcSlots: [{ position: 2, type: 'BLANK', label: 'Blank' }] } };
        await edit([{ key: 'qc.runProfiles', value: profiles }, { key: 'qc.maxBatchSize', value: 1 }]);
        const response = await request(app).post('/api/qc/batches').set('Authorization', `Bearer ${technician}`)
            .send({ analysis: analysisCode, profile: 'CUSTOM' });
        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ profile: 'CUSTOM', maxCapacity: 7 });
    });
    test('report generation freezes the lab policy version and content across later changes', async () => {
        const sampleId = id('POL-REPORT');
        await edit([], { presetCode: 'ADVISORY' });
        await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId, status: 'APPROVED' } });
        await prisma.workItem.create({ data: { id: id('POL-REPORT-WI'), sampleId, assignedLab: labId, analysis: 'PH_H2O', status: 'ACCEPTED', result: '7.2' } });
        await prisma.result.create({ data: { id: id('POL-REPORT-RES'), sampleId, param: 'PH_H2O', value: '7.2', numericValue: 7.2, isValid: true, isCurrent: true } });
        const response = await request(app).post(`/api/reports/generate/${sampleId}`).set('Authorization', `Bearer ${manager}`).send({});
        expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 });
        const report = await prisma.report.findFirst({ where: { sampleId } });
        expect(report.policyVersion).toBe(1); expect(JSON.parse(report.content).policy).toMatchObject({ version: 1, presetCode: 'ADVISORY' });
        await edit([], { presetCode: 'BASIC' });
        expect(await prisma.report.findUnique({ where: { id: report.id } })).toEqual(report);
    });
});

describe('Audit 1.0: registry and pure evaluator defaults', () => {
    test('every preset validates every key and retains shipped physical profiles', () => {
        for (const [key, d] of Object.entries(registry)) for (const value of Object.values(d.presets)) expect(valid(key, value)).toBe(true);
        expect(policy.getStrict('qc.runProfiles')).toEqual(DEFAULT_RUN_PROFILES);
        expect(evaluateBlank({ value: .04 }).status).toBe('PASS');
        expect(evaluateControl({ expected: 100, measured: 95 }).status).toBe('PASS');
        expect(evaluateDuplicate({ value1: 100, value2: 100 }).status).toBe('PASS');
        const { resolveRunProfile } = require('../../controllers/qcController');
        expect(resolveRunProfile('SOC', '', null, 'toString').profileKey).toBe('RACK_40');
    });
    test('QC consumers contain no inline acceptance limits', () => {
        const fs = require('fs'), path = require('path');
        for (const filename of ['services/qcService.js', 'controllers/qcController.js']) {
            const source = fs.readFileSync(path.resolve(__dirname, '../..', filename), 'utf8');
            expect(source).not.toMatch(/\b0\.05\b|\b90(?:\.0)?\b|\b110(?:\.0)?\b/);
            expect(source).not.toMatch(/(?:maxRpd|RPD)\s*[:=][^\n]*\b10\b/);
        }
    });
});
