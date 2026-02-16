import React from 'react';
import { getStatusColor } from '../../utils/workflowMapper';

const STAFF_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#3b82f6', '#8b5cf6', '#14b8a6', '#ef4444'];

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * V2 T03: Individual Stage Card
 */
export default function WorkflowStageCard({
    stage,
    isCurrent,
    isCompleted,
    isFuture,
    onClick,
}) {
    const { room, config, total, done, inProgress, blocked, status, staff, analyses, sampleInfo } = stage;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isEmpty = status === 'EMPTY' && total === 0 && !sampleInfo;

    // Determine CSS class
    let cardClass = 'wf-stage-card';
    if (isCurrent) cardClass += ' current';
    else if (isCompleted) cardClass += ' completed';
    else if (isFuture) cardClass += ' future';
    if (isEmpty) cardClass += ' empty';

    return (
        <div
            className={cardClass}
            style={{ '--stage-accent': config?.accent || '#94a3b8' }}
            onClick={() => onClick?.(room)}
            role="button"
            tabIndex={0}
            aria-label={`${room}: ${total} analyses, ${done} completed`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(room); }}
        >
            {/* Beacon (only on current) */}
            {isCurrent && (
                <div className="wf-beacon">
                    <div className="wf-beacon-dot" />
                </div>
            )}

            {/* Header */}
            <div className="wf-stage-header">
                <span className="wf-stage-icon">{config?.emoji || '📋'}</span>
                <span className="wf-stage-title">{room}</span>
                {total > 0 && (
                    <span className="wf-stage-count">{done}/{total}</span>
                )}
            </div>

            {/* Progress bar */}
            {total > 0 && (
                <div className="wf-progress">
                    <div className="wf-progress-fill" style={{ width: `${pct}%` }} />
                </div>
            )}

            {/* Reception: show sample info instead of analyses */}
            {sampleInfo && (
                <div style={{ fontSize: 11 }}>
                    <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: 2 }}>{sampleInfo.labId}</div>
                    <div style={{ fontSize: 10, color: '#64748b' }}>{sampleInfo.projectCode}</div>
                    <div style={{ marginTop: 4 }}>
                        <span className="wf-analysis-status" style={{
                            background: '#dbeafe',
                            color: '#2563eb',
                        }}>
                            {sampleInfo.status || 'RECEIVED'}
                        </span>
                    </div>
                </div>
            )}

            {/* Analysis list */}
            {analyses && analyses.length > 0 && (
                <div className="wf-analysis-list">
                    {analyses.slice(0, 6).map((a, i) => {
                        const sc = getStatusColor(a.status);
                        return (
                            <div key={i} className="wf-analysis-item">
                                <span className="wf-analysis-name">{a.name}</span>
                                <span
                                    className="wf-analysis-status"
                                    style={{ background: sc.bg, color: sc.text }}
                                >
                                    {sc.label}
                                </span>
                            </div>
                        );
                    })}
                    {analyses.length > 6 && (
                        <div style={{ fontSize: 9, color: '#94a3b8', paddingTop: 2 }}>
                            +{analyses.length - 6} more
                        </div>
                    )}
                </div>
            )}

            {/* Blocker indicator */}
            {blocked > 0 && (
                <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                    🔒 {blocked} blocked
                </div>
            )}

            {/* Staff chips */}
            {staff.length > 0 && (
                <div className="wf-staff-row">
                    {staff.map((name, i) => (
                        <div
                            key={i}
                            className="wf-staff-chip"
                            style={{ background: STAFF_COLORS[i % STAFF_COLORS.length] }}
                            title={name}
                        >
                            {getInitials(name)}
                        </div>
                    ))}
                </div>
            )}

            {/* Empty state */}
            {isEmpty && (
                <div style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic', marginTop: 4 }}>
                    No activity
                </div>
            )}
        </div>
    );
}
