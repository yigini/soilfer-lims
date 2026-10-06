import { useLanguage } from '../../context/LanguageContext';

export default function SampleHoldBadge({ held }) {
    const { t } = useLanguage();
    return held ? <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-[var(--sf-warning-bg)] text-[var(--sf-warning)]">
        {t('sampleHolds.badge')}
    </span> : null;
}
