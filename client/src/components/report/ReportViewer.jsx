import React from 'react';
import { createPortal } from 'react-dom';
import { XCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import ReportContent from './ReportContent';
import ReportPdfButton from './ReportPdfButton';

export default function ReportViewer({ report, onClose }) {
    const { t } = useLanguage();
    return createPortal(
        <div className="report-viewer-modal fixed inset-0 bg-black/70 backdrop-blur-sm z-[130] flex items-center justify-center p-4"
            role="dialog" aria-modal="true" aria-label={t('resultReports.viewReport', 'View report')}>
            <div className="report-viewer-shell bg-sf-surface rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-sf-divider">
                <div className="px-6 py-4 border-b border-sf-divider flex justify-between items-center bg-sf-surface no-print">
                    <div>
                        <h2 className="text-xl font-black text-sf-text">Report — {report.sampleLabId || report.sampleId?.slice(0, 8)}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Version {report.version} • Generated {report.generatedAt ? new Date(report.generatedAt).toLocaleDateString('en-GB') : '—'}{report.generatedBy ? ` by ${report.generatedBy}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ReportPdfButton report={report} className="p-2.5 hover:bg-sf-raised rounded-xl text-sf-emerald transition-colors disabled:opacity-50" />
                        <button onClick={onClose} aria-label={t('common.close', 'Close')} className="p-2.5 hover:bg-sf-raised rounded-xl text-gray-500 transition-colors"><XCircle size={24} /></button>
                    </div>
                </div>
                <div className="report-viewer-scroll flex-1 overflow-y-auto p-8 bg-sf-canvas" data-surface="paper">
                    {report.content ? <ReportContent data={typeof report.content === 'string' ? JSON.parse(report.content) : report.content}
                        publication={{ status: report.status, withdrawal: report.withdrawal }}
                        withdrawalBanner={report.withdrawal && t('resultReports.withdrawnPendingAmendment',
                            'Withdrawn pending amendment {{amendmentId}}', { amendmentId: report.withdrawal.amendmentId })} />
                        : <div className="text-center text-gray-400 py-20">{t('resultReports.noReportContent', 'No report content available')}</div>}
                </div>
            </div>
        </div>, document.body);
}
