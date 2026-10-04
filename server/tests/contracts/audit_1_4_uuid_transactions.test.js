const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const Database = require('better-sqlite3');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, ensureTestLab } = require('../setup');
const { generateWorkItemsForSample } = require('../../controllers/workItemController');
const importController = require('../../controllers/importController');
const { diagnoseCurrentResults } = require('../../scripts/diagnose_current_results');
const { calculateUsdaTexture } = require('../../utils/soilCalculations');
const id = () => crypto.randomUUID();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labId = 'LAB-AUDIT-14';

describe('Audit 1.4: UUID writes and atomic replicate supersession', () => {
    let token, username;
    beforeAll(async () => {
        await ensureTestLab(labId, 'GTM');
        token = await getAuthToken('LAB_MANAGER', labId);
        username = jwt.decode(token).username;
    });
    afterEach(() => jest.restoreAllMocks());

    // Inject a storage failure inside the real SQLite transaction, rather than
    // mocking rollback or the controller's response.
    function failCreate(model, predicate) {
        const original = prisma.$transaction.bind(prisma);
        return jest.spyOn(prisma, '$transaction').mockImplementation((callback, options) => {
            if (typeof callback !== 'function') return original(callback, options);
            return original(tx => callback(new Proxy(tx, { get(target, key) {
                if (key !== model) return target[key];
                return new Proxy(target[key], { get(delegate, method) {
                    if (method !== 'create') return delegate[method];
                    return args => {
                        if (predicate(args.data)) throw new Error('Audit 1.4 injected storage failure');
                        return delegate.create(args);
                    };
                } });
            } })), options);
        });
    }

    async function textureFixture() {
        const sampleId = id();
        await prisma.sample.create({ data: { id: sampleId, originalId: `CODE-${sampleId}`, labId, assignedLab: labId,
            status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE', receptionDate: new Date(),
            requiredAnalyses: '["SAND","SILT","CLAY"]' } });
        const rows = [];
        for (const replicateNo of [1, 2]) for (const [param, value] of [['SAND', '20'], ['SILT', '20'], ['CLAY', '60'], ['TEXTURE', 'Old class']]) {
            rows.push(await prisma.result.create({ data: { id: id(), sampleId, param, value,
                numericValue: param === 'TEXTURE' ? null : Number(value), replicateNo, unit: '%', isCurrent: true, isValid: true } }));
        }
        return { sampleId, rows };
    }
    const sampleSave = (f, measurements) => request(app).post(`/api/results/${f.sampleId}`)
        .set('Authorization', `Bearer ${token}`).send({ measurements });
    const measurements = replicateNo => [['SAND', '50'], ['SILT', '35'], ['CLAY', '15']]
        .map(([param, value]) => ({ param, value, unit: '%', replicateNo }));

    test('the production generator creates 500 distinct UUID WorkItems and audit rows at the same timestamp', async () => {
        const samples = Array.from({ length: 250 }, () => ({ id: id(), originalId: id(), labId, assignedLab: labId,
            status: 'PROCESSING', requiredAnalyses: '[]' }));
        await prisma.sample.createMany({ data: samples });
        jest.spyOn(Date, 'now').mockReturnValue(1234567890000);
        jest.spyOn(Math, 'random').mockReturnValue(0);
        const generated = [];
        for (const sample of samples) generated.push(...await generateWorkItemsForSample(sample));
        expect(generated).toHaveLength(500);
        expect(new Set(generated.map(row => row.id)).size).toBe(500);
        for (const row of generated) expect(row.id).toMatch(uuid);
        const audits = await prisma.auditLog.findMany({ where: { entityId: { in: samples.map(row => row.id) }, action: 'WORKITEM_GENERATED' } });
        expect(audits).toHaveLength(500);
        expect(new Set(audits.map(row => row.id)).size).toBe(500);
        for (const row of audits) expect(row.id).toMatch(uuid);
        const stored = await prisma.sample.findMany({ where: { id: { in: samples.map(row => row.id) } } });
        expect(new Map(stored.map(row => [row.id, row.originalId]))).toEqual(new Map(samples.map(row => [row.id, row.originalId])));
    }, 60000);

    test('diagnostic reports duplicate-current groups per replicate without changing any row', () => {
        const db = new Database(':memory:');
        try {
            db.exec('CREATE TABLE Result(id TEXT, sampleId TEXT, param TEXT, replicateNo INTEGER, isCurrent INTEGER)');
            const insert = db.prepare('INSERT INTO Result VALUES (?,?,?,?,?)');
            insert.run('old', 'sample', 'PH', 1, 0);
            insert.run('a', 'sample', 'PH', 1, 1); insert.run('b', 'sample', 'PH', 1, 1);
            insert.run('other-replicate', 'sample', 'PH', 2, 1);
            const before = db.prepare('SELECT * FROM Result ORDER BY id').all();
            expect(diagnoseCurrentResults(db)).toEqual({ groupCount: 1, currentRowCount: 2,
                groups: [{ sampleId: 'sample', param: 'PH', replicateNo: 1, currentCount: 2 }] });
            expect(db.prepare('SELECT * FROM Result ORDER BY id').all()).toEqual(before);
        } finally { db.close(); }
    });

    test('typed QC creates UUID rows even when supplied QC identifiers repeat', async () => {
        const batchId = id();
        await prisma.batch.create({ data: { id: batchId, labId, analysis: 'PH_H2O', profile: 'RACK_40',
            status: 'OPEN', createdBy: username, history: '[]', qcResults: '{}' } });
        const response = await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send({
                blanks: [{ id: 'same-legacy-id', value: 0 }, { id: 'same-legacy-id', value: 0 }],
                controls: [{ id: 'same-legacy-id', expected: 7, measured: 7 }],
                duplicates: [{ id: 'same-legacy-id', value1: 7, value2: 7 }]
            });
        expect(response.status).toBe(200);
        const rows = await prisma.batchQcResult.findMany({ where: { batchId } });
        expect(rows).toHaveLength(4);
        expect(new Set(rows.map(row => row.id)).size).toBe(4);
        for (const row of rows) expect(row.id).toMatch(uuid);
        const snapshot = await prisma.auditLog.findFirst({ where: { entityId: batchId, action: 'QC_EVIDENCE_SNAPSHOT' } });
        expect(snapshot.id).toMatch(uuid);
    });

    test('sample result save derives texture within the matching replicate and retains all old values', async () => {
        const f = await textureFixture();
        const response = await sampleSave(f, measurements(2));
        expect(response.status).toBe(200);
        const after = await prisma.result.findMany({ where: { sampleId: f.sampleId } });
        for (const old of f.rows) {
            const row = after.find(row => row.id === old.id);
            expect(row.value).toBe(old.value);
            expect(row.isCurrent).toBe(old.replicateNo === 1);
            if (old.replicateNo === 2) expect(row.supersededBy).toMatch(uuid);
        }
        const texture = after.find(row => row.param === 'TEXTURE' && row.replicateNo === 2 && row.isCurrent);
        expect(texture.value).toBe(calculateUsdaTexture(50, 35, 15).className);
        expect(texture.id).toMatch(uuid);
        expect(after.filter(row => row.replicateNo === 2 && row.isCurrent)).toHaveLength(4);
    });

    test('sample result save rolls back fractions, texture supersession and audit when texture storage fails', async () => {
        const f = await textureFixture();
        const audits = await prisma.auditLog.count();
        failCreate('result', row => row.sampleId === f.sampleId && row.param === 'TEXTURE');
        expect((await sampleSave(f, measurements(2))).status).toBe(500);
        expect(await prisma.result.findMany({ where: { sampleId: f.sampleId }, orderBy: { id: 'asc' } }))
            .toEqual([...f.rows].sort((a, b) => a.id.localeCompare(b.id)));
        expect(await prisma.auditLog.count()).toBe(audits);
    });

    test.each([false, true])('workbench fraction save is atomic with derived texture (storage failure: %s)', async fail => {
        const f = await textureFixture();
        const item = await prisma.workItem.create({ data: { id: id(), sampleId: f.sampleId, assignedLab: labId,
            analysis: 'SAND', status: 'ASSIGNED', assignedTo: username, version: 0 } });
        const audits = await prisma.auditLog.count();
        if (fail) failCreate('result', row => row.sampleId === f.sampleId && row.param === 'TEXTURE');
        const response = await request(app).post('/api/workbench/batch-save').set('Authorization', `Bearer ${token}`)
            .send({ draft: false, entries: [{ workItemId: item.id, value: '20', replicateNo: 2 }] });
        if (fail) {
            expect(response.status).toBe(500);
            expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toEqual(item);
            expect(await prisma.result.findMany({ where: { sampleId: f.sampleId }, orderBy: { id: 'asc' } }))
                .toEqual([...f.rows].sort((a, b) => a.id.localeCompare(b.id)));
            expect(await prisma.auditLog.count()).toBe(audits);
        } else {
            expect(response.status).toBe(200); expect(response.body.saved).toBe(1);
            const rows = await prisma.result.findMany({ where: { sampleId: f.sampleId } });
            expect(rows.find(row => row.param === 'TEXTURE' && row.replicateNo === 2 && row.isCurrent).value)
                .toBe(calculateUsdaTexture(20, 20, 60).className);
            for (const old of f.rows.filter(row => row.replicateNo === 1)) expect(rows.find(row => row.id === old.id)).toEqual(old);
            const audit = await prisma.auditLog.findFirst({ where: { entityId: item.id, action: 'WORKBENCH_COMPLETE' } });
            expect(audit.id).toMatch(uuid);
        }
    });

    async function importFixture() {
        const analysis = await prisma.analysis.findFirst({ where: { code: 'PH_H2O' } });
        const method = await prisma.methodology.findFirst({ where: { analysisCode: analysis.code } }) || await prisma.methodReference.findFirst();
        expect(method).not.toBeNull();
        const unit = await prisma.unit.findFirst();
        const sampleId = id();
        await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, labId, assignedLab: labId, status: 'APPROVED' } });
        const rows = [];
        for (const replicateNo of [1, 2]) rows.push(await prisma.result.create({ data: {
            id: id(), sampleId, param: analysis.code, value: '5', replicateNo, isCurrent: true, isValid: true } }));
        return { sampleId, rows, request: { body: { sampleIdColumn: 'sample', labId,
            columnMappings: [{ column: 'value', analysisCode: analysis.code, methodologyId: method.id, unitCode: unit.code }],
            rows: [{ sample: sampleId, value: '6.5' }] }, user: { username, role: 'LAB_MANAGER', labId } } };
    }
    async function executeImport(req) {
        const result = { status: 200 };
        const res = { status(code) { result.status = code; return res; }, json(body) { result.body = body; } };
        await importController.executeImport(req, res);
        return result;
    }
    test('legacy import supersedes only replicate 1, retains old rows, and writes UUID results/audits', async () => {
        const f = await importFixture();
        const response = await executeImport(f.request);
        expect(response.status).toBe(200); expect(response.body.importedResults).toBe(1);
        const rows = await prisma.result.findMany({ where: { sampleId: f.sampleId } });
        expect(rows.find(row => row.id === f.rows[0].id)).toMatchObject({ value: '5', isCurrent: false });
        expect(rows.find(row => row.id === f.rows[1].id)).toEqual(f.rows[1]);
        const current = rows.find(row => row.replicateNo === 1 && row.isCurrent);
        expect(current.id).toMatch(uuid); expect(current.value).toBe('6.5');
        expect(rows.find(row => row.id === f.rows[0].id).supersededBy).toBe(current.id);
        const audit = await prisma.auditLog.findFirst({ where: { action: 'IMPORT_LEGACY_DATA', performedBy: username }, orderBy: { timestamp: 'desc' } });
        expect(audit.id).toMatch(uuid);
    });
    test.each(['result', 'auditLog'])('legacy import rolls back supersession and new samples when %s storage fails', async model => {
        const f = await importFixture();
        const newSampleId = id();
        f.request.body.rows.push({ sample: newSampleId, value: '7' });
        const audits = await prisma.auditLog.count();
        failCreate(model, row => model === 'result' ? row.sampleId === newSampleId : row.action === 'IMPORT_LEGACY_DATA');
        expect((await executeImport(f.request)).status).toBe(500);
        expect(await prisma.sample.findUnique({ where: { id: newSampleId } })).toBeNull();
        expect(await prisma.result.findMany({ where: { sampleId: f.sampleId }, orderBy: { replicateNo: 'asc' } })).toEqual(f.rows);
        expect(await prisma.auditLog.count()).toBe(audits);
    });
});
