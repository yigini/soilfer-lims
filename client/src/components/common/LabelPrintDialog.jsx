import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Printer, X, Tag } from 'lucide-react';

const LabelPrintDialog = ({ isOpen, onClose, sample }) => {
    const [branding, setBranding] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchBranding();
        }
    }, [isOpen]);

    const fetchBranding = async () => {
        try {
            const res = await axios.get('/api/admin/settings');
            if (res.data?.branding) setBranding(res.data.branding);
        } catch (e) { console.warn("Failed to fetch branding", e); }
    };

    if (!isOpen || !sample) return null;

    // Determine IDs
    const labId = sample.labId || 'PENDING';
    const originalId = sample.originalId || 'N/A';
    const collectionDate = sample.samplingDetails?.date || sample.metadata?.date || 'N/A';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* Header */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Printer size={18} className="text-indigo-600" />
                        Print Sample Label
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Content / Preview */}
                <div className="p-8 bg-gray-100 dark:bg-gray-900 flex flex-col items-center gap-6">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-[-10px]">Print Preview</div>

                    {/* THE LABEL REPRESENTATION */}
                    <div className="w-[101mm] h-[54mm] bg-white text-slate-900 p-4 border border-slate-300 shadow-xl flex flex-col font-sans origin-top scale-[0.8] sm:scale-100 rounded-sm">
                        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2 mb-2">
                            <div>
                                <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 line-clamp-1">
                                    {branding?.title || 'SoilFER LIMS'}
                                </h1>
                                <p className="text-[10px] font-bold text-slate-500 uppercase line-clamp-1">
                                    {branding?.organization || 'Reception Intake'}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-[9px] font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded uppercase mb-1 inline-block">
                                    Label
                                </div>
                                <div className="text-[10px] font-mono font-bold text-slate-600">
                                    {new Date().toLocaleDateString()}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-1 gap-4 items-center">
                            {/* QR CODE - Points to Lab ID */}
                            <div className="w-24 h-24 bg-white border border-gray-100 p-1 rounded">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${labId}`}
                                    alt="QR"
                                    className="w-full h-full object-contain"
                                />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="mb-2">
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Lab ID</div>
                                    <div className="text-2xl font-black font-mono leading-tight text-indigo-700 break-all">
                                        {labId}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sample ID (Original)</div>
                                    <div className="text-[11px] font-bold text-slate-600 font-mono break-all line-clamp-2">
                                        {originalId}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-2 border-t border-dashed border-gray-300 flex justify-between items-end">
                            <div className="text-[8px] font-bold text-slate-400">
                                {collectionDate !== 'N/A' ? `Collected: ${collectionDate}` : `Received: ${new Date(sample.createdAt).toLocaleDateString()}`}
                            </div>
                            <div className="text-[8px] font-black text-slate-900 uppercase">
                                {sample.assignedLab || 'Global Lab'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer / Actions */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <Printer size={18} />
                        Print Label
                    </button>
                </div>
            </div>

            {/* REAL PRINTABLE ELEMENT (Only visible to printer) */}
            <div className="print-only hidden">
                <div className="w-[101mm] h-[54mm] bg-white p-4 border border-black flex flex-col font-sans">
                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-2 mb-2">
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                                {branding?.title || 'SoilFER LIMS'}
                            </h1>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">
                                {branding?.organization || 'Reception Intake'}
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-[9px] font-bold text-white bg-slate-900 px-1.5 py-0.5 rounded uppercase mb-1 inline-block">
                                Sample Label
                            </div>
                            <div className="text-[10px] font-mono font-bold text-slate-600">
                                {new Date().toLocaleDateString()}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-1 gap-4 items-center">
                        <div className="w-24 h-24 bg-white border border-gray-200 p-1 rounded">
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${labId}`}
                                alt="QR"
                                className="w-full h-full object-contain"
                            />
                        </div>

                        <div className="flex-1 space-y-2">
                            <div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Lab ID</div>
                                <div className="text-2xl font-black font-mono leading-none text-slate-900">
                                    {labId}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sample ID (Original)</div>
                                <div className="text-[11px] font-bold text-slate-600 font-mono break-all">
                                    {originalId}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-2 border-t border-dashed border-gray-300 flex justify-between items-end">
                        <div className="text-[8px] font-bold text-slate-400">
                            {collectionDate !== 'N/A' ? `Collected: ${collectionDate}` : `Received: ${new Date(sample.createdAt).toLocaleDateString()}`}
                        </div>
                        <div className="text-[8px] font-black text-slate-900 uppercase">
                            {sample.assignedLab || 'Global Lab'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabelPrintDialog;
