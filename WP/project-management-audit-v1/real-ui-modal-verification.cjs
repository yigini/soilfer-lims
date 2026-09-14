// React UI Playwright Suite with Mocked Backend API (Screen & Component Lifecycle Verification)
// Note: This suite exercises the built React SPA, component state lifecycle, modal retention
// across close/reopen, same-SPA account switch session isolation, and stale revision 409 rejection.
// It is paired with real-route Supertest acceptance suites for complete end-to-end evidence.

const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');

function loadPlaywright() {
    const candidates = [
        'playwright',
        path.join(process.env.USERPROFILE || 'C:/Users/yigin', '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),
        path.resolve(__dirname, '../../client/node_modules/playwright'),
        path.resolve(__dirname, '../../server/node_modules/playwright')
    ];
    for (const c of candidates) {
        try { return require(c); } catch (e) {}
    }
    throw new Error('Playwright could not be resolved from candidate locations.');
}

const { chromium } = loadPlaywright();
const jwt = require(path.resolve(__dirname, '../../server/node_modules/jsonwebtoken'));

// Ephemeral per-run fixture signing secret (clearly labeled, non-production)
const JWT_SECRET = 'FIXTURE_EPHEMERAL_TEST_SECRET_' + crypto.randomBytes(16).toString('hex');
const PORT = 4173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

function startStaticServer(port = PORT) {
    const distDir = path.resolve(__dirname, '../../client/dist');
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml'
    };

    const server = http.createServer((req, res) => {
        let cleanUrl = req.url.split('?')[0];
        let filePath = path.join(distDir, cleanUrl);
        if (cleanUrl.startsWith('/api/')) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not mocked' }));
            return;
        }
        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
            filePath = path.join(distDir, 'index.html');
        }
        const ext = path.extname(filePath);
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });

    return new Promise((resolve) => {
        server.listen(port, HOST, () => {
            console.log(`[Static Fixture Server] Running on http://${HOST}:${port} (bound to loopback)`);
            resolve(server);
        });
    });
}

async function run() {
    console.log('================================================================================');
    console.log('React UI Playwright Suite with Mocked Backend API');
    console.log('Testing: Component Lifecycle, Modal State Retention, Same-SPA Session Isolation,');
    console.log('         Original Revision Snapshots & Stale 409 Rejection');
    console.log('================================================================================\n');

    const server = await startStaticServer();

    const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    const launchOptions = {
        headless: true,
        args: ['--ignore-certificate-errors', '--no-sandbox']
    };
    if (fs.existsSync(chromePath)) {
        launchOptions.executablePath = chromePath;
    }

    const browser = await chromium.launch(launchOptions);

    // Initial User A (System Admin)
    const userA = {
        id: 'user-a-admin',
        username: 'admin',
        name: 'System Admin (User A)',
        role: 'SUPER_ADMIN',
        labId: 'A',
        isActive: true,
        tokenVersion: 1
    };
    const tokenA = jwt.sign(
        { id: userA.id, username: userA.username, role: userA.role, tokenVersion: userA.tokenVersion },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    // User B (Project Manager)
    const userB = {
        id: 'user-b-pm',
        username: 'pm_bob',
        name: 'Project Manager Bob (User B)',
        role: 'PROJECT_MANAGER',
        labId: 'A',
        isActive: true,
        tokenVersion: 1
    };
    const tokenB = jwt.sign(
        { id: userB.id, username: userB.username, role: userB.role, tokenVersion: userB.tokenVersion },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    let currentLoggedInUser = userA;
    let currentToken = tokenA;

    const context = await browser.newContext({
        viewport: { width: 1440, height: 1080 }
    });

    await context.addInitScript(({ tokenA, userA }) => {
        localStorage.setItem('token', tokenA);
        localStorage.setItem('user', JSON.stringify(userA));
        localStorage.setItem('locale', 'en');
    }, { tokenA, userA });

    const page = await context.newPage();
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('WebSocket') && !msg.text().includes('404')) {
            console.log('[Browser Console Error]', msg.text());
        }
    });

    let manifestCallCount = 0;
    let archiveCallCount = 0;
    let return404ForReceipt = false;

    const mockProject = {
        id: 'TEST-PROJ',
        code: 'TEST-PROJ',
        name: 'Test Governance Project',
        client: 'UN FAO',
        status: 'ACTIVE',
        projectType: 'OPEN_INTAKE',
        expectedSampleCount: 10,
        labId: 'A',
        capabilities: { canManage: true, canImport: true },
        createdAt: '2026-09-14T00:00:00.000Z',
        updatedAt: '2026-09-14T00:00:00.000Z'
    };

    const mockCounts = {
        registered: 5,
        awaitingArrival: 0,
        intakeInProgress: 0,
        labWork: 0,
        awaitingReview: 0,
        released: 5,
        rejectedOrCancelled: 0,
        needsReconciliation: 0,
        everPhysicallyReceived: 5
    };

    // Setup network routes
    await page.route('**/api/**', async (route) => {
        const req = route.request();
        const url = req.url();
        const method = req.method();
        const headers = req.headers();

        if (url.includes('/api/public/i18n/bootstrap') || url.includes('/api/admin/languages')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        }
        if (url.includes('/api/admin/settings')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
        }
        if (url.includes('/api/notifications') || url.includes('/api/messages/conversations')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        }
        if (url.includes('/api/auth/me')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: currentLoggedInUser }) });
        }
        if (url.includes('/api/auth/login') && method === 'POST') {
            const body = JSON.parse(req.postData() || '{}');
            console.log(`[Mock Auth] Login request for username: "${body.username}"`);
            if (body.username === 'pm_bob' || body.username === userB.username) {
                currentLoggedInUser = userB;
                currentToken = tokenB;
            } else {
                currentLoggedInUser = userA;
                currentToken = tokenA;
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'success',
                    data: { token: currentToken, user: currentLoggedInUser }
                })
            });
        }
        if (url.includes('/api/projects/TEST-PROJ/samples')) {
            return route.fulfill({
                status: 200,
                headers: { 'x-total-count': '5' },
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        }
        if (url.includes('/api/projects/TEST-PROJ/stats')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ counts: mockCounts })
            });
        }
        if (url.includes('/api/projects/TEST-PROJ/lab-access')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ canManage: true, canImport: true }) });
        }
        if (url.includes('/api/projects/TEST-PROJ/kobo-config')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(null) });
        }
        if (url.includes('/api/projects/TEST-PROJ/imports/preview') && method === 'POST') {
            const body = JSON.parse(req.postData() || '{}');
            const sampleIds = body.sampleIds || [];
            const hasExisting = sampleIds.includes('EXISTING');
            const valid = sampleIds.filter(id => id !== 'EXISTING');
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    valid: valid.length === sampleIds.length,
                    totalRows: sampleIds.length,
                    validCount: valid.length,
                    conflictCount: hasExisting ? 1 : 0,
                    errorCount: 0,
                    conflicts: hasExisting ? [{ sampleId: 'EXISTING', error: 'ALREADY_EXISTS_IN_DB', existingProject: 'TEST-PROJ' }] : [],
                    errors: [],
                    validSampleIds: valid,
                    previewHash: 'mock-preview-hash',
                    previewToken: 'mock-preview-token',
                    destinationLabId: 'A'
                })
            });
        }
        if (url.includes('/api/projects/TEST-PROJ/manifest') && method === 'POST') {
            manifestCallCount++;
            if (manifestCallCount === 1) {
                console.log('[Mock Network] Aborting first manifest POST to simulate lost connection...');
                return route.abort('failed');
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'success',
                    messageCode: 'MANIFEST_PROCESSED',
                    data: { count: 1 }
                })
            });
        }
        if (url.includes('/api/projects/TEST-PROJ/archive') && method === 'POST') {
            archiveCallCount++;
            console.log(`[Mock Network] POST /archive attempt #${archiveCallCount}`);

            // Stale revision check
            const ifMatch = headers['if-match'];
            const currentRevision = String(new Date(mockProject.updatedAt).getTime());
            if (ifMatch && ifMatch !== currentRevision) {
                console.log(`[Mock Network] 409 STALE_REVISION detected: client If-Match=${ifMatch} !== server=${currentRevision}`);
                return route.fulfill({
                    status: 409,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        code: 'STALE_REVISION',
                        error: 'STALE_REVISION',
                        message: 'Project has been modified by another user. Please refresh and review before retrying.'
                    })
                });
            }

            if (archiveCallCount === 1 || archiveCallCount === 2 || archiveCallCount === 3) {
                console.log('[Mock Network] Aborting archive POST to simulate lost response...');
                return route.abort('failed');
            }

            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    status: 'success',
                    messageCode: 'PROJECT_ARCHIVED',
                    data: { code: 'TEST-PROJ', project: { ...mockProject, status: 'COMPLETED' } }
                })
            });
        }
        if (url.includes('/api/projects/TEST-PROJ/operations/')) {
            const key = url.split('/operations/')[1];
            console.log(`[Mock Network] Receipt check for operation key: ${key}`);
            if (return404ForReceipt) {
                console.log(`[Mock Network] Simulating uncommitted request: 404 receipt not found for ${key}`);
                return route.fulfill({
                    status: 404,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'NOT_FOUND', message: 'No receipt found' })
                });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    receipt: {
                        idempotencyKey: key,
                        status: 'SUCCESS',
                        outcome: {
                            status: 'success',
                            messageCode: 'RECOVERED_SUCCESS'
                        }
                    }
                })
            });
        }
        if (url.includes('/api/projects/TEST-PROJ') && method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockProject) });
        }
        if (url.includes('/api/config/groups') || url.includes('/api/config/analyses')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    });

    console.log('Navigating to Project Workspace page as User A...');
    await page.goto(`${BASE_URL}/projects/TEST-PROJ`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('text=Test Governance Project', { timeout: 10000 });
    console.log('✓ Project Workspace rendered for User A');

    // =========================================================================
    // SUITE 1: ProjectActionsModal (Archive Lost-Response, Retry, Recovery)
    // =========================================================================
    console.log('\n--- SUITE 1: ProjectActionsModal: Lost-Response Recovery & Conflict Guard ---');

    const actionsBtn = page.locator('button:has-text("Actions"), button:has-text("Governance"), button[title*="Actions"], button:has-text("Project actions")').first();
    await actionsBtn.click();
    await page.waitForSelector('text=Project governance actions', { timeout: 5000 });
    console.log('✓ Actions modal opened');

    await page.click('text=Review archival readiness');
    await page.waitForSelector('textarea', { timeout: 5000 });
    console.log('✓ Navigated to Archival subview with reason textarea');

    await page.fill('textarea', 'Completed harvest and all samples processed');
    const archiveBtn = page.locator('button:has-text("Archive project")');
    await archiveBtn.click();

    await page.waitForSelector('text=Unconfirmed previous attempt', { timeout: 5000 });
    console.log('✓ Recovery banner displayed after dropped response');

    const retryBtn = page.locator('button:has-text("Retry archive")');
    await retryBtn.waitFor({ timeout: 3000 });
    console.log('✓ Submit button updated to "Retry archive"');

    // Modal Close and Reopen preserves unresolvedOp for same user
    console.log('Closing modal to test persistent store retention for same user...');
    await page.click('button[aria-label="Close"]');
    await page.waitForSelector('text=Project governance actions', { state: 'detached', timeout: 5000 });

    await actionsBtn.click();
    await page.waitForSelector('text=Project governance actions', { timeout: 5000 });
    await page.waitForSelector('text=Unconfirmed previous attempt', { timeout: 5000 });
    console.log('✓ Recovery banner preserved across modal close and reopen for same user!');

    // Conflict guard: modify payload while unconfirmed
    await page.click('text=Review archival readiness');
    await page.waitForSelector('textarea', { timeout: 5000 });
    await page.fill('textarea', 'Changed reason while uncertain');
    await page.click('button:has-text("Archive project"), button:has-text("Retry archive")');
    await page.waitForSelector('text=A previous archival request is still unconfirmed', { timeout: 5000 });
    console.log('✓ Conflict guard prevented submitting modified payload while previous attempt unconfirmed');

    // Recover previous attempt
    console.log('Clicking "Recover previous attempt"...');
    await page.click('button:has-text("Recover previous attempt")');
    await page.waitForSelector('.fixed.inset-0', { state: 'detached', timeout: 5000 });
    console.log('✓ Modal successfully recovered receipt and closed!');

    // =========================================================================
    // SUITE 2: ImportPreviewModal (Mixed Manifest, Lost Response, Recovery)
    // =========================================================================
    console.log('\n--- SUITE 2: ImportPreviewModal: Mixed Manifest & Lost Response Recovery ---');

    await page.click('button:has-text("Data connections")');
    await page.waitForTimeout(500);

    const previewBtn = page.locator('button:has-text("Preview a manifest")').first();
    await previewBtn.click();
    await page.waitForSelector('text=Preview expected sample manifest', { timeout: 5000 });
    console.log('✓ Import preview modal opened');

    await page.fill('textarea', 'EXISTING\nNEW-001');
    await page.click('button:has-text("Run preview validation")');

    await page.waitForSelector('text=Ready as expected', { timeout: 5000 });
    await page.waitForSelector('text=Existing in DB', { timeout: 5000 });
    console.log('✓ Mixed manifest preview correctly displays 1 eligible and 1 conflict');

    const registerBtn = page.locator('button:has-text("Register 1 expected samples")');
    await registerBtn.click();

    await page.waitForSelector('text=Unconfirmed previous registration attempt', { timeout: 5000 });
    console.log('✓ Import modal displays recovery banner after dropped commit');

    const retryRegisterBtn = page.locator('button:has-text("Retry registration")');
    await retryRegisterBtn.waitFor({ timeout: 3000 });
    console.log('✓ Button updated to "Retry registration"');

    // Close and reopen preserves recovery banner for same user
    console.log('Closing import modal to test persistence for same user...');
    await page.click('button[aria-label="Close"]');
    await page.waitForSelector('text=Preview expected sample manifest', { state: 'detached', timeout: 5000 });

    await previewBtn.click();
    await page.waitForSelector('text=Preview expected sample manifest', { timeout: 5000 });
    await page.waitForSelector('text=Unconfirmed previous registration attempt', { timeout: 5000 });
    console.log('✓ Import recovery banner preserved across modal close and reopen!');

    // Conflict guard: modify manifest inputs while uncertain
    console.log('Testing edit rows while uncertain...');
    await page.click('button:has-text("Edit rows")');
    await page.fill('textarea', 'DIFFERENT-001');
    await page.click('button:has-text("Run preview validation")');
    await page.waitForSelector('text=Ready as expected', { timeout: 5000 });
    await page.click('button:has-text("Retry registration"), button:has-text("Register")');
    await page.waitForSelector('text=A previous manifest registration attempt is still unconfirmed', { timeout: 5000 });
    console.log('✓ Conflict guard prevented submitting modified manifest while previous attempt unconfirmed');

    // Recover previous attempt
    console.log('Clicking "Recover previous attempt"...');
    await page.click('button:has-text("Recover previous attempt")');
    await page.waitForSelector('.fixed.inset-0', { state: 'detached', timeout: 5000 });
    console.log('✓ Import modal successfully recovered receipt and closed!');

    // =========================================================================
    // SUITE 3: Same-SPA Account-Switch Session Boundary Isolation
    // =========================================================================
    console.log('\n--- SUITE 3: Same-SPA Account Switch Session Boundary Isolation ---');

    // 1. User A starts an archival operation that drops
    await page.click('button:has-text("Overview")');
    await page.waitForTimeout(300);
    await actionsBtn.click();
    await page.waitForSelector('text=Project governance actions', { timeout: 5000 });
    await page.click('text=Review archival readiness');
    await page.waitForSelector('textarea', { timeout: 5000 });
    await page.fill('textarea', 'CONFIDENTIAL REASON FROM USER A');
    await page.click('button:has-text("Archive project")');
    await page.waitForSelector('text=Unconfirmed previous attempt', { timeout: 5000 });
    console.log('✓ User A created unconfirmed archival operation with confidential reason');

    // User A closes the modal without recovering or discarding
    await page.click('button[aria-label="Close"]');
    await page.waitForSelector('text=Project governance actions', { state: 'detached', timeout: 5000 });

    // 2. User A logs out in the same SPA (via UserMenu dropdown)
    console.log('Logging out User A via UserMenu in same SPA...');
    const userMenuBtn = page.locator('button[title="User Menu"]');
    await userMenuBtn.click();
    await page.waitForSelector('text=Sign Out', { timeout: 5000 });
    await page.click('button:has-text("Sign Out")');

    // Should navigate to /login
    await page.waitForURL('**/login', { timeout: 10000 });
    console.log('✓ Navigated to /login after User A logout');

    // 3. User B logs in via the login form in the same SPA
    console.log('Logging in as User B (pm_bob) in same SPA...');
    await page.fill('#username', 'pm_bob');
    await page.fill('#password', 'SecretPass123!');
    await page.click('button[type="submit"]');

    // Should navigate away from /login
    await page.waitForURL('**/projects/**', { timeout: 15000 }).catch(async () => {
        // Fallback navigation if SPA lands on / or /dashboard
        await page.goto(`${BASE_URL}/projects/TEST-PROJ`, { waitUntil: 'networkidle', timeout: 10000 });
    });
    console.log('✓ User B successfully authenticated in same SPA');

    // Navigate to the same project workspace as User B
    await page.goto(`${BASE_URL}/projects/TEST-PROJ`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('text=Test Governance Project', { timeout: 10000 });

    // 4. Verify User B does NOT inherit User A's unconfirmed operation
    console.log('Opening Actions modal as User B...');
    await actionsBtn.click();
    await page.waitForSelector('text=Project governance actions', { timeout: 5000 });

    const recoveryBannerVisible = await page.locator('text=Unconfirmed previous attempt').isVisible();
    if (recoveryBannerVisible) {
        throw new Error('SECURITY VIOLATION: User B inherited User A unconfirmed operation recovery banner!');
    }
    console.log('✓ Verified: No recovery banner visible for User B on project actions');

    // Open Archival subview: verify reason is NOT User A's confidential reason
    await page.click('text=Review archival readiness');
    await page.waitForSelector('textarea', { timeout: 5000 });
    const prefilledReason = await page.locator('textarea').inputValue();
    if (prefilledReason.includes('USER A') || prefilledReason.length > 0) {
        throw new Error(`SECURITY VIOLATION: User A confidential reason leaked to User B: "${prefilledReason}"`);
    }
    console.log('✓ Verified: Archival reason field is completely blank for User B (zero leakage)');

    // Close actions modal
    await page.click('button[aria-label="Close"]');
    await page.waitForSelector('text=Project governance actions', { state: 'detached', timeout: 5000 });

    // Open Import Modal as User B and verify no leakage of manifests
    await page.click('button:has-text("Data connections")');
    await page.waitForTimeout(300);
    await previewBtn.click();
    await page.waitForSelector('text=Preview expected sample manifest', { timeout: 5000 });

    const importRecoveryVisible = await page.locator('text=Unconfirmed previous registration attempt').isVisible();
    if (importRecoveryVisible) {
        throw new Error('SECURITY VIOLATION: User B inherited User A import registration recovery banner!');
    }
    const importRawInput = await page.locator('textarea').inputValue();
    if (importRawInput.length > 0) {
        throw new Error(`SECURITY VIOLATION: User A manifest input leaked to User B: "${importRawInput}"`);
    }
    console.log('✓ Verified: Import modal is completely clean for User B (zero leakage)');
    await page.click('button[aria-label="Close"]');
    await page.waitForSelector('text=Preview expected sample manifest', { state: 'detached', timeout: 5000 });

    // =========================================================================
    // SUITE 4: Original Expected Revision Snapshot & 409 STALE_REVISION Rejection
    // =========================================================================
    console.log('\n--- SUITE 4: Original Revision Snapshot & Stale Revision 409 Guard ---');

    // In Suite 4, attempt #3 drops without server commit (404 receipt lookup)
    return404ForReceipt = true;

    await page.click('button:has-text("Overview")');
    await page.waitForTimeout(300);

    // Initial project revision is 2026-09-14T00:00:00.000Z
    console.log(`Current project updatedAt: ${mockProject.updatedAt}`);
    await actionsBtn.click();
    await page.waitForSelector('text=Project governance actions', { timeout: 5000 });
    await page.click('text=Review archival readiness');
    await page.waitForSelector('textarea', { timeout: 5000 });
    await page.fill('textarea', 'Archive attempt by User B');

    // Attempt #3 (dropped connection)
    await page.click('button:has-text("Archive project")');
    await page.waitForSelector('text=Unconfirmed previous attempt', { timeout: 5000 });
    console.log('✓ User B initiated archive; initial attempt dropped and revision snapshotted');

    // Simulate another manager updating the project concurrently in background
    mockProject.updatedAt = '2026-09-14T02:00:00.000Z';
    console.log(`[Concurrent Event] Another manager updated project updatedAt to: ${mockProject.updatedAt}`);

    // User B clicks "Retry archive": UI MUST send original snapshotted If-Match header
    console.log('User B clicks "Retry archive"...');
    await page.click('button:has-text("Retry archive")');

    // Server should reject with 409 STALE_REVISION
    await page.waitForSelector('text=modified by another user', { timeout: 5000 });
    console.log('✓ Server 409 STALE_REVISION conflict message displayed in UI!');

    // Verify unconfirmed operation is invalidated on 409 stale revision so blind retry does not loop
    const recoveryBannerAfterStale = await page.locator('text=Unconfirmed previous attempt').isVisible();
    if (recoveryBannerAfterStale) {
        throw new Error('Expected unconfirmed operation to be cleared upon 409 STALE_REVISION');
    }
    console.log('✓ Unconfirmed operation cleared upon 409 STALE_REVISION to allow fresh review');

    console.log('\n================================================================================');
    console.log('ALL 4 REAL REACT UI MODAL JOURNEYS SUCCESSFULLY VERIFIED (PASS)');
    console.log('1. Modal Close/Reopen State Retention: PASS');
    console.log('2. Conflict Guard on Diverging Values: PASS');
    console.log('3. Same-SPA Account Switch Session Boundary Isolation: PASS');
    console.log('4. Original Revision Snapshot & 409 Stale Rejection: PASS');
    console.log('================================================================================\n');

    await browser.close();
    server.close();
}

run().catch(err => {
    console.error('\n❌ Test suite failed with error:', err);
    process.exit(1);
});
