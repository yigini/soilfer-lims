import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, Search, Filter } from 'lucide-react';

const AnalysisManager = () => {
    const [analyses, setAnalyses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCat, setFilterCat] = useState('all');
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [aRes, cRes] = await Promise.all([
                axios.get('/api/config/analyses'),
                axios.get('/api/config/categories')
            ]);
            setAnalyses(aRes.data);
            setCategories(cRes.data);
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
                await axios.post('/api/config/analyses', editingItem);
            } else {
                await axios.put(`/api/config/analyses/${editingItem.code}`, editingItem);
            }
            fetchData();
            setEditingItem(null);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to save');
        }
    };

    const handleDelete = async (code) => {
        if (!confirm(`Delete analysis ${code}? This is destructive!`)) return;
        setError(null);
        try {
            await axios.delete(`/api/config/analyses/${code}`);
            fetchData();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to delete');
        }
    };

    const filtered = analyses.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCat = filterCat === 'all' || a.categoryId === filterCat;
        return matchesSearch && matchesCat;
    });

    if (loading) return <div>Loading...</div>;

    if (editingItem) {
        return (
            <div className="bg-white p-6 rounded shadow-sm border max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold">{editingItem._isNew ? 'New Analysis Definition' : `Edit: ${editingItem.name}`}</h2>
                    <button onClick={() => { setEditingItem(null); setError(null); }} className="text-gray-500 hover:text-gray-700">Cancel</button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">{error}</div>
                )}

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Analysis Code (Immutable)</label>
                        <input
                            className="w-full p-2 border rounded bg-gray-50 font-mono"
                            value={editingItem.code}
                            disabled={!editingItem._isNew}
                            onChange={e => setEditingItem({ ...editingItem, code: e.target.value.toUpperCase() })}
                            placeholder="e.g. PH_H2O"
                        />
                        <p className="text-xs text-gray-500 mt-1">Unique identifier for system logic.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Display Name</label>
                        <input
                            className="w-full p-2 border rounded"
                            value={editingItem.name}
                            onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                            placeholder="e.g. Soil pH (Water)"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Category</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={editingItem.categoryId}
                            onChange={e => setEditingItem({ ...editingItem, categoryId: e.target.value })}
                        >
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Units</label>
                        <input
                            className="w-full p-2 border rounded"
                            value={editingItem.units}
                            onChange={e => setEditingItem({ ...editingItem, units: e.target.value })}
                            placeholder="e.g. mg/kg"
                        />
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-semibold mb-1">Description / Notes</label>
                        <textarea
                            className="w-full p-2 border rounded h-24"
                            value={editingItem.description || ''}
                            onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                            placeholder="Detailed description of the parameter..."
                        />
                    </div>

                    <div className="col-span-2 border-t pt-4 flex justify-between items-center bg-gray-50 p-4 rounded text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                            <span>Status:</span>
                            <select
                                className="border rounded px-2 py-1 text-sm font-bold"
                                value={editingItem.status || 'active'}
                                onChange={e => setEditingItem({ ...editingItem, status: e.target.value })}
                            >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setEditingItem(null)} className="px-4 py-2 hover:bg-gray-200 rounded">Cancel</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded font-medium flex items-center gap-2">
                                <Check size={18} /> Save Analysis
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Master Analysis Catalogue</h2>
                    <p className="text-sm text-gray-500">Manage all test parameters available in the system.</p>
                </div>
                <button
                    onClick={() => setEditingItem({ code: '', name: '', categoryId: '', units: '', status: 'active', _isNew: true })}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700"
                >
                    <Plus size={18} /> Add Analysis
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-4 mb-6 bg-white p-4 rounded border shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input
                        className="w-full pl-10 p-2 border rounded"
                        placeholder="Search by code or name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="border p-2 rounded w-48"
                    value={filterCat}
                    onChange={e => setFilterCat(e.target.value)}
                >
                    <option value="all">All Categories</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <div className="bg-white rounded border overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-4 font-semibold text-gray-600">Code</th>
                            <th className="p-4 font-semibold text-gray-600">Name</th>
                            <th className="p-4 font-semibold text-gray-600">Category</th>
                            <th className="p-4 font-semibold text-gray-600">Units</th>
                            <th className="p-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filtered.map(a => (
                            <tr key={a.code} className="hover:bg-blue-50/50 transition-colors group">
                                <td className="p-4 font-mono font-bold text-blue-700">{a.code}</td>
                                <td className="p-4 font-medium text-gray-800">{a.name}</td>
                                <td className="p-4 text-sm text-gray-500">
                                    <span className="px-2 py-1 bg-gray-100 rounded-full text-xs border">
                                        {categories.find(c => c.id === a.categoryId)?.name || a.categoryId}
                                    </span>
                                </td>
                                <td className="p-4 text-sm font-mono text-gray-600">{a.units}</td>
                                <td className="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingItem({ ...a, _isNew: false })} className="text-gray-400 hover:text-blue-600 mr-3">
                                        <Edit2 size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(a.code)} className="text-gray-400 hover:text-red-600">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="p-4 text-sm text-gray-500 text-center border-t">
                    Showing {filtered.length} of {analyses.length} analyses
                </div>
            </div>
        </div>
    );
};

export default AnalysisManager;
