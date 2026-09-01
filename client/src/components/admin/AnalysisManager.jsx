import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Check, Search, Filter, Globe, BookOpen, ExternalLink, Info, CheckCircle2, ChevronRight, Layers } from 'lucide-react';

const AnalysisManager = () => {
    const [analyses, setAnalyses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [glosisCatalog, setGlosisCatalog] = useState(null);
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
            const [aRes, cRes, gRes] = await Promise.all([
                axios.get('/api/config/analyses'),
                axios.get('/api/config/categories'),
                axios.get('/api/config/glosis/catalog').catch(() => ({ data: null }))
            ]);
            setAnalyses(aRes.data);
            setCategories(cRes.data);
            if (gRes.data) setGlosisCatalog(gRes.data);
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
            units: 'g/kg',
            status: 'active',
            description: '',
            glosisAttribute: 'nitrogenTotal',
            methodLabel: 'TotalN_kjeldahl',
            methodDefinition: '',
            methodCitation: ''
        });
        setError(null);
    };

    const handleSelectAttribute = (attrCode) => {
        if (!glosisCatalog) return;
        const attrObj = glosisCatalog.attributes?.find(a => a.code === attrCode);
        const availableMethods = glosisCatalog.procedures?.filter(p => p.attribute === attrCode) || [];
        const firstMethod = availableMethods[0] || {};

        setEditingItem(prev => ({
            ...prev,
            code: prev._isNew ? attrCode : prev.code,
            glosisAttribute: attrCode,
            glosisUri: 'http://glosis.org/ont/glosis#' + attrCode,
            name: prev._isNew ? (attrObj?.label || attrCode) : prev.name,
            methodLabel: firstMethod.label || '',
            methodDefinition: firstMethod.definition || '',
            methodCitation: firstMethod.citation || firstMethod.reference || ''
        }));
    };

    const handleSelectMethod = (methodLabel) => {
        if (!glosisCatalog) return;
        const methodObj = glosisCatalog.procedures?.find(p => p.label === methodLabel || p.instance === methodLabel);
        if (methodObj) {
            setEditingItem(prev => ({
                ...prev,
                methodLabel: methodObj.label,
                methodDefinition: methodObj.definition || '',
                methodCitation: methodObj.citation || methodObj.reference || '',
                glosisUri: methodObj.uri
            }));
        } else {
            setEditingItem(prev => ({
                ...prev,
                methodLabel
            }));
        }
    };

    const handleSave = async () => {
        setError(null);
        try {
            if (editingItem._isNew) {
                await axios.post('/api/config/analyses', editingItem);
            } else {
                await axios.put('/api/config/analyses/' + editingItem.code, editingItem);
            }
            fetchData();
            setEditingItem(null);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to save analysis');
        }
    };

    const handleDelete = async (code, name) => {
        if (!confirm('Delete analysis "' + name + '" (' + code + ')? This will remove its definition.')) return;
        setError(null);
        try {
            await axios.delete('/api/config/analyses/' + code);
            fetchData();
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to delete');
        }
    };

    const filtered = analyses.filter(a => {
        const matchesSearch = 
            a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            a.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.methodLabel && a.methodLabel.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesCat = filterCat === 'all' || a.categoryId === filterCat;
        return matchesSearch && matchesCat;
    });

    if (loading) return <div className="p-8 text-center text-gray-500">Loading Analysis Master Table...</div>;

    // Available procedures for current attribute in modal
    const currentAttr = editingItem?.glosisAttribute || editingItem?.code;
    const availableProcedures = glosisCatalog?.procedures?.filter(p => p.attribute === currentAttr) || [];

    if (editingItem) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
                    <div>
                        <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-lg uppercase tracking-wider">
                            GloSIS Linked Data Parameter
                        </span>
                        <h2 className="text-xl font-black text-gray-900 dark:text-white mt-1">
                            {editingItem._isNew ? 'New Analysis & Method Definition' : 'Edit: ' + editingItem.name}
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
                    {/* GloSIS Attribute / Code */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center justify-between">
                            <span>Soil Property / Attribute (Code)</span>
                            <span className="text-emerald-600 dark:text-emerald-400 text-[11px] lowercase">GloSIS Ontology</span>
                        </label>
                        {glosisCatalog?.attributes ? (
                            <select
                                className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-mono text-sm font-bold text-gray-800 dark:text-gray-100"
                                value={editingItem.glosisAttribute || editingItem.code}
                                onChange={e => handleSelectAttribute(e.target.value)}
                            >
                                {glosisCatalog.attributes.map(a => (
                                    <option key={a.code} value={a.code}>{a.label} ({a.code})</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                className="w-full p-2.5 rounded-xl border font-mono text-sm bg-gray-50"
                                value={editingItem.code}
                                disabled={!editingItem._isNew}
                                onChange={e => setEditingItem({ ...editingItem, code: e.target.value })}
                            />
                        )}
                        <p className="text-[11px] text-gray-400 mt-1">Unique ontology identifier in GloSIS / LIMS.</p>
                    </div>

                    {/* Display Name */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                            Property Display Name
                        </label>
                        <input
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-800 dark:text-gray-100"
                            value={editingItem.name}
                            onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                            placeholder="e.g. Soil Organic Carbon (SOC)"
                        />
                        <p className="text-[11px] text-gray-400 mt-1">Human-readable soil parameter name.</p>
                    </div>

                    {/* Method (Label) Selector */}
                    <div className="col-span-1 md:col-span-2 p-5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                <Globe size={14} /> Analytical Method (GloSIS Label)
                            </label>
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                                {availableProcedures.length} Standard Methods Available
                            </span>
                        </div>

                        {availableProcedures.length > 0 ? (
                            <select
                                className="w-full p-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 font-mono text-sm font-bold text-gray-900 dark:text-white"
                                value={editingItem.methodLabel || ''}
                                onChange={e => handleSelectMethod(e.target.value)}
                            >
                                <option value="">Select standard procedure...</option>
                                {availableProcedures.map((p, idx) => (
                                    <option key={idx} value={p.label}>
                                        {p.label} — {p.definition ? p.definition.substring(0, 70) + '...' : ''}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                className="w-full p-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-gray-800 font-mono text-sm"
                                value={editingItem.methodLabel || ''}
                                onChange={e => setEditingItem({ ...editingItem, methodLabel: e.target.value })}
                                placeholder="e.g. OrgC_wc-cro3-walkleyblack"
                            />
                        )}

                        {/* Selected Method Details Box */}
                        {editingItem.methodDefinition && (
                            <div className="text-xs text-emerald-900 dark:text-emerald-200 bg-white dark:bg-gray-900/60 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/40 space-y-2">
                                <div>
                                    <span className="font-bold">Procedure Definition: </span>
                                    <span>{editingItem.methodDefinition}</span>
                                </div>
                                {editingItem.methodCitation && (
                                    <div className="text-emerald-700 dark:text-emerald-400 italic text-[11px] flex items-center gap-1.5">
                                        <BookOpen size={12} className="flex-shrink-0" />
                                        <span>{editingItem.methodCitation}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                            Category
                        </label>
                        <select
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold"
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
                            Units
                        </label>
                        <input
                            className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold"
                            value={editingItem.units || ''}
                            onChange={e => setEditingItem({ ...editingItem, units: e.target.value })}
                            placeholder="e.g. g/kg, %, mg/kg, dS/m"
                        />
                    </div>

                    {/* Description */}
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                            Description / Analytical Notes
                        </label>
                        <textarea
                            className="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                            rows={3}
                            value={editingItem.description || ''}
                            onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                            placeholder="Notes on preparation, reagents, or ISO standard compliance..."
                        />
                    </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 pt-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">Status:</span>
                        <select
                            className="border rounded-lg px-2.5 py-1 text-xs font-bold bg-white dark:bg-gray-800"
                            value={editingItem.status || 'active'}
                            onChange={e => setEditingItem({ ...editingItem, status: e.target.value })}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => setEditingItem(null)} 
                            className="px-4 py-2 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave} 
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition"
                        >
                            <Check size={16} /> Save Analysis & Method
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 flex-1 min-w-0">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search attribute, property name, or method label..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>

                    <select
                        value={filterCat}
                        onChange={(e) => setFilterCat(e.target.value)}
                        className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                        <option value="all">All Categories</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <button
                    onClick={handleStartNew}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition whitespace-nowrap"
                >
                    <Plus size={16} /> Add Analysis
                </button>
            </div>

            {/* Analysis Master Table */}
            <div className="overflow-x-auto w-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <table className="w-full text-left border-collapse text-xs min-w-[740px]">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 text-[11px] uppercase tracking-wider text-gray-500">
                            <th className="py-3 px-3.5 font-bold whitespace-nowrap">Attribute (Code)</th>
                            <th className="py-3 px-3.5 font-bold whitespace-nowrap min-w-[140px]">Property Name</th>
                            <th className="py-3 px-3.5 font-bold whitespace-nowrap min-w-[180px]">Method (Label)</th>
                            <th className="py-3 px-3.5 font-bold whitespace-nowrap">Category</th>
                            <th className="py-3 px-3.5 font-bold whitespace-nowrap text-center">Units</th>
                            <th className="py-3 px-3.5 font-bold text-center whitespace-nowrap">Status</th>
                            <th className="py-3 px-3.5 font-bold text-right whitespace-nowrap">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
                        {filtered.map(a => (
                            <tr key={a.code} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/30 transition">
                                <td className="py-3 px-3.5 font-mono font-bold text-gray-900 dark:text-white text-xs whitespace-nowrap">
                                    {a.code}
                                </td>
                                <td className="py-3 px-3.5 font-bold text-gray-800 dark:text-gray-200">
                                    {a.name}
                                </td>
                                <td className="py-3 px-3.5">
                                    {a.methodLabel ? (
                                        <div className="flex flex-col">
                                            <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                                <Globe size={13} className="text-emerald-500 flex-shrink-0" />
                                                {a.methodLabel}
                                            </span>
                                            {a.methodDefinition && (
                                                <span className="text-[11px] text-gray-400 truncate max-w-xs" title={a.methodDefinition}>
                                                    {a.methodDefinition}
                                                </span>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-gray-400 italic">Standard</span>
                                    )}
                                </td>
                                <td className="py-3 px-3.5 whitespace-nowrap">
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                        {categories.find(c => c.id === a.categoryId)?.name || a.categoryId || 'General'}
                                    </span>
                                </td>
                                <td className="py-3 px-3.5 font-medium text-gray-600 dark:text-gray-300 text-xs text-center whitespace-nowrap">
                                    {a.units || '—'}
                                </td>
                                <td className="py-3 px-3.5 text-center whitespace-nowrap">
                                    <span className={`inline-block w-2 h-2 rounded-full ${a.status === 'inactive' ? 'bg-red-400' : 'bg-green-500'}`} />
                                </td>
                                <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <button
                                            onClick={() => setEditingItem({ ...a, _isNew: false })}
                                            className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition"
                                            title="Edit Analysis & Method"
                                        >
                                            <Edit2 size={15} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(a.code, a.name)}
                                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                                            title="Delete Analysis"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AnalysisManager;
