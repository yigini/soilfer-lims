import React, { useState } from 'react';
import axios from 'axios';
import { useLanguage } from '../../context/LanguageContext';
import { X, Plus, Monitor, Tag, Hash, MapPin, ShieldAlert, Info, RefreshCw } from 'lucide-react';

const ASSET_TYPES = ['SPECTROMETER', 'BALANCE', 'PH_METER', 'EC_METER', 'OVEN', 'SHAKER', 'AUTO_ANALYZER', 'OTHER'];

const RegisterAssetModal = ({ show, onClose, onSuccess, asset = null }) => {
    const { t } = useLanguage();
    const [form, setForm] = useState({
        name: '',
        assetType: 'SPECTROMETER',
        manufacturer: '',
        model: '',
        serialNumber: '',
        internalAssetTag: '',
        criticality: 'IMPORTANT',
        locationId: ''
    });

    React.useEffect(() => {
        if (asset) {
            setForm({
                name: asset.name || '',
                assetType: asset.assetType || 'SPECTROMETER',
                manufacturer: asset.manufacturer || '',
                model: asset.model || '',
                serialNumber: asset.serialNumber || '',
                internalAssetTag: asset.internalAssetTag || '',
                criticality: asset.criticality || 'IMPORTANT',
                locationId: asset.locationId || ''
            });
        } else {
            setForm({
                name: '',
                assetType: 'SPECTROMETER',
                manufacturer: '',
                model: '',
                serialNumber: '',
                internalAssetTag: '',
                criticality: 'IMPORTANT',
                locationId: ''
            });
        }
        setError('');
    }, [asset, show]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if (!show) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');

        try {
            if (asset) {
                await axios.put(`/api/equipment/${asset.id}`, form);
            } else {
                await axios.post('/api/equipment', form);
            }
            onSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || `Failed to ${asset ? 'update' : 'register'} equipment`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden font-sans" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {asset ? <Monitor className="text-blue-600" size={20} /> : <Plus className="text-blue-600" size={20} />}
                        <h3 className="text-lg font-bold text-sf-text">
                            {asset ? t('equipment.editAsset', 'Edit Instrument Details') : t('equipment.registerAsset', 'Register New Instrument')}
                        </h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm flex items-center gap-2"><ShieldAlert size={14} /> {error}</div>}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.assetName', 'Display Name')} *</label>
                            <input
                                required
                                value={form.name}
                                onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Bruker NIR #1"
                                className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.type', 'Asset Type')} *</label>
                            <select
                                value={form.assetType}
                                onChange={e => setForm({ ...form, assetType: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {ASSET_TYPES.map(tType => <option key={tType} value={tType}>{t(`dynamic.equipmentType.${tType}.label`, tType.replace(/_/g, ' '))}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.assetTag', 'Internal Asset Tag')} *</label>
                            <input
                                required
                                value={form.internalAssetTag}
                                onChange={e => setForm({ ...form, internalAssetTag: e.target.value })}
                                placeholder="e.g. LAB-001-NIR"
                                className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.manufacturer', 'Manufacturer')}</label>
                            <input
                                value={form.manufacturer}
                                onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                                placeholder="e.g. Bruker"
                                className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.model', 'Model')}</label>
                            <input
                                value={form.model}
                                onChange={e => setForm({ ...form, model: e.target.value })}
                                placeholder="e.g. MPA II"
                                className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.serialNumber', 'Serial Number')}</label>
                            <input
                                value={form.serialNumber}
                                onChange={e => setForm({ ...form, serialNumber: e.target.value })}
                                placeholder="SN12345"
                                className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.status', 'Criticality')}</label>
                            <select
                                value={form.criticality}
                                onChange={e => setForm({ ...form, criticality: e.target.value })}
                                className="w-full px-3 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none"
                            >
                                <option value="CRITICAL">🔥 CRITICAL</option>
                                <option value="IMPORTANT">⚡ IMPORTANT</option>
                                <option value="STANDARD">📦 STANDARD</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{t('equipment.location', 'Location / Bench')}</label>
                        <input
                            value={form.locationId}
                            onChange={e => setForm({ ...form, locationId: e.target.value })}
                            placeholder="e.g. Spectral Bench A"
                            className="w-full px-4 py-2.5 rounded-xl border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm outline-none"
                        />
                    </div>

                    {!asset && (
                        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs flex items-start gap-2 border border-blue-100 dark:border-blue-900/40">
                            <Info size={14} className="mt-0.5 shrink-0" />
                            <p>Newly registered instruments will start in <b>NOT_CONFIGURED</b> readiness state until their first calibration is logged.</p>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="px-4 py-2 font-bold text-gray-500">{t('common.cancel', 'Cancel')}</button>
                        <button
                            type="submit"
                            disabled={saving || !form.name || !form.internalAssetTag}
                            className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all active:scale-95"
                        >
                            {saving ? <RefreshCw size={16} className="animate-spin" /> : (asset ? <Monitor size={16} /> : <Plus size={16} />)}
                            {asset ? t('common.save', 'Save Changes') : t('equipment.registerAsset', 'Register Asset')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RegisterAssetModal;
