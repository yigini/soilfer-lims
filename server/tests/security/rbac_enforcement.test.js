const request = require('supertest');
const app = require('../../app');
const { getAuthToken } = require('../setup');
const { PERMISSIONS, ROLES } = require('../../config/roles');
const fs = require('fs');
const path = require('path');

const MOUNTED_ROUTERS = [
    { prefix: '/api/admin', file: 'adminRoutes.js' },
    { prefix: '/api/users', file: 'userRoutes.js' },
    { prefix: '/api/projects', file: 'projectRoutes.js' },
    { prefix: '/api/config', file: 'analysisRoutes.js' },
    { prefix: '/api/samples', file: 'sampleRoutes.js' },
    { prefix: '/api/results', file: 'resultsRoutes.js' },
    { prefix: '/api/data-results', file: 'dataResultsRoutes.js' },
    { prefix: '/api/inventory', file: 'inventoryRoutes.js' },
    { prefix: '/api/equipment', file: 'equipmentRoutes.js' },
    { prefix: '/api/spectral', file: 'spectralRoutes.js' },
    { prefix: '/api/reception', file: 'receptionRoutes.js' },
    { prefix: '/api/work', file: 'workRoutes.js' },
    { prefix: '/api/workbench', file: 'workbenchRoutes.js' },
    { prefix: '/api/labs', file: 'labRoutes.js' },
    { prefix: '/api/exports', file: 'exportRoutes.js' },
    { prefix: '/api/import', file: 'importRoutes.js' },
    { prefix: '/api/reports', file: 'reportRoutes.js' },
    { prefix: '/api/qc', file: 'qcRoutes.js' },
    { prefix: '/api/pt', file: 'ptRoutes.js' },
    { prefix: '/api/submissions', file: 'submissionRoutes.js' },
    { prefix: '/api/reviews', file: 'reviewRoutes.js' },
    { prefix: '/api/v1/data-exchange', file: 'sisRoutes.js' },
    { prefix: '/api/kobo', file: 'koboRoutes.js' }
];

// Exempt endpoints that are inherently personal user actions or public auth
const EXEMPT_MUTATING_PATHS = [
    '/api/auth/login',
    '/api/auth/change-password',
    '/api/notifications/mark-read',
    '/api/notifications/mark-all-read',
    '/api/notifications/clear-all',
    '/api/notifications/send',
    '/api/messages/send',
    '/api/messages/draft',
    '/api/messages/read',
    '/api/messages/move'
];

function extractMutatingRoutes() {
    const discovered = [];

    for (const m of MOUNTED_ROUTERS) {
        const filePath = path.join(__dirname, '..', '..', 'routes', m.file);
        if (!fs.existsSync(filePath)) continue;
        const router = require(filePath);
        const fileContent = fs.readFileSync(filePath, 'utf8');

        // Check for router-level permission
        let routerPerm = null;
        const routerUsePermMatch = fileContent.match(/router\.use\([^)]*checkPermission\(['"]([^'"]+)['"]\)/);
        if (routerUsePermMatch) routerPerm = routerUsePermMatch[1];

        // Also inspect router.stack for router-level middleware
        (router.stack || []).forEach(layer => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods).filter(k => ['post', 'put', 'patch', 'delete'].includes(k));
                methods.forEach(method => {
                    const fullPath = (m.prefix + (layer.route.path === '/' ? '' : layer.route.path)).replace(/\/+/g, '/');
                    if (EXEMPT_MUTATING_PATHS.includes(fullPath)) return;

                    let routePerm = routerPerm;
                    layer.route.stack.forEach(h => {
                        const fnStr = h.handle?.toString() || '';
                        const permMatch = fnStr.match(/checkPermission\(['"]([^'"]+)['"]\)/);
                        if (permMatch) routePerm = permMatch[1];
                    });

                    // Also search the route definition line in fileContent
                    const lines = fileContent.split('\n');
                    const routeLine = lines.find(l => l.includes(`.${method.toLowerCase()}('` + layer.route.path) || l.includes(`.${method.toLowerCase()}("` + layer.route.path));
                    if (routeLine) {
                        const linePerm = routeLine.match(/checkPermission\(['"]([^'"]+)['"]\)/);
                        if (linePerm) routePerm = linePerm[1];
                    }

                    discovered.push({
                        method: method.toUpperCase(),
                        path: fullPath,
                        file: m.file,
                        permission: routePerm
                    });
                });
            }
        });
    }

    return discovered;
}

describe('WP-42: Dynamic RBAC Matrix & Route Enforcement', () => {
    let tokens = {};
    let mutatingRoutes = [];
    const testRoles = ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'VIEWER', 'AUDIT_USER'];

    beforeAll(async () => {
        for (const role of testRoles) {
            tokens[role] = await getAuthToken(role, 'GTM-LAB1', ['GTM'], ['SOILFER-US']);
        }
        mutatingRoutes = extractMutatingRoutes();
    });

    describe('1. Canonical Permission Matrix Verification', () => {
        test('Registry defines all required permissions', () => {
            expect(PERMISSIONS['VIEW_SAMPLES']).toBeDefined();
            expect(PERMISSIONS['ENTER_RESULTS']).toBeDefined();
            expect(PERMISSIONS['APPROVE_RESULTS']).toBeDefined();
            expect(PERMISSIONS['MANAGE_USERS']).toBeDefined();
            expect(PERMISSIONS['MANAGE_BRANDING']).toBeDefined();
            expect(PERMISSIONS['VIEW_AUDIT']).toBeDefined();
            expect(PERMISSIONS['MANAGE_EQUIPMENT']).toBeDefined();
            expect(PERMISSIONS['MANAGE_INVENTORY']).toBeDefined();
            expect(PERMISSIONS['CREATE_SAMPLE']).toBeDefined();
            expect(PERMISSIONS['RECEIVE_SAMPLE']).toBeDefined();
        });

        test('SUPER_ADMIN has all administrative permissions', () => {
            for (const [perm, allowedRoles] of Object.entries(PERMISSIONS)) {
                expect(allowedRoles).toContain('SUPER_ADMIN');
            }
        });
    });

    describe('2. Exhaustive Route Permission Key Coverage (Zero-Unprotected Surface)', () => {
        test('Mutating route extractor finds routes across all registered routers', () => {
            expect(mutatingRoutes.length).toBeGreaterThanOrEqual(80);
        });

        test('Every mutating route declares a valid permission key from config/roles.js', () => {
            const missingKeys = [];
            const invalidKeys = [];

            for (const r of mutatingRoutes) {
                if (!r.permission) {
                    missingKeys.push(`${r.method} ${r.path} (${r.file})`);
                } else if (!PERMISSIONS[r.permission]) {
                    invalidKeys.push(`${r.method} ${r.path} -> '${r.permission}' not in roles.js`);
                }
            }

            expect(missingKeys).toEqual([]);
            expect(invalidKeys).toEqual([]);
        });
    });

    describe('3. Live HTTP Enforcement Matrix across Defined Roles', () => {
        // Representative endpoints across different permissions to test live HTTP 403 vs Allowed
        const matrixCases = [
            { perm: 'MANAGE_USERS', method: 'post', path: '/api/users', sampleBody: { username: 'test_u' } },
            { perm: 'ASSIGN_WORK', method: 'post', path: '/api/work/assign', sampleBody: { workItemIds: [] } },
            { perm: 'MANAGE_BRANDING', method: 'post', path: '/api/config/categories', sampleBody: { name: 'Test' } },
            { perm: 'MANAGE_EQUIPMENT', method: 'post', path: '/api/equipment', sampleBody: { name: 'Meter' } },
            { perm: 'RECEIVE_SAMPLE', method: 'post', path: '/api/samples/SMP-TEST/receive', sampleBody: {} },
            { perm: 'APPROVE_RESULTS', method: 'post', path: '/api/samples/SMP-TEST/approve', sampleBody: {} },
            { perm: 'ENTER_RESULTS', method: 'post', path: '/api/workbench/batch-save', sampleBody: { entries: [] } }
        ];

        matrixCases.forEach(({ perm, method, path, sampleBody }) => {
            describe(`Permission '${perm}' on ${method.toUpperCase()} ${path}`, () => {
                const allowedRoles = PERMISSIONS[perm] || [];
                const deniedRoles = testRoles.filter(r => !allowedRoles.includes(r));

                testRoles.forEach(role => {
                    const isAllowed = allowedRoles.includes(role);
                    test(`Role ${role} is ${isAllowed ? 'ALLOWED' : 'DENIED (403)'}`, async () => {
                        const token = tokens[role];
                        const req = request(app)[method](path)
                            .set('Authorization', `Bearer ${token}`)
                            .send(sampleBody);

                        const res = await req;
                        if (isAllowed) {
                            // Should not be forbidden
                            expect(res.status).not.toBe(403);
                        } else {
                            // Must strictly be 403 Forbidden
                            expect(res.status).toBe(403);
                        }
                    });
                });
            });
        });
    });
});
