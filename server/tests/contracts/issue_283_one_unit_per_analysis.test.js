const { qcGateFixture } = require('../helpers/qcGateFixture');
const { analysisQudtUnit } = require('../../services/methodUnitAuthority');
const { numericReportingUnit } = require('../../services/resultWriteService');
const { extractObservations } = require('../../services/sisAdapterService');

// #283 (YY: "no", one unit per analysis): the analysis's controlled unit is the
// only reporting-unit authority. No per-method unit, no conversion, no rewrite.
describe('#283 one unit per analysis', () => {
    test('a method QUDT override that disagrees is ignored and disclosed; an agreeing one changes nothing', () => {
        expect(analysisQudtUnit({ qudtUnit: 'MilliGM-PER-KiloGM' }, { qudtUnit: 'PERCENT' }))
            .toEqual({ qudtUnit: 'MilliGM-PER-KiloGM', unitDiagnostic: 'METHOD_UNIT_OVERRIDE_IGNORED' });
        expect(analysisQudtUnit({ qudtUnit: null }, { qudtUnit: 'PERCENT' }))
            .toEqual({ qudtUnit: null, unitDiagnostic: 'METHOD_UNIT_OVERRIDE_IGNORED' });
        expect(analysisQudtUnit({ qudtUnit: 'PERCENT' }, { qudtUnit: 'PERCENT' })).toEqual({ qudtUnit: 'PERCENT', unitDiagnostic: null });
        expect(analysisQudtUnit({ qudtUnit: 'PERCENT' }, null)).toEqual({ qudtUnit: 'PERCENT', unitDiagnostic: null });
    });

    test('a method never supplies the reporting unit on write', () => {
        const ctx = { analysis: { code: 'P_OLSEN', units: 'mg/kg', unitCode: 'mg/kg' }, method: { unit: '%' } };
        expect(numericReportingUnit(ctx, { param: 'P_OLSEN', value: '5' })).toBe('mg/kg');
        expect(() => numericReportingUnit(ctx, { param: 'P_OLSEN', value: '5', unit: '%' }))
            .toThrow(expect.objectContaining({ statusCode: 409, code: 'RESULT_UNIT_MISMATCH' }));
    });

    test('the V1 export labels the stored value with the analysis unit and never converts it', () => {
        const sample = { id: 'S-283', results: [{ id: 'R-283', param: 'P_OLSEN', value: '5', numericValue: 5, unit: 'mg/kg', methodologyId: 'M-283' }] };
        const maps = { analysisMap: { P_OLSEN: { code: 'P_OLSEN', units: 'mg/kg', qudtUnit: 'MilliGM-PER-KiloGM' } },
            methodMap: { 'M-283': { id: 'M-283', qudtUnit: 'PERCENT' } } };
        const [observation] = extractObservations(sample, maps);
        expect(observation).toMatchObject({ qudtUnit: 'MilliGM-PER-KiloGM', unitDiagnostic: 'METHOD_UNIT_OVERRIDE_IGNORED',
            asMeasured: { value: 5, rawEntry: '5', unit: 'mg/kg' } });
        maps.methodMap['M-283'].qudtUnit = 'MilliGM-PER-KiloGM';
        expect(extractObservations(sample, maps)[0]).not.toHaveProperty('unitDiagnostic');
    });
});

describe('#283 V2 observations', () => {
    const owned = [];
    afterEach(async () => { for (const f of owned.splice(0)) await f.close(); });
    async function invoke(f, controller, action) {
        let response; const previousSource = process.env.SOURCE_SYSTEM_ID;
        process.env.SOURCE_SYSTEM_ID = 'owned-283-source';
        try { await jest.isolateModulesAsync(async () => {
            jest.doMock('../../prisma', () => f.db);
            const res = { headersSent: false, getHeader: () => null, setHeader: () => {}, status(status) { this.statusCode = status; return this; },
                json(value) { response = { status: this.statusCode || 200, body: value }; return this; } };
            await require('../../controllers/' + controller)[action]({ query: {}, body: {}, params: {}, user: f.actor,
                sisAuth: { ...f.actor, type: 'USER', countries: ['*'], projects: ['*'] } }, res);
        }); } finally { jest.dontMock('../../prisma'); if (previousSource === undefined) delete process.env.SOURCE_SYSTEM_ID; else process.env.SOURCE_SYSTEM_ID = previousSource; }
        return response;
    }

    test('a disagreeing method override is disclosed, the analysis unit labels the value and nothing stored changes', async () => {
        const f = await qcGateFixture({ status: 'ACCEPTED', criteria: { blankPerBatch: 0, lrmPerBatch: 0, duplicateEvery: 0, crmEveryNBatches: 0, ccvEvery: 0 } });
        owned.push(f);
        const row = await f.result(f.items[0]);
        expect(row.methodologyId).toBeTruthy();
        await f.db.sample.update({ where: { id: f.items[0].sampleId }, data: { latitude: 1, longitude: 2 } });
        const analysis = await f.db.analysis.findUnique({ where: { code: row.param } });
        await f.db.analysis.update({ where: { code: row.param }, data: { qudtUnit: 'ANALYSIS-UNIT-283' } });
        await f.db.methodology.update({ where: { id: row.methodologyId }, data: { qudtUnit: 'METHOD-UNIT-283' } });
        const stored = await f.db.result.findUnique({ where: { id: row.id } });
        const response = await invoke(f, 'sisV2Controller', 'getObservations');
        expect(response.status).toBe(200);
        const observation = response.body.data.find(item => item.observationId === row.id);
        expect(observation).toMatchObject({ qudtUnit: 'ANALYSIS-UNIT-283', unitDiagnostic: 'METHOD_UNIT_OVERRIDE_IGNORED',
            asMeasured: { unit: stored.unit || analysis.units || null } });
        expect(await f.db.result.findUnique({ where: { id: row.id } })).toEqual(stored);
        const capabilities = await invoke(f, 'sisV2Controller', 'getCapabilities');
        expect(capabilities.body.observationFields.unitDiagnostic).toMatchObject({ optional: true, values: ['METHOD_UNIT_OVERRIDE_IGNORED'] });
    });
});
