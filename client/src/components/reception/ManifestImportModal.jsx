import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, Check, AlertCircle, ArrowRight, Save, FolderOpen, RefreshCw } from 'lucide-react';
import { parseCoordinates } from '../../utils/coordParser';

const PROFILE_STORAGE_KEY = 'soilfer_manifest_mapping_profiles';

const LIMS_FIELDS = [
    { key: 'sampleId', label: 'Sample Identifier (Required)', required: true, pattern: /id|sample|code|barcode/i },
    { key: 'latitude', label: 'Latitude (DD)', required: false, pattern: /^lat|latitude/i },
    { key: 'longitude', label: 'Longitude (DD)', required: false, pattern: /^lon|lng|longitude/i },
    { key: 'coordinates', label: 'Combined Coords (DD / DMS / UTM)', required: false, pattern: /coord|gps|location/i },
    { key: 'depthTop', label: 'Depth Top / From (cm)', required: false, pattern: /depth_?top|depth_?min|from/i },
    { key: 'depthBottom', label: 'Depth Bottom / To (cm)', required: false, pattern: /depth_?bot|depth_?max|to/i },
    { key: 'receivedMass', label: 'Received Mass (g)', required: false, pattern: /mass|weight/i },
    { key: 'siteName', label: 'Site / Plot Identifier', required: false, pattern: /site|plot|farm/i },
    { key: 'village', label: 'Village / Community', required: false, pattern: /village|communit/i },
    { key: 'admin1', label: 'Department / Province', required: false, pattern: /dept|departamento|district|admin/i },
    { key: 'crop', label: 'Target Crop', required: false, pattern: /crop|cultivo/i },
    { key: 'landUse', label: 'Land Use System', required: false, pattern: /land_?use|uso/i }
];

const ManifestImportModal = ({ isOpen, onClose, onImport }) => {
    if (!isOpen) return null;

    const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Preview
    const [fileName, setFileName] = useState('');
    const [sheetNames, setSheetNames] = useState([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [rawRows, setRawRows] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [mapping, setMapping] = useState({});
    const [parsedSamples, setParsedSamples] = useState([]);

    // Profile state
    const [profiles, setProfiles] = useState({});
    const [selectedProfile, setSelectedProfile] = useState('');
    const [newProfileName, setNewProfileName] = useState('');

    useEffect(() => {
        try {
            const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
            if (saved) setProfiles(JSON.parse(saved));
        } catch (e) {
            console.error('Failed to load profiles:', e);
        }
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                setSheetNames(workbook.SheetNames);
                const firstSheet = workbook.SheetNames[0];
                setSelectedSheet(firstSheet);
                parseSheetData(workbook, firstSheet);
            } catch (err) {
                console.error('Error reading spreadsheet:', err);
                alert('Failed to read spreadsheet: ' + err.message);
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const parseSheetData = (workbook, sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        if (json.length === 0) {
            alert('The selected sheet contains no rows.');
            return;
        }

        const detectedHeaders = Object.keys(json[0]);
        setHeaders(detectedHeaders);
        setRawRows(json);

        // Auto-detect mappings based on patterns
        const autoMap = {};
        LIMS_FIELDS.forEach(field => {
            const match = detectedHeaders.find(h => field.pattern.test(h));
            if (match) autoMap[field.key] = match;
        });

        setMapping(autoMap);
        setStep(2);
    };

    const handleSaveProfile = () => {
        if (!newProfileName.trim()) return;
        const updated = { ...profiles, [newProfileName.trim()]: mapping };
        setProfiles(updated);
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated));
        setSelectedProfile(newProfileName.trim());
        setNewProfileName('');
    };

    const handleLoadProfile = (name) => {
        setSelectedProfile(name);
        if (profiles[name]) {
            setMapping(profiles[name]);
        }
    };

    const handleGeneratePreview = () => {
        if (!mapping.sampleId) {
            alert('Please select which column contains the Sample Identifier.');
            return;
        }

        const samples = [];
        rawRows.forEach((row, idx) => {
            const rawId = row[mapping.sampleId];
            if (!rawId || String(rawId).trim() === '') return;

            const originalId = String(rawId).trim();
            let lat = null, lng = null, uncertaintyM = null;

            // Direct lat/lng
            if (mapping.latitude && mapping.longitude && row[mapping.latitude] !== '' && row[mapping.longitude] !== '') {
                const parsedLat = parseFloat(row[mapping.latitude]);
                const parsedLng = parseFloat(row[mapping.longitude]);
                if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
                    lat = parsedLat;
                    lng = parsedLng;
                    uncertaintyM = 10;
                }
            }

            // Or combined string
            if ((!lat || !lng) && mapping.coordinates && row[mapping.coordinates]) {
                const parsed = parseCoordinates(String(row[mapping.coordinates]));
                if (parsed) {
                    lat = parsed.lat;
                    lng = parsed.lng;
                    uncertaintyM = parsed.uncertaintyM;
                }
            }

            samples.push({
                originalId,
                status: 'ACCEPTED',
                latitude: lat,
                longitude: lng,
                positionalUncertaintyM: uncertaintyM,
                depthTopCm: mapping.depthTop && row[mapping.depthTop] !== '' ? parseFloat(row[mapping.depthTop]) : null,
                depthBottomCm: mapping.depthBottom && row[mapping.depthBottom] !== '' ? parseFloat(row[mapping.depthBottom]) : null,
                receivedMass: mapping.receivedMass && row[mapping.receivedMass] !== '' ? parseFloat(row[mapping.receivedMass]) : null,
                siteName: mapping.siteName ? String(row[mapping.siteName] || '') : null,
                village: mapping.village ? String(row[mapping.village] || '') : null,
                admin1: mapping.admin1 ? String(row[mapping.admin1] || '') : null,
                crop: mapping.crop ? String(row[mapping.crop] || '') : null,
                landUse: mapping.landUse ? String(row[mapping.landUse] || '') : null
            });
        });

        setParsedSamples(samples);
        setStep(3);
    };

    const handleConfirmImport = () => {
        if (parsedSamples.length === 0) {
            alert('No valid samples to import.');
            return;
        }
        onImport(parsedSamples);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base">Client Manifest Spreadsheet Import</h3>
                            <div className="text-xs text-slate-400">Institutional Delivery Manifests (CSV / XLSX)</div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Stepper Bar */}
                <div className="bg-gray-50 dark:bg-gray-900/50 px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs">
                    <div className={`flex items-center gap-2 font-bold ${step === 1 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>1</span>
                        Upload File
                    </div>
                    <ArrowRight size={14} className="text-gray-300 dark:text-gray-600" />
                    <div className={`flex items-center gap-2 font-bold ${step === 2 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>2</span>
                        Map Columns
                    </div>
                    <ArrowRight size={14} className="text-gray-300 dark:text-gray-600" />
                    <div className={`flex items-center gap-2 font-bold ${step === 3 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>3</span>
                        Review & Batch Receive
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* STEP 1: UPLOAD */}
                    {step === 1 && (
                        <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900/40 text-center">
                            <FileSpreadsheet size={48} className="text-emerald-500 mb-4 animate-bounce" />
                            <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Select or drop client spreadsheet</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)</p>
                            
                            <label className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-md transition-all flex items-center gap-2">
                                <Upload size={16} /> Choose File
                                <input
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    )}

                    {/* STEP 2: COLUMN MAPPING */}
                    {step === 2 && (
                        <div className="space-y-6">
                            {/* Saved Profiles Banner */}
                            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                    <FolderOpen size={16} className="text-blue-600 dark:text-blue-400" />
                                    <span className="font-bold text-gray-700 dark:text-gray-300">Saved Client Mapping Template:</span>
                                    <select
                                        value={selectedProfile}
                                        onChange={(e) => handleLoadProfile(e.target.value)}
                                        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs"
                                    >
                                        <option value="">-- Select Template --</option>
                                        {Object.keys(profiles).map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        placeholder="Profile name (e.g. FAO-KE)"
                                        value={newProfileName}
                                        onChange={(e) => setNewProfileName(e.target.value)}
                                        className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 text-xs w-36"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSaveProfile}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1"
                                    >
                                        <Save size={12} /> Save
                                    </button>
                                </div>
                            </div>

                            {/* Mapping Grid */}
                            <div className="grid md:grid-cols-2 gap-4">
                                {LIMS_FIELDS.map(field => (
                                    <div key={field.key} className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl flex flex-col justify-between">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                                {field.label} {field.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {mapping[field.key] && (
                                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                                    <Check size={10} /> Mapped
                                                </span>
                                            )}
                                        </div>

                                        <select
                                            value={mapping[field.key] || ''}
                                            onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                                            className={`w-full p-2 text-xs rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
                                                mapping[field.key]
                                                    ? 'border-emerald-400 dark:border-emerald-600 font-medium'
                                                    : field.required ? 'border-red-300 dark:border-red-800' : 'border-gray-300 dark:border-gray-600'
                                            }`}
                                        >
                                            <option value="">-- Do Not Import --</option>
                                            {headers.map(h => (
                                                <option key={h} value={h}>{h}</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 3: PREVIEW & CONFIRM */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                                <div className="text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
                                    <Check size={16} /> Successfully parsed {parsedSamples.length} samples from manifest.
                                </div>
                                <div className="text-[11px] text-gray-500">Coordinates parsed automatically (DD/DMS/UTM)</div>
                            </div>

                            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 sticky top-0 font-bold">
                                        <tr>
                                            <th className="p-2.5">#</th>
                                            <th className="p-2.5">Sample ID</th>
                                            <th className="p-2.5">Coordinates</th>
                                            <th className="p-2.5">Depths (cm)</th>
                                            <th className="p-2.5">Mass (g)</th>
                                            <th className="p-2.5">Site / Village</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 font-mono">
                                        {parsedSamples.slice(0, 50).map((s, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                                <td className="p-2 text-gray-400">{idx + 1}</td>
                                                <td className="p-2 font-bold text-gray-900 dark:text-gray-100">{s.originalId}</td>
                                                <td className="p-2">
                                                    {s.latitude && s.longitude
                                                        ? `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`
                                                        : <span className="text-amber-500 font-sans text-[10px]">No GPS</span>
                                                    }
                                                </td>
                                                <td className="p-2">
                                                    {s.depthTopCm !== null && s.depthBottomCm !== null
                                                        ? `${s.depthTopCm} - ${s.depthBottomCm}`
                                                        : '-'
                                                    }
                                                </td>
                                                <td className="p-2">{s.receivedMass || '-'}</td>
                                                <td className="p-2 font-sans text-gray-600 dark:text-gray-400">{s.siteName || s.village || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {parsedSamples.length > 50 && (
                                <div className="text-center text-[11px] text-gray-400">Showing first 50 of {parsedSamples.length} rows...</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between">
                    <div>
                        {step > 1 && (
                            <button
                                type="button"
                                onClick={() => setStep(step - 1)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                            >
                                Back
                            </button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </button>

                        {step === 2 && (
                            <button
                                type="button"
                                onClick={handleGeneratePreview}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors flex items-center gap-1.5"
                            >
                                Preview & Validate <ArrowRight size={14} />
                            </button>
                        )}

                        {step === 3 && (
                            <button
                                type="button"
                                onClick={handleConfirmImport}
                                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-colors flex items-center gap-1.5"
                            >
                                Load {parsedSamples.length} Samples into Batch <Check size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManifestImportModal;
