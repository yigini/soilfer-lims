const prisma = require('../prisma');
const crypto = require('crypto');
const { invalidateCache } = require('../services/analysisService');

// --- Helpers ---

/**
 * Lab-scope guard — ensures the current user can modify the entity.
 * SUPER_ADMIN can modify anything. Others can only modify entities
 * that belong to their lab or are global (labId === null).
 */
const canModify = (user, entity) => {
    if (user.role === 'SUPER_ADMIN') return true;
    return entity.labId === null || entity.labId === user.labId;
};

// --- READ OPERATIONS ---

exports.getCategories = async (req, res) => {
    try {
        const user = req.user;
        const where = {};

        if (user && user.role !== 'SUPER_ADMIN') {
            where.OR = [{ labId: user.labId }, { labId: null }];
        }

        const categories = await prisma.analysisCategory.findMany({ where });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
};

exports.getAnalyses = async (req, res) => {
    try {
        const user = req.user;
        const where = {};

        if (user && user.role !== 'SUPER_ADMIN') {
            where.OR = [{ labId: user.labId }, { labId: null }];
        }

        const analyses = await prisma.analysis.findMany({ where });
        const parsed = analyses.map(a => ({
            ...a,
            validation: typeof a.validation === 'string' ? JSON.parse(a.validation) : a.validation
        }));
        res.json(parsed);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch analyses' });
    }
};

exports.getMethodologies = async (req, res) => {
    try {
        const user = req.user;
        const where = {};

        if (user && user.role !== 'SUPER_ADMIN') {
            where.OR = [{ labId: user.labId }, { labId: null }];
        }

        const methodologies = await prisma.methodology.findMany({
            where,
            include: { analysis: { select: { name: true, code: true } } }
        });
        res.json(methodologies);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch methodologies' });
    }
};

exports.getGroups = async (req, res) => {
    try {
        const user = req.user;
        const where = {};

        if (user && user.role !== 'SUPER_ADMIN') {
            where.OR = [{ labId: user.labId }, { labId: null }];
        }

        const groups = await prisma.analysisGroup.findMany({ where });
        const parsed = groups.map(g => ({
            ...g,
            analyses: typeof g.analyses === 'string' ? JSON.parse(g.analyses) : (g.analyses || [])
        }));
        res.json(parsed);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch groups' });
    }
};

exports.getOperationalGates = async (req, res) => {
    try {
        const user = req.user;
        const where = { isActive: true };

        if (user && user.role !== 'SUPER_ADMIN') {
            where.OR = [{ labId: user.labId }, { labId: null }];
        }

        const gates = await prisma.operationalGate.findMany({
            where,
            orderBy: { sortOrder: 'asc' }
        });
        res.json(gates);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch operational gates' });
    }
};

// --- ANALYSES CRUD ---

exports.createAnalysis = async (req, res) => {
    const { code, name, description, categoryId, units, validation } = req.body;
    const user = req.user;

    if (!code || !name) return res.status(400).json({ error: 'Code and Name are required' });

    try {
        const existing = await prisma.analysis.findUnique({ where: { code } });
        if (existing) return res.status(400).json({ error: 'Analysis code already exists' });

        const newAnalysis = await prisma.analysis.create({
            data: {
                code,
                name,
                description: description || null,
                categoryId,
                units,
                status: 'active',
                validation: validation ? JSON.stringify(validation) : null,
                labId: user.role !== 'SUPER_ADMIN' ? user.labId : null
            }
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'ANALYSIS',
                entityId: code,
                action: 'CREATE',
                details: `Created analysis ${name} (${code})`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        invalidateCache();
        res.json(newAnalysis);
    } catch (error) {
        console.error('[createAnalysis] Error:', error);
        res.status(500).json({ error: 'Failed to create analysis' });
    }
};

exports.updateAnalysis = async (req, res) => {
    const { code } = req.params;
    const updates = req.body;
    const user = req.user;

    try {
        const existing = await prisma.analysis.findUnique({ where: { code } });
        if (!existing) return res.status(404).json({ error: 'Analysis not found' });

        if (!canModify(user, existing)) {
            return res.status(403).json({ error: 'You do not have permission to modify this analysis' });
        }

        if (updates.code && updates.code !== code) {
            return res.status(400).json({ error: 'Cannot change Analysis Code' });
        }

        // Whitelist: only allow safe fields to be updated
        const data = {};
        const ALLOWED_FIELDS = ['name', 'description', 'categoryId', 'units', 'validation', 'status'];
        for (const field of ALLOWED_FIELDS) {
            if (updates[field] !== undefined) {
                data[field] = updates[field];
            }
        }
        if (data.validation && typeof data.validation !== 'string') {
            data.validation = JSON.stringify(data.validation);
        }

        const updated = await prisma.analysis.update({
            where: { code },
            data
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'ANALYSIS',
                entityId: code,
                action: 'UPDATE',
                details: `Updated fields: ${Object.keys(data).join(', ')}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        invalidateCache();
        res.json(updated);
    } catch (error) {
        console.error('[updateAnalysis] Error:', error);
        res.status(500).json({ error: 'Failed to update analysis' });
    }
};

exports.deleteAnalysis = async (req, res) => {
    const { code } = req.params;
    const user = req.user;

    try {
        const existing = await prisma.analysis.findUnique({ where: { code } });
        if (!existing) return res.status(404).json({ error: 'Analysis not found' });

        if (!canModify(user, existing)) {
            return res.status(403).json({ error: 'You do not have permission to delete this analysis' });
        }

        // Referential integrity: check if analysis is in active use
        const activeWorkItems = await prisma.workItem.count({
            where: { analysis: code, status: { notIn: ['COMPLETED', 'ACCEPTED', 'CANCELLED'] } }
        });
        if (activeWorkItems > 0) {
            return res.status(409).json({
                error: `Cannot delete: ${activeWorkItems} active work item(s) reference this analysis`,
                activeWorkItems
            });
        }

        // Check if referenced by any methodologies
        const methodCount = await prisma.methodology.count({ where: { analysisCode: code } });
        if (methodCount > 0) {
            return res.status(409).json({
                error: `Cannot delete: ${methodCount} methodology(ies) reference this analysis. Delete them first.`,
                methodCount
            });
        }

        await prisma.analysis.delete({ where: { code } });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'ANALYSIS',
                entityId: code,
                action: 'DELETE',
                details: `Deleted analysis ${existing.name}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        invalidateCache();
        res.json({ success: true, message: 'Analysis deleted' });
    } catch (error) {
        console.error('[deleteAnalysis] Error:', error);
        res.status(500).json({ error: 'Failed to delete analysis' });
    }
};

// --- GROUPS CRUD ---

exports.createGroup = async (req, res) => {
    const { id, name, analyses } = req.body;
    const user = req.user;

    if (!id || !name) return res.status(400).json({ error: 'ID and Name are required' });

    try {
        const existing = await prisma.analysisGroup.findUnique({ where: { id } });
        if (existing) return res.status(400).json({ error: 'Group ID already exists' });

        const newGroup = await prisma.analysisGroup.create({
            data: {
                id,
                name,
                analyses: JSON.stringify(analyses || []),
                labId: user.role !== 'SUPER_ADMIN' ? user.labId : null
            }
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'GROUP',
                entityId: id,
                action: 'CREATE',
                details: `Created group ${name}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.json(newGroup);
    } catch (error) {
        console.error('[createGroup] Error:', error);
        res.status(500).json({ error: 'Failed to create group' });
    }
};

exports.updateGroup = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

    try {
        const existing = await prisma.analysisGroup.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Group not found' });

        if (!canModify(user, existing)) {
            return res.status(403).json({ error: 'You do not have permission to modify this group' });
        }

        const data = {};
        if (updates.name !== undefined) data.name = updates.name;
        if (updates.analyses !== undefined) data.analyses = JSON.stringify(updates.analyses);

        const updated = await prisma.analysisGroup.update({
            where: { id },
            data
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'GROUP',
                entityId: id,
                action: 'UPDATE',
                details: `Updated group ${id}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('[updateGroup] Error:', error);
        res.status(500).json({ error: 'Failed to update group' });
    }
};

exports.deleteGroup = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    try {
        const existing = await prisma.analysisGroup.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Group not found' });

        if (!canModify(user, existing)) {
            return res.status(403).json({ error: 'You do not have permission to delete this group' });
        }

        await prisma.analysisGroup.delete({ where: { id } });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'GROUP',
                entityId: id,
                action: 'DELETE',
                details: `Deleted group ${id}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[deleteGroup] Error:', error);
        res.status(500).json({ error: 'Failed to delete group' });
    }
};

// --- METHODOLOGIES CRUD ---

exports.createMethodology = async (req, res) => {
    const { analysisCode, name, standard, isDefault } = req.body;
    const user = req.user;

    if (!analysisCode || !name) {
        return res.status(400).json({ error: 'Analysis code and method name are required' });
    }

    try {
        // Verify analysis exists
        const analysis = await prisma.analysis.findUnique({ where: { code: analysisCode } });
        if (!analysis) return res.status(404).json({ error: `Analysis '${analysisCode}' not found` });

        // If marking as default, unset any existing defaults for this analysis+lab
        const labId = user.role !== 'SUPER_ADMIN' ? user.labId : null;
        if (isDefault) {
            await prisma.methodology.updateMany({
                where: { analysisCode, labId, isDefault: true },
                data: { isDefault: false }
            });
        }

        const methodology = await prisma.methodology.create({
            data: {
                analysisCode,
                name,
                standard: standard || null,
                isDefault: isDefault || false,
                labId
            }
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'METHODOLOGY',
                entityId: methodology.id,
                action: 'CREATE',
                details: `Created methodology "${name}" for ${analysisCode}${standard ? ` (${standard})` : ''}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.json(methodology);
    } catch (error) {
        console.error('[createMethodology] Error:', error);
        res.status(500).json({ error: 'Failed to create methodology' });
    }
};

exports.updateMethodology = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user;

    try {
        const existing = await prisma.methodology.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Methodology not found' });

        if (!canModify(user, existing)) {
            return res.status(403).json({ error: 'You do not have permission to modify this methodology' });
        }

        const data = {};
        if (updates.name !== undefined) data.name = updates.name;
        if (updates.standard !== undefined) data.standard = updates.standard;
        if (updates.isDefault !== undefined) {
            data.isDefault = updates.isDefault;
            // If setting as default, unset others for same analysis+lab
            if (updates.isDefault) {
                await prisma.methodology.updateMany({
                    where: { analysisCode: existing.analysisCode, labId: existing.labId, isDefault: true, id: { not: id } },
                    data: { isDefault: false }
                });
            }
        }

        const updated = await prisma.methodology.update({ where: { id }, data });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'METHODOLOGY',
                entityId: id,
                action: 'UPDATE',
                details: `Updated methodology ${existing.name}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('[updateMethodology] Error:', error);
        res.status(500).json({ error: 'Failed to update methodology' });
    }
};

exports.deleteMethodology = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    try {
        const existing = await prisma.methodology.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Methodology not found' });

        if (!canModify(user, existing)) {
            return res.status(403).json({ error: 'You do not have permission to delete this methodology' });
        }

        await prisma.methodology.delete({ where: { id } });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'METHODOLOGY',
                entityId: id,
                action: 'DELETE',
                details: `Deleted methodology ${existing.name} for ${existing.analysisCode}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[deleteMethodology] Error:', error);
        res.status(500).json({ error: 'Failed to delete methodology' });
    }
};

// --- CATEGORIES CRUD ---

exports.createCategory = async (req, res) => {
    const { id, name } = req.body;
    const user = req.user;

    if (!name) return res.status(400).json({ error: 'Category name is required' });

    try {
        const newCat = await prisma.analysisCategory.create({
            data: {
                id: id || crypto.randomUUID(),
                name,
                labId: user.role !== 'SUPER_ADMIN' ? user.labId : null
            }
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'CATEGORY',
                entityId: newCat.id,
                action: 'CREATE',
                details: `Created category ${name}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.json(newCat);
    } catch (error) {
        console.error('[createCategory] Error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
};

exports.updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    const user = req.user;

    try {
        const existing = await prisma.analysisCategory.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Category not found' });

        if (!canModify(user, existing)) {
            return res.status(403).json({ error: 'You do not have permission to modify this category' });
        }

        const updated = await prisma.analysisCategory.update({
            where: { id },
            data: { name }
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'CATEGORY',
                entityId: id,
                action: 'UPDATE',
                details: `Renamed category to "${name}"`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.json(updated);
    } catch (error) {
        console.error('[updateCategory] Error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
};

exports.deleteCategory = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    try {
        const existing = await prisma.analysisCategory.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Category not found' });

        if (!canModify(user, existing)) {
            return res.status(403).json({ error: 'You do not have permission to delete this category' });
        }

        // Check if any analyses reference this category
        const analysisCount = await prisma.analysis.count({ where: { categoryId: id } });
        if (analysisCount > 0) {
            return res.status(409).json({
                error: `Cannot delete: ${analysisCount} analysis(es) are in this category. Reassign them first.`,
                analysisCount
            });
        }

        await prisma.analysisCategory.delete({ where: { id } });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'CATEGORY',
                entityId: id,
                action: 'DELETE',
                details: `Deleted category ${existing.name}`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('[deleteCategory] Error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
};
