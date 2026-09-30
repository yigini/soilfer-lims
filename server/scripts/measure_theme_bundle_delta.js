const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { execSync } = require('child_process');
const os = require('os');

const root = 'C:/Users/yigin/Documents/soilfer-lims';

function getDistMetrics(distDir) {
    const assetsDir = path.join(distDir, 'assets');
    if (!fs.existsSync(assetsDir)) return {};
    const files = fs.readdirSync(assetsDir);
    const metrics = {};
    for (const file of files) {
        const full = path.join(assetsDir, file);
        const stat = fs.statSync(full);
        if (stat.isFile()) {
            const content = fs.readFileSync(full);
            const gzip = zlib.gzipSync(content).length;
            metrics[file] = { raw: stat.size, gzip };
        }
    }
    return metrics;
}

// 1. Current candidate dist metrics
const currentMetrics = getDistMetrics(path.join(root, 'client/dist'));

// Find candidate main CSS, ThemeGallery chunk, and candidate main JS
let candCss = null, candGalleryJs = null, candMainJs = null;
for (const [k, v] of Object.entries(currentMetrics)) {
    if (k.startsWith('index-') && k.endsWith('.css')) candCss = { file: k, ...v };
    if (k.startsWith('ThemeGallery-') && k.endsWith('.js')) candGalleryJs = { file: k, ...v };
    if (k.startsWith('index-') && k.endsWith('.js')) candMainJs = { file: k, ...v };
}

// 2. Measure baseline at 1265e8a
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-1265e8a-'));
console.log('Extracting baseline 1265e8a repository to', tempDir);
execSync(`git archive 1265e8a client server/data | tar -x -C "${tempDir}"`, { cwd: root });

const baselineClient = path.join(tempDir, 'client');
// Link node_modules from current client to save install time
const currentModules = path.join(root, 'client/node_modules');
const targetModules = path.join(baselineClient, 'node_modules');

// Use junction on Windows
execSync(`cmd /c mklink /J "${targetModules}" "${currentModules}"`);

console.log('Building baseline client...');
execSync(`npm.cmd run build`, { cwd: baselineClient });

const baselineMetrics = getDistMetrics(path.join(baselineClient, 'dist'));
let baseCss = null, baseMainJs = null;
for (const [k, v] of Object.entries(baselineMetrics)) {
    if (k.startsWith('index-') && k.endsWith('.css')) baseCss = { file: k, ...v };
    if (k.startsWith('index-') && k.endsWith('.js')) baseMainJs = { file: k, ...v };
}

// Clean up temp
try {
    execSync(`cmd /c rmdir "${targetModules}"`);
    fs.rmSync(tempDir, { recursive: true, force: true });
} catch (e) {
    console.warn('Cleanup warning:', e.message);
}

console.log('\n======================================================');
console.log('REPRODUCIBLE PRODUCTION ASSET DELTA MEASUREMENT');
console.log('Baseline Commit: 1265e8a (PR #154 merge / main)');
console.log('======================================================');
console.log(`Baseline CSS:       ${baseCss?.file} (${baseCss?.raw} bytes raw, ${baseCss?.gzip} bytes gzip)`);
console.log(`Candidate CSS:      ${candCss?.file} (${candCss?.raw} bytes raw, ${candCss?.gzip} bytes gzip)`);
const cssDeltaRaw = candCss.raw - baseCss.raw;
const cssDeltaGzip = candCss.gzip - baseCss.gzip;
console.log(`CSS Delta:          +${cssDeltaRaw} bytes raw, +${cssDeltaGzip} bytes gzip (${(cssDeltaGzip / 1024).toFixed(2)} kB gzip)`);

console.log(`\nCandidate ThemeGallery Chunk: ${candGalleryJs?.file} (${candGalleryJs?.raw} bytes raw, ${candGalleryJs?.gzip} bytes gzip = ${(candGalleryJs?.gzip / 1024).toFixed(2)} kB gzip)`);

console.log(`\nBaseline Main JS:   ${baseMainJs?.file} (${baseMainJs?.raw} bytes raw, ${baseMainJs?.gzip} bytes gzip)`);
console.log(`Candidate Main JS:  ${candMainJs?.file} (${candMainJs?.raw} bytes raw, ${candMainJs?.gzip} bytes gzip)`);
const mainJsDeltaRaw = candMainJs.raw - baseMainJs.raw;
const mainJsDeltaGzip = candMainJs.gzip - baseMainJs.gzip;
console.log(`Main JS Delta:      +${mainJsDeltaRaw} bytes raw, +${mainJsDeltaGzip} bytes gzip (${(mainJsDeltaGzip / 1024).toFixed(2)} kB gzip)`);

const totalThemeDeltaGzip = cssDeltaGzip + (candGalleryJs?.gzip || 0) + mainJsDeltaGzip;
console.log('\n======================================================');
console.log(`TOTAL ADDITIONAL THEME LIBRARY PRODUCTION GZIP DELTA:`);
console.log(`+${totalThemeDeltaGzip} bytes gzip = ${(totalThemeDeltaGzip / 1024).toFixed(2)} kB gzip`);
console.log(`Budget: <= 15.0 kB gzip`);
console.log(`Margin: ${(15.0 - (totalThemeDeltaGzip / 1024)).toFixed(2)} kB under budget`);
console.log('======================================================\n');

fs.writeFileSync(path.join(root, 'server/scripts/theme_bundle_budget_measurement.json'), JSON.stringify({
    baselineCommit: '1265e8a',
    measuredAt: new Date().toISOString(),
    baseline: {
        css: baseCss,
        mainJs: baseMainJs
    },
    candidate: {
        css: candCss,
        galleryJs: candGalleryJs,
        mainJs: candMainJs
    },
    delta: {
        cssRaw: cssDeltaRaw,
        cssGzip: cssDeltaGzip,
        galleryGzip: candGalleryJs?.gzip || 0,
        mainJsGzip: mainJsDeltaGzip,
        totalGzip: totalThemeDeltaGzip,
        totalGzipKb: (totalThemeDeltaGzip / 1024).toFixed(2),
        budgetKb: 15.0,
        underBudgetKb: (15.0 - (totalThemeDeltaGzip / 1024)).toFixed(2)
    }
}, null, 2));
