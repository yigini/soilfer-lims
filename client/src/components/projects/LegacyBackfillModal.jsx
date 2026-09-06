import React, { useState } from 'react';
import {
    History, X, Download, Upload, FileSpreadsheet, CheckCircle2,
    AlertCircle, Sparkles, Database, ArrowRight, ShieldCheck, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function LegacyBackfillModal({ isOpen, onClose, preselectedProject = null, projects = [] }) {
    const navigate = useNavigate();
    const [selectedProjectId, setSelectedProjectId] = useState(preselectedProject?.id || (projects[0]?.id || ''));
    const [analysisScope, setAnalysisScope] = useState({
        chemistry: true,
        texture: true,
        spectroscopy: false,
        carbon: true
    });
    const [campaignPeriod, setCampaignPeriod] = useState('2025-2026');
    const [ingestionMode, setIngestionMode] = useState('direct_results');
    const [uploadedFile, setUploadedFile] = useState(null);
    const [complianceChecked, setComplianceChecked] = useState(true);

    if (!isOpen) return null;

    const currentProject = projects.find(p => p.id === selectedProjectId) || preselectedProject;

    const handleDownloadTemplate = () => {
        const headers = [
            ['Sample_ID', 'Original_Field_ID', 'Project_Code', 'Analysis_Code', 'Method_Code', 'Result_Value', 'Unit', 'Analysis_Date', 'Analyst_Name', 'Status', 'QA_Remarks']
        ];
        const sampleRows = [
            ['ZMB-LUS-001', 'FIELD-ZMB-A12', currentProject?.code || 'PRJ-ZMB-01', 'PH', 'ISO_10390_H2O', '6.45', 'pH units', '2025-11-14', 'Dr. Mulenga', 'APPROVED', 'Historical pre-LIMS bench run'],
            ['ZMB-LUS-001', 'FIELD-ZMB-A12', currentProject?.code || 'PRJ-ZMB-01', 'OC', 'WALKLEY_BLACK', '1.82', '%', '2025-11-15', 'Dr. Mulenga', 'APPROVED', 'Historical pre-LIMS bench run'],
            ['ZMB-LUS-001', 'FIELD-ZMB-A12', currentProject?.code || 'PRJ-ZMB-01', 'TEXTURE_CLAY', 'BOUYOUCOS_HYDROMETER', '28.4', '%', '2025-11-16', 'M. Phiri', 'APPROVED', 'Historical hydrometer protocol'],
            ['ZMB-LUS-002', 'FIELD-ZMB-B04', currentProject?.code || 'PRJ-ZMB-01', 'PH', 'ISO_10390_H2O', '5.90', 'pH units', '2025-11-14', 'Dr. Mulenga', 'APPROVED', 'Historical pre-LIMS bench run'],
            ['ZMB-LUS-002', 'FIELD-ZMB-B04', currentProject?.code || 'PRJ-ZMB-01', 'P_MEHLICH3', 'MEHLICH3_ICP', '14.2', 'mg/kg', '2025-11-18', 'L. Zulu', 'APPROVED', 'External reference batch']
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([...headers, ...sampleRows]);

        // Auto column widths
        ws['!cols'] = [
            { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
            { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
            { wch: 16 }, { wch: 12 }, { wch: 32 }
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Historical_Samples');
        XLSX.writeFile(wb, `SoilFER_Legacy_Backfill_Template_${currentProject?.code || 'PROJECT'}.xlsx`);
    };

    const handleFileDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
        if (file) {
            setUploadedFile(file);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Modal Header */}
                <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gradient-to-r from-amber-50/80 via-white to-emerald-50/40 dark:from-amber-950/20 dark:via-gray-800 dark:to-emerald-950/10">
                    <div className="flex items-start gap-3.5">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-xl shadow-sm">
                            <History size={24} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    Pre-Platform Historical Analysis Backfill
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60">
                                    Backward Compatibility
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Ingest project samples and analytical certificates completed prior to SoilFER LIMS platform deployment.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Modal Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                    {/* Architectural Context Callout */}
                    <div className="p-4 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200 flex gap-3">
                        <Info size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <div className="font-bold">Retroactive Quality Assurance & Legacy Traceability</div>
                            <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                                Due to laboratory execution schedules commencing before software cutover, historical soil samples that already underwent wet chemistry or spectroscopy testing can be backfilled directly into the national research repository without undergoing duplicate physical intake scanning.
                            </p>
                        </div>
                    </div>

                    {/* Step 1: Target Project */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center justify-between">
                            <span>1. Target Research Project</span>
                            <span className="text-[11px] font-normal text-gray-400">Where backfilled samples will be assigned</span>
                        </label>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
                        >
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    [{p.code}] {p.name} {p.labId ? `(${p.labId})` : '(Global)'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: Ingestion Mode Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                            2. Backfill Ingestion Pipeline
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <button
                                type="button"
                                onClick={() => setIngestionMode('direct_results')}
                                className={`p-3 rounded-xl border text-left transition-all ${ingestionMode === 'direct_results'
                                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-sm'
                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                <div className="font-bold text-xs flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className={ingestionMode === 'direct_results' ? 'text-amber-600' : 'text-gray-400'} />
                                    <span>Direct Results</span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                                    Inject validated results (pH, Carbon, Mehlich-3) straight into final approval.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIngestionMode('manifest_completed')}
                                className={`p-3 rounded-xl border text-left transition-all ${ingestionMode === 'manifest_completed'
                                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-sm'
                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                <div className="font-bold text-xs flex items-center gap-1.5">
                                    <Database size={14} className={ingestionMode === 'manifest_completed' ? 'text-amber-600' : 'text-gray-400'} />
                                    <span>Sample Manifest</span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                                    Register sample identifiers with completed status & retroactive receipt dates.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => setIngestionMode('workbook_sync')}
                                className={`p-3 rounded-xl border text-left transition-all ${ingestionMode === 'workbook_sync'
                                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 shadow-sm'
                                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40 text-gray-700 dark:text-gray-300'
                                    }`}
                            >
                                <div className="font-bold text-xs flex items-center gap-1.5">
                                    <FileSpreadsheet size={14} className={ingestionMode === 'workbook_sync' ? 'text-amber-600' : 'text-gray-400'} />
                                    <span>Bench Workbook</span>
                                </div>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                                    Upload multi-tab Excel sheets from legacy bench balances and spectrometers.
                                </p>
                            </button>
                        </div>
                    </div>

                    {/* Step 3: Analytical Scope Toggles */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                            3. Historical Analytical Scope
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {[
                                { key: 'chemistry', label: 'Wet Chemistry (pH, EC)' },
                                { key: 'carbon', label: 'Organic Carbon (C)' },
                                { key: 'texture', label: 'Physical Texture' },
                                { key: 'spectroscopy', label: 'MIR / NIR Spectra' }
                            ].map((item) => (
                                <label
                                    key={item.key}
                                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${analysisScope[item.key]
                                        ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                                        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                                        }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={analysisScope[item.key]}
                                        onChange={(e) => setAnalysisScope(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <span>{item.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Step 4: Template Download & Upload Dropzone */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                                4. Historical Spreadsheet Ingestion
                            </label>
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline"
                            >
                                <Download size={14} />
                                <span>Download Excel Backfill Template (.xlsx)</span>
                            </button>
                        </div>

                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleFileDrop}
                            className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-6 text-center hover:border-amber-400 dark:hover:border-amber-600 transition-colors bg-gray-50/50 dark:bg-gray-900/30"
                        >
                            <div className="max-w-xs mx-auto space-y-2">
                                <div className="w-10 h-10 mx-auto rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                    <Upload size={20} />
                                </div>
                                <div className="text-xs font-semibold text-gray-900 dark:text-white">
                                    {uploadedFile ? uploadedFile.name : 'Drop historical Excel (.xlsx) or CSV file here'}
                                </div>
                                <p className="text-[11px] text-gray-500">
                                    {uploadedFile ? `${(uploadedFile.size / 1024).toFixed(1)} KB — Ready to parse` : 'Supports legacy bench logs, instrument export files, and lab summaries'}
                                </p>
                                <label className="inline-block mt-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 cursor-pointer shadow-sm">
                                    <span>Browse Files</span>
                                    <input
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && setUploadedFile(e.target.files[0])}
                                    />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Quality Attestation Check */}
                    <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 flex items-start gap-3">
                        <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <label className="text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={complianceChecked}
                                onChange={(e) => setComplianceChecked(e.target.checked)}
                                className="mr-2 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                            I verify that these historical records correspond to project samples analyzed in accredited or GLOSOLAN-harmonized reference laboratories prior to SoilFER LIMS cutover.
                        </label>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            Roadmap Feature · Full Ingestion Engine available in Admin Panel
                        </span>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                navigate('/admin/legacy-import');
                            }}
                            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition-colors shadow-sm"
                        >
                            <span>Open Legacy Importer</span>
                            <ArrowRight size={14} />
                        </button>

                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-colors shadow-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
