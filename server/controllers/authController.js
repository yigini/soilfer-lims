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
        themePreference: user.themePreference || 'light',
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
            { id: user.id, username: user.username, role: user.role, tokenVersion: user.tokenVersion || 0 },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        // Return user info with effective permissions
        const safeUser = sanitizeUser(user);
        return res.status(200).json({
            messageCode: 'AUTH.LOGIN_SUCCESS',
            message: 'Login successful',
            token,
            user: safeUser,
            data: { token, user: safeUser }
        });
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
        const newVersion = (user.tokenVersion || 0) + 1;

        // Update Password, Clear Flag, and Increment tokenVersion
        await prisma.user.update({
            where: { id: String(userId) },
            data: {
                password: hashedPassword,
                mustChangePassword: false,
                tokenVersion: newVersion
            }
        });

        // Issue freshly signed JWT with new tokenVersion
        const newToken = jwt.sign(
            { id: user.id, username: user.username, role: user.role, tokenVersion: newVersion },
            SECRET_KEY,
            { expiresIn: '24h' }
        );

        res.json({ message: 'Password updated successfully', token: newToken });
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

exports.updatePreferences = async (req, res) => {
    if (!req.user || !req.user.id) {
        return error(res, 401, 'AUTH.UNAUTHORIZED', 'Authentication required');
    }

    // Impersonated sessions must not alter the real user's profile preferences
    if (req.isImpersonating || req.user.isImpersonated || req.actor) {
        return error(res, 403, 'AUTH.IMPERSONATION_PREFERENCE_BLOCKED', 'Preferences cannot be modified during an impersonation session.');
    }

    const allowedKeys = ['themePreference', 'language'];
    const bodyKeys = Object.keys(req.body || {});

    // Reject unknown fields or attempts to inject roles, permissions, passwords, or target IDs
    const invalidKeys = bodyKeys.filter(k => !allowedKeys.includes(k));
    if (invalidKeys.length > 0) {
        return error(res, 400, 'AUTH.INVALID_PREFERENCE_FIELDS', `Unexpected fields in preference update: ${invalidKeys.join(', ')}`);
    }

    const { themePreference, language } = req.body || {};

    if (bodyKeys.length === 0) {
        return error(res, 400, 'AUTH.EMPTY_PREFERENCES', 'At least one preference field must be provided');
    }

    const updateData = {};
    const responseData = {};

    if (themePreference !== undefined) {
        if (!themePreference || typeof themePreference !== 'string') {
            return error(res, 400, 'AUTH.INVALID_THEME_PREFERENCE', 'Theme preference must be a valid string');
        }
        if (!['light', 'dark'].includes(themePreference)) {
            return error(res, 400, 'AUTH.INVALID_THEME_PREFERENCE', 'Theme preference must be strictly "light" or "dark"');
        }
        updateData.themePreference = themePreference;
    }

    if (language !== undefined) {
        const { matchSupportedLocale } = require('../utils/localeResolver');
        if (!language || typeof language !== 'string') {
            return error(res, 400, 'AUTH.INVALID_LANGUAGE_PREFERENCE', 'Language must be a valid string');
        }
        const matched = matchSupportedLocale(language);
        if (!matched) {
            return error(res, 400, 'AUTH.INVALID_LANGUAGE_PREFERENCE', `Unsupported language: ${language}`);
        }
        updateData.language = matched;
    }

    try {
        const updated = await prisma.user.update({
            where: { id: String(req.user.id) },
            data: updateData,
            select: {
                id: true,
                username: true,
                themePreference: true,
                language: true
            }
        });

        if (themePreference !== undefined) {
            responseData.themePreference = updated.themePreference;
        }
        if (language !== undefined) {
            responseData.language = updated.language;
        }

        return success(res, 'AUTH.PREFERENCES_UPDATED', 'Preferences updated successfully', null, 200, responseData);
    } catch (err) {
        console.error('[AUTH] Update Preferences Error:', err);
        return error(res, 500, 'AUTH.INTERNAL', 'Failed to update preferences');
    }
};
