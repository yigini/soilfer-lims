import React, { useState } from 'react';
import { Send, ShieldCheck, Check, X, AlertOctagon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getAnalysisDisplayName } from '../../utils/analysisNames';

const SubmissionPanel = ({ submissions, workItems, onCreateSubmission, onReviewSubmission, onReviewItem }) => {
    const { user } = useAuth();
    const isTech = user.role === 'LAB_TECHNICIAN';
    const isManager = ['LAB_MANAGER', 'SUPER_ADMIN'].includes(user.role);

    const [selectedItems, setSelectedItems] = useState([]);

    // Filter eligible items for submission (Exclude Operational Gates)
    const eligibleItems = workItems.filter(w => w.status === 'COMPLETED' && w.category !== 'Operational Gates');

    const handleToggle = (id) => {
        if (selectedItems.includes(id)) setSelectedItems(selectedItems.filter(i => i !== id));
        else setSelectedItems([...selectedItems, id]);
    };

    const pendingReview = submissions.filter(s => s.status === 'PENDING_REVIEW');

    return (
        <div className="space-y-6">

            {/* TECHNICIAN: Create Submission */}
            {isTech && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        <Send size={18} className="text-indigo-600" /> Submit Results for Approval
                    </h3>

                    {eligibleItems.length > 0 ? (
                        <>
                            <div className="mb-4">
                                <label className="block text-xs font-bold uppercase text-gray-500 mb-2">Select Completed Items to Submit</label>
                                <div className="flex flex-wrap gap-2">
                                    {eligibleItems.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleToggle(item.id)}
                                            className={`px-3 py-1 rounded text-xs border font-bold transition-colors ${selectedItems.includes(item.id)
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
                                                }`}
                                        >
                                            {item.analysisName || getAnalysisDisplayName(item.analysis)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button
                                    onClick={async () => {
                                        await onCreateSubmission('PARTIAL', selectedItems);
                                        setSelectedItems([]);
                                    }}
                                    disabled={selectedItems.length === 0}
                                    className="btn-primary px-4 py-2 bg-indigo-600 text-white rounded font-bold text-sm disabled:opacity-50"
                                >
                                    Submit Selected
                                </button>
                                <button
                                    onClick={async () => {
                                        await onCreateSubmission('FULL', eligibleItems.map(i => i.id));
                                        setSelectedItems([]);
                                    }}
                                    className="btn-secondary px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded font-bold text-sm hover:bg-indigo-50"
                                >
                                    Submit All Eligible (Full)
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-sm text-gray-500 italic">
                            No completed items available for submission.
                        </div>
                    )}
                </div>
            )}

            {/* MANAGER: Review Panel */}
            {isManager && pendingReview.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-xl border border-purple-100 dark:border-purple-800">
                    <h3 className="font-bold text-purple-900 dark:text-purple-100 mb-4 flex items-center gap-2">
                        <ShieldCheck size={18} /> Pending Reviews
                    </h3>
                    <div className="space-y-4">
                        {pendingReview.map(sub => (
                            <div key={sub.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-purple-100 dark:border-purple-700">
                                <div className="flex justify-between items-center mb-3">
                                    <div>
                                        <span className="font-bold text-sm">{sub.type} Submission</span>
                                        <span className="text-xs text-gray-500 ml-2">by {sub.submittedBy}</span>
                                    </div>
                                    <span className="text-xs font-mono text-gray-400">{new Date(sub.submittedAt).toLocaleDateString()}</span>
                                </div>

                                <div className="space-y-1 mb-4">
                                    {sub.itemsDetails && sub.itemsDetails.map(item => (
                                        <div key={item.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 px-2 -mx-2 rounded">
                                            <div className="flex items-center gap-4">
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{item.analysisName || getAnalysisDisplayName(item.analysis)}</span>
                                                <span className="font-mono font-bold">{item.result}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {/* Spectral Link in Review */}
                                                {['SPEC_VIS_NIR', 'SPEC_MIR', 'Vis-NIR Soil Spectra', 'MIR Soil Spectra'].includes(item.analysis) && (
                                                    <a
                                                        href={`/spectral?search=${item.sampleId}`} // Filter by sample ID in explorer
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 mr-2"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <AlertOctagon size={10} /> View Chart
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => onReviewItem(item.id, 'ACCEPTED')}
                                                    className="p-1 hover:bg-green-100 text-green-600 rounded transition-colors"
                                                    title="Accept Item"
                                                >
                                                    <Check size={14} />
                                                </button>
                                                <button
                                                    onClick={() => onReviewItem(item.id, 'REANALYSIS_REQUIRED')}
                                                    className="p-1 hover:bg-red-100 text-red-600 rounded transition-colors"
                                                    title="Reject Item"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                                    <button
                                        onClick={() => onReviewSubmission(sub.id, 'REJECT_REANALYSIS')}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded text-xs font-bold"
                                    >
                                        <X size={14} /> Reject All
                                    </button>
                                    <button
                                        onClick={() => onReviewSubmission(sub.id, 'ACCEPTED')}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded text-xs font-bold"
                                    >
                                        <Check size={14} /> Accept All
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SubmissionPanel;
