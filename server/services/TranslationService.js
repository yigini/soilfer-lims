const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');

const CLIENT_TRANSLATIONS_DIR = path.resolve(__dirname, '../../client/src/translations');

// In-memory cache for dynamic keys (simple version, can be redis/memcached later)
let dynamicKeyCache = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 60 * 1000; // 1 minute

const safeReadJSON = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return {};
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`[TranslationService] Failed to read ${filePath}`, error);
        return {};
    }
};

const flattenParams = (obj, prefix = '', out = {}) => {
    Object.entries(obj || {}).forEach(([k, v]) => {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            flattenParams(v, key, out);
        } else {
            out[key] = v;
        }
    });
    return out;
};

class TranslationService {

    /**
     * Generates all dynamic keys from the database.
     * Returns an object: { 'dynamic.analysis.PH.name': 'pH (Water)', ... }
     * Uses the English/System value as the default.
     */
    async getDynamicKeys() {
        const now = Date.now();
        if (dynamicKeyCache && (now - lastCacheUpdate < CACHE_TTL)) {
            return dynamicKeyCache;
        }

        const keys = {};

        try {
            // 1. Analyses
            const analyses = await prisma.analysis.findMany({ select: { code: true, name: true, description: true } });
            analyses.forEach(a => {
                keys[`dynamic.analysis.${a.code}.name`] = a.name;
                if (a.description) keys[`dynamic.analysis.${a.code}.description`] = a.description;
            });

            // 2. Operational Gates
            const gates = await prisma.operationalGate.findMany({ select: { code: true, name: true } });
            gates.forEach(g => {
                keys[`dynamic.gate.${g.code}.name`] = g.name;
            });

            // 3. Analysis Categories
            const categories = await prisma.analysisCategory.findMany({ select: { id: true, name: true } });
            categories.forEach(c => {
                // Use ID for stability, but name for default text
                keys[`dynamic.category.${c.id}.name`] = c.name;
            });

            // 4. Equipment Types (Enum-like, but currently strings in DB? Schema says String)
            // We can fetch distinct assetTypes
            const equipmentTypes = await prisma.equipmentAsset.findMany({
                distinct: ['assetType'],
                select: { assetType: true }
            });
            equipmentTypes.forEach(e => {
                keys[`dynamic.equipmentType.${e.assetType}.label`] = e.assetType;
            });

            // 5. Analysis Statuses (Hardcoded in schema/code, but good to expose)
            const statuses = ['EXPECTED', 'RECEIVED', 'ACCEPTED', 'PROCESSING', 'DONE', 'FAILED', 'ARCHIVED'];
            statuses.forEach(s => {
                keys[`dynamic.status.${s}.label`] = s; // Fallback title case?
            });

            dynamicKeyCache = keys;
            lastCacheUpdate = now;
        } catch (error) {
            console.error('[TranslationService] Failed to generate dynamic keys', error);
            // Return empty or stale cache if available
        }
        return dynamicKeyCache || {};
    }

    /**
     * Returns the full translation map for a given language code.
     * Merges:
     * 1. Dynamic DB Keys (Default English values)
     * 2. Static JSON File (client/src/translations/{code}.json)
     * 3. DB Overrides (Language.translations JSON blob)
     */
    async getMergedTranslations(code) {
        // 1. Start with Dynamic Keys (Baselines)
        // If code is 'en', these ARE the values. If not, they are fallbacks? 
        // Actually, for non-en, we might want empty strings if we want to force translation?
        // But for "Catalog", we usually want the English default as a reference.
        // Let's return the English defaults as the "base catalog".
        const dynamicDefaults = await this.getDynamicKeys();

        // 2. Load Static File
        const staticFilePath = path.join(CLIENT_TRANSLATIONS_DIR, `${code}.json`);
        const staticTranslations = safeReadJSON(staticFilePath);
        const staticFlat = flattenParams(staticTranslations);

        // 3. Load DB Overrides
        const langRecord = await prisma.language.findUnique({ where: { code } });
        let dbOverrides = {};
        if (langRecord && langRecord.translations) {
            try {
                dbOverrides = JSON.parse(langRecord.translations);
            } catch (e) {
                console.error(`[TranslationService] Bad JSON for lang ${code}`, e);
            }
        }

        // Merge Strategy:
        // Result = DynamicDefaults (as fallback) + StaticFile + DBOverrides
        // Note: If we are 'es', DynamicDefaults are English. We only want them if we don't have a translation?
        // Or do we return them as "untranslated"?
        // Front-end typically handles fallback.
        // BUT, for the Admin Editor, we need ALL keys.
        // For the Client UI, we need the *values* for this language.

        // Let's assume we return the BEST KNOWN translation for each key.
        // If 'es', and key 'dynamic.analysis.PH.name' is not in overrides, do we return 'pH (Water)' (English)?
        // Yes, fallback is better than key name.

        return {
            ...dynamicDefaults, // English Fallbacks for dynamic stuff
            ...staticFlat,      // Static File (usually localized)
            ...dbOverrides      // Manual Admin Overrides (Highest priority)
        };
    }

    /**
     * Returns the "Catalog" structure for the Admin UI.
     * {
     *   key: { en: "Value", [code]: "TranslatedValue", isDynamic: true/false }
     * }
     */
    async getCatalog(targetCode) {
        const dynamicKeys = await this.getDynamicKeys();

        // Load English Static (Reference)
        const enStatic = flattenParams(safeReadJSON(path.join(CLIENT_TRANSLATIONS_DIR, 'en.json'))); // Ensure en.json exists

        // Load Target Static
        const targetStaticFile = safeReadJSON(path.join(CLIENT_TRANSLATIONS_DIR, `${targetCode}.json`));
        const targetStatic = flattenParams(targetStaticFile);

        // Load Target DB Overrides
        const langRecord = await prisma.language.findUnique({ where: { code: targetCode } });
        let dbOverrides = {};
        if (langRecord?.translations) {
            dbOverrides = JSON.parse(langRecord.translations);
        }

        const catalog = {};

        // 1. Add all Dynamic Keys
        Object.entries(dynamicKeys).forEach(([key, enValue]) => {
            catalog[key] = {
                group: 'Dynamic',
                en: enValue,
                value: dbOverrides[key] || targetStatic[key] || '', // Empty if not translated? Or fallback? Editor usually wants empty to show "Missing".
                isDynamic: true
            };
        });

        // 2. Add all Static Keys (from EN)
        Object.entries(enStatic).forEach(([key, enValue]) => {
            if (!catalog[key]) {
                catalog[key] = {
                    group: 'Static',
                    en: enValue,
                    value: dbOverrides[key] || targetStatic[key] || '',
                    isDynamic: false
                };
            }
        });

        return catalog;
    }

    invalidateCache() {
        dynamicKeyCache = null;
    }
}

module.exports = new TranslationService();
