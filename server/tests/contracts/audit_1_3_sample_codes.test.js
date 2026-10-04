const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const app = require('../../app');
const prisma = require('../../prisma');
const policy = require('../../services/policyService');
const { registry, valid } = require('../../config/policyRegistry');
const codes = require('../../services/sampleCodeService');
const { backfill } = require('../../scripts/backfill_sample_codes');
const { getAuthToken } = require('../setup');
const id = () => crypto.randomUUID();
const migration = fs.readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261004170000_add_atomic_sample_codes/migration.sql'), 'utf8');

describe('Audit 1.3: atomic laboratory sample codes', () => {
    let lab, token, manager;
    beforeEach(async () => {
        lab = await prisma.lab.create({ data: { id: id(), code: `A13${id().slice(0, 8).toUpperCase()}`, name: 'Sample code contract laboratory', country: 'GTM', timezone: 'Europe/Rome' } });
        token = await getAuthToken('SAMPLE_RECEPTION', lab.id); manager = jwt.decode(await getAuthToken('LAB_MANAGER', lab.id));
    });
    const edit = changes => policy.change(manager, lab.id, { changes, reason: 'Sample numbering approved' });
    const checklist = { items: Object.fromEntries(['container', 'label', 'quantity', 'condition', 'coc'].map(key => [key, { status: 'PASS' }])) };
    const receive = (body, auth = token) => request(app).post('/api/reception/consignments').set('Authorization', `Bearer ${auth}`)
        .send({ defaults: { checklist }, samples: [{ originalId: id(), status: 'ACCEPTED' }], ...body });
    async function issue(issuedAt = new Date(), projectCode) {
        return prisma.$transaction(async tx => {
            const labSampleCode = await codes.allocateSampleCode(tx, { labReference: lab.id, projectCode, issuedAt });
            return tx.sample.create({ data: { id: id(), originalId: id(), assignedLab: lab.id, labId: labSampleCode, labSampleCode, status: 'RECEIVED' } });
        });
    }
    test('50 parallel real intakes issue 50 unique codes and each work item belongs to the lab', async () => {
        const responses = await Promise.all(Array.from({ length: 50 }, () => receive({})));
        expect(responses.map(response => response.status)).toEqual(Array(50).fill(201));
        const rows = responses.map(response => response.body.samples[0]);
        expect(new Set(rows.map(row => row.labSampleCode)).size).toBe(50);
        for (const row of rows) { expect(row.labId).toBe(row.labSampleCode); expect(codes.verifyCheckCharacter(row.labSampleCode)).toBe(true); }
        const work = await prisma.workItem.findMany({ where: { sampleId: { in: rows.map(row => row.id) } } });
        expect(work).toHaveLength(100); expect(work.every(item => item.labId === lab.id && item.assignedLab === lab.id)).toBe(true);
        const counter = await prisma.labSequence.findFirst({ where: { labId: lab.id, scope: 'SAMPLE' } });
        expect(counter.next).toBe(51);
    }, 60000);
    test('ISO reference vector, single-character substitution and adjacent transposition are rejected', () => {
        expect(codes.checkCharacter('A12425GABC1234002')).toBe('M');
        expect(codes.verifyCheckCharacter('A12425GABC1234002M')).toBe(true);
        const body = 'GHA1-26-000123', code = body + codes.checkCharacter(body);
        expect(codes.verifyCheckCharacter(code)).toBe(true);
        expect(codes.verifyCheckCharacter(code.replace('123', '124'))).toBe(false);
        expect(codes.verifyCheckCharacter(code.replace('123', '132'))).toBe(false);
    });
    test('counter and sample roll back together after a downstream failure', async () => {
        let reserved;
        await expect(prisma.$transaction(async tx => {
            reserved = await codes.allocateSampleCode(tx, { labReference: lab.id });
            await tx.sample.create({ data: { id: id(), originalId: 'FAILED-A13', assignedLab: lab.id, labSampleCode: reserved, status: 'RECEIVED' } });
            throw new Error('synthetic intake failure');
        })).rejects.toThrow('synthetic intake failure');
        expect(await prisma.labSequence.count({ where: { labId: lab.id } })).toBe(0);
        expect(await prisma.sample.count({ where: { originalId: 'FAILED-A13' } })).toBe(0);
        expect((await issue()).labSampleCode).toBe(reserved);
    });
    test('normal single and walk-in paths issue policy codes, with laboratory work-item ownership', async () => {
        const sample = await prisma.sample.create({ data: { id: id(), originalId: id(), assignedLab: lab.id, status: 'RECEIVED' } });
        const response = await request(app).post(`/api/samples/${sample.id}/accept`).set('Authorization', `Bearer ${await getAuthToken('LAB_MANAGER', lab.id)}`).send({ checklist });
        expect(response.status).toBe(200); expect(codes.verifyCheckCharacter(response.body.labSampleCode)).toBe(true);
        const work = await prisma.workItem.findMany({ where: { sampleId: sample.id } });
        expect(work).toHaveLength(2);
        expect(work.every(item => item.labId === lab.id)).toBe(true);
        const walkIn = await request(app).post('/api/samples/walkin').set('Authorization', `Bearer ${token}`).send({ submitter: 'Synthetic submitter', analyses: [] });
        expect(walkIn.status).toBe(201); expect(walkIn.body.sample.originalId).toMatch(/^W\d+$/);
        expect(walkIn.body.sample.labSampleCode).toBeNull();
        expect(await prisma.workItem.count({ where: { sampleId: walkIn.body.sample.id } })).toBe(0);
        const accepted = await request(app).post(`/api/samples/${walkIn.body.sample.id}/accept`).set('Authorization', `Bearer ${await getAuthToken('LAB_MANAGER', lab.id)}`).send({ checklist });
        expect(accepted.status).toBe(200);
        expect(codes.verifyCheckCharacter(accepted.body.labSampleCode)).toBe(true);
        expect(accepted.body.labId).toBe(accepted.body.labSampleCode);
        expect(accepted.body.labId).not.toBe(walkIn.body.sample.originalId);
    });
    test('historical duplicate intake returns a stable conflict and preserves both records', async () => {
        const oldCode = `S${Date.now()}`;
        await prisma.sample.create({ data: { id: id(), originalId: id(), assignedLab: lab.id, labId: oldCode, labSampleCode: oldCode, status: 'RECEIVED' } });
        const sample = await prisma.sample.create({ data: { id: id(), originalId: id(), assignedLab: lab.id, labId: oldCode, status: 'EXPECTED' } });
        const response = await receive({ samples: [{ originalId: sample.originalId, status: 'ACCEPTED' }] });
        expect(response.status).toBe(422); expect(response.body.code).toBe('SAMPLE_CODE_CONFLICT');
        expect(response.body.errors).toHaveLength(1);
        expect(await prisma.sample.findUnique({ where: { id: sample.id } })).toMatchObject({ labId: oldCode, labSampleCode: null, status: 'EXPECTED' });
    });
    test('year rollover uses lab timezone; NEVER retains its counter while date tokens change', async () => {
        const a = await issue('2026-12-31T22:30:00Z'), b = await issue('2026-12-31T23:30:00Z');
        expect(a.labSampleCode).toContain('-26-000001'); expect(b.labSampleCode).toContain('-27-000001');
        expect(await prisma.labSequence.count({ where: { labId: lab.id } })).toBe(2);
        await edit([{ key: 'sample.sequenceReset', value: 'NEVER' }]);
        const c = await issue('2026-12-31T22:30:00Z'), d = await issue('2026-12-31T23:30:00Z');
        // Switching reset modes must not reissue the already reserved 2026 code.
        expect(c.labSampleCode).toContain('-26-000002'); expect(d.labSampleCode).toContain('-27-000003');
        expect((await prisma.labSequence.findUnique({ where: { labId_scope_year: { labId: lab.id, scope: 'SAMPLE', year: 0 } } })).next).toBe(4);
    });
    test('two labs use different policy formats, with one continuous sequence across projects', async () => {
        const other = await prisma.lab.create({ data: { id: id(), code: `B13${id().slice(0, 8).toUpperCase()}`, name: 'Second numbering lab', country: 'GTM', timezone: 'UTC' } });
        const otherManager = jwt.decode(await getAuthToken('LAB_MANAGER', other.id));
        await policy.change(otherManager, other.id, { reason: 'Alternate format', changes: [{ key: 'sample.codeFormat', value: '{PROJECT}.{LAB}.{YYYY}.{SEQ:4}{CHK}' }] });
        const a = await issue('2026-05-01T12:00:00Z');
        const otherIssue = projectCode => prisma.$transaction(async tx => {
            const labSampleCode = await codes.allocateSampleCode(tx, { labReference: other.code, projectCode, issuedAt: '2026-05-01T12:00:00Z' });
            return tx.sample.create({ data: { id: id(), originalId: id(), assignedLab: other.id, labSampleCode, status: 'RECEIVED' } });
        });
        const b = await otherIssue('PRJ1'), c = await otherIssue('PRJ2');
        expect(b.labSampleCode).toMatch(/^PRJ1\.B13.*\.2026\.0001[A-Z0-9]$/);
        expect(c.labSampleCode).toMatch(/^PRJ2\.B13.*\.2026\.0002[A-Z0-9]$/);
        for (const row of [a, b, c]) expect(codes.verifyCheckCharacter(row.labSampleCode)).toBe(true);
        expect(new Set([a, b, c].map(row => row.labSampleCode)).size).toBe(3);
    });
    test('missing PROJECT refuses acceptance without writes; walk-in arrival has no code allocation', async () => {
        await edit([{ key: 'sample.codeFormat', value: '{LAB}-{PROJECT}-{SEQ:6}{CHK}' }]);
        const counts = () => Promise.all([prisma.sample.count(), prisma.workItem.count(), prisma.consignment.count(), prisma.auditLog.count(), prisma.labSequence.count()]);
        const before = await counts();
        const batch = await receive({});
        expect(batch.status).toBe(422); expect(batch.body.code).toBe('SAMPLE_CODE_PROJECT_REQUIRED');
        const single = await request(app).post('/api/reception/intake').set('Authorization', `Bearer ${token}`).send({ originalId: id(), isWalkIn: true, decision: 'ACCEPTED', checklist });
        expect(single.status).toBe(409); expect(single.body.code).toBe('SAMPLE_CODE_PROJECT_REQUIRED');
        expect(await counts()).toEqual(before);
        const walkIn = await request(app).post('/api/samples/walkin').set('Authorization', `Bearer ${token}`).send({ submitter: 'Synthetic submitter', analyses: [] });
        expect(walkIn.status).toBe(201); expect(walkIn.body.sample.labSampleCode).toBeNull();
        const beforeAcceptance = await counts();
        const accepted = await request(app).post(`/api/samples/${walkIn.body.sample.id}/accept`).set('Authorization', `Bearer ${await getAuthToken('LAB_MANAGER', lab.id)}`).send({ checklist });
        expect(accepted.status).toBe(409); expect(accepted.body.code).toBe('SAMPLE_CODE_PROJECT_REQUIRED');
        expect(await counts()).toEqual(beforeAcceptance);
        expect(await prisma.labSequence.count({ where: { labId: lab.id } })).toBe(0);
    });
    test('issued legacy S codes stay unchanged, resolvable and separate from S-prefixed originalIds', async () => {
        const old = await prisma.sample.create({ data: { id: id(), originalId: id(), labId: `S${Date.now()}`, assignedLab: lab.id, status: 'EXPECTED' } });
        const response = await receive({ samples: [{ originalId: old.originalId, status: 'ACCEPTED' }] });
        expect(response.status).toBe(201); expect(response.body.samples[0].labSampleCode).toBe(old.labId);
        expect(await prisma.labSequence.count({ where: { labId: lab.id } })).toBe(0);
        expect((await request(app).get('/api/samples/lookup').set('Authorization', `Bearer ${token}`).query({ code: old.labId })).body.id).toBe(old.id);
        await prisma.sample.create({ data: { id: id(), originalId: `S999999${id()}`, assignedLab: lab.id, status: 'EXPECTED' } });
        expect((await issue()).labSampleCode).toContain('-000001');
    });
    test('format changes affect future codes only, and new code lookup remains scoped', async () => {
        const a = await issue();
        await edit([{ key: 'sample.codeFormat', value: '{LAB}.{YYYY}.{SEQ:4}' }]);
        const b = await issue();
        expect(b.labSampleCode).toMatch(/\.2026\.0002$/);
        expect((await prisma.sample.findUnique({ where: { id: a.id } })).labSampleCode).toBe(a.labSampleCode);
        await prisma.sample.update({ where: { id: b.id }, data: { labId: null } });
        const lookup = auth => request(app).get('/api/samples/lookup').set('Authorization', `Bearer ${auth}`).query({ code: b.labSampleCode });
        expect((await lookup(token)).body.id).toBe(b.id);
        expect((await lookup(await getAuthToken('SAMPLE_RECEPTION', 'FOREIGN-A13'))).status).toBe(404);
    });
    test('legacy alias collision skips a reserved value, and bare root-client allocation is refused', async () => {
        const reserved = codes.formatCode(registry['sample.codeFormat'].presets.ISO17025_STRICT, { labCode: lab.code, year: 2026, sequence: 1 });
        await prisma.sample.create({ data: { id: id(), originalId: id(), labId: reserved, assignedLab: lab.id, status: 'EXPECTED' } });
        expect((await issue('2026-05-01T12:00:00Z')).labSampleCode).toContain('-000002');
        await expect(codes.allocateSampleCode(prisma, { labReference: lab.id })).rejects.toMatchObject({ statusCode: 409, code: 'SAMPLE_CODE_TRANSACTION_REQUIRED' });
    });
    test('YEARLY is a central lab-only preset default; PROJECT is sample-only and checksum-free formats are allowed', () => {
        expect(registry['sample.sequenceReset']).toMatchObject({ scope: 'LAB', presets: { ISO17025_STRICT: 'YEARLY', BASIC: 'YEARLY', ADVISORY: 'YEARLY' } });
        expect(valid('sample.sequenceReset', 'NEVER')).toBe(true); expect(valid('sample.sequenceReset', 'MONTHLY')).toBe(false);
        expect(valid('sample.codeFormat', '{LAB}-{PROJECT}-{SEQ:6}')).toBe(true);
        expect(valid('report.numberFormat', '{LAB}-{PROJECT}-{SEQ:6}')).toBe(false);
    });
});

describe('Audit 1.3: additive migration and idempotent back-fill', () => {
    let db;
    beforeEach(() => {
        db = new Database(':memory:');
        db.exec('CREATE TABLE Lab(id TEXT PRIMARY KEY, code TEXT); CREATE TABLE Sample(id TEXT PRIMARY KEY, labId TEXT, assignedLab TEXT, metadata TEXT); CREATE TABLE WorkItem(id TEXT PRIMARY KEY, sampleId TEXT, labId TEXT, assignedLab TEXT); CREATE TABLE AuditLog(id TEXT PRIMARY KEY, details TEXT); CREATE TABLE Result(id TEXT PRIMARY KEY, value TEXT);');
        db.exec("INSERT INTO Lab VALUES ('lab-a','AAA'),('lab-b','BBB'); INSERT INTO Sample VALUES ('s1','S123','lab-a','raw'),('s2','old-format','lab-a','raw'),('blank',' ','lab-a','raw'),('lab-valued','AAA','lab-a','raw'),('ambiguous',' aaa ','lab-a','raw'),('unowned',NULL,'unknown','raw'); INSERT INTO WorkItem VALUES ('w1','s1','S123','lab-a'),('referred','s1','old-code','BBB'),('fallback','s2','old-code',NULL),('unresolved','unowned','lost','unknown'); INSERT INTO AuditLog VALUES ('a','original audit'); INSERT INTO Result VALUES ('r','12.5');");
        db.exec(migration);
    });
    afterEach(() => db.close());
    test('dry-run has no writes; apply copies issued codes, retains aliases/old work-item ids, reports unresolved and referral ownership', () => {
        const before = db.serialize(), dry = backfill(db);
        expect(db.serialize()).toEqual(before);
        expect(dry.sampleCounts).toEqual({ copiedSNumber: 1, copiedOtherFormat: 1, ambiguous: 1, blank: 2, labValued: 1, alreadyCopied: 0 });
        expect(dry.otherFormatSampleIds).toEqual(['s2']); expect(dry.ambiguous[0].code).toBe('AMBIGUOUS_LAB_OR_CODE');
        expect(dry.workItemCounts).toEqual({ updated: 3, unchanged: 0, unresolved: 1, sampleLabDiffer: 1 });
        const applied = backfill(db, true); expect(applied.mode).toBe('apply');
        expect(db.prepare('SELECT labId, labSampleCode, metadata FROM Sample WHERE id = ?').get('s1')).toEqual({ labId: 'S123', labSampleCode: 'S123', metadata: 'raw' });
        expect(db.prepare('SELECT labSampleCode FROM Sample WHERE id = ?').get('ambiguous').labSampleCode).toBeNull();
        expect(db.prepare('SELECT labId, legacyLabId FROM WorkItem WHERE id = ?').get('w1')).toEqual({ labId: 'lab-a', legacyLabId: 'S123' });
        expect(db.prepare('SELECT labId, legacyLabId FROM WorkItem WHERE id = ?').get('referred')).toEqual({ labId: 'lab-b', legacyLabId: 'old-code' });
        expect(db.prepare('SELECT labId, legacyLabId FROM WorkItem WHERE id = ?').get('unresolved')).toEqual({ labId: 'lost', legacyLabId: null });
        expect(applied.unresolvedWorkItems).toEqual([{ id: 'unresolved', code: 'WORKITEM_LAB_UNRESOLVED' }]);
        expect(applied.differingWorkItems[0]).toMatchObject({ id: 'referred', code: 'WORKITEM_SAMPLE_LAB_DIFFER' });
        const after = db.serialize(), again = backfill(db, true); expect(db.serialize()).toEqual(after);
        expect(again.sampleChanges).toEqual([]); expect(again.workItemChanges).toEqual([]);
        expect(db.prepare('SELECT details FROM AuditLog').get().details).toBe('original audit');
        expect(db.prepare('SELECT value FROM Result').get().value).toBe('12.5');
    });
    test.each(['legacy duplicate', 'existing code collision'])('%s refuses the entire apply, including otherwise-valid work-item corrections', kind => {
        db.prepare('INSERT INTO Sample(id, labId, assignedLab, labSampleCode) VALUES (?, ?, ?, ?)').run('duplicate', kind === 'legacy duplicate' ? 'S123' : null, 'lab-b', kind === 'existing code collision' ? 'S123' : null);
        const before = db.serialize(), report = backfill(db, true);
        expect(report.refused).toBe(true); expect(report.duplicates[0].code).toBe('SAMPLE_CODE_DUPLICATE'); expect(db.serialize()).toEqual(before);
    });
    test('migration is additive, code uniqueness is nullable, and SQL rejects unsupported sequence scopes', () => {
        expect(db.prepare('SELECT COUNT(*) AS n FROM LabSequence').get().n).toBe(0);
        db.prepare('UPDATE Sample SET labSampleCode = ? WHERE id = ?').run('code', 's1');
        expect(() => db.prepare('UPDATE Sample SET labSampleCode = ? WHERE id = ?').run('code', 's2')).toThrow(/UNIQUE/);
        expect(() => db.prepare('INSERT INTO LabSequence VALUES (?,?,?,?)').run('lab-a', 'UNKNOWN', 2026, 1)).toThrow(/CHECK/);
        expect(() => db.prepare('INSERT INTO LabSequence VALUES (?,?,?,?)').run('lab-a', 'SAMPLE', 2026, 0)).toThrow(/CHECK/);
    });
    test('apply registers the actual exchange UDFs required by existing sample triggers', () => {
        db.exec("CREATE TRIGGER existing_exchange_trigger AFTER UPDATE ON Sample BEGIN SELECT exchange_compute_hash('{}', '[]'); END;");
        expect(() => backfill(db, true)).not.toThrow();
        expect(db.prepare("SELECT labSampleCode FROM Sample WHERE id='s1'").get().labSampleCode).toBe('S123');
    });
});
