const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');
const { JWT_SECRET } = require('./config/auth');

// Map: userId -> Set<WebSocket>
const clients = new Map();
const DEBUG = process.env.NODE_ENV !== 'production';

let wss = null;

/**
 * Initialise the WebSocket server by attaching it to the existing HTTP server.
 */
function init(server) {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        // Authenticate via token query param
        const params = new URLSearchParams(url.parse(req.url).query);
        const token = params.get('token');

        if (!token) {
            ws.close(4001, 'Missing token');
            return;
        }

        let userId;
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            userId = String(decoded.id || decoded.userId);
        } catch (e) {
            ws.close(4002, 'Invalid token');
            return;
        }

        // Register
        const isFirstSocket = !clients.has(userId);
        if (isFirstSocket) {
            clients.set(userId, new Set());
            // Broadcast ONLINE to everyone else
            clients.forEach((_, otherUserId) => {
                if (otherUserId !== userId) {
                    broadcastToUser(otherUserId, 'USER_STATUS', { userId, status: 'ONLINE' });
                }
            });
        }
        clients.get(userId).add(ws);

        if (DEBUG) console.log(`[WS] User ${userId} connected (${clients.get(userId).size} sockets)`);

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
                    // Broadcast OFFLINE to everyone else
                    clients.forEach((_, otherUserId) => {
                        broadcastToUser(otherUserId, 'USER_STATUS', { userId, status: 'OFFLINE' });
                    });
                }
            }
            if (DEBUG) console.log(`[WS] User ${userId} socket closed`);
        });

        ws.on('error', (err) => {
            console.error(`[WS] Error for ${userId}:`, err.message);
        });

        // Send welcome & online list
        ws.send(JSON.stringify({
            type: 'CONNECTED',
            userId,
            onlineUsers: Array.from(clients.keys())
        }));

        // Retroactively mark messages as delivered
        (async () => {
            try {
                const prisma = require('./prisma');
                const undelivered = await prisma.message.findMany({
                    where: { recipientId: userId, isDelivered: false, status: 'SENT' },
                    select: { id: true, senderId: true }
                });

                if (undelivered.length > 0) {
                    await prisma.message.updateMany({
                        where: { id: { in: undelivered.map(m => m.id) } },
                        data: { isDelivered: true }
                    });

                    // Notify senders? (Optionally)
                    // For now, let's keep it simple. The next refresh will show it.
                    // Or we broadcast 'MESSAGES_DELIVERED' to each sender.
                    const senderIds = [...new Set(undelivered.map(m => m.senderId))];
                    senderIds.forEach(sid => {
                        broadcastToUser(sid, 'MESSAGES_DELIVERED', { recipientId: userId, messageIds: undelivered.filter(m => m.senderId === sid).map(m => m.id) });
                    });
                }
            } catch (e) {
                console.error('[WS] Delivery sync error:', e);
            }
        })();
    });

    // Heartbeat interval — drop stale connections every 30s
    const heartbeat = setInterval(() => {
        if (!wss) return;
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate();
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => clearInterval(heartbeat));

    console.log('[WS] WebSocket server initialised on /ws');
}

/**
 * Send a message to all sockets belonging to a user.
 */
function broadcastToUser(userId, eventType, payload) {
    const sockets = clients.get(String(userId));
    if (!sockets || sockets.size === 0) {
        if (DEBUG) console.log(`[WS] No sockets for user ${userId}, cannot broadcast ${eventType}`);
        return 0;
    }

    let count = 0;
    if (DEBUG) console.log(`[WS] Broadcasting ${eventType} to user ${userId} (${sockets.size} sockets)`);
    const data = JSON.stringify({ type: eventType, ...payload });
    sockets.forEach((ws) => {
        if (ws.readyState === 1) { // OPEN
            ws.send(data);
            count++;
        } else {
            if (DEBUG) console.log(`[WS] Socket for ${userId} not OPEN (readyState: ${ws.readyState})`);
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

/**
 * Broadcast to ALL currently connected users.
 */
function broadcastToAll(eventType, payload) {
    const data = JSON.stringify({ type: eventType, ...payload });
    let count = 0;
    clients.forEach((sockets, userId) => {
        sockets.forEach(ws => {
            if (ws.readyState === 1) {
                ws.send(data);
                count++;
            }
        });
    });
    console.log(`[WS] Broadcast ${eventType} to ${count} socket(s) across ${clients.size} user(s)`);
    return count;
}

module.exports = { init, broadcastToUser, broadcastToUsers, broadcastToAll };
