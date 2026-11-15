import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { X, Upload, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { INVENTORY_COLUMNS, readInventoryImportFile, initialInventoryImportMapping, inventoryColumnMapping,
    prepareInventoryImport, downloadInventoryImportTemplate, importCsvReport } from '../../utils/inventoryImport';

export default function InventoryImportDialog({ onClose, onImported }) {
    const { user } = useAuth(), { t } = useLanguage();
    const superAdmin = user?.role === 'SUPER_ADMIN';
    const [labs, setLabs] = useState([]), [labId, setLabId] = useState(''), [labError, setLabError] = useState(false);
    const [sheets, setSheets] = useState([]), [mapping, setMapping] = useState({}), [fileName, setFileName] = useState('');
    const [duplicateMode, setDuplicateMode] = useState('SKIP'), [atomic, setAtomic] = useState(true);
    const [result, setResult] = useState(null), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const [page, setPage] = useState(0), [statusFilter, setStatusFilter] = useState('ALL');
    const sequence = useRef(0);
    const dialogRef = useFocusTrap(true, () => { if (!busy) onClose(); });
    useEffect(() => { let current = true;
        if (superAdmin) axios.get('/api/labs').then(response => {
            const rows = response.data?.data || response.data;
            if (current) setLabs((Array.isArray(rows) ? rows : []).filter(lab => lab.isActive !== false));
        }).catch(() => { if (current) setLabError(true); });
        return () => { current = false; sequence.current++; };
    }, [superAdmin]);
    const invalidate = () => { sequence.current++; setResult(null); setConfirmed(false); setPage(0); setError(''); };
    const errorText = code => t('bulkImport.errors.' + code, t('bulkImport.errors.IMPORT_INTERNAL_ERROR'));
    const load = async file => {
        if (!file) return;
        invalidate(); const request = ++sequence.current; setBusy(true); setSheets([]); setFileName('');
        try {
            const loaded = await readInventoryImportFile(file);
            if (request !== sequence.current) return;
            setSheets(loaded); setMapping(initialInventoryImportMapping(loaded, t)); setFileName(file.name);
        } catch (failure) { if (request === sequence.current) setError(errorText(failure.code || 'IMPORT_INVALID_WORKBOOK')); }
        finally { if (request === sequence.current) setBusy(false); }
    };
    const options = { atomic, duplicateMode, fileName, ...(superAdmin && { labId }) };
    const preview = async () => {
        if (superAdmin && !labId) { setError(errorText('IMPORT_LAB_REQUIRED')); return; }
        let payload;
        try { payload = prepareInventoryImport(sheets, mapping, options); }
        catch (failure) { setError(errorText(failure.code)); return; }
        const request = ++sequence.current; setBusy(true); setError(''); setConfirmed(false);
        try { const response = await axios.post('/api/inventory/import/preview', payload);
            if (request === sequence.current) { setResult(response.data); setPage(0); setStatusFilter('ALL'); }
        } catch (failure) { if (request === sequence.current) setError(errorText(failure.response?.data?.code || 'IMPORT_INTERNAL_ERROR')); }
        finally { if (request === sequence.current) setBusy(false); }
    };
    const commit = async () => {
        if (!confirmed || !result || result.mode !== 'preview') return;
        const request = ++sequence.current; setBusy(true); setError('');
        try {
            const response = await axios.post('/api/inventory/import/commit', prepareInventoryImport(sheets, mapping, options));
            if (request === sequence.current) { setResult(response.data); setConfirmed(false); setPage(0); if (response.data.committed) onImported?.(response.data); }
        } catch (failure) {
            if (request === sequence.current) {
                if (failure.response?.data?.sheets) { setResult(failure.response.data); setPage(0); }
                setConfirmed(false); setError(errorText(failure.response?.data?.code || 'IMPORT_INTERNAL_ERROR'));
            }
        } finally { if (request === sequence.current) setBusy(false); }
    };
    const saveBlob = (blob, name) => {
        const url = URL.createObjectURL(blob), anchor = document.createElement('a');
        anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
    };
    const exportSheet = async dataset => {
        if (superAdmin && !labId) { setError(errorText('IMPORT_LAB_REQUIRED')); return; }
        setBusy(true); setError('');
        try { const response = await axios.get('/api/inventory/export/' + dataset, { responseType: 'blob', params: superAdmin ? { labId } : {} });
            saveBlob(new Blob([response.data], { type: 'text/csv;charset=utf-8' }), 'inventory-' + dataset + '.csv'); }
        catch (failure) { setError(errorText(failure.response?.data?.code || 'IMPORT_EXPORT_FAILED')); }
        finally { setBusy(false); }
    };
    const allRows = useMemo(() => result ? Object.values(result.sheets).flat() : [], [result]);
    const visible = allRows.filter(row => statusFilter === 'ALL' || row.status === statusFilter);
    const pageCount = Math.max(1, Math.ceil(visible.length / 50));
    const canCommit = result?.mode === 'preview' && result.totalRows > result.totals.errors && (!atomic || result.totals.errors === 0);
    const inputClass = 'rounded border border-sf-divider bg-sf-surface px-2 py-1.5 text-sm';
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="inventory-import-title" className="w-full max-w-5xl rounded-xl bg-sf-surface text-sf-text shadow-xl flex flex-col max-h-[94vh]">
            <header className="flex items-center justify-between p-4 border-b border-sf-divider">
                <h2 id="inventory-import-title" className="font-bold text-lg">{t('bulkImport.title')}</h2>
                <button type="button" onClick={onClose} disabled={busy} aria-label={t('common.close')} className="p-2"><X size={18} /></button>
            </header>
            <div className="p-4 space-y-5 overflow-y-auto">
                <p className="text-sm text-sf-muted">{t('bulkImport.intro')}</p>
                {error && <p role="alert" className="rounded bg-red-50 text-red-800 p-3 text-sm">{error}</p>}
                <div className="flex flex-wrap items-end gap-3">
                    {superAdmin ? <label className="flex flex-col gap-1 text-sm">{t('bulkImport.laboratory')}
                        <select aria-label={t('bulkImport.laboratory')} value={labId} disabled={busy} className={inputClass} onChange={event => { invalidate(); setLabId(event.target.value); }}>
                            <option value="">{t('bulkImport.chooseLab')}</option>
                            {labs.map(lab => <option key={lab.id} value={lab.id}>{lab.name}{lab.code ? ` (${lab.code})` : ''}</option>)}
                        </select>
                        {labError && <span role="alert">{t('bulkImport.labsUnavailable')}</span>}
                    </label> : <p className="text-sm">{t('bulkImport.destination', { lab: user?.lab?.name || t('bulkImport.currentLab') })}</p>}
                    <button type="button" disabled={busy} className={inputClass + ' inline-flex gap-2 items-center'} onClick={() => downloadInventoryImportTemplate(t)}><Download size={14} />{t('bulkImport.template')}</button>
                    {Object.keys(INVENTORY_COLUMNS).map(dataset => <button key={dataset} type="button" className={inputClass} disabled={busy || superAdmin && !labId} onClick={() => exportSheet(dataset)}>{t('bulkImport.exportSheet', { sheet: t('bulkImport.datasets.' + dataset) })}</button>)}
                </div>
                <label className="flex flex-col gap-1 text-sm font-medium">{t('bulkImport.chooseFile')}
                    <input type="file" accept=".csv,.tsv,.xlsx,.xls" disabled={busy} aria-label={t('bulkImport.chooseFile')} onChange={event => load(event.target.files?.[0])} className={inputClass} />
                    <span className="text-xs text-sf-muted">{t('bulkImport.fileLimits')}</span>
                </label>
                {fileName && <p className="text-sm">{fileName}</p>}
                {sheets.length > 0 && <section aria-label={t('bulkImport.mapping')} className="space-y-3">
                    <h3 className="font-semibold">{t('bulkImport.mapping')}</h3>
                    <p className="text-sm text-sf-muted">{t('bulkImport.mappingHint')}</p>
                    {sheets.map(sheet => <details key={sheet.id} open={Boolean(mapping[sheet.id]?.dataset)} className="rounded border border-sf-divider p-3">
                        <summary className="font-semibold">{sheet.name} · {t('bulkImport.rowCount', { count: sheet.rows.length })}</summary>
                        <label className="my-2 flex items-center gap-2 text-sm">{t('bulkImport.sheetContains')}
                            <select aria-label={t('bulkImport.assignSheet', { sheet: sheet.name })} value={mapping[sheet.id]?.dataset || ''} disabled={busy} className={inputClass} onChange={event => {
                                invalidate(); const dataset = event.target.value;
                                setMapping(previous => ({ ...previous, [sheet.id]: { dataset, columns: dataset ? inventoryColumnMapping(sheet, dataset, t) : {} } }));
                            }}><option value="">{t('bulkImport.ignoreSheet')}</option>{Object.keys(INVENTORY_COLUMNS).map(dataset => <option key={dataset} value={dataset}>{t('bulkImport.datasets.' + dataset)}</option>)}</select>
                        </label>
                        {mapping[sheet.id]?.dataset && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {INVENTORY_COLUMNS[mapping[sheet.id].dataset].map(column => <label key={column} className="flex flex-col gap-1 text-xs">{t('bulkImport.columns.' + column, column)}
                                <select aria-label={t('bulkImport.mapColumn', { sheet: sheet.name, column: t('bulkImport.columns.' + column, column) })} className={inputClass} disabled={busy} value={mapping[sheet.id].columns[column] ?? -1}
                                    onChange={event => { invalidate(); const index = Number(event.target.value); setMapping(previous => ({ ...previous, [sheet.id]: { ...previous[sheet.id], columns: { ...previous[sheet.id].columns, [column]: index } } })); }}>
                                    <option value={-1}>{t('bulkImport.notMapped')}</option>{sheet.headers.map((header, index) => <option key={index} value={index}>{header} ({index + 1})</option>)}
                                </select>
                            </label>)}
                        </div>}
                    </details>)}
                    <p className="text-xs text-sf-muted">{t('bulkImport.numberFormatHint')}</p>
                </section>}
                {sheets.length > 0 && <div className="space-y-3 rounded bg-sf-canvas p-3 text-sm">
                    <label className="flex flex-col gap-1">{t('bulkImport.duplicates')}
                        <select aria-label={t('bulkImport.duplicates')} value={duplicateMode} disabled={busy} className={inputClass} onChange={event => { invalidate(); setDuplicateMode(event.target.value); }}>
                            <option value="SKIP">{t('bulkImport.skipExisting')}</option><option value="UPDATE">{t('bulkImport.updateDescriptions')}</option>
                        </select>
                    </label>
                    <p className="text-xs text-sf-muted">{t('bulkImport.stockRuleHint')}</p>
                    <label className="flex items-start gap-2"><input type="checkbox" checked={atomic} disabled={busy} onChange={event => { invalidate(); setAtomic(event.target.checked); }} />{t('bulkImport.atomic')}</label>
                    <p className="text-xs text-sf-muted">{t('bulkImport.partialHint')}</p>
                </div>}
                {result && <section aria-label={t('bulkImport.preview')} className="space-y-3">
                    <h3 className="font-semibold">{result.mode === 'preview' ? t('bulkImport.preview') : result.committed ? t('bulkImport.completed') : t('bulkImport.stopped')}</h3>
                    <div className="flex flex-wrap gap-3 text-sm">
                        {result.mode === 'preview' ? ['NEW','DUPLICATE_SKIP','DUPLICATE_UPDATE','ERROR'].map(status => <span key={status}>{t('bulkImport.status.' + status)}: {Object.values(result.counts).reduce((sum, count) => sum + count[status], 0)}</span>)
                            : ['created','updated','skipped','errors'].map(key => <span key={key}>{t('bulkImport.counts.' + key)}: {result.totals[key]}</span>)}
                    </div>
                    {Object.entries(result.ignoredColumns || {}).some(([, columns]) => columns.length) && <p className="text-xs text-sf-muted">{t('bulkImport.ignoredColumns')}: {Object.entries(result.ignoredColumns).flatMap(([sheet, columns]) => columns.map(column => t('bulkImport.datasets.' + sheet) + ': ' + column.replace(/^unmapped:\d+:/, ''))).join('; ')}</p>}
                    <label className="text-sm flex gap-2 items-center">{t('bulkImport.filterResult')}<select aria-label={t('bulkImport.filterResult')} className={inputClass} value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(0); }}>
                        <option value="ALL">{t('bulkImport.allRows')}</option>{['NEW','DUPLICATE_SKIP','DUPLICATE_UPDATE','ERROR'].map(status => <option key={status} value={status}>{t('bulkImport.status.' + status)}</option>)}
                    </select></label>
                    <div className="overflow-x-auto"><table className="w-full text-xs text-left"><thead><tr>{['sheet','row','record','result','problems'].map(key => <th key={key} className="p-2 border-b border-sf-divider">{t('bulkImport.' + key)}</th>)}</tr></thead>
                        <tbody>{visible.slice(page * 50, page * 50 + 50).map((row, index) => <tr key={row.sheet + '-' + row.rowNumber + '-' + index} className={row.status === 'ERROR' ? 'bg-red-50 text-red-900' : ''}>
                            <td className="p-2">{t('bulkImport.datasets.' + row.sheet)}</td><td className="p-2">{row.rowNumber}</td>
                            <td className="p-2"><details><summary>{row.values.name || row.values.itemName || row.values.shortCode || row.values.itemShortCode || row.values.lotNumber || '—'}</summary><dl>{Object.entries(row.values).map(([key, value]) => <div key={key}><dt className="inline font-semibold">{t('bulkImport.columns.' + key, key)}: </dt><dd className="inline">{String(value)}</dd></div>)}</dl></details></td>
                            <td className="p-2">{t('bulkImport.status.' + row.status)}</td><td className="p-2">{row.errors.map((problem, i) => <p key={i}>{errorText(problem.code)}{problem.field ? ' · ' + t('bulkImport.columns.' + problem.field, problem.field) : ''}</p>)}</td>
                        </tr>)}</tbody></table></div>
                    <div className="flex items-center gap-3 text-sm"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>{t('bulkImport.previous')}</button><span>{t('bulkImport.page', { page: page + 1, total: pageCount })}</span><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage(value => value + 1)}>{t('bulkImport.next')}</button></div>
                    {result.mode === 'preview' && canCommit && <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />{t('bulkImport.confirm')}</label>}
                    {result.mode === 'preview' && !canCommit && <p role="status" className="text-sm">{t('bulkImport.fixErrors')}</p>}
                </section>}
            </div>
            <footer className="p-4 border-t border-sf-divider flex flex-wrap justify-end gap-3 text-sm">
                {busy && <span role="status" className="inline-flex items-center gap-2"><RefreshCw size={14} className="animate-spin" />{t('bulkImport.working')}</span>}
                {result && <button type="button" disabled={busy} className={inputClass} onClick={() => saveBlob(new Blob([importCsvReport(result, t)], { type: 'text/csv;charset=utf-8' }), 'inventory-import-result.csv')}><Download size={14} className="inline mr-1" />{t('bulkImport.downloadResult')}</button>}
                <button type="button" disabled={busy} onClick={onClose} className={inputClass}>{t('common.close')}</button>
                {sheets.length > 0 && <button type="button" disabled={busy || superAdmin && !labId} className={inputClass} onClick={preview}><Upload size={14} className="inline mr-1" />{t('bulkImport.preview')}</button>}
                {result?.mode === 'preview' && <button type="button" disabled={busy || !canCommit || !confirmed} className="rounded px-4 py-2 bg-sf-primary text-sf-on-primary disabled:opacity-50" onClick={commit}>{t('bulkImport.commit')}</button>}
            </footer>
        </div>
    </div>;
}
