import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
    Key, Plus, Trash2, Copy, CheckCircle2, Shield, Globe, 
    Database, ExternalLink, Code2, RefreshCw, AlertTriangle, 
    Layers, Terminal, Check, Play, BookOpen, Sparkles, 
    Sliders, ArrowRight, Clock, Lock, CheckCheck, FileText
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import { useLanguage } from '../../context/LanguageContext';

const ApiKeyManager = () => {
    const { t } = useLanguage();
    const { showDialog } = useDialog();
    
    // Core state
    const [keys, setKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('keys'); // 'keys' | 'guide' | 'explorer'

    // Key creation modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [role, setRole] = useState('NSIS_CONSUMER');
    const [selectedCountries, setSelectedCountries] = useState(['*']);
    const [expiresDays, setExpiresDays] = useState(365);
    const [creating, setCreating] = useState(false);

    // Newly generated key modal
    const [generatedKey, setGeneratedKey] = useState(null);
    const [copied, setCopied] = useState(false);

    // API Explorer & Sandbox state
    const [selectedEndpoint, setSelectedEndpoint] = useState('/api/v1/data-exchange/stats');
    const [paramCountry, setParamCountry] = useState('');
    const [paramLimit, setParamLimit] = useState(5);
    const [paramPage, setParamPage] = useState(1);
    const [paramModality, setParamModality] = useState('MIR');
    const [paramSince, setParamSince] = useState('2026-01-01T00:00:00Z');
    const [customApiKey, setCustomApiKey] = useState('');
    const [sandboxLoading, setSandboxLoading] = useState(false);
    const [sandboxResponse, setSandboxResponse] = useState(null);
    const [sandboxStatus, setSandboxStatus] = useState(null);
    const [sandboxLatency, setSandboxLatency] = useState(null);
    const [sandboxCodeLang, setSandboxCodeLang] = useState('curl'); // 'curl' | 'python' | 'r' | 'js'

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

    const ENDPOINTS = [
        {
            path: '/api/v1/data-exchange/stats',
            title: 'System Health & Statistics',
            desc: 'Aggregate sample counts, approved determinations, laboratory active counts, and metrological metrics.',
            category: 'System'
        },
        {
            path: '/api/v1/data-exchange/samples',
            title: 'Samples Registry & Provenance',
            desc: 'Full sample registry with geospatial coordinates, depth horizons, field intake metadata, and lab tracking.',
            category: 'Core Data'
        },
        {
            path: '/api/v1/data-exchange/results',
            title: 'Analytical Chemistry Matrix',
            desc: 'Complete tabular soil determinations with method references, controlled units, analytical basis, and provenance.',
            category: 'Core Data'
        },
        {
            path: '/api/v1/data-exchange/geojson',
            title: 'GIS Spatial FeatureCollection',
            desc: 'RFC 7946 GeoJSON FeatureCollection stream optimized for QGIS, ArcGIS, Mapbox, and GeoNode ingestion.',
            category: 'Spatial'
        },
        {
            path: '/api/v1/data-exchange/spectra',
            title: 'Spectroscopy Dataset (NIR/MIR)',
            desc: 'Calibrated spectral signatures (MIR 400-4000 cm⁻¹ & Vis-NIR) linked to physical soil specimens.',
            category: 'Spectral'
        },
        {
            path: '/api/v1/data-exchange/sync',
            title: 'Delta Synchronization (ETL)',
            desc: 'Incremental harvesting endpoint returning records modified since a given timestamp.',
            category: 'ETL'
        }
    ];

    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/v1/data-exchange/keys');
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
            const res = await axios.post('/api/v1/data-exchange/keys', {
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
                    await axios.delete(`/api/v1/data-exchange/keys/${keyId}`);
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

    // Build URL for current sandbox config
    const buildSandboxUrl = () => {
        const params = new URLSearchParams();
        if (paramCountry) params.append('country', paramCountry);
        if (selectedEndpoint.includes('/samples') || selectedEndpoint.includes('/results')) {
            if (paramLimit) params.append('limit', paramLimit);
            if (paramPage && paramPage > 1) params.append('page', paramPage);
        }
        if (selectedEndpoint.includes('/spectra') && paramModality) {
            params.append('modality', paramModality);
        }
        if (selectedEndpoint.includes('/sync') && paramSince) {
            params.append('since', paramSince);
        }
        const qs = params.toString();
        return `${selectedEndpoint}${qs ? `?${qs}` : ''}`;
    };

    // Execute Sandbox API Request
    const handleRunSandbox = async () => {
        setSandboxLoading(true);
        setSandboxResponse(null);
        setSandboxStatus(null);
        setSandboxLatency(null);

        const startTime = Date.now();
        const url = buildSandboxUrl();

        try {
            const config = {};
            if (customApiKey.trim()) {
                config.headers = { 'X-API-Key': customApiKey.trim() };
            }
            const res = await axios.get(url, config);
            const latency = Date.now() - startTime;

            setSandboxStatus({ code: res.status, text: res.statusText || 'OK', ok: true });
            setSandboxLatency(latency);
            setSandboxResponse(res.data);
        } catch (err) {
            const latency = Date.now() - startTime;
            const status = err.response?.status || 500;
            const statusText = err.response?.statusText || err.message;
            setSandboxStatus({ code: status, text: statusText, ok: false });
            setSandboxLatency(latency);
            setSandboxResponse(err.response?.data || { error: err.message });
        } finally {
            setSandboxLoading(false);
        }
    };

    // Generate language snippet
    const generateSnippet = () => {
        const urlPath = buildSandboxUrl();
        const origin = window.location.origin;
        const fullUrl = `${origin}${urlPath}`;
        const key = customApiKey.trim() || 'slims_live_YOUR_API_KEY';

        switch (sandboxCodeLang) {
            case 'curl':
                return `curl -X GET "${fullUrl}" \\\n  -H "X-API-Key: ${key}" \\\n  -H "Accept: application/json"`;
            case 'python':
                return `import requests\n\nurl = "${fullUrl}"\nheaders = {\n    "X-API-Key": "${key}",\n    "Accept": "application/json"\n}\n\nresponse = requests.get(url, headers=headers)\ndata = response.json()\nprint(data)`;
            case 'r':
                return `library(httr2)\n\nreq <- request("${fullUrl}") %>%\n  req_headers(\n    "X-API-Key" = "${key}",\n    "Accept" = "application/json"\n  )\n\nresp <- req_perform(req)\ndata <- resp_body_json(resp)\nprint(data)`;
            case 'js':
                return `const response = await fetch("${fullUrl}", {\n  headers: {\n    "X-API-Key": "${key}",\n    "Accept": "application/json"\n  }\n});\nconst data = await response.json();\nconsole.log(data);`;
            default:
                return '';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-indigo-900/50">
                <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 bg-blue-500/20 text-blue-400 rounded-xl border border-blue-500/30">
                            <Database size={22} />
                        </span>
                        <div>
                            <h2 className="text-xl font-black tracking-tight">National SIS & Data Exchange Gateway</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Spec v1.0.0
                                </span>
                                <span className="text-xs text-blue-200">
                                    FAO OpenNSIS & Global Soil Partnership Interoperability
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-blue-100/80 leading-relaxed pt-1">
                        Secure machine-to-machine interface for exporting verified laboratory chemistry, physical metrology, Vis-NIR/MIR spectra, and geospatial soil provenance to national soil information systems and GIS portals.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-blue-600/30"
                    >
                        <Plus size={16} /> Generate API Key
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
                <button
                    onClick={() => setActiveTab('keys')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                        activeTab === 'keys'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                    <Key size={16} /> Active API Keys ({keys.length})
                </button>
                <button
                    onClick={() => setActiveTab('guide')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                        activeTab === 'guide'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                    <BookOpen size={16} /> Step-by-Step Guide
                </button>
                <button
                    onClick={() => setActiveTab('explorer')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                        activeTab === 'explorer'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                    <Play size={16} /> Live API Sandbox & Tester
                </button>
            </div>

            {/* TAB 1: ACTIVE KEYS */}
            {activeTab === 'keys' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Key size={16} className="text-blue-500" /> Authorized External Consumer Keys
                            </h3>
                            <p className="text-xs text-gray-500">
                                Cryptographically hashed API tokens. Keys can be scoped to specific countries or roles and revoked instantly.
                            </p>
                        </div>
                        <button
                            onClick={fetchKeys}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                            title="Refresh Keys"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-400 text-sm">Loading authorized keys...</div>
                    ) : keys.length === 0 ? (
                        <div className="p-12 text-center bg-gray-50 dark:bg-gray-800/40 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 space-y-3">
                            <Key size={40} className="mx-auto text-gray-400" />
                            <h4 className="font-bold text-gray-800 dark:text-gray-200">No Integration Keys Generated</h4>
                            <p className="text-xs text-gray-500 max-w-md mx-auto">
                                To connect your National Soil Information System (NSIS), QGIS, or an automated harvester, generate your first secure API key.
                            </p>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md"
                            >
                                <Plus size={14} /> Generate First Key
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
                                    <tr>
                                        <th className="p-4">Integration / Consumer</th>
                                        <th className="p-4">Key Identifier</th>
                                        <th className="p-4">Role & Scope</th>
                                        <th className="p-4">Created / Last Used</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {keys.map((k) => (
                                        <tr key={k.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900 dark:text-white">{k.name}</div>
                                                <div className="text-xs text-gray-400">Owner: {k.createdBy || 'Administrator'}</div>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                                                {k.keyPrefix}••••••••
                                            </td>
                                            <td className="p-4 space-y-1">
                                                <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold">
                                                    {k.role}
                                                </span>
                                                <div className="text-xs text-gray-500">
                                                    Territory: {k.countries?.join(', ') || 'Global (*)'}
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs text-gray-500 space-y-0.5">
                                                <div>Created: {new Date(k.createdAt).toLocaleDateString()}</div>
                                                <div>Used: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</div>
                                            </td>
                                            <td className="p-4">
                                                {k.isActive ? (
                                                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
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
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
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
            )}

            {/* TAB 2: STEP-BY-STEP USER GUIDE */}
            {activeTab === 'guide' && (
                <div className="space-y-6">
                    <div className="p-5 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                        <Sparkles size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">
                                How to Connect External Systems in 4 Simple Steps
                            </h4>
                            <p className="text-xs text-blue-800/80 dark:text-blue-300/80 leading-relaxed">
                                SoilFER-LIMS provides automated data exchange with National Soil Information Systems (NSIS), FAO OpenNSIS, and GIS spatial portals. Follow this visual roadmap to integrate your platform.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Step 1 */}
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center">
                                    1
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 rounded-lg">
                                    Provisioning
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base">Generate an Integration Key</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    Click <strong>"Generate API Key"</strong>. Provide a descriptive label (e.g. <em>Guatemala NSIS Node</em>), pick an access role, and select the permitted country scope.
                                </p>
                            </div>
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                    <Lock size={14} /> Security Notice
                                </div>
                                <p>The secret key (starts with <code className="font-mono font-bold">slims_live_</code>) is shown only once upon creation. Copy and store it in your server secrets vault.</p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                                    2
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2.5 py-1 rounded-lg">
                                    Authentication
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base">Authenticate HTTP Requests</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    Every HTTP request sent to SoilFER-LIMS must transmit the secret key via the <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">X-API-Key</code> request header.
                                </p>
                            </div>
                            <div className="p-3 bg-gray-900 text-gray-200 rounded-xl font-mono text-xs space-y-1 border border-gray-800">
                                <div className="text-gray-500 text-[10px]">// Example Request Header</div>
                                <div className="text-emerald-400">X-API-Key: slims_live_abc123...</div>
                                <div className="text-blue-300">Accept: application/json</div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-purple-600 text-white font-black text-sm flex items-center justify-center">
                                    3
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/40 px-2.5 py-1 rounded-lg">
                                    Harvesting
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base">Select Your Target Endpoint</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    Depending on your application requirements, choose between tabular wet chemistry, spatial GIS layers, or delta synchronization:
                                </p>
                            </div>
                            <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                                <li className="flex items-center gap-2">
                                    <Globe size={14} className="text-emerald-500 flex-shrink-0" />
                                    <span><strong>/geojson</strong>: Direct GIS spatial layer (QGIS, ArcGIS).</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Database size={14} className="text-blue-500 flex-shrink-0" />
                                    <span><strong>/results</strong>: Laboratory chemistry with units and ISO methods.</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <RefreshCw size={14} className="text-purple-500 flex-shrink-0" />
                                    <span><strong>/sync?since=...</strong>: Automated incremental ETL jobs.</span>
                                </li>
                            </ul>
                        </div>

                        {/* Step 4 */}
                        <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                                    4
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 px-2.5 py-1 rounded-lg">
                                    Verification
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-base">Test Live with Built-in Sandbox</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    You can test your endpoints and preview real JSON responses directly inside the built-in Sandbox tool without writing code!
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveTab('explorer')}
                                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                            >
                                <Play size={14} /> Open Live API Sandbox
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: INTERACTIVE API EXPLORER & TESTER */}
            {activeTab === 'explorer' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Request Builder */}
                    <div className="lg:col-span-5 space-y-4 bg-white dark:bg-gray-800 p-6 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Sliders size={16} className="text-blue-500" /> Interactive Request Builder
                            </h3>
                            <p className="text-xs text-gray-500">
                                Configure endpoint parameters and run live queries against the active server.
                            </p>
                        </div>

                        {/* Endpoint Selector */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                                Target Endpoint
                            </label>
                            <select
                                value={selectedEndpoint}
                                onChange={(e) => setSelectedEndpoint(e.target.value)}
                                className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {ENDPOINTS.map((ep) => (
                                    <option key={ep.path} value={ep.path}>
                                        [{ep.category}] {ep.title} ({ep.path})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-gray-400 italic">
                                {ENDPOINTS.find(ep => ep.path === selectedEndpoint)?.desc}
                            </p>
                        </div>

                        {/* Query Parameters */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border border-gray-200 dark:border-gray-700/50 space-y-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Query Parameters
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                        Country Scope
                                    </label>
                                    <select
                                        value={paramCountry}
                                        onChange={(e) => setParamCountry(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                    >
                                        <option value="">All Permitted Countries</option>
                                        <option value="GTM">Guatemala (GTM)</option>
                                        <option value="HND">Honduras (HND)</option>
                                        <option value="KEN">Kenya (KEN)</option>
                                        <option value="ZMB">Zambia (ZMB)</option>
                                        <option value="GHA">Ghana (GHA)</option>
                                        <option value="MOZ">Mozambique (MOZ)</option>
                                        <option value="TUN">Tunisia (TUN)</option>
                                    </select>
                                </div>

                                {(selectedEndpoint.includes('/samples') || selectedEndpoint.includes('/results')) && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                            Limit (Records)
                                        </label>
                                        <input
                                            type="number"
                                            value={paramLimit}
                                            onChange={(e) => setParamLimit(e.target.value)}
                                            min="1"
                                            max="100"
                                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-medium"
                                        />
                                    </div>
                                )}

                                {selectedEndpoint.includes('/spectra') && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                            Modality
                                        </label>
                                        <select
                                            value={paramModality}
                                            onChange={(e) => setParamModality(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs"
                                        >
                                            <option value="MIR">Mid-Infrared (MIR 400-4000 cm⁻¹)</option>
                                            <option value="NIR">Vis-NIR (350-2500 nm)</option>
                                        </select>
                                    </div>
                                )}

                                {selectedEndpoint.includes('/sync') && (
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-300 mb-1">
                                            Since (ISO 8601 Timestamp)
                                        </label>
                                        <input
                                            type="text"
                                            value={paramSince}
                                            onChange={(e) => setParamSince(e.target.value)}
                                            placeholder="2026-01-01T00:00:00Z"
                                            className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-mono"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Optional Custom Key */}
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                                Test with Specific API Key (Optional)
                            </label>
                            <input
                                type="text"
                                value={customApiKey}
                                onChange={(e) => setCustomApiKey(e.target.value)}
                                placeholder="Auto: Uses Current Admin Session"
                                className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs font-mono outline-none"
                            />
                            <p className="text-[10px] text-gray-400">
                                Leave blank to use your current logged-in browser session automatically.
                            </p>
                        </div>

                        {/* Execute Button */}
                        <button
                            onClick={handleRunSandbox}
                            disabled={sandboxLoading}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                        >
                            {sandboxLoading ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>Querying Endpoint...</span>
                                </>
                            ) : (
                                <>
                                    <Play size={16} />
                                    <span>Execute Live Query</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right Column: Code Snippets & Response Viewer */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Code Snippet Box */}
                        <div className="bg-gray-900 text-gray-200 rounded-3xl p-5 border border-gray-800 shadow-sm space-y-3">
                            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
                                <div className="flex items-center gap-2 text-xs font-bold">
                                    <Terminal size={16} className="text-blue-400" />
                                    <span>Ready-to-use Code Snippet</span>
                                </div>
                                <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-xl">
                                    {['curl', 'python', 'r', 'js'].map((lang) => (
                                        <button
                                            key={lang}
                                            onClick={() => setSandboxCodeLang(lang)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition ${
                                                sandboxCodeLang === lang
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            {lang}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative">
                                <pre className="p-3.5 bg-black/40 rounded-2xl font-mono text-xs text-blue-300 overflow-x-auto leading-relaxed max-h-48">
                                    {generateSnippet()}
                                </pre>
                                <button
                                    onClick={() => copyToClipboard(generateSnippet())}
                                    className="absolute top-2 right-2 p-1.5 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg text-xs flex items-center gap-1 transition shadow"
                                    title="Copy Code"
                                >
                                    {copied ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Response Output Box */}
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                            <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
                                <div className="flex items-center gap-2">
                                    <Code2 size={16} className="text-emerald-500" />
                                    <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                                        Server Response Payload
                                    </span>
                                </div>

                                {sandboxStatus && (
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className={`px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                                            sandboxStatus.ok
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                        }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${sandboxStatus.ok ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                            {sandboxStatus.code} {sandboxStatus.text}
                                        </span>
                                        {sandboxLatency && (
                                            <span className="text-gray-400 font-mono text-[11px]">
                                                {sandboxLatency} ms
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {sandboxResponse ? (
                                <div className="relative">
                                    <pre className="p-4 bg-gray-950 text-emerald-400 rounded-2xl font-mono text-xs overflow-x-auto max-h-96 leading-relaxed border border-gray-900 select-all">
                                        {JSON.stringify(sandboxResponse, null, 2)}
                                    </pre>
                                    <button
                                        onClick={() => copyToClipboard(JSON.stringify(sandboxResponse, null, 2))}
                                        className="absolute top-3 right-3 p-1.5 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg text-xs flex items-center gap-1 transition shadow"
                                        title="Copy JSON"
                                    >
                                        {copied ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                        <span className="text-[10px]">{copied ? 'Copied JSON' : 'Copy JSON'}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="p-10 text-center text-gray-400 text-xs border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl space-y-2">
                                    <Terminal size={24} className="mx-auto text-gray-400" />
                                    <div>Click <strong>"Execute Live Query"</strong> above to send a real request and view the response.</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create API Key Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2 font-bold text-lg text-gray-900 dark:text-white">
                            <Key size={20} className="text-blue-600" /> Issue Integration Secret Key
                        </div>
                        <p className="text-xs text-gray-500">
                            Create a cryptographically hashed access token for an external NSIS server, GIS system, or automated harvester.
                        </p>

                        <form onSubmit={handleCreateKey} className="space-y-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    Integration Name / Consumer Label *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Kenya National Soil Database"
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
                                    <option value="NSIS_CONSUMER">NSIS Consumer (Full Results & Metadata)</option>
                                    <option value="EXTERNAL_GIS">GIS Harvester (Spatial GeoJSON & Coordinates)</option>
                                    <option value="GLOBAL_HARVESTER">Global Soil Partnership (Global Sync)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wider">
                                    Territorial Country Scope
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
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in zoom-in-95">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 text-center border border-gray-200 dark:border-gray-700">
                        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                            <CheckCircle2 size={32} />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-gray-900 dark:text-white">API Key Successfully Generated</h3>
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                                ⚠️ Make sure to copy your API key now. You will not be able to view it again!
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
                            className="w-full py-3 bg-slate-900 hover:bg-black text-white font-bold rounded-xl text-xs transition shadow-lg"
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
