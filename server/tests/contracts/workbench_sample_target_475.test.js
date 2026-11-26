const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const React = require('react');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken, generateToken, ensureTestLab } = require('../setup');
const { usersDb } = require('../../db');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const esbuild = require(require.resolve('esbuild', { paths: [path.resolve(__dirname, '../../../client')] }));

const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const labId = 'LAB-475-TARGET';
const clientRoot = path.resolve(__dirname, '../../../client/src');

function loadClientModule(file, resolve = () => ({})) {
    const mod = { exports: {} };
    const code = esbuild.transformSync(fs.readFileSync(path.join(clientRoot, file), 'utf8'), {
        loader: file.endsWith('.jsx') ? 'jsx' : 'js',
        format: 'cjs'
    }).code;
    vm.runInNewContext(code, {
        module: mod,
        exports: mod.exports,
        require: resolve,
        console,
        window: { addEventListener: () => {}, removeEventListener: () => {}, localStorage: { getItem: () => null, setItem: () => {} } },
        document: { addEventListener: () => {}, removeEventListener: () => {} },
        setTimeout,
        clearTimeout
    });
    return mod.exports;
}

function findElements(tree, predicate) {
    if (Array.isArray(tree)) return tree.flatMap(node => findElements(node, predicate));
    if (!tree || typeof tree !== 'object') return [];
    return [...(predicate(tree) ? [tree] : []), ...findElements(tree.props?.children, predicate)];
}

function textContent(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(textContent).join(' ');
    return textContent(node.props?.children);
}

describe('Issue #475: sample-targeted Workbench queue and UI guard', () => {
    let techAToken;
    let techBToken;
    let managerToken;
    let sampleAId;
    let sampleBId;
    let workItemAId;

    beforeAll(async () => {
        await ensureTestLab(labId, 'TEST');
        const techAUserObj = usersDb.create({
            username: `tech_a_475_${crypto.randomUUID().slice(0, 8)}`,
            password: 'test-password-123',
            role: 'LAB_TECHNICIAN',
            labId,
            countries: ['TEST'],
            projects: ['SOILFER-US'],
            fullName: 'Technician A'
        });
        const techBUserObj = usersDb.create({
            username: `tech_b_475_${crypto.randomUUID().slice(0, 8)}`,
            password: 'test-password-123',
            role: 'LAB_TECHNICIAN',
            labId,
            countries: ['TEST'],
            projects: ['SOILFER-US'],
            fullName: 'Technician B'
        });
        techAToken = generateToken(techAUserObj);
        techBToken = generateToken(techBUserObj);
        managerToken = await getAuthToken('LAB_MANAGER', labId, ['TEST'], ['SOILFER-US']);

        const techAUser = techAUserObj.username;
        const techBUser = techBUserObj.username;
        const analysis = id('AN475');
        sampleAId = id('SMP475A');
        sampleBId = id('SMP475B');
        workItemAId = id('WI475A');
        const workItemBId = id('WI475B');

        await prisma.analysis.create({ data: { code: analysis, name: 'Issue 475 test analysis', units: 'mg/kg', status: 'active' } });
        await createSampleFixture(prisma, {
            data: { id: sampleAId, originalId: sampleAId, labId: sampleAId, assignedLab: labId, status: 'ACCEPTED', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' }
        });
        await createSampleFixture(prisma, {
            data: { id: sampleBId, originalId: sampleBId, labId: sampleBId, assignedLab: labId, status: 'ACCEPTED', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' }
        });
        await createWorkItemFixture(prisma, {
            data: { id: workItemAId, sampleId: sampleAId, analysis, assignedLab: labId, assignedTo: techAUser, status: 'ASSIGNED', version: 0 }
        });
        await createWorkItemFixture(prisma, {
            data: { id: workItemBId, sampleId: sampleBId, analysis, assignedLab: labId, assignedTo: techBUser, status: 'ASSIGNED', version: 0 }
        });
    });

    test('assigned technician gets target OK with the sample work item', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .query({ sampleId: sampleAId })
            .set('Authorization', `Bearer ${techAToken}`);

        expect(res.status).toBe(200);
        expect(res.body.target).toEqual({ sampleId: sampleAId, status: 'OK' });
        const allSampleIds = res.body.groups.flatMap(g => g.items.map(i => i.sampleId));
        expect(allSampleIds).toContain(sampleAId);
    });

    test('other technician gets NO_ASSIGNED_WORK_FOR_SAMPLE while keeping their own queue', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .query({ sampleId: sampleAId })
            .set('Authorization', `Bearer ${techBToken}`);

        expect(res.status).toBe(200);
        expect(res.body.target).toEqual({ sampleId: sampleAId, status: 'NO_ASSIGNED_WORK_FOR_SAMPLE' });
        const allSampleIds = res.body.groups.flatMap(g => g.items.map(i => i.sampleId));
        expect(allSampleIds).not.toContain(sampleAId);
        expect(allSampleIds).toContain(sampleBId);
    });

    test('manager gets target OK for the sample', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .query({ sampleId: sampleAId })
            .set('Authorization', `Bearer ${managerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.target).toEqual({ sampleId: sampleAId, status: 'OK' });
    });

    test('work-item deep link to another technician item still returns 403', async () => {
        const res = await request(app)
            .get('/api/workbench/queue')
            .query({ workItemId: workItemAId })
            .set('Authorization', `Bearer ${techBToken}`);

        expect(res.status).toBe(403);
    });

    test('all five locales provide the no-assigned-work and back-to-sample messages', () => {
        for (const locale of ['en', 'es', 'es-419', 'fr', 'pt']) {
            const messages = require(`../../../client/src/translations/${locale}.json`).workbenchUi;
            expect(typeof messages.noWorkAssignedForSample).toBe('string');
            expect(messages.noWorkAssignedForSample.trim()).not.toBe('');
            expect(typeof messages.backToSample).toBe('string');
            expect(messages.backToSample.trim()).not.toBe('');
        }
    });

    test('WorkbenchShell shows message and no worksheet when target has NO_ASSIGNED_WORK_FOR_SAMPLE', async () => {
        const en = require('../../../client/src/translations/en.json');
        const states = [];
        const refs = [];
        let effectQueue = [];
        let stateCursor = 0;
        let refCursor = 0;
        const hooks = {
            ...React,
            useState(initial) {
                const idx = stateCursor++;
                if (!(idx in states)) states[idx] = typeof initial === 'function' ? initial() : initial;
                return [states[idx], next => { states[idx] = typeof next === 'function' ? next(states[idx]) : next; }];
            },
            useRef(initial) {
                const idx = refCursor++;
                if (!(idx in refs)) refs[idx] = { current: initial };
                return refs[idx];
            },
            useCallback(fn) { return fn; },
            useEffect(fn) { effectQueue.push(fn); }
        };
        const icons = new Proxy({}, { get: (_, name) => Object.assign(props => React.createElement('span', props), { iconName: String(name) }) });
        const WorksheetArea = Object.assign(props => React.createElement('div', { 'data-testid': 'worksheet-area', ...props }), { displayName: 'WorksheetArea' });
        const Link = Object.assign(props => React.createElement('a', { href: props.to, ...props }), { displayName: 'Link' });
        const axios = {
            get: jest.fn(async url => {
                if (url === '/api/workbench/queue') {
                    return {
                        data: {
                            target: { sampleId: 'sample-target-a', status: 'NO_ASSIGNED_WORK_FOR_SAMPLE' },
                            groups: [{ analysis: 'PH_H2O', analysisName: 'pH', items: [{ workItemId: 'wi-other', sampleId: 'sample-other-b' }] }],
                            stats: { totalItems: 1, myWorkCount: 1 }
                        }
                    };
                }
                return { data: { receipts: [] } };
            })
        };

        const WorkbenchShell = loadClientModule('components/workbench/WorkbenchShell.jsx', name => {
            if (name === 'react') return hooks;
            if (name === 'react-router-dom') return { Link };
            if (name === 'axios') return axios;
            if (name === 'lucide-react') return icons;
            if (name.includes('AuthContext')) return { useAuth: () => ({ user: { id: 'u2', username: 'techB', role: 'LAB_TECHNICIAN', labId }, hasPermission: () => false }) };
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: key => en.workbenchUi[key.split('.').at(-1)] || key }) };
            if (name.includes('NotificationContext')) return { useNotifications: () => ({}) };
            if (name.includes('HelpContext')) return { useHelp: () => ({ clearBlockers: () => {} }) };
            if (name.includes('WorksheetArea')) return WorksheetArea;
            if (name.includes('offlineDb')) return { getLocalDraft: async () => null };
            if (name.includes('syncEngine')) return {};
            if (name.includes('BenchDensity')) return Object.assign(() => null, { readBenchDensity: () => 'standard' });
            if (name.endsWith('.css')) return {};
            return () => null;
        }).default;

        const render = () => {
            stateCursor = 0;
            refCursor = 0;
            effectQueue = [];
            return WorkbenchShell({ initialSampleId: 'sample-target-a' });
        };

        render();
        for (const fn of effectQueue) fn();
        await new Promise(resolve => setTimeout(resolve, 20));
        const tree = render();

        const notice = findElements(tree, n => n.props?.['data-testid'] === 'workbench-no-assigned-work');
        expect(notice.length).toBe(1);
        expect(textContent(notice[0])).toContain('This sample has no work assigned to you.');
        const backLinks = findElements(notice[0], n => n.type === Link && n.props?.to === '/samples/sample-target-a');
        expect(backLinks.length).toBe(1);
        const worksheets = findElements(tree, n => n.type === WorksheetArea);
        expect(worksheets.length).toBe(0);
    });
});
