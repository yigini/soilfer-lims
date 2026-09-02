import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, X, Layers, FlaskConical, AlertTriangle } from 'lucide-react';
import { useDialog } from '../../context/DialogContext';

const GroupManager = () => {
    const { showDialog } = useDialog();
    const [groups, setGroups] = useState([]);
    const [analyses, setAnalyses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingGroup, setEditingGroup] = useState(null);

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
            showDialog({ title: 'Save Failed', message: e.response?.data?.error || 'Failed to save package', type: 'error' });
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete package "${name || id}"?`)) return;
        try {
            await axios.delete(`/api/config/groups/${id}`);
            fetchData();
        } catch (e) {
            showDialog({ title: 'Delete Failed', message: 'Failed to delete package.', type: 'error' });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading Analysis Packages...</p>
            </div>
        );
    }

    if (editingGroup) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-3xl mx-auto space-y-6 font-sans animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-xl">
                            <Layers size={20} />
                        </div>
                        <div>
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                                Package Definition
                            </span>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">
                                {editingGroup._isNew ? 'New Analysis Package' : `Edit Package: ${editingGroup.name}`}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={() => setEditingGroup(null)}
                        className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-bold transition-colors"
                    >
                        Cancel
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                                Package ID (Code)
                            </label>
                            <input
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm font-bold text-gray-900 dark:text-white uppercase outline-none focus:bg-white dark:focus:bg-gray-950 focus:border-emerald-500"
                                value={editingGroup.id}
                                disabled={!editingGroup._isNew}
                                onChange={e => setEditingGroup({ ...editingGroup, id: e.target.value.toUpperCase() })}
                                placeholder="e.g. BASIC_SOIL, FERTILITY_PRO"
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                                Package Display Name
                            </label>
                            <input
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                                value={editingGroup.name}
                                onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                                placeholder="e.g. Routine Soil Fertility & Texture Suite"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
                            Select Included Analytical Parameters ({editingGroup.analyses?.length || 0})
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto border border-gray-200 dark:border-gray-700 p-3 rounded-2xl bg-gray-50 dark:bg-gray-900/50">
                            {analyses.map(a => {
                                const isChecked = editingGroup.analyses?.includes(a.code);
                                return (
                                    <label
                                        key={a.code}
                                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                            isChecked
                                                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 shadow-sm'
                                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={e => {
                                                const cur = editingGroup.analyses || [];
                                                if (e.target.checked) {
                                                    setEditingGroup(prev => ({ ...prev, analyses: [...cur, a.code] }));
                                                } else {
                                                    setEditingGroup(prev => ({ ...prev, analyses: cur.filter(x => x !== a.code) }));
                                                }
                                            }}
                                            className="w-4 h-4 mt-0.5 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-bold text-xs tracking-wide">{a.code}</div>
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{a.name}</div>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
                        <button
                            onClick={() => setEditingGroup(null)}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm shadow-emerald-700/20 text-xs transition-all active:scale-95"
                        >
                            <Check size={16} /> Save Package
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 font-sans w-full min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Analysis Packages & Suites</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pre-configured bundles of analyses for streamlined sample intake and job dispatch.</p>
                </div>
                <button
                    onClick={() => setEditingGroup({ id: '', name: '', analyses: [], _isNew: true })}
                    className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-md shadow-emerald-700/20 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
                >
                    <Plus size={16} /> Create Analysis Package
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {groups.map(g => (
                    <div key={g.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                        <div>
                            <div className="flex justify-between items-start mb-3">
                                <div className="min-w-0 flex-1 pr-2">
                                    <h3 className="font-bold text-sm text-gray-900 dark:text-white truncate">{g.name}</h3>
                                    <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-md border border-slate-200 dark:border-slate-700 mt-1">
                                        {g.id}
                                    </span>
                                </div>
                                <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button
                                        onClick={() => setEditingGroup({ ...g, _isNew: false })}
                                        className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                        title="Edit Package"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(g.id, g.name)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                        title="Delete Package"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
                                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                    {g.analyses?.length || 0} Analyses Included
                                </div>
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-hidden">
                                    {g.analyses?.slice(0, 8).map(code => (
                                        <span key={code} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[11px] font-semibold rounded-md border border-gray-200 dark:border-gray-600">
                                            {code}
                                        </span>
                                    ))}
                                    {g.analyses?.length > 8 && (
                                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold rounded-md border border-emerald-200 dark:border-emerald-800">
                                            +{g.analyses.length - 8} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GroupManager;

