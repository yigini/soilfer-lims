const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');
const { classifyTerminologyKey } = require('../utils/terminologyRegistry');
function getTranslationsDir() {
    const candidatePaths = [
        path.resolve(__dirname, '../../client/src/translations'),
        path.resolve(__dirname, '../locales'),
        path.resolve(__dirname, '../../locales')
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p) && fs.existsSync(path.join(p, 'en.json'))) {
            return p;
        }
    }
    return candidatePaths[0];
}

const CLIENT_TRANSLATIONS_DIR = getTranslationsDir();

// In-memory cache for dynamic keys
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
     * Generates all dynamic keys from the database and canonical reference models.
     * Uses English/System values as default.
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
                keys[`dynamic.category.${c.id}.name`] = c.name;
            });

            // 4. Methodologies
            try {
                const methodologies = await prisma.methodology.findMany({ select: { id: true, name: true, description: true } });
                methodologies.forEach(m => {
                    keys[`dynamic.methodology.${m.id}.name`] = m.name;
                    if (m.description) keys[`dynamic.methodology.${m.id}.description`] = m.description;
                });
            } catch (err) {
                // Ignore if methodology table is empty or inaccessible
            }

            // 5. Equipment Types
            const equipmentTypes = await prisma.equipmentAsset.findMany({
                distinct: ['assetType'],
                select: { assetType: true }
            });
            equipmentTypes.forEach(e => {
                keys[`dynamic.equipmentType.${e.assetType}.label`] = e.assetType;
            });

            // 6. USDA 12-Class Soil Texture Metrology (Soil Survey Manual Ch. 3)
            const textures = [
                { code: 'clay', name: 'Clay' },
                { code: 'silty_clay', name: 'Silty Clay' },
                { code: 'sandy_clay', name: 'Sandy Clay' },
                { code: 'clay_loam', name: 'Clay Loam' },
                { code: 'silty_clay_loam', name: 'Silty Clay Loam' },
                { code: 'sandy_clay_loam', name: 'Sandy Clay Loam' },
                { code: 'sand', name: 'Sand' },
                { code: 'loamy_sand', name: 'Loamy Sand' },
                { code: 'sandy_loam', name: 'Sandy Loam' },
                { code: 'silt', name: 'Silt' },
                { code: 'silt_loam', name: 'Silt Loam' },
                { code: 'loam', name: 'Loam' }
            ];
            textures.forEach(t => {
                keys[`catalogue.texture.${t.code}.name`] = t.name;
            });

            // 7. Analysis Statuses
            const statuses = ['EXPECTED', 'RECEIVED', 'ACCEPTED', 'PROCESSING', 'DONE', 'FAILED', 'ARCHIVED'];
            statuses.forEach(s => {
                keys[`dynamic.status.${s}.label`] = s;
            });

            dynamicKeyCache = keys;
            lastCacheUpdate = now;
        } catch (error) {
            console.error('[TranslationService] Failed to generate dynamic keys', error);
        }
        return dynamicKeyCache || {};
    }

    /**
     * Returns full merged translation dictionary for runtime locale usage.
     */
    async getMergedTranslations(code, labId = null) {
        const dynamicDefaults = await this.getDynamicKeys();

        const staticFilePath = path.join(CLIENT_TRANSLATIONS_DIR, `${code}.json`);
        const staticTranslations = safeReadJSON(staticFilePath);
        const staticFlat = flattenParams(staticTranslations);

        const langRecord = await prisma.language.findUnique({ where: { code } });
        let dbOverrides = {};
        if (langRecord && langRecord.translations) {
            try {
                dbOverrides = JSON.parse(langRecord.translations);
            } catch (e) {
                console.error(`[TranslationService] Bad JSON for lang ${code}`, e);
            }
        }

        if (labId) {
            try {
                const lab = await prisma.lab.findFirst({
                    where: { OR: [{ id: labId }, { code: labId }] }
                });
                if (lab?.branding) {
                    const branding = typeof lab.branding === 'string' ? JSON.parse(lab.branding) : lab.branding;
                    if (branding.translations && branding.translations[code]) {
                        dbOverrides = { ...dbOverrides, ...branding.translations[code] };
                    }
                }
            } catch (e) {
                console.error(`[TranslationService] Failed to load lab overrides for ${labId}`, e);
            }
        }

        return {
            ...dynamicDefaults,
            ...staticFlat,
            ...dbOverrides
        };
    }

    /**
     * Returns the structured "Catalog" with primaryGroup, tags, reviewStatus for Admin/Manager UI.
     */
    async getCatalog(targetCode, labId = null) {
        const dynamicKeys = await this.getDynamicKeys();

        // English baseline (reference)
        const enStatic = flattenParams(safeReadJSON(path.join(CLIENT_TRANSLATIONS_DIR, 'en.json')));

        // Target locale file
        const targetStaticFile = safeReadJSON(path.join(CLIENT_TRANSLATIONS_DIR, `${targetCode}.json`));
        const targetStatic = flattenParams(targetStaticFile);

        // Target DB Overrides
        const langRecord = await prisma.language.findUnique({ where: { code: targetCode } });
        let dbOverrides = {};
        if (langRecord?.translations) {
            try {
                dbOverrides = JSON.parse(langRecord.translations);
            } catch (e) {
                console.error(`[TranslationService] Bad overrides JSON for ${targetCode}`, e);
            }
        }

        if (labId) {
            try {
                const lab = await prisma.lab.findFirst({
                    where: { OR: [{ id: labId }, { code: labId }] }
                });
                if (lab?.branding) {
                    const branding = typeof lab.branding === 'string' ? JSON.parse(lab.branding) : lab.branding;
                    if (branding.translations && branding.translations[targetCode]) {
                        dbOverrides = { ...dbOverrides, ...branding.translations[targetCode] };
                    }
                }
            } catch (e) {
                console.error(`[TranslationService] Bad lab overrides for ${labId}`, e);
            }
        }

        const catalog = {};

        // 1. Add all Dynamic Keys
        Object.entries(dynamicKeys).forEach(([key, enValue]) => {
            const val = dbOverrides[key] !== undefined ? dbOverrides[key] : (targetStatic[key] || '');
            const classification = classifyTerminologyKey(key);
            catalog[key] = {
                group: 'Dynamic',
                primaryGroup: classification.primaryGroup,
                module: classification.module,
                tags: classification.tags,
                en: enValue,
                sourceEnglish: enValue,
                value: val,
                isDynamic: true,
                reviewStatus: val ? (targetCode === 'en' ? 'certified' : 'reviewed') : 'missing'
            };
        });

        // 2. Add all Static Keys (from EN)
        Object.entries(enStatic).forEach(([key, enValue]) => {
            if (!catalog[key]) {
                const val = dbOverrides[key] !== undefined ? dbOverrides[key] : (targetStatic[key] || '');
                const classification = classifyTerminologyKey(key);
                catalog[key] = {
                    group: 'Static',
                    primaryGroup: classification.primaryGroup,
                    module: classification.module,
                    tags: classification.tags,
                    en: enValue,
                    sourceEnglish: enValue,
                    value: val,
                    isDynamic: false,
                    reviewStatus: val ? (targetCode === 'en' ? 'certified' : 'reviewed') : 'missing'
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
