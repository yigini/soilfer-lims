import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Droplet, CheckCircle, AlertTriangle, Plus, Search, Trash2, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import InfoTooltip from '../common/InfoTooltip';

const AnalysisUpdateModal = ({ sample, isOpen, onClose, onUpdateSuccess }) => {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState([]);
    const [allAnalyses, setAllAnalyses] = useState([]);

    // Form State
    const [selectedGroup, setSelectedGroup] = useState('');
    const [currentAnalyses, setCurrentAnalyses] = useState([]);
    const [reason, setReason] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
            // Initialize from sample
            setCurrentAnalyses(sample.requiredAnalyses || []);
            setReason('');
            // Try to match group if all analyses match a group
            // (Standard logic uses analysisGroupIds from sample)
            if (sample.analysisGroupIds && sample.analysisGroupIds.length > 0) {
                setSelectedGroup(sample.analysisGroupIds[0]);
            }
        }
    }, [isOpen, sample]);

    const fetchConfig = async () => {
        try {
            const [gRes, aRes] = await Promise.all([
                axios.get('/api/config/groups'),
                axios.get('/api/config/analyses')
            ]);
            setGroups(gRes.data);
            setAllAnalyses(aRes.data);
        } catch (e) {
            console.error("Failed to fetch analysis config", e);
        }
    };

    const handleToggleAnalysis = (code) => {
        if (currentAnalyses.includes(code)) {
            setCurrentAnalyses(currentAnalyses.filter(c => c !== code));
        } else {
            setCurrentAnalyses([...currentAnalyses, code]);
        }
    };

    const handleApplyBundle = (groupId) => {
        setSelectedGroup(groupId);
        if (!groupId) return;

        const group = groups.find(g => g.id === groupId);
        if (group) {
            // SD-04: A bundle replaces the selection, it does not merge into it
            setCurrentAnalyses([...(group.analyses || [])]);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        setError(null);
        try {
            await axios.put(`/api/samples/${sample.id}/analyses`, {
                analyses: currentAnalyses,
                analysisGroupIds: selectedGroup ? [selectedGroup] : [],
                reason: reason.trim() || undefined
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            onUpdateSuccess();
            onClose();
        } catch (e) {
            setError(e.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-700 overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-xl text-blue-600 dark:text-blue-400">
                            <Droplet size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                Adjust Analysis Selection
                                <InfoTooltip text="Add or remove technical tests for this sample. New tests will generate new work items for technicians." />
                            </h2>
                            <p className="text-sm text-gray-500 font-mono">{sample.labId || sample.originalId}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-3 animate-in shake duration-300">
                            <AlertTriangle size={18} />
                            {error}
                        </div>
                    )}

                    {/* Bundle Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                            Analysis Bundle
                            <InfoTooltip text="Select a predefined group of tests to quickly populate the list." />
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <select
                                value={selectedGroup}
                                onChange={e => handleApplyBundle(e.target.value)}
                                className="w-full p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl text-blue-900 dark:text-blue-100 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            >
                                <option value="">-- No Bundle --</option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                            </select>
                        </div>
                        {selectedGroup && groups.find(g => g.id === selectedGroup) && (
                            <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium">
                                <Info size={14} className="shrink-0" />
                                Replaces current selection with the {groups.find(g => g.id === selectedGroup)?.analyses?.length || 0} analyses in this bundle.
                            </p>
                        )}
                    </div>

                    {/* Individual Search */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                            Add Individual Tests
                            <InfoTooltip text="Search by test name or chemical code (e.g., pH, P, SOC)." />
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by name or code..."
                                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />

                            {searchQuery && (
                                <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in slide-in-from-top-2">
                                    {allAnalyses
                                        .filter(a => !currentAnalyses.includes(a.code) && (
                                            a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            a.code.toLowerCase().includes(searchQuery.toLowerCase())
                                        ))
                                        .map(a => (
                                            <button
                                                key={a.code}
                                                onClick={() => {
                                                    handleToggleAnalysis(a.code);
                                                    setSearchQuery('');
                                                }}
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between border-b border-gray-50 dark:border-gray-700 last:border-0"
                                            >
                                                <div>
                                                    <div className="font-bold text-sm text-gray-900 dark:text-white uppercase">{a.code}</div>
                                                    <div className="text-xs text-gray-500">{a.name}</div>
                                                </div>
                                                <Plus size={16} className="text-blue-500" />
                                            </button>
                                        ))
                                    }
                                    {allAnalyses.filter(a => !currentAnalyses.includes(a.code) && (
                                        a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        a.code.toLowerCase().includes(searchQuery.toLowerCase())
                                    )).length === 0 && (
                                            <div className="px-4 py-3 text-sm text-gray-500 italic">No matching tests found</div>
                                        )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Current Selection */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1">
                            Current Selections ({currentAnalyses.length})
                            <InfoTooltip text="These tests are currently required for this sample. Items with existing results cannot be easily removed." />
                        </label>
                        <div className="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-900/30 rounded-2xl border border-gray-100 dark:border-gray-700 inner-shadow">
                            {currentAnalyses.length === 0 && (
                                <div className="text-gray-400 text-sm italic w-full text-center py-4">No analyses selected</div>
                            )}
                            {currentAnalyses.map(code => {
                                const ana = allAnalyses.find(a => a.code === code);
                                return (
                                    <div key={code} className="group flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm hover:border-red-300 dark:hover:border-red-900/50 transition-all">
                                        <div>
                                            <span className="font-bold text-xs text-blue-600 dark:text-blue-400 uppercase leading-none">{code}</span>
                                            {ana && <p className="text-[10px] text-gray-400 truncate max-w-[100px] leading-tight">{ana.name}</p>}
                                        </div>
                                        <button
                                            onClick={() => handleToggleAnalysis(code)}
                                            className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Reason for Removal if items were dropped */}
                    {Array.isArray(sample.requiredAnalyses) && sample.requiredAnalyses.some(c => !currentAnalyses.includes(c)) && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5">
                            <label className="block text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                                Reason for Removal / Waiver
                                <InfoTooltip text="Required if any removed analysis is already assigned or in progress." />
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder="Specify reason for dropping or waiving analysis..."
                                className="w-full p-2.5 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    )}

                    {['APPROVED', 'ARCHIVED', 'DISPOSED'].includes(sample.status) && currentAnalyses.length > 0 && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3">
                            <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                                <p className="font-bold mb-1">Lifecycle Reactivation</p>
                                Saving these changes will move the sample back to <span className="font-black">PROCESSING</span> to allow technicians to perform the new tests.
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/50">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading || currentAnalyses.length === 0}
                        className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 dark:disabled:bg-blue-900/20 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 group"
                    >
                        {loading ? 'Saving...' : (
                            <>
                                Save Changes
                                <CheckCircle size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisUpdateModal;
