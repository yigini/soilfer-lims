import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
    FlaskConical, CheckCircle2, AlertCircle, Save, 
    RefreshCw, Filter, ShieldCheck, Sparkles, Building2
} from 'lucide-react';

const getUrlLabId = () => {
    if (typeof window === 'undefined' || !window.location || !window.location.search) {
        return null;
    }
    try {
        const params = new URLSearchParams(window.location.search);
        return params.get('labId') || null;
    } catch {
        return null;
    }
};

const LabMethods = () => {
    const { user } = useAuth();
    const { t } = useLanguage();

    const [labs, setLabs] = useState([]);
    const [selectedLabId, setSelectedLabId] = useState(() => {
        const urlLab = getUrlLabId();
        if (urlLab) return urlLab;
        if (user?.labId) return user.labId;
        return '';
    });
    const [defaults, setDefaults] = useState([]);
    const [loadedLabId, setLoadedLabId] = useState(null);
    const [loadError, setLoadError] = useState(false);
    const [loading, setLoading] = useState(() => Boolean(getUrlLabId() || user?.labId));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [filterMatrix, setFilterMatrix] = useState('ALL');
    const [filterModule, setFilterModule] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [isWizardOpen, setIsWizardOpen] = useState(false);

    const activeRequestIdRef = useRef(0);
    const selectedLabIdRef = useRef(selectedLabId);
    useEffect(() => {
        selectedLabIdRef.current = selectedLabId;
    }, [selectedLabId]);

    // Handle lab dropdown change with safe URL reflection
    const handleLabChange = (newLabId) => {
        setSelectedLabId(newLabId);
        if (typeof window !== 'undefined' && window.history?.replaceState && window.location) {
            try {
                const searchParams = new URLSearchParams(window.location.search || '');
                if (newLabId && newLabId !== 'LAB-DEFAULT') {
                    searchParams.set('labId', newLabId);
                } else {
                    searchParams.delete('labId');
                }
                const newSearch = searchParams.toString();
                const newUrl = (window.location.pathname || '') + (newSearch ? `?${newSearch}` : '');
                window.history.replaceState(null, '', newUrl);
            } catch {
                // Ignore environment limitations with history API
            }
        }
    };

    // Fetch labs list if user has access to multiple labs
    useEffect(() => {
        let isCancelled = false;
        const fetchLabs = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/labs', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (isCancelled) return;
                    setLabs(data);
                    setSelectedLabId(current => {
                        // Honor existing selection (from URL scope, user.labId, or user interaction)
                        if (current) return current;
                        if (data && data.length > 0) {
                            return data[0].id;
                        }
                        return 'LAB-DEFAULT';
                    });
                }
            } catch (err) {
                if (isCancelled) return;
                console.error('Failed to load labs list:', err);
                setSelectedLabId(current => current || 'LAB-DEFAULT');
            }
        };
        fetchLabs();
        return () => { isCancelled = true; };
    }, [user]);

    // Fetch lab defaults
    const loadLabDefaults = async (labId) => {
        if (!labId) {
            setDefaults([]);
            setLoadedLabId(null);
            setLoadError(false);
            setLoading(false);
            return;
        }

        const requestId = ++activeRequestIdRef.current;
        setLoading(true);
        // Clear previous state immediately to prevent cross-lab stale data
        setDefaults([]);
        setLoadedLabId(null);
        setLoadError(false);
        setIsWizardOpen(false);
        setMessage(null);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/config/lab-defaults/${labId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Guard against out-of-order race conditions
            if (activeRequestIdRef.current !== requestId) return;

            if (res.ok) {
                const data = await res.json();
                setDefaults(data);
                setLoadedLabId(labId);
                setLoadError(false);
                // Check if any overrides exist — if none, trigger setup wizard prompt
                const hasOverrides = data.some(d => d.isOverridden);
                if (!hasOverrides && data.length > 0) {
                    setIsWizardOpen(true);
                } else {
                    setIsWizardOpen(false);
                }
            } else {
                throw new Error('Configuration could not be loaded.');
            }
        } catch (err) {
            // Guard against out-of-order error handling
            if (activeRequestIdRef.current !== requestId) return;
            console.error('Failed to load defaults:', err);
            setDefaults([]);
            setLoadedLabId(null);
            setLoadError(true);
            setIsWizardOpen(false);
            setMessage({ type: 'error', text: 'Failed to load laboratory methodology defaults.' });
        } finally {
            if (activeRequestIdRef.current === requestId) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        if (selectedLabId) {
            loadLabDefaults(selectedLabId);
        }
    }, [selectedLabId]);

    const handleMethodChange = (analysisCode, methodologyId) => {
        setDefaults(prev => prev.map(item => {
            if (item.analysisCode === analysisCode) {
                return {
                    ...item,
                    chosenMethodologyId: methodologyId,
                    effectiveMethodologyId: methodologyId,
                    isOverridden: true
                };
            }
            return item;
        }));
    };

    const canSave = !saving && !loading && !loadError && Boolean(selectedLabId) && loadedLabId === selectedLabId && defaults.length > 0;

    const handleSave = async () => {
        if (!canSave) return;

        setSaving(true);
        setMessage(null);
        const targetLabId = selectedLabId;

        try {
            const token = localStorage.getItem('token');
            const payload = defaults
                .filter(d => d.chosenMethodologyId !== null)
                .map(d => ({
                    analysisCode: d.analysisCode,
                    methodologyId: d.chosenMethodologyId
                }));

            const res = await fetch(`/api/config/lab-defaults/${targetLabId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ defaults: payload })
            });

            if (res.ok) {
                setMessage({ type: 'success', text: 'Laboratory methodology defaults successfully saved.' });
                setIsWizardOpen(false);
                if (selectedLabIdRef.current === targetLabId) {
                    await loadLabDefaults(targetLabId);
                }
            } else {
                const errData = await res.json().catch(() => ({}));
                setMessage({ type: 'error', text: errData.error || 'Failed to save defaults.' });
            }
        } catch (err) {
            console.error('Error saving lab defaults:', err);
            setMessage({ type: 'error', text: 'Connection error while saving methodology defaults.' });
        } finally {
            setSaving(false);
        }
    };

    // Filter list
    const filteredDefaults = defaults.filter(item => {
        if (filterMatrix !== 'ALL' && item.matrix !== filterMatrix) return false;
        if (filterModule !== 'ALL' && item.module !== filterModule) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return item.analysisCode.toLowerCase().includes(q) || item.analysisName.toLowerCase().includes(q);
        }
        return true;
    });

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-sf-surface p-6 rounded-xl border border-sf-divider shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <FlaskConical className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-sf-text">Laboratory Methodology Defaults</h1>
                            <p className="text-sm text-sf-muted">Configure standard operating procedures and default methods for work items</p>
                        </div>
                    </div>
                </div>

                {/* Lab Selector & Actions */}
                <div className="flex flex-wrap items-center gap-3">
                    {labs.length > 1 && (
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <select
                                value={selectedLabId}
                                onChange={(e) => handleLabChange(e.target.value)}
                                className="px-3 py-2 bg-sf-canvas border border-sf-divider rounded-lg text-sm font-medium text-sf-text focus:ring-2 focus:ring-emerald-500"
                            >
                                {selectedLabId && !labs.some(l => l.id === selectedLabId) && (
                                    <option key={selectedLabId} value={selectedLabId}>{selectedLabId}</option>
                                )}
                                {labs.map(l => (
                                    <option key={l.id} value={l.id}>{l.name || l.id} ({l.code || l.id})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                    >
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Defaults
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {message && (
                <div className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
                    message.type === 'success' 
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800' 
                        : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
                }`}>
                    {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* First-Run Setup Wizard Banner */}
            {isWizardOpen && (
                <div className="p-6 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border-2 border-emerald-500/30 rounded-xl space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Sparkles className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            <div>
                                <h3 className="text-lg font-bold text-sf-text">Laboratory Method Onboarding Wizard</h3>
                                <p className="text-sm text-sf-muted">
                                    This laboratory does not currently have custom methodology overrides. Default FAO GLOSOLAN SOPs are active. 
                                    Review the table below, customize any methods matching your laboratory instruments, and confirm the list.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsWizardOpen(false)}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 uppercase font-semibold"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-4 bg-sf-surface p-4 rounded-xl border border-sf-divider shadow-sm">
                <input
                    type="text"
                    placeholder="Search analyses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 min-w-[200px] px-3 py-2 bg-sf-canvas border border-sf-divider rounded-lg text-sm text-sf-text"
                />

                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Matrix:</span>
                    <select
                        value={filterMatrix}
                        onChange={(e) => setFilterMatrix(e.target.value)}
                        className="px-3 py-2 bg-sf-canvas border border-sf-divider rounded-lg text-sm text-sf-text"
                    >
                        <option value="ALL">All Matrices</option>
                        <option value="SOIL">Soil</option>
                        <option value="PLANT">Plant Tissue</option>
                        <option value="WATER">Water</option>
                        <option value="FERTILIZER">Fertilizer</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase">Module:</span>
                    <select
                        value={filterModule}
                        onChange={(e) => setFilterModule(e.target.value)}
                        className="px-3 py-2 bg-sf-canvas border border-sf-divider rounded-lg text-sm text-sf-text"
                    >
                        <option value="ALL">All Modules</option>
                        <option value="FERTILITY">Fertility</option>
                        <option value="HEALTH">Health</option>
                        <option value="ENVIRONMENTAL">Environmental</option>
                        <option value="QUALITY">Quality</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-sf-surface rounded-xl border border-sf-divider shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-500 flex flex-col items-center gap-3">
                        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
                        <span>Loading methodology defaults...</span>
                    </div>
                ) : loadError ? (
                    <div className="p-12 text-center text-amber-700 dark:text-amber-400">
                        Failed to load laboratory methodology defaults for the selected laboratory.
                    </div>
                ) : filteredDefaults.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        No analytical parameters match the selected filters.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-sf-canvas/50 text-sf-muted uppercase text-xs font-semibold border-b border-sf-divider">
                                <tr>
                                    <th className="px-6 py-4">Parameter</th>
                                    <th className="px-6 py-4">Matrix / Module</th>
                                    <th className="px-6 py-4">Active Methodology</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sf-divider">
                                {filteredDefaults.map(item => {
                                    return (
                                        <tr key={item.analysisCode} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-sf-text">{item.analysisName}</div>
                                                <div className="text-xs text-mono text-gray-400">{item.analysisCode}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-sf-raised text-sf-muted">
                                                        {item.matrix}
                                                    </span>
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                                                        {item.module}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 min-w-[320px]">
                                                {item.configurationError && <p role="alert" className="mb-2 text-xs text-amber-800 dark:text-amber-300">{item.configurationError}</p>}
                                                {item.methodologies.length > 0 ? (
                                                    <select
                                                        value={item.effectiveMethodologyId || ''}
                                                        onChange={(e) => handleMethodChange(item.analysisCode, e.target.value)}
                                                        className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-lg text-sm text-sf-text focus:ring-2 focus:ring-emerald-500"
                                                    >
                                                        <option value="">Choose a method / use a valid shared default</option>
                                                        {item.methodologies.map(m => (
                                                            <option key={m.id} value={m.id}>
                                                                {m.name} {m.standard ? `(${m.standard})` : ''} {m.isDefault ? '★ Default' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs text-amber-700 italic">No method configured</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {item.isOverridden ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                                                        <ShieldCheck className="w-3.5 h-3.5" /> Lab Choice
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sf-raised text-sf-muted">
                                                        GLOSOLAN Standard
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LabMethods;
