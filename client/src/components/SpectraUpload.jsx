import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle, FileCode } from 'lucide-react';
import axios from 'axios';

const SpectraUpload = ({ sampleId, onUploadSuccess }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);

    const allowedExtensions = ['.csv', '.dx', '.jdx', '.jcamp', '.txt', '.opus', '.spc', '.asd'];

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            const ext = '.' + selected.name.split('.').pop().toLowerCase();
            if (!allowedExtensions.includes(ext)) {
                setError(`Unsupported file format. Supported: ${allowedExtensions.join(', ')}`);
                return;
            }
            setFile(selected);
            setError(null);

            // Optional client preview for text formats
            if (['.csv', '.txt'].includes(ext)) {
                parseCsvPreview(selected);
            } else if (['.dx', '.jdx', '.jcamp'].includes(ext)) {
                setPreview({ format: 'JCAMP-DX', filename: selected.name, size: selected.size });
            } else {
                setPreview({ format: 'BINARY_SPECTRUM', filename: selected.name, size: selected.size });
            }
        }
    };

    const parseCsvPreview = (fileObj) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            try {
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                let validRows = 0;
                lines.forEach((line, idx) => {
                    if (idx === 0 && isNaN(parseFloat(line.split(',')[0]))) return;
                    const parts = line.split(',');
                    const w = parseFloat(parts[0]);
                    const a = parseFloat(parts[1]);
                    if (!isNaN(w) && !isNaN(a)) validRows++;
                });

                setPreview({ format: 'CSV', count: validRows, filename: fileObj.name });
            } catch (err) {
                setPreview({ format: 'CSV', filename: fileObj.name });
            }
        };
        reader.readAsText(fileObj);
    };

    const handleUpload = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('files', file);
            if (sampleId) {
                formData.append('sampleId', sampleId);
                formData.append('labId', sampleId);
            }

            const res = await axios.post('/api/spectral/batch', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data?.results?.failed > 0 && res.data?.results?.errors?.length > 0) {
                setError(res.data.results.errors[0].error || 'Upload failed');
            } else {
                setFile(null);
                setPreview(null);
                if (onUploadSuccess) onUploadSuccess();
            }
        } catch (err) {
            console.error('[SPECTRA_UPLOAD_ERR]', err);
            setError(err.response?.data?.error || err.response?.data?.message || 'Upload failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Upload size={18} />
                Upload Spectral Scan (Raw Instrument File)
            </h4>

            {!file ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg h-36 flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-blue-400 transition-colors relative">
                    <input
                        type="file"
                        accept=".csv,.dx,.jdx,.jcamp,.txt,.opus,.spc,.asd"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileCode className="text-blue-500 mb-2" size={32} />
                    <span className="text-sm text-gray-700 font-medium">Click or drag raw instrument spectrum</span>
                    <span className="text-xs text-gray-400 mt-1">Supports JCAMP-DX (.dx, .jcamp), CSV, OPUS, SPC, ASD</span>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-white p-3 rounded border">
                        <FileText className="text-blue-500" />
                        <div className="flex-1">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">
                                {(file.size / 1024).toFixed(1)} KB
                                {preview?.count ? ` • ${preview.count} coordinate points detected` : ` • Format: ${preview?.format || 'Raw'}`}
                            </p>
                        </div>
                        <button
                            onClick={() => { setFile(null); setPreview(null); }}
                            className="text-gray-400 hover:text-red-500 text-lg leading-none p-1"
                        >
                            &times;
                        </button>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {loading ? 'Uploading & Parsing...' : (
                            <>
                                <Upload size={16} />
                                Confirm Multipart Upload
                            </>
                        )}
                    </button>
                </div>
            )}

            {error && (
                <div className="mt-3 text-sm text-red-600 flex items-center gap-2 bg-red-50 p-2 rounded border border-red-200">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default SpectraUpload;
