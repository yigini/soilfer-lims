const prisma = require('../prisma');
const crypto = require('crypto');
const { invalidateCache } = require('../services/analysisService');
const catalogue = require('../services/cataloguePolicy');

// --- Helpers ---

/**
 * Lab-scope guard — ensures the current user can modify the entity.
 * SUPER_ADMIN can modify anything. Others can only modify entities
 * that belong to their lab. Shared definitions are owned centrally.
 */
const canModify = (user, entity) => {
    if (user.role === 'SUPER_ADMIN') return true;
    return !!user.labId && entity.labId === user.labId;
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
        res.json(categories.map(c => ({ ...c, canEdit: canModify(user, c) })));
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

        const analyses = await prisma.analysis.findMany({ where, orderBy: { name: 'asc' } });
        const defaults = await require('../services/methodResolution').resolveDefaultSelections(analyses.map(a => a.code), user.labId);
        const parsed = analyses.map(a => {
            const description = catalogue.describeAnalysis(a);
            if (defaults.get(a.code)?.error) {
                description.configurationIssues.push(defaults.get(a.code).error);
                description.orderable = false;
            }
            return { ...description, canEdit: canModify(user, a) };
        });
        res.json(req.query.orderable === 'true' ? parsed.filter(a => a.orderable) : parsed);
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
        res.json(methodologies.map(m => ({ ...m, canEdit: canModify(user, m) })));
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
        const parsed = await Promise.all(groups.map(async g => {
            const stored = catalogue.parseJson(g.analyses, null);
            if (!Array.isArray(stored) || !stored.length) return { ...g, analyses: [], orderable: false, configurationIssues: [{ reason: 'Package must contain a valid list of parameters.' }], canEdit: canModify(user, g) };
            const analyses = stored;
            const selection = await catalogue.validateSelection(analyses, { labId: user.role === 'SUPER_ADMIN' ? g.labId : user.labId });
            return { ...g, analyses, orderable: selection.valid, configurationIssues: selection.issues, canEdit: canModify(user, g) };
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

async function validateAnalysisReferences(data, code, labId) {
    if (data.categoryId) {
        const category = await prisma.analysisCategory.findUnique({ where: { id: data.categoryId } });
        if (!category || (category.labId && category.labId !== labId)) return 'Category is unavailable to this laboratory.';
    }
    if (data.prerequisites !== undefined) {
        const all = await prisma.analysis.findMany({ select: { code: true, prerequisites: true, labId: true } });
        const deps = catalogue.parseJson(data.prerequisites, []);
        if (deps.some(c => !catalogue.GATE_CODES.has(c) && !all.some(a => a.code === c && (!a.labId || a.labId === labId)))) return 'A prerequisite parameter is unavailable to this laboratory.';
        const check = require('../utils/workflowEngine').validatePrerequisites(code, deps, all);
        if (!check.valid) return check.error;
    }
    return null;
}

function auditData(req, entity, entityId, action, details) {
    return { id: crypto.randomUUID(), entity, entityId, action, details,
        performedBy: req.user.username, timestamp: new Date() };
}

exports.createAnalysis = async (req, res) => {
    const checked = catalogue.validateAnalysisInput(req.body);
    if (checked.error) return res.status(400).json({ error: checked.error });
    const data = checked.data;
    const labId = req.user.role === 'SUPER_ADMIN' ? null : req.user.labId;
    if (req.user.role !== 'SUPER_ADMIN' && !labId) return res.status(403).json({ error: 'A laboratory assignment is required.' });
    try {
        if (await prisma.analysis.findUnique({ where: { code: data.code } })) return res.status(409).json({ error: 'Internal parameter code already exists.' });
        const referenceError = await validateAnalysisReferences(data, data.code, labId);
        if (referenceError) return res.status(400).json({ error: referenceError });
        const created = await prisma.$transaction(async tx => {
            const a = await tx.analysis.create({ data: { ...data, labId, isGlobal: labId === null } });
            await tx.auditLog.create({ data: auditData(req, 'ANALYSIS', a.code, 'CREATE', 'Created parameter: ' + a.name) });
            return a;
        });
        require('../utils/workflowEngine').registerAnalysisConfig(created.code, created);
        invalidateCache();
        res.json(catalogue.describeAnalysis(created));
    } catch (error) {
        console.error('[createAnalysis] Error:', error);
        res.status(error.code === 'P2002' ? 409 : 500).json({ error: 'Could not create parameter. Check the code and retry.' });
    }
};

exports.updateAnalysis = async (req, res) => {
    const { code } = req.params;
    try {
        const existing = await prisma.analysis.findUnique({ where: { code } });
        if (!existing) return res.status(404).json({ error: 'Parameter not found.' });
        if (!canModify(req.user, existing)) return res.status(403).json({ error: 'Shared parameters are maintained by the system administrator. Lab managers can maintain their own parameters and local method defaults.' });
        if (req.body.code !== undefined && req.body.code !== code) return res.status(400).json({ error: 'Internal codes cannot change because orders and results reference them.' });
        const checked = catalogue.validateAnalysisInput(req.body, existing);
        if (checked.error) return res.status(400).json({ error: checked.error });
        const data = checked.data;
        const referenceError = await validateAnalysisReferences(data, code, existing.labId);
        if (referenceError) return res.status(400).json({ error: referenceError });
        const updated = await prisma.$transaction(async tx => {
            // Check references in the same transaction as the definition change.
            const current = await tx.analysis.findUnique({ where: { code } });
            if (['units', 'matrix'].some(k => k in data && data[k] !== current[k])) {
                const usage = await catalogue.analysisUsage(code, tx);
                if (usage.workItems || usage.results || usage.orderLines || usage.sampleOrders) return { blocked: true, usage };
            }
            if ('units' in data && data.units !== current.units) {
                const unit = data.units ? await tx.unit.findUnique({ where: { code: data.units } }) : null;
                data.unitCode = unit?.code || null;
                data.qudtUnit = null; // Do not keep an external unit mapping for a different quantity.
            }
            const a = await tx.analysis.update({ where: { code }, data });
            await tx.auditLog.create({ data: { ...auditData(req, 'ANALYSIS', code, 'UPDATE', 'Updated parameter: ' + a.name), before: JSON.stringify(existing), after: JSON.stringify(a) } });
            return a;
        });
        if (updated.blocked) return res.status(409).json({ error: 'This parameter has recorded work or orders. Create a new parameter definition to change its unit or matrix; existing values must keep their original meaning.', usage: updated.usage });
        require('../utils/workflowEngine').registerAnalysisConfig(code, updated);
        invalidateCache();
        res.json(catalogue.describeAnalysis(updated));
    } catch (error) {
        console.error('[updateAnalysis] Error:', error);
        res.status(500).json({ error: 'Failed to update parameter.' });
    }
};

exports.getAnalysisUsage = async (req, res) => {
    try {
        const analysis = await prisma.analysis.findUnique({ where: { code: req.params.code } });
        if (!analysis) return res.status(404).json({ error: 'Parameter not found.' });
        if (!canModify(req.user, analysis)) return res.status(403).json({ error: 'Parameter is outside your configuration scope.' });
        res.json(await catalogue.analysisUsage(analysis.code));
    } catch (error) { res.status(500).json({ error: 'Could not check parameter connections.' }); }
};

exports.deleteAnalysis = async (req, res) => {
    const { code } = req.params;
    try {
        const existing = await prisma.analysis.findUnique({ where: { code } });
        if (!existing) return res.status(404).json({ error: 'Parameter not found.' });
        if (!canModify(req.user, existing)) return res.status(403).json({ error: 'Shared parameters can only be removed by the system administrator.' });
        const result = await prisma.$transaction(async tx => {
            const usage = await catalogue.analysisUsage(code, tx);
            if (Object.values(usage).some(n => n > 0)) return { usage };
            await tx.analysis.delete({ where: { code } });
            await tx.auditLog.create({ data: auditData(req, 'ANALYSIS', code, 'DELETE', 'Deleted unused parameter: ' + existing.name) });
            return { success: true };
        });
        if (result.usage) return res.status(409).json({ error: 'This parameter is connected to orders, results or configuration. Set it inactive to stop new orders while preserving those connections.', usage: result.usage });
        invalidateCache();
        res.json(result);
    } catch (error) {
        console.error('[deleteAnalysis] Error:', error);
        res.status(500).json({ error: 'Failed to delete parameter.' });
    }
};

// --- GROUPS CRUD ---

exports.createGroup = async (req, res) => {
    const { id, name, analyses } = req.body;
    const user = req.user;

    if (!id || !name) return res.status(400).json({ error: 'ID and Name are required' });
    if (!Array.isArray(analyses) || !analyses.length) return res.status(400).json({ error: 'Select at least one parameter for this package.' });

    try {
        const existing = await prisma.analysisGroup.findUnique({ where: { id } });
        if (existing) return res.status(400).json({ error: 'Group ID already exists' });

        const selected = await catalogue.validateSelection(analyses || [], { labId: user.role === 'SUPER_ADMIN' ? null : user.labId });
        if (!selected.valid) return res.status(400).json({ error: selected.error, issues: selected.issues });
        if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'A package name is required.' });
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
        if (updates.name !== undefined) {
            if (typeof updates.name !== 'string' || !updates.name.trim()) return res.status(400).json({ error: 'A package name is required.' });
            data.name = updates.name.trim();
        }
        if (updates.analyses !== undefined) {
            if (!Array.isArray(updates.analyses) || !updates.analyses.length) return res.status(400).json({ error: 'Select at least one parameter for this package.' });
            const selected = await catalogue.validateSelection(updates.analyses, { labId: existing.labId, existing: catalogue.parseJson(existing.analyses, []) });
            if (!selected.valid) return res.status(400).json({ error: selected.error, issues: selected.issues });
            data.analyses = JSON.stringify(updates.analyses);
        }

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

        const references = await prisma.sample.findMany({ where: { analysisGroupIds: { contains: id } }, select: { analysisGroupIds: true } });
        if (references.some(s => catalogue.parseJson(s.analysisGroupIds, []).includes(id))) return res.status(409).json({ error: 'This package is referenced by sample orders and cannot be deleted.' });
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

function validateMethod(body) {
    if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim())) return 'A descriptive method name is required.';
    if (body.isDefault !== undefined && typeof body.isDefault !== 'boolean') return 'Default method must be true or false.';
    if (body.standard != null && typeof body.standard !== 'string') return 'Method reference must be text.';
    return null;
}

exports.createMethodology = async (req, res) => {
    const { analysisCode, name, standard, isDefault = false } = req.body;
    const error = validateMethod(req.body);
    if (error || !name || !analysisCode) return res.status(400).json({ error: error || 'Parameter and method name are required.' });
    const labId = req.user.role === 'SUPER_ADMIN' ? null : req.user.labId;
    if (req.user.role !== 'SUPER_ADMIN' && !labId) return res.status(403).json({ error: 'A laboratory assignment is required.' });
    try {
        const analysis = await prisma.analysis.findUnique({ where: { code: analysisCode } });
        if (!analysis || (analysis.labId && analysis.labId !== labId)) return res.status(400).json({ error: 'Parameter is unavailable to this laboratory.' });
        const created = await prisma.$transaction(async tx => {
            if (isDefault) await tx.methodology.updateMany({ where: { analysisCode, labId, isDefault: true }, data: { isDefault: false } });
            const m = await tx.methodology.create({ data: { analysisCode, name: name.trim(), standard: standard?.trim() || null, isDefault, labId } });
            await tx.auditLog.create({ data: auditData(req, 'METHODOLOGY', m.id, 'CREATE', 'Created method: ' + m.name) });
            return m;
        });
        invalidateCache();
        res.json(created);
    } catch (error) { console.error('[createMethodology]', error); res.status(500).json({ error: 'Failed to create methodology.' }); }
};

exports.updateMethodology = async (req, res) => {
    const error = validateMethod(req.body);
    if (error) return res.status(400).json({ error });
    const { id } = req.params;
    try {
        const existing = await prisma.methodology.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Method not found.' });
        if (!canModify(req.user, existing)) return res.status(403).json({ error: 'Shared methods are maintained centrally. Create a laboratory method or choose a local default.' });
        const data = {};
        if (req.body.name !== undefined) data.name = req.body.name.trim();
        if (req.body.standard !== undefined) data.standard = req.body.standard?.trim() || null;
        if (req.body.isDefault !== undefined) data.isDefault = req.body.isDefault;
        const updated = await prisma.$transaction(async tx => {
            const usage = await require('../services/methodResolution').methodologyUsage(id, tx);
            if ((usage.workItems || usage.results || usage.orderLines) && ['name', 'standard'].some(k => k in data && data[k] !== existing[k])) return { blocked: true, usage };
            if (data.isDefault) await tx.methodology.updateMany({ where: { analysisCode: existing.analysisCode, labId: existing.labId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
            const m = await tx.methodology.update({ where: { id }, data });
            await tx.auditLog.create({ data: { ...auditData(req, 'METHODOLOGY', id, 'UPDATE', 'Updated method: ' + m.name), before: JSON.stringify(existing), after: JSON.stringify(m) } });
            return m;
        });
        if (updated.blocked) return res.status(409).json({ error: 'This method is already referenced by work or results. Create a revised method to preserve the executed procedure.', usage: updated.usage });
        invalidateCache();
        res.json(updated);
    } catch (error) { console.error('[updateMethodology]', error); res.status(500).json({ error: 'Failed to update methodology.' }); }
};

exports.deleteMethodology = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await prisma.methodology.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Method not found.' });
        if (!canModify(req.user, existing)) return res.status(403).json({ error: 'Method is outside your configuration scope.' });
        const result = await prisma.$transaction(async tx => {
            const usage = await require('../services/methodResolution').methodologyUsage(id, tx);
            if (Object.values(usage).some(n => n > 0)) return { usage };
            await tx.methodology.delete({ where: { id } });
            await tx.auditLog.create({ data: auditData(req, 'METHODOLOGY', id, 'DELETE', 'Deleted unused method: ' + existing.name) });
            return { success: true };
        });
        if (result.usage) return res.status(409).json({ error: 'This method is referenced by work, results or laboratory configuration and cannot be deleted.', usage: result.usage });
        invalidateCache();
        res.json(result);
    } catch (error) { console.error('[deleteMethodology]', error); res.status(500).json({ error: 'Failed to delete methodology.' }); }
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

// --- UNITS & METHOD REFERENCES (WP-16, WP-17) ---

exports.getUnits = async (req, res) => {
    try {
        const units = await prisma.unit.findMany({
            orderBy: { code: 'asc' }
        });
        const parsed = units.map(u => ({
            ...u,
            synonyms: typeof u.synonyms === 'string' ? JSON.parse(u.synonyms) : (u.synonyms || [])
        }));
        res.json(parsed);
    } catch (error) {
        console.error('[getUnits] Error:', error);
        res.status(500).json({ error: 'Failed to fetch units' });
    }
};

exports.getMethodReferences = async (req, res) => {
    try {
        const refs = await prisma.methodReference.findMany({
            orderBy: [{ authority: 'asc' }, { year: 'desc' }]
        });
        res.json(refs);
    } catch (error) {
        console.error('[getMethodReferences] Error:', error);
        res.status(500).json({ error: 'Failed to fetch method references' });
    }
};

// --- LAB METHOD DEFAULTS (WP-20) ---

exports.getLabMethodDefaults = async (req, res) => {
    const { labId } = req.params;
    if (req.user.role !== 'SUPER_ADMIN' && req.user.labId !== labId) return res.status(403).json({ error: 'Cannot view another laboratory’s configuration.' });
    try {
        const defaults = await prisma.labMethodDefault.findMany({
            where: { labId }
        });

        const [analyses, methodologies] = await Promise.all([
            prisma.analysis.findMany({
                where: { OR: [{ labId }, { labId: null }] },
                include: { methodologies: { where: { OR: [{ labId }, { labId: null }] }, orderBy: { name: 'asc' } } },
                orderBy: { name: 'asc' }
            }),
            prisma.methodology.findMany({ where: { OR: [{ labId }, { labId: null }] } })
        ]);

        const defaultsMap = new Map(defaults.map(d => [d.analysisCode, d.methodologyId]));

        const result = analyses.map(a => {
            const chosenMethodId = defaultsMap.get(a.code);
            const local = a.methodologies.filter(m => m.isDefault && m.labId === labId);
            const candidates = local.length ? local : a.methodologies.filter(m => m.isDefault && !m.labId);
            const chosen = a.methodologies.find(m => m.id === chosenMethodId);
            const configurationError = chosenMethodId && !chosen ? 'Local default no longer belongs to this parameter/laboratory.' : !chosenMethodId && candidates.length > 1 ? 'Multiple default methods: choose one.' : null;
            const effectiveMethodId = configurationError ? null : chosen?.id || (candidates.length === 1 ? candidates[0].id : null);

            return {
                analysisCode: a.code,
                analysisName: a.name,
                orderable: catalogue.describeAnalysis(a).orderable,
                configurationError,
                matrix: a.matrix,
                module: a.module,
                chosenMethodologyId: chosenMethodId || null,
                effectiveMethodologyId: effectiveMethodId,
                isOverridden: !!chosenMethodId,
                methodologies: a.methodologies.map(m => ({
                    id: m.id,
                    name: m.name,
                    standard: m.standard,
                    isDefault: m.isDefault
                }))
            };
        });

        res.json(result);
    } catch (error) {
        console.error('[getLabMethodDefaults] Error:', error);
        res.status(500).json({ error: 'Failed to fetch lab method defaults' });
    }
};

exports.updateLabMethodDefaults = async (req, res) => {
    const { labId } = req.params;
    const { defaults } = req.body;
    if (req.user.role !== 'SUPER_ADMIN' && req.user.labId !== labId) return res.status(403).json({ error: 'Cannot modify another laboratory’s defaults.' });
    if (!Array.isArray(defaults) || defaults.some(d => !d || typeof d.analysisCode !== 'string' || (d.methodologyId != null && typeof d.methodologyId !== 'string')) || new Set(defaults.map(d => d.analysisCode)).size !== defaults.length) return res.status(400).json({ error: 'Supply one valid default selection per parameter.' });
    try {
        const result = await prisma.$transaction(async tx => {
            // Validate the entire request before changing any default.
            for (const d of defaults) {
                const a = await tx.analysis.findUnique({ where: { code: d.analysisCode } });
                if (!a || (a.labId && a.labId !== labId)) return { error: 'A parameter is unavailable to this laboratory.' };
                if (d.methodologyId) {
                    const m = await tx.methodology.findUnique({ where: { id: d.methodologyId } });
                    if (!require('../services/methodResolution').isAvailable(m, d.analysisCode, labId)) return { error: 'Each method must belong to its selected parameter and be shared or owned by this laboratory.' };
                }
            }
            for (const { analysisCode, methodologyId } of defaults) {
                if (!methodologyId) await tx.labMethodDefault.deleteMany({ where: { labId, analysisCode } });
                else await tx.labMethodDefault.upsert({ where: { labId_analysisCode: { labId, analysisCode } }, update: { methodologyId }, create: { labId, analysisCode, methodologyId } });
            }
            await tx.auditLog.create({ data: auditData(req, 'LAB_METHOD_DEFAULT', labId, 'UPDATE', 'Updated ' + defaults.length + ' laboratory method defaults') });
            return { success: true, count: defaults.length };
        });
        if (result.error) return res.status(400).json(result);
        invalidateCache();
        res.json(result);
    } catch (error) { console.error('[updateLabMethodDefaults]', error); res.status(500).json({ error: 'Failed to update defaults. No selections were applied.' }); }
};
