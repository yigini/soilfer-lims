import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../context/LanguageContext';
import { UserMenu } from './UserMenu';

import { Bell, Menu } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import clsx from 'clsx';

export const Header = ({ onMenuClick }) => {
    const { theme, darkMode } = useTheme();
    const { 
        unreadCount, 
        totalUnreadCount, 
        unreadMessageCount, 
        hasUnreadMessages, 
        isDrawerOpen, 
        openDrawer, 
        closeDrawer 
    } = useNotifications();
    const { t } = useLanguage();

    const isCustomLogo = theme?.logoUrl && !theme.logoUrl.includes('/assets/img/soilfer-logo') && !theme.logoUrl.includes('/assets/img/logo') && !theme.logoUrl.endsWith('/logo.png') && !theme.logoUrl.includes('fao_logo');
    const defaultSiteLogo = darkMode ? '/assets/img/logo-dark.png' : '/assets/img/logo-light.png';
    const siteLogo = isCustomLogo ? theme.logoUrl : defaultSiteLogo;

    const effectiveUnread = totalUnreadCount ?? unreadCount ?? 0;

    const handleBellClick = () => {
        if (isDrawerOpen) {
            closeDrawer();
        } else if (hasUnreadMessages) {
            openDrawer('CHATS'); // Direct to message exchange tab!
        } else {
            openDrawer('NOTIFICATIONS');
        }
    };

    const bellTitle = hasUnreadMessages
        ? t('header.newMessagesTooltip', '{{count}} new message(s) - Click to open Message Exchange', { count: unreadMessageCount })
        : effectiveUnread > 0
            ? t('header.notificationsCount', '{{count}} unread notification(s)', { count: effectiveUnread })
            : t('header.notifications', 'Notifications');

    return (
        <header className="h-16 bg-sf-surface border-b border-sf-divider fixed top-0 right-0 left-0 z-30 transition-colors duration-200">
            <div className="h-full px-4 md:px-6 flex items-center justify-between">
                {/* Left: Mobile Toggle & Logo */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onMenuClick}
                        className="md:hidden p-2 text-sf-muted hover:text-sf-text hover:bg-sf-hover rounded-lg transition-colors"
                        aria-label="Toggle navigation menu"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="md:hidden flex items-center">
                        <img 
                            src={siteLogo} 
                            alt="SoilFER LIMS" 
                            className="h-8 w-auto max-w-[150px] object-contain" 
                            onError={(e) => { e.target.onerror = null; e.target.src = defaultSiteLogo; }}
                        />
                    </div>
                    <div className="hidden md:block"></div>
                </div>

                {/* Right: User Controls */}
                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        onClick={handleBellClick}
                        className={clsx(
                            "relative p-2 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-sf-surface",
                            hasUnreadMessages
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-2 ring-amber-400/50 hover:bg-amber-500/20 focus:ring-amber-500 shadow-sm"
                                : effectiveUnread > 0
                                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-2 ring-blue-400/40 hover:bg-blue-500/20 focus:ring-blue-500"
                                    : "text-sf-muted hover:text-sf-text hover:bg-sf-hover focus:ring-sf-divider"
                        )}
                        title={bellTitle}
                        aria-label={bellTitle}
                    >
                        <Bell 
                            size={20} 
                            className={clsx(
                                "transition-all duration-300",
                                effectiveUnread > 0 && "animate-bell-swing",
                                hasUnreadMessages
                                    ? "text-amber-600 dark:text-amber-400"
                                    : effectiveUnread > 0
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-sf-muted"
                            )} 
                        />
                        {effectiveUnread > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center">
                                {/* Ping radar ripple animation */}
                                <span 
                                    className={clsx(
                                        "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                        hasUnreadMessages ? "bg-rose-500" : "bg-blue-500"
                                    )} 
                                />
                                {/* High-contrast badge pill with count */}
                                <span 
                                    className={clsx(
                                        "relative inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[10px] font-black text-white shadow-md ring-2 ring-sf-surface",
                                        hasUnreadMessages
                                            ? "bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 animate-badge-pulse"
                                            : "bg-gradient-to-r from-blue-600 to-indigo-600"
                                    )}
                                >
                                    {effectiveUnread > 99 ? '99+' : effectiveUnread}
                                </span>
                            </span>
                        )}
                    </button>
                    <div className="h-6 w-px bg-sf-divider mx-1"></div>
                    <LanguageSwitcher />
                    <ThemeToggle />
                    <UserMenu />
                </div>
            </div>
        </header>
    );
};
