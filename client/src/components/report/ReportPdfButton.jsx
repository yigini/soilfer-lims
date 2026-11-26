import React, { useRef, useState } from 'react';
import axios from 'axios';
import { Printer } from 'lucide-react';
import { useDialog } from '../../context/DialogContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ReportPdfButton({ report, publicToken, label, className, style }) {
    const { showDialog } = useDialog();
    const { t } = useLanguage();
    const [pending, setPending] = useState(false);
    const requestRef = useRef(false);
    const download = async () => {
        if (requestRef.current) return;
        requestRef.current = true;
        setPending(true);
        try {
            // Both routes serve the stored version, with their existing access checks.
            const endpoint = publicToken
                ? `/api/reports/public/${encodeURIComponent(publicToken)}/pdf`
                : `/api/reports/${encodeURIComponent(report.id)}/pdf`;
            const response = await axios.get(endpoint, { responseType: 'blob' });
            const blob = response.data;
            if (!blob.type.includes('application/pdf') || await blob.slice(0, 5).text() !== '%PDF-') throw new Error('Invalid report PDF response');
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const sample = String(report.sampleLabId || report.sampleId || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
            link.href = url;
            link.download = `SoilFER_Report_${sample}_v${report.version}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch {
            showDialog({ type: 'error', title: t('common.error', 'Error'),
                message: t('resultReports.pdfDownloadFailed', 'The report PDF could not be downloaded. Please try again.') });
        } finally {
            requestRef.current = false;
            setPending(false);
        }
    };
    return <button onClick={download} disabled={pending} aria-busy={pending} className={className} style={style}
        aria-label={label ? undefined : t('resultReports.printPdf', 'Print / Save as PDF')}
        title={pending ? t('resultReports.pdfDownloading', 'Preparing PDF…') : (label || t('resultReports.printPdf', 'Print / Save as PDF'))}>
        <Printer size={20} aria-hidden="true" />{label ? <span>{label}</span> : null}
    </button>;
}
