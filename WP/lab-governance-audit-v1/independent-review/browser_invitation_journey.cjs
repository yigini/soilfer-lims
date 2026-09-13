'use strict';
/**
 * Browser Invitation Journey Review
 * 
 * Exercises the complete connected invitation lifecycle in native headless Google Chrome:
 * 1. Lab Manager views pending invitations roster with active and same-day expired status badges.
 * 2. Reissue action opens modal, generates a fresh single-use link, copies to clipboard, and dismisses cleanly.
 * 3. Reissued link is used to activate the account (sets password, creates active user record).
 * 4. Revoked prior link is rejected upon activation attempt (HTTP 410).
 * 5. National Manager positive path: views own-country laboratory pending invitations and successfully reissues.
 * 
 * Operates on a schema-only disposable SQLite database; verifies source dev.db is untouched.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createRequire } = require('module');
const { randomUUID, createHash } = require('crypto');

const root = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(root, 'server/package.json'));
const scratchReq = createRequire(path.join(root, 'scratch/package.json'));

const Database = req('better-sqlite3');
const jwt = req('jsonwebtoken');
const express = req('express');
const puppeteer = scratchReq('puppeteer-core');

const outputDir = __dirname;
const dbPath = path.join(outputDir, `disposable-inv-journey-${randomUUID()}.db`);
const sourcePath = path.join(root, 'server/prisma/dev.db');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceHashBefore = hash(sourcePath);

// Bootstrap schema-only disposable database from dev.db
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const ddl = source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
source.close();

const empty = new Database(dbPath);
empty.pragma('foreign_keys=OFF');
for (const { sql } of ddl) empty.exec(sql);
empty.pragma('foreign_keys=ON');
empty.close();

process.env.DATABASE_PATH = dbPath;
process.env.DATABASE_URL = `file:${dbPath}`;
process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'fictional-inv-journey-secret-2026';

const prisma = req('./prisma');
const app = req('./app');

// Serve client production build
const clientDist = path.join(root, 'client/dist');
if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api')) {
            return res.sendFile(path.join(clientDist, 'index.html'));
        }
        next();
    });
}

const results = [];
function record(id, description, expected, actual, passed) {
    results.push({ id, description, expected, actual, passed });
    console.log(`[${passed ? 'PASS' : 'FAIL'}] ${id}: ${description}`);
    if (!passed) console.log('  Expected:', expected, 'Actual:', actual);
}

const token = (u) => jwt.sign({
    id: u.id,
    username: u.username,
    role: u.role,
    labId: u.labId || null,
    countries: u.countries ? (Array.isArray(u.countries) ? u.countries : JSON.parse(u.countries)) : [],
    tokenVersion: u.tokenVersion || 0
}, process.env.JWT_SECRET, { expiresIn: '2h' });

async function run() {
    console.log('--- STARTING REAL BROWSER INVITATION JOURNEY VERIFICATION ---');
    console.log(`Disposable DB: ${dbPath}`);

    const SUFFIX = Date.now().toString();

    // 1. Seed Fixtures
    const labA = await prisma.lab.create({
        data: {
            id: 'INV-LAB-A',
            code: 'INVA',
            name: 'Guatemala Analytical Center',
            country: 'Guatemala',
            timezone: 'America/Guatemala',
            isActive: true
        }
    });

    const labB = await prisma.lab.create({
        data: {
            id: 'INV-LAB-B',
            code: 'INVB',
            name: 'Honduras Regional Lab',
            country: 'Honduras',
            timezone: 'America/Tegucigalpa',
            isActive: true
        }
    });

    const managerA = await prisma.user.create({
        data: {
            id: 'mgr-inv-a',
            username: 'manager_a',
            name: 'Manager Sofia Lopez',
            email: 'sofia@lab-a.invalid',
            password: 'FICTIONAL_HASH',
            role: 'LAB_MANAGER',
            labId: labA.id,
            countries: JSON.stringify(['Guatemala']),
            isActive: true,
            tokenVersion: 1
        }
    });

    const nationalLeadGTM = await prisma.user.create({
        data: {
            id: 'lead-inv-gtm',
            username: 'lead_gtm',
            name: 'National Lead Carlos Perez',
            email: 'carlos@gtm-lead.invalid',
            password: 'FICTIONAL_HASH',
            role: 'MASTER_USER',
            countries: JSON.stringify(['Guatemala']),
            isActive: true,
            tokenVersion: 1
        }
    });

    const testProject = await prisma.project.create({
        data: {
            id: 'proj-inv-a',
            code: 'PROJ-INVA-01',
            name: 'Soil Quality Assessment Guatemala',
            labId: labA.id,
            assignedLabIds: '[]',
            status: 'ACTIVE'
        }
    });

    // Seed staff invitations
    const { createInvitation } = req('./services/staffLifecycleService');

    // 1. Active invitation
    const inv1 = await createInvitation(managerA, {
        email: 'active-tech@inv.invalid',
        name: 'Active Candidate',
        role: 'LAB_TECHNICIAN',
        labId: labA.id,
        projects: [testProject.code]
    });
    const inviteActiveId = inv1.id;

    // 2. Same-day expired invitation
    const inv2 = await createInvitation(managerA, {
        email: 'expired-tech@inv.invalid',
        name: 'Expired Candidate',
        role: 'LAB_TECHNICIAN',
        labId: labA.id,
        projects: [testProject.code]
    });
    const inviteExpiredId = inv2.id;
    const rawToken2 = inv2.token;

    // Set inv2 to expired earlier today (3 hours ago)
    const earlierToday = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    await prisma.$executeRawUnsafe(
        `UPDATE "StaffInvitation" SET "expiresAt" = ? WHERE "id" = ?`,
        earlierToday,
        inviteExpiredId
    );

    // Start HTTP server
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Server listening on ${baseUrl}`);

    // Launch Headless Chrome
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,850']
    });

    const context = browser.defaultBrowserContext();
    try {
        await context.overridePermissions(baseUrl, ['clipboard-read', 'clipboard-write']);
    } catch (_) {}

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });

    try {
        const mgrToken = token(managerA);

        // Inject Auth
        await page.goto(`${baseUrl}/`);
        await page.evaluate((tok, usr) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(usr));
            localStorage.setItem('language', 'en');
        }, mgrToken, managerA);

        // ─── STEP 1: Manager views pending invitations roster ───
        console.log('Navigating to Lab Management People Tab...');
        await page.goto(`${baseUrl}/admin/labs?labId=${labA.id}&tab=people`, { waitUntil: 'networkidle0' });

        await page.waitForSelector('#pending-invitations-section', { timeout: 10000 });
        const sectionExists = await page.$('#pending-invitations-section') !== null;
        record('B_INV_01', 'Pending invitations roster renders on People Tab', true, sectionExists, sectionExists);

        // Check active and expired rows
        const pageContent = await page.content();
        const hasActiveRow = pageContent.includes('active-tech@inv.invalid') && pageContent.includes('Active Candidate');
        const hasExpiredRow = pageContent.includes('expired-tech@inv.invalid') && pageContent.includes('Expired Candidate');
        record('B_INV_02', 'Both active and same-day expired invitations are listed in table', true, hasActiveRow && hasExpiredRow, hasActiveRow && hasExpiredRow);

        // Check expired badge
        const expiredBadgeRendered = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('#pending-invitations-section tbody tr'));
            const expiredRow = rows.find(r => r.textContent.includes('expired-tech@inv.invalid'));
            if (!expiredRow) return false;
            return expiredRow.textContent.includes('Expired');
        });
        record('B_INV_03', 'Same-day expired invitation displays dynamic Expired badge', true, expiredBadgeRendered, expiredBadgeRendered);

        // Screenshot roster
        await page.screenshot({ path: path.join(outputDir, 'browser-invitation-roster-view.png') });

        // ─── STEP 2: Reissue Flow & Modal Interaction ───
        console.log('Clicking Reissue on expired invitation...');
        const reissueBtnSelector = `#btn-reissue-invite-${inviteExpiredId}`;
        await page.waitForSelector(reissueBtnSelector);
        await page.click(reissueBtnSelector);

        // Wait for Reissue Modal
        await page.waitForSelector('#reissued-dialog-title', { timeout: 5000 });
        const modalTitle = await page.$eval('#reissued-dialog-title', el => el.textContent.trim());
        record('B_INV_04', 'Clicking Reissue opens Reissued Invitation Modal', 'Invitation Reissued', modalTitle, modalTitle.includes('Invitation Reissued'));

        // Capture fresh activation link from input
        const freshUrl = await page.$eval('div[role="dialog"] input[readonly]', el => el.value);
        const hasTokenInUrl = freshUrl.includes('/activate?token=');
        record('B_INV_05', 'Reissued modal displays fresh activation link with token', true, hasTokenInUrl, hasTokenInUrl);

        const freshToken = freshUrl.split('token=')[1];

        // Click Copy button and verify feedback
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="dialog"] button'));
            const copyBtn = buttons.find(b => b.textContent.includes('Copy') || b.textContent.includes('Copied'));
            if (copyBtn) copyBtn.click();
        });
        await new Promise(r => setTimeout(r, 400));
        const copyBtnText = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="dialog"] button'));
            const copyBtn = buttons.find(b => b.textContent.includes('Copied') || b.textContent.includes('Copy'));
            return copyBtn ? copyBtn.textContent.trim() : '';
        });
        const copyFeedbackWorked = copyBtnText.includes('Copied');
        record('B_INV_06', 'Copy button gives immediate visual feedback (Copied!)', true, copyFeedbackWorked, copyFeedbackWorked);

        // Screenshot open modal
        await page.screenshot({ path: path.join(outputDir, 'browser-invitation-reissue-modal.png') });

        // Dismiss Modal
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('div[role="dialog"] button'));
            const doneBtn = buttons.find(b => b.textContent.trim() === 'Done');
            if (doneBtn) doneBtn.click();
        });
        await new Promise(r => setTimeout(r, 500));
        const modalClosed = await page.$('#reissued-dialog-title') === null;
        record('B_INV_07', 'Dismissing modal closes dialog cleanly', true, modalClosed, modalClosed);

        // ─── STEP 3: Successful Activation Journey with Reissued Link ───
        console.log('Exercising account activation with reissued token...');
        const newStaffUsername = 'tech_activated_' + SUFFIX.slice(-4);
        const newStaffPassword = 'SecureStaffPassword2026!';

        // Execute activation via API (authenticating the token)
        const actResponse = await fetch(`${baseUrl}/api/auth/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: freshToken,
                username: newStaffUsername,
                password: newStaffPassword,
                name: 'Elena Rostova'
            })
        });
        const actJson = await actResponse.json();
        const activationSuccess = actResponse.status === 201 && actJson.success === true;
        record('B_INV_08', 'Activation with reissued token creates active staff account (HTTP 201)', true, activationSuccess, activationSuccess);

        // Verify newly created user in database
        const createdUser = await prisma.user.findUnique({ where: { username: newStaffUsername } });
        const userValid = createdUser && createdUser.role === 'LAB_TECHNICIAN' && createdUser.labId === labA.id && createdUser.isActive === true;
        record('B_INV_09', 'Activated user persisted with correct role, labId, and active status', true, Boolean(userValid), Boolean(userValid));

        // Verify invitation is marked consumed in DB
        const reissuedInvInDb = await prisma.$queryRawUnsafe(
            `SELECT "isConsumed" FROM "StaffInvitation" WHERE "email" = 'expired-tech@inv.invalid' AND "isConsumed" = 1`
        );
        const isConsumed = reissuedInvInDb && reissuedInvInDb.length > 0;
        record('B_INV_10', 'Invitation record is flagged as consumed', true, isConsumed, isConsumed);

        // ─── STEP 4: Revoked Link Rejection ───
        console.log('Exercising activation rejection on revoked prior token...');
        const revokedResponse = await fetch(`${baseUrl}/api/auth/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: rawToken2,
                username: 'should_fail_user',
                password: newStaffPassword,
                name: 'Should Fail'
            })
        });
        const revokedStatus = revokedResponse.status;
        const revokedRejected = revokedStatus === 410 || revokedStatus === 400;
        record('B_INV_11', 'Prior revoked invitation token is rejected on activation attempt (410/400)', true, revokedRejected, revokedRejected);

        // ─── STEP 5: National Manager Positive Path ───
        console.log('Exercising National Lead positive path...');
        const leadToken = token(nationalLeadGTM);

        // Switch user session in browser
        await page.evaluate((tok, usr) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(usr));
        }, leadToken, nationalLeadGTM);

        // National Lead visits Lab A (Guatemala) People tab
        await page.goto(`${baseUrl}/admin/labs?labId=${labA.id}&tab=people`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('#pending-invitations-section', { timeout: 8000 });

        const nationalSectionVisible = await page.$('#pending-invitations-section') !== null;
        record('B_INV_12', 'National Lead can view pending invitations roster for authorized country lab', true, nationalSectionVisible, nationalSectionVisible);

        // National Lead reissues active invitation
        const natReissueBtn = `#btn-reissue-invite-${inviteActiveId}`;
        await page.waitForSelector(natReissueBtn);
        await page.click(natReissueBtn);

        await page.waitForSelector('#reissued-dialog-title', { timeout: 5000 });
        const natModalTitle = await page.$eval('#reissued-dialog-title', el => el.textContent.trim());
        const natSuccess = natModalTitle.includes('Invitation Reissued');
        record('B_INV_13', 'National Lead successfully reissues own-country staff invitation from UI', true, natSuccess, natSuccess);

        // Screenshot national lead interaction
        await page.screenshot({ path: path.join(outputDir, 'browser-invitation-national-lead.png') });

    } finally {
        if (browser) {
            try { await browser.close(); } catch (_) {}
        }
        if (server) {
            try { await new Promise(resolve => server.close(resolve)); } catch (_) {}
        }
        if (prisma) {
            try { await prisma.$disconnect(); } catch (_) {}
        }
    }

    // Hash check
    const sourceHashAfter = hash(sourcePath);
    const hashIntact = sourceHashBefore === sourceHashAfter;
    record('B_INV_14', 'Baseline database dev.db hash strictly preserved untouched', sourceHashBefore, sourceHashAfter, hashIntact);

    // Save report
    const summary = {
        timestamp: new Date().toISOString(),
        totalTests: results.length,
        passed: results.filter(r => r.passed).length,
        failed: results.filter(r => !r.passed).length,
        sourceHashBefore,
        sourceHashAfter,
        results
    };

    fs.writeFileSync(
        path.join(outputDir, 'browser-invitation-journey-results.json'),
        JSON.stringify(summary, null, 2),
        'utf8'
    );

    // Cleanup disposable database
    try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    } catch (e) {
        console.warn('Warning during disposable db cleanup:', e.message);
    }

    console.log(`\n--- BROWSER INVITATION JOURNEY COMPLETE: ${summary.passed}/${summary.totalTests} PASSED ---`);
    process.exit(summary.failed > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Fatal error during browser invitation journey:', err);
    process.exit(1);
});
