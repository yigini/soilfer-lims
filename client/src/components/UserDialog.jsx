import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';

const UserDialog = ({ userToEdit, onClose, onSave, currentUserRole, currentUserLabId }) => {
    const isEdit = !!userToEdit;
    const { showDialog } = useDialog();
    const { t } = useLanguage();

    // Form State
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        email: '',
        role: 'LAB_TECHNICIAN', // Default safe role
        password: '',
        labId: currentUserLabId || '',
        countries: [],
        projects: []
    });

    // Fetch Projects for Selection
    const [availableProjects, setAvailableProjects] = useState([]);
    useEffect(() => {
        if (currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'MASTER_USER') {
            axios.get('/api/projects').then(res => setAvailableProjects(res.data)).catch(console.error);
        }
    }, [currentUserRole]);

    useEffect(() => {
        if (userToEdit) {
            setFormData({
                ...userToEdit,
                password: '' // Don't allow editing password simply yet, or leave empty to keep same
            });
        }
    }, [userToEdit]);

    // Roles available to be assigned based on Creator
    const getRoleOptions = () => {
        if (currentUserRole === 'LAB_MANAGER') {
            return ['LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'VIEWER', 'SURVEYOR'];
        }
        if (['Super Admin', 'SUPER_ADMIN'].includes(currentUserRole)) {
            return ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'VIEWER', 'SURVEYOR'];
        }
        return [];
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Password Complexity Check for New Users
        if (!isEdit && formData.password.length < 8) {
            showDialog({ title: t('common.error', 'Error'), message: t('forms.minLength', { min: 8 }, 'Password must be at least 8 characters long'), type: 'error' });
            return;
        }

        try {
            if (isEdit) {
                await axios.put(`/api/users/${userToEdit.id}`, formData);
            } else {
                await axios.post('/api/users', formData);
            }
            onSave();
        } catch (err) {
            showDialog({ title: t('common.error', 'Error'), message: err.response?.data?.error || err.message, type: 'error' });
        }
    };

    const roleOptions = getRoleOptions();
    const canEditLab = currentUserRole === 'SUPER_ADMIN';

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <X size={20} />
                </button>

                <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    {isEdit ? t('users.editUser', 'Edit User') : t('users.addUser', 'Add User')}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('users.name', 'Full Name')}</label>
                        <input
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('users.email', 'Email Address')}</label>
                        <input
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('users.username', 'Username')}</label>
                            <input
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                required
                                disabled={isEdit}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('users.role', 'Role')}</label>
                            <select
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                {roleOptions.map(r => (
                                    <option key={r} value={r}>{t(`roles.${r}`, r.replace('_', ' '))}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Project Selection (Admin Only) */}
                    {(currentUserRole === 'SUPER_ADMIN' || currentUserRole === 'MASTER_USER') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('users.assignedProjects', 'Assigned Projects')}</label>
                            <div className="flex flex-wrap gap-2 border dark:border-gray-600 p-2 rounded-lg max-h-32 overflow-y-auto">
                                {availableProjects.map(p => (
                                    <label key={p.code} className="flex items-center gap-2 text-sm cursor-pointer p-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded text-gray-800 dark:text-gray-200">
                                        <input
                                            type="checkbox"
                                            checked={formData.projects.includes(p.code)}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setFormData(prev => ({
                                                    ...prev,
                                                    projects: checked
                                                        ? [...prev.projects, p.code]
                                                        : prev.projects.filter(code => code !== p.code)
                                                }));
                                            }}
                                            className="rounded text-blue-600"
                                        />
                                        <span>{p.code} ({p.name})</span>
                                    </label>
                                ))}
                                {availableProjects.length === 0 && <span className="text-gray-400 text-sm">{t('projects.noProjects', 'No projects available')}</span>}
                            </div>
                        </div>
                    )}

                    {!isEdit && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('users.password', 'Password')}</label>
                            <input
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder={t('users.tempPassword', 'Min. 8 characters')}
                                required
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('users.tempPasswordHint', 'Temporary password. User will be asked to change on first login.')}</p>
                        </div>
                    )}

                    {/* Scoping Fields */}
                    {canEditLab ? (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('users.lab', 'Assigned Laboratory')}</label>
                            <input
                                name="labId"
                                value={formData.labId || ''}
                                onChange={handleChange}
                                placeholder="e.g. LAB-GTM"
                                className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    ) : (
                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded text-sm text-gray-600 dark:text-gray-300 border dark:border-gray-600">
                            {t('users.lab', 'Assigned Laboratory')}: <strong>{currentUserLabId}</strong>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        >
                            {t('common.cancel', 'Cancel')}
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-sm"
                        >
                            {t('common.save', 'Save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserDialog;
