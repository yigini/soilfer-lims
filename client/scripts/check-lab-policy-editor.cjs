const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { createRequire } = require('node:module');
const clientRoot = path.resolve(__dirname, '..');
const clientRequire = createRequire(path.join(clientRoot, 'package.json'));

async function checkLabPolicyEditor({ chromium, fixture, artifactDir }) {
    const esbuild = clientRequire('esbuild'), postcss = clientRequire('postcss');
    const tailwind = clientRequire('tailwindcss'), autoprefixer = clientRequire('autoprefixer');
    const config = clientRequire('tailwindcss/loadConfig')(path.join(clientRoot, 'tailwind.config.js'));
    const tokens = fs.readFileSync(path.join(clientRoot, 'src/styles/appearance-tokens.css'), 'utf8');
    const styles = fs.readFileSync(path.join(clientRoot, 'src/index.css'), 'utf8').replace(/@import ['"]\.\/styles\/appearance-tokens\.css['"];?/, '');
    const css = await postcss([tailwind({ ...config, content: [path.join(clientRoot, 'src/**/*.{js,ts,jsx,tsx}').replaceAll('\\', '/')] }), autoprefixer]).process(tokens + '\n' + styles, { from: undefined });
    const entry = `import React from 'react'; import {createRoot} from 'react-dom/client';
        import LabPolicies from './src/components/lab/LabPolicies.jsx';
        import {LanguageProvider} from './src/context/LanguageContext.jsx';
        createRoot(document.getElementById('root')).render(<LanguageProvider><main style={{maxWidth:1100,margin:'24px auto',padding:16}}><LabPolicies labId="demo"/></main></LanguageProvider>);`;
    const build = await esbuild.build({ stdin: { contents: entry, loader: 'jsx', resolveDir: clientRoot }, bundle: true,
        write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' } });
    const bundle = build.outputFiles[0].text;
    const server = http.createServer((request, response) => {
        if (request.url === '/app.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(bundle); }
        else if (request.url === '/app.css') { response.setHeader('Content-Type', 'text/css'); response.end(css.css); }
        else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><html><head><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script src="/app.js"></script></body></html>'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser, page, canEdit = true; const patches = [], pageErrors = [];
    const en = clientRequire('./src/translations/en.json');
    const translate = key => key.split('.').reduce((value, part) => value?.[part], en);
    try {
        browser = await chromium.launch();
        page = await browser.newPage({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
        page.on('pageerror', error => pageErrors.push(error.message));
        await page.route('**/api/public/i18n/bootstrap', route => route.fulfill({ json: { languages: [], translations: {} } }));
        await page.route('**/api/qc/rules**', route => route.fulfill({ json: { data: { versions: [], fieldPolicies: {}, expectedVersion: 7, warnings: [] } } }));
        await page.route('**/api/labs/demo/policies**', async route => {
            if (route.request().method() === 'PATCH') { patches.push(route.request().postDataJSON()); await route.fulfill({ json: {} }); }
            else await route.fulfill({ json: { ...fixture, canEdit } });
        });
        await page.goto(`http://127.0.0.1:${server.address().port}`);
        const settings = page.locator('table').nth(0), overrides = page.locator('table').nth(1);
        await settings.waitFor();
        const editableRows = () => settings.locator('tbody > tr').filter({ has: page.getByRole('button', { name: en.policies.edit, exact: true, disabled: false }) });
        const firstKey = Object.keys(fixture.registry).find(key => fixture.registry[key].scope !== 'INSTALL');
        const lastKey = Object.keys(fixture.registry).filter(key => fixture.registry[key].scope !== 'INSTALL').at(-1);
        const firstLabel = translate(fixture.registry[firstKey].description), lastLabel = translate(fixture.registry[lastKey].description);
        const formFor = label => page.getByRole('heading', { name: label, exact: true }).locator('xpath=ancestor::form');
        const assertInlineVisible = async (row, label, image) => {
            const heading = page.getByRole('heading', { name: label, exact: true }); await heading.waitFor();
            await page.waitForFunction(label => [...document.querySelectorAll('form h3')].some(h => h.textContent === label && h.getBoundingClientRect().top >= 0 && h.getBoundingClientRect().bottom <= innerHeight), label, { timeout: 5000 });
            const form = formFor(label);
            assert.equal(await row.evaluate((row, form) => form.closest('tr')?.previousElementSibling === row, await form.elementHandle()), true, 'Editor must be directly under the clicked setting');
            assert.equal(await row.getAttribute('data-editing'), 'true', 'Selected setting must be identified');
            assert.equal(await page.locator('form').filter({ has: page.getByRole('button', { name: en.policies.save, exact: true }) }).count(), 1, 'Only one setting editor may be open');
            if (image) { fs.mkdirSync(artifactDir, { recursive: true }); await page.screenshot({ path: path.join(artifactDir, image) }); }
            return form;
        };
        await editableRows().first().getByRole('button', { name: en.policies.edit, exact: true }).click();
        await assertInlineVisible(editableRows().first(), firstLabel, 'first-setting.png');
        await editableRows().last().getByRole('button', { name: en.policies.edit, exact: true }).click();
        let form = await assertInlineVisible(editableRows().last(), lastLabel, 'last-setting.png');
        assert.equal(await form.getByRole('button', { name: en.policies.save, exact: true }).isDisabled(), true);
        assert.equal(await form.getByText(en.policyEditor.reasonRequiredHint, { exact: true }).isVisible(), true);
        await form.getByLabel(en.policies.reason, { exact: true }).fill('Unsaved note');
        page.once('dialog', async dialog => { assert.equal(dialog.message(), en.policyEditor.replaceUnsaved); await dialog.dismiss(); });
        await editableRows().first().getByRole('button', { name: en.policies.edit, exact: true }).click();
        form = await assertInlineVisible(editableRows().last(), lastLabel);
        assert.equal(await form.getByLabel(en.policies.reason, { exact: true }).inputValue(), 'Unsaved note');
        page.once('dialog', async dialog => { assert.equal(dialog.message(), en.policyEditor.replaceUnsaved); await dialog.accept(); });
        await editableRows().first().getByRole('button', { name: en.policies.edit, exact: true }).click();
        await assertInlineVisible(editableRows().first(), firstLabel);
        await editableRows().last().getByRole('button', { name: en.policies.edit, exact: true }).click();
        form = formFor(lastLabel); await form.locator('input[type=number]').first().fill('2.5');
        await form.getByLabel(en.policies.reason, { exact: true }).fill('Reviewed test limits');
        await form.getByRole('button', { name: en.policies.save, exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('form h3'));
        assert.deepEqual(patches[0], { reason: 'Reviewed test limits', changes: [{ key: 'pt.zScoreLimits', value: { questionable: 2.5, unsatisfactory: fixture.resolved['pt.zScoreLimits'].value.unsatisfactory }, analysisCode: null, methodologyId: null }], expectedVersion: 7 });
        const modeLabel = translate(fixture.registry['qc.mode'].description);
        const modeRow = settings.locator('tbody > tr').filter({ has: page.getByText(modeLabel, { exact: true }) }).filter({ hasNot: page.locator('form') });
        await modeRow.getByRole('button', { name: en.policies.clear, exact: true }).click();
        form = await assertInlineVisible(modeRow, modeLabel); await form.getByLabel(en.policies.reason, { exact: true }).fill('Reset lab rule');
        await form.getByRole('button', { name: en.policies.save, exact: true }).click(); await page.waitForFunction(() => !document.querySelector('form h3'));
        assert.deepEqual(patches[1], { reason: 'Reset lab rule', changes: [{ key: 'qc.mode', clear: true, analysisCode: null, methodologyId: null }], expectedVersion: 7 });
        const override = overrides.locator('tbody > tr').filter({ has: page.getByRole('button', { name: en.policies.clear, exact: true }) }).last();
        await override.getByRole('button', { name: en.policies.clear, exact: true }).click();
        form = await assertInlineVisible(override, modeLabel, 'override-clear.png'); await form.getByLabel(en.policies.reason, { exact: true }).fill('Reset method rule');
        await form.getByRole('button', { name: en.policies.save, exact: true }).click(); await page.waitForFunction(() => !document.querySelector('form h3'));
        assert.deepEqual(patches[2], { reason: 'Reset method rule', changes: [{ key: 'qc.mode', clear: true, analysisCode: 'EC', methodologyId: 'method-ec' }], expectedVersion: 7 });
        const installRow = settings.locator('tbody > tr').first();
        assert.equal(await installRow.getByRole('button', { name: en.policies.edit, exact: true }).isDisabled(), true);
        assert.equal(await installRow.getByText(en.policyEditor.installScopeOnly, { exact: true }).isVisible(), true);
        await page.locator('select').filter({ has: page.locator('option[value="PH"]') }).selectOption('PH'); await settings.waitFor();
        const labOnly = settings.locator('tbody > tr').filter({ has: page.getByText(translate(fixture.registry['numbers.decimalSeparator'].description), { exact: true }) });
        assert.equal(await labOnly.getByRole('button', { name: en.policies.edit, exact: true }).isDisabled(), true);
        assert.equal(await labOnly.getByText(en.policyEditor.labScopeOnly, { exact: true }).isVisible(), true);
        await page.locator('select').filter({ has: page.locator('option[value="PH"]') }).selectOption('EC'); await settings.waitFor();
        await page.locator('select').filter({ has: page.locator('option[value="method-ec"]') }).selectOption('method-ec'); await settings.waitFor();
        const analysisOnly = settings.locator('tbody > tr').filter({ has: page.getByText(lastLabel, { exact: true }) });
        assert.equal(await analysisOnly.getByRole('button', { name: en.policies.edit, exact: true }).isDisabled(), true);
        assert.equal(await analysisOnly.getByText(en.policyEditor.labOrAnalysisScopeOnly, { exact: true }).isVisible(), true);
        canEdit = false; await page.reload(); await settings.waitFor();
        assert.equal(await page.getByRole('button', { name: en.policies.edit, exact: true }).count(), 0);
        assert.equal(await page.getByRole('button', { name: en.policies.clear, exact: true }).count(), 0);
        assert.equal(patches.length, 3); assert.deepEqual(pageErrors, []);
        return { firstKey, lastKey, viewport: { width: 1280, height: 800 }, inlineEditAndClear: true, requestsUnchanged: true, readOnlyPreserved: true };
    } finally {
        await browser?.close(); await new Promise(resolve => server.close(resolve));
    }
}
module.exports = { checkLabPolicyEditor };
