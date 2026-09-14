import React from 'react';

function getCurvePath() {
    let p = '';
    for (let i = 0; i < 160; i++) {
        let x = 20 + i * 2.6;
        let y = 52 + Math.sin(i * 0.13) * 7 + Math.exp(-Math.pow((i - 38) / 5, 2)) * 65 + Math.exp(-Math.pow((i - 91) / 10, 2)) * 45 + Math.sin(i * 0.55) * 2;
        p += (i ? ' L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }
    return p;
}

export default function PracticeSpectra({ sample, spectrumLoaded, onUpdate, onMarkDone, t }) {
    const handleLoad = () => {
        onUpdate('spectrumLoaded', true);
        onMarkDone();
    };

    return (
        <>
            <div className="panel focus">
                <div className="row">
                    <h3>{t('practice.spectra.title', 'Spectral file practice')}</h3>
                    <span className="badge clay">{t('practice.spectra.tag', 'Synthetic curve')}</span>
                </div>
                <div id="curveArea">
                    {spectrumLoaded ? (
                        <svg
                            className="spectrum"
                            viewBox="0 0 455 174"
                            role="img"
                            aria-label={t('practice.spectra.ariaSvg', 'Illustrative MIR curve, wavenumber descending from 4000 to 400 inverse centimetres')}
                        >
                            <path d="M20 20 V143 H436" stroke="#becdbc" fill="none" />
                            <path d={getCurvePath()} fill="none" stroke="#457558" strokeWidth="2" />
                            <text x="20" y="163" fill="#6a796a" fontSize="10">4000</text>
                            <text x="395" y="163" fill="#6a796a" fontSize="10">400 cm⁻¹</text>
                            <text x="25" y="17" fill="#6a796a" fontSize="10">
                                {t('practice.spectra.svgLabel', 'Illustrative relative signal · synthetic, not an instrument export')}
                            </text>
                        </svg>
                    ) : (
                        <div className="note" style={{ margin: '18px 0' }}>
                            {t('practice.spectra.note', 'A source spectrum contains a sequence of measurements across a spectral axis.')}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    className="primary"
                    id="loadSpectrum"
                    onClick={handleLoad}
                >
                    {spectrumLoaded
                        ? t('practice.spectra.btnLoaded', 'Illustrative curve loaded')
                        : t('practice.spectra.btnLoad', 'Load illustrative curve')}
                </button>
                <div className="drawer-info">
                    <b>{t('practice.spectra.infoSample', 'Sample')}</b> TRAIN-US-00{sample}<br />
                    <b>{t('practice.spectra.infoFile', 'File')}</b> {t('practice.spectra.fileDesc', 'illustrative-spectrum.csv · not an instrument export')}<br />
                    <b>{t('practice.spectra.infoQuality', 'Quality')}</b> {t('practice.spectra.qualityDesc', 'not assessed · no predictions generated')}
                </div>
            </div>
            <div className="ribbon">
                {t('practice.spectra.ribbon', 'A raw scan, a quality-checked spectrum and an approved prediction are different records.')}
            </div>
        </>
    );
}
