const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { error, success } = require('../i18n/response');

const { JWT_SECRET: SECRET_KEY } = require('../config/auth');
const { getPermissionsForRole } = require('../config/roles');

// Helper to sanitize user object from DB (parse JSON strings, exclude password)
const sanitizeUser = (user) => {
    if (!user) return null;
    const { password: _, ...safeUser } = user;
    return {
        ...safeUser,
        countries: typeof user.countries === 'string' ? JSON.parse(user.countries) : (user.countries || []),
        projects: typeof user.projects === 'string' ? JSON.parse(user.projects) : (user.projects || []),
        permissions: getPermissionsForRole(user.role)
    };
};

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (!user) {
            return error(res, 401, 'AUTH.INVALID_CREDENTIALS', 'Invalid credentials');
        }

        // Verify Password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return error(res, 401, 'AUTH.INVALID_CREDENTIALS', 'Invalid credentials');
        }

        // Check if account is active
        if (user.isActive === false) {
            return error(res, 401, 'AUTH.ACCOUNT_DEACTIVATED', 'This account has been deactivated. Please contact your administrator.');
        }

        // Generate Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        // Return user info with effective permissions
        const safeUser = sanitizeUser(user);
        return success(res, 'AUTH.LOGIN_SUCCESS', 'Login successful', null, 200, { token, user: safeUser });
    } catch (err) {
        console.error('[AUTH] Login Error:', err);
        return error(res, 500, 'AUTH.INTERNAL', 'Internal server error');
    }
};

exports.me = (req, res) => {
    // req.user is sanitized and contains permissions from verifyToken middleware
    res.json(req.user);
};

exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const user = await prisma.user.findUnique({
            where: { id: String(userId) }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            return res.status(400).json({ error: 'Current password incorrect' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        const isSame = await bcrypt.compare(newPassword, user.password);
        if (isSame) {
            return res.status(400).json({ error: 'New password cannot be the same as the old one' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update Password and Clear Flag
        await prisma.user.update({
            where: { id: String(userId) },
            data: {
                password: hashedPassword,
                mustChangePassword: false
            }
        });

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('[AUTH] Change Password Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

exports.impersonate = async (req, res) => {
    const { userId } = req.body;
    const adminUser = req.user;

    if (!adminUser || adminUser.role !== 'SUPER_ADMIN') {
        return error(res, 403, 'AUTH.FORBIDDEN', 'Only Super Admins can impersonate users');
    }

    try {
        const targetUser = await prisma.user.findUnique({
            where: { id: String(userId) }
        });

        if (!targetUser) {
            return error(res, 404, 'AUTH.USER_NOT_FOUND', 'Target user not found');
        }

        if (targetUser.role === 'SUPER_ADMIN') {
            return error(res, 403, 'AUTH.FORBIDDEN', 'Cannot impersonate another Super Admin');
        }

        // Mint short-lived token (30m) with actor claim
        const token = jwt.sign(
            {
                id: targetUser.id,
                username: targetUser.username,
                role: targetUser.role,
                act: { id: adminUser.id, username: adminUser.username }
            },
            SECRET_KEY,
            { expiresIn: '30m' }
        );

        // Record in audit log
        await prisma.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'USER',
                entityId: targetUser.id,
                action: 'IMPERSONATE_START',
                details: `Super Admin ${adminUser.username} initiated 30-min impersonation of ${targetUser.username} (${targetUser.role})`,
                performedBy: adminUser.username,
                timestamp: new Date()
            }
        });

        const safeUser = sanitizeUser(targetUser);
        return res.json({
            success: true,
            token,
            user: safeUser,
            data: { token, user: safeUser }
        });
    } catch (err) {
        console.error('[AUTH] Impersonate Error:', err);
        return error(res, 500, 'AUTH.INTERNAL', 'Failed to impersonate user');
    }
};
