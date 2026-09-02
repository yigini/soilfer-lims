import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Upload, FileText, CheckCircle2, AlertCircle, ArrowRight,
    Database, Table, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';

const LegacyImport = () => {
    const { user } = useAuth();

    // Configuration states
    const [analyses, setAnalyses] = useState([]);
    const [methods, setMethods] = useState([]);
    const [units, setUnits] = useState([]);
    const [labs, setLabs] = useState([]);
    const [selectedLabId, setSelectedLabId] = useState(user?.labId || 'LAB-DEFAULT');

    // Import workflow states
    const [csvText, setCsvText] = useState('');
    const [previewData, setPreviewData] = useState(null);
    const [sampleIdCol, setSampleIdCol] = useState('');
    const [columnMappings, setColumnMappings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [message, setMessage] = useState(null);

    // Fetch catalogue metadata
    useEffect(() => {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        const loadConfig = async () => {
            try {
                const [anaRes, methRes, unitRes, labRes] = await Promise.all([
                    fetch('/api/config/analyses', { headers }),
                    fetch('/api/config/methodologies', { headers }),
                    fetch('/api/config/units', { headers }),
                    fetch('/api/labs', { headers })
                ]);

                if (anaRes.ok) setAnalyses(await anaRes.json());
                if (methRes.ok) setMethods(await methRes.json());
                if (unitRes.ok) setUnits(await unitRes.json());
                if (labRes.ok) {
                    const lData = await labRes.json();
                    setLabs(lData);
                    if (!user?.labId && lData.length > 0) setSelectedLabId(lData[0].id);
                }
            } catch (err) {
                console.error('Failed to load catalogue config:', err);
            }
        };

        loadConfig();
    }, [user]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            setCsvText(evt.target.result);
        };
        reader.readAsText(file);
    };

    const handlePreview = async () => {
        if (!csvText.trim()) {
            setMessage({ type: 'error', text: 'Please paste or upload CSV data first.' });
            return;
        }

        setLoading(true);
        setMessage(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/import/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ csvText })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Preview failed');

            setPreviewData(data);
            // Default sampleId column to first header or header with 'id'/'sample'
            const foundId = data.headers.find(h => /sample|id|code/i.test(h)) || data.headers[0];
            setSampleIdCol(foundId);

            // Initialize mappings for non-ID columns
            const initialMaps = data.headers
                .filter(h => h !== foundId)
                .map(h => {
                    const suggested = data.suggestedMappings.find(s => s.column === h);
                    return {
                        column: h,
                        analysisCode: suggested?.analysisCode || '',
                        methodologyId: suggested?.methodologyId || '',
                        unitCode: suggested?.unitCode || ''
                    };
                });
            setColumnMappings(initialMaps);
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const updateMapping = (col, field, val) => {
        setColumnMappings(prev => prev.map(m => {
            if (m.column !== col) return m;
            const updated = { ...m, [field]: val };
            // If analysis changed, auto-suggest default method and unit
            if (field === 'analysisCode') {
                const ana = analyses.find(a => a.code === val);
                const meth = methods.find(met => met.analysisCode === val && met.isDefault) ||
                             methods.find(met => met.analysisCode === val);
                if (meth) updated.methodologyId = meth.id;
                if (ana?.unitCode) updated.unitCode = ana.unitCode;
            }
            return updated;
        }));
    };

    const handleExecuteImport = async () => {
        if (!sampleIdCol) {
            setMessage({ type: 'error', text: 'Please select a Sample ID column.' });
            return;
        }

        // Validate all columns mapped
        const unmapped = columnMappings.filter(m => !m.analysisCode || !m.methodologyId || !m.unitCode);
        if (unmapped.length > 0) {
            setMessage({
                type: 'error',
                text: `Mandatory Harmonisation Rule: All ${unmapped.length} parameter column(s) must be mapped to an analysis, a method, and a controlled unit before import.`
            });
            return;
        }

        setImporting(true);
        setMessage(null);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/import/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    sampleIdColumn: sampleIdCol,
                    labId: selectedLabId,
                    columnMappings,
                    rows: previewData.previewRows
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Import failed');

            setMessage({
                type: 'success',
                text: `Import completed successfully: ${data.importedSamples} samples and ${data.importedResults} results recorded with provenance: IMPORTED.`
            });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Database className="w-7 h-7 text-emerald-600" />
                        Legacy Historical Data Harmonisation &amp; Import
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        FAO SoilFER National Repositories Harmonisation — Enforces mandatory ISO 17025 method and unit bindings on all legacy datasets.
                    </p>
                </div>
            </div>

            {/* Notification Banner */}
            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-3 border ${message.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>
                    {message.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0" /> : <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
                    <span className="text-sm font-medium">{message.text}</span>
                </div>
            )}

            {/* Step 1: Upload / Input */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-gray-500" />
                        Step 1: Provide Historical CSV Dataset
                    </h2>
                    {labs.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 font-medium">Target Lab:</span>
                            <select
                                className="text-sm border border-gray-300 rounded-md p-1 bg-white"
                                value={selectedLabId}
                                onChange={(e) => setSelectedLabId(e.target.value)}
                            >
                                {labs.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
                            </select>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                            Upload CSV File
                        </label>
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={handleFileUpload}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                            Or Paste CSV Text
                        </label>
                        <textarea
                            rows={3}
                            className="w-full text-xs font-mono border border-gray-300 rounded-md p-2"
                            placeholder="Sample_ID,pH_H2O,EC_dS_m,Clay_pct&#10;SMP-LEG-01,6.5,1.2,28.4"
                            value={csvText}
                            onChange={(e) => setCsvText(e.target.value)}
                        />
                    </div>
                </div>

                <button
                    onClick={handlePreview}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm disabled:opacity-50"
                >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Table className="w-4 h-4" />}
                    Parse &amp; Analyze CSV Columns
                </button>
            </div>

            {/* Step 2: Mapping Mandate */}
            {previewData && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-6">
                    <div className="border-l-4 border-amber-500 bg-amber-50 p-4 rounded-r-lg">
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-amber-900">Mandatory Harmonisation Metadata Enforcement</h3>
                                <p className="text-xs text-amber-700 mt-1">
                                    Every result column must be explicitly bound to a catalogue <strong>Analysis Parameter</strong>, a calibrated <strong>Laboratory Methodology</strong>, and a controlled <strong>Unit of Measure</strong>. Results will be marked with provenance <code>IMPORTED</code>.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <label className="text-sm font-semibold text-gray-700">Sample Identifier Column:</label>
                        <select
                            className="text-sm border border-gray-300 rounded-md p-1.5 bg-white font-medium"
                            value={sampleIdCol}
                            onChange={(e) => {
                                const newId = e.target.value;
                                setSampleIdCol(newId);
                                setColumnMappings(prev => prev.filter(m => m.column !== newId));
                            }}
                        >
                            {previewData.headers.map(h => (
                                <option key={h} value={h}>{h}</option>
                            ))}
                        </select>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-700">CSV Column</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Analysis Parameter (WP-16)</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Methodology / Standard (WP-18)</th>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Controlled Unit (WP-17)</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {columnMappings.map(m => {
                                    const isComplete = m.analysisCode && m.methodologyId && m.unitCode;
                                    const relevantMethods = methods.filter(met => met.analysisCode === m.analysisCode);

                                    return (
                                        <tr key={m.column} className={isComplete ? 'bg-white' : 'bg-amber-50/30'}>
                                            <td className="px-4 py-3 font-mono font-medium text-gray-900">{m.column}</td>
                                            <td className="px-4 py-3">
                                                <select
                                                    className="w-full text-xs border border-gray-300 rounded p-1 bg-white"
                                                    value={m.analysisCode}
                                                    onChange={(e) => updateMapping(m.column, 'analysisCode', e.target.value)}
                                                >
                                                    <option value="">-- Select Analysis --</option>
                                                    {analyses.map(a => (
                                                        <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    className="w-full text-xs border border-gray-300 rounded p-1 bg-white"
                                                    value={m.methodologyId}
                                                    onChange={(e) => updateMapping(m.column, 'methodologyId', e.target.value)}
                                                >
                                                    <option value="">-- Select Method --</option>
                                                    {relevantMethods.map(met => (
                                                        <option key={met.id} value={met.id}>{met.name} ({met.standard || 'Standard'})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    className="w-full text-xs border border-gray-300 rounded p-1 bg-white"
                                                    value={m.unitCode}
                                                    onChange={(e) => updateMapping(m.column, 'unitCode', e.target.value)}
                                                >
                                                    <option value="">-- Select Unit --</option>
                                                    {units.map(u => (
                                                        <option key={u.code} value={u.code}>{u.display} ({u.quantityKind})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {isComplete ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                                                        Ready
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                                                        Incomplete
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-200">
                        <button
                            onClick={handleExecuteImport}
                            disabled={importing || columnMappings.some(m => !m.analysisCode || !m.methodologyId || !m.unitCode)}
                            className="inline-flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 text-sm"
                        >
                            {importing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Execute Historical Import (Provenance: IMPORTED)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LegacyImport;
