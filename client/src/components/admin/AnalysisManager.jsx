import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, Search, FlaskConical, X, Star, AlertTriangle, Layers, Tag, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

const AnalysisManager = () => {
    const { t } = useLanguage();
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
            (a.name && a.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.code && a.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.units && a.units.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCat = filterCat === 'all' || a.categoryId === filterCat;
        return matchesSearch && matchesCat;
    });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
                <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading Master Analysis Catalogue...</p>
            </div>
        );
    }

    // ─── MODAL: Edit/Add Analysis ───
    if (editingItem) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-4xl mx-auto space-y-6 font-sans animate-in fade-in duration-200">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-xl">
                            <FlaskConical size={20} />
                        </div>
                        <div>
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                                Parameter Specification
                            </span>
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">
                                {editingItem._isNew ? 'New Laboratory Analysis Parameter' : `Edit: ${editingItem.name}`}
                            </h2>
                        </div>
                    </div>
                    <button
                        onClick={() => { setEditingItem(null); setError(null); }}
                        className="px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-bold transition-colors"
                    >
                        Cancel
                    </button>
                </div>

                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-xl text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
                        <AlertTriangle size={16} className="flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Analysis Code */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                            Parameter Code / ID <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-sm font-bold text-gray-900 dark:text-white uppercase focus:bg-white dark:focus:bg-gray-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                            value={editingItem.code}
                            disabled={!editingItem._isNew}
                            onChange={e => setEditingItem({ ...editingItem, code: e.target.value.toUpperCase() })}
                            placeholder="e.g. PH_H2O, SOC, TN, P_OLSEN, SAND"
                        />
                        <p className="text-[11px] text-gray-400 mt-1 font-medium">Standard analytical code used across workbenches and reports.</p>
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                            Display Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                            value={editingItem.name}
                            onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                            placeholder="e.g. Soil pH (1:2.5 H2O potentiometric)"
                        />
                        <p className="text-[11px] text-gray-400 mt-1 font-medium">Full human-readable label presented on certificates and QA sheets.</p>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                            Analytical Domain / Category
                        </label>
                        <select
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                            value={editingItem.categoryId || ''}
                            onChange={e => setEditingItem({ ...editingItem, categoryId: e.target.value })}
                        >
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                    {/* Units */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                            Reporting Unit
                        </label>
                        <input
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                            value={editingItem.units || ''}
                            onChange={e => setEditingItem({ ...editingItem, units: e.target.value })}
                            placeholder="e.g. g/kg, mg/kg, cmol(+)/kg, %, dS/m, pH units"
                        />
                        <p className="text-[11px] text-gray-400 mt-1 font-medium">Standard unit symbol automatically normalized during certificate generation.</p>
                    </div>

                    {/* Validation Range */}
                    <div className="col-span-1 md:col-span-2 p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Plausible Minimum</label>
                            <input
                                type="number"
                                step="any"
                                className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-900 dark:text-white outline-none"
                                value={editingItem.validation?.min ?? ''}
                                onChange={e => setEditingItem({
                                    ...editingItem,
                                    validation: { ...editingItem.validation, min: e.target.value === '' ? null : Number(e.target.value) }
                                })}
                                placeholder="e.g. 0"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Plausible Maximum</label>
                            <input
                                type="number"
                                step="any"
                                className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-900 dark:text-white outline-none"
                                value={editingItem.validation?.max ?? ''}
                                onChange={e => setEditingItem({
                                    ...editingItem,
                                    validation: { ...editingItem.validation, max: e.target.value === '' ? null : Number(e.target.value) }
                                })}
                                placeholder="e.g. 1000"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">Display Decimals</label>
                            <input
                                type="number"
                                min="0"
                                max="4"
                                className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-medium text-gray-900 dark:text-white outline-none"
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
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5">
                            Analytical Description & Principles
                        </label>
                        <textarea
                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-800 dark:text-gray-200 h-20 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-sans"
                            value={editingItem.description || ''}
                            onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                            placeholder="Analytical summary, sample extraction ratio, instrument specifications, or QA instructions..."
                        />
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500">Status:</span>
                        <select
                            className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg px-2.5 py-1 text-xs font-bold text-gray-800 dark:text-gray-200"
                            value={editingItem.status || 'active'}
                            onChange={e => setEditingItem({ ...editingItem, status: e.target.value })}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button
                            onClick={() => { setEditingItem(null); setError(null); }}
                            className="flex-1 sm:flex-none px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm shadow-emerald-700/20 transition-all text-xs active:scale-95"
                        >
                            <Check size={16} /> Save Analysis Parameter
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 font-sans w-full min-w-0">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Master Analysis Catalogue</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Laboratory physical, chemical, and nutrient test parameters & standard methods.</p>
                </div>
                <button
                    onClick={handleStartNew}
                    className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl shadow-md shadow-emerald-700/20 text-xs font-bold transition-all active:scale-95 whitespace-nowrap"
                >
                    <Plus size={16} /> Add Analysis Parameter
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-3 text-gray-400" size={15} />
                    <input
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs font-medium text-gray-800 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-950 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        placeholder="Search by code, parameter name, description, or units..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2.5 rounded-xl text-xs text-gray-700 dark:text-gray-300 font-medium sm:w-64 focus:outline-none focus:border-emerald-500 transition-all"
                    value={filterCat}
                    onChange={e => setFilterCat(e.target.value)}
                >
                    <option value="all">All Categories ({analyses.length})</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            {/* Master Table Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="overflow-x-auto w-full">
                    <table className="w-full text-left text-xs min-w-[760px]">
                        <thead className="bg-gray-50/80 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold text-[11px]">
                            <tr>
                                <th className="py-3.5 px-4 w-[16%]">Code</th>
                                <th className="py-3.5 px-4 w-[34%]">Parameter Name</th>
                                <th className="py-3.5 px-4 w-[22%]">Category</th>
                                <th className="py-3.5 px-4 w-[10%]">Units</th>
                                <th className="py-3.5 px-4 w-[10%]">Methods</th>
                                <th className="py-3.5 px-4 w-[8%] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                            {filtered.map(a => {
                                const methods = methodologies.filter(m => m.analysisCode === a.code);
                                const defaultMethod = methods.find(m => m.isDefault) || methods[0];
                                const catName = categories.find(c => c.id === a.categoryId)?.name || a.categoryId || 'General';

                                return (
                                    <tr key={a.code} className="hover:bg-emerald-50/30 dark:hover:bg-gray-700/30 transition-colors group">
                                        {/* Code */}
                                        <td className="py-3.5 px-4 align-top">
                                            <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] border border-slate-200 dark:border-slate-700 tracking-wide font-sans">
                                                {a.code}
                                            </span>
                                        </td>

                                        {/* Parameter Name */}
                                        <td className="py-3.5 px-4 align-top">
                                            <div className="font-bold text-gray-900 dark:text-gray-100 text-xs leading-snug">
                                                {a.name}
                                            </div>
                                            {a.description && (
                                                <div className="text-[11px] text-gray-400 dark:text-gray-500 line-clamp-1 mt-0.5" title={a.description}>
                                                    {a.description}
                                                </div>
                                            )}
                                        </td>

                                        {/* Category */}
                                        <td className="py-3.5 px-4 align-top">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-gray-700/70 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 whitespace-nowrap">
                                                {catName}
                                            </span>
                                        </td>

                                        {/* Units */}
                                        <td className="py-3.5 px-4 align-top">
                                            <span className="font-semibold text-gray-700 dark:text-gray-300 text-xs">
                                                {a.units || '—'}
                                            </span>
                                        </td>

                                        {/* Methods */}
                                        <td className="py-3.5 px-4 align-top">
                                            <button
                                                onClick={() => setActiveMethodAnalysis(a)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors text-[11px] whitespace-nowrap shadow-sm"
                                                title={methods.length > 0 ? `Configured methods: ${methods.map(m => m.name).join(', ')}` : 'Click to configure standard analytical method'}
                                            >
                                                <FlaskConical size={12} />
                                                <span>{methods.length > 0 ? `${methods.length} Method${methods.length > 1 ? 's' : ''}` : 'Configure'}</span>
                                            </button>
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3.5 px-4 align-top text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    onClick={() => setEditingItem({ ...a, _isNew: false })}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-gray-700 transition-colors"
                                                    title="Edit Parameter"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(a.code, a.name)}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-gray-700 transition-colors"
                                                    title="Delete Parameter"
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

                <div className="p-3 text-xs font-medium text-gray-500 dark:text-gray-400 text-center border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                    Showing {filtered.length} of {analyses.length} standard soil analysis parameters
                </div>
            </div>

            {/* ─── METHODOLOGIES DRAWER / MODAL ─── */}
            {activeMethodAnalysis && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start border-b border-gray-100 dark:border-gray-700 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-xl">
                                    <FlaskConical size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Standard Methods for {activeMethodAnalysis.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 font-semibold mt-0.5">Parameter Code: {activeMethodAnalysis.code}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setActiveMethodAnalysis(null); setEditingMethod(null); }}
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Method list */}
                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                            {methodologies.filter(m => m.analysisCode === activeMethodAnalysis.code).map(m => (
                                <div key={m.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                                    <div>
                                        <div className="font-bold text-xs text-gray-900 dark:text-white flex items-center gap-2">
                                            {m.name}
                                            {m.isDefault && (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold rounded-full flex items-center gap-1">
                                                    <Star size={10} className="fill-amber-500 text-amber-500" /> Default
                                                </span>
                                            )}
                                        </div>
                                        {m.standard && (
                                            <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">Standard: {m.standard}</div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => setEditingMethod(m)}
                                            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-bold"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMethodology(m.id, m.name)}
                                            className="text-xs text-red-600 hover:underline font-bold"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {methodologies.filter(m => m.analysisCode === activeMethodAnalysis.code).length === 0 && (
                                <div className="text-center py-6 px-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                                    <FlaskConical className="mx-auto text-gray-400 mb-2 opacity-60" size={24} />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">No specific analytical methodologies recorded for this parameter.</p>
                                </div>
                            )}
                        </div>

                        {/* Add / Edit Form */}
                        {editingMethod ? (
                            <div className="p-4 bg-gray-50 dark:bg-gray-900/70 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-3">
                                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                    {editingMethod._isNew ? 'Add Analytical Method' : 'Edit Method'}
                                </h4>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Method Name</label>
                                    <input
                                        className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-semibold bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                                        value={editingMethod.name || ''}
                                        onChange={e => setEditingMethod({ ...editingMethod, name: e.target.value })}
                                        placeholder="e.g. Walkley-Black Wet Oxidation, Mehlich-3 Extraction"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-600 dark:text-gray-400 mb-1">Standard / Citation Reference (Optional)</label>
                                    <input
                                        className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                                        value={editingMethod.standard || ''}
                                        onChange={e => setEditingMethod({ ...editingMethod, standard: e.target.value })}
                                        placeholder="e.g. ISO 14235:1998, FAO GLOSOLAN SOP 01"
                                    />
                                </div>
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="checkbox"
                                        id="isDefaultMethod"
                                        checked={editingMethod.isDefault || false}
                                        onChange={e => setEditingMethod({ ...editingMethod, isDefault: e.target.checked })}
                                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <label htmlFor="isDefaultMethod" className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                                        Set as Laboratory Default Method
                                    </label>
                                </div>
                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        onClick={() => setEditingMethod(null)}
                                        className="px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveMethodology}
                                        className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
                                    >
                                        Save Method
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setEditingMethod({ _isNew: true, name: '', standard: '', isDefault: false })}
                                className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl text-xs font-bold text-gray-500 hover:text-emerald-700 hover:border-emerald-400 dark:hover:border-emerald-700 flex items-center justify-center gap-2 transition-all"
                            >
                                <Plus size={15} /> Add Analytical Methodology
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisManager;

