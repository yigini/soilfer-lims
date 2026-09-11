import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
    Plus, Search, Edit2, Shield, User, MapPin, Eye, Lock,
    ChevronLeft, ChevronRight, KeyRound, Power, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { useDialog } from '../context/DialogContext';

import InviteStaffModal from '../components/staff/InviteStaffModal';
import AccessReviewModal from '../components/staff/AccessReviewModal';
import RecoveryLinkModal from '../components/staff/RecoveryLinkModal';
import SuspendUserModal from '../components/staff/SuspendUserModal';
import UserDialog from '../components/UserDialog';

const Users = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { showDialog } = useDialog();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');

    // Selected user for modals
    const [selectedUser, setSelectedUser] = useState(null);
    const [editingUser, setEditingUser] = useState(null);

    // Modals state
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showAccessReviewModal, setShowAccessReviewModal] = useState(false);
    const [showRecoveryModal, setShowRecoveryModal] = useState(false);
    const [showSuspendModal, setShowSuspendModal] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/users?page=${page}&limit=10&search=${encodeURIComponent(search)}`);
            setUsers(res.data.data);
            setTotalPages(res.data.meta.pages || 1);
        } catch (e) {
            console.error('Failed to fetch users:', e);
            showDialog({ title: 'Error', message: 'Failed to fetch users roster', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [page, search, showDialog]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleImpersonate = async (userId) => {
        showDialog({
            title: t('users.impersonateTitle', 'Impersonate User?'),
            message: t('users.impersonateMsg', 'Are you sure you want to log in as this user? You will need to log out to return to your admin account.'),
            type: 'confirm',
            confirmText: t('users.impersonateConfirm', 'Log In as User'),
            cancelText: t('common.cancel', 'Cancel'),
            onConfirm: async () => {
                try {
                    const res = await axios.post('/api/auth/impersonate', { userId });
                    const payload = res.data?.data || res.data;
                    const token = payload?.token;
                    const userData = payload?.user;

                    if (!token || !userData) {
                        throw new Error('Invalid token or user data received');
                    }

                    localStorage.setItem('token', token);
                    localStorage.setItem('user', JSON.stringify(userData));
                    window.location.href = '/';
                } catch (e) {
                    showDialog({
                        title: t('common.error', 'Error'),
                        message: e.response?.data?.message || e.response?.data?.error || e.message || 'Impersonation failed',
                        type: 'error'
                    });
                }
            }
        });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-sf-text tracking-tight flex items-center gap-3">
                        <User className="text-sf-primary" size={28} />
                        {t('users.title', 'Laboratory Staff & Users')}
                    </h1>
                    <p className="text-xs sm:text-sm text-sf-muted mt-1">
                        {t('users.subtitle', 'Manage user accounts, system roles, and laboratory access boundaries')}
                    </p>
                </div>

                <button
                    onClick={() => setShowInviteModal(true)}
                    className="px-5 py-2.5 bg-sf-primary text-white rounded-xl font-bold text-xs hover:bg-sf-primary/90 transition shadow-md shadow-sf-primary/20 flex items-center gap-2 self-start sm:self-auto"
                >
                    <Plus size={16} /> {t('users.inviteStaff', 'Invite Team Member')}
                </button>
            </div>

            {/* Filter */}
            <div className="bg-sf-surface p-3 sm:p-4 rounded-xl border border-sf-divider shadow-xs flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sf-muted" size={16} />
                    <input
                        type="text"
                        placeholder={t('users.searchPlaceholder', 'Search users by name, username, or email...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-sf-canvas border border-sf-divider rounded-xl text-xs sm:text-sm text-sf-text focus:ring-2 focus:ring-sf-primary outline-none transition"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-sf-surface border border-sf-divider rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-sf-divider bg-sf-canvas/50 text-[10px] font-black uppercase tracking-wider text-sf-muted">
                            <th className="py-3.5 px-4 sm:px-6">{t('users.name', 'User')}</th>
                            <th className="py-3.5 px-4">{t('users.role', 'Role')}</th>
                            <th className="py-3.5 px-4">Status</th>
                            <th className="py-3.5 px-4">{t('users.lab', 'Scope (Lab/Country)')}</th>
                            <th className="py-3.5 px-4 sm:px-6 text-right">{t('common.actions', 'Actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-sf-divider text-xs sm:text-sm">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-sf-muted">{t('common.loading', 'Loading...')}</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-sf-muted">{t('common.noRecords', 'No users found.')}</td></tr>
                        ) : (
                            users.map(u => {
                                const isSuspended = u.isActive === false;
                                return (
                                    <tr key={u.id} className="hover:bg-sf-canvas/40 transition">
                                        <td className="py-3.5 px-4 sm:px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-sf-raised text-sf-text font-bold text-xs flex items-center justify-center shrink-0">
                                                    {u.name ? u.name.charAt(0).toUpperCase() : '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-sf-text truncate">{u.name}</div>
                                                    <div className="text-[11px] text-sf-muted font-mono truncate">{u.email || u.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300' :
                                                u.role === 'LAB_MANAGER' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300' :
                                                'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300'
                                            }`}>
                                                {t(`roles.${u.role}`, u.role?.replace('_', ' '))}
                                            </span>
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
                                            {u.labId ? (
                                                <div className="flex items-center gap-1 font-medium text-sf-text">
                                                    <MapPin size={13} className="text-sf-muted" /> {u.labId}
                                                </div>
                                            ) : (
                                                u.countries && u.countries.length > 0 ? (
                                                    <div className="flex items-center gap-1"><Shield size={13} /> {u.countries.join(', ')}</div>
                                                ) : <span className="text-sf-muted italic">Global scope</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 sm:px-6 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(u);
                                                        setShowAccessReviewModal(true);
                                                    }}
                                                    className="px-2.5 py-1 bg-sf-canvas hover:bg-sf-raised border border-sf-divider rounded-lg text-xs font-bold text-sf-text transition"
                                                    title="Review and change role & scope"
                                                >
                                                    Review Access
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(u);
                                                        setShowRecoveryModal(true);
                                                    }}
                                                    className="p-1.5 text-sf-muted hover:text-amber-600 hover:bg-sf-raised rounded-lg transition"
                                                    title="Issue One-Time Recovery Link"
                                                >
                                                    <KeyRound size={15} />
                                                </button>

                                                {user.role === 'SUPER_ADMIN' && u.id !== user.id && (
                                                    <button
                                                        onClick={() => handleImpersonate(u.id)}
                                                        className="p-1.5 text-sf-muted hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg transition"
                                                        title={t('users.impersonate', 'Log in as User')}
                                                    >
                                                        <Eye size={15} />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => {
                                                        setSelectedUser(u);
                                                        setShowSuspendModal(true);
                                                    }}
                                                    className={`p-1.5 rounded-lg transition ${
                                                        isSuspended
                                                            ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                                            : 'text-sf-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                                                    }`}
                                                    title={isSuspended ? 'Reactivate Account' : 'Suspend Account'}
                                                >
                                                    <Power size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex justify-between items-center bg-sf-surface p-4 rounded-xl border border-sf-divider shadow-xs">
                <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-sf-divider rounded-lg hover:bg-sf-raised text-sf-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    <ChevronLeft size={16} />
                    {t('common.previous', 'Previous')}
                </button>
                <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-full border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                        {t('common.pageOf', { page, totalPages }, `Page ${page} of ${totalPages}`)}
                    </span>
                </div>
                <button
                    disabled={page === totalPages || totalPages === 0}
                    onClick={() => setPage(p => p + 1)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-sf-divider rounded-lg hover:bg-sf-raised text-sf-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    {t('common.next', 'Next')}
                    <ChevronRight size={16} />
                </button>
            </div>

            {/* Modals */}
            {showInviteModal && (
                <InviteStaffModal
                    isOpen={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    onSuccess={() => fetchUsers()}
                    defaultLabId={user.labId}
                />
            )}

            {showAccessReviewModal && selectedUser && (
                <AccessReviewModal
                    isOpen={showAccessReviewModal}
                    user={selectedUser}
                    currentLabId={selectedUser.labId}
                    onClose={() => {
                        setShowAccessReviewModal(false);
                        setSelectedUser(null);
                    }}
                    onSuccess={({ message }) => {
                        showDialog({ title: 'Access Updated', message, type: 'success' });
                        fetchUsers();
                    }}
                />
            )}

            {showRecoveryModal && selectedUser && (
                <RecoveryLinkModal
                    isOpen={showRecoveryModal}
                    user={selectedUser}
                    onClose={() => {
                        setShowRecoveryModal(false);
                        setSelectedUser(null);
                    }}
                    onSuccess={() => fetchUsers()}
                />
            )}

            {showSuspendModal && selectedUser && (
                <SuspendUserModal
                    isOpen={showSuspendModal}
                    user={selectedUser}
                    onClose={() => {
                        setShowSuspendModal(false);
                        setSelectedUser(null);
                    }}
                    onSuccess={(msg) => {
                        showDialog({ title: 'Account State Updated', message: msg, type: 'success' });
                        fetchUsers();
                    }}
                />
            )}

            {showEditDialog && (
                <UserDialog
                    userToEdit={editingUser}
                    onClose={() => setShowEditDialog(false)}
                    onSave={() => {
                        setShowEditDialog(false);
                        fetchUsers();
                    }}
                    currentUserRole={user.role}
                    currentUserLabId={user.labId}
                />
            )}
        </div>
    );
};

export default Users;
