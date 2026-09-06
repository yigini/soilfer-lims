import { useAnalysisNames } from '../context/AnalysisCatalogueContext';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Filter, Search, CheckCircle, AlertCircle, FlaskConical, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { useLanguage } from '../context/LanguageContext';

const DataSheet = () => {
    const getAnalysisDisplayName = useAnalysisNames();
    const { user } = useAuth();
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const [workItems, setWorkItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterAnalysis, setFilterAnalysis] = useState('');
    const [filterSample, setFilterSample] = useState('');
    const [inputs, setInputs] = useState({}); // { [itemId]: value }

    // Fetch Unique Analysis Types for Filter
    const [analysisTypes, setAnalysisTypes] = useState([]);

    useEffect(() => {
        fetchWork();
    }, []);

    const fetchWork = async () => {
        setLoading(true);
        try {
            // Fetch all assigned work. Controller filters by Role.
            const res = await axios.get('/api/work?limit=500');
            let data = res.data.data || [];

            // If Manager/Admin, we might get everything. The View should arguably perform additional client-side filtering 
            // if we want "My Lab's Work".
            // For now, assume API scoped it correctly.

            // Filter out completed if we want only pending? User might want to correct completed ones.
            // Let's keep all but sort by Pending.
            data.sort((a, b) => (a.status === 'COMPLETED' ? 1 : -1));

            setWorkItems(data);

            // Extract Unique Analyses
            const types = [...new Set(data.map(i => i.analysis))].sort();
            setAnalysisTypes(types);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (id, val) => {
        setInputs(prev => ({ ...prev, [id]: val }));
    };

    const handleSaveRow = async (item) => {
        const val = inputs[item.id];
        if (val === undefined || val === '') return; // Nothing to save

        try {
            await axios.put(`/api/work/${item.id}/status`, {
                status: 'COMPLETED',
                result: val
            });
            // Update local state to reflect success immediately
            setWorkItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'COMPLETED', result: val } : i));
            // Maybe clear input or keep it? Keeping it shows what was entered.
        } catch (e) {
            showDialog({ title: 'Save Failed', message: e.message, type: 'error' });
        }
    };

    const handleBatchSave = async () => {
        // Find all dirty inputs
        const promises = Object.entries(inputs).map(async ([id, val]) => {
            const item = workItems.find(i => i.id === id);
            if (item && val !== '' && val !== item.result) {
                return axios.put(`/api/work/${id}/status`, {
                    status: 'COMPLETED',
                    result: val
                }).then(() => {
                    setWorkItems(prev => prev.map(i => i.id === id ? { ...i, status: 'COMPLETED', result: val } : i));
                }); // Fire and forget (await all later)
            }
        });

        try {
            await Promise.all(promises);
            showDialog({ title: 'Success', message: 'Batch save completed!', type: 'success' });
            // Refresh logic handled optimistically above
            setInputs({}); // Clear inputs on full batch save?
        } catch (e) {
            showDialog({ title: 'Partial Failure', message: 'Some items failed to save.', type: 'error' });
            fetchWork(); // Re-fetch to ensure consistency
        }
    };

    // Filter Logic
    const filteredItems = workItems.filter(item => {
        const matchAna = filterAnalysis ? item.analysis === filterAnalysis : true;
        const matchSamp = filterSample ? (item.labId || '').toLowerCase().includes(filterSample.toLowerCase()) : true;
        return matchAna && matchSamp;
    });

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <ClipboardList className="text-blue-600 dark:text-blue-400" /> Data Sheet Entry
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Batch result entry for assigned analysis tasks.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleBatchSave}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700 font-bold flex items-center gap-2 transition-transform transform active:scale-95"
                    >
                        <Save size={18} /> Save Changes
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card-base p-4 rounded-lg shadow-sm border mb-6 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                    <Filter size={18} /> Filters:
                </div>

                <select
                    value={filterAnalysis}
                    onChange={e => setFilterAnalysis(e.target.value)}
                    className="input-base border rounded px-3 py-2 text-sm transition-colors"
                >
                    <option value="">All Analyses</option>
                    {analysisTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400 dark:text-gray-500" size={16} />
                    <input
                        type="text"
                        placeholder="Search Lab ID..."
                        value={filterSample}
                        onChange={e => setFilterSample(e.target.value)}
                        className="input-base pl-9 pr-4 py-2 border rounded text-sm w-48 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 outline-none"
                    />
                </div>

                <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
                    Showing {filteredItems.length} tasks
                </div>
            </div>

            {/* Batch Entry Table */}
            <div className="card-base rounded-xl shadow border flex-1 overflow-hidden flex flex-col">
                <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm uppercase tracking-wider border-b dark:border-gray-600">Lab ID</th>
                                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm uppercase tracking-wider border-b dark:border-gray-600">Analysis</th>
                                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm uppercase tracking-wider border-b dark:border-gray-600">Status</th>
                                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm uppercase tracking-wider border-b dark:border-gray-600 w-48">Result Value</th>
                                <th className="px-6 py-4 font-semibold text-gray-600 dark:text-gray-300 text-sm uppercase tracking-wider border-b dark:border-gray-600 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredItems.map(item => (
                                <tr key={item.id} className={`group transition-colors ${item.status === 'COMPLETED' ? 'bg-gray-50/50 dark:bg-gray-800/50' : 'hover:bg-blue-50/30 dark:hover:bg-blue-900/20'}`}>
                                    <td className="px-6 py-3 font-mono text-gray-700 dark:text-gray-300 font-medium">{item.labId}</td>
                                    <td className="px-6 py-3 font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <div className="w-1.5 h-6 bg-blue-500 dark:bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                        {getAnalysisDisplayName(item.analysis, item.analysisName)}
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${item.status === 'COMPLETED' ? 'bg-green-100 text-green-700 border-green-200' :
                                            item.status === 'ASSIGNED' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">
                                        <input
                                            type="text"
                                            value={inputs[item.id] !== undefined ? inputs[item.id] : (item.result || '')}
                                            onChange={e => handleInputChange(item.id, e.target.value)}
                                            placeholder="Enter result..."
                                            className={`input-base w-full border rounded px-3 py-2 text-sm focus:ring-2 outline-none transition-all ${item.status === 'COMPLETED' ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-transparent' : 'border-gray-300 dark:border-gray-600 focus:ring-blue-200 dark:focus:ring-blue-400 focus:border-blue-400 dark:focus:border-blue-500 font-bold'
                                                }`}
                                        />
                                    </td>
                                    <td className="px-6 py-3 text-right">
                                        {((inputs[item.id] && inputs[item.id] !== item.result) || (item.status !== 'COMPLETED')) && (
                                            <button
                                                onClick={() => handleSaveRow(item)}
                                                className="text-blue-600 hover:text-blue-800 font-medium text-sm px-3 py-1 hover:bg-blue-50 rounded transition-colors"
                                            >
                                                Save
                                            </button>
                                        )}
                                        {item.status === 'COMPLETED' && !inputs[item.id] && (
                                            <span className="text-green-600 flex items-center justify-end gap-1 text-sm">
                                                <CheckCircle size={14} /> Saved
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 bg-gray-50/30">
                                        <div className="flex flex-col items-center gap-2">
                                            <FlaskConical size={32} className="opacity-20" />
                                            <p>No work items found matching filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DataSheet;
