import React from 'react';

export default function PracticeReviewReturn({ sample, reviewReason = '', reviewSubmitted = false, onUpdate, onMarkDone, t }) {
    const handleReturn = () => {
        if (!reviewReason || !reviewReason.trim()) return;
        onUpdate('reviewSubmitted', true);
        onMarkDone();
    };

    const handleReasonChange = (val) => {
        onUpdate('reviewReason', val);
        onUpdate('reviewSubmitted', false);
    };

    let statusText = t('practice.review.initialStatus', 'A meaningful reason is required before returning a result.');
    if (reviewSubmitted && reviewReason && reviewReason.trim()) {
        statusText = `${t('practice.review.handoverPrefix', 'Practice handover to technician:')} ${reviewReason.trim()}`;
    }

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
                        onChange={(e) => handleReasonChange(e.target.value)}
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
                    {statusText}
                </div>
            </div>
        </>
    );
}
