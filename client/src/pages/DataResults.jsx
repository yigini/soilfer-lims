import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Download, Filter, Search, FlaskConical, Table, CheckCircle, FileText, XCircle, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import * as XLSX from 'xlsx';
import SpectraViewer from '../components/SpectraViewer';
import InfoTooltip from '../components/common/InfoTooltip';

const DataResults = () => {
    const { user } = useAuth();
    const { subscribeToEvent } = useNotifications();
    const [data, setData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(true);

    // SPECTRA VIEWER STATE
    const [selectedScan, setSelectedScan] = useState(null);
    const [availableScans, setAvailableScans] = useState([]); // All scans for multi-scan selector
    const [viewerLoading, setViewerLoading] = useState(false);

    const loadScanDetail = async (scanSummary) => {
        const detailRes = await axios.get(`/api/spectral/${scanSummary.id}`);
        const chartData = detailRes.data.wavelengths.map((w, i) => ({
            wavelength: w,
            absorbance: detailRes.data.values ? detailRes.data.values[i] : 0
        }));
        setSelectedScan({ ...detailRes.data, chartData });
    };

    const handleViewSpectra = async (sampleId, key) => {
        setViewerLoading(true);
        try {
            let modality = 'NIR';
            if (key === 'SPEC_MIR' || key === 'MIR Soil Spectra') {
                modality = 'MIR';
            }

            const searchRes = await axios.get('/api/spectral', {
                params: { search: sampleId, modality }
            });

            const scans = searchRes.data.data;
            if (!scans || scans.length === 0) {
                alert('No spectral data found for this analysis.');
                return;
            }

            setAvailableScans(scans);

            // Prefer the most recent approved scan, fallback to most recent overall
            const approvedScan = scans.find(s => s.status === 'APPROVED');
            const bestScan = approvedScan || scans[0];

            await loadScanDetail(bestScan);

        } catch (e) {
            console.error(e);
            alert('Failed to load spectral data: ' + e.message);
        } finally {
            setViewerLoading(false);
        }
    };

    const handleScanSwitch = async (scanId) => {
        const scan = availableScans.find(s => s.id === scanId);
        if (!scan) return;
        setViewerLoading(true);
        try {
            await loadScanDetail(scan);
        } catch (e) {
            console.error(e);
        } finally {
            setViewerLoading(false);
        }
    };

    const handleDownload = () => {
        if (!selectedScan) return;

        const headers = ["Wavelength,Absorbance"];
        const rows = selectedScan.wavelengths.map((w, i) =>
            `${w},${selectedScan.values ? selectedScan.values[i] : 0}`
        );
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${selectedScan.labId}_${selectedScan.modality}_${selectedScan.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filters
    const [projectFilter, setProjectFilter] = useState('');
    const [countryFilter, setCountryFilter] = useState('');
    const [analysisType, setAnalysisType] = useState('ALL'); // 'ALL', 'SPECTRAL', 'WET_CHEM'
    const [search, setSearch] = useState('');

    // Column Visibility
    const [visibleColumns, setVisibleColumns] = useState({
        labId: true,
        originalId: false,
        project: false,
        status: false
        // Dynamic results default to true (handled in render)
    });
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    useEffect(() => {
        fetchData();
    }, [projectFilter, countryFilter, analysisType]);

    // Real-time: subscribe to WORKITEM_CHANGED + SPECTRAL_UPDATE for instant refresh
    const refetchTimerRef = useRef(null);
    useEffect(() => {
        if (!subscribeToEvent) return;
        const debouncedRefetch = () => {
            if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
            refetchTimerRef.current = setTimeout(() => fetchData(), 1000);
        };
        const unsubs = [
            subscribeToEvent('WORKITEM_CHANGED', debouncedRefetch),
            subscribeToEvent('SPECTRAL_UPDATE', debouncedRefetch),
        ];
        return () => {
            unsubs.forEach(u => u && u());
            if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
        };
    }, [subscribeToEvent]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = {};
            if (projectFilter) params.project = projectFilter;
            if (countryFilter) params.country = countryFilter;
            if (analysisType !== 'ALL') params.analysisType = analysisType;

            const res = await axios.get('/api/data-results', { params });
            setData(res.data.data);
            setColumns(res.data.columns);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleColumn = (key) => {
        setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleExport = (type) => {
        if (!data.length) return;
        const exportData = data.map(row => {
            const newRow = {};
            columns.forEach(col => {
                let val = row[col.key];
                // Flatten objects for export (e.g. PENDING, DRAFT, SUBMITTED status)
                if (val && typeof val === 'object' && val.status === 'PENDING') {
                    val = `PENDING (${val.assignedTo || 'Unassigned'})`;
                } else if (val && typeof val === 'object' && val.status === 'DRAFT') {
                    val = `DRAFT: ${val.value} (${val.assignedTo})`;
                } else if (val && typeof val === 'object' && val.status === 'SUBMITTED') {
                    val = `${val.value} (Pending Review)`;
                }
                newRow[col.label] = val;
            });
            return newRow;
        });

        if (type === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Analytical Results");
            XLSX.writeFile(wb, "Analytical_Results_Master.xlsx");
        } else if (type === 'csv') {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const csv = XLSX.utils.sheet_to_csv(ws);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "Analytical_Results.csv");
            link.click();
        }
    };

    // Client-side Search Filter
    const filteredData = data.filter(row => {
        if (!search) return true;
        const term = search.toLowerCase();
        return (
            String(row.labId).toLowerCase().includes(term) ||
            String(row.originalId).toLowerCase().includes(term) ||
            String(row.project).toLowerCase().includes(term)
        );
    });

    // Pagination Logic
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => { setCurrentPage(1); }, [projectFilter, countryFilter, search, itemsPerPage]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
    };

    // Helper: Is column visible?
    const isColVisible = (key, isResult) => {
        if (isResult) return true; // Always show result columns if they exist in the set
        return visibleColumns[key] !== false; // Default true if undefined
    };

    const renderCellContent = (value, col, row) => {
        // Handle DRAFT Object — show value with draft indicator
        if (value && typeof value === 'object' && value.status === 'DRAFT') {
            return (
                <div className="flex items-center justify-end gap-1.5">
                    <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{value.value}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" title={`Draft by ${value.assignedTo}`}>
                        draft
                    </span>
                </div>
            );
        }

        // Handle SUBMITTED Object — result awaiting approval
        if (value && typeof value === 'object' && value.status === 'SUBMITTED') {
            return (
                <div className="flex items-center justify-end gap-1.5">
                    <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{value.value}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title={`Submitted by ${value.assignedTo} — pending review`}>
                        pending review
                    </span>
                </div>
            );
        }

        // Handle PENDING Object
        if (value && typeof value === 'object' && value.status === 'PENDING') {
            return (
                <div className="flex justify-end">
                    <FlaskConical size={16} className="text-amber-500 animate-pulse" />
                    <InfoTooltip
                        text={`${value.note || 'Analysis Pending'}. Assigned to: ${value.assignedTo}${value.lastUpdated ? ' (Updated: ' + new Date(value.lastUpdated).toLocaleDateString() + ')' : ''}`}
                        position="bottom"
                    />
                </div>
            );
        }

        // Legacy/Simple String Pending (Fallback)
        if (value === 'PENDING') {
            return (
                <div className="flex justify-end" title="Analysis Pending">
                    <FlaskConical size={16} className="text-amber-500 animate-pulse" />
                </div>
            );
        }

        if (value === 'N/A' || value === undefined || value === null || value === '') {
            // N/A - Icon only
            return (
                <div className="flex justify-end" title="Not Applicable / Not Requested">
                    <span className="text-gray-300 transform rotate-45 text-lg leading-3 select-none">+</span>
                </div>
            );
        }

        // SPECTRAL COMPLETED STATUS
        const isSpectral = col && (col.key === 'SPEC_VIS_NIR' || col.key === 'SPEC_MIR');
        if (isSpectral && (value === 'Done' || value === 'Spectrum Uploaded' || String(value).includes('Uploaded') || String(value).includes('Done'))) {
            return (
                <div className="flex justify-end items-center" onClick={() => handleViewSpectra(row.id, col.key)}>
                    <CheckCircle size={16} className="text-green-500 hover:text-green-600 transition-colors cursor-pointer" />
                    <InfoTooltip text="View Spectrum" position="bottom" />
                </div>
            );
        }

        return <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{value}</span>;
    };

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Table className="text-emerald-600" /> Analytical Results Master
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Master view of all analytical results (Approved & Pending).
                    </p>
                </div>

                <div className="flex gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnMenu(!showColumnMenu)}
                            className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
                        >
                            <Filter size={16} /> Columns
                        </button>
                        {showColumnMenu && (
                            <div className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-800 border dark:border-gray-700 shadow-lg rounded-lg z-50 p-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Metadata Columns</h4>
                                {columns.filter(c => !c.isResult && !c.frozen && !['country', 'collectionDate', 'receptionDate'].includes(c.key)).map(col => (
                                    <label key={col.key} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            checked={!!visibleColumns[col.key]}
                                            onChange={() => toggleColumn(col.key)}
                                            className="rounded text-emerald-600 focus:ring-emerald-500"
                                        />
                                        {col.label}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                    <button onClick={() => handleExport('csv')} className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                        <Download size={16} /> CSV
                    </button>
                    <button onClick={() => handleExport('xlsx')} className="bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
                        <Download size={16} /> Excel
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card-base p-4 rounded-lg shadow-sm border mb-4 flex flex-wrap gap-4 items-center bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300 font-medium">
                    <Filter size={18} /> Filters:
                </div>

                {/* Analysis Type Filter */}
                <select
                    value={analysisType}
                    onChange={e => setAnalysisType(e.target.value)}
                    className="input-base border rounded px-3 py-2 text-sm w-40 bg-white"
                >
                    <option value="ALL">All Data</option>
                    <option value="SPECTRAL">Spectral Only</option>
                    <option value="WET_CHEM">Wet Chemistry</option>
                    <option disabled>--- Specific ---</option>
                    <option value="P_AVAIL">P Available</option>
                    <option value="SOC">Organic Carbon</option>
                    <option value="PH">pH</option>
                    <option value="TEXTURE">Texture (Sand/Silt/Clay)</option>
                </select>

                <input type="text" placeholder="Project Code..." value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="input-base border rounded px-3 py-2 text-sm w-32 md:w-48" />
                <div className="relative ml-auto">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                    <input type="text" placeholder="Search Lab ID..." value={search} onChange={e => setSearch(e.target.value)} className="input-base pl-9 pr-4 py-2 border rounded text-sm w-64 focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
            </div>

            {/* Data Table */}
            <div className="card-base rounded-xl shadow border flex-1 overflow-hidden flex flex-col bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className="overflow-auto flex-1 relative">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-400">Loading Master Data...</div>
                    ) : (
                        <table className="w-full text-left border-collapse text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-750 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    {columns.filter(c => !['country', 'collectionDate', 'receptionDate'].includes(c.key)).filter(c => isColVisible(c.key, c.isResult)).map((col) => (
                                        <th key={col.key} className={`px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-b dark:border-gray-600 whitespace-nowrap ${col.frozen ? 'sticky left-0 z-20 bg-gray-100 dark:bg-gray-750 border-r shadow-sm' : ''} ${col.isResult ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10' : ''}`} style={col.frozen ? { left: 0 } : {}}>
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {paginatedData.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        {columns.filter(c => !['country', 'collectionDate', 'receptionDate'].includes(c.key)).filter(c => isColVisible(c.key, c.isResult)).map((col) => (
                                            <td key={`${row.id}-${col.key}`} className={`px-4 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap ${col.frozen ? 'sticky left-0 z-10 bg-white dark:bg-gray-800 font-medium border-r border-gray-100 dark:border-gray-700' : ''} ${col.isResult ? 'text-right' : ''}`} style={col.frozen ? { left: 0 } : {}}>
                                                {col.isResult ? renderCellContent(row[col.key], col, row) : (
                                                    (col.key === 'labId' || col.key === 'originalId') ? (
                                                        <Link to={`/samples/${row.id}`} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 hover:underline font-medium">
                                                            {row[col.key]}
                                                        </Link>
                                                    ) : (row[col.key] || '-')
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                {/* Footer */}
                <div className="p-3 border-t dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-white dark:bg-gray-700 border rounded px-2 py-1">
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                        </select>
                        <span>{filteredData.length > 0 ? `${startIndex + 1}-${Math.min(startIndex + itemsPerPage, filteredData.length)} of ${filteredData.length}` : '0 results'}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1 px-3 rounded border bg-white dark:bg-gray-700 disabled:opacity-50">Prev</button>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1 px-3 rounded border bg-white dark:bg-gray-700 disabled:opacity-50">Next</button>
                    </div>
                </div>
            </div>


            {/* VIEWER MODAL */}
            {
                selectedScan && (
                    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-800">
                                            {selectedScan.labId} <span className="text-gray-400">|</span> {selectedScan.modality}
                                        </h2>
                                        <p className="text-xs text-gray-500">{selectedScan.id}</p>
                                    </div>
                                    {availableScans.length > 1 && (
                                        <select
                                            value={selectedScan.id}
                                            onChange={(e) => handleScanSwitch(e.target.value)}
                                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            {availableScans.map((s, idx) => (
                                                <option key={s.id} value={s.id}>
                                                    Scan {idx + 1} — {new Date(s.metadata?.scanDate || s.timestamp).toLocaleDateString()} {s.status === 'APPROVED' ? '✓' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={handleDownload} className="p-2 hover:bg-gray-200 rounded-full text-blue-600" title="Download CSV">
                                        <Download size={20} />
                                    </button>
                                    <button onClick={() => { setSelectedScan(null); setAvailableScans([]); }} className="p-2 hover:bg-gray-200 rounded-full">
                                        <XCircle size={24} className="text-gray-500" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 flex overflow-hidden">
                                {/* Chart Area */}
                                <div className="flex-1 p-6 overflow-hidden flex flex-col">
                                    <SpectraViewer data={selectedScan} />
                                </div>

                                {/* Sidebar Info */}
                                <div className="w-80 border-l bg-gray-50 p-6 overflow-y-auto">
                                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                                        <FileText size={16} /> Metadata
                                    </h3>
                                    <div className="space-y-4 text-sm">
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase">Instrument</label>
                                            <div className="font-medium">{selectedScan.metadata.instrument}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase">Scan Date</label>
                                            <div className="font-medium">{new Date(selectedScan.metadata.scanDate).toLocaleString()}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase">Operator</label>
                                            <div className="font-medium">{selectedScan.metadata.operator}</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-400 uppercase">Filename</label>
                                            <div className="break-all text-xs text-gray-600">{selectedScan.metadata.filename}</div>
                                        </div>

                                        <hr className="border-gray-200" />

                                        <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <CheckCircle size={16} /> QC Report
                                        </h3>
                                        <div className={`p-3 rounded-lg border ${selectedScan.qcStatus === 'PASS' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                                            <div className="font-bold mb-1">Status: {selectedScan.qcStatus}</div>
                                            {selectedScan.qcFlags && selectedScan.qcFlags.length > 0 ? (
                                                <ul className="list-disc pl-4 text-xs">
                                                    {selectedScan.qcFlags.map(f => <li key={f}>{f}</li>)}
                                                </ul>
                                            ) : (
                                                <div className="text-xs opacity-75">No flags detected.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DataResults;
