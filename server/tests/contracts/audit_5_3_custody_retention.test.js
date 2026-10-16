const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma');
const custody = require('../../services/custodyService');
const retention = require('../../services/sampleRetentionService');
const holds = require('../../services/sampleHoldService');
const { createSampleFixture } = require('../helpers/workflowFixtures');
const { getAuthToken } = require('../setup');
const { loadCustodyMigrationSource } = require('../../services/custodyMigrationSource');
const { installSampleCustody } = require('../../scripts/install_sample_custody');
const labId = 'CUSTODY-' + randomUUID(), otherLabId = 'CUSTODY-OTHER-' + randomUUID();
let actor, token, app, destination;
beforeAll(async () => {
    for (const id of [labId, otherLabId]) await prisma.lab.create({ data: { id, code: id, name: 'Custody contract laboratory', country: 'GTM', timezone: 'UTC' } });
    token = await getAuthToken('LAB_MANAGER', labId); actor = jwt.decode(token);
    app = express(); app.use(express.json()); app.use(require('../../middleware/authMiddleware').verifyToken);
    app.use('/api/samples', require('../../routes/sampleRoutes'));
    app.use('/api/projects', require('../../routes/projectRoutes'));
    app.use('/api/reception', require('../../routes/receptionRoutes'));
    destination = await prisma.inventoryLocation.create({ data: { id: randomUUID(), labId, purpose: 'SAMPLE', name: 'Controlled archive shelf' } });
});
async function sample(data = {}) {
    const id = randomUUID();
    return createSampleFixture(prisma, { data: { id, originalId: id, assignedLab: labId, status: 'RECEIVED', metadata: '{}', fieldMetadata: '{}', ...data } });
}
const post = (id, body) => request(app).post(`/api/samples/${id}/custody/move`).set('Authorization', `Bearer ${token}`).send(body);
test('move without a controlled location returns 400 with no event or sample mutation', async () => {
    const row = await sample();
    const response = await post(row.id, { reason: 'Transfer', location: 'a free-text shelf' });
    expect(response.status).toBe(400); expect(response.body.code).toBe('CUSTODY_LOCATION_REQUIRED');
    expect(await prisma.sample.findUnique({ where: { id: row.id } })).toEqual(row);
    expect(await prisma.custodyEvent.count({ where: { sampleId: row.id } })).toBe(0);
});
test('malformed closure/custody fields and missing receiving-lab attribution return stable 4xx responses', async () => {
    const row = await sample();
    const malformed = await post(row.id, { toLocationId: destination.id, reason: 'Move', counterparty: 42 });
    expect(malformed.status).toBe(400); expect(malformed.body.code).toBe('CUSTODY_FIELDS_INVALID');
    const closure = await request(app).post(`/api/samples/${row.id}/dispose`).set('Authorization', `Bearer ${token}`).send([]);
    expect(closure.status).toBe(400); expect(closure.body.code).toBe('INVALID_CLOSURE_FIELDS');
    const unattributed = await sample({ assignedLab: null, labId });
    const missingLab = await post(unattributed.id, { toLocationId: destination.id, reason: 'Cannot infer the receiving facility' });
    expect(missingLab.status).toBe(409); expect(missingLab.body.code).toBe('CUSTODY_LAB_REQUIRED');
});
test('receipt acknowledgement is authenticated, immutable, first-receipt based and does not write legacy signatures', async () => {
    const row = await sample({ status: 'EXPECTED' });
    await prisma.$transaction(tx => custody.acknowledgeReceipt(tx, { sample: row, actor,
        input: { custodyCarrierName: 'Recorded courier', custodyTrackingNumber: 'DN-1', receivingOfficerSignature: 'forged', custodySenderSignature: 'forged' } }));
    await prisma.$transaction(tx => custody.acknowledgeReceipt(tx, { sample: row, actor, input: { custodyCarrierName: 'Later courier' } }));
    const view = await custody.receiptView(prisma, row);
    expect(view.custodyCarrierName).toBe('Recorded courier');
    expect(view.custodyAcknowledgement).toMatchObject({ by: actor.username, actorId: actor.id, authenticated: true, source: 'LIVE' });
    expect(view.receivingOfficerSignature).toBeNull();
    expect((await prisma.sample.findUnique({ where: { id: row.id } })).receivingOfficerSignature).toBeNull();
    const events = await custody.list(prisma, row.id, actor); expect(events).toHaveLength(1);
    const db = new Database(process.env.DATABASE_PATH, { fileMustExist: true });
    try {
        expect(() => db.prepare('UPDATE CustodyEvent SET "by"=? WHERE id=?').run('another', events[0].id)).toThrow(/CUSTODY_EVENT_IMMUTABLE/);
        expect(() => db.prepare('DELETE FROM CustodyEvent WHERE id=?').run(events[0].id)).toThrow(/CUSTODY_EVENT_IMMUTABLE/);
    } finally { db.close(); }
    expect(await custody.list(prisma, row.id, actor)).toEqual(events);
});
test('moves use same-lab sample locations and preserve immutable container identity', async () => {
    const row = await sample();
    const foreign = await prisma.inventoryLocation.create({ data: { id: randomUUID(), labId: otherLabId, purpose: 'SAMPLE', name: 'Other lab shelf' } });
    const reagent = await prisma.inventoryLocation.create({ data: { id: randomUUID(), labId, name: 'Reagent shelf' } });
    for (const toLocationId of [foreign.id, reagent.id, 'missing']) expect((await post(row.id, { toLocationId, reason: 'Transfer' })).body.code).toBe('CUSTODY_LOCATION_INVALID');
    const first = await post(row.id, { toLocationId: destination.id, reason: 'Archive transfer', by: 'forged', at: '2000-01-01' });
    expect(first.status).toBe(200); expect(first.body.event).toMatchObject({ type: 'MOVED', by: actor.username, actorId: actor.id, fromLocationId: null, toLocationId: destination.id });
    expect(new Date(first.body.event.at).getTime()).toBeGreaterThan(Date.now() - 10000);
    const second = await post(row.id, { toLocationId: destination.id, reason: 'Shelf check' });
    expect(second.body.event.fromLocationId).toBe(destination.id);
    expect(await prisma.sample.findUnique({ where: { id: row.id } })).toEqual(row);
    const inaccessible = await sample({ assignedLab: otherLabId });
    expect((await post(inaccessible.id, { toLocationId: destination.id, reason: 'Transfer' })).status).toBe(403);
});
test('consignment custody views use the first authenticated receipt and cannot be read across laboratories', async () => {
    const own = await prisma.consignment.create({ data: { id: randomUUID(), code: randomUUID(), labId, receivedBy: actor.username } });
    const foreign = await prisma.consignment.create({ data: { id: randomUUID(), code: randomUUID(), labId: otherLabId, receivedBy: 'Other receiver' } });
    await prisma.$transaction(tx => custody.acknowledgeReceipt(tx, { consignment: own, actor, input: { deliveredBy: 'Consignment courier', deliveryNoteRef: 'Header-ack' } }));
    const stored = await prisma.consignment.findUnique({ where: { id: own.id } });
    expect(stored.custodyCarrierName).toBeNull(); expect(stored.receivingOfficerSignature).toBeNull();
    const listing = await request(app).get('/api/reception/consignments').set('Authorization', `Bearer ${token}`);
    expect(listing.status).toBe(200); expect(listing.body.data.map(row => row.id)).not.toContain(foreign.id);
    expect(listing.body.data.find(row => row.id === own.id)).toMatchObject({ custodyCarrierName: 'Consignment courier', custodyTrackingNumber: 'Header-ack',
        custodyAcknowledgement: { authenticated: true, by: actor.username } });
    const detail = await request(app).get(`/api/reception/consignments/${foreign.id}`).set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(403); expect(detail.body.code).toBeTruthy();
});
test('publication retention reads registry/lab policy and optional project override; invalid override rolls back', async () => {
    const row = await sample(), issuedAt = new Date('2026-10-01T10:00:00Z');
    const policy = require('../../services/policyService');
    const days = await policy.get(labId, 'sample.retentionDaysAfterReport');
    const first = await prisma.$transaction(tx => retention.retainAtPublication(tx, row, issuedAt));
    expect(first.retainUntil.getTime()).toBe(issuedAt.getTime() + days * 86400000);
    const project = await prisma.project.create({ data: { id: randomUUID(), code: randomUUID(), name: 'Configured retention', status: 'ACTIVE', policyConfig: JSON.stringify({ sample: { retentionDaysAfterReport: 7 } }) } });
    const projectSample = await sample({ projectId: project.id, projectCode: project.code });
    const second = await prisma.$transaction(tx => retention.retainAtPublication(tx, projectSample, issuedAt));
    expect(second.retainUntil.toISOString()).toBe('2026-10-08T10:00:00.000Z');
    await prisma.project.update({ where: { id: project.id }, data: { policyConfig: JSON.stringify({ sample: { retentionDaysAfterReport: -1 } }) } });
    await expect(prisma.$transaction(tx => retention.retainAtPublication(tx, projectSample, new Date()))).rejects.toMatchObject({ code: 'PROJECT_RETENTION_INVALID', statusCode: 409 });
    expect((await prisma.sample.findUnique({ where: { id: projectSample.id } })).retainUntil.toISOString()).toBe(second.retainUntil.toISOString());
});
test('container movement is ledger-derived and never rewrites its physical identity; outgoing custody requires a counterparty', async () => {
    const row = await sample();
    const created = await request(app).post(`/api/samples/${row.id}/containers`).set('Authorization', `Bearer ${token}`).send({ kind: 'BULK', massG: 30 });
    expect(created.status).toBe(201);
    const container = created.body.container;
    const moved = await post(row.id, { containerId: container.id, toLocationId: destination.id, reason: 'Store physical bulk container' });
    expect(moved.status).toBe(200);
    expect(await prisma.sampleContainer.findUnique({ where: { id: container.id } })).toMatchObject({ storageLocationId: null, code: container.code, massG: 30 });
    const projected = await request(app).get(`/api/samples/${row.id}/containers`).set('Authorization', `Bearer ${token}`);
    expect(projected.body.containers[0].storageLocationId).toBe(destination.id);
    const outgoing = body => request(app).post(`/api/samples/${row.id}/custody`).set('Authorization', `Bearer ${token}`).send(body);
    expect((await outgoing({ type: 'SENT_OUT', reason: 'External examination', containerId: container.id })).body.code).toBe('CUSTODY_COUNTERPARTY_REQUIRED');
    const sent = await outgoing({ type: 'SENT_OUT', reason: 'External examination', containerId: container.id, counterparty: 'Partner laboratory', reference: 'Dispatch-17' });
    expect(sent.status).toBe(200); expect(sent.body.event).toMatchObject({ fromLocationId: destination.id, toLocationId: null, counterparty: 'Partner laboratory', reference: 'Dispatch-17' });
    const returned = await outgoing({ type: 'RETURNED', reason: 'External examination completed', containerId: container.id, toLocationId: destination.id });
    expect(returned.status).toBe(200);
    const technicianToken = await getAuthToken('LAB_TECHNICIAN', labId);
    const forbidden = await request(app).post(`/api/samples/${row.id}/custody/move`).set('Authorization', `Bearer ${technicianToken}`).send({ toLocationId: destination.id, reason: 'Unauthorized transfer' });
    expect(forbidden.status).toBe(403); expect(forbidden.body.code).toBe('CUSTODY_FORBIDDEN');
});
test('project retention setting is owner-scoped, validates integers, preserves other policy settings and can inherit again', async () => {
    const project = await prisma.project.create({ data: { id: randomUUID(), code: randomUUID(), name: 'Owner retention', status: 'ACTIVE', labId,
        policyConfig: JSON.stringify({ allowedChannels: ['DESK'], sample: { otherSetting: 'preserved' } }) } });
    const update = value => request(app).put(`/api/projects/${project.id}`).set('Authorization', `Bearer ${token}`).send({ retentionDaysAfterReport: value });
    expect((await update(12)).status).toBe(200);
    expect(JSON.parse((await prisma.project.findUnique({ where: { id: project.id } })).policyConfig))
        .toEqual({ allowedChannels: ['DESK'], sample: { otherSetting: 'preserved', retentionDaysAfterReport: 12 } });
    for (const value of [-1, 2.5, '12']) { const response = await update(value); expect(response.status).toBe(400); expect(response.body.code).toBe('PROJECT_RETENTION_INVALID'); }
    expect((await update(null)).status).toBe(200);
    expect(JSON.parse((await prisma.project.findUnique({ where: { id: project.id } })).policyConfig)).toEqual({ allowedChannels: ['DESK'], sample: { otherSetting: 'preserved' } });
    const foreignToken = await getAuthToken('LAB_MANAGER', otherLabId);
    expect((await request(app).put(`/api/projects/${project.id}`).set('Authorization', `Bearer ${foreignToken}`).send({ retentionDaysAfterReport: 2 })).status).toBe(403);
});
test('disposal queue contains only overdue same-lab material without canonical/legacy hold or open amendment', async () => {
    const now = new Date(), past = new Date(now.getTime() - 86400000);
    const eligible = await sample({ status: 'APPROVED', retainUntil: past });
    await sample({ status: 'ARCHIVED', retainUntil: new Date(now.getTime() + 86400000) });
    await sample({ status: 'APPROVED', retainUntil: null });
    await sample({ status: 'APPROVED', retainUntil: past, assignedLab: otherLabId });
    await sample({ status: 'APPROVED', retainUntil: past, metadata: '{"provenanceHold":{"status":"OPEN"}}' });
    const held = await sample({ status: 'APPROVED', retainUntil: past });
    await prisma.$transaction(tx => holds.raiseHold(tx, { sampleId: held.id, type: 'CUSTODY', reason: 'Investigation', actor }));
    const amended = await sample({ status: 'APPROVED', retainUntil: past });
    await prisma.sampleAmendment.create({ data: { sampleId: amended.id, type: 'REPORT', status: 'PENDING', reason: 'Client correction', createdBy: actor.username } });
    const completed = await sample({ status: 'APPROVED', retainUntil: past });
    const previous = await prisma.report.create({ data: { sampleId: completed.id, version: 1, revision: 0, content: '{}', generatedBy: actor.username, status: 'SUPERSEDED', publishedAt: past } });
    const consumed = await require('../helpers/reportAmendmentFixture').approvedReportAmendment(prisma, completed.id, { reason: 'Completed revision', authorizedBy: actor.username });
    await prisma.report.create({ data: { sampleId: completed.id, version: 2, revision: 1, content: '{}', generatedBy: actor.username,
        issuedBy: actor.username, status: 'PUBLISHED', amendmentId: consumed.id, amendmentReason: consumed.reason,
        amendmentAuthorizedBy: consumed.authorizedBy, supersedesReportId: previous.id, publishedAt: past } });
    expect(await retention.hasOpenAmendment(prisma, completed.id)).toBe(false);
    const rows = await retention.queue(prisma, actor, now);
    expect(rows.map(r => r.id)).toContain(eligible.id);
    expect(rows.map(r => r.id)).toContain(completed.id);
    for (const id of [held.id, amended.id]) expect(rows.map(r => r.id)).not.toContain(id);
    expect(rows.every(r => r.assignedLab === labId && r.retainUntil < now)).toBe(true);
    const response = await request(app).get('/api/samples/disposal-queue').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200); expect(response.body.samples.map(r => r.id)).toEqual(rows.map(r => r.id));
});
test('a rejected sample is disposed through the shared transition with a reason and cannot be moved again', async () => {
    const row = await sample({ status: 'RECEIVED_REJECTED', rejectionReason: 'Unsuitable packaging' });
    const url = `/api/samples/${row.id}/dispose`;
    const missing = await request(app).post(url).set('Authorization', `Bearer ${token}`).send({});
    expect(missing.status).toBe(400); expect(missing.body.code).toBe('TRANSITION_REASON_REQUIRED');
    const response = await request(app).post(url).set('Authorization', `Bearer ${token}`).send({ reason: 'Rejected material disposal under the laboratory SOP' });
    expect(response.status).toBe(200); expect(response.body.status).toBe('DISPOSED');
    const event = await prisma.custodyEvent.findFirst({ where: { sampleId: row.id, type: 'DISPOSED' } });
    expect(event.by).toBe(actor.username); expect(JSON.parse(event.evidence).reason).toMatch(/laboratory SOP/);
    expect((await prisma.sample.findUnique({ where: { id: row.id } })).rejectionReason).toBe(row.rejectionReason);
    expect((await post(row.id, { toLocationId: destination.id, reason: 'Invalid movement' })).status).toBe(400);
});
test('expiry, holds and amendments are rechecked in the shared disposal transition', async () => {
    const { transitionSample } = require('../../services/sampleStateService');
    const future = await sample({ status: 'APPROVED', retainUntil: new Date(Date.now() + 86400000) });
    await expect(transitionSample(future.id, 'DISPOSED', actor, 'Premature disposal', {}, prisma)).rejects.toMatchObject({ code: 'SAMPLE_RETENTION_ACTIVE' });
    const held = await sample({ status: 'RECEIVED_REJECTED' });
    await prisma.$transaction(tx => holds.raiseHold(tx, { sampleId: held.id, type: 'CUSTODY', reason: 'Pending enquiry', actor }));
    await expect(transitionSample(held.id, 'DISPOSED', actor, 'Disposal', {}, prisma)).rejects.toMatchObject({ code: 'SAMPLE_HELD' });
    const amended = await sample({ status: 'RECEIVED_REJECTED' });
    await prisma.sampleAmendment.create({ data: { sampleId: amended.id, type: 'CLERICAL', status: 'APPROVED', reason: 'Correction', createdBy: actor.username } });
    await expect(transitionSample(amended.id, 'DISPOSED', actor, 'Disposal', {}, prisma)).rejects.toMatchObject({ code: 'SAMPLE_AMENDMENT_OPEN' });
});
test('installer dry-run preserves bytes; apply preserves every legacy custody field and JSON; repeat is a no-op', async () => {
    const file = path.resolve(__dirname, '../.tmp/custody-install-' + randomUUID() + '.db');
    const reader = new Database(process.env.DATABASE_PATH, { readonly: true, fileMustExist: true });
    await reader.backup(file); reader.close();
    const { PrismaClient } = require('../../prisma_client');
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
    const fixtureDb = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: 'file:' + file }) });
    const id = randomUUID(), at = '2026-09-01T08:00:00.000Z';
    try { await createSampleFixture(fixtureDb, { data: { id, originalId: id, assignedLab: labId, status: 'RECEIVED',
        receptionDate: new Date(at), receivedBy: 'legacy-officer', custodyCarrierName: 'Courier',
        receivingOfficerSignature: 'CONFIRMED:legacy:old', receptionData: '{ "coc": {"tracking":"legacy"} }',
        metadata: '{"archiveLocation":"old shelf"}', updatedAt: new Date(at) } }); } finally { await fixtureDb.$disconnect(); }
    const db = new Database(file);
    const guards = [...loadCustodyMigrationSource().guardsSql.matchAll(/CREATE (?:UNIQUE )?(?:TRIGGER|INDEX) "([^"]+)"/g)].map(m => m[1]);
    for (const name of guards) db.exec(`DROP ${name.includes('first_') ? 'INDEX' : 'TRIGGER'} "${name}"`);
    db.exec('DROP TABLE CustodyEvent; ALTER TABLE Sample DROP COLUMN retainUntil; ALTER TABLE InventoryLocation DROP COLUMN purpose;');
    db.prepare('DELETE FROM _schema_migrations WHERE id=?').run('207_sample_custody');
    const before = db.prepare('SELECT * FROM Sample WHERE id=?').get(id); db.close();
    const bytes = fs.readFileSync(file);
    expect(installSampleCustody({ dbPath: file })).toMatchObject({ classification: 'PRE_207', mode: 'DRY_RUN', totalChanges: 0 });
    expect(fs.readFileSync(file)).toEqual(bytes);
    expect(installSampleCustody({ dbPath: file, apply: true }).classification).toBe('COMPLETE_207');
    const after = new Database(file);
    const row = after.prepare('SELECT * FROM Sample WHERE id=?').get(id); delete row.retainUntil;
    expect(row).toEqual(before);
    const event = after.prepare('SELECT * FROM CustodyEvent WHERE sampleId=?').get(id);
    expect(event.source).toBe('LEGACY'); expect(event.acknowledgement).toBe(0);
    expect(JSON.parse(event.evidence).legacy.receivingOfficerSignature).toBe(before.receivingOfficerSignature);
    expect(JSON.parse(event.evidence).legacy.receptionData).toBe(before.receptionData);
    after.close();
    expect(installSampleCustody({ dbPath: file, apply: true })).toMatchObject({ mode: 'NO_OP', totalChanges: 0 });
    const tampered = new Database(file); tampered.exec('DROP TRIGGER CustodyEvent_no_update'); tampered.close();
    const tamperedBytes = fs.readFileSync(file);
    expect(() => installSampleCustody({ dbPath: file, apply: true })).toThrow(/differs/);
    expect(fs.readFileSync(file)).toEqual(tamperedBytes);
});
