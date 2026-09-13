const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-12345';

const tmpDbFile = path.resolve(__dirname, '.tmp', 'current_test_db.txt');
if (!process.env.DATABASE_PATH && fs.existsSync(tmpDbFile)) {
    try {
        const p = fs.readFileSync(tmpDbFile, 'utf8').trim();
        if (p && fs.existsSync(p)) {
            process.env.DATABASE_PATH = p;
            process.env.DATABASE_URL = `file:${p}`;
        }
    } catch (e) {
        // Fallback
    }
}

const { usersDb } = require('../db');

/**
 * Generates a signed JWT for a given user object.
 */
function generateToken(user) {
    const payload = {
        id: user.id || user.username,
        username: user.username,
        role: user.role,
        labId: user.labId || null,
        countries: Array.isArray(user.countries) ? user.countries : [],
        projects: Array.isArray(user.projects) ? user.projects : [],
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
        tokenVersion: user.tokenVersion !== undefined ? user.tokenVersion : 0
    };

    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Returns a valid JWT auth token for a given role and optional lab/country scope.
 */
async function getAuthToken(role = 'SUPER_ADMIN', labId = 'LAB-GTM', countries = ['GTM'], projects = ['SOILFER-US']) {
    const username = `test_${role.toLowerCase()}_${(labId || 'global').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    let user = usersDb.findByUsername(username);
    if (!user) {
        user = usersDb.create({
            username,
            password: 'password',
            role,
            labId: role === 'SUPER_ADMIN' ? null : labId,
            countries: role === 'SUPER_ADMIN' ? [] : (Array.isArray(countries) ? countries : [countries]),
            projects: role === 'SUPER_ADMIN' ? [] : (Array.isArray(projects) ? projects : [projects])
        });
    }

    return generateToken(user);
}

module.exports = {
    generateToken,
    getAuthToken
};
