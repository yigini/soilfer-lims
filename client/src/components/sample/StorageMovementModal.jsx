import React, { useState } from 'react';
import axios from 'axios';
import { Package, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const StorageMovementModal = ({ sampleId, currentLocation, isOpen, onClose, onSuccess }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);
    const { t } = useLanguage();
    const [location, setLocation] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmedLoc = location.trim();
        const trimmedReason = reason.trim();
        if (!trimmedLoc) {
            setError('New location is required');
            return;
        }
        if (!trimmedReason) {
            setError('Reason for storage movement is required');
            return;
        }

        setSubmitting(true);
        setError('');
        try {
            await axios.post(`/api/samples/${sampleId}/custody/move`, {
                location: trimmedLoc,
                reason: trimmedReason
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to record storage movement');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md p-6 border border-sf-divider">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-sf-text flex items-center gap-2">
                        <Package size={20} className="text-sf-emerald" />
                        {t('custody.recordMovement', 'Record Storage Movement')}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-sf-raised rounded-lg text-gray-500">
                        <X size={18} />
                    </button>
                </div>

                <div className="mb-4 text-xs text-sf-muted">
                    <div>{t('custody.currentLocation', 'Current location')}: <strong className="text-sf-text">{currentLocation || 'Not recorded'}</strong></div>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div>
                        <label className="block text-xs font-bold text-sf-muted mb-1">
                            {t('custody.newLocation', 'New Storage Location')} <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. Cabinet A / Shelf 2 / Box 04"
                            className="w-full text-sm p-2.5 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text focus:ring-2 focus:ring-indigo-500 outline-none"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-sf-muted mb-1">
                            {t('custody.reason', 'Reason for Movement')} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Aliquot transfer, archive relocation, cold room storage..."
                            rows={3}
                            className="w-full text-xs p-2.5 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-sf-muted hover:bg-sf-raised rounded-lg transition-colors"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !location.trim() || !reason.trim()}
                            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {submitting ? t('common.saving', 'Saving...') : t('custody.saveMovement', 'Record Movement')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StorageMovementModal;
