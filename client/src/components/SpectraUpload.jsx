import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
import axios from 'axios';

const SpectraUpload = ({ sampleId, onUploadSuccess }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (selected) {
            if (selected.type !== 'text/csv' && !selected.name.endsWith('.csv')) {
                setError('Please upload a valid CSV file.');
                return;
            }
            setFile(selected);
            setError(null);
            parseFile(selected);
        }
    };

    const parseFile = (fileObj) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            try {
                // Simple CSV parse: Wavelength,Absorbance
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
                const wavelengths = [];
                const absorbance = [];
                let validRows = 0;

                lines.forEach((line, idx) => {
                    // Skip header if it looks like text
                    if (idx === 0 && isNaN(parseFloat(line.split(',')[0]))) return;

                    const parts = line.split(',');
                    const w = parseFloat(parts[0]);
                    const a = parseFloat(parts[1]);

                    if (!isNaN(w) && !isNaN(a)) {
                        wavelengths.push(w);
                        absorbance.push(a);
                        validRows++;
                    }
                });

                if (validRows === 0) {
                    setError('No valid data found in CSV. Expected format: Wavelength,Absorbance');
                    setPreview(null);
                } else {
                    setPreview({ wavelengths, absorbance, count: validRows });
                }

            } catch (err) {
                setError('Failed to parse CSV file.');
            }
        };
        reader.readAsText(fileObj);
    };

    const handleUpload = async () => {
        if (!preview) return;
        setLoading(true);

        try {
            await axios.post('/api/spectra/upload', {
                sampleId,
                wavelengths: preview.wavelengths,
                absorbance: preview.absorbance
            });
            setFile(null);
            setPreview(null);
            if (onUploadSuccess) onUploadSuccess();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.error || 'Upload failed.');
        }
        setLoading(false);
    };

    return (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Upload size={18} />
                Upload Spectral Data (CSV)
            </h4>

            {!preview ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg h-32 flex flex-col items-center justify-center cursor-pointer hover:bg-white hover:border-blue-400 transition-colors relative">
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className="text-gray-400 mb-2" size={32} />
                    <span className="text-sm text-gray-500">Click to select CSV file</span>
                    <span className="text-xs text-gray-400 mt-1">Format: Wavelength, Absorbance</span>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 bg-white p-3 rounded border">
                        <FileText className="text-blue-500" />
                        <div className="flex-1">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs text-green-600">{preview.count} data points parsed</p>
                        </div>
                        <button
                            onClick={() => { setFile(null); setPreview(null); }}
                            className="text-gray-400 hover:text-red-500"
                        >
                            &times;
                        </button>
                    </div>

                    <button
                        onClick={handleUpload}
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {loading ? 'Uploading...' : (
                            <>
                                <Upload size={16} />
                                Confirm Upload
                            </>
                        )}
                    </button>
                </div>
            )}

            {error && (
                <div className="mt-3 text-sm text-red-600 flex items-center gap-2 bg-red-50 p-2 rounded">
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}
        </div>
    );
};

export default SpectraUpload;
