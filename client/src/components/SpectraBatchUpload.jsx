import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, ArrowRight, RefreshCw, AlertCircle, Database, Eye, CheckCircle2, AlertOctagon, ShieldCheck, Zap } from 'lucide-react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * @param {object} props
 * @param {() => void} props.onUploadSuccess
 * @param {() => void} props.onClose
 * @param {string} [props.currentSampleLabId] - If provided, will verify if uploaded Lab IDs match this sample
 * @param {string} [props.currentSampleId] - If provided, passes context sample ID to backend for matching
 */
const SpectraBatchUpload = ({ onUploadSuccess, onClose, currentSampleLabId, currentSampleId }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const isManager = ['SUPER_ADMIN', 'LAB_MANAGER'].includes(user?.role);
    const [step, setStep] = useState(1); // 1: Select, 2: Preview, 3: Result
    const [file, setFile] = useState(null);
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [previewData, setPreviewData] = useState(null); // { new: [], errors: [] }
    const [uploadResult, setUploadResult] = useState(null);
    const [modality, setModality] = useState('NIR');
    const [detectedModality, setDetectedModality] = useState(null); // Auto-detected from wavelengths
    const [detectedFormat, setDetectedFormat] = useState(null); // 'wide', 'long', or 'instrument_files'
    const [autoApprove, setAutoApprove] = useState(false);
    const [previewScan, setPreviewScan] = useState(null); // For showing spectrum chart
    const [labIdMatchInfo, setLabIdMatchInfo] = useState(null); // { matched: [], unmatched: [] }
    const [matchCheckResult, setMatchCheckResult] = useState(null); // Backend sample match check

    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files || []);
        if (selected.length > 0) {
            setFiles(selected);
            setFile(selected[0]);
            setError(null);
        }
    };

    const [parsingProgress, setParsingProgress] = useState(null); // { current: 0, total: 0 }

    // Auto-detect modality from wavelength range
    const detectModality = (wavelengths) => {
        if (!wavelengths || wavelengths.length === 0) return 'NIR';
        const minW = Math.min(...wavelengths);
        const maxW = Math.max(...wavelengths);
        // MIR: wavenumbers typically 600-4000 cm⁻¹
        // NIR: wavelengths typically 350-2500 nm
        if (minW >= 350 && maxW <= 2600) return 'NIR';
        if (minW >= 500 && maxW <= 4500) return 'MIR';
        return 'NIR'; // Default
    };

    // Detect if CSV is wide-format (wavelengths as column headers)
    const isWideFormat = (headerParts) => {
        // Wide format: first cell is empty or label, rest are numeric wavelengths
        // Check if columns 2+ are mostly numeric
        const numericCount = headerParts.slice(1).filter(h => !isNaN(parseFloat(h.trim()))).length;
        return numericCount > 50; // If >50 numeric headers, it's wide-format
    };

    const parseCSVAsync = async (text, onProgress) => {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const totalLines = lines.length;
        const errors = [];

        if (totalLines === 0) {
            errors.push({ labId: 'File', message: 'The file appears to be empty. Please check your CSV file.' });
            return { scans: [], errors, format: null, detectedModality: null };
        }

        const headerParts = lines[0].split(',');
        let scans = [];
        let format = null;
        let detectedModality = null;

        // Helper to yield control to UI
        const yieldToUI = () => new Promise(resolve => setTimeout(resolve, 0));

        // ========== WIDE FORMAT ==========
        if (isWideFormat(headerParts)) {
            format = 'wide';
            const wavelengths = headerParts.slice(1).map(h => parseFloat(h.trim())).filter(w => !isNaN(w));
            detectedModality = detectModality(wavelengths);

            if (wavelengths.length < 10) {
                errors.push({ labId: 'Format', message: 'Wide-format detected but fewer than 10 valid wavelength columns found in header.' });
                return { scans: [], errors, format, detectedModality };
            }

            for (let i = 1; i < totalLines; i++) {
                // Update progress every 50 lines
                if (i % 50 === 0) {
                    onProgress(i, totalLines);
                    await yieldToUI();
                }

                const parts = lines[i].split(',');
                const labId = (parts[0] || '').trim().replace(/^"|"$/g, '');
                if (!labId) continue;

                const values = parts.slice(1).map(v => parseFloat(v.trim()));
                const validWavelengths = [];
                const validValues = [];
                let invalidCount = 0;
                for (let j = 0; j < wavelengths.length && j < values.length; j++) {
                    if (!isNaN(values[j])) {
                        validWavelengths.push(wavelengths[j]);
                        validValues.push(values[j]);
                    } else {
                        invalidCount++;
                    }
                }

                if (validValues.length < 10) {
                    errors.push({ labId, message: `Only ${validValues.length} valid data points found (${invalidCount} invalid). Skipped.` });
                    continue;
                }

                scans.push({
                    labId,
                    modality: detectedModality,
                    wavelengths: validWavelengths,
                    values: validValues,
                    filename: file.name,
                    scanDate: new Date().toISOString()
                });
            }
        }
        // ========== LONG FORMAT ==========
        else {
            format = 'long';
            const hasHeader = isNaN(parseFloat(headerParts[0])) ||
                headerParts[0].toLowerCase().includes('lab') ||
                headerParts[0].toLowerCase().includes('sample') ||
                headerParts[0].toLowerCase().includes('id');

            let startIndex = hasHeader ? 1 : 0;
            const grouped = {};
            let invalidValueRows = 0;

            for (let i = startIndex; i < totalLines; i++) {
                // Update progress every 500 lines (long format has more lines)
                if (i % 500 === 0) {
                    onProgress(i, totalLines);
                    await yieldToUI();
                }

                const line = lines[i];
                const parts = line.split(',');
                if (parts.length < 3) continue;

                const labId = parts[0].trim().replace(/^"|"$/g, '');
                const w = parseFloat(parts[1].trim());
                const v = parseFloat(parts[2].trim());

                if (!grouped[labId]) grouped[labId] = { wavelengths: [], values: [] };
                if (!isNaN(w) && !isNaN(v)) {
                    grouped[labId].wavelengths.push(w);
                    grouped[labId].values.push(v);
                } else {
                    invalidValueRows++;
                }
            }

            // Convert grouped to array
            scans = Object.keys(grouped).map(labId => {
                const g = grouped[labId];
                if (g.wavelengths.length === 0) {
                    errors.push({ labId, message: 'No valid numeric data found.' });
                    return null;
                }
                const autoMod = detectModality(g.wavelengths);
                return {
                    labId, modality: autoMod,
                    wavelengths: g.wavelengths, values: g.values,
                    filename: file.name, scanDate: new Date().toISOString()
                };
            }).filter(Boolean);

            const allModalities = scans.map(p => p.modality);
            detectedModality = allModalities.length > 0 ? allModalities[0] : null;

            if (invalidValueRows > 0 && scans.length > 0) {
                errors.push({ labId: 'Warning', message: `${invalidValueRows} row(s) skipped (non-numeric data).` });
            }
        }

        return { scans, errors, format, detectedModality };
    };

    const handlePreview = async () => {
        if (!file && files.length === 0) return;
        setLoading(true);
        setError(null);
        setParsingProgress({ current: 0, total: 0 });

        const isSingleCsv = (files.length <= 1) && (files[0] || file).name.toLowerCase().endsWith('.csv');

        if (isSingleCsv) {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const text = evt.target.result;
                    // Use async parser with progress callback
                    const { scans, errors, format, detectedModality: dm } = await parseCSVAsync(text, (current, total) => {
                        setParsingProgress({ current, total });
                    });

                    setDetectedFormat(format);
                    if (dm) {
                        setDetectedModality(dm);
                        setModality(dm);
                    }

                    if (scans.length === 0 && errors.length === 0) {
                        setError('No data found in file.');
                    } else {
                        setPreviewData({ scans, errors, isRawInstrumentFiles: false });

                        if (currentSampleLabId && scans.length > 0) {
                            const matched = scans.filter(s =>
                                s.labId.toLowerCase() === currentSampleLabId.toLowerCase()
                            );
                            const unmatched = scans.filter(s =>
                                s.labId.toLowerCase() !== currentSampleLabId.toLowerCase()
                            );
                            setLabIdMatchInfo({ matched, unmatched });
                        } else {
                            setLabIdMatchInfo(null);
                        }

                        // Pre-upload match check: verify all lab IDs against existing samples
                        if (scans.length > 0) {
                            const uniqueLabIds = [...new Set(scans.map(s => s.labId).filter(Boolean))];
                            try {
                                // Reset progress for API call
                                setParsingProgress({ current: scans.length, total: scans.length, message: 'Verifying sample matches...' });
                                const matchRes = await axios.post('/api/spectral/check-matches', { labIds: uniqueLabIds });
                                setMatchCheckResult(matchRes.data);
                            } catch (err) {
                                console.error('Match check failed:', err);
                                setMatchCheckResult(null);
                            }
                        }

                        setStep(2);
                    }
                } catch (err) {
                    console.error(err);
                    setError('Failed to parse CSV client-side.');
                } finally {
                    setLoading(false);
                    setParsingProgress(null);
                }
            };
            reader.readAsText(files[0] || file);
        } else {
            // Direct Instrument Files / Multi-File Ingest (SL-06 & SL-13)
            try {
                const targetFiles = files.length > 0 ? files : [file];
                const scans = targetFiles.map(f => {
                    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
                    const labId = f.name.replace(/\.[^/.]+$/, '');
                    return {
                        filename: f.name,
                        size: f.size,
                        labId,
                        format: ext.replace('.', '').toUpperCase(),
                        modality,
                        scanDate: new Date().toISOString()
                    };
                });

                setDetectedFormat('instrument_files');
                setPreviewData({ scans, errors: [], isRawInstrumentFiles: true });

                const uniqueLabIds = [...new Set(scans.map(s => s.labId).filter(Boolean))];
                if (uniqueLabIds.length > 0) {
                    try {
                        const matchRes = await axios.post('/api/spectral/check-matches', { labIds: uniqueLabIds });
                        setMatchCheckResult(matchRes.data);
                    } catch (err) {
                        console.error('Match check failed:', err);
                        setMatchCheckResult(null);
                    }
                }

                setStep(2);
            } catch (err) {
                console.error(err);
                setError('Failed to inspect selected files.');
            } finally {
                setLoading(false);
                setParsingProgress(null);
            }
        }
    };

    const handleConfirm = async () => {
        if (!previewData) return;
        setLoading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('batchId', `BATCH-${Date.now()}`);
            if (currentSampleId) formData.append('contextSampleId', currentSampleId);
            formData.append('autoApprove', autoApprove && isManager ? 'true' : 'false');
            if (modality) formData.append('modality', modality);

            // Append raw binary files for byte-identical storage (SL-06 & SL-13)
            const targetFiles = files.length > 0 ? files : (file ? [file] : []);
            targetFiles.forEach(f => formData.append('files', f));

            // If wide-table CSV was parsed into individual scans, also send scans JSON
            if (previewData.scans && !previewData.isRawInstrumentFiles) {
                formData.append('scans', JSON.stringify(previewData.scans));
            }

            const res = await axios.post('/api/spectral/batch', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setUploadResult(res.data.results);
            setStep(3);
            if (onUploadSuccess) onUploadSuccess();
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.message || 'Upload failed.');
        } finally {
            setLoading(false);
        }
    };

    // --- Renders ---

    if (step === 1) {
        return (
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Upload className="text-blue-600" /> Batch Upload Spectra
                </h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-sm text-blue-800">
                    <p className="font-semibold mb-1">Upload instrument spectral files or CSV table (SL-06 & SL-13):</p>
                    <ul className="mt-1 ml-4 list-disc space-y-0.5">
                        <li><strong>Raw Instrument Files</strong> — JCAMP-DX (.dx, .jcamp), Bruker OPUS (.opus), Galactic SPC (.spc), ASD (.asd)</li>
                        <li><strong>Wide-format CSV</strong> — wavelengths as column headers, one row per sample</li>
                        <li><strong>Long-format CSV</strong> — columns: LabID, Wavelength, Value</li>
                    </ul>
                    <p className="mt-2 text-xs text-blue-700">Raw instrument files are persisted byte-identically on disk and parsed server-side.</p>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors relative">
                    <input
                        type="file"
                        multiple
                        accept=".csv,.dx,.jdx,.jcamp,.txt,.opus,.spc,.asd"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    {files.length > 1 ? (
                        <div className="text-center">
                            <FileText className="mx-auto text-blue-500 mb-2" size={40} />
                            <p className="font-medium text-gray-700">{files.length} files selected</p>
                            <p className="text-xs text-gray-400">
                                Total: {(files.reduce((acc, f) => acc + f.size, 0) / 1024).toFixed(1)} KB
                            </p>
                        </div>
                    ) : file ? (
                        <div className="text-center">
                            <FileText className="mx-auto text-blue-500 mb-2" size={40} />
                            <p className="font-medium text-gray-700">{file.name}</p>
                            <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <Upload className="mx-auto text-gray-400 mb-2" size={40} />
                            <p className="font-medium text-gray-600">Drag & Drop Instrument Files or CSV</p>
                            <p className="text-xs text-gray-400 mt-1">Select one or multiple files (.dx, .jcamp, .opus, .spc, .asd, .csv)</p>
                        </div>
                    )}
                </div>

                {/* Auto-Approve Option (managers only) */}
                {isManager && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                        <input
                            type="checkbox"
                            id="autoApprove"
                            checked={autoApprove}
                            onChange={(e) => setAutoApprove(e.target.checked)}
                            className="w-4 h-4 text-green-600 rounded"
                        />
                        <label htmlFor="autoApprove" className="text-sm text-green-800 flex items-center gap-2 cursor-pointer">
                            <ShieldCheck size={16} className="text-green-600" />
                            <span><strong>Auto-Approve</strong> — Skip review queue and mark spectra as approved immediately</span>
                        </label>
                    </div>
                )}

                <div className="mt-6 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                    <button
                        onClick={handlePreview}
                        disabled={(!file && files.length === 0) || loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : null}
                        {loading && parsingProgress
                            ? (parsingProgress.message || `Parsing... (${parsingProgress.current}/${parsingProgress.total})`)
                            : 'Parse & Preview'}
                    </button>
                </div>
                {error && <div className="mt-4 text-red-600 bg-red-50 p-3 rounded flex items-center gap-2"><AlertCircle size={18} />{error}</div>}
            </div>
        );
    }

    if (step === 2) {
        const scanCount = previewData?.scans?.length || 0;
        const errorCount = previewData?.errors?.length || 0;

        return (
            <div className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    Validate Data
                    {detectedModality && (
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${detectedModality === 'NIR' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                            <Zap size={12} />
                            {detectedModality} Auto-detected
                        </span>
                    )}
                    {detectedFormat && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                            {detectedFormat === 'wide' ? 'Wide Format' : (detectedFormat === 'instrument_files' ? 'Raw Instrument Files' : 'Long Format')}
                        </span>
                    )}
                    {autoApprove && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                            <ShieldCheck size={12} /> Auto-Approve
                        </span>
                    )}
                </h2>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="text-2xl font-bold text-green-700">{scanCount}</div>
                        <div className="text-sm text-green-800">Scans Detected</div>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                        <div className="text-2xl font-bold text-red-700">{errorCount}</div>
                        <div className="text-sm text-red-800">Errors</div>
                    </div>
                </div>

                {/* Pre-upload Sample Match Check */}
                {matchCheckResult && !currentSampleLabId && (
                    <div className="mb-6">
                        {matchCheckResult.matchedCount > 0 && matchCheckResult.unmatchedCount === 0 && (
                            <div className="bg-green-100 border border-green-400 rounded-lg p-4 flex items-start gap-3">
                                <CheckCircle2 className="text-green-600 mt-0.5" size={22} />
                                <div>
                                    <div className="font-bold text-green-800">✓ All Lab IDs Match Existing Samples</div>
                                    <div className="text-sm text-green-700">
                                        All {matchCheckResult.matchedCount} unique Lab ID(s) found existing sample records. All spectra will be uploaded and linked.
                                    </div>
                                </div>
                            </div>
                        )}

                        {matchCheckResult.matchedCount > 0 && matchCheckResult.unmatchedCount > 0 && (
                            <div className="bg-amber-50 border border-amber-400 rounded-lg p-4 flex items-start gap-3">
                                <AlertOctagon className="text-amber-600 mt-0.5" size={22} />
                                <div>
                                    <div className="font-bold text-amber-800">⚠ Partial Match — Some Lab IDs Not Found</div>
                                    <div className="text-sm text-amber-700 mt-1">
                                        <strong>{matchCheckResult.matchedCount}</strong> Lab ID(s) matched and will be uploaded.
                                        <strong className="text-red-700"> {matchCheckResult.unmatchedCount}</strong> Lab ID(s) have no matching sample and will be <strong>skipped</strong>:
                                    </div>
                                    <div className="mt-2 bg-amber-100 rounded p-2 text-sm max-h-24 overflow-y-auto">
                                        {matchCheckResult.unmatched.slice(0, 10).map((id, i) => (
                                             <span key={i} className="inline-block mr-2 mb-1 px-2 py-0.5 bg-red-100 text-red-800 rounded font-mono text-xs">{id}</span>
                                        ))}
                                        {matchCheckResult.unmatched.length > 10 && (
                                            <span className="text-amber-600 italic text-xs">...and {matchCheckResult.unmatched.length - 10} more</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {matchCheckResult.matchedCount === 0 && (
                            <div className="bg-red-50 border border-red-400 rounded-lg p-4 flex items-start gap-3">
                                <XCircle className="text-red-600 mt-0.5" size={22} />
                                <div>
                                    <div className="font-bold text-red-800">✗ No Matching Samples Found</div>
                                    <div className="text-sm text-red-700 mt-1">
                                        None of the {matchCheckResult.unmatchedCount} Lab ID(s) in this file match existing samples in the database.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Lab ID Match Confirmation Banner */}
                {labIdMatchInfo && currentSampleLabId && (
                    <div className="mb-6">
                        {labIdMatchInfo.matched.length > 0 && labIdMatchInfo.unmatched.length === 0 && (
                            <div className="bg-green-100 border border-green-400 rounded-lg p-4 flex items-start gap-3">
                                <CheckCircle2 className="text-green-600 mt-0.5" size={22} />
                                <div>
                                    <div className="font-bold text-green-800">✓ Lab ID Match Confirmed</div>
                                    <div className="text-sm text-green-700">
                                        All {labIdMatchInfo.matched.length} spectrum(s) match this sample's Lab ID: <strong>{currentSampleLabId}</strong>
                                    </div>
                                </div>
                            </div>
                        )}

                        {labIdMatchInfo.unmatched.length > 0 && (
                            <div className="bg-amber-50 border border-amber-400 rounded-lg p-4 flex items-start gap-3">
                                <AlertOctagon className="text-amber-600 mt-0.5" size={22} />
                                <div>
                                    <div className="font-bold text-amber-800">⚠ Warning: Spectra for Other Samples Detected</div>
                                    <div className="text-sm text-amber-700 mt-1">
                                        You are viewing sample <strong>{currentSampleLabId}</strong>, but the uploaded file contains spectra for different Lab IDs:
                                    </div>
                                    <div className="mt-2 bg-amber-100 rounded p-2 text-sm">
                                        {labIdMatchInfo.unmatched.slice(0, 5).map((s, i) => (
                                            <div key={i} className="font-mono text-amber-800">
                                                • {s.labId} ({s.wavelengths.length} points)
                                            </div>
                                        ))}
                                        {labIdMatchInfo.unmatched.length > 5 && (
                                            <div className="text-amber-600 italic">...and {labIdMatchInfo.unmatched.length - 5} more</div>
                                        )}
                                    </div>
                                    <div className="text-sm text-amber-800 mt-2">
                                        <strong>These spectra will still be saved</strong>, but they will be linked to their respective samples, not this one.
                                    </div>
                                    {labIdMatchInfo.matched.length > 0 && (
                                        <div className="text-sm text-green-700 mt-2 bg-green-50 rounded p-2">
                                            ✓ {labIdMatchInfo.matched.length} spectrum(s) do match this sample and will be linked correctly.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Sample List Preview */}
                <h4 className="font-semibold text-gray-700 mb-2">Detected Samples</h4>
                <div className="max-h-60 overflow-y-auto bg-gray-50 border rounded-lg p-2 mb-6">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b">
                                {currentSampleLabId && <th className="p-2 w-8">Match</th>}
                                <th className="p-2">Lab ID</th>
                                <th className="p-2">Points / Format</th>
                                <th className="p-2">Range / Size</th>
                            </tr>
                        </thead>
                        <tbody>
                            {previewData.scans.slice(0, 20).map((s, i) => {
                                const isMatch = currentSampleLabId && s.labId.toLowerCase() === currentSampleLabId.toLowerCase();
                                const isMismatch = currentSampleLabId && !isMatch;
                                return (
                                    <tr key={i}
                                        className={`border-b last:border-0 cursor-pointer hover:bg-blue-50 
                                            ${previewScan?.labId === s.labId ? 'bg-blue-100' : ''} 
                                            ${isMatch ? 'bg-green-50' : ''} 
                                            ${isMismatch ? 'bg-amber-50' : ''}`}
                                        onClick={() => setPreviewScan(s)}>
                                        {currentSampleLabId && (
                                            <td className="p-2">
                                                {isMatch ? (
                                                    <CheckCircle2 size={16} className="text-green-600" />
                                                ) : (
                                                    <AlertTriangle size={16} className="text-amber-500" />
                                                )}
                                            </td>
                                        )}
                                        <td className={`p-2 font-mono ${isMatch ? 'text-green-700 font-bold' : ''} ${isMismatch ? 'text-amber-700' : ''}`}>
                                            {s.labId}
                                        </td>
                                        <td className="p-2">{s.wavelengths ? `${s.wavelengths.length} pts` : (s.format || 'Raw File')}</td>
                                        <td className="p-2 text-gray-500">
                                            {s.wavelengths && s.wavelengths.length > 0 ? `${Math.min(...s.wavelengths)}-${Math.max(...s.wavelengths)}` : (s.size ? `${(s.size / 1024).toFixed(1)} KB` : '-')}
                                        </td>
                                        <td className="p-2 text-right">
                                            <Eye size={16} className={`inline ${previewScan?.labId === s.labId ? 'text-blue-600' : 'text-gray-400'}`} />
                                        </td>
                                    </tr>
                                );
                            })}
                            {previewData.scans.length > 20 && (
                                <tr><td colSpan={currentSampleLabId ? 5 : 4} className="p-2 text-center text-gray-500 italic">...and {previewData.scans.length - 20} more</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Spectrum Preview Chart */}
                {previewScan && previewScan.wavelengths && previewScan.wavelengths.length > 0 && (
                    <div className="mb-6 bg-white border rounded-lg p-4">
                        <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Eye size={16} className="text-blue-600" />
                            Preview: {previewScan.labId} ({previewScan.wavelengths.length} points)
                        </h4>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={previewScan.wavelengths.map((w, idx) => ({
                                        wavelength: w,
                                        value: previewScan.values[idx]
                                    }))}
                                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="wavelength"
                                        tick={{ fontSize: 10 }}
                                        label={{ value: 'Wavelength (nm)', position: 'insideBottom', offset: -5, fontSize: 10 }}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10 }}
                                        label={{ value: modality === 'NIR' ? 'Reflectance' : 'Absorbance', angle: -90, position: 'insideLeft', fontSize: 10 }}
                                    />
                                    <Tooltip
                                        contentStyle={{ fontSize: 11 }}
                                        formatter={(v) => [v?.toFixed(4), modality === 'NIR' ? 'Reflectance' : 'Absorbance']}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke={modality === 'NIR' ? '#3b82f6' : '#10b981'}
                                        strokeWidth={1.5}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Show errors if any */}
                {errorCount > 0 && (
                    <div className="mb-6">
                        <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                            <AlertCircle size={16} /> Parsing Errors ({errorCount})
                        </h4>
                        <div className="max-h-40 overflow-y-auto bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                            {previewData.errors.map((e, i) => (
                                <div key={i} className="text-red-700 py-1 border-b border-red-100 last:border-0">
                                    <span className="font-mono font-bold">{e.labId || 'Unknown'}:</span> {e.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Show help when no scans detected */}
                {scanCount === 0 && (
                    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                        <div className="font-bold mb-2 flex items-center gap-2">
                            <AlertTriangle size={16} /> No valid data detected
                        </div>
                        <p className="mb-2">Your CSV file format may not match the expected structure.</p>
                        <div className="bg-white/50 rounded p-2 font-mono text-xs">
                            <div className="font-bold mb-1">Expected format (Long-Format CSV):</div>
                            <div>LabID,Wavelength,Value</div>
                            <div className="text-gray-500">S002,350,0.123</div>
                            <div className="text-gray-500">S002,351,0.125</div>
                            <div className="text-gray-500">S002,352,0.128</div>
                            <div className="text-gray-500">...</div>
                        </div>
                        <p className="mt-2 text-xs">Each row should contain the sample Lab ID, wavelength number, and absorbance/reflectance value.</p>
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button onClick={() => setStep(1)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Back</button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || scanCount === 0 || (matchCheckResult && matchCheckResult.matchedCount === 0 && !currentSampleId)}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={18} /> : null}
                        Upload Data
                    </button>
                </div>
                {error && <div className="mt-4 text-red-600 bg-red-50 p-3 rounded flex items-center gap-2"><AlertCircle size={18} />{error}</div>}
            </div>
        );
    }

    if (step === 3) {
        const overwriteCount = uploadResult.overwrites?.length || 0;

        return (
            <div className="p-8 text-center">
                <div className="inline-flex p-4 bg-green-100 text-green-600 rounded-full mb-4">
                    <CheckCircle size={48} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Batch Processed</h2>
                <div className="grid grid-cols-3 gap-4 text-sm mb-6 max-w-md mx-auto">
                    <div className="bg-green-50 p-2 rounded">
                        <div className="font-bold text-green-700">{uploadResult.success}</div>
                        <div>Saved</div>
                    </div>
                    <div className="bg-red-50 p-2 rounded">
                        <div className="font-bold text-red-700">{uploadResult.failed}</div>
                        <div>Failed</div>
                    </div>
                    {overwriteCount > 0 && (
                        <div className="bg-amber-50 p-2 rounded">
                            <div className="font-bold text-amber-700">{overwriteCount}</div>
                            <div>Replaced</div>
                        </div>
                    )}
                </div>

                {/* Sample Linked Confirmation */}
                {uploadResult.linkedToSample && uploadResult.success > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="text-blue-600 mt-0.5" size={22} />
                            <div>
                                <div className="font-bold text-blue-800">✓ Spectra Linked to Sample</div>
                                <div className="text-sm text-blue-700 mt-1">
                                    Sample ID: <strong>{uploadResult.linkedToSample.originalId || uploadResult.linkedToSample.id}</strong>
                                </div>
                                <div className="text-sm text-green-700 mt-2 bg-green-50 rounded p-2">
                                    📋 The work item status has been updated. Ready for submission to manager for approval.
                                </div>
                                <a
                                    href={`/samples/${uploadResult.linkedToSample.id}`}
                                    className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                                >
                                    View Sample Details →
                                </a>
                            </div>
                        </div>
                    </div>
                )}

                {/* Overwrite Warning */}
                {overwriteCount > 0 && (
                    <div className="text-left text-sm bg-amber-50 p-3 rounded mb-4 border border-amber-200">
                        <div className="font-bold text-amber-800 mb-1 flex items-center gap-2">
                            <AlertTriangle size={16} /> Previous Data Replaced
                        </div>
                        <div className="text-amber-700 text-xs">
                            {uploadResult.overwrites.map((o, i) => (
                                <div key={i}>• {o.labId}: {o.modality} spectrum replaced ({o.count} previous)</div>
                            ))}
                        </div>
                    </div>
                )}

                {uploadResult.errors.length > 0 && (
                    <div className="text-left text-xs bg-red-50 p-3 rounded max-h-32 overflow-y-auto mb-4 border border-red-100">
                        {uploadResult.errors.map((e, i) => (
                            <div key={i} className="text-red-700">{e.error}</div>
                        ))}
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                    Close
                </button>
            </div>
        );
    }
};

export default SpectraBatchUpload;
