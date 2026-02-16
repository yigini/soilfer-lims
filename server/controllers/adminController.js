const prisma = require('../prisma');
const translationService = require('../services/TranslationService');

// Initialize default settings if needed (best done in a script, but we'll keep logic here for now)
const ensureSettings = async () => {
    try {
        const settings = await prisma.systemSetting.findUnique({ where: { id: 'global' } });
        if (!settings) {
            await prisma.systemSetting.create({
                data: {
                    id: 'global',
                    branding: JSON.stringify({
                        title: 'SoilFER LIMS',
                        colors: {
                            primary: '#2563EB',
                            secondary: '#111827',
                            accent: '#D97706'
                        },
                        logoUrl: '/logo.png'
                    })
                }
            });
        }
    } catch (e) {
        console.error('Settings init error:', e);
    }
};

// Call once on load? Or lazy load.
// We'll lazy load in getSettings.

exports.getSettings = async (req, res) => {
    try {
        let settings = { branding: {}, id: 'global' };

        // Context-aware settings fetching
        if (req.user && req.user.labId) {
            // Fetch Lab Settings if user belongs to a lab
            const lab = await prisma.lab.findUnique({
                where: { id: req.user.labId },
                select: { branding: true, settings: true }
            });

            if (lab && lab.branding) {
                settings.branding = JSON.parse(lab.branding);
                settings.description = 'Lab Specific Settings';
            } else {
                // Fallback to global
                const globalSettings = await prisma.systemSetting.findUnique({ where: { id: 'global' } });
                if (globalSettings && globalSettings.branding) {
                    settings.branding = JSON.parse(globalSettings.branding);
                }
            }
        } else {
            // Super Admin or Global Context
            const globalSettings = await prisma.systemSetting.findUnique({ where: { id: 'global' } });
            if (!globalSettings) {
                await ensureSettings();
                const newGlobal = await prisma.systemSetting.findUnique({ where: { id: 'global' } });
                settings.branding = newGlobal.branding ? JSON.parse(newGlobal.branding) : {};
            } else {
                settings.branding = globalSettings.branding ? JSON.parse(globalSettings.branding) : {};
            }
        }

        res.success('SETTINGS_FETCHED', 'Settings fetched successfully', null, 200, settings);
    } catch (error) {
        console.error("Get Settings Error:", error);
        res.error(500, 'SETTINGS_FETCH_FAILED', 'Failed to fetch settings');
    }
};

exports.updateBranding = async (req, res) => {
    const { title, colors, logoUrl, tagline, organization, contactEmail, defaultLanguage, dateFormat, footerText, cesiumToken } = req.body;

    // Construct branding object
    const newBranding = {
        title,
        colors,
        logoUrl,
        tagline,
        organization,
        contactEmail,
        defaultLanguage,
        dateFormat,
        footerText,
        cesiumToken
    };

    try {
        if (req.user.labId) {
            // Update Lab Specific Branding
            await prisma.lab.update({
                where: { id: req.user.labId },
                data: {
                    branding: JSON.stringify(newBranding)
                }
            });

            // If default language is set, propagate to all users in the lab
            if (defaultLanguage) {
                await prisma.user.updateMany({
                    where: { labId: req.user.labId },
                    data: { language: defaultLanguage }
                });
            }

            res.success('BRANDING_UPDATED', 'Lab branding and default language updated');

        } else if (req.user.role === 'SUPER_ADMIN') {
            // Update Global Branding
            await prisma.systemSetting.upsert({
                where: { id: 'global' },
                create: {
                    id: 'global',
                    branding: JSON.stringify(newBranding)
                },
                update: {
                    branding: JSON.stringify(newBranding)
                }
            });

            // Keep default language in sync with languages table
            if (defaultLanguage) {
                const code = String(defaultLanguage);
                await prisma.language.updateMany({ data: { isDefault: false } });
                await prisma.language.updateMany({ where: { code }, data: { isDefault: true } });
            }
            res.success('BRANDING_UPDATED', 'Global branding updated');
        } else {
            res.error(403, 'AUTH_FORBIDDEN', 'Not authorized to update branding');
        }
    } catch (error) {
        console.error("Update Branding Error:", error);
        res.error(500, 'BRANDING_UPDATE_FAILED', 'Failed to update settings');
    }
};

exports.getAuditLogs = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    const user = req.user;

    try {
        const where = {};
        if (user && user.role !== 'SUPER_ADMIN') {
            if (user.labId) {
                where.OR = [
                    { labId: user.labId },
                    { sampleId: { in: await prisma.sample.findMany({ where: { assignedLab: user.labId }, select: { id: true } }).then(samples => samples.map(s => s.id)) } }
                ];
            } else {
                // Non-lab staff see nothing or scoped by country (complex, skipping for now)
                where.performedBy = user.username;
            }
        }

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                skip,
                take: limit,
                orderBy: { timestamp: 'desc' }
            }),
            prisma.auditLog.count({ where })
        ]);

        const mappedLogs = logs.map(log => ({
            ...log,
            user: log.performedBy || 'System',
            time: log.timestamp,
            details: log.details || (log.entity ? `${log.entity} ${log.entityId || ''}` : '-')
        }));

        res.success('LOGS_FETCHED', 'Audit logs fetched', null, 200, {
            data: mappedLogs,
            meta: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error("Audit Logs Error:", error);
        res.error(500, 'LOGS_FETCH_FAILED', 'Failed to fetch logs');
    }
};

exports.getLanguages = async (req, res) => {
    try {
        const langs = await prisma.language.findMany();
        const parsed = langs.map(l => ({
            ...l,
            translations: typeof l.translations === 'string' ? JSON.parse(l.translations) : l.translations
        }));
        res.success('LANGUAGES_FETCHED', 'Languages fetched', null, 200, parsed);
    } catch (error) {
        res.error(500, 'LANGUAGES_FETCH_FAILED', 'Failed to fetch languages');
    }
};

exports.createLanguage = async (req, res) => {
    const { code, name } = req.body;
    if (!code || !name) return res.error(400, 'VALIDATION_ERROR', 'Code and Name required');

    try {
        const existing = await prisma.language.findUnique({ where: { code } });
        if (existing) return res.error(400, 'DUPLICATE_ENTRY', 'Language code already exists');

        const newLang = await prisma.language.create({
            data: {
                code,
                name,
                isDefault: false,
                translations: JSON.stringify({})
            }
        });
        res.success('LANGUAGE_CREATED', 'Language created', null, 200, newLang);
    } catch (error) {
        res.error(500, 'LANGUAGE_CREATE_FAILED', 'Failed to create language');
    }
};

exports.deleteLanguage = async (req, res) => {
    const { code } = req.params;

    try {
        const lang = await prisma.language.findUnique({ where: { code } });
        if (!lang) return res.error(404, 'NOT_FOUND', 'Language not found');
        if (lang.isDefault) return res.error(400, 'ACTION_FORBIDDEN', 'Cannot delete default language');

        await prisma.language.delete({ where: { code } });
        res.success('LANGUAGE_DELETED', 'Deleted');
    } catch (error) {
        res.error(500, 'LANGUAGE_DELETE_FAILED', 'Failed to delete language');
    }
};

exports.setDefaultLanguage = async (req, res) => {
    const { code } = req.params;
    const user = req.user;

    try {
        const lang = await prisma.language.findUnique({ where: { code } });
        if (!lang) return res.status(404).json({ error: 'Language not found' });

        // Lab Manager Context: Update Lab Branding
        if (user && user.labId) {
            const lab = await prisma.lab.findUnique({ where: { id: user.labId } });
            if (!lab) return res.error(404, 'LAB_NOT_FOUND', 'Lab not found');

            let branding = {};
            try {
                branding = lab.branding ? JSON.parse(lab.branding) : {};
            } catch (e) {
                console.warn(`[setDefaultLanguage] Invalid branding JSON for lab ${user.labId}, resetting.`);
                branding = {};
            }

            branding.defaultLanguage = code;

            await prisma.lab.update({
                where: { id: user.labId },
                data: { branding: JSON.stringify(branding) }
            });

            // Bulk update all users in this lab to enforce the new default language preference
            await prisma.user.updateMany({
                where: { labId: user.labId },
                data: { language: code }
            });

            return res.success('LAB_DEFAULT_UPDATED', 'Lab default language updated', { scope: 'LAB' });
        }

        // Global Context: Super Admin only
        if (user && user.role === 'SUPER_ADMIN') {
            await prisma.$transaction([
                prisma.language.updateMany({ data: { isDefault: false } }),
                prisma.language.update({ where: { code }, data: { isDefault: true } })
            ]);

            // Sync branding defaultLanguage
            try {
                const settings = await prisma.systemSetting.findUnique({ where: { id: 'global' } });
                const branding = settings?.branding ? JSON.parse(settings.branding) : {};
                branding.defaultLanguage = code;
                await prisma.systemSetting.upsert({
                    where: { id: 'global' },
                    create: { id: 'global', branding: JSON.stringify(branding) },
                    update: { branding: JSON.stringify(branding) }
                });
            } catch (e) {
                console.warn('[setDefaultLanguage] branding sync failed', e.message);
            }

            return res.success('GLOBAL_DEFAULT_UPDATED', 'Global default language updated', { scope: 'GLOBAL' });
        }

        return res.error(403, 'AUTH_FORBIDDEN', 'Not authorized to change default language');

    } catch (error) {
        console.error("Set Default Language Error:", error);
        res.error(500, 'SET_DEFAULT_FAILED', 'Failed to set default language', { details: error.message });
    }
};

exports.updateLanguage = async (req, res) => {
    const { code } = req.params;
    const { translations } = req.body;

    try {
        const lang = await prisma.language.findUnique({ where: { code } });
        if (!lang) return res.error(404, 'NOT_FOUND', 'Language not found');

        await prisma.language.update({
            where: { code },
            data: { translations: JSON.stringify(translations) }
        });

        // Invalidate cache if needed
        translationService.invalidateCache();

        res.success('TRANSLATIONS_UPDATED', 'Translations updated');
    } catch (error) {
        res.error(500, 'TRANSLATION_UPDATE_FAILED', 'Failed to update translations');
    }
};

exports.getLanguageCatalog = async (req, res) => {
    const { code } = req.params;
    try {
        const catalog = await translationService.getCatalog(code);
        res.success('CATALOG_FETCHED', 'Catalog fetched', null, 200, catalog);
    } catch (error) {
        console.error('Get Catalog Error:', error);
        res.error(500, 'CATALOG_FETCH_FAILED', 'Failed to fetch translation catalog');
    }
};
