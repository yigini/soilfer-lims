const { randomUUID } = require('node:crypto');
const request = require('supertest');
const { qcGateFixture } = require('../helpers/qcGateFixture');
const { createWorkItemFixture } = require('../helpers/workflowFixtures');
const { withQcRunHttp } = require('../helpers/qcRunHttpHarness');
const { listMaterials } = require('../../services/referenceMaterialService');

const owned = [];

async function fixture(role = 'LAB_TECHNICIAN') {
    const f = await qcGateFixture({
        status: 'ASSIGNED',
        fixedWindowPolicy: false,
        criteria: { blankPerBatch: 0, lrmPerBatch: 1, duplicateEvery: 0, crmEveryNBatches: 0 }
    });
    owned.push(f);
    const actor = await f.db.user.create({
        data: {
            id: randomUUID(),
            username: 'reference-scope-' + randomUUID(),
            email: 'reference-scope@example.test',
            password: 'fixture-only',
            role,
            labId: f.labId,
            countries: JSON.stringify(['TEST'])
        }
    });
    await f.db.workItem.update({
        where: { id: f.items[0].id },
        data: { assignedTo: actor.username }
    });
    await f.db.labMethodDefault.create({
        data: { labId: f.labId, analysisCode: f.analysisCode, methodologyId: f.method.id }
    });
    await f.db.equipmentQualification.create({
        data: {
            id: randomUUID(),
            equipmentId: f.instrument.id,
            labId: f.labId,
            calibrationStatus: 'OK',
            verificationStatus: 'OK',
            nextCalibrationDueDate: new Date('2099-01-01')
        }
    });
    await f.db.equipmentMethodEligibility.create({
        data: {
            id: randomUUID(),
            labId: f.labId,
            analysisCode: f.analysisCode,
            methodId: f.method.id,
            isRequired: true,
            eligibleEquipmentIds: JSON.stringify([f.instrument.id])
        }
    });
    for (const analysis of ['DRYING', 'PREPARATION']) {
        await createWorkItemFixture(f.db, {
            data: {
                id: randomUUID(),
                sampleId: f.items[0].sampleId,
                labId: f.labId,
                analysis,
                status: 'COMPLETED',
                history: '[]'
            }
        });
    }
    const otherLab = await f.db.lab.create({
        data: { id: randomUUID(), code: randomUUID(), name: 'Other reference laboratory', country: 'TEST' }
    });
    const materials = [];
    for (const labId of [f.labId, otherLab.id]) {
        const material = await f.db.referenceMaterial.create({
            data: {
                id: randomUUID(),
                labId,
                code: randomUUID(),
                name: 'Owned reference soil',
                kind: 'LRM',
                matrix: 'SOIL',
                lotNumber: randomUUID(),
                status: 'ACTIVE',
                createdBy: f.actor.username
            }
        });
        await f.db.referenceValue.create({
            data: {
                id: randomUUID(),
                referenceMaterialId: material.id,
                analysisCode: f.analysisCode,
                methodologyId: f.method.id,
                assignedValue: 7,
                unit: 'fixture-unit',
                valueType: 'LAB_ASSIGNED',
                createdBy: f.actor.username
            }
        });
        materials.push(material);
    }
    return { ...f, actor, otherLab, material: materials[0], otherMaterial: materials[1] };
}

afterEach(async () => {
    for (const f of owned.splice(0)) await f.close();
});

test.each(['LAB_TECHNICIAN', 'LAB_MANAGER', 'AUDIT_USER', 'MASTER_USER'])(
    '%s reads run options with only its laboratory reference lots',
    async role => {
        const f = await fixture(role);
        const before = await f.snapshot();
        await withQcRunHttp(f.db, f.actor, async (app, token) => {
            const response = await request(app)
                .get('/api/qc/run-options')
                .set('Authorization', 'Bearer ' + token)
                .query({ labId: f.labId, analysisCode: f.analysisCode });
            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({ chartLotRequired: true, methodologyId: f.method.id });
            expect(response.body.eligibleLrmLots.map(row => row.id)).toEqual([f.material.id]);
        });
        expect(await f.snapshot()).toEqual(before);
    }
);

test('a technician starts a run with the in-scope reference lot through the real HTTP route', async () => {
    const f = await fixture();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app)
            .post('/api/qc/runs/start')
            .set('Authorization', 'Bearer ' + token)
            .send({
                labId: f.labId,
                analysisCode: f.analysisCode,
                instrumentId: f.instrument.id,
                workItemIds: f.workItemIds,
                referenceMaterialLotId: f.material.id
            });
        expect(response.body).toHaveProperty('batch');
        expect(response.status).toBe(201);
        expect(response.body.batch).toMatchObject({ status: 'RUNNING', labId: f.labId });
        expect(response.body.batch.positions.some(row => row.kind === 'LRM')).toBe(true);
    });
    expect((await f.db.workItem.findUnique({ where: { id: f.items[0].id } })).batchId).toBeTruthy();
});

test('QA can inspect options but remains unable to start a run', async () => {
    const f = await fixture('AUDIT_USER');
    const before = await f.snapshot();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app)
            .post('/api/qc/runs/start')
            .set('Authorization', 'Bearer ' + token)
            .send({ labId: f.labId, analysisCode: f.analysisCode, workItemIds: f.workItemIds });
        expect(response.status).toBe(403);
    });
    expect(await f.snapshot()).toEqual(before);
});

test('reference catalogue scope uses lab identity for national roles and keeps global access explicit', async () => {
    const f = await fixture('MASTER_USER');
    expect((await listMaterials(f.db, f.actor)).map(row => row.id)).toEqual([f.material.id]);
    expect(await listMaterials(f.db, { ...f.actor, labId: null })).toEqual([]);
    await expect(listMaterials(f.db, f.actor, { labId: f.otherLab.id }))
        .rejects.toMatchObject({ statusCode: 403 });
    const globalRows = await listMaterials(f.db, { ...f.actor, role: 'SUPER_ADMIN', labId: null });
    expect(globalRows.map(row => row.id).sort()).toEqual([f.material.id, f.otherMaterial.id].sort());
});

test('external viewers cannot read run options and retain the complete database snapshot', async () => {
    const f = await fixture('EXTERNAL_VIEWER');
    const before = await f.snapshot();
    await withQcRunHttp(f.db, f.actor, async (app, token) => {
        const response = await request(app)
            .get('/api/qc/run-options')
            .set('Authorization', 'Bearer ' + token)
            .query({ labId: f.labId, analysisCode: f.analysisCode });
        expect(response.status).toBe(403);
    });
    expect(await f.snapshot()).toEqual(before);
});
