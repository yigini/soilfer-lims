import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { getStatusColor } from '../../utils/workflowMapper';
import {
    CheckCircle2, Circle, Loader2, AlertCircle,
    ChevronDown, ChevronRight,
    Beaker, ScanLine, Pipette,
    Layers, Scale, FlaskConical, FlaskRound,
    Gauge, Eye, Radiation, Thermometer, Trash2,
    Filter, Sun, User,
} from 'lucide-react';

// ─── Status dot config ───
const STATUS_DOT = {
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

// ─── Analysis icons ───
const A_ICONS = {
    DRYING: Sun, PREPARATION: Filter,
    PH: Beaker, PH_H2O: Beaker, PH_KCL: Beaker, EC: Beaker,
    SOC: Layers, OC: Layers, TN: Layers, TC: Layers,
    TEXTURE: Layers, SAND: Layers, SILT: Layers, CLAY: Layers, GRAVEL: Layers,
    CEC: FlaskRound, AV_P: Pipette, P_BRAY: Pipette, P_OLSEN: Pipette, PHOS: Pipette,
    EX_ACIDITY: FlaskConical, BULK_DENSITY: Scale, BD: Scale,
    MC: Gauge, MOIST: Gauge, MOISTURE: Gauge,
    MIR: ScanLine, SPEC_MIR: ScanLine, VISNIR: Eye, SPEC_VIS_NIR: Eye, XRF: Radiation,
    ARCHIVING: Trash2, DISPOSAL: Trash2,
    K_EXCH: FlaskConical, CA_EXCH: FlaskConical, MG_EXCH: FlaskConical, NA_EXCH: FlaskConical,
    FE: Thermometer, MN: Thermometer, ZN: Thermometer, CU: Thermometer, B: Thermometer,
    CACO3: FlaskRound, S_RESP: Layers,
};
function aIcon(code) { return A_ICONS[code?.toUpperCase()] || Beaker; }

// ─── Soft gradient bar ───
function GradientBar({ accent, inactive }) {
    return (
        <div style={{
            height: 3, borderRadius: '20px 20px 0 0',
            background: inactive ? '#e2e8f0' : `linear-gradient(90deg, ${accent}, ${accent}80)`,
        }} />
    );
}

// ─── Progress Bar (soft) ───
function ProgressBar({ pct, accent }) {
    return (
        <div style={{
            height: 5, backgroundColor: `${accent}12`, borderRadius: 99, overflow: 'hidden',
            flex: 1
        }}>
            <div style={{
                height: '100%', width: `${pct}%`, borderRadius: 99,
                background: `linear-gradient(90deg, ${accent}90, ${accent})`,
                transition: 'width 0.6s ease',
            }} />
        </div>
    );
}

// ── Room width ──
const ROOM_W = 500;

function WorkflowNode({ data, selected }) {
    // Scrollable list instead of expanded/collapsed
    const config = data.config || {};
    const items = data.analysisList || [];
    const rs = data.roomStatus || {};
    const here = data.sampleHere;
    const accent = config.accent || '#6b7280';
    const isActive = data.isActive;
    const isCurrentRoom = data.isCurrentRoom;
    const assignees = data.assignees || [];
    const bottleneckCount = data.bottleneckCount || 0;
    const bottleneckSeverity = data.bottleneckSeverity;

    // ─── Styles ───
    const boxShadow = isActive
        ? here
            ? `0 0 0 2px ${accent}30, 0 0 35px ${accent}15, 0 8px 32px rgba(0,0,0,0.06)`
            : selected
                ? `0 0 0 2px ${accent}25, 0 8px 28px rgba(0,0,0,0.08)`
                : '0 2px 16px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.03)'
        : 'none';

    const roomStyle = {
        width: ROOM_W,
        border: isActive
            ? `1.5px solid ${here ? `${accent}40` : '#e5e7eb'}`
            : '1.5px dashed #cbd5e1',
        borderRadius: 24,
        backgroundColor: isActive ? '#ffffff' : '#f8fafc',
        opacity: isActive ? 1 : 0.6,
        boxShadow,
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.4s ease',
        display: 'flex', flexDirection: 'column',
        // P1: Beacon glow on current room
        ...(isCurrentRoom && {
            border: `2px solid ${accent}80`,
            boxShadow: `0 0 0 4px ${accent}15, 0 0 40px ${accent}20, 0 8px 32px rgba(0,0,0,0.08)`,
        }),
    };

    // ═══════════════════════════
    //  RECEPTION (Sample card)
    // ═══════════════════════════
    if (data.isReception) {
        const info = data.sampleInfo || {};
        return (
            <div style={roomStyle}>
                <GradientBar accent={accent} />
                <div style={{ padding: '14px 18px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 12,
                            background: `linear-gradient(135deg, ${accent}15, ${accent}08)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20,
                        }}>
                            {config.emoji}
                        </div>
                        <div>
                            <div style={{
                                fontSize: 11, fontWeight: 700, color: accent,
                                textTransform: 'uppercase', letterSpacing: 1.2
                            }}>
                                {data.title}
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{config.description}</div>
                        </div>
                        {here && <SampleHere accent={accent} />}
                    </div>
                    {/* Sample info */}
                    <div style={{
                        padding: '12px 14px', borderRadius: 14,
                        backgroundColor: `${accent}06`, border: `1px solid ${accent}10`,
                    }}>
                        <div style={{ fontWeight: 800, fontSize: 20, color: '#1e293b', letterSpacing: 0.5 }}>
                            {info.labId}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            {info.projectCode}
                        </div>
                        <div style={{
                            display: 'inline-block', marginTop: 8, fontSize: 10, fontWeight: 700,
                            padding: '3px 10px', borderRadius: 8,
                            backgroundColor: `${accent}12`, color: accent,
                            textTransform: 'uppercase', letterSpacing: 0.5,
                        }}>
                            RECEIVED
                        </div>
                    </div>
                </div>
                <Handle type="source" position={Position.Right} style={hStyle(accent)} />
            </div>
        );
    }

    // ═══════════════════════════
    //  QA OFFICE (aggregate)
    // ═══════════════════════════
    if (data.isQA) {
        return (
            <div style={roomStyle}>
                <Handle type="target" position={Position.Top} style={hStyle(accent)} />
                <Handle type="source" position={Position.Right} style={hStyle(accent)} />
                <GradientBar accent={accent} inactive={!isActive} />
                <div style={{ padding: '14px 18px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{
                            width: 38, height: 38, borderRadius: 12,
                            background: isActive ? `linear-gradient(135deg, ${accent}15, ${accent}08)` : '#f1f5f9',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 20, opacity: isActive ? 1 : 0.5
                        }}>
                            {config.emoji}
                        </div>
                        <div>
                            <div style={{
                                fontSize: 11, fontWeight: 700, color: isActive ? accent : '#94a3b8',
                                textTransform: 'uppercase', letterSpacing: 1.2
                            }}>
                                {data.title}
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{config.description}</div>
                        </div>
                        {here && isActive && <SampleHere accent={accent} />}
                    </div>

                    {isActive ? (
                        <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
                            <div style={{ fontWeight: 900, fontSize: 32, color: accent, lineHeight: 1 }}>
                                {rs.accepted}/{rs.total}
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 4 }}>approved</div>
                            <div style={{ marginTop: 8 }}>
                                <ProgressBar pct={rs.pct || 0} accent={accent} />
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            fontSize: 10, color: '#cbd5e1', fontStyle: 'italic',
                            textAlign: 'center', padding: '10px 0'
                        }}>
                            No active QC tasks
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════
    //  LAB ROOM (Phys/Chem/Spec/Prep/Archive)
    // ═══════════════════════════════════════
    const hasItems = items.length > 0;

    // Fixed height layout logic:
    // Header ~60px
    // Progress Bar ~10px
    // List Area ~max-height: 140px

    return (
        <div style={roomStyle}>
            <Handle
                type="target"
                position={data.roomName === 'Preparation Room' || data.roomName === 'Archive & Disposal' ? Position.Left : Position.Top}
                style={hStyle(isActive ? accent : '#cbd5e1')}
            />

            <GradientBar accent={accent} inactive={!isActive} />

            {/* Room header */}
            <div
                style={{
                    padding: '12px 16px 8px', display: 'flex', alignItems: 'center',
                    gap: 10,
                }}
            >
                <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    background: isActive ? `linear-gradient(135deg, ${accent}15, ${accent}08)` : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, opacity: isActive ? 1 : 0.5
                }}>
                    {config.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 11, fontWeight: 700, color: isActive ? accent : '#94a3b8',
                        textTransform: 'uppercase', letterSpacing: 1.2
                    }}>
                        {data.title}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{config.description}</div>
                </div>

                {hasItems && (
                    <div style={{
                        fontSize: 11, fontWeight: 800, color: accent,
                        backgroundColor: `${accent}08`, borderRadius: 10,
                        padding: '3px 10px',
                    }}>
                        {rs.accepted}/{rs.total}
                    </div>
                )}
                <StaffPresence assignees={assignees} accent={accent} />
                {bottleneckCount > 0 && (
                    <div
                        title={`${bottleneckCount} item(s) delayed (${bottleneckSeverity})`}
                        aria-label={`${bottleneckCount} bottleneck items`}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 3,
                            fontSize: 10, fontWeight: 700,
                            color: bottleneckSeverity === 'CRITICAL' ? '#dc2626' : '#d97706',
                            backgroundColor: bottleneckSeverity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                            borderRadius: 8, padding: '2px 8px',
                            animation: bottleneckSeverity === 'CRITICAL' ? 'pulse 2s infinite' : 'none',
                        }}
                    >
                        ⚠ {bottleneckCount}
                    </div>
                )}
            </div>

            {/* Content or Ghost Message */}
            {isActive ? (
                <>
                    <div style={{ padding: '0 16px 4px' }}>
                        <ProgressBar pct={rs.pct || 0} accent={accent} />
                    </div>

                    {/* SCROLLABLE LIST AREA */}
                    <div
                        className="nodrag nopan nowheel"
                        style={{
                            padding: '4px 10px 10px',
                            maxHeight: 140, // Keeps room size reasonable
                            overflowY: 'auto',
                            scrollbarWidth: 'thin',
                        }}
                        onWheel={(e) => e.stopPropagation()}
                    >
                        {items.map((item, i) => {
                            const dot = STATUS_DOT[item.status] || STATUS_DOT.PENDING;
                            const StatusIcon = dot.Icon;
                            const ItemIcon = aIcon(item.analysisCode);
                            const sc = getStatusColor(item.status);

                            return (
                                <div key={item.id || i} style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '3px 8px', borderRadius: 8,
                                    opacity: item.blocked ? 0.3 : 1,
                                    transition: 'background 0.2s',
                                    marginBottom: 2,
                                }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = `${accent}06`}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    <StatusIcon
                                        size={12} style={{ color: dot.color, flexShrink: 0 }}
                                        className={item.status === 'IN_PROGRESS' ? 'animate-spin' : ''}
                                    />
                                    <ItemIcon size={12} style={{ color: `${accent}60`, flexShrink: 0 }} />
                                    <span style={{
                                        flex: 1, fontSize: 11, color: '#374151',
                                        fontWeight: 500, overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {item.name}
                                    </span>
                                    <span style={{
                                        fontSize: 9, fontWeight: 700, padding: '1px 6px',
                                        borderRadius: 6, flexShrink: 0,
                                        color: sc.text, backgroundColor: sc.bg,
                                    }}>
                                        {sc.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </>
            ) : (
                <div style={{
                    fontSize: 10, color: '#cbd5e1', fontStyle: 'italic',
                    textAlign: 'center', padding: '0 0 16px'
                }}>
                    No active analyses
                </div>
            )}

            {isActive && here && <SampleHere accent={accent} />}

            <Handle
                type="source"
                position={data.roomName === 'Preparation Room' || data.roomName.includes('Lab') ? Position.Bottom : Position.Right}
                style={hStyle(isActive ? accent : '#cbd5e1')}
            />
        </div>
    );
}

// ── "Sample is HERE" soft pulsing badge ──
function SampleHere({ accent }) {
    return (
        <div style={{
            position: 'absolute', top: 12, right: 12,
            display: 'flex', alignItems: 'center', gap: 4,
        }}>
            <div style={{
                width: 7, height: 7, borderRadius: '50%',
                backgroundColor: '#f59e0b',
                boxShadow: '0 0 10px #f59e0b60',
                animation: 'samplePulse 2s ease-in-out infinite',
            }} />
            <span style={{
                fontSize: 8, fontWeight: 700, color: '#d97706', letterSpacing: 0.5,
                textTransform: 'uppercase'
            }}>
                here
            </span>
            <style>{`
                @keyframes samplePulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.4; transform: scale(1.4); }
                }
            `}</style>
        </div>
    );
}

// ── Staff Presence Chips ──
function StaffPresence({ assignees, accent }) {
    if (!assignees || assignees.length === 0) return null;
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: -4,
            marginLeft: 'auto',
        }}>
            {assignees.map((name, i) => {
                const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
                return (
                    <div key={i} title={name} style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${accent}30, ${accent}60)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: accent,
                        border: '2px solid white',
                        marginLeft: i > 0 ? -6 : 0,
                        zIndex: assignees.length - i,
                    }}>
                        {initials}
                    </div>
                );
            })}
        </div>
    );
}

function hStyle(color) {
    return {
        width: 8, height: 8,
        border: '2px solid white',
        backgroundColor: color,
        boxShadow: `0 0 4px ${color}30`,
        borderRadius: '50%',
    };
}

export default memo(WorkflowNode);
