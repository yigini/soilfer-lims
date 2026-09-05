import React from 'react';
import { ClipboardList, FlaskConical, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

const IntakeRequestCard = ({ sample }) => {
    if (!sample || sample.status !== 'RECEIVED') return null;

    const checklist = sample.receptionData?.checklist?.items || {};
    const nonConformance = sample.receptionData?.checklist?.nonConformance;
    const ncReason = sample.receptionData?.checklist?.reason;
    const notes = sample.receptionData?.notes;

    const checklistKeys = ['container', 'label', 'quantity', 'preservation', 'damage'];
    const evaluatedCount = checklistKeys.filter(k => checklist[k] && checklist[k].status).length;
    const hasFailures = Boolean(nonConformance) || checklistKeys.some(k => checklist[k]?.status === 'FAIL');
    const isComplete = evaluatedCount === checklistKeys.length && !hasFailures;
    const isNotAssessed = evaluatedCount === 0;

    // Helper for Checklist Item
    const ChecklistItem = ({ label, item }) => {
        const status = item?.status || 'NOT_ASSESSED';
        const isPass = status === 'PASS';
        const isNA = status === 'NA';
        const isUnassessed = status === 'NOT_ASSESSED';
        return (
            <div className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0 text-sm">
                <span className="text-gray-600">{label}</span>
                <div className="text-right">
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        isPass ? 'bg-green-100 text-green-700' :
                        isNA ? 'bg-gray-100 text-gray-500' :
                        isUnassessed ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-red-100 text-red-700'
                    }`}>
                        {isUnassessed ? 'Not assessed' : status}
                    </span>
                    {item?.note && <div className="text-xs text-red-500 mt-1 italic">{item.note}</div>}
                </div>
            </div>
        );
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-in fade-in slide-in-from-top-4">

            {/* LEFT: Analysis Request */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-blue-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-blue-50/50 p-3 border-b border-blue-100 flex items-center justify-between">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2 text-sm">
                        <FlaskConical size={16} className="text-blue-500" />
                        Requested Analysis
                    </h3>
                    <span className="text-xs font-mono text-blue-400">PENDING APPROVAL</span>
                </div>
                <div className="p-4">
                    {sample.analysisGroupIds?.length > 0 && (
                        <div className="mb-4">
                            <div className="text-xs font-bold text-gray-400 uppercase mb-2">Bundles</div>
                            <div className="flex flex-wrap gap-2">
                                {sample.analysisGroupIds.map(g => (
                                    <span key={g} className="px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded text-xs font-semibold">
                                        {g}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <div className="text-xs font-bold text-gray-400 uppercase mb-2">Individual Parameters</div>
                        <div className="flex flex-wrap gap-1.5">
                            {sample.requiredAnalyses?.map(code => (
                                <span key={code} className="px-2 py-1 bg-gray-50 text-gray-600 border border-gray-100 rounded text-xs font-mono">
                                    {code}
                                </span>
                            )) || <span className="text-gray-400 italic text-sm">No specific analyses listed</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: Compliance & Conditions */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="bg-gray-50/50 p-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                        <ClipboardList size={16} className="text-gray-500" />
                        Intake Conditions
                    </h3>
                    {hasFailures ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                            <AlertTriangle size={12} /> ISSUES FOUND
                        </span>
                    ) : isComplete ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                            <CheckCircle size={12} /> CONFORMING
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle size={12} /> {isNotAssessed ? 'NOT ASSESSED' : 'PARTIALLY ASSESSED'}
                        </span>
                    )}
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <ChecklistItem label="Container" item={checklist.container} />
                        <ChecklistItem label="Labeling" item={checklist.label} />
                        <ChecklistItem label="Quantity" item={checklist.quantity} />
                    </div>
                    <div>
                        <ChecklistItem label="Preservation" item={checklist.preservation} />
                        <ChecklistItem label="Damage" item={checklist.damage} />

                        {ncReason && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-700">
                                <span className="font-bold block mb-1">Non-Conformance:</span>
                                {ncReason}
                            </div>
                        )}

                        {notes && (
                            <div className="mt-2 p-2 bg-gray-50 border border-gray-100 rounded text-xs text-gray-600 italic">
                                "{notes}"
                            </div>
                        )}
                    </div>
                </div>
            </div>

        </div>
    );
};

export default IntakeRequestCard;
