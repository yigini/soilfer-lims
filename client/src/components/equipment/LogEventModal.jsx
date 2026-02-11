import React, { useState } from 'react';
import axios from 'axios';
import { X, ClipboardCheck, Wrench, ShieldAlert, CheckCircle, XCircle, AlertTriangle, Calendar, Info, RefreshCw } from 'lucide-react';

const LogEventModal = ({ show, onClose, asset, eventType, onSuccess }) => {
    const [form, setForm] = useState({
        eventType: eventType || 'MAINTENANCE',
        summary: '',
        details: '',
        outcome: 'PASS',
        nextDueDate: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Sync eventType when the prop changes (e.g. switching between Maintenance and Calibration)
    React.useEffect(() => {
        if (eventType) {
            setForm(prev => ({ ...prev, eventType }));
        }
    }, [eventType]);

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
            setError(err.response?.data?.error || 'Failed to log event');
        } finally {
            setSaving(false);
        }
    };

    const isCalibration = form.eventType.includes('CALIBRATION') || form.eventType.includes('VERIFICATION');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden font-sans" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {isCalibration ? <ClipboardCheck className="text-blue-600" size={20} /> : <Wrench className="text-indigo-600" size={20} />}
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Log {form.eventType.replace(/_/g, ' ')}</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm flex items-center gap-2"><ShieldAlert size={14} /> {error}</div>}

                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 border dark:border-gray-700 text-xs">
                        <div className="text-gray-400 mb-1">Target Instrument</div>
                        <div className="font-bold text-gray-900 dark:text-gray-100">{asset.name} <span className="font-mono ml-2 text-blue-600">{asset.internalAssetTag}</span></div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Summary / ID *</label>
                        <input
                            required
                            value={form.summary}
                            onChange={e => setForm({ ...form, summary: e.target.value })}
                            placeholder="e.g. Annual Calibration Cert #12345"
                            className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Outcome</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, outcome: 'PASS' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${form.outcome === 'PASS' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-bold' : 'border-gray-200 dark:border-gray-700'}`}
                                >
                                    <CheckCircle size={14} /> PASS
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, outcome: 'FAIL' })}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border transition-all ${form.outcome === 'FAIL' ? 'bg-red-50 border-red-500 text-red-700 font-bold' : 'border-gray-200 dark:border-gray-700'}`}
                                >
                                    <XCircle size={14} /> FAIL
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Next Due Date</label>
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
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Detailed Notes</label>
                        <textarea
                            rows={3}
                            value={form.details}
                            onChange={e => setForm({ ...form, details: e.target.value })}
                            placeholder="Enter technical findings, certificate links, or maintenance details..."
                            className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                    </div>

                    {form.outcome === 'FAIL' && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 border border-red-100 dark:border-red-900/40">
                            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                            <p><b>Warning:</b> Marking a calibration or verification as FAIL will automatically set this instrument to OUT OF SERVICE.</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-gray-500 hover:text-gray-700">Cancel</button>
                        <button
                            type="submit"
                            disabled={saving || !form.summary}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
                        >
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : <ClipboardCheck size={16} />}
                            Save Record
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LogEventModal;
