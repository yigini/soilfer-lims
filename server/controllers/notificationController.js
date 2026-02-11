const prisma = require('../prisma');
const { v4: uuidv4 } = require('uuid');
const { broadcastToUser } = require('../wsServer');

exports.getMyNotifications = async (req, res) => {
    const userId = String(req.user.id);
    try {
        // Query for notifications assigned to userId OR 'all'
        const notifications = await prisma.notification.findMany({
            where: {
                OR: [
                    { userId: userId },
                    { userId: 'all' }
                ]
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
};

exports.markAsRead = async (req, res) => {
    const { id } = req.body;
    const userId = String(req.user.id);

    try {
        const notif = await prisma.notification.findUnique({ where: { id } });
        if (!notif) return res.status(404).json({ error: 'Notification not found' });

        // Logic for 'all': If it's a broadcast, we can't mark it read globally for everyone just because one user read it.
        // For now, we will just return success without DB update for 'all' types to avoid side effects.
        if (notif.userId === 'all') {
            return res.json(notif);
        }

        if (String(notif.userId) !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark as read' });
    }
};

exports.markAllRead = async (req, res) => {
    const userId = String(req.user.id);
    try {
        // Only update personal notifications
        await prisma.notification.updateMany({
            where: {
                userId: userId,
                isRead: false
            },
            data: { isRead: true }
        });
        res.json({ message: 'All marked as read' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark all read' });
    }
};

exports.clearAllNotifications = async (req, res) => {
    const userId = String(req.user.id);
    try {
        await prisma.notification.deleteMany({
            where: { userId: userId }
        });
        res.json({ message: 'All notifications cleared' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to clear notifications' });
    }
};

exports.sendInternalMessage = async (req, res) => {
    const sender = req.user;
    const { toUserId, message } = req.body;

    if (!toUserId || !message) {
        return res.status(400).json({ error: 'Missing toUserId or message' });
    }

    try {
        const targetUser = await prisma.user.findUnique({ where: { id: toUserId } });
        if (!targetUser) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        const notif = await prisma.notification.create({
            data: {
                id: uuidv4(),
                userId: toUserId,
                type: 'MESSAGE',
                title: `Message from ${sender.name || sender.username}`,
                message: message,
                link: null,
                isRead: false,
                senderId: sender.id
            }
        });

        broadcastToUser(toUserId, 'NOTIFICATION_UPDATE', { notification: notif });

        res.json(notif);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

// Internal Helper to Create Notification
exports.createNotification = async (userId, type, title, message, link) => {
    try {
        const notif = await prisma.notification.create({
            data: {
                id: uuidv4(),
                userId,
                type,
                title,
                message,
                link,
                isRead: false,
                createdAt: new Date()
            }
        });

        broadcastToUser(userId, 'NOTIFICATION_UPDATE', { notification: notif });
        return notif;
    } catch (e) {
        console.error('Create notification error:', e);
        return null;
    }
};
