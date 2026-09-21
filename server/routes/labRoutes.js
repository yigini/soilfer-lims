const labLifecycleService = require('../services/labLifecycleService');
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { verifyToken, checkPermission } = require('../middleware/authMiddleware');
const bcrypt = require('bcryptjs');

function parseOptionalCapacity(val) {
    if (val === undefined) return undefined;
    if (val === null || (typeof val === 'string' && val.trim() === '')) return null;
    let num;
    if (typeof val === 'number') {
        num = val;
    } else if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!/^\d+$/.test(trimmed)) return NaN;
        num = Number(trimmed);
    } else {
        return NaN;
    }
    if (!Number.isInteger(num) || num < 0 || !Number.isSafeInteger(num) || num > 2147483647) {
        return NaN;
    }
    return num;
}

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

        let userCountries = [];
        if (req.user.countries) {
            userCountries = Array.isArray(req.user.countries)
                ? req.user.countries
                : (typeof req.user.countries === 'string' ? JSON.parse(req.user.countries) : []);
        }

        const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
        const userLabId = req.user.labId;

        const sanitized = enriched.map(lab => {
            let canSeeNotes = false;
            if (isSuperAdmin) {
                canSeeNotes = true;
            } else if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(req.user.role)) {
                canSeeNotes = userCountries.includes(lab.country);
            } else if (userLabId && userLabId === lab.id) {
                canSeeNotes = true;
            }

            if (!canSeeNotes) {
                const { notes, ...safeLab } = lab;
                return safeLab;
            }
            return lab;
        });

        res.json(sanitized);
    } catch (e) {
        console.error('[GET /api/labs] Error:', e);
        res.status(500).json({ error: 'Failed to fetch labs' });
    }
});

// ─── GET /api/labs/directory ─── Lightweight public lab directory
router.get('/directory', async (req, res) => {
    try {
        const labs = await prisma.lab.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true, country: true, location: true, city: true, isActive: true },
            orderBy: { name: 'asc' }
        });
        res.json(labs.map(l => ({ ...l, operationalStatus: l.isActive ? 'ACTIVE' : 'PAUSED' })));
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch directory' });
    }
});

// ─── GET /api/labs/:id ─── Laboratory Directory Profile Entry (#114)
// DIRECTORY-ACCESS POLICY:
// Returns public directory-level laboratory profile fields ({ id, code, name, location, country, city, isActive }).
// Accessible to any authenticated user to allow client components (Reception, LocationPicker, profile view)
// to resolve laboratory coordinates, name, and operational status without leaking sensitive data.
// SCOPED AUTHORIZATION NOTE:
// Authentication grants access to this directory lookup only. Operational authority and sensitive data
// (workspaces via GET /:id/workspace, staff rosters via GET /:id/staff, lifecycle transitions via POST /:id/lifecycle,
// and method editing via PUT /:id) remain strictly scoped to assigned laboratory managers, authorized national users,
// or SUPER_ADMIN. Directory access does NOT grant operational authority over the laboratory.
router.get('/:id', async (req, res) => {
    try {
        const lab = await prisma.lab.findUnique({
            where: { id: req.params.id },
            select: { id: true, code: true, name: true, location: true, country: true, city: true, isActive: true }
        });
        if (!lab) return res.status(404).json({ error: 'Lab not found' });
        res.json(lab);
    } catch (e) {
        console.error(`[GET /api/labs/${req.params.id}]`, e);
        res.status(500).json({ error: 'Failed to fetch laboratory configuration' });
    }
});

// ─── GET /api/labs/:id/staff ─── Staff roster for a specific lab
router.get('/:id/staff', async (req, res) => {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isOwnLabManager = req.user.role === 'LAB_MANAGER' && req.user.labId === req.params.id;
    let isAuthorizedNational = false;
    if (req.user.role === 'MASTER_USER') {
        const lab = await prisma.lab.findUnique({ where: { id: req.params.id }, select: { country: true } });
        const userCountries = Array.isArray(req.user.countries) ? req.user.countries : (typeof req.user.countries === 'string' ? JSON.parse(req.user.countries) : []);
        if (lab && userCountries.includes(lab.country)) {
            isAuthorizedNational = true;
        }
    }

    if (!isSuperAdmin && !isOwnLabManager && !isAuthorizedNational) {
        return res.status(403).json({ error: 'Unauthorized: insufficient permissions to view staff for this laboratory' });
    }

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
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can modify laboratory operational status' });
    }

    try {
        const lab = await prisma.lab.findUnique({ where: { id: req.params.id } });
        if (!lab) return res.status(404).json({ error: 'Lab not found' });

        const newActive = !lab.isActive;

        // Wrap update and audit atomically in a transaction (LG-05, P08)
        const updated = await prisma.$transaction(async (tx) => {
            const l = await tx.lab.update({
                where: { id: req.params.id },
                data: { isActive: newActive }
            });

            await tx.$executeRawUnsafe(`
                INSERT INTO "LabLifecycleState" ("labId", "operationalStatus", "revision", "updatedAt")
                VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT("labId") DO UPDATE SET
                    "operationalStatus" = excluded."operationalStatus",
                    "revision" = "LabLifecycleState"."revision" + 1,
                    "updatedAt" = CURRENT_TIMESTAMP
            `, req.params.id, newActive ? 'ACTIVE' : 'PAUSED');

            await tx.auditLog.create({
                data: {
                    id: `audit-lab-toggle-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    entity: 'LAB',
                    entityId: req.params.id,
                    action: 'STATUS_CHANGE',
                    details: `Lab ${newActive ? 'activated' : 'deactivated'}`,
                    performedBy: req.user.username,
                    labId: req.params.id,
                    timestamp: new Date()
                }
            });

            return l;
        });

        res.json({ ...updated, isActive: newActive });
    } catch (e) {
        console.error('[PATCH toggle-active]', e);
        res.status(500).json({ error: 'Toggle failed' });
    }
});

// ─── PATCH /api/labs/:id/staff/:userId/toggle ─── Toggle individual staff member active status
router.patch('/:id/staff/:userId/toggle', checkPermission('MANAGE_USERS'), async (req, res) => {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isOwnLabManager = req.user.role === 'LAB_MANAGER' && req.user.labId === req.params.id;

    if (!isSuperAdmin && !isOwnLabManager) {
        return res.status(403).json({ error: 'Unauthorized to manage staff for this laboratory' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.labId !== req.params.id) return res.status(403).json({ error: 'User does not belong to this lab' });

        // Lab manager role hierarchy restrictions (LG-01, LG-06)
        if (isOwnLabManager) {
            const { ALLOWED_SUB_ROLES } = require('../config/roles');
            if (!ALLOWED_SUB_ROLES.includes(user.role)) {
                return res.status(403).json({ error: 'Lab Managers may only manage subordinate laboratory staff' });
            }
        }

        // Protect last active super administrator
        if (user.role === 'SUPER_ADMIN' && user.isActive) {
            const adminCount = await prisma.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } });
            if (adminCount <= 1) {
                return res.status(403).json({ error: 'LAST_ADMIN_PROTECTED', message: 'Cannot deactivate the last active Super Administrator' });
            }
        }

        const newActive = !user.isActive;
        const newVersion = (user.tokenVersion || 0) + 1;

        const updated = await prisma.$transaction(async (tx) => {
            const u = await tx.user.update({
                where: { id: req.params.userId },
                data: {
                    isActive: newActive,
                    tokenVersion: newVersion
                }
            });

            await tx.auditLog.create({
                data: {
                    id: `audit-staff-toggle-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    entity: 'USER',
                    entityId: req.params.userId,
                    action: 'STATUS_CHANGE',
                    details: `Staff ${newActive ? 'activated' : 'deactivated'}: ${user.username}`,
                    performedBy: req.user.username,
                    labId: req.params.id,
                    timestamp: new Date()
                }
            });

            return u;
        });

        const { password: _, ...safe } = updated;
        res.json(safe);
    } catch (e) {
        console.error('[PATCH staff toggle]', e);
        res.status(500).json({ error: 'Toggle failed' });
    }
});

// ─── PATCH /api/labs/:id/staff/:userId/reset-password ─── Reset staff password
router.patch('/:id/staff/:userId/reset-password', checkPermission('MANAGE_USERS'), async (req, res) => {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isOwnLabManager = req.user.role === 'LAB_MANAGER' && req.user.labId === req.params.id;

    if (!isSuperAdmin && !isOwnLabManager) {
        return res.status(403).json({ error: 'Unauthorized to reset credentials for this laboratory' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.userId } });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.labId !== req.params.id) return res.status(403).json({ error: 'User does not belong to this lab' });

        // Lab manager role hierarchy restrictions (LG-01, P02)
        if (isOwnLabManager) {
            const { ALLOWED_SUB_ROLES } = require('../config/roles');
            if (!ALLOWED_SUB_ROLES.includes(user.role)) {
                return res.status(403).json({ error: 'TARGET_ROLE_NOT_MANAGEABLE', message: 'Lab Managers may only reset credentials for subordinate laboratory staff' });
            }
        }

        // Generate cryptographically secure random temporary password (LG-03)
        const crypto = require('crypto');
        const tempPassword = 'SL-' + crypto.randomBytes(6).toString('hex') + '!' + (Math.floor(Math.random() * 90) + 10);
        const hashed = await bcrypt.hash(tempPassword, 10);
        const newVersion = (user.tokenVersion || 0) + 1;

        await prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: req.params.userId },
                data: {
                    password: hashed,
                    mustChangePassword: true,
                    tokenVersion: newVersion
                }
            });

            await tx.auditLog.create({
                data: {
                    id: `audit-staff-reset-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    entity: 'USER',
                    entityId: req.params.userId,
                    action: 'PASSWORD_RESET',
                    details: `Administrative password reset for ${user.username}`,
                    performedBy: req.user.username,
                    labId: req.params.id,
                    timestamp: new Date()
                }
            });
        });

        res.json({ success: true, username: user.username, tempPassword, temporaryPassword: tempPassword, message: 'Password reset. User must change on next login.' });
    } catch (e) {
        console.error('[PATCH reset-password]', e);
        res.status(500).json({ error: 'Reset failed' });
    }
});

// ─── POST /api/labs ─── Create a new lab
router.post('/', checkPermission('MANAGE_BRANDING'), async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Only Super Administrators can create laboratories' });
    }

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

        let safeCapacity = null;
        if (capacity !== undefined) {
            safeCapacity = parseOptionalCapacity(capacity);
            if (Number.isNaN(safeCapacity)) {
                return res.status(400).json({ error: 'Capacity must be a non-negative whole integer or blank', code: 'INVALID_CAPACITY' });
            }
        }

        const newLab = await prisma.$transaction(async (tx) => {
            const lab = await tx.lab.create({
                data: {
                    id, code, name, country, location, address, city, phone, email, website,
                    capacity: safeCapacity,
                    timezone, notes,
                    projectCode: projectId,
                    isActive: false
                }
            });

            await tx.$executeRawUnsafe(`
                INSERT INTO "LabLifecycleState" ("labId", "operationalStatus", "revision", "updatedAt")
                VALUES (?, 'SETUP', 1, CURRENT_TIMESTAMP)
                ON CONFLICT("labId") DO UPDATE SET
                    "operationalStatus" = 'SETUP',
                    "updatedAt" = CURRENT_TIMESTAMP
            `, id);

            await tx.auditLog.create({
                data: {
                    id: `audit-lab-create-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    entity: 'LAB',
                    entityId: id,
                    action: 'CREATE',
                    details: `Lab "${name}" (${code}) created by ${req.user.username}`,
                    performedBy: req.user.username,
                    labId: id,
                    timestamp: new Date()
                }
            });

            return lab;
        });

        res.json({
            success: true,
            lab: newLab,
            message: 'Lab created successfully.'
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to create lab' });
    }
});

// ─── PUT /api/labs/:id ─── Update lab details
router.put('/:id', checkPermission('MANAGE_BRANDING'), async (req, res) => {
    const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
    const isOwnLabManager = req.user.role === 'LAB_MANAGER' && req.user.labId === req.params.id;

    if (!isSuperAdmin && !isOwnLabManager) {
        return res.status(403).json({ error: 'Unauthorized to update this laboratory profile' });
    }

    // Reject immutable identity and lifecycle fields (LG-02, P05)
    if (req.body.id && req.body.id !== req.params.id) {
        return res.status(400).json({ error: 'IMMUTABLE_FIELDS_REJECTED', message: 'Cannot alter immutable laboratory identifier' });
    }
    if (req.body.isActive !== undefined) {
        return res.status(400).json({ error: 'IMMUTABLE_FIELDS_REJECTED', message: 'Laboratory operational status must be changed via dedicated lifecycle endpoint' });
    }
    if (req.body.createdAt !== undefined) {
        return res.status(400).json({ error: 'IMMUTABLE_FIELDS_REJECTED', message: 'Cannot modify createdAt' });
    }

    const {
        name, country, location, address, city, phone, email, website,
        capacity, timezone, notes, projectId
    } = req.body;

    const data = {};
    if (name !== undefined) data.name = name;
    if (country !== undefined) data.country = country;
    if (location !== undefined) data.location = location;
    if (address !== undefined) data.address = address;
    if (city !== undefined) data.city = city;
    if (phone !== undefined) data.phone = phone;
    if (email !== undefined) data.email = email;
    if (website !== undefined) data.website = website;
    if (capacity !== undefined) {
        const safeCapacity = parseOptionalCapacity(capacity);
        if (Number.isNaN(safeCapacity)) {
            return res.status(400).json({ error: 'Capacity must be a non-negative whole integer or blank', code: 'INVALID_CAPACITY' });
        }
        data.capacity = safeCapacity;
    }
    if (timezone !== undefined) data.timezone = timezone;
    if (notes !== undefined) data.notes = notes;
    if (projectId !== undefined) data.projectCode = projectId;

    try {
        const updated = await prisma.$transaction(async (tx) => {
            const lab = await tx.lab.update({
                where: { id: req.params.id },
                data
            });

            await tx.auditLog.create({
                data: {
                    id: `audit-lab-update-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    entity: 'LAB',
                    entityId: req.params.id,
                    action: 'UPDATE',
                    details: `Lab profile updated: ${Object.keys(data).join(', ')}`,
                    performedBy: req.user.username,
                    labId: req.params.id,
                    timestamp: new Date()
                }
            });

            return lab;
        });

        res.json(updated);
    } catch (e) {
        console.error(e);
        if (e.code === 'P2025') return res.status(404).json({ error: 'Lab not found' });
        res.status(500).json({ error: 'Update failed' });
    }
});


// ─── GET /api/labs/:id/workspace ─── Detailed operational workspace
router.get('/:id/workspace', async (req, res) => {
    try {
        const workspace = await labLifecycleService.getLabWorkspace(req.user, req.params.id, req.query);
        res.json(workspace);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
});

// ─── PATCH /api/labs/:id/profile ─── Strict allowlist profile updates
router.patch('/:id/profile', checkPermission('MANAGE_BRANDING'), async (req, res) => {
    try {
        const updated = await labLifecycleService.updateLabProfile(req.user, req.params.id, req.body);
        res.json(updated);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message, message: err.message, code: err.code });
    }
});

// ─── POST /api/labs/:id/lifecycle-preview ─── Preview lifecycle transition impact
router.post('/:id/lifecycle-preview', checkPermission('MANAGE_BRANDING'), async (req, res) => {
    try {
        const { targetState } = req.body;
        const preview = await labLifecycleService.getLifecyclePreview(req.user, req.params.id, targetState);
        res.json(preview);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
});

// ─── POST /api/labs/:id/lifecycle ─── Transition laboratory operational lifecycle state
router.post('/:id/lifecycle', checkPermission('MANAGE_BRANDING'), async (req, res) => {
    try {
        const { targetState, reason, reviewToken } = req.body;
        const result = await labLifecycleService.transitionLifecycle(req.user, req.params.id, { targetState, reason, reviewToken });
        res.json(result);
    } catch (err) {
        res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
    }
});

module.exports = router;
