#!/usr/bin/env node
/**
 * Bounded Read-Only HTTP API Postflight Verification for Issue #140 (PR #149)
 *
 * Verifies mounted HTTP API contracts:
 * 1. Database schema presence and integrity checks (no mutations)
 * 2. Public discovery endpoints availability (health, capabilities)
 * 3. Anonymous request rejection on all protected exchange & directory routes (HTTP 401)
 * 4. Directory projection policy (lightweight public fields, no operational leaks)
 * 5. Role-based access control (Super Admin vs Lab Manager boundaries) using approved existing principals
 * 6. Scoped laboratory catalogue retrieval (strictly excludes unauthorized/foreign facilities)
 *
 * NOTE: This probe validates HTTP API contracts; it does not render browser UI or provision credentials.
 * Exit code 0 on complete pass, exit code 1 on any failure (fail-closed).
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
            // Fail closed: Missing required JWT_SECRET must block release verification
            logResult('FAIL', 'JWT_SECRET configuration', 'JWT_SECRET environment variable is missing; cannot verify role boundaries');
        } else {
            // Find existing active principals in DB (supports environment overrides or reviewed existing principals)
            const superAdmin = (process.env.POSTFLIGHT_ADMIN_ID
                ? db.prepare("SELECT id, username, role, tokenVersion FROM User WHERE id = ? AND role = 'SUPER_ADMIN' AND isActive = 1").get(process.env.POSTFLIGHT_ADMIN_ID)
                : null)
                || db.prepare("SELECT id, username, role, tokenVersion FROM User WHERE id = 'synthetic-admin' AND role = 'SUPER_ADMIN' AND isActive = 1").get()
                || db.prepare("SELECT id, username, role, tokenVersion FROM User WHERE role = 'SUPER_ADMIN' AND isActive = 1 ORDER BY id ASC LIMIT 1").get();

            const labManager = (process.env.POSTFLIGHT_MANAGER_ID
                ? db.prepare("SELECT id, username, role, labId, countries, projects, tokenVersion FROM User WHERE id = ? AND role = 'LAB_MANAGER' AND isActive = 1").get(process.env.POSTFLIGHT_MANAGER_ID)
                : null)
                || db.prepare("SELECT id, username, role, labId, countries, projects, tokenVersion FROM User WHERE id = 'synthetic-manager' AND role = 'LAB_MANAGER' AND isActive = 1").get()
                || db.prepare("SELECT id, username, role, labId, countries, projects, tokenVersion FROM User WHERE role = 'LAB_MANAGER' AND isActive = 1 ORDER BY id ASC LIMIT 1").get();

            if (!superAdmin) {
                logResult('FAIL', 'SUPER_ADMIN principal presence', 'Required active SUPER_ADMIN user not found in database');
            } else {
                const adminToken = jwt.sign({
                    id: superAdmin.id,
                    username: superAdmin.username,
                    role: superAdmin.role,
                    tokenVersion: superAdmin.tokenVersion || 0
                }, JWT_SECRET, { expiresIn: '5m' });
                const adminHeaders = { 'Authorization': `Bearer ${adminToken}` };

                // Directory lookup with projection policy check (lightweight public fields only, no operational leaks)
                const dirRes = await request('GET', '/api/labs/directory', adminHeaders);
                let isDirValid = dirRes.status === 200 && Array.isArray(dirRes.body) && dirRes.body.length > 0;
                if (isDirValid) {
                    const LEAK_KEYS = ['notes', 'projects', 'users', 'sampleCount', 'allSamplesCount', 'activeSamplesCount', 'totalSamplesCount', 'equipment', 'staff', 'capacity'];
                    for (const item of dirRes.body) {
                        for (const k of LEAK_KEYS) {
                            if (k in item) {
                                isDirValid = false;
                                break;
                            }
                        }
                    }
                }
                logResult(isDirValid ? 'PASS' : 'FAIL', 'SUPER_ADMIN GET /api/labs/directory (projection policy)', `Got ${dirRes.status}, valid: ${isDirValid}, items: ${Array.isArray(dirRes.body) ? dirRes.body.length : 0}`);

                // Connection and key management
                const connRes = await request('GET', '/api/v1/data-exchange/connections', adminHeaders);
                const isConnValid = connRes.status === 200 && Array.isArray(connRes.body?.data);
                logResult(isConnValid ? 'PASS' : 'FAIL', 'SUPER_ADMIN GET /api/v1/data-exchange/connections -> 200', `Got ${connRes.status}`);

                const keysRes = await request('GET', '/api/v1/data-exchange/keys', adminHeaders);
                const isKeysValid = keysRes.status === 200 && Array.isArray(keysRes.body?.data);
                logResult(isKeysValid ? 'PASS' : 'FAIL', 'SUPER_ADMIN GET /api/v1/data-exchange/keys -> 200', `Got ${keysRes.status}`);

                const labsRes = await request('GET', '/api/labs', adminHeaders);
                logResult(labsRes.status === 200 ? 'PASS' : 'FAIL', 'SUPER_ADMIN GET /api/labs -> 200', `Got ${labsRes.status}`);
            }

            if (!labManager) {
                logResult('FAIL', 'LAB_MANAGER principal presence', 'Required active LAB_MANAGER user not found in database');
            } else {
                let allowedCountries = [];
                if (labManager.countries) {
                    try {
                        allowedCountries = typeof labManager.countries === 'string' ? JSON.parse(labManager.countries) : labManager.countries;
                    } catch (_) {}
                }
                if (!Array.isArray(allowedCountries)) allowedCountries = [];

                let allowedProjects = [];
                if (labManager.projects) {
                    try {
                        allowedProjects = typeof labManager.projects === 'string' ? JSON.parse(labManager.projects) : labManager.projects;
                    } catch (_) {}
                }
                if (!Array.isArray(allowedProjects)) allowedProjects = [];

                const mgrToken = jwt.sign({
                    id: labManager.id,
                    username: labManager.username,
                    role: labManager.role,
                    labId: labManager.labId,
                    countries: labManager.countries,
                    projects: labManager.projects,
                    tokenVersion: labManager.tokenVersion || 0
                }, JWT_SECRET, { expiresIn: '5m' });
                const mgrHeaders = { 'Authorization': `Bearer ${mgrToken}` };

                const dirRes = await request('GET', '/api/labs/directory', mgrHeaders);
                let isMgrDirValid = dirRes.status === 200 && Array.isArray(dirRes.body);
                if (isMgrDirValid) {
                    const LEAK_KEYS = ['notes', 'projects', 'users', 'sampleCount', 'allSamplesCount', 'activeSamplesCount', 'totalSamplesCount', 'equipment', 'staff', 'capacity'];
                    for (const item of dirRes.body) {
                        for (const k of LEAK_KEYS) {
                            if (k in item) {
                                isMgrDirValid = false;
                                break;
                            }
                        }
                    }
                }
                logResult(isMgrDirValid ? 'PASS' : 'FAIL', 'LAB_MANAGER GET /api/labs/directory (projection policy)', `Got ${dirRes.status}, valid: ${isMgrDirValid}`);

                const connRes = await request('GET', '/api/v1/data-exchange/connections', mgrHeaders);
                logResult(connRes.status === 403 ? 'PASS' : 'FAIL', 'LAB_MANAGER GET /api/v1/data-exchange/connections -> 403 Forbidden', `Got ${connRes.status}`);

                const keysRes = await request('GET', '/api/v1/data-exchange/keys', mgrHeaders);
                logResult(keysRes.status === 403 ? 'PASS' : 'FAIL', 'LAB_MANAGER GET /api/v1/data-exchange/keys -> 403 Forbidden', `Got ${keysRes.status}`);

                // Scoped catalogue assertion: verify returned facilities belong strictly to authorized scope
                const labsRes = await request('GET', '/api/labs', mgrHeaders);
                let catalogueScoped = labsRes.status === 200 && Array.isArray(labsRes.body);

                if (catalogueScoped) {
                    if (labManager.labId) {
                        // 1. Manager with assigned labId: must only receive assigned facility
                        for (const lab of labsRes.body) {
                            if (lab.id !== labManager.labId) {
                                catalogueScoped = false;
                                break;
                            }
                        }
                    } else if (allowedCountries.length === 0 && allowedProjects.length === 0) {
                        // 2. Manager with no assigned lab, no countries, and no projects: catalogue must be empty
                        if (labsRes.body.length > 0) {
                            catalogueScoped = false;
                        }
                    } else {
                        // 3. Manager without labId: must adhere strictly to country and project scoping
                        let projectLabIds = [];
                        if (allowedProjects.length > 0) {
                            try {
                                const placeholders = allowedProjects.map(() => '?').join(',');
                                const rows = db.prepare(`SELECT DISTINCT labId FROM Project WHERE code IN (${placeholders}) AND labId IS NOT NULL`).all(...allowedProjects);
                                projectLabIds = rows.map(r => r.labId);
                            } catch (_) {}
                        }

                        for (const lab of labsRes.body) {
                            // Country scope validation
                            if (allowedCountries.length > 0 && !allowedCountries.includes('*')) {
                                if (!lab.country || !allowedCountries.includes(lab.country)) {
                                    catalogueScoped = false;
                                    break;
                                }
                            }
                            // Project scope validation if manager is project-scoped
                            if (allowedProjects.length > 0 && projectLabIds.length > 0) {
                                if (!projectLabIds.includes(lab.id)) {
                                    catalogueScoped = false;
                                    break;
                                }
                            }
                        }
                    }
                }

                logResult(catalogueScoped ? 'PASS' : 'FAIL',
                    'LAB_MANAGER GET /api/labs (scoped catalogue)',
                    `Status: ${labsRes.status}, Scoped: ${catalogueScoped} (returned ${Array.isArray(labsRes.body) ? labsRes.body.length : 0} labs)`
                );

                // Negative fixture: forged token rejected on protected route (HTTP 401)
                const forgedRes = await request('GET', '/api/labs/directory', { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature' });
                logResult(forgedRes.status === 401 ? 'PASS' : 'FAIL', 'Negative fixture: forged token GET /api/labs/directory -> 401', `Got ${forgedRes.status}`);
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
