'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

// Resolve repository root dynamically
const root = process.env.REPO_ROOT || (
    fs.existsSync(path.join(__dirname, 'server/scripts'))
        ? __dirname
        : (fs.existsSync(path.join(__dirname, '../server/scripts'))
            ? path.resolve(__dirname, '..')
            : path.resolve(__dirname, '../..'))
);

const src = fs.readFileSync(path.join(root, 'server/scripts/verify_issue155_browser_journeys.cjs'), 'utf8');
const supplied = JSON.parse(fs.readFileSync(path.join(root, 'server/scripts/issue155-browser-journeys-results.json'), 'utf8'));

const cases = [];
const copy = x => JSON.parse(JSON.stringify(x));
function test(name, fn) {
    const details = fn();
    cases.push({ name, details });
    console.log(name + ' ' + JSON.stringify(details));
}
function collector(name, args = ['document', 'window']) {
    const m = src.match(new RegExp('const ' + name + ' = await page\\.evaluate\\(\\(\\) => \\{([\\s\\S]*?)\\n        \\}\\);'));
    assert(m, name);
    return new Function(...args, m[1]);
}

const op = supplied.suites.find(x => x.category === 'Operational Workflows').details;
const gm = src.match(/'Operational Workflows',\s*([\s\S]*?),\s*\{ worksheetState,/);
assert(gm);
const gate = (w = op.worksheetState, s = op.scanState, m = op.workflowState, u = true) =>
    new Function('worksheetState', 'scanState', 'workflowState', 'uploadSucceeded', 'return ' + gm[1])(w, s, m, u);

// 1. Worksheet exact observed sample and unit
test('PASS supplied worksheet now has exact observed sample and unit', () => {
    assert.equal(op.worksheetState.sampleId, 'SMP-2026-001');
    assert.equal(op.worksheetState.unit, 'pH units');
    assert.equal(gate(), true);
    return { sample: op.worksheetState.sampleId, workItem: op.worksheetState.workItemId, unit: op.worksheetState.unit, accepted: true };
});

// 2. Incorrect worksheet identity and workspace unit reject
test('PASS previous incorrect worksheet identity and workspace unit now reject', () => {
    for (const field of ['sampleId', 'unit']) {
        const w = copy(op.worksheetState);
        w[field] = field === 'sampleId' ? 'Sample' : 'SoilFER LIMS / Technician Workspace';
        assert.equal(gate(w), false);
    }
    return { wrongSampleRejected: true, wrongUnitRejected: true };
});

// 3. Wrong before-preview and restored appearance reject
test('PASS previous wrong before-preview and restored appearance now reject', () => {
    const w = copy(op.worksheetState);
    w.beforePreview.value = 'LOST';
    assert.equal(gate(w), false);
    const a = copy(op.worksheetState);
    a.afterExit.appliedMode = 'dark';
    assert.equal(gate(a), false);
    const s = copy(op.scanState);
    s.beforePreview.enteredValue = 'OTHER';
    assert.equal(gate(undefined, s), false);
    return { beforeDraftRejected: true, afterAppearanceRejected: true, beforeBarcodeRejected: true };
});

// 4. Empty graph dependencies or edges reject
test('PASS prior empty graph dependencies or edges now reject', () => {
    const m = copy(op.workflowState);
    m.observedEdges = [];
    assert.equal(gate(undefined, undefined, m), false);
    const a = copy(op.workflowState);
    a.dependencyNodes = [];
    assert.equal(gate(undefined, undefined, a), false);
    return { emptyEdgesRejected: true, emptyDependenciesRejected: true };
});

// 5. Observed wet-chem edge matches expected
test('PASS supplied graph observed edge now matches expected wet-chem->review', () => {
    assert.deepEqual(op.workflowState.observedEdges[2], { from: 'wet-chem', to: 'review' });
    assert.deepEqual(op.workflowState.observedEdges, op.workflowState.expectedEdges);
    assert.equal(gate(), true);
    return { expected: op.workflowState.expectedEdges[2], observed: op.workflowState.observedEdges[2], accepted: true };
});

// 6. Arbitrary four graph edges now reject
test('PASS arbitrary four graph edges now reject', () => {
    const m = copy(op.workflowState);
    m.observedEdges = Array.from({ length: 4 }, () => ({ from: 'unrelated-a', to: 'unrelated-b' }));
    assert.equal(gate(undefined, undefined, m), false);
    return { arbitraryEdgesRejected: true };
});

// 7. Different dependency identities now reject
test('PASS different dependency identities now reject (wi-010/wi-020 rejected)', () => {
    const m = copy(op.workflowState);
    m.dependencyNodes = ['wi-010', 'wi-020'];
    assert.equal(gate(undefined, undefined, m), false);
    return { substringDependenciesRejected: true };
});

const valid = [
    'Laboratory ID\tSOIL-GH-2026-001',
    'Report No.\tCERT-2026-SOIL-01',
    'pH\tISO 10390\t6.50\tpH units',
    'Organic Carbon\tWalkley-Black\t2.15\t%',
    'Total Nitrogen\tKjeldahl\t0.18\t%',
    'Available P (Bray-1)\tBray-1\t15.40\tmg/kg',
    'Exchangeable K\tAmmonium Acetate\t0.45\tcmol(+)/kg',
    'Status\tAPPROVED'
].join('\n');

const pm = src.match(/const printIsolationPassed =([\s\S]*?);/);
assert(pm);
const printGate = (p, ss, ls) => new Function('chartTokensPresent', 'printStylesActive', 'spectralSeriesState', 'labelPreviewState', 'return ' + pm[1])(true, p, ss, ls);
function paper(text) {
    const el = { innerText: text, className: 'report-document', querySelector: () => null, getAttribute: () => null };
    return collector('printStylesActive')({ querySelector: () => el, body: el }, { getComputedStyle: () => ({ backgroundColor: 'rgb(255, 255, 255)', color: 'rgb(30, 58, 95)' }) });
}

const validSpectral = {
    route: '/spectral-library',
    renderedSeriesVerified: true,
    seriesCount: 1,
    wavelengthRange: '4000 - 400 cm⁻¹',
    intensityRange: '0.05 - 1.25 AU',
    chartTokensEvaluated: ['--sf-chart-1']
};
const validLabel = {
    rendered: true,
    component: 'LabelPrintDialog.jsx',
    format: 'Standard 101x54mm',
    substrate: 'white',
    barcodeColor: '#000000',
    thermalPaperIsolation: true,
    offlineQrVerified: true
};

const emptyDoc = { querySelector: () => null, querySelectorAll: () => [], documentElement: {} };
const emptySpectral = collector('spectralSeriesState')(emptyDoc, { getComputedStyle: () => ({ getPropertyValue: () => '' }) });
const emptyLabel = collector('labelPreviewState')(emptyDoc, {});

// 8. Scientific positive and observed report identity
test('PASS complete scientific positive and observed report identity', () => {
    const a = paper(valid);
    assert.equal(printGate(a, validSpectral, validLabel), true);
    assert.equal(a.reportId, 'CERT-2026-SOIL-01');
    assert.equal(a.accessionId, 'SOIL-GH-2026-001');
    assert.equal(a.labelLayout.thermalPaperIsolation, false);
    assert.equal(a.labelLayout.applicable, false);
    return { report: a.reportId, accession: a.accessionId, status: a.measurements[0].status, labelIsolation: a.labelLayout.thermalPaperIsolation };
});

// 9. Prior OTHER METHOD, DRAFT and missing status reject
test('PASS prior OTHER METHOD, DRAFT and missing status now reject', () => {
    const texts = [valid.replace('ISO 10390', 'OTHER METHOD'), valid.replace('Status\tAPPROVED', 'Status\tDRAFT'), valid.replace('\nStatus\tAPPROVED', '')];
    for (const text of texts) assert.equal(printGate(paper(text), validSpectral, validLabel), false);
    assert.equal(paper(texts[2]).measurements[0].status, null);
    return { literalWrongMethodRejected: true, draftRejected: true, missingStatusRejected: true };
});

// 10. Different real method (Kjeldahl) for pH row now rejects
test('PASS different real method (Kjeldahl) for pH row now rejects', () => {
    const a = paper(valid.replace('ISO 10390', 'Kjeldahl'));
    assert.equal(a.measurements[0].method, 'Kjeldahl');
    assert.equal(printGate(a, validSpectral, validLabel), false);
    return { parameter: a.measurements[0].parameter, expectedMethod: 'ISO 10390', observedMethod: a.measurements[0].method, wrongMethodRejected: true };
});

// 11. Wrong observed report number now rejects
test('PASS wrong observed report number (CERT-OTHER-02) now rejects', () => {
    const a = paper(valid.replace('CERT-2026-SOIL-01', 'CERT-OTHER-02'));
    assert.equal(a.reportId, 'CERT-OTHER-02');
    assert.equal(printGate(a, validSpectral, validLabel), false);
    return { expectedReport: 'CERT-2026-SOIL-01', observedReport: a.reportId, wrongReportRejected: true };
});

// 12. Test-only flex wrapping repair removed from resize action
test('PASS test-only flex wrapping repair removed from resize action', () => {
    const a = src.match(/await zoom400Page\.evaluate\(\(\) => \{\s*document\.documentElement\.style\.fontSize = '400%';([\s\S]*?)\n        \}\);/);
    assert(a);
    assert(!a[1].includes('flexWrap'));
    const el = { style: {} }, doc = { documentElement: { style: {} }, querySelectorAll: () => [el] };
    new Function('document', 'window', "document.documentElement.style.fontSize = '400%';" + a[1])(doc, { getComputedStyle: () => ({ display: 'flex', flexWrap: 'nowrap' }) });
    assert.equal(el.style.flexWrap, undefined);
    return { rootTextSize: doc.documentElement.style.fontSize, flexLayoutMutated: false };
});

// 13. Source distinguishes scoped root text case; manual tooling pending recorded honestly
test('PASS source distinguishes scoped root text case; manual tooling pending recorded honestly', () => {
    const matrix = fs.readFileSync(path.join(root, 'WP/sitewide-theme-library-v1/TRACEABLE-MATRIX.md'), 'utf8');
    assert(src.includes('cardBases.find'));
    assert(matrix.includes('400% root text enlargement at 1280'));
    assert(matrix.includes('Manual Screen-Reader'));
    assert(matrix.includes('pending dedicated assistive evaluation'));
    return { rootTextScopeDocumented: true, manualScreenReaderPending: true };
});

// 14. Worksheet method and status asserted, and scientific method compared to expected
test('PASS worksheet method and status asserted, and scientific method compared to expected', () => {
    assert(gm[1].includes('worksheetState.method'));
    assert(gm[1].includes('worksheetState.status'));
    assert(pm[1].includes('m.method ==='));
    return { worksheetMethodStatusAsserted: true, scientificMethodComparedToExpected: true };
});

// 15. All 14 variant transitions present in verifier and required by operational gate
test('PASS all 14 variant transitions and preservation required by operational gate', () => {
    assert(src.includes('variantTransitions'));
    assert(src.includes('all14VariantsPreserved'));
    assert(op.worksheetState.variantTransitions && op.worksheetState.variantTransitions.length === 14);
    assert(op.scanState.variantTransitions && op.scanState.variantTransitions.length === 14);
    assert.equal(op.worksheetState.all14VariantsPreserved, true);
    assert.equal(op.scanState.all14VariantsPreserved, true);

    const wMissing = copy(op.worksheetState);
    delete wMissing.variantTransitions;
    delete wMissing.all14VariantsPreserved;
    assert.equal(gate(wMissing), false);

    const sMissing = copy(op.scanState);
    delete sMissing.variantTransitions;
    delete sMissing.all14VariantsPreserved;
    assert.equal(gate(undefined, sMissing), false);

    return { worksheetTransitions: 14, scanTransitions: 14, operationalGateStrict: true };
});

// 16. Workflow loop IDs agree with canonical catalogue
const vm = src.match(/const authorizedVariants = (\[[\s\S]*?\]);/);
assert(vm);
const variants = new Function('return ' + vm[1])();
test('PASS workflow loop IDs agree with canonical catalogue', () => {
    const allowed = JSON.parse(fs.readFileSync(path.join(root, 'server/config/themeCatalogData.json'), 'utf8')).themeAllowlist;
    const used = [...new Set(variants.map(v => v.themeId))];
    const unsupported = used.filter(x => !allowed.includes(x));
    const missing = allowed.filter(x => !used.includes(x));
    assert.deepEqual(unsupported, []);
    assert.deepEqual(missing, []);
    assert.equal(variants.length, 14);
    return { unsupported, missing, count: variants.length };
});

// 17. Missing preview provider and mismatched actual theme now reject
const tm = src.match(/const vt = await page\.evaluate\(\(\{ theme, mode \}\) => \{([\s\S]*?)\n            \}, \{ theme: variant\.themeId, mode: variant\.mode \}\);/);
assert(tm);
const transition = new Function('document', 'theme', 'mode', tm[1]);
test('PASS missing preview provider and mismatched actual theme now reject', () => {
    const input = { value: '42.50', selectionStart: 2, selectionEnd: 5 };
    const doc = { getElementById: () => null, querySelector: s => s.includes('workbench-container') ? input : null, documentElement: { getAttribute: k => k === 'data-theme' ? 'forest' : 'light' } };
    const a = variants.map(v => transition(doc, v.themeId, v.mode));
    assert(a.every(v => v.draftPreserved && v.caretPreserved));
    assert(a.some(v => v.requestedTheme !== v.appliedTheme || v.requestedMode !== v.appliedMode));
    assert(a.every(v => v.noticeVisible === false));
    assert(a.every(v => v.providerFound === false));
    assert(a.every(v => v.transitionSucceeded === false));
    const w = copy(op.worksheetState);
    w.variantTransitions = a;
    w.all14VariantsPreserved = a.length === 14 && a.every(v => v.transitionSucceeded === true);
    assert.equal(gate(w), false);
    return { providerMissing: true, noticeAbsent: true, rejected: true };
});

// 18. Absent actual spectrum reports falsy / empty
test('PASS absent actual spectrum reports unverified and zero series', () => {
    assert.equal(emptySpectral.renderedSeriesVerified, false);
    assert.equal(emptySpectral.seriesCount, 0);
    assert.equal(emptySpectral.chartTokensEvaluated.length, 0);
    assert.equal(emptySpectral.wavelengthRange, null);
    assert.equal(emptySpectral.intensityRange, null);
    return { noSvgOrSeries: true, reported: emptySpectral };
});

// 19. Absent actual label reports unrendered and unverified
test('PASS absent actual label reports unrendered and unverified', () => {
    assert.equal(emptyLabel.rendered, false);
    assert.equal(emptyLabel.thermalPaperIsolation, false);
    assert.equal(emptyLabel.offlineQrVerified, false);
    assert.equal(emptyLabel.format, null);
    assert.equal(emptyLabel.substrate, null);
    assert.equal(emptyLabel.barcodeColor, null);
    return { labelNotRendered: true, reported: emptyLabel };
});

// 20. Scientific final gate rejects when actual spectrum or label is absent
test('PASS scientific final gate rejects when actual spectrum or label is absent', () => {
    const p = paper(valid);
    assert.equal(printGate(p, emptySpectral, emptyLabel), false);
    return { validCertificate: true, actualSpectrumAbsent: true, actualLabelAbsent: true, rejected: true };
});

// 21. Spectral series and label preview state collectors present and required by print gate
test('PASS spectral series and label preview state collectors present and required by print gate', () => {
    assert(src.includes('const spectralSeriesState = await page.evaluate'));
    assert(src.includes('const labelPreviewState = await page.evaluate'));
    
    const p = paper(valid);
    assert.equal(printGate(p, null, validLabel), false);
    assert.equal(printGate(p, validSpectral, null), false);

    return { spectralCollectorPresent: true, labelCollectorPresent: true, printGateStrict: true };
});

// 22. Fixture fallbacks completely eradicated from verifier source
test('PASS fixture fallbacks completely eradicated from verifier source', () => {
    assert(!src.includes("input.getAttribute('step') || '0.01'"));
    assert(!src.includes("(typeof observedVal === 'number' ? 2 : null)"));
    assert(!src.includes("Math.max(seriesLines ? seriesLines.length : 0, 2)"));
    assert(!src.includes("seriesCount: 2"));
    return { defaultWorksheetStepRemoved: true, defaultScientificDecimalsRemoved: true, constantTwoRemoved: true };
});

// 23. Fourteen repetitions of a single variant strictly rejected by operational gate
test('PASS fourteen repetitions of a single variant strictly rejected by operational gate', () => {
    const w = copy(op.worksheetState);
    const s = copy(op.scanState);
    w.variantTransitions = Array.from({ length: 14 }, () => copy(w.variantTransitions[0]));
    s.variantTransitions = Array.from({ length: 14 }, () => copy(s.variantTransitions[0]));
    assert.equal(gate(w, s), false);
    return { uniqueWorksheetVariants: new Set(w.variantTransitions.map(x => x.variant)).size, duplicatesRejected: true };
});

// 24. Unrelated brand icon path is rejected by spectralSeriesState
test('PASS unrelated brand icon path is rejected by spectralSeriesState', () => {
    const unrelatedSvg = { tagName: 'svg', className: 'brand-icon' };
    const iconPath = { tagName: 'path', getAttribute: k => k === 'd' ? 'M0 0h8v8z' : null };
    const genericSpectrum = collector('spectralSeriesState')({ querySelector: () => unrelatedSvg, querySelectorAll: () => [iconPath], documentElement: {} }, { getComputedStyle: () => ({ getPropertyValue: () => '#222222' }) });
    assert.equal(genericSpectrum.renderedSeriesVerified, false);
    assert.equal(genericSpectrum.seriesCount, 0);
    assert.equal(genericSpectrum.wavelengthRange, null);
    return { brandIconRejected: true, reported: genericSpectrum };
});

// 25. Certificate report document is rejected by labelPreviewState
test('PASS certificate report document is rejected by labelPreviewState', () => {
    const reportElement = { className: 'report-document', getAttribute: () => null, querySelector: () => null };
    const certificateAsLabel = collector('labelPreviewState')({ querySelector: () => reportElement }, { getComputedStyle: () => ({ backgroundColor: 'rgb(0, 0, 0)', color: 'rgb(255, 255, 255)' }) });
    assert.equal(certificateAsLabel.rendered, false);
    assert.equal(certificateAsLabel.offlineQrVerified, false);
    assert.equal(certificateAsLabel.thermalPaperIsolation, false);
    assert.equal(certificateAsLabel.substrate, null);
    return { certificateDocumentRejectedAsLabel: true, reported: certificateAsLabel };
});

// 26. Print gate rejects unrelated icon and certificate document as label
test('PASS print gate rejects unrelated icon and certificate document as label', () => {
    const unrelatedSvg = { tagName: 'svg', className: 'brand-icon' };
    const iconPath = { tagName: 'path', getAttribute: k => k === 'd' ? 'M0 0h8v8z' : null };
    const genericSpectrum = collector('spectralSeriesState')({ querySelector: () => unrelatedSvg, querySelectorAll: () => [iconPath], documentElement: {} }, { getComputedStyle: () => ({ getPropertyValue: () => '#222222' }) });
    const reportElement = { className: 'report-document', getAttribute: () => null, querySelector: () => null };
    const certificateAsLabel = collector('labelPreviewState')({ querySelector: () => reportElement }, { getComputedStyle: () => ({ backgroundColor: 'rgb(0, 0, 0)', color: 'rgb(255, 255, 255)' }) });
    const p = paper(valid);
    assert.equal(printGate(p, genericSpectrum, certificateAsLabel), false);
    return { genericSpectrumAndCertLabelRejected: true };
});

// 27. Scientific output suite navigates to spectral and label views with real click actions
test('PASS scientific output suite navigates to spectral and label views with real click actions', () => {
    const start = src.indexOf('await page.goto(`${origin}/report/CERT-2026-SOIL-01`');
    const end = src.indexOf('const printIsolationPassed =', start);
    assert(start >= 0 && end > start);
    const span = src.slice(start, end);
    const gotos = (span.match(/await page\.goto\(/g) || []).length;
    assert(gotos >= 2);
    assert(/\.click\(/.test(span));
    assert(span.includes('/spectral-library'));
    assert(span.includes('/samples'));
    return { gotosInSuite10: gotos, hasClickAction: true, navigatesSpectralAndSamples: true };
});

// 28. Action waits outside activation callback for observable theme/mode and named notice settlement
test('PASS action waits outside activation callback for observable theme/mode and named notice settlement', () => {
    assert(src.includes('await page.waitForFunction((theme, mode) => {'));
    assert(src.includes("appliedTheme === theme && appliedMode === mode && Boolean(notice)"));
    return { waitsOutsideActivationCallback: true, settlesBeforeCollection: true };
});

console.log(JSON.stringify({ allCasesPassed: true, casesCompleted: cases.length }));
