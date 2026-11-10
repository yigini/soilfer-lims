const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('../../../client/node_modules/esbuild');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const { ensureTestLab, getAuthToken } = require('../setup');

function loadPreview() {
    const loadClientModule = (name, imports = {}) => {
        const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src', name), 'utf8');
        const { code } = transformSync(source, { loader: name.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs' });
        const module = { exports: {} };
        new Function('module', 'exports', 'require', code)(module, module.exports, dependency => imports[dependency] || {});
        return module.exports;
    };
    const assignmentWorkflow = loadClientModule('utils/assignmentWorkflow.js');
    return loadClientModule('components/sample/BulkAssignmentDialog.jsx', {
        '../../utils/assignmentWorkflow': assignmentWorkflow
    }).previewBulkAssignment;
}

test('preview keeps only selected, eligible work and lists held, finished and foreign items', () => {
    const preview = loadPreview();
    const sample = (id, lab, workItems, props = {}) => ({
        identity: { id, displayId: id, assignedLab: lab }, workItems,
        capabilities: { canAssign: { allowed: true } }, ...props
    });
    const item = (id, analysis, status = 'NOT_ASSIGNED', assignedTo = null) => ({ id, analysis, status, assignedTo });
    const samples = [
        sample('A', 'LAB-A', [item('dry', 'DRYING'), item('ph', 'PH_H2O'), item('soc', 'SOC', 'SUBMITTED')]),
        sample('B', 'LAB-A', [item('prep', 'PREPARATION'), item('arch', 'ARCHIVING'), item('disp', 'DISPOSAL')]),
        sample('C', 'LAB-A', [item('held', 'PH_H2O')], { held: true }),
        sample('D', 'LAB-B', [item('foreign', 'PH_H2O')]),
        sample('E', 'LAB-A', [item('expected', 'PH_H2O')], { capabilities: { canAssign: { allowed: false } } }),
        sample('F', 'LAB-A', [item('closed', 'ARCHIVING', 'ASSIGNED', 'existing-tech'), item('pair', 'DISPOSAL')])
    ];
    const all = preview(samples, { labId: 'LAB-A', mode: 'all', analyses: [] });
    expect(all.eligible.map(row => row.id)).toEqual(['dry', 'ph', 'prep']);
    expect(Object.fromEntries(all.skipped.map(row => [row.id, row.reason]))).toEqual({
        soc: 'workState', arch: 'chooseClosure', disp: 'chooseClosure', held: 'held',
        foreign: 'outsideLab', expected: 'sampleNotReady', closed: 'workState', pair: 'closureAlreadyAssigned'
    });
    expect(preview(samples, { labId: 'LAB-A', mode: 'prep', analyses: [] }).eligible.map(row => row.id)).toEqual(['dry', 'prep']);
    expect(preview(samples, { labId: 'LAB-A', mode: 'selected', analyses: ['ARCHIVING'] }).eligible.map(row => row.id)).toEqual(['arch']);
});

describe('multi-sample work assignment', () => {
    let manager, technician, tech, actor;
    const labA = 'LAB-GTM';
    const labB = 'LAB-HND';
    const send = (token, ids, options = {}) => request(app).post('/api/work/assign')
        .set('Authorization', 'Bearer ' + token)
        .send({ workItemIds: ids, assignee: tech.username, ...options });

    async function addSample(label, labId, items) {
        const sampleId = 'bulk-392-' + label;
        await createSampleFixture(prisma, { data: {
            id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId,
            country: labId === labA ? 'GTM' : 'HND', status: 'ACCEPTED', requiredAnalyses: JSON.stringify(['PH_H2O'])
        } });
        for (const [id, analysis, status] of items) {
            await createWorkItemFixture(prisma, { data: {
                id, sampleId, assignedLab: labId, analysis, status
            } });
        }
    }

    beforeAll(async () => {
        await ensureTestLab(labA, 'GTM');
        await ensureTestLab(labB, 'HND');
        manager = await getAuthToken('LAB_MANAGER', labA);
        technician = await getAuthToken('LAB_TECHNICIAN', labA);
        actor = jwt.decode(manager);
        tech = jwt.decode(technician);
        await addSample('a', labA, [['bulk-dry', 'DRYING', 'NOT_ASSIGNED'], ['bulk-finished', 'SOC', 'COMPLETED']]);
        await addSample('b', labA, [['bulk-ph', 'PH_H2O', 'NOT_ASSIGNED'], ['bulk-control', 'SOC', 'NOT_ASSIGNED']]);
        await addSample('foreign', labB, [['bulk-foreign', 'PH_H2O', 'NOT_ASSIGNED']]);
    });

    test('refuses a user without ASSIGN_WORK and refuses a mixed-lab request before writes', async () => {
        await send(technician, ['bulk-ph'], { summarizeNotifications: true }).expect(403);
        await send(manager, ['bulk-ph', 'bulk-foreign'], { summarizeNotifications: true }).expect(403);
        const rows = await prisma.workItem.findMany({ where: { id: { in: ['bulk-ph', 'bulk-foreign'] } } });
        expect(rows.every(row => row.status === 'NOT_ASSIGNED' && row.assignedTo === null)).toBe(true);
    });

    test('assigns eligible work across samples, keeps individual audit events, and sends one summary', async () => {
        const notifications = { userId: tech.id };
        const messages = { recipientId: tech.id };
        const before = await prisma.notification.count({ where: notifications });
        const messageBefore = await prisma.message.count({ where: messages });
        const result = await send(manager, ['bulk-dry', 'bulk-ph', 'bulk-finished'], { summarizeNotifications: true }).expect(200);
        expect(result.body.assigned).toBe(2);
        expect(result.body.errors).toEqual([expect.objectContaining({ id: 'bulk-finished' })]);
        const items = await request(app).get('/api/work').set('Authorization', 'Bearer ' + technician).expect(200);
        expect(items.body.data.map(row => row.id)).toEqual(expect.arrayContaining(['bulk-dry', 'bulk-ph']));
        expect((await prisma.workItem.findUnique({ where: { id: 'bulk-finished' } })).status).toBe('COMPLETED');
        expect(await prisma.notification.count({ where: notifications })).toBe(before + 1);
        expect(await prisma.message.count({ where: messages })).toBe(messageBefore + 1);

        await send(manager, ['bulk-control']).expect(200);
        const events = await prisma.auditLog.findMany({ where: {
            entityId: { in: ['bulk-dry', 'bulk-ph', 'bulk-control', 'bulk-finished'] },
            action: 'WORKITEM_ASSIGNED'
        } });
        expect(events.map(row => row.entityId).sort()).toEqual(['bulk-control', 'bulk-dry', 'bulk-ph']);
        for (const row of events) {
            expect(row).toMatchObject({ entity: 'WORKITEM', performedBy: actor.username, action: 'WORKITEM_ASSIGNED', labId: labA });
            expect(row.details).toContain(' to ' + tech.username);
            expect(JSON.parse(row.before).status).toBe('NOT_ASSIGNED');
            expect(JSON.parse(row.after).status).toBe('ASSIGNED');
        }
    });
});
