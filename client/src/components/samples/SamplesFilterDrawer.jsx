import React, { useState, useEffect } from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';

const SECTIONS = [
    {
        id: 'status', label: 'Lifecycle State', type: 'checkbox',
        options: [
            { value: 'EXPECTED', label: 'Expected' },
            { value: 'RECEIVED', label: 'Received (Intake)' },
            { value: 'ACCEPTED', label: 'Accepted' },
            { value: 'PROCESSING', label: 'Processing' },
            { value: 'SUBMITTED_PARTIAL', label: 'Submitted (Partial)' },
            { value: 'SUBMITTED_FULL', label: 'Submitted (Full)' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'ON_HOLD', label: 'On Hold' },
            { value: 'ARCHIVED', label: 'Archived' },
            { value: 'DISPOSED', label: 'Disposed' }
        ]
    }
];

const SamplesFilterDrawer = ({ isOpen, onClose, filters, onApply, onReset, options = {} }) => {
    const [localFilters, setLocalFilters] = useState(filters);

    // Sync when drawer opens or filters change externallly
    useEffect(() => {
        if (isOpen) setLocalFilters(filters);
    }, [isOpen, filters]);

    const handleChange = (sectionId, value, checked) => {
        const currentCSV = localFilters[sectionId] || '';
        const currentList = currentCSV ? currentCSV.split(',') : [];

        // Uniquify
        const set = new Set(currentList);
        if (checked) set.add(value);
        else set.delete(value);

        const newCSV = Array.from(set).join(',');
        setLocalFilters({ ...localFilters, [sectionId]: newCSV });
    };

    const handleApply = () => {
        onApply(localFilters);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose}></div>

            {/* Drawer */}
            <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col h-full transform transition-transform duration-300">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                    <h2 className="font-bold flex items-center gap-2">
                        <Filter size={18} /> Advanced Filters
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Dynamic Status/Blocker Sections */}
                    {SECTIONS.map(section => (
                        <div key={section.id}>
                            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-3">{section.label}</h3>
                            <div className="space-y-2 pl-1">
                                {section.options.map(opt => {
                                    const isChecked = (localFilters[section.id] || '').split(',').includes(opt.value);
                                    return (
                                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => handleChange(section.id, opt.value, e.target.checked)}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                                            />
                                            <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {opt.label}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Metadata Sections (Projects, Countries) */}
                    {/* Projects */}
                    {options.projects && options.projects.length > 0 && (
                        <div>
                            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-3">Project</h3>
                            <div className="space-y-2 pl-1 max-h-40 overflow-y-auto scrollbar-thin">
                                {options.projects.map(p => {
                                    const isChecked = (localFilters.projects || '').split(',').includes(p.code);
                                    return (
                                        <label key={p.code} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => handleChange('projects', p.code, e.target.checked)}
                                                className="rounded text-indigo-600 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                                            />
                                            <span className="text-sm text-gray-600 dark:text-gray-400">{p.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Countries */}
                    {options.countries && options.countries.length > 0 && (
                        <div>
                            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-3">Country</h3>
                            <div className="space-y-2 pl-1 max-h-40 overflow-y-auto scrollbar-thin">
                                {options.countries.map(c => {
                                    const isChecked = (localFilters.countries || '').split(',').includes(c.code);
                                    return (
                                        <label key={c.code} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => handleChange('countries', c.code, e.target.checked)}
                                                className="rounded text-indigo-600 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                                            />
                                            <span className="text-sm text-gray-600 dark:text-gray-400">{c.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Labs */}
                    {options.labs && options.labs.length > 0 && (
                        <div>
                            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 mb-3">Lab</h3>
                            <div className="space-y-2 pl-1 max-h-40 overflow-y-auto scrollbar-thin">
                                {options.labs.map(l => {
                                    const isChecked = (localFilters.labs || '').split(',').includes(l.id);
                                    return (
                                        <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => handleChange('labs', l.id, e.target.checked)}
                                                className="rounded text-indigo-600 border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                                            />
                                            <span className="text-sm text-gray-600 dark:text-gray-400">{l.name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex gap-4">
                    <button
                        onClick={() => { setLocalFilters({}); onReset(); }}
                        className="btn-secondary flex-1 py-2 text-sm flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={16} /> Reset
                    </button>
                    <button
                        onClick={handleApply}
                        className="btn-primary flex-1 py-2 text-sm"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SamplesFilterDrawer;
