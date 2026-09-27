import React, { useState, useEffect, useRef } from 'react';
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
    const [connections, setConnections] = useState([]);
    const [connectionsLoading, setConnectionsLoading] = useState(false);
    const [editingConnection, setEditingConnection] = useState(null);
    const [updatingConnection, setUpdatingConnection] = useState(false);
    const [activeTab, setActiveTab] = useState('keys'); // 'keys' | 'connections' | 'guide' | 'explorer'

    // Key creation modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [name, setName] = useState('');
    const [role, setRole] = useState('NSIS_CONSUMER');
    const [selectedCapabilities, setSelectedCapabilities] = useState(['SPATIAL', 'SPECTRAL', 'SNAPSHOT', 'RECEIPT']);
    const [customConnectionId, setCustomConnectionId] = useState('');
    const [selectedCountries, setSelectedCountries] = useState(['*']);
    const [availableLabs, setAvailableLabs] = useState([]);
    const [selectedLabs, setSelectedLabs] = useState([]);
    const [expiresDays, setExpiresDays] = useState(365);
    const [creating, setCreating] = useState(false);
    const [rotatingKeyId, setRotatingKeyId] = useState(null);
    const rotationOperationsRef = useRef({});

    // Newly generated key modal
    const [generatedKey, setGeneratedKey] = useState(null);
    const [copied, setCopied] = useState(false);

    // API Explorer & Sandbox state
    const [selectedEndpoint, setSelectedEndpoint] = useState('/api/v2/data-exchange/capabilities');
    const [endpointFilter, setEndpointFilter] = useState('all'); // 'all' | 'v2' | 'v1'
    const [paramCountry, setParamCountry] = useState('');
    const [paramProfile, setParamProfile] = useState('');
    const [paramLimit, setParamLimit] = useState(5);
    const [paramPage, setParamPage] = useState(1);
    const [paramCursor, setParamCursor] = useState('');
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
        // V2 Lossless Data Exchange Endpoints (Issue #140)
        {
            path: '/api/v2/data-exchange/capabilities',
            title: 'Exchange Capabilities & Profiles',
            desc: 'Discovery endpoint declaring supported exchange profiles (core-lossless-v2, opennsis), geometry constraints, horizons, and pagination limits.',
            category: 'V2 System',
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/stats',
            title: 'Scoped Dataset Statistics',
            desc: 'Aggregate metrics scoped strictly to authorized laboratories and published/approved sample statuses (IR-14 compliant).',
            category: 'V2 System',
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/samples',
            title: 'Lossless Specimen Registry & Provenance',
            desc: 'Soil specimen registry with truthful coordinates, unrounded depth horizons, distinct collection/reception dates, and namespaced profiles.',
            category: 'V2 Core Data',
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/observations',
            title: 'Lossless Tabular Observations Matrix',
            desc: 'Analytical chemistry observations retaining all replicate determinations, basis, censoring flags, and normalized units.',
            category: 'V2 Core Data',
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/geojson',
            title: 'RFC 7946 Spatial GeoJSON FeatureCollection',
            desc: 'Strict RFC 7946 GeoJSON points (WGS84, no obsolete crs object) with complete specimen metadata properties.',
            category: 'V2 Spatial',
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/spectra',
            title: 'Lossless Spectroscopy Dataset (MIR/NIR)',
            desc: 'Calibrated spectral signatures (MIR 400-4000 cm⁻¹ & Vis-NIR) linked to verified specimens.',
            category: 'V2 Spectral',
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/changes',
            title: 'Monotonic Change Feed & Continuous Sync',
            desc: 'Continuous synchronization feed with opaque boundary cursors, publication/withdrawal event types, and HTTP 410 cursor expiration guard.',
            category: 'V2 ETL',
            version: 'v2'
        },
        // V1 Compatibility Endpoints
        {
            path: '/api/v1/data-exchange/stats',
            title: 'V1 System Health & Statistics',
            desc: 'Aggregate sample counts, approved determinations, laboratory active counts, and metrological metrics (legacy).',
            category: 'V1 Legacy',
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/samples',
            title: 'V1 Samples Registry & Provenance',
            desc: 'Sample registry formatted with v1 compatibility layer.',
            category: 'V1 Legacy',
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/results',
            title: 'V1 Analytical Chemistry Matrix',
            desc: 'Soil determinations with method references and controlled units (v1 legacy format).',
            category: 'V1 Legacy',
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/geojson',
            title: 'V1 GIS Spatial FeatureCollection',
            desc: 'GeoJSON FeatureCollection formatted with v1 compatibility layer.',
            category: 'V1 Legacy',
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/spectra',
            title: 'V1 Spectroscopy Dataset (NIR/MIR)',
            desc: 'Calibrated spectral signatures formatted with v1 compatibility layer.',
            category: 'V1 Legacy',
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/sync',
            title: 'V1 Delta Synchronization (ETL)',
            desc: 'Timestamp-based delta synchronization endpoint (v1 legacy).',
            category: 'V1 Legacy',
            version: 'v1'
        }
    ];

    useEffect(() => {
        fetchKeys();
        fetchConnections();
    }, []);

    const fetchConnections = async () => {
        setConnectionsLoading(true);
        try {
            const res = await axios.get('/api/v1/data-exchange/connections');
            setConnections(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch connections:', err);
        } finally {
            setConnectionsLoading(false);
        }
    };

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const [keysRes, labsRes] = await Promise.allSettled([
                axios.get('/api/v1/data-exchange/keys'),
                axios.get('/api/labs')
            ]);
            if (keysRes.status === 'fulfilled') {
                setKeys(keysRes.value.data.data || []);
            }
            if (labsRes.status === 'fulfilled') {
                const fetched = Array.isArray(labsRes.value.data) ? labsRes.value.data : (labsRes.value.data?.labs || []);
                setAvailableLabs(fetched);
            }
        } catch (err) {
            console.error('Failed to fetch API keys or laboratories:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleConnectionStatus = async (conn) => {
        const newStatus = conn.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
        try {
            await axios.put(`/api/v1/data-exchange/connections/${conn.id}`, { status: newStatus });
            await fetchConnections();
            await fetchKeys();
            showDialog({
                title: 'Connection Status Updated',
                message: `Connection "${conn.name}" is now ${newStatus}. Associated keys will have their access updated immediately.`,
                type: 'info'
            });
        } catch (err) {
            showDialog({
                title: 'Status Update Failed',
                message: err.response?.data?.message || err.message,
                type: 'error'
            });
        }
    };

    const handleSaveConnectionEdit = async (e) => {
        e.preventDefault();
        if (!editingConnection) return;
        setUpdatingConnection(true);
        try {
            await axios.put(`/api/v1/data-exchange/connections/${editingConnection.id}`, {
                name: editingConnection.name,
                status: editingConnection.status,
                capabilities: editingConnection.capabilities,
                countries: editingConnection.countries,
                projects: editingConnection.projects,
                labs: editingConnection.labs,
                contactEmail: editingConnection.contactEmail,
                organization: editingConnection.organization
            });
            setEditingConnection(null);
            await fetchConnections();
            await fetchKeys();
            showDialog({
                title: 'Connection Saved',
                message: `Connection "${editingConnection.name}" was updated successfully. Auth version was incremented.`,
                type: 'info'
            });
        } catch (err) {
            showDialog({
                title: 'Save Failed',
                message: err.response?.data?.message || err.message,
                type: 'error'
            });
        } finally {
            setUpdatingConnection(false);
        }
    };

    const handleCreateKey = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        if (!selectedLabs.length) {
            showDialog({
                title: 'Laboratory Scope Required',
                message: 'You must select at least one authorized laboratory for this integration key (IR-14).',
                type: 'error'
            });
            return;
        }
        setCreating(true);
        try {
            const res = await axios.post('/api/v1/data-exchange/keys', {
                name,
                role,
                countries: selectedCountries.includes('*') ? null : selectedCountries,
                labs: selectedLabs,
                capabilities: selectedCapabilities,
                connectionId: customConnectionId.trim() || undefined,
                expiresDays: parseInt(expiresDays) || 365
            });

            setGeneratedKey(res.data.apiKey);
            setIsCreateModalOpen(false);
            setName('');
            setSelectedLabs([]);
            setSelectedCapabilities(['SPATIAL', 'SPECTRAL', 'SNAPSHOT', 'RECEIPT']);
            setCustomConnectionId('');
            fetchKeys();
        } catch (err) {
            showDialog({
                title: 'Creation Failed',
                message: err.response?.data?.message || err.response?.data?.error || err.message,
                type: 'error'
            });
        } finally {
            setCreating(false);
        }
    };

    const handleRotateKey = (keyId, keyName) => {
        if (!rotationOperationsRef.current[keyId]) {
            rotationOperationsRef.current[keyId] = `rot_${keyId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        }
        const idempotencyKey = rotationOperationsRef.current[keyId];

        showDialog({
            title: 'Rotate API Key?',
            message: `Are you sure you want to rotate "${keyName}"? A new secret key will be generated for the same connection identity and scopes with 24-hour bounded overlap (the prior key remains active until verified or confirmed to prevent disruption).`,
            type: 'confirm',
            confirmText: 'Rotate Key',
            onConfirm: async () => {
                setRotatingKeyId(keyId);
                try {
                    const res = await axios.post(`/api/v1/data-exchange/keys/${keyId}/rotate`, {}, {
                        headers: {
                            'Idempotency-Key': idempotencyKey
                        }
                    });
                    delete rotationOperationsRef.current[keyId];
                    if (res.data?.apiKey) {
                        setGeneratedKey(res.data.apiKey);
                    } else if (res.data?.alreadyRotated) {
                        showDialog({
                            title: res.data?.oldKeyActive ? 'Key Rotation In Progress (Bounded Overlap)' : 'Key Rotation Completed',
                            message: res.data?.oldKeyActive
                                ? `Rotation is pending confirmation for this key. The prior key remains active under bounded overlap while awaiting verification of the replacement key (Prefix: ${res.data.keyInfo?.keyPrefix || 'slims_live_...'}).`
                                : `Rotation was already committed for this key. The replacement key (Prefix: ${res.data.keyInfo?.keyPrefix || 'slims_live_...'}) is active.`,
                            type: 'info'
                        });
                    }
                    fetchKeys();
                } catch (err) {
                    showDialog({
                        title: 'Rotation Failed',
                        message: `${err.response?.data?.message || err.response?.data?.error || err.message} (You can safely retry this operation using the retained operation key.)`,
                        type: 'error',
                        confirmText: 'Retry Rotation',
                        onConfirm: () => handleRotateKey(keyId, keyName)
                    });
                } finally {
                    setRotatingKeyId(null);
                }
            }
        });
    };

    const handleConfirmRotation = async (keyId) => {
        try {
            await axios.post(`/api/v1/data-exchange/keys/${keyId}/confirm-rotation`);
            fetchKeys();
            showDialog({
                title: 'Rotation Confirmed',
                message: 'Key rotation has been confirmed and prior rotating keys have been retired.',
                type: 'info'
            });
        } catch (err) {
            showDialog({
                title: 'Confirmation Failed',
                message: err.response?.data?.error || err.message,
                type: 'error'
            });
        }
    };

    const handleAbortRotation = async (keyId) => {
        showDialog({
            title: 'Abort Key Rotation?',
            message: 'Are you sure you want to abort this rotation? The original key will be restored to active status and the unconfirmed replacement key will be revoked.',
            type: 'confirm',
            confirmText: 'Abort Rotation',
            onConfirm: async () => {
                try {
                    await axios.post(`/api/v1/data-exchange/keys/${keyId}/abort-rotation`);
                    fetchKeys();
                    showDialog({
                        title: 'Rotation Aborted',
                        message: 'Key rotation was aborted. Original key restored to active status.',
                        type: 'info'
                    });
                } catch (err) {
                    showDialog({
                        title: 'Abort Failed',
                        message: err.response?.data?.error || err.message,
                        type: 'error'
                    });
                }
            }
        });
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
        if (paramProfile) params.append('profile', paramProfile);
        if (selectedEndpoint.includes('/samples') || selectedEndpoint.includes('/results') || selectedEndpoint.includes('/observations')) {
            if (paramLimit) params.append('limit', paramLimit);
            if (paramPage && paramPage > 1 && !selectedEndpoint.includes('/v2/')) params.append('page', paramPage);
            if (paramCursor) params.append('cursor', paramCursor);
        }
        if (selectedEndpoint.includes('/changes')) {
            if (paramLimit) params.append('limit', paramLimit);
            if (paramCursor) params.append('cursor', paramCursor);
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
                                    Spec v2.0.0 (Issue #140 Lossless)
                                </span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    v1.0.0 Compatible
                                </span>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    Fail-Closed Scoping (IR-14)
                                </span>
                                <span className="text-xs text-blue-200">
                                    FAO OpenNSIS & GSP Interoperability
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
            <div className="flex items-center gap-2 border-b border-sf-divider pb-2">
                <button
                    onClick={() => setActiveTab('keys')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                        activeTab === 'keys'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'text-sf-muted hover:bg-sf-raised'
                    }`}
                >
                    <Key size={16} /> Active API Keys ({keys.length})
                </button>
                <button
                    onClick={() => setActiveTab('connections')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                        activeTab === 'connections'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'text-sf-muted hover:bg-sf-raised'
                    }`}
                >
                    <Layers size={16} /> Connections & Telemetry ({connections.length})
                </button>
                <button
                    onClick={() => setActiveTab('guide')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                        activeTab === 'guide'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'text-sf-muted hover:bg-sf-raised'
                    }`}
                >
                    <BookOpen size={16} /> Step-by-Step Guide
                </button>
                <button
                    onClick={() => setActiveTab('explorer')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                        activeTab === 'explorer'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                            : 'text-sf-muted hover:bg-sf-raised'
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
                            <h3 className="text-sm font-bold text-sf-text flex items-center gap-2">
                                <Key size={16} className="text-blue-500" /> Authorized External Consumer Keys
                            </h3>
                            <p className="text-xs text-gray-500">
                                Cryptographically hashed API tokens. Keys can be scoped to specific countries or roles and revoked instantly.
                            </p>
                        </div>
                        <button
                            onClick={fetchKeys}
                            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition rounded-lg hover:bg-sf-raised"
                            title="Refresh Keys"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-400 text-sm">Loading authorized keys...</div>
                    ) : keys.length === 0 ? (
                        <div className="p-12 text-center bg-sf-canvas/40 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 space-y-3">
                            <Key size={40} className="mx-auto text-gray-400" />
                            <h4 className="font-bold text-sf-text">No Integration Keys Generated</h4>
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
                        <div className="overflow-x-auto rounded-2xl border border-sf-divider bg-sf-surface shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-sf-canvas/50 border-b border-sf-divider text-xs font-bold uppercase text-sf-muted">
                                    <tr>
                                        <th className="p-4">Integration & Connection</th>
                                        <th className="p-4">Key Identifier</th>
                                        <th className="p-4">Capabilities & Scope</th>
                                        <th className="p-4">Created / Last Used</th>
                                        <th className="p-4">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sf-divider">
                                    {keys.map((k) => {
                                        const rawCaps = k.capabilities;
                                        let caps = [];
                                        if (Array.isArray(rawCaps)) caps = rawCaps;
                                        else if (rawCaps) {
                                            try { caps = JSON.parse(rawCaps); } catch (_) { caps = []; }
                                        }
                                        return (
                                            <tr key={k.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition">
                                                <td className="p-4">
                                                    <div className="font-bold text-sf-text">{k.name}</div>
                                                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                                                        Conn: <span className="font-semibold text-blue-600 dark:text-blue-400">{k.connectionId || ('conn_' + k.id)}</span>
                                                    </div>
                                                    <div className="text-[11px] text-gray-400">Owner: {k.createdBy || 'Administrator'}</div>
                                                </td>
                                                <td className="p-4 font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">
                                                    {k.keyPrefix}••••••••
                                                </td>
                                                <td className="p-4 space-y-1.5">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold">
                                                            {k.role}
                                                        </span>
                                                        {caps.length > 0 ? caps.map(cap => (
                                                            <span key={cap} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                                {cap}
                                                            </span>
                                                        )) : (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                NO CAPS
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        Territory: {k.countries?.join(', ') || 'Global (*)'}
                                                    </div>
                                                    <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                                                        Labs: {Array.isArray(k.labs) ? (k.labs.includes('*') ? 'All Laboratories (*)' : k.labs.join(', ')) : (k.labs ? (JSON.parse(k.labs).includes('*') ? 'All Laboratories (*)' : JSON.parse(k.labs).join(', ')) : 'None')}
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
                                                    <div className="flex items-center justify-end gap-1">
                                                        {k.isActive && (
                                                            <button
                                                                onClick={() => handleRotateKey(k.id, k.name)}
                                                                disabled={rotatingKeyId === k.id}
                                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition disabled:opacity-50"
                                                                title="Rotate API Key (Issues new secret token for existing connection ID)"
                                                            >
                                                                <RefreshCw size={16} className={rotatingKeyId === k.id ? 'animate-spin text-blue-600' : ''} />
                                                            </button>
                                                        )}
                                                        {k.isActive && (
                                                            <button
                                                                onClick={() => handleRevokeKey(k.id, k.name)}
                                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                                                                title="Revoke API Key"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: CONNECTIONS & TELEMETRY */}
            {activeTab === 'connections' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-bold text-sf-text flex items-center gap-2">
                                <Layers size={16} className="text-blue-500" /> Managed Exchange Connections & Receiver Telemetry
                            </h3>
                            <p className="text-xs text-sf-muted mt-0.5">
                                Authoritative connection identities, capability grants, status lifecycle controls, and receiver ingestion telemetry.
                            </p>
                        </div>
                        <button
                            onClick={fetchConnections}
                            disabled={connectionsLoading}
                            className="px-3 py-1.5 bg-sf-raised hover:bg-sf-subtle text-sf-text rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-sf-divider"
                        >
                            <RefreshCw size={14} className={connectionsLoading ? 'animate-spin' : ''} /> Refresh
                        </button>
                    </div>

                    {connectionsLoading && connections.length === 0 ? (
                        <div className="p-12 text-center text-sf-muted text-xs">
                            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                            Loading exchange connections...
                        </div>
                    ) : connections.length === 0 ? (
                        <div className="p-8 text-center bg-sf-surface rounded-2xl border border-sf-divider text-sf-muted text-xs space-y-2">
                            <Layers size={32} className="mx-auto text-sf-muted/50 mb-1" />
                            <p className="font-semibold text-sf-text">No Managed Connections Configured</p>
                            <p>Connections are provisioned when creating integration API keys or by platform administrators.</p>
                        </div>
                    ) : (
                        <div className="bg-sf-surface rounded-2xl border border-sf-divider overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-sf-raised text-sf-muted uppercase font-bold text-[10px] tracking-wider border-b border-sf-divider">
                                    <tr>
                                        <th className="p-4">Connection & Identity</th>
                                        <th className="p-4">Status & Control</th>
                                        <th className="p-4">Auth Version & Capabilities</th>
                                        <th className="p-4">Authorized Scopes</th>
                                        <th className="p-4">Receiver-Reported Telemetry</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sf-divider">
                                    {connections.map((c) => (
                                        <tr key={c.id} className="hover:bg-sf-raised/50 transition">
                                            <td className="p-4 space-y-1">
                                                <div className="font-bold text-sf-text text-sm flex items-center gap-1.5">
                                                    {c.name}
                                                </div>
                                                <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900 inline-block">
                                                    {c.id}
                                                </div>
                                                {c.organization && (
                                                    <div className="text-[11px] text-sf-muted">
                                                        Org: <span className="font-medium text-sf-text">{c.organization}</span>
                                                        {c.contactEmail && ` (${c.contactEmail})`}
                                                    </div>
                                                )}
                                                {c.clientCode && (
                                                    <div className="text-[10px] text-sf-muted">
                                                        Client Code: <span className="font-mono text-sf-text">{c.clientCode}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 space-y-2">
                                                <div>
                                                    {c.status === 'ACTIVE' ? (
                                                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Disabled
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => handleToggleConnectionStatus(c)}
                                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition border ${
                                                        c.status === 'ACTIVE'
                                                            ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900'
                                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
                                                    }`}
                                                >
                                                    {c.status === 'ACTIVE' ? 'Disable Connection' : 'Enable Connection'}
                                                </button>
                                            </td>
                                            <td className="p-4 space-y-1.5">
                                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-bold border border-indigo-200 dark:border-indigo-900 inline-block">
                                                    Version {c.authVersion || 1}
                                                </span>
                                                <div className="flex flex-wrap gap-1">
                                                    {(c.capabilities || []).length > 0 ? (
                                                        c.capabilities.map((cap) => (
                                                            <span key={cap} className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-900">
                                                                {cap}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] text-sf-muted italic">None (Deny All)</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-sf-muted">
                                                    Active Keys Linked: <span className="font-bold text-sf-text">{c.activeKeyIds?.length || 0}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 space-y-1">
                                                <div className="text-[11px]">
                                                    <span className="text-sf-muted">Countries: </span>
                                                    <span className="font-medium text-sf-text">
                                                        {(c.countries || []).join(', ') || 'All (*)'}
                                                    </span>
                                                </div>
                                                <div className="text-[11px]">
                                                    <span className="text-sf-muted">Labs: </span>
                                                    <span className="font-medium text-sf-text">
                                                        {c.labs?.length ? `${c.labs.length} laboratories` : 'None (Deny)'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 space-y-1">
                                                <div className="text-[11px]">
                                                    <span className="text-sf-muted">Receiver Ingested: </span>
                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                        {c.telemetry?.receiverReportedImported ?? c.telemetry?.totalImported ?? 0}
                                                    </span>
                                                </div>
                                                <div className="text-[11px]">
                                                    <span className="text-sf-muted">Receiver Quarantined: </span>
                                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                                        {c.telemetry?.receiverReportedQuarantined ?? c.telemetry?.totalQuarantined ?? 0}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] font-mono text-sf-muted">
                                                    Reported Checkpoint: <span className="text-sf-text">{c.telemetry?.lastReportedCheckpoint || c.telemetry?.lastCheckpoint || 'None'}</span>
                                                </div>
                                                <div className="text-[10px] text-sf-muted">
                                                    Last Receipt: <span className="text-sf-text">{c.telemetry?.lastReceiptAt ? new Date(c.telemetry.lastReceiptAt).toLocaleString() : 'Not reported'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setEditingConnection(JSON.parse(JSON.stringify(c)))}
                                                    className="px-3 py-1.5 bg-sf-raised hover:bg-sf-subtle text-sf-text rounded-xl text-xs font-bold transition border border-sf-divider inline-flex items-center gap-1.5"
                                                >
                                                    <Sliders size={14} /> Edit Scopes
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* EDIT CONNECTION MODAL */}
            {editingConnection && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-sf-surface rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-sf-divider space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b border-sf-divider pb-3">
                            <div>
                                <h3 className="text-base font-bold text-sf-text">Edit Exchange Connection</h3>
                                <p className="text-xs text-sf-muted font-mono">{editingConnection.id}</p>
                            </div>
                            <button
                                onClick={() => setEditingConnection(null)}
                                className="p-1.5 rounded-lg text-sf-muted hover:bg-sf-raised"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveConnectionEdit} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-sf-muted font-bold uppercase tracking-wider mb-1">
                                    Connection Name
                                </label>
                                <input
                                    type="text"
                                    value={editingConnection.name || ''}
                                    onChange={(e) => setEditingConnection({ ...editingConnection, name: e.target.value })}
                                    className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text font-medium"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sf-muted font-bold uppercase tracking-wider mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={editingConnection.status || 'ACTIVE'}
                                        onChange={(e) => setEditingConnection({ ...editingConnection, status: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text font-medium"
                                    >
                                        <option value="ACTIVE">ACTIVE (Operational)</option>
                                        <option value="DISABLED">DISABLED (Halt All Keys)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sf-muted font-bold uppercase tracking-wider mb-1">
                                        Contact Email
                                    </label>
                                    <input
                                        type="email"
                                        value={editingConnection.contactEmail || ''}
                                        onChange={(e) => setEditingConnection({ ...editingConnection, contactEmail: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sf-muted font-bold uppercase tracking-wider mb-1.5">
                                    Granted Capabilities
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-3 bg-sf-canvas rounded-xl border border-sf-divider">
                                    {[
                                        { id: 'SPATIAL', label: 'SPATIAL (Exact GPS coordinates)' },
                                        { id: 'SPECTRAL', label: 'SPECTRAL (Vis-NIR/MIR spectra)' },
                                        { id: 'SNAPSHOT', label: 'SNAPSHOT (Point-in-time export)' },
                                        { id: 'RECEIPT', label: 'RECEIPT (Delivery acknowledgements)' }
                                    ].map((cap) => (
                                        <label key={cap.id} className="flex items-center gap-2 cursor-pointer text-sf-text">
                                            <input
                                                type="checkbox"
                                                checked={(editingConnection.capabilities || []).includes(cap.id)}
                                                onChange={(e) => {
                                                    const cur = editingConnection.capabilities || [];
                                                    if (e.target.checked) {
                                                        setEditingConnection({ ...editingConnection, capabilities: [...cur, cap.id] });
                                                    } else {
                                                        setEditingConnection({ ...editingConnection, capabilities: cur.filter(x => x !== cap.id) });
                                                    }
                                                }}
                                                className="rounded text-blue-600"
                                            />
                                            <span className="font-semibold text-[11px]">{cap.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sf-muted font-bold uppercase tracking-wider mb-1.5">
                                    Authorized Laboratories
                                </label>
                                <div className="p-3 bg-sf-canvas rounded-xl border border-sf-divider max-h-36 overflow-y-auto space-y-1.5">
                                    {availableLabs.map((l) => (
                                        <label key={l.id} className="flex items-center gap-2 cursor-pointer text-sf-text text-[11px]">
                                            <input
                                                type="checkbox"
                                                checked={(editingConnection.labs || []).includes(l.id)}
                                                onChange={(e) => {
                                                    const cur = editingConnection.labs || [];
                                                    if (e.target.checked) {
                                                        setEditingConnection({ ...editingConnection, labs: [...cur, l.id] });
                                                    } else {
                                                        setEditingConnection({ ...editingConnection, labs: cur.filter(x => x !== l.id) });
                                                    }
                                                }}
                                                className="rounded text-blue-600"
                                            />
                                            <span>{l.name || l.id} ({l.code || l.id})</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t border-sf-divider">
                                <button
                                    type="button"
                                    onClick={() => setEditingConnection(null)}
                                    className="px-4 py-2 text-sf-muted hover:text-sf-text font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatingConnection}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition shadow-md disabled:opacity-50"
                                >
                                    {updatingConnection ? 'Saving...' : 'Save Connection Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
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
                        <div className="p-6 bg-sf-surface rounded-3xl border border-sf-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center">
                                    1
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2.5 py-1 rounded-lg">
                                    Provisioning
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-sf-text text-base">Generate an Integration Key</h4>
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
                        <div className="p-6 bg-sf-surface rounded-3xl border border-sf-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                                    2
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-sf-emerald bg-indigo-50 dark:bg-indigo-900/40 px-2.5 py-1 rounded-lg">
                                    Authentication
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-sf-text text-base">Authenticate HTTP Requests</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    Every HTTP request sent to SoilFER-LIMS must transmit the secret key via the <code className="font-mono text-sf-emerald font-bold">X-API-Key</code> request header.
                                </p>
                            </div>
                            <div className="p-3 bg-gray-900 text-gray-200 rounded-xl font-mono text-xs space-y-1 border border-gray-800">
                                <div className="text-gray-500 text-[10px]">// Example Request Header</div>
                                <div className="text-emerald-400">X-API-Key: slims_live_abc123...</div>
                                <div className="text-blue-300">Accept: application/json</div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="p-6 bg-sf-surface rounded-3xl border border-sf-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-purple-600 text-white font-black text-sm flex items-center justify-center">
                                    3
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/40 px-2.5 py-1 rounded-lg">
                                    Harvesting
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-sf-text text-base">Select Your Target Endpoint</h4>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    Depending on your application requirements, choose between V2 lossless representations, RFC 7946 spatial layers, or continuous delta feeds:
                                </p>
                            </div>
                            <ul className="space-y-2 text-xs text-sf-muted">
                                <li className="flex items-center gap-2">
                                    <Sparkles size={14} className="text-amber-500 flex-shrink-0" />
                                    <span><strong>/api/v2/.../capabilities</strong>: Machine discovery of profiles & limits.</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Database size={14} className="text-blue-500 flex-shrink-0" />
                                    <span><strong>/api/v2/.../samples</strong>: Truthful coordinates, depth intervals & profiles.</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Code2 size={14} className="text-indigo-500 flex-shrink-0" />
                                    <span><strong>/api/v2/.../observations</strong>: Full replicate determinations & basis metadata.</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Globe size={14} className="text-emerald-500 flex-shrink-0" />
                                    <span><strong>/api/v2/.../geojson</strong>: RFC 7946 FeatureCollection (QGIS, GeoNode).</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <RefreshCw size={14} className="text-purple-500 flex-shrink-0" />
                                    <span><strong>/api/v2/.../changes</strong>: Continuous monotonic change feed with cursors.</span>
                                </li>
                            </ul>
                        </div>

                        {/* Step 4 */}
                        <div className="p-6 bg-sf-surface rounded-3xl border border-sf-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center">
                                    4
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 px-2.5 py-1 rounded-lg">
                                    Verification
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-sf-text text-base">Test Live with Built-in Sandbox</h4>
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
                    <div className="lg:col-span-5 space-y-4 bg-sf-surface p-6 rounded-3xl border border-sf-divider shadow-sm">
                        <div className="space-y-1">
                            <h3 className="text-sm font-bold text-sf-text flex items-center gap-2">
                                <Sliders size={16} className="text-blue-500" /> Interactive Request Builder
                            </h3>
                            <p className="text-xs text-gray-500">
                                Configure endpoint parameters and run live queries against the active server.
                            </p>
                        </div>

                        {/* Endpoint Selector & Version Filter */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold uppercase tracking-wider text-sf-muted">
                                    Target Endpoint
                                </label>
                                <div className="flex items-center gap-1 bg-sf-canvas p-1 rounded-lg border border-sf-divider">
                                    {[
                                        { id: 'all', label: 'All' },
                                        { id: 'v2', label: 'V2 Lossless' },
                                        { id: 'v1', label: 'V1 Legacy' }
                                    ].map((f) => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => setEndpointFilter(f.id)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                                endpointFilter === f.id
                                                    ? 'bg-blue-600 text-white'
                                                    : 'text-gray-400 hover:text-sf-text'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <select
                                value={selectedEndpoint}
                                onChange={(e) => setSelectedEndpoint(e.target.value)}
                                className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {ENDPOINTS.filter(ep => endpointFilter === 'all' || ep.version === endpointFilter).map((ep) => (
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
                        <div className="p-4 bg-sf-canvas/30 rounded-2xl border border-sf-divider/50 space-y-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                                Query Parameters
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                        Country Scope
                                    </label>
                                    <select
                                        value={paramCountry}
                                        onChange={(e) => setParamCountry(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs"
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

                                {(selectedEndpoint.includes('/samples') || selectedEndpoint.includes('/observations')) && selectedEndpoint.includes('/v2/') && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            Exchange Profile
                                        </label>
                                        <select
                                            value={paramProfile}
                                            onChange={(e) => setParamProfile(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs"
                                        >
                                            <option value="">Default (core-lossless-v2)</option>
                                            <option value="opennsis">OpenNSIS (National Accession)</option>
                                        </select>
                                    </div>
                                )}

                                {(selectedEndpoint.includes('/samples') || selectedEndpoint.includes('/results') || selectedEndpoint.includes('/observations') || selectedEndpoint.includes('/changes')) && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            Limit (Records)
                                        </label>
                                        <input
                                            type="number"
                                            value={paramLimit}
                                            onChange={(e) => setParamLimit(e.target.value)}
                                            min="1"
                                            max="100"
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs font-medium"
                                        />
                                    </div>
                                )}

                                {(selectedEndpoint.includes('/changes') || (selectedEndpoint.includes('/v2/') && (selectedEndpoint.includes('/samples') || selectedEndpoint.includes('/observations')))) && (
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            Opaque Boundary Cursor (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={paramCursor}
                                            onChange={(e) => setParamCursor(e.target.value)}
                                            placeholder="e.g. eyJsYXN0VXBkYXRlZEF0IjoiMjAy..."
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs font-mono"
                                        />
                                    </div>
                                )}

                                {selectedEndpoint.includes('/spectra') && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            Modality
                                        </label>
                                        <select
                                            value={paramModality}
                                            onChange={(e) => setParamModality(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs"
                                        >
                                            <option value="MIR">Mid-Infrared (MIR 400-4000 cm⁻¹)</option>
                                            <option value="NIR">Vis-NIR (350-2500 nm)</option>
                                        </select>
                                    </div>
                                )}

                                {selectedEndpoint.includes('/sync') && (
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            Since (ISO 8601 Timestamp)
                                        </label>
                                        <input
                                            type="text"
                                            value={paramSince}
                                            onChange={(e) => setParamSince(e.target.value)}
                                            placeholder="2026-01-01T00:00:00Z"
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs font-mono"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Optional Custom Key */}
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-sf-muted">
                                Test with Specific API Key (Optional)
                            </label>
                            <input
                                type="text"
                                value={customApiKey}
                                onChange={(e) => setCustomApiKey(e.target.value)}
                                placeholder="Auto: Uses Current Admin Session"
                                className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-xs font-mono outline-none"
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
                        <div className="bg-sf-surface rounded-3xl p-5 border border-sf-divider shadow-sm space-y-3">
                            <div className="flex justify-between items-center border-b border-sf-divider pb-3">
                                <div className="flex items-center gap-2">
                                    <Code2 size={16} className="text-emerald-500" />
                                    <span className="text-xs font-bold text-sf-text uppercase tracking-wider">
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
                                <div className="p-10 text-center text-gray-400 text-xs border border-dashed border-sf-divider rounded-2xl space-y-2">
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
                    <div className="bg-sf-surface rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-sf-divider">
                        <div className="flex items-center gap-2 font-bold text-lg text-sf-text">
                            <Key size={20} className="text-blue-600" /> Issue Integration Secret Key
                        </div>
                        <p className="text-xs text-gray-500">
                            Create a cryptographically hashed access token for an external NSIS server, GIS system, or automated harvester.
                        </p>

                        <form onSubmit={handleCreateKey} className="space-y-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Integration Name / Consumer Label *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Kenya National Soil Database"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Connection Identifier (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. conn_kenya_national_sis (leave blank for auto-generated)"
                                    value={customConnectionId}
                                    onChange={(e) => setCustomConnectionId(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <p className="text-[11px] text-gray-400 mt-1">
                                    Persistent identity across key rotations. Distinct keys with different connections cannot acknowledge each other&apos;s snapshots.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Access Role
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="NSIS_CONSUMER">NSIS Consumer (Full Results & Metadata)</option>
                                    <option value="EXTERNAL_GIS">GIS Harvester (Spatial GeoJSON & Coordinates)</option>
                                    <option value="GLOBAL_HARVESTER">Global Soil Partnership (Global Sync)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Granted Capabilities (Fine-Grained Permissions)
                                </label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {[
                                        { id: 'SPATIAL', label: 'SPATIAL', desc: 'GPS coordinates & GeoJSON points' },
                                        { id: 'SPECTRAL', label: 'SPECTRAL', desc: 'MIR / Vis-NIR spectroscopy curves' },
                                        { id: 'SNAPSHOT', label: 'SNAPSHOT', desc: 'Snapshot package creation & retrieval' },
                                        { id: 'RECEIPT', label: 'RECEIPT', desc: 'Sequence receipt acknowledgement' }
                                    ].map((cap) => (
                                        <label key={cap.id} className="flex items-start gap-2 p-2 rounded-lg bg-sf-canvas/50 border border-sf-divider cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedCapabilities.includes(cap.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedCapabilities([...selectedCapabilities, cap.id]);
                                                    } else {
                                                        setSelectedCapabilities(selectedCapabilities.filter(c => c !== cap.id));
                                                    }
                                                }}
                                                className="rounded text-blue-600 mt-0.5"
                                            />
                                            <div>
                                                <div className="font-mono font-bold text-[11px] text-sf-text">{cap.label}</div>
                                                <div className="text-[10px] text-gray-400">{cap.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Territorial Country Scope
                                </label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {COUNTRIES.map((c) => (
                                        <label key={c.code} className="flex items-center gap-1.5 p-2 rounded-lg bg-sf-canvas/50 border border-sf-divider cursor-pointer">
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
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Authorized Laboratory Scope *
                                </label>
                                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2.5 rounded-xl border border-sf-divider bg-sf-canvas/50">
                                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sf-canvas cursor-pointer text-xs font-bold border-b border-sf-divider pb-2 mb-1">
                                        <input
                                            type="checkbox"
                                            checked={selectedLabs.includes('*')}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedLabs(['*']);
                                                } else {
                                                    setSelectedLabs([]);
                                                }
                                            }}
                                            className="rounded text-blue-600"
                                        />
                                        <span>All Laboratories (Global Wildcard *)</span>
                                    </label>
                                    {availableLabs.map((l) => (
                                        <label key={l.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-sf-canvas cursor-pointer text-xs">
                                            <input
                                                type="checkbox"
                                                checked={selectedLabs.includes(l.id)}
                                                onChange={(e) => {
                                                    const filtered = selectedLabs.filter(x => x !== '*');
                                                    if (e.target.checked) {
                                                        setSelectedLabs([...filtered, l.id]);
                                                    } else {
                                                        setSelectedLabs(filtered.filter(x => x !== l.id));
                                                    }
                                                }}
                                                className="rounded text-blue-600"
                                            />
                                            <span className="font-semibold">{l.name || l.id} ({l.code || l.id})</span>
                                            {l.country && <span className="text-[10px] text-gray-400">· {l.country}</span>}
                                        </label>
                                    ))}
                                    {availableLabs.length === 0 && (
                                        <p className="text-xs text-gray-400 italic p-2">Loading laboratories...</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Key Expiration
                                </label>
                                <select
                                    value={expiresDays}
                                    onChange={(e) => setExpiresDays(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sm font-medium outline-none"
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
                    <div className="bg-sf-surface rounded-3xl p-8 max-w-lg w-full shadow-2xl space-y-6 text-center border border-sf-divider">
                        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                            <CheckCircle2 size={32} />
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-sf-text">API Key Successfully Generated</h3>
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
