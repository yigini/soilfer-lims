jest.mock('dotenv', () => ({ config: () => ({ parsed: {} }) }));

const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const uploadRoot = path.resolve(__dirname, '..', '.tmp', 'uploads_' + require('node:crypto').randomUUID());
fs.mkdirSync(uploadRoot, { recursive: true });
process.env.LIMS_OWNED_UPLOAD_ROOT = uploadRoot;
// No network is used by this real mounted-route matrix. Standalone Kobo test
// input is public synthetic data; authentication/controllers/ORM stay real.
jest.spyOn(require('axios'), 'get').mockImplementation(async url => {
    if (typeof url !== 'string' || !url.startsWith('https://example.invalid/')) throw Error('Unexpected outbound request in route matrix.');
    return { data: { name: 'Synthetic standalone form', url: 'https://example.invalid/synthetic' } };
});
const prisma = require('../../prisma');
const { loadRegisteredRouteInventory } = require('../helpers/registeredRouteInventory');
const { createRouteIsolationFixtures, snapshotLabA } = require('../helpers/routeIsolationFixtures');
const cases = [...require('../helpers/sampleProjectIsolationCases'), ...require('../helpers/workResultIsolationCases'),
    ...require('../helpers/reportQcIsolationCases'), ...require('../helpers/inventoryEquipmentIsolationCases'), ...require('../helpers/labMediaIsolationCases'),
    ...require('../helpers/receptionExecutionIsolationCases'), ...require('../helpers/workbenchIsolationCases'), ...require('../helpers/spectralProficiencyIsolationCases'),
    ...require('../helpers/staffMessageIsolationCases'), ...require('../helpers/identityDashboardIsolationCases'), ...require('../helpers/configurationHelpIsolationCases'),
    ...require('../helpers/exchangeOfflineIsolationCases')];
const inventory = loadRegisteredRouteInventory(() => require('../../app'), { allowedDuplicateKeys: ['GET /api/kobo/media'] });
const app = inventory.app;

function fill(value, ids) {
    if (typeof value === 'string') return value.replace(/\{(\w+)\}/g, (_, name) => {
        if (!ids[name]) throw Error(`Unseeded route fixture: ${name}`);
        return ids[name];
    });
    if (Array.isArray(value)) return value.map(item => fill(item, ids));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fill(item, ids)]));
    return value;
}

describe('R2 real lab-A requests as lab B', () => {
    let fixtures;
    beforeAll(async () => { fixtures = await createRouteIsolationFixtures(prisma); }, 60000);
    afterAll(async () => { await prisma.$disconnect(); });

    test('the implemented route families have no uncovered or obsolete method/path', () => {
        const registered = [...new Set(inventory.routes.map(route => route.key))].sort();
        const covered = [...new Set(cases.map(row => row.key))].sort();
        expect(covered).toEqual(registered);
    });

    for (const role of ['managerB', 'technicianB']) {
        for (const entry of cases) {
            test(`${role}: ${entry.key}${entry.variant ? ` (${entry.variant})` : ''}`, async () => {
                const [method] = entry.key.split(' '), write = method !== 'GET';
                const before = write ? await snapshotLabA(prisma, fixtures.ids) : null;
                let call = request(app)[method.toLowerCase()](fill(entry.path, fixtures.ids))
                    .set('Authorization', `Bearer ${fixtures.tokens[role]}`);
                if (entry.query) call = call.query(fill(entry.query, fixtures.ids));
                if (entry.body) call = call.send(fill(entry.body, fixtures.ids));
                if (entry.multipart) {
                    for (const [key, value] of Object.entries(entry.multipart.fields || {})) call = call.field(key, fill(value, fixtures.ids));
                    call = call.attach(entry.multipart.fileField, Buffer.from(entry.multipart.base64, 'base64'), {
                        filename: entry.multipart.filename, contentType: entry.multipart.contentType });
                }
                const response = await call;
                if (write) expect(await snapshotLabA(prisma, fixtures.ids)).toEqual(before);
                // Record only synthetic identifiers on failure, never an entire
                // response that might later acquire credential-bearing fields.
                const text = Buffer.isBuffer(response.body) ? response.body.toString('utf8') : response.text || JSON.stringify(response.body);
                const allowed = (entry.allowedMarkers || []).map(key => fixtures.ids[key]);
                const disclosedForeignMarkers = fixtures.foreignMarkers.filter(marker => !allowed.includes(marker) && text.includes(marker));
                expect({ status: response.status, disclosedForeignMarkers }).toEqual({ status: response.status, disclosedForeignMarkers: [] });
                if (entry.publicDirectory && response.status === 200) {
                    const rows = Array.isArray(response.body) ? response.body : [response.body];
                    for (const row of rows) expect(Object.keys(row).filter(key => ![
                        'id', 'code', 'name', 'location', 'country', 'city', 'isActive', 'operationalStatus'].includes(key))).toEqual([]);
                }
                if (entry.expectedEmptyGeometry && response.status === 200) {
                    expect(response.body.sampleCount).toBe(0);
                    expect(response.body.clusterCentroid).toBeUndefined();
                }
                if (entry.emptyDashboard && response.status === 200) {
                    expect(response.body.totalSamples).toBe(0);
                    expect(response.body.inProgress).toBe(0);
                }
                if (entry.rejectedSync && response.status === 200) {
                    expect(response.body.receipts).toHaveLength(1);
                    expect(response.body.receipts[0].status).toBe('REJECTED');
                    expect(response.body.receipts[0].code).toBe('WORK_ITEM_OUTSIDE_LAB_SCOPE');
                }
                // Invalid requests, lifecycle errors, and 500s cannot masquerade
                // as evidence that a foreign-owned entity was access checked.
                if (entry.protocolRefusal && response.status !== 403 && response.status !== 404) {
                    expect(response.status).toBe(entry.protocolRefusal.status);
                    expect(response.body.code).toBe(entry.protocolRefusal.code);
                } else if (entry.mustDeny) {
                    expect([403, 404]).toContain(response.status);
                } else if (entry.expectedStatus) {
                    expect(response.status).toBe(entry.expectedStatus);
                } else if (entry.staticRefusal && response.status !== 403) {
                    expect(response.status).toBe(entry.staticRefusal.status);
                    expect(response.body).toEqual(entry.staticRefusal.body);
                } else {
                    expect([403, 404, 200, 201, 202, 204, 206]).toContain(response.status);
                }
            });
        }
    }

    for (const role of ['globalAdmin', 'nationalUser']) {
        test(`${role} retains cross-lab sample access`, async () => {
            const response = await request(app).get(`/api/samples/${fixtures.ids.sampleA}/detail`)
                .set('Authorization', `Bearer ${fixtures.tokens[role]}`);
            expect(response.status).toBe(200);
            expect(JSON.stringify(response.body)).toContain(fixtures.ids.sampleA);
        });
        test(`${role} retains cross-lab project access`, async () => {
            const response = await request(app).get(`/api/projects/${fixtures.ids.projectA}`)
                .set('Authorization', `Bearer ${fixtures.tokens[role]}`);
            expect(response.status).toBe(200);
            expect(JSON.stringify(response.body)).toContain(fixtures.ids.projectA);
        });
        for (const [entity, path, marker] of [
            ['work item', '/api/work?sampleId={sampleA}', 'workItemA'],
            ['result', '/api/results/{sampleA}/history/PH_H2O', 'resultA'],
            ['review history', '/api/reviews?sampleId={sampleA}', 'reviewA'],
            ['report', '/api/reports/{reportA}', 'reportA'],
            ['sample PDF', '/api/reports/sample/{sampleA}/pdf', 'sampleA'],
            ['QC run', '/api/qc/batches/{batchA}', 'batchA'],
            ['sample storage location', '/api/samples/{sampleA}/storage-locations', 'locationA'],
            ['NCR', '/api/nonconformities?source=OTHER', 'ncrA'],
            ['laboratory policy', '/api/labs/{labA}/policies', 'labA'],
            ['Kobo configuration', '/api/kobo/configs', 'koboA'],
            ['sample container', '/api/samples/{sampleA}/containers', 'containerA'],
            ['custody history', '/api/samples/{sampleA}/custody', 'custodyA'],
            ['sample amendment', '/api/samples/{sampleA}/amendments', 'amendmentA'],
            ['order preview', '/api/samples/{sampleA}/orders/preview', 'sampleA'],
            ['submission', '/api/submissions/{submissionA}', 'submissionA'],
            ['spectral scan', '/api/spectral/{scanA}', 'scanA'],
            ['proficiency round', '/api/pt/rounds', 'ptRoundA'],
            ['membership discrepancy', '/api/access/project-membership-report', 'discrepancyProjectA'],
        ]) {
            test(`${role} retains cross-lab ${entity} access`, async () => {
                const response = await request(app).get(fill(path, fixtures.ids))
                    .set('Authorization', `Bearer ${fixtures.tokens[role]}`);
                expect(response.status).toBe(200);
                expect(Buffer.isBuffer(response.body) ? response.body.toString('utf8') : JSON.stringify(response.body)).toContain(fixtures.ids[marker]);
            });
        }
    }

    for (const role of ['managerA', 'globalAdmin', 'nationalUser']) {
        test(`${role} can read the real synthetic intake image`, async () => {
            const response = await request(app).get(fixtures.ids.uploadA).set('Authorization', `Bearer ${fixtures.tokens[role]}`);
            expect(response.status).toBe(200);
            expect(response.headers['content-type']).toMatch(/^image\/png/);
            expect(Buffer.isBuffer(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(24);
        });
    }

    for (const role of ['globalAdmin', 'nationalUser']) {
        test(`${role} retains authorized label-preview access`, async () => {
            const response = await request(app).post('/api/samples/labels/preview')
                .set('Authorization', `Bearer ${fixtures.tokens[role]}`).send({ items: [
                    { entity: 'SAMPLE', entityId: fixtures.ids.sampleA, count: 1 }], format: 'STANDARD', reason: 'Synthetic reprint' });
            expect(response.status).toBe(200);
            expect(JSON.stringify(response.body)).toContain('R2-SAMPLE-CODE-A');
        });
    }

    test('same-lab inventory references and equipment mappings remain usable', async () => {
        const headers = { Authorization: `Bearer ${fixtures.tokens.managerB}` };
        const ids = fixtures.ids;
        const created = await request(app).post('/api/inventory/items').set(headers).send({
            name: 'Synthetic permitted reagent', itemType: 'REAGENT', unitOfMeasure: 'g', defaultLocationId: ids.reagentLocationB });
        expect(created.status).toBe(201);
        expect(created.body.defaultLocationId).toBe(ids.reagentLocationB);
        const updated = await request(app).put(`/api/inventory/items/${created.body.id}`).set(headers)
            .send({ defaultLocationId: ids.reagentLocationB });
        expect(updated.status).toBe(200);
        const requirement = await request(app).post('/api/inventory/method-requirements').set(headers).send({
            analysisCode: 'PH_H2O', inventoryItemId: created.body.id, methodId: ids.methodB, unit: 'g' });
        expect(requirement.status).toBe(201);
        const list = await request(app).get('/api/inventory/method-requirements').set(headers);
        expect(list.status).toBe(200);
        expect(list.body.some(row => row.id === requirement.body.id)).toBe(true);
        expect((await request(app).delete(`/api/inventory/method-requirements/${requirement.body.id}`).set(headers)).status).toBe(200);
        const mapping = await request(app).post('/api/equipment/eligibility').set(headers).send({
            analysisCode: 'PH_H2O', methodId: ids.methodB, eligibleEquipmentIds: [ids.equipmentB] });
        expect(mapping.status).toBe(200);
        expect(mapping.body.methodId).toBe(ids.methodB);
        expect(JSON.parse(mapping.body.eligibleEquipmentIds)).toEqual([ids.equipmentB]);
    });

    test('MASTER_USER cannot read a QC run outside its authorized country', async () => {
        const response = await request(app).get(`/api/qc/batches/${fixtures.ids.batchC}`)
            .set('Authorization', `Bearer ${fixtures.tokens.nationalUser}`);
        expect(response.status).toBe(403);
        expect(JSON.stringify(response.body)).not.toContain(fixtures.ids.batchC);
    });

    test('MASTER_USER NCR access remains restricted to its authorized country', async () => {
        const response = await request(app).get('/api/nonconformities?source=OTHER')
            .set('Authorization', `Bearer ${fixtures.tokens.nationalUser}`);
        expect(response.status).toBe(200);
        expect(response.body.rows.some(row => row.id === fixtures.ids.ncrA)).toBe(true);
        expect(response.body.rows.some(row => row.id === fixtures.ids.ncrC)).toBe(false);
        const transition = await request(app).post(`/api/nonconformities/${fixtures.ids.ncrC}/transitions`)
            .set('Authorization', `Bearer ${fixtures.tokens.nationalUser}`)
            .send({ status: 'ACTION', impactAssessment: 'Synthetic out-of-country command' });
        expect(transition.status).toBe(403);
    });

    test('MASTER_USER cannot read a submission outside its authorized country', async () => {
        const response = await request(app).get(`/api/submissions/${fixtures.ids.submissionC}`)
            .set('Authorization', `Bearer ${fixtures.tokens.nationalUser}`);
        expect(response.status).toBe(403);
    });

    test('spectral and proficiency national access stays inside the authorized country', async () => {
        const headers = { Authorization: `Bearer ${fixtures.tokens.nationalUser}` };
        expect((await request(app).get(`/api/spectral/${fixtures.ids.scanC}`).set(headers)).status).toBe(403);
        const rounds = await request(app).get('/api/pt/rounds').set(headers);
        expect(rounds.status).toBe(200);
        expect(rounds.body.data.some(row => row.id === fixtures.ids.ptRoundA)).toBe(true);
        expect(rounds.body.data.some(row => row.id === fixtures.ids.ptRoundC)).toBe(false);
    });

    test('same-lab spectral restore and permanent disposal remain permitted', async () => {
        const headers = { Authorization: `Bearer ${fixtures.tokens.managerB}` };
        const restored = await request(app).post(`/api/spectral/${fixtures.ids.deletedScanB}/restore`).set(headers);
        expect(restored.status).toBe(200);
        expect((await prisma.spectralData.findUnique({ where: { id: fixtures.ids.deletedScanB } })).status).not.toBe('DELETED');
        const removed = await request(app).delete(`/api/spectral/${fixtures.ids.purgedScanB}/permanent`).set(headers);
        expect(removed.status).toBe(200);
        expect(await prisma.spectralData.findUnique({ where: { id: fixtures.ids.purgedScanB } })).toBeNull();
    });

    test('an author can still create, update and send their own private draft', async () => {
        const headers = { Authorization: `Bearer ${fixtures.tokens.managerB}` };
        const body = { toUserId: fixtures.ids.managerIdB, subject: 'Synthetic personal draft', body: 'Synthetic original text' };
        const created = await request(app).post('/api/messages/draft').set(headers).send(body);
        expect(created.status).toBe(200);
        const updated = await request(app).post('/api/messages/draft').set(headers).send({ ...body, id: created.body.id, body: 'Synthetic revised text' });
        expect(updated.status).toBe(200);
        expect(updated.body.body).toBe('Synthetic revised text');
        const sent = await request(app).post('/api/messages/send').set(headers).send({ ...body, draftId: created.body.id });
        expect(sent.status).toBe(200);
        expect(await prisma.message.findUnique({ where: { id: created.body.id } })).toBeNull();
    });

    test('global exchange and calculation readers retain nonempty A evidence', async () => {
        const headers = { Authorization: `Bearer ${fixtures.tokens.globalAdmin}` };
        for (const alias of ['data-exchange', 'sis']) {
            for (const version of ['v1', 'v2']) {
                const detail = await request(app).get(`/api/${version}/${alias}/samples/${fixtures.ids.exportSampleA}`).set(headers);
                expect(detail.status).toBe(200);
                expect(JSON.stringify(detail.body)).toContain(fixtures.ids.exportSampleA);
            }
        }
        const template = await request(app).get('/api/calculation-templates').query({ labId: fixtures.ids.labA }).set(headers);
        expect(template.status).toBe(200);
        expect(JSON.stringify(template.body)).toContain(fixtures.ids.calcA);
        const pages = await request(app).get(`/api/v2/data-exchange/snapshots/${fixtures.ids.snapshotA}/pages`).set(headers);
        expect(pages.status).toBe(200);
        expect(JSON.stringify(pages.body)).toContain(fixtures.ids.exportSampleA);
    });

    test('authorized national readers retain laboratory calculation definitions', async () => {
        const response = await request(app).get('/api/calculation-templates')
            .query({ labId: fixtures.ids.labA, analysisCode: 'EXCH_CA' })
            .set('Authorization', `Bearer ${fixtures.tokens.nationalUser}`);
        expect(response.status).toBe(200);
        expect(JSON.stringify(response.body)).toContain(fixtures.ids.calcA);
        const foreign = await request(app).get('/api/calculation-templates').query({ labId: fixtures.ids.labC })
            .set('Authorization', `Bearer ${fixtures.tokens.nationalUser}`);
        expect(foreign.status).toBe(403);
    });

    test('own-lab import suggestions and export history remain usable', async () => {
        const preview = await request(app).post('/api/import/preview').set('Authorization', `Bearer ${fixtures.tokens.managerA}`)
            .send({ csvText: 'Synthetic private parameter A\n7.1' });
        expect(preview.status).toBe(200);
        expect(preview.body.suggestedMappings[0].analysisCode).toBe(fixtures.ids.analysisA);
        const exported = await request(app).post('/api/exports/data').set('Authorization', `Bearer ${fixtures.tokens.managerB}`)
            .send({ type: 'LIST', project: fixtures.ids.projectB, signOffName: 'Synthetic actor', signOffReason: 'Synthetic permitted export' });
        expect(exported.status).toBe(200);
        const own = await request(app).get('/api/exports/history').set('Authorization', `Bearer ${fixtures.tokens.managerB}`);
        expect(own.status).toBe(200);
        expect(own.body.length).toBeGreaterThan(0);
        expect(own.body.every(row => row.user !== fixtures.actor.username)).toBe(true);
        const global = await request(app).get('/api/exports/history').set('Authorization', `Bearer ${fixtures.tokens.globalAdmin}`);
        expect(global.status).toBe(200);
        expect(global.body.some(row => row.id === fixtures.ids.exportAuditA)).toBe(true);
    });

    test('public and lab translation caches stay separate in both request orders', async () => {
        const own = await request(app).get('/api/admin/languages/en/catalog')
            .set('Authorization', `Bearer ${fixtures.tokens.managerA}`);
        expect(own.status).toBe(200);
        expect(own.body.data[`dynamic.analysis.${fixtures.ids.analysisA}.name`]).toBeDefined();
        for (const call of [request(app).get('/api/public/i18n/bootstrap'), request(app).get('/api/admin/languages/en/catalog')
            .set('Authorization', `Bearer ${fixtures.tokens.managerB}`)]) {
            const response = await call;
            expect(response.status).toBe(200);
            for (const marker of [fixtures.ids.analysisA, fixtures.ids.categoryA, fixtures.ids.methodA]) {
                expect(JSON.stringify(response.body)).not.toContain(marker);
            }
        }
    });

    test('lab managers retain their own role catalogue and membership discrepancy', async () => {
        const headers = { Authorization: `Bearer ${fixtures.tokens.managerB}` };
        const catalogue = await request(app).get('/api/access/assignable-roles').query({ labId: fixtures.ids.labB }).set(headers);
        expect(catalogue.status).toBe(200);
        expect(catalogue.body.targetLabId).toBe(fixtures.ids.labB);
        const report = await request(app).get('/api/access/project-membership-report').set(headers);
        expect(report.status).toBe(200);
        expect(report.body.discrepancies.some(row => row.projectId === fixtures.ids.discrepancyProjectB)).toBe(true);
        expect(report.body.discrepancies.some(row => row.projectId === fixtures.ids.discrepancyProjectA)).toBe(false);
    });
});
