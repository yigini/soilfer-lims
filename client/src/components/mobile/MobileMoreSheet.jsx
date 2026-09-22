import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    X,
    User,
    LogOut,
    Cloud,
    FileSpreadsheet,
    FileText,
    Settings,
    Package,
    Monitor,
    Activity,
    Beaker,
    ClipboardList,
    ShieldAlert,
    Table,
    Info,
    HelpCircle,
    ChevronRight,
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSync } from '../../context/SyncContext';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeToggle } from '../ThemeToggle';
import clsx from 'clsx';

export const MobileMoreSheet = ({ isOpen, onClose }) => {
    const { user, logout, hasPermission } = useAuth();
    const { t } = useLanguage();
    const { openSyncCentre, pendingCount, conflictCount, isOnline } = useSync();
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleNavigate = (path) => {
        onClose();
        navigate(path);
    };

    const handleLogout = () => {
        onClose();
        logout();
    };

    const handleOpenSync = () => {
        onClose();
        openSyncCentre();
    };

    return (
        <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn"
                onClick={onClose}
            />

            {/* Slide-over Sheet */}
            <div className="relative ml-auto w-full max-w-sm h-full bg-sf-surface border-l border-sf-divider flex flex-col shadow-2xl overflow-hidden z-10 animate-slideLeft">
                {/* Header: User Profile Card */}
                <div className="p-4 border-b border-sf-divider bg-sf-canvas">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                            Laboratory Navigation
                        </span>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-sf-muted hover:text-sf-text hover:bg-sf-hover"
                            aria-label="Close menu"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-sf-surface border border-sf-divider">
                        <div className="w-10 h-10 rounded-full bg-sf-primary/10 text-sf-primary flex items-center justify-center font-bold text-sm">
                            {user?.name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-sf-text truncate">
                                {user?.name || user?.username}
                            </div>
                            <div className="text-xs text-sf-muted truncate">
                                {user?.role} {user?.labId ? `• ${user.labId}` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Sync Centre Action Card */}
                <div className="p-4 border-b border-sf-divider bg-sf-inset">
                    <button
                        onClick={handleOpenSync}
                        className="w-full flex items-center justify-between p-3 rounded-xl border border-sf-divider bg-sf-surface hover:bg-sf-hover transition-colors text-left"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className={clsx(
                                "p-2 rounded-lg",
                                conflictCount > 0 ? "bg-amber-500/15 text-amber-600" : "bg-sf-primary/10 text-sf-primary"
                            )}>
                                <Cloud size={18} />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-sf-text">Offline & Sync Centre</div>
                                <div className="text-[11px] text-sf-muted">
                                    {conflictCount > 0
                                        ? `${conflictCount} conflict needing review`
                                        : pendingCount > 0
                                            ? `${pendingCount} items waiting to sync`
                                            : isOnline ? 'All work synchronized' : 'Offline Mode active'}
                                </div>
                            </div>
                        </div>
                        <ChevronRight size={16} className="text-sf-muted" />
                    </button>
                </div>

                {/* Permitted Links Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Section: Daily Operations */}
                    <div className="space-y-1">
                        <div className="px-2 text-[10px] font-black uppercase tracking-wider text-sf-muted">
                            Operations
                        </div>
                        {user?.role === 'LAB_TECHNICIAN' && (
                            <>
                                <Link
                                    to="/my-work"
                                    onClick={onClose}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                                >
                                    <ClipboardList size={18} className="text-sf-muted" />
                                    <span>{t('nav.myWork', 'My Work')}</span>
                                </Link>
                                <Link
                                    to="/workbench"
                                    onClick={onClose}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                                >
                                    <Beaker size={18} className="text-sf-muted" />
                                    <span>{t('nav.workbench', 'Workbench')}</span>
                                </Link>
                            </>
                        )}
                        {['SAMPLE_RECEPTION', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role) && (
                            <Link
                                to="/reception"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                            >
                                <Package size={18} className="text-sf-muted" />
                                <span>{t('nav.reception', 'Sample Reception')}</span>
                            </Link>
                        )}
                        {['LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role) && (
                            <Link
                                to="/manager-queue"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                            >
                                <ShieldAlert size={18} className="text-sf-muted" />
                                <span>{t('nav.managerQueue', 'Manager Task List')}</span>
                            </Link>
                        )}
                        {['AUDIT_USER', 'LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role) && (
                            <Link
                                to="/qa"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                            >
                                <ShieldAlert size={18} className="text-sf-muted" />
                                <span>{t('nav.qa', 'Quality Assurance')}</span>
                            </Link>
                        )}
                        {['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'AUDIT_USER'].includes(user?.role) && (
                            <Link
                                to="/equipment"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                            >
                                <Monitor size={18} className="text-sf-muted" />
                                <span>{t('nav.equipment', 'Equipment')}</span>
                            </Link>
                        )}
                        {['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'MASTER_USER'].includes(user?.role) && (
                            <Link
                                to="/inventory"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                            >
                                <Package size={18} className="text-sf-muted" />
                                <span>{t('nav.inventory', 'Inventory')}</span>
                            </Link>
                        )}
                    </div>

                    {/* Section: Data & Reports */}
                    <div className="space-y-1">
                        <div className="px-2 text-[10px] font-black uppercase tracking-wider text-sf-muted">
                            Data & Results
                        </div>
                        {user?.role !== 'SAMPLE_RECEPTION' && (
                            <Link
                                to="/spectral-library"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                            >
                                <Activity size={18} className="text-sf-muted" />
                                <span>{t('nav.spectral', 'Spectral Library')}</span>
                            </Link>
                        )}
                        <Link
                            to="/result-reports"
                            onClick={onClose}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                        >
                            <FileText size={18} className="text-sf-muted" />
                            <span>{t('nav.reports', 'Result Reports')}</span>
                        </Link>
                        {['SUPER_ADMIN', 'PROJECT_MANAGER', 'LAB_MANAGER'].includes(user?.role) && (
                            <>
                                <Link
                                    to="/projects"
                                    onClick={onClose}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                                >
                                    <FileSpreadsheet size={18} className="text-sf-muted" />
                                    <span>{t('nav.projects', 'Projects')}</span>
                                </Link>
                                <Link
                                    to="/data-results"
                                    onClick={onClose}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                                >
                                    <Table size={18} className="text-sf-muted" />
                                    <span>{t('nav.dataResults', 'Data Results')}</span>
                                </Link>
                            </>
                        )}
                    </div>

                    {/* Section: Administration (if authorized) */}
                    {['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role) && (
                        <div className="space-y-1">
                            <div className="px-2 text-[10px] font-black uppercase tracking-wider text-sf-muted">
                                Administration
                            </div>
                            <Link
                                to="/users"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                            >
                                <User size={18} className="text-sf-muted" />
                                <span>{t('nav.labStaff', 'Laboratory Staff')}</span>
                            </Link>
                            {user?.role === 'SUPER_ADMIN' && (
                                <Link
                                    to="/admin/labs"
                                    onClick={onClose}
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                                >
                                    <Beaker size={18} className="text-sf-muted" />
                                    <span>{t('nav.labs', 'Labs')}</span>
                                </Link>
                            )}
                            <Link
                                to="/admin"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                            >
                                <Settings size={18} className="text-sf-muted" />
                                <span>{t('nav.admin', 'Admin Panel')}</span>
                            </Link>
                            <Link
                                to="/admin/help"
                                onClick={onClose}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                            >
                                <HelpCircle size={18} className="text-sf-primary" />
                                <span>{t('help.guides', 'Knowledge Base Editor')}</span>
                            </Link>
                        </div>
                    )}

                    {/* Section: Info & Tech Stack */}
                    <div className="space-y-1">
                        <div className="px-2 text-[10px] font-black uppercase tracking-wider text-sf-muted">
                            {t('help.help', 'Help & Guidance')}
                        </div>
                        <Link
                            to="/help"
                            onClick={onClose}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                        >
                            <HelpCircle size={18} className="text-sf-primary" />
                            <span>{t('help.centre', 'Help Centre')}</span>
                        </Link>
                        <Link
                            to="/help/faq"
                            onClick={onClose}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                        >
                            <HelpCircle size={18} className="text-sf-muted" />
                            <span>{t('help.faq', 'Common Questions (FAQs)')}</span>
                        </Link>
                        <Link
                            to="/about"
                            onClick={onClose}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sf-text hover:bg-sf-hover font-medium"
                        >
                            <Info size={18} className="text-sf-muted" />
                            <span>{t('nav.about', 'About SoilFER')}</span>
                        </Link>
                    </div>
                </div>

                {/* Footer Controls: Language, Theme, Profile & Logout */}
                <div className="p-4 border-t border-sf-divider bg-sf-canvas space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <LanguageSwitcher />
                            <ThemeToggle />
                        </div>
                        <Link
                            to="/profile"
                            onClick={onClose}
                            className="text-xs font-bold text-sf-primary hover:underline"
                        >
                            {t('nav.profile', 'My Profile')}
                        </Link>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-500/20 transition-colors"
                    >
                        <LogOut size={16} />
                        <span>{t('nav.logout', 'Sign Out')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
