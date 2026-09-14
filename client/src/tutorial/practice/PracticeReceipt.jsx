import React from 'react';

export default function PracticeReceipt({ sample, receiptStatusCode = 'initial', onUpdate, onMarkDone, t }) {
    const handleConfirm = () => {
        onUpdate('receiptStatusCode', 'confirmed');
        onMarkDone();
    };

    const handleReset = () => {
        onUpdate('receiptStatusCode', 'initial');
    };

    const isConfirmed = receiptStatusCode === 'confirmed';
    const sampleCode = sample?.id || `TRAIN-US-00${sample?.tube || 1}`;

    const statusText = isConfirmed
        ? t('practice.receipt.confirmed', 'Arrival confirmed: Synthetic receipt logged. Physical container verified for preparation and testing.')
        : t('practice.receipt.pending', 'Inspect container custody seal and confirm physical arrival in the laboratory.');

    return (
        <div className="panel focus" id="practiceReceiptPanel">
            <div className="row">
                <h3>{t('practice.receipt.title', 'Confirm physical arrival')}</h3>
                <span className="badge clay">{t('practice.tag', 'Local exercise')}</span>
            </div>
            <div className="stack small" style={{ marginTop: '12px', fontSize: '12px' }}>
                <p><b>{t('common.tableSampleId', 'Sample ID')}:</b> {sampleCode}</p>
                <p><b>{t('practice.receipt.custodyLabel', 'Chain of custody')}:</b> {t('practice.receipt.custodyOk', 'Verified container seal & dispatch voucher intact')}</p>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                <button
                    type="button"
                    className="primary"
                    id="confirmArrival"
                    disabled={isConfirmed}
                    onClick={handleConfirm}
                >
                    {t('practice.receipt.confirmBtn', 'Confirm arrival & generate receipt')}
                </button>
                {isConfirmed && (
                    <button
                        type="button"
                        className="quiet"
                        id="resetArrival"
                        onClick={handleReset}
                    >
                        {t('common.reset', 'Reset')}
                    </button>
                )}
            </div>
            <div
                id="receiptStatus"
                role="status"
                className={`status ${isConfirmed ? 'success' : ''}`}
                style={{ marginTop: '12px' }}
            >
                {statusText}
            </div>
        </div>
    );
}
