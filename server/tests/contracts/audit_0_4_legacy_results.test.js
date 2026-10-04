const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../app');
const prisma = require('../../prisma');
const { getAuthToken } = require('../setup');
const labId = 'LAB-AUDIT-04';
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const wire = x => JSON.parse(JSON.stringify(x));

describe('Audit 0.4: legacy status result writes are disabled', () => {
    let token, username;
    beforeAll(async () => { token = await getAuthToken('LAB_TECHNICIAN', labId); username = jwt.decode(token).username; });
    async function fixture(analysis = 'EC') {
        const sampleId = id('SMP-04');
        await prisma.sample.create({ data: { id: sampleId, originalId: sampleId, labId: sampleId, assignedLab: labId,
            status: 'PROCESSING', receptionDate: new Date(), dryingStatus: 'DONE', preparationStatus: 'DONE' } });
        return prisma.workItem.create({ data: { id: id('WI-04'), sampleId, analysis, status: 'ASSIGNED', assignedTo: username,
            assignedLab: labId, category: ['ARCHIVING','DISPOSAL','ARCH','DISP','Archive','Dispose'].includes(analysis) ? 'Post-Analytical'
                : ['DRYING', 'PREPARATION'].includes(analysis) ? 'Operational Gates' : 'Chemical' } });
    }
    const put = (item, data) => request(app).put(`/api/work/${item.id}/status`).set('Authorization', `Bearer ${token}`).send(data);
    test.each(['7.2', '<0.5', 0, '', null, { value: 7 }])('analytical result %j returns 410 and preserves data', async result => {
        const item = await fixture('PH_H2O');
        const before = wire(item);
        const res = await put(item, { status: 'COMPLETED', result });
        expect(res.status).toBe(410); expect(res.body.code).toBe('USE_WORKBENCH');
        expect(res.body.destination).toBe(`/workbench?workItemId=${encodeURIComponent(item.id)}`);
        expect(wire(await prisma.workItem.findUnique({ where: { id: item.id } }))).toEqual(before);
        expect(await prisma.result.count({ where: { sampleId: item.sampleId } })).toBe(0);
        expect(await prisma.auditLog.count({ where: { sampleId: item.sampleId } })).toBe(0);
    });
    test('status-only analytical start still works without writing results', async () => {
        const item = await fixture();
        expect((await put(item, { status: 'IN_PROGRESS' })).status).toBe(200);
        const after = await prisma.workItem.findUnique({ where: { id: item.id } });
        expect(after.status).toBe('IN_PROGRESS'); expect(after.result).toBeNull();
    });
    test.each(['DRYING', 'PREPARATION'])('%s completion still records checklist evidence through status', async analysis => {
        const item = await fixture(analysis);
        const res = await put(item, { status: 'COMPLETED', result: JSON.stringify({ checklist: [true,true,true] }) });
        expect(res.status).toBe(200); expect(res.body.receipt.analysis).toBe(analysis);
        const after = await prisma.workItem.findUnique({ where: { id: item.id } });
        expect(after.status).toBe('COMPLETED'); expect(JSON.parse(after.result).kind).toBe('operational-checklist-v1');
        expect(await prisma.result.count({ where: { sampleId: item.sampleId } })).toBe(0);
    });
    test.each(['ARCHIVING', 'DISPOSAL', 'ARCH', 'DISP', 'Archive', 'Dispose'])('%s status endpoint remains available with operational evidence', async analysis => {
        const item = await fixture(analysis);
        const res = await put(item, { status: 'COMPLETED', result: 'Procedure recorded' });
        expect(res.status).toBe(200);
        const after = await prisma.workItem.findUnique({ where: { id: item.id } });
        expect(after.status).toBe('COMPLETED'); expect(after.result).toBe('Procedure recorded');
    });
    test('no client status-endpoint call sends a result field', () => {
        const root = path.resolve(__dirname, '../../../client/src');
        const violations = [];
        for (const name of fs.readdirSync(root, { recursive: true }).filter(name => /\.[jt]sx?$/.test(name))) {
            const source = fs.readFileSync(path.join(root, name), 'utf8');
            for (const match of source.matchAll(/axios\.put\(([\s\S]*?)\);/g)) {
                if (match[1].includes('/api/work/') && match[1].includes('/status') && /\bresult\s*[:,}]/.test(match[1])) violations.push(name);
            }
        }
        expect(violations).toEqual([]);
    });
    test('DataSheet keeps recorded zero visible and replaces result edits with a workbench link', () => {
        const React = require('../../../client/node_modules/react');
        const ReactDOMServer = require('../../../client/node_modules/react-dom/server');
        const esbuild = require('../../../client/node_modules/esbuild');
        const source = fs.readFileSync(path.resolve(__dirname, '../../../client/src/pages/DataSheet.jsx'), 'utf8');
        const compiled = esbuild.transformSync(source, { loader: 'jsx', format: 'cjs' });
        const values = [[{ id: 'item/zero', analysis: 'EC', labId: 'SAMPLE-04', result: 0, status: 'COMPLETED' }], false, '', '', ['EC']];
        let slot = 0;
        const hooks = { ...React, useState: () => [values[slot++], () => {}], useEffect: () => {} };
        const mod = { exports: {} };
        const axios = { get: jest.fn(), put: jest.fn() };
        vm.runInNewContext(compiled.code, { module: mod, exports: mod.exports, require: name => {
            if (name === 'react') return hooks;
            if (name === 'axios') return axios;
            if (name === 'react-router-dom') return { Link: ({ to, children, ...props }) => React.createElement('a', { ...props, href: to }, children) };
            if (name.includes('AnalysisCatalogueContext')) return { useAnalysisNames: () => code => code };
            if (name.includes('LanguageContext')) return { useLanguage: () => ({ t: (_, fallback) => fallback }) };
            if (name === 'lucide-react') return new Proxy({}, { get: () => () => null });
            throw Error('Unexpected import '+name);
        }, console, encodeURIComponent });
        const html = ReactDOMServer.renderToStaticMarkup(React.createElement(mod.exports.default));
        expect(html).toContain('href="/workbench?workItemId=item%2Fzero"');
        expect(html).toMatch(/<span[^>]*>0<\/span>/);
        expect(html).not.toContain('Save Changes'); expect(html).not.toMatch(/<td[^>]*>[\s\S]*?<input/);
        expect(axios.put).not.toHaveBeenCalled();
    });
});
