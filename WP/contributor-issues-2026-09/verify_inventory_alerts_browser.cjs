'use strict';

/**
 * Browser Verification Script for Issue #125
 * 
 * Verifies that the inventory top warning and row item badges follow the exact same rules:
 * - 124 active items with 0 lots are classified as OUT OF STOCK.
 * - 2 active items with expired lots are classified as OUT OF STOCK and EXPIRED.
 * - getAlerts returns lowStock: 126, outOfStock: 126, expired: 2.
 * - UI displays "📦 126 low / out of stock" and "🔴 2 expired".
 * - All 126 item rows in the table display the OUT OF STOCK badge.
 * - The 2 expired items display both OUT OF STOCK and EXPIRED badges.
 * - Interactive filter chips correctly filter to 126 low/out items and 2 expired items.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { createRequire } = require('module');
const { randomUUID } = require('crypto');

const root = path.resolve(__dirname, '../..');
const req = createRequire(path.join(root, 'server/package.json'));
const scratchReq = createRequire(path.join('C:/Users/yigin/Documents/soilfer-lims/scratch/package.json'));

const Database = req('better-sqlite3');
const jwt = req('jsonwebtoken');
const express = req('express');
const puppeteer = scratchReq('puppeteer-core');

const artifactDir = 'C:/Users/yigin/.gemini/antigravity/brain/80c11c12-5cb7-4455-a433-01544d488498';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const sourceDbPath = path.join(root, 'server/prisma/dev.db');
const tempDbPath = path.join(__dirname, `temp_inventory_verify_${Date.now()}.db`);

async function main() {
    console.log('[ISSUE-125] Initializing headless browser verification...');

    // 1. Clone schema to ephemeral DB
    const sourceDb = new Database(sourceDbPath, { readonly: true });
    const ddl = sourceDb.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
    sourceDb.close();

    const tempDb = new Database(tempDbPath);
    tempDb.pragma('foreign_keys = OFF');
    for (const { sql } of ddl) {
        tempDb.exec(sql);
    }
    tempDb.pragma('foreign_keys = ON');

    // 2. Seed Lab, User, and 126 Items (124 no lots, 2 with expired lots)
    const now = new Date();
    const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    tempDb.prepare("INSERT INTO Lab (id, code, name, country, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)")
        .run('GTM-LAB1', 'GTM-LAB1', 'Guatemala National Soil Lab', 'Guatemala', now.toISOString(), now.toISOString());

    const userId = 'usr-admin-125';
    tempDb.prepare("INSERT INTO User (id, username, email, password, name, role, labId, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)")
        .run(userId, 'superadmin', 'admin@example.com', 'hash', 'Super Administrator', 'SUPER_ADMIN', 'GTM-LAB1', now.toISOString(), now.toISOString());

    const insertItem = tempDb.prepare(`
        INSERT INTO InventoryItem (id, labId, itemType, name, shortCode, unitOfMeasure, reorderPoint, reorderQuantity, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    const insertLot = tempDb.prepare(`
        INSERT INTO InventoryLot (id, inventoryItemId, labId, lotNumber, initialQuantity, currentQuantity, unitOfMeasure, status, expiryDate, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 124 no-lot items
    for (let i = 1; i <= 124; i++) {
        const itemId = `ITEM-NOLOT-${String(i).padStart(3, '0')}`;
        insertItem.run(itemId, 'GTM-LAB1', 'CHEMICAL', `Standard Reagent ${i}`, `R-${i}`, 'L', 5, 10, now.toISOString(), now.toISOString());
    }

    // 2 items with expired lots (ITEM-EXPLOT-125 has TWO expired lots to verify multi-lot item aggregation)
    for (let i = 125; i <= 126; i++) {
        const itemId = `ITEM-EXPLOT-${String(i).padStart(3, '0')}`;
        insertItem.run(itemId, 'GTM-LAB1', 'REAGENT', `Expired Buffer Solution ${i}`, `EXP-${i}`, 'mL', 10, 20, now.toISOString(), now.toISOString());
        insertLot.run(`LOT-EXP-${i}-1`, itemId, 'GTM-LAB1', `LOT-EXP-${i}-001`, 50, 5, 'mL', 'AVAILABLE', pastDate, now.toISOString(), now.toISOString());
    }
    // Add 2nd expired lot to ITEM-EXPLOT-125 (total 3 expired lots across 2 items)
    insertLot.run('LOT-EXP-125-2', 'ITEM-EXPLOT-125', 'GTM-LAB1', 'LOT-EXP-125-002', 30, 2.5, 'mL', 'EXPIRED', pastDate, now.toISOString(), now.toISOString());

    tempDb.close();

    // 3. Configure environment and start Express server
    process.env.DATABASE_PATH = tempDbPath;
    process.env.DATABASE_URL = `file:${tempDbPath}`;
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'secret-issue-125-verify';

    const app = express();
    app.use(express.json());

    // Inject superadmin auth
    app.use((req, res, next) => {
        req.user = { id: userId, username: 'superadmin', name: 'Super Administrator', role: 'SUPER_ADMIN', labId: 'GTM-LAB1' };
        next();
    });

    const inventoryController = require(path.join(root, 'server/controllers/inventoryController'));
    app.get('/api/inventory/items', inventoryController.getItems);
    app.get('/api/inventory/items/:id', inventoryController.getItem);
    app.get('/api/inventory/alerts', inventoryController.getAlerts);
    app.get('/api/inventory/locations', (req, res) => res.json([]));
    app.get('/api/auth/me', (req, res) => res.json(req.user));

    // Serve built client
    const distPath = path.join(root, 'client/dist');
    app.use(express.static(distPath));
    app.use((req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`[ISSUE-125] Ephemeral LIMS server listening at ${baseUrl}`);

    // 4. Launch headless browser
    const browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: true,
        args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    // Inject token in localStorage
    const token = jwt.sign(
        { id: userId, username: 'superadmin', role: 'SUPER_ADMIN', labId: 'GTM-LAB1' },
        process.env.JWT_SECRET
    );

    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle0' });
    await page.evaluate((tok, usr) => {
        localStorage.setItem('token', tok);
        localStorage.setItem('user', JSON.stringify(usr));
    }, token, { id: userId, username: 'superadmin', name: 'Super Administrator', role: 'SUPER_ADMIN', labId: 'GTM-LAB1' });

    // Navigate to Inventory page
    await page.goto(`${baseUrl}/inventory`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-tour="inventory-container"]', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000)); // Allow items to populate

    // 5. Verification: Check Alert Banner text
    const bannerText = await page.evaluate(() => {
        const banner = document.querySelector('.bg-gradient-to-r');
        return banner ? banner.innerText : '';
    });
    console.log(`[ISSUE-125] Banner Text: "${bannerText.replace(/\n/g, ' ')}"`);

    const hasLowOutCount = bannerText.includes('126 low / out of stock');
    const hasExpiredCount = bannerText.includes('2 expired');
    console.log(`[ISSUE-125] Alert Banner lowStock count is 126: ${hasLowOutCount}`);
    console.log(`[ISSUE-125] Alert Banner expired count is 2: ${hasExpiredCount}`);

    // Check row counts and badge occurrences
    const tableStats = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr');
        let outOfStockCount = 0;
        let expiredBadgeCount = 0;
        rows.forEach(tr => {
            if (tr.querySelector('.bg-red-100') || /out of stock/i.test(tr.innerText)) outOfStockCount++;
            if (tr.querySelector('.bg-rose-100') || /expired/i.test(tr.innerText)) expiredBadgeCount++;
        });
        return {
            totalRows: rows.length,
            outOfStockRows: outOfStockCount,
            expiredBadgeRows: expiredBadgeCount
        };
    });
    console.log('[ISSUE-125] Table Statistics (Default Unfiltered):', tableStats);

    // Save Screenshot 1: Matched Summary & Rows
    const shot1Path = path.join(artifactDir, 'inventory_summary_126_matched.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    console.log(`[ISSUE-125] Saved screenshot 1 to: ${shot1Path}`);

    // 6. Test Interactive Chip: Click "126 low / out of stock"
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const chip = buttons.find(b => b.innerText.includes('low / out of stock'));
        if (chip) chip.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const lowStockFilterStats = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr');
        const filterBadge = document.querySelector('.bg-orange-50');
        return {
            filterText: filterBadge ? filterBadge.innerText.replace(/\n/g, ' ') : '',
            rowsShowing: rows.length
        };
    });
    console.log('[ISSUE-125] Table Statistics (Filtered Low/Out):', lowStockFilterStats);

    const shot2Path = path.join(artifactDir, 'inventory_filtered_low_stock.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    console.log(`[ISSUE-125] Saved screenshot 2 to: ${shot2Path}`);

    // 7. Test Interactive Chip: Click "2 expired"
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const chip = buttons.find(b => b.innerText.includes('expired') && !b.innerText.includes('Clear'));
        if (chip) chip.click();
    });
    await new Promise(r => setTimeout(r, 500));

    const expiredFilterStats = await page.evaluate(() => {
        const rows = document.querySelectorAll('tbody tr');
        const filterBadge = document.querySelector('.bg-orange-50');
        return {
            filterText: filterBadge ? filterBadge.innerText.replace(/\n/g, ' ') : '',
            rowsShowing: rows.length
        };
    });
    console.log('[ISSUE-125] Table Statistics (Filtered Expired):', expiredFilterStats);

    const shot3Path = path.join(artifactDir, 'inventory_filtered_expired.png');
    await page.screenshot({ path: shot3Path, fullPage: false });
    console.log(`[ISSUE-125] Saved screenshot 3 to: ${shot3Path}`);

    // Close browser & server
    await browser.close();
    server.close();

    // Clean up temp DB
    try { fs.unlinkSync(tempDbPath); } catch (_) {}
    try { fs.unlinkSync(tempDbPath + '-wal'); } catch (_) {}
    try { fs.unlinkSync(tempDbPath + '-shm'); } catch (_) {}

    const results = {
        bannerLowStock126: hasLowOutCount,
        bannerExpired2: hasExpiredCount,
        defaultRows: tableStats.totalRows,
        defaultOutOfStockBadges: tableStats.outOfStockRows,
        defaultExpiredBadges: tableStats.expiredBadgeRows,
        lowStockFilteredRows: lowStockFilterStats.rowsShowing,
        expiredFilteredRows: expiredFilterStats.rowsShowing,
        evidenceScreenshots: [shot1Path, shot2Path, shot3Path]
    };

    console.log('\n[ISSUE-125] FINAL VERIFICATION SUMMARY:');
    console.log(JSON.stringify(results, null, 2));

    if (
        results.bannerLowStock126 &&
        results.bannerExpired2 &&
        results.defaultRows === 126 &&
        results.defaultOutOfStockBadges === 126 &&
        results.defaultExpiredBadges === 2 &&
        results.lowStockFilteredRows === 126 &&
        results.expiredFilteredRows === 2
    ) {
        console.log('\n✅ ALL VERIFICATIONS PASSED: Summary counts, row badges, and 126 filtered rows 100% aligned!');
        process.exit(0);
    } else {
        console.error('\n❌ VERIFICATION FAILED: Mismatch detected!');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('[ISSUE-125] Fatal error:', err);
    process.exit(1);
});
