const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');

const clientRoot = path.resolve(__dirname, '..');
const clientRequire = createRequire(path.join(clientRoot, 'package.json'));

// Render the production components and production Tailwind rules. Only data,
// session providers and the closed inspection modal are synthetic boundaries;
// this browser contract never starts a backend or opens a database.
async function checkMobileLayout({ chromium, artifactDir }) {
    const esbuild = clientRequire('esbuild');
    const postcss = clientRequire('postcss');
    const tailwind = clientRequire('tailwindcss');
    const autoprefixer = clientRequire('autoprefixer');
    const config = clientRequire('tailwindcss/loadConfig')(path.join(clientRoot, 'tailwind.config.js'));
    const themeCss = fs.readFileSync(path.join(clientRoot, 'src/styles/appearance-tokens.css'), 'utf8');
    const inputCss = fs.readFileSync(path.join(clientRoot, 'src/index.css'), 'utf8').replace(/@import ['"]\.\/styles\/appearance-tokens\.css['"];?/, '');
    const css = await postcss([tailwind({ ...config, content: [path.join(clientRoot, 'src/**/*.{js,ts,jsx,tsx}').replaceAll('\\', '/')] }), autoprefixer]).process(themeCss + '\n' + inputCss, { from: undefined });
    const stubs = {
        LanguageContext: "export const useLanguage=()=>({t:(_key,fallback)=>fallback});",
        AuthContext: "export const useAuth=()=>({user:null,can:()=>false});",
        AnalysisCatalogueContext: "const name=(code,fallback)=>fallback||code;export const useAnalysisNames=()=>name;",
        NotificationContext: "const subscribeToEvent=()=>()=>{};export const useNotifications=()=>({subscribeToEvent});",
        useRealtimeData: "const refresh=()=>{};const data={kpis:{exceptionsCount:12,pendingIntakes:345,unassignedTasks:678,awaitingReview:90,pendingApproval:12}};export const useRealtimeData=()=>({data,isLive:true,isStale:false,lastUpdated:null,refresh});export const formatLastUpdated=()=>'';",
        BatchInspectionModal: "export default function ClosedInspection(){return null;}",
        axios: "const data={data:[],meta:{page:1,limit:20,total:0,totalPages:1}};export default {get:async()=>({data})};",
    };
    const entry = `
        import React,{useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import {MemoryRouter} from 'react-router-dom';
        import ManagerQueue from './src/pages/ManagerQueue.jsx';
        import SamplesHeader from './src/components/samples/SamplesHeader.jsx';
        import SamplesFilterBar from './src/components/samples/SamplesFilterBar.jsx';
        const facets={lifecycle:{EXPECTED:40223,RECEIVED:12,ACCEPTED:5,ONGOING:1,COMPLETED:3,HISTORY:10,REJECTED:4}};
        const noop=()=>{};
        function SamplesFixture(){
            const [activeFilters,setFilters]=useState({});
            const toggle=(key,value)=>{window.__mobileLayoutClicks.push({key,value});setFilters({[key]:value});};
            return <main style={{padding:16,minWidth:0}}>
                <section id="samples-header"><SamplesHeader facets={facets} onSync={noop} onExport={noop} onToggleQuickFilter={toggle}/></section>
                <section id="samples-filter"><SamplesFilterBar search="" onSearchChange={noop} activeFilters={activeFilters} onToggleQuickFilter={toggle} onOpenAdvanced={noop} onReset={noop} totalResults={40223} facets={facets} page={1} pages={10} onPageChange={noop}/></section>
            </main>;
        }
        window.__mobileLayoutClicks=[];
        const manager=new URLSearchParams(location.search).get('screen')==='manager';
        createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[manager?'/manager-queue':'/samples']}>{manager?<ManagerQueue/>:<SamplesFixture/>}</MemoryRouter>);
    `;
    const build = await esbuild.build({ stdin: { contents: entry, loader: 'jsx', resolveDir: clientRoot }, bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'mobile-layout-data-boundaries', setup(buildApi) {
        buildApi.onResolve({ filter: /(?:^|\/)(LanguageContext|AuthContext|AnalysisCatalogueContext|NotificationContext|useRealtimeData|BatchInspectionModal)(?:\.jsx?)?$|^axios$/ }, args => ({ path: args.path.split('/').pop().replace(/\.jsx?$/, ''), namespace: 'mobile-layout-boundary' }));
        buildApi.onLoad({ filter: /.*/, namespace: 'mobile-layout-boundary' }, args => ({ contents: stubs[args.path], loader: 'js' }));
    } }] });
    const bundle = build.outputFiles[0].text;
    const listener = http.createServer((req, res) => {
        if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); }
        else if (req.url === '/fixture.css') { res.setHeader('Content-Type', 'text/css'); res.end(css.css); }
        else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><div id="root"></div><script src="/fixture.js"></script>'); }
    });
    let browser;
    const results = [], failures = [];
    fs.mkdirSync(artifactDir, { recursive: true });
    try {
        await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
        const origin = `http://127.0.0.1:${listener.address().port}`;
        browser = await chromium.launch();
        for (const width of [390, 1280]) {
            const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'en-US', hasTouch: width === 390 });
            try {
                await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
                const page = await context.newPage();
                await page.goto(origin + '/?screen=manager');
                const labels = ['QC Exceptions', 'New (Intake)', 'Assign Work', 'Review Submissions', 'Final Approvals'];
                await page.getByRole('button', { name: /Final Approvals/ }).waitFor();
                const buttons = await Promise.all(labels.map(label => page.getByRole('button', { name: new RegExp('^' + label.replace(/[()]/g, '\\$&')) }).evaluate(el => ({ label: el.textContent.trim(), width: el.clientWidth, contentWidth: el.scrollWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }))));
                const overlaps = buttons.filter((button, index) => button.contentWidth > button.width + 1 || (index && buttons[index - 1].right > button.left + 1));
                results.push({ screen: 'manager', width, buttons, overlappingOrClippedTabs: overlaps.length });
                if (overlaps.length) failures.push(`Manager Queue ${width}px: ${overlaps.length} tab labels overflow their buttons.`);
                await page.getByRole('button', { name: /Final Approvals/ }).click();
                await page.screenshot({ path: path.join(artifactDir, `manager-${width}.png`), fullPage: true });

                await page.goto(origin + '/?screen=samples');
                await page.getByTestId('qf-rejected').waitFor();
                const samples = await page.evaluate(() => {
                    const right = document.documentElement.clientWidth;
                    const filters = [...document.querySelectorAll('[data-testid^="qf-"]')].map(el => ({ id: el.dataset.testid, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
                    const stages = [...document.querySelectorAll('#samples-header .group')];
                    const strip = stages[0].parentElement;
                    return { viewport: right, bodyWidth: document.documentElement.scrollWidth, filterCount: filters.length, offscreenFilters: filters.filter(f => f.left < -1 || f.right > right + 1), stageCount: stages.length, stripWidth: strip.clientWidth, stripContentWidth: strip.scrollWidth, stripOverflowX: getComputedStyle(strip).overflowX };
                });
                results.push({ screen: 'samples', width, ...samples });
                if (samples.bodyWidth > samples.viewport + 1 || samples.offscreenFilters.length) failures.push(`Samples ${width}px: page or quick filters exceed the viewport.`);
                if (samples.stageCount !== 6 || samples.filterCount !== 7) failures.push(`Samples ${width}px: expected controls are missing.`);
                if (samples.stripContentWidth > samples.stripWidth + 1 && !['auto', 'scroll'].includes(samples.stripOverflowX)) failures.push(`Samples ${width}px: lifecycle stages escape their card instead of scrolling.`);
                await page.getByTestId('qf-rejected').click();
                assert.deepEqual(await page.evaluate(() => window.__mobileLayoutClicks.at(-1)), { key: 'status', value: 'RECEIVED_REJECTED' });
                const archived = page.locator('#samples-header').getByText('Archived', { exact: true });
                await archived.click();
                assert.deepEqual(await page.evaluate(() => window.__mobileLayoutClicks.at(-1)), { key: 'status', value: 'ARCHIVED,DISPOSED' });
                assert.ok(await archived.evaluate(el => el.getBoundingClientRect().left >= 0 && el.getBoundingClientRect().right <= innerWidth));
                await page.screenshot({ path: path.join(artifactDir, `samples-${width}.png`), fullPage: true });
            } finally { await context.close(); }
        }
    } finally {
        await browser?.close();
        if (listener.listening) await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
        fs.writeFileSync(path.join(artifactDir, 'layout-measurements.json'), JSON.stringify({ results, failures, databaseConnections: 0, physicalDeviceClaim: false }, null, 2));
    }
    assert.deepEqual(failures, [], failures.join('\n'));
    return results;
}

module.exports = { checkMobileLayout };
