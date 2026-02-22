import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle, Download, Printer } from 'lucide-react';
import ReportContent from '../components/report/ReportContent';

/**
 * PublicReport — Unauthenticated route for /report/:token
 * Renders a branded report from a public share link using the shared ReportContent component.
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

    return (
        <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none">
                {/* Print bar */}
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center print:hidden no-print">
                    <span className="text-xs text-gray-400">Shared Report • Version {report?.version}</span>
                    <div className="flex items-center gap-2">
                        {report?.id && (
                            <a
                                href={`/api/reports/public/${token}/pdf`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-bold hover:bg-gray-700 transition-colors flex items-center gap-2"
                            >
                                <Download size={14} /> Download PDF
                            </a>
                        )}
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                            <Printer size={14} /> Print
                        </button>
                    </div>
                </div>

                {/* Report Body — uses shared ReportContent */}
                <div className="p-8 lg:p-12">
                    <ReportContent data={report?.content} />
                </div>
            </div>
        </div>
    );
};

export default PublicReport;
