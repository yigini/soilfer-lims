import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
    PackageCheck, Filter, Ruler, FlaskConical, ScanLine,
    ShieldCheck, Archive, CheckCircle2, Circle, Loader2,
    AlertCircle, Clock, Users, ChevronRight, Sparkles
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

const STATUS_DOTS = {
    NOT_ASSIGNED: { color: '#94a3b8', Icon: Circle },
    ASSIGNED: { color: '#3b82f6', Icon: Circle },
    IN_PROGRESS: { color: '#f59e0b', Icon: Loader2 },
    COMPLETED: { color: '#10b981', Icon: CheckCircle2 },
    SUBMITTED: { color: '#6366f1', Icon: CheckCircle2 },
    ACCEPTED: { color: '#10b981', Icon: CheckCircle2 },
    REANALYSIS_REQUIRED: { color: '#ef4444', Icon: AlertCircle },
    WAIVED: { color: '#94a3b8', Icon: Circle },
    PENDING: { color: '#cbd5e1', Icon: Circle },
};

// ─── Handle Styles ───
const hStyle = (color) => ({
    width: 10,
    height: 10,
    border: '2px solid rgba(255,255,255,0.9)',
    backgroundColor: color,
    boxShadow: `0 0 8px ${color}80`,
    borderRadius: '50%',
});

function WorkflowStageNode({ data }) {
    const {
        room, config, phase, total, done, inProgress, blocked,
        status, staff, analyses, sampleInfo,
    } = data;

    const accent = config?.accent || '#6366f1';
    const isCurrent = phase === 'current';
    const isCompleted = phase === 'completed';
    const isFuture = phase === 'future';

    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const queuedCount = Math.max(0, (total || 0) - (done || 0) - (inProgress || 0));
    const isEmpty = status === 'EMPTY' && total === 0 && !sampleInfo;

    return (
        <div
            className={`wf-node group ${isCurrent ? 'wf-node-current' : isCompleted ? 'wf-node-completed' : 'wf-node-future'}`}
            style={{
                '--accent': accent,
                '--accent-glow': `${accent}25`,
            }}
        >
            {/* Top Accent Gradient Bar */}
            <div
                className="wf-node-accent-bar"
                style={{
                    background: isFuture
                        ? 'var(--wf-future-border)'
                        : `linear-gradient(90deg, ${accent}, ${accent}90)`,
                }}
            />

            {/* Active Station Pulsing Radar Beacon */}
            {isCurrent && (
                <div className="absolute -top-1.5 -right-1.5 z-20 flex h-4 w-4">
                    <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: accent }}
                    />
                    <span
                        className="relative inline-flex rounded-full h-4 w-4 border-2 border-white dark:border-slate-900 shadow-md"
                        style={{ backgroundColor: accent }}
                    />
                </div>
            )}

            {/* Card Header: Icon + Title + Count Badge */}
            <div className="p-3.5 pb-2 flex items-center gap-2.5">
                <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 shadow-sm"
                    style={{
                        background: !isFuture
                            ? `linear-gradient(135deg, ${accent}25, ${accent}10)`
                            : 'var(--wf-icon-bg-future)',
                        border: `1px solid ${accent}30`
                    }}
                >
                    <RoomIcon
                        name={config?.icon}
                        size={18}
                        style={{ color: !isFuture ? accent : '#94a3b8' }}
                    />
                </div>

                <div className="flex-1 min-w-0">
                    <div
                        className="text-xs font-black tracking-wide uppercase truncate transition-colors"
                        style={{ color: !isFuture ? accent : 'var(--wf-text-muted)' }}
                    >
                        {room}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                        {config?.description || 'Analytical Station'}
                    </div>
                </div>

                {total > 0 && (
                    <div
                        className="px-2 py-0.5 rounded-lg text-[10px] font-black tracking-tight shrink-0 shadow-xs border"
                        style={{
                            color: accent,
                            backgroundColor: `${accent}15`,
                            borderColor: `${accent}30`
                        }}
                    >
                        {done}/{total}
                    </div>
                )}
            </div>

            {/* Reception Station: Sample Information Card */}
            {sampleInfo && (
                <div className="px-3.5 pb-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
                        <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                            {sampleInfo.labId}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>{sampleInfo.projectCode || 'LIMS Project'}</span>
                            {sampleInfo.matrix && (
                                <>
                                    <span>•</span>
                                    <span>{sampleInfo.matrix}</span>
                                </>
                            )}
                        </div>
                        <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            {sampleInfo.status || 'RECEIVED'}
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Meter Bar */}
            {total > 0 && (
                <div className="px-3.5 pb-2">
                    <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        <span>Completion</span>
                        <span style={{ color: accent }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-700/50">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, ${accent}80, ${accent})`,
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Metric Status Chips (Clean Replacement for Trap Scrollbar) */}
            {total > 0 && (
                <div className="px-3.5 pb-2 flex items-center gap-1.5 flex-wrap">
                    {done > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                            <CheckCircle2 size={10} /> {done} Done
                        </span>
                    )}
                    {inProgress > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                            <Loader2 size={10} className="animate-spin" /> {inProgress} Active
                        </span>
                    )}
                    {queuedCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {queuedCount} Queued
                        </span>
                    )}
                    {blocked > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                            <AlertCircle size={10} /> {blocked} Blocked
                        </span>
                    )}
                </div>
            )}

            {/* Top 3 Key Analyses Pills */}
            {analyses && analyses.length > 0 && (
                <div className="px-3.5 pb-2 space-y-1">
                    {analyses.slice(0, 3).map((a, i) => {
                        const sc = getStatusColor(a.status);
                        const dot = STATUS_DOTS[a.status] || STATUS_DOTS.PENDING;
                        const StatusIcon = dot.Icon;

                        return (
                            <div
                                key={i}
                                className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-[10px]"
                            >
                                <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                                    <StatusIcon
                                        size={10}
                                        style={{ color: dot.color }}
                                        className={a.status === 'IN_PROGRESS' ? 'animate-spin' : ''}
                                    />
                                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                                        {a.name}
                                    </span>
                                </div>
                                <span
                                    className="px-1.5 py-0.2 rounded text-[8px] font-bold uppercase shrink-0"
                                    style={{ color: sc.text, backgroundColor: sc.bg }}
                                >
                                    {sc.label}
                                </span>
                            </div>
                        );
                    })}

                    {analyses.length > 3 && (
                        <div className="pt-0.5 text-center">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline inline-flex items-center gap-0.5">
                                +{analyses.length - 3} more parameters <ChevronRight size={10} />
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Staff Row */}
            {staff && staff.length > 0 && (
                <div className="px-3.5 pb-2.5 flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-2">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        <Users size={11} /> Handlers
                    </div>
                    <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {staff.map((name, i) => {
                            const initials = name?.split(/[ _-]/).map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                            return (
                                <div
                                    key={i}
                                    title={name}
                                    className="w-5 h-5 rounded-full ring-2 ring-white dark:ring-slate-900 flex items-center justify-center text-[8px] font-extrabold shadow-xs"
                                    style={{
                                        background: `linear-gradient(135deg, ${accent}, ${accent}90)`,
                                        color: '#ffffff'
                                    }}
                                >
                                    {initials}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {isEmpty && (
                <div className="px-3.5 pb-3 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500 italic">
                    Station on Standby
                </div>
            )}

            {/* Hover Action Hint */}
            <div className="px-3.5 py-1.5 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800/80 rounded-b-[19px] flex items-center justify-between text-[9px] font-bold text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                <span>Station Inspector</span>
                <ChevronRight size={11} className="transition-transform group-hover:translate-x-0.5" />
            </div>

            {/* Connection Handles */}
            <Handle type="target" position={Position.Left} id="left" style={hStyle(accent)} />
            <Handle type="source" position={Position.Right} id="right" style={hStyle(accent)} />
            <Handle type="target" position={Position.Top} id="top" style={hStyle(accent)} />
            <Handle type="source" position={Position.Bottom} id="bottom" style={hStyle(accent)} />
        </div>
    );
}

export default memo(WorkflowStageNode);
