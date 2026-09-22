/**
 * Canonical Navigation Configuration & Journey Builder (#115)
 *
 * Implements canonical laboratory journey order:
 * 1. Reception / Intake (/reception)
 * 2. Samples Registry (/samples)
 * 3. Technician Work & Workbench (/my-work, /workbench)
 * 4. Manager Task List (/manager-queue)
 * 5. Quality Assurance (/qa)
 * 6. Result Reports (/result-reports)
 * 7. Supporting Modules (Spectral, Inventory, Equipment, Projects, Admin, About)
 */

export function buildNavItems(user, t = (k, d) => d, icons = {}) {
    const {
        LayoutDashboard,
        Package,
        TestTube2,
        ClipboardList,
        Beaker,
        ShieldAlert,
        FileText,
        Activity,
        Monitor,
        FileSpreadsheet,
        Table,
        User,
        Settings,
        Info
    } = icons;

    const navItems = [
        { icon: LayoutDashboard, label: t('nav.dashboard', 'Dashboard'), path: '/' },
    ];

    // 1. Projects (placed second after Dashboard for management and oversight roles — #115)
    if (['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'AUDIT_USER'].includes(user?.role)) {
        navItems.push({ icon: FileSpreadsheet, label: t('nav.projects', 'Projects'), path: '/projects' });
    }

    // 2. Reception / Intake (Physical receipt and check-in)
    if (['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ icon: Package, label: t('nav.reception', 'Sample Reception'), path: '/reception' });
    }

    // 3. Samples Registry
    navItems.push({ icon: TestTube2, label: t('nav.samples', 'Samples'), path: '/samples' });

    // 4. Technician Work & Workbench
    if (user?.role === 'LAB_TECHNICIAN') {
        navItems.push({ icon: ClipboardList, label: t('nav.myWork', 'My Work'), path: '/my-work' });
        navItems.push({ icon: Beaker, label: t('nav.workbench', 'Workbench'), path: '/workbench' });
    }

    // 5. Manager Task List (#116, #120)
    if (['LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ icon: ShieldAlert, label: t('nav.managerQueue', 'Manager Task List'), path: '/manager-queue' });
    }

    // 6. Quality Assurance & Audit view
    if (['AUDIT_USER', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ icon: ShieldAlert, label: t('nav.qa', 'Quality Assurance'), path: '/qa' });
    }

    // 7. Data Results (between QA and Result Reports for authorized roles — #115)
    if (['SUPER_ADMIN', 'PROJECT_MANAGER', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ icon: Table, label: t('nav.dataResults', 'Data Results'), path: '/data-results' });
    }

    // 8. Result Reports
    navItems.push({ icon: FileText, label: t('nav.reports', 'Result Reports'), path: '/result-reports' });

    // 9. Supporting Modules (Spectral, Inventory, Equipment, Projects for remaining roles, Management)
    if (user?.role !== 'SAMPLE_RECEPTION') {
        navItems.push({ icon: Activity, label: t('nav.spectral', 'Spectral Library'), path: '/spectral-library' });
    }

    // Inventory — visible to technicians (view-only) + managers + admin
    if (['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'MASTER_USER'].includes(user?.role)) {
        navItems.push({ icon: Package, label: t('nav.inventory', 'Inventory'), path: '/inventory' });
    }

    // Equipment — visible to technicians, managers, reception, and audit users
    if (['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'AUDIT_USER'].includes(user?.role)) {
        navItems.push({ icon: Monitor, label: t('nav.equipment', 'Equipment'), path: '/equipment' });
    }

    // Projects for roles where it is not placed second (#115)
    if (['SAMPLE_RECEPTION', 'LAB_TECHNICIAN'].includes(user?.role)) {
        navItems.push({ icon: FileSpreadsheet, label: t('nav.projects', 'Projects'), path: '/projects' });
    }

    if (['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ icon: User, label: t('nav.labStaff', 'Laboratory Staff'), path: '/users' });
    }

    if (['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({
            icon: Beaker,
            label: user?.role === 'LAB_MANAGER' ? t('nav.myLab', 'My Laboratory') : t('nav.labs', 'Laboratories'),
            path: user?.role === 'LAB_MANAGER' && user?.labId ? `/admin/labs?labId=${user.labId}` : '/admin/labs'
        });
    }

    if (['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ icon: Settings, label: t('nav.admin', 'Admin Panel'), path: '/admin' });
    }

    // General Information
    navItems.push({ icon: Info, label: t('nav.about', 'About SoilFER'), path: '/about' });

    return navItems;
}
