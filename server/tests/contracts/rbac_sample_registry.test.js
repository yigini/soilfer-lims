const fs = require('fs');
const path = require('path');
const { hasPermission, PERMISSIONS } = require('../../config/roles');
const workflowContract = require('../../workflowContract');

describe('WP-24: Canonical RBAC Registry and Sample Controller Alignment', () => {
    test('1. hasPermission helper correctly evaluates permissions', () => {
        expect(typeof hasPermission).toBe('function');

        // Super Admin permissions
        expect(hasPermission({ role: 'SUPER_ADMIN' }, 'DISPOSE_SAMPLE')).toBe(true);
        expect(hasPermission({ role: 'SUPER_ADMIN' }, 'ARCHIVE_SAMPLE')).toBe(true);
        expect(hasPermission({ role: 'SUPER_ADMIN' }, 'DELETE_SAMPLE')).toBe(true);
        expect(hasPermission({ role: 'SUPER_ADMIN' }, 'APPROVE_RESULTS')).toBe(true);

        // Master User permissions settled
        expect(hasPermission({ role: 'MASTER_USER' }, 'APPROVE_RESULTS')).toBe(true);
        expect(hasPermission({ role: 'MASTER_USER' }, 'DISPOSE_SAMPLE')).toBe(true);
        expect(hasPermission({ role: 'MASTER_USER' }, 'ARCHIVE_SAMPLE')).toBe(true);
        expect(hasPermission({ role: 'MASTER_USER' }, 'DELETE_SAMPLE')).toBe(true);

        // Lab Manager permissions
        expect(hasPermission({ role: 'LAB_MANAGER' }, 'APPROVE_RESULTS')).toBe(true);
        expect(hasPermission({ role: 'LAB_MANAGER' }, 'DISPOSE_SAMPLE')).toBe(true);
        expect(hasPermission({ role: 'LAB_MANAGER' }, 'ARCHIVE_SAMPLE')).toBe(true);
        expect(hasPermission({ role: 'LAB_MANAGER' }, 'DELETE_SAMPLE')).toBe(false);

        // Lab Technician permissions
        expect(hasPermission({ role: 'LAB_TECHNICIAN' }, 'ENTER_RESULTS')).toBe(true);
        expect(hasPermission({ role: 'LAB_TECHNICIAN' }, 'APPROVE_RESULTS')).toBe(false);
        expect(hasPermission({ role: 'LAB_TECHNICIAN' }, 'DISPOSE_SAMPLE')).toBe(false);

        // Null / undefined user
        expect(hasPermission(null, 'VIEW_SAMPLES')).toBe(false);
        expect(hasPermission({}, 'VIEW_SAMPLES')).toBe(false);
    });

    test('2. sampleController.js contains 0 occurrences of includes(user.role)', () => {
        const controllerPath = path.resolve(__dirname, '../../controllers/sampleController.js');
        const code = fs.readFileSync(controllerPath, 'utf8');

        const inlineRoleChecks = code.match(/\.includes\(\s*user\.role\s*\)/g);
        expect(inlineRoleChecks).toBeNull();
    });

    test('3. No role map contains blacklisted legacy sample states', () => {
        const controllerPath = path.resolve(__dirname, '../../controllers/sampleController.js');
        const code = fs.readFileSync(controllerPath, 'utf8');

        // Extract STATUS_REQUIRED_PERMISSIONS map
        const mapMatch = code.match(/const STATUS_REQUIRED_PERMISSIONS = \{([\s\S]*?)\};/);
        expect(mapMatch).not.toBeNull();

        const mapBody = mapMatch[1];
        for (const legacyState of workflowContract.LEGACY_SAMPLE_STATUSES) {
            const regex = new RegExp(`['"]${legacyState}['"]\\s*:`);
            expect(regex.test(mapBody)).toBe(false);
        }
    });
});
