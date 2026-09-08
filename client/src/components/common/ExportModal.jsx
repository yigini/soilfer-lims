import React, { useState } from 'react';
import axios from 'axios';
import { Download, FileDown, Loader2, CheckCircle2, X, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const ExportModal = ({ isOpen, onClose, currentFilters, searchQuery }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && onClose) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const { user, token } = useAuth();
    const [step, setStep] = useState('CONFIGURE'); // CONFIGURE, GENERATING, DONE, ERROR
    const [config, setConfig] = useState({
        type: 'LIST', // Default to LIST
        includeUnapproved: false,
        viewFilters: {}
    });
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // Reset on open
    React.useEffect(() => {
        if (isOpen) {
            setStep('CONFIGURE');
            setResult(null);
            setError(null);
            setConfig({
                type: 'LIST',
                includeUnapproved: false,
                viewFilters: { ...currentFilters, search: searchQuery }
            });
        }
    }, [isOpen, currentFilters, searchQuery]);

    const handleGenerate = async () => {
        setStep('GENERATING');
        setError(null);
        try {
            const res = await axios.post('/api/exports/data', config, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.data.success) {
                setResult(res.data);
                setStep('DONE');
            } else {
                throw new Error(res.data.error || 'Export failed');
            }
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || err.message);
            setStep('ERROR');
        }
    };

    const handleDownload = () => {
        if (!result) return;

        const { columns, data, meta } = result;

        // Simple CSV conversion
        const escape = (val) => {
            if (val === null || val === undefined) return '';
            const str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const header = columns.map(escape).join(',');
        const rows = data.map(row => columns.map(col => escape(row[col])).join(','));
        const csvContent = [header, ...rows].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${meta.exportId}_${config.type}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100 border border-sf-divider" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-sf-emerald">
                            <FileDown size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-sf-text">Export Data</h3>
                            <p className="text-xs text-sf-muted">Generate CSV reports</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-sf-raised rounded-lg transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content based on Step */}
                <div className="mb-6">
                    {step === 'CONFIGURE' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-sf-muted mb-2">Export Type</label>
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg text-sf-emerald">
                                            <FileSpreadsheet size={20} />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sf-text">Current List View</div>
                                            <div className="text-xs text-sf-muted">Export currently visible columns and rows</div>
                                        </div>
                                    </div>
                                    <div className="text-[11px] text-sf-muted pl-[52px]">
                                        Based on active filters: {searchQuery ? `"${searchQuery}"` : 'No search text'}, {Object.keys(currentFilters || {}).length} active filters.
                                    </div>
                                </div>
                            </div>

                            {['LAB_MANAGER', 'SUPER_ADMIN'].includes(user?.role) && (
                                <label className="flex items-center gap-3 p-3 rounded-xl border border-sf-divider cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                    <input
                                        type="checkbox"
                                        checked={config.includeUnapproved}
                                        onChange={e => setConfig({ ...config, includeUnapproved: e.target.checked })}
                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                    />
                                    <div className="text-sm font-medium text-sf-muted">
                                        Include Unapproved Results
                                        <div className="text-[10px] text-orange-500 font-normal">Use with caution</div>
                                    </div>
                                </label>
                            )}
                        </div>
                    )}

                    {step === 'GENERATING' && (
                        <div className="py-8 text-center">
                            <Loader2 size={48} className="animate-spin text-indigo-600 mx-auto mb-4" />
                            <h4 className="font-bold text-sf-text mb-1">Generating Export...</h4>
                            <p className="text-sm text-gray-500">Processing records and results</p>
                        </div>
                    )}

                    {step === 'DONE' && (
                        <div className="py-6 text-center bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/50">
                            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                <CheckCircle2 size={24} />
                            </div>
                            <h4 className="font-bold text-sf-text mb-1">Export Ready!</h4>
                            <p className="text-sm text-sf-muted mb-4">
                                Generated {result?.meta?.recordCount} records
                            </p>
                            <button
                                onClick={handleDownload}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-lg hover:shadow-green-500/20 transition-all transform hover:scale-105"
                            >
                                <Download size={18} />
                                Download CSV
                            </button>
                        </div>
                    )}

                    {step === 'ERROR' && (
                        <div className="py-6 text-center bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/50">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-3">
                                <AlertCircle size={24} />
                            </div>
                            <h4 className="font-bold text-sf-text mb-1">Export Failed</h4>
                            <p className="text-sm text-red-600 dark:text-red-400 px-4">
                                {error}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-sf-divider">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        {step === 'DONE' ? 'Close' : 'Cancel'}
                    </button>

                    {step === 'CONFIGURE' && (
                        <button
                            onClick={handleGenerate}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all transform hover:scale-105 flex items-center gap-2"
                        >
                            <FileSpreadsheet size={16} />
                            Generate Export
                        </button>
                    )}

                    {step === 'ERROR' && (
                        <button
                            onClick={() => setStep('CONFIGURE')}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-lg transition-all"
                        >
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExportModal;
