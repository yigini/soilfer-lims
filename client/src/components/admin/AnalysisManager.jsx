import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, Search, Filter, FlaskConical, BookOpen, Layers, X, Star } from 'lucide-react';

const AnalysisManager = () => {
    const [analyses, setAnalyses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [methodologies, setMethodologies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCat, setFilterCat] = useState('all');
    const [error, setError] = useState(null);

    // Methodology modal / drawer state
    const [activeMethodAnalysis, setActiveMethodAnalysis] = useState(null);
    const [editingMethod, setEditingMethod] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [aRes, cRes, mRes] = await Promise.all([
                axios.get('/api/config/analyses'),
                axios.get('/api/config/categories'),
                axios.get('/api/config/methodologies').catch(() => ({ data: [] }))
            ]);
            setAnalyses(aRes.data);
            setCategories(cRes.data);
            setMethodologies(mRes.data || []);
        } catch (e) {
            console.error('Failed to load analysis config:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleStartNew = () => {
        setEditingItem({
            _isNew: true,
            code: '',
            name: '',
            categoryId: categories[0]?.id || '',
            units: 'mg/kg',
            status: 'active',
            description: '',
            validation: { min: 0, max: 1000, decimalPlaces: 2 }
        });
        setError(null);
    };

    const handleSave = async () => {
        setError(null);
        try {
            const payload = {
                ...editingItem,
                validation: editingItem.validation || null
            };

            if (editingItem._isNew) {
                await axios.post('/api/config/analyses', payload);
            } else {
                await axios.put('/api/config/analyses/' + editingItem.code, payload);
            }
            fetchData();
            setEditingItem(null);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to save analysis');
        }
    };

    const handleDelete = async (code, name) => {
        if (!confirm(`Delete analysis "${name}" (${code})? This will remove its configuration.`)) return;
        setError(null);
        try {
            await axios.delete('/api/config/analyses/' + code);
            fetchData();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to delete');
        }
    };

    // Methodology handlers
    const handleSaveMethodology = async () => {
        if (!editingMethod || !activeMethodAnalysis) return;
        setError(null);
        try {
            if (editingMethod._isNew) {
                await axios.post('/api/config/methodologies', {
                    analysisCode: activeMethodAnalysis.code,
                    name: editingMethod.name,
                    standard: editingMethod.standard || null,
                    isDefault: editingMethod.isDefault || false
                });
            } else {
                await axios.put('/api/config/methodologies/' + editingMethod.id, {
                    name: editingMethod.name,
                    standard: editingMethod.standard || null,
                    isDefault: editingMethod.isDefault || false
                });
            }
            fetchData();
            setEditingMethod(null);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to save methodology');
        }
    };

    const handleDeleteMethodology = async (id, name) => {
        if (!confirm(`Delete methodology "${name}"?`)) return;
        try {
            await axios.delete('/api/config/methodologies/' + id);
            fetchData();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to delete methodology');
        }
    };

    const filtered = analyses.filter(a => {
        const matchesSearch =
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.units && a.units.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCat = filterCat === 'all' || a.categoryId === filterCat;
        return matchesSearch && matchesCat;
    });

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Analysis Catalogue...</div>;

    // ─── MODAL: Edit/Add Analysis ───
    if (editingItem) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-3xl mx-auto space-y-6 animate-fade-in">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                    <div>
                        <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs font-bold rounded-lg uppercase tracking-wider">
                            Analysis Definition
                        </span>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white mt-1">
                            {editingItem._isNew ? 'New Laboratory Analysis' : 'Edit: ' + editingItem.name}
                        </h2>
                    </div>
                    <button
                        onClick={() => { setEditingItem(null); setError(null); }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm font-semibold"
                    >
                        Cancel
                    </button>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-300 text-sm font-medium">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Analysis Code */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                            Analysis Code / Parameter ID
                        </label>
                        <input
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-mono text-sm font-bold text-gray-800 dark:text-gray-100 uppercase"
                            value={editingItem.code}
                            disabled={!editingItem._isNew}
                            onChange={e => setEditingItem({ ...editingItem, code: e.target.value.toUpperCase() })}
                            placeholder="e.g. PH_H2O, SOC, TN, P_OLSEN"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">Unique analytical code for workbench and results.</p>
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                            Display Name
                        </label>
                        <input
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-800 dark:text-gray-100"
                            value={editingItem.name}
                            onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                            placeholder="e.g. Soil pH (1:2.5 Water)"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">Full parameter name for reports and workbenches.</p>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                            Property Category
                        </label>
                        <select
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-800 dark:text-gray-100"
                            value={editingItem.categoryId || ''}
                            onChange={e => setEditingItem({ ...editingItem, categoryId: e.target.value })}
                        >
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Units */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                            Reporting Unit
                        </label>
                        <input
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono text-sm text-gray-800 dark:text-gray-100"
                            value={editingItem.units || ''}
                            onChange={e => setEditingItem({ ...editingItem, units: e.target.value })}
                            placeholder="e.g. g/kg, mg/kg, cmol(+)/kg, %, dS/m"
                        />
                    </div>

                    {/* Validation Range */}
                    <div className="col-span-1 md:col-span-2 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700 grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Min Acceptable</label>
                            <input
                                type="number"
                                step="any"
                                className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono"
                                value={editingItem.validation?.min ?? ''}
                                onChange={e => setEditingItem({
                                    ...editingItem,
                                    validation: { ...editingItem.validation, min: e.target.value === '' ? null : Number(e.target.value) }
                                })}
                                placeholder="0"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Max Acceptable</label>
                            <input
                                type="number"
                                step="any"
                                className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono"
                                value={editingItem.validation?.max ?? ''}
                                onChange={e => setEditingItem({
                                    ...editingItem,
                                    validation: { ...editingItem.validation, max: e.target.value === '' ? null : Number(e.target.value) }
                                })}
                                placeholder="1000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">Decimal Places</label>
                            <input
                                type="number"
                                min="0"
                                max="4"
                                className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-mono"
                                value={editingItem.validation?.decimalPlaces ?? 2}
                                onChange={e => setEditingItem({
                                    ...editingItem,
                                    validation: { ...editingItem.validation, decimalPlaces: parseInt(e.target.value, 10) || 0 }
                                })}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                            Description / Analytical Principles
                        </label>
                        <textarea
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-100 h-20"
                            value={editingItem.description || ''}
                            onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                            placeholder="Analytical summary, standard reference, or QA instructions..."
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500">Status:</span>
                        <select
                            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-2.5 py-1 text-xs font-bold"
                            value={editingItem.status || 'active'}
                            onChange={e => setEditingItem({ ...editingItem, status: e.target.value })}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setEditingItem(null); setError(null); }}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all text-sm"
                        >
                            <Check size={16} /> Save Analysis
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white">Master Analysis Catalogue</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Laboratory physical, chemical, and nutrient test parameters & standard methods.</p>
                </div>
                <button
                    onClick={handleStartNew}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl shadow-sm text-xs font-bold transition-all"
                >
                    <Plus size={16} /> Add Analysis Parameter
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder="Search by code, parameter name, or units..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-2 rounded-xl text-xs text-gray-700 dark:text-gray-300 font-medium sm:w-56"
                    value={filterCat}
                    onChange={e => setFilterCat(e.target.value)}
                >
                    <option value="all">All Categories ({analyses.length})</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 uppercase tracking-wider text-gray-500 font-bold">
                            <tr>
                                <th className="p-3.5">Code</th>
                                <th className="p-3.5">Parameter Name</th>
                                <th className="p-3.5">Category</th>
                                <th className="p-3.5">Units</th>
                                <th className="p-3.5">Methods</th>
                                <th className="p-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                            {filtered.map(a => {
                                const methods = methodologies.filter(m => m.analysisCode === a.code);
                                const defaultMethod = methods.find(m => m.isDefault) || methods[0];

                                return (
                                    <tr key={a.code} className="hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors group">
                                        <td className="p-3.5 font-mono font-bold text-blue-700 dark:text-blue-400">
                                            {a.code}
                                        </td>
                                        <td className="p-3.5">
                                            <div className="font-semibold text-gray-900 dark:text-gray-100">{a.name}</div>
                                            {a.description && (
                                                <div className="text-[11px] text-gray-400 truncate max-w-xs">{a.description}</div>
                                            )}
                                        </td>
                                        <td className="p-3.5">
                                            <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-[11px] font-medium border border-gray-200 dark:border-gray-600">
                                                {categories.find(c => c.id === a.categoryId)?.name || a.categoryId || '—'}
                                            </span>
                                        </td>
                                        <td className="p-3.5 font-mono text-gray-600 dark:text-gray-300 font-semibold">
                                            {a.units || '—'}
                                        </td>
                                        <td className="p-3.5">
                                            <button
                                                onClick={() => setActiveMethodAnalysis(a)}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-[11px]"
                                            >
                                                <FlaskConical size={12} />
                                                <span>{methods.length > 0 ? (defaultMethod?.name || `${methods.length} methods`) : 'Configure Methods'}</span>
                                            </button>
                                        </td>
                                        <td className="p-3.5 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100">
                                                <button
                                                    onClick={() => setEditingItem({ ...a, _isNew: false })}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors"
                                                    title="Edit Analysis"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(a.code, a.name)}
                                                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                                                    title="Delete Analysis"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 text-xs text-gray-500 text-center border-t border-gray-100 dark:border-gray-700">
                    Showing {filtered.length} of {analyses.length} standard analyses
                </div>
            </div>

            {/* ─── METHODOLOGIES DRAWER / MODAL ─── */}
            {activeMethodAnalysis && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl p-6 space-y-5 animate-scale-up">
                        <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-700 pb-3">
                            <div>
                                <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <FlaskConical className="text-emerald-600" size={18} />
                                    Standard Methodologies for {activeMethodAnalysis.name}
                                </h3>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">Code: {activeMethodAnalysis.code}</p>
                            </div>
                            <button
                                onClick={() => { setActiveMethodAnalysis(null); setEditingMethod(null); }}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Method list */}
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {methodologies.filter(m => m.analysisCode === activeMethodAnalysis.code).map(m => (
                                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                    <div>
                                        <div className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-2">
                                            {m.name}
                                            {m.isDefault && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-black rounded-full flex items-center gap-1">
                                                    <Star size={10} className="fill-amber-500 text-amber-500" /> Default
                                                </span>
                                            )}
                                        </div>
                                        {m.standard && (
                                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">Standard: {m.standard}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setEditingMethod(m)}
                                            className="text-xs text-blue-600 hover:underline font-semibold"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMethodology(m.id, m.name)}
                                            className="text-xs text-red-600 hover:underline font-semibold"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {methodologies.filter(m => m.analysisCode === activeMethodAnalysis.code).length === 0 && (
                                <p className="text-xs text-gray-400 text-center py-4">No specific methodologies recorded yet. Default analytical method applies.</p>
                            )}
                        </div>

                        {/* Add / Edit Form */}
                        {editingMethod ? (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/70 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">
                                    {editingMethod._isNew ? 'Add Method' : 'Edit Method'}
                                </h4>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Method Name</label>
                                    <input
                                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs bg-white dark:bg-gray-800"
                                        value={editingMethod.name || ''}
                                        onChange={e => setEditingMethod({ ...editingMethod, name: e.target.value })}
                                        placeholder="e.g. Walkley-Black Wet Oxidation"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 mb-1">Standard / Citation (Optional)</label>
                                    <input
                                        className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs bg-white dark:bg-gray-800 font-mono"
                                        value={editingMethod.standard || ''}
                                        onChange={e => setEditingMethod({ ...editingMethod, standard: e.target.value })}
                                        placeholder="e.g. ISO 14235:1998"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isDefaultMethod"
                                        checked={editingMethod.isDefault || false}
                                        onChange={e => setEditingMethod({ ...editingMethod, isDefault: e.target.checked })}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <label htmlFor="isDefaultMethod" className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                        Set as Laboratory Default Method
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        onClick={() => setEditingMethod(null)}
                                        className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveMethodology}
                                        className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 shadow-sm"
                                    >
                                        Save Method
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setEditingMethod({ _isNew: true, name: '', standard: '', isDefault: false })}
                                className="w-full py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-500 hover:text-emerald-600 hover:border-emerald-300 dark:hover:border-emerald-700 flex items-center justify-center gap-2 transition-colors"
                            >
                                <Plus size={14} /> Add Analytical Methodology
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisManager;
