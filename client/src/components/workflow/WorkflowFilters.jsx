import React from 'react';
import { Filter, X } from 'lucide-react';
import { CATEGORIES } from '../../utils/workflowMapper';

const STATUS_OPTIONS = [
    { value: '', label: 'workflow.filters.allStatuses' },
    { value: 'NOT_ASSIGNED', label: 'workflow.filters.notAssigned' },
    { value: 'ASSIGNED', label: 'workflow.filters.assigned' },
    { value: 'IN_PROGRESS', label: 'workflow.filters.inProgress' },
    { value: 'COMPLETED', label: 'workflow.filters.completed' },
    { value: 'SUBMITTED', label: 'workflow.filters.submitted' },
    { value: 'ACCEPTED', label: 'workflow.filters.accepted' },
    { value: 'REANALYSIS_REQUIRED', label: 'workflow.filters.reanalysis' },
];

const CATEGORY_OPTIONS = [
    { value: '', label: 'workflow.filters.allCategories' },
    { value: CATEGORIES.OPERATIONAL_GATES, label: 'workflow.filters.gates' },
    { value: CATEGORIES.WET_CHEMISTRY, label: 'workflow.filters.wetChem' },
    { value: CATEGORIES.SPECTRAL, label: 'workflow.filters.spectral' },
    { value: CATEGORIES.POST_ANALYTICAL, label: 'workflow.filters.postAnalytical' },
];

export default function WorkflowFilters({ filters, onChange, assignees = [], t }) {
    const hasFilters = filters.status || filters.assignee || filters.category || filters.blockedOnly;

    const handleClear = () => {
        onChange({ status: '', assignee: '', category: '', blockedOnly: false });
    };

    return (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-sf-surface rounded-xl border border-sf-divider shadow-sm">
            <Filter size={16} className="text-gray-400" />

            {/* Status */}
            <select
                value={filters.status || ''}
                onChange={e => onChange({ ...filters, status: e.target.value })}
                className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sf-text focus:ring-2 focus:ring-indigo-500 outline-none"
            >
                {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {t ? t(opt.label) : opt.value || 'All Statuses'}
                    </option>
                ))}
            </select>

            {/* Category */}
            <select
                value={filters.category || ''}
                onChange={e => onChange({ ...filters, category: e.target.value })}
                className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sf-text focus:ring-2 focus:ring-indigo-500 outline-none"
            >
                {CATEGORY_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                        {t ? t(opt.label) : opt.value || 'All Categories'}
                    </option>
                ))}
            </select>

            {/* Assignee */}
            {assignees.length > 0 && (
                <select
                    value={filters.assignee || ''}
                    onChange={e => onChange({ ...filters, assignee: e.target.value })}
                    className="text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sf-text focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="">{t ? t('workflow.filters.allAssignees') : 'All Assignees'}</option>
                    {assignees.map(a => (
                        <option key={a} value={a}>{a}</option>
                    ))}
                </select>
            )}

            {/* Blocked Only */}
            <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={filters.blockedOnly || false}
                    onChange={e => onChange({ ...filters, blockedOnly: e.target.checked })}
                    className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                />
                {t ? t('workflow.filters.blockedOnly') : 'Blocked Only'}
            </label>

            {/* Clear */}
            {hasFilters && (
                <button
                    onClick={handleClear}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors ml-auto"
                >
                    <X size={12} />
                    {t ? t('workflow.filters.clear') : 'Clear'}
                </button>
            )}
        </div>
    );
}
