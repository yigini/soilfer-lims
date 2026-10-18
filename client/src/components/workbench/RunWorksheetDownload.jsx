import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { FileDown } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';

export default function RunWorksheetDownload({ batch, analysisCode }) {
    const { t } = useLanguage(), { hasPermission } = useAuth();
    const [busy, setBusy] = useState(false), [error, setError] = useState(null);
    const generation = useRef(0), request = useRef(null);
    useEffect(() => {
        generation.current++; request.current?.abort(); request.current = null;
        setBusy(false); setError(null);
        return () => { generation.current++; request.current?.abort(); request.current = null; };
    }, [batch.id, analysisCode]);
    const download = async () => {
        if (request.current) return;
        const token = ++generation.current, controller = new AbortController();
        request.current = controller; setBusy(true); setError(null);
        try {
            const response = await axios.get(`/api/workbench/runs/${encodeURIComponent(batch.id)}/worksheet.pdf`, {
                params: { ...(analysisCode && { analysisCode }) }, responseType: 'blob', signal: controller.signal
            });
            if (controller.signal.aborted || generation.current !== token) return;
            if (!String(response.headers?.['content-type'] || '').startsWith('application/pdf')) throw Error(t('benchErgonomics.pdfUnexpected'));
            const url = URL.createObjectURL(response.data), link = document.createElement('a');
            try {
                link.href = url; link.download = 'run-worksheet.pdf'; document.body.appendChild(link); link.click();
            } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
        } catch (failure) {
            if (controller.signal.aborted || generation.current !== token) return;
            let detail = failure.response?.data;
            if (detail?.text) { try { detail = JSON.parse(await detail.text()); } catch { detail = null; } }
            if (generation.current === token) setError(detail?.error || failure.message || t('benchErgonomics.pdfFailed'));
        } finally {
            if (generation.current === token) { request.current = null; setBusy(false); }
        }
    };
    if (!hasPermission?.('ENTER_RESULTS')) return null;
    return <div className="space-y-1">
        <button type="button" onClick={download} disabled={busy} className="min-h-[44px] inline-flex items-center gap-2 rounded-lg border border-sf-divider px-3 text-sm font-semibold">
            <FileDown size={18} aria-hidden="true" />{t(busy ? 'benchErgonomics.pdfDownloading' : 'benchErgonomics.pdfDownload')}
        </button>
        {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
    </div>;
}
