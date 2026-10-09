import React, { useState } from 'react';
import NumericEditor from './NumericEditor';
import { useLanguage } from '../../context/LanguageContext';

// One durable existing draft at a time. Recording/confirmation remains the
// worksheet's ordinary completion flow; retained cells are never refilled.
export default function SampleReplicateEntry({ item, disabled, unit, onDraftChange,
    onEnterNext, inputRef, onBarcodeRejected }) {
    const { t } = useLanguage();
    const [showThird, setShowThird] = useState(false);
    const view = item.sampleReplicates, rows = view.measurements || [];
    const stored = number => rows.find(row => row.replicateNo === number);
    const hasThird = Boolean(stored(3));
    const numbers = [1, 2, ...((hasThird || showThird && view.canAddThird ||
        item.draft?.replicateNo === 3 && view.canAddThird) ? [3] : [])];
    const active = !stored(1) ? 1 : !stored(2) ? 2 : view.canAddThird && numbers.includes(3) ? 3 : null;
    const display = value => value == null ? '—' : String(value).replace('.', item.numberFormat?.decimal || '.');
    return <div data-testid={`sample-replicates-${item.workItemId}`}>
        <div className="grid grid-flow-col auto-cols-fr gap-2">
            {numbers.map(number => <div key={number}>
                <label className="block text-xs text-sf-muted mb-1">
                    {t(`replicateGrid.rep${number}`, `Rep ${number}`)}
                </label>
                {stored(number) ? <output className="block font-mono" data-replicate={number}>
                    {stored(number).rawInput ?? stored(number).value}
                </output> : <NumericEditor numberFormat={item.numberFormat} unit={unit}
                    value={Number(item.draft?.replicateNo || 1) === number ? item.draft?.value ?? '' : ''}
                    disabled={disabled || number !== active}
                    ariaLabel={`${item.sampleDisplayId || item.sampleId} ${t(`replicateGrid.rep${number}`, `Rep ${number}`)}`}
                    onChange={value => onDraftChange(item.workItemId, value, { replicateNo: number })}
                    onEnterNext={onEnterNext} inputRef={number === active ? inputRef : null}
                    onBarcodeRejected={onBarcodeRejected} />}
            </div>)}
        </div>
        <div className="text-xs mt-2" data-pair-status={view.status}>
            {t(`replicateGrid.status.${view.status}`, view.status)}
            {view.reason && <> · {t(`replicateGrid.reason.${view.reason}`, view.reason)}</>}
            {view.mean != null && <> · {t('replicateGrid.mean', 'Mean')}: {display(view.mean)}</>}
            {view.rpd != null && <> · {t('replicateGrid.rpd', 'RPD')}: {display(view.rpd)}%</>}
            {view.absoluteDifference != null && <> · |Δ|: {display(view.absoluteDifference)}</>}
            {view.limit != null && <> · {t('replicateGrid.limit', 'Limit')}: {display(view.limit)}{view.criterion === 'RPD' ? '%' : ''}</>}
            {view.range != null && <> · {t('replicateGrid.range', 'Range')}: {display(view.range)}</>}
        </div>
        <div className="text-xs text-sf-muted">{t('replicateGrid.criteria', 'Criteria')}: {t(`replicateGrid.source.${view.source}`, view.source)}
            {' · '}{t('replicateGrid.count', 'Required count')}: {view.requiredCount} ({t(`replicateGrid.source.${view.countSource}`, view.countSource)})</div>
        {view.canAddThird && !showThird && !hasThird && <button type="button"
            disabled={disabled} className="mt-2 px-2 py-1 rounded bg-amber-500/15 text-amber-800 dark:text-amber-200"
            onClick={() => setShowThird(true)}>{t('replicateGrid.runThird', 'Run third replicate')}</button>}
        {!hasThird && !stored(2) && <p className="text-xs text-sf-muted mt-1">
            {t('replicateGrid.recordInOrder', 'Record each reading with the worksheet review and confirmation before entering the next.')}
        </p>}
        <p className="text-xs text-sf-muted mt-1">{t('replicateGrid.selectionHint', 'These calculations do not select the reported value. Review decides the reported value.')}</p>
    </div>;
}
