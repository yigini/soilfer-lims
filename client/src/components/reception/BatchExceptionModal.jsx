import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Camera, Upload, Trash2 } from 'lucide-react';
import axios from 'axios';

const PRESET_REASONS = [
    'Bag torn / sample leaked in transit',
    'Label missing or completely illegible',
    'Grossly insufficient mass (< 20g)',
    'Non-soil matrix / construction debris',
    'Severe cross-contamination',
    'Sample severely waterlogged / compromised'
];

const BatchExceptionModal = ({ isOpen, sample, index, onClose, onSave }) => {
    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !sample) return null;

    const [status, setStatus] = useState(sample.status || 'ACCEPTED');
    const [rejectionReason, setRejectionReason] = useState(sample.rejectionReason || '');
    const [receivedMass, setReceivedMass] = useState(sample.receivedMass !== undefined && sample.receivedMass !== null ? sample.receivedMass : '');
    const [moistureOnArrival, setMoistureOnArrival] = useState(sample.moistureOnArrival || 'MOIST');
    const [notes, setNotes] = useState(sample.notes || '');
    const [photos, setPhotos] = useState(sample.intakePhotos || []);
    const [uploading, setUploading] = useState(false);

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        setUploading(true);
        const formData = new FormData();
        files.forEach(f => formData.append('photos', f));

        try {
            const token = localStorage.getItem('token');
            const res = await axios.post('/api/reception/upload-photo', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': token ? `Bearer ${token}` : undefined
                }
            });
            if (res.data.success && res.data.photos) {
                setPhotos(prev => [...prev, ...res.data.photos.map(p => p.url)]);
            }
        } catch (err) {
            console.error('Photo upload failed:', err);
            alert('Failed to upload photo: ' + (err.response?.data?.error || err.message));
        } finally {
            setUploading(false);
        }
    };

    const handleRemovePhoto = (photoIdx) => {
        setPhotos(prev => prev.filter((_, i) => i !== photoIdx));
    };

    const handleApply = () => {
        if (status === 'REJECTED' && !rejectionReason.trim()) {
            alert('Please specify a rejection reason for this non-conforming sample.');
            return;
        }

        onSave({
            ...sample,
            status,
            rejectionReason: status === 'REJECTED' ? rejectionReason.trim() : null,
            receivedMass: receivedMass !== '' ? parseFloat(receivedMass) : null,
            moistureOnArrival,
            notes: notes.trim(),
            intakePhotos: photos
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="bg-sf-surface rounded-2xl shadow-2xl border border-sf-divider w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 bg-sf-raised border-b border-sf-divider text-sf-text flex justify-between items-center">
                    <div>
                        <div className="text-xs text-sf-muted font-bold uppercase tracking-wider">Sample Exception Override (Item #{index + 1})</div>
                        <h3 className="text-lg font-bold font-mono text-sf-text">{sample.originalId}</h3>
                    </div>
                    <button onClick={onClose} className="text-sf-muted hover:text-sf-text p-1 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-sf-text">
                    {/* Status Toggle */}
                    <div>
                        <label className="block font-bold mb-2">Sample Reception Decision</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setStatus('ACCEPTED')}
                                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${status === 'ACCEPTED'
                                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                                    : 'border-sf-divider hover:bg-sf-hover text-sf-muted'
                                }`}
                            >
                                <CheckCircle size={18} />
                                Accept Sample
                            </button>

                            <button
                                type="button"
                                onClick={() => setStatus('REJECTED')}
                                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${status === 'REJECTED'
                                    ? 'bg-red-500/10 border-red-500 text-red-700 dark:text-red-300 ring-2 ring-red-500/20'
                                    : 'border-sf-divider hover:bg-sf-hover text-sf-muted'
                                }`}
                            >
                                <AlertTriangle size={18} />
                                Reject Sample (Exception)
                            </button>
                        </div>
                    </div>

                    {/* Rejection Details */}
                    {status === 'REJECTED' && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
                            <label className="block font-bold text-red-900 dark:text-red-300">
                                Rejection Reason <span className="text-red-500">*</span>
                            </label>

                            {/* Preset Reason Chips */}
                            <div className="flex flex-wrap gap-1.5">
                                {PRESET_REASONS.map(reason => (
                                    <button
                                        key={reason}
                                        type="button"
                                        onClick={() => setRejectionReason(reason)}
                                        className={`text-xs px-2.5 py-1 rounded-full border transition-all ${rejectionReason === reason
                                            ? 'bg-red-600 text-white border-red-600 font-bold'
                                            : 'bg-sf-surface border-sf-divider text-sf-text hover:border-red-300'
                                        }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>

                            <textarea
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Explain why this bag cannot be accepted for analytical processing..."
                                className="w-full p-2.5 rounded-lg border border-red-500/30 bg-sf-canvas text-sf-text focus:outline-hidden focus:ring-2 focus:ring-red-500 text-xs"
                                rows={2}
                            />
                        </div>
                    )}

                    {/* Physical Overrides */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-sf-muted mb-1">
                                Received Mass (g)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                value={receivedMass}
                                onChange={(e) => setReceivedMass(e.target.value)}
                                placeholder="e.g. 520"
                                className="w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text text-xs focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-sf-muted mb-1">
                                Moisture State
                            </label>
                            <select
                                value={moistureOnArrival}
                                onChange={(e) => setMoistureOnArrival(e.target.value)}
                                className="w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text text-xs focus:ring-1 focus:ring-emerald-500"
                            >
                                <option value="DRY">Dry (&lt;10%)</option>
                                <option value="MOIST">Moist (10-25%)</option>
                                <option value="WET">Wet (25-40%)</option>
                                <option value="SATURATED">Saturated (&gt;40%)</option>
                            </select>
                        </div>
                    </div>

                    {/* Non-conformance Photo Upload */}
                    <div>
                        <label className="block text-xs font-bold text-sf-muted mb-2 flex items-center gap-1.5">
                            <Camera size={14} /> Photographic Evidence of Condition
                        </label>
                        <div className="flex flex-wrap gap-2 items-center">
                            {photos.map((p, idx) => (
                                <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-sf-divider group">
                                    <img src={p} alt="evidence" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => handleRemovePhoto(idx)}
                                        className="absolute inset-0 bg-red-600/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-sf-divider hover:border-emerald-500 flex flex-col items-center justify-center cursor-pointer text-sf-muted hover:text-emerald-500 transition-colors">
                                <Upload size={18} />
                                <span className="text-[9px] font-bold mt-1">Upload</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handlePhotoUpload}
                                    disabled={uploading}
                                    className="hidden"
                                />
                            </label>
                            {uploading && <span className="text-xs text-blue-500 animate-pulse">Uploading...</span>}
                        </div>
                    </div>

                    {/* Specific Notes */}
                    <div>
                        <label className="block text-xs font-bold text-sf-muted mb-1">
                            Sample-Specific Intake Notes
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. Sample bag label smudged with water, verified via field sheet"
                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text text-xs focus:ring-1 focus:ring-emerald-500"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-sf-canvas/40 border-t border-sf-divider flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-sf-muted hover:bg-sf-hover hover:text-sf-text transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleApply}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors"
                    >
                        Apply Override
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BatchExceptionModal;
