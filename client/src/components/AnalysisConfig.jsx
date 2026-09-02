import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import AnalysisManager from './admin/AnalysisManager';
import GroupManager from './admin/GroupManager';
import CategoryManager from './admin/CategoryManager';
import { LayoutList, Layers, Tag } from 'lucide-react';

const AnalysisConfig = () => {
    const { t } = useLanguage();
    const [view, setView] = useState('analyses'); // analyses, groups, categories

    const navItems = [
        { id: 'analyses', label: t('analytics.testMethods', 'Analyses & Methodologies'), icon: LayoutList, desc: 'Individual parameters' },
        { id: 'groups', label: 'Analysis Packages', icon: Layers, desc: 'Grouped test suites' },
        { id: 'categories', label: 'Property Categories', icon: Tag, desc: 'Domain groupings' }
    ];

    return (
        <div className="flex flex-col lg:flex-row h-full gap-5 w-full min-w-0 font-sans">
            {/* Sub-Navigation */}
            <div className="w-full lg:w-60 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 space-y-1.5 flex-shrink-0 rounded-2xl shadow-sm h-fit">
                <div className="text-[10px] font-extrabold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2 px-3 pt-1">
                    {t('nav.settings', 'Catalogue Setup')}
                </div>

                {navItems.map(item => {
                    const isActive = view === item.id;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={`w-full text-left px-3.5 py-3 rounded-xl flex items-center gap-3 text-xs transition-all ${
                                isActive
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200/80 dark:border-emerald-800 shadow-sm'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 font-semibold border border-transparent'
                            }`}
                        >
                            <Icon size={17} className={isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'} />
                            <div className="min-w-0 flex-1">
                                <div className="truncate">{item.label}</div>
                                <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 truncate">{item.desc}</div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0 overflow-x-hidden">
                {view === 'analyses' && <AnalysisManager />}
                {view === 'groups' && <GroupManager />}
                {view === 'categories' && <CategoryManager />}
            </div>
        </div>
    );
};

export default AnalysisConfig;


