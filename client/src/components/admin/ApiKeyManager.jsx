import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Key, Plus, Trash2, Copy, CheckCircle2, Shield, Globe, 
    Database, Code2, RefreshCw, Layers, Terminal, Check, Play, 
    BookOpen, Sparkles, Sliders, Lock, CheckCheck, RotateCcw, X
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

// Native modality keeps the window above transformed page content and confines
// keyboard focus without competing with the application's global dialog trap.
const ApiKeyDialog = ({ labelledBy, describedBy, onDismiss, children }) => {
    const dialogRef = useRef(null);
    const openerRef = useRef(typeof document === 'undefined' ? null : document.activeElement);
    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        const opener = openerRef.current;
        dialog.showModal();
        dialog.querySelector('[data-dialog-initial-focus]')?.focus({ preventScroll: true });
        return () => {
            dialog.close();
            if (opener?.isConnected) opener.focus({ preventScroll: true });
        };
    }, []);

    return (
        <dialog
            ref={dialogRef}
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            onCancel={(event) => {
                event.preventDefault();
                onDismiss?.();
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Tab') return;
                const dialog = event.currentTarget;
                const controls = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'))
                    .filter(control => control.getClientRects().length > 0);
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (!first) {
                    event.preventDefault();
                } else if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }}
            className="fixed inset-0 !m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] rounded-2xl sm:rounded-3xl p-0 overflow-hidden bg-sf-surface text-sf-text border border-sf-divider shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
            {children}
        </dialog>
    );
};

const ApiKeyManager = () => {
    const { t } = useLanguage();
    const { showDialog } = useDialog();
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'SUPER_ADMIN';
    
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
    const [createError, setCreateError] = useState(null);
    const createErrorRef = useRef(null);
    const [rotatingKeyId, setRotatingKeyId] = useState(null);
    const rotationOperationsRef = useRef({});

    // Newly generated key modal
    const [generatedKey, setGeneratedKey] = useState(null);
    const [copied, setCopied] = useState(false);
    const [secretCopyError, setSecretCopyError] = useState(null);

    const closeCreateModal = () => {
        if (!creating) setIsCreateModalOpen(false);
    };

    useEffect(() => {
        if (createError) createErrorRef.current?.focus();
    }, [createError]);

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
        { code: '*', label: t('exchangeAdmin.allCountriesScope') },
        { code: 'GTM', label: t('exchangeAdmin.countryGuatemala') },
        { code: 'HND', label: t('exchangeAdmin.countryHonduras') },
        { code: 'KEN', label: t('exchangeAdmin.countryKenya') },
        { code: 'ZMB', label: t('exchangeAdmin.countryZambia') },
        { code: 'GHA', label: t('exchangeAdmin.countryGhana') },
        { code: 'MOZ', label: t('exchangeAdmin.countryMozambique') },
        { code: 'TUN', label: t('exchangeAdmin.countryTunisia') }
    ];

    const ENDPOINTS = [
        // V2 Lossless Data Exchange Endpoints (Issue #140)
        {
            path: '/api/v2/data-exchange/capabilities',
            title: t('exchangeAdmin.capabilitiesProfiles'),
            desc: t('exchangeAdmin.discoverProfiles'),
            category: t('exchangeAdmin.systemCategory'),
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/stats',
            title: t('exchangeAdmin.datasetStats'),
            desc: t('exchangeAdmin.scopedMetrics'),
            category: t('exchangeAdmin.systemCategory'),
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/samples',
            title: t('exchangeAdmin.specimenRegistry'),
            desc: t('exchangeAdmin.specimenDescription'),
            category: t('exchangeAdmin.coreCategory'),
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/observations',
            title: t('exchangeAdmin.observationsMatrix'),
            desc: t('exchangeAdmin.observationsDescription'),
            category: t('exchangeAdmin.coreCategory'),
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/geojson',
            title: t('exchangeAdmin.spatialCollection'),
            desc: t('exchangeAdmin.spatialDescription'),
            category: t('exchangeAdmin.spatialCategory'),
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/spectra',
            title: t('exchangeAdmin.spectroscopyDataset'),
            desc: t('exchangeAdmin.spectraDescription'),
            category: t('exchangeAdmin.spectralCategory'),
            version: 'v2'
        },
        {
            path: '/api/v2/data-exchange/changes',
            title: t('exchangeAdmin.changeFeed'),
            desc: t('exchangeAdmin.changesDescription'),
            category: t('exchangeAdmin.etlCategory'),
            version: 'v2'
        },
        // V1 Compatibility Endpoints
        {
            path: '/api/v1/data-exchange/stats',
            title: t('exchangeAdmin.legacyHealth'),
            desc: t('exchangeAdmin.legacyHealthDescription'),
            category: t('exchangeAdmin.v1Legacy'),
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/samples',
            title: t('exchangeAdmin.legacySamples'),
            desc: t('exchangeAdmin.legacySamplesDescription'),
            category: t('exchangeAdmin.v1Legacy'),
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/results',
            title: t('exchangeAdmin.legacyChemistry'),
            desc: t('exchangeAdmin.legacyChemistryDescription'),
            category: t('exchangeAdmin.v1Legacy'),
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/geojson',
            title: t('exchangeAdmin.legacySpatial'),
            desc: t('exchangeAdmin.legacySpatialDescription'),
            category: t('exchangeAdmin.v1Legacy'),
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/spectra',
            title: t('exchangeAdmin.legacySpectroscopy'),
            desc: t('exchangeAdmin.legacySpectraDescription'),
            category: t('exchangeAdmin.v1Legacy'),
            version: 'v1'
        },
        {
            path: '/api/v1/data-exchange/sync',
            title: t('exchangeAdmin.legacySync'),
            desc: t('exchangeAdmin.legacySyncDescription'),
            category: t('exchangeAdmin.v1Legacy'),
            version: 'v1'
        }
    ];

    useEffect(() => {
        if (isSuperAdmin) {
            fetchKeys();
            fetchConnections();
        }
    }, [isSuperAdmin]);

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
                axios.get('/api/labs/directory')
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
                title: t('exchangeAdmin.connectionUpdated'),
                message: t('exchangeAdmin.connectionStatusMessage', { name: conn.name, status: (newStatus === 'ACTIVE' ? t('projects.active') : t('controlCharts.ruleStatus.DISABLED')) }),
                type: 'info'
            });
        } catch (err) {
            showDialog({
                title: t('exchangeAdmin.connectionUpdateFailed'),
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
                title: t('exchangeAdmin.connectionSaved'),
                message: t('exchangeAdmin.connectionSavedMessage', { name: editingConnection.name }),
                type: 'info'
            });
        } catch (err) {
            showDialog({
                title: t('exchangeAdmin.connectionSaveFailed'),
                message: err.response?.data?.message || err.message,
                type: 'error'
            });
        } finally {
            setUpdatingConnection(false);
        }
    };

    const handleCreateKey = async (e) => {
        e.preventDefault();
        if (creating) return;
        setCreateError(null);
        if (!name.trim()) return;
        if (!selectedLabs.length) {
            setCreateError('You must select at least one authorized laboratory for this integration key to enforce strict scoping.');
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

            setCopied(false);
            setSecretCopyError(null);
            setGeneratedKey(res.data.apiKey);
            setIsCreateModalOpen(false);
            setName('');
            setSelectedLabs([]);
            setSelectedCapabilities(['SPATIAL', 'SPECTRAL', 'SNAPSHOT', 'RECEIPT']);
            setCustomConnectionId('');
            fetchKeys();
        } catch (err) {
            setCreateError(err.response?.data?.message || err.response?.data?.error || err.message);
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
            title: t('exchangeAdmin.confirmRotate'),
            message: t('exchangeAdmin.rotateHelp', { name: keyName }),
            type: 'confirm',
            confirmText: t('exchangeAdmin.rotateKey'),
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
                        setCopied(false);
                        setSecretCopyError(null);
                        setGeneratedKey(res.data.apiKey);
                    } else if (res.data?.alreadyRotated) {
                        showDialog({
                            title: res.data?.oldKeyActive ? t('exchangeAdmin.rotationInProgress') : t('exchangeAdmin.rotationDone'),
                            message: res.data?.oldKeyActive
                                ? t('exchangeAdmin.rotationPendingMessage', { prefix: res.data.keyInfo?.keyPrefix || 'slims_live_...' })
                                : t('exchangeAdmin.rotationDoneMessage', { prefix: res.data.keyInfo?.keyPrefix || 'slims_live_...' }),
                            type: 'info'
                        });
                    }
                    fetchKeys();
                } catch (err) {
                    showDialog({
                        title: t('exchangeAdmin.rotationFailed'),
                        message: t('exchangeAdmin.rotationRetryHelp', { error: err.response?.data?.message || err.response?.data?.error || err.message }),
                        type: 'error',
                        confirmText: t('exchangeAdmin.retryRotation'),
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
                title: t('exchangeAdmin.rotationConfirmed'),
                message: t('exchangeAdmin.rotationConfirmedHelp'),
                type: 'info'
            });
        } catch (err) {
            showDialog({
                title: t('exchangeAdmin.rotationConfirmFailed'),
                message: err.response?.data?.error || err.message,
                type: 'error'
            });
        }
    };

    const handleAbortRotation = async (keyId) => {
        showDialog({
            title: t('exchangeAdmin.confirmAbort'),
            message: t('exchangeAdmin.confirmAbortHelp'),
            type: 'confirm',
            confirmText: t('exchangeAdmin.abortRotation'),
            onConfirm: async () => {
                try {
                    await axios.post(`/api/v1/data-exchange/keys/${keyId}/abort-rotation`);
                    fetchKeys();
                    showDialog({
                        title: t('exchangeAdmin.rotationAborted'),
                        message: t('exchangeAdmin.rotationAbortedHelp'),
                        type: 'info'
                    });
                } catch (err) {
                    showDialog({
                        title: t('exchangeAdmin.abortFailed'),
                        message: err.response?.data?.error || err.message,
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleRevokeKey = (keyId, keyName) => {
        showDialog({
            title: t('exchangeAdmin.confirmRevoke'),
            message: t('exchangeAdmin.revokeHelp', { name: keyName }),
            type: 'confirm',
            confirmText: t('exchangeAdmin.revokeKey'),
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/v1/data-exchange/keys/${keyId}`);
                    fetchKeys();
                } catch (err) {
                    showDialog({
                        title: t('common.error'),
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

    const copyGeneratedKey = async () => {
        setSecretCopyError(null);
        setCopied(false);
        try {
            await navigator.clipboard.writeText(generatedKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setSecretCopyError(t('common.copySecretFailed', 'Copy failed. Select the key and copy it manually before closing this window.'));
        }
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

    if (!isSuperAdmin) {
        return (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm max-w-lg mx-auto my-12">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800/50">
                    <Shield size={24} />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{t('exchangeAdmin.restricted')}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                    {t('exchangeAdmin.restrictedHelp')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full min-w-0 font-sans">
            {/* Header Banner */}
            <div className="card-base bg-sf-surface rounded-2xl border border-sf-divider p-5 sm:p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2 max-w-3xl min-w-0">
                    <div className="flex items-start sm:items-center gap-3">
                        <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/60 flex-shrink-0">
                            <Database size={22} />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-sf-text">
                                {t('exchangeAdmin.gateway')}
                            </h2>
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                                <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                                    {t('exchangeAdmin.losslessGateway')}
                                </span>
                                <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sf-raised text-sf-text border border-sf-divider whitespace-nowrap">
                                    {t('exchangeAdmin.v1Compatible')}
                                </span>
                                <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 whitespace-nowrap">
                                    {t('exchangeAdmin.strictScope')}
                                </span>
                                <span className="inline-flex items-center text-[11px] text-sf-muted whitespace-nowrap">
                                    {t('exchangeAdmin.interoperable')}
                                </span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-sf-muted leading-relaxed pt-0.5">
                        {t('exchangeAdmin.gatewayDescription')}
                    </p>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto flex-shrink-0">
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-bold whitespace-nowrap shadow-sm"
                    >
                        <Plus size={16} /> <span>{t('exchangeAdmin.generateKey')}</span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-1.5 bg-sf-raised rounded-2xl border border-sf-divider w-fit max-w-full overflow-x-auto">
                <button
                    onClick={() => setActiveTab('keys')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'keys'
                            ? 'bg-sf-surface text-emerald-800 dark:text-emerald-300 shadow-sm border border-sf-divider'
                            : 'text-sf-muted hover:text-sf-text hover:bg-sf-hover'
                    }`}
                >
                    <Key size={15} className={activeTab === 'keys' ? 'text-emerald-700 dark:text-emerald-400' : 'text-sf-muted'} />
                    <span>{t('exchangeAdmin.activeKeys')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        activeTab === 'keys'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-sf-inset text-sf-muted'
                    }`}>
                        {keys.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('connections')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'connections'
                            ? 'bg-sf-surface text-emerald-800 dark:text-emerald-300 shadow-sm border border-sf-divider'
                            : 'text-sf-muted hover:text-sf-text hover:bg-sf-hover'
                    }`}
                >
                    <Layers size={15} className={activeTab === 'connections' ? 'text-emerald-700 dark:text-emerald-400' : 'text-sf-muted'} />
                    <span>{t('exchangeAdmin.connectionsTelemetry')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        activeTab === 'connections'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : 'bg-sf-inset text-sf-muted'
                    }`}>
                        {connections.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('guide')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'guide'
                            ? 'bg-sf-surface text-emerald-800 dark:text-emerald-300 shadow-sm border border-sf-divider'
                            : 'text-sf-muted hover:text-sf-text hover:bg-sf-hover'
                    }`}
                >
                    <BookOpen size={15} className={activeTab === 'guide' ? 'text-emerald-700 dark:text-emerald-400' : 'text-sf-muted'} />
                    <span>{t('exchangeAdmin.guide')}</span>
                </button>
                <button
                    onClick={() => setActiveTab('explorer')}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === 'explorer'
                            ? 'bg-sf-surface text-emerald-800 dark:text-emerald-300 shadow-sm border border-sf-divider'
                            : 'text-sf-muted hover:text-sf-text hover:bg-sf-hover'
                    }`}
                >
                    <Play size={15} className={activeTab === 'explorer' ? 'text-emerald-700 dark:text-emerald-400' : 'text-sf-muted'} />
                    <span>{t('exchangeAdmin.sandbox')}</span>
                </button>
            </div>

            {/* TAB 1: ACTIVE KEYS */}
            {activeTab === 'keys' && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-bold text-sf-text flex items-center gap-2">
                                <Key size={16} className="text-emerald-600 dark:text-emerald-400" /> {t('exchangeAdmin.externalKeys')}
                            </h3>
                            <p className="text-xs text-sf-muted">
                                {t('exchangeAdmin.externalKeysHelp')}
                            </p>
                        </div>
                        <button
                            onClick={fetchKeys}
                            className="p-2 text-sf-muted hover:text-sf-text transition rounded-lg hover:bg-sf-raised"
                            title={t('exchangeAdmin.refreshKeys')}
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-sf-muted text-sm">{t('exchangeAdmin.loadingKeys')}</div>
                    ) : keys.length === 0 ? (
                        <div className="p-12 text-center bg-sf-canvas/40 rounded-3xl border border-dashed border-sf-divider space-y-3">
                            <Key size={40} className="mx-auto text-sf-muted" />
                            <h4 className="font-bold text-sf-text">{t('exchangeAdmin.noKeys')}</h4>
                            <p className="text-xs text-sf-muted max-w-md mx-auto">
                                {t('exchangeAdmin.noKeysHelp')}
                            </p>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="btn-primary inline-flex items-center gap-1.5 text-xs shadow-sm"
                            >
                                <Plus size={14} /> {t('exchangeAdmin.firstKey')}
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-sf-divider bg-sf-surface shadow-sm">
                            <table className="w-full text-left text-sm min-w-[700px]">
                                <thead className="bg-sf-canvas/50 border-b border-sf-divider text-xs font-bold uppercase text-sf-muted">
                                    <tr>
                                        <th className="p-4">{t('exchangeAdmin.integrationConnection')}</th>
                                        <th className="p-4">{t('exchangeAdmin.keyIdentifier')}</th>
                                        <th className="p-4">{t('exchangeAdmin.capabilitiesScope')}</th>
                                        <th className="p-4">{t('exchangeAdmin.createdUsed')}</th>
                                        <th className="p-4">{t('qaOverview.status')}</th>
                                        <th className="p-4 text-right">{t('common.actions')}</th>
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
                                            <tr key={k.id} className="hover:bg-sf-raised/50 transition">
                                                <td className="p-4">
                                                    <div className="font-bold text-sf-text">{k.name}</div>
                                                    <div className="text-xs font-mono text-sf-muted mt-0.5">
                                                        {t('exchangeAdmin.connectionShort')} <span className="font-semibold text-emerald-700 dark:text-emerald-400">{k.connectionId || ('conn_' + k.id)}</span>
                                                    </div>
                                                    <div className="text-[11px] text-sf-muted">{t('exchangeAdmin.owner')} {k.createdBy || t('exchangeAdmin.administrator')}</div>
                                                </td>
                                                <td className="p-4 font-mono text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                                                    {k.keyPrefix}••••••••
                                                </td>
                                                <td className="p-4 space-y-1.5">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold">
                                                            {k.role}
                                                        </span>
                                                        {caps.length > 0 ? caps.map(cap => (
                                                            <span key={cap} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sf-raised text-sf-text border border-sf-divider">
                                                                {cap}
                                                            </span>
                                                        )) : (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                {t('exchangeAdmin.noCapabilities')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-sf-muted">
                                                        {t('exchangeAdmin.territory')} {k.countries?.join(', ') || t('exchangeAdmin.globalScope')}
                                                    </div>
                                                    <div className="text-xs text-sf-muted font-medium">
                                                        {t('exchangeAdmin.labs')} {Array.isArray(k.labs) ? (k.labs.includes('*') ? t('exchangeAdmin.allLabs') : k.labs.join(', ')) : (k.labs ? (JSON.parse(k.labs).includes('*') ? t('exchangeAdmin.allLabs') : JSON.parse(k.labs).join(', ')) : t('common.none'))}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-xs text-sf-muted space-y-0.5">
                                                    <div>{t('exchangeAdmin.created')} {new Date(k.createdAt).toLocaleDateString()}</div>
                                                    <div>{t('exchangeAdmin.used')} {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : t('common.never')}</div>
                                                </td>
                                                <td className="p-4">
                                                    {(k.isRotating || k.keyStatus === 'ROTATING') ? (
                                                        <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-1.5" title={t('exchangeAdmin.rotationGraceTooltip')}>
                                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> {t('exchangeAdmin.rotating')}
                                                        </span>
                                                    ) : k.isActive ? (
                                                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> {t('projects.active')}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold">
                                                            {k.keyStatus === 'RETIRED' ? t('labManagement.status.retired') : t('resultReports.revoked')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        {(k.isRotating || k.keyStatus === 'ROTATING') && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleConfirmRotation(k.id)}
                                                                    className="p-2 text-sf-muted hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                                                                    title={t('exchangeAdmin.confirmRotationTooltip')}
                                                                >
                                                                    <CheckCheck size={16} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleAbortRotation(k.id)}
                                                                    className="p-2 text-sf-muted hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition"
                                                                    title={t('exchangeAdmin.abortRotationTooltip')}
                                                                >
                                                                    <RotateCcw size={16} />
                                                                </button>
                                                            </>
                                                        )}
                                                        {k.isActive && !k.isRotating && k.keyStatus !== 'ROTATING' && (
                                                            <button
                                                                onClick={() => handleRotateKey(k.id, k.name)}
                                                                disabled={rotatingKeyId === k.id}
                                                                className="p-2 text-sf-muted hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition disabled:opacity-50"
                                                                title={t('exchangeAdmin.rotateTooltip')}
                                                            >
                                                                <RefreshCw size={16} className={rotatingKeyId === k.id ? 'animate-spin text-emerald-700' : ''} />
                                                            </button>
                                                        )}
                                                        {k.isActive && (
                                                            <button
                                                                onClick={() => handleRevokeKey(k.id, k.name)}
                                                                className="p-2 text-sf-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                                                                title={t('exchangeAdmin.revokeTooltip')}
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
                                <Layers size={16} className="text-emerald-600 dark:text-emerald-400" /> {t('exchangeAdmin.managedConnections')}
                            </h3>
                            <p className="text-xs text-sf-muted mt-0.5">
                                {t('exchangeAdmin.managedConnectionsHelp')}
                            </p>
                        </div>
                        <button
                            onClick={fetchConnections}
                            disabled={connectionsLoading}
                            className="px-3 py-1.5 bg-sf-raised hover:bg-sf-hover text-sf-text rounded-xl text-xs font-semibold transition flex items-center gap-1.5 border border-sf-divider"
                        >
                            <RefreshCw size={14} className={connectionsLoading ? 'animate-spin' : ''} /> {t('common.refresh')}
                        </button>
                    </div>

                    {connectionsLoading && connections.length === 0 ? (
                        <div className="p-12 text-center text-sf-muted text-xs">
                            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-emerald-600" />
                            {t('exchangeAdmin.loadingConnections')}
                        </div>
                    ) : connections.length === 0 ? (
                        <div className="p-8 text-center bg-sf-surface rounded-2xl border border-sf-divider text-sf-muted text-xs space-y-2">
                            <Layers size={32} className="mx-auto text-sf-muted/50 mb-1" />
                            <p className="font-semibold text-sf-text">{t('exchangeAdmin.noConnections')}</p>
                            <p>{t('exchangeAdmin.noConnectionsHelp')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-sf-divider bg-sf-surface shadow-sm">
                            <table className="w-full text-left text-xs min-w-[750px]">
                                <thead className="bg-sf-raised text-sf-muted uppercase font-bold text-[10px] tracking-wider border-b border-sf-divider">
                                    <tr>
                                        <th className="p-4">{t('exchangeAdmin.connectionIdentity')}</th>
                                        <th className="p-4">{t('exchangeAdmin.statusControl')}</th>
                                        <th className="p-4">{t('exchangeAdmin.authCapabilities')}</th>
                                        <th className="p-4">{t('exchangeAdmin.authorizedScopes')}</th>
                                        <th className="p-4">{t('exchangeAdmin.receiverTelemetry')}</th>
                                        <th className="p-4 text-right">{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sf-divider">
                                    {connections.map((c) => (
                                        <tr key={c.id} className="hover:bg-sf-raised/50 transition">
                                            <td className="p-4 space-y-1">
                                                <div className="font-bold text-sf-text text-sm flex items-center gap-1.5">
                                                    {c.name}
                                                </div>
                                                <div className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 inline-block font-semibold">
                                                    {c.id}
                                                </div>
                                                {c.organization && (
                                                    <div className="text-[11px] text-sf-muted">
                                                        {t('exchangeAdmin.org')} <span className="font-medium text-sf-text">{c.organization}</span>
                                                        {c.contactEmail && ` (${c.contactEmail})`}
                                                    </div>
                                                )}
                                                {c.clientCode && (
                                                    <div className="text-[10px] text-sf-muted">
                                                        {t('exchangeAdmin.clientCode')} <span className="font-mono text-sf-text">{c.clientCode}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 space-y-2">
                                                <div>
                                                    {c.status === 'ACTIVE' ? (
                                                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> {t('projects.active')}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-xs font-bold inline-flex items-center gap-1.5">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {t('controlCharts.ruleStatus.DISABLED')}
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
                                                    {c.status === 'ACTIVE' ? t('exchangeAdmin.disableConnection') : t('exchangeAdmin.enableConnection')}
                                                </button>
                                            </td>
                                            <td className="p-4 space-y-1.5">
                                                <span className="px-2 py-0.5 rounded-md bg-sf-raised text-sf-text font-mono text-[11px] font-bold border border-sf-divider inline-block">
                                                    {t('resultReports.colVersion')} {c.authVersion || 1}
                                                </span>
                                                <div className="flex flex-wrap gap-1">
                                                    {(c.capabilities || []).length > 0 ? (
                                                        c.capabilities.map((cap) => (
                                                            <span key={cap} className="px-1.5 py-0.5 rounded bg-sf-raised text-sf-text text-[10px] font-bold border border-sf-divider">
                                                                {cap}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-[10px] text-sf-muted italic">{t('exchangeAdmin.denyAll')}</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-sf-muted">
                                                    {t('exchangeAdmin.linkedKeys')} <span className="font-bold text-sf-text">{c.activeKeyIds?.length || 0}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 space-y-1">
                                                <div className="text-[11px]">
                                                    <span className="text-sf-muted">{t('exchangeAdmin.countries')} </span>
                                                    <span className="font-medium text-sf-text">
                                                        {(c.countries || []).join(', ') || t('exchangeAdmin.allWildcard')}
                                                    </span>
                                                </div>
                                                <div className="text-[11px]">
                                                    <span className="text-sf-muted">{t('exchangeAdmin.labs')} </span>
                                                    <span className="font-medium text-sf-text">
                                                        {c.labs?.length ? `${c.labs.length} laboratories` : t('exchangeAdmin.deny')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 space-y-1">
                                                <div className="text-[11px]">
                                                    <span className="text-sf-muted">{t('exchangeAdmin.receiverIngested')} </span>
                                                    {(c.telemetry?.receiverReportedImported != null || c.telemetry?.totalImported != null) ? (
                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                            {c.telemetry.receiverReportedImported ?? c.telemetry.totalImported}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sf-muted italic">{t('exchangeAdmin.notReported')}</span>
                                                    )}
                                                </div>
                                                <div className="text-[11px]">
                                                    <span className="text-sf-muted">{t('exchangeAdmin.receiverQuarantined')} </span>
                                                    {(c.telemetry?.receiverReportedQuarantined != null || c.telemetry?.totalQuarantined != null) ? (
                                                        <span className="font-bold text-amber-600 dark:text-amber-400">
                                                            {c.telemetry.receiverReportedQuarantined ?? c.telemetry.totalQuarantined}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sf-muted italic">{t('exchangeAdmin.notReported')}</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] font-mono text-sf-muted">
                                                    {t('exchangeAdmin.reportedCheckpoint')} <span className="text-sf-text">{c.telemetry?.lastReportedCheckpoint || c.telemetry?.lastCheckpoint || t('exchangeAdmin.notReported')}</span>
                                                </div>
                                                <div className="text-[10px] text-sf-muted">
                                                    {t('exchangeAdmin.lastReceipt')} <span className="text-sf-text">{c.telemetry?.lastReceiptAt ? new Date(c.telemetry.lastReceiptAt).toLocaleString() : t('exchangeAdmin.notReported')}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setEditingConnection(JSON.parse(JSON.stringify(c)))}
                                                    className="px-3 py-1.5 bg-sf-raised hover:bg-sf-hover text-sf-text rounded-xl text-xs font-bold transition border border-sf-divider inline-flex items-center gap-1.5"
                                                >
                                                    <Sliders size={14} /> {t('exchangeAdmin.editScopes')}
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
                                <h3 className="text-base font-bold text-sf-text">{t('exchangeAdmin.editConnection')}</h3>
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
                                    {t('exchangeAdmin.connectionName')}
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
                                        {t('qaOverview.status')}
                                    </label>
                                    <select
                                        value={editingConnection.status || 'ACTIVE'}
                                        onChange={(e) => setEditingConnection({ ...editingConnection, status: e.target.value })}
                                        className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sf-text font-medium"
                                    >
                                        <option value="ACTIVE">{t('exchangeAdmin.activeOperational')}</option>
                                        <option value="DISABLED">{t('exchangeAdmin.disabledHalt')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sf-muted font-bold uppercase tracking-wider mb-1">
                                        {t('adminDetails.contactEmail')}
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
                                    {t('exchangeAdmin.grantedCapabilities')}
                                </label>
                                <div className="grid grid-cols-2 gap-2 p-3 bg-sf-canvas rounded-xl border border-sf-divider">
                                    {[
                                        { id: 'SPATIAL', label: t('exchangeAdmin.spatialCapability') },
                                        { id: 'SPECTRAL', label: t('exchangeAdmin.spectralCapability') },
                                        { id: 'SNAPSHOT', label: t('exchangeAdmin.snapshotCapability') },
                                        { id: 'RECEIPT', label: t('exchangeAdmin.receiptCapability') }
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
                                                className="rounded text-emerald-700 focus:ring-emerald-500"
                                            />
                                            <span className="font-semibold text-[11px]">{cap.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sf-muted font-bold uppercase tracking-wider mb-1.5">
                                    {t('exchangeAdmin.authorizedLabs')}
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
                                                className="rounded text-emerald-700 focus:ring-emerald-500"
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
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatingConnection}
                                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-sm disabled:opacity-50"
                                >
                                    {updatingConnection ? t('common.saving') : t('exchangeAdmin.saveConnection')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TAB 2: STEP-BY-STEP USER GUIDE */}
            {activeTab === 'guide' && (
                <div className="space-y-6">
                    <div className="p-5 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                        <Sparkles size={20} className="text-emerald-700 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                                {t('exchangeAdmin.fourSteps')}
                            </h4>
                            <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                                {t('exchangeAdmin.fourStepsHelp')}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Step 1 */}
                        <div className="p-6 bg-sf-surface rounded-3xl border border-sf-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-emerald-700 text-white font-black text-sm flex items-center justify-center">
                                    1
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                                    {t('exchangeAdmin.provisioning')}
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-sf-text text-base">{t('exchangeAdmin.generateIntegrationKey')}</h4>
                                <p className="text-xs text-sf-muted mt-1 leading-relaxed">
                                    {t('exchangeAdmin.provisionGuide', { action: t('exchangeAdmin.generateKey') })}
                                </p>
                            </div>
                            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                    <Lock size={14} /> {t('exchangeAdmin.securityNotice')}
                                </div>
                                <p>{t('exchangeAdmin.secretGuide', { prefix: 'slims_live_' })}</p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="p-6 bg-sf-surface rounded-3xl border border-sf-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-teal-700 text-white font-black text-sm flex items-center justify-center">
                                    2
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 px-2.5 py-1 rounded-lg">
                                    {t('exchangeAdmin.authentication')}
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-sf-text text-base">{t('exchangeAdmin.authenticateHttp')}</h4>
                                <p className="text-xs text-sf-muted mt-1 leading-relaxed">
                                    {t('exchangeAdmin.headerGuide', { header: 'X-API-Key' })}
                                </p>
                            </div>
                            <div className="p-3 bg-gray-950 text-gray-200 rounded-xl font-mono text-xs space-y-1 border border-sf-divider">
                                <div className="text-sf-muted text-[10px]">{t('exchangeAdmin.exampleHeader')}</div>
                                <div className="text-emerald-400">X-API-Key: slims_live_abc123...</div>
                                <div className="text-teal-300">Accept: application/json</div>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="p-6 bg-sf-surface rounded-3xl border border-sf-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-slate-700 text-white font-black text-sm flex items-center justify-center">
                                    3
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-sf-divider px-2.5 py-1 rounded-lg">
                                    {t('exchangeAdmin.harvesting')}
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-sf-text text-base">{t('exchangeAdmin.selectEndpoint')}</h4>
                                <p className="text-xs text-sf-muted mt-1 leading-relaxed">
                                    {t('exchangeAdmin.selectEndpointHelp')}
                                </p>
                            </div>
                            <ul className="space-y-2 text-xs text-sf-muted">
                                <li className="flex items-center gap-2">
                                    <Sparkles size={14} className="text-amber-500 flex-shrink-0" />
                                    <span><strong>/api/v2/.../capabilities</strong>{t('exchangeAdmin.capabilitiesHelp')}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Database size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                    <span><strong>/api/v2/.../samples</strong>{t('exchangeAdmin.samplesHelp')}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Code2 size={14} className="text-teal-600 dark:text-teal-400 flex-shrink-0" />
                                    <span><strong>/api/v2/.../observations</strong>{t('exchangeAdmin.observationsHelp')}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <Globe size={14} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                    <span><strong>/api/v2/.../geojson</strong>{t('exchangeAdmin.geojsonHelp')}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <RefreshCw size={14} className="text-purple-500 flex-shrink-0" />
                                    <span><strong>/api/v2/.../changes</strong>{t('exchangeAdmin.changesHelp')}</span>
                                </li>
                            </ul>
                        </div>

                        {/* Step 4 */}
                        <div className="p-6 bg-sf-surface rounded-3xl border border-sf-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="w-8 h-8 rounded-xl bg-emerald-700 text-white font-black text-sm flex items-center justify-center">
                                    4
                                </span>
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                                    {t('equipment.typeVerification')}
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-sf-text text-base">{t('exchangeAdmin.testSandbox')}</h4>
                                <p className="text-xs text-sf-muted mt-1 leading-relaxed">
                                    {t('exchangeAdmin.testSandboxHelp')}
                                </p>
                            </div>
                            <button
                                onClick={() => setActiveTab('explorer')}
                                className="btn-primary w-full py-2.5 px-4 flex items-center justify-center gap-2 shadow-sm"
                            >
                                <Play size={14} /> {t('exchangeAdmin.openSandbox')}
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
                                <Sliders size={16} className="text-emerald-600 dark:text-emerald-400" /> {t('exchangeAdmin.requestBuilder')}
                            </h3>
                            <p className="text-xs text-sf-muted">
                                {t('exchangeAdmin.requestBuilderHelp')}
                            </p>
                        </div>

                        {/* Endpoint Selector & Version Filter */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold uppercase tracking-wider text-sf-muted">
                                    {t('exchangeAdmin.targetEndpoint')}
                                </label>
                                <div className="flex items-center gap-1 bg-sf-canvas p-1 rounded-lg border border-sf-divider">
                                    {[
                                        { id: 'all', label: t('exchangeAdmin.allVersions') },
                                        { id: 'v2', label: t('exchangeAdmin.v2Lossless') },
                                        { id: 'v1', label: t('exchangeAdmin.v1Legacy') }
                                    ].map((f) => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => setEndpointFilter(f.id)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                                endpointFilter === f.id
                                                    ? 'bg-emerald-700 text-white'
                                                    : 'text-sf-muted hover:text-sf-text'
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
                                className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-600 text-sf-text"
                            >
                                {ENDPOINTS.filter(ep => endpointFilter === 'all' || ep.version === endpointFilter).map((ep) => (
                                    <option key={ep.path} value={ep.path}>
                                        [{ep.category}] {ep.title} ({ep.path})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-sf-muted italic">
                                {ENDPOINTS.find(ep => ep.path === selectedEndpoint)?.desc}
                            </p>
                        </div>

                        {/* Query Parameters */}
                        <div className="p-4 bg-sf-canvas/30 rounded-2xl border border-sf-divider/50 space-y-3">
                            <div className="text-xs font-bold uppercase tracking-wider text-sf-muted">
                                {t('exchangeAdmin.queryParameters')}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                        {t('exchangeAdmin.countryScope')}
                                    </label>
                                    <select
                                        value={paramCountry}
                                        onChange={(e) => setParamCountry(e.target.value)}
                                        className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs text-sf-text focus:ring-2 focus:ring-emerald-600 outline-none"
                                    >
                                        <option value="">{t('exchangeAdmin.permittedCountries')}</option>
                                        <option value="GTM">{t('exchangeAdmin.countryGuatemala')}</option>
                                        <option value="HND">{t('exchangeAdmin.countryHonduras')}</option>
                                        <option value="KEN">{t('exchangeAdmin.countryKenya')}</option>
                                        <option value="ZMB">{t('exchangeAdmin.countryZambia')}</option>
                                        <option value="GHA">{t('exchangeAdmin.countryGhana')}</option>
                                        <option value="MOZ">{t('exchangeAdmin.countryMozambique')}</option>
                                        <option value="TUN">{t('exchangeAdmin.countryTunisia')}</option>
                                    </select>
                                </div>

                                {(selectedEndpoint.includes('/samples') || selectedEndpoint.includes('/observations')) && selectedEndpoint.includes('/v2/') && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            {t('exchangeAdmin.exchangeProfile')}
                                        </label>
                                        <select
                                            value={paramProfile}
                                            onChange={(e) => setParamProfile(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs text-sf-text focus:ring-2 focus:ring-emerald-600 outline-none"
                                        >
                                            <option value="">{t('exchangeAdmin.defaultProfile')}</option>
                                            <option value="opennsis">{t('exchangeAdmin.openNsisProfile')}</option>
                                        </select>
                                    </div>
                                )}

                                {(selectedEndpoint.includes('/samples') || selectedEndpoint.includes('/results') || selectedEndpoint.includes('/observations') || selectedEndpoint.includes('/changes')) && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            {t('exchangeAdmin.recordLimit')}
                                        </label>
                                        <input
                                            type="number"
                                            value={paramLimit}
                                            onChange={(e) => setParamLimit(e.target.value)}
                                            min="1"
                                            max="100"
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs font-medium text-sf-text focus:ring-2 focus:ring-emerald-600 outline-none"
                                        />
                                    </div>
                                )}

                                {(selectedEndpoint.includes('/changes') || (selectedEndpoint.includes('/v2/') && (selectedEndpoint.includes('/samples') || selectedEndpoint.includes('/observations')))) && (
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            {t('exchangeAdmin.opaqueCursor')}
                                        </label>
                                        <input
                                            type="text"
                                            value={paramCursor}
                                            onChange={(e) => setParamCursor(e.target.value)}
                                            placeholder={t('exchangeAdmin.cursorExample', { cursor: 'eyJsYXN0VXBkYXRlZEF0IjoiMjAy...' })}
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs font-mono text-sf-text focus:ring-2 focus:ring-emerald-600 outline-none"
                                        />
                                    </div>
                                )}

                                {selectedEndpoint.includes('/spectra') && (
                                    <div>
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            {t('exchangeAdmin.modality')}
                                        </label>
                                        <select
                                            value={paramModality}
                                            onChange={(e) => setParamModality(e.target.value)}
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs text-sf-text focus:ring-2 focus:ring-emerald-600 outline-none"
                                        >
                                            <option value="MIR">{t('exchangeAdmin.midInfrared')}</option>
                                            <option value="NIR">Vis-NIR (350-2500 nm)</option>
                                        </select>
                                    </div>
                                )}

                                {selectedEndpoint.includes('/sync') && (
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-semibold text-sf-muted mb-1">
                                            {t('exchangeAdmin.since')}
                                        </label>
                                        <input
                                            type="text"
                                            value={paramSince}
                                            onChange={(e) => setParamSince(e.target.value)}
                                            placeholder="2026-01-01T00:00:00Z"
                                            className="w-full p-2 rounded-lg border border-sf-divider bg-sf-surface text-xs font-mono text-sf-text focus:ring-2 focus:ring-emerald-600 outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Optional Custom Key */}
                        <div className="space-y-1">
                            <label className="block text-xs font-bold text-sf-muted">
                                {t('exchangeAdmin.testApiKey')}
                            </label>
                            <input
                                type="text"
                                value={customApiKey}
                                onChange={(e) => setCustomApiKey(e.target.value)}
                                placeholder={t('exchangeAdmin.autoSession')}
                                className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-xs font-mono text-sf-text focus:ring-2 focus:ring-emerald-600 outline-none"
                            />
                            <p className="text-[10px] text-sf-muted">
                                {t('exchangeAdmin.autoSessionHelp')}
                            </p>
                        </div>

                        {/* Execute Button */}
                        <button
                            onClick={handleRunSandbox}
                            disabled={sandboxLoading}
                            className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-xs shadow-md disabled:opacity-50"
                        >
                            {sandboxLoading ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    <span>{t('exchangeAdmin.querying')}</span>
                                </>
                            ) : (
                                <>
                                    <Play size={16} />
                                    <span>{t('exchangeAdmin.executeQuery')}</span>
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
                                    <Terminal size={16} className="text-emerald-400" />
                                    <span>{t('exchangeAdmin.codeSnippet')}</span>
                                </div>
                                <div className="flex items-center gap-1 bg-gray-800 p-1 rounded-xl">
                                    {['curl', 'python', 'r', 'js'].map((lang) => (
                                        <button
                                            key={lang}
                                            onClick={() => setSandboxCodeLang(lang)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase transition ${
                                                sandboxCodeLang === lang
                                                    ? 'bg-emerald-700 text-white'
                                                    : 'text-gray-400 hover:text-white'
                                            }`}
                                        >
                                            {lang}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative">
                                <pre className="p-3.5 bg-black/40 rounded-2xl font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed max-h-48">
                                    {generateSnippet()}
                                </pre>
                                <button
                                    onClick={() => copyToClipboard(generateSnippet())}
                                    className="absolute top-2 right-2 p-1.5 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg text-xs flex items-center gap-1 transition shadow"
                                    title={t('exchangeAdmin.copyCode')}
                                >
                                    {copied ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                    <span className="text-[10px]">{copied ? t('exchangeAdmin.copied') : t('common.copy')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Response Output Box */}
                        <div className="bg-sf-surface rounded-3xl p-5 border border-sf-divider shadow-sm space-y-3">
                            <div className="flex justify-between items-center border-b border-sf-divider pb-3">
                                <div className="flex items-center gap-2">
                                    <Code2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                                    <span className="text-xs font-bold text-sf-text uppercase tracking-wider">
                                        {t('exchangeAdmin.serverResponse')}
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
                                            <span className="text-sf-muted font-mono text-[11px]">
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
                                        title={t('exchangeAdmin.copyJson')}
                                    >
                                        {copied ? <CheckCheck size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                        <span className="text-[10px]">{copied ? t('exchangeAdmin.copiedJson') : t('exchangeAdmin.copyJson')}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="p-10 text-center text-sf-muted text-xs border border-dashed border-sf-divider rounded-2xl space-y-2">
                                    <Terminal size={24} className="mx-auto text-sf-muted" />
                                    <div>{t('exchangeAdmin.liveQueryGuide', { action: t('exchangeAdmin.executeQuery') })}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Create API Key Modal */}
            {isCreateModalOpen && (
                <ApiKeyDialog labelledBy="create-api-key-title" describedBy="create-api-key-description" onDismiss={closeCreateModal}>
                    <form onSubmit={handleCreateKey} aria-busy={creating} className="flex flex-col min-h-0 max-h-[calc(100dvh-2rem)]">
                        <header className="shrink-0 p-4 sm:p-6 border-b border-sf-divider">
                            <div className="flex items-start justify-between gap-3">
                                <h2 id="create-api-key-title" className="flex items-start gap-2 font-bold text-base sm:text-lg text-sf-text">
                                    <Key size={20} className="shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" /> {t('exchangeAdmin.issueKey')}
                                </h2>
                                <button type="button" onClick={closeCreateModal} disabled={creating} aria-label={t('common.close', 'Close')} className="shrink-0 p-2 -m-1 rounded-xl hover:bg-sf-hover text-sf-muted disabled:opacity-50">
                                    <X size={20} />
                                </button>
                            </div>
                            <p id="create-api-key-description" className="mt-2 text-xs text-sf-muted">
                                {t('exchangeAdmin.issueKeyHelp')}
                            </p>
                        </header>
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
                            {createError && <p ref={createErrorRef} tabIndex={-1} role="alert" className="mb-4 p-3 rounded-xl text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800">{createError}</p>}
                            <fieldset disabled={creating} className="min-w-0 space-y-4">
                            <div>
                                <label htmlFor="api-key-name" className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    {t('exchangeAdmin.consumerLabel')}
                                </label>
                                <input
                                    id="api-key-name"
                                    type="text"
                                    data-dialog-initial-focus
                                    required
                                    placeholder={t('exchangeAdmin.consumerExample')}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sm font-medium focus:ring-2 focus:ring-emerald-600 outline-none text-sf-text"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    {t('exchangeAdmin.optionalConnectionId')}
                                </label>
                                <input
                                    type="text"
                                    placeholder={t('exchangeAdmin.connectionIdExample')}
                                    value={customConnectionId}
                                    onChange={(e) => setCustomConnectionId(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sm font-mono focus:ring-2 focus:ring-emerald-600 outline-none text-sf-text"
                                />
                                <p className="text-[11px] text-sf-muted mt-1">
                                    {t('exchangeAdmin.persistentIdentity')}
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    {t('exchangeAdmin.accessRole')}
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sm font-medium focus:ring-2 focus:ring-emerald-600 outline-none text-sf-text"
                                >
                                    <option value="NSIS_CONSUMER">{t('exchangeAdmin.nsisConsumer')}</option>
                                    <option value="EXTERNAL_GIS">{t('exchangeAdmin.gisHarvester')}</option>
                                    <option value="GLOBAL_HARVESTER">{t('exchangeAdmin.gspSync')}</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    {t('exchangeAdmin.fineGrained')}
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
                                                className="rounded text-emerald-700 focus:ring-emerald-600 mt-0.5"
                                            />
                                            <div>
                                                <div className="font-mono font-bold text-[11px] text-sf-text">{cap.label}</div>
                                                <div className="text-[10px] text-sf-muted">{cap.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    {t('exchangeAdmin.territorialScope')}
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
                                                className="rounded text-emerald-700 focus:ring-emerald-600"
                                            />
                                            <span className="font-semibold">{c.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    {t('exchangeAdmin.authorizedLabScope')}
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
                                            className="rounded text-emerald-700 focus:ring-emerald-600"
                                        />
                                        <span>{t('exchangeAdmin.allLabsGlobal')}</span>
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
                                                className="rounded text-emerald-700 focus:ring-emerald-600"
                                            />
                                            <span className="font-semibold">{l.name || l.id} ({l.code || l.id})</span>
                                            {l.country && <span className="text-[10px] text-sf-muted">· {l.country}</span>}
                                        </label>
                                    ))}
                                    {availableLabs.length === 0 && (
                                        <p className="text-xs text-sf-muted italic p-2">{t('exchangeAdmin.loadingLabs')}</p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    {t('exchangeAdmin.keyExpiration')}
                                </label>
                                <select
                                    value={expiresDays}
                                    onChange={(e) => setExpiresDays(e.target.value)}
                                    className="w-full p-2.5 rounded-xl border border-sf-divider bg-sf-canvas text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-600 text-sf-text"
                                >
                                    <option value="90">{t('exchangeAdmin.ninetyDays')}</option>
                                    <option value="180">{t('exchangeAdmin.oneEightyDays')}</option>
                                    <option value="365">{t('exchangeAdmin.oneYear')}</option>
                                    <option value="730">{t('exchangeAdmin.twoYears')}</option>
                                    <option value="0">{t('exchangeAdmin.neverExpires')}</option>
                                </select>
                            </div>

                            </fieldset>
                        </div>
                            <footer className="shrink-0 flex flex-wrap justify-end gap-2 p-4 sm:px-6 border-t border-sf-divider bg-sf-surface">
                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    disabled={creating}
                                    className="px-4 py-2 text-sf-muted hover:text-sf-text text-xs font-bold disabled:opacity-50"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                                >
                                    {creating ? t('common.generating') : t('exchangeAdmin.generateSecretKey')}
                                </button>
                            </footer>
                    </form>
                </ApiKeyDialog>
            )}

            {/* Secret Key Display Modal (Shown only once) */}
            {generatedKey && (
                <ApiKeyDialog labelledBy="generated-api-key-title" describedBy="generated-api-key-warning">
                    <div className="flex flex-col min-h-0 max-h-[calc(100dvh-2rem)] text-center">
                        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-8 space-y-6">
                        <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                            <CheckCircle2 size={32} />
                        </div>

                        <div className="space-y-2">
                            <h2 id="generated-api-key-title" className="text-xl font-black text-sf-text">{t('exchangeAdmin.keyGenerated')}</h2>
                            <p id="generated-api-key-warning" className="text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/50 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800">
                                {t('exchangeAdmin.copyKeyNow')}
                            </p>
                        </div>

                        <div className="p-4 bg-gray-900 text-emerald-400 font-mono text-xs rounded-2xl flex items-center justify-between gap-3 border border-gray-800 break-all select-all">
                            <span className="min-w-0">{generatedKey}</span>
                            <button
                                type="button"
                                onClick={copyGeneratedKey}
                                data-dialog-initial-focus
                                className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl flex-shrink-0 transition flex items-center gap-1 text-xs"
                            >
                                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                <span>{copied ? t('exchangeAdmin.copied') : t('common.copy')}</span>
                            </button>
                        </div>
                        {secretCopyError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{secretCopyError}</p>}
                        </div>
                        <footer className="shrink-0 p-4 sm:px-8 border-t border-sf-divider bg-sf-surface">
                        <button
                            type="button"
                            onClick={() => setGeneratedKey(null)}
                            className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow-sm"
                        >
                            {t('exchangeAdmin.savedKey')}
                        </button>
                        </footer>
                    </div>
                </ApiKeyDialog>
            )}
        </div>
    );
};

export default ApiKeyManager;
