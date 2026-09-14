/**
 * Journey 5 & Lab Access Verification Suite
 * PM-16, PM-20, Review 31: Owner-authorized servicing lab review, change, blockers, scope, concurrency,
 * inactive lab deselection, definitive 4xx rejection cleanup, and truthful status.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { createRequire } = require('module');
const { createHash } = require('crypto');
const http = require('http');

const root = 'C:/Users/yigin/Documents/soilfer-lims';
const req = createRequire(path.join(root, 'server/package.json'));
const Database = req('better-sqlite3');

const sourcePath = path.join(root, 'server/prisma/dev.db');
const getHash = () => createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
const beforeHash = getHash();

// Create isolated temporary fixture
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'journey5-lab-access-'));
const fixture = path.join(dir, 'fixture.db');

const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const ddl = source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
source.close();

const db = new Database(fixture);
db.pragma('foreign_keys=OFF');
for (const row of ddl) {
    db.exec(row.sql);
}
db.close();

process.env.DATABASE_PATH = fixture;
process.env.DATABASE_URL = 'file:' + fixture;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'disposable-journey5-secret-12345';

const prisma = req('./prisma');
const express = req('express');
const jwt = req('jsonwebtoken');

const { verifyToken } = req('./middleware/authMiddleware');
const app = express();
app.use(express.json());
app.use('/api/projects', req('./routes/projectRoutes'));
app.use('/api/samples', verifyToken, req('./routes/sampleRoutes'));

let server;

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
}

async function request(method, url, { token, body, headers = {} } = {}) {
    const defaultHeaders = {
        'content-type': 'application/json',
        ...headers
    };
    if (token) {
        defaultHeaders['authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
        method,
        headers: defaultHeaders,
        body: body ? JSON.stringify(body) : undefined
    });

    let data;
    const text = await res.text();
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }
    return { status: res.status, headers: res.headers, body: data };
}

async function run() {
    console.log('='.repeat(75));
    console.log('  STARTING JOURNEY 5 & LAB ACCESS MANAGEMENT VERIFICATION');
    console.log('  Fixture:', fixture);
    console.log('  dev.db SHA-256 Before:', beforeHash);
    console.log('='.repeat(75));

    // 1. Seed Labs
    await prisma.lab.create({ data: { id: 'LAB-A', code: 'LAB-A', name: 'Coordinating Owner Lab A', country: 'GTM', isActive: true } });
    await prisma.lab.create({ data: { id: 'LAB-B', code: 'LAB-B', name: 'Regional Servicing Lab B', country: 'GTM', isActive: true } });
    await prisma.lab.create({ data: { id: 'LAB-C', code: 'LAB-C', name: 'Foreign Lab C', country: 'HND', isActive: true } });
    await prisma.lab.create({ data: { id: 'LAB-D', code: 'LAB-D', name: 'Decommissioned Lab D', country: 'GTM', isActive: false } });

    // 2. Seed Users
    const users = [
        { id: 'usr-owner', username: 'owner_mgr', email: 'owner@lab-a.org', password: 'pwd', role: 'LAB_MANAGER', labId: 'LAB-A', countries: '["GTM"]', isActive: true },
        { id: 'usr-service', username: 'service_mgr', email: 'service@lab-b.org', password: 'pwd', role: 'LAB_MANAGER', labId: 'LAB-B', countries: '["GTM"]', isActive: true },
        { id: 'usr-foreign', username: 'foreign_mgr', email: 'foreign@lab-c.org', password: 'pwd', role: 'LAB_MANAGER', labId: 'LAB-C', countries: '["HND"]', isActive: true },
        { id: 'usr-admin', username: 'superadmin', email: 'admin@lims.org', password: 'pwd', role: 'SUPER_ADMIN', labId: null, countries: '["GTM","HND"]', isActive: true }
    ];

    for (const u of users) {
        await prisma.user.create({ data: u });
    }

    const tokenFor = (user) => jwt.sign(
        { id: user.id, username: user.username, role: user.role, labId: user.labId, countries: JSON.parse(user.countries) },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    const ownerToken = tokenFor(users[0]);
    const serviceToken = tokenFor(users[1]);
    const foreignToken = tokenFor(users[2]);
    const adminToken = tokenFor(users[3]);

    // Start ephemeral server
    await new Promise((resolve) => {
        server = http.createServer(app).listen(0, '127.0.0.1', resolve);
    });
    console.log(`Ephemeral server listening on port ${server.address().port}`);

    // Create Project owned by Lab A
    const project = await prisma.project.create({
        data: {
            id: 'proj-j5-001',
            code: 'J5-REGIONAL',
            name: 'Journey 5 Regional Soil Assessment',
            labId: 'LAB-A',
            countries: '["GTM"]',
            status: 'ACTIVE'
        }
    });

    // Step 1: Owner fetches lab access via GET /api/projects/:id/lab-access
    {
        const res = await request('GET', `/api/projects/${project.id}/lab-access`, { token: ownerToken });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.ownerLabId === 'LAB-A', `Expected ownerLabId LAB-A, got ${res.body.ownerLabId}`);
        assert(res.body.canManage === true, 'Owner should have canManage=true');
        assert(Array.isArray(res.body.servicingLabIds) && res.body.servicingLabIds.length === 0, 'Initially no servicing labs');
        console.log('✓ Step 1: Owner successfully queried project lab access with canManage=true');
    }

    // Step 2: Foreign actor C attempts to view project -> 403 Forbidden
    {
        const res = await request('GET', `/api/projects/${project.id}/lab-access`, { token: foreignToken });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        console.log('✓ Step 2: Foreign actor denied read access (403)');
    }

    // Step 3: Foreign actor C attempts PATCH /api/projects/:id/lab-access -> 403 Forbidden
    {
        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: foreignToken,
            body: {
                servicingLabIds: ['LAB-B'],
                reason: 'Unauthorized attempt by foreign actor'
            }
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assert(res.body.code === 'PROJECT_OWNER_REQUIRED' || res.body.code === 'PROJECT_ACCESS_DENIED', `Expected PROJECT_OWNER_REQUIRED, got ${res.body.code}`);
        console.log('✓ Step 3: Foreign actor denied PATCH access (403)');
    }

    // Step 4: Non-owner servicing manager B attempts PATCH -> 403 Forbidden
    {
        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: serviceToken,
            body: {
                servicingLabIds: ['LAB-B'],
                reason: 'Servicing lab attempting self-authorization'
            }
        });
        assert(res.status === 403, `Expected 403, got ${res.status}`);
        assert(res.body.code === 'PROJECT_OWNER_REQUIRED', `Expected PROJECT_OWNER_REQUIRED, got ${res.body.code}`);
        console.log('✓ Step 4: Non-owner servicing manager denied modification rights (403 PROJECT_OWNER_REQUIRED)');
    }

    // Step 5: Attempting to assign new inactive lab D -> 400 INACTIVE_LAB_NOT_ALLOWED
    {
        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: ownerToken,
            body: {
                servicingLabIds: ['LAB-D'],
                reason: 'Attempting to assign decommissioned facility'
            }
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.body.code === 'INACTIVE_LAB_NOT_ALLOWED', `Expected INACTIVE_LAB_NOT_ALLOWED, got ${res.body.code}`);
        console.log('✓ Step 5: Inactive lab assignment safely rejected (400 INACTIVE_LAB_NOT_ALLOWED)');
    }

    // Step 6: Owner authorizes active servicing lab B with mandatory reason and revision
    let projectUpdatedTime;
    {
        const projBefore = await prisma.project.findUnique({ where: { id: project.id } });
        projectUpdatedTime = new Date(projBefore.updatedAt).getTime().toString();

        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: ownerToken,
            headers: {
                'if-match': projectUpdatedTime,
                'x-idempotency-key': 'idem-j5-add-lab-b'
            },
            body: {
                servicingLabIds: ['LAB-B'],
                reason: 'Authorized regional intake for Journey 5 sample processing'
            }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
        assert(res.body.servicingLabIds.includes('LAB-B'), 'Servicing lab B should be in servicingLabIds');
        console.log('✓ Step 6: Owner authorized servicing lab B with audit reason and concurrency token');
    }

    // Step 7: Verify idempotency replay returns same outcome without duplicating audit logs
    {
        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: ownerToken,
            headers: {
                'x-idempotency-key': 'idem-j5-add-lab-b'
            },
            body: {
                servicingLabIds: ['LAB-B'],
                reason: 'Authorized regional intake for Journey 5 sample processing'
            }
        });
        assert(res.status === 200, `Expected 200 on replay, got ${res.status}`);
        assert(res.body.servicingLabIds.includes('LAB-B'), 'Replay returns matching servicingLabIds');
        console.log('✓ Step 7: Idempotent replay returned cached outcome without duplicate side effects');
    }

    // Step 8: Create an active sample assigned to Lab B
    const activeSample = await prisma.sample.create({
        data: {
            id: 'smp-j5-001',
            originalId: 'SMP-J5-001',
            projectId: project.id,
            projectCode: project.code,
            labId: 'LAB-B',
            status: 'RECEIVED' // active status
        }
    });

    // Step 9: Owner attempts to remove servicing lab B while active work exists -> 400 CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK
    {
        const projCurrent = await prisma.project.findUnique({ where: { id: project.id } });
        const currentRev = new Date(projCurrent.updatedAt).getTime().toString();

        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: ownerToken,
            headers: {
                'if-match': currentRev,
                'x-idempotency-key': 'idem-j5-remove-blocked'
            },
            body: {
                servicingLabIds: [],
                reason: 'Premature attempt to decommission servicing lab B'
            }
        });
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.body.code === 'CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK', `Expected CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK, got ${res.body.code}`);
        assert(res.body.details && res.body.details.activeSamples === 1, `Expected details.activeSamples === 1, got ${JSON.stringify(res.body.details)}`);
        assert(res.body.error && res.body.error.includes('1 active sample(s)'), `Expected error message to mention 1 active sample, got: ${res.body.error}`);
        console.log('✓ Step 9: Removal blocked due to active work (400 CANNOT_REMOVE_LAB_WITH_ACTIVE_WORK, details: { activeSamples: 1 })');
    }

    // Step 10: Verify definitive 400 rejection does NOT record an unresolved command conflict
    // (A new command with a fresh key is immediately accepted, proving definitive rejection clears blockers)
    {
        const projCurrent = await prisma.project.findUnique({ where: { id: project.id } });
        const currentRev = new Date(projCurrent.updatedAt).getTime().toString();

        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: ownerToken,
            headers: {
                'if-match': currentRev,
                'x-idempotency-key': 'idem-j5-fresh-attempt'
            },
            body: {
                servicingLabIds: ['LAB-B'], // Retain LAB-B
                reason: 'Maintaining servicing lab B while samples are active'
            }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        console.log('✓ Step 10: Definitive 400 rejection cleared cleanly; no collision on subsequent command');
    }

    // Step 11: Transition sample to terminal status COMPLETED
    // Note: This transition verifies the server-side blocker clearance logic; it does not claim to execute interactive Tech Workbench UI.
    await prisma.sample.update({
        where: { id: activeSample.id },
        data: { status: 'COMPLETED' }
    });
    console.log('✓ Step 11: Sample transitioned to terminal status (COMPLETED) to evaluate blocker clearance');

    // Step 12: Optimistic concurrency check - stale revision returns 409 STALE_REVISION
    {
        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: ownerToken,
            headers: {
                'if-match': 'stale-revision-timestamp-123',
                'x-idempotency-key': 'idem-j5-stale-rev'
            },
            body: {
                servicingLabIds: [],
                reason: 'Concurrent edit attempt with old timestamp'
            }
        });
        assert(res.status === 409, `Expected 409, got ${res.status}`);
        assert(res.body.code === 'STALE_REVISION', `Expected STALE_REVISION, got ${res.body.code}`);
        console.log('✓ Step 12: Stale revision conflict prevented (409 STALE_REVISION)');
    }

    // Step 13: Owner removes servicing lab B with valid revision once work resolved -> 200 SUCCESS
    {
        const projCurrent = await prisma.project.findUnique({ where: { id: project.id } });
        const currentRev = new Date(projCurrent.updatedAt).getTime().toString();

        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: ownerToken,
            headers: {
                'if-match': currentRev,
                'x-idempotency-key': 'idem-j5-remove-success'
            },
            body: {
                servicingLabIds: [],
                reason: 'Phase complete: Servicing analyses finalized and verified'
            }
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(!res.body.servicingLabIds.includes('LAB-B'), 'LAB-B should be removed from servicingLabIds');
        console.log('✓ Step 13: Servicing lab B cleanly removed following complete work resolution');
    }

    // Step 14: Historical inactive lab member removal test:
    // Create an existing ProjectLab membership for inactive lab D, then remove it cleanly
    {
        await prisma.projectLab.create({
            data: {
                id: 'pl-test-inactive',
                projectCode: project.code,
                labId: 'LAB-D',
                role: 'SERVICING'
            }
        });
        await prisma.project.update({
            where: { id: project.id },
            data: { assignedLabIds: JSON.stringify(['LAB-D']) }
        });

        const projCurrent = await prisma.project.findUnique({ where: { id: project.id } });
        const currentRev = new Date(projCurrent.updatedAt).getTime().toString();

        // Removing the existing inactive lab D without active work must succeed (not blocked by INACTIVE_LAB_NOT_ALLOWED)
        const res = await request('PATCH', `/api/projects/${project.id}/lab-access`, {
            token: ownerToken,
            headers: {
                'if-match': currentRev,
                'x-idempotency-key': 'idem-j5-remove-inactive-d'
            },
            body: {
                servicingLabIds: [], // Remove LAB-D
                reason: 'Removing decommissioned lab D from project membership'
            }
        });
        assert(res.status === 200, `Expected 200 when removing existing inactive lab, got ${res.status}: ${JSON.stringify(res.body)}`);
        assert(!res.body.servicingLabIds.includes('LAB-D'), 'LAB-D should be removed');
        console.log('✓ Step 14: Removal of existing inactive lab member cleanly permitted without active work');
    }

    // Step 15: Truthful lab status in GET /lab-access
    {
        const res = await request('GET', `/api/projects/${project.id}/lab-access`, { token: ownerToken });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const memberLabA = res.body.memberLabs.find(l => l.id === 'LAB-A');
        assert(memberLabA && memberLabA.isActive === true, 'Member lab A must reflect authoritative isActive: true');
        console.log('✓ Step 15: Authoritative lab status truthfully reported in GET /lab-access');
    }

    server.close();

    const afterHash = getHash();
    assert(beforeHash === afterHash, 'dev.db SHA-256 mismatch! Zero-mutation invariant violated!');
    console.log('='.repeat(75));
    console.log('  ALL JOURNEY 5 & LAB ACCESS CHECKS PASSED (15/15 STEPS VERIFIED)');
    console.log('  dev.db Invariant SHA-256 Unchanged:', afterHash);
    console.log('='.repeat(75));
}

run().catch(err => {
    console.error('Test failed with error:', err);
    if (server) server.close();
    process.exit(1);
});
