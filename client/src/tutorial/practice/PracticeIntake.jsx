import React, { useState } from 'react';

export default function PracticeIntake({ sample, mass, condition, onUpdate, onMarkDone, t }) {
    const [status, setStatus] = useState({
        text: t('practice.intake.initialStatus', 'Match the label and enter a positive mass.'),
        isError: false
    });

    const handleCheck = () => {
        const m = Number(String(mass).replace(',', '.'));
        const ok = String(mass).trim() !== '' && Number.isFinite(m) && m > 0 && condition === 'intact';

        if (ok) {
            setStatus({
                text: t('practice.intake.success', 'Practice checked: the container matches and a positive mass is recorded in this exercise.'),
                isError: false
            });
            onMarkDone();
        } else {
            setStatus({
                text: t('practice.intake.error', 'Check the container identity and enter a positive mass. A mismatch needs resolution.'),
                isError: true
            });
        }
    };

    return (
        <div className="panel focus">
            <div className="row">
                <h3>{t('practice.intake.title', 'Physical arrival')}</h3>
                <span className="badge clay">{t('practice.tag', 'Local exercise')}</span>
            </div>
            <div className="form-grid" style={{ marginTop: '14px' }}>
                <label className="label">
                    {t('practice.intake.massLabel', 'Received mass (g)')}
                    <input
                        id="mass"
                        inputMode="decimal"
                        value={mass}
                        onChange={(e) => onUpdate('intakeMass', e.target.value)}
                        placeholder="e.g. 485.2"
                    />
                </label>
                <label className="label">
                    {t('practice.intake.conditionLabel', 'Container condition')}
                    <select
                        id="condition"
                        value={condition}
                        onChange={(e) => onUpdate('condition', e.target.value)}
                    >
                        <option value="intact">{t('practice.intake.condIntact', 'Container intact')}</option>
                        <option value="mismatch">{t('practice.intake.condMismatch', 'Label does not match')}</option>
                    </select>
                </label>
            </div>
            <button
                type="button"
                className="primary"
                id="practiceIntake"
                onClick={handleCheck}
                style={{ marginTop: '16px' }}
            >
                {t('practice.intake.button', 'Check this practice intake')}
            </button>
            <div
                id="intakeStatus"
                role="status"
                className={`status ${status.isError ? 'error' : ''}`}
            >
                {status.text}
            </div>
        </div>
    );
}
