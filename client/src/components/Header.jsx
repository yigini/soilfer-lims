import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../context/LanguageContext';
import { UserMenu } from './UserMenu';

import { Bell, Menu } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

// ...

export const Header = ({ onMenuClick }) => {
    const { theme } = useTheme();
    const { unreadCount, toggleDrawer } = useNotifications();
    const { t } = useLanguage();

    return (
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 fixed top-0 right-0 left-0 z-30 transition-colors duration-300">
            <div className="h-full px-4 md:px-6 flex items-center justify-between">
                {/* Left: Mobile Toggle & Logo */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={onMenuClick}
                        className="md:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        aria-label="Toggle navigation menu"
                    >
                        <Menu size={20} />
                    </button>
                    <div className="md:hidden flex items-center gap-1.5">
                        <img src="/assets/img/soilfer-logo.png" alt="SoilFER" className="h-7 w-auto object-contain" />
                        <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">LIMS</span>
                    </div>
                    <div className="hidden md:block"></div>
                </div>

                {/* Right: User Controls */}
                <div className="flex items-center gap-2 md:gap-3">
                    <button
                        onClick={toggleDrawer}
                        className="relative p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        title={t('header.notifications', 'Notifications')}
                        aria-label={t('header.notifications', 'Notifications')}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-gray-800 animate-pulse" />
                        )}
                    </button>
                    <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                    <LanguageSwitcher />
                    <ThemeToggle />
                    <UserMenu />
                </div>
            </div>
        </header>
    );
};
