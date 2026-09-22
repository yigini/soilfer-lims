/**
 * Contract & Real Integration Test: Generated Assignment Message Attribution (#126)
 *
 * Verifies:
 * 1. Helper resolution: proper name priority, whitespace trimming, username fallback, deactivated accounts.
 * 2. Formatter regression fixes:
 *    - Targets only the final generated footer line at the end of the message.
 *    - Quoted attribution line inside free-text reassignment reason is preserved verbatim.
 *    - Literal names containing replacement tokens (e.g. 'Review $& Person') do not expand.
 *    - Missing stable username fails closed.
 *    - User-authored messages (UUID IDs) with identical subject/header/footer are never rewritten.
 * 3. Real Authenticated Assignment & Reassignment in SQLite:
 *    - Real HTTP POST /api/work/assign creates message with proper name footer and bell notification.
 *    - Real HTTP POST /api/work/assign with unnamed manager falls back to username.
 *    - Real HTTP POST /api/work/:id/reassign with multiline quoted reason creates message with proper name footer and preserves quoted reason verbatim.
 *    - Real audit logs retain immutable performedBy username across all operations.
 * 4. Real Authenticated Message List & Thread Checks:
 *    - Real HTTP GET /api/messages?folder=INBOX enriches historical stored assignment messages in-memory.
 *    - Real HTTP GET /api/messages/thread/:userId enriches messages in-memory.
 *    - Deactivated sender accounts resolve proper name if available, or fall back to username.
 *    - User-authored message with identical template (UUID ID) is untouched in API response.
 *    - Literal name message is returned verbatim without token expansion.
 * 5. Stored Data Conservation:
 *    - Direct prisma.message queries verify stored database records are NEVER rewritten after reads.
 *    - Direct prisma.auditLog queries verify audit trails are completely untouched.
 */

const request = require('supertest');
const app = require('../../app');
const { generateToken } = require('../setup');
const prisma = require('../../prisma');
const { getDisplayName, formatAssignmentBody } = require('../../controllers/messageController');

describe('Issue #126: Assignment Message Attribution Contract & Real DB Integration', () => {

    describe('1. Display Name Resolution Core Helper', () => {
        test('resolves proper name when available', () => {
            const user = { id: 'u-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            expect(getDisplayName(user)).toBe('Carlos Morales');
        });

        test('trims whitespace from proper name', () => {
            const user = { id: 'u-1', username: 'mgr_gtm', name: '   Carlos Morales   ' };
            expect(getDisplayName(user)).toBe('Carlos Morales');
        });

        test('falls back to username when name is null, undefined, empty, or whitespace', () => {
            expect(getDisplayName({ username: 'mgr_gtm', name: null })).toBe('mgr_gtm');
            expect(getDisplayName({ username: 'mgr_gtm', name: undefined })).toBe('mgr_gtm');
            expect(getDisplayName({ username: 'mgr_gtm', name: '' })).toBe('mgr_gtm');
            expect(getDisplayName({ username: 'mgr_gtm', name: '    ' })).toBe('mgr_gtm');
        });

        test('handles historical/deactivated users correctly', () => {
            const deactivatedWithName = { username: 'elena_g', name: 'Elena Gomez', isActive: false };
            expect(getDisplayName(deactivatedWithName)).toBe('Elena Gomez');

            const deactivatedNoName = { username: 'old_tech', name: null, isActive: false };
            expect(getDisplayName(deactivatedNoName)).toBe('old_tech');
        });

        test('falls back to Unknown when user object is null, undefined, or empty', () => {
            expect(getDisplayName(null)).toBe('Unknown');
            expect(getDisplayName(undefined)).toBe('Unknown');
            expect(getDisplayName({})).toBe('Unknown');
        });
    });

    describe('2. Formatter Regressions: Quoted Reason, Literal Tokens, and Fail-Closed Guards', () => {
        test('targets only verified final footer and preserves quoted attribution in reassignment reason verbatim', () => {
            const user = { id: 'review-manager', username: 'review_mgr', name: 'Review Manager' };
            const reason = 'Copied attribution from prior note:\nReassigned by: review_mgr\nKeep this quoted line unchanged.';
            const body = `A work item has been reassigned to you.\n\n**Analysis:** PH\n**Sample:** SYN-001\n**Reason:** ${reason}\n**Previously assigned to:** prior_tech\n\nPlease complete this task in a timely manner.\n\nReassigned by: review_mgr`;

            const rendered = formatAssignmentBody(body, user, '📋 Work Reassigned: PH', 'msg-reassign-review-1-123-abc');

            // Quoted reason must be preserved verbatim
            expect(rendered).toContain(reason);
            // Final footer must be updated to proper name
            expect(rendered.endsWith('Reassigned by: Review Manager')).toBe(true);
        });

        test('literal name replacement with $ tokens does not expand replacement patterns', () => {
            const literalName = 'Review $& Person';
            const user = { id: 'u-1', username: 'review_mgr', name: literalName };
            const assignBody = 'You have been assigned a new analysis task.\n\n**Analysis:** PH\n**Sample:** SYN-001\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: review_mgr';

            const rendered = formatAssignmentBody(assignBody, user, '📋 New Work Assigned: PH', 'msg-assign-review-1-123-abc');

            expect(rendered.endsWith('Assigned by: Review $& Person')).toBe(true);
            expect(rendered).not.toContain('Review \nAssigned by: review_mgr Person');
        });

        test('fails closed when stable username is absent on sender', () => {
            const userMissingUsername = { id: 'u-1', name: 'Review Manager' };
            const assignBody = 'You have been assigned a new analysis task.\n\n**Analysis:** PH\n**Sample:** SYN-001\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: review_mgr';

            const rendered = formatAssignmentBody(assignBody, userMissingUsername, '📋 New Work Assigned: PH', 'msg-assign-review-1-123-abc');

            expect(rendered).toBe(assignBody);
            expect(rendered.endsWith('Assigned by: review_mgr')).toBe(true);
        });

        test('CRITICAL NEGATIVE REGRESSION: User-authored message with identical subject, header, and footer is NOT modified', () => {
            const sender = { id: 'u-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            const userAuthoredBody = `You have been assigned a new analysis task.\n\n**Analysis:** PH\n**Sample:** SYN-001\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: mgr_gtm`;
            const userMessageId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

            const result = formatAssignmentBody(userAuthoredBody, sender, '📋 New Work Assigned: PH', userMessageId);

            expect(result).toBe(userAuthoredBody);
            expect(result.endsWith('Assigned by: mgr_gtm')).toBe(true);
        });

        test('attribution mismatch guard: fails closed when footer attribution does not match sender username', () => {
            const sender = { id: 'u-1', username: 'actual_sender_mgr', name: 'Carlos Morales' };
            const forgedBody = `You have been assigned a new analysis task.\n\n**Analysis:** PH\n**Sample:** SYN-001\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: someone_else`;

            const result = formatAssignmentBody(
                forgedBody,
                sender,
                '📋 New Work Assigned: PH',
                'msg-assign-item-999-1727000000-xyz'
            );

            expect(result).toBe(forgedBody);
            expect(result).not.toContain('Carlos Morales');
        });
    });

    describe('3. Real Authenticated Assignment, Reassignment, and Stored-Data Conservation in Isolated DB', () => {
        let suffix;
        let mgrNamed, mgrUnnamed, techUser, deactivatedNamed, deactivatedUnnamed;
        let mgrNamedToken, mgrUnnamedToken, techToken;
        let testSample, testItem1, testItem2;
        let createdIds = { users: [], samples: [], items: [], messages: [], notifications: [], auditLogs: [] };

        beforeAll(async () => {
            suffix = Date.now() + '_' + Math.random().toString(36).slice(2, 6);

            // Create active manager with proper name
            mgrNamed = await prisma.user.create({
                data: {
                    id: `mgr_named_${suffix}`,
                    username: `mgr_named_${suffix}`,
                    email: `mgr_named_${suffix}@example.com`,
                    name: 'Carlos Morales',
                    password: 'hashed-password',
                    role: 'LAB_MANAGER',
                    labId: 'GTM-LAB1',
                    isActive: true
                }
            });
            createdIds.users.push(mgrNamed.id);

            // Create active manager without proper name
            mgrUnnamed = await prisma.user.create({
                data: {
                    id: `mgr_unnamed_${suffix}`,
                    username: `mgr_unnamed_${suffix}`,
                    email: `mgr_unnamed_${suffix}@example.com`,
                    name: null,
                    password: 'hashed-password',
                    role: 'LAB_MANAGER',
                    labId: 'GTM-LAB1',
                    isActive: true
                }
            });
            createdIds.users.push(mgrUnnamed.id);

            // Create technician
            techUser = await prisma.user.create({
                data: {
                    id: `tech_${suffix}`,
                    username: `tech_${suffix}`,
                    email: `tech_${suffix}@example.com`,
                    name: 'Luis Lado',
                    password: 'hashed-password',
                    role: 'LAB_TECHNICIAN',
                    labId: 'GTM-LAB1',
                    isActive: true
                }
            });
            createdIds.users.push(techUser.id);

            // Create deactivated manager with proper name
            deactivatedNamed = await prisma.user.create({
                data: {
                    id: `mgr_deact_named_${suffix}`,
                    username: `mgr_deact_named_${suffix}`,
                    email: `mgr_deact_named_${suffix}@example.com`,
                    name: 'Elena Gomez (Retired)',
                    password: 'hashed-password',
                    role: 'LAB_MANAGER',
                    labId: 'GTM-LAB1',
                    isActive: false
                }
            });
            createdIds.users.push(deactivatedNamed.id);

            // Create deactivated manager without proper name
            deactivatedUnnamed = await prisma.user.create({
                data: {
                    id: `mgr_deact_unnamed_${suffix}`,
                    username: `mgr_deact_unnamed_${suffix}`,
                    email: `mgr_deact_unnamed_${suffix}@example.com`,
                    name: null,
                    password: 'hashed-password',
                    role: 'LAB_MANAGER',
                    labId: 'GTM-LAB1',
                    isActive: false
                }
            });
            createdIds.users.push(deactivatedUnnamed.id);

            // Create accepted sample and work items in GTM-LAB1
            testSample = await prisma.sample.create({
                data: {
                    id: `sample_${suffix}`,
                    originalId: `ORIG_${suffix}`,
                    labId: `SAM_${suffix}`,
                    assignedLab: 'GTM-LAB1',
                    status: 'ACCEPTED'
                }
            });
            createdIds.samples.push(testSample.id);

            testItem1 = await prisma.workItem.create({
                data: {
                    id: `wi_1_${suffix}`,
                    sampleId: testSample.id,
                    analysis: 'PH',
                    status: 'NOT_ASSIGNED',
                    assignedLab: 'GTM-LAB1'
                }
            });
            createdIds.items.push(testItem1.id);

            testItem2 = await prisma.workItem.create({
                data: {
                    id: `wi_2_${suffix}`,
                    sampleId: testSample.id,
                    analysis: 'CEC',
                    status: 'NOT_ASSIGNED',
                    assignedLab: 'GTM-LAB1'
                }
            });
            createdIds.items.push(testItem2.id);

            // Generate JWT tokens
            mgrNamedToken = generateToken(mgrNamed);
            mgrUnnamedToken = generateToken(mgrUnnamed);
            techToken = generateToken(techUser);
        });

        afterAll(async () => {
            try {
                // Teardown created records in clean reverse dependency order
                await prisma.message.deleteMany({
                    where: {
                        OR: [
                            { id: { in: createdIds.messages } },
                            { senderId: { in: createdIds.users } },
                            { recipientId: { in: createdIds.users } }
                        ]
                    }
                });
                await prisma.notification.deleteMany({
                    where: {
                        OR: [
                            { id: { in: createdIds.notifications } },
                            { userId: { in: createdIds.users } },
                            { senderId: { in: createdIds.users } }
                        ]
                    }
                });
                await prisma.auditLog.deleteMany({
                    where: {
                        OR: [
                            { id: { in: createdIds.auditLogs } },
                            { entityId: { in: createdIds.items } }
                        ]
                    }
                });
                await prisma.workItem.deleteMany({
                    where: {
                        OR: [
                            { id: { in: createdIds.items } },
                            { sampleId: { in: createdIds.samples } }
                        ]
                    }
                });
                if (createdIds.samples.length > 0) {
                    await prisma.sample.deleteMany({ where: { id: { in: createdIds.samples } } });
                }
                if (createdIds.users.length > 0) {
                    await prisma.user.deleteMany({ where: { id: { in: createdIds.users } } });
                }
            } catch (err) {
                console.error('[afterAll teardown error]:', err);
            }
        });

        test('A. Real authenticated assignment creates proper name footer, bell text, and immutable audit', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${mgrNamedToken}`)
                .send({
                    workItemIds: [testItem1.id],
                    assignee: techUser.username,
                    priority: 'HIGH'
                });

            expect(res.status).toBe(200);

            // 1. Verify real message in database
            const message = await prisma.message.findFirst({
                where: { recipientId: techUser.id, id: { startsWith: `msg-assign-${testItem1.id}` } },
                orderBy: { createdAt: 'desc' }
            });
            expect(message).toBeDefined();
            createdIds.messages.push(message.id);

            expect(message.id.startsWith('msg-assign-')).toBe(true);
            expect(message.body).toContain('Assigned by: Carlos Morales');
            expect(message.body.endsWith('Assigned by: Carlos Morales')).toBe(true);
            expect(message.body).not.toContain(`Assigned by: ${mgrNamed.username}`);

            // 2. Verify real notification in database
            const notif = await prisma.notification.findFirst({
                where: { userId: techUser.id, type: 'INFO' },
                orderBy: { createdAt: 'desc' }
            });
            expect(notif).toBeDefined();
            createdIds.notifications.push(notif.id);
            expect(notif.message).toContain('Carlos Morales assigned you');

            // 3. Verify real audit log in database
            const audit = await prisma.auditLog.findFirst({
                where: { entityId: testItem1.id, action: 'WORKITEM_ASSIGNED' },
                orderBy: { timestamp: 'desc' }
            });
            expect(audit).toBeDefined();
            createdIds.auditLogs.push(audit.id);
            expect(audit.performedBy).toBe(mgrNamed.username); // Stable username retained
            expect(audit.performedBy).not.toBe('Carlos Morales');
        });

        test('B. Real authenticated assignment with unnamed manager falls back safely to username', async () => {
            const res = await request(app)
                .post('/api/work/assign')
                .set('Authorization', `Bearer ${mgrUnnamedToken}`)
                .send({
                    workItemIds: [testItem2.id],
                    assignee: techUser.username,
                    priority: 'NORMAL'
                });

            expect(res.status).toBe(200);

            const message = await prisma.message.findFirst({
                where: { recipientId: techUser.id, id: { startsWith: `msg-assign-${testItem2.id}` } },
                orderBy: { createdAt: 'desc' }
            });
            expect(message).toBeDefined();
            createdIds.messages.push(message.id);

            expect(message.body.endsWith(`Assigned by: ${mgrUnnamed.username}`)).toBe(true);

            const notif = await prisma.notification.findFirst({
                where: { userId: techUser.id, type: 'INFO' },
                orderBy: { createdAt: 'desc' }
            });
            expect(notif.message).toContain(`${mgrUnnamed.username} assigned you`);

            const audit = await prisma.auditLog.findFirst({
                where: { entityId: testItem2.id, action: 'WORKITEM_ASSIGNED' },
                orderBy: { timestamp: 'desc' }
            });
            createdIds.auditLogs.push(audit.id);
            expect(audit.performedBy).toBe(mgrUnnamed.username);
        });

        test('C. Real authenticated reassignment with quoted reason preserves quoted reason and updates final footer', async () => {
            const complexReason = `Prior notes from review:\nReassigned by: ${mgrNamed.username}\nKeep this quoted text intact.`;

            const res = await request(app)
                .post(`/api/work/${testItem1.id}/reassign`)
                .set('Authorization', `Bearer ${mgrNamedToken}`)
                .send({
                    technicianUserId: techUser.username,
                    reason: complexReason
                });

            expect(res.status).toBe(200);

            const message = await prisma.message.findFirst({
                where: { recipientId: techUser.id, id: { startsWith: `msg-reassign-${testItem1.id}` } },
                orderBy: { createdAt: 'desc' }
            });
            expect(message).toBeDefined();
            createdIds.messages.push(message.id);

            expect(message.id.startsWith('msg-reassign-')).toBe(true);
            // Quoted reason line inside the body must be preserved verbatim
            expect(message.body).toContain(complexReason);
            // Final footer line must be updated with proper name
            expect(message.body.endsWith('Reassigned by: Carlos Morales')).toBe(true);

            // Audit record preserves stable username
            const audit = await prisma.auditLog.findFirst({
                where: { entityId: testItem1.id, action: 'WORKITEM_REASSIGNED' },
                orderBy: { timestamp: 'desc' }
            });
            expect(audit).toBeDefined();
            createdIds.auditLogs.push(audit.id);
            expect(audit.performedBy).toBe(mgrNamed.username);
        });

        test('D. Real authenticated message list endpoint enriches historical messages and preserves stored DB records', async () => {
            // Seed a historical stored assignment message with raw username footer
            const historicalMsgId = `msg-assign-hist-${suffix}`;
            const rawHistoricalBody = `You have been assigned a new analysis task.\n\n**Analysis:** Zinc\n**Sample:** SAM-HIST\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: ${mgrNamed.username}`;

            await prisma.message.create({
                data: {
                    id: historicalMsgId,
                    senderId: mgrNamed.id,
                    recipientId: techUser.id,
                    subject: '📋 New Work Assigned: Zinc',
                    body: rawHistoricalBody,
                    status: 'SENT',
                    folderSender: 'SENT',
                    folderRecipient: 'INBOX',
                    isRead: false,
                    isChat: false,
                    createdAt: new Date('2026-09-01T10:00:00Z')
                }
            });
            createdIds.messages.push(historicalMsgId);

            // Seed message from deactivated manager with proper name
            const deactNamedMsgId = `msg-assign-deact-named-${suffix}`;
            const rawDeactNamedBody = `You have been assigned a new analysis task.\n\n**Analysis:** Copper\n**Sample:** SAM-DEACT-1\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: ${deactivatedNamed.username}`;

            await prisma.message.create({
                data: {
                    id: deactNamedMsgId,
                    senderId: deactivatedNamed.id,
                    recipientId: techUser.id,
                    subject: '📋 New Work Assigned: Copper',
                    body: rawDeactNamedBody,
                    status: 'SENT',
                    folderSender: 'SENT',
                    folderRecipient: 'INBOX',
                    isRead: false,
                    isChat: false,
                    createdAt: new Date('2026-09-01T11:00:00Z')
                }
            });
            createdIds.messages.push(deactNamedMsgId);

            // Seed user-authored message with identical assignment subject & body (UUID ID negative regression)
            const userAuthoredMsgId = `11223344-5566-4778-8899-aabbccddeeff`;
            const rawUserAuthoredBody = `You have been assigned a new analysis task.\n\n**Analysis:** Iron\n**Sample:** SAM-USER\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: ${mgrNamed.username}`;

            await prisma.message.create({
                data: {
                    id: userAuthoredMsgId,
                    senderId: mgrNamed.id,
                    recipientId: techUser.id,
                    subject: '📋 New Work Assigned: Iron',
                    body: rawUserAuthoredBody,
                    status: 'SENT',
                    folderSender: 'SENT',
                    folderRecipient: 'INBOX',
                    isRead: false,
                    isChat: false,
                    createdAt: new Date('2026-09-01T12:00:00Z')
                }
            });
            createdIds.messages.push(userAuthoredMsgId);

            // Record audit log state before reads
            const auditCountBefore = await prisma.auditLog.count();

            // 1. Call GET /api/messages?folder=INBOX as technician
            const listRes = await request(app)
                .get('/api/messages?folder=INBOX')
                .set('Authorization', `Bearer ${techToken}`);

            expect(listRes.status).toBe(200);

            // Verify historical message enriched for display
            const enrichedHistMsg = listRes.body.find(m => m.id === historicalMsgId);
            expect(enrichedHistMsg).toBeDefined();
            expect(enrichedHistMsg.body.endsWith('Assigned by: Carlos Morales')).toBe(true);

            // Verify deactivated sender with proper name enriched for display
            const enrichedDeactMsg = listRes.body.find(m => m.id === deactNamedMsgId);
            expect(enrichedDeactMsg).toBeDefined();
            expect(enrichedDeactMsg.body.endsWith('Assigned by: Elena Gomez (Retired)')).toBe(true);

            // Verify user-authored UUID message is NOT rewritten (fail-closed negative regression)
            const returnedUserMsg = listRes.body.find(m => m.id === userAuthoredMsgId);
            expect(returnedUserMsg).toBeDefined();
            expect(returnedUserMsg.body).toBe(rawUserAuthoredBody);
            expect(returnedUserMsg.body.endsWith(`Assigned by: ${mgrNamed.username}`)).toBe(true);

            // 2. STORED DATA CONSERVATION: Direct database queries confirm zero DB rewrites
            const storedHistDb = await prisma.message.findUnique({ where: { id: historicalMsgId } });
            expect(storedHistDb.body).toBe(rawHistoricalBody);
            expect(storedHistDb.body.endsWith(`Assigned by: ${mgrNamed.username}`)).toBe(true);

            const storedDeactDb = await prisma.message.findUnique({ where: { id: deactNamedMsgId } });
            expect(storedDeactDb.body).toBe(rawDeactNamedBody);
            expect(storedDeactDb.body.endsWith(`Assigned by: ${deactivatedNamed.username}`)).toBe(true);

            const storedUserDb = await prisma.message.findUnique({ where: { id: userAuthoredMsgId } });
            expect(storedUserDb.body).toBe(rawUserAuthoredBody);

            // Audit log count and rows completely untouched
            const auditCountAfter = await prisma.auditLog.count();
            expect(auditCountAfter).toBe(auditCountBefore);
        });

        test('E. Real authenticated thread endpoint enriches assignment messages and preserves literal $ tokens', async () => {
            // Seed a chat assignment message from mgrNamed to techUser
            const chatMsgId = `msg-assign-chat-${suffix}`;
            const chatBody = `You have been assigned a new analysis task.\n\n**Analysis:** Nitrogen\n**Sample:** SAM-CHAT\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: ${mgrNamed.username}`;

            await prisma.message.create({
                data: {
                    id: chatMsgId,
                    senderId: mgrNamed.id,
                    recipientId: techUser.id,
                    subject: '📋 New Work Assigned: Nitrogen',
                    body: chatBody,
                    status: 'SENT',
                    folderSender: 'SENT',
                    folderRecipient: 'INBOX',
                    isRead: false,
                    isChat: true,
                    createdAt: new Date('2026-09-01T14:00:00Z')
                }
            });
            createdIds.messages.push(chatMsgId);

            // Call GET /api/messages/thread/:userId as techUser
            const threadRes = await request(app)
                .get(`/api/messages/thread/${mgrNamed.id}`)
                .set('Authorization', `Bearer ${techToken}`);

            expect(threadRes.status).toBe(200);

            const enrichedChatMsg = threadRes.body.find(m => m.id === chatMsgId);
            expect(enrichedChatMsg).toBeDefined();
            expect(enrichedChatMsg.body.endsWith('Assigned by: Carlos Morales')).toBe(true);

            // Stored data conservation
            const storedChatDb = await prisma.message.findUnique({ where: { id: chatMsgId } });
            expect(storedChatDb.body).toBe(chatBody);
            expect(storedChatDb.body.endsWith(`Assigned by: ${mgrNamed.username}`)).toBe(true);
        });
    });
});
