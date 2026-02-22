import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { FileText, AlertTriangle, Clock, User, Shield, Download } from 'lucide-react';

/**
 * PublicReport — Unauthenticated route for /report/:token
 * Renders a branded report from a public share link.
 */
const PublicReport = () => {
    const { token } = useParams();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchReport();
    }, [token]);

    const fetchReport = async () => {
        try {
            const res = await axios.get(`/api/reports/public/${token}`);
            const content = typeof res.data.content === 'string' ? JSON.parse(res.data.content) : res.data.content;
            setReport({ ...res.data, content });
        } catch (e) {
            const status = e.response?.status;
            if (status === 404) setError('This report link is invalid or has been removed.');
            else if (status === 410) setError(e.response?.data?.error || 'This link has expired or been revoked.');
            else setError('Failed to load report. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent mx-auto mb-4" />
                    <p className="text-gray-500">Loading report...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 p-8 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle size={28} className="text-red-500" />
                    </div>
                    <h1 className="text-xl font-black text-gray-900 mb-2">Report Unavailable</h1>
                    <p className="text-gray-500 text-sm">{error}</p>
                    <p className="text-xs text-gray-300 mt-6">If you believe this is an error, please contact the laboratory that issued this report.</p>
                </div>
            </div>
        );
    }

    const { sample, client, project, lab, labBranding, resultGroups, generated } = report?.content || {};

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none">
                {/* Print button */}
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center print:hidden">
                    <span className="text-xs text-gray-400">Shared Report • Version {report?.version}</span>
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                    >
                        <Download size={14} /> Print / Save PDF
                    </button>
                </div>

                {/* Report Body */}
                <div className="p-8 lg:p-12 space-y-8">
                    {/* Lab Header */}
                    <div className="text-center border-b-2 border-indigo-600 pb-6">
                        {labBranding?.logoUrl && (
                            <img src={labBranding.logoUrl} alt="Lab logo" className="h-16 mx-auto mb-3" />
                        )}
                        <h1 className="text-2xl font-black text-gray-900">{lab?.name || 'Laboratory Report'}</h1>
                        {lab?.address && <p className="text-sm text-gray-500 mt-1">{[lab.address, lab.city, lab.country].filter(Boolean).join(', ')}</p>}
                        {(lab?.phone || lab?.email) && (
                            <p className="text-xs text-gray-400 mt-0.5">{[lab.phone, lab.email, lab.website].filter(Boolean).join(' • ')}</p>
                        )}
                        <h2 className="text-lg font-bold text-indigo-600 mt-4">SOIL ANALYSIS REPORT</h2>
                    </div>

                    {/* Client & Sample */}
                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><User size={13} /> Client Information</h3>
                            <div className="space-y-1.5 text-sm">
                                <div><span className="text-gray-500">Name:</span> <span className="font-bold text-gray-900">{client?.fullName || '—'}</span></div>
                                {client?.phone && <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{client.phone}</span></div>}
                                {project && <div><span className="text-gray-500">Project:</span> <span className="font-medium">{project.name} ({project.code})</span></div>}
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5"><FileText size={13} /> Sample Details</h3>
                            <div className="space-y-1.5 text-sm">
                                <div><span className="text-gray-500">Lab ID:</span> <span className="font-mono font-bold text-indigo-600">{sample?.labId || '—'}</span></div>
                                <div><span className="text-gray-500">Status:</span> <span className="font-bold">{sample?.status || '—'}</span></div>
                                {sample?.receptionDate && <div><span className="text-gray-500">Received:</span> {new Date(sample.receptionDate).toLocaleDateString()}</div>}
                                {sample?.approvedBy && <div><span className="text-gray-500">Approved by:</span> {sample.approvedBy}</div>}
                            </div>
                        </div>
                    </div>

                    {/* Results */}
                    {resultGroups && resultGroups.length > 0 ? (
                        resultGroups.map((group, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                                <div className="bg-indigo-50 px-6 py-3 border-b border-gray-200">
                                    <h3 className="font-bold text-indigo-800">{group.categoryName}</h3>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider">
                                        <tr>
                                            <th className="px-6 py-2.5 text-left">Parameter</th>
                                            <th className="px-6 py-2.5 text-left">Result</th>
                                            <th className="px-6 py-2.5 text-left">Unit</th>
                                            <th className="px-6 py-2.5 text-left">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {group.items.map((item, i) => (
                                            <tr key={i} className={item.flags?.length > 0 ? 'bg-amber-50/50' : ''}>
                                                <td className="px-6 py-3 font-medium text-gray-900">{item.name}</td>
                                                <td className="px-6 py-3 font-mono font-bold text-gray-900">
                                                    {item.value != null ? Number(item.value).toFixed(2) : '—'}
                                                </td>
                                                <td className="px-6 py-3 text-gray-600">{item.unit || '—'}</td>
                                                <td className="px-6 py-3">
                                                    {item.flags?.length > 0 ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                                            ⚠ {item.flags.join(', ')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-green-600">✓ Normal</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 text-gray-400 border border-gray-200 rounded-xl">
                            No analysis results available yet.
                        </div>
                    )}

                    {/* Footer */}
                    <div className="text-center text-xs text-gray-400 border-t border-gray-200 pt-4 mt-8">
                        <p>Generated {generated?.at ? new Date(generated.at).toLocaleString() : '—'} by {generated?.byName || 'System'}</p>
                        <p className="mt-1">CONFIDENTIAL — This report is intended for the named client and authorized personnel only.</p>
                        <p className="mt-0.5">Verification: This report can be verified at the issuing laboratory.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicReport;
