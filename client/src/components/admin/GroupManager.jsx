import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import { useDialog } from '../../context/DialogContext';

const GroupManager = () => {
    const { showDialog } = useDialog();
    const [groups, setGroups] = useState([]);
    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingGroup, setEditingGroup] = useState(null); // null = list, {} = create, {id...} = edit

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [gRes, aRes] = await Promise.all([
                axios.get('/api/config/groups'),
                axios.get('/api/config/analyses')
            ]);
            setGroups(gRes.data);
            setAnalyses(aRes.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (editingGroup._isNew) {
                await axios.post('/api/config/groups', editingGroup);
            } else {
                await axios.put(`/api/config/groups/${editingGroup.id}`, editingGroup);
            }
            fetchData();
            setEditingGroup(null);
        } catch (e) {
            showDialog({ title: 'Save Failed', message: e.response?.data?.error || 'Failed to save', type: 'error' });
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this group?')) return;
        try {
            await axios.delete(`/api/config/groups/${id}`);
            fetchData();
        } catch (e) {
            showDialog({ title: 'Delete Failed', message: 'Failed to delete group.', type: 'error' });
        }
    };

    if (loading) return <div>Loading...</div>;

    if (editingGroup) {
        return (
            <div className="bg-white p-6 rounded shadow-sm border">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">{editingGroup._isNew ? 'Create New Group' : `Edit Group: ${editingGroup.name}`}</h2>
                    <button onClick={() => setEditingGroup(null)} className="text-gray-500 hover:text-gray-700">Cancel</button>
                </div>

                <div className="space-y-4 max-w-2xl">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-sm font-semibold mb-1">Group ID (Unique)</label>
                            <input
                                className="w-full p-2 border rounded bg-gray-50"
                                value={editingGroup.id}
                                disabled={!editingGroup._isNew}
                                onChange={e => setEditingGroup({ ...editingGroup, id: e.target.value })}
                            />
                        </div>
                        <div className="flex-[2]">
                            <label className="block text-sm font-semibold mb-1">Group Name</label>
                            <input
                                className="w-full p-2 border rounded"
                                value={editingGroup.name}
                                onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold mb-2">Included Analyses ({editingGroup.analyses.length})</label>
                        <div className="grid grid-cols-2 gap-2 h-64 overflow-y-auto border p-4 rounded bg-gray-50">
                            {analyses.map(a => (
                                <label key={a.code} className="flex items-center gap-2 p-2 bg-white border rounded cursor-pointer hover:border-blue-400">
                                    <input
                                        type="checkbox"
                                        checked={editingGroup.analyses.includes(a.code)}
                                        onChange={e => {
                                            if (e.target.checked) {
                                                setEditingGroup(prev => ({ ...prev, analyses: [...prev.analyses, a.code] }));
                                            } else {
                                                setEditingGroup(prev => ({ ...prev, analyses: prev.analyses.filter(x => x !== a.code) }));
                                            }
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <div>
                                        <div className="font-bold text-sm">{a.code}</div>
                                        <div className="text-xs text-gray-500 truncate">{a.name}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="pt-4 border-t flex justify-end gap-3">
                        <button onClick={() => setEditingGroup(null)} className="px-4 py-2 text-gray-600">Cancel</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded font-medium flex items-center gap-2">
                            <Check size={18} /> Save Group
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800">Analysis Groups</h2>
                <button
                    onClick={() => setEditingGroup({ id: '', name: '', analyses: [], _isNew: true })}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow-sm hover:bg-blue-700"
                >
                    <Plus size={18} /> Create Group
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {groups.map(g => (
                    <div key={g.id} className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">{g.name}</h3>
                                <code className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">{g.id}</code>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingGroup({ ...g, _isNew: false })} className="p-1 text-gray-400 hover:text-blue-600"><Edit2 size={16} /></button>
                                <button onClick={() => handleDelete(g.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{g.analyses.length} Analyses Included</div>
                            <div className="flex flex-wrap gap-1 max-h-32 overflow-hidden">
                                {g.analyses.slice(0, 10).map(code => (
                                    <span key={code} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">
                                        {code}
                                    </span>
                                ))}
                                {g.analyses.length > 10 && (
                                    <span className="px-2 py-1 bg-gray-50 text-gray-400 text-xs rounded border border-gray-100">
                                        +{g.analyses.length - 10} more
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroupManager;
