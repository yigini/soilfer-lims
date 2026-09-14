import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
    Monitor, Beaker, Scale, Thermometer, Activity, Search, Plus,
    Settings, Filter, ChevronRight, X, ShieldAlert, AlertTriangle,
    CheckCircle, XCircle, RefreshCw, Calendar, History, Wrench,
    ClipboardCheck, MapPin, Tag, Hash, Info, Download
} from 'lucide-react';

import EquipmentDetailDrawer from '../components/equipment/EquipmentDetailDrawer';
import RegisterAssetModal from '../components/equipment/RegisterAssetModal';

const ASSET_TYPES = ['ALL', 'SPECTROMETER', 'BALANCE', 'PH_METER', 'EC_METER', 'OVEN', 'SHAKER', 'AUTO_ANALYZER', 'OTHER'];
const TYPE_ICONS = {
    SPECTROMETER: Activity,
    BALANCE: Scale,
    PH_METER: Beaker,
    EC_METER: Activity,
    OVEN: Thermometer,
    SHAKER: RefreshCw,
    AUTO_ANALYZER: Monitor,
    OTHER: Tag
};

const READINESS_BADGES = {
    READY: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    BLOCKED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    NOT_CONFIGURED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
};

const STATUS_INDICATORS = {
    IN_SERVICE: 'text-emerald-500',
    MAINTENANCE: 'text-amber-500',
    OUT_OF_SERVICE: 'text-red-500',
    DECOMMISSIONED: 'text-gray-400'
};

const Equipment = () => {
    const { user, hasPermission } = useAuth();
    const { t } = useLanguage();
    const canManage = hasPermission('MANAGE_EQUIPMENT');

    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('ALL');
    const [selectedAsset, setSelectedAsset] = useState(null);
    const [showRegister, setShowRegister] = useState(false);

    const handleExportCSV = () => {
        const headers = ['Name', 'Serial Number', 'Asset Tag', 'Type', 'Status', 'Readiness', 'Last Calibration', 'Next Calibration', 'Manufacturer / Model'];
        const rows = assets.map(a => [
            `"${a.name || ''}"`,
            `"${a.serialNumber || '-'}"`,
            `"${a.internalAssetTag || '-'}"`,
            `"${a.assetType || ''}"`,
            `"${a.status || ''}"`,
            `"${a.readiness || ''}"`,
            a.qualification?.lastCalibrationDate ? `"${new Date(a.qualification.lastCalibrationDate).toLocaleDateString()}"` : '"-"',
            a.qualification?.nextCalibrationDueDate ? `"${new Date(a.qualification.nextCalibrationDueDate).toLocaleDateString()}"` : '"-"',
            `"${(a.manufacturer || '').replace(/"/g, '""')} ${(a.model || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `equipment_registry_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const fetchAssets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/equipment');
            setAssets(res.data);
        } catch (e) {
            console.error('[EQUIPMENT] Fetch failed:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAssets();
    }, [fetchAssets]);

    const filteredAssets = assets.filter(a => {
        const matchesSearch = (a.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (a.internalAssetTag || '').toLowerCase().includes(search.toLowerCase());
        const matchesType = typeFilter === 'ALL' || a.assetType === typeFilter;
        return matchesSearch && matchesType;
    });

    const stats = {
        total: assets.length,
        ready: assets.filter(a => a.readiness === 'READY').length,
        blocked: assets.filter(a => a.readiness === 'BLOCKED').length,
        maintenance: assets.filter(a => a.status === 'MAINTENANCE').length
    };

    return (
        <div className="flex flex-col h-full gap-4 pb-4" data-tour="equipment-container">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-sf-text flex items-center gap-2">
                        <Monitor className="text-blue-600 dark:text-blue-400" size={24} /> {t('equipment.title', 'Equipment Registry')}
                    </h1>
                    <p className="text-sm text-sf-muted">{t('equipment.subtitle', 'Track instrument calibration and maintenance logs')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-bold rounded-lg bg-sf-surface text-sf-muted border dark:border-gray-700 hover:bg-sf-raised transition-colors shadow-sm"
                    >
                        <Download size={16} /> {t('equipment.exportCSV', 'Export')}
                    </button>
                    {canManage && (
                        <button onClick={() => setShowRegister(true)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
                            <Plus size={16} /> {t('equipment.registerAsset', 'Register Instrument')}
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl card-base border flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600"><Monitor size={20} /></div>
                    <div>
                        <div className="text-xl font-bold text-sf-text">{stats.total}</div>
                        <div className="text-xs text-sf-muted">{t('equipment.title', 'Instruments')}</div>
                    </div>
                </div>
                <div className="p-3 rounded-xl card-base border flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600"><CheckCircle size={20} /></div>
                    <div>
                        <div className="text-xl font-bold text-sf-text">{stats.ready}</div>
                        <div className="text-xs text-sf-muted">{t('equipment.ready', 'Ready for Use')}</div>
                    </div>
                </div>
                <div className="p-3 rounded-xl card-base border flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600"><Settings size={20} /></div>
                    <div>
                        <div className="text-xl font-bold text-sf-text">{stats.maintenance}</div>
                        <div className="text-xs text-sf-muted">{t('equipment.maintenance', 'In Maintenance')}</div>
                    </div>
                </div>
                <div className="p-3 rounded-xl card-base border flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600"><ShieldAlert size={20} /></div>
                    <div>
                        <div className="text-xl font-bold text-sf-text">{stats.blocked}</div>
                        <div className="text-xs text-sf-muted">{t('equipment.blocked', 'Blocked / Overdue')}</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
                <div className="relative w-full lg:w-80 flex-shrink-0">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('equipment.searchPlaceholder', 'Search by name, tag, SN...')}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-sf-text outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-wrap items-center gap-1 card-base rounded-lg border p-1">
                    {ASSET_TYPES.map(type => (
                        <button key={type} onClick={() => setTypeFilter(type)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${typeFilter === type
                                ? 'bg-slate-700 dark:bg-slate-600 text-white shadow-sm'
                                : 'text-sf-muted hover:text-gray-900 dark:hover:text-gray-200'}`}>
                            {type === 'ALL' ? t('common.all', 'ALL') : t(`dynamic.equipmentType.${type}.label`, type)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Instrument Table */}
            <div className="card-base rounded-xl shadow-sm border flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-gray-400"><RefreshCw size={24} className="animate-spin mr-2" /> {t('common.loading', 'Loading registry...')}</div>
                ) : filteredAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                        <Monitor size={40} className="mb-2 opacity-40" />
                        <p className="text-sm">{t('common.noRecords', 'No instruments found matching filters')}</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-sf-canvas/60 border-b dark:border-gray-600 sticky top-0">
                            <tr>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase">{t('equipment.assetName', 'Instrument')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase">{t('equipment.model', 'Specification')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase text-center">{t('equipment.status', 'Status')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase text-center">{t('equipment.readiness', 'Readiness')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase">{t('equipment.lastCalibration', 'Last Calib.')}</th>
                                <th className="px-4 py-3 text-xs font-semibold text-sf-muted uppercase text-right">{t('common.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {filteredAssets.map(asset => (
                                <tr key={asset.id} onClick={() => setSelectedAsset(asset)} className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${READINESS_BADGES[asset.readiness]} bg-opacity-10}`}>
                                                {React.createElement(TYPE_ICONS[asset.assetType] || Tag, { size: 18 })}
                                            </div>
                                            <div>
                                                <div className="font-bold text-sf-text">{asset.name}</div>
                                                <div className="text-xs text-gray-400 font-mono">{asset.internalAssetTag}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-xs text-sf-muted">{asset.manufacturer} {asset.model}</div>
                                        <div className="text-[10px] text-gray-400 uppercase tracking-tighter">SN: {asset.serialNumber}</div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className={`flex items-center justify-center gap-1.5 text-xs font-medium ${STATUS_INDICATORS[asset.status]}`}>
                                            <div className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_8px_currentcolor]" />
                                            {t(`equipment.${asset.status.toLowerCase()}`, asset.status.replace(/_/g, ' '))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${READINESS_BADGES[asset.readiness]}`}>
                                            {t(`equipment.${asset.readiness.toLowerCase()}`, asset.readiness)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-xs text-sf-muted">
                                            {asset.qualification?.lastCalibrationDate ? new Date(asset.qualification.lastCalibrationDate).toLocaleDateString() : t('common.never', 'Never')}
                                        </div>
                                        <div className="text-[10px] text-amber-600 font-medium">
                                            {t('equipment.nextCalibration', 'Next')}: {asset.qualification?.nextCalibrationDueDate ? new Date(asset.qualification.nextCalibrationDueDate).toLocaleDateString() : t('common.unscheduled', 'Unscheduled')}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors inline-block" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Detail Drawer */}
            <EquipmentDetailDrawer
                show={!!selectedAsset}
                assetId={selectedAsset?.id}
                onClose={() => setSelectedAsset(null)}
                onUpdate={fetchAssets}
                canManage={canManage}
            />

            <RegisterAssetModal
                show={showRegister}
                onClose={() => setShowRegister(false)}
                onSuccess={fetchAssets}
            />
        </div>
    );
};

export default Equipment;
