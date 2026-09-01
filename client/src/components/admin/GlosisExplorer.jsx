import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, Globe, BookOpen, ExternalLink, Copy, Check, Filter, Layers, Info } from 'lucide-react';

const GlosisExplorer = () => {
    const [catalog, setCatalog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAttr, setSelectedAttr] = useState('all');
    const [copiedItem, setCopiedItem] = useState(null);

    useEffect(() => {
        fetchCatalog();
    }, []);

    const fetchCatalog = async () => {
        try {
            const res = await axios.get('/api/config/glosis/catalog');
            setCatalog(res.data);
        } catch (err) {
            console.error('Failed to load GloSIS catalog:', err);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedItem(id);
        setTimeout(() => setCopiedItem(null), 2000);
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading GloSIS Ontology Catalog...</div>;
    }

    if (!catalog || !catalog.procedures) {
        return <div className="p-8 text-center text-gray-500">GloSIS catalog not available.</div>;
    }

    const filtered = catalog.procedures.filter(p => {
        const matchesSearch = 
            p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.attribute.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.definition.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.citation.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAttr = selectedAttr === 'all' || p.attribute === selectedAttr;
        return matchesSearch && matchesAttr;
    });

    return (
        <div className="space-y-6">
            {/* Header Banner */}
            <div className="p-6 bg-gradient-to-r from-emerald-900 to-teal-900 rounded-2xl text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 bg-emerald-500/30 rounded-lg text-emerald-300">
                            <Globe size={20} />
                        </span>
                        <h2 className="text-xl font-black">GloSIS Linked Data Ontology & Procedure Codelists</h2>
                    </div>
                    <p className="text-sm text-emerald-200">
                        Official FAO Global Soil Information System (GloSIS) ontology codelist. Contains {catalog.totalProcedures} standard analytical procedures across {catalog.totalAttributes} soil properties.
                    </p>
                </div>

                <a
                    href="https://github.com/glosis-ld/glosis"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 flex-shrink-0"
                >
                    <ExternalLink size={14} /> View on GitHub
                </a>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by procedure label, attribute, standard, or citation..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-400" />
                    <select
                        value={selectedAttr}
                        onChange={(e) => setSelectedAttr(e.target.value)}
                        className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                        <option value="all">All Properties ({catalog.totalAttributes})</option>
                        {catalog.attributes.map(a => (
                            <option key={a.code} value={a.code}>{a.label} ({a.proceduresCount})</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Procedures Cards Grid */}
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Showing {filtered.length} of {catalog.totalProcedures} Procedures
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((p, idx) => (
                    <div 
                        key={idx} 
                        className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3 hover:border-emerald-500/50 transition"
                    >
                        <div className="flex justify-between items-start gap-2">
                            <div>
                                <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                                    {p.attribute}
                                </span>
                                <h4 className="font-mono text-sm font-bold text-gray-900 dark:text-white mt-1">
                                    {p.label}
                                </h4>
                            </div>

                            <button
                                onClick={() => copyToClipboard(p.label, 'lbl-' + idx)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition flex-shrink-0"
                                title="Copy Method Label"
                            >
                                {copiedItem === ('lbl-' + idx) ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                        </div>

                        {p.definition && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-900/40 p-2.5 rounded-xl">
                                {p.definition}
                            </p>
                        )}

                        {p.citation && (
                            <div className="text-xs text-gray-400 italic flex items-start gap-1.5 pt-1">
                                <BookOpen size={13} className="flex-shrink-0 mt-0.5 text-gray-400" />
                                <span>{p.citation}</span>
                            </div>
                        )}

                        {p.reference && (
                            <div className="pt-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs">
                                <span className="text-gray-400 font-mono text-[11px] truncate max-w-[280px]">
                                    {p.reference}
                                </span>
                                <a
                                    href={p.reference}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                                >
                                    Ref <ExternalLink size={12} />
                                </a>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default GlosisExplorer;