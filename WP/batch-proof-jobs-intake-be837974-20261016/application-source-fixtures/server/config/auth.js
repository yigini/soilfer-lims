/**
 * Shared Auth Configuration
 * Single source of truth for JWT secret and token settings.
 */

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is not set. Application cannot start securely.');
    process.exit(1);
}

const TOKEN_EXPIRY = process.env.TOKEN_EXPIRY || '24h';

module.exports = { JWT_SECRET, TOKEN_EXPIRY };
