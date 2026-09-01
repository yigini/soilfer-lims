import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Key, Plus, Trash2, Copy, CheckCircle2, Shield, Globe, 
    Database, ExternalLink, Code2, RefreshCw, AlertTriangle, 
    Layers, Terminal, Check
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import { useLanguage } from '../../context/LanguageContext';

const ApiKeyManager = () => {
    const { t } = useLanguage();
    const { showDialog } = useDialog();
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    // New key form
    const [name, setName] = useState('');
    const [role, setRole] = useState('NSIS_CONSUMER');
    const [selectedCountries, setSelectedCountries] = useState(['*']);
    const [expiresDays, setExpiresDays] = useState(365);
    const [creating, setCreating] = useState(false);

    // Newly generated key modal
    const [generatedKey, setGeneratedKey] = useState(null);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState('keys'); // 'keys' | 'docs'

    const COUNTRIES = [
        { code: '*', label: 'All Countries (*)' },
        { code: 'GTM', label: 'Guatemala (GTM)' },
        { code: 'HND', label: 'Honduras (HND)' },
        { code: 'KEN', label: 'Kenya (KEN)' },
        { code: 'ZMB', label: 'Zambia (ZMB)' },
        { code: 'GHA', label: 'Ghana (GHA)' },
        { code: 'MOZ', label: 'Mozambique (MOZ)' },
        { code: 'TUN', label: 'Tunisia (TUN)' }
    ];

    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/sis/keys');
            setKeys(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch API keys:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateKey = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setCreating(true);
        try {
            const res = await axios.post('/api/v1/sis/keys', {
                name,
                role,
                countries: selectedCountries.includes('*') ? null : selectedCountries,
                expiresDays: parseInt(expiresDays) || 365
            });

            setGeneratedKey(res.data.apiKey);
            setIsCreateModalOpen(false);
            setName('');
            fetchKeys();
        } catch (err) {
            showDialog({
                title: 'Creation Failed',
                message: err.response?.data?.error || err.message,
                type: 'error'
            });
        } finally {
            setCreating(false);
        }
    };

    const handleRevokeKey = (keyId, keyName) => {
        showDialog({
            title: 'Revoke API Key?',
            message: `Are you sure you want to revoke "${keyName}"? Any external Soil Information System using this key will immediately lose API access.`,
            type: 'confirm',
            confirmText: 'Revoke Key',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/v1/sis/keys/${keyId}`);
                    fetchKeys();
                } catch (err) {
                    showDialog({
                        title: 'Error',
                        message: err.response?.data?.error || err.message,
                        type: 'error'
                    });
                }
            }
        });
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="p-6 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-blue-500/30 rounded-lg text-blue-300">
                            <Database size={20} />
                        </span>
                        <h2 className="text-xl font-black">Soil Information System (SIS / NSIS) API Gateway</h2>
                    </div>
                    <p className="text-sm text-blue-200">
                        Expose standardized soil field provenance, laboratory analytical chemistry, and spectral libraries to external national information systems and geoportals.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab(activeTab === 'keys' ? 'docs' : 'keys')}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                    >
                        <Code2 size={16} /> {activeTab === 'keys' ? 'API Documentation' : 'Manage Keys'}
                    </button>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
                    >
                        <Plus size={16} /> Generate API Key
                    </button>
                </div>
            </div>

            {/* View Tabs */}
            {activeTab === 'keys' ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Key size={16} /> Active Integration Keys ({keys.length})
                        </h3>
                        <button
                            onClick={fetchKeys}
                            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
                            title="Refresh Keys"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-400 text-sm">Loading integration keys...</div>
                    ) : keys.length === 0 ? (
                        <div className="p-12 text-center bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-200 dark:border-gray-700">
                            <Key size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                            <h4 className="font-bold text-gray-800 dark:text-gray-200">No API Keys Generated Yet</h4>
                            <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                                Generate an API key to allow national soil mapping tools, QGIS, or Space2Place to ingest verified analytical results automatically.
                            </p>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                            >
                                <Plus size={14} /> Create First Key
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                                    <tr>
                                        <th className="p-4">Consumer / Key Name</th>
                                        <th className="p-4">Key Prefix</th>
                                        <th className="p-4">Role & Scope</th>
                                        <th className="p-4">Last Used</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {keys.map((k) => (
                                        <tr key={k.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900 dark:text-white">{k.name}</div>
                                                <div className="text-xs text-gray-400">Created by {k.createdBy || 'Admin'}</div>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                                                {k.keyPrefix}
                                            </td>
                                            <td className="p-4 space-y-1">
                                                <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold">
                                                    {k.role}
                                                </span>
                                                <div className="text-xs text-gray-500">
                                                    Countries: {k.countries?.join(', ') || 'All (*)'}
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs text-gray-500">
                                                {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td className="p-4">
                                                {k.isActive ? (
                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold">
                                                        Revoked
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-right">
                                                {k.isActive && (
                                                    <button
                                                        onClick={() => handleRevokeKey(k.id, k.name)}
                                                        className="p-2 text-gray-400 hover:text-red-600 transition"
                                                        title="Revoke API Key"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                /* Interactive API Documentation Tab */
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                            <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                                <Globe size={18} className="text-emerald-500" />
                                <span>1. GeoJSON FeatureCollection (GIS)</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Standard OGC-compliant GeoJSON endpoint for real-time spatial layer ingestion into QGIS, ArcGIS, Mapbox, or Leaflet.
                            </p>
                            <div className="p-3 bg-gray-900 text-gray-200 font-mono text-xs rounded-xl flex items-center justify-between">
                                <span className="truncate">GET /api/v1/sis/geojson?country=GTM</span>
                                <button
                                    onClick={() => copyToClipboard('curl -H "X-API-KEY: slims_live_..." "https://lims.yigini.net/api/v1/sis/geojson?country=GTM"')}
                                    className="p-1 hover:text-white text-gray-400"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                            <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                                <Database size={18} className="text-blue-500" />
                                <span>2. Full Sample Registry & Results</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Paginated list of soil samples with complete field provenance, depth horizon, crop history, and approved wet chemistry.
                            </p>
                            <div className="p-3 bg-gray-900 text-gray-200 font-mono text-xs rounded-xl flex items-center justify-between">
                                <span className="truncate">GET /api/v1/sis/samples?page=1&limit=50</span>
                                <button
                                    onClick={() => copyToClipboard('curl -H "X-API-KEY: slims_live_..." "https://lims.yigini.net/api/v1/sis/samples?page=1&limit=50"')}
                                    className="p-1 hover:text-white text-gray-400"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                            <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                                <RefreshCw size={18} className="text-purple-500" />
                                <span>3. Incremental Delta Sync (ETL)</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Allows national data pipelines to fetch only new or updated samples and spectra since the last synchronization timestamp.
                            </p>
                            <div className="p-3 bg-gray-900 text-gray-200 font-mono text-xs rounded-xl flex items-center justify-between">
                                <span className="truncate">GET /api/v1/sis/sync?updatedSince=2026-08-01</span>
                                <button
                                    onClick={() => copyToClipboard('curl -H "X-API-KEY: slims_live_..." "https://lims.yigini.net/api/v1/sis/sync?updatedSince=2026-08-01T00:00:00Z"')}
                                    className="p-1 hover:text-white text-gray-400"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                            <div className="flex items-center gap-2 font-bold text-sm text-gray-900 dark:text-white">
                                <Layers size={18} className="text-amber-500" />
                                <span>4. Spectral Library Matrix (NIR/MIR)</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Access raw and preprocessed Vis-NIR and MIR spectral arrays with wavenumber vectors for national chemometric calibrations.
                            </p>
                            <div className="p-3 bg-gray-900 text-gray-200 font-mono text-xs rounded-xl flex items-center justify-between">
                                <span className="truncate">GET /api/v1/sis/spectra?modality=MIR</span>
                                <button
                                    onClick={() => copyToClipboard('curl -H "X-API-KEY: slims_live_..." "https://lims.yigini.net/api/v1/sis/spectra?modality=MIR"')}
                                    className="p-1 hover:text-white text-gray-400"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create API Key Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
                            <Key size={20} className="text-blue-600" /> Generate SIS Integration Key
                        </div>
                        <p className="text-xs text-gray-500">
                            Issue an API Key for external government databases, FAO GLOSIS, or automated GIS pipelines.
                        </p>

                        <form onSubmit={handleCreateKey} className="space-y-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    Integration Name / Consumer Label *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Guatemala NSIS Harvester"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    Access Role
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="NSIS_CONSUMER">NSIS Consumer (Verified Data & Metadata)</option>
                                    <option value="EXTERNAL_GIS">GIS Harvester (Spatial & Analytical)</option>
                                    <option value="GLOBAL_HARVESTER">Global Soil Partnership (Full Data)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    Country Scope
                                </label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {COUNTRIES.map((c) => (
                                        <label key={c.code} className="flex items-center gap-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedCountries.includes(c.code)}
                                                onChange={(e) => {
                                                    if (c.code === '*') {
                                                        setSelectedCountries(['*']);
                                                    } else {
                                                        const filtered = selectedCountries.filter(x => x !== '*');
                                                        if (e.target.checked) {
                                                            setSelectedCountries([...filtered, c.code]);
                                                        } else {
                                                            setSelectedCountries(filtered.filter(x => x !== c.code));
                                                        }
                                                    }
                                                }}
                                                className="rounded text-blue-600"
                                            />
                                            <span className="font-semibold">{c.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    Key Expiration
                                </label>
                                <select
                                    value={expiresDays}
                                    onChange={(e) => setExpiresDays(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-medium outline-none"
                                >
                                    <option value="90">90 Days</option>
                                    <option value="180">180 Days</option>
                                    <option value="365">1 Year (365 Days)</option>
                                    <option value="730">2 Years</option>
                                    <option value="0">Never Expires</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xs font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
                                >
                                    {creating ? 'Generating...' : 'Generate Secret Key'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Secret Key Display Modal (Shown only once) */}
            {generatedKey && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 text-center border border-gray-200 dark:border-gray-700 animate-in zoom-in-95">
                        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                            <CheckCircle2 size={32} />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">API Key Successfully Generated</h3>
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                                ⚠️ Make sure to copy your API key now. You will not be able to see it again!
                            </p>
                        </div>

                        <div className="p-4 bg-gray-900 text-emerald-400 font-mono text-xs rounded-2xl flex items-center justify-between gap-3 border border-gray-800 break-all select-all">
                            <span>{generatedKey}</span>
                            <button
                                onClick={() => copyToClipboard(generatedKey)}
                                className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl flex-shrink-0 transition flex items-center gap-1 text-xs"
                            >
                                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                <span>{copied ? 'Copied' : 'Copy'}</span>
                            </button>
                        </div>

                        <button
                            onClick={() => setGeneratedKey(null)}
                            className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs transition"
                        >
                            I Have Saved This Key Securely
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiKeyManager;
