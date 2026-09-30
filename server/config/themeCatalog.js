/**
 * SoilFER LIMS - Server Theme Catalogue & Validation
 *
 * Source: WP/sitewide-theme-library-v1/THEME-CONCEPTS.json
 */

const THEME_ALLOWLIST = [
    'soilfer-classic',
    'forest',
    'terra',
    'mineral',
    'watershed',
    'nutrient',
    'clear-contrast'
];

const DEFAULT_THEME_ID = 'soilfer-classic';
const DEFAULT_MODE = 'light';
const RECOMMENDED_THEME_ID = 'forest';
const ACCESSIBILITY_THEME_ID = 'clear-contrast';

const SEMANTIC_STATUS = {
    light: {
        success: '#246044',
        successBg: '#EAF4ED',
        warning: '#7F5710',
        warningBg: '#FCF2DA',
        danger: '#9B3842',
        dangerBg: '#FAEDEF',
        info: '#206477',
        infoBg: '#E4F1F3'
    },
    dark: {
        success: '#A5DABA',
        successBg: '#31493B',
        warning: '#F0D083',
        warningBg: '#494030',
        danger: '#F3AFB5',
        dangerBg: '#4A343B',
        info: '#9CD4E1',
        infoBg: '#2E4149'
    }
};

const THEMES = [
    {
        id: 'soilfer-classic',
        name: 'SoilFER Classic',
        description: 'Keep the familiar SoilFER identity.',
        badge: 'Default',
        light: {
            canvas: '#F5F3ED',
            surface: '#FFFFFF',
            primary: '#256348',
            sidebar: '#173F32'
        },
        dark: {
            canvas: '#25282B',
            surface: '#2E3236',
            primary: '#91D2AF',
            sidebar: '#243932'
        }
    },
    {
        id: 'forest',
        name: 'Forest',
        description: 'Soft green and quiet surfaces for everyday soil work.',
        badge: 'Recommended',
        isRecommended: true,
        light: {
            canvas: '#F2F6F1',
            surface: '#FFFFFF',
            primary: '#245B3D',
            sidebar: '#1B392B'
        },
        dark: {
            canvas: '#252B27',
            surface: '#303A33',
            primary: '#9DD7AA',
            sidebar: '#26382B'
        }
    },
    {
        id: 'terra',
        name: 'Terra',
        description: 'Warm clay tones with clear white work surfaces.',
        light: {
            canvas: '#F7F2ED',
            surface: '#FFFFFF',
            primary: '#865039',
            sidebar: '#493226'
        },
        dark: {
            canvas: '#2C2927',
            surface: '#3A3330',
            primary: '#E6B298',
            sidebar: '#3B2E27'
        }
    },
    {
        id: 'mineral',
        name: 'Mineral',
        description: 'Neutral slate for tables, precision and instrument work.',
        light: {
            canvas: '#F2F4F6',
            surface: '#FFFFFF',
            primary: '#43556D',
            sidebar: '#283545'
        },
        dark: {
            canvas: '#272B30',
            surface: '#333A42',
            primary: '#ABC2D7',
            sidebar: '#293440'
        }
    },
    {
        id: 'watershed',
        name: 'Watershed',
        description: 'Restrained teal, suitable for soil and future water analysis.',
        light: {
            canvas: '#F0F6F5',
            surface: '#FFFFFF',
            primary: '#166879',
            sidebar: '#173F44'
        },
        dark: {
            canvas: '#252D2E',
            surface: '#303B3D',
            primary: '#89CFD2',
            sidebar: '#263C3F'
        }
    },
    {
        id: 'nutrient',
        name: 'Nutrient',
        description: 'Muted olive inspired by soil fertility and nutrient work.',
        light: {
            canvas: '#F5F5ED',
            surface: '#FFFFFF',
            primary: '#596024',
            sidebar: '#373B23'
        },
        dark: {
            canvas: '#2A2D25',
            surface: '#353B2E',
            primary: '#C4D48E',
            sidebar: '#303A25'
        }
    },
    {
        id: 'clear-contrast',
        name: 'Clear Contrast',
        description: 'Stronger edges and text with minimal decoration.',
        badge: 'Accessibility',
        isAccessibility: true,
        light: {
            canvas: '#FFFFFF',
            surface: '#FFFFFF',
            primary: '#003E70',
            sidebar: '#182B3B'
        },
        dark: {
            canvas: '#161616',
            surface: '#202020',
            primary: '#90C9FF',
            sidebar: '#202020'
        }
    }
];

const THEME_MAP = new Map(THEMES.map(t => [t.id, t]));

function isValidThemeId(id) {
    return typeof id === 'string' && THEME_MAP.has(id);
}

function isValidMode(mode) {
    return mode === 'light' || mode === 'dark';
}

function isValidModePreference(pref) {
    return pref === 'inherit' || pref === 'light' || pref === 'dark';
}

function getPublishedThemeList() {
    return THEMES.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        badge: t.badge || null,
        isRecommended: !!t.isRecommended,
        isAccessibility: !!t.isAccessibility,
        lightSwatches: t.light,
        darkSwatches: t.dark
    }));
}

module.exports = {
    THEME_ALLOWLIST,
    DEFAULT_THEME_ID,
    DEFAULT_MODE,
    RECOMMENDED_THEME_ID,
    ACCESSIBILITY_THEME_ID,
    SEMANTIC_STATUS,
    THEMES,
    isValidThemeId,
    isValidMode,
    isValidModePreference,
    getPublishedThemeList
};
