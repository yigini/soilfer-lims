import React, { useState } from 'react';

export default function PracticePreparation({ checks, onUpdate, onMarkDone, t }) {
    const [verified, setVerified] = useState(false);

    const labels = [
        t('practice.prep.check0', 'Match the sample label to its intake record.'),
        t('practice.prep.check1', 'Verify the applicable drying and preparation records.'),
        t('practice.prep.check2', 'Confirm prepared portions are labelled for their analyses.')
    ];

    const handleToggle = (index) => {
        const next = [...checks];
        next[index] = !next[index];
        onUpdate('checks', next);
        setVerified(false);
    };

    const handleVerify = () => {
        setVerified(true);
        onMarkDone();
    };

    const allChecked = checks.length === 3 && checks.every(Boolean);
    const checkedCount = checks.filter(Boolean).length;

    return (
        <div className="panel focus">
            <h3>{t('practice.prep.title', 'Preparation practice')}</h3>
            <div className="stack" style={{ marginTop: '14px' }}>
                {labels.map((label, i) => (
                    <div className="check" key={i}>
                        <input
                            type="checkbox"
                            id={`check${i}`}
                            checked={!!checks[i]}
                            onChange={() => handleToggle(i)}
                        />
                        <label htmlFor={`check${i}`}>{label}</label>
                    </div>
                ))}
            </div>
            <button
                type="button"
                className="primary"
                id="verifyChecks"
                disabled={!allChecked}
                onClick={handleVerify}
                style={{ marginTop: '16px' }}
            >
                {t('practice.prep.button', 'Verify practice checklist')}
            </button>
            <div id="prepStatus" className="status" role="status">
                {verified
                    ? t('practice.prep.verifiedStatus', 'Practice checklist verified. No actual preparation record was changed.')
                    : t('practice.prep.countSelected', '{count} of 3 checks selected.').replace('{count}', String(checkedCount))}
            </div>
        </div>
    );
}
