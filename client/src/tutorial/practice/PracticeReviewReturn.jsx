import React, { useState } from 'react';

export default function PracticeReviewReturn({ sample, reviewReason, onUpdate, onMarkDone, t }) {
    const [status, setStatus] = useState(
        t('practice.review.initialStatus', 'A meaningful reason is required before returning a result.')
    );

    const handleReturn = () => {
        if (!reviewReason || !reviewReason.trim()) return;
        setStatus(`${t('practice.review.handoverPrefix', 'Practice handover to technician:')} ${reviewReason.trim()}`);
        onMarkDone();
    };

    return (
        <>
            <div className="panel">
                <div className="row">
                    <h3>Texture · TRAIN-US-00{sample}</h3>
                    <span className="badge clay">{t('practice.review.badgeExample', 'Review example')}</span>
                </div>
                <p className="small muted">
                    Sand 35% · Silt 35% · Clay 30%<br />
                    {t('practice.review.qcNote', 'QC evidence: needs inspection, not assumed PASS.')}
                </p>
            </div>
            <div className="panel focus">
                <h3>{t('practice.review.title', 'Return for correction')}</h3>
                <label className="label" style={{ marginTop: '12px' }}>
                    {t('practice.review.label', 'Tell the technician what to check')}
                    <input
                        id="reason"
                        value={reviewReason}
                        onChange={(e) => onUpdate('reviewReason', e.target.value)}
                        placeholder={t('practice.review.placeholder', 'For example: verify the replicate discrepancy')}
                    />
                </label>
                <button
                    type="button"
                    className="primary"
                    id="returnPractice"
                    disabled={!reviewReason || !reviewReason.trim()}
                    onClick={handleReturn}
                >
                    {t('practice.review.button', 'Practice returning the result')}
                </button>
                <div className="status" id="reviewStatus" role="status">
                    {status}
                </div>
            </div>
        </>
    );
}
