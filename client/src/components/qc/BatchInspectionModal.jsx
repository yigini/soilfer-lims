import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    X, AlertTriangle, ShieldCheck, CheckCircle2,
    Clock, RefreshCw, AlertCircle, CheckCircle, FileText,
    Layers, Cpu, User, Calendar, ShieldAlert,
    ChevronDown, ChevronUp, Check, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import ReviewedQcCorrection from './ReviewedQcCorrection';

export function getDispositionInfo(disposition, t = key => key) {
    if (!disposition || !disposition.decision) return null;
    const dec = disposition.canonicalDecision === 'REPEAT_BRACKET' ? 'REPEAT_BRACKET' : String(disposition.decision).trim();

    switch (dec) {
        case 'PROCEED_WITH_WARNING':
            return {
                type: 'WARNING_OVERRIDE',
                title: 'PROCEED WITH WARNING',
                badgeText: 'Override Logged',
                badgeStyle: 'bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700',
                bannerStyle: 'bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200',
                titleColor: 'text-amber-700 dark:text-amber-400',
                boxStyle: 'bg-amber-100/60 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800',
                noteColor: 'text-amber-700 dark:text-amber-400',
                note: 'Analytical release is authorized under recorded manager justification. Control measurement failure remains permanently recorded in audit history.'
            };
        case 'REPEAT_BRACKET':
        case 'REANALYZE_BATCH':
            return {
                type: 'REANALYSIS_REQUIRED',
                title: dec === 'REPEAT_BRACKET' ? t('qcGate.repeatBracket') : 'RE-ANALYZE BATCH',
                badgeText: 'Re-analysis Required',
                badgeStyle: 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700',
                bannerStyle: 'bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200',
                titleColor: 'text-rose-700 dark:text-rose-400',
                boxStyle: 'bg-rose-100/60 dark:bg-rose-900/40 border-rose-200 dark:border-rose-800',
                noteColor: 'text-rose-700 dark:text-rose-400',
                note: dec === 'REPEAT_BRACKET' ? t('qcGate.repeatBracketHelp') : 'Batch results rejected by laboratory management. Associated sample work items are flagged for repeat preparation and re-analysis. Sample approval and report release remain blocked.'
            };
        case 'REJECT_REANALYSIS':
            return {
                type: 'LEGACY_REJECT_REANALYSIS',
                title: 'REJECTED FOR RE-ANALYSIS (Legacy)',
                badgeText: 'Legacy Rejection: REJECT_REANALYSIS',
                badgeStyle: 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700',
                bannerStyle: 'bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200',
                titleColor: 'text-rose-700 dark:text-rose-400',
                boxStyle: 'bg-rose-100/60 dark:bg-rose-900/40 border-rose-200 dark:border-rose-800',
                noteColor: 'text-rose-700 dark:text-rose-400',
                note: 'Persisted legacy manager disposition recorded as rejected for re-analysis by laboratory management. Rendered read-only for historical audit and supervisory review.'
            };
        case 'REJECT_BATCH':
            return {
                type: 'REJECTED',
                title: 'BATCH REJECTED',
                badgeText: 'Batch Rejected',
                badgeStyle: 'bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700',
                bannerStyle: 'bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200',
                titleColor: 'text-rose-700 dark:text-rose-400',
                boxStyle: 'bg-rose-100/60 dark:bg-rose-900/40 border-rose-200 dark:border-rose-800',
                noteColor: 'text-rose-700 dark:text-rose-400',
                note: 'Batch results rejected by laboratory management. Action recorded in audit history for supervisory review.'
            };
        case 'ACCEPT':
            return {
                type: 'CUSTOM_OR_UNSUPPORTED',
                title: 'RECORDED LEGACY ACCEPT (Under Review)',
                badgeText: 'Legacy Decision: ACCEPT',
                badgeStyle: 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700',
                bannerStyle: 'bg-slate-50 dark:bg-slate-950/50 border-2 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200',
                titleColor: 'text-slate-700 dark:text-slate-400',
                boxStyle: 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800',
                noteColor: 'text-slate-700 dark:text-slate-400',
                note: 'Recorded legacy ACCEPT decision in database history. Not a recognized automated override; preserved read-only for technical and supervisory review.'
            };
        default:
            return {
                type: 'CUSTOM_OR_UNSUPPORTED',
                title: dec,
                badgeText: `Recorded: ${dec}`,
                badgeStyle: 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700',
                bannerStyle: 'bg-slate-50 dark:bg-slate-950/50 border-2 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200',
                titleColor: 'text-slate-700 dark:text-slate-400',
                boxStyle: 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800',
                noteColor: 'text-slate-700 dark:text-slate-400',
                note: 'Persisted disposition decision recorded in database. Rendered read-only for technical review.'
            };
    }
}

export function formatBlankLimit(b, t = (k, def) => def) {
    if (!b) return t('qcWorksheet.notStored', 'not stored in this evaluation');
    const recordedLimit = (b.limit !== undefined && b.limit !== null)
        ? b.limit
        : (b.upperLimit !== undefined && b.upperLimit !== null)
            ? b.upperLimit
            : b.maxAllowed ?? null;
    if (recordedLimit !== null) {
        if (typeof recordedLimit === 'number' && Number.isFinite(recordedLimit)) {
            return String(recordedLimit);
        }
        if (typeof recordedLimit === 'string' && recordedLimit.trim() !== '') {
            return recordedLimit;
        }
    }
    return t('qcWorksheet.notStored', 'not stored in this evaluation');
}

export function evaluateBlankStatus(b) {
    return b?.status || null;
}

const storedJson = value => {
    if (typeof value !== 'string') return value;
    try { return JSON.parse(value); } catch { return null; }
};
const storedText = (value, t) => value === undefined || value === null || value === ''
    ? t('qcWorksheet.notStored', 'not stored in this evaluation')
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
const storedLimits = row => Object.fromEntries(['limit', 'upperLimit', 'maxAllowed', 'maxRpd', 'absMax', 'absMaxBelow5LOQ', 'loq',
    'minRecovery', 'maxRecovery', 'crmAbsWindow', 'lrmWindowPct'].filter(key => row[key] !== undefined && row[key] !== null).map(key => [key, row[key]]));

// Render retained evidence, including historical compatibility records. No
// live policy, catalogue fallback, recomputation or numeric rounding is used.
export function StoredQcEvidence({ batch, t = (key, fallback) => fallback || key }) {
    const recorded = (batch?.analytes || []).filter(row => row.evaluation?.details).map(row => ({
        analysisCode: row.analysisCode, record: row.evaluation, details: storedJson(row.evaluation.details)
    }));
    const records = recorded.length ? recorded : [{ analysisCode: batch?.analysis, record: null, details: storedJson(batch?.qcResults) }];
    return <section className="space-y-3" data-testid="stored-qc-evidence">
        <h3 className="font-bold text-sm">{t('qcWorksheet.storedEvidence', 'Stored QC evaluation — read only')}</h3>
        {(batch?.reviewedCorrections || []).map(row => <div key={row.id} className="border border-sf-divider rounded-lg p-3 text-sm space-y-1" data-testid={`reviewed-qc-disclosure-${row.id}`}>
            <h4 className="font-bold">{t('qcReviewedCorrection.disclosure')}</h4>
            <p>{row.analysisCode} · {t('qcReviewedCorrection.originalFailure')}: {row.previousVerdict} ({row.previousEvaluationId})
                {' · '}{t('qcReviewedCorrection.replacement')}: {row.replacementEvaluation?.verdict} ({row.evaluationId})</p>
            <p>{t('qcReviewedCorrection.reviewer')}: {row.reviewer?.username || row.by} · {row.at}</p>
            <p>{t('qcReviewedCorrection.reason')}: {row.reason}</p>
            <p>{t('qcReviewedCorrection.sourceReference')}: {row.sourceReference}</p>
            <p>{t('qcReviewedCorrection.authors')}: {(row.observationAuthors || []).map(author => author.username).join(', ')}</p>
            {(row.replacements || []).map(change => <p className="font-mono" key={change.original.id}>
                {change.original.positionId}/{change.original.replicateNo}: {change.original.rawInput ?? change.original.value} ({change.original.id})
                {' → '}{change.replacement.rawInput ?? change.replacement.value} ({change.replacement.id})
            </p>)}
            <details><summary>{t('qcReviewedCorrection.originalFailure')}</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(row.originalEvaluation, null, 2)}</pre></details>
        </div>)}
        {records.map(({ analysisCode, record, details }, index) => {
            const evaluation = details?.evaluation || details?.qcResults || details || {};
            const rows = ['blanks', 'controls', 'duplicates'].flatMap(collection => evaluation[collection] || []);
            return <div key={`${analysisCode}-${index}`} className="space-y-2">
                <p>{analysisCode} · {t('qcWorksheet.verdict', 'Verdict')}: {storedText(record?.verdict ?? details?.verdict ?? evaluation.result, t)}
                    {' · '}{t('qcWorksheet.ruleVersion', 'Rule version')}: {storedText(record?.ruleVersion ?? evaluation.qcRule?.version, t)}
                    {' · '}{t('qcWorksheet.policyVersion', 'Policy version')}: {storedText(record?.policyVersion ?? evaluation.policyVersion, t)}</p>
                <div className="overflow-x-auto"><table className="w-full text-left text-xs" data-testid="stored-qc-table">
                    <thead><tr>{['position', 'type', 'expected', 'measured', 'limits', 'criterion', 'failAction', 'verdict'].map(field =>
                        <th key={field} className="p-2">{t(`qcWorksheet.${field}`, field)}</th>)}</tr></thead>
                    <tbody>{rows.map((row, rowIndex) => <tr key={row.id || rowIndex} className="border-t border-sf-divider">
                        <td className="p-2">{storedText(row.position ?? row.slot, t)}</td>
                        <td className="p-2">{storedText(row.kind ?? row.type ?? row.label, t)}</td>
                        <td className="p-2">{storedText(row.expected, t)}</td>
                        <td className="p-2 font-mono">{storedText(row.rawInput ?? row.measured ?? row.value ??
                            (row.value1 !== undefined || row.value2 !== undefined ? { value1: row.value1, value2: row.value2 } : undefined), t)}</td>
                        <td className="p-2 font-mono" data-testid={`stored-limits-${row.id || rowIndex}`}>{Object.keys(storedLimits(row)).length
                            ? JSON.stringify(storedLimits(row)) : storedText(undefined, t)}</td>
                        <td className="p-2">{storedText(row.criterion, t)}</td>
                        <td className="p-2">{storedText(row.failAction, t)}</td>
                        <td className="p-2">{storedText(row.status, t)}</td>
                    </tr>)}</tbody>
                </table></div>
                {!rows.length && <p>{t('qcWorksheet.notStored', 'not stored in this evaluation')}</p>}
                {details && <details><summary>{t('qcWorksheet.fullRecord', 'Full stored evaluation')}</summary>
                    <pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(details, null, 2)}</pre></details>}
            </div>;
        })}
    </section>;
}

export default function BatchInspectionModal({ batchId, isOpen, onClose, onDispositionSuccess, initialBatch = null }) {
    const { token, user, hasPermission } = useAuth();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [batch, setBatch] = useState(initialBatch);

    // Disposition form state
    const [decision, setDecision] = useState('PROCEED_WITH_WARNING');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [dispositionError, setDispositionError] = useState(null);
    const [bracketAnalysisCode, setBracketAnalysisCode] = useState('');
    const [amendmentRequired, setAmendmentRequired] = useState([]);
    const [showHistory, setShowHistory] = useState(false);

    const isManager = user && ['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role);

    const fetchBatch = useCallback(async () => {
        if (!batchId || !token) return;
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`/api/qc/batches/${encodeURIComponent(batchId)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBatch(res.data.data);
        } catch (err) {
            console.error('[BatchInspectionModal] Error fetching batch:', err);
            setError(err.response?.data?.error || err.message || 'Failed to load QC batch');
        } finally {
            setLoading(false);
        }
    }, [batchId, token]);

    useEffect(() => {
        if (isOpen && batchId) {
            fetchBatch();
            setDispositionError(null);
        } else {
            setBatch(initialBatch);
            setReason('');
            setDispositionError(null);
        }
    }, [isOpen, batchId, fetchBatch, initialBatch]);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onClose) onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleDispositionSubmit = async (e) => {
        e.preventDefault();
        if (!reason.trim()) {
            setDispositionError('A documented reason is required for QC disposition.');
            return;
        }

        setSubmitting(true);
        setDispositionError(null);

        try {
            const res = await axios.post(
                `/api/qc/batches/${encodeURIComponent(batchId)}/disposition`,
                { decision, reason: reason.trim(), ...(decision === 'REPEAT_BRACKET' && { analysisCode: bracketAnalyte?.analysisCode,
                    scope: { affectedPositionIds: bracketAnalyte?.repeatBracketScope.affectedPositionIds,
                        affectedWorkItemIds: bracketAnalyte?.repeatBracketScope.affectedWorkItemIds } }) },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (res.data.success) {
                setAmendmentRequired(res.data.amendmentRequired || []);
                await fetchBatch();
                if (onDispositionSuccess) {
                    onDispositionSuccess(res.data.disposition);
                }
            }
        } catch (err) {
            console.error('[BatchInspectionModal] Disposition error:', err);
            setDispositionError(err.response?.data?.error || 'Failed to submit disposition');
        } finally {
            setSubmitting(false);
        }
    };

    const isFailed = batch && (batch.status === 'QC_FAIL' || batch.status === 'FAILED');
    const disposition = batch?.disposition;
    const dispInfo = getDispositionInfo(disposition, t);
    const bracketAnalytes = (batch?.analytes || []).filter(row => row.repeatBracketScope);
    const bracketAnalyte = bracketAnalytes.find(row => row.analysisCode === bracketAnalysisCode) || bracketAnalytes[0];

    const workItems = batch?.workItems || [];
    const historyEvents = batch?.history || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-4xl max-h-[92vh] bg-sf-surface border border-sf-divider rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-sf-divider flex items-center justify-between bg-sf-canvas">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${isFailed ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'}`}>
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-[11px] font-bold uppercase tracking-wider text-sf-muted">
                                {t('qcInspection.title', 'QC Batch Inspection')}
                            </div>
                            <div className="text-lg font-extrabold text-sf-text flex items-center gap-2">
                                <span>{batchId}</span>
                                {batch && (
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                                        isFailed
                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                            : batch.status === 'QC_PASS'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                : 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                                    }`}>
                                        {batch.result === 'NOT_REQUIRED' || batch.qcMode === 'OFF' ? t('qcRuns.notRequired') : batch.status}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-sf-muted hover:text-sf-text rounded-lg hover:bg-sf-raised transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-6 text-xs text-sf-text">
                    {loading ? (
                        <div className="py-16 text-center text-sf-muted flex flex-col items-center justify-center space-y-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                            <p className="text-sm font-medium">Loading batch inspection data…</p>
                        </div>
                    ) : error ? (
                        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                                <div className="font-bold text-sm">Unable to load batch</div>
                                <div className="mt-1 text-xs">{error}</div>
                            </div>
                        </div>
                    ) : batch ? (
                        <>
                            {amendmentRequired.length > 0 && <div className="p-4 rounded-xl bg-amber-50 text-amber-900 text-sm">
                                {t('qcGate.amendmentRequired')} {amendmentRequired.map(row => row.sampleId).join(', ')}
                            </div>}
                            {/* Prominent QC Status / Disposition Banner */}
                            {isFailed && !dispInfo && (
                                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 space-y-1">
                                    <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-400">
                                        <AlertTriangle className="w-5 h-5 shrink-0" />
                                        <span>QC FAILED — Quality Gate Active</span>
                                    </div>
                                    <p className="text-xs text-rose-800 dark:text-rose-300">
                                        This batch failed analytical QC control limits. Downstream sample approvals and official report release are strictly blocked until an authorized Laboratory Manager records a formal disposition.
                                    </p>
                                </div>
                            )}

                            {dispInfo && (
                                <div className={`p-4 rounded-xl ${dispInfo.bannerStyle} space-y-2`}>
                                    <div className="flex items-center justify-between">
                                        <div className={`flex items-center gap-2 font-bold text-sm ${dispInfo.titleColor}`}>
                                            <ShieldAlert className="w-5 h-5 shrink-0" />
                                            <span>
                                                {isFailed ? 'QC FAILED — Manager Disposition Active: ' : 'Manager Disposition Active: '}
                                                {dispInfo.title}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded font-bold ${dispInfo.badgeStyle}`}>
                                            {dispInfo.badgeText}
                                        </span>
                                    </div>
                                    <div className="text-xs">
                                        <strong>{t('qcInspection.recordedBy', 'Recorded by')}:</strong> {disposition.by || 'Unknown'}
                                        {disposition.at && ` on ${new Date(disposition.at).toLocaleString()}`}
                                    </div>
                                    <div className={`p-2.5 rounded-lg text-xs font-mono border ${dispInfo.boxStyle} whitespace-pre-wrap`}>
                                        <strong>{t('qcInspection.justification', 'Justification')}:</strong> {disposition.reason || 'No justification text recorded'}
                                    </div>
                                    <p className={`text-[11px] ${dispInfo.noteColor}`}>
                                        {dispInfo.note}
                                    </p>
                                </div>
                            )}

                            {batch.result === 'NOT_REQUIRED' && <p data-testid="qc-not-required">{t('qcRuns.notRequired')}</p>}
                            {batch.status === 'QC_PASS' && batch.result !== 'NOT_REQUIRED' && batch.qcMode !== 'OFF' && !dispInfo && (
                                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex items-center gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <div>
                                        <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300">QC Passed</span>
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                                            All blanks, duplicate pairs, and CRM control recoveries are within acceptable tolerance limits.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Batch Metadata Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-3 bg-sf-canvas rounded-xl border border-sf-divider">
                                    <div className="text-[10px] font-semibold text-sf-muted uppercase tracking-wider">Analysis</div>
                                    <div className="font-bold text-sf-text mt-0.5">{batch.analysis}</div>
                                </div>
                                <div className="p-3 bg-sf-canvas rounded-xl border border-sf-divider">
                                    <div className="text-[10px] font-semibold text-sf-muted uppercase tracking-wider">Laboratory</div>
                                    <div className="font-bold text-sf-text mt-0.5">{batch.labId || 'Global'}</div>
                                </div>
                                <div className="p-3 bg-sf-canvas rounded-xl border border-sf-divider">
                                    <div className="text-[10px] font-semibold text-sf-muted uppercase tracking-wider">Instrument</div>
                                    <div className="font-bold text-sf-text mt-0.5">{batch.instrument || 'Bench / Manual'}</div>
                                </div>
                                <div className="p-3 bg-sf-canvas rounded-xl border border-sf-divider">
                                    <div className="text-[10px] font-semibold text-sf-muted uppercase tracking-wider">Run Profile</div>
                                    <div className="font-bold text-sf-text mt-0.5">{batch.profile || t('qcWorksheet.nativeRun', 'Native run')} · {Array.isArray(batch.positions) ? batch.positions.length : t('qcWorksheet.notStored', 'not stored in this evaluation')}</div>
                                </div>
                            </div>

                            {batch.notes && (
                                <div className="p-3 bg-sf-canvas rounded-xl border border-sf-divider">
                                    <div className="text-[10px] font-semibold text-sf-muted uppercase tracking-wider mb-1">Batch Notes</div>
                                    <div className="text-xs text-sf-text whitespace-pre-wrap">{batch.notes}</div>
                                </div>
                            )}

                            <StoredQcEvidence batch={batch} t={t} />
                            <ReviewedQcCorrection batch={batch} token={token} t={t}
                                canReview={Boolean(hasPermission?.('APPROVE_RESULTS') && hasPermission?.('CHANGE_STATUS'))}
                                onSubmitted={async () => { await fetchBatch(); onDispositionSuccess?.(); }} />

                            {/* Affected Work Items Table */}
                            <div className="border border-sf-divider rounded-xl overflow-hidden">
                                <div className="bg-sf-canvas px-4 py-2 border-b border-sf-divider font-semibold text-sf-text flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-indigo-600" />
                                        <span>Affected Work Items ({workItems.length})</span>
                                    </div>
                                    <span className="text-[11px] text-sf-muted font-normal">Ordered by rack position</span>
                                </div>
                                {workItems.length > 0 ? (
                                    <table className="w-full text-left">
                                        <thead className="bg-sf-surface border-b border-sf-divider text-gray-500 font-semibold text-[11px]">
                                            <tr>
                                                <th className="py-2 px-4">Pos</th>
                                                <th className="py-2 px-4">Work Item ID</th>
                                                <th className="py-2 px-4">Sample ID (Canonical)</th>
                                                <th className="py-2 px-4">Lab ID / Field ID</th>
                                                <th className="py-2 px-4">Analysis</th>
                                                <th className="py-2 px-4 text-right">Item Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-sf-divider">
                                            {workItems.map((item) => (
                                                <tr key={item.id} className="hover:bg-sf-raised/50">
                                                    <td className="py-2 px-4 font-mono font-bold text-sf-muted">{item.rackPosition ?? '—'}</td>
                                                    <td className="py-2 px-4 font-mono font-semibold">{item.id}</td>
                                                    <td className="py-2 px-4 font-mono text-sf-muted">{item.sampleId}</td>
                                                    <td className="py-2 px-4">
                                                        <div className="font-semibold text-sf-text">{item.sample?.labId || '—'}</div>
                                                        {item.sample?.originalId && (
                                                            <div className="text-[10px] text-sf-muted">Orig: {item.sample.originalId}</div>
                                                        )}
                                                    </td>
                                                    <td className="py-2 px-4">{item.analysis}</td>
                                                    <td className="py-2 px-4 text-right">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sf-canvas border border-sf-divider">
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-4 text-center text-sf-muted text-xs">No sample work items currently assigned to this batch.</div>
                                )}
                            </div>

                            {/* Batch History & Audit Trail */}
                            <div className="border border-sf-divider rounded-xl overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setShowHistory(!showHistory)}
                                    className="w-full bg-sf-canvas px-4 py-2.5 font-semibold text-sf-text flex justify-between items-center hover:bg-sf-raised transition-colors text-left"
                                >
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-sf-muted" />
                                        <span>Batch Lifecycle History ({historyEvents.length} events)</span>
                                    </div>
                                    {showHistory ? <ChevronUp className="w-4 h-4 text-sf-muted" /> : <ChevronDown className="w-4 h-4 text-sf-muted" />}
                                </button>
                                {showHistory && (
                                    <div className="p-4 bg-sf-surface border-t border-sf-divider space-y-2">
                                        {historyEvents.length > 0 ? (
                                            historyEvents.map((ev, i) => (
                                                <div key={i} className="flex items-start justify-between py-1.5 border-b border-sf-divider/50 last:border-0 font-mono text-[11px]">
                                                    <div className="space-y-0.5">
                                                        <span className="font-bold text-sf-text">
                                                            Status: {ev.status}
                                                            {ev.disposition && ` · Disposition: ${ev.disposition}`}
                                                        </span>
                                                        {ev.reason && (
                                                            <div className="text-sf-muted font-sans italic text-[11px]">
                                                                "{ev.reason}"
                                                            </div>
                                                        )}
                                                        <div className="text-sf-muted text-[10px]">By {ev.changedBy || 'system'}</div>
                                                    </div>
                                                    <div className="text-sf-muted text-[10px] shrink-0">
                                                        {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : '—'}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-sf-muted text-xs">No history events logged.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Manager Disposition Action Form (Only when failed and no disposition has been recorded) */}
                            {isManager && isFailed && !dispInfo && (
                                <form onSubmit={handleDispositionSubmit} className="p-4 bg-sf-canvas rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-4">
                                    <div className="flex items-center justify-between border-b border-sf-divider pb-2">
                                        <div className="flex items-center gap-2 font-bold text-sm text-sf-text">
                                            <ShieldAlert className="w-4 h-4 text-indigo-600" />
                                            <span>Record Manager QC Disposition</span>
                                        </div>
                                        <span className="text-[10px] text-sf-muted uppercase font-bold">
                                            Authorized Role: {user.role}
                                        </span>
                                    </div>

                                    {dispositionError && (
                                        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-lg text-xs flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            <span>{dispositionError}</span>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="font-semibold text-sf-text block text-xs">
                                            Manager Decision
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {bracketAnalyte && <label className="flex items-start gap-2.5 p-3 rounded-xl border border-sf-divider cursor-pointer">
                                                <input type="radio" name="decision" value="REPEAT_BRACKET" checked={decision === 'REPEAT_BRACKET'} onChange={event => setDecision(event.target.value)} />
                                                <span className="text-xs"><strong>{t('qcGate.repeatBracket')}</strong><br />{t('qcGate.repeatBracketHelp')}</span>
                                            </label>}
                                            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                                                decision === 'PROCEED_WITH_WARNING'
                                                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                                                    : 'border-sf-divider hover:bg-sf-raised'
                                            }`}>
                                                <input
                                                    type="radio"
                                                    name="decision"
                                                    value="PROCEED_WITH_WARNING"
                                                    checked={decision === 'PROCEED_WITH_WARNING'}
                                                    onChange={(e) => setDecision(e.target.value)}
                                                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <div>
                                                    <div className="font-bold text-xs text-sf-text">Proceed with Warning</div>
                                                    <div className="text-[11px] text-sf-muted mt-0.5">
                                                        Authorize analytical release with documented justification. Retains QC failure in permanent audit trail.
                                                    </div>
                                                </div>
                                            </label>

                                            <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                                                decision === 'REANALYZE_BATCH'
                                                    ? 'border-rose-600 bg-rose-50/50 dark:bg-rose-950/30'
                                                    : 'border-sf-divider hover:bg-sf-raised'
                                            }`}>
                                                <input
                                                    type="radio"
                                                    name="decision"
                                                    value="REANALYZE_BATCH"
                                                    checked={decision === 'REANALYZE_BATCH'}
                                                    onChange={(e) => setDecision(e.target.value)}
                                                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                                                />
                                                <div>
                                                    <div className="font-bold text-xs text-sf-text">Re-analyze Batch</div>
                                                    <div className="text-[11px] text-sf-muted mt-0.5">
                                                        Reject batch results and flag all associated work items for repeat preparation/analysis.
                                                    </div>
                                                </div>
                                            </label>
                                        </div>
                                        {decision === 'REPEAT_BRACKET' && bracketAnalyte && <div className="text-xs space-y-2">
                                            <select value={bracketAnalyte.analysisCode} onChange={event => setBracketAnalysisCode(event.target.value)}
                                                className="p-2 bg-sf-surface border border-sf-divider rounded-lg">
                                                {bracketAnalytes.map(row => <option key={row.analysisCode} value={row.analysisCode}>{row.analysisCode}</option>)}
                                            </select>
                                            <p>{t('qcGate.affectedItems')}: {bracketAnalyte.repeatBracketScope.affectedWorkItemIds.length}</p>
                                        </div>}
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="disposition-reason" className="font-semibold text-sf-text block text-xs">
                                            Documented Technical Justification <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            id="disposition-reason"
                                            rows={3}
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="Provide documented scientific rationale, instrument tolerance context, or investigation details justifying this disposition decision..."
                                            className="w-full p-2.5 text-xs bg-sf-surface border border-sf-divider rounded-xl text-sf-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            required
                                        />
                                    </div>

                                    <div className="flex justify-end gap-2 pt-1">
                                        <button
                                            type="submit"
                                            disabled={submitting || !reason.trim()}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm text-xs flex items-center gap-2 transition-colors"
                                        >
                                            {submitting ? (
                                                <>
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Recording Disposition…</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>Confirm Manager Disposition</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Recorded Manager Disposition (Read-Only) */}
                            {dispInfo && (
                                <div className="p-4 bg-sf-canvas rounded-xl border border-sf-divider space-y-3">
                                    <div className="flex items-center justify-between border-b border-sf-divider pb-2">
                                        <div className="flex items-center gap-2 font-bold text-sm text-sf-text">
                                            <ShieldCheck className="w-4 h-4 text-sf-muted" />
                                            <span>Manager QC Disposition (Recorded — Read Only)</span>
                                        </div>
                                        <span className="text-[10px] text-sf-muted uppercase font-bold tracking-wider">
                                            Recorded Audit Entry
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <span className="text-[10px] font-semibold text-sf-muted uppercase tracking-wider block">Decision</span>
                                            <span className="font-mono font-bold text-sf-text">{disposition.decision}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-semibold text-sf-muted uppercase tracking-wider block">Recorded By</span>
                                            <span className="font-medium text-sf-text">
                                                {disposition.by || 'Unknown'} {disposition.at && `on ${new Date(disposition.at).toLocaleString()}`}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-semibold text-sf-muted uppercase tracking-wider block mb-1">Documented Technical Justification</span>
                                        <div className="p-2.5 bg-sf-surface rounded-lg text-xs font-mono border border-sf-divider whitespace-pre-wrap text-sf-text">
                                            {disposition.reason || 'No justification recorded'}
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-sf-muted">
                                        Recorded manager QC dispositions are preserved in audit history and cannot be overwritten through this interface.
                                    </p>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3 border-t border-sf-divider bg-sf-canvas flex justify-between items-center">
                    <div className="text-[11px] text-sf-muted">
                        Recorded QC batch evaluations and manager dispositions are preserved in audit history.
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-sf-divider bg-sf-surface hover:bg-sf-raised text-sf-text text-xs font-semibold rounded-xl transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
