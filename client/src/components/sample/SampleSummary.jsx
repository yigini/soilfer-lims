import React from 'react';
import { ArrowLeft, CheckCircle, MoreHorizontal, User, Building, Phone, Activity, Clock, Inbox, Printer, Droplet, GitBranch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SampleSummary = ({
    sample,
    user,
    dryingStatus,
    prepStatus,
    archivingStatus,
    showContextPanel,
    setShowContextPanel,
    drawerOpen,
    setDrawerOpen,
    onApproveIntake,
    onUndoIntake,
    onFinalApproval,
    onUndoApproval,
    onArchive,
    onDispose,
    allAccepted,
    isApproved,
    onPrintLabel,
    onEditAnalysis
}) => {
    const navigate = useNavigate();

    if (!sample) return null;

    const submitter = sample.fieldMetadata?.submitterName?.value || sample.receptionData?.submitterDetails?.name || 'N/A';

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col mb-6 relative z-50 overflow-hidden transition-all hover:shadow-md">

            {/* TOP: ID & BASIC INFO */}
            <div className="p-6 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2.5 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-xl shadow-sm border border-gray-200 dark:border-gray-600 transition text-gray-500 dark:text-gray-400 group">
                        <ArrowLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>

                    <div className="flex flex-col">
                        <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-2">
                            <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 rounded border border-indigo-100 dark:border-indigo-800">
                                Sample ID: {sample.labId || sample.originalId}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="font-mono font-black text-3xl text-gray-900 dark:text-white tracking-tight leading-none">
                                {sample.labId || sample.originalId}
                            </h1>
                            <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide border shadow-sm ${sample.status === 'APPROVED' ? 'bg-green-100 text-green-700 border-green-200' :
                                sample.status === 'ARCHIVED' ? 'bg-purple-600 text-white border-purple-700' :
                                    sample.status === 'DISPOSED' ? 'bg-gray-800 text-white border-gray-900' :
                                        sample.status === 'RECEIVED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                            'bg-indigo-50 text-indigo-700 border-indigo-100'
                                }`}>
                                {sample.status?.replace('_', ' ')}
                            </span>
                            {isApproved && <CheckCircle size={20} className="text-green-600 drop-shadow-sm" />}
                        </div>
                        {sample.labId && sample.labId !== sample.originalId && (
                            <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] font-black">
                                {sample.originalId}
                            </span>
                        )}
                    </div>
                </div>

                {/* PRINT & AUDIT ACTIONS */}
                <div className="flex gap-2">
                    {['LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role) && (
                        <button
                            onClick={onEditAnalysis}
                            className="p-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl shadow-sm transition-all"
                            title="Edit Analysis Selection"
                        >
                            <Droplet size={20} />
                        </button>
                    )}
                    <button
                        onClick={onPrintLabel}
                        className="p-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl shadow-sm transition-all"
                        title="Print Label"
                    >
                        <Printer size={20} />
                    </button>
                    <button
                        onClick={() => navigate(`/samples/${sample.id}/map`)}
                        className="p-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-xl shadow-sm transition-all"
                        title="Workflow Map"
                    >
                        <GitBranch size={20} />
                    </button>
                    <button
                        onClick={() => setDrawerOpen(!drawerOpen)}
                        className={`p-2.5 rounded-xl transition-all border shadow-sm ${drawerOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                            }`}
                        title="Audit Log"
                    >
                        <MoreHorizontal size={20} />
                    </button>
                </div>
            </div>

            {/* MIDDLE: METADATA GRID */}
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em]">
                        <Building size={11} /> Project
                    </div>
                    <div className="text-base font-black text-gray-800 dark:text-gray-100 truncate max-w-[150px]" title={sample.projectCode}>
                        {sample.projectCode || 'N/A'}
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em]">
                        <Activity size={11} /> Sample Type
                    </div>
                    <div className="text-base font-black text-gray-800 dark:text-gray-100">{sample.sampleType || 'Soil'}</div>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em]">
                        <Clock size={11} /> Date Received
                    </div>
                    <div className="text-base font-black text-gray-800 dark:text-gray-100">
                        {sample.receptionDate ? new Date(sample.receptionDate).toLocaleDateString('en-GB') :
                            (sample.createdAt ? new Date(sample.createdAt).toLocaleDateString('en-GB') : 'N/A')}
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.1em]">
                        <Activity size={11} /> Priority
                    </div>
                    {sample.fieldMetadata?.urgency?.value || sample.priority ? (
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-sm w-fit ${(sample.fieldMetadata?.urgency?.value === 'Urgent' || sample.priority === 'HIGH') ? 'bg-red-50 text-red-700 border-red-100 dark:bg-red-900/20 dark:border-red-800' :
                            (sample.fieldMetadata?.urgency?.value === 'Medium' || sample.priority === 'NORMAL') ? 'bg-orange-50 text-orange-700 border-orange-100 dark:bg-orange-900/20 dark:border-orange-800' :
                                'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-800'
                            }`}>
                            {sample.fieldMetadata?.urgency?.value || sample.priority}
                        </div>
                    ) : <span className="text-gray-400 text-base font-bold">-</span>}
                </div>
            </div>

            {/* BOTTOM: ACTIONS */}
            <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/20 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    {/* Gates Status */}
                    {(dryingStatus || prepStatus) && (
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-r border-gray-200 dark:border-gray-700 pr-4">Gates</span>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col gap-1 items-center">
                                    <div className={`w-2 h-2 rounded-full ${dryingStatus === 'COMPLETED' || dryingStatus === 'ACCEPTED' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Drying</span>
                                </div>
                                <div className="flex flex-col gap-1 items-center">
                                    <div className={`w-2 h-2 rounded-full ${prepStatus === 'COMPLETED' || prepStatus === 'ACCEPTED' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-300 dark:bg-gray-600'}`} />
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Prep</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {/* RECEIVE SAMPLE */}
                    {(sample.status === 'EXPECTED' || sample.status === 'COLLECTED') && (
                        <button
                            onClick={() => {
                                const params = new URLSearchParams();
                                params.set('originalId', sample.originalId);
                                if (sample.projectId) params.set('projectId', sample.projectId);
                                if (sample.projectCode) params.set('projectCode', sample.projectCode);
                                navigate(`/reception?${params.toString()}`);
                            }}
                            className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
                        >
                            <Inbox size={18} /> Receive Sample
                        </button>
                    )}

                    {/* APPROVE INTAKE */}
                    {sample.status === 'RECEIVED' && (user.role === 'LAB_MANAGER' || user.role === 'SUPER_ADMIN') && (
                        <button
                            onClick={onApproveIntake}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
                        >
                            <CheckCircle size={18} /> Approve Intake
                        </button>
                    )}

                    {/* UNDO INTAKE */}
                    {(sample.status === 'ACCEPTED' || sample.status === 'LAB_ID_ASSIGNED') && (user.role === 'LAB_MANAGER' || user.role === 'SUPER_ADMIN') && (
                        <button
                            onClick={onUndoIntake}
                            className="bg-white text-red-600 border border-gray-200 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-red-50 hover:border-red-200 transition-all flex items-center gap-2"
                        >
                            <span className="text-lg leading-none">↩</span> Undo Intake
                        </button>
                    )}

                    {/* FINAL APPROVAL */}
                    {user.role === 'LAB_MANAGER' && sample.status !== 'RECEIVED' && (
                        <>
                            {!['APPROVED', 'ARCHIVED', 'DISPOSED'].includes(sample.status) && (
                                <button
                                    onClick={onFinalApproval}
                                    disabled={!allAccepted && !isApproved}
                                    className={`px-6 py-2.5 rounded-xl transition-all border flex items-center gap-2 font-bold text-sm shadow-md ${allAccepted || isApproved
                                        ? 'bg-green-600 text-white border-green-600 hover:bg-green-700 hover:shadow-lg hover:-translate-y-0.5'
                                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                        }`}
                                >
                                    <CheckCircle size={18} /> Final Approve
                                </button>
                            )}

                            {/* APPROVED + PENDING POST-ANALYTICAL ACTIONS */}
                            {(isApproved || sample.status === 'APPROVED' || sample.status === 'PROCESSING') && (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-500">
                                    {isApproved && (
                                        <button
                                            onClick={onUndoApproval}
                                            className="bg-white hover:bg-gray-50 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold border border-gray-200 shadow-sm transition-all"
                                        >
                                            Undo
                                        </button>
                                    )}

                                    {/* ARCHIVE BUTTON */}
                                    {archivingStatus === 'ACCEPTED' || sample.status === 'ARCHIVED' ? (
                                        <div className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg text-[10px] font-black uppercase border border-purple-200 flex items-center gap-2">
                                            <Building size={12} /> Archived
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                onArchive && onArchive();
                                                setTimeout(() => {
                                                    const el = document.getElementById('wi-row-ARCHIVING');
                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                }, 300);
                                            }}
                                            disabled={!isApproved || sample.workItems?.some(w => w.analysis === 'DISPOSAL' && w.assignedTo)}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold border shadow-sm transition-all flex items-center gap-1 ${isApproved
                                                ? (archivingStatus ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200')
                                                : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                                                }`}
                                        >
                                            {archivingStatus ? 'Assign Archival' : 'Archive'}
                                        </button>
                                    )}

                                    {/* DISPOSE BUTTON */}
                                    {sample.workItems?.some(w => w.analysis === 'DISPOSAL' && w.status === 'ACCEPTED') || sample.status === 'DISPOSED' ? (
                                        <div className="bg-gray-800 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase flex items-center gap-2">
                                            <CheckCircle size={12} /> Disposed
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                onDispose && onDispose();
                                                setTimeout(() => {
                                                    const el = document.getElementById('wi-row-DISPOSAL');
                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                }, 300);
                                            }}
                                            disabled={!isApproved || sample.workItems?.some(w => w.analysis === 'ARCHIVING' && w.assignedTo)}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold border shadow-sm transition-all flex items-center gap-1 ${isApproved
                                                ? (sample.workItems?.some(w => w.analysis === 'DISPOSAL') ? 'bg-red-100 text-red-700 border-red-300' : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200')
                                                : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'
                                                }`}
                                        >
                                            {sample.workItems?.some(w => w.analysis === 'DISPOSAL') ? 'Assign Disposal' : 'Dispose'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SampleSummary;
