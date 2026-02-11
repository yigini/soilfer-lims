const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

const { JWT_SECRET: SECRET_KEY } = require('../config/auth');
if (!SECRET_KEY) {
    throw new Error('JWT_SECRET is not defined in config/auth (checking .env)');
}

/**
 * AUTHORITATIVE PERMISSION MATRIX
 * Based on: LIMS – Roles, Inventory, Sample Lifecycle, and Production Completeness
 */
const PERMISSIONS = {
    // RESOURCE: [Roles allowed]

    // Samples
    'VIEW_SAMPLES': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'SURVEYOR', 'VIEWER'],
    'CREATE_SAMPLE': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'SURVEYOR'],
    'RECEIVE_SAMPLE': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],
    'ASSIGN_LAB_ID': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION'],
    'CHANGE_STATUS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN'], // Tech limited, checked in logic

    // Results
    'ENTER_RESULTS': ['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'],
    'APPROVE_RESULTS': ['SUPER_ADMIN', 'LAB_MANAGER'],
    'BATCH_APPROVAL': ['SUPER_ADMIN', 'LAB_MANAGER'],

    // Inventory
    'VIEW_INVENTORY': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER', 'SAMPLE_RECEPTION', 'LAB_TECHNICIAN', 'VIEWER'],
    'CONSUME_INVENTORY': ['SUPER_ADMIN', 'LAB_MANAGER', 'LAB_TECHNICIAN'],
    'MANAGE_INVENTORY': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // Projects
    'MANAGE_PROJECTS': ['SUPER_ADMIN', 'MASTER_USER', 'PROJECT_MANAGER', 'LAB_MANAGER'],
    'ARCHIVE_PROJECTS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // Users
    'MANAGE_USERS': ['SUPER_ADMIN', 'MASTER_USER', 'LAB_MANAGER'],

    // System
    'MANAGE_BRANDING': ['SUPER_ADMIN', 'LAB_MANAGER'],
    'MANAGE_ANALYSES': ['SUPER_ADMIN', 'LAB_MANAGER', 'MASTER_USER']
};

/**
 * Middleware to verify JWT and attach user to request
 */
const verifyToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        console.warn(`[AUTH] Missing token at ${new Date().toISOString()} from ${req.ip}`);
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const user = await prisma.user.findUnique({
            where: { id: String(decoded.id) }
        });

        if (!user) {
            return res.status(401).json({ error: 'User invalid' });
        }

        // Sanitize and Parse JSON fields for SQLite
        const { password: _, ...safeUser } = user;
        req.user = {
            ...safeUser,
            countries: typeof user.countries === 'string' ? JSON.parse(user.countries) : (user.countries || []),
            projects: typeof user.projects === 'string' ? JSON.parse(user.projects) : (user.projects || [])
        };

        next();
    } catch (e) {
        console.warn(`[AUTH] Invalid token from ${req.ip}: ${e.message}`);
        return res.status(403).json({ error: 'Invalid token' });
    }
};

/**
 * Factory to check strictly defined permissions from the Matrix
 * @param {string} permissionKey Key from PERMISSIONS object (e.g. 'CREATE_SAMPLE')
 */
const checkPermission = (permissionKey) => {
    return (req, res, next) => {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'User not authenticated' });

        const currentRole = user.role ? user.role.trim() : '';
        const currentKey = permissionKey ? permissionKey.trim() : '';
        const allowedRoles = PERMISSIONS[currentKey];

        if (!allowedRoles) {
            console.error(`Permission key '${currentKey}' not found in matrix.`);
            return res.status(500).json({ error: 'System configuration error' });
        }

        if (!allowedRoles.includes(currentRole)) {
            console.warn(`[AUTH] RBAC Denied: User ${user.username} (${currentRole}) attempted ${currentKey}. Allowed roles: ${JSON.stringify(allowedRoles)}`);
            return res.status(403).json({ error: `Access denied. Role '${currentRole}' lacks permission '${currentKey}'.` });
        }

        next();
    };
};

/**
 * Factory to check if user has access to the requested resource's scope.
 */
const checkScope = (req, res, next) => {
    const user = req.user;

    if (user.role === 'SUPER_ADMIN') {
        return next();
    }

    const userLabId = user.labId;
    const isLabStaff = ['LAB_MANAGER', 'LAB_TECHNICIAN', 'SAMPLE_RECEPTION'].includes(user.role);

    // 1. Mandatory Lab Isolation for Lab Staff
    if (isLabStaff && userLabId) {
        const requestedLab = req.params.labId || req.body.labId || req.query.labId || req.body.assignedLab;
        if (requestedLab && requestedLab !== userLabId) {
            return res.status(403).json({ error: `Security Violation: You are restricted to lab context ${userLabId}` });
        }

        // Anti-leak: For lab staff, we don't care about their "countries/projects" if they are at a lab, 
        // they only see what is IN the lab. 
        // However, we'll keep the permissive filters if helpful, but the controller MUST filter by labId.
    }

    // 2. Country Scope Check
    const targetCountry = req.body.country || req.query.country || req.params.country || req.body.projectCode;
    if (targetCountry && user.countries && user.countries.length > 0) {
        if (!user.countries.includes(targetCountry)) {
            // Note: We only block if the country is EXPLICITLY requested. 
            // Generic list fetches are filtered in controllers.
            return res.status(403).json({ error: `Access denied for country territory: ${targetCountry}` });
        }
    }

    // 3. Project Scope Check
    const targetProject = req.body.projectId || req.query.projectId || req.params.projectId || req.body.projectCode;
    if (targetProject && user.projects && user.projects.length > 0) {
        if (!user.projects.includes(targetProject)) {
            return res.status(403).json({ error: `Access denied for project scope: ${targetProject}` });
        }
    }

    next();
};

module.exports = {
    verifyToken,
    checkPermission,
    checkScope,
    PERMISSIONS
};
