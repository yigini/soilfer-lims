import React from 'react';
import {
    X, Clock, User, FileText, AlertTriangle, FlaskConical,
    CheckCircle2, Loader2, ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getStatusColor, getDisplayName, getRoom, ROOM_CONFIG } from '../../utils/workflowMapper';

/**
 * Station Inspector Slide-out Drawer
 * Full Dark Mode support, comprehensive parameter breakdown, and direct technician action triggers.
 */
export default function WorkflowDetailDrawer({
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onClose) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    isOpen,
    onClose,
    selectedRoom,
    stageSummary,
    blockerGraph = [],
    workItems = [],
    auditLog = [],
    sample,
    onClose,
}) {
    const navigate = useNavigate();
    if (!selectedRoom) return null;

    const config = ROOM_CONFIG[selectedRoom] || {};
    const accent = config?.accent || '#6366f1';
    const roomItems = (workItems || []).filter(wi => getRoom(wi.analysis) === selectedRoom);

    // Relevant audit events for this specific station
    const relevantAudit = (auditLog || []).filter(ev => {
        if (ev.entity === 'WORKITEM') {
            return roomItems.some(wi => wi.id === ev.entityId);
        }
        if (ev.entity === 'SAMPLE' && ev.details?.toLowerCase().includes(selectedRoom.toLowerCase())) {
            return true;
        }
        return false;
    }).slice(0, 20);

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) +
            ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    };

    const doneCount = stageSummary?.done || roomItems.filter(w => ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(w.status)).length;
    const totalCount = stageSummary?.total || roomItems.length;
    const inProgressCount = stageSummary?.inProgress || roomItems.filter(w => w.status === 'IN_PROGRESS').length;
    const blockedCount = stageSummary?.blocked || 0;

    return (
        <>
            <div
                className="wf-drawer-backdrop fixed inset-0 z-40 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity duration-300"
                onClick={onClose}
                aria-hidden="true"
            />
            <aside
                className="wf-drawer fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-sf-surface border-l border-sf-divider shadow-2xl flex flex-col transition-transform duration-300 ease-out"
                role="dialog"
                aria-label={`${selectedRoom} station details`}
            >
                {/* Drawer Header */}
                <div
                    className="p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50"
                    style={{ borderTop: `4px solid ${accent}` }}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl shrink-0 p-2 rounded-xl bg-sf-surface shadow-xs border border-sf-divider">
                            {config.emoji || '🔬'}
                        </span>
                        <div className="min-w-0">
                            <div className="text-base font-extrabold text-sf-text tracking-tight truncate">
                                {selectedRoom}
                            </div>
                            <div className="text-xs text-sf-muted font-medium truncate mt-0.5">
                                {config.description || 'Analytical Station'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-sf-raised transition-colors"
                        aria-label="Close drawer"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Drawer Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Quick Workbench Action Banner */}
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-500/20 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-xs font-bold text-sf-text flex items-center gap-1.5">
                                <FlaskConical size={14} className="text-sf-emerald" />
                                <span>Technician Workbench</span>
                            </div>
                            <div className="text-[11px] text-sf-muted mt-0.5">
                                Jump to active queue for this station
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                onClose();
                                navigate(`/workbench?sampleId=${sample?.id || sample?.labId}`);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1 shrink-0"
                        >
                            <span>Open</span>
                            <ArrowRight size={12} />
                        </button>
                    </div>

                    {/* Metric Stats Quad */}
                    <div>
                        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                            Station Overview
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            <div className="p-3 bg-sf-canvas/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 text-center">
                                <div className="text-base font-black text-sf-text">{totalCount}</div>
                                <div className="text-[9px] font-extrabold text-slate-400 dark:text-slate-500 uppercase mt-0.5">Total</div>
                            </div>
                            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 text-center">
                                <div className="text-base font-black text-emerald-700 dark:text-emerald-300">{doneCount}</div>
                                <div className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">Done</div>
                            </div>
                            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-800/60 text-center">
                                <div className="text-base font-black text-amber-700 dark:text-amber-300">{inProgressCount}</div>
                                <div className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 uppercase mt-0.5">Active</div>
                            </div>
                            <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200/60 dark:border-rose-800/60 text-center">
                                <div className="text-base font-black text-rose-700 dark:text-rose-300">{blockedCount}</div>
                                <div className="text-[9px] font-extrabold text-rose-600 dark:text-rose-400 uppercase mt-0.5">Blocked</div>
                            </div>
                        </div>
                    </div>

                    {/* Blockers Alert (if any) */}
                    {(() => {
                        const roomBlockers = blockerGraph.filter(b => b.room === selectedRoom);
                        if (roomBlockers.length === 0) return null;
                        return (
                            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl">
                                <div className="flex items-center gap-2 text-xs font-extrabold text-amber-900 dark:text-amber-200 mb-1.5">
                                    <AlertTriangle size={14} className="text-amber-600" />
                                    <span>Gate Dependency Blockers ({roomBlockers.length})</span>
                                </div>
                                <div className="space-y-1.5">
                                    {roomBlockers.map((b, i) => (
                                        <div key={i} className="text-xs text-amber-800 dark:text-amber-300">
                                            • <strong>{b.displayName || b.analysis}:</strong> {b.reason}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Analyses Table List */}
                    {roomItems.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                                <span className="flex items-center gap-1.5">
                                    <FileText size={13} />
                                    <span>Station Analyses ({roomItems.length})</span>
                                </span>
                            </div>
                            <div className="space-y-2">
                                {roomItems.map((wi, idx) => {
                                    const sc = getStatusColor(wi.status);
                                    return (
                                        <div
                                            key={idx}
                                            className="p-3 rounded-xl bg-sf-canvas/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-2xs hover:border-indigo-400/60 dark:hover:border-indigo-500/60 transition-colors"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold text-sf-text truncate">
                                                    {getDisplayName(wi.analysis)}
                                                </div>
                                                <div className="text-[10px] text-sf-muted flex items-center gap-2 mt-0.5">
                                                    <span className="font-mono">{wi.analysis}</span>
                                                    {wi.assignedTo ? (
                                                        <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                                                            <User size={10} /> {wi.assignedTo}
                                                        </span>
                                                    ) : (
                                                        <span className="italic text-slate-400">Unassigned</span>
                                                    )}
                                                    {wi.result && (
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                            Val: {wi.result}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <span
                                                className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase shrink-0 border"
                                                style={{
                                                    color: sc.text,
                                                    backgroundColor: sc.bg,
                                                    borderColor: `${sc.text}30`
                                                }}
                                            >
                                                {sc.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Assigned Handlers */}
                    {stageSummary?.staff?.length > 0 && (
                        <div>
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <User size={13} />
                                <span>Assigned Handlers</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {stageSummary.staff.map((name, i) => (
                                    <div
                                        key={i}
                                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-sf-divider flex items-center gap-2 text-xs font-semibold text-sf-text"
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shadow-xs"
                                            style={{ background: accent }}
                                        >
                                            {name.split(/[ _-]/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <span>{name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Station Event Audit Log */}
                    {relevantAudit.length > 0 && (
                        <div>
                            <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <Clock size={13} />
                                <span>Station Activity Trail</span>
                            </div>
                            <div className="space-y-2.5 relative before:absolute before:top-2 before:bottom-2 before:left-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                                {relevantAudit.map((ev, i) => (
                                    <div key={i} className="flex items-start gap-3 relative pl-6">
                                        <div
                                            className="w-2 h-2 rounded-full absolute left-1 top-1.5 ring-4 ring-white dark:ring-slate-900"
                                            style={{ backgroundColor: accent }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold text-sf-text">
                                                {ev.action?.replace(/_/g, ' ')}
                                            </div>
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                                {formatDate(ev.timestamp)} {ev.performedBy && `• by ${ev.performedBy}`}
                                            </div>
                                            {ev.details && (
                                                <div className="text-[11px] text-sf-muted mt-1 p-2 rounded-lg bg-sf-canvas/40 border border-slate-200/50 dark:border-slate-700/50">
                                                    {ev.details}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {roomItems.length === 0 && relevantAudit.length === 0 && (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                            <ShieldCheck size={36} className="mx-auto mb-3 opacity-40" />
                            <div className="text-sm font-bold text-sf-text">Station on Standby</div>
                            <div className="text-xs mt-1">No active tests or log history for this sample at this station.</div>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
