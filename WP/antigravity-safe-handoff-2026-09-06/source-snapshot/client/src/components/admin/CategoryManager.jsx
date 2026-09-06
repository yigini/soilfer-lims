import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { notifyCatalogueChanged } from '../../context/AnalysisCatalogueContext';
import { Plus, Edit2, Trash2, Check, Tag, AlertTriangle, X } from 'lucide-react';

const CategoryManager = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await axios.get('/api/config/categories');
            setCategories(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setError(null);
        try {
            if (editingItem._isNew) {
                await axios.post('/api/config/categories', editingItem);
            } else {
                await axios.put(`/api/config/categories/${editingItem.id}`, editingItem);
            }
            await fetchData();
            notifyCatalogueChanged();
            setEditingItem(null);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to save category');
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete category "${name}"? Analyses in this category will become uncategorized.`)) return;
        setError(null);
        try {
            await axios.delete(`/api/config/categories/${id}`);
            await fetchData();
            notifyCatalogueChanged();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to delete category');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading Property Categories...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 font-sans w-full min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analysis & Property Categories</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Organize test parameters into standard analytical domains (Physical, Chemical, Biological, Spectral).</p>
                </div>
                <button
                    onClick={() => setEditingItem({ id: '', name: '', _isNew: true })}
                    className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-md shadow-emerald-700/20 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
                >
                    <Plus size={16} /> Add Category
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-xl text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {categories.map(c => (
                    <div key={c.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-3.5 min-w-0 pr-2">
                            <div className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 p-2.5 rounded-xl flex-shrink-0">
                                <Tag size={18} />
                            </div>
                            <div className="min-w-0">
                                <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{c.name}</h3>
                                <span className="inline-block text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">
                                    {c.id}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                                onClick={() => setEditingItem({ ...c, _isNew: false })}
                                disabled={c.canEdit === false}
                                className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Edit Category"
                            >
                                <Edit2 size={14} />
                            </button>
                            <button
                                onClick={() => handleDelete(c.id, c.name)}
                                disabled={c.canEdit === false}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Delete Category"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Inline edit modal */}
            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-7 w-full max-w-md space-y-5 animate-in zoom-in-95 duration-200 font-sans">
                        <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-3">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingItem._isNew ? 'New Property Category' : 'Edit Category'}
                            </h3>
                            <button
                                onClick={() => setEditingItem(null)}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {editingItem._isNew && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">Category ID</label>
                                    <input
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:bg-white dark:focus:bg-gray-950 focus:border-emerald-500"
                                        value={editingItem.id}
                                        onChange={e => setEditingItem({ ...editingItem, id: e.target.value })}
                                        placeholder="e.g. routine_chemical"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">Category Name</label>
                                <input
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                                    value={editingItem.name}
                                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                    placeholder="e.g. Routine Chemical Properties & Acidity"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setEditingItem(null)}
                                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-700/20 transition-all active:scale-95"
                            >
                                Save Category
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryManager;

