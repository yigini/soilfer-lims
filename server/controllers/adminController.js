const prisma = require('../prisma');

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

        res.json(settings);
    } catch (error) {
        console.error("Get Settings Error:", error);
        res.status(500).json({ error: 'Failed to fetch settings' });
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
            res.json({ message: 'Lab branding updated' });

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
            res.json({ message: 'Global branding updated' });
        } else {
            res.status(403).json({ error: 'Not authorized to update branding' });
        }
    } catch (error) {
        console.error("Update Branding Error:", error);
        res.status(500).json({ error: 'Failed to update settings' });
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

        res.json({
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
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
};

exports.getLanguages = async (req, res) => {
    try {
        const langs = await prisma.language.findMany();
        const parsed = langs.map(l => ({
            ...l,
            translations: typeof l.translations === 'string' ? JSON.parse(l.translations) : l.translations
        }));
        res.json(parsed);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch languages' });
    }
};

exports.createLanguage = async (req, res) => {
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'Code and Name required' });

    try {
        const existing = await prisma.language.findUnique({ where: { code } });
        if (existing) return res.status(400).json({ error: 'Language code already exists' });

        const newLang = await prisma.language.create({
            data: {
                code,
                name,
                isDefault: false,
                translations: JSON.stringify({})
            }
        });
        res.json(newLang);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create language' });
    }
};

exports.deleteLanguage = async (req, res) => {
    const { id } = req.params; // 'id' matches route :id, which is code

    try {
        const lang = await prisma.language.findUnique({ where: { code: id } });
        if (!lang) return res.status(404).json({ error: 'Language not found' });
        if (lang.isDefault) return res.status(400).json({ error: 'Cannot delete default language' });

        await prisma.language.delete({ where: { code: id } });
        res.json({ message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete language' });
    }
};

exports.setDefaultLanguage = async (req, res) => {
    const { id } = req.params;

    try {
        const lang = await prisma.language.findUnique({ where: { code: id } });
        if (!lang) return res.status(404).json({ error: 'Language not found' });

        await prisma.$transaction([
            prisma.language.updateMany({ data: { isDefault: false } }),
            prisma.language.update({ where: { code: id }, data: { isDefault: true } })
        ]);

        res.json({ message: 'Default updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to set default' });
    }
};

exports.updateLanguage = async (req, res) => {
    const { code } = req.params;
    const { translations } = req.body;

    try {
        const lang = await prisma.language.findUnique({ where: { code } });
        if (!lang) return res.status(404).json({ error: 'Language not found' });

        await prisma.language.update({
            where: { code },
            data: { translations: JSON.stringify(translations) }
        });

        res.json({ message: 'Translations updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update translations' });
    }
};
