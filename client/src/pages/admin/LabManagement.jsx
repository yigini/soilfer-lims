import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
    Plus, Edit, Beaker, CheckCircle2, X, HelpCircle, ChevronDown, ChevronRight,
    Users, FlaskConical, MapPin, Phone, Mail, Globe, Clock, Building2, Hash,
    Shield, UserCheck, UserX, KeyRound, Copy, Activity, BarChart3, Power,
    FileText, AlertTriangle, FolderOpen, Clipboard, Eye, Search, ExternalLink,
    TestTube2, ArrowUpRight
} from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import { useLanguage } from '../../context/LanguageContext';

// ─── Role Display Config ───
const ROLE_CONFIG = {
    'LAB_MANAGER': { label: 'Lab Manager', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300', icon: Shield },
    'SAMPLE_RECEPTION': { label: 'Intake Officer', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300', icon: UserCheck },
    'LAB_TECHNICIAN': { label: 'Technician', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300', icon: FlaskConical },
    'AUDIT_USER': { label: 'Auditor', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', icon: Eye },
    'EXTERNAL_VIEWER': { label: 'External', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', icon: Globe },
    'SURVEYOR': { label: 'Surveyor', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300', icon: MapPin },
    'VIEWER': { label: 'Viewer', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', icon: Eye },
};

const getRoleDisplay = (role) => ROLE_CONFIG[role] || { label: role, color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', icon: Users };

// ─── Stat Card ───
const StatCard = ({ icon: Icon, label, value, sub, color }) => (
    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/60 dark:bg-white/5 border border-gray-200/50 dark:border-white/10 backdrop-blur-sm">
        <div className={`p-3 rounded-xl ${color}`}>
            <Icon size={20} className="text-white" />
        </div>
        <div>
            <div className="text-2xl font-black text-gray-900 dark:text-white">{value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</div>
            {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
        </div>
    </div>
);

// ─── Success Modal (credentials display) ───
const SuccessModal = ({ isOpen, labName, staff, onClose }) => {
    if (!isOpen) return null;
    const [copied, setCopied] = useState(false);

    const copyAll = () => {
        const text = staff.map(s => `${s.role}\t${s.username}\t${s.password}`).join('\n');
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 dark:border-gray-700 animate-in zoom-in duration-300">
                <div className="p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 size={48} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">Lab Created!</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-6">
                        <strong>"{labName}"</strong> is now online with {staff?.length || 0} staff accounts.
                    </p>

                    {staff && staff.length > 0 && (
                        <div className="w-full text-left">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Generated Credentials</span>
                                <button onClick={copyAll} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors">
                                    <Copy size={12} /> {copied ? 'Copied!' : 'Copy All'}
                                </button>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="px-3 py-2 text-left font-bold text-gray-500 dark:text-gray-400">Role</th>
                                            <th className="px-3 py-2 text-left font-bold text-gray-500 dark:text-gray-400">Username</th>
                                            <th className="px-3 py-2 text-left font-bold text-gray-500 dark:text-gray-400">Password</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {staff.map((s, i) => (
                                            <tr key={i} className="border-b last:border-0 border-gray-100 dark:border-gray-700/50">
                                                <td className="px-3 py-2 font-medium text-gray-700 dark:text-gray-300">{s.name || s.role}</td>
                                                <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400">{s.username}</td>
                                                <td className="px-3 py-2 font-mono text-amber-600 dark:text-amber-400">{s.password}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
                                    <AlertTriangle size={12} /> Save these credentials — they won't be shown again.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-gray-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black dark:hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Expanded Staff Tab ───
const StaffTab = ({ labId, labName }) => {
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionMsg, setActionMsg] = useState(null);

    useEffect(() => {
        axios.get(`/api/labs/${labId}/staff`).then(r => { setStaff(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, [labId]);

    const toggleStaff = async (userId) => {
        try {
            const res = await axios.patch(`/api/labs/${labId}/staff/${userId}/toggle`);
            setStaff(prev => prev.map(s => s.id === userId ? { ...s, isActive: res.data.isActive } : s));
        } catch (e) { setActionMsg('Failed to toggle staff'); }
    };

    const resetPassword = async (userId, username) => {
        if (!window.confirm(`Reset password for ${username}? They will need to change it on next login.`)) return;
        try {
            const res = await axios.patch(`/api/labs/${labId}/staff/${userId}/reset-password`);
            setActionMsg(`Password reset for ${res.data.username}: ${res.data.tempPassword}`);
            setTimeout(() => setActionMsg(null), 8000);
        } catch (e) { setActionMsg('Reset failed'); }
    };

    if (loading) return <div className="py-8 text-center text-gray-400 text-sm">Loading staff roster…</div>;
    if (!staff.length) return <div className="py-8 text-center text-gray-400 text-sm">No staff accounts found for this lab.</div>;

    return (
        <div className="space-y-3">
            {actionMsg && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={14} /> {actionMsg}
                </div>
            )}
            <div className="grid gap-2">
                {staff.map(user => {
                    const rd = getRoleDisplay(user.role);
                    const RIcon = rd.icon;
                    return (
                        <div key={user.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${user.isActive
                            ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                            : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 opacity-60'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${rd.color}`}>
                                    <RIcon size={14} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{user.name || user.username}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${rd.color}`}>
                                            {rd.label}
                                        </span>
                                        {!user.isActive && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                                                Disabled
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 font-mono">{user.username}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => resetPassword(user.id, user.username)}
                                    className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-all"
                                    title="Reset Password"
                                >
                                    <KeyRound size={14} />
                                </button>
                                <button
                                    onClick={() => toggleStaff(user.id)}
                                    className={`p-2 rounded-lg transition-all ${user.isActive
                                        ? 'text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                                        : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}
                                    title={user.isActive ? 'Disable Account' : 'Enable Account'}
                                >
                                    <Power size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Expanded Projects Tab ───
const ProjectsTab = ({ projects }) => {
    if (!projects || projects.length === 0) return <div className="py-8 text-center text-gray-400 text-sm">No projects assigned to this lab.</div>;
    return (
        <div className="grid gap-2">
            {projects.map(proj => (
                <Link
                    key={proj.code}
                    to="/projects"
                    className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all group"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${proj.isOwned ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-blue-100 dark:bg-blue-900/40'}`}>
                            <FolderOpen size={16} className={proj.isOwned ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'} />
                        </div>
                        <div>
                            <div className="font-bold text-sm text-gray-800 dark:text-gray-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {proj.name || proj.code}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">{proj.code}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${proj.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : proj.status === 'PAUSED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}>{proj.status}</span>
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${proj.isOwned ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                            }`}>{proj.isOwned ? 'Owned' : 'Shared'}</span>
                        <ArrowUpRight size={14} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                </Link>
            ))}
        </div>
    );
};

// ─── Expanded Info Tab ───
const InfoTab = ({ lab }) => {
    const fields = [
        { icon: Hash, label: 'Lab ID', value: lab.id },
        { icon: Building2, label: 'Code', value: lab.code },
        { icon: MapPin, label: 'Country', value: lab.country },
        { icon: Building2, label: 'City', value: lab.city },
        { icon: MapPin, label: 'Address', value: lab.address },
        { icon: Mail, label: 'Email', value: lab.email, isLink: true, href: `mailto:${lab.email}` },
        { icon: Phone, label: 'Phone', value: lab.phone },
        { icon: Globe, label: 'Website', value: lab.website, isLink: true, href: lab.website },
        { icon: Clock, label: 'Timezone', value: lab.timezone },
        { icon: BarChart3, label: 'Capacity', value: lab.capacity ? `${lab.capacity} samples/month` : null },
        { icon: Users, label: 'Staff', value: lab.staffCount > 0 ? `${lab.staffCount} staff (${lab.activeStaffCount || 0} active)` : null },
        { icon: FlaskConical, label: 'Samples', value: lab.sampleCount > 0 ? `${lab.sampleCount} total (${lab.activeSampleCount || 0} active)` : null },
        { icon: FolderOpen, label: 'Projects', value: lab.projects?.length > 0 ? `${lab.projects.length} projects` : null },
        { icon: Clock, label: 'Created', value: lab.createdAt ? new Date(lab.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null },
        { icon: FileText, label: 'Notes', value: lab.notes },
    ].filter(f => f.value);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {fields.map(f => (
                <div key={f.label} className="flex items-start gap-3 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <f.icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">{f.label}</div>
                        {f.isLink ? (
                            <a href={f.href} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline truncate block">{f.value}</a>
                        ) : (
                            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.value}</div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

// ─── Expandable Lab Row ───
const LabRow = ({ lab, isExpanded, onToggle, onEdit, onToggleActive }) => {
    const [activeTab, setActiveTab] = useState('staff');

    return (
        <>
            <tr
                className={`group cursor-pointer transition-all duration-200 ${isExpanded
                    ? 'bg-blue-50/50 dark:bg-blue-900/10'
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                    } ${!lab.isActive ? 'opacity-50' : ''}`}
                onClick={onToggle}
            >
                {/* Expand Arrow */}
                <td className="pl-4 pr-1 py-4 w-8">
                    <div className={`transition-transform duration-200 text-gray-400 ${isExpanded ? 'rotate-90' : ''}`}>
                        <ChevronRight size={16} />
                    </div>
                </td>

                {/* Status */}
                <td className="px-3 py-4 w-12">
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
                        className={`w-3 h-3 rounded-full transition-all ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ${lab.isActive
                            ? 'bg-emerald-500 ring-emerald-300 dark:ring-emerald-700'
                            : 'bg-red-400 ring-red-200 dark:ring-red-800'
                            }`}
                        title={lab.isActive ? 'Active — Click to deactivate' : 'Inactive — Click to activate'}
                    />
                </td>

                {/* Lab ID */}
                <td className="px-4 py-4">
                    <div className="font-mono font-black text-sm text-gray-800 dark:text-gray-200">{lab.id}</div>
                </td>

                {/* Name + Country + Contact */}
                <td className="px-4 py-4">
                    <div className="font-bold text-gray-800 dark:text-gray-200">{lab.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <MapPin size={10} />{lab.country}{lab.city && ` · ${lab.city}`}
                    </div>
                    {(lab.email || lab.phone) && (
                        <div className="flex items-center gap-2 mt-1">
                            {lab.email && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                    <Mail size={9} />{lab.email}
                                </span>
                            )}
                            {lab.phone && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                    <Phone size={9} />{lab.phone}
                                </span>
                            )}
                        </div>
                    )}
                </td>

                {/* Projects — show NAME, not just code */}
                <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                        {lab.projects && lab.projects.length > 0
                            ? lab.projects.slice(0, 3).map(proj => (
                                <div key={proj.code} className="flex items-center gap-1.5">
                                    <FolderOpen size={11} className={proj.isOwned ? 'text-emerald-500 shrink-0' : 'text-blue-500 shrink-0'} />
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[180px]" title={`${proj.name} (${proj.code})`}>
                                        {proj.name || proj.code}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${proj.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                        : proj.status === 'PAUSED' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                        }`}>{proj.status}</span>
                                </div>
                            ))
                            : <span className="text-xs text-gray-400 italic">No projects</span>
                        }
                        {lab.projects && lab.projects.length > 3 && (
                            <span className="text-[10px] text-gray-400 font-medium">
                                +{lab.projects.length - 3} more
                            </span>
                        )}
                    </div>
                </td>

                {/* Staff */}
                <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1">
                            <Users size={13} className="text-gray-400" />
                            <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{lab.staffCount || 0}</span>
                        </div>
                        {lab.staffCount > 0 && (
                            <span className={`text-[10px] mt-0.5 ${lab.activeStaffCount < lab.staffCount ? 'text-amber-500' : 'text-emerald-500'}`}>
                                {lab.activeStaffCount || 0} active
                            </span>
                        )}
                    </div>
                </td>

                {/* Samples */}
                <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1">
                            <FlaskConical size={13} className="text-gray-400" />
                            <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{lab.sampleCount || 0}</span>
                        </div>
                        {lab.sampleCount > 0 && (
                            <span className="text-[10px] text-emerald-500 mt-0.5">
                                {lab.activeSampleCount || 0} active
                            </span>
                        )}
                    </div>
                </td>

                {/* Actions */}
                <td className="px-4 py-4 text-right">
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                        title="Edit Lab"
                    >
                        <Edit size={16} />
                    </button>
                </td>
            </tr>

            {/* Expanded Detail Panel */}
            {isExpanded && (
                <tr>
                    <td colSpan={8} className="px-0 py-0">
                        <div className="mx-4 mb-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 overflow-hidden">
                            {/* Tab Bar */}
                            <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                {[
                                    { key: 'staff', label: 'Staff', icon: Users, count: lab.staffCount },
                                    { key: 'projects', label: 'Projects', icon: FolderOpen, count: lab.projects?.length },
                                    { key: 'info', label: 'Details', icon: FileText },
                                ].map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={(e) => { e.stopPropagation(); setActiveTab(tab.key); }}
                                        className={`flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === tab.key
                                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                            : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                                            }`}
                                    >
                                        <tab.icon size={14} />
                                        {tab.label}
                                        {tab.count !== undefined && (
                                            <span className="px-1.5 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300 ml-1">
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                            {/* Tab Content */}
                            <div className="p-4">
                                {activeTab === 'staff' && <StaffTab labId={lab.id} labName={lab.name} />}
                                {activeTab === 'projects' && <ProjectsTab projects={lab.projects} />}
                                {activeTab === 'info' && <InfoTab lab={lab} />}
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

// ─── Create/Edit Modal ───
const LabFormModal = ({ isOpen, editingLab, formData, setFormData, onSubmit, onClose, projects }) => {
    if (!isOpen) return null;

    const timezones = [
        { value: '', label: 'Select Timezone...' },
        { value: 'America/Guatemala', label: 'America/Guatemala (UTC-6)' },
        { value: 'America/Tegucigalpa', label: 'America/Tegucigalpa (UTC-6)' },
        { value: 'America/New_York', label: 'America/New York (UTC-5)' },
        { value: 'America/Chicago', label: 'America/Chicago (UTC-6)' },
        { value: 'America/Denver', label: 'America/Denver (UTC-7)' },
        { value: 'America/Los_Angeles', label: 'America/Los Angeles (UTC-8)' },
        { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
        { value: 'Europe/Rome', label: 'Europe/Rome (UTC+1)' },
        { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+1)' },
        { value: 'Europe/Istanbul', label: 'Europe/Istanbul (UTC+3)' },
        { value: 'Africa/Accra', label: 'Africa/Accra (UTC+0)' },
        { value: 'Africa/Nairobi', label: 'Africa/Nairobi (UTC+3)' },
        { value: 'Africa/Lusaka', label: 'Africa/Lusaka (UTC+2)' },
        { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (UTC+2)' },
        { value: 'Africa/Tunis', label: 'Africa/Tunis (UTC+1)' },
        { value: 'Africa/Maputo', label: 'Africa/Maputo (UTC+2)' },
        { value: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
        { value: 'Asia/Shanghai', label: 'Asia/Shanghai (UTC+8)' },
        { value: 'UTC', label: 'UTC' },
    ];

    const inputCls = "w-full border border-gray-200 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:bg-white dark:focus:bg-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-300 dark:placeholder-gray-500";
    const labelCls = "block text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <h2 className="text-xl font-black text-gray-800 dark:text-white flex items-center gap-2">
                        <Beaker size={20} className="text-blue-500" />
                        {editingLab ? 'Edit Laboratory' : 'Onboard New Laboratory'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all">
                        <X size={18} className="text-gray-400" />
                    </button>
                </div>

                <form onSubmit={onSubmit} className="p-6 space-y-5">
                    {/* Core Identity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Lab ID (Unique)</label>
                            <input className={inputCls} placeholder="GTM-LAB1" value={formData.id}
                                onChange={e => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                                disabled={!!editingLab} required />
                        </div>
                        <div>
                            <label className={labelCls}>Lab Code</label>
                            <input className={inputCls} placeholder="GTM1" value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                disabled={!!editingLab} required />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Lab Name</label>
                        <input className={inputCls} placeholder="Guatemala City Soil Laboratory" value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                    </div>

                    {/* Geographic */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelCls}>Country (ISO3)</label>
                            <input className={`${inputCls} text-center font-bold`} value={formData.country}
                                onChange={e => setFormData({ ...formData, country: e.target.value.toUpperCase() })}
                                required maxLength={3} placeholder="GTM" />
                        </div>
                        <div>
                            <label className={labelCls}>City</label>
                            <input className={inputCls} value={formData.city || ''}
                                onChange={e => setFormData({ ...formData, city: e.target.value })} placeholder="Guatemala City" />
                        </div>
                        <div>
                            <label className={labelCls}>Timezone</label>
                            <select className={`${inputCls} appearance-none`} value={formData.timezone || ''}
                                onChange={e => setFormData({ ...formData, timezone: e.target.value })}>
                                {timezones.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Contact Email</label>
                            <input type="email" className={inputCls} value={formData.email || ''}
                                onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="lab@soilfer.org" />
                        </div>
                        <div>
                            <label className={labelCls}>Phone</label>
                            <input className={inputCls} value={formData.phone || ''}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="+502 1234 5678" />
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Physical Address</label>
                        <textarea className={`${inputCls} resize-none`} rows={2} value={formData.address || ''}
                            onChange={e => setFormData({ ...formData, address: e.target.value })} />
                    </div>

                    {/* Capacity & Project */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Monthly Capacity</label>
                            <input type="number" className={inputCls} value={formData.capacity || ''}
                                onChange={e => setFormData({ ...formData, capacity: e.target.value })} placeholder="500" />
                        </div>
                        <div>
                            <label className={labelCls}>Primary Global Project</label>
                            <select className={`${inputCls} appearance-none`} value={formData.projectId}
                                onChange={e => setFormData({ ...formData, projectId: e.target.value })}>
                                <option value="">No project assigned</option>
                                {projects.map(p => <option key={p.id} value={p.code}>{p.name} ({p.code})</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Admin Notes</label>
                        <textarea className={`${inputCls} resize-none`} rows={2} value={formData.notes || ''}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                    </div>

                    {!editingLab && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 flex gap-3">
                            <HelpCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
                            <div className="text-[11px] text-blue-700 dark:text-blue-300 font-bold leading-relaxed">
                                <p className="mb-1">Creating a lab will auto-generate:</p>
                                <ul className="list-disc list-inside space-y-0.5 text-blue-600 dark:text-blue-400">
                                    <li>6 staff accounts (Manager, Intake, 2 Technicians, Auditor, External)</li>
                                    <li>A test project for onboarding</li>
                                    <li>All accounts use default password "password"</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <button type="button" onClick={onClose}
                            className="px-6 py-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl font-black uppercase tracking-widest text-[10px] transition">
                            Cancel
                        </button>
                        <button type="submit"
                            className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-black uppercase tracking-widest text-[10px] transition shadow-xl shadow-blue-500/20 active:scale-95">
                            {editingLab ? 'Update Lab' : 'Create & Onboard'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════
// ─── MAIN COMPONENT ───
// ═══════════════════════════════════════════════
const LabManagement = () => {
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const [labs, setLabs] = useState([]);
    const [projects, setProjects] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLab, setEditingLab] = useState(null);
    const [expandedLabId, setExpandedLabId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const [formData, setFormData] = useState({
        id: '', code: '', name: '', country: '', location: '', address: '', city: '',
        phone: '', email: '', website: '', capacity: '', timezone: '', notes: '', projectId: ''
    });

    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successLabName, setSuccessLabName] = useState('');
    const [successStaff, setSuccessStaff] = useState([]);

    useEffect(() => { fetchLabs(); fetchProjects(); }, []);

    const fetchLabs = async () => {
        try {
            const res = await axios.get('/api/labs');
            setLabs(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchProjects = async () => {
        try {
            const res = await axios.get('/api/projects');
            setProjects(res.data);
        } catch (e) { console.error('Failed to fetch projects:', e); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingLab) {
                await axios.put(`/api/labs/${editingLab.id}`, formData);
            } else {
                const res = await axios.post('/api/labs', formData);
                setSuccessLabName(formData.name);
                setSuccessStaff(res.data.staff || []);
                setShowSuccessModal(true);
            }
            setIsModalOpen(false);
            setEditingLab(null);
            fetchLabs();
        } catch (e) {
            showDialog({ title: 'Operation Failed', message: e.response?.data?.error || e.message, type: 'error' });
        }
    };

    const openEdit = (lab) => {
        setEditingLab(lab);
        setFormData({
            id: lab.id, code: lab.code, name: lab.name, country: lab.country,
            location: lab.location || '', address: lab.address || '', city: lab.city || '',
            phone: lab.phone || '', email: lab.email || '', website: lab.website || '',
            capacity: lab.capacity || '', timezone: lab.timezone || '',
            notes: lab.notes || '', projectId: lab.projectCode || ''
        });
        setIsModalOpen(true);
    };

    const openNew = () => {
        setEditingLab(null);
        setFormData({
            id: '', code: '', name: '', country: '', location: '', address: '', city: '',
            phone: '', email: '', website: '', capacity: '', timezone: '', notes: '', projectId: ''
        });
        setIsModalOpen(true);
    };

    const [searchParams] = useSearchParams();
    const queryLabId = searchParams.get('labId');

    useEffect(() => {
        if (queryLabId && labs.length > 0) {
            const target = labs.find(l => l.id === queryLabId || l.code === queryLabId);
            if (target) {
                openEdit(target);
            }
        }
    }, [queryLabId, labs]);

    const toggleActive = async (lab) => {
        const action = lab.isActive ? 'deactivate' : 'activate';
        const warning = lab.isActive
            ? `Deactivating "${lab.name}" will also disable all ${lab.staffCount || 0} staff accounts. Continue?`
            : `Reactivate "${lab.name}"? Staff accounts will need to be re-enabled individually.`;
        if (!window.confirm(warning)) return;
        try {
            await axios.patch(`/api/labs/${lab.id}/toggle-active`);
            fetchLabs();
        } catch (e) { showDialog({ title: 'Toggle Failed', message: e.response?.data?.error || e.message, type: 'error' }); }
    };

    // Filter
    const filteredLabs = labs.filter(lab => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return lab.id.toLowerCase().includes(q) || lab.name.toLowerCase().includes(q)
            || lab.code.toLowerCase().includes(q) || (lab.country || '').toLowerCase().includes(q);
    });

    // Stats
    const totalLabs = labs.length;
    const activeLabs = labs.filter(l => l.isActive !== false).length;
    const totalStaff = labs.reduce((sum, l) => sum + (l.staffCount || 0), 0);
    const totalSamples = labs.reduce((sum, l) => sum + (l.sampleCount || 0), 0);

    return (
        <div className="p-6 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
                            <Beaker size={22} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        {t('labs.title', 'Laboratory Management')}
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">{t('labs.subtitle', 'Configure National Reference Soil Laboratories and partner facilities')}</p>
                </div>
                <button onClick={openNew}
                    className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-black uppercase tracking-widest text-[10px] transition shadow-lg shadow-blue-500/20 active:scale-95">
                    <Plus size={16} /> {t('labs.addLab', 'Onboard Lab')}
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Beaker} label="Total Labs" value={totalLabs} sub={`${activeLabs} active`} color="bg-blue-500" />
                <StatCard icon={Users} label="Total Staff" value={totalStaff} color="bg-violet-500" />
                <StatCard icon={FlaskConical} label="Total Samples" value={totalSamples.toLocaleString()} color="bg-emerald-500" />
                <StatCard icon={Activity} label="Active Labs" value={activeLabs} sub={totalLabs > activeLabs ? `${totalLabs - activeLabs} inactive` : 'All online'} color="bg-amber-500" />
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search labs by ID, name, code, or country…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                            <th className="pl-4 pr-1 py-3 w-8"></th>
                            <th className="px-3 py-3 w-12 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500"></th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Lab ID</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Name</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Projects</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 text-center">Staff</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 text-center">Samples</th>
                            <th className="px-4 py-3 w-16"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {loading ? (
                            <tr><td colSpan={8} className="py-16 text-center text-gray-400 text-sm">Loading laboratories…</td></tr>
                        ) : filteredLabs.length === 0 ? (
                            <tr><td colSpan={8} className="py-16 text-center text-gray-400 text-sm">
                                {searchQuery ? 'No labs match your search.' : 'No laboratories registered yet.'}
                            </td></tr>
                        ) : filteredLabs.map(lab => (
                            <LabRow
                                key={lab.id}
                                lab={lab}
                                isExpanded={expandedLabId === lab.id}
                                onToggle={() => setExpandedLabId(expandedLabId === lab.id ? null : lab.id)}
                                onEdit={() => openEdit(lab)}
                                onToggleActive={() => toggleActive(lab)}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            <LabFormModal
                isOpen={isModalOpen}
                editingLab={editingLab}
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleSubmit}
                onClose={() => { setIsModalOpen(false); setEditingLab(null); }}
                projects={projects}
            />

            <SuccessModal
                isOpen={showSuccessModal}
                labName={successLabName}
                staff={successStaff}
                onClose={() => setShowSuccessModal(false)}
            />
        </div>
    );
};

export default LabManagement;
