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
    PanelLeftOpen
} from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Samples from './pages/Samples';
import DataSheet from './pages/DataSheet';
import CountryData from './pages/CountryData';
import QADashboard from './pages/QADashboard';
import Inventory from './pages/Inventory';
import Equipment from './pages/Equipment';
import Reception from './pages/Reception';
import AdminPanel from './pages/AdminPanel';
import SpectralLibrary from './pages/SpectralLibrary';
import SampleDetail from './pages/SampleDetail';
import Users from './pages/Users';
import Projects from './pages/Projects';
import LabManagement from './pages/admin/LabManagement';
import Reports from './pages/Reports';
import MyWork from './pages/MyWork';
import TechWorkbench from './pages/TechWorkbench';
import ManagerQueue from './pages/ManagerQueue';
import AuditLogs from './pages/AuditLogs';
import Profile from './pages/Profile';
import DataResults from './pages/DataResults';

import { useTheme } from './context/ThemeContext';
import { useLanguage } from './context/LanguageContext';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import Footer from './components/Footer';
import Credits from './pages/Credits';

// --- Layout Component ---
const Layout = ({ children }) => {
    const location = useLocation();
    const { user } = useAuth();
    const { t } = useLanguage();
    const { theme } = useTheme();
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = React.useState(location.pathname === '/workbench');

    // Auto-collapse only on workbench, expand on all other pages
    React.useEffect(() => {
        const isWorkbench = location.pathname === '/workbench';
        setSidebarCollapsed(isWorkbench);
    }, [location.pathname]);

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
        navItems.push({ icon: ClipboardList, label: 'My Work', path: '/my-work' });
        navItems.push({ icon: Beaker, label: 'Workbench', path: '/workbench' });
    }

    // 2. MANAGER
    if (['LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ icon: ShieldAlert, label: 'Manager Queue', path: '/manager-queue' });
    }

    // 3. INTAKE
    if (['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        navItems.push({ icon: Package, label: t('nav.reception'), path: '/reception' });
        if (user?.role === 'SAMPLE_RECEPTION') {
            navItems.push({ icon: UserPlus, label: 'Walk-in Intake', path: '/reception?mode=WALK_IN' });
        }
    }

    // GENERAL
    if (user?.role !== 'SAMPLE_RECEPTION') {
        navItems.push({ icon: Activity, label: t('nav.spectral'), path: '/spectral-library' });
    }
    navItems.push({ icon: FileText, label: 'Reports', path: '/reports' });

    if (['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ icon: User, label: 'Laboratory Staff', path: '/users' });
        navItems.push({ icon: Monitor, label: t('nav.equipment'), path: '/equipment' });
    }

    // Inventory — visible to technicians (view-only) + managers + admin
    if (['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'MASTER_USER'].includes(user?.role)) {
        navItems.push({ icon: Package, label: t('nav.inventory'), path: '/inventory' });
    }

    if (['SUPER_ADMIN', 'PROJECT_MANAGER', 'LAB_MANAGER'].includes(user?.role)) {
        navItems.push({ icon: FileSpreadsheet, label: t('nav.projects'), path: '/projects' });
        navItems.push({ icon: Table, label: 'Data Results', path: '/data-results' });

    }

    if (['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role)) {
        if (user?.role === 'SUPER_ADMIN') {
            navItems.push({ icon: Beaker, label: 'Labs', path: '/admin/labs' });
        }
        navItems.push({ icon: Settings, label: t('nav.admin'), path: '/admin' });
    }

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
                    {!sidebarCollapsed && (
                        <img src={['SUPER_ADMIN', 'MASTER_USER'].includes(user?.role) ? '/assets/img/logo.png' : (theme.logoUrl || '/assets/img/logo.png')} alt="Lab Logo" className="h-10 w-auto object-contain dark:drop-shadow-[0_0_30px_rgba(255,255,255,0.8)] dark:brightness-125" />
                    )}
                    <button className="md:hidden p-2 text-gray-500" onClick={() => setIsSidebarOpen(false)}>
                        <X size={20} />
                    </button>
                </div>
                <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-4'} space-y-1 overflow-y-auto sidebar-scroll`}>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
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
                {children}
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

            {/* Restricted Routes */}
            <Route path="/my-work" element={<RequireAuth permission="ENTER_RESULTS"><MyWork /></RequireAuth>} />
            <Route path="/workbench" element={<RequireAuth permission="ENTER_RESULTS"><TechWorkbench /></RequireAuth>} />
            <Route path="/manager-queue" element={<RequireAuth permission="APPROVE_RESULTS"><ManagerQueue /></RequireAuth>} />
            <Route path="/reception" element={<RequireAuth permission="RECEIVE_SAMPLE"><Reception /></RequireAuth>} />

            <Route path="/inventory" element={<RequireAuth permission="VIEW_INVENTORY"><Inventory /></RequireAuth>} />
            <Route path="/equipment" element={<RequireAuth permission="MANAGE_ANALYSES"><Equipment /></RequireAuth>} />
            <Route path="/users" element={<RequireAuth permission="MANAGE_USERS"><Users /></RequireAuth>} />
            <Route path="/projects" element={<RequireAuth permission="MANAGE_PROJECTS"><Projects /></RequireAuth>} />

            <Route path="/admin" element={<RequireAuth permission="MANAGE_BRANDING"><AdminPanel /></RequireAuth>} />
            <Route path="/admin/audit" element={<RequireAuth permission="MANAGE_USERS"><AuditLogs /></RequireAuth>} />
            <Route path="/admin/labs" element={<RequireAuth requiredRole="SUPER_ADMIN"><LabManagement /></RequireAuth>} />

            {/* General Access */}
            <Route path="/datasheet" element={<RequireAuth><DataSheet /></RequireAuth>} />
            <Route path="/maps" element={<RequireAuth><CountryData /></RequireAuth>} />
            <Route path="/qa" element={<RequireAuth><QADashboard /></RequireAuth>} />
            <Route path="/spectral-library" element={<RequireAuth><SpectralLibrary /></RequireAuth>} />
            <Route path="/spectral" element={<RequireAuth><SpectralLibrary /></RequireAuth>} />
            <Route path="/data-results" element={<RequireAuth><DataResults /></RequireAuth>} />

            <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/credits" element={<RequireAuth><Credits /></RequireAuth>} />
        </Routes>
    );
}

export default App;
