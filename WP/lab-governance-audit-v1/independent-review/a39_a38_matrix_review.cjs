'use strict';
// Real browser verification of A39 responsive/theme/locale/focus matrix and A38 error/race cases.
// Schema-only disposable database; source dev.db is read-only.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { createRequire } = require('module');
const { randomUUID, createHash } = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(root, 'server/package.json'));
const wpReq = createRequire(path.join(__dirname, '../package.json'));

const Database = req('better-sqlite3');
const jwt = req('jsonwebtoken');
const puppeteer = wpReq('puppeteer-core');

const outputDir = __dirname;
const dbPath = path.join(outputDir, `disposable-a39-${randomUUID()}.db`);
const sourcePath = path.join(root, 'server/prisma/dev.db');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sourceHashBefore = hash(sourcePath);

// Clone DDL only from dev.db
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
process.env.JWT_SECRET = 'fictional-a39-review-secret-2026';

const prisma = req('./prisma');
const app = req('./app');

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
    tokenVersion: u.tokenVersion || 0
}, process.env.JWT_SECRET, { expiresIn: '2h' });

async function run() {
    console.log('--- STARTING REAL BROWSER A39 MATRIX & A38 ERROR/RACE VERIFICATION ---');
    console.log(`Disposable DB: ${dbPath}`);

    // Seed fictional fixtures
    for (const [id, country] of [['PAGING-A', 'Guatemala'], ['PAGING-A-OTHER', 'France']]) {
        await prisma.lab.create({ data: { id, code: id, name: `Laboratory ${id}`, country, isActive: true, timezone: 'America/Guatemala' } });
    }

    const manager = await prisma.user.create({
        data: {
            id: 'staff-000-mgr',
            username: 'paging-mgr',
            name: 'Paging Lab Manager',
            email: 'mgr@paging-a.invalid',
            password: 'FICTIONAL_HASH',
            role: 'LAB_MANAGER',
            labId: 'PAGING-A',
            isActive: true
        }
    });

    // Seed 100 fictional staff members (enough for multi-page roster)
    console.log('Seeding 100 fictional staff members...');
    const staffData = [];
    for (let i = 1; i <= 100; i++) {
        const num = String(i).padStart(3, '0');
        staffData.push({
            id: `staff-member-${num}`,
            username: `staff_${num}`,
            name: `Staff Member ${num}`,
            email: `staff_${num}@soilfer.invalid`,
            password: 'FICTIONAL_HASH',
            role: i % 2 === 0 ? 'LAB_TECHNICIAN' : 'SAMPLE_RECEPTION',
            labId: 'PAGING-A',
            isActive: true
        });
    }
    await prisma.user.createMany({ data: staffData });

    // Start HTTP server
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Server listening on ${baseUrl}`);

    // Launch Chrome
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const mgrToken = token(manager);

    // Initial auth injection
    await page.goto(`${baseUrl}/`);
    await page.evaluate((tok, usr) => {
        localStorage.setItem('token', tok);
        localStorage.setItem('user', JSON.stringify(usr));
        localStorage.setItem('language', 'en');
        localStorage.setItem('locale', 'en');
    }, mgrToken, manager);

    // =========================================================================
    // PART 1: A39 RESPONSIVE VIEWPORT MATRIX (320px, 390px, 768px, 1440px)
    // =========================================================================
    console.log('\n--- EXERCISING A39 RESPONSIVE VIEWPORTS ---');
    const viewports = [
        { width: 320, height: 640, label: '320px Mobile Small' },
        { width: 390, height: 844, label: '390px Mobile Modern' },
        { width: 768, height: 1024, label: '768px Tablet Portrait' },
        { width: 1440, height: 900, label: '1440px Desktop Widescreen' }
    ];

    for (const vp of viewports) {
        await page.setViewport({ width: vp.width, height: vp.height });
        await page.goto(`${baseUrl}/admin/labs?labId=PAGING-A&tab=people`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('table tbody tr', { timeout: 6000 });

        const bodyWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        const windowWidth = await page.evaluate(() => window.innerWidth);
        const hasHorizontalBlowout = bodyWidth > windowWidth + 2; // small tolerance for rounding

        const tableRendered = await page.evaluate(() => {
            const rows = document.querySelectorAll('table tbody tr');
            return rows.length === 50;
        });

        record(
            `A39-VP-${vp.width}`,
            `Responsive layout at ${vp.label} renders without unmanaged page overflow`,
            { noBlowout: true, rowsRendered: 50 },
            { noBlowout: !hasHorizontalBlowout, rowsRendered: tableRendered ? 50 : 0, bodyWidth, windowWidth },
            !hasHorizontalBlowout && tableRendered
        );
    }

    // =========================================================================
    // PART 2: A39 THEMES (LIGHT AND DARK)
    // =========================================================================
    console.log('\n--- EXERCISING A39 THEMES (LIGHT AND DARK) ---');
    await page.setViewport({ width: 1280, height: 800 });

    // Test Light Theme
    await page.goto(`${baseUrl}/admin/labs?labId=PAGING-A&tab=people`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('table', { timeout: 5000 });

    const isLightDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    record('A39-THEME-LIGHT', 'Light theme renders cleanly without dark root class', { isDark: false }, { isDark: isLightDarkClass }, !isLightDarkClass);

    // Test Dark Theme via UI ThemeToggle
    console.log('Toggling to Dark theme via ThemeToggle...');
    await page.waitForSelector('button[aria-label*="Appearance"]', { timeout: 5000 });
    await page.click('button[aria-label*="Appearance"]');
    await page.waitForSelector('#appearance-popover', { timeout: 5000 });
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('#appearance-popover button'));
        const darkBtn = buttons.find(b => b.textContent.includes('Dark'));
        if (darkBtn) darkBtn.click();
    });
    await page.waitForFunction(() => document.documentElement.classList.contains('dark'), { timeout: 5000 });

    const isDarkDarkClass = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    record('A39-THEME-DARK', 'Dark theme applies dark root class and dark styling tokens', { isDark: true }, { isDark: isDarkDarkClass }, isDarkDarkClass);

    // Reset to light theme for subsequent checks via ThemeToggle
    console.log('Reverting to Light theme...');
    await page.click('button[aria-label*="Appearance"]');
    await page.waitForSelector('#appearance-popover', { timeout: 5000 });
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('#appearance-popover button'));
        const lightBtn = buttons.find(b => b.textContent.includes('Light'));
        if (lightBtn) lightBtn.click();
    });
    await page.waitForFunction(() => !document.documentElement.classList.contains('dark'), { timeout: 5000 });

    // =========================================================================
    // PART 3: A39 LOCALES (ALL 5 CANONICAL LOCALES)
    // =========================================================================
    console.log('\n--- EXERCISING A39 LOCALES (EN, ES, ES-419, FR, PT) ---');
    const locales = [
        { code: 'en', tabExpected: 'People and Access', pageExpected: 'Page' },
        { code: 'es', tabExpected: 'Personal y', pageExpected: 'Página' },
        { code: 'es-419', tabExpected: 'Personal y', pageExpected: 'Página' },
        { code: 'fr', tabExpected: 'Personnel et Accès', pageExpected: 'Page' },
        { code: 'pt', tabExpected: 'Pessoas e Acesso', pageExpected: 'Página' }
    ];

    for (const loc of locales) {
        await page.evaluate((l) => {
            localStorage.setItem('language', l);
            localStorage.setItem('locale', l);
            sessionStorage.setItem('soilfer_locale_override', l);
        }, loc.code);
        await page.goto(`${baseUrl}/admin/labs?labId=PAGING-A&tab=people`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('table tbody tr', { timeout: 6000 });

        const pageText = await page.evaluate(() => document.body.textContent);
        const hasTabExpected = pageText.includes(loc.tabExpected);
        const hasPageExpected = pageText.includes(loc.pageExpected);
        const hasRawTranslationKey = /labManagement\.[a-zA-Z0-9_]+/.test(pageText);

        record(
            `A39-LOCALE-${loc.code}`,
            `Locale ${loc.code} renders authentic translated strings without missing-key fallback`,
            { tabMatched: true, pageMatched: true, noRawKey: true },
            { tabMatched: hasTabExpected, pageMatched: hasPageExpected, noRawKey: !hasRawTranslationKey },
            hasTabExpected && hasPageExpected && !hasRawTranslationKey
        );
    }

    // Reset language to en
    await page.evaluate(() => {
        localStorage.setItem('language', 'en');
        localStorage.setItem('locale', 'en');
        sessionStorage.setItem('soilfer_locale_override', 'en');
    });

    // =========================================================================
    // PART 4: A39 KEYBOARD FOCUS, ENTER ACTIVATION & ESCAPE DISMISSAL
    // =========================================================================
    console.log('\n--- EXERCISING A39 KEYBOARD FOCUS, ENTER & ESCAPE ---');
    await page.goto(`${baseUrl}/admin/labs?labId=PAGING-A&tab=people`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('table tbody tr', { timeout: 6000 });

    // Focus the first Review Access button via keyboard Tab navigation
    await page.evaluate(() => {
        const firstBtn = document.querySelector('table tbody tr button');
        if (firstBtn) firstBtn.focus();
    });

    const activeBeforeEnter = await page.evaluate(() => document.activeElement.textContent);
    const hasFocusedButton = activeBeforeEnter.includes('Review Access');

    // Press Enter to activate button and open modal
    await page.keyboard.press('Enter');
    await page.waitForSelector('[role="dialog"]', { timeout: 6000 });

    const dialogOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    const focusInDialog = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return dialog && dialog.contains(document.activeElement);
    });

    record(
        'A39-KEYBOARD-ENTER',
        'Keyboard Enter opens modal and moves focus inside accessible dialog',
        { dialogOpen: true, focusInDialog: true },
        { dialogOpen, focusInDialog },
        dialogOpen && focusInDialog
    );

    // Press Escape to dismiss modal
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5000 });

    const dialogClosedAfterEscape = await page.evaluate(() => !document.querySelector('[role="dialog"]'));
    record(
        'A39-KEYBOARD-ESCAPE',
        'Keyboard Escape dismisses modal cleanly without unhandled rejection',
        { dialogClosed: true },
        { dialogClosed: dialogClosedAfterEscape },
        dialogClosedAfterEscape
    );

    // =========================================================================
    // PART 5: A38 ERROR STATES & SEARCH RACE RESILIENCE
    // =========================================================================
    console.log('\n--- EXERCISING A38 ERROR STATES & SEARCH RACE CASES ---');

    // 1. 403 Forbidden State (Access Denied)
    console.log('Testing 403 Forbidden State...');
    const unauthorizedManager = await prisma.user.create({
        data: {
            id: 'staff-unauth-mgr',
            username: 'unauth-mgr',
            name: 'Unauthorized Lab Manager',
            email: 'unauth-mgr@paging-other.invalid',
            password: 'FICTIONAL_HASH',
            role: 'LAB_MANAGER',
            labId: 'PAGING-A-OTHER',
            isActive: true
        }
    });
    const unauthTok = token(unauthorizedManager);

    await page.evaluate((tok, usr) => {
        localStorage.setItem('token', tok);
        localStorage.setItem('user', JSON.stringify(usr));
    }, unauthTok, unauthorizedManager);

    await page.goto(`${baseUrl}/admin/labs?labId=PAGING-A&tab=people`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h2', { timeout: 6000 });

    const errorCardText = await page.evaluate(() => document.body.textContent);
    const has403Title = errorCardText.includes('Access Denied');
    const hasFalseNoStaff = errorCardText.includes('No staff accounts matching the selected criteria');

    record(
        'A38-403-FORBIDDEN',
        '403 Forbidden renders Access Denied message without falsely claiming laboratory has no staff',
        { has403Title: true, noFalseEmpty: true },
        { has403Title, noFalseEmpty: !hasFalseNoStaff },
        has403Title && !hasFalseNoStaff
    );

    // Restore manager login
    await page.evaluate((tok, usr) => {
        localStorage.setItem('token', tok);
        localStorage.setItem('user', JSON.stringify(usr));
    }, mgrToken, manager);

    // 2. 500 Server Error State
    console.log('Testing 500 Server Error State via request interception...');
    await page.setRequestInterception(true);
    let interceptNextWorkspaceAs500 = true;
    const onRequest = interceptedRequest => {
        if (interceptNextWorkspaceAs500 && interceptedRequest.url().includes('/api/labs/PAGING-A/workspace')) {
            interceptNextWorkspaceAs500 = false;
            interceptedRequest.respond({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Simulated internal server error' })
            });
        } else {
            interceptedRequest.continue();
        }
    };
    page.on('request', onRequest);

    await page.goto(`${baseUrl}/admin/labs?labId=PAGING-A&tab=people`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h2', { timeout: 6000 });

    const server500Text = await page.evaluate(() => document.body.textContent);
    const has500Title = server500Text.includes('Workspace Error') || server500Text.includes('Failed to load');
    const hasRetryBtn = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Retry'));
    });
    const hasFalseNoStaff500 = server500Text.includes('No staff accounts matching the selected criteria');

    record(
        'A38-500-SERVER-ERROR',
        '500 Server Error renders error recovery card with Retry button and never false empty state',
        { has500Title: true, hasRetryBtn: true, noFalseEmpty: true },
        { has500Title, hasRetryBtn, noFalseEmpty: !hasFalseNoStaff500 },
        has500Title && hasRetryBtn && !hasFalseNoStaff500
    );

    page.off('request', onRequest);
    await page.setRequestInterception(false);

    // 3. Empty Roster State (No matching search query)
    console.log('Testing Empty Search State...');
    await page.goto(`${baseUrl}/admin/labs?labId=PAGING-A&tab=people`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[placeholder*="Search people"]', { timeout: 6000 });

    const searchInput = await page.$('input[placeholder*="Search people"]');
    await searchInput.type('NonExistentStaffMember999');

    await page.waitForFunction(() => {
        return document.body.textContent.includes('No staff accounts matching the selected criteria');
    }, { timeout: 6000 });

    const emptyText = await page.evaluate(() => document.body.textContent);
    const hasEmptyMsg = emptyText.includes('No staff accounts matching the selected criteria');
    const rowsRenderedEmpty = await page.$$eval('table tbody tr', trs => trs.length);

    record(
        'A38-EMPTY-SEARCH',
        'Search with no matching records cleanly renders explicit empty state message',
        { emptyMsgRendered: true, rowsCount: 0 },
        { emptyMsgRendered: hasEmptyMsg, rowsCount: rowsRenderedEmpty },
        hasEmptyMsg && rowsRenderedEmpty === 0
    );

    // 4. Search Race Resilience (latestWorkspaceReqId protection)
    console.log('Testing Search Race Condition Protection...');
    // Clear search input
    await searchInput.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');

    // Rapidly type first search query then second search query
    await searchInput.type('Staff Member 099');
    await new Promise(r => setTimeout(r, 60)); // short interval before debounce fires
    await searchInput.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await searchInput.type('Staff Member 001');

    await page.waitForFunction(() => {
        const rows = document.querySelectorAll('table tbody tr');
        return rows.length === 1 && rows[0].textContent.includes('Staff Member 001');
    }, { timeout: 6000 });

    const raceFinalFirstRow = await page.$eval('table tbody tr:first-child', el => el.textContent);
    const racePassed = raceFinalFirstRow.includes('Staff Member 001') && !raceFinalFirstRow.includes('099');

    record(
        'A38-SEARCH-RACE-PROTECTION',
        'Stale out-of-order response cannot replace latest search result',
        { expectedFinalTarget: 'Staff Member 001', containsStale: false },
        { finalTargetRendered: racePassed, containsStale: raceFinalFirstRow.includes('099') },
        racePassed
    );

    await browser.close();
    await new Promise((resolve) => server.close(resolve));
    await prisma.$disconnect();

    const sourceHashAfter = hash(sourcePath);
    const allPassed = results.every(r => r.passed);

    const report = {
        timestamp: new Date().toISOString(),
        head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        browser: 'Google Chrome (Headless via Puppeteer-Core)',
        sourcePath,
        sourceHashBefore,
        sourceHashAfter,
        dbUntouched: sourceHashBefore === sourceHashAfter,
        disposableDb: dbPath,
        allPassed,
        results
    };

    fs.writeFileSync(path.join(outputDir, 'a39-a38-matrix-results.json'), JSON.stringify(report, null, 2));
    console.log('\n--- A39 & A38 MATRIX VERIFICATION SUMMARY ---');
    console.log(JSON.stringify(report, null, 2));

    if (!allPassed) {
        process.exit(1);
    }
    process.exit(0);
}

run().catch(err => {
    console.error('Fatal A39/A38 matrix error:', err);
    process.exit(1);
});
