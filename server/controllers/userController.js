const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { ALL_ROLES, ALLOWED_SUB_ROLES } = require('../config/roles');

const canManage = (actor, target) => {
    if (!actor || !target) return false;
    if (actor.role === 'SUPER_ADMIN') return true;

    // Helper to parse countries
    const getCountries = (u) => typeof u.countries === 'string' ? JSON.parse(u.countries) : (u.countries || []);

    // Lab Manager: Can manage sub-roles in their OWN lab
    if (actor.role === 'LAB_MANAGER') {
        if (!actor.labId) return false;
        if (target.labId !== actor.labId) return false;
        if (['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'].includes(target.role) && target.id !== actor.id) {
            return false;
        }
        return true;
    }

    // Self-profile edit is permitted (checked for allowed fields in updateUser)
    if (actor.id === target.id) return true;

    return false;
};

exports.getUsers = async (req, res) => {
    const actor = req.user;
    const { page = 1, limit = 20, search, role, labId, country } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    try {
        const andConditions = [];

        // 1. Scoping (Security) - HARD ISOLATION
        if (actor.role !== 'SUPER_ADMIN') {
            if (actor.role === 'LAB_MANAGER') {
                if (actor.labId) {
                    andConditions.push({ labId: actor.labId });
                } else {
                    return res.status(403).json({ error: 'Manager lacks Lab ID' });
                }
            } else if (['MASTER_USER', 'COUNTRY_ADMIN'].includes(actor.role)) {
                if (actor.countries && actor.countries.length > 0) {
                    const countryList = typeof actor.countries === 'string' ? JSON.parse(actor.countries) : actor.countries;
                    andConditions.push({ country: { in: countryList } });
                }
            } else {
                andConditions.push({ id: actor.id });
            }
        }

        // 2. Filters (Applied with AND, never overriding security constraints)
        if (role) andConditions.push({ role });
        if (labId && actor.role === 'SUPER_ADMIN') {
            andConditions.push({ labId });
        }
        if (search && search.trim()) {
            const term = search.trim();
            andConditions.push({
                OR: [
                    { username: { contains: term } },
                    { name: { contains: term } },
                    { email: { contains: term } }
                ]
            });
        }

        const where = andConditions.length > 0 ? { AND: andConditions } : {};

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

    if (!ALL_ROLES.includes(role)) {
        return res.status(400).json({ error: `Invalid role '${role}'. Must be one of: ${ALL_ROLES.join(', ')}` });
    }

    try {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) return res.status(400).json({ error: 'Username already exists' });

        if (actor.role === 'LAB_MANAGER') {
            if (!actor.labId) return res.status(403).json({ error: 'Manager has no Lab assigned' });
            if (!ALLOWED_SUB_ROLES.includes(role)) {
                return res.status(403).json({ error: `Lab Managers may only create: ${ALLOWED_SUB_ROLES.join(', ')}` });
            }
        } else if (actor.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ error: 'Only administrators can create users' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                id: crypto.randomUUID(),
                username,
                password: hashedPassword,
                role,
                name: name || username,
                email: email || `${username}@soilfer.org`,
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
                details: `Created user ${username} (${role}) in lab ${newUser.labId}`,
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

        const isSelf = actor.id === target.id;
        const isSuperAdmin = actor.role === 'SUPER_ADMIN';

        // Prevent self-privilege escalation
        if (isSelf && !isSuperAdmin) {
            if (updates.role && updates.role !== target.role) {
                return res.status(403).json({ error: 'Cannot modify your own role' });
            }
            if (updates.labId && updates.labId !== target.labId) {
                return res.status(403).json({ error: 'Cannot modify your own lab assignment' });
            }
            if (updates.countries || updates.projects) {
                return res.status(403).json({ error: 'Cannot modify your own country or project scopes' });
            }
        }

        // Validate role changes
        if (updates.role && updates.role !== target.role) {
            if (!ALL_ROLES.includes(updates.role)) {
                return res.status(400).json({ error: `Invalid role '${updates.role}'` });
            }
            if (actor.role === 'LAB_MANAGER') {
                if (!ALLOWED_SUB_ROLES.includes(updates.role)) {
                    return res.status(403).json({ error: `Lab Managers may only assign: ${ALLOWED_SUB_ROLES.join(', ')}` });
                }
            } else if (!isSuperAdmin) {
                return res.status(403).json({ error: 'Only Super Admins can assign management roles' });
            }
        }

        // Build data using strict allowlist
        const data = {};
        if (updates.name !== undefined) data.name = updates.name;
        if (updates.email !== undefined) data.email = updates.email;
        if (updates.language !== undefined) data.language = updates.language;

        if (updates.password) {
            data.password = await bcrypt.hash(updates.password, 10);
            data.mustChangePassword = true;
        }

        // Privileged fields
        if (isSuperAdmin) {
            if (updates.role !== undefined) data.role = updates.role;
            if (updates.labId !== undefined) data.labId = updates.labId;
            if (updates.isActive !== undefined) data.isActive = Boolean(updates.isActive);
            if (updates.countries !== undefined) data.countries = JSON.stringify(updates.countries);
            if (updates.projects !== undefined) data.projects = JSON.stringify(updates.projects);
        } else if (actor.role === 'LAB_MANAGER') {
            if (updates.role !== undefined && ALLOWED_SUB_ROLES.includes(updates.role)) {
                data.role = updates.role;
            }
            if (updates.isActive !== undefined && !isSelf) {
                data.isActive = Boolean(updates.isActive);
            }
        }

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
                details: `Updated fields: ${Object.keys(data).join(', ')} on user ${target.username}`,
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
