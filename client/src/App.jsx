import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    TestTube2,
    FileSpreadsheet,
    FileText,
    Settings,
    User,
    Package,
    Monitor,
    Activity,
    Beaker,
    ClipboardList,
    ShieldAlert,
    Menu,
    X,
    Table,
    UserPlus,
    PanelLeftClose,
    PanelLeftOpen,
    Info,
    Loader2
} from 'lucide-react';

// Core immediate pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Samples from './pages/Samples';
import SampleDetail from './pages/SampleDetail';

// Lazy-loaded secondary pages
const Projects = React.lazy(() => import('./pages/Projects'));
const Inventory = React.lazy(() => import('./pages/Inventory'));
const Equipment = React.lazy(() => import('./pages/Equipment'));
const Reception = React.lazy(() => import('./pages/Reception'));
const SpectralLibrary = React.lazy(() => import('./pages/SpectralLibrary'));
const ResultReports = React.lazy(() => import('./pages/ResultReports'));
const PublicReport = React.lazy(() => import('./pages/PublicReport'));
const AdminPanel = React.lazy(() => import('./pages/AdminPanel'));
const LabManagement = React.lazy(() => import('./pages/admin/LabManagement'));
const AuditLogs = React.lazy(() => import('./pages/AuditLogs'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Users = React.lazy(() => import('./pages/Users'));
const DataSheet = React.lazy(() => import('./pages/DataSheet'));
const DataResults = React.lazy(() => import('./pages/DataResults'));
const CountryData = React.lazy(() => import('./pages/CountryData'));
const QADashboard = React.lazy(() => import('./pages/QADashboard'));
const MyWork = React.lazy(() => import('./pages/MyWork'));
const TechWorkbench = React.lazy(() => import('./pages/TechWorkbench'));
const ManagerQueue = React.lazy(() => import('./pages/ManagerQueue'));
const About = React.lazy(() => import('./pages/About'));
const TechStack = React.lazy(() => import('./pages/TechStack'));
const SampleWorkflowMap = React.lazy(() => import('./pages/SampleWorkflowMap'));
const LabMethods = React.lazy(() => import('./pages/admin/LabMethods'));
const LegacyImport = React.lazy(() => import('./pages/admin/LegacyImport'));
const NotFound = React.lazy(() => import('./pages/NotFound'));
const ScanPage = React.lazy(() => import('./pages/ScanPage'));
const HelpCentre = React.lazy(() => import('./pages/help/HelpCentre'));
const FAQPage = React.lazy(() => import('./pages/help/FAQPage'));
const ArticleReader = React.lazy(() => import('./pages/help/ArticleReader'));
const TopicExplorer = React.lazy(() => import('./pages/help/TopicExplorer'));
const AdminHelpEditor = React.lazy(() => import('./pages/help/AdminHelpEditor'));

const LazyFallback = () => (
    <div className="flex items-center justify-center min-h-[50vh] p-8">
        <div className="flex flex-col items-center gap-3 text-sf-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs font-bold text-sf-muted uppercase tracking-widest">Loading View...</span>
        </div>
    </div>
);

import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import { SyncProvider } from './context/SyncContext';
import { HelpProvider } from './context/HelpContext';
import { Header } from './components/Header';
import Footer from './components/Footer';
import { MobileHeader } from './components/mobile/MobileHeader';
import { MobileNavBar } from './components/mobile/MobileNavBar';
import { MobileMoreSheet } from './components/mobile/MobileMoreSheet';
import { SyncCentreModal } from './components/mobile/SyncCentreModal';
import { ContextHelpDrawer } from './components/help/ContextHelpDrawer';

// --- Layout Component ---
const Layout = ({ children }) => {
    const location = useLocation();
    const { user } = useAuth();
    const { t } = useLanguage();
    const { theme, darkMode } = useTheme();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const [isMoreSheetOpen, setIsMoreSheetOpen] = React.useState(false);

    // Determine site logo: custom lab logo or official SoilFER LIMS brand logo (light/dark)
    const isCustomLogo = theme?.logoUrl && !theme.logoUrl.includes('/assets/img/soilfer-logo') && !theme.logoUrl.includes('/assets/img/logo') && !theme.logoUrl.endsWith('/logo.png') && !theme.logoUrl.includes('fao_logo');
    const defaultSiteLogo = darkMode ? '/assets/img/logo-dark.png' : '/assets/img/logo-light.png';
    const siteLogo = isCustomLogo ? theme.logoUrl : defaultSiteLogo;
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
        const saved = localStorage.getItem('sidebar-collapsed');
        if (saved !== null) return saved === 'true';
        return location.pathname === '/workbench';
    });

    const toggleCollapse = () => {
        setSidebarCollapsed(prev => {
            const next = !prev;
            try { localStorage.setItem('sidebar-collapsed', String(next)); } catch { }
            return next;
        });
    };

    const navItems = [
        { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/' },
        { icon: TestTube2, label: t('nav.samples'), path: '/samples' },
    ];

    // ROLE-BASED NAVIGATION

    // 1. TECHNICIAN
    if (user?.role === 'LAB_TECHNICIAN') {
        navItems.push({ icon: ClipboardList, label: t('nav.myWork', 'My Work'), path: '/my-work' });
        navItems.push({ icon: Beaker, label: t('nav.workbench', 'Workbench'), path: '/workbench' });
    }

    // 2. MANAGER
    if (['LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ icon: ShieldAlert, label: t('nav.managerQueue', 'Manager Queue'), path: '/manager-queue' });
    }

    // 3. INTAKE
    if (['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ icon: Package, label: t('nav.reception'), path: '/reception' });
    }

    // GENERAL
    if (user?.role !== 'SAMPLE_RECEPTION') {
        navItems.push({ icon: Activity, label: t('nav.spectral'), path: '/spectral-library' });
    }
    navItems.push({ icon: FileText, label: t('nav.reports', 'Result Reports'), path: '/result-reports' });

    if (['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ icon: User, label: t('nav.labStaff', 'Laboratory Staff'), path: '/users' });
    }

    // Equipment — visible to technicians, managers, reception, and audit users
    if (['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'AUDIT_USER'].includes(user?.role)) {
        navItems.push({ icon: Monitor, label: t('nav.equipment'), path: '/equipment' });
    }

    // QA & Audit view
    if (['AUDIT_USER', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ icon: ShieldAlert, label: t('nav.qa', 'Quality Assurance'), path: '/qa' });
    }

    // Inventory — visible to technicians (view-only) + managers + admin
    if (['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'MASTER_USER'].includes(user?.role)) {
        navItems.push({ icon: Package, label: t('nav.inventory'), path: '/inventory' });
    }

    if (['SUPER_ADMIN', 'PROJECT_MANAGER', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ icon: FileSpreadsheet, label: t('nav.projects'), path: '/projects' });
        navItems.push({ icon: Table, label: t('nav.dataResults', 'Data Results'), path: '/data-results' });

    }

    if (['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role)) {
        if (user?.role === 'SUPER_ADMIN') {
            navItems.push({ icon: Beaker, label: t('nav.labs'), path: '/admin/labs' });
        }
        navItems.push({ icon: Settings, label: t('nav.admin'), path: '/admin' });
    }

    // General Information
    navItems.push({ icon: Info, label: t('nav.about', 'About SoilFER'), path: '/about' });

    const sidebarWidth = sidebarCollapsed ? 'w-16' : 'w-64';
    const marginClass = sidebarCollapsed ? 'md:ml-16' : 'md:ml-64';

    return (
        <div className="flex h-screen bg-sf-canvas overflow-hidden text-sf-text font-sans">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                ${sidebarWidth} bg-[var(--sf-sidebar)] text-[var(--sf-side-text)] flex flex-col fixed h-full z-50 transition-all duration-300 border-r border-black/20 shadow-md font-sans
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
                    {sidebarCollapsed ? (
                        <img 
                            src="/assets/img/soilfer-logo-white.png" 
                            alt="SoilFER" 
                            className="h-8 w-8 object-contain mx-auto" 
                            onError={(e) => { e.target.onerror = null; e.target.src = '/assets/img/soilfer-logo.png'; }}
                        />
                    ) : (
                        <img 
                            src={isCustomLogo ? theme.logoUrl : '/assets/img/logo-dark.png'} 
                            alt="SoilFER LIMS" 
                            className="h-10 w-auto object-contain transition-all duration-200" 
                            onError={(e) => { e.target.onerror = null; e.target.src = '/assets/img/logo-dark.png'; }} 
                        />
                    )}
                    <button className="md:hidden p-2 text-[var(--sf-side-muted)] hover:text-[var(--sf-side-text)]" onClick={() => setIsSidebarOpen(false)}>
                        <X size={20} />
                    </button>
                </div>
                <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-3'} space-y-1 overflow-y-auto sidebar-scroll`}>
                    {navItems.map((item) => {
                        const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-3.5'} py-2.5 rounded-lg text-sm transition-all ${
                                    isActive
                                        ? 'bg-[var(--sf-side-active)] text-[var(--sf-side-text)] font-semibold shadow-[inset_3px_0_0_var(--sf-primary)]'
                                        : 'text-[var(--sf-side-muted)] hover:text-[var(--sf-side-text)] hover:bg-[var(--sf-side-active)]/60'
                                }`}
                                title={sidebarCollapsed ? item.label : undefined}
                            >
                                <item.icon size={19} className={isActive ? 'text-[var(--sf-primary)]' : 'text-[var(--sf-side-muted)]'} />
                                {!sidebarCollapsed && <span className="font-medium truncate">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>
                {/* Collapse toggle (desktop only) */}
                <div className="hidden md:block border-t border-white/10 p-2">
                    <button
                        onClick={toggleCollapse}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[var(--sf-side-muted)] hover:text-[var(--sf-side-text)] hover:bg-[var(--sf-side-active)]/50 transition-all text-xs font-semibold"
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /><span>Collapse</span></>}
                    </button>
                </div>
                {/* Decorative Soil-Band Branding (Signature Identity) */}
                <div className="sf-soil-bands w-full" aria-hidden="true" />
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
                {/* Desktop Top Header (hidden on mobile) */}
                <div className="hidden md:block">
                    <Header onMenuClick={() => setIsSidebarOpen(true)} />
                </div>

                {/* Mobile Top Header (hidden on desktop) */}
                <MobileHeader onMenuClick={() => setIsMoreSheetOpen(true)} />

                <main className="flex-1 overflow-auto bg-sf-canvas md:ml-0 pt-14 md:pt-16 mt-0">
                    <div className={`p-3 md:p-8 ${marginClass} transition-all duration-300 min-h-[calc(100vh-8rem)] pb-24 md:pb-8`}>
                        {children}
                    </div>
                    <div className={`${marginClass} hidden md:block`}>
                        <Footer />
                    </div>
                </main>

                {/* Mobile Bottom Navigation Bar (hidden on desktop) */}
                <MobileNavBar onMoreClick={() => setIsMoreSheetOpen(true)} />

                {/* Mobile Full-Height Drawer (hidden on desktop) */}
                <MobileMoreSheet isOpen={isMoreSheetOpen} onClose={() => setIsMoreSheetOpen(false)} />

                {/* Laboratory Sync Centre Modal */}
                <SyncCentreModal />
            </div>
        </div>
    );
};

import ForcePasswordChangeModal from './components/ForcePasswordChangeModal';

import { NotificationProvider } from './context/NotificationContext';
import NotificationDrawer from './components/NotificationDrawer';

const RequireAuth = ({ children, permission, requiredRole }) => {
    const { user, hasPermission } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Global intercept for password change
    if (user.mustChangePassword) {
        return (
            <NotificationProvider>
                <ForcePasswordChangeModal />
                <div className="filter blur-sm pointer-events-none select-none h-screen overflow-hidden">
                    <Layout>{children}</Layout>
                </div>
            </NotificationProvider>
        );
    }

    // Role/Permission Check
    if (permission && !hasPermission(permission)) {
        return <Navigate to="/" replace />;
    }

    if (requiredRole && user.role !== requiredRole && user.role !== 'SUPER_ADMIN') {
        return <Navigate to="/" replace />;
    }

    return (
        <NotificationProvider>
            <SyncProvider>
                <HelpProvider>
                    <Layout>
                        <React.Suspense fallback={<LazyFallback />}>
                            {children}
                        </React.Suspense>
                        <NotificationDrawer />
                        <ContextHelpDrawer />
                    </Layout>
                </HelpProvider>
            </SyncProvider>
        </NotificationProvider>
    );
};

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/samples" element={<RequireAuth><Samples /></RequireAuth>} />
            <Route path="/samples/:id" element={<RequireAuth><SampleDetail /></RequireAuth>} />
            <Route path="/scan" element={<RequireAuth><React.Suspense fallback={<LazyFallback />}><ScanPage /></React.Suspense></RequireAuth>} />
            <Route path="/samples/:id/map" element={<RequireAuth><React.Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}><SampleWorkflowMap /></React.Suspense></RequireAuth>} />
            <Route path="/workflow-map" element={<RequireAuth><React.Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}><SampleWorkflowMap /></React.Suspense></RequireAuth>} />

            {/* Restricted Routes */}
            <Route path="/my-work" element={<RequireAuth permission="ENTER_RESULTS"><MyWork /></RequireAuth>} />
            <Route path="/workbench" element={<RequireAuth permission="ENTER_RESULTS"><TechWorkbench /></RequireAuth>} />
            <Route path="/manager-queue" element={<RequireAuth permission="APPROVE_RESULTS"><ManagerQueue /></RequireAuth>} />
            <Route path="/reception" element={<RequireAuth permission="RECEIVE_SAMPLE"><Reception /></RequireAuth>} />

            <Route path="/inventory" element={<RequireAuth permission="VIEW_INVENTORY"><Inventory /></RequireAuth>} />
            <Route path="/equipment" element={<RequireAuth permission="VIEW_EQUIPMENT"><Equipment /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth permission="MANAGE_USERS"><Users /></RequireAuth>} />
            <Route path="/projects" element={<RequireAuth permission="MANAGE_PROJECTS"><Projects /></RequireAuth>} />

            <Route path="/admin" element={<RequireAuth permission="MANAGE_ANALYSES"><AdminPanel /></RequireAuth>} />
            <Route path="/admin/methods" element={<RequireAuth permission="MANAGE_ANALYSES"><LabMethods /></RequireAuth>} />
            <Route path="/lab-methods" element={<RequireAuth permission="MANAGE_ANALYSES"><LabMethods /></RequireAuth>} />
            <Route path="/admin/audit" element={<RequireAuth permission="VIEW_AUDIT"><AuditLogs /></RequireAuth>} />
            <Route path="/admin/labs" element={<RequireAuth requiredRole="SUPER_ADMIN"><LabManagement /></RequireAuth>} />
            <Route path="/admin/legacy-import" element={<RequireAuth permission="RECEIVE_SAMPLE"><LegacyImport /></RequireAuth>} />

            {/* General Access */}
            <Route path="/datasheet" element={<RequireAuth><DataSheet /></RequireAuth>} />
            <Route path="/maps" element={<RequireAuth><CountryData /></RequireAuth>} />
            <Route path="/qa" element={<RequireAuth permission="VIEW_AUDIT"><QADashboard /></RequireAuth>} />
            <Route path="/spectral-library" element={<RequireAuth><SpectralLibrary /></RequireAuth>} />
            <Route path="/spectral" element={<RequireAuth><SpectralLibrary /></RequireAuth>} />
            <Route path="/data-results" element={<RequireAuth><DataResults /></RequireAuth>} />

            <Route path="/result-reports" element={<RequireAuth><ResultReports /></RequireAuth>} />
            <Route path="/reports" element={<Navigate to="/result-reports" replace />} />
            <Route path="/report/:token" element={<React.Suspense fallback={<LazyFallback />}><PublicReport /></React.Suspense>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />

            {/* Public Institutional & Technical Architecture Routes */}
            <Route path="/about" element={<React.Suspense fallback={<LazyFallback />}><About /></React.Suspense>} />
            <Route path="/techstack" element={<React.Suspense fallback={<LazyFallback />}><TechStack /></React.Suspense>} />
            <Route path="/tech-stack" element={<React.Suspense fallback={<LazyFallback />}><TechStack /></React.Suspense>} />
            <Route path="/credits" element={<React.Suspense fallback={<LazyFallback />}><TechStack /></React.Suspense>} />

            {/* Help Centre & Knowledge Base Routes */}
            <Route path="/help" element={<RequireAuth><HelpCentre /></RequireAuth>} />
            <Route path="/help/faq" element={<RequireAuth><FAQPage /></RequireAuth>} />
            <Route path="/faq" element={<Navigate to="/help/faq" replace />} />
            <Route path="/help/articles/:articleId" element={<RequireAuth><ArticleReader /></RequireAuth>} />
            <Route path="/help/topics/:topicId" element={<RequireAuth><TopicExplorer /></RequireAuth>} />
            <Route path="/admin/help" element={<RequireAuth permission="HELP_EDIT_LAB"><AdminHelpEditor /></RequireAuth>} />

            {/* Catch-All 404 Route */}
            <Route path="*" element={<React.Suspense fallback={<LazyFallback />}><NotFound /></React.Suspense>} />
        </Routes>
    );
}

export default App;
