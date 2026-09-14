const { chromium } = require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const jwt = require('c:/Users/yigin/Documents/LIMSI/server/node_modules/jsonwebtoken');
const path = require('path');
const fs = require('fs');
const http = require('http');

const JWT_SECRET = '6baec08f7a8162bb0bc5d34c93bb6a5ac4dd647be867ea4da0d837e788d82365';
const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

function startStaticServer(port = PORT) {
    const distDir = path.resolve('C:/Users/yigin/Documents/soilfer-lims/client/dist');
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
        server.listen(port, () => {
            console.log(`Static server running on http://localhost:${port}`);
            resolve(server);
        });
    });
}

async function run() {
    console.log('--- Starting Real UI React Modal Verification ---');
    const server = await startStaticServer();

    const browser = await chromium.launch({
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: true,
        args: ['--ignore-certificate-errors', '--no-sandbox']
    });

    const token = jwt.sign(
        { id: 'admin', username: 'admin', role: 'SUPER_ADMIN', tokenVersion: 1 },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    const userObj = {
        id: 'admin',
        username: 'admin',
        name: 'System Admin',
        role: 'SUPER_ADMIN',
        labId: 'A',
        isActive: true,
        tokenVersion: 1
    };

    const context = await browser.newContext({
        viewport: { width: 1440, height: 1080 }
    });

    await context.addInitScript(({ token, userObj }) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userObj));
        localStorage.setItem('locale', 'en');
    }, { token, userObj });

    const page = await context.newPage();
    page.on('console', msg => {
        if (msg.type() === 'error' && !msg.text().includes('WebSocket')) console.log('[Browser Console Error]', msg.text());
    });

    let manifestCallCount = 0;
    let archiveCallCount = 0;

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
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: userObj }) });
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
                console.log('[Mock Network] Aborting first manifest POST to simulate dropped connection...');
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
            if (archiveCallCount === 1) {
                console.log('[Mock Network] Aborting first archive POST to simulate dropped connection...');
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

    console.log('Navigating to Project Workspace page...');
    await page.goto(`${BASE_URL}/projects/TEST-PROJ`, { waitUntil: 'networkidle', timeout: 30000 });

    // Verify workspace loaded
    await page.waitForSelector('text=Test Governance Project', { timeout: 10000 });
    console.log('✓ Project Workspace rendered');

    // =========================================================================
    // TEST SUITE 1: ProjectActionsModal (Archive Lost-Response, Retry, Recovery)
    // =========================================================================
    console.log('\n--- 1. Testing ProjectActionsModal: Lost-Response Recovery ---');

    // Open Actions Modal
    const actionsBtn = page.locator('button:has-text("Actions"), button:has-text("Governance"), button[title*="Actions"], button:has-text("Project actions")').first();
    await actionsBtn.click();
    await page.waitForSelector('text=Project governance actions', { timeout: 5000 });
    console.log('✓ Actions modal opened');

    // Click "Review archival readiness"
    await page.click('text=Review archival readiness');
    await page.waitForSelector('textarea', { timeout: 5000 });
    console.log('✓ Navigated to Archival subview with reason textarea');

    // Fill archive reason
    await page.fill('textarea', 'Completed harvest and all samples processed');

    // First attempt: network dropped
    const archiveBtn = page.locator('button:has-text("Archive project")');
    await archiveBtn.click();

    // Verify error message and recovery banner appear
    await page.waitForSelector('text=Unconfirmed previous attempt', { timeout: 5000 });
    console.log('✓ Recovery banner displayed after dropped response');

    // Verify retry button label
    const retryBtn = page.locator('button:has-text("Retry archive")');
    await retryBtn.waitFor({ timeout: 3000 });
    console.log('✓ Submit button updated to "Retry archive"');

    // Test: Modal Close and Reopen preserves unresolvedOp
    console.log('Closing modal to test persistent store retention...');
    await page.click('button[aria-label="Close"]');
    await page.waitForSelector('text=Project governance actions', { state: 'detached', timeout: 5000 });

    // Reopen modal
    await actionsBtn.click();
    await page.waitForSelector('text=Project governance actions', { timeout: 5000 });
    // Verify recovery banner is STILL visible on menu view!
    await page.waitForSelector('text=Unconfirmed previous attempt', { timeout: 5000 });
    console.log('✓ Recovery banner preserved across modal close and reopen!');

    // Test: Navigate to Archive subview, edit reason while uncertain -> should show conflict warning
    await page.click('text=Review archival readiness');
    await page.waitForSelector('textarea', { timeout: 5000 });
    await page.fill('textarea', 'Changed reason while uncertain');
    await page.click('button:has-text("Archive project"), button:has-text("Retry archive")');
    await page.waitForSelector('text=A previous archival request is still unconfirmed', { timeout: 5000 });
    console.log('✓ Conflict guard prevented submitting modified payload while previous attempt unconfirmed');

    // Test: Click "Recover previous attempt"
    console.log('Clicking "Recover previous attempt"...');
    await page.click('button:has-text("Recover previous attempt")');
    // Modal should resolve receipt and close automatically!
    await page.waitForSelector('.fixed.inset-0', { state: 'detached', timeout: 5000 });
    console.log('✓ Modal successfully recovered receipt and closed!');

    // =========================================================================
    // TEST SUITE 2: ImportPreviewModal (Mixed Manifest, Lost Response, Retry)
    // =========================================================================
    console.log('\n--- 2. Testing ImportPreviewModal: Mixed Manifest & Lost Response ---');

    // Switch to Data Connections tab
    await page.click('button:has-text("Data connections")');
    await page.waitForTimeout(500);

    // Open Import Preview Modal via "Preview a manifest"
    const previewBtn = page.locator('button:has-text("Preview a manifest")').first();
    await previewBtn.click();
    await page.waitForSelector('text=Preview expected sample manifest', { timeout: 5000 });
    console.log('✓ Import preview modal opened');

    // Enter mixed manifest: 1 existing ID, 1 valid new ID
    await page.fill('textarea', 'EXISTING\nNEW-001');
    await page.click('button:has-text("Run preview validation")');

    // Verify preview outcome report table
    await page.waitForSelector('text=Ready as expected', { timeout: 5000 });
    await page.waitForSelector('text=Existing in DB', { timeout: 5000 });
    console.log('✓ Mixed manifest preview correctly displays 1 eligible and 1 conflict');

    // First commit attempt: network dropped
    const registerBtn = page.locator('button:has-text("Register 1 expected samples")');
    await registerBtn.click();

    // Verify error and recovery banner
    await page.waitForSelector('text=Unconfirmed previous registration attempt', { timeout: 5000 });
    console.log('✓ Import modal displays recovery banner after dropped commit');

    const retryRegisterBtn = page.locator('button:has-text("Retry registration")');
    await retryRegisterBtn.waitFor({ timeout: 3000 });
    console.log('✓ Button updated to "Retry registration"');

    // Test: Close and reopen modal preserves recovery banner
    console.log('Closing import modal to test persistence...');
    await page.click('button[aria-label="Close"]');
    await page.waitForSelector('text=Preview expected sample manifest', { state: 'detached', timeout: 5000 });

    await previewBtn.click();
    await page.waitForSelector('text=Preview expected sample manifest', { timeout: 5000 });
    await page.waitForSelector('text=Unconfirmed previous registration attempt', { timeout: 5000 });
    console.log('✓ Import recovery banner preserved across modal close and reopen!');

    // Test: Edit rows while uncertain -> should trigger conflict warning if IDs changed
    console.log('Testing edit rows while uncertain...');
    await page.click('button:has-text("Edit rows")');
    await page.fill('textarea', 'DIFFERENT-001');
    await page.click('button:has-text("Run preview validation")');
    await page.waitForSelector('text=Ready as expected', { timeout: 5000 });
    await page.click('button:has-text("Retry registration"), button:has-text("Register")');
    await page.waitForSelector('text=A previous manifest registration attempt is still unconfirmed', { timeout: 5000 });
    console.log('✓ Conflict guard prevented submitting modified manifest while previous attempt unconfirmed');

    // Test: Click "Recover previous attempt"
    console.log('Clicking "Recover previous attempt"...');
    await page.click('button:has-text("Recover previous attempt")');
    await page.waitForSelector('.fixed.inset-0', { state: 'detached', timeout: 5000 });
    console.log('✓ Import modal successfully recovered receipt and closed!');

    console.log('\n======================================================');
    console.log('ALL REAL REACT MODAL JOURNEYS INDEPENDENTLY VERIFIED PASS!');
    console.log('======================================================\n');

    await browser.close();
    server.close();
}

run().catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
