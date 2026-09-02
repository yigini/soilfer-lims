const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

router.use(verifyToken);

// ─── GET /api/labs ─── Enriched list with stats
router.get('/', async (req, res) => {
    try {
        const labs = await prisma.lab.findMany({ orderBy: { createdAt: 'desc' } });

        // Batch-fetch all related data in parallel
        const [allProjects, allUsers, allSamples] = await Promise.all([
            prisma.project.findMany({
                where: { OR: [{ labId: { not: null } }, { assignedLabIds: { not: null } }] },
                select: { id: true, code: true, name: true, status: true, labId: true, assignedLabIds: true }
            }),
            prisma.user.groupBy({ by: ['labId', 'isActive'], _count: true }),
            prisma.sample.groupBy({
                by: ['assignedLab', 'status'],
                _count: true
            })
        ]);

        // Build lookup maps
        const userCounts = {};   // labId -> { total, active }
        allUsers.forEach(row => {
            if (!row.labId) return;
            if (!userCounts[row.labId]) userCounts[row.labId] = { total: 0, active: 0 };
            userCounts[row.labId].total += row._count;
            if (row.isActive) userCounts[row.labId].active += row._count;
        });

        const TERMINAL_STATUSES = ['ARCHIVED', 'DISPOSED'];
        const sampleCounts = {};  // labId -> { total, active }
        allSamples.forEach(row => {
            if (!row.assignedLab) return;
            if (!sampleCounts[row.assignedLab]) sampleCounts[row.assignedLab] = { total: 0, active: 0 };
            sampleCounts[row.assignedLab].total += row._count;
            if (!TERMINAL_STATUSES.includes(row.status)) {
                sampleCounts[row.assignedLab].active += row._count;
            }
        });

        const enriched = labs.map(lab => {
            // Projects: owned + assigned via multi-lab
            const assigned = lab.projectCode ? [lab.projectCode] : [];
            const owned = allProjects.filter(p => p.labId === lab.id).map(p => p.code);
            const accesses = allProjects.filter(p => {
                if (!p.assignedLabIds) return false;
                try {
                    const ids = JSON.parse(p.assignedLabIds);
                    return Array.isArray(ids) && ids.includes(lab.id);
                } catch (e) { return false; }
            }).map(p => p.code);
            const allProjectCodes = [...new Set([...assigned, ...owned, ...accesses])];

            // Enrich projects with metadata
            const projectDetails = allProjectCodes.map(code => {
                const proj = allProjects.find(p => p.code === code);
                return proj ? {
                    code: proj.code,
                    name: proj.name,
                    status: proj.status,
                    isOwned: proj.labId === lab.id,
                    isGlobal: !proj.labId || proj.labId !== lab.id
                } : { code, name: code, status: 'UNKNOWN', isOwned: false, isGlobal: true };
            });

            const uc = userCounts[lab.id] || { total: 0, active: 0 };
            const sc = sampleCounts[lab.id] || { total: 0, active: 0 };

            return {
                ...lab,
                projectId: lab.projectCode || '',
                projects: projectDetails,
                staffCount: uc.total,
                activeStaffCount: uc.active,
                sampleCount: sc.total,
                activeSampleCount: sc.active
            };
        });

        res.json(enriched);
    } catch (e) {
        console.error('[GET /api/labs] Error:', e);
        res.status(500).json({ error: 'Failed to fetch labs' });
    }
});

// ─── GET /api/labs/:id/staff ─── Staff roster for a specific lab
router.get('/:id/staff', async (req, res) => {
    if (!['SUPER_ADMIN', 'MASTER_USER'].includes(req.user.role))
        return res.status(403).json({ error: 'Unauthorized' });

    try {
        const users = await prisma.user.findMany({
            where: { labId: req.params.id },
            orderBy: { role: 'asc' }
        });

        const roster = users.map(u => ({
            id: u.id,
            username: u.username,
            name: u.name,
            email: u.email,
            role: u.role,
            isActive: u.isActive,
            mustChangePassword: u.mustChangePassword,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt
        }));

        res.json(roster);
    } catch (e) {
        console.error('[GET /api/labs/:id/staff]', e);
        res.status(500).json({ error: 'Failed to fetch staff' });
    }
});

// ─── PATCH /api/labs/:id/toggle-active ─── Toggle lab active status
router.patch('/:id/toggle-active', checkPermission('MANAGE_BRANDING'), async (req, res) => {

    try {
        const lab = await prisma.lab.findUnique({ where: { id: req.params.id } });
        if (!lab) return res.status(404).json({ error: 'Lab not found' });

        const newActive = !lab.isActive;

        // Toggle lab
        const updated = await prisma.lab.update({
            where: { id: req.params.id },
            data: { isActive: newActive }
        });

        // If deactivating, also deactivate all staff
        if (!newActive) {
            await prisma.user.updateMany({
                where: { labId: req.params.id },
                data: { isActive: false }
            });
        }

        // Audit
        await prisma.auditLog.create({
            data: {
                id: `audit-lab-toggle-${Date.now()}`,
                entity: 'LAB',
                entityId: req.params.id,
                action: 'STATUS_CHANGE',
                details: `Lab ${newActive ? 'activated' : 'deactivated'}${!newActive ? ' (all staff disabled)' : ''}`,
                performedBy: req.user.username,
                labId: req.params.id,
                timestamp: new Date()
            }
        });

        res.json({ ...updated, isActive: newActive });
    } catch (e) {
        console.error('[PATCH toggle-active]', e);
        res.status(500).json({ error: 'Toggle failed' });
    }
});

// ─── PATCH /api/labs/:id/staff/:userId/toggle ─── Toggle individual staff member active status
router.patch('/:id/staff/:userId/toggle', checkPermission('MANAGE_BRANDING'), async (req, res) => {

    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.labId !== req.params.id) return res.status(403).json({ error: 'User does not belong to this lab' });

        const updated = await prisma.user.update({
            where: { id: req.params.userId },
            data: { isActive: !user.isActive }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-staff-toggle-${Date.now()}`,
                entity: 'USER',
                entityId: req.params.userId,
                action: 'STATUS_CHANGE',
                details: `Staff ${updated.isActive ? 'activated' : 'deactivated'}: ${user.username}`,
                performedBy: req.user.username,
                labId: req.params.id,
                timestamp: new Date()
            }
        });

        const { password: _, ...safe } = updated;
        res.json(safe);
    } catch (e) {
        console.error('[PATCH staff toggle]', e);
        res.status(500).json({ error: 'Toggle failed' });
    }
});

// ─── PATCH /api/labs/:id/staff/:userId/reset-password ─── Reset staff password
router.patch('/:id/staff/:userId/reset-password', checkPermission('MANAGE_BRANDING'), async (req, res) => {

    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.labId !== req.params.id) return res.status(403).json({ error: 'User does not belong to this lab' });

        const tempPassword = 'password';
        const hashed = await bcrypt.hash(tempPassword, 10);

        await prisma.user.update({
            where: { id: req.params.userId },
            data: { password: hashed, mustChangePassword: true }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-staff-reset-${Date.now()}`,
                entity: 'USER',
                entityId: req.params.userId,
                action: 'UPDATE',
                details: `Password reset for ${user.username}`,
                performedBy: req.user.username,
                labId: req.params.id,
                timestamp: new Date()
            }
        });

        res.json({ username: user.username, tempPassword, message: 'Password reset. User must change on next login.' });
    } catch (e) {
        console.error('[PATCH reset-password]', e);
        res.status(500).json({ error: 'Reset failed' });
    }
});

// ─── POST /api/labs ─── Create a new lab with auto-generated staff + test project
router.post('/', checkPermission('MANAGE_BRANDING'), async (req, res) => {

    const {
        projectId,
        id, code, name, country, location, address, city, phone, email, website, capacity, timezone, notes
    } = req.body;

    if (!id || !code || !name) return res.status(400).json({ error: 'ID, Code, and Name are required' });

    try {
        const existing = await prisma.lab.findUnique({ where: { id } });
        if (existing) return res.status(400).json({ error: 'Lab ID already exists' });

        const codeExists = await prisma.lab.findUnique({ where: { code } });
        if (codeExists) return res.status(400).json({ error: 'Lab Code already exists' });

        const newLab = await prisma.lab.create({
            data: {
                id, code, name, country, location, address, city, phone, email, website,
                capacity: parseInt(capacity) || null,
                timezone, notes,
                projectCode: projectId
            }
        });

        // 1. GENERATE STAFF ACCOUNTS
        const roles = [
            { role: 'LAB_MANAGER', suffix: 'mgr', name: 'Lab Manager' },
            { role: 'SAMPLE_RECEPTION', suffix: 'intake', name: 'Intake Officer' },
            { role: 'LAB_TECHNICIAN', suffix: 'tech1', name: 'Technician 1' },
            { role: 'LAB_TECHNICIAN', suffix: 'tech2', name: 'Technician 2' },
            { role: 'AUDIT_USER', suffix: 'audit', name: 'Audit Officer' },
            { role: 'EXTERNAL_VIEWER', suffix: 'farmer', name: 'External Partner' }
        ];

        const defaultPassword = 'password';
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const createdUsers = [];
        for (const r of roles) {
            const username = `${code.toLowerCase()}_${r.suffix}`;
            const userId = `user-${code}-${r.suffix}-${Date.now()}`;

            try {
                const user = await prisma.user.create({
                    data: {
                        id: userId,
                        username,
                        password: hashedPassword,
                        email: email ? `${r.suffix}@${email.split('@')[1] || 'placeholder.com'}` : `${username}@soilfer.org`,
                        name: `${name} ${r.name}`,
                        role: r.role,
                        labId: id,
                        mustChangePassword: true,
                        isActive: true
                    }
                });
                createdUsers.push({ username, role: r.role, name: r.name, password: defaultPassword });
            } catch (userErr) {
                console.error(`Failed to create user ${username}:`, userErr);
            }
        }

        // 2. GENERATE DEFAULT TEST PROJECT
        const testProjectCode = `TEST-${code}`;
        const existingProject = await prisma.project.findUnique({ where: { code: testProjectCode } });

        if (!existingProject) {
            await prisma.project.create({
                data: {
                    id: `proj-${testProjectCode}-${Date.now()}`,
                    code: testProjectCode,
                    name: `${name} Test Project`,
                    description: 'Automated test project for laboratory onboarding.',
                    status: 'ACTIVE',
                    projectType: 'OPEN_INTAKE',
                    labId: id,
                    priority: 'NORMAL'
                }
            });
        }

        // 3. AUDIT LOG
        await prisma.auditLog.create({
            data: {
                id: `audit-lab-create-${Date.now()}`,
                entity: 'LAB',
                entityId: id,
                action: 'CREATE',
                details: `Lab "${name}" (${code}) created with ${createdUsers.length} staff accounts`,
                performedBy: req.user.username,
                labId: id,
                timestamp: new Date()
            }
        });

        res.json({
            success: true,
            lab: newLab,
            staff: createdUsers,
            message: 'Lab created with staff accounts and test project.'
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create lab' });
    }
});

// ─── PUT /api/labs/:id ─── Update lab details
router.put('/:id', checkPermission('MANAGE_BRANDING'), async (req, res) => {

    const { projectId, capacity, ...labData } = req.body;

    try {
        const updated = await prisma.lab.update({
            where: { id: req.params.id },
            data: {
                ...labData,
                capacity: capacity ? parseInt(capacity) : null,
                projectCode: projectId
            }
        });

        res.json(updated);
    } catch (e) {
        console.error(e);
        if (e.code === 'P2025') return res.status(404).json({ error: 'Lab not found' });
        res.status(500).json({ error: 'Update failed' });
    }
});

module.exports = router;
