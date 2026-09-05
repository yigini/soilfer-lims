import React from 'react';
import { FileText, AlertTriangle, ShieldCheck, CheckCircle, X, ExternalLink, Activity } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const EvidenceInspectionModal = ({ item, sample, isOpen, onClose, onViewSpectra }) => {
    const { t } = useLanguage();

    if (!isOpen || !item) return null;

    const isSpectral = ['SPEC_MIR', 'SPEC_VIS_NIR', 'MIR Soil Spectra', 'Vis-NIR Soil Spectra'].includes(item.analysis);
    const hasResults = item.results && item.results.length > 0;
    const hasScans = item.spectralScans && item.spectralScans.length > 0;
    const isHistoricalGap = item.isHistoricalGap;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-800">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                            {item.analysisName || item.analysis} — Evidence Inspection
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Sample: <strong className="text-gray-700 dark:text-gray-300">{sample?.labId || sample?.originalId}</strong> • Category: {item.category || 'Analytical'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 text-left text-sm">
                    {/* S003 Alert if historical evidence gap */}
                    {isHistoricalGap && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl text-amber-900 dark:text-amber-200">
                            <div className="flex items-center gap-2 font-bold mb-1">
                                <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />
                                Historical approval — evidence needs verification
                            </div>
                            <p className="text-xs leading-relaxed">
                                This analysis was recorded as ACCEPTED historically, but lacks recorded raw result data, valid spectral scans, or an authorized waiver note. Release of new analytical reports is blocked until this historical record is investigated.
                            </p>
                        </div>
                    )}

                    {/* Execution & Method Metadata */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700/60">
                        <div>
                            <span className="block text-[11px] uppercase font-bold text-gray-400">Current Status</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{item.status}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] uppercase font-bold text-gray-400">Assigned To</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{item.assigneeName || item.assignedTo || 'Unassigned'}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] uppercase font-bold text-gray-400">Method Revision</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{item.methodology?.name || item.methodology?.code || 'Standard Method'}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] uppercase font-bold text-gray-400">Execution Date</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{item.completedAt ? new Date(item.completedAt).toLocaleString() : 'Not recorded'}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] uppercase font-bold text-gray-400">Review Decision</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{item.reviewedBy ? `${item.reviewDecision || 'ACCEPTED'} by ${item.reviewedBy}` : 'Unreviewed'}</span>
                        </div>
                        <div>
                            <span className="block text-[11px] uppercase font-bold text-gray-400">Batch QC Status</span>
                            <span className={`font-semibold flex items-center gap-1 ${item.qcStatus === 'QC_FAIL' ? 'text-red-600' : 'text-emerald-600'}`}>
                                {item.qcStatus === 'QC_FAIL' ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                                {item.qcStatus || 'QC_PASS'}
                            </span>
                        </div>
                    </div>

                    {/* Scientific Evidence (Scalar / Array / Spectrum) */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Recorded Scientific Evidence</h4>
                        
                        {isSpectral ? (
                            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Activity size={18} className="text-indigo-600" />
                                        <span className="font-bold text-gray-800 dark:text-gray-200">
                                            {hasScans ? `${item.spectralScans.length} Linked Spectral Scan(s)` : 'No spectral scans linked'}
                                        </span>
                                    </div>
                                    {hasScans && onViewSpectra && (
                                        <button
                                            onClick={() => {
                                                onClose();
                                                onViewSpectra(item);
                                            }}
                                            className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold text-xs hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
                                        >
                                            <ExternalLink size={13} /> Open Spectra Viewer
                                        </button>
                                    )}
                                </div>
                                {hasScans && (
                                    <div className="text-xs text-gray-500 space-y-1 font-mono">
                                        {item.spectralScans.map((s, idx) => (
                                            <div key={s.id || idx} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded flex justify-between">
                                                <span>Scan ID: {s.id?.slice(0, 8)}... ({s.scanType || 'MIR/NIR'})</span>
                                                <span>Range: {s.wavenumberStart || 4000} - {s.wavenumberEnd || 400} cm⁻¹</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl">
                                <div className="text-2xl font-black text-gray-900 dark:text-white font-mono">
                                    {item.result !== null && item.result !== undefined && item.result !== '' ? String(item.result) : (
                                        <span className="text-gray-400 italic text-base font-normal">No measurement recorded</span>
                                    )}
                                </div>
                                {hasResults && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs space-y-1">
                                        {item.results.map((r, i) => (
                                            <div key={r.id || i} className="flex justify-between text-gray-600 dark:text-gray-400 font-mono">
                                                <span>{r.param}: {r.value} {r.unit || ''}</span>
                                                <span>Attempt #{r.attemptNo || 1} • {new Date(r.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Blockers list if any */}
                    {item.blockers && item.blockers.length > 0 && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                            <span className="block text-xs font-bold uppercase text-red-600 dark:text-red-400 mb-1">Active Blockers</span>
                            <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300 space-y-0.5">
                                {item.blockers.map((b, i) => (
                                    <li key={i}>{b}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-bold transition-colors"
                    >
                        {t('common.close', 'Close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EvidenceInspectionModal;
