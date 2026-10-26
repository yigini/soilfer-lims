const { randomUUID } = require('node:crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const db = require('../../prisma');
const policies = require('../../services/policyService');
const { JWT_SECRET } = require('../../config/auth');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { SCHEMA_VERSION, readMethodContexts, methodQuality, censoringFields } = require('../../services/exchangeObservationQuality');

describe('optional procedure quality representation', () => {
    const method = { lod: 0.5, loq: 1.5, uncertainty: 0.8 };
    test('known fields and zeros are retained; each missing amount is omitted', () => {
        expect(methodQuality({ method }, 'g/kg')).toEqual({ limitOfDetection: { value: 0.5, unit: 'g/kg' },
            limitOfQuantification: { value: 1.5, unit: 'g/kg' } });
        for (const field of ['lod', 'loq']) {
            const key = field === 'lod' ? 'limitOfDetection' : 'limitOfQuantification';
            expect(methodQuality({ method: { ...method, [field]: null } }, 'g/kg')).not.toHaveProperty(key);
            expect(methodQuality({ method: { ...method, [field]: 0 } }, 'g/kg')[key].value).toBe(0);
        }
        expect(methodQuality({ method: null }, 'g/kg')).toEqual({});
        expect(methodQuality({ method }, null)).toEqual({});
    });
    test.each([
        ['NOT_REPORTED', {}],
        ['EXPANDED_ABSOLUTE', { value: 0.8, unit: 'g/kg', type: 'expanded', coverageFactor: 2 }],
        ['EXPANDED_RELATIVE_PCT', { value: 0.8, unit: '%', relative: true, type: 'expanded', coverageFactor: 2 }]
    ])('uncertainty mode %s follows the stored procedure amount', (mode, expected) => {
        const output = methodQuality({ method, mode, coverageFactor: 2 }, 'g/kg');
        if (mode === 'NOT_REPORTED') expect(output).not.toHaveProperty('uncertainty');
        else expect(output.uncertainty).toEqual(expected);
    });
    test('null coverage factor is omitted, missing uncertainty is omitted, and units are never invented', () => {
        const context = { method, mode: 'EXPANDED_ABSOLUTE', coverageFactor: null };
        expect(methodQuality(context, 'g/kg').uncertainty).toEqual({ value: 0.8, unit: 'g/kg', type: 'expanded' });
        expect(methodQuality({ ...context, method: { ...method, uncertainty: null } }, 'g/kg')).not.toHaveProperty('uncertainty');
        expect(methodQuality(context, '')).not.toHaveProperty('uncertainty');
        expect(methodQuality({ ...context, mode: 'EXPANDED_RELATIVE_PCT' }, null).uncertainty)
            .toEqual({ value: 0.8, unit: '%', relative: true, type: 'expanded' });
    });
    test.each([
        ['BELOW_LOD', '<0.5', '<LOD', 0.5],
        ['BELOW_LOQ', '<1.234', '<LOQ', 1.234],
        ['ABOVE_RANGE', '>1e2', '>RANGE', 100],
        ['BELOW_LOQ', '0', '<LOQ', 1.5],
        ['ABOVE_RANGE', '0', '>RANGE', null]
    ])('stored %s maps to an explicit marker and an evidenced threshold', (censoring, value, censored, censoringLimit) => {
        expect(censoringFields({ censoring, value, numericValue: 0 }, method)).toEqual({ censored, censoringLimit });
    });
    test('uncensored rows are unchanged; unknown censoring refuses rather than releasing a substituted value', () => {
        expect(censoringFields({ censoring: 'NONE', value: '0', numericValue: 0 }, method)).toEqual({});
        expect(() => censoringFields({ censoring: 'UNRECOGNIZED', value: '0' }, method))
            .toThrow('Stored censoring cannot be represented');
    });
});

describe('actual exchange observations, laboratory scope and stored-result preservation', () => {
    let labA, labB, methodA, methodB, analysisCode, user, token, cases;
    beforeAll(async () => {
        analysisCode = ('EX333-' + randomUUID()).toUpperCase();
        const unitCode = 'EX333-UNIT-' + randomUUID();
        await db.unit.create({ data: { code: unitCode, display: 'g/kg', quantityKind: 'MASS_FRACTION', factorToBase: 1 } });
        await db.analysis.create({ data: { code: analysisCode, name: 'Owned exchange analyte', units: 'g/kg', unitCode } });
        labA = await db.lab.create({ data: { id: randomUUID(), code: 'EX333-A-' + randomUUID(), name: 'Owned lab A', country: 'GTM' } });
        labB = await db.lab.create({ data: { id: randomUUID(), code: 'EX333-B-' + randomUUID(), name: 'Owned lab B', country: 'GTM' } });
        user = await db.user.create({ data: { id: randomUUID(), username: 'ex333_' + randomUUID(), email: randomUUID() + '@example.invalid',
            password: 'synthetic-unused-hash', role: 'LAB_MANAGER', labId: labA.id, countries: '["GTM"]', projects: '["SOILFER-GTM"]' } });
        token = jwt.sign({ id: user.id, tokenVersion: 0 }, JWT_SECRET, { expiresIn: '10m' });
        methodA = await db.methodology.create({ data: { analysisCode, labId: labA.id, name: 'Owned procedure A',
            standard: 'SOP-A', lod: 0.5, loq: 1.5, uncertainty: 0.8, isDefault: true } });
        methodB = await db.methodology.create({ data: { analysisCode, labId: labB.id, name: 'OTHER LAB PROCEDURE',
            standard: 'OTHER-LAB', lod: 999, loq: 999, uncertainty: 999, isDefault: true } });
        await setPolicy('EXPANDED_ABSOLUTE', 2);
        cases = [
            { name: 'uncensored', value: '6.4', rawInput: '6,40', numericValue: 6.4, censoring: 'NONE' },
            { name: 'lod', value: '<0.5', rawInput: '< 0,5', numericValue: 0.5, censoring: 'BELOW_LOD' },
            { name: 'loq', value: '<1.5', rawInput: '<1,5', numericValue: 1.5, censoring: 'BELOW_LOQ' },
            { name: 'range', value: '>100', rawInput: '>100', numericValue: 100, censoring: 'ABOVE_RANGE' },
            { name: 'no-method', value: '7', numericValue: 7, censoring: 'NONE', noMethod: true },
            { name: 'other-lab', value: '9', numericValue: 9, censoring: 'NONE', otherLab: true }
        ];
        for (const [index, row] of cases.entries()) {
            const lab = row.otherLab ? labB : labA, method = row.noMethod ? null : row.otherLab ? methodB : methodA;
            const sample = await createSampleFixture(db, { data: { id: randomUUID(), originalId: randomUUID(),
                labId: 'EX333-ACCESSION-' + randomUUID(), assignedLab: lab.id, country: 'GTM', projectCode: 'SOILFER-GTM', status: 'APPROVED' } });
            await createWorkItemFixture(db, { data: { id: randomUUID(), sampleId: sample.id, labId: lab.id,
                assignedLab: lab.id, analysis: analysisCode, methodologyId: method?.id || null, status: 'ACCEPTED' } });
            // An explicit retained order for this new accepted reference assembly.
            require('../../services/workflowStateRules').assertFixtureContext();
            await db.sampleOrderRevision.create({ data: { id: randomUUID(), sampleId: sample.id, version: 1,
                status: 'ACTIVE', reason: 'Owned exchange reference order', requestedBy: 'system:fixture',
                lines: { create: [{ id: randomUUID(), analysis: analysisCode, workItemId: null, status: 'ACTIVE', isRequired: true }] } } });
            const result = await createExecutionResultFixture(db, { attemptStatus: 'ACCEPTED', data: { id: randomUUID(),
                sampleId: sample.id, param: analysisCode, methodologyId: method?.id || null, value: row.value, rawInput: row.rawInput,
                numericValue: row.numericValue, unit: 'g/kg', censoring: row.censoring, replicateNo: index + 1, isCurrent: true, isValid: true } });
            row.id = result.id; row.sample = sample;
        }
    });
    async function setPolicy(mode, coverageFactor) {
        await policies.change({ ...user, role: 'LAB_MANAGER' }, labA.id, { reason: 'Owned exchange policy test', changes: [
            { key: 'report.uncertaintyMode', value: mode, analysisCode, methodologyId: methodA.id },
            { key: 'report.uncertaintyCoverageFactor', value: coverageFactor, analysisCode, methodologyId: methodA.id }
        ] }, { db });
    }
    const scientificRows = () => db.result.findMany({ where: { param: analysisCode }, orderBy: { id: 'asc' } });
    async function observations(alias = '/api/v2/data-exchange') {
        const response = await request(app).get(alias + '/observations').query({ param: analysisCode, profile: 'opennsis' })
            .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(200); expect(response.body.schemaVersion).toBe(SCHEMA_VERSION);
        return response.body.data;
    }
    test('actual HTTP preserves uncensored rows and nulls all censored numeric outputs without rewriting stored results', async () => {
        const before = await scientificRows(), rows = await observations();
        expect(rows).toHaveLength(5);
        const uncensored = rows.find(row => row.observationId === cases[0].id);
        expect(uncensored.asMeasured).toEqual({ value: 6.4, rawEntry: '6.4', unit: 'g/kg' });
        expect(uncensored.normalized).toEqual({ value: 6.4, unit: 'g/kg' });
        expect(uncensored).not.toHaveProperty('censored'); expect(uncensored).not.toHaveProperty('censoringLimit');
        expect(uncensored.method).toMatchObject({ id: methodA.id,
            limitOfDetection: { value: 0.5, unit: 'g/kg' }, limitOfQuantification: { value: 1.5, unit: 'g/kg' },
            uncertainty: { value: 0.8, unit: 'g/kg', type: 'expanded', coverageFactor: 2 } });
        for (const [index, marker, limit] of [[1, '<LOD', 0.5], [2, '<LOQ', 1.5], [3, '>RANGE', 100]]) {
            const source = cases[index], row = rows.find(item => item.observationId === source.id);
            expect(row).toMatchObject({ censoring: source.censoring, censored: marker, censoringLimit: limit,
                lod: null, loq: null, asMeasured: { value: null, rawEntry: source.rawInput }, normalized: { value: null } });
        }
        const missing = rows.find(row => row.observationId === cases[4].id);
        for (const key of ['limitOfDetection', 'limitOfQuantification', 'uncertainty']) expect(missing.method).not.toHaveProperty(key);
        expect(JSON.stringify(rows)).not.toMatch(/OTHER LAB PROCEDURE|OTHER-LAB/);
        expect(JSON.stringify(rows)).not.toContain(methodB.id);
        expect(await scientificRows()).toEqual(before);
    });
    test('actual laboratory policy modes and null coverage factor apply on both observation aliases', async () => {
        await setPolicy('EXPANDED_RELATIVE_PCT', null);
        let rows = await observations('/api/v2/sis');
        expect(rows.find(row => row.observationId === cases[0].id).method.uncertainty)
            .toEqual({ value: 0.8, unit: '%', relative: true, type: 'expanded' });
        await setPolicy('NOT_REPORTED', null);
        rows = await observations(); expect(rows.every(row => !Object.hasOwn(row.method, 'uncertainty'))).toBe(true);
    });
    test('even a foreign method id cannot select lab B values for a lab A result; lab code aliases resolve safely', async () => {
        const fake = [{ id: 'owned-context', param: analysisCode, methodologyId: methodB.id, sample: { assignedLab: labA.code } }];
        const contexts = await db.$transaction(tx => readMethodContexts(tx, fake));
        expect(contexts.get('owned-context')).toMatchObject({ labId: labA.id, method: null, mode: 'NOT_REPORTED' });
        expect(methodQuality(contexts.get('owned-context'), 'g/kg')).toEqual({});
    });
});
