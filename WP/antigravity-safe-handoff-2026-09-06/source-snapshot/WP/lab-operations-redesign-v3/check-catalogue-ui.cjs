// Local production-build UI verification. All API responses are fixtures; no live LIMS connection.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { chromium } = require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '../..'), dist = path.join(root, 'client/dist');
const results = [], errors = [], calls = [];
const check = (name, pass) => { assert.ok(pass, name); results.push(name); };
const catalogue = [
    { code: 'CAT_PH', name: 'Soil pH in water — local procedure', units: 'pH units', categoryId: 'chem', matrix: 'SOIL', status: 'active', orderable: true, canEdit: true, validation: { min: 0, max: 14 } },
    { code: 'CAT_CARBON', name: 'Soil organic carbon', units: 'g/kg', categoryId: 'chem', matrix: 'SOIL', status: 'active', orderable: true, canEdit: true, validation: null },
    { code: 'SPEC_PARAM_1', name: 'Specialized Agronomic Parameter 1', status: 'active', matrix: 'SOIL', orderable: false, canEdit: true, configurationIssues: ['Placeholder parameter: define a real measurand and procedure before ordering.'], validation: null }
];
const categories = [{ id: 'chem', name: 'Chemical properties', canEdit: true }];
const groups = [{ id: 'routine', name: 'Routine soil measurements', analyses: ['CAT_PH', 'CAT_CARBON'], orderable: true, canEdit: true }];
const item = (code, ready) => ({ workItemId: `WI_${code}`, id: `WI_${code}`, sampleId: 'INTERNAL_UUID', sampleDisplayId: 'S004', originalId: 'GTM0007-3-1C-T', projectCode: 'SOILFER-US', analysis: code, version: 1, status: 'ASSIGNED', priority: 'Normal', currentResult: '', editorKind: code === 'DRYING' ? 'OPERATIONAL' : 'NUMERIC', readiness: { isReady: ready, blockers: ready ? [] : ['PREPARATION_PREREQUISITE_BLOCKED'], reasons: ready ? [] : ['Complete sample preparation before analysis.'], warnings: [] }, dryingStatus: 'PENDING', preparationStatus: 'PENDING', sample: { status: 'ACCEPTED', dryingStatus: 'PENDING', preparationStatus: 'PENDING' } });
const queue = { groups: [
    { analysis: 'DRYING', analysisName: 'DRYING', category: 'Operational Gates', unit: null, items: [item('DRYING', true)] },
    { analysis: 'CAT_PH', analysisName: 'CAT_PH', category: 'Chemical properties', unit: 'pH units', items: [item('CAT_PH', false)] }
], stats: { totalItems: 2, totalPending: 2, totalInProgress: 0, ready: 1, needsAttention: 1, readyToSubmit: 0 } };
async function main() {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://localhost');
        let file = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
        if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
        res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' })[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    try {
        const context = await browser.newContext({ viewport: { width: 1536, height: 1050 } });
        let user = { id: 'UI_TEST', username: 'fixture_admin', fullName: 'Catalogue reviewer', role: 'SUPER_ADMIN', labId: 'GTM-LAB1', language: 'en' };
        await context.addInitScript(() => { localStorage.setItem('token', 'local-ui-fixture'); localStorage.setItem('user', JSON.stringify({ id: 'UI_TEST', username: 'fixture_admin', fullName: 'Catalogue reviewer', role: 'SUPER_ADMIN', labId: 'GTM-LAB1', language: 'en' })); localStorage.setItem('locale', 'en'); localStorage.setItem('darkMode', 'false'); });
        await context.route('**/*', async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin !== base) return route.abort();
            if (!url.pathname.startsWith('/api/')) return route.continue();
            const p = url.pathname; calls.push(`${request.method()} ${p}`);
            let data = {};
            if (p === '/api/auth/me') data = user;
            else if (p === '/api/config/analyses' && request.method() === 'GET') data = catalogue;
            else if (p === '/api/config/categories') data = categories;
            else if (p === '/api/config/groups') data = groups;
            else if (p === '/api/config/methodologies') data = [];
            else if (p.endsWith('/usage')) data = { workItems: 7, results: 4, orderLines: 3, sampleOrders: 3, methodologies: 0, labDefaults: 0, equipment: 0, packages: 1, dependencies: 0 };
            else if (p === '/api/admin/settings') data = { branding: { title: 'SoilFER LIMS' } };
            else if (p === '/api/admin/languages') data = [];
            else if (p === '/api/public/i18n/bootstrap') data = { languages: [], translations: {} };
            else if (p === '/api/notifications') data = [];
            else if (p === '/api/workbench/queue') data = queue;
            else if (p === '/api/workbench/v2/receipts') data = { receipts: [] };
            else if (p === '/api/workbench/batch-save') data = { saved: 1 };
            await route.fulfill({ json: data });
        });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/admin`);
        await page.getByRole('button', { name: 'Analysis Configuration', exact: true }).click();
        await page.getByRole('heading', { name: 'Master Analysis Catalogue' }).waitFor();
        check('Parameter count is derived from the catalogue', await page.getByText('3 Parameters', { exact: true }).isVisible());
        check('Package count reflects real groups', await page.getByText('1 Packages', { exact: true }).isVisible());
        check('Placeholder warning is visible', await page.getByText(/Placeholder parameter: define/).isVisible());
        await page.screenshot({ path: path.join(__dirname, 'catalogue-admin-verified.png'), fullPage: true });
        await page.getByRole('combobox', { name: 'Parameter availability' }).selectOption('review');
        check('Needs-review filter isolates the invalid definition', !(await page.getByText('Soil organic carbon', { exact: true }).isVisible()));
        await page.getByRole('button', { name: 'Add Analysis Parameter' }).click();
        const unit = page.getByPlaceholder('e.g. g/kg, mg/kg, cmol(+)/kg, %, dS/m, pH units');
        check('New parameter has no invented reporting unit', await unit.inputValue() === '');
        check('New parameter has no invented numerical limits', (await page.getByRole('spinbutton').evaluateAll(nodes => nodes.map(node => node.value))).every(v => v === ''));
        check('New parameter starts inactive', await page.locator('select').filter({ has: page.locator('option[value="inactive"]') }).inputValue() === 'inactive');
        await page.getByRole('button', { name: 'Cancel', exact: true }).first().click();
        await page.getByRole('combobox', { name: 'Parameter availability' }).selectOption('all');
        const row = page.locator('tr').filter({ hasText: 'Soil pH in water — local procedure' });
        await row.getByRole('button', { name: /edit/i }).click();
        await page.getByRole('status').filter({ hasText: 'Connected records:' }).waitFor();
        check('Used parameters cannot silently change reporting units', await unit.isDisabled());
        await page.screenshot({ path: path.join(__dirname, 'catalogue-connections-verified.png'), fullPage: true });
        user = { ...user, username: 'fixture_technician', role: 'LAB_TECHNICIAN' };
        await page.goto(`${base}/workbench`);
        await page.getByRole('heading', { name: 'Technician Workbench' }).waitFor();
        await page.getByText('Soil pH in water — local procedure', { exact: true }).waitFor();
        check('Workbench uses the live catalogue name even when queue metadata contains only a code', true);
        check('Operational names are readable without fake catalogue analyses', await page.getByText('Sample drying', { exact: true }).isVisible());
        await page.goto(`${base}/workbench?analysis=DRYING`);
        await page.getByRole('button', { name: 'Sample identity and container label verified', exact: true }).waitFor();
        check('Drying opens a checklist rather than a numerical result field', await page.getByPlaceholder('0.00').count() === 0);
        check('Drying does not ask for numeric result basis or replicate metadata', await page.getByText('Determination Identity', { exact: true }).count() === 0);
        await page.getByRole('button', { name: 'Sample identity and container label verified', exact: true }).click();
        check('Checklist progress reflects partial evidence', await page.getByText('Checklist: 1/3 confirmed', { exact: true }).isVisible());
        await page.getByText('Drafts saved', { exact: false }).first().waitFor();
        await page.screenshot({ path: path.join(__dirname, 'catalogue-drying-verified.png'), fullPage: true });
        await page.goto(`${base}/workbench?analysis=CAT_PH`);
        const numeric = page.getByRole('textbox', { name: 'S004 determination', exact: true });
        await numeric.waitFor();
        check('Analytical input is disabled while preparation is incomplete', await numeric.isDisabled());
        await page.screenshot({ path: path.join(__dirname, 'catalogue-blocked-analysis-verified.png'), fullPage: true });
        check('No runtime page errors occurred', errors.length === 0);
        check('No external endpoint received a request', true);
        fs.writeFileSync(path.join(__dirname, 'catalogue-ui-results.json'), JSON.stringify({ checkedAt: new Date().toISOString(), mode: 'production build, fixture APIs, no production data', passed: results.length, checks: results, errors, apiPaths: [...new Set(calls)] }, null, 2));
        console.log(`${results.length} browser checks passed.`);
    } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
