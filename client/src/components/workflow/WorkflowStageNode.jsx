import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
    PackageCheck, Filter, Ruler, FlaskConical, ScanLine,
    ShieldCheck, Archive, CheckCircle2, Circle, Loader2,
    AlertCircle, Clock, Users,
} from 'lucide-react';
import { getStatusColor } from '../../utils/workflowMapper';

// ─── Icon Resolver ───
const ICON_MAP = {
    PackageCheck, Filter, Ruler, FlaskConical, ScanLine,
    ShieldCheck, Archive,
};
function RoomIcon({ name, size = 18, style }) {
    const Icon = ICON_MAP[name] || PackageCheck;
    return <Icon size={size} style={style} />;
}

// ─── Status Badge Config ───
const PHASE_STYLES = {
    current: {
        border: '2px solid var(--accent)',
        boxShadow: '0 0 0 4px var(--accent-glow), 0 8px 32px rgba(0,0,0,0.08)',
        opacity: 1,
        bg: '#ffffff',
    },
    completed: {
        border: '1.5px solid #bbf7d0',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        opacity: 1,
        bg: '#f8fdf9',
    },
    future: {
        border: '1.5px dashed #cbd5e1',
        boxShadow: 'none',
        opacity: 0.55,
        bg: '#f8fafc',
    },
};

const STATUS_DOTS = {
    NOT_ASSIGNED: { color: '#cbd5e1', Icon: Circle },
    ASSIGNED: { color: '#60a5fa', Icon: Circle },
    IN_PROGRESS: { color: '#f59e0b', Icon: Loader2 },
    COMPLETED: { color: '#818cf8', Icon: CheckCircle2 },
    SUBMITTED: { color: '#818cf8', Icon: CheckCircle2 },
    ACCEPTED: { color: '#34d399', Icon: CheckCircle2 },
    REANALYSIS_REQUIRED: { color: '#f87171', Icon: AlertCircle },
    WAIVED: { color: '#94a3b8', Icon: Circle },
    PENDING: { color: '#e2e8f0', Icon: Circle },
};

// ─── Handle Styles ───
const hStyle = (color) => ({
    width: 8, height: 8,
    border: '2px solid white',
    backgroundColor: color,
    boxShadow: `0 0 4px ${color}30`,
    borderRadius: '50%',
});

function WorkflowStageNode({ data }) {
    const {
        room, config, phase, total, done, inProgress, blocked,
        status, staff, analyses, sampleInfo,
    } = data;

    const accent = config?.accent || '#94a3b8';
    const phaseStyle = PHASE_STYLES[phase] || PHASE_STYLES.future;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isEmpty = status === 'EMPTY' && total === 0 && !sampleInfo;

    const cssVars = {
        '--accent': accent,
        '--accent-glow': `${accent}20`,
    };

    return (
        <div
            className={`wf-node wf-node-${phase} ${phase === 'current' ? 'wf-node-pulse' : ''}`}
            style={{
                ...cssVars,
                width: 240,
                border: phaseStyle.border,
                borderRadius: 20,
                backgroundColor: phaseStyle.bg,
                opacity: phaseStyle.opacity,
                boxShadow: phaseStyle.boxShadow,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
            }}
        >
            {/* Accent bar */}
            <div style={{
                height: 3,
                borderRadius: '20px 20px 0 0',
                background: phase === 'future' ? '#e2e8f0' : `linear-gradient(90deg, ${accent}, ${accent}80)`,
                transition: 'background 0.4s',
            }} />

            {/* Beacon for current room */}
            {phase === 'current' && (
                <div className="wf-beacon" style={{ position: 'absolute', top: -6, right: -6, zIndex: 5 }}>
                    <div className="wf-beacon-dot" style={{ borderColor: 'white', background: accent }} />
                </div>
            )}

            {/* Header */}
            <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="wf-node-icon" style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: phase !== 'future'
                        ? `linear-gradient(135deg, ${accent}18, ${accent}08)`
                        : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s',
                }}>
                    <RoomIcon name={config?.icon} size={18} style={{
                        color: phase !== 'future' ? accent : '#94a3b8',
                        transition: 'color 0.3s',
                    }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 11, fontWeight: 800,
                        color: phase !== 'future' ? accent : '#94a3b8',
                        textTransform: 'uppercase', letterSpacing: 0.8,
                        transition: 'color 0.3s',
                    }}>
                        {room}
                    </div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 1 }}>
                        {config?.description}
                    </div>
                </div>
                {total > 0 && (
                    <div className="wf-count-badge" style={{
                        fontSize: 10, fontWeight: 800, color: accent,
                        backgroundColor: `${accent}10`, borderRadius: 8,
                        padding: '2px 8px', transition: 'all 0.3s',
                    }}>
                        {done}/{total}
                    </div>
                )}
            </div>

            {/* Reception: Sample Info */}
            {sampleInfo && (
                <div className="wf-node-content" style={{ padding: '0 16px 12px' }}>
                    <div style={{
                        padding: '10px 12px', borderRadius: 12,
                        backgroundColor: `${accent}06`, border: `1px solid ${accent}10`,
                    }}>
                        <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b', letterSpacing: 0.3 }}>
                            {sampleInfo.labId}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                            {sampleInfo.projectCode}
                        </div>
                        <div style={{
                            display: 'inline-block', marginTop: 6,
                            fontSize: 9, fontWeight: 700, padding: '2px 8px',
                            borderRadius: 6, textTransform: 'uppercase', letterSpacing: 0.5,
                            backgroundColor: sampleInfo.status === 'EXPECTED' ? '#fef3c7' : '#dbeafe',
                            color: sampleInfo.status === 'EXPECTED' ? '#d97706' : '#2563eb',
                            transition: 'all 0.3s',
                        }}>
                            {sampleInfo.status || 'RECEIVED'}
                        </div>
                    </div>
                </div>
            )}

            {/* Progress bar */}
            {total > 0 && (
                <div style={{ padding: '0 16px 4px' }}>
                    <div style={{
                        height: 4, backgroundColor: `${accent}10`,
                        borderRadius: 99, overflow: 'hidden',
                    }}>
                        <div className="wf-progress-animated" style={{
                            height: '100%', width: `${pct}%`,
                            borderRadius: 99,
                            background: `linear-gradient(90deg, ${accent}90, ${accent})`,
                            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                        }} />
                    </div>
                </div>
            )}

            {/* Analysis list */}
            {analyses && analyses.length > 0 && (() => {
                // Sort: completed/submitted first, then in-progress, then assigned, then pending
                const STATUS_PRIORITY = {
                    COMPLETED: 0, SUBMITTED: 0, ACCEPTED: 0,
                    IN_PROGRESS: 1,
                    ASSIGNED: 2,
                    PENDING: 3, WAIVED: 3,
                    REANALYSIS_REQUIRED: 1,
                };
                const sorted = [...analyses].sort((a, b) =>
                    (STATUS_PRIORITY[a.status] ?? 4) - (STATUS_PRIORITY[b.status] ?? 4)
                );
                return (
                    <div className="wf-node-analyses nodrag nopan nowheel" style={{
                        padding: '4px 12px 10px',
                        maxHeight: 120, overflowY: 'auto',
                        scrollbarWidth: 'thin',
                    }}>
                        {sorted.slice(0, 8).map((a, i) => {
                            const sc = getStatusColor(a.status);
                            const dot = STATUS_DOTS[a.status] || STATUS_DOTS.PENDING;
                            const StatusIcon = dot.Icon;

                            return (
                                <div
                                    key={i}
                                    className="wf-analysis-row"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '3px 6px', borderRadius: 6,
                                        transition: 'background 0.2s',
                                        animationDelay: `${i * 60}ms`,
                                    }}
                                >
                                    <StatusIcon
                                        size={11}
                                        style={{ color: dot.color, flexShrink: 0 }}
                                        className={a.status === 'IN_PROGRESS' ? 'wf-spin' : ''}
                                    />
                                    <span style={{
                                        flex: 1, fontSize: 10, color: '#374151',
                                        fontWeight: 500, overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {a.name}
                                    </span>
                                    <span className="wf-status-chip" style={{
                                        fontSize: 8, fontWeight: 700, padding: '1px 6px',
                                        borderRadius: 5, flexShrink: 0,
                                        color: sc.text, backgroundColor: sc.bg,
                                        transition: 'all 0.3s',
                                    }}>
                                        {sc.label}
                                    </span>
                                </div>
                            );
                        })}
                        {analyses.length > 8 && (
                            <div style={{ fontSize: 9, color: '#94a3b8', paddingTop: 2, textAlign: 'center' }}>
                                +{analyses.length - 8} more
                            </div>
                        )}
                    </div>
                );
            })()}


            {/* Blocked indicator */}
            {blocked > 0 && (
                <div className="wf-blocked-badge" style={{
                    margin: '0 16px 8px',
                    fontSize: 9, fontWeight: 700, color: '#dc2626',
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 6,
                    backgroundColor: '#fef2f2',
                }}>
                    <AlertCircle size={10} /> {blocked} blocked
                </div>
            )}

            {/* Staff row */}
            {staff && staff.length > 0 && (
                <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Users size={10} style={{ color: '#94a3b8' }} />
                    {staff.map((name, i) => {
                        const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                        return (
                            <div key={i} title={name} style={{
                                width: 22, height: 22, borderRadius: '50%',
                                background: `linear-gradient(135deg, ${accent}30, ${accent}60)`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 8, fontWeight: 700, color: accent,
                                border: '2px solid white',
                                marginLeft: i > 0 ? -6 : 0,
                                zIndex: staff.length - i,
                                transition: 'transform 0.2s',
                            }}>
                                {initials}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty state */}
            {isEmpty && (
                <div style={{
                    fontSize: 10, color: '#cbd5e1', fontStyle: 'italic',
                    textAlign: 'center', padding: '0 16px 12px',
                }}>
                    No activity
                </div>
            )}

            {/* Handles — ids must match sourceHandle/targetHandle in edges */}
            <Handle type="target" position={Position.Left} id="left" style={hStyle(accent)} />
            <Handle type="source" position={Position.Right} id="right" style={hStyle(accent)} />
            <Handle type="target" position={Position.Top} id="top" style={hStyle(accent)} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={hStyle(accent)} />
        </div>
    );
}

export default memo(WorkflowStageNode);
