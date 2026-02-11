import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, Tag, AlertTriangle } from 'lucide-react';

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
            fetchData();
            setEditingItem(null);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to save');
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete category "${name}"? Analyses in this category will become uncategorized.`)) return;
        setError(null);
        try {
            await axios.delete(`/api/config/categories/${id}`);
            fetchData();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to delete');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Analysis Categories</h2>
                    <p className="text-sm text-gray-500">Organize analyses into logical domains (Physical, Chemical, Biological, Spectral).</p>
                </div>
                <button
                    onClick={() => setEditingItem({ id: '', name: '', _isNew: true })}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700"
                >
                    <Plus size={18} /> Add Category
                </button>
            </div>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {categories.map(c => (
                    <div key={c.id} className="bg-white border rounded-lg p-5 hover:shadow-sm transition-shadow group">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="bg-purple-100 p-2 rounded-lg">
                                    <Tag size={18} className="text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800">{c.name}</h3>
                                    <code className="text-xs text-gray-400">{c.id}</code>
                                </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingItem({ ...c, _isNew: false })} className="p-1 text-gray-400 hover:text-blue-600">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => handleDelete(c.id, c.name)} className="p-1 text-gray-400 hover:text-red-600">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Inline edit modal */}
            {editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">{editingItem._isNew ? 'New Category' : 'Edit Category'}</h3>
                        <div className="space-y-4">
                            {editingItem._isNew && (
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Category ID</label>
                                    <input
                                        className="w-full p-2 border rounded font-mono bg-gray-50"
                                        value={editingItem.id}
                                        onChange={e => setEditingItem({ ...editingItem, id: e.target.value })}
                                        placeholder="e.g. physical"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold mb-1">Category Name</label>
                                <input
                                    className="w-full p-2 border rounded"
                                    value={editingItem.name}
                                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                    placeholder="e.g. Physical Properties"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded font-medium flex items-center gap-2">
                                <Check size={18} /> Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryManager;
