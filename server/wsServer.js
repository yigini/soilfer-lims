const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const { JWT_SECRET } = require('./config/auth');
const prisma = require('./prisma');

// Map: userId -> Set<WebSocket>
const clients = new Map();
const DEBUG = process.env.NODE_ENV !== 'production';

let wss = null;
let heartbeatTimer = null;

/**
 * Explicitly close the WebSocket server, dispose its clients, and clear any heartbeat timers.
 */
function close(callback) {
    return new Promise((resolve) => {
        const done = () => {
            if (callback) callback();
            resolve();
        };
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        if (wss) {
            const currentWss = wss;
            wss = null;
            if (currentWss.clients) {
                currentWss.clients.forEach(ws => {
                    try { ws.terminate(); } catch (e) {}
                });
            }
            clients.clear();
            try {
                currentWss.close(done);
            } catch (e) {
                done();
            }
        } else {
            clients.clear();
            done();
        }
    });
}

/**
 * Initialise the WebSocket server by attaching it to the existing HTTP server.
 */
function init(server) {
    // If an existing instance or heartbeat exists, dispose it cleanly first
    if (wss || heartbeatTimer) {
        if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
        if (wss) {
            try {
                if (wss.clients) {
                    wss.clients.forEach(ws => {
                        try { ws.terminate(); } catch (e) {}
                    });
                }
                wss.close();
            } catch (e) {}
            wss = null;
        }
    }

    const instanceWss = new WebSocketServer({ server, path: '/ws' });
    wss = instanceWss;

    // Instance-bound heartbeat interval — drop stale connections every 30s
    let instanceHeartbeat = setInterval(() => {
        if (!instanceWss || instanceWss !== wss) return;
        instanceWss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);
    heartbeatTimer = instanceHeartbeat;

    const cleanupInstance = () => {
        if (instanceHeartbeat) {
            clearInterval(instanceHeartbeat);
            instanceHeartbeat = null;
        }
        if (heartbeatTimer === instanceHeartbeat) {
            heartbeatTimer = null;
        }
        if (instanceWss.clients) {
            instanceWss.clients.forEach(ws => {
                try { ws.terminate(); } catch (e) {}
            });
        }
        if (wss === instanceWss) {
            wss = null;
        }
    };

    instanceWss.on('close', cleanupInstance);

    if (server && typeof server.once === 'function') {
        server.once('close', () => {
            cleanupInstance();
            try {
                instanceWss.close();
            } catch (e) {}
        });
    }

    instanceWss.dispose = () => {
        cleanupInstance();
        return new Promise(resolve => {
            try {
                instanceWss.close(resolve);
            } catch (e) {
                resolve();
            }
        });
    };

    instanceWss.on('connection', (ws, req) => {
        // Authenticate via Sec-WebSocket-Protocol or query param
        let token = null;
        if (req.headers['sec-websocket-protocol']) {
            token = req.headers['sec-websocket-protocol'].split(',')[0].trim();
        }
        if (!token) {
            const params = new URLSearchParams(url.parse(req.url).query);
            token = params.get('token');
        }

        if (!token) {
            ws.close(4001, 'Missing token');
            return;
        }

        let userId;
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            userId = String(decoded.id || decoded.userId);
        } catch (e) {
            ws.close(4002, 'Invalid token');
            return;
        }

        // Verify principal using consolidated sessionValidationService
        (async () => {
            try {
                const { validateUserPrincipal } = require('./services/sessionValidationService');
                const decision = await validateUserPrincipal(decoded, { currentPath: '/ws' });
                if (!decision.valid) {
                    if (decision.isPasswordChangeRequired) {
                        ws.close(4005, 'Password change required');
                    } else if (decision.error === 'ACTOR_DEACTIVATED' || decision.error === 'ACTOR_SESSION_INVALIDATED' || decision.error === 'ACTOR_NOT_FOUND' || decision.error === 'ACTOR_UNAUTHORIZED') {
                        ws.close(4003, decision.message || 'Actor invalid or deactivated');
                    } else if (decision.error === 'ACCOUNT_DEACTIVATED') {
                        ws.close(4003, 'Account deactivated or invalid');
                    } else {
                        ws.close(4004, decision.message || 'Session token invalidated');
                    }
                    return;
                }

                const user = decision.user;
                ws.userId = String(user.id);
                ws.actorId = decoded.act?.id ? String(decoded.act.id) : null;
                ws.username = user.username;
                ws.role = user.role;
                ws.labId = user.labId || null;

                // Register
                const isFirstSocket = !clients.has(userId);
                if (isFirstSocket) {
                    clients.set(userId, new Set());
                    // Broadcast ONLINE to lab peers or super admins
                    broadcastToLab(ws.labId, 'USER_STATUS', { userId, status: 'ONLINE' });
                }
                clients.get(userId).add(ws);

                if (DEBUG) console.log(`[WS] User ${user.username} (${userId}) connected for lab ${user.labId || 'GLOBAL'}`);

                // Send welcome & scoped online list
                const onlineUsers = [];
                clients.forEach((sockets, otherUid) => {
                    sockets.forEach(sock => {
                        if (sock.readyState === 1) {
                            if (user.role === 'SUPER_ADMIN' || !user.labId || sock.labId === user.labId || sock.role === 'SUPER_ADMIN') {
                                if (!onlineUsers.includes(otherUid)) onlineUsers.push(otherUid);
                            }
                        }
                    });
                });

                ws.send(JSON.stringify({
                    type: 'CONNECTED',
                    userId,
                    onlineUsers
                }));

                // Retroactively mark messages as delivered
                const undelivered = await prisma.message.findMany({
                    where: { recipientId: userId, isDelivered: false, status: 'SENT' },
                    select: { id: true, senderId: true }
                });

                if (undelivered.length > 0) {
                    await prisma.message.updateMany({
                        where: { id: { in: undelivered.map(m => m.id) } },
                        data: { isDelivered: true }
                    });

                    const senderIds = [...new Set(undelivered.map(m => m.senderId))];
                    senderIds.forEach(sid => {
                        broadcastToUser(sid, 'MESSAGES_DELIVERED', { recipientId: userId, messageIds: undelivered.filter(m => m.senderId === sid).map(m => m.id) });
                    });
                }
            } catch (err) {
                console.error('[WS] Auth check error:', err);
                ws.close(4000, 'Server error');
                return;
            }
        })();

        // Heartbeat
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('close', () => {
            const sockets = clients.get(userId);
            if (sockets) {
                sockets.delete(ws);
                if (sockets.size === 0) {
                    clients.delete(userId);
                    if (DEBUG) console.log(`[WS] User ${userId} fully disconnected`);
                    // Broadcast OFFLINE to lab peers
                    broadcastToLab(ws.labId, 'USER_STATUS', { userId, status: 'OFFLINE' });
                }
            }
        });

        ws.on('error', (err) => {
            console.error(`[WS] Error for ${userId}:`, err.message);
        });
    });

    console.log('[WS] WebSocket server initialised on /ws');
    return instanceWss;
}

/**
 * Send a message to all sockets belonging to a user.
 */
function broadcastToUser(userId, eventType, payload) {
    const sockets = clients.get(String(userId));
    if (!sockets || sockets.size === 0) {
        return 0;
    }

    let count = 0;
    const data = JSON.stringify({ type: eventType, ...payload });
    sockets.forEach((ws) => {
        if (ws.readyState === 1) { // OPEN
            ws.send(data);
            count++;
        }
    });
    return count;
}

/**
 * Broadcast to multiple users at once.
 */
function broadcastToUsers(userIds, eventType, payload) {
    userIds.forEach(uid => broadcastToUser(uid, eventType, payload));
}

const ALLOWED_GLOBAL_EVENTS = ['SYSTEM_HEALTH', 'SYSTEM_MAINTENANCE', 'SYSTEM_NOTICE'];

/**
 * Broadcast an event to all users in a specific laboratory (and Super Admins).
 * Fails closed if labId is missing to prevent leaking private lab data.
 */
function broadcastToLab(labId, eventType, payload) {
    if (!labId) {
        if (DEBUG) console.warn(`[WS] Blocked broadcast for event ${eventType}: missing labId`);
        return 0;
    }
    const data = JSON.stringify({ type: eventType, ...payload });
    let count = 0;
    clients.forEach((sockets) => {
        sockets.forEach(ws => {
            if (ws.readyState === 1) { // OPEN
                if (ws.role === 'SUPER_ADMIN' || ws.labId === labId) {
                    ws.send(data);
                    count++;
                }
            }
        });
    });
    if (DEBUG) console.log(`[WS] Broadcast ${eventType} to ${count} socket(s) in lab ${labId}`);
    return count;
}

/**
 * Broadcast to ALL currently connected users.
 * Strictly limited to allowlisted system-wide administrative events.
 */
function broadcastToAll(eventType, payload) {
    if (!ALLOWED_GLOBAL_EVENTS.includes(eventType)) {
        if (DEBUG) console.warn(`[WS] Blocked broadcastToAll for non-global event: ${eventType}`);
        return 0;
    }
    const data = JSON.stringify({ type: eventType, ...payload });
    let count = 0;
    clients.forEach((sockets) => {
        sockets.forEach(ws => {
            if (ws.readyState === 1) {
                ws.send(data);
                count++;
            }
        });
    });
    return count;
}

function revokeUserSockets(principalId) {
    if (!principalId) return;
    const pid = String(principalId);
    // 1. Close direct sockets
    const userSockets = clients.get(pid);
    if (userSockets) {
        userSockets.forEach(sock => {
            try {
                sock.close(4004, 'Session revoked');
            } catch (e) {}
        });
        clients.delete(pid);
    }
    // 2. Also close any sockets where actorId === pid (impersonation sessions)
    clients.forEach((sockets, uid) => {
        sockets.forEach(sock => {
            if (sock.actorId === pid) {
                try {
                    sock.close(4004, 'Actor session revoked');
                } catch (e) {}
                sockets.delete(sock);
            }
        });
        if (sockets.size === 0) {
            clients.delete(uid);
        }
    });
}

module.exports = { init, close, broadcastToUser, broadcastToUsers, broadcastToLab, broadcastToAll, revokeUserSockets };
