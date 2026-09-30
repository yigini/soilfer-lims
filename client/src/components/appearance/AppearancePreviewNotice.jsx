/**
 * SoilFER LIMS - Appearance Preview Notice Banner
 *
 * Appears when an interactive full-screen preview is active.
 * Reversible and safe: does not persist changes to the server until explicitly saved.
 */

import React from 'react';
import { Eye, X, Check, Undo2 } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export const AppearancePreviewNotice = () => {
    const {
        isPreviewActive,
        previewOverride,
        activeTheme,
        appearance,
        clearPreviewTheme,
        savePersonalPreferences
    } = useTheme();
    const { t } = useLanguage();

    if (!isPreviewActive) return null;

    const handleSaveCurrent = async () => {
        try {
            await savePersonalPreferences({
                themeId: previewOverride?.themeId,
                modePreference: previewOverride?.mode || appearance
            });
        } catch (err) {
            console.error('[PREVIEW] Failed to save preview as default:', err);
        }
    };

    return (
        <aside
            role="region"
            aria-label={t('appearance.previewNoticeAria', 'Theme preview active banner')}
            className="fixed top-0 inset-x-0 z-50 bg-sf-sidebar text-sf-side-text border-b border-sf-control/30 shadow-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm animate-in slide-in-from-top-2 duration-200"
        >
            <div className="flex items-center gap-2.5">
                <div className="p-1 rounded-md bg-sf-primary text-sf-on-primary">
                    <Eye size={16} />
                </div>
                <div>
                    <span className="font-bold">
                        {t('appearance.previewing', 'Previewing')}: {activeTheme?.name || 'Theme'} ({appearance === 'dark' ? t('appearance.dark', 'Dark') : t('appearance.light', 'Light')})
                    </span>
                    <span className="hidden sm:inline text-sf-side-muted ml-2">
                        — {t('appearance.previewUnsavedNotice', 'Temporary preview only. Your saved default is unchanged.')}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={clearPreviewTheme}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sf-control/40 hover:bg-sf-hover/20 font-medium transition-colors touch-target sm:min-h-0 sm:min-w-0"
                    title={t('appearance.exitPreview', 'Exit preview')}
                >
                    <Undo2 size={15} />
                    <span>{t('appearance.exitPreview', 'Exit preview')}</span>
                </button>

                <button
                    type="button"
                    onClick={handleSaveCurrent}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sf-primary text-sf-on-primary font-bold hover:bg-sf-primary-hover shadow-sm transition-colors touch-target sm:min-h-0 sm:min-w-0"
                    title={t('appearance.saveForMe', 'Save for me')}
                >
                    <Check size={15} />
                    <span>{t('appearance.saveForMe', 'Save for me')}</span>
                </button>
            </div>
        </aside>
    );
};

export default AppearancePreviewNotice;
