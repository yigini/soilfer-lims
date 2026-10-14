const { createWorkItemFixture, createSampleFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { samplesDb } = require('../../db');
const prisma = require('../../prisma');
const parameters = [['SAND', '%'], ['SILT', '%'], ['CLAY', '%'], ['SOC', 'g/kg'], ['TN', 'g/kg'], ['CEC', 'cmol(+)/kg'], ['EXCH_CA', 'cmol(+)/kg'], ['EXCH_MG', 'cmol(+)/kg'], ['EXCH_K', 'cmol(+)/kg']];
async function assignOrderedWork(sampleId, token) {
    const username = require('jsonwebtoken').decode(token).username;
    await prisma.sample.update({ where: { id: sampleId }, data: { dryingStatus: 'DONE', preparationStatus: 'DONE', requiredAnalyses: JSON.stringify(parameters.map(([code]) => code)) } });
    for (const [code, units] of parameters) {
        await prisma.analysis.upsert({ where: { code }, create: { code, name: `${code} matrix test parameter`, units }, update: { units, labId: null } });
        await createWorkItemFixture(prisma, { data: { id: `${sampleId}_${code}`, sampleId, analysis: code, assignedTo: username, assignedLab: 'LAB-MX', labId: 'LAB-MX', status: 'IN_PROGRESS' } });
    }
    // #209: usable order context is declared only in this NEW owned fixture assembly.
    require('../../services/workflowStateRules').assertFixtureContext();
    await prisma.sampleOrderRevision.create({ data: { id: require('node:crypto').randomUUID(), sampleId: sampleId,
        version: 1, status: 'ACTIVE', reason: 'Owned numerical execution order context', requestedBy: 'system:fixture',
        lines: { create: parameters.map(([code]) => code).map(analysis => ({ id: require('node:crypto').randomUUID(), analysis,
            workItemId: null, status: 'ACTIVE', isRequired: true })) } } });
}

describe('Sample Matrix Cross-Parameter Validation Contract', () => {
    let techToken, sampleId;

    beforeAll(async () => {
        await require('../setup').ensureTestLab('LAB-MX', 'GTM');
        techToken = await getAuthToken('LAB_TECHNICIAN', 'LAB-MX', ['GTM'], ['MX-PROJ']);

        const s = await createSampleFixture(prisma, { data: { id: `SMP-MX-${Date.now()}`,
            labId: 'LAB-MX-001',
            assignedLab: 'LAB-MX',
            status: 'PROCESSING',
            originalId: 'LAB-MX-001',
            country: 'GTM',
            countryName: 'GTM',
            projectCode: 'SOILFER-US',
            dryingStatus: 'DONE',
            preparationStatus: 'DONE',
            receptionDate: new Date(),
            metadata: '{}',
            history: '[]' } });
        sampleId = s.id;
        await assignOrderedWork(sampleId, techToken);
    });

    test('1. saveResults validates matrix integrity and computes USDA texture; C:N and bases come from crossChecks', async () => {
        const res = await request(app)
            .post(`/api/results/${sampleId}`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                measurements: [
                    { param: 'SAND', value: '60.0', unit: '%' },
                    { param: 'SILT', value: '25.0', unit: '%' },
                    { param: 'CLAY', value: '15.0', unit: '%' },
                    { param: 'SOC', value: '16.0', unit: 'g/kg' },
                    { param: 'TN', value: '1.33', unit: 'g/kg' },
                    { param: 'CEC', value: '18.0', unit: 'cmol(+)/kg' },
                    { param: 'EXCH_CA', value: '8.0', unit: 'cmol(+)/kg' },
                    { param: 'EXCH_MG', value: '3.0', unit: 'cmol(+)/kg' },
                    { param: 'EXCH_K', value: '0.5', unit: 'cmol(+)/kg' }
                ]
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.matrixDiagnostics).toBeDefined();

        // Texture check
        expect(res.body.matrixDiagnostics.texture).toBeDefined();
        expect(res.body.matrixDiagnostics.texture.className).toBe('Sandy Loam');
        expect(res.body.matrixDiagnostics.texture.isValid).toBe(true);

        // #279 (YY "retire"): the legacy C:N and bases/CEC advisories are retired; the
        // registry-governed crossChecks are the only advisory source and Na is never assumed 0.
        expect(res.body.matrixDiagnostics.cnRatio).toBeUndefined();
        expect(res.body.matrixDiagnostics.basesAndCec).toBeUndefined();
        expect(res.body.matrixDiagnostics.retiredAdvisories).toEqual(['CN_RATIO', 'BASES_CEC']);
        expect(res.body.matrixDiagnostics.advisorySuccessor).toBe('crossChecks');
        const check = code => res.body.crossChecks.find(item => item.ruleCode === code);
        expect(check('CN_RATIO')).toMatchObject({ outcome: 'PASS', thresholds: { 'crossCheck.cnMin': 8, 'crossCheck.cnMax': 25 } });
        expect(check('BASES_CEC')).toMatchObject({ outcome: 'NOT_EVALUATED', reasonCode: 'INPUT_MISSING',
            inputs: { missing: ['EXCH_NA'] } });
    });

    test('2. Emits warning when texture fractions fail 100% closure tolerance', async () => {
        const sBad = await createSampleFixture(prisma, { data: { id: `SMP-MX-BAD-${Date.now()}`,
            labId: 'LAB-MX-002',
            assignedLab: 'LAB-MX',
            status: 'PROCESSING',
            originalId: 'LAB-MX-002',
            country: 'GTM',
            countryName: 'GTM',
            projectCode: 'SOILFER-US',
            dryingStatus: 'DONE',
            preparationStatus: 'DONE',
            receptionDate: new Date(),
            metadata: '{}',
            history: '[]' } });
        await assignOrderedWork(sBad.id, techToken);

        const res = await request(app)
            .post(`/api/results/${sBad.id}`)
            .set('Authorization', `Bearer ${techToken}`)
            .send({
                measurements: [
                    { param: 'SAND', value: '40.0', unit: '%' },
                    { param: 'SILT', value: '30.0', unit: '%' },
                    { param: 'CLAY', value: '10.0', unit: '%' } // Sum = 80% (fails closure)
                ]
            });

        expect(res.status).toBe(200);
        expect(res.body.matrixDiagnostics.texture.isValid).toBe(false);
        expect(res.body.matrixDiagnostics.warnings.length).toBeGreaterThan(0);
        expect(res.body.matrixDiagnostics.warnings[0]).toMatch(/Texture closure failed/);
    });

    test('3. submitForApproval attaches complete matrix diagnostics to response', async () => {
        const res = await request(app)
            .post(`/api/results/${sampleId}/submit`)
            .set('Authorization', `Bearer ${techToken}`);

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('SUBMITTED_FULL');
        expect(res.body.matrixDiagnostics).toBeDefined();
        expect(res.body.matrixDiagnostics.texture.className).toBe('Sandy Loam');
    });
});
