import React, { useEffect, useState } from 'react';
import axios from 'axios';
import BarcodeSafeInput from './BarcodeSafeInput';
import { useLanguage } from '../../context/LanguageContext';

export default function CalibrationCurvePanel({ batch, analyte, canEdit, onChanged, onBarcodeRejected }) {
    const { t } = useLanguage();
    const [state,setState] = useState(null), [points,setPoints] = useState([]), [reason,setReason] = useState('');
    const [busy,setBusy] = useState(false), [error,setError] = useState(null), [revision,setRevision] = useState(0);
    useEffect(() => {
        let current = true; setState(null); setError(null); setReason('');
        if (batch.startedAt) axios.get(`/api/qc/batches/${batch.id}/calibration-curves`,{params:{analysisCode:analyte.analysisCode}})
            .then(({data}) => { if (current) { setState(data.data); setPoints(data.data.latest?.points.map(point => ({
                standardConcentration:String(point.standardConcentration).replace('.',analyte.numberFormat?.decimal || '.'),
                response:String(point.response).replace('.',analyte.numberFormat?.decimal || '.') })) || [{standardConcentration:'',response:''}]); } })
            .catch(() => { if (current) setError(t('calculations.unavailable')); });
        return () => { current = false; };
    },[batch.id,batch.startedAt,analyte.analysisCode,analyte.numberFormat?.decimal,revision,t]);
    if (!batch.startedAt || state && !state.active?.requiresCurve) return null;
    const locked = !canEdit || batch.status === 'CLOSED' || ['QC_FAIL','REJECTED','REPEAT_ORDERED','CLOSED'].includes(analyte.status) || Boolean(analyte.disposition);
    const save = async () => {
        setBusy(true); setError(null);
        try {
            await axios.post(`/api/qc/batches/${batch.id}/calibration-curves`,{analysisCode:analyte.analysisCode,
                activationId:state.active.activationId,templateId:state.active.templateId,templateVersion:state.active.templateVersion,
                expectedCurveId:state.latest?.id || null,points,reason:reason.trim() || null});
            setRevision(value => value+1); await onChanged?.();
        } catch { setError(t('calculations.saveRefused')); }
        finally { setBusy(false); }
    };
    return <section className="p-3 border border-sf-divider rounded-xl space-y-2" data-testid="calibration-curve-panel">
        <h3 className="font-semibold text-sm">{t('calculations.curve')}</h3>
        {error && <p role="alert">{error}</p>}
        {state?.criteria && <p className="text-xs">{t('calculations.minimumLevels')}: {state.criteria.curveMinPoints.value}
            {' · '}{t('calculations.minimumR')}: {state.criteria.curveMinR.value}</p>}
        {state?.latest && <p className="text-xs" data-testid="calibration-latest">
            {t('calculations.revision')} {state.latest.revision} · {state.latest.status} · r={state.latest.r ?? '—'} · r²={state.latest.rSquared ?? '—'}
            {' · '}{t('calculations.appliedLimits')}: {state.latest.minPointsApplied} / {state.latest.minRApplied}</p>}
        {state?.active?.requiresCurve && <>
            {points.map((point,index) => <div className="grid grid-cols-2 gap-2" key={index}>
                {['standardConcentration','response'].map(key => <label className="text-xs grid gap-1" key={key}>
                    {t(`calculations.${key}`)} {key === 'standardConcentration' ? '(mg/L)' : ''}
                    <BarcodeSafeInput aria-label={`${t(`calculations.${key}`)} ${index+1}`} inputMode="decimal" value={point[key]}
                        disabled={locked || busy} onBarcodeRejected={onBarcodeRejected}
                        onChange={event => setPoints(rows => rows.map((row,i) => i === index ? {...row,[key]:event.target.value} : row))}
                        className="p-2 border border-sf-divider rounded bg-sf-canvas" />
                </label>)}
            </div>)}
            <button type="button" disabled={locked || busy} onClick={() => setPoints(rows => [...rows,{standardConcentration:'',response:''}])}
                className="px-3 py-2 border rounded">{t('calculations.addStandard')}</button>
            <label className="grid gap-1 text-xs">{t('calculations.reason')}<textarea value={reason} disabled={locked || busy}
                onChange={event => setReason(event.target.value)} className="p-2 border rounded bg-sf-canvas" /></label>
            <button type="button" disabled={locked || busy || !points.length || state.latest && !reason.trim()}
                onClick={save} className="btn-primary px-3 py-2">{t('calculations.recordCurve')}</button>
            <details className="text-xs"><summary>{t('calculations.curveHistory')}</summary>
                {state.rows.map(row => <div key={row.id} className="p-2 border-b">
                    {t('calculations.revision')} {row.revision} · {row.status} · {row.recordedBy} · {row.reason}
                    <table className="w-full"><tbody>{row.points.map(point => <tr key={point.ordinal}><td>{point.standardConcentration}</td><td>{point.response}</td></tr>)}</tbody></table>
                </div>)}
            </details>
        </>}
    </section>;
}
