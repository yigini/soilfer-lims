import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import ReportContent from '../components/report/ReportContent';

/**
 * PublicReport — Customer-facing public report page.
 * Clean, professional, light-only. No dark mode.
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
            <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#888' }}>
                    <div style={{ width: 32, height: 32, border: '3px solid #1e3a5f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '14px' }}>Loading report…</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ maxWidth: 420, width: '100%', background: '#fff', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', padding: 40, textAlign: 'center' }}>
                    <div style={{ width: 56, height: 56, background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24 }}>⚠</div>
                    <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Report Unavailable</h1>
                    <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>{error}</p>
                    <p style={{ fontSize: 11, color: '#d1d5db' }}>If you believe this is an error, please contact the laboratory that issued this report.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#f0f0f0', padding: '24px 16px' }} className="print-reset">
            <div style={{ maxWidth: 900, margin: '0 auto', background: '#fff', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', overflow: 'hidden' }}
                className="print-container">

                {/* Action bar — hidden in print */}
                <div className="no-print" style={{ padding: '12px 20px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>
                        Shared Report · Version {report?.version}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => window.print()}
                            style={{ padding: '8px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                            🖨 Print / Save as PDF
                        </button>
                    </div>
                </div>

                {/* Report Document */}
                <div style={{ padding: '32px 40px' }} className="print-body" data-surface="paper">
                    <ReportContent data={report?.content} />
                </div>
            </div>

            {/* Print reset styles */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @media print {
                    .print-reset { background: white !important; padding: 0 !important; }
                    .print-container { box-shadow: none !important; border: none !important; border-radius: 0 !important; max-width: none !important; }
                    .print-body { padding: 0 !important; }
                    .no-print { display: none !important; }
                }
            `}</style>
        </div>
    );
};

export default PublicReport;
