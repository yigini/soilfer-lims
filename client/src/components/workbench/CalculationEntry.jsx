import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import soilCalculation from '@lims/soil-calculation';
import BarcodeSafeInput from './BarcodeSafeInput';
import { useLanguage } from '../../context/LanguageContext';

export default function CalculationEntry({ item, disabled, onDraftChange, onBarcodeRejected, inputRef, children }) {
    const { t } = useLanguage();
    const [context,setContext] = useState(null), [loaded,setLoaded] = useState(false), [error,setError] = useState(null), [busy,setBusy] = useState(false);
    const generation = useRef(0), [raw,setRaw] = useState(item.draft?.values?.calculation?.inputs || {});
    useEffect(() => {
        const version = ++generation.current; setLoaded(false); setContext(null); setError(null);
        setRaw(item.draft?.values?.calculation?.inputs || {});
        if (!item.calculationTemplate) { setLoaded(true); return; }
        axios.post('/api/workbench/calculation-preview',{sampleId:item.sampleId,workItemId:item.workItemId})
            .then(({data}) => { if (generation.current === version) { setContext(data.data); setLoaded(true); } })
            .catch(() => { if (generation.current === version) { setError(t('calculations.unavailable')); setLoaded(true); } });
        return () => { generation.current++; };
    },[item.sampleId,item.workItemId,item.methodologyId,item.batchId,item.calculationTemplate?.activationId,t]);
    const calculated = useMemo(() => {
        if (!context?.active || context.curveBlocker) return null;
        try { return soilCalculation.calculate(context.template,raw,{numberFormat:context.numberFormat,curve:context.curve,units:context.units}); }
        catch { return null; }
    },[context,raw]);
    if (loaded && !context?.active) return <>{error && <p role="alert" className="text-xs">{error}</p>}{children}</>;
    if (!loaded) return <p className="text-xs">{t('calculations.loading')}</p>;
    const view = item.sampleReplicates, retained = view?.measurements || [];
    const replicateNo = !view ? Number(item.draft?.replicateNo || 1) : !retained.some(row => row.replicateNo === 1) ? 1
        : !retained.some(row => row.replicateNo === 2) ? 2 : view.canAddThird ? 3 : null;
    const change = (key,value) => {
        generation.current++; setError(null); const inputs = {...raw,[key]:value}; setRaw(inputs);
        onDraftChange(item.workItemId,'',{replicateNo,values:{calculation:{...context.active,curveId:context.curve?.id || null,inputs}}});
    };
    const accept = async () => {
        const version = ++generation.current; setBusy(true); setError(null);
        try {
            const {data} = await axios.post('/api/workbench/calculation-preview',{sampleId:item.sampleId,workItemId:item.workItemId,inputs:raw});
            if (version !== generation.current) return;
            if (data.data.active.activationId !== context.active.activationId ||
                data.data.active.templateId !== context.active.templateId ||
                data.data.active.templateVersion !== context.active.templateVersion ||
                (data.data.curve?.id || null) !== (context.curve?.id || null) ||
                data.data.calculation.output !== calculated.output) throw Error('Calculation context changed');
            setContext(data.data);
            onDraftChange(item.workItemId,String(data.data.calculation.output).replace('.',data.data.numberFormat.decimal),
                {replicateNo,values:{calculation:{...data.data.active,curveId:data.data.curve?.id || null,inputs:{...raw}}}});
        } catch { if (version === generation.current) setError(t('calculations.saveRefused')); }
        finally { setBusy(false); }
    };
    return <div className="space-y-2" data-testid={`calculation-entry-${item.workItemId}`}>
        <p className="text-xs font-semibold">{context.template.variant} · v{context.template.version}
            {replicateNo && <> · {t('calculations.reading')} {replicateNo}</>}</p>
        {context.curveBlocker && <p role="alert" className="text-xs">{t('calculations.curveRequired')}</p>}
        {context.template.inputs.map((input,index) => <label className="grid gap-1 text-xs" key={input.key}>
            {t(`calculations.inputs.${input.key}`,input.label)} ({input.unit})
            <BarcodeSafeInput value={raw[input.key] ?? ''} aria-label={`${t(`calculations.inputs.${input.key}`,input.label)} ${item.sampleDisplayId || item.sampleId}`}
                ref={index === 0 ? inputRef : null} data-worksheet-column={`calculation-${input.key}`}
                inputMode="decimal" disabled={disabled || busy || !replicateNo} onBarcodeRejected={onBarcodeRejected}
                onChange={event => change(input.key,event.target.value)} className="p-2 border border-sf-divider rounded bg-sf-canvas" />
        </label>)}
        <p className="text-xs">{t('calculations.preview')}: <output>{calculated?.output ?? '—'}</output> {context.units.reporting.code}</p>
        {calculated?.intermediate.aboveRange && <p className="text-amber-700 dark:text-amber-300 text-xs">{t('calculations.aboveRange')}</p>}
        {error && <p role="alert" className="text-xs">{error}</p>}
        <button type="button" disabled={disabled || busy || !calculated || !replicateNo || Boolean(context.curveBlocker)}
            onClick={accept} className="px-3 py-2 rounded border border-sf-divider">{t('calculations.useCalculated')}</button>
        <p className="text-xs text-sf-muted">{t('calculations.confirmation')}</p>
        {retained.length > 0 && <div className="text-xs">{retained.map(row => <p key={row.id || row.replicateNo}>
            {t('calculations.reading')} {row.replicateNo}: {row.rawInput ?? row.value}</p>)}</div>}
    </div>;
}
