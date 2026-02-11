import React, { useState } from 'react';
import { LogOut, User, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getTimezoneInfo } from '../utils/timezone';

export const UserMenu = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const tzInfo = getTimezoneInfo();

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="User Menu"
            >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white text-sm shadow-sm">
                    {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {user?.name || 'User'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                        {user?.role?.replace(/_/g, ' ')}
                    </div>
                </div>
                <svg
                    className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown */}
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl z-50 border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* User Info */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-md">
                                    {user?.name?.charAt(0) || 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-900 dark:text-white truncate">
                                        {user?.name || 'User'}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                                        {user?.email || user?.username}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                        {user?.role?.replace(/_/g, ' ')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Timezone Info */}
                        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                <Clock size={14} />
                                <span className="font-medium">{tzInfo.abbreviation}</span>
                                <span className="text-gray-400 dark:text-gray-500">{tzInfo.offset}</span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                {tzInfo.timezone}
                            </div>
                        </div>

                        {/* Menu Items */}
                        <div className="py-2">
                            {/* Profile */}
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    navigate('/profile');
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <User size={16} />
                                <span>Profile Settings</span>
                            </button>

                            {/* Logout */}
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    logout();
                                }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                            >
                                <LogOut size={16} />
                                <span className="font-medium">Sign Out</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
