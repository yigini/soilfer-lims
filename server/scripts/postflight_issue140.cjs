#!/usr/bin/env node
/**
 * Bounded, Read-Only Postflight Verification for Issue #140 (PR #149)
 *
 * Verifies:
 * 1. Database table presence and schema integrity (no mutations)
 * 2. Public unauthenticated endpoint availability (health, capabilities)
 * 3. Anonymous request rejection on all protected exchange & directory routes (HTTP 401)
 * 4. Manager UI & Super Admin RBAC boundaries using approved existing principals (HTTP 200 vs 403)
 * 5. Scoped laboratory catalogue retrieval
 *
 * Exit code 0 on complete pass, exit code 1 on any failure.
 */

'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const BASE_URL = process.env.POSTFLIGHT_BASE_URL || 'http://127.0.0.1:3000';
const DATABASE_PATH = process.env.DATABASE_PATH || path.resolve(__dirname, '../prisma/dev.db');
const JWT_SECRET = process.env.JWT_SECRET;

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function logResult(status, name, detail) {
    totalChecks++;
    if (status === 'PASS') {
        passedChecks++;
        console.log(`[PASS] ${name}${detail ? ` - ${detail}` : ''}`);
    } else {
        failedChecks++;
        console.error(`[FAIL] ${name}${detail ? ` - ${detail}` : ''}`);
    }
}

function request(method, routePath, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(routePath, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 3000,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Accept': 'application/json',
                ...headers
            },
            timeout: 5000
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            options.headers['Content-Type'] = 'application/json';
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = data ? JSON.parse(data) : null;
                } catch (e) {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error(`Request to ${routePath} timed out after 5000ms`));
        });

        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runPostflight() {
    console.log('============================================================');
    console.log('  SOILFER-LIMS ISSUE #140 BOUNDED POSTFLIGHT VERIFICATION   ');
    console.log('============================================================');
    console.log(`Database Path: ${DATABASE_PATH}`);
    console.log(`Target URL:    ${BASE_URL}`);

    // --- 1. Database Schema & Integrity Check ---
    console.log('\n--- 1. Database Schema & Integrity Checks ---');
    if (!fs.existsSync(DATABASE_PATH)) {
        logResult('FAIL', 'Database file exists', `Not found at ${DATABASE_PATH}`);
        process.exit(1);
    }
    logResult('PASS', 'Database file exists', DATABASE_PATH);

    const db = new Database(DATABASE_PATH, { readonly: true, fileMustExist: true });
    try {
        const integrity = db.pragma('integrity_check');
        const isOk = Array.isArray(integrity) && integrity.length === 1 && integrity[0].integrity_check === 'ok';
        logResult(isOk ? 'PASS' : 'FAIL', 'PRAGMA integrity_check', JSON.stringify(integrity));

        const fkErrors = db.pragma('foreign_key_check');
        const fkOk = Array.isArray(fkErrors) && fkErrors.length === 0;
        logResult(fkOk ? 'PASS' : 'FAIL', 'PRAGMA foreign_key_check', fkOk ? '0 errors' : `${fkErrors.length} FK errors`);

        const expectedTables = [
            '_exchange_journal',
            '_exchange_snapshots',
            '_exchange_connections',
            '_exchange_connection_keys',
            '_exchange_receipts',
            '_exchange_meta'
        ];
        const existingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
        for (const tbl of expectedTables) {
            const exists = existingTables.includes(tbl);
            logResult(exists ? 'PASS' : 'FAIL', `Table presence: ${tbl}`, exists ? 'Found' : 'MISSING');
        }

        // --- 2. Public Unauthenticated Endpoints ---
        console.log('\n--- 2. Public Endpoint Health & Discovery ---');
        try {
            const healthRes = await request('GET', '/api/health');
            logResult(healthRes.status === 200 ? 'PASS' : 'FAIL', 'GET /api/health -> 200', `Got ${healthRes.status}`);
        } catch (e) {
            logResult('FAIL', 'GET /api/health', e.message);
        }

        try {
            const capsRes = await request('GET', '/api/v2/data-exchange/capabilities');
            const hasCaps = capsRes.body && capsRes.body.contractVersion === '2.0.0';
            logResult(capsRes.status === 200 && hasCaps ? 'PASS' : 'FAIL', 'GET /api/v2/data-exchange/capabilities -> 200', `Got ${capsRes.status}, version: ${capsRes.body?.contractVersion}`);
        } catch (e) {
            logResult('FAIL', 'GET /api/v2/data-exchange/capabilities', e.message);
        }

        // --- 3. Anonymous Denials (Protected Routes Return HTTP 401) ---
        console.log('\n--- 3. Anonymous Protection Policy (HTTP 401 Denials) ---');
        const anonChecks = [
            ['GET', '/api/labs/directory'],
            ['GET', '/api/v1/data-exchange/stats'],
            ['GET', '/api/v1/sis/stats'],
            ['GET', '/api/v2/data-exchange/stats'],
            ['GET', '/api/v2/data-exchange/samples'],
            ['GET', '/api/v2/data-exchange/observations'],
            ['GET', '/api/v2/data-exchange/geojson'],
            ['GET', '/api/v2/data-exchange/spectra'],
            ['GET', '/api/v2/data-exchange/changes'],
            ['POST', '/api/v2/data-exchange/snapshots'],
            ['POST', '/api/v2/data-exchange/receipts']
        ];

        for (const [method, route] of anonChecks) {
            try {
                const res = await request(method, route);
                logResult(res.status === 401 ? 'PASS' : 'FAIL', `Anonymous ${method} ${route} -> 401`, `Got ${res.status}`);
            } catch (e) {
                logResult('FAIL', `Anonymous ${method} ${route}`, e.message);
            }
        }

        // --- 4. Role-Based Access Control & Principal Verification ---
        console.log('\n--- 4. Role-Based Access Control & Scoped Catalogue ---');
        if (!JWT_SECRET) {
            console.warn('[WARN] JWT_SECRET not provided; skipping authenticated role checks.');
        } else {
            // Find existing active principals in DB
            const superAdmin = db.prepare("SELECT id, username, role, tokenVersion FROM User WHERE role = 'SUPER_ADMIN' AND isActive = 1 LIMIT 1").get();
            const labManager = db.prepare("SELECT id, username, role, labId, tokenVersion FROM User WHERE role = 'LAB_MANAGER' AND isActive = 1 LIMIT 1").get();

            if (superAdmin) {
                const adminToken = jwt.sign({
                    id: superAdmin.id,
                    username: superAdmin.username,
                    role: superAdmin.role,
                    tokenVersion: superAdmin.tokenVersion || 0
                }, JWT_SECRET, { expiresIn: '5m' });
                const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };

                const dirRes = await request('GET', '/api/labs/directory', adminHeaders);
                logResult(dirRes.status === 200 ? 'PASS' : 'FAIL', 'SUPER_ADMIN GET /api/labs/directory -> 200', `Got ${dirRes.status}`);

                const connRes = await request('GET', '/api/v1/data-exchange/connections', adminHeaders);
                logResult(connRes.status === 200 ? 'PASS' : 'FAIL', 'SUPER_ADMIN GET /api/v1/data-exchange/connections -> 200', `Got ${connRes.status}`);

                const keysRes = await request('GET', '/api/v1/data-exchange/keys', adminHeaders);
                logResult(keysRes.status === 200 ? 'PASS' : 'FAIL', 'SUPER_ADMIN GET /api/v1/data-exchange/keys -> 200', `Got ${keysRes.status}`);

                const labsRes = await request('GET', '/api/labs', adminHeaders);
                logResult(labsRes.status === 200 ? 'PASS' : 'FAIL', 'SUPER_ADMIN GET /api/labs -> 200', `Got ${labsRes.status}`);
            } else {
                console.log('[INFO] No active SUPER_ADMIN found in User table; skipping admin token tests.');
            }

            if (labManager) {
                const mgrToken = jwt.sign({
                    id: labManager.id,
                    username: labManager.username,
                    role: labManager.role,
                    labId: labManager.labId,
                    tokenVersion: labManager.tokenVersion || 0
                }, JWT_SECRET, { expiresIn: '5m' });
                const mgrHeaders = { 'Authorization': `Bearer ${mgrToken}` };

                const dirRes = await request('GET', '/api/labs/directory', mgrHeaders);
                logResult(dirRes.status === 200 ? 'PASS' : 'FAIL', 'LAB_MANAGER GET /api/labs/directory -> 200', `Got ${dirRes.status}`);

                const connRes = await request('GET', '/api/v1/data-exchange/connections', mgrHeaders);
                logResult(connRes.status === 403 ? 'PASS' : 'FAIL', 'LAB_MANAGER GET /api/v1/data-exchange/connections -> 403 Forbidden', `Got ${connRes.status}`);

                const keysRes = await request('GET', '/api/v1/data-exchange/keys', mgrHeaders);
                logResult(keysRes.status === 403 ? 'PASS' : 'FAIL', 'LAB_MANAGER GET /api/v1/data-exchange/keys -> 403 Forbidden', `Got ${keysRes.status}`);

                const labsRes = await request('GET', '/api/labs', mgrHeaders);
                logResult(labsRes.status === 200 ? 'PASS' : 'FAIL', 'LAB_MANAGER GET /api/labs (scoped catalogue) -> 200', `Got ${labsRes.status}`);
            } else {
                console.log('[INFO] No active LAB_MANAGER found in User table; skipping manager token tests.');
            }
        }
    } finally {
        db.close();
    }

    console.log('\n============================================================');
    console.log(`  POSTFLIGHT SUMMARY: ${passedChecks}/${totalChecks} checks passed (${failedChecks} failed)`);
    console.log('============================================================');

    if (failedChecks > 0) {
        process.exit(1);
    }
}

runPostflight().catch(err => {
    console.error('Unhandled postflight error:', err);
    process.exit(1);
});
