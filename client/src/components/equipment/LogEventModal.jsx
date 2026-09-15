import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import { X, ClipboardCheck, Wrench, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Calendar, Info, RefreshCw } from 'lucide-react';

const LogEventModal = ({ show, onClose, asset, eventType, onSuccess }) => {
    const { t } = useLanguage();
    const todayStr = new Date().toISOString().split('T')[0];

    const [form, setForm] = useState({
        eventType: eventType || 'CALIBRATION',
        summary: '',
        performedDate: todayStr,
        details: '',
        outcome: 'PASS',
        nextDueDate: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Sync eventType when the prop changes
    useEffect(() => {
        if (eventType) {
            setForm(prev => ({
                ...prev,
                eventType,
                performedDate: prev.performedDate || todayStr
            }));
        }
    }, [eventType, todayStr]);

    if (!show || !asset) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            await axios.post('/api/equipment/events', {
                equipmentId: asset.id,
                ...form
            });
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || t('equipment.logEventFailed', 'Failed to log event'));
        } finally {
            setSaving(false);
        }
    };

    const isCalibration = form.eventType.includes('CALIBRATION');
    const isVerification = form.eventType.includes('VERIFICATION');
    const isScheduleSensitive = isCalibration || isVerification;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-sans" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {isCalibration ? <ClipboardCheck className="text-blue-600" size={20} /> : <Wrench className="text-indigo-600" size={20} />}
                        <h3 className="text-lg font-bold text-sf-text">{t('equipment.logEvent', 'Log Event')}</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm flex items-center gap-2"><ShieldAlert size={14} /> {error}</div>}

                    <div className="p-3 rounded-xl bg-sf-canvas/40 border dark:border-gray-700 text-xs">
                        <div className="text-gray-400 mb-1">{t('equipment.assetName', 'Target Instrument')}</div>
                        <div className="font-bold text-sf-text">{asset.name} <span className="font-mono ml-2 text-blue-600">{asset.internalAssetTag}</span></div>
                    </div>

                    {/* Event Type Selector */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.eventType', 'Event Type')} *</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, eventType: 'CALIBRATION' })}
                                className={`py-2 px-1 text-xs rounded-lg border font-medium text-center transition-all ${form.eventType === 'CALIBRATION' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold shadow-sm' : 'border-sf-divider hover:bg-sf-canvas'}`}
                            >
                                {t('equipment.typeCalibration', 'Calibration')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, eventType: 'VERIFICATION' })}
                                className={`py-2 px-1 text-xs rounded-lg border font-medium text-center transition-all ${form.eventType === 'VERIFICATION' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold shadow-sm' : 'border-sf-divider hover:bg-sf-canvas'}`}
                            >
                                {t('equipment.typeVerification', 'Verification')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setForm({ ...form, eventType: 'MAINTENANCE' })}
                                className={`py-2 px-1 text-xs rounded-lg border font-medium text-center transition-all ${form.eventType === 'MAINTENANCE' ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-bold shadow-sm' : 'border-sf-divider hover:bg-sf-canvas'}`}
                            >
                                {t('equipment.typeMaintenance', 'Maintenance')}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.logHistory', 'Summary / Certificate #')} *</label>
                        <input
                            required
                            value={form.summary}
                            onChange={e => setForm({ ...form, summary: e.target.value })}
                            placeholder={isCalibration ? "e.g. Annual Calibration Cert #12345" : "e.g. Routine cleaning / verification"}
                            className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.performedDate', 'Date Performed')} *</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    type="date"
                                    required
                                    max={todayStr}
                                    value={form.performedDate}
                                    onChange={e => setForm({ ...form, performedDate: e.target.value })}
                                    className="w-full pl-9 pr-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        {isScheduleSensitive ? (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.nextCalibration', 'Next Due Date')}</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="date"
                                        value={form.nextDueDate}
                                        onChange={e => setForm({ ...form, nextDueDate: e.target.value })}
                                        className="w-full pl-9 pr-3 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.status', 'Outcome')}</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, outcome: 'PASS' })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs transition-all ${form.outcome === 'PASS' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'border-sf-divider'}`}
                                    >
                                        <CheckCircle size={14} /> PASS
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, outcome: 'FAIL' })}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-xs transition-all ${form.outcome === 'FAIL' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'border-sf-divider'}`}
                                    >
                                        <XCircle size={14} /> FAIL
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {isScheduleSensitive && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.status', 'Outcome')}</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, outcome: 'PASS' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${form.outcome === 'PASS' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'border-sf-divider'}`}
                                >
                                    <CheckCircle size={14} /> PASS
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, outcome: 'FAIL' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${form.outcome === 'FAIL' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'border-sf-divider'}`}
                                >
                                    <XCircle size={14} /> FAIL
                                </button>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('workItems.remarks', 'Detailed Notes')}</label>
                        <textarea
                            rows={2}
                            value={form.details}
                            onChange={e => setForm({ ...form, details: e.target.value })}
                            placeholder="Enter technical findings, certificate links, or maintenance details..."
                            className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>

                    {form.outcome === 'FAIL' && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 border border-red-100 dark:border-red-900/40">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                            <p><b>Warning:</b> Marking this event as FAIL will automatically place this instrument into OUT OF SERVICE.</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-gray-500 hover:text-gray-700">{t('common.cancel', 'Cancel')}</button>
                        <button
                            type="submit"
                            disabled={saving || !form.summary}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
                        >
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                            {t('common.save', 'Save Record')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LogEventModal;
