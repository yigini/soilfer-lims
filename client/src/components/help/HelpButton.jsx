import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useHelp } from '../../context/HelpContext';
import { useLanguage } from '../../context/LanguageContext';
import clsx from 'clsx';

export const HelpButton = ({ className = '', showLabel = true, articleId = null }) => {
    const { openDrawer } = useHelp();
    const { t } = useLanguage();

    const handleClick = (e) => {
        e.preventDefault();
        openDrawer(articleId, e.currentTarget);
    };

    return (
        <button
            type="button"
            id="sf-help-trigger-btn"
            onClick={handleClick}
            className={clsx(
                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200",
                "bg-sf-primary/10 text-sf-primary hover:bg-sf-primary/20 border border-sf-primary/20 hover:border-sf-primary/40",
                "focus:outline-none focus:ring-2 focus:ring-sf-primary/40",
                className
            )}
            aria-label={t('help.context', 'Help with this page')}
            title={t('help.context', 'Help with this page')}
        >
            <HelpCircle size={15} aria-hidden="true" />
            {showLabel && <span>{t('help.help', 'Help')}</span>}
        </button>
    );
};

export default HelpButton;
