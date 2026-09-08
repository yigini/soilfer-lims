import React from 'react';
import { X, User, Clock, Tag, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { getStatusColor } from '../../utils/workflowMapper';

export default function WorkflowDetailPanel({ node, onClose, t }) {
    if (!node) return null;

    const { data } = node;
    const wi = data.workItem;
    const colors = getStatusColor(data.status);

    return (
        <div className="fixed right-0 top-0 h-full w-96 bg-sf-surface shadow-2xl border-l border-sf-divider z-50 animate-in slide-in-from-right duration-300 overflow-y-auto">
            {/* Header */}
            <div
                className="p-5 border-b border-sf-divider"
                style={{ backgroundColor: `${colors.bg}` }}
            >
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold" style={{ color: colors.text }}>{data.title}</h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-black/10 transition-colors"
                    >
                        <X size={18} className="text-gray-500" />
                    </button>
                </div>
                <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: `${colors.border}40`, color: colors.text }}
                >
                    {colors.label || data.status}
                </span>
                {data.blocked && (
                    <div className="flex items-center gap-2 mt-2 text-red-500 text-sm">
                        <AlertTriangle size={14} />
                        <span>{t ? t('workflow.detail.blocked') : 'Blocked by prerequisite'}</span>
                    </div>
                )}
            </div>

            {/* Details */}
            <div className="p-5 space-y-5">
                {/* Category */}
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                        <Tag size={16} className="text-gray-500" />
                    </div>
                    <div>
                        <p className="text-xs text-sf-muted">{t ? t('workflow.detail.category') : 'Category'}</p>
                        <p className="text-sm font-semibold text-sf-text">{data.category}</p>
                    </div>
                </div>

                {/* Assignee */}
                {wi && (
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                            <User size={16} className="text-gray-500" />
                        </div>
                        <div>
                            <p className="text-xs text-sf-muted">{t ? t('workflow.detail.assignee') : 'Assignee'}</p>
                            <p className="text-sm font-semibold text-sf-text">{wi.assignedTo || 'Unassigned'}</p>
                        </div>
                    </div>
                )}

                {/* Timestamps */}
                {wi && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                                <Clock size={16} className="text-gray-500" />
                            </div>
                            <div>
                                <p className="text-xs text-sf-muted">{t ? t('workflow.detail.created') : 'Created'}</p>
                                <p className="text-sm font-semibold text-sf-text">
                                    {wi.createdAt ? new Date(wi.createdAt).toLocaleString() : '—'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                                <Clock size={16} className="text-gray-500" />
                            </div>
                            <div>
                                <p className="text-xs text-sf-muted">{t ? t('workflow.detail.updated') : 'Last Updated'}</p>
                                <p className="text-sm font-semibold text-sf-text">
                                    {wi.updatedAt ? new Date(wi.updatedAt).toLocaleString() : '—'}
                                </p>
                            </div>
                        </div>
                    </>
                )}

                {/* Result */}
                {wi?.result && (
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 mt-0.5">
                            <FileText size={16} className="text-gray-500" />
                        </div>
                        <div>
                            <p className="text-xs text-sf-muted">{t ? t('workflow.detail.result') : 'Result'}</p>
                            <p className="text-sm font-semibold text-sf-text">{wi.result} {wi.unit || ''}</p>
                        </div>
                    </div>
                )}

                {/* Remarks */}
                {wi?.remarks && (
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-xs text-sf-muted mb-1">{t ? t('workflow.detail.remarks') : 'Remarks'}</p>
                        <p className="text-sm text-sf-muted">{wi.remarks}</p>
                    </div>
                )}

                {/* Work Item History */}
                {wi?.history && Array.isArray(wi.history) && wi.history.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-sf-muted uppercase mb-2">
                            {t ? t('workflow.detail.history') : 'Status History'}
                        </p>
                        <div className="space-y-2">
                            {wi.history.slice(0, 10).map((h, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                    <span className="text-gray-600 dark:text-gray-300 font-medium">{h.status || h.action}</span>
                                    <span className="text-gray-400 text-xs ml-auto">
                                        {h.timestamp ? new Date(h.timestamp).toLocaleString() : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
