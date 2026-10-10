import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

const copy = value => JSON.parse(JSON.stringify(value));
const initialMapping = context => {
    let column = 1;
    return { version: 1, delimiter: 'COMMA', hasHeader: true, idColumn: 0, idType: 'LAB_SAMPLE_CODE',
        analytes: context.analyses.map(analysis => analysis.inputs
            ? { analysisCode: analysis.analysisCode, inputs: analysis.inputs.map(input => ({ variable: input.key, column: column++, unit: input.unit })) }
            : { analysisCode: analysis.analysisCode, valueColumn: column++, unit: analysis.reportingUnits[0] || '' }) };
};
export default function InstrumentImportPanel({ batch, canEdit = true, onChanged, setSuccessMsg }) {
    const { t } = useLanguage(), auth = useAuth(), canManage = auth?.hasPermission?.('MANAGE_EQUIPMENT') === true;
    const [context, setContext] = useState(null), [mapping, setMapping] = useState(null), [selected, setSelected] = useState('');
    const [name, setName] = useState(''), [file, setFile] = useState(null), [sheetName, setSheetName] = useState('');
    const [preview, setPreview] = useState(null), [error, setError] = useState(null), [busy, setBusy] = useState(false), [page, setPage] = useState(0);
    const [dirty, setDirty] = useState(true), [contextRevision, setContextRevision] = useState(0);
    const generation = useRef(0), fileInput = useRef(null);
    const invalidate = () => { generation.current++; setPreview(null); setError(null); setPage(0); };
    const usable = canEdit && batch.startedAt && batch.instrumentId && batch.status !== 'CLOSED';
    useEffect(() => {
        const current = ++generation.current; let mounted = true;
        setContext(null); setMapping(null); setSelected(''); setFile(null); setPreview(null); setError(null); setSheetName(''); setPage(0); setDirty(true);
        if (usable) {
            setBusy(true);
            axios.get(`/api/workbench/runs/${batch.id}/imports/context`).then(({ data }) => {
                if (!mounted || generation.current !== current) return;
                setContext(data); setMapping(initialMapping(data)); setName('');
            }).catch(cause => { if (mounted && generation.current === current) setError(cause.response?.data || { code: 'IMPORT_FAILED' }); })
                .finally(() => { if (mounted && generation.current === current) setBusy(false); });
        }
        return () => { mounted = false; generation.current++; };
    }, [batch.id, batch.instrumentId, usable, contextRevision]);
    if (!usable) return null;
    const saved = context?.templates.find(row => row.id === selected);
    const updateMapping = change => { invalidate(); setDirty(true); setMapping(previous => change(copy(previous))); };
    const changeAnalyte = (index, change) => updateMapping(value => { value.analytes[index] = change(value.analytes[index]); return value; });
    const run = async operation => {
        const current = ++generation.current; setBusy(true); setError(null);
        try { await operation(current); }
        catch (cause) { if (current === generation.current) setError(cause.response?.data || { code: 'IMPORT_FAILED' }); }
        finally { if (current === generation.current) setBusy(false); }
    };
    const save = () => !busy && canManage && context && mapping && name.trim() && mapping.analytes.length && run(async current => {
        const { data } = await axios.post(`/api/workbench/instruments/${context.instrumentId}/import-templates`, {
            labId: context.labId, name, mapping, supersedesId: saved?.id || null, expectedVersion: saved?.version || 0
        });
        if (current !== generation.current) return;
        setContext(previous => ({ ...previous, templates: [data, ...previous.templates] })); setSelected(data.id); setMapping(data.mapping); setPreview(null); setDirty(false);
        setSuccessMsg?.(t('instrumentImport.mappingSaved'));
    });
    const payload = committing => {
        const body = new FormData(); body.append('file', file); body.append('templateId', selected);
        if (sheetName) body.append('sheetName', sheetName);
        if (committing) body.append('previewToken', preview.previewToken);
        return body;
    };
    const readPreview = () => !busy && selected && file && !dirty && run(async current => {
        setPreview(null); const { data } = await axios.post(`/api/workbench/runs/${batch.id}/imports/preview`, payload(false));
        if (current === generation.current) { setPreview(data); setPage(0); }
    });
    const commit = () => !busy && preview?.canCommit && preview.previewToken && !dirty && run(async current => {
        const { data } = await axios.post(`/api/workbench/runs/${batch.id}/imports/commit`, payload(true));
        if (current !== generation.current) return;
        setPreview(null); setFile(null); if (fileInput.current) fileInput.current.value = '';
        setSuccessMsg?.(`${t('instrumentImport.imported')}: ${data.draftCount} / ${data.qcCount}`);
        await onChanged?.();
    });
    const columnInput = (label, value, changed, testId) => <label className="grid gap-1 text-xs">{label}
        <input type="number" min="1" step="1" value={Number.isSafeInteger(value) ? value + 1 : ''} disabled={busy}
            data-testid={testId} onChange={event => changed(/^\d+$/.test(event.target.value) && Number(event.target.value) > 0 ? Number(event.target.value) - 1 : null)}
            className="p-2 border rounded bg-sf-canvas" /></label>;
    const unitInput = (binding, declared, changed, testId) => <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">{t('instrumentImport.unitSource')}
            <select disabled={busy} value={Object.hasOwn(binding, 'unitColumn') ? 'column' : 'fixed'} data-testid={testId + '-source'}
                onChange={event => { const next = { ...binding }; delete next.unit; delete next.unitColumn;
                    changed({ ...next, ...(event.target.value === 'column' ? { unitColumn: null } : { unit: declared[0] || '' }) }); }} className="p-2 border rounded bg-sf-canvas">
                <option value="fixed">{t('instrumentImport.fixedUnit')}</option><option value="column">{t('instrumentImport.unitColumn')}</option>
            </select></label>
        {Object.hasOwn(binding, 'unitColumn') ? columnInput(t('instrumentImport.unitColumn'), binding.unitColumn, value => changed({ ...binding, unitColumn: value }), testId + '-column')
            : <label className="grid gap-1 text-xs">{t('instrumentImport.unit')}<select value={binding.unit} disabled={busy} data-testid={testId + '-unit'}
                onChange={event => changed({ ...binding, unit: event.target.value })} className="p-2 border rounded bg-sf-canvas">
                {!declared.length && <option value="">{t('instrumentImport.unitUnavailable')}</option>}
                {declared.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select></label>}
    </div>;
    return <details className="p-3 border border-sf-divider rounded-xl" data-testid="instrument-import-panel">
        <summary className="font-semibold text-sm">{t('instrumentImport.title')}</summary>
        <div className="mt-3 space-y-3">
            <p className="text-xs text-sf-muted">{t('instrumentImport.help')}</p>
            {error && <div role="alert"><p>{t(`instrumentImport.errors.${error.code}`, t('instrumentImport.refused'))}</p>
                {error.details?.sheets?.map(sheet => <p key={sheet.name}>{sheet.name} ({sheet.state})</p>)}
                {error.details?.refusedRows?.map((row, index) => <p key={index}>{t('instrumentImport.row')} {row.rowNumber} · {row.analysisCode}
                    {' '}{t(`instrumentImport.errors.${row.code}`, t('instrumentImport.refused'))}</p>)}</div>}
            {context && <>
                <label className="grid gap-1 text-xs">{t('instrumentImport.savedMapping')}<select value={selected} disabled={busy} data-testid="import-template"
                    onChange={event => { invalidate(); setSelected(event.target.value); const row = context.templates.find(item => item.id === event.target.value);
                        setMapping(row ? copy(row.mapping) : initialMapping(context)); setName(row?.name || ''); setDirty(!row); }} className="p-2 border rounded bg-sf-canvas">
                    <option value="">{t('instrumentImport.newMapping')}</option>
                    {context.templates.map(row => <option key={row.id} value={row.id}>{row.name} · v{row.version}</option>)}
                </select></label>
                <button type="button" disabled={busy} onClick={() => setContextRevision(value => value + 1)} className="px-3 py-2 border rounded">{t('instrumentImport.refresh')}</button>
                {canManage && mapping && <details data-testid="import-mapping-editor"><summary>{t('instrumentImport.editMapping')}</summary>
                    <div className="mt-2 space-y-3">
                        <label className="grid gap-1 text-xs">{t('instrumentImport.name')}<input value={name} disabled={busy} data-testid="import-mapping-name"
                            onChange={event => { invalidate(); setDirty(true); setName(event.target.value); }} className="p-2 border rounded bg-sf-canvas" /></label>
                        <p className="text-xs">{t('instrumentImport.columnHelp')}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <label className="grid gap-1 text-xs">{t('instrumentImport.identifier')}<select value={mapping.idType} disabled={busy} data-testid="import-id-type"
                                onChange={event => updateMapping(value => ({ ...value, idType: event.target.value }))} className="p-2 border rounded bg-sf-canvas">
                                {['LAB_SAMPLE_CODE', 'ORIGINAL_ID', 'POSITION'].map(type => <option key={type} value={type}>{t('instrumentImport.identifiers.' + type)}</option>)}
                            </select></label>
                            {columnInput(t('instrumentImport.idColumn'), mapping.idColumn, value => updateMapping(row => ({ ...row, idColumn: value })), 'import-id-column')}
                            <label className="grid gap-1 text-xs">{t('instrumentImport.delimiter')}<select value={mapping.delimiter} disabled={busy} data-testid="import-delimiter"
                                onChange={event => updateMapping(value => ({ ...value, delimiter: event.target.value }))} className="p-2 border rounded bg-sf-canvas">
                                {['COMMA', 'SEMICOLON', 'TAB'].map(value => <option key={value} value={value}>{t('instrumentImport.delimiters.' + value)}</option>)}
                            </select></label>
                            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={mapping.hasHeader} disabled={busy} data-testid="import-header"
                                onChange={event => updateMapping(value => ({ ...value, hasHeader: event.target.checked }))} />{t('instrumentImport.hasHeader')}</label>
                        </div>
                        <label className="grid gap-1 text-xs">{t('instrumentImport.defaultSheet')}<input value={mapping.sheetName || ''} disabled={busy} data-testid="import-default-sheet"
                            onChange={event => updateMapping(value => { if (event.target.value) value.sheetName = event.target.value; else delete value.sheetName; return value; })}
                            className="p-2 border rounded bg-sf-canvas" /></label>
                        <div className="flex flex-wrap gap-3">{context.analyses.map(analysis => <label key={analysis.analysisCode} className="flex gap-2 text-xs">
                            <input type="checkbox" disabled={busy} checked={mapping.analytes.some(row => row.analysisCode === analysis.analysisCode)}
                                onChange={event => updateMapping(value => { value.analytes = event.target.checked
                                    ? [...value.analytes, initialMapping({ analyses: [analysis] }).analytes[0]] : value.analytes.filter(row => row.analysisCode !== analysis.analysisCode); return value; })} />
                            {analysis.analysisCode}</label>)}</div>
                        {mapping.analytes.map((binding, index) => {
                            const analysis = context.analyses.find(row => row.analysisCode === binding.analysisCode);
                            return <fieldset key={binding.analysisCode} className="p-2 border rounded space-y-2"><legend>{analysis?.name || binding.analysisCode} ({binding.analysisCode})</legend>
                                {binding.inputs ? binding.inputs.map((input, inputIndex) => {
                                    const definition = analysis?.inputs?.find(row => row.key === input.variable), change = next => changeAnalyte(index, row => ({ ...row,
                                        inputs: row.inputs.map((old, current) => current === inputIndex ? next : old) }));
                                    return <div key={input.variable} className="space-y-2">
                                        {columnInput(`${definition?.label || input.variable} (${definition?.unit || input.unit || ''})`, input.column,
                                            value => change({ ...input, column: value }), 'import-input-' + input.variable)}
                                        {unitInput(input, definition ? [definition.unit] : [], change, 'import-input-' + input.variable)}
                                    </div>;
                                }) : <>
                                    {columnInput(t('instrumentImport.valueColumn'), binding.valueColumn, value => changeAnalyte(index, row => ({ ...row, valueColumn: value })), 'import-value-' + binding.analysisCode)}
                                    {unitInput(binding, analysis?.reportingUnits || [], next => changeAnalyte(index, () => next), 'import-unit-' + binding.analysisCode)}
                                    {columnInput(t('instrumentImport.dilutionColumn'), binding.dilutionColumn, value => changeAnalyte(index, row => {
                                        if (value === null) delete row.dilutionColumn; else row.dilutionColumn = value; return row;
                                    }), 'import-dilution-' + binding.analysisCode)}
                                </>}
                            </fieldset>;
                        })}
                        <label className="flex gap-2 text-xs"><input type="checkbox" checked={!!mapping.qcDetector} disabled={busy} data-testid="import-qc-detector"
                            onChange={event => updateMapping(value => { if (event.target.checked) value.qcDetector = { positionColumn: null,
                                prefixes: ['BLANK', 'CCV', 'LRM'].map(kind => ({ kind, prefix: kind === 'BLANK' ? 'BLK' : kind })) }; else delete value.qcDetector; return value; })} />
                            {t('instrumentImport.qcDetector')}</label>
                        {mapping.qcDetector && <div className="space-y-2">
                            {columnInput(t('instrumentImport.qcPositionColumn'), mapping.qcDetector.positionColumn,
                                column => updateMapping(value => ({ ...value, qcDetector: { ...value.qcDetector, positionColumn: column } })), 'import-qc-position')}
                            {mapping.qcDetector.prefixes.map((rule, index) => <label className="grid gap-1 text-xs" key={rule.kind}>{rule.kind} · {t('instrumentImport.prefix')}
                                <input value={rule.prefix} disabled={busy} data-testid={'import-prefix-' + rule.kind} onChange={event => updateMapping(value => {
                                    value.qcDetector.prefixes[index].prefix = event.target.value; return value;
                                })} className="p-2 border rounded bg-sf-canvas" /></label>)}
                        </div>}
                        <button type="button" disabled={busy || !name.trim() || !mapping.analytes.length} onClick={save} data-testid="import-save-template" className="px-3 py-2 border rounded">
                            {t(saved ? 'instrumentImport.saveRevision' : 'instrumentImport.saveMapping')}</button>
                    </div>
                </details>}
                <label className="grid gap-1 text-xs">{t('instrumentImport.file')}<input key={batch.id} ref={fileInput} type="file" accept=".csv,.txt,.xlsx" disabled={busy}
                    data-testid="import-file" onChange={event => { invalidate(); setSheetName(''); setFile(event.target.files?.[0] || null); }} /></label>
                <label className="grid gap-1 text-xs">{t('instrumentImport.sheet')}<input value={sheetName} disabled={busy} data-testid="import-sheet"
                    onChange={event => { invalidate(); setSheetName(event.target.value); }} className="p-2 border rounded bg-sf-canvas" /></label>
                <button type="button" onClick={readPreview} disabled={busy || !selected || !file || dirty} data-testid="import-preview" className="px-3 py-2 border rounded">{t('instrumentImport.preview')}</button>
            </>}
            {preview && <div className="space-y-2" data-testid="import-preview-results">
                <p>{t('instrumentImport.matched')}: {preview.rows.filter(row => row.match.kind === 'SAMPLE').length} · {t('instrumentImport.qcRows')}: {preview.rows.filter(row => row.match.kind === 'QC').length}
                    {' · '}{t('instrumentImport.unmatched')}: {preview.rows.filter(row => row.status === 'SKIPPED_UNMATCHED').length}</p>
                <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr>{['row', 'identifier', 'status', 'values', 'issues'].map(key => <th key={key}>{t('instrumentImport.' + key)}</th>)}</tr></thead>
                    <tbody>{preview.rows.slice(page * 20, (page + 1) * 20).map(row => <tr key={row.rowNumber}>
                        <td>{row.rowNumber}</td><td>{row.match.sourceId}</td><td>{t('instrumentImport.statuses.' + (row.errors.length ? 'REFUSED' : row.match.kind))}</td>
                        <td>{Object.values(row.cells).join(' | ')}</td><td>{row.errors.map((issue, index) => <p key={index}>{issue.analysisCode} {issue.details?.cellRef}
                            {' '}{t(`instrumentImport.errors.${issue.code}`, t('instrumentImport.refused'))}</p>)}</td>
                    </tr>)}</tbody></table></div>
                {preview.rows.length > 20 && <div className="flex gap-2"><button type="button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>{t('instrumentImport.previous')}</button>
                    <span>{page + 1} / {Math.ceil(preview.rows.length / 20)}</span><button type="button" disabled={(page + 1) * 20 >= preview.rows.length} onClick={() => setPage(value => value + 1)}>{t('instrumentImport.next')}</button></div>}
                {!!preview.refusals.length && <p role="alert">{t('instrumentImport.refused')}</p>}
                <p className="text-xs">{t('instrumentImport.unmatchedHelp')}</p>
                <button type="button" onClick={commit} disabled={busy || !preview.canCommit || dirty} data-testid="import-commit" className="btn-primary px-3 py-2">{t('instrumentImport.commit')}</button>
            </div>}
        </div>
    </details>;
}
