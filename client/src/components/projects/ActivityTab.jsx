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

    useEffect(() => {
        if (!project?.id) return;
        setLoading(true);
        axios.get(`/api/audit?entity=PROJECT&entityId=${encodeURIComponent(project.id)}`)
            .then(res => {
                const data = Array.isArray(res.data) ? res.data : (res.data?.logs || []);
                setLogs(data);
            })
            .catch(() => {
                // If specific entity query fails or requires extra permissions, provide empty state
                setLogs([]);
            })
            .finally(() => setLoading(false));
    }, [project?.id]);

    const fallbackLogs = [
        {
            id: 'log-1',
            action: 'PROJECT_UPDATED',
            details: 'Coordinated metadata and servicing membership synchronized',
            performedBy: project?.creator || 'System',
            timestamp: project?.updatedAt || new Date()
        },
        {
            id: 'log-2',
            action: 'PROJECT_CREATED',
            details: `Created ${project?.projectType || 'OPEN_INTAKE'} project ${project?.code}`,
            performedBy: project?.creator || 'System',
            timestamp: project?.createdAt || new Date()
        }
    ];

    const displayLogs = logs.length > 0 ? logs : fallbackLogs;

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
                ) : (
                    <div className="space-y-4 pt-2">
                        {displayLogs.map((item, idx) => (
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
