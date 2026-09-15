import { useAnalysisNames } from '../../context/AnalysisCatalogueContext';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import {
    X, Settings, History, ClipboardCheck, Info, AlertTriangle,
    CheckCircle, XCircle, Wrench, Calendar, MapPin, Tag,
    MessageSquare, User, Clock, ShieldAlert, Monitor, Beaker, RefreshCw, Download
} from 'lucide-react';
import LogEventModal from './LogEventModal';
import RegisterAssetModal from './RegisterAssetModal';

const READINESS_COLORS = {
    READY: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    WARNING: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
    BLOCKED: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    NOT_CONFIGURED: 'text-gray-500 bg-sf-raised'
};

const EquipmentDetailDrawer = ({ assetId, show, onClose, onUpdate, canManage }) => {
    const { t } = useLanguage();
    const [asset, setAsset] = useState(null);
    const [activeTab, setActiveTab] = useState('OVERVIEW');
    const [loading, setLoading] = useState(true);
    const [logModal, setLogModal] = useState(null); // 'CALIBRATION', 'VERIFICATION', 'MAINTENANCE', 'STATUS'
    const [showEdit, setShowEdit] = useState(false);

    useEffect(() => {
        if (show && assetId) {
            fetchDetails();
        }
    }, [show, assetId]);

    const fetchDetails = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/equipment/${assetId}`);
            setAsset(res.data);
        } catch (e) {
            console.error('[EquipmentDetail] Fetch failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportHistory = () => {
        if (!asset || !asset.events) return;
        const headers = ['Date', 'Type', 'Summary', 'User', 'Outcome', 'Details'];
        const rows = asset.events.map(e => [
            `"${new Date(e.ts).toLocaleString()}"`,
            `"${e.eventType}"`,
            `"${(e.summary || '').replace(/"/g, '""')}"`,
            `"${e.userId}"`,
            `"${e.outcome}"`,
            `"${(e.details || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${asset.internalAssetTag || 'asset'}_history_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-2xl bg-sf-surface h-full overflow-y-auto shadow-2xl animate-slide-in-right font-sans" onClick={e => e.stopPropagation()}>
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-400"><RefreshCw className="animate-spin mr-2" /> Loading...</div>
                ) : !asset ? (
                    <div className="p-10 text-center text-gray-400">Asset not found</div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-xl ${READINESS_COLORS[asset.readiness]}`}>
                                    <Monitor size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-sf-text">{asset.name}</h3>
                                    <p className="text-xs text-gray-400 font-mono tracking-wider">{asset.internalAssetTag} • {asset.assetType}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {canManage && (
                                    <button
                                        onClick={() => setShowEdit(true)}
                                        title="Edit Item Details"
                                        className="p-2 rounded-lg hover:bg-sf-raised transition-colors text-blue-600"
                                    >
                                        <Settings size={20} />
                                    </button>
                                )}
                                <button
                                    onClick={handleExportHistory}
                                    title="Export History"
                                    className="p-2 rounded-lg hover:bg-sf-raised transition-colors text-gray-500"
                                >
                                    <Download size={20} />
                                </button>
                                <button onClick={onClose} className="p-2 rounded-lg hover:bg-sf-raised transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="px-6 border-b dark:border-gray-700 flex gap-6 overflow-x-auto no-scrollbar">
                            {['OVERVIEW', 'MAINTENANCE', 'HISTORY', 'ELIGIBILITY'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="p-6">
                            {activeTab === 'OVERVIEW' && <OverviewTab asset={asset} />}
                            {activeTab === 'MAINTENANCE' && <MaintenanceTab asset={asset} canManage={canManage} onAction={setLogModal} />}
                            {activeTab === 'HISTORY' && <HistoryTab events={asset.events} />}
                            {activeTab === 'ELIGIBILITY' && <EligibilityTab asset={asset} />}
                        </div>

                        {/* Quick Actions (Sticky Bottom) */}
                        <div className="sticky bottom-0 border-t dark:border-gray-700 bg-sf-canvas p-4 grid grid-cols-2 gap-3">
                            <button onClick={() => setLogModal('MAINTENANCE')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 font-bold text-sm bg-sf-surface hover:bg-gray-50 transition-colors">
                                <Wrench size={16} /> Log Maintenance
                            </button>
                            <button onClick={() => setLogModal('CALIBRATION')} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm">
                                <ClipboardCheck size={16} /> Calibration Task
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Event Logging Modal */}
            <LogEventModal
                show={!!logModal}
                onClose={() => setLogModal(null)}
                asset={asset}
                eventType={logModal}
                onSuccess={() => {
                    fetchDetails();
                    if (onUpdate) onUpdate();
                }}
            />

            {/* Edit Asset Modal */}
            <RegisterAssetModal
                show={showEdit}
                onClose={() => setShowEdit(false)}
                asset={asset}
                onSuccess={() => {
                    fetchDetails();
                    if (onUpdate) onUpdate();
                }}
            />
        </div>
    );
};

// --- Sub-Components ---

const OverviewTab = ({ asset }) => (
    <div className="space-y-6">
        <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Info size={14} /> Specifications</h4>
            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-sf-canvas/40 border dark:border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Manufacturer</div>
                    <div className="font-bold text-sm">{asset.manufacturer || '—'}</div>
                </div>
                <div className="p-3 rounded-xl bg-sf-canvas/40 border dark:border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Model / System</div>
                    <div className="font-bold text-sm">{asset.model || '—'}</div>
                </div>
                <div className="p-3 rounded-xl bg-sf-canvas/40 border dark:border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Serial Number</div>
                    <div className="font-bold font-mono text-sm">{asset.serialNumber || '—'}</div>
                </div>
                <div className="p-3 rounded-xl bg-sf-canvas/40 border dark:border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">Criticality</div>
                    <div className={`font-bold text-sm ${asset.criticality === 'CRITICAL' ? 'text-red-600' : 'text-blue-600'}`}>{asset.criticality}</div>
                </div>
            </div>
        </section>

        <section>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2"><MapPin size={14} /> Context</h4>
            <div className="p-4 rounded-xl border dark:border-gray-700 bg-gray-50/50 dark:bg-transparent space-y-3">
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Laboratory</span>
                    <span className="font-bold font-mono">{asset.labId}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Location Tag</span>
                    <span className="font-bold">{asset.locationId || 'Main Laboratory'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">Registered On</span>
                    <span className="font-bold">{new Date(asset.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
        </section>
    </div>
);

const MaintenanceTab = ({ asset, canManage, onAction }) => {
    const calibStatus = asset.qualification?.calibrationStatus || 'NOT_CONFIGURED';
    const verifStatus = asset.qualification?.verificationStatus || 'NOT_CONFIGURED';

    return (
        <div className="space-y-6">
            <div className="p-5 rounded-2xl border-2 border-dashed dark:border-gray-700 flex flex-col items-center text-center gap-4">
                <div className={`p-4 rounded-full ${READINESS_COLORS[asset.readiness] || READINESS_COLORS.NOT_CONFIGURED} bg-opacity-20`}>
                    {asset.readiness === 'READY' ? <CheckCircle size={32} /> : asset.readiness === 'BLOCKED' ? <ShieldAlert size={32} /> : <AlertTriangle size={32} />}
                </div>
                <div>
                    <h4 className="text-lg font-bold">Instrument Readiness: {asset.readiness}</h4>
                    <p className="text-sm text-gray-500">System check shows {asset.status.replace(/_/g, ' ')} state with {calibStatus.toLowerCase()} calibration.</p>
                </div>
            </div>

            <section>
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Calibration & Verification</h4>
                </div>
                <div className="space-y-3">
                    <div className="p-4 rounded-xl border dark:border-gray-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500 font-medium">Last External Calibration</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${calibStatus === 'OK' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : calibStatus === 'OVERDUE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : calibStatus === 'DUE_SOON' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 text-gray-500'}`}>
                                    {calibStatus}
                                </span>
                            </div>
                            <div className="font-bold text-sf-text">{asset.qualification?.lastCalibrationDate ? new Date(asset.qualification.lastCalibrationDate).toLocaleDateString() : 'None Recorded'}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                                Next Due: <span className={calibStatus === 'OVERDUE' ? 'text-red-500 font-bold' : ''}>{asset.qualification?.nextCalibrationDueDate ? new Date(asset.qualification.nextCalibrationDueDate).toLocaleDateString() : 'Unscheduled'}</span>
                            </div>
                        </div>
                        {canManage && onAction && (
                            <button
                                type="button"
                                onClick={() => onAction('CALIBRATION')}
                                className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                            >
                                <ClipboardCheck size={14} /> Log Calibration
                            </button>
                        )}
                    </div>

                    <div className="p-4 rounded-xl border dark:border-gray-700 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500 font-medium">Performance Verification</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${verifStatus === 'OK' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : verifStatus === 'OVERDUE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : verifStatus === 'DUE_SOON' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-gray-100 text-gray-500'}`}>
                                    {verifStatus}
                                </span>
                            </div>
                            <div className="font-bold text-sf-text">{asset.qualification?.lastVerificationDate ? new Date(asset.qualification.lastVerificationDate).toLocaleDateString() : 'None Recorded'}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                                Next Due: <span className={verifStatus === 'OVERDUE' ? 'text-red-500 font-bold' : ''}>{asset.qualification?.nextVerificationDueDate ? new Date(asset.qualification.nextVerificationDueDate).toLocaleDateString() : 'Unscheduled'}</span>
                            </div>
                        </div>
                        {canManage && onAction && (
                            <button
                                type="button"
                                onClick={() => onAction('VERIFICATION')}
                                className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                            >
                                <ClipboardCheck size={14} /> Log Verification
                            </button>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

const HistoryTab = ({ events = [] }) => (
    <div className="space-y-4">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Audit Log & Event History</h4>
        <div className="relative border-l-2 border-sf-divider ml-3 pl-6 space-y-6">
            {events.map((e, idx) => (
                <div key={e.id} className="relative">
                    <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 outline outline-4 outline-white dark:outline-gray-800" />
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 px-2 py-0.5 rounded uppercase">{e.eventType}</span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10} /> {new Date(e.ts).toLocaleString()}</span>
                    </div>
                    <div className="text-sm font-medium text-sf-text">{e.summary}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1 mt-1"><User size={10} /> {e.userId} • Outcome: <span className={e.outcome === 'PASS' ? 'text-emerald-500' : e.outcome === 'FAIL' ? 'text-red-500' : ''}>{e.outcome}</span></div>
                </div>
            ))}
            {events.length === 0 && <div className="text-gray-400 text-sm">No events found for this instrument.</div>}
        </div>
    </div>
);

const EligibilityTab = ({ asset }) => {
    const getAnalysisDisplayName = useAnalysisNames();
    const [mappings, setMappings] = React.useState([]);
    const [loadingEligibility, setLoadingEligibility] = React.useState(true);

    React.useEffect(() => {
        setLoadingEligibility(true);
        axios.get('/api/equipment/eligibility')
            .then(res => {
                const all = Array.isArray(res.data) ? res.data : [];
                // Filter mappings that include this asset's ID
                const relevant = all.filter(m => {
                    try {
                        const ids = JSON.parse(m.eligibleEquipmentIds || '[]');
                        return ids.includes(asset.id);
                    } catch { return false; }
                });
                setMappings(relevant);
            })
            .catch(err => console.error('[Eligibility] Fetch error:', err))
            .finally(() => setLoadingEligibility(false));
    }, [asset.id]);

    return (
        <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm">
                Instruments are mapped to analysis codes to prevent incorrect equipment selection during result entry.
            </div>
            <section>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Linked Laboratory Methods</h4>
                {loadingEligibility ? (
                    <div className="text-sm text-gray-400 flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Loading...</div>
                ) : mappings.length === 0 ? (
                    <div className="text-sm text-gray-400">No method eligibility mappings found for this instrument.</div>
                ) : (
                    <div className="space-y-2">
                        {mappings.map(m => (
                            <div key={m.id} className="p-3 rounded-lg border dark:border-gray-700 flex justify-between items-center text-sm">
                                <span className="font-bold">{getAnalysisDisplayName(m.analysisCode)}</span>
                                <span className={`text-xs px-2 py-0.5 rounded ${m.isRequired ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-sf-raised'}`}>
                                    {m.isRequired ? 'MANDATORY' : 'OPTIONAL'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default EquipmentDetailDrawer;
export { READINESS_COLORS };
