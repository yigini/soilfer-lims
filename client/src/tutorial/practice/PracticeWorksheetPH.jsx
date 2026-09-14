import React from 'react';

export default function PracticeWorksheetPH({ sample, benchValue = '', benchStatusCode = 'initial', onUpdate, onMarkDone, t }) {
    const handleCheck = () => {
        const str = String(benchValue || '').trim();
        const v = Number(str.replace(',', '.'));
        const ok = str !== '' && Number.isFinite(v);

        if (ok) {
            onUpdate('benchStatusCode', 'success');
            onMarkDone();
        } else {
            onUpdate('benchStatusCode', 'error');
        }
    };

    const handleValueChange = (val) => {
        onUpdate('benchValue', val);
        onUpdate('benchStatusCode', 'initial');
    };

    const str = String(benchValue || '').trim();
    const v = Number(str.replace(',', '.'));
    let statusText = t('practice.bench.initialStatus', 'This field belongs to the preview, not the real workbench.');
    let isError = false;
    if (benchStatusCode === 'success') {
        const numStr = Number.isFinite(v) ? v.toFixed(2) : '';
        statusText = `${t('practice.bench.previewPrefix', 'Practice preview:')} ${numStr}. ${t('practice.bench.previewSuffix', 'In LIMS, confirm the configured method and limits before recording.')}`;
    } else if (benchStatusCode === 'error') {
        statusText = t('practice.bench.error', 'Enter a valid numeric reading.');
        isError = true;
    }

    return (
        <>
            <div className="panel focus" style={{ padding: '10px' }}>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('practice.bench.colSample', 'Sample')}</th>
                                <th>{t('practice.bench.colMethod', 'Method')}</th>
                                <th>{t('practice.bench.colReading', 'Reading')}</th>
                                <th>{t('practice.bench.colState', 'State')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3, 4, 5].map(n => (
                                <tr key={n}>
                                    <td><b>TRAIN-US-00{n}</b></td>
                                    <td>{t('practice.bench.methodName', 'pH in water')}</td>
                                    <td>
                                        {n === sample ? (
                                            <input
                                                id="ph"
                                                inputMode="decimal"
                                                aria-label={t('practice.bench.ariaPh', 'Practice pH reading')}
                                                value={benchValue}
                                                onChange={(e) => handleValueChange(e.target.value)}
                                            />
                                        ) : (
                                            <span className="muted">—</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`badge ${n === sample ? '' : 'clay'}`}>
                                            {n === sample
                                                ? t('practice.bench.stateEntry', 'Practice entry')
                                                : t('practice.bench.stateNotEntered', 'Not entered')}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flow" style={{ marginTop: '23px' }}>
                <div className="flow-node">
                    <b>1</b>
                    <strong>{t('practice.bench.step1', 'Draft')}</strong>
                    <span>{t('practice.bench.step1Desc', 'Work in progress')}</span>
                </div>
                <div className="flow-node">
                    <b>2</b>
                    <strong>{t('practice.bench.step2', 'Record determination')}</strong>
                    <span>{t('practice.bench.step2Desc', 'Checked entry')}</span>
                </div>
                <div className="flow-node">
                    <b>3</b>
                    <strong>{t('practice.bench.step3', 'Submit for review')}</strong>
                    <span>{t('practice.bench.step3Desc', 'Reviewer handover')}</span>
                </div>
            </div>

            <button
                type="button"
                className="primary"
                id="practicePH"
                onClick={handleCheck}
            >
                {t('practice.bench.button', 'Check practice reading')}
            </button>
            <div
                className={`status ${isError ? 'error' : ''}`}
                role="status"
                id="phStatus"
            >
                {statusText}
            </div>
        </>
    );
}
