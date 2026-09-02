import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Plus, Search, Edit2, Trash2, Shield, User, MapPin, Eye, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import UserDialog from '../components/UserDialog';
import { useDialog } from '../context/DialogContext';

const Users = () => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const { showDialog } = useDialog();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [showDialogState, setShowDialogState] = useState(false); // Renamed to avoid collision with hook
    const [editingUser, setEditingUser] = useState(null);

    // Initial Fetch
    useEffect(() => {
        fetchUsers();
    }, [page, search]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/api/users?page=${page}&limit=10&search=${search}`);
            setUsers(res.data.data);
            setTotalPages(res.data.meta.pages);
        } catch (e) {
            console.error(e);
            showDialog({ title: 'Error', message: 'Failed to fetch users', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        showDialog({
            title: 'Delete User?',
            message: 'Are you sure you want to delete this user?',
            type: 'confirm',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    await axios.delete(`/api/users/${id}`);
                    fetchUsers();
                } catch (e) {
                    showDialog({
                        title: 'Delete Failed',
                        message: e.response?.data?.error || e.message,
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleResetPassword = (id, name) => {
        showDialog({
            title: 'Reset Password',
            message: `Enter new temporary password for ${name}:`,
            type: 'prompt', // Special type for input
            confirmText: 'Reset Password',
            cancelText: 'Cancel',
            inputPlaceholder: 'New Password',
            onConfirm: async (newPassword) => {
                if (!newPassword || newPassword.length < 6) {
                    showDialog({ title: 'Error', message: 'Password must be at least 6 characters.', type: 'error' });
                    return;
                }
                try {
                    await axios.put(`/api/users/${id}`, { password: newPassword });
                    showDialog({ title: 'Success', message: `Password reset for ${name}. They will be asked to change it on next login.`, type: 'success' });
                } catch (e) {
                    showDialog({ title: 'Error', message: e.response?.data?.error || 'Failed to reset password', type: 'error' });
                }
            }
        });
    };

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

                    // Direct Login logic
                    localStorage.setItem('token', token);
                    localStorage.setItem('user', JSON.stringify(userData));
                    window.location.href = '/'; // Hard reload to pick up new context
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

    const handleSave = () => {
        setShowDialogState(false);
        setEditingUser(null);
        fetchUsers();
    };

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{t('users.title', 'Laboratory Staff')}</h1>
                    <p className="text-gray-700 dark:text-gray-400">{t('users.subtitle', 'Manage laboratory personnel and access')}</p>
                </div>
                <button
                    onClick={() => { setEditingUser(null); setShowDialogState(true); }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus size={18} /> {t('users.addUser', 'Add User')}
                </button>
            </div>

            {/* Filters */}
            <div className="card-base p-4 rounded-lg shadow-sm border mb-6 flex gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
                    <input
                        type="text"
                        placeholder={t('users.searchPlaceholder', 'Search users by name, username, or email...')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input-base w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="card-base rounded-lg shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-semibold border-b dark:border-gray-600">
                        <tr>
                            <th className="p-4">{t('users.name', 'User')}</th>
                            <th className="p-4">{t('users.role', 'Role')}</th>
                            <th className="p-4">{t('users.lab', 'Scope (Lab/Country)')}</th>
                            <th className="p-4 text-center">{t('common.actions', 'Actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-gray-700">
                        {loading ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-500 dark:text-gray-400">{t('common.loading', 'Loading...')}</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan="4" className="p-8 text-center text-gray-400">{t('common.noRecords', 'No users found.')}</td></tr>
                        ) : (
                            users.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-bold">
                                                {u.name ? u.name.charAt(0) : '?'}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-gray-100">{u.name}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                            u.role === 'LAB_MANAGER' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                'bg-blue-100 text-blue-700 border-blue-200'
                                            }`}>
                                            {t(`roles.${u.role}`, u.role.replace('_', ' '))}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400">
                                        {u.labId ? (
                                            <div className="flex items-center gap-1"><MapPin size={14} /> {u.labId}</div>
                                        ) : (
                                            u.countries && u.countries.length > 0 ? (
                                                <div className="flex items-center gap-1"><Shield size={14} /> {u.countries.join(', ')}</div>
                                            ) : <span className="text-gray-400 italic">Global</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => { setEditingUser(u); setShowDialogState(true); }}
                                                className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-gray-700 rounded"
                                                title={t('common.edit', 'Edit')}
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            {user.role === 'SUPER_ADMIN' && u.id !== user.id && (
                                                <button
                                                    onClick={() => handleImpersonate(u.id)}
                                                    className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-gray-700 rounded"
                                                    title={t('users.impersonate', 'Log in as User')}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(u.id)}
                                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-700 rounded"
                                                title={t('common.delete', 'Delete')}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleResetPassword(u.id, u.name)}
                                                className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-gray-700 rounded"
                                                title={t('users.resetPassword', 'Reset Password')}
                                            >
                                                <Lock size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination settings */}
            <div className="mt-5 flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
                <button
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    {t('common.next', 'Next')}
                    <ChevronRight size={16} />
                </button>
            </div>

            {showDialogState && (
                <UserDialog
                    userToEdit={editingUser}
                    onClose={() => setShowDialogState(false)}
                    onSave={handleSave}
                    currentUserRole={user.role}
                    currentUserLabId={user.labId}
                />
            )}
        </div>
    );
};

export default Users;
