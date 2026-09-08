import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { SyncStatusBadge } from './SyncStatusBadge';
import { Bell, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

export const MobileHeader = ({ onMenuClick }) => {
    const { theme, darkMode } = useTheme();
    const { user } = useAuth();
    const {
        unreadCount,
        totalUnreadCount,
        hasUnreadMessages,
        isDrawerOpen,
        openDrawer,
        closeDrawer
    } = useNotifications();

    const isCustomLogo = theme?.logoUrl && !theme.logoUrl.includes('/assets/img/soilfer-logo') && !theme.logoUrl.includes('/assets/img/logo') && !theme.logoUrl.endsWith('/logo.png') && !theme.logoUrl.includes('fao_logo');
    const defaultSiteLogo = darkMode ? '/assets/img/logo-dark.png' : '/assets/img/logo-light.png';
    const siteLogo = isCustomLogo ? theme.logoUrl : defaultSiteLogo;

    const effectiveUnread = totalUnreadCount ?? unreadCount ?? 0;

    const handleBellClick = () => {
        if (isDrawerOpen) {
            closeDrawer();
        } else if (hasUnreadMessages) {
            openDrawer('CHATS');
        } else {
            openDrawer('NOTIFICATIONS');
        }
    };

    return (
        <header className="md:hidden h-14 bg-sf-surface border-b border-sf-divider fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-3 shadow-xs">
            {/* Left: Brand Logo & Lab context */}
            <Link to="/" className="flex items-center gap-2 max-w-[160px]">
                <img
                    src={siteLogo}
                    alt="SoilFER"
                    className="h-7 w-auto object-contain"
                    onError={(e) => { e.target.onerror = null; e.target.src = defaultSiteLogo; }}
                />
            </Link>

            {/* Right: Sync status badge + Notification bell + User profile */}
            <div className="flex items-center gap-1.5">
                <SyncStatusBadge showLabel={false} className="py-1 px-2 text-[11px]" />

                <button
                    onClick={handleBellClick}
                    className={clsx(
                        "relative p-2 rounded-full transition-colors focus:outline-none",
                        hasUnreadMessages
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-400/50"
                            : effectiveUnread > 0
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "text-sf-muted hover:text-sf-text"
                    )}
                    aria-label="Notifications"
                >
                    <Bell size={18} />
                    {effectiveUnread > 0 && (
                        <span className="absolute 0.5 top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 text-[9px] font-black text-white px-1">
                            {effectiveUnread > 99 ? '99+' : effectiveUnread}
                        </span>
                    )}
                </button>

                <Link
                    to="/profile"
                    className="w-7 h-7 rounded-full bg-sf-primary/10 text-sf-primary border border-sf-divider flex items-center justify-center font-bold text-xs hover:ring-2 hover:ring-sf-primary"
                    aria-label="My Profile"
                >
                    {user?.name?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || <User size={14} />}
                </Link>
            </div>
        </header>
    );
};
