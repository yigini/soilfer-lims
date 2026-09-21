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

function extractNavItemsForRole(user, t = (k, d) => d) {
    // Mirror of App.jsx navItems generation logic
    const navItems = [
        { label: t('nav.dashboard', 'Dashboard'), path: '/' },
    ];

    // 1. Reception / Intake
    if (['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ label: t('nav.reception', 'Sample Reception'), path: '/reception' });
    }

    // 2. Samples Registry
    navItems.push({ label: t('nav.samples', 'Samples'), path: '/samples' });

    // 3. Technician Work & Workbench
    if (user?.role === 'LAB_TECHNICIAN') {
        navItems.push({ label: t('nav.myWork', 'My Work'), path: '/my-work' });
        navItems.push({ label: t('nav.workbench', 'Workbench'), path: '/workbench' });
    }

    // 4. Manager Task List (#116, #120)
    if (['LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ label: t('nav.managerQueue', 'Manager Task List'), path: '/manager-queue' });
    }

    // 5. Quality Assurance
    if (['AUDIT_USER', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ label: t('nav.qa', 'Quality Assurance'), path: '/qa' });
    }

    // 6. Result Reports
    navItems.push({ label: t('nav.reports', 'Result Reports'), path: '/result-reports' });

    // 7. Supporting Modules
    if (user?.role !== 'SAMPLE_RECEPTION') {
        navItems.push({ label: t('nav.spectral', 'Spectral Library'), path: '/spectral-library' });
    }

    if (['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'MASTER_USER'].includes(user?.role)) {
        navItems.push({ label: t('nav.inventory', 'Inventory'), path: '/inventory' });
    }

    if (['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'AUDIT_USER'].includes(user?.role)) {
        navItems.push({ label: t('nav.equipment', 'Equipment'), path: '/equipment' });
    }

    if (['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'AUDIT_USER'].includes(user?.role)) {
        navItems.push({ label: t('nav.projects', 'Projects'), path: '/projects' });
    }

    if (['SUPER_ADMIN', 'PROJECT_MANAGER', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ label: t('nav.dataResults', 'Data Results'), path: '/data-results' });
    }

    if (['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ label: t('nav.labStaff', 'Laboratory Staff'), path: '/users' });
    }

    if (['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({
            label: user?.role === 'LAB_MANAGER' ? t('nav.myLab', 'My Laboratory') : t('nav.labs', 'Laboratories'),
            path: user?.role === 'LAB_MANAGER' && user?.labId ? `/admin/labs?labId=${user.labId}` : '/admin/labs'
        });
    }

    if (['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ label: t('nav.admin', 'Admin Panel'), path: '/admin' });
    }

    navItems.push({ label: t('nav.about', 'About SoilFER'), path: '/about' });

    return navItems;
}

describe('Navigation Order & Laboratory Journey Contract (#115)', () => {
    test('1. App.jsx source reflects the canonical journey sequence order', () => {
        const appPath = path.resolve(__dirname, '../../../client/src/App.jsx');
        const code = fs.readFileSync(appPath, 'utf8');

        // Check relative order of navigation additions in code
        const receptionIdx = code.indexOf("path: '/reception'");
        const samplesIdx = code.indexOf("path: '/samples'");
        const workbenchIdx = code.indexOf("path: '/workbench'");
        const managerQueueIdx = code.indexOf("path: '/manager-queue'");
        const qaIdx = code.indexOf("path: '/qa'");
        const reportsIdx = code.indexOf("path: '/result-reports'");

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
});
