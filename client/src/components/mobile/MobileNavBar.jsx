import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
    LayoutDashboard,
    TestTube2,
    Beaker,
    Package,
    ShieldAlert,
    QrCode,
    MoreHorizontal,
    ClipboardList
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import clsx from 'clsx';

export const MobileNavBar = ({ onMoreClick }) => {
    const location = useLocation();
    const { user } = useAuth();
    const { t } = useLanguage();

    // Determine primary work route based on user role
    let roleWorkItem = {
        icon: Beaker,
        label: t('nav.workbench', 'Workbench'),
        path: '/workbench'
    };

    if (user?.role === 'SAMPLE_RECEPTION') {
        roleWorkItem = {
            icon: Package,
            label: t('nav.reception', 'Intake'),
            path: '/reception'
        };
    } else if (['LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role)) {
        roleWorkItem = {
            icon: ShieldAlert,
            label: t('nav.managerQueue', 'Review'),
            path: '/manager-queue'
        };
    } else if (user?.role === 'AUDIT_USER') {
        roleWorkItem = {
            icon: ShieldAlert,
            label: t('nav.qa', 'Quality'),
            path: '/qa'
        };
    } else if (user?.role === 'LAB_TECHNICIAN') {
        roleWorkItem = {
            icon: Beaker,
            label: t('nav.workbench', 'Workbench'),
            path: '/workbench'
        };
    } else if (user?.role === 'PROJECT_MANAGER') {
        roleWorkItem = {
            icon: ClipboardList,
            label: t('nav.projects', 'Projects'),
            path: '/projects'
        };
    }

    const navTabs = [
        {
            key: 'home',
            label: t('nav.dashboard', 'Home'),
            icon: LayoutDashboard,
            path: '/'
        },
        {
            key: 'work',
            ...roleWorkItem
        },
        {
            key: 'scan',
            label: t('nav.scan', 'Scan'),
            icon: QrCode,
            path: '/scan'
        },
        {
            key: 'samples',
            label: t('nav.samples', 'Samples'),
            icon: TestTube2,
            path: '/samples'
        }
    ];

    return (
        <nav
            aria-label="Mobile primary navigation"
            className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sf-surface border-t border-sf-divider shadow-lg select-none"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.25rem)' }}
        >
            <div className="grid grid-cols-5 h-14 items-center">
                {navTabs.map((tab) => {
                    const isActive = tab.path === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(tab.path);

                    return (
                        <Link
                            key={tab.key}
                            to={tab.path}
                            className={clsx(
                                "flex flex-col items-center justify-center h-full w-full py-1 transition-colors relative",
                                isActive
                                    ? "text-sf-primary font-bold"
                                    : "text-sf-muted hover:text-sf-text"
                            )}
                            title={tab.label}
                        >
                            {isActive && (
                                <span className="absolute top-0 w-8 h-0.5 bg-sf-primary rounded-full shadow-[0_1px_4px_var(--sf-primary)]" />
                            )}
                            <tab.icon size={20} className={clsx("transition-transform", isActive && "scale-110")} />
                            <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[56px] text-center font-medium">
                                {tab.label}
                            </span>
                        </Link>
                    );
                })}

                {/* 5th Tab: More Drawer Trigger */}
                <button
                    onClick={onMoreClick}
                    className="flex flex-col items-center justify-center h-full w-full py-1 text-sf-muted hover:text-sf-text active:text-sf-primary transition-colors focus:outline-none"
                    aria-label="Open full menu"
                >
                    <MoreHorizontal size={20} />
                    <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[56px] text-center font-medium">
                        {t('nav.more', 'More')}
                    </span>
                </button>
            </div>
        </nav>
    );
};
