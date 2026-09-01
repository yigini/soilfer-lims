import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNotifications } from '../context/NotificationContext';
import {
    Beaker, CheckCircle, Clock, AlertTriangle, Save, PlayCircle,
    ChevronRight, Filter, RefreshCw, Trash2, X, Check, ArrowRight,
    Activity, Zap, FileText, Search, ChevronDown, Wrench, ShieldAlert,
    Droplets, FlaskConical, Radio, Download, XCircle, Info
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const AUTOSAVE_INTERVAL = 1500; // ms — debounce before server save
const POLL_INTERVAL = 20000; // 20s
const DRAFT_KEY = (username, analysis) => `workbench-drafts-${username}-${analysis}`;
const TEXTURE_ANALYSES = ['SAND', 'CLAY', 'SILT'];
const TEXTURE_TOLERANCE = 2.0; // ±2.0% realistic method tolerance for hydrometer/pipette closure

// ─────────────────────────────────────────────────────────────────────────────
// TOAST COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Toast = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const colors = {
        success: 'bg-emerald-600 text-white',
        error: 'bg-red-600 text-white',
        warning: 'bg-amber-500 text-white',
        info: 'bg-blue-600 text-white'
    };

    return (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl ${colors[type] || colors.info} flex items-center gap-3 max-w-sm animate-slide-in-right`}>
            <span className="text-sm font-medium">{message}</span>
            <button onClick={onClose} className="opacity-70 hover:opacity-100 transition-opacity">
                <X size={16} />
            </button>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const configs = {
        ASSIGNED: { label: 'Awaiting Input', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', icon: Clock },
        IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: Activity },
        REANALYSIS_REQUIRED: { label: 'Reanalysis', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: AlertTriangle },
        COMPLETED: { label: 'Completed', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: CheckCircle },
        drafted: { label: 'Drafted', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', icon: Save },
        saved: { label: 'Saved ✓', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: Check },
        completed: { label: 'Completed ✓', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', icon: Check },
        error: { label: 'Error', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
    };
    const cfg = configs[status] || configs.ASSIGNED;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
            <Icon size={12} />
            {cfg.label}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY BADGE
// ─────────────────────────────────────────────────────────────────────────────
const PriorityBadge = ({ priority }) => {
    if (!priority || priority === 'NORMAL') return null;
    const colors = {
        HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
        URGENT: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${colors[priority] || ''}`}>
            {priority}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// GATE BADGES — Fix 1: Surface gate status per row
// ─────────────────────────────────────────────────────────────────────────────
const GateBadges = ({ item }) => {
    const gateCfg = {
        DONE: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
        PENDING: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
        FAILED: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
    };

    // Skip for operational gates themselves
    if (item.category === 'Operational Gates' || item.category === 'Post-Analytical') return null;

    const drying = item.dryingStatus || 'PENDING';
    const prep = item.preparationStatus || 'PENDING';
    const dCfg = gateCfg[drying] || gateCfg.PENDING;
    const pCfg = gateCfg[prep] || gateCfg.PENDING;

    return (
        <div className="flex items-center gap-1">
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${dCfg.color} ${dCfg.bg}`}
                title={`Drying: ${drying}`}>
                <Droplets size={10} /> {drying === 'DONE' ? '✓' : drying === 'FAILED' ? '✗' : '…'}
            </span>
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${pCfg.color} ${pCfg.bg}`}
                title={`Preparation: ${prep}`}>
                <FlaskConical size={10} /> {prep === 'DONE' ? '✓' : '…'}
            </span>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
const ValidationIndicator = ({ value, validation }) => {
    if (!value || !validation) return null;
    const num = Number(value);
    if (isNaN(num)) {
        return <span className="text-red-500 text-xs font-medium">Invalid</span>;
    }
    const { min, max } = validation;
    if (min !== undefined && num < min) {
        return <span className="text-red-500 text-xs" title={`Minimum: ${min}`}>⚠ Below {min}</span>;
    }
    if (max !== undefined && num > max) {
        return <span className="text-red-500 text-xs" title={`Maximum: ${max}`}>⚠ Above {max}</span>;
    }
    return <span className="text-emerald-500 text-xs">✓</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT SELECT — Fix 2: Instrument picker
// ─────────────────────────────────────────────────────────────────────────────
const EquipmentSelect = ({ value, onChange, eligibleEquipment, required, disabled }) => {
    if (!eligibleEquipment || eligibleEquipment.length === 0) {
        if (required) {
            return (
                <span className="text-xs text-red-500 italic">No eligible instruments configured</span>
            );
        }
        return null;
    }

    const calStatusIcon = (status) => {
        switch (status) {
            case 'OK': return '🟢';
            case 'DUE_SOON': return '🟡';
            case 'OVERDUE': return '🔴';
            default: return '⚪';
        }
    };

    return (
        <select
            value={value || ''}
            onChange={e => onChange(e.target.value || null)}
            disabled={disabled}
            className={`w-full max-w-[160px] px-2 py-1.5 rounded-lg border text-xs bg-white dark:bg-gray-800 focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700 outline-none transition-all ${required && !value
                ? 'border-amber-400 dark:border-amber-600'
                : 'border-gray-300 dark:border-gray-600'
                }`}
        >
            <option value="">{required ? '⚠ Select instrument…' : 'Optional…'}</option>
            {eligibleEquipment.map(eq => (
                <option key={eq.id} value={eq.id}>
                    {calStatusIcon(eq.calibrationStatus)} {eq.name}
                </option>
            ))}
        </select>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// ERROR ROW — Fix 1: Surface server error message per row
// ─────────────────────────────────────────────────────────────────────────────
const ErrorMessage = ({ feedback }) => {
    if (!feedback || !feedback.error) return null;
    return (
        <div className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-start gap-1 max-w-[300px]" title={feedback.error}>
            <XCircle size={12} className="flex-shrink-0 mt-0.5" />
            <span className="truncate">{feedback.error}</span>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CHECK IF ROW IS BLOCKED (prerequisites not met)
// ─────────────────────────────────────────────────────────────────────────────
const isRowBlocked = (item) => {
    if (item.category === 'Operational Gates' || item.category === 'Post-Analytical') return null;
    if (item.analysis === 'DRYING') return null; // Drying has its own gate check
    if (item.analysis === 'PREPARATION') {
        if (item.dryingStatus !== 'DONE') return 'Drying must be completed first';
        return null;
    }
    const blocked = [];
    if (item.dryingStatus !== 'DONE') blocked.push('Drying');
    if (item.preparationStatus !== 'DONE') blocked.push('Preparation');
    if (blocked.length > 0) return `Waiting for: ${blocked.join(', ')}`;
    if (item.sampleStatus === 'ON_HOLD') return 'Sample is ON HOLD';
    return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TechWorkbench = () => {
    const { user, token } = useAuth();
    const { t } = useLanguage();
    const { subscribeToEvent } = useNotifications();

    // Data state
    const [groups, setGroups] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // UI state
    const [activeTab, setActiveTab] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState(new Set());

    // Draft values: { [workItemId]: { value, equipmentId, overrideReason } }
    const [draftValues, setDraftValues] = useState({});
    const [lastSaved, setLastSaved] = useState(null);
    const [saveIndicator, setSaveIndicator] = useState('');

    // Fix 1: Submission feedback — now stores { status, error?, flags? } per item
    const [itemFeedback, setItemFeedback] = useState({});

    // Fix 1: Toast state
    const [toast, setToast] = useState(null);

    // Phase 5: Completion handoff banner — links to sample detail for submission
    const [completedBanner, setCompletedBanner] = useState(null);

    // Fix 6: Polling state
    const [lastFetch, setLastFetch] = useState(null);
    const [isLive, setIsLive] = useState(true);

    const inputRefs = useRef({});
    const autosaveTimer = useRef(null);
    const pollTimer = useRef(null);
    const serverSaveTimer = useRef(null);
    const serverSavePending = useRef(false);

    // Phase 7: Single-layout per viewport — prevents dual DOM + ref collision
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const handler = (e) => setIsMobile(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    // Phase 2: Per-workItem version tracking — prevents stale version conflicts
    const versionMapRef = useRef({});
    // Phase 3: Track which workItemIds changed since last autosave
    const dirtySetRef = useRef(new Set());
    // Fix 1: Ref to latest processedGroups for tab-independent autosave
    const groupsRef = useRef([]);
    // Fix 2: Hydration guard — suppress autosave while restoring drafts
    const isHydratingDraftsRef = useRef(false);
    // Fix 4: Throttle ref for WS-triggered refresh
    const wsRefreshThrottleRef = useRef(0);

    const axiosConfig = useMemo(() => ({
        headers: { Authorization: `Bearer ${token}` }
    }), [token]);

    // ─── Fetch Queue ───
    const fetchQueue = useCallback(async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            const { data } = await axios.get('/api/workbench/queue', axiosConfig);
            setGroups(data.groups || []);
            setStats(data.stats || {});
            setLastFetch(new Date());
            setIsLive(true);
            if (data.groups?.length > 0 && !activeTab) {
                setActiveTab(data.groups[0].analysis);
            }
            // Phase 2: Initialize/refresh versionMap from server data
            const newVersionMap = { ...versionMapRef.current };
            (data.groups || []).forEach(g => {
                g.items.forEach(item => {
                    newVersionMap[item.workItemId] = item.version;
                });
            });
            versionMapRef.current = newVersionMap;
        } catch (err) {
            console.error('Failed to fetch workbench queue:', err);
            setIsLive(false);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [axiosConfig, activeTab]);

    useEffect(() => { fetchQueue(); }, []);

    // ─── Merge SAND/CLAY/SILT into a virtual TEXTURE group ───
    const processedGroups = useMemo(() => {
        const textureGroups = groups.filter(g => TEXTURE_ANALYSES.includes(g.analysis));
        const otherGroups = groups.filter(g => !TEXTURE_ANALYSES.includes(g.analysis));

        if (textureGroups.length === 0) return otherGroups;

        // Build a map of sampleId → { SAND: workItem, CLAY: workItem, SILT: workItem }
        const sampleTextures = {};
        textureGroups.forEach(g => {
            g.items.forEach(item => {
                if (!sampleTextures[item.sampleId]) {
                    sampleTextures[item.sampleId] = {
                        sampleId: item.sampleId,
                        labId: item.labId,
                        originalId: item.originalId,
                        projectCode: item.projectCode,
                        status: item.status,
                        dryingStatus: item.dryingStatus,
                        preparationStatus: item.preparationStatus,
                        sampleStatus: item.sampleStatus,
                        priority: item.priority,
                        version: item.version,
                        category: item.category,
                        components: {}
                    };
                }
                sampleTextures[item.sampleId].components[g.analysis] = {
                    workItemId: item.workItemId,
                    currentResult: item.currentResult,
                    equipmentId: item.equipmentId,
                    status: item.status,
                    version: item.version,
                    unit: g.unit
                };
            });
        });

        const textureItems = Object.values(sampleTextures);

        const textureGroup = {
            analysis: 'TEXTURE',
            analysisName: 'Texture',
            category: textureGroups[0]?.category || 'Physical',
            unit: '%',
            validation: null,
            equipmentRequired: false,
            eligibleEquipment: [],
            isTexture: true,
            items: textureItems,
            // Collect original workItemIds for saving
            _textureGroups: textureGroups
        };

        return [textureGroup, ...otherGroups];
    }, [groups]);

    // ─── Tab status color helper ───
    const getTabColor = useCallback((group) => {
        if (!group?.items?.length) return { border: 'border-gray-300', dot: 'bg-gray-300', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };

        const items = group.items;
        const hasTexture = group.isTexture;

        let allPending = true;
        let allCompleted = true;
        let hasDrafts = false;

        items.forEach(item => {
            if (hasTexture) {
                // Texture: check each component's status
                Object.values(item.components || {}).forEach(comp => {
                    const d = draftValues[comp.workItemId];
                    if (comp.status !== 'ASSIGNED') allPending = false;
                    if (comp.status !== 'COMPLETED' && !(itemFeedback[comp.workItemId]?.status === 'completed')) allCompleted = false;
                    if (d?.value || comp.status === 'IN_PROGRESS') hasDrafts = true;
                });
            } else {
                const d = draftValues[item.workItemId];
                if (item.status !== 'ASSIGNED') allPending = false;
                if (item.status !== 'COMPLETED' && !(itemFeedback[item.workItemId]?.status === 'completed')) allCompleted = false;
                if (d?.value || item.status === 'IN_PROGRESS') hasDrafts = true;
            }
        });

        if (allCompleted) return {
            border: 'border-emerald-500',
            dot: 'bg-emerald-500',
            badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-200'
        };
        if (hasDrafts) return {
            border: 'border-indigo-500',
            dot: 'bg-indigo-500',
            badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200'
        };
        if (allPending) return {
            border: 'border-amber-500',
            dot: 'bg-amber-500',
            badge: 'bg-amber-100 text-amber-700 dark:bg-amber-800 dark:text-amber-200'
        };
        return {
            border: 'border-gray-400',
            dot: 'bg-gray-400',
            badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        };
    }, [draftValues, itemFeedback]);

    // ─── Fix 6: Polling (20s) ───
    useEffect(() => {
        pollTimer.current = setInterval(() => {
            if (!saving) fetchQueue(true);
        }, POLL_INTERVAL);

        return () => {
            if (pollTimer.current) clearInterval(pollTimer.current);
        };
    }, [fetchQueue, saving]);

    // Track staleness
    useEffect(() => {
        const staleCheck = setInterval(() => {
            if (lastFetch && Date.now() - lastFetch.getTime() > 30000) {
                setIsLive(false);
            }
        }, 5000);
        return () => clearInterval(staleCheck);
    }, [lastFetch]);

    // ─── Fix 5: Load server drafts on mount (with hydration guard) ───
    useEffect(() => {
        if (!token) return;
        const loadServerDrafts = async () => {
            isHydratingDraftsRef.current = true; // Fix 2: suppress autosave
            try {
                const { data } = await axios.get('/api/workbench/drafts', axiosConfig);
                if (data.drafts && Object.keys(data.drafts).length > 0) {
                    let count = 0;
                    const serverDrafts = {};
                    Object.values(data.drafts).forEach(items => {
                        items.forEach(d => {
                            serverDrafts[d.workItemId] = { value: d.value, equipmentId: d.equipmentId };
                            count++;
                        });
                    });
                    // Server wins over stale localStorage
                    setDraftValues(prev => ({ ...prev, ...serverDrafts }));
                    if (count > 0) {
                        setToast({ message: `Restored ${count} server draft${count > 1 ? 's' : ''}`, type: 'info' });
                    }
                }
            } catch (err) {
                console.error('Failed to load server drafts:', err);
            } finally {
                // Fix 2: re-enable autosave after a tick (so React state has settled)
                setTimeout(() => { isHydratingDraftsRef.current = false; }, 100);
            }
        };
        loadServerDrafts();
    }, [token]);

    // ─── Load drafts from localStorage on tab change (with hydration guard) ───
    useEffect(() => {
        if (!activeTab || !user) return;
        isHydratingDraftsRef.current = true; // Fix 2: suppress autosave during merge
        const key = DRAFT_KEY(user.username, activeTab);
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setDraftValues(prev => ({ ...prev, ...parsed }));
            } catch (e) { /* ignore corrupted */ }
        }
        setTimeout(() => { isHydratingDraftsRef.current = false; }, 100);
    }, [activeTab, user]);

    // ─── Fix 6: Clear selection on tab change (keep itemFeedback for tab colors) ───
    useEffect(() => {
        setSelectedItems(new Set());
    }, [activeTab]);

    // ─── Active Group ───
    const activeGroup = useMemo(() => {
        return processedGroups.find(g => g.analysis === activeTab) || null;
    }, [processedGroups, activeTab]);

    // ─── Filtered items ───
    const filteredItems = useMemo(() => {
        if (!activeGroup) return [];
        let items = activeGroup.items;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            items = items.filter(i =>
                (i.labId || '').toLowerCase().includes(term) ||
                (i.originalId || '').toLowerCase().includes(term) ||
                (i.projectCode || '').toLowerCase().includes(term) ||
                (i.sampleId || '').toLowerCase().includes(term)
            );
        }
        return items;
    }, [activeGroup, searchTerm]);

    // ─── Completion Stats ───
    const completionStats = useMemo(() => {
        if (!filteredItems.length) return { filled: 0, total: 0 };
        let filled = 0;
        const isTexture = activeGroup?.isTexture;
        filteredItems.forEach(item => {
            if (isTexture) {
                // Count as filled only if all 3 components have values
                const allFilled = TEXTURE_ANALYSES.every(code => {
                    const comp = item.components?.[code];
                    if (!comp) return false;
                    const d = draftValues[comp.workItemId];
                    return (d?.value) || comp.currentResult;
                });
                if (allFilled) filled++;
            } else {
                const draft = draftValues[item.workItemId];
                if ((draft && draft.value) || item.currentResult) filled++;
            }
        });
        return { filled, total: filteredItems.length };
    }, [filteredItems, draftValues, activeGroup]);

    // ─── Update Draft Value ───
    const updateDraft = (workItemId, field, value) => {
        setDraftValues(prev => ({
            ...prev,
            [workItemId]: { ...prev[workItemId], [field]: value }
        }));
        // Phase 3: Mark this workItem as dirty for delta autosave
        dirtySetRef.current.add(workItemId);
    };

    // ─── Toggle Selection ───
    const toggleSelect = (workItemId) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(workItemId)) next.delete(workItemId);
            else next.add(workItemId);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === filteredItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredItems.map(i => i.workItemId)));
        }
    };

    // ─── Build entries with version + overrideReason ───
    const buildEntries = (items, isDraft) => {
        const isTexture = activeGroup?.isTexture;
        if (isTexture) {
            // For texture group, expand each sample's components into individual entries
            const entries = [];
            items.forEach(item => {
                TEXTURE_ANALYSES.forEach(code => {
                    const comp = item.components?.[code];
                    if (!comp) return;
                    const d = draftValues[comp.workItemId];
                    const val = d?.value || comp.currentResult;
                    if (isDraft ? (d?.value) : val) {
                        entries.push({
                            workItemId: comp.workItemId,
                            value: val,
                            equipmentId: d?.equipmentId || comp.equipmentId || undefined,
                            version: versionMapRef.current[comp.workItemId] ?? comp.version,
                            overrideReason: d?.overrideReason || undefined
                        });
                    }
                });
            });
            return entries;
        }
        return items
            .filter(i => {
                const draft = draftValues[i.workItemId];
                return isDraft ? (draft && draft.value) : ((draft && draft.value) || i.currentResult);
            })
            .map(i => ({
                workItemId: i.workItemId,
                value: draftValues[i.workItemId]?.value || i.currentResult,
                equipmentId: draftValues[i.workItemId]?.equipmentId || i.equipmentId || undefined,
                version: versionMapRef.current[i.workItemId] ?? i.version,
                overrideReason: draftValues[i.workItemId]?.overrideReason || undefined
            }));
    };

    // ─── Ref to track latest draftValues for auto-save ───
    const draftValuesRef = useRef(draftValues);
    useEffect(() => { draftValuesRef.current = draftValues; }, [draftValues]);

    // Fix 1: Keep groupsRef in sync with processedGroups for tab-independent autosave
    useEffect(() => { groupsRef.current = processedGroups; }, [processedGroups]);

    // ─── Fix 1+C: Build global work-item lookup from ALL groups (tab-independent) ───
    const buildDirtyEntries = useCallback(() => {
        const dirtyIds = dirtySetRef.current;
        if (dirtyIds.size === 0) return [];
        const currentDrafts = draftValuesRef.current;
        const allGroups = groupsRef.current;
        const entries = [];

        // Build a flat lookup: workItemId → { version, equipmentId }
        const itemLookup = {};
        allGroups.forEach(g => {
            if (g.isTexture) {
                g.items.forEach(item => {
                    Object.entries(item.components || {}).forEach(([code, comp]) => {
                        itemLookup[comp.workItemId] = { version: comp.version, equipmentId: comp.equipmentId };
                    });
                });
            } else {
                g.items.forEach(item => {
                    itemLookup[item.workItemId] = { version: item.version, equipmentId: item.equipmentId };
                });
            }
        });

        dirtyIds.forEach(workItemId => {
            const d = currentDrafts[workItemId];
            const meta = itemLookup[workItemId];
            if (!d?.value || !meta) return;
            entries.push({
                workItemId,
                value: d.value,
                equipmentId: d.equipmentId || meta.equipmentId || undefined,
                version: versionMapRef.current[workItemId] ?? meta.version
            });
        });

        return entries;
    }, []);

    // ─── Auto-save server helper (debounced, delta-only, tab-independent) ───
    const autoSaveToServer = useCallback(async () => {
        if (!token) return;
        if (isHydratingDraftsRef.current) return; // Fix 2: suppress during hydration

        const entries = buildDirtyEntries();

        if (entries.length === 0) {
            dirtySetRef.current = new Set();
            return;
        }

        // Snapshot dirty IDs before clearing (so new edits during save are tracked)
        const savedDirtyIds = new Set(dirtySetRef.current);
        dirtySetRef.current = new Set();

        setSaveIndicator('saving');
        serverSavePending.current = true;
        try {
            const { data } = await axios.post('/api/workbench/batch-save',
                { entries, draft: true },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Process response — update versionMap + handle per-row errors
            let hasConflict = false;
            (data.results || []).forEach(r => {
                if (r.newVersion !== undefined) {
                    versionMapRef.current[r.workItemId] = r.newVersion;
                }
                // Fix 5: Per-cell "saved" feedback
                setItemFeedback(prev => ({
                    ...prev,
                    [r.workItemId]: { status: 'saved', at: Date.now() }
                }));
            });
            (data.errors || []).forEach(e => {
                if (e.code === 'VERSION_CONFLICT') {
                    hasConflict = true;
                    dirtySetRef.current.add(e.workItemId);
                }
                setItemFeedback(prev => ({
                    ...prev,
                    [e.workItemId]: { status: 'error', error: e.error, code: e.code }
                }));
            });

            // Fix 5: Auto-clear "saved" indicators after 2.5s
            if (data.results?.length > 0) {
                const savedIds = data.results.map(r => r.workItemId);
                setTimeout(() => {
                    setItemFeedback(prev => {
                        const next = { ...prev };
                        savedIds.forEach(id => {
                            if (next[id]?.status === 'saved') delete next[id];
                        });
                        return next;
                    });
                }, 2500);
            }

            if (hasConflict) {
                fetchQueue(true);
                setSaveIndicator('error');
            } else if (data.errors?.length > 0) {
                setSaveIndicator('error');
            } else {
                setSaveIndicator('saved');
                setLastSaved(new Date());
                setTimeout(() => setSaveIndicator(prev => prev === 'saved' ? '' : prev), 3000);
            }
        } catch (err) {
            console.error('Auto-save failed:', err);
            savedDirtyIds.forEach(id => dirtySetRef.current.add(id));
            setSaveIndicator('error');
        } finally {
            serverSavePending.current = false;
        }
    }, [token, fetchQueue, buildDirtyEntries]);

    // ─── AutoSave drafts to localStorage + server (debounced) ───
    useEffect(() => {
        if (!activeTab || !user) return;
        if (isHydratingDraftsRef.current) return; // Fix 2: skip during hydration
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);

        autosaveTimer.current = setTimeout(() => {
            // Save to localStorage immediately
            const key = DRAFT_KEY(user.username, activeTab);
            const activeGrp = groups.find(g => g.analysis === activeTab);
            if (!activeGrp) return;

            const groupDrafts = {};
            activeGrp.items.forEach(item => {
                if (draftValues[item.workItemId]) {
                    groupDrafts[item.workItemId] = draftValues[item.workItemId];
                }
            });

            if (Object.keys(groupDrafts).length > 0) {
                localStorage.setItem(key, JSON.stringify(groupDrafts));
            }
        }, 300); // localStorage: fast

        // Server save: slightly longer debounce (fix 1: tab-independent via buildDirtyEntries)
        serverSaveTimer.current = setTimeout(() => {
            if (dirtySetRef.current.size > 0) {
                autoSaveToServer();
            }
        }, AUTOSAVE_INTERVAL);

        return () => {
            if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
            if (serverSaveTimer.current) clearTimeout(serverSaveTimer.current);
        };
    }, [draftValues, activeTab, user, groups, autoSaveToServer]);

    // ─── Fix 3: Unload / page-hide flush (keepalive fetch) ───
    useEffect(() => {
        const flushDirty = () => {
            if (dirtySetRef.current.size === 0) return;
            const currentToken = localStorage.getItem('token');
            if (!currentToken) return;

            const entries = buildDirtyEntries();
            if (entries.length === 0) return;

            // Cap at 100 entries for keepalive payload limit (~64KB)
            const capped = entries.slice(0, 100);
            try {
                fetch('/api/workbench/batch-save', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentToken}`
                    },
                    body: JSON.stringify({ entries: capped, draft: true }),
                    keepalive: true
                });
                dirtySetRef.current = new Set();
            } catch (e) {
                console.error('[FLUSH] Failed to flush dirty drafts:', e);
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') flushDirty();
        };
        const handleBeforeUnload = () => flushDirty();

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [buildDirtyEntries]);

    // ─── Fix 4: WebSocket WORKITEM_CHANGED subscription with throttle ───
    useEffect(() => {
        if (!subscribeToEvent) return;
        const handleWsEvent = (data) => {
            // Ignore self-originated draft saves to reduce churn
            if (data.updatedBy === user?.username && data.action === 'DRAFT_SAVE') return;
            // Throttle: min 2s between refreshes
            const now = Date.now();
            if (now - wsRefreshThrottleRef.current < 2000) return;
            wsRefreshThrottleRef.current = now;
            fetchQueue(true);
        };
        const unsubscribe = subscribeToEvent('WORKITEM_CHANGED', handleWsEvent);
        return () => unsubscribe();
    }, [subscribeToEvent, user, fetchQueue]);

    // ─── Process batch response — Fix 1: rich feedback ───
    const processBatchResponse = (data, isDraft) => {
        const feedback = {};
        let successCount = 0;
        let errorCount = 0;

        (data.results || []).forEach(r => {
            feedback[r.workItemId] = { status: r.status, newVersion: r.newVersion };
            successCount++;
        });
        (data.errors || []).forEach(e => {
            feedback[e.workItemId] = { status: 'error', error: e.error, code: e.code, flags: e.flags };
            errorCount++;
        });
        setItemFeedback(feedback);

        // Toast summary
        const parts = [];
        if (successCount > 0) parts.push(`✓ ${successCount} ${isDraft ? 'drafted' : 'completed'}`);
        if (errorCount > 0) parts.push(`✗ ${errorCount} error${errorCount > 1 ? 's' : ''}`);
        if (parts.length > 0) {
            setToast({
                message: parts.join(', '),
                type: errorCount > 0 ? (successCount > 0 ? 'warning' : 'error') : 'success'
            });
        }

        return { successCount, errorCount };
    };

    // ─── Save Drafts (Server) ───
    const handleSaveDrafts = async () => {
        if (!activeGroup) return;
        setSaving(true);
        setSaveIndicator('saving');

        const entries = buildEntries(activeGroup.items, true);

        if (entries.length === 0) {
            setSaving(false);
            setSaveIndicator('');
            return;
        }

        try {
            const { data } = await axios.post('/api/workbench/batch-save',
                { entries, draft: true },
                axiosConfig
            );
            processBatchResponse(data, true);
            setSaveIndicator('saved');
            setLastSaved(new Date());
            setTimeout(() => setSaveIndicator(''), 3000);
        } catch (err) {
            console.error('Draft save failed:', err);
            setSaveIndicator('error');
            setToast({ message: 'Draft save failed — network error', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // ─── Complete Items (Batch) ───
    const handleBatchComplete = async (onlySelected = false) => {
        if (!activeGroup) return;

        const itemsToComplete = onlySelected
            ? filteredItems.filter(i => selectedItems.has(i.workItemId))
            : filteredItems;

        // Texture closure pre-check: All 3 components must sum to 100% ± tolerance
        if (activeGroup.isTexture) {
            for (const item of itemsToComplete) {
                const texSum = getTextureSum(item);
                if (texSum.count === 3 && !texSum.valid) {
                    setToast({
                        message: `Closure failed: Sample ${item.labId || item.sampleId} Sand + Silt + Clay (${texSum.sum.toFixed(1)}%) must equal 100% ± ${TEXTURE_TOLERANCE}%`,
                        type: 'error'
                    });
                    return;
                }
            }
        }

        setSaving(true);
        const entries = buildEntries(itemsToComplete, false);

        if (entries.length === 0) {
            setSaving(false);
            setToast({ message: 'No items with results to complete', type: 'warning' });
            return;
        }

        try {
            const { data } = await axios.post('/api/workbench/batch-save',
                { entries, draft: false },
                axiosConfig
            );

            const { successCount } = processBatchResponse(data, false);

            // Clear localStorage drafts for completed items & update feedback to persist
            if (successCount > 0) {
                const key = DRAFT_KEY(user.username, activeTab);
                const stored = localStorage.getItem(key);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    (data.results || []).filter(r => r.status === 'completed').forEach(r => {
                        delete parsed[r.workItemId];
                    });
                    localStorage.setItem(key, JSON.stringify(parsed));
                }

                // Clear draft values for completed items so they appear as results
                setDraftValues(prev => {
                    const next = { ...prev };
                    (data.results || []).filter(r => r.status === 'completed').forEach(r => {
                        delete next[r.workItemId];
                    });
                    return next;
                });

                // Phase 5: Show completion handoff banner with links to submit
                const completedSampleIds = [...new Set(
                    (data.results || []).filter(r => r.status === 'completed').map(r => {
                        const item = itemsToComplete.find(i => i.workItemId === r.workItemId);
                        return item ? { id: item.sampleId, labId: item.labId || item.sampleId } : null;
                    }).filter(Boolean).map(s => JSON.stringify(s))
                )].map(s => JSON.parse(s));

                if (completedSampleIds.length > 0) {
                    setCompletedBanner({
                        samples: completedSampleIds,
                        count: successCount,
                        analysis: activeGroup.analysisName || activeTab
                    });
                }

                // Refresh queue to get updated statuses
                setTimeout(() => fetchQueue(true), 500);
            }
        } catch (err) {
            console.error('Batch complete failed:', err);
            setToast({ message: 'Batch complete failed — network error', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // ─── Discard Drafts — Fix 5: also clear server drafts ───
    const handleDiscardDrafts = async () => {
        if (!activeTab || !user) return;
        const key = DRAFT_KEY(user.username, activeTab);
        localStorage.removeItem(key);

        // Clear draft values for active group items
        setDraftValues(prev => {
            const next = { ...prev };
            activeGroup?.items.forEach(i => delete next[i.workItemId]);
            return next;
        });

        setItemFeedback({});

        // Fix 5: Clear server-side drafts
        try {
            await axios.delete(`/api/workbench/drafts/${activeTab}`, axiosConfig);
            setToast({ message: 'Drafts cleared (local + server)', type: 'info' });
        } catch (err) {
            console.error('Failed to clear server drafts:', err);
        }

        setTimeout(() => fetchQueue(true), 300);
    };

    // ─── Get input border color based on validation ───
    const getInputBorderClass = (item) => {
        const draft = draftValues[item.workItemId];
        const value = draft?.value || item.currentResult;
        if (!value || !activeGroup?.validation) return 'border-gray-300 dark:border-gray-600';

        const num = Number(value);
        if (isNaN(num)) return 'border-red-400 dark:border-red-500 ring-1 ring-red-200';

        const { min, max } = activeGroup.validation;
        if ((min !== undefined && num < min) || (max !== undefined && num > max)) {
            return 'border-amber-400 dark:border-amber-500 ring-1 ring-amber-200';
        }
        return 'border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-200';
    };

    // ─── Check if value is out of range ───
    const isOutOfRange = (item) => {
        const draft = draftValues[item.workItemId];
        const value = draft?.value || item.currentResult;
        if (!value || !activeGroup?.validation) return false;
        const num = Number(value);
        if (isNaN(num)) return false;
        const { min, max } = activeGroup.validation;
        return (min !== undefined && num < min) || (max !== undefined && num > max);
    };

    // ─── Handle Tab Key navigation ───
    const handleKeyDown = (e, index) => {
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            const nextIndex = index + 1;
            if (nextIndex < filteredItems.length) {
                const nextId = filteredItems[nextIndex].workItemId;
                inputRefs.current[nextId]?.focus();
            }
        } else if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            const prevIndex = index - 1;
            if (prevIndex >= 0) {
                const prevId = filteredItems[prevIndex].workItemId;
                inputRefs.current[prevId]?.focus();
            }
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const nextIndex = index + 1;
            if (nextIndex < filteredItems.length) {
                const nextId = filteredItems[nextIndex].workItemId;
                inputRefs.current[nextId]?.focus();
            }
        }
    };

    // ─────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3 text-gray-400">
                    <RefreshCw size={24} className="animate-spin" />
                    <span className="text-lg">Loading workbench...</span>
                </div>
            </div>
        );
    }

    if (processedGroups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Beaker size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">No pending work items</p>
                <p className="text-sm mt-1">All your assigned analyses are completed or not yet assigned.</p>
            </div>
        );
    }

    // ─── Texture sum helper ───
    const getTextureSum = (item) => {
        let sum = 0;
        let count = 0;
        TEXTURE_ANALYSES.forEach(code => {
            const comp = item.components?.[code];
            if (!comp) return;
            const d = draftValues[comp.workItemId];
            const val = d?.value ?? comp.currentResult;
            if (val !== null && val !== undefined && val !== '') {
                const num = Number(val);
                if (!isNaN(num)) { sum += num; count++; }
            }
        });
        return { sum, count, valid: count === 3 && Math.abs(sum - 100) <= TEXTURE_TOLERANCE };
    };

    return (
        <div className="space-y-4">
            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Phase 5: Completion Handoff Banner */}
            {completedBanner && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                            ✓ {completedBanner.count} {completedBanner.analysis} result{completedBanner.count > 1 ? 's' : ''} completed
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            Go to Sample Detail to review and submit:
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {completedBanner.samples.slice(0, 10).map(s => (
                                <Link
                                    key={s.id}
                                    to={`/samples/${s.id}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-200 dark:hover:bg-emerald-700/40 transition-colors"
                                >
                                    {s.labId} <ArrowRight size={12} />
                                </Link>
                            ))}
                            {completedBanner.samples.length > 10 && (
                                <span className="text-xs text-emerald-500">+{completedBanner.samples.length - 10} more</span>
                            )}
                        </div>
                    </div>
                    <button onClick={() => setCompletedBanner(null)} className="text-emerald-400 hover:text-emerald-600 transition-colors">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Beaker className="text-emerald-500" size={28} />
                            Workbench
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Batch result entry for your assigned analyses
                        </p>
                    </div>

                    {/* Fix 6: Live/Stale indicator */}
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${isLive
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        {isLive ? 'Live' : 'Stale'}
                    </div>
                </div>

                {/* KPI Chips */}
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                        <Clock size={14} className="text-amber-500" />
                        <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{stats.totalPending || 0}</span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">Pending</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <Activity size={14} className="text-blue-500" />
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">{stats.totalInProgress || 0}</span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">In Progress</span>
                    </div>
                    {stats.totalReanalysis > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                            <AlertTriangle size={14} className="text-red-500" />
                            <span className="text-sm font-semibold text-red-700 dark:text-red-300">{stats.totalReanalysis}</span>
                            <span className="text-xs text-red-600 dark:text-red-400">Reanalysis</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Analysis Group Tabs ── */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 scrollbar-thin">
                    {processedGroups.map(group => {
                        const tabColor = getTabColor(group);
                        const isActive = activeTab === group.analysis;
                        return (
                            <button
                                key={group.analysis}
                                onClick={() => { setActiveTab(group.analysis); setSearchTerm(''); }}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all ${isActive
                                    ? `${tabColor.border} text-gray-800 dark:text-gray-100 bg-gray-50/80 dark:bg-gray-700/30`
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                                    }`}
                            >
                                <div className={`w-2 h-2 rounded-full ${tabColor.dot}`} title={`Status`} />
                                <span>{group.analysisName}</span>
                                {group.equipmentRequired && <Wrench size={12} className="text-gray-400" title="Equipment required" />}
                                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold ${isActive
                                    ? tabColor.badge
                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                    }`}>
                                    {group.items.length}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {activeGroup && (
                    <div className="p-4">
                        {/* ── Toolbar ── */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2 flex-1">
                                {/* Search */}
                                <div className="relative flex-1 max-w-xs">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search samples..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700 outline-none transition-all"
                                    />
                                </div>

                                {/* Validation info */}
                                {activeGroup.validation && (
                                    <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                                        <span>Range:</span>
                                        <span className="font-mono">
                                            {activeGroup.validation.min ?? '−∞'} – {activeGroup.validation.max ?? '∞'}
                                        </span>
                                        {activeGroup.unit && <span>({activeGroup.unit})</span>}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Auto-save indicator */}
                                {saveIndicator === 'saving' && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 animate-pulse bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full">
                                        <RefreshCw size={12} className="animate-spin" /> Saving draft…
                                    </span>
                                )}
                                {saveIndicator === 'saved' && (
                                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full font-medium">
                                        <Check size={12} /> Draft Saved ✓
                                    </span>
                                )}
                                {saveIndicator === 'error' && (
                                    <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                                        <XCircle size={12} /> Save error
                                    </span>
                                )}
                                {!saveIndicator && lastSaved && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        Saved {Math.round((Date.now() - lastSaved.getTime()) / 1000)}s ago
                                    </span>
                                )}

                                <div className="flex items-center gap-1 text-xs font-medium">
                                    <span className="text-emerald-600 dark:text-emerald-400">{completionStats.filled}</span>
                                    <span className="text-gray-400">/</span>
                                    <span className="text-gray-500">{completionStats.total}</span>
                                    <span className="text-gray-400">filled</span>
                                </div>

                                <button
                                    onClick={handleDiscardDrafts}
                                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                    title="Discard drafts (local + server)"
                                >
                                    <Trash2 size={16} />
                                </button>

                                <button
                                    onClick={() => fetchQueue()}
                                    className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                                    title="Refresh"
                                >
                                    <RefreshCw size={16} />
                                </button>
                            </div>
                        </div>

                        {/* ── Desktop: Spreadsheet Grid ── */}
                        {!isMobile && <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                                        <th className="pb-2 pr-2 w-8">
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                                                onChange={toggleSelectAll}
                                                className="rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500"
                                            />
                                        </th>
                                        <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">#</th>
                                        <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Lab ID</th>
                                        <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Sample ID</th>
                                        <th className="pb-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Gates</th>
                                        <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400 text-center">Priority</th>
                                        {activeGroup.isTexture ? (
                                            <>
                                                <th className="pb-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Sand %</th>
                                                <th className="pb-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Clay %</th>
                                                <th className="pb-2 pr-2 font-medium text-gray-500 dark:text-gray-400">Silt %</th>
                                                <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Σ</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                                                    Result {activeGroup.unit && <span className="font-normal text-gray-400">({activeGroup.unit})</span>}
                                                </th>
                                                {activeGroup.equipmentRequired && (
                                                    <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">
                                                        <span className="flex items-center gap-1"><Wrench size={12} /> Equipment</span>
                                                    </th>
                                                )}
                                                <th className="pb-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Valid</th>
                                            </>
                                        )}
                                        <th className="pb-2 font-medium text-gray-500 dark:text-gray-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredItems.map((item, idx) => {
                                        // ── TEXTURE ROW ──
                                        if (activeGroup.isTexture) {
                                            const blocked = isRowBlocked(item);
                                            const texSum = getTextureSum(item);
                                            const anyCompleted = TEXTURE_ANALYSES.some(code => {
                                                const comp = item.components?.[code];
                                                return comp && (itemFeedback[comp.workItemId]?.status === 'completed');
                                            });
                                            const anyError = TEXTURE_ANALYSES.some(code => {
                                                const comp = item.components?.[code];
                                                return comp && (itemFeedback[comp.workItemId]?.status === 'error');
                                            });

                                            return (
                                                <React.Fragment key={item.sampleId}>
                                                    <tr className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors
                                                        ${anyCompleted ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''}
                                                        ${anyError ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                                                        ${blocked ? 'opacity-60' : ''}`}
                                                    >
                                                        <td className="py-2.5 pr-2">
                                                            <input type="checkbox" checked={false} disabled className="rounded border-gray-300 dark:border-gray-600 opacity-30" />
                                                        </td>
                                                        <td className="py-2.5 pr-4 text-gray-400 font-mono text-xs">{idx + 1}</td>
                                                        <td className="py-2.5 pr-4 font-mono text-xs font-medium text-gray-800 dark:text-gray-200">
                                                            {item.labId || '—'}
                                                        </td>
                                                        <td className="py-2.5 pr-4 text-xs text-gray-500 dark:text-gray-400 max-w-[120px] truncate" title={item.originalId || item.sampleId}>
                                                            {item.originalId || item.sampleId?.substring(0, 12) || '—'}
                                                        </td>
                                                        <td className="py-2.5 pr-2">
                                                            <GateBadges item={item} />
                                                        </td>
                                                        <td className="py-2.5 pr-4 text-center">
                                                            <PriorityBadge priority={item.priority} />
                                                        </td>
                                                        {TEXTURE_ANALYSES.map(code => {
                                                            const comp = item.components?.[code];
                                                            if (!comp) return <td key={code} className="py-2.5 pr-2 text-xs text-gray-400">—</td>;
                                                            const d = draftValues[comp.workItemId];
                                                            const val = d?.value ?? comp.currentResult ?? '';
                                                            const compCompleted = itemFeedback[comp.workItemId]?.status === 'completed';
                                                            return (
                                                                <td key={code} className="py-2.5 pr-2">
                                                                    <input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        value={val}
                                                                        onChange={e => updateDraft(comp.workItemId, 'value', e.target.value)}
                                                                        placeholder={blocked || '0.0'}
                                                                        className={`w-full max-w-[80px] px-2 py-1.5 rounded-lg border text-sm font-mono bg-white dark:bg-gray-800 focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700 outline-none transition-all border-gray-300 dark:border-gray-600 ${blocked ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-700' : ''}`}
                                                                        disabled={compCompleted || !!blocked}
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="py-2.5 pr-4">
                                                            {texSum.count > 0 && (
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${texSum.valid
                                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                    : texSum.count === 3
                                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                                                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                                                    }`}>
                                                                    {texSum.valid ? '✓' : texSum.count === 3 ? '⚠' : ''} {texSum.sum.toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5">
                                                            <StatusBadge status={anyCompleted ? 'completed' : item.status} />
                                                        </td>
                                                    </tr>
                                                    {/* Error messages for texture components */}
                                                    {TEXTURE_ANALYSES.map(code => {
                                                        const comp = item.components?.[code];
                                                        if (!comp) return null;
                                                        const fb = itemFeedback[comp.workItemId];
                                                        if (!fb?.error) return null;
                                                        return (
                                                            <tr key={`err-${code}`} className="bg-red-50/30 dark:bg-red-900/5">
                                                                <td colSpan={11} className="py-1 px-4">
                                                                    <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                                                        <XCircle size={12} /> <span className="font-medium">{code}:</span> {fb.error}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {/* Sum-to-100 warning */}
                                                    {texSum.count === 3 && !texSum.valid && (
                                                        <tr className="bg-amber-50/30 dark:bg-amber-900/5">
                                                            <td colSpan={11} className="py-1 px-4">
                                                                <div className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                                                    <AlertTriangle size={12} />
                                                                    Sand + Clay + Silt = {texSum.sum.toFixed(1)}% — must equal 100% (±{TEXTURE_TOLERANCE}%) to complete
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        }

                                        // ── NORMAL ROW ──
                                        const draft = draftValues[item.workItemId];
                                        const displayValue = draft?.value ?? item.currentResult ?? '';
                                        const feedback = itemFeedback[item.workItemId];
                                        const blocked = isRowBlocked(item);
                                        const outOfRange = isOutOfRange(item);
                                        const isCompleted = feedback?.status === 'completed';
                                        const isConflict = feedback?.code === 'VERSION_CONFLICT';

                                        return (
                                            <React.Fragment key={item.workItemId}>
                                                <tr
                                                    className={`border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isCompleted ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''
                                                        } ${feedback?.status === 'error' ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                                                        } ${isConflict ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
                                                        } ${blocked ? 'opacity-60' : ''}`}
                                                >
                                                    <td className="py-2.5 pr-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedItems.has(item.workItemId)}
                                                            onChange={() => toggleSelect(item.workItemId)}
                                                            className="rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="py-2.5 pr-4 text-gray-400 font-mono text-xs">{idx + 1}</td>
                                                    <td className="py-2.5 pr-4 font-mono text-xs font-medium text-gray-800 dark:text-gray-200">
                                                        {item.labId || '—'}
                                                    </td>
                                                    <td className="py-2.5 pr-4 text-xs text-gray-500 dark:text-gray-400 max-w-[120px] truncate" title={item.originalId || item.sampleId}>
                                                        {item.originalId || item.sampleId?.substring(0, 12) || '—'}
                                                    </td>
                                                    <td className="py-2.5 pr-2">
                                                        <GateBadges item={item} />
                                                    </td>
                                                    <td className="py-2.5 pr-4 text-center">
                                                        <PriorityBadge priority={item.priority} />
                                                    </td>
                                                    <td className="py-2.5 pr-4">
                                                        <input
                                                            ref={el => inputRefs.current[item.workItemId] = el}
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={displayValue}
                                                            onChange={e => updateDraft(item.workItemId, 'value', e.target.value)}
                                                            onKeyDown={e => handleKeyDown(e, idx)}
                                                            placeholder={blocked ? blocked : (activeGroup.validation ? `${activeGroup.validation.min ?? ''} – ${activeGroup.validation.max ?? ''}` : 'Enter value')}
                                                            className={`w-full max-w-[140px] px-3 py-1.5 rounded-lg border text-sm font-mono bg-white dark:bg-gray-800 focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700 outline-none transition-all ${getInputBorderClass(item)} ${blocked ? 'cursor-not-allowed bg-gray-100 dark:bg-gray-700' : ''}`}
                                                            disabled={isCompleted || !!blocked}
                                                            title={blocked || ''}
                                                        />
                                                    </td>
                                                    {activeGroup.equipmentRequired && (
                                                        <td className="py-2.5 pr-4">
                                                            <EquipmentSelect
                                                                value={draft?.equipmentId || item.equipmentId}
                                                                onChange={val => updateDraft(item.workItemId, 'equipmentId', val)}
                                                                eligibleEquipment={activeGroup.eligibleEquipment}
                                                                required={item.equipmentRequired}
                                                                disabled={isCompleted || !!blocked}
                                                            />
                                                        </td>
                                                    )}
                                                    <td className="py-2.5 pr-4">
                                                        <div className="flex items-center gap-1">
                                                            <ValidationIndicator value={displayValue} validation={activeGroup.validation} />
                                                            {feedback?.status === 'saved' && (
                                                                <span className="text-[10px] text-emerald-500 font-medium animate-pulse">✓ Saved</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5">
                                                        <StatusBadge status={feedback?.status === 'saved' ? item.status : (feedback?.status || item.status)} />
                                                    </td>
                                                </tr>
                                                {/* Error message row */}
                                                {feedback?.error && (
                                                    <tr className="bg-red-50/30 dark:bg-red-900/5">
                                                        <td colSpan={activeGroup.equipmentRequired ? 10 : 9} className="py-1 px-4">
                                                            <ErrorMessage feedback={feedback} />
                                                        </td>
                                                    </tr>
                                                )}
                                                {/* Override reason row */}
                                                {outOfRange && !isCompleted && !blocked && (
                                                    <tr className="bg-amber-50/30 dark:bg-amber-900/5">
                                                        <td colSpan={activeGroup.equipmentRequired ? 10 : 9} className="py-1.5 px-4">
                                                            <div className="flex items-center gap-2 text-xs">
                                                                <ShieldAlert size={14} className="text-amber-500 flex-shrink-0" />
                                                                <span className="text-amber-700 dark:text-amber-400">Out of range — override reason required:</span>
                                                                <input
                                                                    type="text"
                                                                    value={draft?.overrideReason || ''}
                                                                    onChange={e => updateDraft(item.workItemId, 'overrideReason', e.target.value)}
                                                                    placeholder="e.g., Confirmed by replicate analysis"
                                                                    className="flex-1 max-w-xs px-2 py-1 rounded border border-amber-300 dark:border-amber-600 bg-white dark:bg-gray-800 text-xs focus:ring-1 focus:ring-amber-400 outline-none"
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>}

                        {/* ── Mobile: Card Layout ── */}
                        {isMobile && <div className="space-y-3">
                            {filteredItems.map((item, idx) => {
                                const draft = draftValues[item.workItemId];
                                const displayValue = draft?.value ?? item.currentResult ?? '';
                                const feedback = itemFeedback[item.workItemId];
                                const blocked = isRowBlocked(item);
                                const outOfRange = isOutOfRange(item);
                                const isCompleted = feedback?.status === 'completed';

                                return (
                                    <div
                                        key={item.workItemId}
                                        className={`rounded-xl border p-4 transition-all ${isCompleted
                                            ? 'border-emerald-200 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-900/10'
                                            : feedback?.status === 'error'
                                                ? 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10'
                                                : blocked
                                                    ? 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/50 opacity-60'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <div className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
                                                    {item.labId || item.sampleId?.substring(0, 15)}
                                                </div>
                                                {item.originalId && (
                                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{item.originalId}</div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <PriorityBadge priority={item.priority} />
                                                <StatusBadge status={feedback?.status || item.status} />
                                            </div>
                                        </div>

                                        {/* Gate badges */}
                                        <div className="mb-2">
                                            <GateBadges item={item} />
                                        </div>

                                        {blocked && (
                                            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-1.5 mb-2 flex items-center gap-1">
                                                <AlertTriangle size={12} />
                                                {blocked}
                                            </div>
                                        )}

                                        {/* Error message */}
                                        {feedback?.error && <ErrorMessage feedback={feedback} />}

                                        <div className="flex items-center gap-2 mt-2">
                                            <input
                                                ref={el => inputRefs.current[item.workItemId] = el}
                                                type="text"
                                                inputMode="decimal"
                                                value={displayValue}
                                                onChange={e => updateDraft(item.workItemId, 'value', e.target.value)}
                                                placeholder={blocked || 'Result'}
                                                className={`flex-1 px-4 py-3 rounded-xl border text-base font-mono bg-gray-50 dark:bg-gray-700 focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-700 outline-none transition-all ${getInputBorderClass(item)} ${blocked ? 'cursor-not-allowed' : ''}`}
                                                disabled={isCompleted || !!blocked}
                                            />
                                            {activeGroup.unit && (
                                                <span className="text-sm text-gray-400 dark:text-gray-500 min-w-[30px]">{activeGroup.unit}</span>
                                            )}
                                            <ValidationIndicator value={displayValue} validation={activeGroup.validation} />
                                        </div>

                                        {/* Equipment picker */}
                                        {activeGroup.equipmentRequired && (
                                            <div className="mt-2">
                                                <EquipmentSelect
                                                    value={draft?.equipmentId || item.equipmentId}
                                                    onChange={val => updateDraft(item.workItemId, 'equipmentId', val)}
                                                    eligibleEquipment={activeGroup.eligibleEquipment}
                                                    required={item.equipmentRequired}
                                                    disabled={isCompleted || !!blocked}
                                                />
                                            </div>
                                        )}

                                        {/* Override reason */}
                                        {outOfRange && !isCompleted && !blocked && (
                                            <div className="mt-2">
                                                <input
                                                    type="text"
                                                    value={draft?.overrideReason || ''}
                                                    onChange={e => updateDraft(item.workItemId, 'overrideReason', e.target.value)}
                                                    placeholder="Override reason (required for out-of-range)"
                                                    className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-600 bg-white dark:bg-gray-800 text-sm focus:ring-1 focus:ring-amber-400 outline-none"
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>}

                        {filteredItems.length === 0 && (
                            <div className="text-center py-12 text-gray-400">
                                <Search size={32} className="mx-auto mb-2 opacity-50" />
                                <p>No matching samples found</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Sticky Bottom Action Bar ── */}
            {activeGroup && filteredItems.length > 0 && (
                <div className="sticky bottom-0 z-30 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3 text-sm">
                            {/* Progress bar */}
                            <div className="flex items-center gap-2 min-w-[160px]">
                                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                                        style={{ width: `${completionStats.total > 0 ? (completionStats.filled / completionStats.total * 100) : 0}%` }}
                                    />
                                </div>
                                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {completionStats.filled}/{completionStats.total}
                                </span>
                            </div>

                            {saveIndicator === 'saving' && (
                                <span className="text-blue-600 text-xs flex items-center gap-1 animate-pulse bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 rounded-full">
                                    <RefreshCw size={14} className="animate-spin" /> Saving draft…
                                </span>
                            )}
                            {saveIndicator === 'saved' && (
                                <span className="text-emerald-600 text-xs flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 rounded-full font-medium">
                                    <Check size={14} /> Draft Saved ✓
                                </span>
                            )}
                            {saveIndicator === 'error' && (
                                <span className="text-red-500 text-xs flex items-center gap-1">
                                    <X size={14} /> Save failed
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {selectedItems.size > 0 && (
                                <button
                                    onClick={() => handleBatchComplete(true)}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-sm"
                                >
                                    <Check size={16} />
                                    Submit Selected ({selectedItems.size})
                                </button>
                            )}

                            <button
                                onClick={() => handleBatchComplete(false)}
                                disabled={saving || completionStats.filled === 0}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm font-medium shadow-md"
                            >
                                {saving ? (
                                    <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                    <Zap size={16} />
                                )}
                                Submit Results ({completionStats.filled})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TechWorkbench;
