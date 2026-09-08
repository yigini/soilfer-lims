import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React, { useState } from 'react';
import axios from 'axios';
import {
    ArrowUp, ArrowDown, Folder, MapPin, FileText, User, Trash2,
    CalendarClock, Inbox, ClipboardCheck, Beaker, FileUp, FileOutput, Library, AlertCircle, Archive, Trash, History, Hash,
    CheckCircle2, ShieldCheck, Printer, Droplets, FlaskConical, AlertTriangle, Clock, ExternalLink,
    X, Activity, Loader2, Send, RotateCcw, Microscope, ChevronDown, ChevronUp, Truck,
    GitBranch, XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import InfoTooltip from '../common/InfoTooltip';

const STATE_CONFIG = {
    'EXPECTED': { icon: CalendarClock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Expected' },
    'RECEIVED': { icon: Inbox, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Received' },
    'COLLECTED': { icon: Inbox, color: 'text-blue-400', bg: 'bg-blue-50', label: 'Collected' },
    'ACCEPTED': { icon: ClipboardCheck, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Accepted' },
    'PROCESSING': { icon: Beaker, color: 'text-amber-500', bg: 'bg-amber-100', label: 'Processing' },
    'SUBMITTED_FULL': { icon: FileUp, color: 'text-purple-500', bg: 'bg-purple-100', label: 'Submitted' },
    'SUBMITTED_PARTIAL': { icon: FileOutput, color: 'text-purple-400', bg: 'bg-purple-50', label: 'Partial' },
    'APPROVED': { icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-100', label: 'Approved' },
    'ARCHIVING_PENDING': { icon: Library, color: 'text-amber-600', bg: 'bg-amber-50', label: 'Archiving' },
    'DISPOSAL_PENDING': { icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', label: 'Disposal' },
    'ARCHIVED': { icon: Archive, color: 'text-slate-500', bg: 'bg-slate-100', label: 'Archived' },
    'DISPOSED': { icon: Trash, color: 'text-gray-400', bg: 'bg-gray-100', label: 'Disposed' },
    'ON_HOLD': { icon: History, color: 'text-red-500', bg: 'bg-red-100', label: 'On Hold' },
    'LAB_ID_ASSIGNED': { icon: Hash, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'ID Assigned' },
    'Draft Intake': { icon: FileOutput, color: 'text-orange-400', bg: 'bg-orange-50', label: 'Draft Intake' },
    'DRAFT': { icon: FileOutput, color: 'text-orange-400', bg: 'bg-orange-50', label: 'Draft Intake' },
    'RECEIVED_REJECTED': { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-950/40', label: 'Rejected (Non-Conformance)' },
    'REJECTED': { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-100 dark:bg-rose-950/40', label: 'Rejected' }
};

const WI_STATUS_ICON = { 'NOT_ASSIGNED': '○', 'ASSIGNED': '◎', 'IN_PROGRESS': '◉', 'COMPLETED': '✓', 'ACCEPTED': '✓' };
const WI_STATUS_COLOR = { 'NOT_ASSIGNED': 'text-gray-400', 'ASSIGNED': 'text-blue-400', 'IN_PROGRESS': 'text-amber-400', 'COMPLETED': 'text-emerald-400', 'ACCEPTED': 'text-emerald-400' };

const CATEGORY_COLORS = {
    'Operational Gates': { bar: 'bg-blue-500', text: 'text-blue-400', label: 'Gates' },
    'Wet Chemistry': { bar: 'bg-amber-500', text: 'text-amber-400', label: 'Wet Chem' },
    'Texture': { bar: 'bg-teal-500', text: 'text-teal-400', label: 'Texture' },
    'Spectroscopy': { bar: 'bg-purple-500', text: 'text-purple-400', label: 'Spectral' },
    'QA/QC': { bar: 'bg-rose-500', text: 'text-rose-400', label: 'QA/QC' },
    'Review': { bar: 'bg-indigo-500', text: 'text-indigo-400', label: 'Review' },
    'Lifecycle': { bar: 'bg-emerald-500', text: 'text-emerald-400', label: 'Done' },
    'Other': { bar: 'bg-gray-500', text: 'text-gray-400', label: 'Other' }
};

const StatusIcon = ({ status, overrideText }) => {
    const config = STATE_CONFIG[status] || { icon: AlertCircle, color: 'text-gray-400', bg: 'bg-gray-50', label: status };
    const Icon = config.icon;
    const label = overrideText || config.label;
    return (
        <div className="flex items-center justify-center">
            <div className={`flex items-center justify-center p-2 rounded-xl transition-all duration-300 ease-out border-2 border-transparent group-hover:border-current group-hover:bg-current/10 ${config.bg} ${config.color}`}>
                <Icon size={18} className="transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
            </div>
            <InfoTooltip text={label} position="bottom" />
        </div>
    );
};

// Attention: returns null (N/A), [] (OK), or array of flags
const computeAttention = (sample) => {
    const st = sample.status;
    if (['EXPECTED', 'ARCHIVED', 'DISPOSED', 'APPROVED', 'SUBMITTED_FULL', 'RECEIVED_REJECTED', 'REJECTED'].includes(st)) return null;
    const flags = [];
    if (st === 'Draft Intake' || st === 'DRAFT')
        flags.push({ key: 'draft_intake', icon: AlertTriangle, color: 'text-orange-500', label: 'Info Only – Not yet accepted' });
    if (['RECEIVED', 'COLLECTED'].includes(st))
        flags.push({ key: 'needs_acceptance', icon: AlertTriangle, color: 'text-indigo-500', label: 'Needs Acceptance' });
    if (st === 'ACCEPTED' && sample.dryingStatus === 'PENDING' && sample.preparationStatus === 'PENDING')
        flags.push({ key: 'needs_processing', icon: Clock, color: 'text-amber-500', label: 'Awaiting Processing' });
    if (['PROCESSING', 'LAB_ID_ASSIGNED'].includes(st)) {
        if (sample.dryingStatus === 'PENDING') flags.push({ key: 'drying', icon: Droplets, color: 'text-blue-500', label: 'Drying Pending' });
        if (sample.preparationStatus === 'PENDING') flags.push({ key: 'prep', icon: FlaskConical, color: 'text-purple-500', label: 'Preparation Pending' });
    }
    // Work-item-level attention signals (from server activity flags)
    if (sample.hasInProgressWork) flags.push({ key: 'in_progress', icon: Clock, color: 'text-emerald-500', label: 'Analysis In Progress' });
    if (sample.hasAssignedWork) flags.push({ key: 'assigned', icon: AlertTriangle, color: 'text-blue-500', label: 'Work Assigned' });
    if (sample.hasReanalysisWork) flags.push({ key: 'reanalysis', icon: AlertTriangle, color: 'text-red-500', label: 'Reanalysis Required' });
    if (sample.pendingReview) flags.push({ key: 'review', icon: AlertTriangle, color: 'text-purple-500', label: 'Pending Review' });
    if (st === 'ON_HOLD') flags.push({ key: 'hold', icon: History, color: 'text-red-500', label: 'On Hold' });
    return flags;
};

// Progress: uses real work items grouped by category
const computeProgress = (sample) => {
    const st = sample.status;
    if (['EXPECTED', 'RECEIVED', 'COLLECTED'].includes(st)) return null;
    const wip = sample.workItemProgress;

    if (wip && wip.total > 0) {
        const categories = {};
        wip.items.forEach(item => {
            const cat = item.category || 'Other';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(item);
        });
        return { completed: wip.completed, total: wip.total, categories };
    }

    // Fallback to gate status
    const dD = sample.dryingStatus === 'DONE', pD = sample.preparationStatus === 'DONE';
    const completed = (dD ? 1 : 0) + (pD ? 1 : 0);
    if (['APPROVED', 'ARCHIVED', 'DISPOSED', 'SUBMITTED_FULL'].includes(st) && completed === 0)
        return { completed: 1, total: 1, categories: { Lifecycle: [{ analysis: 'Complete', status: 'COMPLETED' }] } };
    return {
        completed, total: 2,
        categories: {
            'Operational Gates': [
                { analysis: 'DRYING', status: dD ? 'COMPLETED' : sample.dryingStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'NOT_ASSIGNED' },
                { analysis: 'PREPARATION', status: pD ? 'COMPLETED' : sample.preparationStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'NOT_ASSIGNED' }
            ]
        }
    };
};

// Audit icon mapping (matches CollapsibleDrawer)
const getAuditIcon = (action) => {
    if (!action) return <Activity size={14} className="text-gray-400" />;
    if (action.includes('ASSIGN')) return <User size={14} className="text-blue-500" />;
    if (action.includes('SUBMIT')) return <Send size={14} className="text-purple-500" />;
    if (action.includes('REVIEW') || action.includes('DECISION')) return <ClipboardCheck size={14} className="text-green-500" />;
    if (action.includes('RECEIVED') || action.includes('SYNC')) return <Truck size={14} className="text-indigo-500" />;
    if (action.includes('REANALYSIS') || action.includes('REJECT')) return <RotateCcw size={14} className="text-red-500" />;
    if (action.includes('DRYING') || action.includes('PREP')) return <Activity size={14} className="text-orange-500" />;
    if (action.includes('RESULT')) return <Microscope size={14} className="text-cyan-500" />;
    if (action.includes('STATUS')) return <Activity size={14} className="text-indigo-500" />;
    if (action.includes('GENERATED')) return <Beaker size={14} className="text-amber-500" />;
    return <Activity size={14} className="text-gray-400" />;
};

// Humanize audit actions (matches CollapsibleDrawer)
const humanizeAudit = (event) => {
    const { action, details, analysisName, decision, type, performedByName } = event;
    const actor = performedByName || event.performedBy || 'System';
    const targetMatch = details?.match(/to (.+)$/);
    const target = targetMatch ? targetMatch[1] : 'Technician';
    switch (action) {
        case 'WORKITEM_ASSIGNED': return `Assigned: ${analysisName || 'Unknown'} → ${target}`;
        case 'WORKITEM_REASSIGNED': return `Reassigned: ${analysisName} → ${target}`;
        case 'WORKITEM_STARTED': return `Started: ${analysisName}`;
        case 'WORKITEM_COMPLETED': return `Completed: ${analysisName}`;
        case 'CREATE_SYNC': return 'Synced field data';
        case 'SAMPLE_RECEIVED': return 'Sample received at lab';
        case 'DRYING_STATUS_CHANGED':
            if (event.after?.dryingStatus === 'DONE' || details?.includes('DONE')) return 'Drying marked DONE';
            if (event.after?.dryingStatus === 'FAILED' || details?.includes('FAILED')) return 'Drying marked FAILED';
            return 'Drying status updated';
        case 'PREP_STATUS_CHANGED':
            if (event.after?.preparationStatus === 'DONE' || details?.includes('DONE')) return 'Preparation marked DONE';
            return 'Preparation status updated';
        case 'WORKITEM_SUBMITTED': return `Submitted: ${analysisName}`;
        case 'SUBMISSION_CREATED': return `Created ${type || ''} submission package`;
        case 'REVIEW_DECISION_MADE':
            if (decision === 'ACCEPT') return `Work Item ACCEPTED by ${actor}`;
            if (decision === 'REJECT_REANALYSIS') return `QA/QC rejected: ${analysisName}`;
            return `QA/QC decision: ${decision} for ${analysisName}`;
        case 'WORKITEM_GENERATED': return `Task generated: ${analysisName}`;
        case 'UPDATE_RESULTS': return `Result saved: ${analysisName}`;
        case 'STATUS_CHANGE': return `Status: ${event.before?.status || '?'} → ${event.after?.status || '?'}`;
        case 'ANALYSES_UPDATE': return details || 'Analyses updated';
        default:
            if (details && details.includes(actor)) return details;
            return action?.replace(/_/g, ' ') || 'System activity';
    }
};

// Audit Log Drawer - matches CollapsibleDrawer style
const AuditDrawer = ({ isOpen, onClose, sampleId, token }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState({});

    React.useEffect(() => {
        if (isOpen && !loaded) {
            setLoading(true);
            axios.get(`/api/samples/${sampleId}/detail`, { headers: { Authorization: `Bearer ${token}` } })
                .then(res => {
                    const auditLog = res.data.auditLog || [];
                    setHistory(auditLog);
                    setLoaded(true);
                })
                .catch(() => { setHistory([]); setLoaded(true); })
                .finally(() => setLoading(false));
        }
    }, [isOpen, sampleId, token, loaded]);

    React.useEffect(() => { setLoaded(false); setHistory([]); }, [sampleId]);

    // Close on Escape key
    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Group same-action events within 2 seconds (matches CollapsibleDrawer logic)
    const processedHistory = React.useMemo(() => {
        if (!history || history.length === 0) return [];
        const sorted = [...history].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const grouped = [];
        let i = 0;
        while (i < sorted.length) {
            const current = sorted[i];
            const groupable = ['WORKITEM_ASSIGNED', 'WORKITEM_GENERATED', 'WORKITEM_SUBMITTED', 'REVIEW_DECISION_MADE'].includes(current.action);
            if (groupable) {
                const members = [];
                const stamp = current.timestamp;
                while (i < sorted.length && sorted[i].action === current.action && sorted[i].performedBy === current.performedBy && Math.abs(new Date(sorted[i].timestamp) - new Date(stamp)) < 2000) {
                    members.push(sorted[i]); i++;
                }
                if (members.length > 1) {
                    let label = `${members.length} items processed`;
                    if (current.action === 'WORKITEM_ASSIGNED') { const t = members[0].details?.match(/to (.+)$/); label = `Assigned ${members.length} analyses → ${t ? t[1] : 'Technician'}`; }
                    else if (current.action === 'WORKITEM_GENERATED') label = `Generated ${members.length} tasks`;
                    else if (current.action === 'WORKITEM_SUBMITTED') label = `Submitted ${members.length} analyses`;
                    else if (current.action === 'REVIEW_DECISION_MADE') label = `QA/QC Reviewed ${members.length} analyses`;
                    grouped.push({ ...members[0], isGroup: true, count: members.length, label, members }); continue;
                } else { grouped.push(members[0]); continue; }
            }
            grouped.push(current); i++;
        }
        return grouped;
    }, [history]);

    const toggleGroup = (idx) => setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));

    const formatTime = (ts) => ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative w-full max-w-md bg-sf-surface shadow-2xl border-l border-sf-divider flex flex-col animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
                {/* Header - matches CollapsibleDrawer */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-sf-divider">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                        <Clock size={18} className="text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <h2 className="font-bold text-sf-text uppercase tracking-widest text-xs">Audit Timeline</h2>
                        <p className="text-[10px] text-sf-muted font-medium">History of all activities</p>
                    </div>
                    <span className="ml-auto bg-sf-canvas text-sf-muted text-[10px] font-bold px-2.5 py-1 rounded-full border border-sf-divider">{processedHistory.length}</span>
                    <button onClick={onClose} className="p-1.5 hover:bg-sf-raised rounded-lg transition-colors"><X size={18} className="text-sf-muted hover:text-sf-text" /></button>
                </div>
                {/* Timeline */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
                    {loading && <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>}
                    {!loading && processedHistory.length === 0 && (
                        <div className="text-center py-12">
                            <Activity size={32} className="mx-auto text-sf-muted mb-2" />
                            <div className="text-sf-muted italic text-sm">No history recorded yet</div>
                        </div>
                    )}
                    {!loading && processedHistory.length > 0 && (
                        <div className="relative border-l-2 border-sf-divider ml-4 space-y-9 pb-10">
                            {processedHistory.map((event, idx) => {
                                if (event.isGroup) {
                                    const exp = expandedGroups[idx];
                                    return (
                                        <div key={idx} className="relative pl-8">
                                            <div className="absolute -left-[7px] top-1.5 w-3.5 h-3.5 rounded-full bg-sf-surface border-[3px] border-indigo-500 z-10 shadow-sm" />
                                            <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-indigo-50/30 dark:bg-indigo-900/10 border border-sf-divider hover:border-indigo-200 dark:hover:border-indigo-800 transition-all">
                                                <span className="text-[10px] font-mono font-bold text-indigo-400/80">{formatTime(event.timestamp)}</span>
                                                <div className="font-bold text-sf-text text-[13px] cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-between" onClick={() => toggleGroup(idx)}>
                                                    <span>{event.label}</span>
                                                    <div className="p-0.5 rounded bg-sf-surface border border-sf-divider text-sf-text">
                                                        {exp ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                    </div>
                                                </div>
                                                <div className="text-[11px] text-sf-muted font-semibold flex items-center gap-1.5">
                                                    <div className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-[8px] text-indigo-700 dark:text-indigo-300">{(event.performedByName || event.performedBy || 'S').charAt(0).toUpperCase()}</div>
                                                    {event.performedByName || event.performedBy || 'System'}
                                                </div>
                                                {exp && (
                                                    <div className="mt-3 pl-3 border-l-2 border-indigo-100 dark:border-indigo-900/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        {event.members.map((m, mi) => (
                                                            <div key={mi} className="flex flex-col gap-1">
                                                                <div className="text-[11px] text-sf-text font-bold flex items-center gap-2">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                                    {m.analysisName || m.analysisCode || humanizeAudit(m)}
                                                                </div>
                                                                {m.decision && <div className={`ml-3.5 px-2 py-0.5 rounded text-[9px] font-black inline-block w-fit ${m.decision === 'ACCEPT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.decision}</div>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={event.id || idx} className="relative pl-8 group">
                                        <div className="absolute -left-3 top-0 p-1.5 bg-sf-surface border-2 border-sf-divider rounded-xl z-10 shadow-sm transition-all group-hover:border-indigo-400 group-hover:scale-110 group-hover:shadow-md">
                                            {getAuditIcon(event.action)}
                                        </div>
                                        <div className="flex flex-col gap-1.5 p-3 rounded-xl hover:bg-sf-canvas transition-all border border-transparent hover:border-sf-divider">
                                            <span className="text-[10px] font-mono font-bold text-sf-muted group-hover:text-indigo-400 transition-colors">{formatTime(event.timestamp)}</span>
                                            <div className="font-bold text-sf-text text-[13px] leading-snug">{humanizeAudit(event)}</div>
                                            <div className="flex items-center gap-2 text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                                                <div className="w-4 h-4 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-[8px] border border-indigo-100 dark:border-indigo-800">
                                                    {(event.performedByName || event.performedBy || 'S').charAt(0).toUpperCase()}
                                                </div>
                                                {event.performedByName || event.performedBy || 'System'}
                                            </div>
                                            {(event.reason || (event.details && !humanizeAudit(event).includes(event.details))) && (
                                                <div className="mt-2 text-[11px] text-sf-muted bg-sf-canvas p-2.5 rounded-lg border border-sf-divider shadow-sm">
                                                    {event.reason && <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-black mb-1 text-[10px] uppercase tracking-wider"><span className="w-1 h-1 rounded-full bg-orange-600 animate-pulse" />Reason: {event.reason}</div>}
                                                    {event.details && event.details !== humanizeAudit(event) && <div className="font-medium whitespace-pre-wrap leading-relaxed text-sf-text">{event.details}</div>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const SamplesTable = ({ data, sort, order, onSort, selected = [], onSelect, onSelectAll, canDelete, onDelete, deletingIds = [], onPrintLabel, loading = false }) => {
    const getAnalysisDisplayName = useAnalysisNames();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [auditSampleId, setAuditSampleId] = useState(null);

    const handleSort = (field) => { const newOrder = sort === field && order === 'asc' ? 'desc' : 'asc'; onSort(field, newOrder); };
    const SortIcon = ({ field }) => { if (sort !== field) return null; return order === 'asc' ? <ArrowUp size={12} className="inline ml-1" /> : <ArrowDown size={12} className="inline ml-1" />; };
    const handleRowClick = (e, id) => { if (e.target.closest('button') || e.target.closest('input[type="checkbox"]')) return; navigate(`/samples/${id}`); };
    const handleRowKeyDown = (e, id) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/samples/${id}`); } };

    return (
        <>
            <div className="bg-sf-surface rounded-lg shadow border border-sf-divider overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[700px]">
                    <thead className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 border-b border-sf-divider">
                        <tr>
                            <th className="p-4 w-4"><input type="checkbox" className="rounded border-sf-divider text-emerald-600 focus:ring-emerald-500" onChange={(e) => onSelectAll(e.target.checked)} checked={data.length > 0 && selected.length === data.length} /></th>
                            <th className="px-4 py-4 cursor-pointer hover:bg-emerald-100/50 transition-colors" onClick={() => handleSort('labId')}>ID <SortIcon field="labId" /></th>
                            <th className="px-4 py-4 cursor-pointer hover:bg-emerald-100/50 transition-colors" onClick={() => handleSort('projectCode')}>Project <SortIcon field="projectCode" /></th>
                            <th className="px-4 py-4 cursor-pointer hover:bg-emerald-100/50 transition-colors" onClick={() => handleSort('status')}>State <SortIcon field="status" /></th>
                            <th className="px-4 py-4">Attention</th>
                            <th className="px-4 py-4">Progress</th>
                            <th className="px-4 py-4 cursor-pointer hover:bg-emerald-100/50 transition-colors" onClick={() => handleSort('updatedAt')}>Updated <SortIcon field="updatedAt" /></th>
                            <th className="px-4 py-4 text-right w-20"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && data.length === 0 && (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={`skel-${i}`} className="border-b border-sf-divider animate-pulse">
                                    <td className="p-4 w-4"><div className="w-4 h-4 bg-sf-canvas rounded" /></td>
                                    <td className="px-4 py-4"><div className="flex items-center gap-2.5"><div className="w-8 h-8 bg-sf-canvas rounded-lg" /><div className="flex flex-col gap-1.5"><div className={`h-3.5 bg-sf-canvas rounded`} style={{ width: `${80 + i * 15}px` }} /><div className="h-2.5 bg-sf-canvas rounded w-16" /></div></div></td>
                                    <td className="px-4 py-4"><div className="flex flex-col gap-1.5"><div className={`h-3 bg-sf-canvas rounded`} style={{ width: `${70 + i * 10}px` }} /><div className="h-2.5 bg-sf-canvas rounded w-12" /></div></td>
                                    <td className="px-4 py-4"><div className="w-9 h-9 bg-sf-canvas rounded-xl mx-auto" /></td>
                                    <td className="px-4 py-4"><div className="w-6 h-6 bg-sf-canvas rounded-lg" /></td>
                                    <td className="px-4 py-4"><div className="flex items-center gap-2"><div className="flex-1 h-2 bg-sf-canvas rounded-full" /><div className="w-8 h-3 bg-sf-canvas rounded" /></div></td>
                                    <td className="px-4 py-4"><div className="h-3 bg-sf-canvas rounded w-14" /></td>
                                    <td className="px-4 py-4"><div className="flex justify-end gap-1"><div className="w-6 h-6 bg-sf-canvas rounded" /><div className="w-6 h-6 bg-sf-canvas rounded" /></div></td>
                                </tr>
                            ))
                        )}
                        {data.map((sample, rowIdx) => {
                            const isWalkIn = !sample.projectCode || String(sample.originalId).startsWith('EXT-') || String(sample.originalId).startsWith('W');
                            const isProtected = sample.metadata && (sample.metadata._uuid || sample.metadata['Country']);
                            const isDeleting = deletingIds.includes(sample.id);
                            const attention = computeAttention(sample);
                            const progress = computeProgress(sample);

                            return (
                                <tr key={sample.id} onClick={(e) => handleRowClick(e, sample.id)} onKeyDown={(e) => handleRowKeyDown(e, sample.id)} tabIndex={0} role="link" aria-label={`Sample ${sample.labId || sample.originalId || sample.id}`}
                                    className={`border-b border-sf-divider hover:bg-sf-canvas cursor-pointer transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset ${selected.includes(sample.id) ? 'bg-emerald-50/30 dark:bg-emerald-950/20' : ''} ${isDeleting ? 'line-through opacity-40 bg-red-50 dark:bg-red-900/10 scale-95' : ''}`}>

                                    {/* Checkbox */}
                                    <td className="p-4 w-4"><input type="checkbox" className="rounded border-sf-divider text-emerald-600 focus:ring-emerald-500" checked={selected.includes(sample.id)} onChange={(e) => onSelect(sample.id, e.target.checked)} disabled={isDeleting} /></td>

                                    {/* ID */}
                                    <td className="px-4 py-4 font-medium text-sf-text whitespace-nowrap">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-1.5 rounded-lg shrink-0 ${isWalkIn ? 'bg-orange-50 text-orange-500 dark:bg-orange-900/20' : 'bg-blue-50 text-blue-500 dark:bg-blue-900/20'}`}>
                                                {isWalkIn ? <User size={14} /> : <FileText size={14} />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                                    {sample.status === 'EXPECTED'
                                                        ? (sample.originalId || 'PENDING')
                                                        : (sample.labId || sample.siteId || sample.originalId || 'PENDING')}
                                                </span>
                                                <span className="text-xs text-sf-muted flex items-center gap-1">
                                                    {sample.status === 'EXPECTED'
                                                        ? <span className="text-amber-500 font-medium">Lab ID: Pending</span>
                                                        : sample.labId
                                                            ? sample.originalId
                                                            : sample.siteId ? <><MapPin size={10} className="text-sf-muted" />{sample.originalId}</> : ''}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Project */}
                                    <td className="px-4 py-4">
                                        {isWalkIn ? (
                                            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Walk-in</span>
                                        ) : (
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-1.5 font-bold text-sf-text text-sm">
                                                    <Folder size={13} className="text-sf-muted shrink-0" />
                                                    <span className="truncate max-w-[120px]">{sample.projectCode}</span>
                                                </div>
                                                {(sample.countryName || sample.country) && (
                                                    <div className="flex items-center gap-1 text-xs text-sf-muted pl-5"><MapPin size={9} />{sample.countryName || sample.country}</div>
                                                )}
                                            </div>
                                        )}
                                    </td>

                                    {/* State */}
                                    <td className="px-4 py-4">
                                        <StatusIcon
                                            status={(sample.computed?.isArchiving && sample.status !== 'ARCHIVED') ? 'ARCHIVING_PENDING' : (sample.computed?.isDisposing && sample.status !== 'DISPOSED') ? 'DISPOSAL_PENDING' : sample.status}
                                            overrideText={(sample.computed?.isArchiving && sample.status !== 'ARCHIVED') ? 'ARCHIVING' : (sample.computed?.isDisposing && sample.status !== 'DISPOSED') ? 'DISPOSAL' : null}
                                        />
                                    </td>

                                    {/* Attention */}
                                    <td className="px-4 py-4">
                                        <div className="flex gap-1.5">
                                            {attention === null ? (
                                                <span className="text-xs text-sf-muted">—</span>
                                            ) : attention.length === 0 ? (
                                                <span className="text-xs text-emerald-500 flex items-center gap-1"><CheckCircle2 size={13} /><span className="font-medium">OK</span></span>
                                            ) : (
                                                attention.map(flag => {
                                                    const FlagIcon = flag.icon;
                                                    return (
                                                        <div key={flag.key} className="group/flag relative flex items-center">
                                                            <div className={`p-1.5 rounded-lg border-2 border-transparent transition-all duration-300 group-hover/flag:border-current group-hover/flag:bg-current/10 ${flag.color}`}>
                                                                <FlagIcon size={16} className="transition-transform duration-300 group-hover/flag:scale-110" />
                                                            </div>
                                                            <div className={`absolute left-1/2 -translate-x-1/2 px-3 py-1.5 bg-sf-raised text-sf-text text-[10px] font-black uppercase tracking-widest rounded-lg opacity-0 group-hover/flag:opacity-100 whitespace-nowrap pointer-events-none z-50 transition-all duration-300 shadow-xl border border-sf-divider ${rowIdx < 2 && data.length > 3 ? 'top-full mt-2' : 'bottom-full mb-2'}`}>
                                                                {flag.label}
                                                                <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${rowIdx < 2 && data.length > 3 ? 'bottom-full -mb-1 border-b-sf-raised' : 'top-full -mt-1 border-t-sf-raised'}`}></div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </td>

                                    {/* Progress - Segmented by category */}
                                    <td className="px-4 py-4">
                                        {progress ? (() => {
                                            const pct = Math.round((progress.completed / progress.total) * 100);
                                            const done = progress.completed >= progress.total;
                                            const segments = Object.entries(progress.categories).map(([cat, items]) => {
                                                const cc = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Other'];
                                                const comp = items.filter(i => ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(i.status)).length;
                                                return { cat, items, cc, w: (items.length / progress.total) * 100, fill: items.length > 0 ? (comp / items.length) * 100 : 0, comp };
                                            });
                                            return (
                                                <div className="group/prog relative flex items-center gap-2.5 min-w-[110px]">
                                                    <div className="flex-1 flex rounded-full h-2 overflow-hidden shadow-inner bg-sf-canvas gap-px">
                                                        {segments.map(s => (
                                                            <div key={s.cat} className="relative h-full overflow-hidden" style={{ width: `${s.w}%` }}>
                                                                <div className={`h-full ${s.cc.bar} transition-all duration-1000 ease-out`} style={{ width: `${s.fill}%` }} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="shrink-0">
                                                        {done
                                                            ? <div className="flex items-center gap-1 text-emerald-500"><CheckCircle2 size={14} /><span className="text-[10px] font-black">DONE</span></div>
                                                            : <span className="text-[10px] text-sf-muted font-bold tabular-nums">{progress.completed}/{progress.total}</span>
                                                        }
                                                    </div>
                                                    {/* Tooltip: grouped by category */}
                                                    <div className={`absolute left-1/2 -translate-x-1/2 px-3 py-2.5 bg-sf-raised text-sf-text text-[10px] rounded-lg opacity-0 group-hover/prog:opacity-100 pointer-events-none z-50 transition-all duration-300 shadow-xl whitespace-nowrap border border-sf-divider min-w-[180px] ${rowIdx < 2 && data.length > 3 ? 'top-full mt-2 translate-y-2 group-hover/prog:translate-y-0' : 'bottom-full mb-2 translate-y-2 group-hover/prog:translate-y-0'}`}>
                                                        <div className="flex flex-col gap-2">
                                                            {segments.map(s => (
                                                                <div key={s.cat}>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        <div className={`w-2 h-2 rounded-full ${s.cc.bar}`} />
                                                                        <span className="text-[9px] font-black uppercase tracking-widest text-sf-muted">{s.cc.label}</span>
                                                                        <span className={`ml-auto text-[9px] font-bold ${s.comp === s.items.length ? 'text-emerald-400' : 'text-sf-muted'}`}>{s.comp}/{s.items.length}</span>
                                                                    </div>
                                                                    {s.items.map((item, idx) => (
                                                                        <div key={idx} className="flex items-center gap-2 py-0.5 pl-4">
                                                                            <span className={WI_STATUS_COLOR[item.status] || 'text-sf-muted'}>{WI_STATUS_ICON[item.status] || '○'}</span>
                                                                            <span className="font-bold">{getAnalysisDisplayName(item.analysis, item.analysisName)}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="mt-1.5 pt-1.5 border-t border-sf-divider text-sf-muted font-black">{pct}% — {progress.completed} of {progress.total} steps</div>
                                                        <div className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${rowIdx < 2 && data.length > 3 ? 'bottom-full -mb-1 border-b-sf-raised' : 'top-full -mt-1 border-t-sf-raised'}`}></div>
                                                    </div>
                                                </div>
                                            );
                                        })() : <span className="text-xs text-sf-muted italic">—</span>}
                                    </td>

                                    {/* Updated */}
                                    <td className="px-4 py-4 text-xs text-sf-muted whitespace-nowrap">
                                        {sample.updatedAt ? new Date(sample.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {user.role === 'SUPER_ADMIN' && !isProtected && !isDeleting && (
                                                <button onClick={(e) => { e.stopPropagation(); onDelete(sample.id); }} className="text-sf-muted hover:text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded" title="Hard Delete" aria-label="Delete sample"><Trash2 size={15} /></button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); onPrintLabel(sample); }} className="text-sf-muted hover:text-indigo-600 p-1.5 hover:bg-sf-canvas rounded transition-colors" title="Print Label" aria-label="Print label"><Printer size={15} /></button>
                                            {!['EXPECTED', 'RECEIVED', 'COLLECTED', 'DRAFT'].includes(sample.status) && (
                                                <button onClick={(e) => { e.stopPropagation(); navigate(`/samples/${sample.id}/map`); }} className="text-sf-muted hover:text-purple-600 p-1.5 hover:bg-sf-canvas rounded transition-colors" title="Workflow Map" aria-label="Workflow map"><GitBranch size={15} /></button>
                                            )}
                                            <button onClick={(e) => { e.stopPropagation(); setAuditSampleId(sample.id); }} className="text-sf-muted hover:text-emerald-600 p-1.5 hover:bg-sf-canvas rounded transition-colors" title="Audit Log" aria-label="Audit log"><ExternalLink size={15} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {!loading && data.length === 0 && (
                            <tr><td colSpan="8" className="p-8 text-center text-sf-muted italic">No samples found matching your filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            <AuditDrawer isOpen={!!auditSampleId} onClose={() => setAuditSampleId(null)} sampleId={auditSampleId} token={token} />
        </>
    );
};

export default SamplesTable;
