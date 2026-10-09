import { useLanguage } from '../../context/LanguageContext';

export const RETURN_REASON_CODES = Object.freeze([
    'REVIEW_OUTLIER', 'DUPLICATE_DISAGREEMENT', 'CONFIRMATION', 'QC_BATCH_FAIL',
    'ABOVE_RANGE_DILUTION', 'INSTRUMENT_FAULT', 'PREP_ERROR', 'OTHER'
]);

export default function RepeatReasonFields({ reasonCode, note, onReasonChange, onNoteChange }) {
    const { t } = useLanguage();
    return (
        <div className="space-y-3 mb-4">
            <label className="block text-xs font-bold text-sf-text">
                {t('repeatCommands.reasonLabel')}
                <select value={reasonCode} onChange={event => onReasonChange(event.target.value)}
                    className="block w-full mt-1 p-2 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text" required>
                    <option value="">{t('repeatCommands.chooseReason')}</option>
                    {RETURN_REASON_CODES.map(code => <option key={code} value={code}>{t(`repeatCommands.reasons.${code}`)}</option>)}
                </select>
            </label>
            <label className="block text-xs font-bold text-sf-text">
                {t('repeatCommands.noteLabel')}
                <textarea value={note} onChange={event => onNoteChange(event.target.value)}
                    placeholder={t('repeatCommands.notePlaceholder')}
                    className="block w-full mt-1 text-xs p-3 rounded-lg border border-sf-divider bg-sf-canvas text-sf-text outline-none resize-none h-24 focus:border-sf-emerald"
                    required />
            </label>
        </div>
    );
}
