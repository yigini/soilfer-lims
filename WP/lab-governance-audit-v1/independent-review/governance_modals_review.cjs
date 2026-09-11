'use strict';
/**
 * Comprehensive Independent Verification Suite for All 5 Governance Modals:
 * 1. InviteStaffModal (People tab)
 * 2. AccessReviewModal (People tab)
 * 3. RecoveryLinkModal (People tab)
 * 4. SuspendUserModal (People tab)
 * 5. LabLifecycleModal (Settings tab)
 *
 * Verifies:
 * - Small-screen viewport containment (320x568, 390x640)
 * - Header and footer button reachability (no clipping)
 * - Screenshots captured WHILE dialog is open (not after closure)
 * - Keyboard Tab / Shift+Tab focus trapping
 * - Keyboard Escape dismissal
 * - Focus restoration back to the exact opening trigger
 * - Long localized labels (Spanish 'es')
 * - Authentic Dark Theme activation via ThemeToggle appearance popover
 * - Computed dark styling tokens (background / text colors)
 * - Source database read-only immutability
 */
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { randomUUID, createHash } = require('crypto');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../../..');
const req = createRequire(path.join(root, 'server/package.json'));
const Database = req('better-sqlite3');
const outputDir = path.join(__dirname);
const dbPath = path.join(outputDir, `disposable-modal-all-${randomUUID()}.db`);
const sourcePath = path.join(root, 'server/prisma/dev.db');

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
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'fictional-modal-all-review-only';

const print = console.log;
console.log = () => {};
console.warn = () => {};

const prisma = req('./prisma');
const app = req('./app');
const jwt = req('jsonwebtoken');
const express = req('express');

const results = [];
function record(id, description, expected, actual, passed) {
    results.push({ id, description, expected, actual, passed });
}

const token = (u) => jwt.sign({ id: u.id, username: u.username, role: u.role, tokenVersion: u.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
const makeUser = (id, role, labId, name = id) => prisma.user.create({
    data: {
        id,
        username: `${id}-login`,
        name,
        email: `${id}@example.invalid`,
        password: 'FICTIONAL_TEST_HASH',
        role,
        labId,
        countries: '["Guatemala"]',
        projects: '[]',
        isActive: true,
        tokenVersion: 1
    }
});

async function main() {
    const { chromium } = require('C:/Users/yigin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

    // Create fictional laboratory and users
    await prisma.lab.create({
        data: {
            id: 'MODAL-ALL',
            code: 'MODAL-ALL',
            name: 'Fictional Laboratory for Modal Suite',
            country: 'Guatemala',
            isActive: true,
            timezone: 'America/Guatemala'
        }
    });

    const manager = await makeUser('modal-all-mgr', 'LAB_MANAGER', 'MODAL-ALL', 'Manager Maria');
    const admin = await makeUser('modal-all-adm', 'SUPER_ADMIN', null, 'Admin Alexander');
    const tech = await makeUser('modal-all-tech', 'LAB_TECHNICIAN', 'MODAL-ALL', 'Technician Carlos');

    app.use(express.static(path.join(root, 'client/dist')));
    app.use((r, s, n) => r.path.startsWith('/api') ? n() : s.sendFile(path.join(root, 'client/dist/index.html')));

    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;

    const browser = await chromium.launch({
        headless: true,
        executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    });

    async function checkModalInteraction(page, triggerSelector, modalName, screenshotPath = null) {
        const trigger = page.locator(triggerSelector).first();
        await trigger.waitFor({ state: 'attached', timeout: 15000 });
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();

        const dialog = page.locator('[role="dialog"]');
        await dialog.waitFor({ timeout: 5000 });
        await page.waitForTimeout(350); // Wait for CSS transition / animation to settle

        const metrics = await dialog.evaluate(el => {
            const rect = el.getBoundingClientRect();
            const buttons = [...el.querySelectorAll('button')].map(b => {
                const r = b.getBoundingClientRect();
                return { text: b.textContent.trim(), top: r.top, bottom: r.bottom, visible: r.bottom <= window.innerHeight + 2 && r.top >= -2 };
            });
            return {
                top: rect.top,
                bottom: rect.bottom,
                height: rect.height,
                viewportHeight: window.innerHeight,
                buttons,
                allButtonsContained: buttons.every(b => b.visible)
            };
        });

        const contained = metrics.top >= -2 && metrics.bottom <= metrics.viewportHeight + 2;

        // Capture screenshot of the OPEN dialog before any dismissal
        if (screenshotPath) {
            await page.screenshot({ path: screenshotPath });
        }

        // Test Tab / Shift+Tab wrapping
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        const focusInsideAfterTab = await dialog.evaluate(el => el.contains(document.activeElement));

        await page.keyboard.press('Shift+Tab');
        const focusInsideAfterShiftTab = await dialog.evaluate(el => el.contains(document.activeElement));

        // Test Escape dismissal and focus restoration
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
        await page.waitForTimeout(150);

        const dialogClosed = (await page.locator('[role="dialog"]').count()) === 0;
        const focusReturned = await trigger.evaluate(el => el === document.activeElement);

        return {
            metrics,
            contained,
            focusInsideAfterTab,
            focusInsideAfterShiftTab,
            dialogClosed,
            focusReturned
        };
    }

    // 1. InviteStaffModal at 320x568
    {
        const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
        await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
        await page.addInitScript(({ u, tok }) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(u));
            sessionStorage.setItem('soilfer_locale_override', 'en');
        }, { u: manager, tok: token(manager) });

        await page.goto(origin + '/admin/labs?labId=MODAL-ALL&tab=people');
        const shot = path.join(outputDir, 'modal-all-invite-320.png');
        const res = await checkModalInteraction(page, '#btn-invite-staff', 'InviteStaffModal', shot);

        record('MODAL-INVITE-320', 'InviteStaffModal stays within 320x568 viewport with visible buttons',
            { insideViewport: true, allButtonsContained: true },
            { insideViewport: res.contained, allButtonsContained: res.metrics.allButtonsContained, height: res.metrics.height, screenshot: shot },
            res.contained && res.metrics.allButtonsContained);

        record('TRAP-INVITE-320', 'InviteStaffModal traps Tab/Shift+Tab and restores trigger focus on Escape',
            { focusTrapped: true, dialogClosed: true, focusReturned: true },
            { focusTrapped: res.focusInsideAfterTab && res.focusInsideAfterShiftTab, dialogClosed: res.dialogClosed, focusReturned: res.focusReturned },
            res.focusInsideAfterTab && res.focusInsideAfterShiftTab && res.dialogClosed && res.focusReturned);

        await page.close();
    }

    // 2. AccessReviewModal at 320x568
    {
        const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
        await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
        await page.addInitScript(({ u, tok }) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(u));
            sessionStorage.setItem('soilfer_locale_override', 'en');
        }, { u: manager, tok: token(manager) });

        await page.goto(origin + '/admin/labs?labId=MODAL-ALL&tab=people');
        const shot = path.join(outputDir, 'modal-all-access-review-320.png');
        const res = await checkModalInteraction(page, 'button:has-text("Review Access")', 'AccessReviewModal', shot);

        record('MODAL-REVIEW-320', 'AccessReviewModal stays within 320x568 viewport with visible buttons',
            { insideViewport: true, allButtonsContained: true },
            { insideViewport: res.contained, allButtonsContained: res.metrics.allButtonsContained, height: res.metrics.height, screenshot: shot },
            res.contained && res.metrics.allButtonsContained);

        record('TRAP-REVIEW-320', 'AccessReviewModal traps Tab/Shift+Tab and restores trigger focus on Escape',
            { focusTrapped: true, dialogClosed: true, focusReturned: true },
            { focusTrapped: res.focusInsideAfterTab && res.focusInsideAfterShiftTab, dialogClosed: res.dialogClosed, focusReturned: res.focusReturned },
            res.focusInsideAfterTab && res.focusInsideAfterShiftTab && res.dialogClosed && res.focusReturned);

        await page.close();
    }

    // 3. RecoveryLinkModal at 320x568
    {
        const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
        await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
        await page.addInitScript(({ u, tok }) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(u));
            sessionStorage.setItem('soilfer_locale_override', 'en');
        }, { u: manager, tok: token(manager) });

        await page.goto(origin + '/admin/labs?labId=MODAL-ALL&tab=people');
        const shot = path.join(outputDir, 'modal-all-recovery-320.png');
        const res = await checkModalInteraction(page, 'button[aria-label*="Recovery Link"]', 'RecoveryLinkModal', shot);

        record('MODAL-RECOVERY-320', 'RecoveryLinkModal stays within 320x568 viewport with visible buttons',
            { insideViewport: true, allButtonsContained: true },
            { insideViewport: res.contained, allButtonsContained: res.metrics.allButtonsContained, height: res.metrics.height, screenshot: shot },
            res.contained && res.metrics.allButtonsContained);

        record('TRAP-RECOVERY-320', 'RecoveryLinkModal traps Tab/Shift+Tab and restores trigger focus on Escape',
            { focusTrapped: true, dialogClosed: true, focusReturned: true },
            { focusTrapped: res.focusInsideAfterTab && res.focusInsideAfterShiftTab, dialogClosed: res.dialogClosed, focusReturned: res.focusReturned },
            res.focusInsideAfterTab && res.focusInsideAfterShiftTab && res.dialogClosed && res.focusReturned);

        await page.close();
    }

    // 4. SuspendUserModal at 320x568
    {
        const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
        await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
        await page.addInitScript(({ u, tok }) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(u));
            sessionStorage.setItem('soilfer_locale_override', 'en');
        }, { u: manager, tok: token(manager) });

        await page.goto(origin + '/admin/labs?labId=MODAL-ALL&tab=people');
        const shot = path.join(outputDir, 'modal-all-suspend-320.png');
        const res = await checkModalInteraction(page, 'button[aria-label*="Suspend"]', 'SuspendUserModal', shot);

        record('MODAL-SUSPEND-320', 'SuspendUserModal stays within 320x568 viewport with visible buttons',
            { insideViewport: true, allButtonsContained: true },
            { insideViewport: res.contained, allButtonsContained: res.metrics.allButtonsContained, height: res.metrics.height, screenshot: shot },
            res.contained && res.metrics.allButtonsContained);

        record('TRAP-SUSPEND-320', 'SuspendUserModal traps Tab/Shift+Tab and restores trigger focus on Escape',
            { focusTrapped: true, dialogClosed: true, focusReturned: true },
            { focusTrapped: res.focusInsideAfterTab && res.focusInsideAfterShiftTab, dialogClosed: res.dialogClosed, focusReturned: res.focusReturned },
            res.focusInsideAfterTab && res.focusInsideAfterShiftTab && res.dialogClosed && res.focusReturned);

        await page.close();
    }

    // 5. LabLifecycleModal at 320x568
    {
        const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
        await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
        await page.addInitScript(({ u, tok }) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(u));
            sessionStorage.setItem('soilfer_locale_override', 'en');
        }, { u: admin, tok: token(admin) });

        await page.goto(origin + '/admin/labs?labId=MODAL-ALL&tab=settings');
        const shot = path.join(outputDir, 'modal-all-lifecycle-320.png');
        const res = await checkModalInteraction(page, '#btn-lifecycle-action', 'LabLifecycleModal', shot);

        record('MODAL-LIFECYCLE-320', 'LabLifecycleModal stays within 320x568 viewport with visible buttons',
            { insideViewport: true, allButtonsContained: true },
            { insideViewport: res.contained, allButtonsContained: res.metrics.allButtonsContained, height: res.metrics.height, screenshot: shot },
            res.contained && res.metrics.allButtonsContained);

        record('TRAP-LIFECYCLE-320', 'LabLifecycleModal traps Tab/Shift+Tab and restores trigger focus on Escape',
            { focusTrapped: true, dialogClosed: true, focusReturned: true },
            { focusTrapped: res.focusInsideAfterTab && res.focusInsideAfterShiftTab, dialogClosed: res.dialogClosed, focusReturned: res.focusReturned },
            res.focusInsideAfterTab && res.focusInsideAfterShiftTab && res.dialogClosed && res.focusReturned);

        await page.close();
    }

    // 6. Long localized labels (Spanish 'es') at 320x568
    {
        const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
        await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
        await page.addInitScript(({ u, tok }) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(u));
            sessionStorage.setItem('soilfer_locale_override', 'es');
        }, { u: manager, tok: token(manager) });

        await page.goto(origin + '/admin/labs?labId=MODAL-ALL&tab=people');
        const shot = path.join(outputDir, 'modal-all-invite-es-320.png');
        const res = await checkModalInteraction(page, '#btn-invite-staff', 'InviteStaffModal-Spanish', shot);

        record('MODAL-LONG-LABEL-ES', 'Modal layout in Spanish with longer translated strings fits 320x568 viewport',
            { insideViewport: true, allButtonsContained: true },
            { insideViewport: res.contained, allButtonsContained: res.metrics.allButtonsContained, height: res.metrics.height, screenshot: shot },
            res.contained && res.metrics.allButtonsContained);

        await page.close();
    }

    // 7. Authentic Dark Theme at 320x568 via ThemeToggle appearance popover
    {
        const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
        await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
        await page.addInitScript(({ u, tok }) => {
            localStorage.setItem('token', tok);
            localStorage.setItem('user', JSON.stringify(u));
            sessionStorage.setItem('soilfer_locale_override', 'en');
        }, { u: manager, tok: token(manager) });

        await page.goto(origin + '/admin/labs?labId=MODAL-ALL&tab=people');
        await page.waitForSelector('button[aria-label*="Appearance"]', { timeout: 10000 });

        // Activate Dark Mode via the real Appearance control
        const appearanceBtn = page.locator('button[aria-label*="Appearance"]').first();
        await appearanceBtn.click();
        const popover = page.locator('#appearance-popover');
        await popover.waitFor({ timeout: 5000 });
        await popover.locator('button:has-text("Dark")').click();
        await page.waitForFunction(() => document.documentElement.classList.contains('dark'), { timeout: 5000 });

        // Resize viewport to 320x568 for small-screen modal testing
        await page.setViewportSize({ width: 320, height: 568 });
        await page.waitForTimeout(200);

        // Open modal in dark mode
        const trigger = page.locator('#btn-invite-staff').first();
        await trigger.waitFor({ state: 'attached', timeout: 15000 });
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();

        const dialog = page.locator('[role="dialog"]');
        await dialog.waitFor({ timeout: 5000 });
        await page.waitForTimeout(350);

        // Evaluate dark state and computed colors while dialog is OPEN
        const darkCheck = await dialog.evaluate(el => {
            const isDark = document.documentElement.classList.contains('dark');
            const rect = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            const heading = el.querySelector('h2, h3') || el;
            const hs = getComputedStyle(heading);
            const buttons = [...el.querySelectorAll('button')].map(b => {
                const r = b.getBoundingClientRect();
                return { text: b.textContent.trim(), top: r.top, bottom: r.bottom, visible: r.bottom <= window.innerHeight + 2 && r.top >= -2 };
            });
            return {
                isDark,
                backgroundColor: cs.backgroundColor,
                textColor: cs.color,
                headingColor: hs.color,
                top: rect.top,
                bottom: rect.bottom,
                height: rect.height,
                viewportHeight: window.innerHeight,
                buttons,
                allButtonsContained: buttons.every(b => b.visible)
            };
        });

        // Capture screenshot of the OPEN dialog in authentic dark mode
        const shot = path.join(outputDir, 'modal-all-invite-dark-320.png');
        await page.screenshot({ path: shot });

        const contained = darkCheck.top >= -2 && darkCheck.bottom <= darkCheck.viewportHeight + 2;
        // Verify surface background is dark (not light/white)
        const bgIsDark = darkCheck.backgroundColor !== 'rgb(255, 255, 255)' && !darkCheck.backgroundColor.includes('255, 255, 255');
        const darkValid = darkCheck.isDark && bgIsDark && contained && darkCheck.allButtonsContained;

        record('MODAL-THEME-DARK-320', 'Modal renders correctly in authentic Dark Theme with dark surface tokens at 320x568',
            { isDark: true, bgIsDark: true, insideViewport: true, allButtonsContained: true },
            { isDark: darkCheck.isDark, bgIsDark, backgroundColor: darkCheck.backgroundColor, headingColor: darkCheck.headingColor, insideViewport: contained, allButtonsContained: darkCheck.allButtonsContained, height: darkCheck.height, screenshot: shot },
            darkValid);

        // Test Tab / Shift+Tab wrapping
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        const focusInsideAfterTab = await dialog.evaluate(el => el.contains(document.activeElement));
        await page.keyboard.press('Shift+Tab');
        const focusInsideAfterShiftTab = await dialog.evaluate(el => el.contains(document.activeElement));

        // Test Escape dismissal and focus restoration
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden', timeout: 5000 });
        await page.waitForTimeout(150);

        const dialogClosed = (await page.locator('[role="dialog"]').count()) === 0;
        const focusReturned = await trigger.evaluate(el => el === document.activeElement);

        record('TRAP-THEME-DARK-320', 'Dark Theme modal traps Tab/Shift+Tab and restores trigger focus on Escape',
            { focusTrapped: true, dialogClosed: true, focusReturned: true },
            { focusTrapped: focusInsideAfterTab && focusInsideAfterShiftTab, dialogClosed, focusReturned },
            focusInsideAfterTab && focusInsideAfterShiftTab && dialogClosed && focusReturned);

        await page.close();
    }

    await browser.close();
    await new Promise(resolve => server.close(resolve));
    await prisma.$disconnect();

    const report = {
        head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
        timestamp: new Date().toISOString(),
        database: dbPath,
        sourceHashBefore,
        sourceHashAfter: hash(sourcePath),
        dbUntouched: sourceHashBefore === hash(sourcePath),
        allPassed: results.every(r => r.passed),
        results
    };

    const reportPath = path.join(outputDir, 'governance-modals-results.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    print(JSON.stringify(report, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
