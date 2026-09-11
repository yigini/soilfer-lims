'use strict';
// Real browser verification of workspace paging, server-side search, navigation, and foreign-scope controls.
// Fictional fixtures only; schema-only disposable database; source dev.db is read-only.
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
const dbPath = path.join(outputDir, `disposable-browser-${randomUUID()}.db`);
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
process.env.JWT_SECRET = 'fictional-browser-review-secret-2026';

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
    console.log('--- STARTING REAL BROWSER PAGING & WORKSPACE VERIFICATION ---');
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

    // Seed 205 fictional staff members
    console.log('Seeding 205 fictional staff members...');
    const staffData = [];
    for (let i = 1; i <= 204; i++) {
        const num = String(i).padStart(3, '0');
        if (i === 145) {
            staffData.push({
                id: `staff-member-${num}`,
                username: 'zoe-laterperson',
                name: 'Zoe LaterPerson',
                email: 'zoe145@soilfer.invalid',
                password: 'FICTIONAL_HASH',
                role: 'LAB_TECHNICIAN',
                labId: 'PAGING-A',
                isActive: true
            });
        } else {
            staffData.push({
                id: `staff-member-${num}`,
                username: `staff_${num}`,
                name: `Staff Member ${num}`,
                email: `staff_${num}@soilfer.invalid`,
                password: 'FICTIONAL_HASH',
                role: i % 3 === 0 ? 'LAB_TECHNICIAN' : i % 3 === 1 ? 'SAMPLE_RECEPTION' : 'AUDIT_USER',
                labId: 'PAGING-A',
                isActive: true
            });
        }
    }
    await prisma.user.createMany({ data: staffData });

    // Seed projects: 1 foreign project, 1 valid shared project, and 205 local projects
    console.log('Seeding fictional projects...');
    await prisma.project.create({
        data: {
            id: 'proj-00-foreign',
            code: 'PAGING-00-FOREIGN',
            name: 'Foreign Project In Other Lab',
            labId: 'PAGING-A-OTHER',
            assignedLabIds: '["PAGING-A-OTHER"]',
            status: 'ACTIVE'
        }
    });

    await prisma.project.create({
        data: {
            id: 'proj-00-valid',
            code: 'PAGING-00-VALID',
            name: 'Valid Shared Project For Lab A',
            labId: 'PAGING-A-OTHER',
            assignedLabIds: '["PAGING-A"]',
            status: 'ACTIVE'
        }
    });

    const projectData = [];
    for (let i = 0; i < 205; i++) {
        const num = String(i).padStart(3, '0');
        projectData.push({
            id: `proj-own-${num}`,
            code: `PAGING-OWN-${num}`,
            name: `Local Research Batch ${num}`,
            labId: 'PAGING-A',
            assignedLabIds: '[]',
            status: 'ACTIVE'
        });
    }
    await prisma.project.createMany({ data: projectData });

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
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const mgrToken = token(manager);

    // Inject Auth before loading app
    await page.goto(`${baseUrl}/`);
    await page.evaluate((tok, usr) => {
        localStorage.setItem('token', tok);
        localStorage.setItem('user', JSON.stringify(usr));
        localStorage.setItem('language', 'en');
    }, mgrToken, manager);

    // 1. Navigate to Lab Management Workspace
    console.log('Navigating to workspace...');
    await page.goto(`${baseUrl}/admin/labs?labId=PAGING-A&tab=overview`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h1');
    const headerText = await page.$eval('h1', el => el.textContent);
    record('B01', 'Workspace loads with authentic Lab Manager role', { contains: 'Laboratory PAGING-A' }, { actual: headerText }, headerText.includes('Laboratory PAGING-A'));

    // 2. Click People & Access tab
    console.log('Navigating to People & Access tab...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const peopleBtn = buttons.find(b => b.textContent.includes('People'));
        if (peopleBtn) peopleBtn.click();
    });

    await page.waitForSelector('table tbody tr', { timeout: 5000 });
    const page1Rows = await page.$$eval('table tbody tr', trs => trs.length);
    const page1Text = await page.$eval('table tbody', el => el.textContent);
    const page1HasTarget = page1Text.includes('Zoe LaterPerson');

    record('B02', 'People tab bounded to first 50 staff rows on Page 1', { rowCount: 50, targetPresent: false }, { rowCount: page1Rows, targetPresent: page1HasTarget }, page1Rows === 50 && !page1HasTarget);

    // Verify pagination controls render on Page 1
    const paginationText = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span'));
        const pageSpan = spans.find(s => s.textContent.includes('Page') && s.textContent.includes('of'));
        return pageSpan ? pageSpan.textContent : '';
    });
    record('B03', 'Staff pagination indicator reports accurate total pages', { contains: 'Page 1 of 5' }, { actual: paginationText }, paginationText.includes('1 of 5'));

    // 3. Navigate to Page 2
    console.log('Navigating to Page 2 of staff roster...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(b => b.textContent.includes('Next'));
        if (nextBtn) nextBtn.click();
    });

    await page.waitForFunction(() => {
        const tr = document.querySelector('table tbody tr:first-child');
        const span = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('Page') && s.textContent.includes('of'));
        return span && span.textContent.includes('2 of 5') && tr && !tr.textContent.includes('000') && !tr.textContent.includes('001') && (tr.textContent.includes('050') || tr.textContent.includes('049'));
    }, { timeout: 8000 });

    const page2Rows = await page.$$eval('table tbody tr', trs => trs.length);
    const page2FirstMember = await page.$eval('table tbody tr:first-child', el => el.textContent);
    record('B04', 'Page 2 navigates and displays staff accounts beyond index 50', { rowCount: 50, containsBeyond50: true }, { rowCount: page2Rows, firstMember: page2FirstMember }, page2Rows === 50 && (page2FirstMember.includes('050') || page2FirstMember.includes('049')));

    // 4. Server-Side Search for Zoe LaterPerson (index 145, normally on Page 3)
    console.log('Testing server-side search for later-page person (Zoe LaterPerson, index 145)...');
    const searchInput = await page.$('input[placeholder*="Search people"]');
    await searchInput.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await searchInput.type('Zoe LaterPerson');

    await page.waitForFunction(() => {
        const trs = document.querySelectorAll('table tbody tr');
        return trs.length === 1 && trs[0].textContent.includes('Zoe LaterPerson');
    }, { timeout: 6000 });

    const searchRows = await page.$$eval('table tbody tr', trs => trs.length);
    const foundTargetText = await page.$eval('table tbody tr', el => el.textContent);

    record('B05', 'Server-side search locates staff on later pages without local memory cutoff', { rowCount: 1, targetFound: true }, { rowCount: searchRows, targetFound: foundTargetText.includes('Zoe LaterPerson') }, searchRows === 1 && foundTargetText.includes('Zoe LaterPerson'));

    // 5. Open Management Modal (Review Access) for Zoe LaterPerson
    console.log('Exercising Review Access action modal for later-page person...');
    await page.evaluate(() => {
        const reviewBtn = Array.from(document.querySelectorAll('table tbody tr button')).find(b => b.textContent.includes('Review Access'));
        if (reviewBtn) reviewBtn.click();
    });

    await page.waitForSelector('[role="dialog"]', { timeout: 6000 });
    const modalContent = await page.$eval('[role="dialog"]', el => el.textContent);
    record('B06', 'Management modal successfully binds and manages later-page person', { modalOpened: true, targetInModal: true }, { modalOpened: true, targetInModal: modalContent.includes('Zoe LaterPerson') || modalContent.includes('zoe-laterperson') }, modalContent.includes('Zoe LaterPerson') || modalContent.includes('zoe-laterperson'));

    // Close modal
    await page.evaluate(() => {
        const closeButtons = Array.from(document.querySelectorAll('[role="dialog"] button'));
        const closeBtn = closeButtons.find(b => b.textContent.includes('Cancel') || b.textContent.includes('Close')) || closeButtons[0];
        if (closeBtn) closeBtn.click();
    });
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5000 });

    // Clear search
    await searchInput.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');

    // 6. Switch to Projects tab & verify Foreign-Scope Negative Control + Shared Scope Positive Control
    console.log('Navigating to Projects tab...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const projBtn = buttons.find(b => b.textContent.includes('Projects'));
        if (projBtn) projBtn.click();
    });

    await page.waitForFunction(() => {
        return document.querySelector('div.grid') !== null;
    }, { timeout: 5000 });

    const projectsPageText = await page.$eval('div.grid', el => el.textContent);
    const foreignProjectRendered = projectsPageText.includes('PAGING-00-FOREIGN');
    const validSharedProjectRendered = projectsPageText.includes('PAGING-00-VALID');

    record('B07', 'Foreign-scope negative control: PAGING-00-FOREIGN is NOT rendered', { foreignVisible: false }, { foreignVisible: foreignProjectRendered }, !foreignProjectRendered);
    record('B08', 'Shared project positive control: PAGING-00-VALID is rendered', { validVisible: true }, { validVisible: validSharedProjectRendered }, validSharedProjectRendered);

    // 7. Verify Project Pagination Toolbar
    const projectPaginationText = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll('span'));
        const pageSpan = spans.find(s => s.textContent.includes('Page') && s.textContent.includes('of'));
        return pageSpan ? pageSpan.textContent : '';
    });
    record('B09', 'Projects collection is bounded and reports pagination (Page 1 of 11)', { contains: '1 of 11' }, { actual: projectPaginationText }, projectPaginationText.includes('1 of 11'));

    // 8. Navigate to Page 2 of projects
    console.log('Navigating to Page 2 of projects...');
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const nextBtn = buttons.find(b => b.textContent.includes('Next'));
        if (nextBtn) nextBtn.click();
    });

    await page.waitForFunction(() => {
        const span = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('Page') && s.textContent.includes('of'));
        return span && span.textContent.includes('2 of 11');
    }, { timeout: 5000 });

    const page2ProjectSpan = await page.evaluate(() => {
        const span = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('Page') && s.textContent.includes('of'));
        return span ? span.textContent : '';
    });
    record('B10', 'Project page 2 navigates and renders subsequent project batches', { contains: '2 of 11' }, { actual: page2ProjectSpan }, page2ProjectSpan.includes('2 of 11'));

    // Capture visual screenshot proof
    const screenshotPath = path.join(outputDir, 'browser-paging-evidence.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Saved browser screenshot evidence to ${screenshotPath}`);

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
        screenshot: screenshotPath,
        allPassed,
        results
    };

    fs.writeFileSync(path.join(outputDir, 'browser-paging-results.json'), JSON.stringify(report, null, 2));
    console.log('\n--- BROWSER VERIFICATION SUMMARY ---');
    console.log(JSON.stringify(report, null, 2));

    if (!allPassed) {
        process.exit(1);
    }
    process.exit(0);
}

run().catch(err => {
    console.error('Fatal browser test error:', err);
    process.exit(1);
});
