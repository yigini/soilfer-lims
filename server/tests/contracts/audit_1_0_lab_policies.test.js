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
        ['qc.westgardRules', { reject: ['1-3s'], warn: ['1-3s'] }], ['qc.runProfiles', { tray: { name: 'Tray', capacity: 2, qcSlots: [{ position: 3, type: 'BLANK', label: 'Blank' }] } }]])('invalid %s returns 400 without writes', async (key, value) => {
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
});

describe('Audit 1.0: registry and pure evaluator defaults', () => {
    test('every preset validates every key and retains shipped physical profiles', () => {
        for (const [key, d] of Object.entries(registry)) for (const value of Object.values(d.presets)) expect(valid(key, value)).toBe(true);
        expect(policy.getStrict('qc.runProfiles')).toEqual(DEFAULT_RUN_PROFILES);
        expect(evaluateBlank({ value: .04 }).status).toBe('PASS');
        expect(evaluateControl({ expected: 100, measured: 95 }).status).toBe('PASS');
        expect(evaluateDuplicate({ value1: 100, value2: 100 }).status).toBe('PASS');
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
