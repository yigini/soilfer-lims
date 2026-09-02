import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, CheckCircle, AlertTriangle, FileText, Upload, UserPlus, XCircle, Download, ShieldAlert, HelpCircle } from 'lucide-react';
import SpectraViewer from '../SpectraViewer';
import SpectraBatchUpload from '../SpectraBatchUpload';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../context/DialogContext';
import InfoTooltip from '../common/InfoTooltip';
import { getAnalysisDisplayName } from '../../utils/analysisNames';

const WorkItemsTable = ({ workItems, onUpdateStatus, loading, isGateOpen, onAssignmentSuccess, onReview, onReviewBulk }) => {
    const { user } = useAuth();
    const { showDialog } = useDialog();
    const isTech = user.role === 'LAB_TECHNICIAN';
    const isManager = ['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role);

    const [technicians, setTechnicians] = useState([]);
    const [assigning, setAssigning] = useState(null); // ID of item being assigned
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadItem, setUploadItem] = useState(null);

    // Fetch technicians for assignment dropdown
    useEffect(() => {
        if (isManager) {
            axios.get('/api/users/directory')
                .then(res => {
                    const allUsers = Array.isArray(res.data) ? res.data : (res.data.data || []);
                    setTechnicians(allUsers.filter(u => u.role === 'LAB_TECHNICIAN'));
                })
                .catch(err => console.error('Failed to fetch technicians', err));
        }
    }, [isManager]);

    const handleAssign = async (itemId, techUsername) => {
        if (!techUsername) return;
        try {
            setAssigning(itemId);
            const res = await axios.post(`/api/work/${itemId}/assign`, { technicianUserId: techUsername });

            showDialog({
                type: 'success',
                title: 'Assignment Successful',
                message: `Task assigned to ${techUsername}.`
            });

            if (onAssignmentSuccess) onAssignmentSuccess();
        } catch (e) {
            showDialog({
                type: 'error',
                title: 'Assignment Failed',
                message: e.response?.data?.error || e.message
            });
        } finally {
            setAssigning(null);
        }
    };

    // Local state for inputs to avoid jumping
    const [inputs, setInputs] = useState({});

    const handleInputChange = (id, val) => {
        setInputs(prev => ({ ...prev, [id]: val }));
    };



    const getDisplayValue = (item) => {
        if (inputs[item.id] !== undefined) return inputs[item.id];
        if (item.result && typeof item.result === 'object') return item.result.value;
        return item.result || '';
    };

    // --- BATCH ASSIGNMENT LOGIC ---
    const [selection, setSelection] = useState([]);
    const [selectedTech, setSelectedTech] = useState('');

    // Workflow Calculations
    const nonPostAnalyses = workItems.filter(w => w.category !== 'Post-Analytical');
    const isDryingComplete = workItems.some(w => w.analysis === 'DRYING' && ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(w.status));
    const isPrepComplete = workItems.some(w => w.analysis === 'PREPARATION' && ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(w.status));
    // Approved if: Gates are Done/Accepted AND all other analyses are Accepted/Waived
    const allAnalysesApproved = nonPostAnalyses.length > 0 && nonPostAnalyses.every(w => {
        if (w.category === 'Operational Gates') return ['COMPLETED', 'ACCEPTED', 'SUBMITTED'].includes(w.status);
        return ['ACCEPTED', 'WAIVED'].includes(w.status);
    });

    const toggleSelectAll = (e) => {
        if (e.target.checked) setSelection(workItems.map(i => i.id));
        else setSelection([]);
    };

    const toggleSelect = (id) => {
        if (selection.includes(id)) setSelection(s => s.filter(x => x !== id));
        else setSelection(s => [...s, id]);
    };

    const handleBulkAssign = async () => {
        if (!selectedTech || selection.length === 0) return;
        try {
            const res = await axios.post('/api/work/assign', {
                workItemIds: selection,
                assignee: selectedTech
            });

            // Specific message for post-analytical
            let msg = `Assigned ${selection.length} items to ${selectedTech}.`;
            if (selection.length === 1) {
                const item = workItems.find(i => i.id === selection[0]);
                if (item?.analysis === 'ARCHIVING') msg = `Archiving task assigned to ${selectedTech}.`;
                if (item?.analysis === 'DISPOSAL') msg = `Disposal task assigned to ${selectedTech}.`;
            }

            showDialog({
                type: 'success',
                title: 'Bulk Assignment Successful',
                message: msg
            });

            setSelection([]);
            if (onAssignmentSuccess) onAssignmentSuccess();
        } catch (e) {
            showDialog({
                type: 'error',
                title: 'Bulk Assignment Failed',
                message: e.response?.data?.error || e.message
            });
        }
    };

    // --- NEW STATE ---
    const [showMyAssignedOnly, setShowMyAssignedOnly] = useState(isTech);
    const [collapsedCategories, setCollapsedCategories] = useState({});

    // SPECTRA VIEWER STATE
    const [selectedScan, setSelectedScan] = useState(null);
    const [viewerLoading, setViewerLoading] = useState(false);

    const handleViewSpectra = async (item) => {
        setViewerLoading(true);
        try {
            // Map Analysis to Modality
            let modality = 'NIR'; // Default
            if (item.analysis === 'SPEC_MIR' || item.analysis === 'MIR Soil Spectra') {
                modality = 'MIR';
            }

            // 1. Find the scan for this sample by LAB ID (not internal sampleId)
            // The work item has labId which matches what was used in the CSV upload
            const searchTerm = item.labId || item.sampleId; // Prefer labId, fallback to sampleId

            console.log('[ViewSpectra] Searching for:', searchTerm, 'modality:', modality);

            const searchRes = await axios.get('/api/spectral', {
                params: { search: searchTerm, modality }
            });

            const scans = searchRes.data.data;
            console.log('[ViewSpectra] Found scans:', scans?.length || 0);

            if (!scans || scans.length === 0) {
                showDialog({ title: 'No Data', message: `No spectral data found for Lab ID: ${searchTerm} (${modality}). Please upload spectral data first.`, type: 'info' });
                return;
            }

            // Take the most recent one
            const scanSummary = scans[0];

            // 2. Fetch full details (chart data)
            const detailRes = await axios.get(`/api/spectral/${scanSummary.id}`);

            // Transform for Chart
            const chartData = detailRes.data.wavelengths.map((w, i) => ({
                wavelength: w,
                absorbance: detailRes.data.values ? detailRes.data.values[i] : 0
            }));

            setSelectedScan({ ...detailRes.data, chartData });

        } catch (e) {
            console.error(e);
            showDialog({ title: 'Load Failed', message: 'Failed to load spectral data: ' + e.message, type: 'error' });
        } finally {
            setViewerLoading(false);
        }
    };

    // Toggle Category
    const toggleCategory = (cat) => {
        setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    // Filter Items
    const filteredWorkItems = workItems.filter(item => {
        if (!showMyAssignedOnly) return true;
        // If "My Assigned", show items assigned to me OR not assigned (grabable) if needed? 
        // User request: "Table should filter to 'My assigned analyses' by default"
        // Also show unassigned? Usually yes if open allocation, but strict "My Assigned" implies only mine.
        // Let's stick to "My Assigned".
        return item.assignedTo === user.username;
    });

    // Re-Group based on FILTERED items
    const grouped = filteredWorkItems.reduce((acc, item) => {
        const cat = item.category || 'Analysis';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {});

    const orderedCategories = Object.keys(grouped).sort((a, b) => {
        if (a === 'Operational Gates') return -1;
        if (b === 'Operational Gates') return 1;
        return a.localeCompare(b);
    });

    const handleDownload = () => {
        if (!selectedScan) return;

        const headers = ["Wavelength,Absorbance"];
        const rows = selectedScan.wavelengths.map((w, i) =>
            `${w},${selectedScan.values ? selectedScan.values[i] : 0}`
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${selectedScan.labId}_${selectedScan.modality}_${selectedScan.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 relative flex flex-col h-full">

            {/* Toolbar / Filters */}
            <div className="p-3 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider">
                        Analytical Results ({filteredWorkItems.length})
                    </h3>

                    {/* Technician Filter Toggle */}
                    {isTech && (
                        <button
                            onClick={() => setShowMyAssignedOnly(!showMyAssignedOnly)}
                            className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${showMyAssignedOnly
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm'
                                : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                                }`}
                        >
                            {showMyAssignedOnly ? 'Showing: My Assignments' : 'Showing: All'}
                        </button>
                    )}
                </div>

                {isGateOpen === false && <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded">Results Locked</span>}
            </div>

            {/* BULK ACTIONS BAR (Sticky) */}
            {selection.length > 0 && isManager && (
                <div className="sticky top-0 left-0 right-0 bg-blue-50 dark:bg-blue-900/40 p-2 z-20 flex items-center gap-4 px-4 border-b border-blue-100 dark:border-blue-800 animate-in slide-in-from-top-2 shadow-md">
                    <span className="font-bold text-sm text-blue-800 dark:text-blue-200">{selection.length} Selected</span>

                    <div className="flex items-center gap-2 ml-auto">
                        <select
                            value={selectedTech}
                            onChange={e => setSelectedTech(e.target.value)}
                            className="text-xs p-1.5 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-800 shadow-sm"
                        >
                            <option value="">Assign to...</option>
                            {technicians.map(t => <option key={t.id} value={t.username}>{t.name}</option>)}
                        </select>
                        <button
                            onClick={handleBulkAssign}
                            disabled={!selectedTech}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded disabled:opacity-50 transition-colors shadow-sm"
                        >
                            Assign Selected
                        </button>
                        <button
                            onClick={() => setSelection([])}
                            className="text-gray-500 hover:text-gray-700 text-xs font-medium px-2"
                        >
                            Cancel
                        </button>
                        <div className="w-px h-4 bg-gray-300 mx-2"></div>
                        <button
                            onClick={async () => {
                                if (!confirm(`Approve ${selection.length} items?`)) return;
                                if (onReviewBulk) {
                                    await onReviewBulk(selection, 'ACCEPTED');
                                } else {
                                    for (const id of selection) {
                                        await onReview(id, 'ACCEPTED');
                                    }
                                }
                                setSelection([]);
                            }}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-sm"
                        >
                            Approve Selected
                        </button>
                    </div>
                </div>
            )}

            <div className="overflow-auto max-h-[70vh]"> {/* Scrollable Container */}
                <table className="w-full text-left border-collapse relative min-w-[800px]">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                        <tr>
                            {isManager && (
                                <th className="px-4 py-3 w-8 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                                    <input
                                        type="checkbox"
                                        onChange={toggleSelectAll}
                                        checked={workItems.length > 0 && selection.length === workItems.length}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                </th>
                            )}
                            <th className="px-4 py-3 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 w-1/4">
                                <div className="flex items-center gap-1">
                                    Analysis
                                    <InfoTooltip text="Technical test or operational task required for this sample." position="bottom" />
                                </div>
                            </th>
                            <th className="px-4 py-3 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 w-24">
                                <div className="flex items-center gap-1">
                                    Method
                                    <InfoTooltip text="Standard Operating Procedure (SOP) or analytical method used." position="bottom" />
                                </div>
                            </th>
                            <th className="px-4 py-3 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 w-32">
                                <div className="flex items-center gap-1">
                                    Assigned To
                                    <InfoTooltip text="The laboratory technician responsible for performing this test." position="bottom" />
                                </div>
                            </th>
                            <th className="px-4 py-3 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 w-24">
                                <div className="flex items-center gap-1">
                                    Status
                                    <InfoTooltip text="Current progress of the task. Managers must approve 'Submitted' results." position="bottom" />
                                </div>
                            </th>
                            <th className="px-4 py-3 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 w-40">
                                <div className="flex items-center gap-1">
                                    Result
                                    <InfoTooltip text="Quantitative or qualitative output of the analysis." position="bottom" />
                                </div>
                            </th>
                            <th className="px-4 py-3 border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hidden md:table-cell w-32">
                                <div className="flex items-center gap-1">
                                    Updated
                                    <InfoTooltip text="Timestamp of the most recent change to this task." position="bottom" />
                                </div>
                            </th>
                            <th className="px-4 py-3 text-right border-b dark:border-gray-600 bg-gray-50 dark:bg-gray-700 w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {orderedCategories.map(category => (
                            <React.Fragment key={category}>
                                {/* Category Header (Collapsible) */}
                                <tr
                                    className="bg-gray-100 dark:bg-gray-800 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                                    onClick={() => toggleCategory(category)}
                                >
                                    <td colSpan={isManager ? 8 : 7} className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                                        <div className="transform transition-transform duration-200">
                                            {collapsedCategories[category] ? '▶' : '▼'}
                                        </div>
                                        {category} ({grouped[category].length})
                                    </td>
                                </tr>

                                {!collapsedCategories[category] && grouped[category].map(item => {
                                    const isAssignedToMe = item.assignedTo === user.username;
                                    const isCompleted = item.status === 'COMPLETED';
                                    const isAccepted = item.status === 'ACCEPTED';
                                    const isSealed = ['SUBMITTED', 'ACCEPTED', 'WAIVED'].includes(item.status);

                                    // STRICT: Only Technician assigned can edit. Managers assign only.
                                    const canEdit = (isTech && isAssignedToMe && !isSealed);

                                    const isOpsGate = item.category === 'Operational Gates';
                                    const isPostAnalytical = item.category === 'Post-Analytical';

                                    // Workflow Dependencies
                                    let isBlockedByWorkflow = false;
                                    let lockReason = "";

                                    if (item.analysis === 'PREPARATION') {
                                        if (!isDryingComplete) {
                                            isBlockedByWorkflow = true;
                                            lockReason = "Requires Drying Complete";
                                        }
                                    } else if (!isOpsGate && !isPostAnalytical) {
                                        // General Analysis
                                        if (!isPrepComplete) {
                                            isBlockedByWorkflow = true;
                                            lockReason = "Requires Preparation Complete";
                                        }
                                    } else if (isPostAnalytical) {
                                        if (!allAnalysesApproved) {
                                            isBlockedByWorkflow = true;
                                            lockReason = "Final Approval Required";
                                        }
                                    }

                                    const effectiveBlocked = isBlockedByWorkflow && !isSealed && !isCompleted && !item.result;

                                    return (
                                        <tr key={item.id} className="hover:bg-blue-50/30 dark:hover:bg-gray-800/50 transition-colors group">
                                            {isManager && (
                                                <td className="px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                                                    <input
                                                        type="checkbox"
                                                        checked={selection.includes(item.id)}
                                                        onChange={() => toggleSelect(item.id)}
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    />
                                                </td>
                                            )}
                                            <td className="px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                                                <div className="font-bold text-xs text-gray-900 dark:text-gray-100">
                                                    {item.analysisName || getAnalysisDisplayName(item.analysis)}
                                                </div>
                                                <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5 mt-0.5">
                                                    <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700/80 rounded text-gray-600 dark:text-gray-300 font-semibold">{item.analysis}</span>
                                                    <span>• TASK: {String(item.id).split('-').pop()}</span>
                                                </div>
                                                {effectiveBlocked && (
                                                    <div className="text-[9px] text-amber-600 font-bold mt-1 uppercase flex items-center gap-1">
                                                        <ShieldAlert size={10} /> {lockReason}
                                                    </div>
                                                )}
                                                {item.reanalysisReason && (
                                                    <div className="text-xs text-red-500 mt-1 flex items-center gap-1 font-bold">
                                                        <AlertTriangle size={10} /> Redo: {item.reanalysisReason}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 font-mono text-xs border-b border-gray-50 dark:border-gray-800">
                                                {item.method || 'STD'}
                                            </td>
                                            <td className="px-4 py-3 text-sm border-b border-gray-50 dark:border-gray-800">
                                                {isManager ? (
                                                    <div className="relative flex items-center gap-2">
                                                        <select
                                                            title={effectiveBlocked ? lockReason : "Assign Technician"}
                                                            className={`bg-transparent border-none text-xs text-gray-700 dark:text-gray-300 focus:ring-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 -ml-1 w-full ${effectiveBlocked ? 'opacity-50 cursor-not-allowed' : ''} ${assigning === item.id ? 'opacity-30' : ''}`}
                                                            value={item.assignedTo || ''}
                                                            onChange={(e) => handleAssign(item.id, e.target.value)}
                                                            disabled={['COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(item.status) || effectiveBlocked || assigning === item.id || (
                                                                // DISABLE if mutual exclusion task is already assigned
                                                                (item.analysis === 'ARCHIVING' && workItems.some(wi => wi.analysis === 'DISPOSAL' && wi.assignedTo)) ||
                                                                (item.analysis === 'DISPOSAL' && workItems.some(wi => wi.analysis === 'ARCHIVING' && wi.assignedTo))
                                                            )}
                                                        >
                                                            <option value="">Unassigned</option>
                                                            {technicians.map(t => (
                                                                <option key={t.id} value={t.username}>{t.name}</option>
                                                            ))}
                                                        </select>
                                                        {assigning === item.id && <div className="absolute right-0 w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />}
                                                    </div>
                                                ) : (
                                                    <span className={`text-xs ${!item.assignedTo ? 'text-red-400 italic' : 'text-gray-600'}`}>
                                                        {item.assignedTo ? technicians.find(t => t.username === item.assignedTo)?.name || item.assignedTo : 'Unassigned'}
                                                    </span>
                                                )}
                                                {isManager && item.status === 'NOT_ASSIGNED' && !isSealed && (
                                                    <div className="text-[9px] text-orange-600 font-bold uppercase mt-1 animate-pulse">
                                                        Please assign a tech
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                                                <span
                                                    id={`wi-row-${item.analysis}`}
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border shadow-sm ${item.status === 'COMPLETED' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        item.status === 'ACCEPTED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                            item.status === 'IN_PROGRESS' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                                item.status === 'SUBMITTED' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                                    item.status === 'REANALYSIS_REQUIRED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                                        item.status === 'NOT_ASSIGNED' ? 'bg-pink-50 text-pink-700 border-pink-200 animate-pulse' :
                                                                            item.status === 'ASSIGNED' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                                                'bg-gray-50 text-gray-500 border-gray-200'
                                                        }`}>
                                                    {item.status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 border-b border-gray-50 dark:border-gray-800">
                                                {/* CUSTOM: Spectral Handling (Decoupled from generic canEdit) */}
                                                {['SPEC_VIS_NIR', 'SPEC_MIR', 'Vis-NIR Soil Spectra', 'MIR Soil Spectra'].includes(item.analysis) ? (
                                                    <div className="relative">
                                                        {/* VIEW BUTTON (Visible if data exists, regardless of permissions) */}
                                                        {['COMPLETED', 'SUBMITTED', 'ACCEPTED'].includes(item.status) && (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleViewSpectra(item)}
                                                                    className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border transition-colors bg-green-50 text-green-700 border-green-200 hover:bg-green-100`}
                                                                >
                                                                    <FileText size={12} /> View in Library
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* UPLOAD BUTTON (Visible only if editable and needed) */}
                                                        {canEdit && ['ASSIGNED', 'PENDING', 'IN_PROGRESS', 'REANALYSIS_REQUIRED'].includes(item.status) && (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setUploadItem(item);
                                                                        setShowUploadModal(true);
                                                                    }}
                                                                    className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded border transition-colors bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100`}
                                                                >
                                                                    <Upload size={12} /> Upload Spectrum
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* If not editable and not finalized (e.g. assigned to someone else pending upload) */}
                                                        {!canEdit && ['ASSIGNED', 'PENDING', 'IN_PROGRESS', 'REANALYSIS_REQUIRED'].includes(item.status) && (
                                                            <span className="font-mono text-sm font-bold text-gray-400 italic">
                                                                Pending Upload
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    /* STANDARD INPUTS (Requires canEdit) */
                                                    canEdit ? (
                                                        <div className="relative">
                                                            {isOpsGate ? (
                                                                isManager && !item.assignedTo ? (
                                                                    <div className="text-[9px] text-orange-600 font-bold uppercase">Please assign a tech</div>
                                                                ) : (
                                                                    <div className="text-xs text-gray-400 italic">Toggle Status →</div>
                                                                )
                                                            ) : (
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="text"
                                                                            disabled={effectiveBlocked || loading}
                                                                            value={getDisplayValue(item)}
                                                                            onChange={(e) => handleInputChange(item.id, e.target.value)}
                                                                            placeholder={item.analysis === 'ARCHIVING' ? "Shelf X, Drawer Y..." : (effectiveBlocked ? "Locked" : "-")}
                                                                            className={`
                                                                            flex-1 bg-gray-50 dark:bg-gray-900 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-gray-800 rounded px-2 py-1 text-sm font-mono transition-colors
                                                                            ${effectiveBlocked ? 'cursor-not-allowed opacity-50' : ''}
                                                                            ${item.analysis === 'ARCHIVING' ? 'border-amber-200' : ''}
                                                                        `}
                                                                        />
                                                                        {item.unit && (
                                                                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium whitespace-nowrap">{item.unit}</span>
                                                                        )}
                                                                    </div>

                                                                    {item.analysis === 'ARCHIVING' && (
                                                                        <span className="text-[10px] text-amber-600 font-bold uppercase tracking-tighter">Archive Address</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {item.status === 'IN_PROGRESS' && !isOpsGate && (
                                                                <button
                                                                    onClick={() => onUpdateStatus(item.id, 'COMPLETED', getDisplayValue(item))}
                                                                    className="absolute right-1 top-1.5 text-gray-300 hover:text-green-600 transition-colors"
                                                                    title="Save & Complete"
                                                                >
                                                                    <CheckCircle size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-sm font-bold text-gray-700 dark:text-gray-300">
                                                                {item.result ? (typeof item.result === 'object' ? item.result.value : item.result) : '-'}
                                                                {item.unit && item.result && <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal ml-1">{item.unit}</span>}
                                                            </span>
                                                            {isManager && !item.assignedTo && !isSealed && (
                                                                <span className="text-[9px] text-orange-600 font-bold uppercase mt-1">
                                                                    Please assign a tech
                                                                </span>
                                                            )}
                                                        </div>
                                                    )
                                                )}
                                            </td>
                                            <td className="px-4 py-3 border-b border-gray-50 dark:border-gray-800 hidden md:table-cell">
                                                {Array.isArray(item.history) && item.history.length > 0 ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-gray-500">
                                                            {(() => {
                                                                const d = new Date(item.history[item.history.length - 1].timestamp);
                                                                return isNaN(d.getTime()) ? 'Not recorded' : d.toLocaleDateString();
                                                            })()}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">{item.history[item.history.length - 1].changedBy}</span>
                                                    </div>
                                                ) : <span className="text-[10px] text-gray-300">-</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right border-b border-gray-50 dark:border-gray-800">
                                                {canEdit && !effectiveBlocked && !isCompleted && !isSealed && (
                                                    <button
                                                        onClick={() => {
                                                            if (isOpsGate) onUpdateStatus(item.id, 'COMPLETED', 'Done');
                                                            else onUpdateStatus(item.id, 'IN_PROGRESS');
                                                        }}
                                                        className="text-white bg-blue-600 hover:bg-blue-700 text-xs font-bold px-3 py-1 rounded shadow-sm transition-transform active:scale-95"
                                                    >
                                                        {isOpsGate ? 'Mark Done' : 'Start'}
                                                    </button>
                                                )}
                                                {/* MANAGER APPROVAL ACTIONS */}
                                                {isManager && (['SUBMITTED', 'COMPLETED', 'REANALYSIS_REQUIRED', 'ASSIGNED', 'IN_PROGRESS'].includes(item.status)) && (
                                                    <div className="flex items-center gap-1 justify-end">
                                                        {(() => {
                                                            const isGate = item.category === 'Operational Gates';
                                                            const hasResult = !!item.result || (isGate && ((Array.isArray(item.history) && item.history.some(h => h.action === 'COMPLETED')) || item.status === 'COMPLETED'));
                                                            const isReadyForReview = item.status === 'SUBMITTED' || (isGate && item.status === 'COMPLETED') || (isManager && hasResult);
                                                            const disabledClass = !isReadyForReview ? "text-gray-300 cursor-not-allowed" : "";

                                                            const reasonTitle = isReadyForReview
                                                                ? "Approve"
                                                                : (isGate ? "Gate not completed" : "No results recorded yet");

                                                            return (
                                                                <>
                                                                    <button
                                                                        onClick={() => isReadyForReview && onReview && onReview(item.id, 'ACCEPTED')}
                                                                        title={reasonTitle}
                                                                        className={`p-1 rounded border border-transparent ${isReadyForReview ? 'text-green-600 hover:bg-green-50 hover:border-green-200' : disabledClass}`}
                                                                        disabled={!isReadyForReview}
                                                                    >
                                                                        <CheckCircle size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            if (!isReadyForReview) return;
                                                                            const reason = prompt("Reason for rejection?");
                                                                            if (reason) onReview && onReview(item.id, 'REANALYSIS_REQUIRED', reason);
                                                                        }}
                                                                        title={isReadyForReview ? "Reject (Request Reanalysis)" : reasonTitle}
                                                                        className={`p-1 rounded border border-transparent ${isReadyForReview ? 'text-red-600 hover:bg-red-50 hover:border-red-200' : disabledClass}`}
                                                                        disabled={!isReadyForReview}
                                                                    >
                                                                        <AlertTriangle size={16} />
                                                                    </button>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                        {filteredWorkItems.length === 0 && (
                            <tr><td colSpan={isManager ? 8 : 7} className="text-center py-12 text-gray-400">
                                <FileText size={48} className="mx-auto mb-2 opacity-20" />
                                No work items {showMyAssignedOnly ? 'assigned to you' : 'found'}.
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>


            {/* VIEWER MODAL */}
            {
                selectedScan && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col">
                            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50 rounded-t-xl">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">
                                        {selectedScan.labId} <span className="text-gray-400 dark:text-gray-500">|</span> {selectedScan.modality}
                                    </h2>
                                    <p className="text-xs text-gray-500">{selectedScan.id}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleDownload} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-blue-600 dark:text-blue-400" title="Download CSV">
                                        <Download size={20} />
                                    </button>
                                    <button onClick={() => setSelectedScan(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                                        <XCircle size={24} className="text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 flex overflow-hidden">
                                {/* Chart Area */}
                                <div className="flex-1 p-6 overflow-hidden flex flex-col">
                                    <SpectraViewer data={selectedScan} />
                                </div>

                                {/* Sidebar Info */}
                                <div className="w-80 border-l dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 p-6 overflow-y-auto">
                                    <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
                                        <FileText size={16} /> Metadata
                                    </h3>
                                    <div className="space-y-4 text-sm">
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase">Instrument</label>
                                            <div className="font-medium">{selectedScan.metadata.instrument}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase">Scan Date</label>
                                            <div className="font-medium">{new Date(selectedScan.metadata.scanDate).toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase">Operator</label>
                                            <div className="font-medium">{selectedScan.metadata.operator}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase">Filename</label>
                                            <div className="break-all text-xs text-gray-600">{selectedScan.metadata.filename}</div>
                                        </div>

                                        <hr className="border-gray-200 dark:border-gray-600" />

                                        <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
                                            <CheckCircle size={16} /> QC Report
                                        </h3>
                                        <div className={`p-3 rounded-lg border ${selectedScan.qcStatus === 'PASS' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
                                            <div className="font-bold mb-1">Status: {selectedScan.qcStatus}</div>
                                            {selectedScan.qcFlags && selectedScan.qcFlags.length > 0 ? (
                                                <ul className="list-disc pl-4 text-xs">
                                                    {selectedScan.qcFlags.map(f => <li key={f}>{f}</li>)}
                                                </ul>
                                            ) : (
                                                <div className="text-xs opacity-75">No flags detected.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Spectra Batch Upload Modal (Reused for Single Item Upload) */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden">
                        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/50">
                            <h3 className="font-bold text-lg">Upload Spectrum for {uploadItem?.labId}</h3>
                            <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle size={24} />
                            </button>
                        </div>
                        <SpectraBatchUpload
                            currentSampleLabId={uploadItem?.labId}
                            currentSampleId={uploadItem?.sampleId}
                            onClose={() => setShowUploadModal(false)}
                            onUploadSuccess={() => {
                                setShowUploadModal(false);
                                // Trigger refresh via assignment callback (which refetches data)
                                if (onAssignmentSuccess) onAssignmentSuccess();
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkItemsTable;
