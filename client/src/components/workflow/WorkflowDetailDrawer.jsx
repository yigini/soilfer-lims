import React from 'react';
import { X, Clock, User, FileText, AlertTriangle } from 'lucide-react';
import { getStatusColor, getDisplayName, getRoom, ROOM_CONFIG } from '../../utils/workflowMapper';

/**
 * V2 T08: Detail Drawer — slide-in right panel for deep info
 */
export default function WorkflowDetailDrawer({
    selectedRoom,
    stageSummary,
    blockerGraph = [],
    workItems,
    auditLog,
    onClose,
}) {
    if (!selectedRoom) return null;

    const config = ROOM_CONFIG[selectedRoom] || {};
    const roomItems = (workItems || []).filter(wi => getRoom(wi.analysis) === selectedRoom);

    // Relevant audit events
    const relevantAudit = (auditLog || []).filter(ev => {
        if (ev.entity === 'WORKITEM') {
            return roomItems.some(wi => wi.id === ev.entityId);
        }
        return false;
    }).slice(0, 20);

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
            ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            <div className="wf-drawer-backdrop" onClick={onClose} />
            <div className="wf-drawer" role="dialog" aria-label={`${selectedRoom} details`}>
                {/* Header */}
                <div className="wf-drawer-header">
                    <span style={{ fontSize: 22 }}>{config.emoji || '📋'}</span>
                    <div style={{ flex: 1 }}>
                        <div className="wf-drawer-title">{selectedRoom}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{config.description}</div>
                    </div>
                    <button className="wf-drawer-close" onClick={onClose} aria-label="Close drawer">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="wf-drawer-body">
                    {/* Summary */}
                    {stageSummary && (
                        <div className="wf-drawer-section">
                            <div className="wf-drawer-section-title">Summary</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 10, textAlign: 'center' }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1e293b' }}>{stageSummary.total}</div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Total</div>
                                </div>
                                <div style={{ padding: '8px 12px', background: '#f0fdf4', borderRadius: 10, textAlign: 'center' }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#059669' }}>{stageSummary.done}</div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Done</div>
                                </div>
                                <div style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 10, textAlign: 'center' }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#d97706' }}>{stageSummary.inProgress}</div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Active</div>
                                </div>
                                <div style={{ padding: '8px 12px', background: '#fee2e2', borderRadius: 10, textAlign: 'center' }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>{stageSummary.blocked}</div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Blocked</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Work Items */}
                    {roomItems.length > 0 && (
                        <div className="wf-drawer-section">
                            <div className="wf-drawer-section-title">
                                <FileText size={12} style={{ display: 'inline', marginRight: 4 }} /> Analyses ({roomItems.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {roomItems.map((wi, idx) => {
                                    const sc = getStatusColor(wi.status);
                                    return (
                                        <div key={idx} style={{
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            padding: '8px 12px', background: '#f8fafc', borderRadius: 10,
                                            border: '1px solid #f1f5f9',
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>
                                                    {getDisplayName(wi.analysis)}
                                                </div>
                                                {wi.assignedTo && (
                                                    <div style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                                                        <User size={10} /> {wi.assignedTo}
                                                    </div>
                                                )}
                                            </div>
                                            <span style={{
                                                fontSize: 10, fontWeight: 700, padding: '2px 8px',
                                                borderRadius: 8, background: sc.bg, color: sc.text,
                                            }}>
                                                {sc.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Blockers */}
                    {(() => {
                        const roomBlockers = blockerGraph.filter(b => b.room === selectedRoom);
                        if (roomBlockers.length === 0) return null;
                        return (
                            <div className="wf-drawer-section">
                                <div className="wf-drawer-section-title">
                                    <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4, color: '#f59e0b' }} /> Blockers ({roomBlockers.length})
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {roomBlockers.map((b, i) => (
                                        <div key={i} style={{
                                            padding: '8px 12px', background: '#fef3c7', borderRadius: 10,
                                            border: '1px solid #fde68a',
                                        }}>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>
                                                {b.displayName || b.analysis}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#78350f', marginTop: 2 }}>
                                                {b.reason}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Staff */}
                    {stageSummary?.staff?.length > 0 && (
                        <div className="wf-drawer-section">
                            <div className="wf-drawer-section-title">
                                <User size={12} style={{ display: 'inline', marginRight: 4 }} /> Assigned Staff
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {stageSummary.staff.map((name, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '6px 12px', background: '#f1f5f9', borderRadius: 20,
                                        fontSize: 12, fontWeight: 600, color: '#334155',
                                    }}>
                                        <div style={{
                                            width: 20, height: 20, borderRadius: '50%',
                                            background: '#6366f1', color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 9, fontWeight: 700,
                                        }}>
                                            {name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                                        </div>
                                        {name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Audit Trail */}
                    {relevantAudit.length > 0 && (
                        <div className="wf-drawer-section">
                            <div className="wf-drawer-section-title">
                                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} /> Recent Activity
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {relevantAudit.map((ev, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 8,
                                        padding: '6px 0', borderBottom: i < relevantAudit.length - 1 ? '1px solid #f1f5f9' : 'none',
                                    }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8', marginTop: 5, flexShrink: 0 }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>
                                                {ev.action?.replace(/_/g, ' ')}
                                            </div>
                                            <div style={{ fontSize: 10, color: '#94a3b8' }}>
                                                {formatDate(ev.timestamp)} {ev.performedBy && `• ${ev.performedBy}`}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {roomItems.length === 0 && relevantAudit.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                            <AlertTriangle size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                            <div style={{ fontSize: 13, fontWeight: 600 }}>No detailed data available</div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>This stage has no work items or recent activity.</div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
