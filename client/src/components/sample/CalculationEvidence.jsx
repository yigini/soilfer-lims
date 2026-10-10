import React from 'react';

const parsed = (value,fallback) => {
    if (typeof value !== 'string') return value ?? fallback;
    try { return JSON.parse(value); } catch { return fallback; }
};

// Display the recorded snapshot. Review/history never run the calculation
// engine or resolve today's template activation or calibration.
export default function CalculationEvidence({ evidence, t }) {
    if (!evidence) return null;
    const inputs = parsed(evidence.inputs,{}), parameters = parsed(evidence.parameters,[]);
    const definitions = parsed(evidence.template?.inputs,[]), intermediate = parsed(evidence.intermediate,{});
    return <details className="my-2 p-2 border border-sf-divider rounded" data-testid={`calculation-evidence-${evidence.resultId || evidence.id || 'preview'}`}>
        <summary>{t('calculations.frozenCalculation')} · {evidence.template?.variant || evidence.templateId} · v{evidence.templateVersion}</summary>
        <div className="space-y-2 mt-2">
            <p>{evidence.output} {evidence.outputUnit} · {evidence.engineVersion}
                {evidence.computedBy && <> · {evidence.computedBy}</>}
                {evidence.computedAt && <> · {new Date(evidence.computedAt).toLocaleString()}</>}</p>
            <h5 className="font-semibold">{t('calculations.rawInputs')}</h5>
            <table className="text-left"><tbody>{Object.entries(inputs).map(([key,value]) => <tr key={key}>
                <th className="pr-3 font-normal">{t(`calculations.inputs.${key}`,definitions.find(row => row.key === key)?.label || key)}</th>
                <td className="pr-2">{String(value)}</td><td>{definitions.find(row => row.key === key)?.unit || ''}</td>
            </tr>)}</tbody></table>
            <p>{t('calculations.template')}: {evidence.templateId} · v{evidence.templateVersion} · {evidence.activationId}</p>
            <table className="text-left"><tbody>{parameters.map(row => <tr key={row.key}>
                <th className="pr-3 font-normal">{t(`calculations.parameters.${row.key}`,row.label || row.key)}</th>
                <td className="pr-2">{row.value}</td><td>{row.unit}</td>
            </tr>)}</tbody></table>
            <p>{evidence.nativeValue} {evidence.nativeUnit} × {evidence.conversionFactor} = {evidence.unroundedOutput} {evidence.outputUnit}</p>
            {evidence.curveId && <div className="space-y-1">
                <p>{t('calculations.curve')}: {evidence.curveId} · {t('calculations.revision')} {evidence.curve?.revision ?? intermediate.curveRevision}</p>
                <p>{intermediate.extractConcentration} {intermediate.calibrationUnit} / {intermediate.calibrationMax} {intermediate.calibrationUnit}</p>
                {evidence.curve && <>
                    <p>r={evidence.curve.r} · r²={evidence.curve.rSquared} · y={evidence.curve.slope}x + {evidence.curve.intercept}</p>
                    <p>{t('calculations.appliedLimits')}: {evidence.curve.minPointsApplied} / {evidence.curve.minRApplied}</p>
                    <table className="text-left"><thead><tr><th className="pr-3">{t('calculations.standardConcentration')}</th><th>{t('calculations.response')}</th></tr></thead>
                        <tbody>{evidence.curve.points.map(point => <tr key={point.ordinal}><td>{point.standardConcentration}</td><td>{point.response}</td></tr>)}</tbody></table>
                </>}
                {intermediate.aboveRange && <p className="text-amber-700 dark:text-amber-300">{t('calculations.aboveRange')}</p>}
            </div>}
        </div>
    </details>;
}
