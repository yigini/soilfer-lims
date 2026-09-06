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

const LazyFallback = () => (
    <div className="flex items-center justify-center min-h-[50vh] p-8">
        <div className="flex flex-col items-center gap-3 text-emerald-600 dark:text-emerald-400">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading View...</span>
        </div>
    </div>
);

import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import Footer from './components/Footer';

// --- Layout Component ---
const Layout = ({ children }) => {
    const location = useLocation();
    const { user } = useAuth();
    const { t } = useLanguage();
    const { theme, darkMode } = useTheme();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

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
        navItems.push({ icon: Monitor, label: t('nav.equipment'), path: '/equipment' });
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
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden text-gray-900 dark:text-gray-100 font-sans">
            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                ${sidebarWidth} bg-white dark:bg-gray-800 flex flex-col fixed h-full z-50 transition-all duration-300 border-r border-gray-200 dark:border-gray-700 shadow-lg font-sans
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
                    {sidebarCollapsed ? (
                        <img 
                            src="/assets/img/soilfer-logo.png" 
                            alt="SoilFER" 
                            className="h-8 w-8 object-contain mx-auto" 
                        />
                    ) : (
                        <img 
                            src={siteLogo} 
                            alt="SoilFER LIMS" 
                            className="h-10 w-auto object-contain transition-all duration-200" 
                            onError={(e) => { e.target.onerror = null; e.target.src = defaultSiteLogo; }} 
                        />
                    )}
                    <button className="md:hidden p-2 text-gray-500" onClick={() => setIsSidebarOpen(false)}>
                        <X size={20} />
                    </button>
                </div>
                <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-4'} space-y-1 overflow-y-auto sidebar-scroll`}>
                    {navItems.map((item) => {
                        const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsSidebarOpen(false)}
                                className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition-all ${isActive ? 'bg-emerald-700 dark:bg-emerald-800 text-white shadow-md' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                title={sidebarCollapsed ? item.label : undefined}
                            >
                                <item.icon size={20} />
                                {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>
                {/* Collapse toggle (desktop only) */}
                <div className="hidden md:block border-t border-gray-200 dark:border-gray-700 p-2">
                    <button
                        onClick={toggleCollapse}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all text-sm"
                        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /><span className="font-medium">Collapse</span></>}
                    </button>
                </div>
            </aside>

            <div className="flex-1 flex flex-col min-w-0">
                <Header onMenuClick={() => setIsSidebarOpen(true)} />

                <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 md:ml-0 pt-16 mt-0">
                    <div className={`p-4 md:p-8 ${marginClass} transition-all duration-300 min-h-[calc(100vh-8rem)]`}>
                        {children}
                    </div>
                    <div className={marginClass}>
                        <Footer />
                    </div>
                </main>
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
            <Layout>
                <React.Suspense fallback={<LazyFallback />}>
                    {children}
                </React.Suspense>
                <NotificationDrawer />
            </Layout>
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
            <Route path="/samples/:id/map" element={<RequireAuth><React.Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}><SampleWorkflowMap /></React.Suspense></RequireAuth>} />
            <Route path="/workflow-map" element={<RequireAuth><React.Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}><SampleWorkflowMap /></React.Suspense></RequireAuth>} />

            {/* Restricted Routes */}
            <Route path="/my-work" element={<RequireAuth permission="ENTER_RESULTS"><MyWork /></RequireAuth>} />
            <Route path="/workbench" element={<RequireAuth permission="ENTER_RESULTS"><TechWorkbench /></RequireAuth>} />
            <Route path="/manager-queue" element={<RequireAuth permission="APPROVE_RESULTS"><ManagerQueue /></RequireAuth>} />
            <Route path="/reception" element={<RequireAuth permission="RECEIVE_SAMPLE"><Reception /></RequireAuth>} />

            <Route path="/inventory" element={<RequireAuth permission="VIEW_INVENTORY"><Inventory /></RequireAuth>} />
            <Route path="/equipment" element={<RequireAuth permission="MANAGE_ANALYSES"><Equipment /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth permission="MANAGE_USERS"><Users /></RequireAuth>} />
            <Route path="/projects" element={<RequireAuth permission="MANAGE_PROJECTS"><Projects /></RequireAuth>} />

            <Route path="/admin" element={<RequireAuth permission="MANAGE_ANALYSES"><AdminPanel /></RequireAuth>} />
            <Route path="/admin/methods" element={<RequireAuth permission="MANAGE_ANALYSES"><LabMethods /></RequireAuth>} />
            <Route path="/lab-methods" element={<RequireAuth permission="MANAGE_ANALYSES"><LabMethods /></RequireAuth>} />
            <Route path="/admin/audit" element={<RequireAuth permission="VIEW_AUDIT"><AuditLogs /></RequireAuth>} />
            <Route path="/admin/labs" element={<RequireAuth requiredRole="SUPER_ADMIN"><LabManagement /></RequireAuth>} />
            <Route path="/admin/legacy-import" element={<RequireAuth permission="RECEIVE_SAMPLES"><LegacyImport /></RequireAuth>} />

            {/* General Access */}
            <Route path="/datasheet" element={<RequireAuth><DataSheet /></RequireAuth>} />
            <Route path="/maps" element={<RequireAuth><CountryData /></RequireAuth>} />
            <Route path="/qa" element={<RequireAuth><QADashboard /></RequireAuth>} />
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

            {/* Catch-All 404 Route */}
            <Route path="*" element={<React.Suspense fallback={<LazyFallback />}><NotFound /></React.Suspense>} />
        </Routes>
    );
}

export default App;
