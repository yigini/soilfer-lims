const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const clientRoot = path.resolve(__dirname, '../../../client');
const esbuild = require(path.join(clientRoot, 'node_modules/esbuild'));
const React = require(path.join(clientRoot, 'node_modules/react'));

const completeValues = () => ({
    blanks: [{ value: 0 }], controls: [{ expected: 7, measured: 7 }],
    duplicates: [{ value1: 7, value2: 7 }]
});

describe('Audit 0.1: explicit QC measurements at evaluation', () => {
    let token;
    let batchId;
    beforeAll(async () => { token = await getAuthToken('LAB_TECHNICIAN', 'AUDIT-QC-VALUES'); });
    beforeEach(async () => {
        batchId = `AUDIT-QC-${randomUUID()}`;
        await prisma.batch.create({ data: {
            id: batchId, labId: 'AUDIT-QC-VALUES', analysis: 'PH_H2O', profile: 'RACK_40',
            status: 'OPEN', createdBy: 'audit-fixture', history: '[]', qcResults: '{}'
        } });
    });
    afterEach(async () => {
        await prisma.batchQcResult.deleteMany({ where: { batchId } });
        await prisma.batch.delete({ where: { id: batchId } });
    });

    test.each([
        ['empty payload', {}],
        ['empty collections', { blanks: [], controls: [], duplicates: [] }],
        ['partial types', { blanks: [{ value: 0 }] }],
        ['missing duplicate reading', { ...completeValues(), duplicates: [{ value1: 7 }] }],
        ['empty blank', { ...completeValues(), blanks: [{ value: '' }] }],
        ['whitespace control', { ...completeValues(), controls: [{ expected: 7, measured: ' ' }] }],
        ['invalid numeric value', { ...completeValues(), blanks: [{ value: 'no reading' }] }],
        ['boolean blank', { ...completeValues(), blanks: [{ value: false }] }],
        ['null control record', { ...completeValues(), controls: [null] }]
    ])('rejects %s without changing stored QC or audit evidence', async (_, payload) => {
        const before = await prisma.batch.findUnique({ where: { id: batchId } });
        const auditCount = await prisma.auditLog.count({ where: { entityId: batchId } });
        const res = await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send(payload);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('QC_VALUES_MISSING');
        expect(await prisma.batch.findUnique({ where: { id: batchId } })).toEqual(before);
        expect(await prisma.batchQcResult.count({ where: { batchId } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { entityId: batchId } })).toBe(auditCount);
    });

    test.each([0, '0'])('accepts an explicitly entered zero blank (%s)', async value => {
        const res = await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send({ ...completeValues(), blanks: [{ value }] });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('QC_PASS');
        expect(res.body.evaluation.blanks[0].value).toBe(0);
    });

    test('rejecting an incomplete new evaluation preserves existing QC measurements', async () => {
        await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send(completeValues()).expect(200);
        const before = await prisma.batch.findUnique({ where: { id: batchId } });
        const rows = await prisma.batchQcResult.findMany({ where: { batchId }, orderBy: { id: 'asc' } });
        await request(app).post(`/api/qc/batches/${batchId}/evaluate`)
            .set('Authorization', `Bearer ${token}`).send({}).expect(400);
        expect(await prisma.batch.findUnique({ where: { id: batchId } })).toEqual(before);
        expect(await prisma.batchQcResult.findMany({ where: { batchId }, orderBy: { id: 'asc' } })).toEqual(rows);
    });
});

// Execute the actual JSX component and its event handlers with a stateful hook host.
// No browser, production data, source-string assertions or duplicated handler logic.
function modalHost() {
    const hooks = [];
    let cursor = 0;
    let pendingEffects = [];
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => value === b[i]);
    const react = { ...React,
        useState(initial) {
            const index = cursor++;
            if (!(index in hooks)) hooks[index] = { value: typeof initial === 'function' ? initial() : initial };
            return [hooks[index].value, value => {
                hooks[index].value = typeof value === 'function' ? value(hooks[index].value) : value;
            }];
        },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) pendingEffects.push(effect);
            hooks[index] = { deps };
        },
        useCallback(callback, deps) {
            const index = cursor++;
            if (!sameDeps(hooks[index]?.deps, deps)) hooks[index] = { deps, value: callback };
            return hooks[index].value;
        }
    };
    const axios = {
        get: jest.fn().mockResolvedValue({ data: { data: [
            { id: 'fixture-batch', status: 'OPEN', profile: 'RACK_40', numberFormat: { decimal: '.', thousands: null } },
            { id: 'second-batch', status: 'OPEN', profile: 'RACK_40', numberFormat: { decimal: '.', thousands: null } }
        ] } }),
        post: jest.fn().mockResolvedValue({ data: { status: 'QC_PASS' } }),
        put: jest.fn()
    };
    const load = (file, resolve) => {
        const module = { exports: {} };
        vm.runInNewContext(esbuild.transformSync(fs.readFileSync(file, 'utf8'), { loader: 'jsx', format: 'cjs' }).code,
            { module, exports: module.exports, require: resolve, console });
        return module.exports;
    };
    const parser = load(path.join(clientRoot, 'src/utils/messageFormatter.js'), () => ({}));
    const Component = load(path.join(clientRoot, 'src/components/workbench/BatchModal.jsx'), name => {
        if (name === 'react') return react;
        if (name === 'axios') return axios;
        if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
        if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
        if (name.includes('messageFormatter')) return parser;
        if (name.includes('shared/numberParse')) return require('../../../shared/numberParse');
        if (name === './NumberPreview') return () => null;
        throw new Error(`Unexpected component dependency: ${name}`);
    }).default;
    let tree;
    const nodes = node => {
        if (Array.isArray(node)) return node.flatMap(nodes);
        if (!node || typeof node !== 'object') return [];
        return [node, ...nodes(node.props?.children)];
    };
    return {
        axios,
        async render(isOpen = true) {
            for (let i = 0; i < 4; i++) {
                cursor = 0;
                tree = Component({ isOpen, analysisCode: 'PH_H2O', selectedWorkItemIds: [] });
                const effects = pendingEffects;
                pendingEffects = [];
                effects.forEach(effect => effect());
                await new Promise(resolve => setImmediate(resolve));
            }
            return tree;
        },
        find(id) { return nodes(tree).find(node => node.props?.['data-testid'] === id); },
        qcTab() { return nodes(tree).find(node => node.type === 'button' && node.props.children === 'QC Measurements & State'); }
    };
}

describe('Audit 0.1: BatchModal explicit input component behavior', () => {
    test.each(['1,234', '1.234', '6 ,42'])('ambiguous or malformed QC input %s cannot be sent', async raw => {
        const host = modalHost();
        await host.render(); host.qcTab().props.onClick(); await host.render();
        for (const id of ['qc-blank-input', 'qc-ctrl-exp-input', 'qc-ctrl-meas-input', 'qc-dup1-input', 'qc-dup2-input']) {
            host.find(id).props.onChange({ target: { value: id === 'qc-dup1-input' ? raw : '7' } });
            await host.render();
        }
        expect(host.find('evaluate-qc-btn').props.disabled).toBe(true);
        await host.find('evaluate-qc-btn').props.onClick();
        expect(host.axios.post).not.toHaveBeenCalled();
    });
    test('opening QC with no input disables evaluation and clicking its handler sends no request', async () => {
        const host = modalHost();
        await host.render();
        host.qcTab().props.onClick();
        await host.render();
        for (const id of ['qc-blank-input', 'qc-ctrl-exp-input', 'qc-ctrl-meas-input', 'qc-dup1-input', 'qc-dup2-input']) {
            expect(host.find(id).props.value).toBe('');
        }
        expect(host.find('evaluate-qc-btn').props.disabled).toBe(true);
        await host.find('evaluate-qc-btn').props.onClick();
        expect(host.axios.post).not.toHaveBeenCalled();
        expect(host.axios.put).not.toHaveBeenCalled();
    });

    test('requires every field, accepts zero and decimal comma, and clears inputs when reopened', async () => {
        const host = modalHost();
        await host.render();
        host.qcTab().props.onClick();
        await host.render();
        const values = { 'qc-blank-input': '0', 'qc-ctrl-exp-input': '7,00', 'qc-ctrl-meas-input': '7,03', 'qc-dup1-input': '6,85' };
        for (const [id, value] of Object.entries(values)) {
            host.find(id).props.onChange({ target: { value } });
            await host.render();
        }
        expect(host.find('evaluate-qc-btn').props.disabled).toBe(true);
        await host.find('evaluate-qc-btn').props.onClick();
        expect(host.axios.post).not.toHaveBeenCalled();
        host.find('qc-dup2-input').props.onChange({ target: { value: '6,87' } });
        await host.render();
        expect(host.find('evaluate-qc-btn').props.disabled).toBe(false);
        await host.find('evaluate-qc-btn').props.onClick();
        expect(host.axios.post).toHaveBeenCalledWith('/api/qc/batches/fixture-batch/evaluate', {
            blanks: [{ value: 0, rawInput: { value: '0' } }], controls: [{ expected: 7, measured: 7.03, rawInput: { expected: '7,00', measured: '7,03' } }],
            duplicates: [{ value1: 6.85, value2: 6.87, rawInput: { value1: '6,85', value2: '6,87' } }]
        });
        await host.render(false);
        await host.render(true);
        expect(host.find('qc-blank-input').props.value).toBe('');
        expect(host.find('evaluate-qc-btn').props.disabled).toBe(true);
    });
});
