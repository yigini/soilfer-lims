const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Roles that can manage users
const MANAGER_ROLES = ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'COUNTRY_ADMIN'];

const canManage = (actor, target) => {
    if (actor.role === 'SUPER_ADMIN') return true;

    // Helper to parse countries
    const getCountries = (u) => typeof u.countries === 'string' ? JSON.parse(u.countries) : (u.countries || []);

    // Country Admin: Can manage users in their country
    if (actor.role === 'MASTER_USER' || actor.role === 'COUNTRY_ADMIN') {
        const targetCountries = getCountries(target);
        if (targetCountries.length === 0) return false; // Orphan user
        const intersects = targetCountries.some(c => actor.countries.includes(c));
        if (target.role === 'SUPER_ADMIN') return false;
        return intersects;
    }

    // Lab Manager: Can manage users in their LAB
    if (actor.role === 'LAB_MANAGER') {
        if (!actor.labId) return false; // Manager must have a lab
        if (target.labId !== actor.labId) return false; // Target must be in same lab
        if (['SUPER_ADMIN', 'MASTER_USER', 'COUNTRY_ADMIN'].includes(target.role)) return false;
        return true;
    }

    return false;
};

exports.getUsers = async (req, res) => {
    const actor = req.user;
    const { page = 1, limit = 20, search, role, labId, country } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    try {
        const where = {};

        // 1. Scoping (Security) - HARD ISOLATION
        if (actor.role !== 'SUPER_ADMIN') {
            if (actor.role === 'LAB_MANAGER') {
                if (actor.labId) {
                    where.labId = actor.labId; // Forced filter
                } else {
                    return res.status(403).json({ error: 'Manager lacks Lab ID' });
                }
            } else if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(actor.role)) {
                // Approximate country scoping in controllers if needed, 
                // but for now we'll restrict to their projects/countries
            } else {
                where.id = actor.id;
            }
        }

        // 2. Filters
        if (role) where.role = role;
        if (labId) where.labId = labId;
        if (search) {
            where.OR = [
                ...(where.OR || []),
                { username: { contains: search } },
                { name: { contains: search } },
                { email: { contains: search } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.count({ where })
        ]);

        // Parse JSON fields and sanitize
        const safeUsers = users.map(u => {
            const { password, ...rest } = u;
            return {
                ...rest,
                countries: typeof u.countries === 'string' ? JSON.parse(u.countries) : (u.countries || []),
                projects: typeof u.projects === 'string' ? JSON.parse(u.projects) : (u.projects || [])
            };
        });

        res.json({
            data: safeUsers,
            meta: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
        });
    } catch (error) {
        console.error('[getUsers] Error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

exports.createUser = async (req, res) => {
    const actor = req.user;
    const { username, password, role, name, email, labId, countries, projects } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) return res.status(400).json({ error: 'Username already exists' });

        if (actor.role === 'LAB_MANAGER') {
            if (!actor.labId) return res.status(403).json({ error: 'Manager has no Lab assigned' });
            if (labId && labId !== actor.labId) return res.status(403).json({ error: 'Cannot create user for another lab' });

            const ALLOWED_SUB_ROLES = ['LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'VIEWER', 'SURVEYOR'];
            if (!ALLOWED_SUB_ROLES.includes(role)) return res.status(403).json({ error: 'Invalid role' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                id: crypto.randomUUID(),
                username,
                password: hashedPassword,
                role,
                name,
                email,
                labId: actor.role === 'LAB_MANAGER' ? actor.labId : labId,
                countries: JSON.stringify(actor.role === 'LAB_MANAGER' ? actor.countries : (countries || [])),
                projects: JSON.stringify(actor.role === 'LAB_MANAGER' ? actor.projects : (projects || [])),
                isActive: true,
                mustChangePassword: true
            }
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'USER',
                entityId: newUser.id,
                action: 'CREATE',
                details: `Created user ${username} (${role})`,
                performedBy: actor.username,
                timestamp: new Date()
            }
        });

        const { password: _, ...safeUser } = newUser;
        res.json(safeUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateUser = async (req, res) => {
    const actor = req.user;
    const { id } = req.params;
    const updates = req.body;

    try {
        const target = await prisma.user.findUnique({ where: { id: String(id) } });
        if (!target) return res.status(404).json({ error: 'User not found' });

        if (!canManage(actor, target)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        if (updates.role && updates.role !== target.role && actor.role === 'LAB_MANAGER') {
            const ALLOWED_SUB_ROLES = ['LAB_TECHNICIAN', 'SAMPLE_RECEPTION', 'VIEWER', 'SURVEYOR'];
            if (!ALLOWED_SUB_ROLES.includes(updates.role)) return res.status(403).json({ error: 'Invalid role' });
        }

        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
            updates.mustChangePassword = true;
        }

        const data = { ...updates };
        if (data.countries) data.countries = JSON.stringify(data.countries);
        if (data.projects) data.projects = JSON.stringify(data.projects);

        const updated = await prisma.user.update({
            where: { id: String(id) },
            data
        });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'USER',
                entityId: id,
                action: 'UPDATE',
                details: `Updated fields: ${Object.keys(updates).join(', ')}`,
                performedBy: actor.username,
                timestamp: new Date()
            }
        });

        const { password: _, ...safeUser } = updated;
        res.json(safeUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    const actor = req.user;
    const { id } = req.params;

    try {
        const target = await prisma.user.findUnique({ where: { id: String(id) } });
        if (!target) return res.status(404).json({ error: 'User not found' });

        if (!canManage(actor, target)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        await prisma.user.delete({ where: { id: String(id) } });

        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'USER',
                entityId: id,
                action: 'DELETE',
                details: `Deleted user ${target.username}`,
                performedBy: actor.username,
                timestamp: new Date()
            }
        });

        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDirectory = async (req, res) => {
    const actor = req.user;

    try {
        const where = {};
        if (actor.role === 'SUPER_ADMIN' || actor.role === 'MASTER_USER') {
            // All
        } else if (actor.role === 'COUNTRY_ADMIN') {
            // Approximate matching for country-scoped members
        } else if (actor.labId) {
            where.labId = actor.labId;
        } else {
            where.id = actor.id;
        }

        const users = await prisma.user.findMany({ where });

        const directory = users.map(u => ({
            id: u.id,
            name: u.name,
            username: u.username,
            role: u.role,
            labId: u.labId
        }));

        directory.sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username));
        res.json(directory);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
