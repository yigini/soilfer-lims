import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { useLanguage } from '../../context/LanguageContext';

export default function ContainerLabelDialog({ container, sampleCode, onClose }) {
    const { t } = useLanguage();
    const [qr, setQr] = useState(''), [error, setError] = useState(false);
    useEffect(() => {
        let current = true; setQr(''); setError(false);
        QRCode.toDataURL(container.code, { width: 240, margin: 1 }).then(url => { if (current) setQr(url); })
            .catch(() => { if (current) setError(true); });
        return () => { current = false; };
    }, [container.code]);
    const label = <div className="container-label-card">
        <div><strong>{container.code}</strong><div>{t(`containers.kinds.${container.kind}`)}</div>
            <div>{t('containers.sample')}: {sampleCode}</div>{container.massG != null && <div>{container.massG} g</div>}</div>
        {qr && <img src={qr} alt={container.code} width="100" height="100" />}
    </div>;
    return <>
        <style>{`.container-label-card { display:flex; align-items:center; justify-content:space-between; width:100mm; height:50mm; padding:4mm; box-sizing:border-box; background:white; color:black; font:12pt sans-serif; overflow-wrap:anywhere; gap:3mm; }
        #container-label-print { display:none; }
        @media print { @page { size:100mm 50mm; margin:0; } body > * { display:none !important; } body > #container-label-print { display:block !important; } }`}</style>
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={t('containers.print')}>
            <div className="rounded-xl bg-sf-surface p-4 max-w-full overflow-auto">
                {label}{error && <p role="alert">{t('containers.labelFailed')}</p>}
                <div className="flex justify-end gap-3 mt-3">
                    <button type="button" onClick={onClose}>{t('common.close', 'Close')}</button>
                    <button type="button" disabled={!qr} onClick={() => window.print()}>{t('containers.print')}</button>
                </div>
            </div>
        </div>
        {createPortal(<div id="container-label-print">{label}</div>, document.body)}
    </>;
}
