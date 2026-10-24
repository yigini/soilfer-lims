'use strict';

const { createHash, randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const { readSignInPolicy } = require('./signInPolicy');

// Public, fixed cost-10 dummy hash. No real credential or per-process state.
const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

async function authenticate(db, username, password, ip, { now = Date.now() } = {}) {
    const typed = typeof username === 'string' ? username : '';
    const policy = readSignInPolicy();
    const user = typed ? await db.user.findUnique({ where: { username: typed } }) : null;
    const candidate = typeof password === 'string' ? password : '';
    const matches = await bcrypt.compare(candidate, user?.password || DUMMY_HASH);
    const key = createHash('sha256').update(typed).digest('hex');

    return db.$transaction(async tx => {
        // First statement acquires SQLite's writer lock before reading state.
        // ON CONFLICT also serializes existing rows across separate processes.
        await tx.$executeRawUnsafe(`INSERT INTO "AuthLoginState" ("accountKey") VALUES (?)
            ON CONFLICT ("accountKey") DO UPDATE SET "accountKey" = excluded."accountKey"`, key);
        const [state] = await tx.$queryRawUnsafe('SELECT * FROM "AuthLoginState" WHERE "accountKey" = ?', key);
        const lockedUntil = Number(state.lockedUntil);
        const current = user ? await tx.user.findUnique({ where: { id: user.id } }) : null;
        const audit = async (action, reason) => tx.auditLog.create({ data: {
            id: randomUUID(), entity: 'AUTH_LOGIN', entityId: key, action,
            performedBy: 'ANONYMOUS', labId: current?.labId || null,
            timestamp: new Date(now), details: JSON.stringify({
                username: typed.slice(0, 256), ip: String(ip || '').slice(0, 128), reason
            })
        } });
        if (lockedUntil > now) {
            await audit('LOGIN_FAILURE', 'ACCOUNT_LOCKED');
            return { accepted: false, status: 429, retryAfter: Math.ceil((lockedUntil - now) / 1000) };
        }
        // A concurrent password change/deactivation cannot admit a stale compare.
        if (current && current.password === user.password && current.isActive !== false && matches && typeof password === 'string') {
            await tx.$executeRawUnsafe(`UPDATE "AuthLoginState" SET "failedAttempts" = 0,
                "windowStartedAt" = 0, "lockedUntil" = 0 WHERE "accountKey" = ?`, key);
            return { accepted: true, user: current };
        }
        const withinWindow = now - Number(state.windowStartedAt) < policy.windowMs;
        const count = (withinWindow ? Number(state.failedAttempts) : 0) + 1;
        const windowStart = withinWindow ? Number(state.windowStartedAt) : now;
        const delay = count >= policy.failureThreshold
            ? Math.min(policy.maxDelayMs, 1000 * (2 ** Math.min(30, count - policy.failureThreshold))) : 0;
        await tx.$executeRawUnsafe(`UPDATE "AuthLoginState" SET "failedAttempts" = ?,
            "windowStartedAt" = ?, "lockedUntil" = ? WHERE "accountKey" = ?`, count, windowStart, delay ? now + delay : 0, key);
        await audit('LOGIN_FAILURE', !current ? 'UNKNOWN_ACCOUNT' : current.isActive === false ? 'ACCOUNT_DISABLED' : 'INVALID_CREDENTIALS');
        if (delay) await audit('LOGIN_LOCKOUT', 'FAILURE_THRESHOLD');
        return { accepted: false, status: delay ? 429 : 401, ...(delay && { retryAfter: Math.ceil(delay / 1000) }) };
    });
}

module.exports = { authenticate };
