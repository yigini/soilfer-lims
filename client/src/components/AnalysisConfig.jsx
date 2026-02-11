import React, { useState } from 'react';
import AnalysisManager from './admin/AnalysisManager';
import GroupManager from './admin/GroupManager';
import MethodologyManager from './admin/MethodologyManager';
import CategoryManager from './admin/CategoryManager';
import { LayoutList, Layers, Settings2, Tag } from 'lucide-react';

const AnalysisConfig = () => {
    const [view, setView] = useState('analyses'); // categories, analyses, methods, groups

    return (
        <div className="flex h-full gap-6">
            {/* Sub-Sidebar */}
            <div className="w-56 bg-gray-50 border-r p-4 space-y-2 h-full">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">Configuration</div>

                <button onClick={() => setView('analyses')} className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === 'analyses' ? 'bg-white shadow-sm text-blue-700 font-bold border' : 'text-gray-600 hover:bg-gray-200/50'}`}>
                    <LayoutList size={18} />
                    <span>Analyses</span>
                </button>

                <button onClick={() => setView('groups')} className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === 'groups' ? 'bg-white shadow-sm text-blue-700 font-bold border' : 'text-gray-600 hover:bg-gray-200/50'}`}>
                    <Layers size={18} />
                    <span>Analysis Groups</span>
                </button>

                <button onClick={() => setView('methods')} className={`w-full text-left px-3 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === 'methods' ? 'bg-white shadow-sm text-blue-700 font-bold border' : 'text-gray-600 hover:bg-gray-200/50'}`}>
                    <Settings2 size={18} />
                    <span>Methodologies</span>
                </button>

                <div className="pt-4 border-t mt-4">
                    <button onClick={() => setView('categories')} className={`w-full text-left px-3 py-2 rounded flex items-center gap-3 ${view === 'categories' ? 'text-blue-700 font-bold' : 'text-gray-500 hover:text-gray-700'}`}>
                        <Tag size={16} />
                        <span className="text-sm">Categories</span>
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pr-6 pb-6 pt-2">
                {view === 'analyses' && <AnalysisManager />}
                {view === 'groups' && <GroupManager />}
                {view === 'methods' && <MethodologyManager />}
                {view === 'categories' && <CategoryManager />}
            </div>
        </div>
    );
};

export default AnalysisConfig;

