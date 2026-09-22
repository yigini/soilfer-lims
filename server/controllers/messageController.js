const prisma = require('../prisma');
const { randomUUID: uuidv4 } = require('crypto');
const { broadcastToUser } = require('../wsServer');

const getDisplayName = (user) => {
    if (!user) return 'Unknown';
    if (typeof user === 'string') return user;
    if (typeof user.name === 'string' && user.name.trim()) return user.name.trim();
    if (typeof user.username === 'string' && user.username.trim()) return user.username.trim();
    return 'Unknown';
};
exports.getDisplayName = getDisplayName;

/**
 * Safely resolves attribution in server-generated assignment message bodies for display.
 * 
 * In-memory presentation only: does NOT mutate database records or audit trails.
 * Fails closed for any user-authored message, uncertain sender, or unexpected structure.
 * 
 * Verification criteria:
 * 1. Server-generated message identity: messageId must strictly match known server-generated assignment prefixes:
 *    - 'msg-assign-' (created by workItemController.assignWork)
 *    - 'msg-reassign-' (created by workItemController.reassignWorkItem)
 *    (User-authored messages use UUID format v4 and fail closed immediately).
 * 2. Strict known template:
 *    - For 'msg-assign-':
 *      - Subject must match /^(?:📋\s*)?New Work Assigned:\s*.+/i
 *      - Body must start with 'You have been assigned a new analysis task.'
 *      - Targets ONLY the verified final generated footer: /\n\nAssigned by:\s*([^\r\n]+)\s*$/
 *    - For 'msg-reassign-':
 *      - Subject must match /^(?:📋\s*)?Work Reassigned:\s*.+/i
 *      - Body must start with 'A work item has been reassigned to you.'
 *      - Targets ONLY the verified final generated footer: /\n\nReassigned by:\s*([^\r\n]+)\s*$/
 * 3. Matching stable sender attribution:
 *    - sender.username must be present and non-empty (fail closed if missing or empty).
 *    - The captured attribution in the final footer must match sender.username (or already sender.name).
 * 4. Literal replacement semantics:
 *    - Uses a replacement callback function to prevent string replacement tokens ($&, $', etc.)
 *      from expanding when user.name contains literal dollar signs or special characters.
 * 5. Safe fallback:
 *    - If sender has a proper name (sender.name.trim()), update footer with proper name.
 *    - If sender has no proper name, attribution does not match, or username is absent, return body unchanged.
 */
const formatAssignmentBody = (body, sender, subject, messageId) => {
    if (!body || typeof body !== 'string') return body;
    if (!messageId || typeof messageId !== 'string') return body;

    const isAssign = messageId.startsWith('msg-assign-');
    const isReassign = messageId.startsWith('msg-reassign-');

    // 1. Server-generated identity guard: fail closed for non-assignment or user-authored messages (e.g. UUID)
    if (!isAssign && !isReassign) {
        return body;
    }

    // Stable username is required for attribution verification; fail closed if absent
    if (!sender || typeof sender !== 'object') {
        return body;
    }
    const stableUsername = (typeof sender.username === 'string' && sender.username.trim()) ? sender.username.trim() : null;
    if (!stableUsername) {
        return body;
    }

    const properName = (typeof sender.name === 'string' && sender.name.trim()) ? sender.name.trim() : null;

    // 2. Strict subject and template verification targeting only the verified final generated footer
    if (isAssign) {
        if (!subject || typeof subject !== 'string' || !/^(?:📋\s*)?New Work Assigned:\s*.+/i.test(subject.trim())) {
            return body;
        }
        if (!body.startsWith('You have been assigned a new analysis task.')) {
            return body;
        }

        // Anchor strictly to the final generated footer at the end of the body
        const finalAssignPattern = /\n\nAssigned by:\s*([^\r\n]+)\s*$/;
        const footerMatch = body.match(finalAssignPattern);
        if (!footerMatch) {
            return body;
        }

        const currentAttribution = footerMatch[1].trim();

        // 3. Verify that the final footer matches sender's stable username (or already proper name)
        if (currentAttribution !== stableUsername && currentAttribution !== properName) {
            // Attribution does not match sender; fail closed to avoid misattribution
            return body;
        }

        // 4. Literal replacement semantics via callback to prevent $ token expansion
        if (properName && currentAttribution !== properName) {
            return body.replace(finalAssignPattern, () => `\n\nAssigned by: ${properName}`);
        }

        return body;
    }

    if (isReassign) {
        if (!subject || typeof subject !== 'string' || !/^(?:📋\s*)?Work Reassigned:\s*.+/i.test(subject.trim())) {
            return body;
        }
        if (!body.startsWith('A work item has been reassigned to you.')) {
            return body;
        }

        // Anchor strictly to the final generated footer at the end of the body
        const finalReassignPattern = /\n\nReassigned by:\s*([^\r\n]+)\s*$/;
        const footerMatch = body.match(finalReassignPattern);
        if (!footerMatch) {
            return body;
        }

        const currentAttribution = footerMatch[1].trim();

        // 3. Verify that the final footer matches sender's stable username (or already proper name)
        if (currentAttribution !== stableUsername && currentAttribution !== properName) {
            return body;
        }

        // 4. Literal replacement semantics via callback to prevent $ token expansion
        if (properName && currentAttribution !== properName) {
            return body.replace(finalReassignPattern, () => `\n\nReassigned by: ${properName}`);
        }

        return body;
    }

    return body;
};
exports.formatAssignmentBody = formatAssignmentBody;

// Helpers
const createNotification = async (recipientId, type, title, message, link, senderId, options = {}) => {
    try {
        const notif = await prisma.notification.create({
            data: {
                id: uuidv4(),
                userId: String(recipientId),
                type,
                title,
                message,
                link,
                senderId: senderId ? String(senderId) : null,
                titleCode: options.titleCode || null,
                titleParams: options.titleParams ? JSON.stringify(options.titleParams) : null,
                messageCode: options.messageCode || null,
                messageParams: options.messageParams ? JSON.stringify(options.messageParams) : null,
                isRead: false
            }
        });
        broadcastToUser(recipientId, 'NOTIFICATION_UPDATE', { notification: notif });
        return notif;
    } catch (e) {
        console.error("Failed to create notification:", e);
    }
};

// ── Formal Messages (Inbox / Sent / Draft / Archive / Trash) ─────
exports.getMessages = async (req, res) => {
    const userId = String(req.user.id);
    const folder = req.query.folder || 'INBOX';

    try {
        const where = { isChat: false }; // Formal messages only

        if (folder === 'SENT') {
            where.senderId = userId;
            where.folderSender = 'SENT';
        } else if (folder === 'DRAFT') {
            where.senderId = userId;
            where.status = 'DRAFT';
        } else if (folder === 'INBOX') {
            where.recipientId = userId;
            where.folderRecipient = 'INBOX';
        } else {
            // ARCHIVE or TRASH
            where.OR = [
                { senderId: userId, folderSender: folder },
                { recipientId: userId, folderRecipient: folder }
            ];
        }

        const messages = await prisma.message.findMany({
            where,
            include: {
                sender: { select: { id: true, username: true, name: true } },
                recipient: { select: { id: true, username: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const enriched = messages.map(m => ({
            ...m,
            senderName: getDisplayName(m.sender),
            recipientName: getDisplayName(m.recipient),
            body: formatAssignmentBody(m.body, m.sender, m.subject, m.id)
        }));

        res.json(enriched);
    } catch (e) {
        console.error("Get Messages Error:", e);
        res.status(500).json({ error: e.message });
    }
};

// ── Chat Conversations ───────────────────────────────────────────
exports.getConversations = async (req, res) => {
    const userId = String(req.user.id);
    try {
        // Get all CHAT messages where user is sender or recipient (not trashed)
        const allMsgs = await prisma.message.findMany({
            where: {
                isChat: true,
                status: 'SENT',
                OR: [
                    { senderId: userId, folderSender: { not: 'TRASH' } },
                    { recipientId: userId, folderRecipient: { notIn: ['TRASH'] } }
                ]
            },
            include: {
                sender: { select: { id: true, username: true, name: true, role: true } },
                recipient: { select: { id: true, username: true, name: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Group by conversation partner
        const convMap = new Map();
        for (const msg of allMsgs) {
            const partnerId = String(msg.senderId) === userId ? String(msg.recipientId) : String(msg.senderId);
            if (!partnerId) continue;

            if (!convMap.has(partnerId)) {
                const partner = String(msg.senderId) === userId ? msg.recipient : msg.sender;
                convMap.set(partnerId, {
                    partnerId,
                    partnerName: getDisplayName(partner),
                    partnerRole: partner?.role || '',
                    lastMessage: msg.body,
                    lastMessageAt: msg.createdAt,
                    lastMessageIsMe: String(msg.senderId) === userId,
                    unreadCount: 0
                });
            }

            if (String(msg.recipientId) === userId && !msg.isRead) {
                convMap.get(partnerId).unreadCount++;
            }
        }

        const conversations = Array.from(convMap.values())
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));

        res.json(conversations);
    } catch (e) {
        console.error("Get Conversations Error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.getThread = async (req, res) => {
    const userId = String(req.user.id);
    const partnerId = String(req.params.userId);

    try {
        const messages = await prisma.message.findMany({
            where: {
                isChat: true,
                status: 'SENT',
                OR: [
                    { senderId: userId, recipientId: partnerId, folderSender: { not: 'TRASH' } },
                    { senderId: partnerId, recipientId: userId, folderRecipient: { not: 'TRASH' } }
                ]
            },
            include: {
                sender: { select: { id: true, username: true, name: true } },
                recipient: { select: { id: true, username: true, name: true } }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Auto-mark unread messages as read
        const unreadIds = messages
            .filter(m => String(m.recipientId) === userId && !m.isRead)
            .map(m => m.id);

        if (unreadIds.length > 0) {
            await prisma.message.updateMany({
                where: { id: { in: unreadIds } },
                data: { isRead: true }
            });
            await prisma.notification.updateMany({
                where: { userId, senderId: partnerId, type: 'MESSAGE', isRead: false },
                data: { isRead: true }
            });
            broadcastToUser(partnerId, 'MESSAGES_READ', { readBy: userId, messageIds: unreadIds });
            broadcastToUser(userId, 'NOTIFICATION_REFRESH', {});
        }

        const enriched = messages.map(m => ({
            ...m,
            senderName: getDisplayName(m.sender),
            recipientName: getDisplayName(m.recipient),
            isMe: String(m.senderId) === userId,
            body: formatAssignmentBody(m.body, m.sender, m.subject, m.id)
        }));

        res.json(enriched);
    } catch (e) {
        console.error("Get Thread Error:", e);
        res.status(500).json({ error: e.message });
    }
};

// ── Send Message (both formal + chat) ────────────────────────────
exports.sendMessage = async (req, res) => {
    const sender = req.user;
    const { toUserId, subject, body, draftId, isChat } = req.body;

    if (!toUserId || !body) {
        return res.status(400).json({ error: 'Recipient and body are required' });
    }

    try {
        // Handle Draft Deletion if converting draft -> sent
        if (draftId) {
            try {
                await prisma.message.delete({ where: { id: draftId } });
            } catch (e) { /* ignore if not found */ }
        }

        // BROADCAST (always formal)
        if (toUserId === 'BROADCAST') {
            if (sender.role !== 'LAB_MANAGER' && sender.role !== 'SUPER_ADMIN') {
                return res.status(403).json({ error: 'Only Managers can broadcast.' });
            }

            const allUsers = await prisma.user.findMany({
                where: { id: { not: sender.id } }
            });

            const operations = allUsers.map(async u => {
                const msgId = uuidv4();
                const msg = await prisma.message.create({
                    data: {
                        id: msgId,
                        senderId: sender.id,
                        recipientId: u.id,
                        subject: subject || '(No Subject)',
                        body,
                        status: 'SENT',
                        folderSender: 'SENT',
                        folderRecipient: 'INBOX',
                        isRead: false,
                        isChat: false
                    }
                });

                await createNotification(
                    u.id,
                    'MESSAGE',
                    `Broadcast from ${getDisplayName(sender)}`,
                    subject || 'Important Announcement',
                    `/profile?tab=messaging&id=${msgId}`,
                    sender.id
                );

                broadcastToUser(u.id, 'NEW_MESSAGE', {
                    message: { ...msg, senderName: getDisplayName(sender), recipientName: getDisplayName(u), isMe: false }
                });
            });

            await Promise.all(operations);
            return res.json({ success: true, count: allUsers.length });
        }

        // NORMAL SEND (formal or chat)
        const isChatMsg = isChat === true;
        const msgId = uuidv4();

        const newItem = await prisma.message.create({
            data: {
                id: msgId,
                senderId: sender.id,
                recipientId: toUserId,
                subject: isChatMsg ? '' : (subject || '(No Subject)'),
                body,
                status: 'SENT',
                folderSender: 'SENT',
                folderRecipient: 'INBOX',
                isRead: false,
                isChat: isChatMsg
            }
        });

        const recipient = await prisma.user.findUnique({
            where: { id: toUserId },
            select: { id: true, username: true, name: true }
        });

        // Only create notification for formal messages (chats have their own real-time delivery)
        if (!isChatMsg) {
            await createNotification(
                toUserId,
                'MESSAGE',
                `New message from ${getDisplayName(sender)}`,
                subject || 'You have a new message',
                `/profile?tab=messaging&id=${newItem.id}`,
                sender.id
            );
        } else {
            // For chat: lightweight notification (shows in drawer if they're not on chat tab)
            await createNotification(
                toUserId,
                'MESSAGE',
                `Chat from ${getDisplayName(sender)}`,
                body.substring(0, 80),
                null, // No link — they open it from the chat tab
                sender.id
            );
        }

        const enrichedMsg = {
            ...newItem,
            senderName: getDisplayName(sender),
            recipientName: getDisplayName(recipient),
        };

        console.log(`[DEBUG] Attempting broadcast to recipient ${toUserId} and sender ${sender.id}`);
        // Push to recipient
        const deliveredCount = broadcastToUser(toUserId, 'NEW_MESSAGE', {
            message: { ...enrichedMsg, isMe: false }
        });

        // If delivered to at least one socket, update DB
        if (deliveredCount > 0) {
            await prisma.message.update({
                where: { id: msgId },
                data: { isDelivered: true }
            });
            enrichedMsg.isDelivered = true;
        }

        // Push to sender (for multi-tab sync and checkmark update)
        broadcastToUser(sender.id, 'NEW_MESSAGE', {
            message: { ...enrichedMsg, isMe: true }
        });

        res.json(enrichedMsg);

    } catch (e) {
        console.error("Send Message Error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.saveDraft = async (req, res) => {
    const sender = req.user;
    const { toUserId, subject, body, id } = req.body;

    try {
        let draft;
        if (id) {
            draft = await prisma.message.update({
                where: { id },
                data: { recipientId: toUserId || null, subject, body }
            });
        } else {
            draft = await prisma.message.create({
                data: {
                    id: uuidv4(),
                    senderId: sender.id,
                    recipientId: toUserId || null,
                    subject,
                    body,
                    status: 'DRAFT',
                    folderSender: 'DRAFT',
                    folderRecipient: null,
                    isChat: false
                }
            });
        }
        res.json(draft);
    } catch (e) {
        console.error("Save Draft Error:", e);
        res.status(500).json({ error: e.message });
    }
};

exports.markRead = async (req, res) => {
    const userId = String(req.user.id);
    const { id } = req.body;

    try {
        const msg = await prisma.message.findUnique({ where: { id } });
        if (!msg) return res.status(404).json({ error: 'Message not found' });

        if (String(msg.recipientId) === userId) {
            await prisma.message.update({
                where: { id },
                data: { isRead: true }
            });
            broadcastToUser(msg.senderId, 'MESSAGE_READ', { messageId: id, readBy: userId });
            res.json({ success: true });
        } else {
            res.status(403).json({ error: 'Not authorized' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.moveFolder = async (req, res) => {
    const userId = String(req.user.id);
    const { id, targetFolder, scope } = req.body;

    try {
        const msg = await prisma.message.findUnique({ where: { id } });
        if (!msg) return res.status(404).json({ error: 'Message not found' });

        const isSender = String(msg.senderId) === userId;
        const isRecipient = String(msg.recipientId) === userId;

        if (!isSender && !isRecipient) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        const data = {};
        if (isSender && isRecipient) {
            if (scope === 'SENDER') data.folderSender = targetFolder;
            else data.folderRecipient = targetFolder;
        } else if (isSender) {
            data.folderSender = targetFolder;
        } else if (isRecipient) {
            data.folderRecipient = targetFolder;
        }

        await prisma.message.update({ where: { id }, data });

        // Clean up linked notifications on TRASH or ARCHIVE
        if (targetFolder === 'TRASH' || targetFolder === 'ARCHIVE') {
            try {
                await prisma.notification.deleteMany({
                    where: { userId, link: { contains: id } }
                });
                broadcastToUser(userId, 'NOTIFICATION_REFRESH', {});
            } catch (nErr) {
                console.error('Failed to clean up notification for message:', nErr.message);
            }
        }

        broadcastToUser(userId, 'MESSAGE_MOVED', { messageId: id, targetFolder });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
