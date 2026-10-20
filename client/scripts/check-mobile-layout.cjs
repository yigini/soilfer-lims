const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');

const clientRoot = path.resolve(__dirname, '..');
const clientRequire = createRequire(path.join(clientRoot, 'package.json'));

// Compile the real App Layout (sidebar, content margins and padding) alongside
// the production components and Tailwind rules. Data/session providers and
// unrelated header/modal chrome are synthetic; no backend or database starts.
async function checkMobileLayout({ chromium, artifactDir }) {
    const esbuild = clientRequire('esbuild');
    const postcss = clientRequire('postcss');
    const tailwind = clientRequire('tailwindcss');
    const autoprefixer = clientRequire('autoprefixer');
    const config = clientRequire('tailwindcss/loadConfig')(path.join(clientRoot, 'tailwind.config.js'));
    const themeCss = fs.readFileSync(path.join(clientRoot, 'src/styles/appearance-tokens.css'), 'utf8');
    const inputCss = fs.readFileSync(path.join(clientRoot, 'src/index.css'), 'utf8').replace(/@import ['"]\.\/styles\/appearance-tokens\.css['"];?/, '');
    const css = await postcss([tailwind({ ...config, content: [path.join(clientRoot, 'src/**/*.{js,ts,jsx,tsx}').replaceAll('\\', '/')] }), autoprefixer]).process(themeCss + '\n' + inputCss, { from: undefined });
    const appSource = fs.readFileSync(path.join(clientRoot, 'src/App.jsx'), 'utf8');
    const samplesSource = fs.readFileSync(path.join(clientRoot, 'src/pages/Samples.jsx'), 'utf8');
    const samplesPageClass = samplesSource.match(/return \(\s*<div className="([^"]*max-w-\[1600px\][^"]*)"/);
    assert.ok(samplesPageClass, 'Use the actual Samples page content wrapper.');
    const stubs = {
        'closed-chrome': "const Closed=()=>null;export default Closed;export {Closed as Header,Closed as MobileHeader,Closed as MobileNavBar,Closed as MobileMoreSheet,Closed as SyncCentreModal,Closed as ContextHelpDrawer,Closed as AppearancePreviewNotice};",
        LanguageContext: `
            import en from ${JSON.stringify(path.join(clientRoot, 'src/translations/en.json'))};
            import es from ${JSON.stringify(path.join(clientRoot, 'src/translations/es.json'))};
            import {formatMessage} from ${JSON.stringify(path.join(clientRoot, 'src/utils/messageFormatter.js'))};
            const locale=new URLSearchParams(location.search).get('lang')||'en';
            const messages=locale==='es'?es:en;
            export const useLanguage=()=>({locale,t:(key,fallback,params)=>{
                const value=key.split('.').reduce((node,part)=>node?.[part],messages);
                return formatMessage(typeof value==='string'?value:fallback,params||{},locale);
            }});
        `,
        AuthContext: "export const useAuth=()=>({user:{role:'LAB_MANAGER'},can:()=>false});",
        ThemeContext: "export const useTheme=()=>({theme:{},darkMode:false});",
        SyncContext: "export const SyncProvider=({children})=>children;",
        HelpContext: "export const HelpProvider=({children})=>children;",
        AnalysisCatalogueContext: "const name=(code,fallback)=>fallback||code;export const useAnalysisNames=()=>name;",
        NotificationContext: "const subscribeToEvent=()=>()=>{};export const useNotifications=()=>({subscribeToEvent});export const NotificationProvider=({children})=>children;",
        useRealtimeData: "const refresh=()=>{};const data={kpis:{exceptionsCount:12,pendingIntakes:345,unassignedTasks:678,awaitingReview:90,pendingApproval:12}};export const useRealtimeData=()=>({data,isLive:true,isStale:false,lastUpdated:null,refresh});export const formatLastUpdated=()=>'';",
        BatchInspectionModal: "export default function ClosedInspection(){return null;}",
        axios: "const data={data:[],meta:{page:1,limit:20,total:0,totalPages:1}};export default {get:async()=>({data})};",
    };
    const entry = `
        import React,{useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import {MemoryRouter} from 'react-router-dom';
        import {LayoutContract as AppShell} from './src/App.jsx';
        import ManagerQueue from './src/pages/ManagerQueue.jsx';
        import SamplesHeader from './src/components/samples/SamplesHeader.jsx';
        import SamplesFilterBar from './src/components/samples/SamplesFilterBar.jsx';
        const facets={views:{daily:40223,expected:123,registry:40237},lifecycle:{EXPECTED:40223,RECEIVED:12,ACCEPTED:5,ONGOING:1,COMPLETED:3,HISTORY:10,REJECTED:4}};
        const noop=()=>{};
        function SamplesFixture(){
            const [activeFilters,setFilters]=useState({});
            const toggle=(key,value)=>{window.__mobileLayoutClicks.push({key,value});setFilters({[key]:value});};
            return <div className=${JSON.stringify(samplesPageClass[1])}>
                <section id="samples-header"><SamplesHeader facets={facets} onSync={noop} onExport={noop} onToggleQuickFilter={toggle}/></section>
                <section id="samples-filter"><SamplesFilterBar search="" onSearchChange={noop} activeFilters={activeFilters} onToggleQuickFilter={toggle} onOpenAdvanced={noop} onReset={noop} totalResults={40223} facets={facets} page={1} pages={10} onPageChange={noop} onViewChange={view=>window.__mobileLayoutViews.push(view)}/></section>
            </div>;
        }
        window.__mobileLayoutClicks=[];
        window.__mobileLayoutViews=[];
        const manager=new URLSearchParams(location.search).get('screen')==='manager';
        createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={[manager?'/manager-queue':'/samples']}><AppShell>{manager?<ManagerQueue/>:<SamplesFixture/>}</AppShell></MemoryRouter>);
    `;
    const build = await esbuild.build({ stdin: { contents: entry, loader: 'jsx', resolveDir: clientRoot }, bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'mobile-layout-data-boundaries', setup(buildApi) {
        // Add a test-only export without copying or changing Layout's JSX.
        buildApi.onLoad({ filter: /[/\\]src[/\\]App\.jsx$/ }, () => ({ contents: appSource + '\nexport { Layout as LayoutContract };', loader: 'jsx', resolveDir: path.join(clientRoot, 'src') }));
        buildApi.onResolve({ filter: /^\.\/pages\/|(?:^|\/)(Header|Footer|MobileHeader|MobileNavBar|MobileMoreSheet|SyncCentreModal|ContextHelpDrawer|AppearancePreviewNotice|ForcePasswordChangeModal|SessionKeeper|NotificationDrawer)(?:\.jsx?)?$/ }, () => ({ path: 'closed-chrome', namespace: 'mobile-layout-boundary' }));
        buildApi.onResolve({ filter: /(?:^|\/)(LanguageContext|AuthContext|ThemeContext|SyncContext|HelpContext|AnalysisCatalogueContext|NotificationContext|useRealtimeData|BatchInspectionModal)(?:\.jsx?)?$|^axios$/ }, args => ({ path: args.path.split('/').pop().replace(/\.jsx?$/, ''), namespace: 'mobile-layout-boundary' }));
        buildApi.onLoad({ filter: /.*/, namespace: 'mobile-layout-boundary' }, args => ({ contents: stubs[args.path], loader: 'js', resolveDir: clientRoot }));
    } }] });
    const bundle = build.outputFiles[0].text;
    const listener = http.createServer((req, res) => {
        if (req.url.startsWith('/assets/img/')) { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="40"/>'); }
        else if (req.url === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); }
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
        const cases = ['en', 'es'].flatMap(lang => [390, 1024, 1280, 1440].map(width => ({ lang, width })));
        for (const { lang, width } of cases) {
            const context = await browser.newContext({ viewport: { width, height: 844 }, locale: lang, hasTouch: width === 390 });
            try {
                await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
                const page = await context.newPage();
                page.on('pageerror', error => failures.push(`${lang} ${width}px: browser error: ${error.message}`));
                await page.goto(origin + '/?screen=manager&lang=en');
                const labels = ['QC Exceptions', 'New (Intake)', 'Assign Work', 'Review Submissions', 'Final Approvals'];
                await page.getByRole('button', { name: /Final Approvals/ }).waitFor();
                const buttons = await Promise.all(labels.map(label => page.getByRole('button', { name: new RegExp('^' + label.replace(/[()]/g, '\\$&')) }).evaluate(el => ({ label: el.textContent.trim(), width: el.clientWidth, contentWidth: el.scrollWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }))));
                const overlaps = buttons.filter((button, index) => button.contentWidth > button.width + 1 || (index && buttons[index - 1].right > button.left + 1));
                results.push({ screen: 'manager', width, lang: 'en', buttons, overlappingOrClippedTabs: overlaps.length });
                if (overlaps.length) failures.push(`Manager Queue ${width}px: ${overlaps.length} tab labels overflow their buttons.`);
                await page.getByRole('button', { name: /Final Approvals/ }).click();
                await page.screenshot({ path: path.join(artifactDir, `manager-${width}-${lang}.png`), fullPage: true });

                await page.goto(origin + '/?screen=samples&lang=' + lang);
                await page.getByTestId('qf-rejected').waitFor();
                const samples = await page.evaluate(() => {
                    const right = document.documentElement.clientWidth;
                    const filters = [...document.querySelectorAll('[data-testid^="qf-"]')].map(el => ({ id: el.dataset.testid, top: el.getBoundingClientRect().top }));
                    const quickStrip = document.querySelector('[data-testid="qf-expected"]').parentElement.parentElement;
                    const main = document.querySelector('main');
                    const search = document.querySelector('#samples-filter input');
                    const bar = document.querySelector('#samples-filter > div');
                    const stages = [...document.querySelectorAll('#samples-header .group')];
                    const strip = stages[0].parentElement;
                    return { viewport: right, bodyWidth: document.documentElement.scrollWidth, mainWidth: main.clientWidth, mainContentWidth: main.scrollWidth, sidebarWidth: document.querySelector('aside').getBoundingClientRect().width, filterCount: filters.length, quickFilterTops: filters.map(f => f.top), quickStripWidth: quickStrip.clientWidth, quickStripContentWidth: quickStrip.scrollWidth, quickStripOverflowX: getComputedStyle(quickStrip).overflowX, searchWidth: search.getBoundingClientRect().width, filterBarHeight: bar.getBoundingClientRect().height, stageCount: stages.length, stripWidth: strip.clientWidth, stripContentWidth: strip.scrollWidth, stripOverflowX: getComputedStyle(strip).overflowX };
                });
                results.push({ screen: 'samples', width, lang, ...samples });
                const label = `Samples ${lang} ${width}px`;
                if (samples.bodyWidth > samples.viewport + 1 || samples.mainContentWidth > samples.mainWidth + 1) failures.push(`${label}: page content overflows horizontally.`);
                if (Math.max(...samples.quickFilterTops) - Math.min(...samples.quickFilterTops) > 1) failures.push(`${label}: quick filters stack into multiple rows.`);
                if (samples.searchWidth < 160) failures.push(`${label}: search is narrower than 160px (${samples.searchWidth}).`);
                if (samples.quickStripWidth < 160) failures.push(`${label}: quick-filter scroll strip is narrower than 160px (${samples.quickStripWidth}).`);
                if (width >= 1024 && samples.filterBarHeight > 140) failures.push(`${label}: filter bar is taller than two rows (${samples.filterBarHeight}).`);
                if (width >= 1024 && Math.abs(samples.sidebarWidth - 256) > 1) failures.push(`${label}: expanded app sidebar is missing.`);
                if (samples.quickStripContentWidth > samples.quickStripWidth + 1 && !['auto', 'scroll'].includes(samples.quickStripOverflowX)) failures.push(`${label}: quick filters escape instead of scrolling.`);
                if (samples.stageCount !== 6 || samples.filterCount !== 7) failures.push(`Samples ${width}px: expected controls are missing.`);
                if (samples.stripContentWidth > samples.stripWidth + 1 && !['auto', 'scroll'].includes(samples.stripOverflowX)) failures.push(`Samples ${width}px: lifecycle stages escape their card instead of scrolling.`);
                await page.screenshot({ path: path.join(artifactDir, `samples-${width}-${lang}.png`), fullPage: true });
                for (const [id, value] of Object.entries({ expected: 'EXPECTED', intake: 'RECEIVED,COLLECTED', accepted: 'ACCEPTED', processing: 'PROCESSING,SUBMITTED_PARTIAL', completed: 'SUBMITTED_FULL,APPROVED', archived: 'ARCHIVED,DISPOSED', rejected: 'RECEIVED_REJECTED' })) {
                    await page.getByTestId('qf-' + id).click();
                    assert.deepEqual(await page.evaluate(() => window.__mobileLayoutClicks.at(-1)), { key: 'status', value });
                    assert.ok(await page.getByTestId('qf-' + id).evaluate(el => el.getBoundingClientRect().left >= 0 && el.getBoundingClientRect().right <= innerWidth));
                }
                const stages = page.locator('#samples-header .group');
                assert.equal(await stages.count(), 6);
                for (const stage of await stages.all()) await stage.click();
                assert.deepEqual(await page.evaluate(() => window.__mobileLayoutClicks.at(-1)), { key: 'status', value: 'ARCHIVED,DISPOSED' });
                const viewLabels = clientRequire('./src/translations/' + lang + '.json').samplesSection.views;
                for (const view of ['daily', 'expected', 'registry']) {
                    const button = page.getByRole('button', { name: viewLabels[view] });
                    await button.click();
                    assert.equal(await page.evaluate(() => window.__mobileLayoutViews.at(-1)), view);
                    assert.ok(await button.evaluate(el => {
                        const button = el.getBoundingClientRect(), strip = el.parentElement.getBoundingClientRect();
                        return button.left >= strip.left - 1 && button.right <= strip.right + 1;
                    }));
                }
            } finally { await context.close(); }
        }
    } finally {
        await browser?.close();
        if (listener.listening) await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
        fs.writeFileSync(path.join(artifactDir, 'layout-measurements.json'), JSON.stringify({ results, failures, appShellSourceSha256: createHash('sha256').update(appSource).digest('hex'), actualAppShellWithExpandedSidebar: true, actualSamplesPageWrapper: samplesPageClass[1], databaseConnections: 0, physicalDeviceClaim: false }, null, 2));
    }
    assert.deepEqual(failures, [], failures.join('\n'));
    return results;
}

module.exports = { checkMobileLayout };
