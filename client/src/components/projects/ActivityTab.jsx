import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { History, Shield, ExternalLink, Calendar, User } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function ActivityTab({
    project,
    capabilities = {},
    userRole = ''
}) {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDenied, setIsDenied] = useState(false);

    useEffect(() => {
        const identifier = project?.id || project?.code;
        if (!identifier) return;

        setLoading(true);
        setError(null);
        setIsDenied(false);

        axios.get(`/api/projects/${encodeURIComponent(identifier)}/activity`)
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : (res.data?.logs || []);
                setLogs(data);
            })
            .catch(err => {
                if (err.response?.status === 403) {
                    setIsDenied(true);
                } else {
                    setError(err.response?.data?.error || t('projects.activity.fetchError', 'Failed to load activity logs'));
                }
                setLogs([]);
            })
            .finally(() => setLoading(false));
    }, [project?.id, project?.code, t]);

    return (
        <div className="space-y-6">
            <div className="card-base rounded-2xl p-6 shadow-sm border border-sf-divider bg-sf-surface space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-sf-text">
                            {t('projects.activity.title', 'Project activity & audit history')}
                        </h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            {t('projects.activity.subtitle', 'Traceable, permanent domain log of all governance, admission, and lifecycle actions.')}
                        </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-sf-inset text-sf-muted border border-sf-divider">
                        {t('projects.activity.immutableBadge', 'Immutable log')}
                    </span>
                </div>

                {loading ? (
                    <div className="py-8 text-center text-xs text-sf-muted">
                        {t('common.loading', 'Loading activity trail…')}
                    </div>
                ) : isDenied ? (
                    <div className="py-8 text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800/40">
                        {t('projects.activity.accessDenied', 'Access denied: You do not have permission to view activity logs for this project.')}
                    </div>
                ) : error ? (
                    <div className="py-8 text-center text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 rounded-xl p-4 border border-rose-200 dark:border-rose-800/40">
                        {error}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-8 text-center text-xs text-sf-muted bg-sf-inset/50 rounded-xl p-6 border border-sf-divider">
                        {t('projects.activity.empty', 'No activity or governance events recorded for this project yet.')}
                    </div>
                ) : (
                    <div className="space-y-4 pt-2">
                        {logs.map((item, idx) => (
                            <div key={item.id || idx} className="relative pl-6 pb-4 border-l border-sf-divider last:border-0 last:pb-0">
                                <span className="absolute -left-1.5 top-0.5 w-3 h-3 rounded-full bg-sf-primary border-2 border-sf-surface" />
                                <div className="space-y-0.5">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <h3 className="text-xs font-bold text-sf-text font-mono">
                                            {item.action}
                                        </h3>
                                        <span className="text-[11px] text-sf-muted">
                                            {item.timestamp ? new Date(item.timestamp).toLocaleString() : '—'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-sf-muted">
                                        {item.details || '—'}
                                    </p>
                                    <div className="text-[11px] text-sf-muted/80 flex items-center gap-1 pt-0.5">
                                        <User className="w-3 h-3" />
                                        <span>{item.performedBy || 'System'}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {['SUPER_ADMIN', 'ADMIN', 'LAB_MANAGER', 'AUDIT_USER'].includes(userRole) && (
                    <div className="pt-3 border-t border-sf-divider">
                        <button
                            onClick={() => navigate(`/admin/audit?entity=PROJECT&entityId=${encodeURIComponent(project?.id)}`)}
                            className="text-xs font-semibold text-sf-primary hover:underline flex items-center gap-1"
                        >
                            <span>{t('projects.activity.openFullAudit', 'Open full authorized audit log →')}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
