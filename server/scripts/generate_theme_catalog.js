/**
 * SoilFER LIMS - Theme Catalog Generator & Drift Verifier
 *
 * Generates both server/config/themeCatalog.js (CJS) and client/src/lib/themeCatalog.js (ESM)
 * from the canonical single source of truth: server/config/themeCatalogData.json.
 *
 * Usage:
 *   node server/scripts/generate_theme_catalog.js          # Generate both catalogues
 *   node server/scripts/generate_theme_catalog.js --check  # Verify zero drift (exit code 1 if drifted)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '../..');
const SOURCE_JSON = path.join(ROOT_DIR, 'server/config/themeCatalogData.json');
const SERVER_TARGET = path.join(ROOT_DIR, 'server/config/themeCatalog.js');
const CLIENT_TARGET = path.join(ROOT_DIR, 'client/src/lib/themeCatalog.js');

function loadCanonicalData() {
    if (!fs.existsSync(SOURCE_JSON)) {
        throw new Error(`Canonical source JSON not found at: ${SOURCE_JSON}`);
    }
    const raw = fs.readFileSync(SOURCE_JSON, 'utf8');
    return JSON.parse(raw);
}

function generateServerCatalog(data) {
    const jsonStr = (val) => JSON.stringify(val, null, 4);

    return `/**
 * SoilFER LIMS - Server Theme Catalogue & Validation
 *
 * GENERATED CODE - DO NOT EDIT MANUALLY
 * Source: server/config/themeCatalogData.json (v${data.version})
 * Generator: server/scripts/generate_theme_catalog.js
 */

const THEME_ALLOWLIST = ${jsonStr(data.themeAllowlist)};

const DEFAULT_THEME_ID = ${jsonStr(data.defaultThemeId)};
const DEFAULT_MODE = ${jsonStr(data.defaultMode)};
const RECOMMENDED_THEME_ID = ${jsonStr(data.recommendedThemeId)};
const ACCESSIBILITY_THEME_ID = ${jsonStr(data.accessibilityThemeId)};

const SEMANTIC_STATUS = ${jsonStr(data.semanticStatus)};

const THEMES = ${jsonStr(data.themes)};

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

function getTheme(themeId) {
    return THEME_MAP.get(themeId) || THEME_MAP.get(DEFAULT_THEME_ID);
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
    getTheme,
    getPublishedThemeList
};
`;
}

function generateClientCatalog(data) {
    const jsonStr = (val) => JSON.stringify(val, null, 4);

    return `/**
 * SoilFER LIMS - Theme Catalogue & Token Definitions
 *
 * GENERATED CODE - DO NOT EDIT MANUALLY
 * Source: server/config/themeCatalogData.json (v${data.version})
 * Generator: server/scripts/generate_theme_catalog.js
 *
 * Invariants:
 * 1. Semantic status colors (success, warning, danger, info) remain scientifically unambiguous.
 * 2. WCAG 2.2 AA compliant contrast pairs for text, controls, focus, and backgrounds.
 * 3. Clear Contrast targets >= 7:1 for core text.
 * 4. Classic is initial compatibility default; Forest is recommended soil theme.
 */

export const THEME_ALLOWLIST = ${jsonStr(data.themeAllowlist)};

export const DEFAULT_THEME_ID = ${jsonStr(data.defaultThemeId)};
export const DEFAULT_MODE = ${jsonStr(data.defaultMode)};
export const RECOMMENDED_THEME_ID = ${jsonStr(data.recommendedThemeId)};
export const ACCESSIBILITY_THEME_ID = ${jsonStr(data.accessibilityThemeId)};

export const SEMANTIC_STATUS = ${jsonStr(data.semanticStatus)};

export const THEMES = ${jsonStr(data.themes)};

const THEME_MAP = new Map(THEMES.map(t => [t.id, t]));

/**
 * Validates if a string is an accepted theme ID.
 */
export function isValidThemeId(id) {
    return typeof id === 'string' && THEME_MAP.has(id);
}

/**
 * Returns theme object by ID, falling back safely to SoilFER Classic.
 */
export function getTheme(id) {
    if (isValidThemeId(id)) {
        return THEME_MAP.get(id);
    }
    return THEME_MAP.get(DEFAULT_THEME_ID);
}

/**
 * Returns clean sanitized metadata list for selector UI and public APIs.
 */
export function getPublishedThemeList() {
    return THEMES.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        badge: t.badge || null,
        isRecommended: !!t.isRecommended,
        isAccessibility: !!t.isAccessibility,
        lightSwatches: {
            canvas: t.light.canvas,
            surface: t.light.surface,
            primary: t.light.primary,
            sidebar: t.light.sidebar
        },
        darkSwatches: {
            canvas: t.dark.canvas,
            surface: t.dark.surface,
            primary: t.dark.primary,
            sidebar: t.dark.sidebar
        }
    }));
}
`;
}

function main() {
    const isCheck = process.argv.includes('--check');
    const data = loadCanonicalData();

    const expectedServer = generateServerCatalog(data);
    const expectedClient = generateClientCatalog(data);

    if (isCheck) {
        let hasError = false;
        if (!fs.existsSync(SERVER_TARGET)) {
            console.error(`[DRIFT] Server target missing: ${SERVER_TARGET}`);
            hasError = true;
        } else {
            const currentServer = fs.readFileSync(SERVER_TARGET, 'utf8');
            if (currentServer !== expectedServer) {
                console.error(`[DRIFT] Server themeCatalog.js drifted from themeCatalogData.json`);
                hasError = true;
            }
        }

        if (!fs.existsSync(CLIENT_TARGET)) {
            console.error(`[DRIFT] Client target missing: ${CLIENT_TARGET}`);
            hasError = true;
        } else {
            const currentClient = fs.readFileSync(CLIENT_TARGET, 'utf8');
            if (currentClient !== expectedClient) {
                console.error(`[DRIFT] Client themeCatalog.js drifted from themeCatalogData.json`);
                hasError = true;
            }
        }

        if (hasError) {
            console.error('[ERROR] Theme catalog drift detected! Run "node server/scripts/generate_theme_catalog.js" to resync.');
            process.exit(1);
        }

        console.log('[PASS] Theme catalog check: 0 drift detected between server, client, and themeCatalogData.json.');
        process.exit(0);
    }

    fs.writeFileSync(SERVER_TARGET, expectedServer, 'utf8');
    fs.writeFileSync(CLIENT_TARGET, expectedClient, 'utf8');
    console.log(`[GENERATED] Successfully generated:\n  - ${SERVER_TARGET}\n  - ${CLIENT_TARGET}\nfrom canonical ${SOURCE_JSON}`);
}

if (require.main === module) {
    main();
}

module.exports = {
    loadCanonicalData,
    generateServerCatalog,
    generateClientCatalog
};
