import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAnalysisCatalogue } from '../context/AnalysisCatalogueContext';
import { useLanguage } from '../context/LanguageContext';
import AnalysisManager from './admin/AnalysisManager';
import GroupManager from './admin/GroupManager';
import CategoryManager from './admin/CategoryManager';
import { FlaskConical, Layers, Tag } from 'lucide-react';

const AnalysisConfig = () => {
    const { t } = useLanguage();
    const [view, setView] = useState('analyses'); // analyses, groups, categories
    const { analyses } = useAnalysisCatalogue();
    const [counts, setCounts] = useState({ groups: '…', categories: '…' });
    useEffect(() => {
        let active = true;
        Promise.all([axios.get('/api/config/groups'), axios.get('/api/config/categories')])
            .then(([groups, categories]) => { if (active) setCounts({ groups: groups.data.length, categories: categories.data.length }); })
            .catch(() => { if (active) setCounts({ groups: 'Unavailable', categories: 'Unavailable' }); });
        return () => { active = false; };
    }, [view, analyses]);

    const navItems = [
        { id: 'analyses', label: t('analytics.testMethods', 'Analyses & Methodologies'), icon: FlaskConical, badge: `${analyses.length} Parameters` },
        { id: 'groups', label: 'Analysis Packages', icon: Layers, badge: `${counts.groups} Packages` },
        { id: 'categories', label: 'Property Categories', icon: Tag, badge: `${counts.categories} Domains` }
    ];

    return (
        <div className="space-y-4 font-sans w-full min-w-0">
            {/* Top Sub-Navigation Pills */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl border border-sf-divider w-fit">
                {navItems.map(item => {
                    const isActive = view === item.id;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                isActive
                                    ? 'bg-white dark:bg-gray-700 text-emerald-800 dark:text-emerald-300 shadow-sm border border-gray-200/80 dark:border-gray-600'
                                    : 'text-sf-muted hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
                            }`}
                        >
                            <Icon size={16} className={isActive ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400'} />
                            <span>{item.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                isActive
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-gray-200/70 dark:bg-gray-700 text-sf-muted'
                            }`}>
                                {item.badge}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Content Area - Full Width */}
            <div className="w-full min-w-0">
                {view === 'analyses' && <AnalysisManager />}
                {view === 'groups' && <GroupManager />}
                {view === 'categories' && <CategoryManager />}
            </div>
        </div>
    );
};

export default AnalysisConfig;


