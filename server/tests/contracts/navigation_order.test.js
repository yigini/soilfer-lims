/**
 * Contract Tests: Canonical Laboratory Journey Navigation Order & Role Filtering (#115)
 *
 * Verifies:
 * 1. Canonical journey order: Reception -> Samples -> Workbench -> Manager Task List -> QA -> Result Reports
 * 2. Role-specific navigation filtering (SAMPLE_RECEPTION, LAB_TECHNICIAN, LAB_MANAGER, SUPER_ADMIN, AUDIT_USER)
 * 3. Route paths, access gates, and deep links remain preserved and stable.
 * 4. Manager Task List label and route binding (/manager-queue).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadClientModule(filePath) {
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/export\s+const\s+([a-zA-Z0-9_$]+)\s*=/g, 'const $1 = exports.$1 =');
    code = code.replace(/export\s+function\s+([a-zA-Z0-9_$]+)/g, 'exports.$1 = $1; function $1');
    const exportsObj = {};
    const context = {
        exports: exportsObj,
        module: { exports: exportsObj },
        console,
        Array,
        Object,
        String,
        Boolean
    };
    vm.runInNewContext(code, context);
    return context.exports;
}

const navConfigPath = path.resolve(__dirname, '../../../client/src/navigationConfig.js');
const { buildNavItems } = loadClientModule(navConfigPath);

function extractNavItemsForRole(user, t) {
    // Direct production caller execution of buildNavItems from client/src/navigationConfig (#115)
    return buildNavItems(user, t);
}

describe('Navigation Order & Laboratory Journey Contract (#115)', () => {
    test('1. navigationConfig.js and App.jsx reflect the canonical journey sequence order', () => {
        const appPath = path.resolve(__dirname, '../../../client/src/App.jsx');
        const appCode = fs.readFileSync(appPath, 'utf8');
        expect(appCode).toContain("import { buildNavItems } from './navigationConfig';");
        expect(appCode).toContain("buildNavItems(user, t");

        const configCode = fs.readFileSync(navConfigPath, 'utf8');
        // Check relative order of navigation additions in code
        const receptionIdx = configCode.indexOf("path: '/reception'");
        const samplesIdx = configCode.indexOf("path: '/samples'");
        const workbenchIdx = configCode.indexOf("path: '/workbench'");
        const managerQueueIdx = configCode.indexOf("path: '/manager-queue'");
        const qaIdx = configCode.indexOf("path: '/qa'");
        const reportsIdx = configCode.indexOf("path: '/result-reports'");

        expect(receptionIdx).toBeGreaterThan(0);
        expect(samplesIdx).toBeGreaterThan(receptionIdx);
        expect(workbenchIdx).toBeGreaterThan(samplesIdx);
        expect(managerQueueIdx).toBeGreaterThan(workbenchIdx);
        expect(qaIdx).toBeGreaterThan(managerQueueIdx);
        expect(reportsIdx).toBeGreaterThan(qaIdx);
    });

    test('2. SAMPLE_RECEPTION role sees Reception first followed by Samples and Reports', () => {
        const user = { id: 'u-rec', role: 'SAMPLE_RECEPTION', labId: 'lab-1' };
        const items = extractNavItemsForRole(user);
        const paths = items.map(i => i.path);

        expect(paths[0]).toBe('/');
        expect(paths[1]).toBe('/reception');
        expect(paths[2]).toBe('/samples');
        expect(paths).toContain('/result-reports');
        expect(paths).not.toContain('/workbench');
        expect(paths).not.toContain('/my-work');
        expect(paths).not.toContain('/manager-queue');
        expect(paths).not.toContain('/admin');
    });

    test('3. LAB_TECHNICIAN sees Samples followed by My Work and Workbench', () => {
        const user = { id: 'u-tech', role: 'LAB_TECHNICIAN', labId: 'lab-1' };
        const items = extractNavItemsForRole(user);
        const paths = items.map(i => i.path);

        expect(paths).not.toContain('/reception');
        expect(paths).toContain('/samples');
        expect(paths).toContain('/my-work');
        expect(paths).toContain('/workbench');
        expect(paths).not.toContain('/manager-queue');
        expect(paths).not.toContain('/qa');

        const samplesIdx = paths.indexOf('/samples');
        const myWorkIdx = paths.indexOf('/my-work');
        const workbenchIdx = paths.indexOf('/workbench');
        const reportsIdx = paths.indexOf('/result-reports');

        expect(myWorkIdx).toBeGreaterThan(samplesIdx);
        expect(workbenchIdx).toBeGreaterThan(myWorkIdx);
        expect(reportsIdx).toBeGreaterThan(workbenchIdx);
    });

    test('4. LAB_MANAGER sees complete management journey: Reception -> Samples -> Manager Task List -> QA -> Reports', () => {
        const user = { id: 'u-mgr', role: 'LAB_MANAGER', labId: 'lab-1' };
        const items = extractNavItemsForRole(user);
        const paths = items.map(i => i.path);

        const receptionIdx = paths.indexOf('/reception');
        const samplesIdx = paths.indexOf('/samples');
        const queueIdx = paths.indexOf('/manager-queue');
        const qaIdx = paths.indexOf('/qa');
        const reportsIdx = paths.indexOf('/result-reports');

        expect(receptionIdx).toBeGreaterThan(0);
        expect(samplesIdx).toBeGreaterThan(receptionIdx);
        expect(queueIdx).toBeGreaterThan(samplesIdx);
        expect(qaIdx).toBeGreaterThan(queueIdx);
        expect(reportsIdx).toBeGreaterThan(qaIdx);

        // Manager Task List label
        const queueItem = items.find(i => i.path === '/manager-queue');
        expect(queueItem.label).toBe('Manager Task List');
    });

    test('5. SUPER_ADMIN possesses complete laboratory and administrative scope', () => {
        const user = { id: 'u-admin', role: 'SUPER_ADMIN' };
        const items = extractNavItemsForRole(user);
        const paths = items.map(i => i.path);

        expect(paths).toContain('/reception');
        expect(paths).toContain('/samples');
        expect(paths).toContain('/manager-queue');
        expect(paths).toContain('/qa');
        expect(paths).toContain('/result-reports');
        expect(paths).toContain('/admin');
        expect(paths).toContain('/users');
    });

    test('6. Projects placed second and Data Results placed between QA and Reports for authorized roles (#115)', () => {
        const managerUser = { id: 'u-mgr', role: 'LAB_MANAGER', labId: 'lab-1' };
        const managerItems = extractNavItemsForRole(managerUser);
        const managerPaths = managerItems.map(i => i.path);

        expect(managerPaths[0]).toBe('/');
        expect(managerPaths[1]).toBe('/projects');

        const qaIdx = managerPaths.indexOf('/qa');
        const dataResultsIdx = managerPaths.indexOf('/data-results');
        const reportsIdx = managerPaths.indexOf('/result-reports');

        expect(qaIdx).toBeGreaterThan(0);
        expect(dataResultsIdx).toBeGreaterThan(qaIdx);
        expect(reportsIdx).toBeGreaterThan(dataResultsIdx);

        // Also check SUPER_ADMIN
        const adminUser = { id: 'u-admin', role: 'SUPER_ADMIN' };
        const adminItems = extractNavItemsForRole(adminUser);
        const adminPaths = adminItems.map(i => i.path);
        expect(adminPaths[1]).toBe('/projects');
        expect(adminPaths.indexOf('/data-results')).toBeGreaterThan(adminPaths.indexOf('/qa'));
        expect(adminPaths.indexOf('/result-reports')).toBeGreaterThan(adminPaths.indexOf('/data-results'));
    });

    test('7. Role-specific Workbench and MyLab are preserved without removing required workflows (#115)', () => {
        const techUser = { id: 'u-tech', role: 'LAB_TECHNICIAN', labId: 'lab-1' };
        const techItems = extractNavItemsForRole(techUser);
        const techPaths = techItems.map(i => i.path);
        expect(techPaths).toContain('/workbench');
        expect(techPaths).toContain('/my-work');

        const managerUser = { id: 'u-mgr', role: 'LAB_MANAGER', labId: 'lab-1' };
        const managerItems = extractNavItemsForRole(managerUser);
        const myLabItem = managerItems.find(i => i.path && i.path.startsWith('/admin/labs'));
        expect(myLabItem).toBeDefined();
        expect(myLabItem.path).toBe('/admin/labs?labId=lab-1');
    });
});
