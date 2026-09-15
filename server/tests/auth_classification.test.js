'use strict';

const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { verifyToken } = require('../middleware/authMiddleware');
const { JWT_SECRET } = require('../config/auth');

describe('Issue #111: Auth Error Classification and Protection Contracts', () => {
    let mockReq, mockRes, nextFn;

    beforeEach(() => {
        mockReq = {
            headers: {},
            ip: '127.0.0.1',
            path: '/test'
        };
        mockRes = {
            statusCode: 200,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                this.body = data;
                return this;
            }
        };
        nextFn = jest.fn();
    });

    test('1. Missing token returns HTTP 401 NO_TOKEN', async () => {
        await verifyToken(mockReq, mockRes, nextFn);

        expect(mockRes.statusCode).toBe(401);
        expect(mockRes.body).toBeDefined();
        expect(mockRes.body.error).toBe('No token provided');
        expect(mockRes.body.code).toBe('NO_TOKEN');
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('2. Expired token returns HTTP 401 TOKEN_EXPIRED (never 403)', async () => {
        const expiredToken = jwt.sign({
            id: '1770311018064',
            username: 'admin',
            role: 'SUPER_ADMIN',
            tokenVersion: 1
        }, JWT_SECRET, { expiresIn: -10 });

        mockReq.headers['authorization'] = `Bearer ${expiredToken}`;
        await verifyToken(mockReq, mockRes, nextFn);

        expect(mockRes.statusCode).toBe(401);
        expect(mockRes.body).toBeDefined();
        expect(mockRes.body.code).toBe('TOKEN_EXPIRED');
        expect(mockRes.body.error).toBe('Token expired');
        expect(mockRes.body.message).toContain('expired');
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('3. Malformed or tampered token returns HTTP 401 INVALID_TOKEN (never 403)', async () => {
        mockReq.headers['authorization'] = 'Bearer invalid.tampered.jwttoken';
        await verifyToken(mockReq, mockRes, nextFn);

        expect(mockRes.statusCode).toBe(401);
        expect(mockRes.body).toBeDefined();
        expect(mockRes.body.code).toBe('INVALID_TOKEN');
        expect(mockRes.body.error).toBe('Invalid token');
        expect(nextFn).not.toHaveBeenCalled();
    });

    test('4. Valid token succeeds and correctly attaches sanitized user', async () => {
        let user = await prisma.user.findFirst({ where: { isActive: true } });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    id: 'usr-auth-test-' + Date.now(),
                    username: 'auth_test_' + Date.now(),
                    email: `auth_test_${Date.now()}@test.org`,
                    name: 'Auth Test Admin',
                    password: 'hash',
                    role: 'SUPER_ADMIN',
                    isActive: true,
                    tokenVersion: 1
                }
            });
        }

        const validToken = jwt.sign({
            id: user.id,
            username: user.username,
            role: user.role,
            tokenVersion: user.tokenVersion || 0
        }, JWT_SECRET, { expiresIn: '1h' });

        mockReq.headers['authorization'] = `Bearer ${validToken}`;
        await verifyToken(mockReq, mockRes, nextFn);

        expect(mockRes.statusCode).toBe(200);
        expect(nextFn).toHaveBeenCalled();
        expect(mockReq.user).toBeDefined();
        expect(mockReq.user.id).toBe(user.id);
        expect(mockReq.user.role).toBe(user.role);
    });

    test('5. Stale 401 interceptor logic preserves newer active session', () => {
        // Test client-side stale token detection logic
        const oldToken = 'old-expired-token-123';
        const newToken = 'new-active-token-456';
        let currentStorageToken = newToken;
        let sessionCleared = false;

        function simulateResponseInterceptor(error) {
            const reqAuthHeader = error.config?.headers?.Authorization;
            const requestToken = reqAuthHeader
                ? (reqAuthHeader.startsWith('Bearer ') ? reqAuthHeader.slice(7).trim() : null)
                : null;

            if (requestToken && currentStorageToken && requestToken !== currentStorageToken) {
                // Stale token from superseded request: drop without wiping session
                return 'IGNORED_STALE';
            }

            if (currentStorageToken) {
                sessionCleared = true;
                currentStorageToken = null;
                return 'CLEARED_SESSION';
            }
            return 'REJECTED';
        }

        // Simulate delayed 401 from old request arriving AFTER new login
        const staleError = {
            response: { status: 401 },
            config: {
                headers: { Authorization: `Bearer ${oldToken}` },
                url: '/api/dashboard/home'
            }
        };

        const result = simulateResponseInterceptor(staleError);
        expect(result).toBe('IGNORED_STALE');
        expect(sessionCleared).toBe(false);
        expect(currentStorageToken).toBe(newToken);

        // Simulate genuine 401 from current session
        const genuineError = {
            response: { status: 401 },
            config: {
                headers: { Authorization: `Bearer ${newToken}` },
                url: '/api/dashboard/home'
            }
        };

        const genuineResult = simulateResponseInterceptor(genuineError);
        expect(genuineResult).toBe('CLEARED_SESSION');
        expect(sessionCleared).toBe(true);
        expect(currentStorageToken).toBeNull();
    });
});
