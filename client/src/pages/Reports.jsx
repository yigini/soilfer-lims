import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { generateCSV, generateXLS, generatePDF } from '../utils/reportUtils';
import { FileText, Table, FileSpreadsheet, History, Download, ShieldCheck, AlertCircle } from 'lucide-react';

const Reports = () => {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('generate');
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);

    // Filters
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [includeUnapproved, setIncludeUnapproved] = useState(false);

    // Sign-off
    const [signOffName, setSignOffName] = useState(user?.name || '');
    const [signOffReason, setSignOffReason] = useState('');
    const [consentChecked, setConsentChecked] = useState(false);

    useEffect(() => {
        if (user) {
            fetchProjects();
            // Default Name
            setSignOffName(user.name || '');
        }
    }, [user]);

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab]);

    const fetchProjects = async () => {
        try {
            const res = await axios.get('/api/projects');
            setProjects(res.data || []);
        } catch (e) { console.error(e); }
    };

    const fetchHistory = async () => {
        try {
            const res = await axios.get('/api/exports/history');
            setHistory(res.data);
        } catch (e) { console.error(e); }
    };

    const handleExport = async (format) => {
        if (!consentChecked) {
            alert("You must confirm that this export is authorized.");
            return;
        }
        if (!signOffName) {
            alert("Please enter your name for the signature.");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                type: 'WET_CHEM', // Default for now
                project: selectedProject,
                startDate,
                endDate,
                includeUnapproved,
                signOffName,
                signOffReason,
                signOffRole: user.role
            };

            const res = await axios.post('/api/exports/data', payload);
            const { data, columns, meta } = res.data;

            if (data.length === 0) {
                alert("No records found for the selected criteria.");
                setLoading(false);
                return;
            }

            const filename = `SOILFER_EXPORT_${meta.exportId}.${format.toLowerCase()}`;

            if (format === 'CSV') generateCSV(data, columns, meta, filename);
            if (format === 'XLS') generateXLS(data, columns, meta, filename);
            if (format === 'PDF') generatePDF(data, columns, meta, filename);

            // Refresh history if active
            if (activeTab === 'history') fetchHistory();

        } catch (e) {
            alert('Export Failed: ' + (e.response?.data?.error || e.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 h-full bg-gray-50 overflow-y-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FileText className="text-blue-600" /> Reporting & Audits
            </h1>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`pb-2 font-bold ${activeTab === 'generate' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                >
                    Generate Export
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-2 font-bold ${activeTab === 'history' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
                >
                    Export History
                </button>
            </div>

            {activeTab === 'generate' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Filters Panel */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2 space-y-6">
                        <h3 className="font-bold text-gray-800">1. Scope & Filters</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Project Scope</label>
                                <select
                                    className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                                    value={selectedProject}
                                    onChange={e => setSelectedProject(e.target.value)}
                                >
                                    <option value="">All Projects</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.code}>{p.name} ({p.code})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                                <div className="flex gap-2">
                                    <input type="date" className="border rounded px-2 py-2 w-full text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                    <input type="date" className="border rounded px-2 py-2 w-full text-sm" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {['SUPER_ADMIN', 'LAB_MANAGER'].includes(user.role) && (
                            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex gap-3 items-start">
                                <AlertCircle className="text-yellow-600 shrink-0 mt-0.5" size={18} />
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={includeUnapproved}
                                            onChange={e => setIncludeUnapproved(e.target.checked)}
                                            className="w-4 h-4 text-yellow-600 rounded"
                                        />
                                        <span className="font-bold text-yellow-800 text-sm">Include Unapproved / In-Progress Samples</span>
                                    </label>
                                    <p className="text-xs text-yellow-700 mt-1">
                                        Only use for internal review. Official reports must be strictly approved.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sign-off Panel */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6 h-fit">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <ShieldCheck size={18} className="text-purple-600" /> 2. Sign-off & Export
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Authorized By</label>
                                <input
                                    type="text"
                                    className="w-full border-b-2 border-gray-200 focus:border-purple-500 outline-none py-1 font-medium"
                                    value={signOffName}
                                    onChange={e => setSignOffName(e.target.value)}
                                    placeholder="Full Name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase">Reason / Purpose</label>
                                <input
                                    type="text"
                                    className="w-full border-b-2 border-gray-200 focus:border-purple-500 outline-none py-1"
                                    value={signOffReason}
                                    onChange={e => setSignOffReason(e.target.value)}
                                    placeholder="e.g. Monthly Report"
                                />
                            </div>

                            <label className="flex gap-2 items-start p-3 bg-gray-50 rounded border cursor-pointer hover:bg-gray-100">
                                <input
                                    type="checkbox"
                                    checked={consentChecked}
                                    onChange={e => setConsentChecked(e.target.checked)}
                                    className="mt-1"
                                />
                                <span className="text-xs text-gray-600">
                                    I confirm this export is authorized and reflects approved results (unless override selected).
                                </span>
                            </label>

                            <div className="pt-4 space-y-2">
                                <button
                                    onClick={() => handleExport('CSV')}
                                    disabled={loading}
                                    className="w-full bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Generating...' : <><Table size={18} /> Export CSV</>}
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleExport('XLS')}
                                        disabled={loading}
                                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <FileSpreadsheet size={18} /> XLS
                                    </button>
                                    <button
                                        onClick={() => handleExport('PDF')}
                                        disabled={loading}
                                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <FileText size={18} /> PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-3">Time</th>
                                <th className="px-6 py-3">User</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Filters</th>
                                <th className="px-6 py-3">Records</th>
                                <th className="px-6 py-3">Auth Sign-off</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-3 text-gray-900 whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-3 font-medium">{log.user}</td>
                                    <td className="px-6 py-3">
                                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{log.type}</span>
                                    </td>
                                    <td className="px-6 py-3 text-xs text-gray-500 max-w-xs truncate" title={JSON.stringify(log.filters)}>
                                        {log.filters.project ? `Proj: ${log.filters.project}` : 'All Projects'}
                                        {log.filters.includeUnapproved && <span className="text-yellow-600 ml-1">(Unapproved)</span>}
                                    </td>
                                    <td className="px-6 py-3 font-mono">{log.recordCount}</td>
                                    <td className="px-6 py-3 text-xs">
                                        <div>{log.signOff.name}</div>
                                        <div className="text-gray-400">{log.signOff.reason}</div>
                                    </td>
                                </tr>
                            ))}
                            {history.length === 0 && (
                                <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-400">No export history found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Reports;
