import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import AnalysisManager from './admin/AnalysisManager';
import GroupManager from './admin/GroupManager';
import CategoryManager from './admin/CategoryManager';
import { LayoutList, Layers, Tag } from 'lucide-react';

const AnalysisConfig = () => {
    const { t } = useLanguage();
    const [view, setView] = useState('analyses'); // analyses, groups, categories

    return (
        <div className="flex flex-col lg:flex-row h-full gap-4 w-full min-w-0">
            {/* Sub-Sidebar */}
            <div className="w-full lg:w-56 bg-gray-50 dark:bg-gray-800/80 border lg:border-r border-gray-200 dark:border-gray-700 p-2.5 space-y-1.5 flex-shrink-0 rounded-xl">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-2.5">
                    {t('nav.settings', 'Laboratory Setup')}
                </div>

                {/* 1. Analyses & Methods */}
                <button
                    onClick={() => setView('analyses')}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-xs transition-colors ${view === 'analyses' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-700 dark:text-emerald-400 font-bold border border-gray-200 dark:border-gray-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 font-medium'}`}
                >
                    <LayoutList size={16} />
                    <span>{t('analytics.testMethods', 'Analyses & Methodologies')}</span>
                </button>

                {/* 2. Analysis Packages / Suites */}
                <button
                    onClick={() => setView('groups')}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-xs transition-colors ${view === 'groups' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-700 dark:text-emerald-400 font-bold border border-gray-200 dark:border-gray-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 font-medium'}`}
                >
                    <Layers size={16} />
                    <span>Analysis Packages</span>
                </button>

                {/* 3. Categories */}
                <button
                    onClick={() => setView('categories')}
                    className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-xs transition-colors ${view === 'categories' ? 'bg-white dark:bg-gray-700 shadow-sm text-emerald-700 dark:text-emerald-400 font-bold border border-gray-200 dark:border-gray-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 font-medium'}`}
                >
                    <Tag size={16} />
                    <span>Property Categories</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-4 pt-1">
                {view === 'analyses' && <AnalysisManager />}
                {view === 'groups' && <GroupManager />}
                {view === 'categories' && <CategoryManager />}
            </div>
        </div>
    );
};

export default AnalysisConfig;


