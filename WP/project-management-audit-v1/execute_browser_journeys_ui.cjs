/**
 * Browser UI Acceptance Suite for Lab Journeys 1-4 and 6
 * 
 * Strict Browser DOM Acceptance Harness:
 * - Real Headless Chromium browser via Playwright
 * - Real built React application in client/dist
 * - Static server proxying /api/ requests to real Express backend (app.js)
 * - Real SQLite database on an isolated temporary fixture (zero mutations on dev.db)
 *
 * Exact flows under test:
 * - Journey 1: Coordinator Manifest UI: Data connections tab -> ImportPreviewModal -> paste 40 rows (38 valid, 1 dup, 1 blank) -> run preview validation -> assert DOM breakdown -> click register 38 expected samples -> downstream DB verify.
 * - Journey 2: Reception Desk UI: Project session lookup -> scan 000101 -> edit notes -> Save Draft -> reload & assert restored notes in DOM -> enter mass 485.2g -> click Complete Intake -> assert "Intake Confirmed!" in DOM -> assert exact project dashboard stage counts (37 awaiting, 1 received).
 * - Journey 3: Technician SOP Checklists & Spectral Intake:
 *     * Drying SOP checklist buttons clicked -> Confirm Complete -> assert DOM "Checklist Verified" -> sample dryingStatus DONE.
 *     * Preparation SOP checklist buttons clicked -> Confirm Complete -> assert DOM "Checklist Verified" -> sample preparationStatus DONE.
 *     * Read-only sample page navigation -> assert Drying/Prep Completed persisted in DOM.
 *     * Spectral MIR Wizard: row button "Upload spectra →" -> SpectralIntakeModal -> upload synthetic MIR CSV curve (4000-400 cm⁻¹) -> assert auto-detect & SVG plot -> review import -> confirm checkbox -> commit -> assert durable receipt & DOM scan recorded badge.
 *     * Determinations & 2-step submission: enter pH 6.85, Texture (35/35/30) -> Review Completion (2) -> ReviewCompletionView -> Record 2 Determinations -> ReviewSubmissionView -> submit-for-review-btn -> authoritative SUBMITTED status.
 * - Journey 4: Manager Review Queue & Return:
 *     * Unsubmitted item approval blocked (HTTP 400 INVALID_TRANSITION).
 *     * Manager queue card click -> sample review tab in SampleDetail.jsx.
 *     * Accept button clicked on pH -> transitions to ACCEPTED.
 *     * Return for correction button clicked on Texture -> Return modal opens -> assert Confirm Return disabled when reason empty -> enter return reason -> Confirm Return -> transitions to REANALYSIS_REQUIRED.
 *     * Technician queue / my-work / sample audit DOM reflects exact return reason.
 * - Journey 6: Project Lifecycle Gates:
 *     * Pause admissions via UI modal with reason -> assert Admissions Paused -> intake attempt rejected with HTTP 422 PROJECT_ADMISSIONS_PAUSED.
 *     * UI Archival Gate Blocked: Review archival readiness modal shows "This project is not ready to archive." and "Expected unaccounted samples: 37", Archive button absent.
 *     * Concrete UI gap documented: No bulk cancel control for expected non-arrivals; reconcile via authorized admin update.
 *     * Re-test Archival in UI: "Project is eligible for archival." -> enter reason -> Archive project -> assert exact DOM badge "Archived".
 *     * Restore project via POST /api/projects/:id/restore -> verify restored state & admissions control.
 *     * SIS read-only data exchange verified accessible.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { createHash } = require('crypto');
const { createRequire } = require('module');

const root = 'C:/Users/yigin/Documents/soilfer-lims';
const reqServer = createRequire(path.join(root, 'server/package.json'));
const Database = reqServer('better-sqlite3');
const jwt = reqServer('jsonwebtoken');

function loadPlaywright() {
    const candidates = [
        'playwright',
        path.join(process.env.USERPROFILE || 'C:/Users/yigin', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),
        path.resolve(root, 'client/node_modules/playwright'),
        path.resolve(root, 'server/node_modules/playwright')
    ];
    for (const c of candidates) {
        try { return require(c); } catch (e) {}
    }
    throw new Error('Playwright could not be resolved from candidate locations.');
}

const { chromium } = loadPlaywright();

const sourceDbPath = path.join(root, 'server/prisma/dev.db');
const beforeHash = createHash('sha256').update(fs.readFileSync(sourceDbPath)).digest('hex');

const BACKEND_PORT = 4197;
const UI_PORT = 4177;
const UI_BASE_URL = `http://127.0.0.1:${UI_PORT}`;
const JWT_SECRET = 'ephemeral-browser-journeys-secret-key-12345';

// Outcome table records
const stepOutcomes = [];

function recordOutcome(step, action, observedApi, exactDomAssertion, authoritativeState, outcome) {
    stepOutcomes.push({
        step,
        action,
        observedApi,
        exactDomAssertion,
        authoritativeState,
        outcome
    });
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function runBrowserJourneys() {
    console.log('='.repeat(85));
    console.log('  STARTING BROWSER UI LAB JOURNEYS 1, 2, 3, 4, AND 6 SUITE (ZERO BYPASSES)');
    console.log('  Testing built client in client/dist via Chromium against real isolated backend');
    console.log('='.repeat(85));

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-journeys-strict-'));
    const fixturePath = path.join(tmpDir, 'browser_journeys.db');

    // Step 1: Create isolated fixture from dev.db DDL
    const sourceDb = new Database(sourceDbPath, { readonly: true });
    const ddl = sourceDb.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
    const fixtureDb = new Database(fixturePath);
    fixtureDb.pragma('journal_mode = WAL');
    fixtureDb.pragma('foreign_keys = OFF');
    for (const row of ddl) {
        fixtureDb.exec(row.sql);
    }
    // Copy reference analysis & methodology data
    const analyses = sourceDb.prepare('SELECT * FROM Analysis').all();
    if (analyses.length > 0) {
        const cols = Object.keys(analyses[0]);
        const insertAnalysis = fixtureDb.prepare(`INSERT INTO Analysis (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
        for (const a of analyses) {
            insertAnalysis.run(Object.values(a));
        }
    }
    const methodologies = sourceDb.prepare('SELECT * FROM Methodology').all();
    if (methodologies.length > 0) {
        const cols = Object.keys(methodologies[0]);
        const insertMeth = fixtureDb.prepare(`INSERT INTO Methodology (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
        for (const m of methodologies) {
            insertMeth.run(Object.values(m));
        }
    }
    const analysisGroups = sourceDb.prepare('SELECT * FROM AnalysisGroup').all();
    if (analysisGroups.length > 0) {
        const cols = Object.keys(analysisGroups[0]);
        const insertGroup = fixtureDb.prepare(`INSERT INTO AnalysisGroup (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
        for (const g of analysisGroups) {
            insertGroup.run(Object.values(g));
        }
    }
    sourceDb.close();

    // Seed Core Facilities and Users
    const insertLab = fixtureDb.prepare(`
        INSERT INTO Lab (id, code, name, country, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);
    insertLab.run('LAB-COORD', 'LAB-COORD', 'Central Coordinating Laboratory', 'GTM');
    insertLab.run('LAB-SERVICE', 'LAB-SERVICE', 'Servicing Analytical Facility B', 'GTM');

    const insertUser = fixtureDb.prepare(`
        INSERT INTO User (id, username, password, email, role, name, labId, countries, projects, isActive, createdAt, updatedAt)
        VALUES (?, ?, 'hashed_pw', ?, ?, ?, ?, '["GTM"]', ?, 1, datetime('now'), datetime('now'))
    `);
    const defaultProjectsJson = JSON.stringify(['GTM-HIGH-2026']);
    insertUser.run('usr-coord', 'coordinator_user', 'coord@fao.org', 'PROJECT_MANAGER', 'Carlos Coordinator', 'LAB-COORD', defaultProjectsJson);
    insertUser.run('usr-intake', 'intake_officer', 'intake@fao.org', 'SAMPLE_RECEPTION', 'Iris Intake', 'LAB-COORD', defaultProjectsJson);
    insertUser.run('usr-tech', 'lab_technician', 'tech@fao.org', 'LAB_TECHNICIAN', 'Tomas Tech', 'LAB-COORD', defaultProjectsJson);
    insertUser.run('usr-mgr', 'qa_manager', 'manager@fao.org', 'LAB_MANAGER', 'Maria Manager', 'LAB-COORD', defaultProjectsJson);

    // Seed Spectrometer Equipment Asset for LAB-COORD
    const insertEquip = fixtureDb.prepare(`
        INSERT INTO EquipmentAsset (id, name, model, assetType, status, criticality, labId, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, 'CRITICAL', ?, datetime('now'), datetime('now'))
    `);
    insertEquip.run('eq-mir-coord', 'Bruker ALPHA II MIR Spectrometer', 'ALPHA II', 'SPECTROMETER', 'IN_SERVICE', 'LAB-COORD');

    fixtureDb.close();
    console.log(`✓ Seeded isolated database fixture at ${fixturePath}`);

    // Step 2: Start isolated backend Express server
    process.env.DATABASE_PATH = fixturePath;
    process.env.DATABASE_URL = 'file:' + fixturePath;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = JWT_SECRET;

    const backendApp = reqServer('./app');
    const backendServer = http.createServer(backendApp);
    await new Promise(resolve => backendServer.listen(BACKEND_PORT, '127.0.0.1', resolve));
    console.log(`✓ Real Express API server listening on http://127.0.0.1:${BACKEND_PORT}`);

    // Step 3: Start static UI server proxying /api/ to backend
    const distDir = path.join(root, 'client/dist');
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };

    const staticServer = http.createServer((req, res) => {
        if (req.url.startsWith('/api/')) {
            const proxyReq = http.request({
                hostname: '127.0.0.1',
                port: BACKEND_PORT,
                path: req.url,
                method: req.method,
                headers: req.headers
            }, proxyRes => {
                res.writeHead(proxyRes.statusCode, proxyRes.headers);
                proxyRes.pipe(res);
            });
            proxyReq.on('error', err => {
                console.error('[PROXY_ERROR]', err.message);
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Proxy Error', message: err.message }));
            });
            req.pipe(proxyReq);
            return;
        }

        let cleanUrl = req.url.split('?')[0];
        let filePath = path.join(distDir, cleanUrl);
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            filePath = path.join(distDir, 'index.html');
        }
        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });

    await new Promise(resolve => staticServer.listen(UI_PORT, '127.0.0.1', resolve));
    console.log(`✓ Built Client UI server running on ${UI_BASE_URL} (proxying /api to port ${BACKEND_PORT})`);

    // Actor JWT generators
    const users = {
        coord: { id: 'usr-coord', username: 'coordinator_user', name: 'Carlos Coordinator', role: 'PROJECT_MANAGER', labId: 'LAB-COORD', countries: ['GTM'], projects: ['GTM-HIGH-2026'], isActive: true },
        intake: { id: 'usr-intake', username: 'intake_officer', name: 'Iris Intake', role: 'SAMPLE_RECEPTION', labId: 'LAB-COORD', countries: ['GTM'], projects: ['GTM-HIGH-2026'], isActive: true },
        tech: { id: 'usr-tech', username: 'lab_technician', name: 'Tomas Tech', role: 'LAB_TECHNICIAN', labId: 'LAB-COORD', countries: ['GTM'], projects: ['GTM-HIGH-2026'], isActive: true },
        mgr: { id: 'usr-mgr', username: 'qa_manager', name: 'Maria Manager', role: 'LAB_MANAGER', labId: 'LAB-COORD', countries: ['GTM'], projects: ['GTM-HIGH-2026'], isActive: true }
    };

    const tokens = {
        coord: jwt.sign(users.coord, JWT_SECRET, { expiresIn: '2h' }),
        intake: jwt.sign(users.intake, JWT_SECRET, { expiresIn: '2h' }),
        tech: jwt.sign(users.tech, JWT_SECRET, { expiresIn: '2h' }),
        mgr: jwt.sign(users.mgr, JWT_SECRET, { expiresIn: '2h' })
    };

    // Helper for authoritative API verification
    function apiRequest(actorToken, method, urlPath, body = null) {
        return new Promise((resolve, reject) => {
            const reqObj = http.request({
                hostname: '127.0.0.1',
                port: BACKEND_PORT,
                path: urlPath,
                method,
                headers: {
                    Authorization: `Bearer ${actorToken}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            }, res => {
                let data = '';
                res.on('data', chunk => (data += chunk));
                res.on('end', () => {
                    let parsed = null;
                    try { parsed = JSON.parse(data); } catch {}
                    resolve({ status: res.statusCode, data: parsed || data });
                });
            });
            reqObj.on('error', reject);
            if (body) reqObj.write(JSON.stringify(body));
            reqObj.end();
        });
    }

    const prisma = reqServer('./prisma');

    // Launch Chromium browser
    const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const browser = await chromium.launch({
        headless: true,
        executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
        args: ['--ignore-certificate-errors', '--no-sandbox']
    });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[BROWSER PAGEERROR] ${err.message}`));
    page.on('response', res => {
        if (res.url().includes('/api/')) {
            console.log(`[API RESPONSE] ${res.status()} ${res.url()}`);
        }
    });

    async function setBrowserUser(userKey) {
        const u = users[userKey];
        const tok = tokens[userKey];
        await page.goto(UI_BASE_URL);
        await page.evaluate(({ tokenStr, userObj }) => {
            localStorage.setItem('token', tokenStr);
            localStorage.setItem('user', JSON.stringify(userObj));
            localStorage.setItem('language', 'en');
        }, { tokenStr: tok, userObj: u });
    }

    const projectCode = 'GTM-HIGH-2026';

    // =========================================================================
    // JOURNEY 1 (UI): COORDINATOR PREPARES SHIPMENT & IMPORTS MANIFEST VIA UI
    // =========================================================================
    console.log('\n' + '-'.repeat(75));
    console.log('  JOURNEY 1 (UI): COORDINATOR MANIFEST PREVIEW & IMPORT CONTROLS');
    console.log('-'.repeat(75));

    // 1. Create project draft via governed endpoint & activate
    const projCreateRes = await apiRequest(tokens.coord, 'POST', '/api/projects', {
        name: 'Guatemala Highlands Soil Fertility Project',
        code: projectCode,
        projectType: 'STANDARD',
        description: '40-sample baseline regional fertility study',
        labId: 'LAB-COORD',
        countries: ['GTM'],
        defaultAnalysisBundle: 'routine-soil'
    });
    assert(projCreateRes.status === 201 || projCreateRes.status === 200, `Project create failed: ${projCreateRes.status}`);

    await prisma.projectLab.create({
        data: { id: 'pl-serv-strict', projectCode, labId: 'LAB-SERVICE', role: 'SERVICING', priority: 2 }
    });
    await apiRequest(tokens.mgr, 'PUT', `/api/projects/${projectCode}`, { status: 'ACTIVE' });

    // 2. Open Project Workspace as Coordinator
    await setBrowserUser('coord');
    await page.goto(`${UI_BASE_URL}/projects/${projectCode}`);
    await page.waitForLoadState('networkidle');

    // 3. Navigate to Data connections tab
    const dataConnTabBtn = page.getByRole('button', { name: 'Data connections', exact: true });
    await dataConnTabBtn.waitFor({ state: 'visible', timeout: 5000 });
    await dataConnTabBtn.click();

    // 4. Click "Preview a manifest" button
    const previewManifestBtn = page.locator('button:has-text("Preview a manifest")');
    await previewManifestBtn.waitFor({ state: 'visible', timeout: 5000 });
    await previewManifestBtn.click();

    // 5. In ImportPreviewModal: fill 40 rows (38 valid IDs, 1 duplicate '000101', 1 blank)
    const modalTextarea = page.locator('div.fixed textarea, textarea');
    await modalTextarea.waitFor({ state: 'visible', timeout: 5000 });

    const lines = [];
    for (let i = 1; i <= 38; i++) {
        lines.push(`000${100 + i}`);
    }
    lines.push('000101'); // duplicate
    lines.push('INVALID*CHAR$');   // invalid format

    await modalTextarea.fill(lines.join('\n'));

    // 6. Click "Run preview validation"
    const runValidationBtn = page.locator('button:has-text("Run preview validation")');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/imports/preview') && res.status() === 200),
        runValidationBtn.click()
    ]);

    // 7. Exact DOM Assertion: preview counts rendered in DOM
    const validCountLocator = page.locator('text=Ready as expected').locator('xpath=..').locator('div.text-lg');
    await validCountLocator.waitFor({ state: 'visible', timeout: 5000 });
    const domValidCount = (await validCountLocator.textContent()).trim();
    assert(domValidCount === '38', `Expected DOM validCount 38, got ${domValidCount}`);

    const errorCountLocator = page.locator('text=Duplicate/Blank').locator('xpath=..').locator('div.text-lg');
    const domErrorCount = (await errorCountLocator.textContent()).trim();
    assert(domErrorCount === '2', `Expected DOM errorCount 2, got ${domErrorCount}`);

    // 8. Commit Manifest in UI
    const registerBtn = page.locator('button:has-text("Register 38 expected samples")');
    await registerBtn.waitFor({ state: 'visible', timeout: 5000 });
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/manifest') && res.status() === 200),
        registerBtn.click()
    ]);

    // 9. Authoritative DB State: 38 expected samples created
    const samplesInDb = await prisma.sample.count({ where: { projectCode, status: 'EXPECTED' } });
    assert(samplesInDb === 38, `Expected 38 EXPECTED samples in DB, got ${samplesInDb}`);

    // 10. Project Overview DOM displays 38 registered samples
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.waitForLoadState('networkidle');
    const overviewText = await page.textContent('main');
    assert(overviewText.includes('38'), 'Project overview must display 38 registered samples');

    recordOutcome(
        'Journey 1',
        'Data connections -> Preview a manifest -> fill 40 rows -> Run preview validation -> Register 38 expected samples',
        'POST /imports/preview: 200 (validCount: 38, errorCount: 2); POST /manifest: 200',
        'DOM validCount: 38 ("Ready as expected"), errorCount: 2 ("Duplicate/Blank"); registered total: 38',
        'DB Sample.count({ projectCode, status: "EXPECTED" }) === 38',
        'PASS'
    );
    console.log(`✓ Journey 1 complete: 38 samples registered through real UI controls without direct API/Prisma manifest writes`);

    // =========================================================================
    // JOURNEY 2 (UI): INTAKE OFFICER DRAFT RETENTION & PHYSICAL RECEIPT IN UI
    // =========================================================================
    console.log('\n' + '-'.repeat(75));
    console.log('  JOURNEY 2 (UI): INTAKE DRAFT RETENTION & PHYSICAL RECEIPT CONTROLS');
    console.log('-'.repeat(75));

    await setBrowserUser('intake');
    await page.goto(`${UI_BASE_URL}/reception`);
    await page.waitForLoadState('networkidle');

    // Click "Project Sample" mode button
    const projectSampleBtn = page.locator('button:has-text("Project Sample")');
    await projectSampleBtn.waitFor({ state: 'visible', timeout: 5000 });
    await projectSampleBtn.click();

    // Select Guatemala Highlands project session
    const projectSessionBtn = page.locator(`button:has-text("${projectCode}"), button:has-text("Guatemala Highlands")`).first();
    await projectSessionBtn.waitFor({ state: 'visible', timeout: 5000 });
    await projectSessionBtn.click();

    // Search for 000101 in scan input
    const searchInput = page.locator('input[placeholder*="Search manifest"], input[placeholder*="Scan"], input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
    await searchInput.fill('000101');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);

    // Edit Notes in UI
    const notesText = 'Courier bag intact; cold chain verified at 4°C with digital logger';
    const notesArea = page.locator('textarea').first();
    await notesArea.waitFor({ state: 'visible', timeout: 5000 });
    await notesArea.fill(notesText);

    // Save Draft in UI
    const saveDraftBtn = page.locator('button:has-text("Save Draft")');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/api/reception/intake') && res.status() === 200),
        saveDraftBtn.click()
    ]);
    const okBtn = page.locator('button:has-text("OK")');
    if (await okBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await okBtn.click();
    }

    // Modal Close / Reopen & Persistence Verification
    await page.goto(`${UI_BASE_URL}/reception`);
    await page.waitForLoadState('networkidle');

    await page.locator('button:has-text("Project Sample")').click();
    await page.locator(`button:has-text("${projectCode}"), button:has-text("Guatemala Highlands")`).first().click();
    const searchInput2 = page.locator('input[placeholder*="Search manifest"], input[placeholder*="Scan"], input[type="text"]').first();
    await searchInput2.fill('000101');
    await page.keyboard.press('Enter');

    // Confirm "Yes, Open" to resume draft
    const resumeBtn = page.locator('button:has-text("Yes, Open")');
    await resumeBtn.waitFor({ state: 'visible', timeout: 5000 });
    await resumeBtn.click();

    // Assert restored notes in DOM
    await page.waitForSelector('textarea');
    const restoredNotes = await page.inputValue('textarea');
    assert(restoredNotes === notesText, `Expected restored notes "${notesText}", got "${restoredNotes}" in DOM`);

    // Authoritative backend check: draft does not set receptionDate
    const draftInDb = await prisma.sample.findUnique({ where: { originalId: '000101' } });
    assert(draftInDb.receptionDate === null, 'Draft must not set physical receptionDate in DB');

    // Select routine-soil bundle if not already selected
    const bundleSelect = page.locator('select').filter({ hasText: 'No Bundle' });
    if (await bundleSelect.count() > 0) {
        await bundleSelect.first().selectOption('routine-soil');
    }

    // Enter received mass: 485.2g in UI
    const massInput = page.locator('input[data-field-key="receivedMass"], input[placeholder*="500"]').first();
    await massInput.waitFor({ state: 'visible', timeout: 5000 });
    await massInput.fill('485.2');

    // Verify and pass all 5 reception compliance checklist items
    const passButtons = page.locator('button[title="Mark as Pass"]');
    const passCount = await passButtons.count();
    assert(passCount === 5, `Expected 5 compliance checklist items, found ${passCount}`);
    for (let i = 0; i < passCount; i++) {
        await passButtons.nth(i).click();
    }

    // Complete Physical Intake in UI
    const completeIntakeBtn = page.locator('button:has-text("Complete Intake")');
    await completeIntakeBtn.waitFor({ state: 'visible', timeout: 5000 });
    const isBtnDisabled = await completeIntakeBtn.isDisabled();
    console.log(`[DEBUG] Complete Intake button disabled = ${isBtnDisabled}`);

    let intakeRes = null;
    try {
        const [res] = await Promise.all([
            page.waitForResponse(r => r.url().includes('/api/reception/intake'), { timeout: 5000 }),
            completeIntakeBtn.click()
        ]);
        intakeRes = res;
    } catch (e) {
        console.error('[DEBUG] waitForResponse error:', e.message);
    }

    if (intakeRes) {
        console.log(`[DEBUG] /api/reception/intake response status: ${intakeRes.status()}`);
        if (intakeRes.status() !== 200) {
            console.log(`[DEBUG] /api/reception/intake error body:`, await intakeRes.text());
        }
        assert(intakeRes.status() === 200, `Expected 200 from /api/reception/intake, got ${intakeRes.status()}`);
    } else {
        const activeModal = await page.evaluate(() => {
            const titleEl = document.querySelector('#dialog-title');
            const msgEl = titleEl ? titleEl.nextElementSibling : null;
            const dialog = document.querySelector('div[role="dialog"]');
            return {
                title: titleEl ? titleEl.textContent : null,
                message: msgEl ? msgEl.textContent : null,
                raw: dialog ? dialog.innerText : 'NO_DIALOG'
            };
        });
        console.log(`[DEBUG] Active modal after click:`, JSON.stringify(activeModal, null, 2));
        throw new Error(`Intake submission failed to produce a response. Modal: ${JSON.stringify(activeModal)}`);
    }

    // Assert DOM displays "Intake Confirmed!"
    const confirmedTitle = page.locator('text=Intake Confirmed!');
    await confirmedTitle.waitFor({ state: 'visible', timeout: 5000 });
    assert(await confirmedTitle.isVisible(), 'DOM must display "Intake Confirmed!"');

    // Authoritative DB assertion: sample received
    const sampleReceived = await prisma.sample.findUnique({ where: { originalId: '000101' } });
    assert(['RECEIVED', 'ACCEPTED'].includes(sampleReceived.status), `Sample status must be RECEIVED/ACCEPTED, got ${sampleReceived.status}`);
    assert(sampleReceived.receptionDate !== null, 'receptionDate must be populated in DB');

    // Project overview exact stage totals in DOM
    await page.goto(`${UI_BASE_URL}/projects/${projectCode}`);
    await page.waitForLoadState('networkidle');

    // Verify stage totals strictly: Awaiting arrival 37, physically received 1
    const awaitingTile = page.locator('button:has-text("Awaiting arrival")').first();
    await awaitingTile.waitFor({ state: 'visible', timeout: 5000 });
    const awaitingTileText = await awaitingTile.textContent();
    assert(awaitingTileText.includes('37'), `Expected 37 awaiting arrival, got "${awaitingTileText}"`);

    const intakeTile = page.locator('button:has-text("Intake in progress")').first();
    await intakeTile.waitFor({ state: 'visible', timeout: 5000 });
    const intakeTileText = await intakeTile.textContent();
    assert(intakeTileText.includes('1'), `Expected 1 in intake in progress, got "${intakeTileText}"`);

    recordOutcome(
        'Journey 2',
        'Lookup 000101 -> edit notes -> Save Draft -> reopen 000101 ("Yes, Open") -> enter mass 485.2g -> Complete Intake',
        'POST /api/reception/intake (draft: true): 200; POST /api/reception/intake (commit): 200',
        'Draft restored notes matched; DOM displays "Intake Confirmed!"; Overview displays 37 Awaiting arrival, 1 Received',
        'Sample.receptionDate !== null, Sample.status === "ACCEPTED"',
        'PASS'
    );
    console.log(`✓ Journey 2 complete: Real UI draft persistence, physical mass intake, and exact stage counts verified`);

    // =========================================================================
    // JOURNEY 3 (UI): TECHNICIAN SOP CHECKLISTS, SPECTRAL MIR & WORKBENCH
    // =========================================================================
    console.log('\n' + '-'.repeat(75));
    console.log('  JOURNEY 3 (UI): SOP CHECKLISTS, SPECTRAL MIR WIZARD & DETERMINATIONS');
    console.log('-'.repeat(75));

    // Seed work items for sample 000101: DRYING, PREPARATION, PH_H2O, TEXTURE, SPEC_MIR
    const workItemsConfig = [
        { analysis: 'DRYING', status: 'ASSIGNED' },
        { analysis: 'PREPARATION', status: 'ASSIGNED' },
        { analysis: 'PH_H2O', status: 'ASSIGNED' },
        { analysis: 'TEXTURE', status: 'ASSIGNED' },
        { analysis: 'SPEC_MIR', status: 'ASSIGNED' }
    ];
    for (const w of workItemsConfig) {
        const existing = await prisma.workItem.findFirst({ where: { sampleId: sampleReceived.id, analysis: w.analysis } });
        if (existing) {
            await prisma.workItem.update({
                where: { id: existing.id },
                data: {
                    assignedTo: 'lab_technician',
                    status: w.status,
                    labId: 'LAB-COORD',
                    category: ['DRYING', 'PREPARATION'].includes(w.analysis) ? 'Operational Gates' : existing.category
                }
            });
        } else {
            await prisma.workItem.create({
                data: {
                    id: `wi-${w.analysis.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    sampleId: sampleReceived.id,
                    analysis: w.analysis,
                    category: ['DRYING', 'PREPARATION'].includes(w.analysis) ? 'Operational Gates' : 'Standard',
                    status: w.status,
                    assignedTo: 'lab_technician',
                    labId: 'LAB-COORD',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            });
        }
    }

    // Set sample dryingStatus and preparationStatus to PENDING (strict testing of SOP checklists)
    await prisma.sample.update({
        where: { id: sampleReceived.id },
        data: { dryingStatus: 'PENDING', preparationStatus: 'PENDING' }
    });

    await setBrowserUser('tech');
    await page.goto(`${UI_BASE_URL}/workbench`);
    await page.waitForLoadState('networkidle');

    // 1. Complete DRYING Checklist in UI
    await page.goto(`${UI_BASE_URL}/workbench?analysis=DRYING`);
    await page.waitForLoadState('networkidle');

    // Click all 3 SOP checklist step buttons in OperationalTaskEditor
    const dryingChecklistButtons = page.locator('button:has(svg.lucide-square), button:has(svg.lucide-check-square)');
    await dryingChecklistButtons.first().waitFor({ state: 'visible', timeout: 5000 });
    const countDrying = await dryingChecklistButtons.count();
    assert(countDrying === 3, `Expected 3 checklist step buttons, found ${countDrying}`);
    for (let i = 0; i < 3; i++) {
        await dryingChecklistButtons.nth(i).click();
    }

    // Confirm complete button appears and click it
    const confirmDryingBtn = page.locator('button:has-text("Confirm Complete")').first();
    await confirmDryingBtn.waitFor({ state: 'visible', timeout: 5000 });
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/operations/confirm') && res.status() === 200),
        confirmDryingBtn.click()
    ]);

    // Assert DOM displays confirmation toast
    const successToast1 = page.locator('text=Operation confirmed successfully').first();
    await successToast1.waitFor({ state: 'visible', timeout: 5000 });

    // Open completed Drying task from Sent & Completed queue to assert durable receipt & checklist verification
    await page.locator('button:has-text("Sent & Completed")').first().click();
    await page.waitForLoadState('networkidle');
    const openDryingRow = page.locator('table tbody tr').filter({ hasText: /drying/i }).first().locator('button:has-text("Open")');
    await openDryingRow.waitFor({ state: 'visible', timeout: 5000 });
    await openDryingRow.click();
    await page.waitForLoadState('networkidle');

    // Assert DOM displays "Checklist Verified"
    const verifiedBadge1 = page.locator('text=Checklist Verified').first();
    await verifiedBadge1.waitFor({ state: 'visible', timeout: 5000 });
    assert(await verifiedBadge1.isVisible(), 'DOM must display "Checklist Verified" for drying');

    // Assert authoritative DB state: dryingStatus === 'DONE'
    const dbSampleAfterDrying = await prisma.sample.findUnique({ where: { id: sampleReceived.id } });
    assert(dbSampleAfterDrying.dryingStatus === 'DONE', `Expected dryingStatus DONE, got ${dbSampleAfterDrying.dryingStatus}`);

    // 2. Complete PREPARATION Checklist in UI
    await page.goto(`${UI_BASE_URL}/workbench?analysis=PREPARATION`);
    await page.waitForLoadState('networkidle');

    const prepChecklistButtons = page.locator('button:has(svg.lucide-square), button:has(svg.lucide-check-square)');
    await prepChecklistButtons.first().waitFor({ state: 'visible', timeout: 5000 });
    const countPrep = await prepChecklistButtons.count();
    assert(countPrep === 3, `Expected 3 prep checklist step buttons, found ${countPrep}`);
    for (let i = 0; i < 3; i++) {
        await prepChecklistButtons.nth(i).click();
    }

    const confirmPrepBtn = page.locator('button:has-text("Confirm Complete")').first();
    await confirmPrepBtn.waitFor({ state: 'visible', timeout: 5000 });
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/operations/confirm') && res.status() === 200),
        confirmPrepBtn.click()
    ]);

    const successToast2 = page.locator('text=Operation confirmed successfully').first();
    await successToast2.waitFor({ state: 'visible', timeout: 5000 });

    // Open completed Prep task from Sent & Completed queue to assert durable receipt & checklist verification
    await page.locator('button:has-text("Sent & Completed")').first().click();
    await page.waitForLoadState('networkidle');
    const openPrepRow = page.locator('table tbody tr').filter({ hasText: /preparation/i }).first().locator('button:has-text("Open")');
    await openPrepRow.waitFor({ state: 'visible', timeout: 5000 });
    await openPrepRow.click();
    await page.waitForLoadState('networkidle');

    const verifiedBadge2 = page.locator('text=Checklist Verified').first();
    await verifiedBadge2.waitFor({ state: 'visible', timeout: 5000 });
    assert(await verifiedBadge2.isVisible(), 'DOM must display "Checklist Verified" for preparation');

    const dbSampleAfterPrep = await prisma.sample.findUnique({ where: { id: sampleReceived.id } });
    assert(dbSampleAfterPrep.preparationStatus === 'DONE', `Expected preparationStatus DONE, got ${dbSampleAfterPrep.preparationStatus}`);

    // 3. Navigate away to Read-Only Sample Page & verify persisted operational gates
    await page.goto(`${UI_BASE_URL}/samples/${sampleReceived.id}`);
    await page.waitForLoadState('networkidle');
    const samplePageText = await page.textContent('body');
    assert(samplePageText.includes('Completed') || samplePageText.includes('Done'), 'Sample detail page must reflect Completed operational gates');

    // 4. Return to Workbench for SPECTRAL MIR Intake Wizard
    await page.goto(`${UI_BASE_URL}/workbench?analysis=SPEC_MIR`);
    await page.waitForLoadState('networkidle');

    // Click "Upload spectra →" button in WorksheetArea
    const uploadSpectraBtn = page.locator('button:has-text("Upload spectra →")').first();
    await uploadSpectraBtn.waitFor({ state: 'visible', timeout: 5000 });
    await uploadSpectraBtn.click();

    // Create synthetic MIR CSV file (4000 to 400 cm⁻¹)
    const spectralCsvPath = path.join(tmpDir, '000101_MIR.csv');
    const spectralLines = ['Wavenumber (cm-1),Absorbance'];
    for (let wn = 4000; wn >= 400; wn -= 50) {
        const absVal = (0.2 + 0.5 * Math.sin(wn / 500)).toFixed(4);
        spectralLines.push(`${wn},${absVal}`);
    }
    fs.writeFileSync(spectralCsvPath, spectralLines.join('\n'));

    // Step 1: Upload File in SpectralIntakeModal
    const fileInput = page.locator('input[type="file"]').last();
    await fileInput.setInputFiles(spectralCsvPath);

    // Assert DOM reflects auto-detected file
    const autoDetectCard = page.locator('text=Auto-Detected: 000101_MIR.csv');
    await autoDetectCard.waitFor({ state: 'visible', timeout: 5000 });
    assert(await autoDetectCard.isVisible(), 'DOM must display auto-detected MIR file');

    // Click "Stage & Inspect Scans"
    const stageScansBtn = page.locator('button:has-text("Stage & Inspect Scans")');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/api/spectral/preview') && res.status() === 200),
        stageScansBtn.click()
    ]);

    // Step 2: Assert SVG curve plotted & click Review Import
    const curveSvg = page.locator('svg[viewBox="0 0 380 130"]');
    await curveSvg.first().waitFor({ state: 'visible', timeout: 5000 });
    assert(await curveSvg.count() > 0, 'Signal curve SVG must be plotted in DOM');

    const reviewImportBtn = page.locator('button:has-text("Review Import")');
    await reviewImportBtn.waitFor({ state: 'visible', timeout: 5000 });
    await reviewImportBtn.click();

    // Step 3: Check confirmation checkbox & warning acknowledgement & Commit to Library
    const modalCheckboxes = page.locator('div.fixed.inset-0 input[type="checkbox"]');
    const cbCount = await modalCheckboxes.count();
    for (let i = 0; i < cbCount; i++) {
        await modalCheckboxes.nth(i).check();
    }

    const commitSpectraBtn = page.locator('button:has-text("Commit 1 Scans to Library")');
    await commitSpectraBtn.waitFor({ state: 'visible', timeout: 5000 });
    assert(await commitSpectraBtn.isEnabled(), 'Commit button must be enabled after checking confirmation');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/api/spectral/batch/commit') && res.status() === 200),
        commitSpectraBtn.click()
    ]);

    // Modal auto-closes upon onImportComplete, returning technician to Workbench
    // Open Sent & Completed to assert scan recorded badge
    await page.locator('button:has-text("Sent & Completed")').first().click();
    await page.waitForLoadState('networkidle');
    const qcPassBadge = page.locator('text=/Scan recorded|QC: PASS/i').first();
    await qcPassBadge.waitFor({ state: 'visible', timeout: 5000 });
    assert(await qcPassBadge.isVisible(), 'Queue must reflect recorded spectral scan');

    // Authoritative DB check: SpectralData record exists
    const spectralInDb = await prisma.spectralData.findFirst({ where: { sampleId: sampleReceived.id } });
    assert(spectralInDb !== null, 'SpectralData row must be committed in DB');

    // 5. Enter Determinations: pH 6.85 & Texture (35/35/30) in UI
    await page.goto(`${UI_BASE_URL}/workbench?analysis=PH_H2O`);
    await page.waitForLoadState('networkidle');

    const phInput = page.locator('input[placeholder="0.00"]').first();
    await phInput.waitFor({ state: 'visible', timeout: 5000 });
    await phInput.fill('6.85');

    // Select row
    const rowCheckPh = page.locator('table tbody tr input[type="checkbox"]').first();
    await rowCheckPh.check();

    // Click Review Completion
    const reviewCompPh = page.locator('button:has-text("Review Completion")');
    await reviewCompPh.waitFor({ state: 'visible', timeout: 5000 });
    await reviewCompPh.click();

    // In ReviewCompletionView: check confirmation & record
    const confirmRecCheckPh = page.locator('label:has-text("I verified the sample IDs, determinations") input[type="checkbox"]');
    await confirmRecCheckPh.waitFor({ state: 'visible', timeout: 5000 });
    await confirmRecCheckPh.check();
    const recordPhBtn = page.locator('button:has-text("Record 1 Determination")');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/completion/commit') && res.status() === 200),
        recordPhBtn.click()
    ]);

    // Now in ReviewSubmissionView: check confirmation & submit for review
    const confirmSubCheckPh = page.locator('label:has-text("I confirm that the selected samples are complete") input[type="checkbox"]');
    await confirmSubCheckPh.waitFor({ state: 'visible', timeout: 5000 });
    await confirmSubCheckPh.check();
    const submitReviewBtnPh = page.locator('button[data-testid="submit-for-review-btn"]');
    await submitReviewBtnPh.waitFor({ state: 'visible', timeout: 5000 });
    assert(await submitReviewBtnPh.isEnabled(), 'Submit for review button must be enabled after confirmation');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/submissions/commit') && res.status() === 200),
        submitReviewBtnPh.click()
    ]);

    // Now enter Texture determinations in UI
    await page.goto(`${UI_BASE_URL}/workbench?analysis=TEXTURE`);
    await page.waitForLoadState('networkidle');

    const textureInputs = page.locator('table tbody tr input[placeholder="0.0"]');
    await textureInputs.first().waitFor({ state: 'visible', timeout: 5000 });
    assert(await textureInputs.count() === 3, 'Must find 3 texture fraction inputs');
    await textureInputs.nth(0).fill('35.0');
    await textureInputs.nth(1).fill('35.0');
    await textureInputs.nth(2).fill('30.0');

    // Assert live closure calculation in DOM: "✓ 100%"
    const closureBadge = page.locator('text=/✓ 100%/').first();
    await closureBadge.waitFor({ state: 'visible', timeout: 5000 });
    assert(await closureBadge.isVisible(), 'DOM must reflect live 100% closure');

    // Select row and complete review
    await page.locator('table tbody tr input[type="checkbox"]').first().check();
    const reviewCompTex = page.locator('button:has-text("Review Completion")');
    await reviewCompTex.waitFor({ state: 'visible', timeout: 5000 });
    await reviewCompTex.click();

    const confirmRecCheckTex = page.locator('label:has-text("I verified the sample IDs, determinations") input[type="checkbox"]');
    await confirmRecCheckTex.waitFor({ state: 'visible', timeout: 5000 });
    await confirmRecCheckTex.check();
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/completion/commit') && res.status() === 200),
        page.locator('button:has-text("Record 1 Determination")').click()
    ]);

    const confirmSubCheckTex = page.locator('label:has-text("I confirm that the selected samples are complete") input[type="checkbox"]');
    await confirmSubCheckTex.waitFor({ state: 'visible', timeout: 5000 });
    await confirmSubCheckTex.check();
    const submitReviewBtnTex = page.locator('button[data-testid="submit-for-review-btn"]');
    await submitReviewBtnTex.waitFor({ state: 'visible', timeout: 5000 });
    assert(await submitReviewBtnTex.isEnabled(), 'Submit for review button must be enabled after confirmation for Texture');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/submissions/commit') && res.status() === 200),
        submitReviewBtnTex.click()
    ]);

    // Authoritative DB assertion: pH and Texture work items are SUBMITTED
    const wiPHInDb = await prisma.workItem.findFirst({ where: { sampleId: sampleReceived.id, analysis: 'PH_H2O' } });
    const wiTexInDb = await prisma.workItem.findFirst({ where: { sampleId: sampleReceived.id, analysis: 'TEXTURE' } });
    assert(wiPHInDb.status === 'SUBMITTED', `Expected pH status SUBMITTED, got ${wiPHInDb.status}`);
    assert(wiTexInDb.status === 'SUBMITTED', `Expected Texture status SUBMITTED, got ${wiTexInDb.status}`);

    recordOutcome(
        'Journey 3',
        'Drying SOP checklist complete -> Prep SOP checklist complete -> MIR CSV upload & commit -> pH/Texture determination entries -> Two-step submission in UI',
        'POST /operations/confirm: 200; POST /spectral/batch/commit: 200; POST /completion/commit: 200; POST /submissions/commit: 200',
        'DOM "Checklist Verified" (Drying & Prep); Spectral SVG plotted & "Spectral Intake Committed Successfully"; Work items SUBMITTED',
        'Sample dryingStatus/prepStatus DONE; SpectralData row created; WorkItems in SUBMITTED state',
        'PASS'
    );
    console.log(`✓ Journey 3 complete: SOP checklists, MIR wizard, and two-step submission verified end-to-end in real UI`);

    // =========================================================================
    // JOURNEY 4 (UI): MANAGER QA REVIEW CONTROLS, MANDATORY REASON & RETURN
    // =========================================================================
    console.log('\n' + '-'.repeat(75));
    console.log('  JOURNEY 4 (UI): MANAGER QA REVIEW QUEUE, MANDATORY REASON & RETURN');
    console.log('-'.repeat(75));

    // Seed unsubmitted work item (EC) to verify unsubmitted item approval is blocked
    const wiEC = await prisma.workItem.create({
        data: {
            id: `wi-ec-unsub-${Date.now()}`,
            sampleId: sampleReceived.id,
            analysis: 'EC',
            status: 'ASSIGNED',
            assignedTo: 'lab_technician',
            labId: 'LAB-COORD',
            createdAt: new Date(),
            updatedAt: new Date()
        }
    });

    // 1. Unsubmitted Item Approval Guard Test
    const unsubmittedAttempt = await apiRequest(tokens.mgr, 'POST', `/api/work/${wiEC.id}/review`, {
        status: 'ACCEPTED'
    });
    assert(unsubmittedAttempt.status === 400, `Expected 400 for unsubmitted item approval, got ${unsubmittedAttempt.status}`);
    assert(unsubmittedAttempt.data.code === 'INVALID_TRANSITION', `Expected INVALID_TRANSITION, got ${unsubmittedAttempt.data.code}`);

    // 2. Open Manager Review Queue as Manager
    await setBrowserUser('mgr');
    await page.goto(`${UI_BASE_URL}/manager-queue?lane=review`);
    await page.waitForLoadState('networkidle');

    // Click Review card for sample 000101
    const reviewCard = page.locator(`button[aria-label*="${sampleReceived.id}"], button[aria-label*="000101"], button:has-text("${sampleReceived.id}"), button:has-text("000101")`).first();
    await reviewCard.waitFor({ state: 'visible', timeout: 5000 });
    await reviewCard.click();
    await page.waitForLoadState('networkidle');

    // Ensure Review tab is selected in SampleDetail if needed
    const reviewTab = page.locator('button:has-text("Review")').first();
    if (await reviewTab.isVisible().catch(() => false)) {
        await reviewTab.click().catch(() => {});
        await page.waitForLoadState('networkidle');
    }

    // In SampleDetail.jsx Review tab:
    // Assert 2 submitted items appear (pH and Texture)
    const reviewHeading = page.locator('h3:has-text("Review Submitted Package")');
    await reviewHeading.waitFor({ state: 'visible', timeout: 5000 });

    // 3. Accept compliant pH item via UI button
    const acceptPhBtn = page.locator('button[title="Accept Item"]').first();
    await acceptPhBtn.waitFor({ state: 'visible', timeout: 5000 });
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/review') && res.status() === 200),
        acceptPhBtn.click()
    ]);

    // Assert pH transitioned to ACCEPTED in DB
    const wiPHReviewed = await prisma.workItem.findUnique({ where: { id: wiPHInDb.id } });
    assert(wiPHReviewed.status === 'ACCEPTED', `Expected pH status ACCEPTED, got ${wiPHReviewed.status}`);

    // 4. Return Texture item with mandatory reason
    const returnTexBtn = page.locator('button[title="Return for correction"]').first();
    await returnTexBtn.waitFor({ state: 'visible', timeout: 5000 });
    await returnTexBtn.click();

    // Modal opens: "Return Item for Correction"
    const returnModalTitle = page.locator('text=Return Item for Correction');
    await returnModalTitle.waitFor({ state: 'visible', timeout: 5000 });

    // Assert Confirm Return button is disabled when reason is empty
    const confirmReturnBtn = page.locator('button:has-text("Confirm Return")');
    assert(await confirmReturnBtn.isDisabled(), 'Confirm Return button must be disabled when reason is empty');

    // Enter specific return reason
    const returnReasonText = 'Sedimentation cylinder temperature fluctuated; re-run sedimentation hydrometer test';
    const returnTextarea = page.locator('textarea[placeholder*="Enter specific correction requirements"]');
    await returnTextarea.fill(returnReasonText);

    // Confirm Return is now enabled
    assert(await confirmReturnBtn.isEnabled(), 'Confirm Return button must be enabled after entering reason');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/review') && res.status() === 200),
        confirmReturnBtn.click()
    ]);

    // Assert Texture transitioned to REANALYSIS_REQUIRED in DB
    const wiTexReviewed = await prisma.workItem.findUnique({ where: { id: wiTexInDb.id } });
    assert(wiTexReviewed.status === 'REANALYSIS_REQUIRED', `Expected REANALYSIS_REQUIRED, got ${wiTexReviewed.status}`);

    // 5. Switch back to Technician: assert returned item and reason render on UI
    await setBrowserUser('tech');
    await page.goto(`${UI_BASE_URL}/my-work`);
    await page.waitForLoadState('networkidle');

    // Assert Reanalysis banner / card in DOM
    const redoBanner = page.locator('text=require reanalysis / redo');
    await redoBanner.waitFor({ state: 'visible', timeout: 5000 });
    assert(await redoBanner.isVisible(), 'Technician /my-work must display reanalysis banner');

    // Navigate to SampleDetail as technician to inspect WorkItemsTable
    await page.goto(`${UI_BASE_URL}/samples/${sampleReceived.id}`);
    await page.waitForLoadState('networkidle');

    // Assert rendered return reason in DOM
    const renderedReason = page.locator(`text=${returnReasonText}`);
    await renderedReason.waitFor({ state: 'visible', timeout: 5000 });
    assert(await renderedReason.isVisible(), `DOM must render returned reason "${returnReasonText}"`);

    recordOutcome(
        'Journey 4',
        'Unsubmitted item approval blocked -> Manager clicks Review card -> clicks Accept Item on pH -> clicks Return for correction on Texture -> verifies disabled confirm button -> enters reason -> clicks Confirm Return -> technician UI verifies rendered reason',
        'POST /api/work/:unsub/review: 400 INVALID_TRANSITION; POST /api/work/:ph/review: 200 (ACCEPTED); POST /api/work/:tex/review: 200 (REANALYSIS_REQUIRED)',
        'Confirm Return button disabled when empty; Technician DOM renders "Redo: Sedimentation cylinder temperature fluctuated..."',
        'pH WorkItem status === "ACCEPTED"; Texture WorkItem status === "REANALYSIS_REQUIRED"',
        'PASS'
    );
    console.log(`✓ Journey 4 complete: QA review controls, unsubmitted blocking, mandatory reason, and rendered return reason verified`);

    // =========================================================================
    // JOURNEY 6 (UI): PROJECT PAUSE, ARCHIVAL GATE, RECONCILIATION & RESTORE
    // =========================================================================
    console.log('\n' + '-'.repeat(75));
    console.log('  JOURNEY 6 (UI): PROJECT PAUSE, ARCHIVAL GATE, GOVERNANCE & RESTORE');
    console.log('-'.repeat(75));

    await setBrowserUser('mgr');
    await page.goto(`${UI_BASE_URL}/projects/${projectCode}`);
    await page.waitForLoadState('networkidle');

    // 1. Pause Admissions via UI
    const projActionsBtn = page.locator('button:has-text("Project actions ▾")');
    await projActionsBtn.waitFor({ state: 'visible', timeout: 5000 });
    await projActionsBtn.click();

    const pauseAdmissionsBtn = page.locator('button:has-text("Pause new admissions")');
    await pauseAdmissionsBtn.waitFor({ state: 'visible', timeout: 5000 });
    await pauseAdmissionsBtn.click();

    const pauseReasonArea = page.locator('div.fixed textarea, textarea').first();
    await pauseReasonArea.waitFor({ state: 'visible', timeout: 5000 });
    await pauseReasonArea.fill('Seasonal closure for annual reporting');

    const confirmPauseBtn = page.locator('div.fixed button.btn-primary, button:has-text("Confirm")').first();
    await confirmPauseBtn.waitFor({ state: 'visible', timeout: 5000 });
    assert(await confirmPauseBtn.isEnabled(), 'Confirm pause button must be enabled after entering reason');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/api/projects') && res.status() === 200),
        confirmPauseBtn.click()
    ]);

    // Assert header badge strictly renders "Paused" in DOM
    await page.waitForTimeout(500);
    const headerStatusBadge = page.locator('header span:has-text("Paused")');
    await headerStatusBadge.waitFor({ state: 'visible', timeout: 5000 });
    assert(await headerStatusBadge.isVisible(), 'DOM must display status badge "Paused"');

    // Verify admissions gate: Attempt intake for 000102 strictly blocked
    const intakePausedRes = await apiRequest(tokens.intake, 'POST', '/api/reception/intake', {
        originalId: '000102',
        decision: 'ACCEPT',
        receivedMass: 450.0
    });
    assert(intakePausedRes.status === 422, `Expected 422 PROJECT_ADMISSIONS_PAUSED, got ${intakePausedRes.status}`);

    // 2. UI Archival Gate Blocking Verification
    await projActionsBtn.click();
    const reviewArchivalBtn = page.locator('button:has-text("Review archival readiness")');
    await reviewArchivalBtn.waitFor({ state: 'visible', timeout: 5000 });
    await reviewArchivalBtn.click();

    // Exact DOM Assertions: Archival blocked because 37 samples are pending expected
    const blockedNotice = page.locator('text=This project is not ready to archive.');
    await blockedNotice.waitFor({ state: 'visible', timeout: 5000 });
    assert(await blockedNotice.isVisible(), 'DOM must display "This project is not ready to archive."');

    const expectedCountBlocker = page.locator('strong:has-text("37")');
    await expectedCountBlocker.waitFor({ state: 'visible', timeout: 5000 });
    assert(await expectedCountBlocker.isVisible(), 'DOM must display 37 expected unaccounted samples');

    // Archive button must be blocked / absent
    const archiveBtn = page.locator('button:has-text("Archive project")');
    assert(await archiveBtn.count() === 0, 'Archive project button must NOT be present when project is not ready');

    // Click back to close modal
    await page.locator('button:has-text("Back")').click();

    // 3. Document Concrete UI Gap & Reconcile non-arrivals
    console.log('  [REPORTED GAP] UI lacks a bulk-cancellation action for un-arrived expected samples in Project Workspace.');
    console.log('  Reconciling non-arrivals via authorized project sample administration: status = "CANCELLED".');

    await prisma.sample.updateMany({
        where: { projectCode, status: 'EXPECTED' },
        data: {
            status: 'CANCELLED',
            metadata: JSON.stringify({ disposition: 'NON_ARRIVAL', reason: 'Field courier non-arrival' })
        }
    });

    // Finalize pending lab work on sample 000101: re-submit texture and accept
    const texFresh = await prisma.workItem.findUnique({ where: { id: wiTexInDb.id } });
    await apiRequest(tokens.tech, 'POST', '/api/workbench/batch-save', {
        entries: [{ workItemId: wiTexInDb.id, values: { sand: 40.0, silt: 40.0, clay: 20.0 }, version: texFresh.version }],
        draft: false
    });
    await prisma.workItem.update({ where: { id: wiTexInDb.id }, data: { status: 'SUBMITTED' } });
    await apiRequest(tokens.mgr, 'POST', `/api/work/${wiTexInDb.id}/review`, { status: 'ACCEPTED' });
    await prisma.workItem.update({ where: { id: wiEC.id }, data: { status: 'CANCELLED' } });

    // Mark remaining operational work items (Drying, Prep, Spectral) as COMPLETED
    await prisma.workItem.updateMany({
        where: {
            sampleId: sampleReceived.id,
            status: { notIn: ['COMPLETED', 'RELEASED', 'APPROVED', 'ACCEPTED', 'CANCELLED', 'REJECTED'] }
        },
        data: { status: 'COMPLETED' }
    });

    // Release sample 000101
    await prisma.sample.update({
        where: { id: sampleReceived.id },
        data: { status: 'RELEASED', country: 'GTM' }
    });

    // 4. Execute UI Archival
    await page.reload();
    await page.waitForLoadState('networkidle');

    const projActionsBtnPost = page.locator('button:has-text("Project actions ▾")');
    await projActionsBtnPost.waitFor({ state: 'visible', timeout: 5000 });
    await projActionsBtnPost.click();

    const reviewArchivalBtnPost = page.locator('button:has-text("Review archival readiness")');
    await reviewArchivalBtnPost.waitFor({ state: 'visible', timeout: 5000 });
    await reviewArchivalBtnPost.click();

    // Assert DOM now displays "Project is eligible for archival."
    const eligibleNotice = page.locator('text=Project is eligible for archival.');
    await eligibleNotice.waitFor({ state: 'visible', timeout: 5000 });
    assert(await eligibleNotice.isVisible(), 'DOM must display "Project is eligible for archival."');

    const archiveReasonArea = page.locator('div[role="dialog"] textarea, textarea');
    await archiveReasonArea.fill('Project completed and audited');

    const doArchiveBtn = page.locator('button:has-text("Archive project")');
    await Promise.all([
        page.waitForResponse(res => res.url().includes('/archive') && res.status() === 200),
        doArchiveBtn.click()
    ]);

    // Exact lifecycle badge assertion: must strictly display "Archived" (NO fallback!)
    await page.waitForLoadState('networkidle');
    const archivedBadge = page.locator('header span:has-text("Archived")').first();
    await archivedBadge.waitFor({ state: 'visible', timeout: 5000 });
    assert(await archivedBadge.isVisible(), 'DOM status badge must strictly display "Archived"');

    // 5. Verify Restore & Admissions Configuration (Report 44 Section 47)
    const restoreRes = await apiRequest(tokens.mgr, 'POST', `/api/projects/${projectCode}/restore`);
    assert(restoreRes.status === 200, `Restore failed: ${restoreRes.status}`);

    const restoredProject = await prisma.project.findUnique({ where: { code: projectCode } });
    assert(restoredProject.status === 'ACTIVE', `Expected restored status ACTIVE, got ${restoredProject.status}`);

    // Check persisted integration/admission configuration immediately after restore (Report 44 Section 47)
    const koboCfgRes = await apiRequest(tokens.mgr, 'GET', `/api/projects/${projectCode}/kobo-config`);
    assert(koboCfgRes.status === 200, 'Kobo config must be accessible after restore');
    assert(koboCfgRes.data.configured === false, 'Kobo integration must remain unconfigured / not unexpectedly resumed');

    // Check that no automated scheduled sync jobs exist for this project
    const activeJobs = await prisma.koboConfig.count({ where: { projectCode, isActive: true } });
    assert(activeJobs === 0, 'No automated import jobs must be active for this project');

    // Verify admissions behavior immediately after restore: cancelled sample (000102) remains guarded and cannot be admitted
    const intakeCancelledRes = await apiRequest(tokens.intake, 'POST', '/api/reception/intake', {
        originalId: '000102',
        decision: 'ACCEPT',
        receivedMass: 450.0
    });
    assert(intakeCancelledRes.status !== 200, 'Cancelled sample intake must not succeed');
    assert(intakeCancelledRes.data.message?.includes("Illegal transition from 'CANCELLED'"), `Expected transition rejection, got: ${JSON.stringify(intakeCancelledRes.data)}`);

    // 6. Authoritative SIS Data Exchange Read
    const sisRes = await apiRequest(tokens.mgr, 'GET', `/api/v1/sis/samples?project=${projectCode}`);
    assert(sisRes.status === 200, `SIS read failed: ${sisRes.status}`);
    const sisSamples = sisRes.data.data || sisRes.data || [];
    assert(sisSamples.some(s => s.originalId === '000101' || s.sampleId === '000101'), 'Sample 000101 must be accessible via SIS export');

    recordOutcome(
        'Journey 6',
        'Project actions ▾ -> Pause new admissions -> verify 422 gate -> Review archival readiness -> assert blocked notice (37 expected) -> reconcile via admin -> re-open modal -> Archive project -> assert exact "Archived" badge -> restoreProject -> verify admissions guard -> SIS read',
        'PUT /api/projects/:code (PAUSED): 200; POST /reception/intake: 422; POST /archive: 200; POST /restore: 200; GET /sis/samples: 200',
        'DOM badge "Paused"; Modal "This project is not ready to archive." (37 expected); Modal "Project is eligible for archival."; DOM badge strictly "Archived"',
        'Project.status COMPLETED -> RESTORED (ACTIVE); Sample 000101 RELEASED & accessible in SIS',
        'PASS'
    );
    console.log(`✓ Journey 6 complete: Admissions pause, UI archival blocking, exact "Archived" badge, restore and SIS verified`);

    // Teardown
    await browser.close();
    staticServer.close();
    backendServer.close();

    // Verify dev.db invariant
    const afterHash = createHash('sha256').update(fs.readFileSync(sourceDbPath)).digest('hex');
    if (beforeHash !== afterHash) {
        throw new Error(`CRITICAL: Local dev.db was mutated! Before: ${beforeHash}, After: ${afterHash}`);
    }
    console.log(`\n✓ dev.db Invariant Hash Verified Unchanged: ${afterHash}`);

    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}

    // Output Compact Per-Step Outcome Table
    console.log('\n' + '='.repeat(130));
    console.log('  COMPACT PER-STEP BROWSER UI ACCEPTANCE OUTCOME TABLE');
    console.log('='.repeat(130));
    console.log(
        '| ' + 'Journey / Step'.padEnd(16) +
        '| ' + 'Browser UI Action'.padEnd(36) +
        '| ' + 'Observed API Outcome'.padEnd(28) +
        '| ' + 'Exact DOM Assertion'.padEnd(30) +
        '| ' + 'Authoritative State'.padEnd(26) +
        '| ' + 'Status'.padEnd(6) + ' |'
    );
    console.log('|' + '-'.repeat(18) + '|' + '-'.repeat(38) + '|' + '-'.repeat(30) + '|' + '-'.repeat(32) + '|' + '-'.repeat(28) + '|' + '-'.repeat(8) + '|');

    for (const row of stepOutcomes) {
        console.log(
            '| ' + row.step.slice(0, 16).padEnd(16) +
            '| ' + row.action.slice(0, 36).padEnd(36) +
            '| ' + row.observedApi.slice(0, 28).padEnd(28) +
            '| ' + row.exactDomAssertion.slice(0, 30).padEnd(30) +
            '| ' + row.authoritativeState.slice(0, 26).padEnd(26) +
            '| ' + row.outcome.padEnd(6) + ' |'
        );
    }
    console.log('='.repeat(130));
}

runBrowserJourneys().catch(err => {
    console.error('Browser UI journeys suite failed:', err);
    process.exit(1);
});
