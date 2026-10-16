import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal, flushSync } from 'react-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import { useLanguage } from '../../context/LanguageContext';
import LabelCode128 from './LabelCode128';
import { fitsLabel } from '../../utils/labelBarcode';

const refusedStates = ['REJECTED', 'RECEIVED_REJECTED', 'DISPOSED'];
const keyOf = item => `${item.entity}:${item.entityId}`;
const printSample = label => ({ ...label.sample, labelCode: label.code, container: label.container, sampleCode: label.sampleCode });

export default function LabelPrintDialog({ isOpen, onClose, sample, samples, container, autoPrint = false }) {
    const { t } = useLanguage();
    const [format, setFormat] = useState('STANDARD'), [copies, setCopies] = useState(1);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [labels, setLabels] = useState([]), [qrDataUrls, setQrDataUrls] = useState({});
    const [branding, setBranding] = useState(null), [reason, setReason] = useState(''), [error, setError] = useState('');
    const [busy, setBusy] = useState(false), [authorized, setAuthorized] = useState([]);
    const printing = useRef(false), opened = useRef(false), session = useRef(0), hasAutoPrintedRef = useRef(false);
    const sampleList = useMemo(() => container ? [{ ...container, entity: 'CONTAINER', entityId: container.id }] :
        (samples?.length ? samples : sample ? [sample] : []).map(row => ({ ...row, entity: 'SAMPLE', entityId: row.id })), [container, samples, sample]);
    const items = useMemo(() => sampleList.filter(row => selectedIds.has(keyOf(row))).map(row => ({ entity: row.entity, entityId: row.entityId, count: copies })), [sampleList, selectedIds, copies]);
    useEffect(() => {
        opened.current = isOpen;
        session.current++;
        if (!isOpen) { hasAutoPrintedRef.current = false; setAuthorized([]); return; }
        setSelectedIds(new Set(sampleList.filter(row => !refusedStates.includes(row.status)).map(keyOf)));
        setLabels([]); setQrDataUrls({}); setReason(''); setError('');
        axios.get('/api/public/branding').then(response => setBranding(response.data.branding)).catch(() => setBranding(null));
        const escape = event => { if (event.key === 'Escape' && !printing.current) onClose?.(); };
        window.addEventListener('keydown', escape);
        return () => { opened.current = false; window.removeEventListener('keydown', escape); };
    }, [isOpen, sampleList, onClose]);
    useEffect(() => {
        if (!isOpen) return;
        let current = true; setLabels([]); setQrDataUrls({}); setError('');
        if (items.length) axios.post('/api/samples/labels/preview', { items }).then(async response => {
            const incoming = response.data.labels;
            const urls = {};
            for (const label of incoming) urls[keyOf(label)] = await QRCode.toDataURL(label.code, { width: 240, margin: 1, errorCorrectionLevel: 'M' });
            if (current) { setLabels(incoming); setQrDataUrls(urls); }
        }).catch(failure => { if (current) setError(t(`labelPrint.errors.${failure.response?.data?.code}`, t('labelPrint.failed'))); });
        return () => { current = false; };
    }, [isOpen, items, t]);
    const reprint = labels.some(label => label.reprint);
    const fits = labels.every(label => fitsLabel(label.code, format));
    const ready = items.length > 0 && labels.length === items.length && labels.every(label => qrDataUrls[keyOf(label)]) && fits;
    const handlePrint = useCallback(async () => {
        if (printing.current || !ready || (reprint && !reason.trim())) return;
        printing.current = true; setBusy(true); setError('');
        const printSession = session.current;
        try {
            // Every invocation is recorded before making printable content available.
            const response = await axios.post('/api/samples/labels/print', { items, format, reason: reason.trim() || null });
            if (!opened.current || session.current !== printSession) return;
            const committed = response.data.labels;
            if (committed.some(label => qrDataUrls[keyOf(label)] == null || label.code !== labels.find(row => keyOf(row) === keyOf(label))?.code)) {
                setError(t('labelPrint.changed')); return;
            }
            const originalTitle = document.title;
            const sanitizedId = committed[0].code.replace(/[^a-zA-Z0-9-_]/g, '_');
            document.title = committed.length > 1 ? `Labels-Batch-${committed.length}` : `Label-${sanitizedId}`;
            const cleanup = () => { document.title = originalTitle; setAuthorized([]); window.removeEventListener('afterprint', cleanup); };
            window.addEventListener('afterprint', cleanup);
            flushSync(() => { setAuthorized(committed); setLabels(committed.map(row => ({ ...row, reprint: true }))); });
            try {
                await Promise.all([...document.querySelectorAll('#label-print-portal img')].map(image => typeof image.decode === 'function' ? image.decode() : Promise.resolve()));
                if (opened.current && session.current === printSession) window.print();
            } finally { cleanup(); }
        } catch (failure) {
            if (failure.response?.data?.code === 'LABEL_REPRINT_REASON_REQUIRED') setLabels(rows => rows.map(row => ({ ...row, reprint: true })));
            setError(t(`labelPrint.errors.${failure.response?.data?.code}`, t('labelPrint.failed')));
        } finally { printing.current = false; setBusy(false); }
    }, [ready, reprint, reason, items, format, qrDataUrls, labels, t]);
    useEffect(() => {
        if (autoPrint && isOpen && ready && !reprint && !hasAutoPrintedRef.current) {
            hasAutoPrintedRef.current = true;
            void handlePrint();
        }
    }, [autoPrint, isOpen, ready, reprint, handlePrint]);
    if (!isOpen || !sampleList.length) return null;
    const Card = format === 'STANDARD' ? StandardLabelCard : CompactLabelCard;
    const renderCard = (label, isPrint = false) => <Card sample={printSample(label)} branding={branding} qrDataUrl={qrDataUrls[keyOf(label)]} isPrint={isPrint} />;
    return <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 no-print overflow-y-auto" role="dialog" aria-modal="true" aria-label={t('labelPrint.title')}>
        <div className="bg-sf-surface rounded-2xl p-5 max-w-full overflow-auto border border-sf-divider">
            <h3 className="font-semibold">{t('labelPrint.title')}</h3>
            <p className="text-sm text-sf-muted my-2">{t('labelPrint.help')}</p>
            <div className="flex flex-wrap gap-3 my-3">
                <label>{t('labelPrint.format')}<select value={format} disabled={busy} onChange={event => setFormat(event.target.value)} className="block p-2 bg-sf-canvas border rounded">
                    <option value="STANDARD">{t('labelPrint.standard')}</option><option value="COMPACT">{t('labelPrint.compact')}</option>
                </select></label>
                <label>{t('labelPrint.copies')}<input className="block p-2 bg-sf-canvas border rounded w-20" type="number" min="1" max="20" value={copies} disabled={busy}
                    onChange={event => setCopies(Number(event.target.value))} /></label>
            </div>
            {sampleList.length > 1 && <div className="max-h-32 overflow-auto my-3">{sampleList.map(row => <label key={keyOf(row)} className="block">
                <input type="checkbox" disabled={busy || refusedStates.includes(row.status)} checked={selectedIds.has(keyOf(row))} onChange={() => setSelectedIds(previous => {
                    const next = new Set(previous); if (next.has(keyOf(row))) next.delete(keyOf(row)); else next.add(keyOf(row)); return next;
                })} /> {row.labSampleCode || row.code || row.labId || row.originalId || row.id}
            </label>)}</div>}
            {labels[0] && <div className="my-3 overflow-auto" data-testid="label-preview">{renderCard(labels[0])}</div>}
            {!fits && <p role="alert">{t('labelPrint.tooLong')}</p>}
            {reprint && <label className="block my-3">{t('labelPrint.reason')}<textarea value={reason} maxLength={1000} disabled={busy} required className="block w-full p-2 border rounded bg-sf-canvas"
                onChange={event => setReason(event.target.value)} /></label>}
            {error && <p role="alert" className="text-red-600">{error}</p>}
            <div className="flex justify-end gap-4 mt-4">
                <button type="button" disabled={busy} onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
                <button type="button" data-testid="label-print" disabled={busy || !ready || (reprint && !reason.trim())} onClick={handlePrint} className="px-4 py-2 bg-sf-primary text-white rounded disabled:opacity-50">
                    {t(busy ? 'labelPrint.recording' : 'labelPrint.print')}
                </button>
            </div>
        </div>
        {authorized.length > 0 && createPortal(<div id="label-print-portal" className="print-only hidden">
            <style>{`@media print {
                @page { margin:0; size:${format === 'STANDARD' ? '101mm 54mm' : '50mm 25mm'}; }
                html, body { margin:0 !important; padding:0 !important; height:auto !important; min-height:0 !important; background:white !important; }
                body > * { display:none !important; }
                body > #label-print-portal { display:block !important; }
                .sample-label-page { width:${format === 'STANDARD' ? '101mm' : '50mm'}; height:${format === 'STANDARD' ? '54mm' : '25mm'}; break-inside:avoid !important; page-break-inside:avoid !important; overflow:hidden; margin:0; }
                .sample-label-page:not(:last-child) { break-after:page !important; page-break-after:always !important; }
                .sample-label-page:last-child { break-after:auto !important; page-break-after:auto !important; }
            }`}</style>
            {authorized.flatMap(label => Array.from({ length: label.count }, (_, index) => <div key={`${keyOf(label)}:${index}`} className="sample-label-page">{renderCard(label, true)}</div>))}
        </div>, document.body)}
    </div>;
}

const parseJsonSafely = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch {
            return null;
        }
    }
    return null;
};

export const formatLabelDate = (val) => {
    if (!val) return null;
    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed || trimmed === 'N/A' || trimmed === '—' || trimmed === '-' || trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') {
            return null;
        }
        const isoMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
        if (isoMatch) return isoMatch[1];
    }
    try {
        const d = new Date(val);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
    } catch {
        return null;
    }
};

export const resolveCollectionDate = (sample) => {
    if (!sample) return null;
    const direct = sample.collectionDate || sample.samplingDate || sample.samplingDetails?.date || sample.samplingDetails?.collectionDate;
    if (direct) {
        const formatted = formatLabelDate(direct);
        if (formatted) return formatted;
    }

    const fm = parseJsonSafely(sample.fieldMetadata);
    if (fm) {
        const fmDate = fm.collectionDate || fm.samplingDate || fm.collection_date || fm.sampling_date || fm.date || fm.samplingDetails?.date;
        if (fmDate) {
            const formatted = formatLabelDate(fmDate);
            if (formatted) return formatted;
        }
    }

    const meta = parseJsonSafely(sample.metadata);
    if (meta) {
        const metaDate = meta.collectionDate || meta.samplingDate || meta.collection_date || meta.sampling_date || meta.date || meta.samplingDetails?.date;
        if (metaDate) {
            const formatted = formatLabelDate(metaDate);
            if (formatted) return formatted;
        }
    }

    return null;
};

export const resolveIntakeDate = (sample) => {
    if (!sample) return null;
    const direct = sample.receptionDate || sample.receivedDate || sample.intakeDate || sample.custodyHandoverAt;
    if (direct) {
        const formatted = formatLabelDate(direct);
        if (formatted) return formatted;
    }

    const rd = parseJsonSafely(sample.receptionData);
    if (rd) {
        const rdDate = rd.intakeDate || rd.receptionDate || rd.receivedDate || rd.custodyHandoverAt || rd.coc?.handoverAt || rd.coc?.date;
        if (rdDate) {
            const formatted = formatLabelDate(rdDate);
            if (formatted) return formatted;
        }
    }

    // Persisted receipt or custody timestamps only.
    // Record creation time (createdAt) or render clock must never be promoted to intake/receipt date.
    return null;
};


export const StandardLabelCard = ({ sample, branding, qrDataUrl }) => {
    const { t } = useLanguage();
    const code = sample.labelCode || sample.labSampleCode || sample.labId;
    const intakeDate = resolveIntakeDate(sample), collectionDate = resolveCollectionDate(sample);
    return <div style={{ width: '101mm', height: '54mm', padding: '3mm', boxSizing: 'border-box', background: 'white', color: 'black', overflow: 'hidden', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '1mm' }}>
        <div style={{ fontSize: '9pt', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{branding?.title || 'SoilFER LIMS'} · {sample.assignedLab}{sample.projectCode && ` · ${sample.projectCode}`}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3mm', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {qrDataUrl && <img src={qrDataUrl} alt={`QR ${code}`} style={{ width: '23mm', height: '23mm' }} />}
            <div style={{ minWidth: 0, maxHeight: '100%', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                <strong style={{ fontSize: '13pt', fontFamily: 'monospace' }}>{code}</strong>
                {sample.container && <div style={{ fontSize: '8pt' }}>{t(`containers.kinds.${sample.container.kind}`)} · {t('containers.sample')}: {sample.sampleCode || '—'}{sample.container.massG != null && ` · ${sample.container.massG} g`}</div>}
                <div style={{ fontSize: '8pt' }}>{sample.originalId}</div>
                <div style={{ fontSize: '7pt' }}>{t('labelPrint.collected')}: {collectionDate || '—'} · {t('labelPrint.received')}: {intakeDate || '—'}</div>
            </div>
        </div>
        <LabelCode128 code={code} heightMm={10} />
    </div>;
};

export const CompactLabelCard = ({ sample, qrDataUrl }) => {
    const { t } = useLanguage();
    const code = sample.labelCode || sample.labSampleCode || sample.labId;
    return <div style={{ width: '50mm', height: '25mm', padding: '2mm', boxSizing: 'border-box', background: 'white', color: 'black', overflow: 'hidden', fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: '1mm', height: '13mm', alignItems: 'center', overflow: 'hidden' }}>
            {qrDataUrl && <img src={qrDataUrl} alt={`QR ${code}`} style={{ width: '13mm', height: '13mm' }} />}
            <div style={{ minWidth: 0, maxHeight: '100%', overflow: 'hidden', fontSize: '6pt', overflowWrap: 'anywhere' }}><strong>{code}</strong>
                {sample.container && <div>{t(`containers.kinds.${sample.container.kind}`)} · {sample.sampleCode || '—'}{sample.container.massG != null && ` · ${sample.container.massG} g`}</div>}
            </div>
        </div>
        <LabelCode128 code={code} heightMm={8} />
    </div>;
};
