/**
 * SoilFER LIMS - Theme Gallery & Selector Component
 *
 * Implements Section 6 & Phase 3 of WP/sitewide-theme-library-v1:
 * - 7 Curated Theme Family Cards × Light/Dark Mode (14 variants)
 * - Realistic miniature screen preview with canvas, sidebar, cards, and status badge
 * - Scope-aware adoption controls: Personal save, Laboratory default, Platform default
 * - Reversible live preview without losing unsaved inputs
 * - WCAG 2.2 AA compliant contrast, keyboard navigation, and polite status announcements
 * - Named confirmation modals for lab and platform adoption
 * - Conflict detection and retry reconciliation
 */

import React, { useState, useEffect, useCallback, useId, useMemo, useRef } from 'react';
import {
    Sun,
    Moon,
    Check,
    Eye,
    Undo2,
    Save,
    Building2,
    Globe,
    AlertCircle,
    CheckCircle2,
    RotateCcw,
    Layers,
    X,
    RefreshCw
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export const ThemeGallery = ({
    targetScope = 'personal', // 'personal' | 'lab' | 'platform'
    targetLabId = null,
    targetLabName = null,
    targetAppearance: propTargetAppearance = null,
    onSaved = null
}) => {
    const {
        activeThemeId,
        appearance,
        darkMode,
        themeSource,
        modeSource,
        isPreviewActive,
        previewOverride,
        authSubject,
        serverContext,
        themes,
        setPreviewTheme,
        clearPreviewTheme,
        savePersonalPreferences,
        adoptLabDefault,
        adoptPlatformDefault,
        resetPersonalToDefault,
        fetchAppearanceContext,
        getLabAppearance
    } = useTheme();

    const { t } = useLanguage();
    const groupId = useId();
    const modalRef = useRef(null);
    const modalTriggerRef = useRef(null);

    const isSuperAdmin = authSubject?.role === 'SUPER_ADMIN';
    const isLabManager = authSubject?.role === 'LAB_MANAGER';
    const isOrdinaryStaff = !isSuperAdmin && !isLabManager;

    // Resolve effective lab target
    const effectiveLabId = targetLabId || authSubject?.labId || null;

    // Target lab appearance state
    const [targetLabAppearance, setTargetLabAppearance] = useState(propTargetAppearance);
    const [loadingTarget, setLoadingTarget] = useState(false);
    const [targetLoadError, setTargetLoadError] = useState(null);

    useEffect(() => {
        if (targetScope !== 'lab' || !effectiveLabId) {
            setTargetLabAppearance(null);
            return;
        }

        if (propTargetAppearance) {
            setTargetLabAppearance(propTargetAppearance);
            return;
        }

        if (serverContext?.labDefault && serverContext.labDefault.labId === effectiveLabId) {
            setTargetLabAppearance(serverContext.labDefault);
            return;
        }

        if (typeof getLabAppearance === 'function') {
            let active = true;
            setLoadingTarget(true);
            setTargetLoadError(null);
            getLabAppearance(effectiveLabId)
                .then(data => {
                    if (active && data) {
                        setTargetLabAppearance(data);
                    }
                })
                .catch(err => {
                    if (active) {
                        setTargetLoadError(err.message || 'Failed to load target laboratory settings');
                    }
                })
                .finally(() => {
                    if (active) setLoadingTarget(false);
                });
            return () => { active = false; };
        }
    }, [targetScope, effectiveLabId, serverContext?.labDefault, getLabAppearance]);

    // Initialize drafts based on targetScope
    const initialThemeId = useMemo(() => {
        if (targetScope === 'personal') {
            return authSubject?.savedThemeId || null;
        }
        if (targetScope === 'lab') {
            if (targetLabAppearance) {
                return targetLabAppearance.themeId ?? null;
            }
            if (serverContext?.labDefault && serverContext.labDefault.labId === effectiveLabId) {
                return serverContext.labDefault.themeId || null;
            }
            return null; // preserve null/inherit instead of Forest fallback
        }
        if (targetScope === 'platform') {
            return serverContext?.platformDefault?.themeId || 'soilfer-classic';
        }
        return activeThemeId;
    }, [targetScope, authSubject?.savedThemeId, targetLabAppearance, serverContext?.labDefault, effectiveLabId, activeThemeId]);

    const initialMode = useMemo(() => {
        if (targetScope === 'personal') {
            return (authSubject?.savedModePreference === 'light' || authSubject?.savedModePreference === 'dark' || authSubject?.savedModePreference === 'inherit')
                ? authSubject.savedModePreference
                : 'inherit';
        }
        if (targetScope === 'lab') {
            if (targetLabAppearance) {
                return targetLabAppearance.defaultMode || 'inherit';
            }
            if (serverContext?.labDefault && serverContext.labDefault.labId === effectiveLabId) {
                return serverContext.labDefault.defaultMode || 'inherit';
            }
            return 'inherit';
        }
        if (targetScope === 'platform') {
            return serverContext?.platformDefault?.defaultMode || 'light';
        }
        return appearance;
    }, [targetScope, authSubject?.savedModePreference, targetLabAppearance, serverContext?.labDefault, effectiveLabId, appearance]);

    // Local draft state - preserve initialMode (do not convert inherit to explicit Light)
    const [draftThemeId, setDraftThemeId] = useState(initialThemeId);
    const [draftMode, setDraftMode] = useState(initialMode);
    const [saving, setSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ type: null, text: '' });
    const [conflictError, setConflictError] = useState(null);
    const [pendingConfirm, setPendingConfirm] = useState(null); // 'lab' | 'platform' | null

    // Sync draft if targetScope or server data updates and preview is not active
    useEffect(() => {
        if (!isPreviewActive) {
            setDraftThemeId(initialThemeId);
            setDraftMode(initialMode);
        }
    }, [initialThemeId, initialMode, isPreviewActive]);

    // Keyboard and focus management for modal
    useEffect(() => {
        if (!pendingConfirm || typeof document === 'undefined') return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                setPendingConfirm(null);
            } else if (e.key === 'Tab' && modalRef.current) {
                const focusables = modalRef.current.querySelectorAll('button:not([disabled]), [tabindex="0"]');
                if (focusables.length === 0) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (modalTriggerRef.current && typeof modalTriggerRef.current.focus === 'function') {
                modalTriggerRef.current.focus();
            }
        };
    }, [pendingConfirm]);

    // Check if user is allowed to select this theme palette
    const isThemeSelectable = (themeId) => {
        if (targetScope !== 'personal') return true;
        if (isSuperAdmin || isLabManager) return true;
        // Non-manager staff can only explicitly select Clear Contrast (the accessibility option)
        return themeId === 'clear-contrast';
    };

    // Handle card click
    const handleSelectCard = (themeId) => {
        if (!isThemeSelectable(themeId)) {
            setStatusMessage({
                type: 'info',
                text: t('appearance.staffInheritNotice', 'Staff accounts inherit laboratory themes. Clear Contrast is available as an accessibility override.')
            });
            return;
        }
        setDraftThemeId(themeId);
        setStatusMessage({ type: null, text: '' });
        setConflictError(null);
    };

    // Set theme to follow shared default
    const handleSetInheritTheme = () => {
        setDraftThemeId(null);
        setStatusMessage({ type: null, text: '' });
    };

    // Trigger full-screen live preview resolving proposed inherited values
    const handleStartPreview = () => {
        const resolvedInheritedThemeId = (targetScope === 'personal' && serverContext?.labDefault?.themeId)
            ? serverContext.labDefault.themeId
            : (serverContext?.platformDefault?.themeId || 'soilfer-classic');

        const resolvedInheritedMode = (targetScope === 'personal' && serverContext?.labDefault?.defaultMode && serverContext.labDefault.defaultMode !== 'inherit')
            ? serverContext.labDefault.defaultMode
            : (serverContext?.platformDefault?.defaultMode || 'light');

        const themeToPreview = draftThemeId !== null ? draftThemeId : resolvedInheritedThemeId;
        const modeToPreview = (draftMode === 'dark' || draftMode === 'light') ? draftMode : resolvedInheritedMode;

        setPreviewTheme({
            themeId: themeToPreview,
            mode: modeToPreview
        });
        setStatusMessage({
            type: 'info',
            text: t('appearance.previewNotice', 'Previewing theme. Click "Exit preview" or save below.')
        });
    };

    // Exit live preview
    const handleExitPreview = () => {
        clearPreviewTheme();
        setDraftThemeId(initialThemeId);
        setDraftMode(initialMode);
        setStatusMessage({ type: null, text: '' });
    };

    // Save for authenticated user
    const handleSavePersonal = async () => {
        setSaving(true);
        setStatusMessage({ type: null, text: '' });
        setConflictError(null);
        try {
            // Ordinary staff who haven't explicitly chosen Clear Contrast must retain themeId: null
            let finalThemeId = draftThemeId;
            if (isOrdinaryStaff && draftThemeId !== 'clear-contrast') {
                finalThemeId = null;
            }

            const effectiveModePref = (draftMode === 'light' || draftMode === 'dark' || draftMode === 'inherit') ? draftMode : 'inherit';

            await savePersonalPreferences({
                themeId: finalThemeId,
                modePreference: effectiveModePref
            });
            setStatusMessage({
                type: 'success',
                text: t('appearance.savedPersonalSuccess', 'Personal appearance preferences saved successfully.')
            });
            if (onSaved) onSaved({ themeId: finalThemeId, mode: effectiveModePref });
        } catch (err) {
            console.error('[THEME] Save error:', err);
            if (err.statusCode === 409 || err.response?.status === 409) {
                setConflictError(t('appearance.revisionConflict', 'Settings were updated by another session. Please refresh to load latest settings.'));
            } else {
                const msg = err.response?.data?.error || err.message || t('appearance.saveFailed', 'Failed to save preferences.');
                setStatusMessage({ type: 'error', text: msg });
            }
        } finally {
            setSaving(false);
        }
    };

    // Adopt as laboratory default
    const executeAdoptLab = async () => {
        if (!effectiveLabId) return;

        setSaving(true);
        setStatusMessage({ type: null, text: '' });
        setConflictError(null);
        setPendingConfirm(null);
        try {
            const targetRev = targetLabAppearance?.revision ?? (serverContext?.labDefault?.labId === effectiveLabId ? serverContext.labDefault.revision : undefined);
            await adoptLabDefault({
                labId: effectiveLabId,
                themeId: draftThemeId, // Preserves null/inherit
                defaultMode: draftMode || 'inherit',
                expectedRevision: targetRev
            });
            setStatusMessage({
                type: 'success',
                text: t('appearance.adoptedLabSuccess', `Adopted as default for laboratory ${targetLabName || effectiveLabId}.`)
            });
            if (onSaved) onSaved({ scope: 'lab', labId: effectiveLabId, themeId: draftThemeId, mode: draftMode });
        } catch (err) {
            console.error('[THEME] Lab adopt error:', err);
            if (err.statusCode === 409 || err.response?.status === 409) {
                setConflictError(t('appearance.revisionConflict', 'Laboratory default was updated by another administrator. Please refresh.'));
            } else {
                const msg = err.response?.data?.error || err.message || t('appearance.adoptFailed', 'Failed to update lab default.');
                setStatusMessage({ type: 'error', text: msg });
            }
        } finally {
            setSaving(false);
        }
    };

    // Adopt as platform default
    const executeAdoptPlatform = async () => {
        setSaving(true);
        setStatusMessage({ type: null, text: '' });
        setConflictError(null);
        setPendingConfirm(null);
        try {
            await adoptPlatformDefault({
                themeId: draftThemeId || 'soilfer-classic',
                defaultMode: draftMode === 'dark' ? 'dark' : 'light'
            });
            setStatusMessage({
                type: 'success',
                text: t('appearance.adoptedPlatformSuccess', 'Adopted as platform-wide default appearance.')
            });
            if (onSaved) onSaved({ scope: 'platform', themeId: draftThemeId, mode: draftMode });
        } catch (err) {
            console.error('[THEME] Platform adopt error:', err);
            if (err.statusCode === 409 || err.response?.status === 409) {
                setConflictError(t('appearance.revisionConflict', 'Platform default was updated by another administrator. Please refresh.'));
            } else {
                const msg = err.response?.data?.error || err.message || t('appearance.adoptFailed', 'Failed to update platform default.');
                setStatusMessage({ type: 'error', text: msg });
            }
        } finally {
            setSaving(false);
        }
    };

    // Refresh after conflict
    const handleRefreshAfterConflict = async () => {
        setSaving(true);
        try {
            await fetchAppearanceContext(effectiveLabId);
            setConflictError(null);
            setStatusMessage({
                type: 'info',
                text: t('appearance.refreshedLatest', 'Refreshed latest settings from server.')
            });
        } catch (e) {
            // Ignore
        } finally {
            setSaving(false);
        }
    };

    // Reset personal to default
    const handleResetPersonal = async () => {
        setSaving(true);
        setStatusMessage({ type: null, text: '' });
        setConflictError(null);
        try {
            await resetPersonalToDefault();
            setDraftThemeId(null);
            setDraftMode(appearance);
            setStatusMessage({
                type: 'success',
                text: t('appearance.resetSuccess', 'Reset to inherited defaults.')
            });
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setStatusMessage({ type: 'error', text: msg });
        } finally {
            setSaving(false);
        }
    };

    // Descriptive source text
    const formatSource = (src) => {
        switch (src) {
            case 'preview': return t('appearance.sourcePreview', 'Temporary preview');
            case 'session': return t('appearance.sourceSession', 'Session override');
            case 'saved': return t('appearance.sourcePersonal', 'Personal override');
            case 'labDefault': return t('appearance.sourceLab', 'Laboratory default');
            case 'platformDefault': return t('appearance.sourcePlatform', 'Platform default');
            default: return t('appearance.sourceDefault', 'SoilFER standard');
        }
    };

    const selectedThemeName = themes?.find(t => t.id === (draftThemeId || activeThemeId))?.name || 'Classic';

    return (
        <section
            aria-labelledby={`${groupId}-title`}
            className="space-y-6 text-sf-text"
        >
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sf-divider pb-4">
                <div>
                    <h3 id={`${groupId}-title`} className="text-lg font-bold text-sf-text">
                        {targetScope === 'lab'
                            ? (targetLabName ? `${targetLabName} — ${t('appearance.labAppearance', 'Laboratory Appearance')}` : t('appearance.labAppearance', 'Laboratory Appearance'))
                            : (targetScope === 'platform' ? t('appearance.platformAppearance', 'Platform Default Appearance') : t('appearance.galleryTitle', 'Theme Library'))}
                    </h3>
                    <p className="text-sm text-sf-muted">
                        {targetScope === 'lab'
                            ? t('appearance.labHeadingDesc', 'Configure default theme and mode for staff in this laboratory.')
                            : (targetScope === 'platform'
                                ? t('appearance.platformHeadingDesc', 'Configure global appearance for all users without laboratory or personal overrides.')
                                : t('appearance.galleryDescription', 'Choose a calm, readable identity for scientific laboratory work.'))}
                    </p>
                </div>

                {/* Light / Dark / Inherit Mode Toggle */}
                <div
                    role="radiogroup"
                    aria-label={t('appearance.modeSelectionAria', 'Color Mode')}
                    className="inline-flex items-center p-1 rounded-xl bg-sf-hover border border-sf-divider gap-1 flex-wrap"
                >
                    <button
                        type="button"
                        role="radio"
                        aria-checked={draftMode === 'light'}
                        onClick={() => {
                            setDraftMode('light');
                            if (isPreviewActive) {
                                setPreviewTheme({ themeId: draftThemeId || activeThemeId, mode: 'light' });
                            }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[44px] sm:min-h-0 touch-target ${
                            draftMode === 'light'
                                ? 'bg-sf-surface text-sf-text shadow-sm'
                                : 'text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        <Sun size={15} className="text-amber-500" />
                        <span>{t('appearance.light', 'Light')}</span>
                    </button>

                    <button
                        type="button"
                        role="radio"
                        aria-checked={draftMode === 'dark'}
                        onClick={() => {
                            setDraftMode('dark');
                            if (isPreviewActive) {
                                setPreviewTheme({ themeId: draftThemeId || activeThemeId, mode: 'dark' });
                            }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[44px] sm:min-h-0 touch-target ${
                            draftMode === 'dark'
                                ? 'bg-sf-surface text-sf-text shadow-sm'
                                : 'text-sf-muted hover:text-sf-text'
                        }`}
                    >
                        <Moon size={15} className="text-sf-link" />
                        <span>{t('appearance.dark', 'Dark · Graphite')}</span>
                    </button>

                    {targetScope !== 'platform' && (
                        <button
                            type="button"
                            role="radio"
                            aria-checked={draftMode === 'inherit'}
                            onClick={() => {
                                setDraftMode('inherit');
                                if (isPreviewActive) {
                                    handleStartPreview();
                                }
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[44px] sm:min-h-0 touch-target ${
                                draftMode === 'inherit'
                                    ? 'bg-sf-surface text-sf-text shadow-sm'
                                    : 'text-sf-muted hover:text-sf-text'
                            }`}
                        >
                            <RotateCcw size={13} className="text-sf-link" />
                            <span>{t('appearance.followDefaultMode', 'Follow default mode')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Scope Missing Warning for Lab Scope */}
            {targetScope === 'lab' && !effectiveLabId && (
                <div role="alert" className="p-4 rounded-xl bg-sf-warning-bg border border-sf-warning/40 text-sf-warning text-sm flex items-center gap-3">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{t('appearance.noLabSelected', 'No laboratory selected. Please select a laboratory to configure appearance defaults.')}</span>
                </div>
            )}

            {/* Conflict Error Notice */}
            {conflictError && (
                <div role="alert" className="p-4 rounded-xl bg-sf-danger-bg border border-sf-danger/40 text-sf-danger text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={18} className="shrink-0" />
                        <span>{conflictError}</span>
                    </div>
                    <button
                        type="button"
                        onClick={handleRefreshAfterConflict}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sf-surface text-sf-danger border border-sf-danger font-bold text-xs hover:bg-sf-hover"
                    >
                        <RefreshCw size={13} className={saving ? 'animate-spin' : ''} />
                        <span>{t('appearance.refreshLatest', 'Refresh & Review Latest')}</span>
                    </button>
                </div>
            )}

            {/* Current Active Status Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-sf-surface border border-sf-divider text-xs md:text-sm">
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-sf-muted">
                        {t('appearance.activeAppearance', 'Active Appearance')}:
                    </span>
                    <span className="font-bold text-sf-text">
                        {themes?.find(t => t.id === activeThemeId)?.name || 'Classic'}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-sf-hover text-sf-text font-medium text-xs">
                        {appearance === 'dark' ? t('appearance.dark', 'Dark') : t('appearance.light', 'Light')}
                    </span>
                    <span className="text-xs text-sf-muted">
                        ({formatSource(themeSource)})
                    </span>
                </div>

                {targetScope === 'personal' && (
                    <div className="flex items-center gap-3 flex-wrap">
                        {(authSubject?.savedThemeId !== null || draftThemeId !== null) && (
                            <button
                                type="button"
                                onClick={handleSetInheritTheme}
                                disabled={saving || draftThemeId === null}
                                className="flex items-center gap-1.5 text-xs text-sf-link hover:underline font-medium min-h-[44px] sm:min-h-0 touch-target"
                            >
                                <RotateCcw size={13} />
                                <span>{t('appearance.followSharedTheme', 'Follow shared theme')}</span>
                            </button>
                        )}
                        {(authSubject?.savedThemeId !== null || authSubject?.savedModePreference !== 'inherit') && (
                            <button
                                type="button"
                                onClick={handleResetPersonal}
                                disabled={saving}
                                className="flex items-center gap-1.5 text-xs text-sf-link hover:underline font-medium min-h-[44px] sm:min-h-0 touch-target"
                            >
                                <RotateCcw size={13} />
                                <span>{t('appearance.resetToInherited', 'Reset to inherited defaults')}</span>
                            </button>
                        )}
                    </div>
                )}
                {targetScope === 'lab' && draftThemeId !== null && (
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSetInheritTheme}
                            disabled={saving}
                            className="flex items-center gap-1.5 text-xs text-sf-link hover:underline font-medium min-h-[44px] sm:min-h-0 touch-target"
                        >
                            <RotateCcw size={13} />
                            <span>{t('appearance.followPlatformTheme', 'Follow platform theme')}</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Status Feedback Banner */}
            {statusMessage.text && (
                <div
                    role="status"
                    className={`flex items-center gap-2.5 p-3 rounded-xl text-xs md:text-sm font-medium border animate-in fade-in duration-150 ${
                        statusMessage.type === 'success'
                            ? 'bg-sf-success-bg text-sf-success border-sf-success/30'
                            : (statusMessage.type === 'error'
                                ? 'bg-sf-danger-bg text-sf-danger border-sf-danger/30'
                                : 'bg-sf-info-bg text-sf-info border-sf-info/30')
                    }`}
                >
                    {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{statusMessage.text}</span>
                </div>
            )}

            {/* Gallery Cards Grid (Responsive 1-col on phone, 2-col on tablet, 3-col on desktop) */}
            <div
                role="radiogroup"
                aria-label={t('appearance.themeFamiliesAria', 'Theme Families')}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
                {themes?.map((th, index) => {
                    const isSelected = draftThemeId === th.id || (draftThemeId === null && activeThemeId === th.id && targetScope === 'personal');
                    const isRovingFocused = isSelected || (!draftThemeId && index === 0);
                    const tokens = draftMode === 'dark' ? th.dark : th.light;
                    const selectable = isThemeSelectable(th.id);

                    return (
                        <div
                            key={th.id}
                            id={`theme-card-${th.id}`}
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={selectable ? (isRovingFocused ? 0 : -1) : -1}
                            onClick={() => handleSelectCard(th.id)}
                            onKeyDown={(e) => {
                                if (e.key === ' ' || e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSelectCard(th.id);
                                } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const nextIdx = (index + 1) % themes.length;
                                    const nextTheme = themes[nextIdx];
                                    if (isThemeSelectable(nextTheme.id)) {
                                        handleSelectCard(nextTheme.id);
                                        if (typeof document !== 'undefined') {
                                            document.getElementById(`theme-card-${nextTheme.id}`)?.focus();
                                        }
                                    }
                                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const prevIdx = (index - 1 + themes.length) % themes.length;
                                    const prevTheme = themes[prevIdx];
                                    if (isThemeSelectable(prevTheme.id)) {
                                        handleSelectCard(prevTheme.id);
                                        if (typeof document !== 'undefined') {
                                            document.getElementById(`theme-card-${prevTheme.id}`)?.focus();
                                        }
                                    }
                                }
                            }}
                            className={`group relative flex flex-col rounded-2xl border-2 transition-all p-3.5 space-y-3 focus:outline-none focus:ring-2 focus:ring-sf-focus min-h-[44px] ${
                                selectable ? 'cursor-pointer' : 'cursor-default'
                            } ${
                                isSelected
                                    ? 'border-sf-primary bg-sf-selected/30 shadow-md ring-1 ring-sf-primary/40'
                                    : 'border-sf-divider bg-sf-surface hover:border-sf-control'
                            }`}
                        >
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h4 className="font-bold text-sm text-sf-text">
                                            {th.name}
                                        </h4>
                                        {th.badge && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                                th.isRecommended
                                                    ? 'bg-sf-success-bg text-sf-success'
                                                    : (th.isAccessibility
                                                        ? 'bg-sf-info-bg text-sf-info'
                                                        : 'bg-sf-hover text-sf-muted')
                                            }`}>
                                                {th.badge}
                                            </span>
                                        )}
                                        {draftThemeId === null && activeThemeId === th.id && targetScope === 'personal' && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sf-hover text-sf-muted">
                                                {t('appearance.inherited', 'Inherited')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-sf-muted mt-0.5 line-clamp-2">
                                        {th.description}
                                    </p>
                                </div>

                                <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                    isSelected
                                        ? 'bg-sf-primary text-sf-on-primary border-sf-primary'
                                        : 'border-sf-control bg-transparent'
                                }`}>
                                    {isSelected && <Check size={13} strokeWidth={3} />}
                                </div>
                            </div>

                            {/* Miniature Screen Mockup */}
                            <div
                                style={{ backgroundColor: tokens.canvas, borderColor: tokens.divider }}
                                className="h-28 rounded-xl border overflow-hidden grid grid-cols-4 select-none pointer-events-none transition-colors"
                            >
                                {/* Miniature Sidebar */}
                                <div
                                    style={{ backgroundColor: tokens.sidebar, color: tokens.sideText }}
                                    className="p-2 flex flex-col justify-between"
                                >
                                    <div className="space-y-1.5">
                                        <div style={{ backgroundColor: tokens.sideActive }} className="h-2 w-full rounded-sm" />
                                        <div style={{ backgroundColor: tokens.sideMuted }} className="h-1.5 w-3/4 rounded-sm opacity-60" />
                                        <div style={{ backgroundColor: tokens.sideMuted }} className="h-1.5 w-2/3 rounded-sm opacity-60" />
                                    </div>
                                    <div style={{ color: tokens.sideMuted }} className="text-[8px] font-mono">
                                        SF
                                    </div>
                                </div>

                                {/* Miniature Work Area */}
                                <div className="col-span-3 p-2.5 flex flex-col justify-between">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <div style={{ backgroundColor: tokens.text }} className="h-2 w-1/3 rounded-sm opacity-80" />
                                            <span
                                                style={{ backgroundColor: draftMode === 'dark' ? '#31493B' : '#EAF4ED', color: draftMode === 'dark' ? '#A5DABA' : '#246044' }}
                                                className="text-[8px] font-bold px-1 rounded"
                                            >
                                                OK
                                            </span>
                                        </div>
                                        <div
                                            style={{ backgroundColor: tokens.surface, borderColor: tokens.divider }}
                                            className="h-10 rounded-lg border p-1.5 space-y-1"
                                        >
                                            <div style={{ backgroundColor: tokens.muted }} className="h-1.5 w-full rounded-sm opacity-30" />
                                            <div style={{ backgroundColor: tokens.muted }} className="h-1.5 w-4/5 rounded-sm opacity-30" />
                                        </div>
                                    </div>

                                    {/* Primary Button Accent */}
                                    <div className="flex justify-end">
                                        <div
                                            style={{ backgroundColor: tokens.primary }}
                                            className="h-3 w-12 rounded-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Color Palette Swatches */}
                            <div className="flex items-center gap-1.5 pt-1">
                                <span className="text-[10px] text-sf-muted font-medium">Palette:</span>
                                <div className="flex items-center gap-1">
                                    <span
                                        style={{ backgroundColor: tokens.canvas }}
                                        className="w-3.5 h-3.5 rounded-full border border-sf-control/40 shadow-xs"
                                        title={`Canvas: ${tokens.canvas}`}
                                    />
                                    <span
                                        style={{ backgroundColor: tokens.surface }}
                                        className="w-3.5 h-3.5 rounded-full border border-sf-control/40 shadow-xs"
                                        title={`Surface: ${tokens.surface}`}
                                    />
                                    <span
                                        style={{ backgroundColor: tokens.primary }}
                                        className="w-3.5 h-3.5 rounded-full border border-sf-control/40 shadow-xs"
                                        title={`Primary: ${tokens.primary}`}
                                    />
                                    <span
                                        style={{ backgroundColor: tokens.sidebar }}
                                        className="w-3.5 h-3.5 rounded-full border border-sf-control/40 shadow-xs"
                                        title={`Sidebar: ${tokens.sidebar}`}
                                    />
                                </div>

                                {!selectable && (
                                    <span className="ml-auto text-[10px] text-sf-muted italic">
                                        {t('appearance.inheritedOnly', 'Inherited by staff')}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Action Bar (Scope-Aware & Mobile Responsive) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-sf-divider">
                <div className="flex items-center gap-2">
                    {/* Live Preview Button */}
                    {!isPreviewActive ? (
                        <button
                            type="button"
                            onClick={handleStartPreview}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-sf-divider bg-sf-surface hover:bg-sf-hover text-xs font-bold transition-all min-h-[44px] touch-target"
                        >
                            <Eye size={15} />
                            <span>{t('appearance.livePreview', 'Preview full screen')}</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleExitPreview}
                            className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-sf-control bg-sf-surface hover:bg-sf-hover text-xs font-bold transition-all min-h-[44px] touch-target"
                        >
                            <Undo2 size={15} />
                            <span>{t('appearance.exitPreview', 'Exit preview')}</span>
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Target Scope: Personal Save */}
                    {targetScope === 'personal' && (
                        <button
                            type="button"
                            onClick={handleSavePersonal}
                            disabled={saving}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-sf-primary text-sf-on-primary text-xs font-bold hover:bg-sf-primary-hover shadow-sm transition-all disabled:opacity-50 min-h-[44px] touch-target"
                        >
                            <Save size={15} />
                            <span>{t('appearance.saveForMe', 'Save for me')}</span>
                        </button>
                    )}

                    {/* Target Scope: Laboratory Default */}
                    {targetScope === 'lab' && (
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof document !== 'undefined') modalTriggerRef.current = document.activeElement;
                                setPendingConfirm('lab');
                            }}
                            disabled={saving || !effectiveLabId}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-sf-primary text-sf-primary bg-sf-surface hover:bg-sf-selected text-xs font-bold transition-all disabled:opacity-50 min-h-[44px] touch-target"
                            title={t('appearance.adoptLabTitle', 'Staff following this lab default will see this appearance')}
                        >
                            <Building2 size={15} />
                            <span>
                                {targetLabName
                                    ? t('appearance.useAsLabDefaultName', `Use as ${targetLabName} default`)
                                    : t('appearance.useAsLabDefault', "Use as this lab's default")}
                            </span>
                        </button>
                    )}

                    {/* Target Scope: Platform Default */}
                    {targetScope === 'platform' && (
                        <button
                            type="button"
                            onClick={() => {
                                if (typeof document !== 'undefined') modalTriggerRef.current = document.activeElement;
                                setPendingConfirm('platform');
                            }}
                            disabled={saving}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-sf-divider bg-sf-raised text-sf-text hover:bg-sf-hover text-xs font-bold transition-all disabled:opacity-50 min-h-[44px] touch-target"
                            title={t('appearance.adoptPlatformTitle', 'All users without personal or lab overrides will see this theme')}
                        >
                            <Globe size={15} />
                            <span>{t('appearance.useAsPlatformDefault', 'Use as platform default')}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Named Confirmation Modal */}
            {pendingConfirm && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`${groupId}-confirm-title`}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
                >
                    <div ref={modalRef} className="relative w-full max-w-md rounded-2xl bg-sf-surface border border-sf-divider p-6 space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h4 id={`${groupId}-confirm-title`} className="text-base font-bold text-sf-text">
                                {pendingConfirm === 'lab'
                                    ? t('appearance.confirmLabTitle', 'Confirm Laboratory Appearance Default')
                                    : t('appearance.confirmPlatformTitle', 'Confirm Platform Appearance Default')}
                            </h4>
                            <button
                                type="button"
                                aria-label={t('common.close', 'Close')}
                                onClick={() => setPendingConfirm(null)}
                                className="p-2.5 text-sf-muted hover:text-sf-text rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center touch-target"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="text-sm text-sf-muted">
                            {pendingConfirm === 'lab'
                                ? t('appearance.confirmLabMsg', `Are you sure you want to set the appearance default for "${targetLabName || effectiveLabId}" to ${selectedThemeName} (${draftMode})?`)
                                : t('appearance.confirmPlatformMsg', `Are you sure you want to set the platform-wide default to ${selectedThemeName} (${draftMode})?`)}
                        </p>

                        <div className="p-3 rounded-xl bg-sf-hover text-xs text-sf-muted">
                            {pendingConfirm === 'lab'
                                ? t('appearance.confirmLabSub', 'Staff members assigned to this laboratory who do not have personal overrides will immediately receive this appearance.')
                                : t('appearance.confirmPlatformSub', 'All users across all laboratories without laboratory or personal overrides will receive this appearance.')}
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setPendingConfirm(null)}
                                className="px-4 py-2 rounded-xl border border-sf-divider text-xs font-bold hover:bg-sf-hover min-h-[44px] touch-target"
                            >
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={pendingConfirm === 'lab' ? executeAdoptLab : executeAdoptPlatform}
                                disabled={saving}
                                className="px-4 py-2 rounded-xl bg-sf-primary text-sf-on-primary text-xs font-bold hover:bg-sf-primary-hover min-h-[44px] touch-target"
                            >
                                {saving ? t('common.saving', 'Saving...') : t('common.confirm', 'Confirm & Apply')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ThemeGallery;
