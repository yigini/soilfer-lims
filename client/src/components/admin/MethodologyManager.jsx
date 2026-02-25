import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, Search } from 'lucide-react';
import { useDialog } from '../../context/DialogContext';

const MethodologyManager = () => {
    const { showDialog } = useDialog();
    const [methods, setMethods] = useState([]);
    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState(null);
    const [filterCode, setFilterCode] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [mRes, aRes] = await Promise.all([
                axios.get('/api/config/methodologies'),
                axios.get('/api/config/analyses')
            ]);
            setMethods(mRes.data);
            setAnalyses(aRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (editingItem._isNew) {
                await axios.post('/api/config/methodologies', editingItem);
            } else {
                await axios.put(`/api/config/methodologies/${editingItem.id}`, editingItem);
            }
            fetchData();
            setEditingItem(null);
        } catch (e) {
            showDialog({ title: 'Save Failed', message: e.response?.data?.error || 'Failed to save', type: 'error' });
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete methodology "${name}"?`)) return;
        try {
            await axios.delete(`/api/config/methodologies/${id}`);
            fetchData();
        } catch (e) {
            showDialog({ title: 'Delete Failed', message: e.response?.data?.error || 'Failed to delete', type: 'error' });
        }
    };

    const filtered = methods.filter(m => filterCode === 'all' || m.analysisCode === filterCode);

    if (loading) return <div>Loading...</div>;

    if (editingItem) {
        return (
            <div className="bg-white p-6 rounded shadow-sm border max-w-2xl mx-auto">
                <h2 className="text-xl font-bold mb-6">{editingItem._isNew ? 'New Methodology' : 'Edit Methodology'}</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold mb-1">Analysis Parameter</label>
                        <select
                            className="w-full p-2 border rounded"
                            value={editingItem.analysisCode}
                            disabled={!editingItem._isNew}
                            onChange={e => setEditingItem({ ...editingItem, analysisCode: e.target.value })}
                        >
                            <option value="">Select Analysis</option>
                            {analyses.map(a => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Standard Reference</label>
                        <input
                            className="w-full p-2 border rounded"
                            placeholder="e.g. ISO 10390:2021"
                            value={editingItem.standard}
                            onChange={e => setEditingItem({ ...editingItem, standard: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1">Method Name / Description</label>
                        <input
                            className="w-full p-2 border rounded"
                            placeholder="e.g. pH in Water (1:2.5)"
                            value={editingItem.name}
                            onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            checked={editingItem.isDefault}
                            onChange={e => setEditingItem({ ...editingItem, isDefault: e.target.checked })}
                            className="w-5 h-5"
                        />
                        <span className="text-sm font-medium">Set as Default Method</span>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-gray-600">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded font-medium">Save Method</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Methodologies</h2>
                <button
                    onClick={() => setEditingItem({ name: '', standard: '', analysisCode: '', isDefault: false, _isNew: true })}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700"
                >
                    <Plus size={18} /> Add Method
                </button>
            </div>

            <div className="flex gap-4 mb-6">
                <select
                    className="border p-2 rounded w-64"
                    value={filterCode}
                    onChange={e => setFilterCode(e.target.value)}
                >
                    <option value="all">Filter by Analysis...</option>
                    {analyses.map(a => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
                </select>
            </div>

            <div className="space-y-4">
                {filtered.map(m => {
                    const analysis = analyses.find(a => a.code === m.analysisCode);
                    return (
                        <div key={m.id || m.name + m.analysisCode} className="bg-white border p-4 rounded flex justify-between items-center hover:shadow-sm">
                            <div>
                                <div className="text-sm font-bold text-gray-600 mb-1">
                                    {analysis ? `${analysis.name} (${analysis.code})` : m.analysisCode}
                                </div>
                                <div className="text-lg font-medium text-gray-900">{m.name}</div>
                                <div className="text-sm text-gray-500 font-mono">{m.standard}</div>
                            </div>
                            <div className="flex items-center gap-4">
                                {m.isDefault && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full border border-green-200">Default</span>}
                                <button onClick={() => setEditingItem({ ...m, _isNew: false })} className="text-gray-400 hover:text-blue-600">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(m.id, m.name)} className="text-gray-400 hover:text-red-600">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MethodologyManager;
