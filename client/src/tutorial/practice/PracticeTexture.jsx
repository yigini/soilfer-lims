import React from 'react';

export default function PracticeTexture({ texture, onUpdate, onMarkDone, t }) {
    const vals = texture.map(v => {
        const s = String(v).trim();
        return s === '' ? NaN : Number(s.replace(',', '.'));
    });

    const valid = vals.every(v => Number.isFinite(v) && v >= 0 && v <= 100);
    const total = valid ? vals.reduce((a, b) => a + b, 0) : NaN;
    const ok = valid && Math.abs(total - 100) < 0.00001;

    const handleChange = (index, value) => {
        const next = [...texture];
        next[index] = value;
        onUpdate('texture', next);

        // Check if now valid
        const nextVals = next.map(v => {
            const s = String(v).trim();
            return s === '' ? NaN : Number(s.replace(',', '.'));
        });
        const nextValid = nextVals.every(v => Number.isFinite(v) && v >= 0 && v <= 100);
        const nextTotal = nextValid ? nextVals.reduce((a, b) => a + b, 0) : NaN;
        if (nextValid && Math.abs(nextTotal - 100) < 0.00001) {
            onMarkDone();
        }
    };

    const labels = [
        t('practice.texture.sand', 'Sand'),
        t('practice.texture.silt', 'Silt'),
        t('practice.texture.clay', 'Clay')
    ];

    return (
        <>
            <div className="panel focus">
                <div className="metric-grid">
                    {labels.map((label, i) => (
                        <label className="label" key={i}>
                            {label} (%)
                            <input
                                id={`texture${i}`}
                                inputMode="decimal"
                                value={texture[i]}
                                onChange={(e) => handleChange(i, e.target.value)}
                            />
                        </label>
                    ))}
                </div>
                <div className="row" style={{ marginTop: '24px' }}>
                    <div>
                        <div className="caps">{t('practice.texture.practiceTotal', 'Practice total')}</div>
                        <strong className="num" id="textureTotal">
                            {Number.isFinite(total) ? `${total.toFixed(1)}%` : '—'}
                        </strong>
                    </div>
                    <span
                        className={`badge ${ok ? '' : 'clay'}`}
                        id="textureBadge"
                    >
                        {ok
                            ? t('practice.texture.badgeCloses', 'Closes to 100%')
                            : t('practice.texture.badgeCheck', 'Check the fractions')}
                    </span>
                </div>
                <div
                    className={`status ${ok ? '' : 'error'}`}
                    id="textureStatus"
                    role="status"
                >
                    {ok
                        ? t('practice.texture.statusOk', 'Practice values close correctly. The real method defines precision and tolerance.')
                        : t('practice.texture.statusError', 'Use 0–100% for each fraction and make this practice total equal 100%.')}
                </div>
            </div>
            <div className="panel">
                <h3>{t('practice.texture.classTitle', 'And the texture class?')}</h3>
                <p className="small muted">
                    {t('practice.texture.classDesc', 'The production report should use the validated classification rule and result revision. This guide does not calculate a substitute class.')}
                </p>
            </div>
        </>
    );
}
