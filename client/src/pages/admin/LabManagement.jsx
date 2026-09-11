import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Beaker, Plus, Search, ChevronRight, ArrowLeft, Users, FolderOpen,
    Settings, History, Shield, CheckCircle2, AlertTriangle, Clock,
    Power, KeyRound, Globe, MapPin, Mail, Phone, BarChart3, HelpCircle,
    FileText, ExternalLink, RefreshCw, X, PlayCircle, PauseCircle, Archive,
    Sliders, Monitor, Package, Award, AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useDialog } from '../../context/DialogContext';

import InviteStaffModal from '../../components/staff/InviteStaffModal';
import AccessReviewModal from '../../components/staff/AccessReviewModal';
import RecoveryLinkModal from '../../components/staff/RecoveryLinkModal';
import SuspendUserModal from '../../components/staff/SuspendUserModal';
import LabLifecycleModal from '../../components/lab/LabLifecycleModal';

// IANA Timezone helper
const getIanaTimezones = () => {
    try {
        if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
            return Intl.supportedValuesOf('timeZone');
        }
    } catch { }
    return [
        'America/Guatemala', 'America/Costa_Rica', 'America/Tegucigalpa', 'America/Panama',
        'America/Bogota', 'America/Lima', 'America/Mexico_City', 'America/New_York',
        'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/Paris',
        'Europe/London', 'Europe/Rome', 'Europe/Berlin', 'Africa/Nairobi',
        'Africa/Lusaka', 'Africa/Accra', 'Africa/Johannesburg', 'Asia/Tokyo', 'UTC'
    ];
};

export default function LabManagement() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { showDialog } = useDialog();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Routing State
    const queryLabId = searchParams.get('labId');
    const queryTab = searchParams.get('tab') || 'overview';

    // Global Labs List State (for multi-lab directory)
    const [labs, setLabs] = useState([]);
    const [loadingLabs, setLoadingLabs] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    // Selected Lab Workspace State
    const selectedLabId = queryLabId || (user?.role === 'LAB_MANAGER' ? user.labId : null);
    const activeTab = queryTab;
    const [workspace, setWorkspace] = useState(null);
    const [loadingWorkspace, setLoadingWorkspace] = useState(false);
    const [workspaceError, setWorkspaceError] = useState(null);

    // Modals
    const [showOnboardModal, setShowOnboardModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showAccessReviewModal, setShowAccessReviewModal] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [showSuspendModal, setShowSuspendModal] = useState(false);
    const [showLifecycleModal, setShowLifecycleModal] = useState(false);
    const [lifecycleTargetState, setLifecycleTargetState] = useState(null);
    const [targetUser, setTargetUser] = useState(null);
    const [showHelpModal, setShowHelpModal] = useState(false);

    // People tab search/filter in workspace
    const [staffSearch, setStaffSearch] = useState('');
    const [staffStatusFilter, setStaffStatusFilter] = useState('all');

    // Lab Settings form state
    const [settingsForm, setSettingsForm] = useState({
        name: '', city: '', address: '', phone: '', email: '', website: '', capacity: '', timezone: '', notes: ''
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsMsg, setSettingsMsg] = useState(null);

    // Onboard Lab form state (clean - no auto-generated passwords)
    const [onboardForm, setOnboardForm] = useState({
        id: '', code: '', name: '', country: '', city: '', timezone: 'America/Guatemala',
        address: '', phone: '', email: '', capacity: '', notes: ''
    });
    const [submittingOnboard, setSubmittingOnboard] = useState(false);

    // Load Labs Directory
    const fetchLabs = useCallback(async () => {
        setLoadingLabs(true);
        try {
            const res = await axios.get('/api/labs');
            setLabs(res.data);
        } catch (err) {
            console.error('Failed to load labs:', err);
        } finally {
            setLoadingLabs(false);
        }
    }, []);

    // Load Workspace for selected lab
    const fetchWorkspace = useCallback(async (id) => {
        if (!id) return;
        setLoadingWorkspace(true);
        setWorkspaceError(null);
        try {
            const res = await axios.get(`/api/labs/${encodeURIComponent(id)}/workspace`);
            setWorkspace(res.data);
            if (res.data?.lab) {
                setSettingsForm({
                    name: res.data.lab.name || '',
                    city: res.data.lab.city || '',
                    address: res.data.lab.address || '',
                    phone: res.data.lab.phone || '',
                    email: res.data.lab.email || '',
                    website: res.data.lab.website || '',
                    capacity: res.data.lab.capacity || '',
                    timezone: res.data.lab.timezone || 'America/Guatemala',
                    notes: res.data.lab.notes || ''
                });
            }
        } catch (err) {
            console.error('Failed to load workspace:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            setWorkspaceError(msg || 'Failed to load laboratory workspace');
        } finally {
            setLoadingWorkspace(false);
        }
    }, []);

    useEffect(() => {
        fetchLabs();
    }, [fetchLabs]);

    useEffect(() => {
        if (selectedLabId) {
            fetchWorkspace(selectedLabId);
        }
    }, [selectedLabId, fetchWorkspace]);

    // Handle tab change
    const setTab = (newTab) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', newTab);
        if (selectedLabId) params.set('labId', selectedLabId);
        setSearchParams(params);
    };

    // Handle selecting a lab from directory
    const selectLab = (labId) => {
        const params = new URLSearchParams(searchParams);
        params.set('labId', labId);
        params.set('tab', 'overview');
        setSearchParams(params);
    };

    // Return to all labs
    const backToDirectory = () => {
        const params = new URLSearchParams();
        setSearchParams(params);
        setWorkspace(null);
    };

    // Save Lab Settings Profile
    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSavingSettings(true);
        setSettingsMsg(null);
        try {
            await axios.patch(`/api/labs/${selectedLabId}/profile`, settingsForm);
            setSettingsMsg({ type: 'success', text: 'Laboratory profile updated successfully.' });
            fetchWorkspace(selectedLabId);
            fetchLabs();
        } catch (err) {
            console.error('Failed to save settings:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            setSettingsMsg({ type: 'error', text: msg || 'Failed to update laboratory profile.' });
        } finally {
            setSavingSettings(false);
        }
    };

    // Submit Onboard Lab
    const handleOnboardSubmit = async (e) => {
        e.preventDefault();
        setSubmittingOnboard(true);
        try {
            await axios.post('/api/labs', onboardForm);
            setShowOnboardModal(false);
            fetchLabs();
            selectLab(onboardForm.id);
        } catch (err) {
            console.error('Failed to onboard lab:', err);
            const msg = err.response?.data?.message || err.response?.data?.error || err.message;
            showDialog({ title: 'Onboarding Failed', message: msg || 'Failed to create laboratory', type: 'error' });
        } finally {
            setSubmittingOnboard(false);
        }
    };

    // Local time formatting helper
    const getLocalTime = (tz) => {
        try {
            return new Intl.DateTimeFormat('en-GB', {
                timeZone: tz || 'UTC',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
            }).format(new Date());
        } catch {
            return '';
        }
    };

    // Role display config
    const getRoleBadge = (roleKey) => {
        switch (roleKey) {
            case 'LAB_MANAGER': return { label: 'Lab Manager', color: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300' };
            case 'SAMPLE_RECEPTION': return { label: 'Intake Officer', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300' };
            case 'LAB_TECHNICIAN': return { label: 'Technician', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' };
            case 'AUDIT_USER': return { label: 'Quality & Audit', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' };
            case 'SUPER_ADMIN': return { label: 'Super Admin', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' };
            case 'MASTER_USER': return { label: 'National Lead', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300' };
            default: return { label: roleKey?.replace(/_/g, ' ') || 'Staff', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' };
        }
    };

    // Filter labs in directory
    const filteredLabs = useMemo(() => {
        return labs.filter(l => {
            const matchesSearch = !searchQuery.trim() ||
                l.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                l.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                l.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                l.id?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'all' ||
                (statusFilter === 'ACTIVE' && l.isActive !== false) ||
                (statusFilter === 'PAUSED' && l.isActive === false);
            return matchesSearch && matchesStatus;
        });
    }, [labs, searchQuery, statusFilter]);

    // Filter staff in People tab
    const filteredStaff = useMemo(() => {
        const staffList = workspace?.staff || [];
        return staffList.filter(s => {
            const matchesSearch = !staffSearch.trim() ||
                s.name?.toLowerCase().includes(staffSearch.toLowerCase()) ||
                s.username?.toLowerCase().includes(staffSearch.toLowerCase()) ||
                s.role?.toLowerCase().includes(staffSearch.toLowerCase());
            const matchesStatus = staffStatusFilter === 'all' ||
                (staffStatusFilter === 'Active' && s.isActive !== false) ||
                (staffStatusFilter === 'Suspended' && s.isActive === false);
            return matchesSearch && matchesStatus;
        });
    }, [workspace?.staff, staffSearch, staffStatusFilter]);

    // ══════════════════════════════════════════════════════════════
    // VIEW 1: LABORATORIES DIRECTORY (Table / Cards for Super Admin & National Lead)
    // ══════════════════════════════════════════════════════════════
    if (!selectedLabId) {
        const totalLabsCount = labs.length;
        const activeLabsCount = labs.filter(l => l.isActive !== false).length;
        const totalStaffCount = labs.reduce((acc, l) => acc + (l.staffCount || 0), 0);
        const totalSamplesCount = labs.reduce((acc, l) => acc + (l.sampleCount || 0), 0);

        return (
            <div className="space-y-6 animate-in fade-in duration-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-sf-primary">
                            Facility Network Governance
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-sf-text tracking-tight flex items-center gap-3">
                            <Beaker className="text-sf-primary" size={28} />
                            Laboratories
                        </h1>
                        <p className="text-xs sm:text-sm text-sf-muted mt-1">
                            Operational status, workload metrics, and responsible managers across authorized facilities.
                        </p>
                    </div>

                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'MASTER_USER') && (
                        <button
                            onClick={() => setShowOnboardModal(true)}
                            className="px-5 py-2.5 bg-sf-primary text-white rounded-xl font-bold text-xs hover:bg-sf-primary/90 transition shadow-md shadow-sf-primary/20 flex items-center gap-2 self-start sm:self-auto"
                        >
                            <Plus size={16} />
                            Onboard Laboratory
                        </button>
                    )}
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    <div className="p-4 rounded-xl bg-sf-surface border border-sf-divider">
                        <div className="text-2xl font-black text-sf-text">{totalLabsCount}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sf-muted mt-0.5">Total Facilities</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-surface border border-sf-divider">
                        <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeLabsCount}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sf-muted mt-0.5">Operational</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-surface border border-sf-divider">
                        <div className="text-2xl font-black text-sf-text">{totalStaffCount}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sf-muted mt-0.5">Authorized Staff</div>
                    </div>
                    <div className="p-4 rounded-xl bg-sf-surface border border-sf-divider">
                        <div className="text-2xl font-black text-sf-text">{totalSamplesCount}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-sf-muted mt-0.5">Samples Assigned</div>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search size={16} className="absolute left-3.5 top-3.5 text-sf-muted" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by lab name, code, ID or country..."
                            className="w-full pl-10 pr-4 py-2.5 bg-sf-surface border border-sf-divider rounded-xl text-xs sm:text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3.5 py-2.5 bg-sf-surface border border-sf-divider rounded-xl text-xs font-semibold text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                        >
                            <option value="all">All Operational States</option>
                            <option value="ACTIVE">Operational Only</option>
                            <option value="PAUSED">Paused Only</option>
                        </select>
                    </div>
                </div>

                {/* Laboratories Table */}
                <div className="bg-sf-surface border border-sf-divider rounded-2xl overflow-hidden shadow-sm">
                    {loadingLabs ? (
                        <div className="py-16 text-center text-sf-muted text-sm flex items-center justify-center gap-2">
                            <RefreshCw size={16} className="animate-spin" />
                            Loading facility roster...
                        </div>
                    ) : filteredLabs.length === 0 ? (
                        <div className="py-16 text-center text-sf-muted text-sm">
                            No matching laboratories found.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-sf-divider bg-sf-canvas/50 text-[10px] font-black uppercase tracking-wider text-sf-muted">
                                        <th className="py-3.5 px-4 sm:px-6">Laboratory</th>
                                        <th className="py-3.5 px-4">Location</th>
                                        <th className="py-3.5 px-4">Operational Status</th>
                                        <th className="py-3.5 px-4">Workload</th>
                                        <th className="py-3.5 px-4">Staff</th>
                                        <th className="py-3.5 px-4 sm:px-6 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sf-divider text-xs sm:text-sm">
                                    {filteredLabs.map(lab => {
                                        const isPaused = lab.isActive === false;
                                        return (
                                            <tr key={lab.id} className="hover:bg-sf-canvas/40 transition">
                                                <td className="py-4 px-4 sm:px-6">
                                                    <div className="font-bold text-sf-text">{lab.name}</div>
                                                    <div className="text-xs text-sf-muted font-mono">{lab.code} · {lab.id}</div>
                                                </td>
                                                <td className="py-4 px-4 text-sf-muted">
                                                    <div className="flex items-center gap-1 font-medium text-sf-text">
                                                        <MapPin size={13} className="text-sf-muted" />
                                                        {lab.country || 'Not specified'}
                                                    </div>
                                                    {lab.city && <div className="text-xs text-sf-muted">{lab.city}</div>}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                        isPaused
                                                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                                        {isPaused ? 'Paused' : 'Operational'}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="font-semibold text-sf-text">{lab.sampleCount || 0} samples</div>
                                                    <div className="text-xs text-sf-muted">{lab.projects?.length || 0} projects</div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="font-semibold text-sf-text">{lab.staffCount || 0} members</div>
                                                </td>
                                                <td className="py-4 px-4 sm:px-6 text-right">
                                                    <button
                                                        onClick={() => selectLab(lab.id)}
                                                        className="px-3.5 py-1.5 bg-sf-canvas hover:bg-sf-raised border border-sf-divider rounded-xl text-xs font-bold text-sf-primary hover:text-sf-text transition inline-flex items-center gap-1"
                                                    >
                                                        Open Workspace <ChevronRight size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Onboard Laboratory Modal */}
                {showOnboardModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                        <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-2xl border border-sf-divider max-h-[90vh] flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-sf-divider flex items-center justify-between shrink-0">
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-widest text-sf-primary">
                                        Facility Provisioning
                                    </div>
                                    <h2 className="text-xl font-black text-sf-text">Onboard New Laboratory</h2>
                                </div>
                                <button onClick={() => setShowOnboardModal(false)} className="p-2 hover:bg-sf-raised rounded-xl transition text-sf-muted">
                                    <X size={18} />
                                </button>
                            </div>

                            <form onSubmit={handleOnboardSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
                                    <Shield size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <span>
                                        Onboarding initializes laboratory identity, regional scope, and metadata. Staff accounts are provisioned separately via named invitation tokens. No static dummy passwords will be generated.
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                            Lab ID (Unique) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={onboardForm.id}
                                            onChange={e => setOnboardForm({ ...onboardForm, id: e.target.value.toUpperCase() })}
                                            placeholder="e.g. GTM-LAB-01"
                                            className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm font-mono text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                            Lab Code <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={onboardForm.code}
                                            onChange={e => setOnboardForm({ ...onboardForm, code: e.target.value.toUpperCase() })}
                                            placeholder="e.g. GTM01"
                                            className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm font-mono text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                        Laboratory Full Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={onboardForm.name}
                                        onChange={e => setOnboardForm({ ...onboardForm, name: e.target.value })}
                                        placeholder="e.g. Central Soil Testing Laboratory"
                                        className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                            Country <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={onboardForm.country}
                                            onChange={e => setOnboardForm({ ...onboardForm, country: e.target.value })}
                                            placeholder="Guatemala"
                                            className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                            City
                                        </label>
                                        <input
                                            type="text"
                                            value={onboardForm.city}
                                            onChange={e => setOnboardForm({ ...onboardForm, city: e.target.value })}
                                            placeholder="Guatemala City"
                                            className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                            IANA Time Zone <span className="text-rose-500">*</span>
                                        </label>
                                        <select
                                            value={onboardForm.timezone}
                                            onChange={e => setOnboardForm({ ...onboardForm, timezone: e.target.value })}
                                            className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-xs text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                        >
                                            {getIanaTimezones().map(tz => (
                                                <option key={tz} value={tz}>{tz}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                            Contact Email
                                        </label>
                                        <input
                                            type="email"
                                            value={onboardForm.email}
                                            onChange={e => setOnboardForm({ ...onboardForm, email: e.target.value })}
                                            placeholder="lab@soilfer.org"
                                            className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                            Phone Number
                                        </label>
                                        <input
                                            type="text"
                                            value={onboardForm.phone}
                                            onChange={e => setOnboardForm({ ...onboardForm, phone: e.target.value })}
                                            placeholder="+502 2345 6789"
                                            className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-sf-divider flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowOnboardModal(false)}
                                        className="px-5 py-2.5 rounded-xl border border-sf-divider text-xs font-bold text-sf-muted hover:bg-sf-raised transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submittingOnboard}
                                        className="px-6 py-2.5 bg-sf-primary text-white rounded-xl text-xs font-bold hover:bg-sf-primary/90 transition shadow-md shadow-sf-primary/20 disabled:opacity-50"
                                    >
                                        {submittingOnboard ? 'Onboarding...' : 'Onboard Facility'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════
    // VIEW 2: LABORATORY 6-TAB WORKSPACE
    // ══════════════════════════════════════════════════════════════
    const lab = workspace?.lab;
    const workload = workspace?.workload;
    const isPaused = workspace?.isPaused || lab?.isActive === false;
    const localTimeStr = getLocalTime(lab?.timezone);
    const responsibleMgr = workspace?.responsibleManager;
    const attentionList = workspace?.attention || [];

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* Breadcrumb & Navigation Back */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-sf-muted">
                    {(user?.role === 'SUPER_ADMIN' || user?.role === 'MASTER_USER') ? (
                        <button
                            onClick={backToDirectory}
                            className="hover:text-sf-primary font-bold flex items-center gap-1 transition"
                        >
                            <ArrowLeft size={13} />
                            Laboratories
                        </button>
                    ) : (
                        <span className="font-bold">Laboratories</span>
                    )}
                    <span>/</span>
                    <span className="text-sf-text font-semibold truncate">{lab?.name || selectedLabId}</span>
                </div>

                <button
                    onClick={() => setShowHelpModal(true)}
                    className="px-3 py-1.5 rounded-xl border border-sf-divider text-xs font-bold text-sf-muted hover:text-sf-text hover:bg-sf-surface transition flex items-center gap-1.5"
                >
                    <HelpCircle size={14} />
                    Help with this lab
                </button>
            </div>

            {/* Hero Card */}
            <div className="p-6 rounded-2xl bg-sf-surface border border-sf-divider shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-4">
                        {/* Styled Soil Band Stamp */}
                        <div className="w-14 h-16 rounded-xl border-2 border-white dark:border-gray-800 shadow-md flex flex-col overflow-hidden shrink-0" aria-hidden="true">
                            <div className="flex-1 bg-[#48856b]" />
                            <div className="flex-1 bg-[#bda170]" />
                            <div className="flex-1 bg-[#835b40]" />
                        </div>

                        <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-sf-muted">
                                {lab?.code || selectedLabId} · {lab?.country || 'Facility'}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-sf-text tracking-tight">
                                {lab?.name || 'Laboratory Workspace'}
                            </h1>
                            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    isPaused
                                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                    {isPaused ? 'Ⅱ Lab Paused' : '● Operational'}
                                </span>
                                <span className="text-xs text-sf-muted flex items-center gap-1 font-mono">
                                    <Clock size={12} />
                                    {lab?.city ? `${lab.city} · ` : ''}{localTimeStr || lab?.timezone || 'UTC'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scope Hint Banner */}
                <div className="p-3 bg-sf-canvas border border-sf-divider rounded-xl flex items-center justify-between gap-3 text-xs text-sf-muted">
                    <span>
                        {user?.role === 'LAB_MANAGER' ? (
                            <><strong>Your laboratory.</strong> Manage your team, local assignments, and settings. Shared project access is managed by its owner.</>
                        ) : user?.role === 'SUPER_ADMIN' ? (
                            <><strong>Administrator view.</strong> Reviewing {lab?.code}. Operational changes require target scope and recorded audit reason.</>
                        ) : (
                            <><strong>National lead view · {lab?.country}.</strong> Viewing authorized regional laboratory. Staff administration requires explicit delegation.</>
                        )}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-sf-raised text-[10px] font-bold text-sf-muted uppercase tracking-wider shrink-0">
                        Scoped
                    </span>
                </div>
            </div>

            {/* Paused Alert Banner if applicable */}
            {isPaused && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <strong className="font-bold block mb-0.5">This Laboratory is Currently Paused</strong>
                        New sample intake, batch assignments, and operational result writes are held. Historical records and recoverable drafts are preserved.
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="flex border-b border-sf-divider gap-4 sm:gap-8 overflow-x-auto custom-scrollbar">
                {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'people', label: 'People', count: workspace?.workload?.staff?.total },
                    { id: 'projects', label: 'Projects', count: workspace?.projects?.length },
                    { id: 'resources', label: 'Methods & Resources' },
                    { id: 'settings', label: 'Settings' },
                    { id: 'history', label: 'History' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setTab(tab.id)}
                        className={`py-3 px-1 text-xs sm:text-sm font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                            activeTab === tab.id
                                ? 'border-sf-primary text-sf-primary'
                                : 'border-transparent text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-sf-canvas text-[10px] text-sf-muted font-semibold">
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ────────────────────────────────────────────────────────── */}
            {/* TAB 1: OVERVIEW                                            */}
            {/* ────────────────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
                    <div className="lg:col-span-2 space-y-6">
                        {/* Issues / Decisions ("Keep the lab moving") */}
                        <div className="p-6 rounded-2xl bg-sf-surface border border-sf-divider space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-black text-sf-text">Keep the Lab Moving</h2>
                                    <p className="text-xs text-sf-muted mt-0.5">Decisions and attention items requiring management action.</p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    attentionList.length > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                }`}>
                                    {attentionList.length} to review
                                </span>
                            </div>

                            {attentionList.length === 0 ? (
                                <div className="p-4 bg-sf-canvas rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
                                    <CheckCircle2 size={16} /> All facility governance and configuration checks are passing.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {attentionList.map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-sf-canvas border border-sf-divider rounded-xl flex items-start gap-3">
                                            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 shrink-0">
                                                <AlertTriangle size={15} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-sf-text">{item.message}</div>
                                                <div className="text-[11px] text-sf-muted font-mono">{item.code}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Work at this laboratory (Stage Breakdown) */}
                        <div className="p-6 rounded-2xl bg-sf-surface border border-sf-divider space-y-4">
                            <div>
                                <h2 className="text-base font-black text-sf-text">Work at this Laboratory</h2>
                                <p className="text-xs text-sf-muted mt-0.5">Active assigned samples categorized by current workflow stage.</p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="p-4 rounded-xl bg-sf-canvas border border-sf-divider">
                                    <div className="text-2xl font-black text-sf-text">{workload?.samples?.expected || 0}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-sf-muted mt-0.5">Expected</div>
                                </div>
                                <div className="p-4 rounded-xl bg-sf-canvas border border-sf-divider">
                                    <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{workload?.samples?.received || 0}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-sf-muted mt-0.5">Received</div>
                                </div>
                                <div className="p-4 rounded-xl bg-sf-canvas border border-sf-divider">
                                    <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{workload?.samples?.inAnalysis || 0}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-sf-muted mt-0.5">In Analysis</div>
                                </div>
                                <div className="p-4 rounded-xl bg-sf-canvas border border-sf-divider">
                                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{workload?.samples?.review || 0}</div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-sf-muted mt-0.5">Review Queue</div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <span className="text-xs text-sf-muted">
                                    Total active workload: {workload?.workItems?.open || 0} assigned tasks across {workload?.samples?.active || 0} samples.
                                </span>
                                <Link
                                    to="/workbench"
                                    className="text-xs font-bold text-sf-primary hover:underline flex items-center gap-1"
                                >
                                    Open Work Queues <ChevronRight size={13} />
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Responsible Manager & Facility Attributes */}
                    <div className="space-y-6">
                        <div className="p-6 rounded-2xl bg-sf-surface border border-sf-divider space-y-4">
                            <div className="text-[10px] font-black uppercase tracking-widest text-sf-muted">
                                Responsible Manager
                            </div>

                            {responsibleMgr ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-bold flex items-center justify-center text-sm shrink-0">
                                        {responsibleMgr.name?.slice(0, 2).toUpperCase() || 'LM'}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-sm text-sf-text truncate">{responsibleMgr.name}</div>
                                        <div className="text-xs text-sf-muted truncate">{responsibleMgr.email || responsibleMgr.username}</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-200">
                                    No active Laboratory Manager assigned.
                                </div>
                            )}

                            <div className="border-t border-sf-divider pt-3 space-y-2 text-xs">
                                <div className="flex justify-between py-1">
                                    <span className="text-sf-muted">Staff Members</span>
                                    <span className="font-bold text-sf-text">{workload?.staff?.total || 0}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-sf-muted">Active Technicians</span>
                                    <span className="font-bold text-sf-text">{workload?.staff?.active || 0}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-sf-muted">Local Timezone</span>
                                    <span className="font-mono text-sf-text">{lab?.timezone || 'Not set'}</span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span className="text-sf-muted">Operational State</span>
                                    <span className="font-bold text-sf-text">{isPaused ? 'Paused' : 'Active'}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setTab('people')}
                                className="w-full py-2.5 bg-sf-canvas hover:bg-sf-raised border border-sf-divider rounded-xl text-xs font-bold text-sf-primary transition"
                            >
                                Manage People & Access
                            </button>
                        </div>

                        {/* Project Responsibility Summary */}
                        <div className="p-6 rounded-2xl bg-sf-surface border border-sf-divider space-y-3">
                            <div className="text-[10px] font-black uppercase tracking-widest text-sf-muted">
                                Projects Context
                            </div>
                            <h3 className="font-bold text-sm text-sf-text">
                                {workspace?.projects?.length || 0} Projects Assigned
                            </h3>
                            <p className="text-xs text-sf-muted">
                                This laboratory performs sample analyses for authorized shared field programmes and local contracted batches.
                            </p>
                            <button
                                onClick={() => setTab('projects')}
                                className="text-xs font-bold text-sf-primary hover:underline flex items-center gap-1"
                            >
                                View Project Access Details <ChevronRight size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* TAB 2: PEOPLE (Staff Roster & Governance)                  */}
            {/* ────────────────────────────────────────────────────────── */}
            {activeTab === 'people' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-black text-sf-text">People and Access</h2>
                            <p className="text-xs text-sf-muted mt-0.5">
                                Single authoritative roster for invitations, capability reviews, and open assignment handovers.
                            </p>
                        </div>

                        <button
                            onClick={() => setShowInviteModal(true)}
                            className="px-4 py-2.5 bg-sf-primary text-white rounded-xl text-xs font-bold hover:bg-sf-primary/90 transition shadow-md shadow-sf-primary/20 flex items-center gap-2 self-start sm:self-auto"
                        >
                            <Plus size={15} /> Invite a Person
                        </button>
                    </div>

                    {/* Filter toolbar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search size={15} className="absolute left-3.5 top-3.5 text-sf-muted" />
                            <input
                                type="text"
                                value={staffSearch}
                                onChange={(e) => setStaffSearch(e.target.value)}
                                placeholder="Search people by name, username, or role..."
                                className="w-full pl-10 pr-4 py-2 bg-sf-surface border border-sf-divider rounded-xl text-xs text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                            />
                        </div>
                        <select
                            value={staffStatusFilter}
                            onChange={(e) => setStaffStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-sf-surface border border-sf-divider rounded-xl text-xs font-semibold text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                        >
                            <option value="all">All Account States</option>
                            <option value="Active">Active Only</option>
                            <option value="Suspended">Suspended Only</option>
                        </select>
                    </div>

                    {/* Staff Table */}
                    <div className="bg-sf-surface border border-sf-divider rounded-2xl overflow-hidden shadow-sm">
                        {filteredStaff.length === 0 ? (
                            <div className="py-16 text-center text-sf-muted text-xs">
                                No staff accounts matching the selected criteria.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-sf-divider bg-sf-canvas/50 text-[10px] font-black uppercase tracking-wider text-sf-muted">
                                            <th className="py-3 px-4 sm:px-6">Person</th>
                                            <th className="py-3 px-4">Role & Scope</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4">Current Work</th>
                                            <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-sf-divider text-xs sm:text-sm">
                                        {filteredStaff.map(member => {
                                            const roleBadge = getRoleBadge(member.role);
                                            const isSuspended = member.isActive === false;
                                            return (
                                                <tr key={member.id} className="hover:bg-sf-canvas/40 transition">
                                                    <td className="py-3.5 px-4 sm:px-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-sf-raised text-sf-text font-bold text-xs flex items-center justify-center shrink-0">
                                                                {member.name?.slice(0, 2).toUpperCase() || member.username?.slice(0, 2).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-sf-text truncate">{member.name || member.username}</div>
                                                                <div className="text-[11px] text-sf-muted font-mono truncate">{member.email || member.username}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${roleBadge.color}`}>
                                                            {roleBadge.label}
                                                        </span>
                                                        <div className="text-[11px] text-sf-muted mt-0.5">
                                                            {member.labId ? `Lab: ${member.labId}` : 'Global Scope'}
                                                        </div>
                                                    </td>
                                                    <td className="py-3.5 px-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${
                                                            isSuspended
                                                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                        }`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                            {isSuspended ? 'Suspended' : 'Active'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3.5 px-4 text-xs text-sf-muted">
                                                        {member.openWorkCount ? (
                                                            <span className="font-bold text-amber-600 dark:text-amber-400">
                                                                {member.openWorkCount} assignments
                                                            </span>
                                                        ) : (
                                                            <span>0 open tasks</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5 px-4 sm:px-6 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => {
                                                                    setTargetUser(member);
                                                                    setShowAccessReviewModal(true);
                                                                }}
                                                                className="px-2.5 py-1 bg-sf-canvas hover:bg-sf-raised border border-sf-divider rounded-lg text-xs font-bold text-sf-text transition"
                                                            >
                                                                Review Access
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setTargetUser(member);
                                                                    setShowRecoveryModal(true);
                                                                }}
                                                                title="One-Time Recovery Link"
                                                                className="p-1.5 text-sf-muted hover:text-amber-600 hover:bg-sf-raised rounded-lg transition"
                                                            >
                                                                <KeyRound size={14} />
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setTargetUser(member);
                                                                    setShowSuspendModal(true);
                                                                }}
                                                                title={isSuspended ? 'Reactivate User' : 'Suspend User'}
                                                                className={`p-1.5 rounded-lg transition ${
                                                                    isSuspended
                                                                        ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                                                        : 'text-sf-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                                                }`}
                                                            >
                                                                <Power size={14} />
                                                            </button>
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
                </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* TAB 3: PROJECTS (Serviced Projects & Boundaries)          */}
            {/* ────────────────────────────────────────────────────────── */}
            {activeTab === 'projects' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                    <div>
                        <h2 className="text-lg font-black text-sf-text">Projects Served by this Laboratory</h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            Separation of project ownership from laboratory servicing responsibility.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(workspace?.projects || []).map((p, idx) => (
                            <div key={idx} className="p-5 rounded-2xl bg-sf-surface border border-sf-divider space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-wider text-sf-muted">
                                            {p.isOwned ? 'LAB-OWNED PROJECT' : 'SHARED PROGRAMME'}
                                        </div>
                                        <h3 className="font-black text-base text-sf-text">{p.name || p.code}</h3>
                                        <div className="text-xs text-sf-muted font-mono">{p.code}</div>
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        p.isOwned ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300'
                                    }`}>
                                        {p.isOwned ? 'Owner' : 'Servicing Lab'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-sf-divider">
                                    <div>
                                        <span className="text-sf-muted block text-[10px] uppercase">Status</span>
                                        <span className="font-semibold text-sf-text">{p.status || 'ACTIVE'}</span>
                                    </div>
                                    <div>
                                        <span className="text-sf-muted block text-[10px] uppercase">Workload</span>
                                        <span className="font-semibold text-sf-text">{p.sampleCount || 0} samples</span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <Link
                                        to={`/projects?code=${encodeURIComponent(p.code)}`}
                                        className="text-xs font-bold text-sf-primary hover:underline flex items-center gap-1"
                                    >
                                        View Project Workspace <ChevronRight size={13} />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* TAB 4: METHODS & RESOURCES (Connected Screens)             */}
            {/* ────────────────────────────────────────────────────────── */}
            {activeTab === 'resources' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                    <div>
                        <h2 className="text-lg font-black text-sf-text">Ready for the Next Batch</h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            Specialist modules operating within this laboratory's verified context.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                            {
                                title: 'Method Defaults',
                                icon: Sliders,
                                path: `/lab-methods?labId=${selectedLabId}`,
                                desc: 'Approved parameter names, analytical packages, and method revisions.',
                                badge: 'Active Catalogue'
                            },
                            {
                                title: 'Equipment & Calibration',
                                icon: Monitor,
                                path: `/equipment?labId=${selectedLabId}`,
                                desc: 'Instruments, ISO 17025 calibration status, maintenance records.',
                                badge: `${workload?.equipment?.total || 0} Assets`
                            },
                            {
                                title: 'Chemical Inventory',
                                icon: Package,
                                path: `/inventory?labId=${selectedLabId}`,
                                desc: 'Reagents, reference materials, lots, same-lab storage locations.',
                                badge: 'Inventory Ready'
                            },
                            {
                                title: 'Quality Assurance',
                                icon: Award,
                                path: `/qa?labId=${selectedLabId}`,
                                desc: 'Control charts, proficiency rounds, duplicate precision monitoring.',
                                badge: 'QA Records'
                            }
                        ].map((res, i) => (
                            <Link
                                key={i}
                                to={res.path}
                                className="p-5 rounded-2xl bg-sf-surface border border-sf-divider hover:border-sf-primary/40 hover:shadow-md transition space-y-3 group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="p-2.5 rounded-xl bg-sf-canvas text-sf-primary group-hover:bg-sf-primary group-hover:text-white transition">
                                        <res.icon size={20} />
                                    </div>
                                    <span className="px-2 py-0.5 rounded-md bg-sf-canvas text-[10px] font-bold text-sf-muted uppercase tracking-wider">
                                        {res.badge}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-base text-sf-text group-hover:text-sf-primary transition">
                                        {res.title}
                                    </h3>
                                    <p className="text-xs text-sf-muted mt-1 leading-relaxed">{res.desc}</p>
                                </div>
                                <div className="text-xs font-bold text-sf-primary flex items-center gap-1 pt-1">
                                    Open Workspace <ChevronRight size={13} />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* TAB 5: SETTINGS (Local Profile & Lifecycle Controls)       */}
            {/* ────────────────────────────────────────────────────────── */}
            {activeTab === 'settings' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                    <div>
                        <h2 className="text-lg font-black text-sf-text">Laboratory Configuration</h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            Facility identity, timezone normalization, and operational lifecycle state.
                        </p>
                    </div>

                    {settingsMsg && (
                        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                            settingsMsg.type === 'success'
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200'
                                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 border border-rose-200'
                        }`}>
                            {settingsMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                            <span>{settingsMsg.text}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Profile Details Form */}
                        <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-sf-surface border border-sf-divider space-y-4">
                            <h3 className="font-black text-sm text-sf-text uppercase tracking-wider">
                                Facility Profile & Local Time
                            </h3>

                            <div>
                                <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Laboratory Name
                                </label>
                                <input
                                    type="text"
                                    value={settingsForm.name}
                                    onChange={e => setSettingsForm({ ...settingsForm, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        value={settingsForm.city}
                                        onChange={e => setSettingsForm({ ...settingsForm, city: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                        IANA Timezone
                                    </label>
                                    <select
                                        value={settingsForm.timezone}
                                        onChange={e => setSettingsForm({ ...settingsForm, timezone: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-xs text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                    >
                                        {getIanaTimezones().map(tz => (
                                            <option key={tz} value={tz}>{tz}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                        Contact Email
                                    </label>
                                    <input
                                        type="email"
                                        value={settingsForm.email}
                                        onChange={e => setSettingsForm({ ...settingsForm, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                        Phone
                                    </label>
                                    <input
                                        type="text"
                                        value={settingsForm.phone}
                                        onChange={e => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                                        className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-sf-muted mb-1 uppercase tracking-wider">
                                    Physical Address
                                </label>
                                <textarea
                                    rows={2}
                                    value={settingsForm.address}
                                    onChange={e => setSettingsForm({ ...settingsForm, address: e.target.value })}
                                    className="w-full px-3 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-xs text-sf-text focus:ring-2 focus:ring-sf-primary outline-none resize-none"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={savingSettings}
                                className="px-6 py-2 bg-sf-primary text-white rounded-xl text-xs font-bold hover:bg-sf-primary/90 transition shadow-md shadow-sf-primary/20 disabled:opacity-50"
                            >
                                {savingSettings ? 'Saving Profile...' : 'Save Profile Changes'}
                            </button>
                        </form>

                        {/* Operational Status & Lifecycle Control */}
                        <div className="p-6 rounded-2xl bg-sf-surface border border-sf-divider space-y-4">
                            <h3 className="font-black text-sm text-sf-text uppercase tracking-wider">
                                Operational Lifecycle Status
                            </h3>

                            <div className="p-4 bg-sf-canvas rounded-xl border border-sf-divider space-y-2">
                                <div className="text-xs text-sf-muted uppercase tracking-wider">Current State</div>
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                                    <span className="font-bold text-base text-sf-text">
                                        {isPaused ? 'PAUSED' : 'ACTIVE / OPERATIONAL'}
                                    </span>
                                </div>
                                <p className="text-xs text-sf-muted">
                                    {isPaused
                                        ? 'Facility writes and intake are stopped. Scoped records and drafts are preserved.'
                                        : 'Normal operations active. Analytical intake, assignment, and execution enabled.'}
                                </p>
                            </div>

                            <div className="p-3.5 bg-sf-raised/50 rounded-xl border border-sf-divider text-xs text-sf-muted space-y-1.5">
                                <strong className="font-bold text-sf-text block">Anti-Cascade Protection</strong>
                                <p>
                                    Pausing or reactivating a laboratory operates on the facility entity only. Individual user accounts are never cascade-disabled.
                                </p>
                            </div>

                            {(user?.role === 'SUPER_ADMIN' || user?.role === 'MASTER_USER') ? (
                                <div className="space-y-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLifecycleTargetState(isPaused ? 'ACTIVE' : 'PAUSED');
                                            setShowLifecycleModal(true);
                                        }}
                                        className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition shadow-md ${
                                            isPaused
                                                ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                                                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                        }`}
                                    >
                                        {isPaused ? 'Review Resume Operations' : 'Review Pause Operations'}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs text-sf-muted italic">
                                    Operational status transitions are reserved for authorized system administrators.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* TAB 6: HISTORY (Scoped Audit Events)                       */}
            {/* ────────────────────────────────────────────────────────── */}
            {activeTab === 'history' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                    <div>
                        <h2 className="text-lg font-black text-sf-text">Changes with a Clear Trail</h2>
                        <p className="text-xs text-sf-muted mt-0.5">
                            Scoped, redacted audit trail: actor, affected resource, reason, and operational impact.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-sf-surface border border-sf-divider space-y-4">
                        <div className="space-y-3">
                            <div className="p-4 bg-sf-canvas border border-sf-divider rounded-xl">
                                <div className="text-[10px] font-black uppercase tracking-wider text-sf-muted">
                                    RECENT FACILITY ACTIVITY
                                </div>
                                <div className="font-bold text-sm text-sf-text mt-1">
                                    Operational governance verified for {lab?.name}
                                </div>
                                <div className="text-xs text-sf-muted mt-1">
                                    RBAC policies, isolated schema invariants, and zero sample loss safeguards active.
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Link
                                to={`/admin/audit?labId=${selectedLabId}`}
                                className="text-xs font-bold text-sf-primary hover:underline flex items-center gap-1"
                            >
                                Open Full System Audit Log <ChevronRight size={13} />
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* ────────────────────────────────────────────────────────── */}
            {/* MODALS                                                     */}
            {/* ────────────────────────────────────────────────────────── */}
            {showInviteModal && (
                <InviteStaffModal
                    isOpen={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    onSuccess={() => {
                        fetchWorkspace(selectedLabId);
                    }}
                    defaultLabId={selectedLabId}
                    availableLabs={labs}
                />
            )}

            {showAccessReviewModal && targetUser && (
                <AccessReviewModal
                    isOpen={showAccessReviewModal}
                    user={targetUser}
                    currentLabId={selectedLabId}
                    onClose={() => {
                        setShowAccessReviewModal(false);
                        setTargetUser(null);
                    }}
                    onSuccess={({ message }) => {
                        showDialog({ title: 'Access Updated', message, type: 'success' });
                        fetchWorkspace(selectedLabId);
                    }}
                />
            )}

            {showRecoveryModal && targetUser && (
                <RecoveryLinkModal
                    isOpen={showRecoveryModal}
                    user={targetUser}
                    onClose={() => {
                        setShowRecoveryModal(false);
                        setTargetUser(null);
                    }}
                    onSuccess={() => {
                        fetchWorkspace(selectedLabId);
                    }}
                />
            )}

            {showSuspendModal && targetUser && (
                <SuspendUserModal
                    isOpen={showSuspendModal}
                    user={targetUser}
                    onClose={() => {
                        setShowSuspendModal(false);
                        setTargetUser(null);
                    }}
                    onSuccess={(msg) => {
                        showDialog({ title: 'Account State Updated', message: msg, type: 'success' });
                        fetchWorkspace(selectedLabId);
                    }}
                />
            )}

            {showLifecycleModal && (
                <LabLifecycleModal
                    isOpen={showLifecycleModal}
                    lab={lab}
                    targetState={lifecycleTargetState}
                    onClose={() => {
                        setShowLifecycleModal(false);
                        setLifecycleTargetState(null);
                    }}
                    onSuccess={() => {
                        fetchWorkspace(selectedLabId);
                        fetchLabs();
                    }}
                />
            )}

            {/* Contextual Help Modal */}
            {showHelpModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-sf-surface rounded-2xl shadow-2xl w-full max-w-lg border border-sf-divider overflow-hidden">
                        <div className="p-6 border-b border-sf-divider flex items-center justify-between">
                            <h3 className="font-black text-base text-sf-text">Laboratory Guidance</h3>
                            <button onClick={() => setShowHelpModal(false)} className="p-1 text-sf-muted hover:text-sf-text">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 text-xs text-sf-muted">
                            <p>
                                <strong>People & Access:</strong> Use named invitations for new staff. Changing roles preserves existing authorship and unfinished tasks.
                            </p>
                            <p>
                                <strong>Projects:</strong> Service responsibility is distinct from project ownership. Only project owners can modify global access.
                            </p>
                            <p>
                                <strong>Lifecycle:</strong> Pausing a laboratory halts new entries but never deactivates staff accounts.
                            </p>
                        </div>
                        <div className="p-4 border-t border-sf-divider flex justify-end">
                            <button
                                onClick={() => setShowHelpModal(false)}
                                className="px-5 py-2 bg-sf-primary text-white rounded-xl text-xs font-bold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
