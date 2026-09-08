import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun, Moon, Check, Sparkles } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export const ThemeToggle = () => {
    const {
        appearance,
        appearanceSource,
        setSessionAppearance,
        clearSessionAppearance
    } = useTheme();
    const { user } = useAuth();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef(null);
    const popoverRef = useRef(null);

    const toggleOpen = useCallback(() => {
        setIsOpen(prev => !prev);
    }, []);

    const closePopover = useCallback(() => {
        setIsOpen(false);
        triggerRef.current?.focus();
    }, []);

    // Handle click outside and Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target) &&
                triggerRef.current &&
                !triggerRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closePopover();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, closePopover]);

    const handleSelectTheme = (mode) => {
        setSessionAppearance(mode);
        setIsOpen(false);
    };

    const handleClearOverride = () => {
        clearSessionAppearance();
        setIsOpen(false);
    };

    const handleGoToProfile = () => {
        setIsOpen(false);
        navigate('/profile?tab=appearance');
    };

    return (
        <div className="relative inline-block text-left">
            <button
                ref={triggerRef}
                onClick={toggleOpen}
                className={`p-2 rounded-full transition-colors flex items-center justify-center relative focus:outline-none focus:ring-2 focus:ring-sf-focus ${
                    isOpen
                        ? 'bg-sf-hover text-sf-text'
                        : 'text-sf-muted hover:text-sf-text hover:bg-sf-hover'
                }`}
                title={t('appearance.title', 'Appearance')}
                aria-label={t('appearance.title', 'Appearance')}
                aria-haspopup="true"
                aria-expanded={isOpen}
                aria-controls="appearance-popover"
            >
                {appearance === 'dark' ? (
                    <Sun size={20} className="text-amber-400" />
                ) : (
                    <Moon size={20} className="text-sf-muted" />
                )}
                {appearanceSource === 'session' && (
                    <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sf-primary ring-2 ring-sf-surface"
                        title={t('appearance.activeSessionNotice', 'Session override active for this tab')}
                    />
                )}
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    id="appearance-popover"
                    role="dialog"
                    aria-label={t('appearance.title', 'Appearance')}
                    className="absolute right-0 mt-2 w-64 rounded-xl border border-sf-divider bg-sf-raised p-3 text-sf-text shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 focus:outline-none"
                >
                    <div className="flex items-center justify-between pb-1.5">
                        <div className="text-sm font-bold text-sf-text">
                            {t('appearance.title', 'Appearance')}
                        </div>
                        {appearanceSource === 'session' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sf-warning-bg text-sf-warning">
                                Session
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-sf-muted mb-2.5">
                        {t('appearance.sessionNotice', 'Changes apply to this session.')}
                    </p>

                    <div className="space-y-1">
                        <button
                            type="button"
                            onClick={() => handleSelectTheme('light')}
                            aria-pressed={appearance === 'light'}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                appearance === 'light'
                                    ? 'bg-sf-selected text-sf-success font-bold'
                                    : 'text-sf-text hover:bg-sf-hover'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Sun size={15} className="text-amber-500" />
                                {t('appearance.light', 'Light')}
                            </span>
                            {appearance === 'light' && <Check size={14} className="text-sf-success" />}
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSelectTheme('dark')}
                            aria-pressed={appearance === 'dark'}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                                appearance === 'dark'
                                    ? 'bg-sf-selected text-sf-success font-bold'
                                    : 'text-sf-text hover:bg-sf-hover'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <Moon size={15} className="text-sf-muted" />
                                {t('appearance.dark', 'Dark · Graphite')}
                            </span>
                            {appearance === 'dark' && <Check size={14} className="text-sf-success" />}
                        </button>
                    </div>

                    <hr className="my-2.5 border-sf-divider" />

                    <div className="pt-0.5 space-y-1.5">
                        {appearanceSource === 'session' && (
                            <button
                                type="button"
                                onClick={handleClearOverride}
                                className="w-full text-left text-xs font-medium text-sf-link hover:underline py-1"
                            >
                                {t('appearance.useSavedDefault', 'Use my saved default')}
                            </button>
                        )}

                        {user ? (
                            <button
                                type="button"
                                onClick={handleGoToProfile}
                                className="w-full text-left text-xs font-medium text-sf-link hover:underline flex items-center justify-between py-1"
                            >
                                <span>{t('appearance.saveDefaultInProfile', 'Save a default in Profile →')}</span>
                            </button>
                        ) : (
                            <p className="text-[11px] text-sf-muted italic py-0.5">
                                {t('appearance.signInToSave', 'Sign in to save a default.')}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThemeToggle;
