import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    Plus, Database, CheckCircle2, AlertTriangle, X,
    Calendar, Beaker, Archive, RotateCcw, Trash2,
    ArrowRight, ChevronRight, Clock, Search, Filter,
    MoreVertical, PackageCheck, LayoutList, FileSearch, Edit2, Lock, BarChart2, Pause, History
} from 'lucide-react';
import LegacyBackfillModal from '../components/projects/LegacyBackfillModal';

const calculatePercentage = (actual, target) => {
    const a = parseInt(actual) || 0;
    const t = parseInt(target) || 0;
    if (t === 0) return 0;
    return Math.round((a / t) * 100);
};
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';
import * as XLSX from 'xlsx';
import InfoTooltip from '../components/common/InfoTooltip';

export const getProjectLabIds = (p) => {
    if (!p) return [];
    if (Array.isArray(p.assignedLabs) && p.assignedLabs.length > 0) return p.assignedLabs;
    if (Array.isArray(p.assignedLabIds) && p.assignedLabIds.length > 0) return p.assignedLabIds;
    if (typeof p.assignedLabIds === 'string' && p.assignedLabIds.trim()) {
        try {
            const parsed = JSON.parse(p.assignedLabIds);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
    }
    return [];
};

const ProjectDrawer = ({ project, isOpen, onClose, onEdit, canEdit, canDelete, handleArchive, handleRestore, initiateDelete, onViewSamples, onOpenLegacyBackfill }) => {
    if (!project) return null;

    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setUploadStatus({ type: 'info', message: 'Processing file...' });

        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                const sampleIds = data
                    .map(row => String(row[0] || '').trim())
                    .filter(id => id && id !== 'Sample ID' && id !== 'sample_id');

                if (sampleIds.length === 0) {
                    setUploadStatus({ type: 'error', message: 'No valid Sample IDs found in first column.' });
                    setUploading(false);
                    return;
                }

                try {
                    const res = await axios.post(`/api/projects/${project.id}/manifest`, { sampleIds });
                    setUploadStatus({
                        type: 'success',
                        message: res.data.message || `Success! Registered ${res.data.count} samples.`
                    });
                } catch (err) {
                    const errorMsg = err.response?.data?.error || 'Upload failed';
                    const details = err.response?.data?.details;
                    setUploadStatus({
                        type: 'error',
                        message: details ? `${errorMsg} ${details}` : errorMsg
                    });
                }
                setUploading(false);
            };
            reader.readAsBinaryString(file);
        } catch (err) {
            setUploadStatus({ type: 'error', message: 'File read error' });
            setUploading(false);
        }
    };

    const isOverdue = project.deliveryDeadline && new Date(project.deliveryDeadline) < new Date() && project.status === 'ACTIVE';

    return (
        <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-sf-surface shadow-2xl z-[60] transform transition-transform duration-300 border-l border-sf-divider ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="h-full flex flex-col">
                <div className="p-6 border-b border-sf-divider flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                    <div>
                        <h2 className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">{project.code}</h2>
                        <p className="text-sm text-sf-muted font-medium">{project.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors truncate">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Status Badges */}
                    <div className="flex flex-wrap gap-2">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${project.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            project.status === 'PAUSED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                project.status === 'PENDING_MANIFEST' ? 'bg-orange-50 text-orange-700 border-orange-200 shadow-sm animate-pulse' :
                                    'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                            {project.status === 'PENDING_MANIFEST' ? 'On Hold (Awaiting Manifest)' : project.status}
                        </span>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                            {project.projectType === 'KOBO_LINKED' ? '📱 Kobo Sync' :
                                project.projectType === 'TEMPLATE_PREDEFINED_IDS' ? '📋 Template' : '🚪 Open Intake'}
                        </span>
                        {project.priority && (
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${project.priority === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' :
                                project.priority === 'LOW' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                                    'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                {project.priority} Priority
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Expected Samples</label>
                            <p className="text-lg font-black text-sf-text">{project.expectedSampleCount || '—'}</p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Deadline</label>
                            <div className="flex items-center gap-2">
                                <Calendar size={16} className={isOverdue ? 'text-red-500' : 'text-gray-400'} />
                                <p className={`text-md font-bold ${isOverdue ? 'text-red-600 animate-pulse' : 'text-sf-text'}`}>
                                    {project.deliveryDeadline ? new Date(project.deliveryDeadline).toLocaleDateString() : 'None'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lab Instructions / Notes</label>
                        <div className="p-4 bg-sf-canvas rounded-xl border border-sf-divider text-sm leading-relaxed text-sf-muted">
                            {project.notes || "No special instructions provided."}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Analysis Bundle</label>
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                            <Beaker size={18} className="text-blue-500" />
                            <span className="text-sm font-bold text-blue-700">{project.defaultAnalysisBundle || "Not specified"}</span>
                        </div>
                    </div>

                    {/* ASSIGNED LABS SECTION - Show for global projects */}
                    {!project.labId && (
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-purple-600 uppercase tracking-widest">Assigned Laboratories</label>
                            <div className="p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800">
                                {(() => {
                                    const labs = getProjectLabIds(project);

                                    if (labs.length > 0) {
                                        return (
                                            <div className="flex flex-wrap gap-2">
                                                {labs.map(labId => (
                                                    <span
                                                        key={labId}
                                                        className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs font-bold border border-purple-200"
                                                    >
                                                        {labId}
                                                    </span>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return (
                                        <p className="text-sm text-purple-400 italic">No labs assigned yet. Only Super Admins can view this project.</p>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                    {project.projectType === 'TEMPLATE_PREDEFINED_IDS' && (
                        <div className="pt-4 border-t border-sf-divider space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Manifest Management</label>
                                {project.totalCount > 0 && (
                                    <button
                                        onClick={() => onViewSamples(project)}
                                        className="text-[10px] font-black text-blue-600 hover:text-blue-800 uppercase flex items-center gap-1 transition-colors"
                                    >
                                        <LayoutList size={12} /> View Registered Samples
                                    </button>
                                )}
                            </div>
                            {canEdit && (
                                <div className="p-4 bg-blue-50/30 dark:bg-blue-900/10 rounded-xl border border-dashed border-blue-200 dark:border-blue-800">
                                    <p className="text-[11px] text-blue-700 dark:text-blue-300 mb-3 leading-snug">
                                        {project.totalCount > 0 ? (
                                            <>
                                                <strong>Add additional samples</strong> to this project. Upload a list where the first column contains the new Sample IDs.
                                                <span className="block mt-1 opacity-75 italic">Existing IDs in the database will be automatically skipped.</span>
                                            </>
                                        ) : (
                                            "Upload a CSV or Excel file containing a list of Sample IDs (first column). These will be pre-registered as expected samples for intake lookup."
                                        )}
                                    </p>

                                    <input
                                        type="file"
                                        accept=".csv, .xlsx, .xls"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="manifest-upload"
                                        disabled={uploading}
                                    />
                                    <label
                                        htmlFor="manifest-upload"
                                        className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold cursor-pointer hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 active:scale-95 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {uploading ? <Clock className="animate-spin" size={14} /> : <Plus size={14} />}
                                        {uploading ? 'Processing...' : (project.totalCount > 0 ? 'Add Supplemental Samples' : 'Upload Sample List')}
                                    </label>

                                    {uploadStatus && (
                                        <div className={`mt-3 p-2 rounded text-[10px] font-medium flex items-center gap-2 ${uploadStatus.type === 'error' ? 'bg-red-50 text-red-700' :
                                            uploadStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
                                                'bg-blue-50 text-blue-700'
                                            }`}>
                                            {uploadStatus.type === 'error' && <AlertTriangle size={12} />}
                                            {uploadStatus.type === 'success' && <CheckCircle2 size={12} />}
                                            {uploadStatus.message}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {/* Pre-Delivery Historical Analysis Backfill Card */}
                    <div className="pt-4 border-t border-sf-divider space-y-3">
                        <div className="p-4 rounded-xl border border-amber-200/90 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20">
                            <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-700 dark:text-amber-300 flex-shrink-0 mt-0.5">
                                    <History size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="text-xs font-bold text-sf-text">
                                            Pre-Platform Historical Analysis
                                        </h4>
                                        <span className="text-[9px] font-black uppercase tracking-wider bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded">
                                            Backward Compatibility
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-sf-muted mt-1 leading-snug">
                                        Were samples for this project analysed before platform deployment? Bulk backfill historical wet chemistry, spectroscopy, and certificates.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => onOpenLegacyBackfill && onOpenLegacyBackfill(project)}
                                    className="px-3 py-1.5 bg-sf-surface hover:bg-amber-50 dark:hover:bg-amber-900/40 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                                >
                                    <span>Backfill Historical Data</span>
                                    <ArrowRight size={13} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-sf-divider space-y-3">
                    <div className="flex gap-3">
                        {canEdit && (
                            <button
                                onClick={onEdit}
                                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                                Edit Project
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 border border-sf-divider rounded-xl font-bold bg-sf-surface hover:bg-gray-50 transition active:scale-95"
                        >
                            Close
                        </button>
                    </div>

                    {/* Quick Management Actions in Drawer */}
                    {canEdit && (
                        <div className="flex flex-wrap gap-2 pt-2">
                            {['ACTIVE', 'PAUSED', 'PENDING_MANIFEST', 'CLOSED'].includes(project.status) && (
                                <button
                                    onClick={() => handleArchive(project)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-[10px] font-black uppercase transition-colors"
                                >
                                    <Archive size={12} /> Mark as Completed
                                </button>
                            )}
                            {['COMPLETED', 'DELETED'].includes(project.status) && (
                                <button
                                    onClick={() => handleRestore(project)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 text-[10px] font-black uppercase transition-colors"
                                >
                                    <RotateCcw size={12} /> Restore Project
                                </button>
                            )}
                            {project.status !== 'DELETED' && canDelete && (
                                <button
                                    onClick={() => initiateDelete(project)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-[10px] font-black uppercase transition-colors"
                                >
                                    <Trash2 size={12} /> Move to Trash
                                </button>
                            )}
                            {project.status !== 'DELETED' && !canDelete && (
                                <div
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sf-divider text-gray-400 text-[10px] font-black uppercase cursor-not-allowed opacity-60"
                                    title="Only System Administrators can delete this project"
                                >
                                    <Lock size={12} /> Admin Only
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const SampleManifestModal = ({ isOpen, project, samples, loading, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-sf-divider animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-sf-divider flex justify-between items-center bg-gray-50/30 dark:bg-gray-900/30">
                    <div>
                        <h2 className="text-xl font-black text-sf-text uppercase tracking-tight flex items-center gap-2">
                            <PackageCheck className="text-blue-600" size={24} />
                            Project Manifest: {project?.code}
                        </h2>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Expected Sample List ({samples.length} items)</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                            <Clock className="animate-spin mb-4" size={48} />
                            <p className="font-bold uppercase tracking-widest text-xs">Loading Manifest Data...</p>
                        </div>
                    ) : samples.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-400 border-2 border-dashed border-sf-divider rounded-3xl">
                            <FileSearch size={48} className="mb-4 opacity-20" />
                            <p className="font-bold uppercase tracking-widest text-xs">No samples found in this manifest.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {samples.map((s, idx) => (
                                <div key={s.id} className={`p-3 rounded-xl border flex flex-col gap-1 transition-all ${s.status !== 'EXPECTED'
                                    ? 'bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-800'
                                    : 'bg-white border-gray-100 dark:bg-gray-800 dark:border-gray-700'
                                    } shadow-sm hover:shadow-md`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">#{idx + 1}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter ${s.status === 'EXPECTED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-600 text-white'
                                            }`}>
                                            {s.status}
                                        </span>
                                    </div>
                                    <p className="text-xs font-mono font-bold text-sf-text truncate">{s.id}</p>
                                    <div className="flex items-center gap-1 mt-1">
                                        <Calendar size={10} className="text-gray-300" />
                                        <span className="text-[9px] text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-sf-divider bg-gray-50/30 dark:bg-gray-900/30 flex justify-between items-center">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-white border border-gray-200" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Expected</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-600" />
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Received</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition active:scale-95 text-sm uppercase tracking-widest">
                        Close View
                    </button>
                </div>
            </div>
        </div>
    );
};

const SuccessModal = ({ isOpen, message, onClose }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
            <div className="bg-sf-surface rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-sf-divider animate-in zoom-in duration-300">
                <div className="p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6 animate-bounce">
                        <CheckCircle2 size={48} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-black text-sf-text uppercase tracking-tight mb-2">Success!</h3>
                    <p className="text-sf-muted text-sm font-medium leading-relaxed px-4">
                        {message}
                    </p>
                </div>
                <div className="p-4 bg-sf-canvas/50 border-t border-sf-divider">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-gray-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black dark:hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                    >
                        Awesome, Thanks!
                    </button>
                </div>
            </div>
        </div>
    );
};

const Projects = () => {
    const { user } = useAuth();
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const [projects, setProjects] = useState([]);
    const [labs, setLabs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [statsProject, setStatsProject] = useState(null);
    const [statsData, setStatsData] = useState(null);

    // Manifest Modal States
    const [showSampleModal, setShowSampleModal] = useState(false);
    const [modalProject, setModalProject] = useState(null);
    const [modalSamples, setModalSamples] = useState([]);
    const [loadingSamples, setLoadingSamples] = useState(false);

    // Success Modal States
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Legacy Backfill Modal States (Backward Compatibility for Pre-Platform Analysis)
    const [showLegacyBackfillModal, setShowLegacyBackfillModal] = useState(false);
    const [backfillTargetProject, setBackfillTargetProject] = useState(null);

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        description: '',
        projectType: 'OPEN_INTAKE',
        expectedSampleCount: 0,
        deliveryDeadline: '',
        priority: 'NORMAL',
        defaultAnalysisBundle: '',
        notes: '',
        status: 'ACTIVE',
        labId: '',
        assignedLabIds: [],
        koboServerUrl: 'https://kf.kobotoolbox.org',
        koboFormId: '',
        koboApiToken: '',
        sampleIds: [],
        manifestFileName: ''
    });
    const [koboTestStatus, setKoboTestStatus] = useState(null); // null | 'testing' | 'success' | 'error'
    const [koboTestMessage, setKoboTestMessage] = useState('');

    // --- Delete Flow State ---
    const [statsLoading, setStatsLoading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null); // ID pending confirmation
    const [deletingIds, setDeletingIds] = useState([]); // IDs in undo window
    const [undoTimers, setUndoTimers] = useState({}); // { id: timeoutId }
    const [countdowns, setCountdowns] = useState({}); // { id: remainingSeconds }

    // --- Drawer State ---
    const [viewingProject, setViewingProject] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, ACTIVE, PAUSED, CLOSED
    const [filterType, setFilterType] = useState('ALL'); // ALL, TEMPLATE, OPEN
    const [filterPriority, setFilterPriority] = useState('ALL'); // ALL, HIGH, NORMAL, LOW
    const [showOnlyMyLab, setShowOnlyMyLab] = useState(user?.role === 'LAB_MANAGER');

    // Helper: Is Project Editable?
    const isEditable = (p) => {
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN' || user.role === 'MASTER_USER') return true;
        if (user.role === 'LAB_MANAGER') {
            return p.labId && p.labId === user.labId;
        }
        return false;
    };

    const [groups, setGroups] = useState([]);

    const handleViewManifest = async (proj) => {
        setModalProject(proj);
        setShowSampleModal(true);
        setLoadingSamples(true);
        try {
            const res = await axios.get(`/api/projects/${proj.id}/samples`);
            setModalSamples(res.data);
        } catch (e) {
            console.error("Failed to fetch manifest samples", e);
            showDialog({ title: 'Error', message: 'Failed to load sample list', type: 'error' });
        } finally {
            setLoadingSamples(false);
        }
    };

    const fetchProjects = useCallback(async () => {
        setLoading(true);
        try {
            const [projRes, labRes, groupRes] = await Promise.all([
                axios.get('/api/projects?includeDeleted=true'),
                (user.role === 'SUPER_ADMIN' || user.role === 'MASTER_USER') ? axios.get('/api/labs') : Promise.resolve({ data: [] }),
                axios.get('/api/config/groups')
            ]);

            setProjects(projRes.data);
            setLabs(labRes.data);
            setGroups(groupRes.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [user.role, user.labId]);



    useEffect(() => {
        if (deletingIds.length === 0) return;

        const interval = setInterval(() => {
            setCountdowns(prev => {
                const updated = { ...prev };
                Object.keys(updated).forEach(id => {
                    if (updated[id] > 0) updated[id] -= 1;
                });
                return updated;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [deletingIds]);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData };
            // Ensure numeric values
            payload.expectedSampleCount = parseInt(payload.expectedSampleCount) || 0;

            // Normalize dates to ISO or null to avoid Prisma validation errors on legacy records
            payload.deliveryDeadline = payload.deliveryDeadline ? new Date(payload.deliveryDeadline).toISOString() : null;
            payload.startDate = payload.startDate ? new Date(payload.startDate).toISOString() : null;

            // Serialize lab assignments for multi-lab support
            if (Array.isArray(payload.assignedLabIds)) {
                payload.assignedLabIds = JSON.stringify(payload.assignedLabIds);
            }

            // Clean up UI-only fields before sending
            delete payload.manifestFileName;

            if (editing) {
                delete payload.sampleIds; // sampleIds only for creation
                await axios.put(`/api/projects/${editing.id}`, payload);
                setSuccessMessage(`Project ${payload.code} updated successfully.${payload.assignedLabIds ? ' Lab assignments have been synchronized.' : ''}`);
            } else {
                const sampleCount = payload.sampleIds?.length || 0;
                await axios.post('/api/projects', payload);
                setSuccessMessage(
                    sampleCount > 0
                        ? `Project ${payload.code} created with ${sampleCount} samples registered!`
                        : `Project ${payload.code} created successfully.`
                );
            }
            setShowSuccessModal(true);
            setShowModal(false);
            fetchProjects();
        } catch (e) {
            showDialog({ title: 'Error', message: e.response?.data?.error || e.message, type: 'error' });
        }
    };

    // --- Delete Flow Handlers ---

    const initiateDelete = (proj) => {
        setDeleteTarget(proj);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        const id = deleteTarget.id;
        setDeleteTarget(null);

        // Add to deleting list (Visual Strikethrough)
        setDeletingIds(prev => [...prev, id]);
        setCountdowns(prev => ({ ...prev, [id]: 10 }));

        // Start Timer
        const timer = setTimeout(() => {
            performFinalDelete(id);
        }, 10000); // 10 seconds

        setUndoTimers(prev => ({ ...prev, [id]: timer }));
    };

    const undoDelete = (id) => {
        if (undoTimers[id]) {
            clearTimeout(undoTimers[id]);
            setUndoTimers(prev => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
        }
        setCountdowns(prev => {
            const updated = { ...prev };
            delete updated[id];
            return updated;
        });
        setDeletingIds(prev => prev.filter(mid => mid !== id));
    };

    const performFinalDelete = async (id) => {
        try {
            await axios.delete(`/api/projects/${id}`);
            fetchProjects();
        } catch (e) {
            console.error("Failed to delete project", e);
            showDialog({ title: 'Delete Failed', message: e.response?.data?.error || e.message, type: 'error' });
            undoDelete(id);
        } finally {
            setUndoTimers(prev => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
            setCountdowns(prev => {
                const updated = { ...prev };
                delete updated[id];
                return updated;
            });
            setDeletingIds(prev => prev.filter(mid => mid !== id));
        }
    };

    const viewStats = async (p) => {
        setStatsProject(p);
        setStatsLoading(true);
        setStatsData(null);
        try {
            const res = await axios.get(`/api/projects/${p.id}/stats`);
            setStatsData(res.data);
        } catch (e) {
            console.error("Failed to load stats", e);
        } finally {
            setStatsLoading(false);
        }
    };

    const toggleStatus = async (p, newStatus) => {
        try {
            setLoading(true);
            await axios.put(`/api/projects/${p.id}`, { status: newStatus || (p.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE') });
            fetchProjects();
        } catch (e) {
            console.error("Status toggle failed", e);
        } finally {
            setLoading(false);
        }
    };

    const handleArchive = async (p) => {
        try {
            setLoading(true);
            const res = await axios.post(`/api/projects/${p.id}/archive`);
            setSuccessMessage(`Project ${p.code} has been successfully marked as completed and moved to the archive.`);
            setShowSuccessModal(true);
            fetchProjects();
            if (viewingProject?.id === p.id) setViewingProject(null);
        } catch (e) {
            console.error("Archive failed", e);
            showDialog({ title: 'Archive Failed', message: e.response?.data?.error || e.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (p) => {
        try {
            setLoading(true);
            const res = await axios.post(`/api/projects/${p.id}/restore`);
            setSuccessMessage(`Project ${p.code} has been successfully restored to Active status.`);
            setShowSuccessModal(true);
            fetchProjects();
            if (viewingProject?.id === p.id) setViewingProject(null);
        } catch (e) {
            console.error("Restore failed", e);
            showDialog({ title: 'Restore Failed', message: e.response?.data?.error || e.message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const [koboConfigLoaded, setKoboConfigLoaded] = useState(false);
    const [koboCanEdit, setKoboCanEdit] = useState(true);

    const openModal = async (proj = null) => {
        if (proj && !isEditable(proj)) return;
        setEditing(proj);
        setKoboConfigLoaded(false);
        setKoboCanEdit(true);
        setKoboTestStatus(null);
        setKoboTestMessage('');
        if (proj) {
            // Parse assignedLabIds robustly
            let parsedLabIds = getProjectLabIds(proj);

            const baseFormData = {
                code: proj.code,
                name: proj.name,
                description: proj.description || '',
                projectType: proj.projectType || 'OPEN_INTAKE',
                expectedSampleCount: proj.expectedSampleCount || 0,
                deliveryDeadline: proj.deliveryDeadline ? proj.deliveryDeadline.split('T')[0] : '',
                priority: proj.priority || 'NORMAL',
                defaultAnalysisBundle: proj.defaultAnalysisBundle || '',
                notes: proj.notes || '',
                status: proj.status || 'ACTIVE',
                labId: proj.labId || '',
                assignedLabIds: parsedLabIds,
                koboServerUrl: 'https://kf.kobotoolbox.org',
                koboFormId: '',
                koboApiToken: ''
            };

            setFormData(baseFormData);

            // Fetch existing Kobo config for KOBO_LINKED projects
            if (proj.projectType === 'KOBO_LINKED') {
                try {
                    const res = await axios.get(`/api/projects/${proj.id}/kobo-config`);
                    if (res.data.configured) {
                        setFormData(prev => ({
                            ...prev,
                            koboServerUrl: res.data.koboServerUrl || 'https://kf.kobotoolbox.org',
                            koboFormId: res.data.koboFormId || '',
                            koboApiToken: res.data.koboApiToken || ''
                        }));
                        setKoboCanEdit(res.data.canEdit !== false);
                        setKoboConfigLoaded(true);
                    }
                } catch (err) {
                    console.error('Failed to load Kobo config:', err);
                }
            }
        } else {
            setFormData({
                code: '',
                name: '',
                description: '',
                projectType: 'OPEN_INTAKE',
                expectedSampleCount: 0,
                deliveryDeadline: '',
                priority: 'NORMAL',
                defaultAnalysisBundle: '',
                notes: '',
                status: 'ACTIVE',
                labId: '',
                assignedLabIds: [],
                koboServerUrl: 'https://kf.kobotoolbox.org',
                koboFormId: '',
                koboApiToken: '',
                sampleIds: [],
                manifestFileName: ''
            });
        }
        setShowModal(true);
    };

    const filteredProjects = projects
        .filter(p => {
            // Respect the specific "DELETED" view
            if (filterStatus === 'DELETED') return p.status === 'DELETED';
            // Hide deleted projects from normal views
            if (p.status === 'DELETED') return false;

            const matchesSearch = p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.name?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
            const matchesType = filterType === 'ALL' ||
                (filterType === 'TEMPLATE' && p.projectType === 'TEMPLATE_PREDEFINED_IDS') ||
                (filterType === 'KOBO' && p.projectType === 'KOBO_LINKED') ||
                (filterType === 'OPEN' && p.projectType === 'OPEN_INTAKE');
            const matchesPriority = filterPriority === 'ALL' || p.priority === filterPriority;
            const matchesLab = !showOnlyMyLab ||
                (p.labId === user.labId) ||
                getProjectLabIds(p).includes(user.labId);

            return matchesSearch && matchesStatus && matchesType && matchesPriority && matchesLab;
        })
        .sort((a, b) => {
            // COMPLETED projects go to the bottom
            if (a.status === 'COMPLETED' && b.status !== 'COMPLETED') return 1;
            if (a.status !== 'COMPLETED' && b.status === 'COMPLETED') return -1;

            // 1. Overdue projects first
            const now = new Date();
            const aOverdue = a.deliveryDeadline && new Date(a.deliveryDeadline) < now && a.status === 'ACTIVE';
            const bOverdue = b.deliveryDeadline && new Date(b.deliveryDeadline) < now && b.status === 'ACTIVE';
            if (aOverdue && !bOverdue) return -1;
            if (!aOverdue && bOverdue) return 1;

            // 2. Upcoming deadlines (soonest first)
            if (a.deliveryDeadline && b.deliveryDeadline) {
                return new Date(a.deliveryDeadline) - new Date(b.deliveryDeadline);
            }
            if (a.deliveryDeadline) return -1;
            if (b.deliveryDeadline) return 1;

            // 3. Fallback to UpdatedAt
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

    const stats = {
        total: projects.filter(p => p.status !== 'DELETED').length,
        active: projects.filter(p => p.status === 'ACTIVE').length,
        deleted: projects.filter(p => p.status === 'DELETED').length,
        overdue: projects.filter(p => p.status === 'ACTIVE' && p.deliveryDeadline && new Date(p.deliveryDeadline) < new Date()).length
    };

    return (
        <div className="max-w-7xl mx-auto p-6 relative min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-sf-text tracking-tight">{t('projects.title', 'Projects')}</h1>
                    <p className="text-sf-muted mt-1">{t('projects.subtitle', 'Operational management of soil research projects')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setBackfillTargetProject(null); setShowLegacyBackfillModal(true); }}
                        className="bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800/80 px-4 py-3 rounded-xl flex items-center gap-2 hover:shadow-md transition-all font-bold text-sm active:scale-95"
                        title="Backward compatibility for project samples analysed prior to platform deployment"
                    >
                        <History size={18} className="text-amber-600 dark:text-amber-400" />
                        <span>Pre-Delivery Backfill</span>
                        <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded">
                            Legacy
                        </span>
                    </button>
                    {(user.role === 'SUPER_ADMIN' || user.role === 'MASTER_USER' || user.role === 'LAB_MANAGER') && (
                        <button
                            onClick={() => openModal()}
                            className="bg-blue-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all font-bold active:scale-95"
                        >
                            <Plus size={20} /> {t('projects.createProject', 'Create Project')}
                        </button>
                    )}
                </div>
            </div>

            {/* QUICK STATS CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-sf-surface p-5 rounded-2xl shadow-sm border border-sf-divider flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Database size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-sf-text uppercase tracking-tighter">{stats.total}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{t('common.total', 'Total')} {t('projects.title', 'Projects')}</div>
                    </div>
                </div>

                <div className="bg-sf-surface p-5 rounded-2xl shadow-sm border border-sf-divider flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <PackageCheck size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-sf-text uppercase tracking-tighter">{stats.active}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{t('projects.active', 'Active')}</div>
                    </div>
                </div>

                <div className="bg-sf-surface p-5 rounded-2xl shadow-sm border border-sf-divider flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center text-red-600 dark:text-red-400">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-sf-text uppercase tracking-tighter">{stats.overdue}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{t('projects.overdue', 'Overdue')}</div>
                    </div>
                </div>

                <div className="bg-sf-surface p-5 rounded-2xl shadow-sm border border-sf-divider flex items-center gap-4">
                    <div className="w-12 h-12 bg-sf-canvas/40 rounded-xl flex items-center justify-center text-gray-400">
                        <Archive size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-black text-sf-text uppercase tracking-tighter">{stats.deleted}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-tight">{t('projects.archived', 'Archived')}</div>
                    </div>
                </div>
            </div>

            {/* CONTROLS BAR */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center mb-6 bg-sf-surface p-4 rounded-2xl border border-sf-divider shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder={t('projects.searchPlaceholder', 'Search projects by name, code, or country...')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 bg-sf-canvas border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 text-sf-text outline-none"
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                    <select
                        value={filterStatus}
                        onChange={e => setFilterStatus(e.target.value)}
                        className="text-sm font-bold bg-white dark:bg-gray-700 border border-sf-divider rounded-lg px-3 py-2 outline-none"
                    >
                        <option value="ALL">All Status</option>
                        <option value="ACTIVE">Active</option>
                        <option value="PAUSED">Paused</option>
                        <option value="COMPLETED">Completed (Archived)</option>
                        <option value="CLOSED">Closed</option>
                        <option value="DELETED">Trash / Deleted</option>
                    </select>
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value)}
                        className="text-sm font-bold bg-white dark:bg-gray-700 border border-sf-divider rounded-lg px-3 py-2 outline-none"
                    >
                        <option value="ALL">All Types</option>
                        <option value="TEMPLATE">Template</option>
                        <option value="KOBO">Kobo Linked</option>
                        <option value="OPEN">Open Intake</option>
                    </select>
                    {user?.role !== 'PROJECT_MANAGER' && (
                        <label className="flex items-center gap-2 ml-2 px-3 py-2 bg-sf-canvas rounded-lg border border-sf-divider cursor-pointer hover:bg-gray-100 transition-colors">
                            <input
                                type="checkbox"
                                checked={showOnlyMyLab}
                                onChange={e => setShowOnlyMyLab(e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-bold text-sf-muted whitespace-nowrap">My Lab Only</span>
                        </label>
                    )}
                </div>
            </div>

            <div className="bg-sf-surface rounded-2xl shadow-xl border border-sf-divider overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-sf-divider">
                                <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-1">
                                        Project
                                        <InfoTooltip text="Unique project identifier and descriptive name. 'Global' indicates accessible across multiple labs." position="bottom" />
                                    </div>
                                </th>
                                <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-1">
                                        Type
                                        <InfoTooltip text="Template: Reusable site configuration. Open Intake: Active data collection project." position="bottom" />
                                    </div>
                                </th>
                                <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-1">
                                        Samples
                                        <InfoTooltip text="Count of samples received vs. the expected target for this project." position="bottom" />
                                    </div>
                                </th>
                                <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-1">
                                        Deadline
                                        <InfoTooltip text="Expected completion date for all sample analyses." position="bottom" />
                                    </div>
                                </th>
                                <th className="p-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {loading && projects.length === 0 ? (
                                <tr><td colSpan="5" className="p-20 text-center text-gray-400 animate-pulse font-medium">Synchronizing resources...</td></tr>
                            ) : filteredProjects.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-20 text-center">
                                        <div className="max-w-xs mx-auto space-y-4">
                                            <div className="w-16 h-16 bg-sf-raised rounded-full flex items-center justify-center mx-auto text-gray-400">
                                                <Database size={32} />
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-sf-text">No matches found</p>
                                                <p className="text-sm text-gray-500">Try adjusting your filters or search keywords.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProjects.map(p => {
                                    const canEdit = isEditable(p);
                                    const isDeleting = deletingIds.includes(p.id);
                                    const isOverdue = p.deliveryDeadline && new Date(p.deliveryDeadline) < new Date() && p.status === 'ACTIVE';

                                    return (
                                        <tr
                                            key={p.id}
                                            onClick={() => setViewingProject(p)}
                                            className={`hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-all cursor-pointer group ${isDeleting ? 'opacity-40 grayscale pointer-events-none' : ''}`}
                                        >
                                            <td className="p-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-2 h-10 rounded-full ${p.status === 'ACTIVE' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' :
                                                        p.status === 'PENDING_MANIFEST' ? 'bg-orange-500 shadow-lg shadow-orange-500/20' :
                                                            p.status === 'PAUSED' ? 'bg-amber-500 shadow-lg shadow-amber-500/20' :
                                                                p.status === 'COMPLETED' ? 'bg-slate-400' : 'bg-gray-300'
                                                        }`} />
                                                    <div>
                                                        <div className="font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                                                            {p.code}
                                                            {!p.labId && <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[9px] uppercase font-black">Global</span>}
                                                        </div>
                                                        <div className="text-sm font-bold text-sf-text mt-0.5">{p.name}</div>
                                                        {/* Show assigned labs for global projects */}
                                                        {!p.labId && (() => {
                                                            const labs = getProjectLabIds(p);
                                                            if (labs.length > 0) {
                                                                return (
                                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                                        {labs.slice(0, 3).map(lid => (
                                                                            <span key={lid} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[8px] font-bold border border-blue-100">{lid}</span>
                                                                        ))}
                                                                        {labs.length > 3 && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[8px] font-bold">+{labs.length - 3} more</span>}
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col gap-1">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase w-fit ${p.projectType === 'KOBO_LINKED' ? 'bg-purple-100 text-purple-700' : p.projectType === 'TEMPLATE_PREDEFINED_IDS' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                                        {p.projectType === 'KOBO_LINKED' ? '📱 Kobo Sync' : p.projectType === 'TEMPLATE_PREDEFINED_IDS' ? 'Template' : 'Open Intake'}
                                                    </span>
                                                    {p.status === 'PENDING_MANIFEST' && (
                                                        <span className="flex items-center gap-1 text-[9px] font-black text-orange-600 uppercase tracking-tighter">
                                                            <Clock size={10} /> Awaiting Manifest (On Hold)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                    <div className="flex justify-between items-end mb-0.5">
                                                        <div className="font-black text-sf-text leading-none">
                                                            {p.receivedCount || 0}
                                                            {p.projectType === 'TEMPLATE_PREDEFINED_IDS' && p.totalCount > 0 && (
                                                                <span className="text-gray-400 font-bold text-xs ml-1.5">/ {p.totalCount}</span>
                                                            )}
                                                        </div>
                                                        {p.projectType === 'TEMPLATE_PREDEFINED_IDS' && p.totalCount > 0 && (
                                                            <div className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                                                                {calculatePercentage(p.receivedCount, p.totalCount)}%
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="w-full bg-sf-raised h-1.5 rounded-full overflow-hidden flex">
                                                        <div
                                                            className={`h-full transition-all duration-500 ${p.status === 'ACTIVE' ? 'bg-blue-500' : 'bg-gray-400'}`}
                                                            style={{ width: `${Math.min(100, calculatePercentage(p.receivedCount, p.totalCount || p.receivedCount))}%` }}
                                                        />
                                                    </div>
                                                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">
                                                        {p.projectType === 'TEMPLATE_PREDEFINED_IDS' ? 'Throughput Progress' : `Total Volume: ${p.receivedCount || 0}`}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className={`flex items-center gap-2 font-bold ${isOverdue ? 'text-red-500' : 'text-sf-muted'}`}>
                                                    {isOverdue ? <AlertTriangle size={14} className="animate-pulse" /> : <Clock size={14} />}
                                                    <span className="text-sm">
                                                        {p.deliveryDeadline ? new Date(p.deliveryDeadline).toLocaleDateString() : '—'}
                                                    </span>
                                                </div>
                                                {isOverdue && <div className="text-[9px] text-red-500 font-black uppercase mt-0.5 tracking-widest animate-pulse">Critical Overdue</div>}
                                            </td>
                                            <td className="p-5 text-center">
                                                <div className="flex justify-center gap-1 opacity-10 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {p.status === 'ACTIVE' ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleStatus(p, 'PAUSED'); }}
                                                            className="p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                            title="Pause Project"
                                                        >
                                                            <Pause size={16} />
                                                        </button>
                                                    ) : p.status === 'PAUSED' ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleStatus(p, 'ACTIVE'); }}
                                                            className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                            title="Resume Project"
                                                        >
                                                            <CheckCircle2 size={16} />
                                                        </button>
                                                    ) : p.status === 'PENDING_MANIFEST' ? (
                                                        <div className="p-2 text-orange-400 opacity-50 cursor-not-allowed" title="Actions disabled until manifest is uploaded">
                                                            <Lock size={16} />
                                                        </div>
                                                    ) : null}

                                                    {/* Archive/Restore Actions */}
                                                    {['ACTIVE', 'PAUSED', 'PENDING_MANIFEST', 'CLOSED'].includes(p.status) && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleArchive(p); }}
                                                            className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 rounded-lg transition-colors"
                                                            title="Archive (Mark as Completed)"
                                                        >
                                                            <Archive size={16} />
                                                        </button>
                                                    )}

                                                    {['COMPLETED', 'DELETED'].includes(p.status) && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRestore(p); }}
                                                            className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                            title="Restore / Re-activate"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'MASTER_USER';
                                                            const isOwnLab = user.role === 'LAB_MANAGER' && p.labId && p.labId === user.labId;
                                                            if (!isAdmin && !isOwnLab) return;
                                                            openModal(p);
                                                        }}
                                                        disabled={!canEdit || p.status === 'DELETED' || (user.role === 'LAB_MANAGER' && (!p.labId || p.labId !== user.labId))}
                                                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                        title={user.role === 'LAB_MANAGER' && (!p.labId || p.labId !== user.labId) ? 'Global projects can only be edited by System Administrators' : 'Edit'}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); viewStats(p); }}
                                                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                                        title="Statistics"
                                                    >
                                                        <BarChart2 size={16} />
                                                    </button>

                                                    {canEdit && p.status !== 'DELETED' && (
                                                        (user.role === 'SUPER_ADMIN' || user.role === 'MASTER_USER') ||
                                                        (user.role === 'LAB_MANAGER' && p.labId && p.labId === user.labId)
                                                    ) ? (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); initiateDelete(p); }}
                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors"
                                                            title="Move to Trash"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    ) : p.status !== 'DELETED' && canEdit ? (
                                                        <div
                                                            className="p-2 text-gray-300 dark:text-gray-600 cursor-not-allowed"
                                                            title="Only System Administrators can delete this project"
                                                        >
                                                            <Trash2 size={16} />
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ProjectDrawer
                project={viewingProject}
                isOpen={!!viewingProject}
                onClose={() => setViewingProject(null)}
                onEdit={() => {
                    setViewingProject(null);
                    openModal(viewingProject);
                }}
                canEdit={
                    (user.role === 'SUPER_ADMIN' || user.role === 'MASTER_USER') ||
                    (user.role === 'LAB_MANAGER' && viewingProject?.labId && viewingProject.labId === user.labId)
                }
                canDelete={
                    (user.role === 'SUPER_ADMIN' || user.role === 'MASTER_USER') ||
                    (user.role === 'LAB_MANAGER' && viewingProject?.labId && viewingProject.labId === user.labId)
                }
                handleArchive={handleArchive}
                handleRestore={handleRestore}
                initiateDelete={initiateDelete}
                onViewSamples={handleViewManifest}
                onOpenLegacyBackfill={(p) => {
                    setViewingProject(null);
                    setBackfillTargetProject(p);
                    setShowLegacyBackfillModal(true);
                }}
            />

            <SampleManifestModal
                isOpen={showSampleModal}
                project={modalProject}
                samples={modalSamples}
                loading={loadingSamples}
                onClose={() => setShowSampleModal(false)}
            />

            <SuccessModal
                isOpen={showSuccessModal}
                message={successMessage}
                onClose={() => setShowSuccessModal(false)}
            />

            <LegacyBackfillModal
                isOpen={showLegacyBackfillModal}
                onClose={() => {
                    setShowLegacyBackfillModal(false);
                    setBackfillTargetProject(null);
                }}
                preselectedProject={backfillTargetProject}
                projects={projects.filter(p => p.status !== 'DELETED')}
            />

            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-sf-surface rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border border-sf-divider animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-red-600 mb-4">
                            <AlertTriangle size={24} />
                            <h3 className="text-lg font-bold">Delete Project?</h3>
                        </div>
                        <p className="text-sf-muted mb-6">
                            Are you sure you want to move <span className="font-bold text-sf-text">{deleteTarget.name}</span> to the trash?
                            Samples from this project will be temporarily unlinked and moved to the <span className="font-bold">Restore Pool</span> until the project is restored or purged.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition font-medium shadow-lg shadow-red-500/20"
                            >
                                Move to Trash
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Modal */}
            {statsProject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-sf-surface rounded-xl shadow-2xl w-full max-w-2xl border border-sf-divider animate-in fade-in zoom-in duration-200 overflow-hidden">
                        <div className="p-6 border-b border-sf-divider flex justify-between items-start">
                            <div>
                                <h2 className="text-2xl font-bold text-sf-text flex items-center gap-2">
                                    <BarChart2 className="text-blue-600" />
                                    {statsProject.name}
                                </h2>
                                <p className="text-sm text-sf-muted mt-1 font-mono">{statsProject.code}</p>
                            </div>
                            <button
                                onClick={() => setStatsProject(null)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-sf-raised p-2 rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8">
                            {statsLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4">
                                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-gray-500">Calculating statistics...</p>
                                </div>
                            ) : (statsData) ? (
                                <div className="space-y-8">

                                    {/* Breakdown Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="h-4 w-1 bg-blue-500 rounded-full" />
                                            <h3 className="text-sm font-bold text-sf-muted uppercase tracking-wider">Lab Workflow Status</h3>
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="bg-sf-canvas/30 p-4 rounded-xl border border-sf-divider transition-hover hover:border-blue-200">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Expected</p>
                                                <p className="text-2xl font-black text-sf-text">{(statsData.expected || 0).toLocaleString()}</p>
                                                <p className="text-[9px] text-gray-400 mt-1 italic leading-tight">(In transit or pending)</p>
                                            </div>
                                            <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-800/30 transition-hover hover:border-purple-200">
                                                <p className="text-[10px] font-bold text-purple-400 dark:text-purple-300 uppercase mb-1">Received</p>
                                                <p className="text-2xl font-black text-purple-900 dark:text-purple-100">{(statsData.received || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-800/30 transition-hover hover:border-amber-200">
                                                <p className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase mb-1">Processing</p>
                                                <p className="text-2xl font-black text-amber-900 dark:text-amber-100">{(statsData.processing || 0).toLocaleString()}</p>
                                            </div>
                                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-800/30 transition-hover hover:border-blue-200">
                                                <p className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase mb-1">Completed</p>
                                                <p className="text-2xl font-black text-blue-900 dark:text-blue-100">{(statsData.completed || 0).toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {statsData.rejected > 0 && (
                                            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                                                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                <span className="text-xs font-bold text-red-600 dark:text-red-400">
                                                    {statsData.rejected} SAMPLES REJECTED/FAILED
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : statsData ? (
                                <div className="text-center py-12 text-gray-500">
                                    <AlertTriangle size={48} className="mx-auto mb-4 text-amber-500 opacity-50" />
                                    <p className="text-lg font-bold">Invalid Statistics Data</p>
                                    <p className="text-sm">The data returned from the server has an unexpected structure.</p>
                                    <p className="text-[10px] mt-4 font-mono">{JSON.stringify(statsData)}</p>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <p>Failed to load statistics.</p>
                                </div>
                            )}
                        </div>
                        <div className="bg-sf-canvas/50 p-4 border-t border-sf-divider flex justify-end">
                            <button
                                onClick={() => setStatsProject(null)}
                                className="px-6 py-2 bg-sf-surface border border-sf-divider rounded-lg text-sf-muted hover:bg-sf-raised transition shadow-sm font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Undo Toast */}
            {deletingIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50">
                    {deletingIds.map(id => (
                        <div key={id} className="bg-gray-900 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 animate-in slide-in-from-bottom duration-300 border border-gray-700">
                            <span className="text-sm">Project deleted & samples reassigned.</span>
                            <button
                                onClick={() => undoDelete(id)}
                                className="text-blue-400 text-sm font-bold hover:text-blue-300 hover:underline"
                            >
                                Undo ({countdowns[id] || 0}s)
                            </button>
                            <button onClick={() => undoDelete(id)} className="ml-2 text-gray-500 hover:text-white transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-sf-surface p-6 rounded-xl shadow-2xl w-full max-w-2xl border border-sf-divider animate-in fade-in zoom-in duration-200 overflow-y-auto max-h-[95vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-sf-text">{editing ? 'Edit Project' : 'New Project'}</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1.5 text-sf-muted uppercase tracking-wide">Project Code *</label>
                                    <input
                                        value={formData.code}
                                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, '-') })}
                                        className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white font-mono"
                                        disabled={!!editing}
                                        required
                                        placeholder="e.g. SOILFER-USA"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Permanent unique identifier</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1.5 text-sf-muted uppercase tracking-wide">Project Name *</label>
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
                                        required
                                        placeholder="Display Name"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1.5 text-sf-muted uppercase tracking-wide">Project Type *</label>
                                    <select
                                        value={formData.projectType}
                                        onChange={e => setFormData({ ...formData, projectType: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
                                        required
                                    >
                                        <option value="OPEN_INTAKE">🚪 Open Intake (Walk-in Samples)</option>
                                        <option value="TEMPLATE_PREDEFINED_IDS">📋 Template (CSV Sample List)</option>
                                        <option value="KOBO_LINKED">📱 Template (Kobo Field Data)</option>
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-1">
                                        {formData.projectType === 'KOBO_LINKED' ? 'Samples synced from KoboToolbox forms' :
                                            formData.projectType === 'TEMPLATE_PREDEFINED_IDS' ? 'Upload CSV/Excel with predefined Sample IDs' :
                                                'Accept any sample during reception'}
                                    </p>
                                </div>

                                {/* TEMPLATE MANIFEST UPLOAD - Show when Template is selected on creation */}
                                {formData.projectType === 'TEMPLATE_PREDEFINED_IDS' && !editing && (
                                    <div className="col-span-2 p-4 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">📋</span>
                                            <h3 className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Upload Sample Manifest</h3>
                                            <InfoTooltip text="Upload a CSV or Excel file with Sample IDs in the first column. The project will be created as Active with these samples pre-registered." />
                                        </div>

                                        <input
                                            type="file"
                                            accept=".csv, .xlsx, .xls"
                                            onChange={(e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = (evt) => {
                                                    try {
                                                        const bstr = evt.target.result;
                                                        const wb = XLSX.read(bstr, { type: 'binary' });
                                                        const ws = wb.Sheets[wb.SheetNames[0]];
                                                        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
                                                        const ids = data
                                                            .map(row => String(row[0] || '').trim())
                                                            .filter(id => id && id !== 'Sample ID' && id !== 'sample_id' && id !== 'SampleID');
                                                        const uniqueIds = [...new Set(ids)];
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            sampleIds: uniqueIds,
                                                            manifestFileName: file.name,
                                                            expectedSampleCount: uniqueIds.length
                                                        }));
                                                    } catch (err) {
                                                        console.error('File parse error:', err);
                                                        showDialog({ title: 'Parse Error', message: 'Failed to parse file. Please ensure it is a valid CSV or Excel file.', type: 'error' });
                                                    }
                                                };
                                                reader.readAsBinaryString(file);
                                            }}
                                            className="hidden"
                                            id="modal-manifest-upload"
                                        />
                                        <label
                                            htmlFor="modal-manifest-upload"
                                            className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-sf-surface text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-[0.98]"
                                        >
                                            {formData.sampleIds.length > 0 ? (
                                                <>
                                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                                    {formData.manifestFileName} — {formData.sampleIds.length} Sample IDs loaded
                                                </>
                                            ) : (
                                                <>
                                                    <Plus size={16} />
                                                    Click to upload CSV / Excel file
                                                </>
                                            )}
                                        </label>

                                        {formData.sampleIds.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                                        ✅ {formData.sampleIds.length} unique Sample IDs ready to register
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData(prev => ({ ...prev, sampleIds: [], manifestFileName: '', expectedSampleCount: 0 }))}
                                                        className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase flex items-center gap-1 transition-colors"
                                                    >
                                                        <X size={10} /> Clear
                                                    </button>
                                                </div>
                                                <div className="max-h-[60px] overflow-y-auto bg-sf-surface rounded-lg border border-emerald-100 dark:border-emerald-800 p-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        {formData.sampleIds.slice(0, 20).map(id => (
                                                            <span key={id} className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[9px] font-mono font-bold">
                                                                {id}
                                                            </span>
                                                        ))}
                                                        {formData.sampleIds.length > 20 && (
                                                            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[9px] font-bold">
                                                                +{formData.sampleIds.length - 20} more
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {formData.sampleIds.length === 0 && (
                                            <p className="text-[10px] text-emerald-500/70 italic">
                                                Optional: Upload now to activate the project immediately, or skip and upload later from the project drawer.
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* KOBO CONFIGURATION SECTION */}
                                {formData.projectType === 'KOBO_LINKED' && (
                                    <div className="col-span-2 p-4 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-200 dark:border-purple-800 space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">📱</span>
                                            <h3 className="text-xs font-black text-purple-700 dark:text-purple-300 uppercase tracking-widest">Kobo Configuration</h3>
                                            <InfoTooltip text="Connect this project to a KoboToolbox form. Samples will be automatically synced from Kobo field submissions." />
                                            {editing && !koboCanEdit && (
                                                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-sf-raised px-2 py-1 rounded-md">
                                                    <Lock size={10} /> Managed by Admin
                                                </span>
                                            )}
                                        </div>
                                        {editing && !koboCanEdit ? (
                                            /* READ-ONLY VIEW for non-admin users */
                                            <div className="grid grid-cols-1 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold mb-1 text-gray-500 uppercase tracking-wide">Server URL</label>
                                                    <div className="w-full px-3 py-2 bg-sf-raised border border-sf-divider rounded-lg text-sm font-mono text-sf-muted">
                                                        {formData.koboServerUrl || '—'}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold mb-1 text-gray-500 uppercase tracking-wide">Form ID</label>
                                                        <div className="w-full px-3 py-2 bg-sf-raised border border-sf-divider rounded-lg text-sm font-mono text-sf-muted">
                                                            {formData.koboFormId || '—'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold mb-1 text-gray-500 uppercase tracking-wide">API Token</label>
                                                        <div className="w-full px-3 py-2 bg-sf-raised border border-sf-divider rounded-lg text-sm font-mono text-sf-muted">
                                                            {formData.koboApiToken || '—'}
                                                        </div>
                                                    </div>
                                                </div>
                                                {koboConfigLoaded && (
                                                    <p className="text-[10px] text-purple-500 italic">Integration is configured and active. Contact an administrator to modify credentials.</p>
                                                )}
                                            </div>
                                        ) : (
                                            /* EDITABLE VIEW for admins and new projects */
                                            <div className="grid grid-cols-1 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold mb-1 text-sf-muted uppercase tracking-wide flex items-center gap-1">
                                                        Server URL
                                                        <InfoTooltip text="The KoboToolbox server URL. Use the default unless your organization hosts a private Kobo instance." />
                                                    </label>
                                                    <input
                                                        value={formData.koboServerUrl}
                                                        onChange={e => { setFormData({ ...formData, koboServerUrl: e.target.value }); setKoboTestStatus(null); }}
                                                        className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all dark:text-white text-sm font-mono"
                                                        placeholder="https://kf.kobotoolbox.org"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-[10px] font-bold mb-1 text-sf-muted uppercase tracking-wide flex items-center gap-1">
                                                            Form ID (Asset UID) *
                                                            <InfoTooltip text="Found in your Kobo form URL: kf.kobotoolbox.org/#/forms/[THIS_ID]. It's a long alphanumeric string like aYU8RNGWtCtwTJh2ph6FdM." />
                                                        </label>
                                                        <input
                                                            value={formData.koboFormId}
                                                            onChange={e => { setFormData({ ...formData, koboFormId: e.target.value.trim() }); setKoboTestStatus(null); }}
                                                            className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all dark:text-white text-sm font-mono"
                                                            placeholder="e.g. aYU8RNGWtCtwTJh2ph6FdM"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] font-bold mb-1 text-sf-muted uppercase tracking-wide flex items-center gap-1">
                                                            API Token *
                                                            <InfoTooltip text="Go to KoboToolbox → Account Settings → Security → API Key. Copy the full token string." />
                                                        </label>
                                                        <input
                                                            type="password"
                                                            value={formData.koboApiToken}
                                                            onChange={e => { setFormData({ ...formData, koboApiToken: e.target.value.trim() }); setKoboTestStatus(null); }}
                                                            className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all dark:text-white text-sm font-mono"
                                                            placeholder={editing && koboConfigLoaded ? 'Leave blank to keep current token' : 'Your Kobo API token'}
                                                            required={!editing || !koboConfigLoaded}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            setKoboTestStatus('testing');
                                                            try {
                                                                const res = await axios.post('/api/kobo/test', {
                                                                    koboServerUrl: formData.koboServerUrl,
                                                                    formId: formData.koboFormId,
                                                                    apiToken: formData.koboApiToken
                                                                });
                                                                if (res.data.success) {
                                                                    setKoboTestStatus('success');
                                                                    setKoboTestMessage(`Connected! Form: ${res.data.formName || res.data.name || 'OK'} (${res.data.submissions || '?'} submissions)`);
                                                                } else {
                                                                    setKoboTestStatus('error');
                                                                    setKoboTestMessage(res.data.error || 'Connection failed');
                                                                }
                                                            } catch (err) {
                                                                setKoboTestStatus('error');
                                                                setKoboTestMessage(err.response?.data?.error || err.message);
                                                            }
                                                        }}
                                                        disabled={!formData.koboFormId || !formData.koboApiToken || koboTestStatus === 'testing'}
                                                        className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                                    >
                                                        {koboTestStatus === 'testing' ? (
                                                            <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Testing...</>
                                                        ) : '🔌 Test Connection'}
                                                    </button>
                                                    {koboTestStatus === 'success' && (
                                                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">✅ {koboTestMessage}</span>
                                                    )}
                                                    {koboTestStatus === 'error' && (
                                                        <span className="text-xs text-red-600 dark:text-red-400 font-bold flex items-center gap-1">❌ {koboTestMessage}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-xs font-bold mb-1.5 text-sf-muted uppercase tracking-wide">Expected Samples</label>
                                    <input
                                        type="number"
                                        value={formData.expectedSampleCount}
                                        onChange={e => setFormData({ ...formData, expectedSampleCount: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1.5 text-sf-muted uppercase tracking-wide">Delivery Deadline</label>
                                    <input
                                        type="date"
                                        value={formData.deliveryDeadline}
                                        onChange={e => setFormData({ ...formData, deliveryDeadline: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">Internal turnaround goal</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1.5 text-sf-muted uppercase tracking-wide">Priority</label>
                                    <select
                                        value={formData.priority}
                                        onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
                                    >
                                        <option value="LOW">Low</option>
                                        <option value="NORMAL">Normal</option>
                                        <option value="HIGH">High</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <select
                                        value={formData.defaultAnalysisBundle}
                                        onChange={e => setFormData({ ...formData, defaultAnalysisBundle: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
                                    >
                                        <option value="">-- No Default Bundle --</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-gray-500 mt-1">Applied automatically during intake</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1.5 text-sf-muted uppercase tracking-wide">Status</label>
                                    <select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
                                    >
                                        <option value="ACTIVE">Active</option>
                                        <option value="PAUSED">Paused</option>
                                        <option value="CLOSED">Closed</option>
                                    </select>
                                </div>
                            </div>

                            {(user.role === 'SUPER_ADMIN' || user.role === 'MASTER_USER') && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold mb-1.5 text-sf-muted uppercase tracking-wide text-blue-600 dark:text-blue-400">Ownership: Main Lab</label>
                                        <select
                                            value={formData.labId || ''}
                                            onChange={e => setFormData({ ...formData, labId: e.target.value })}
                                            className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white"
                                        >
                                            <option value="">Global Project (Managed by Super Admin)</option>
                                            {labs.map(lab => (
                                                <option key={lab.id} value={lab.id}>{lab.name} ({lab.id})</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-gray-400 mt-1 italic">Selecting a lab here makes it a local project for that lab.</p>
                                    </div>

                                    {!formData.labId && (
                                        <div className="p-4 bg-blue-50/30 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800">
                                            <label className="block text-[10px] font-black mb-3 text-blue-700 dark:text-blue-300 uppercase tracking-widest flex items-center gap-1">
                                                Multi-Lab Access Control
                                                <InfoTooltip text="Selected laboratories will have access to this project and its manifests. Lab managers of assigned labs will see this in their queues." />
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar">
                                                {labs.map(lab => (
                                                    <label key={lab.id} className="flex items-center gap-2 p-2 rounded-lg bg-sf-surface border border-sf-divider cursor-pointer hover:border-blue-300 transition-colors group">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.assignedLabIds.includes(lab.id)}
                                                            onChange={e => {
                                                                const updated = e.target.checked
                                                                    ? [...formData.assignedLabIds, lab.id]
                                                                    : formData.assignedLabIds.filter(id => id !== lab.id);
                                                                setFormData({ ...formData, assignedLabIds: updated });
                                                            }}
                                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300 transition-all cursor-pointer"
                                                        />
                                                        <span className="text-[11px] font-bold text-sf-muted truncate group-hover:text-blue-600 transition-colors">
                                                            {lab.id}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                            {formData.assignedLabIds.length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-800 flex flex-wrap gap-1.5">
                                                    {formData.assignedLabIds.map(id => (
                                                        <span key={id} className="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-black uppercase tracking-tighter shadow-sm">
                                                            {id}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {formData.assignedLabIds.length === 0 && (
                                                <p className="text-[10px] text-blue-500/60 font-medium italic mt-2">No labs assigned. This project will only be visible to Super Admins.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold mb-1.5 text-sf-muted uppercase tracking-wide">Lab Instructions / Notes</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 bg-sf-surface border border-sf-divider rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all dark:text-white min-h-[100px]"
                                    placeholder="Specific protocols, handling notes..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-sf-divider">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-sf-muted hover:bg-sf-raised rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                    disabled={!formData.code || !formData.name}
                                >
                                    Save Project
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Projects;
