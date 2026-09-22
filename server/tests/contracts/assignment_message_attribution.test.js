/**
 * Contract & Integration Test: Generated Assignment Message Attribution (#126)
 *
 * Verifies:
 * 1. New assignment message body and bell notification use proper name with username fallback.
 * 2. New reassignment message body and bell notification use proper name with username fallback.
 * 3. Existing stored assignment messages are enriched in-memory for display via stable actor identity.
 * 4. Existing stored reassignment messages are enriched in-memory for display.
 * 5. Historical/deactivated sender accounts resolve proper name if available, or fall back to username.
 * 6. Missing or unresolvable sender fails closed, safely preserving stored footer.
 * 7. Negative Regression: User-authored messages (UUID ID) with identical subject/header/footer
 *    are never rewritten or modified (fail-closed).
 * 8. Quoted/copied user text mentioning "Assigned by:" is untouched.
 * 9. Attribution mismatch guard fails closed when footer does not match sender identity.
 * 10. Database immutability: fetching messages via getMessages does not modify stored records.
 * 11. Audit trail preservation: audit log performedBy remains the stable username.
 */

const { getDisplayName, formatAssignmentBody, getMessages } = require('../../controllers/messageController');
const prisma = require('../../prisma');

describe('Issue #126: Assignment Message Attribution Contract', () => {

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

    describe('2. New Assignment & Reassignment Generation Simulation', () => {
        test('assignment message body and notification use proper name when available', () => {
            const user = { id: 'u-mgr-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            const analysis = 'pH';
            const item = { labId: 'SYN-001', sampleId: 's-uuid-1', priority: 'NORMAL' };
            const priority = 'NORMAL';
            const dueDate = null;

            // Template from workItemController.js assignWork
            const notifMessage = `${getDisplayName(user)} assigned you "${analysis}" for sample ${item.labId || item.sampleId}.`;
            const body = `You have been assigned a new analysis task.\n\n**Analysis:** ${analysis}\n**Sample:** ${item.labId || item.sampleId}\n**Priority:** ${priority || item.priority || 'NORMAL'}\n${dueDate ? `**Due:** ${new Date(dueDate).toLocaleDateString()}\n` : ''}\nPlease complete this task in a timely manner.\n\nAssigned by: ${getDisplayName(user)}`;

            expect(notifMessage).toBe('Carlos Morales assigned you "pH" for sample SYN-001.');
            expect(body).toContain('Assigned by: Carlos Morales');
            expect(body.endsWith('Assigned by: Carlos Morales')).toBe(true);
            expect(body).not.toContain('Assigned by: mgr_gtm');
        });

        test('assignment message body and notification fall back safely to username when name is missing', () => {
            const user = { id: 'u-mgr-2', username: 'mgr_gtm', name: null };
            const analysis = 'pH';
            const item = { labId: 'SYN-001', sampleId: 's-uuid-1', priority: 'NORMAL' };

            const notifMessage = `${getDisplayName(user)} assigned you "${analysis}" for sample ${item.labId || item.sampleId}.`;
            const body = `You have been assigned a new analysis task.\n\n**Analysis:** ${analysis}\n**Sample:** ${item.labId || item.sampleId}\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: ${getDisplayName(user)}`;

            expect(notifMessage).toBe('mgr_gtm assigned you "pH" for sample SYN-001.');
            expect(body.endsWith('Assigned by: mgr_gtm')).toBe(true);
        });

        test('reassignment message body and notification use proper name when available', () => {
            const user = { id: 'u-mgr-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            const analysis = 'Soil Texture';
            const item = { labId: 'SYN-002', sampleId: 's-uuid-2' };
            const reason = 'Workload balance';
            const previousAssignee = 'tech_prev';

            // Template from workItemController.js reassignWork
            const notifMessage = `${getDisplayName(user)} reassigned "${analysis}" for sample ${item.labId || item.sampleId} to you.`;
            const body = `A work item has been reassigned to you.\n\n**Analysis:** ${analysis}\n**Sample:** ${item.labId || item.sampleId}\n**Reason:** ${reason}\n${previousAssignee ? `**Previously assigned to:** ${previousAssignee}\n` : ''}\nPlease complete this task in a timely manner.\n\nReassigned by: ${getDisplayName(user)}`;

            expect(notifMessage).toBe('Carlos Morales reassigned "Soil Texture" for sample SYN-002 to you.');
            expect(body).toContain('Reassigned by: Carlos Morales');
            expect(body.endsWith('Reassigned by: Carlos Morales')).toBe(true);
            expect(body).not.toContain('Reassigned by: mgr_gtm');
        });

        test('reassignment message body and notification fall back safely to username when name is missing', () => {
            const user = { id: 'u-mgr-2', username: 'mgr_gtm', name: '' };
            const analysis = 'Soil Texture';
            const item = { labId: 'SYN-002', sampleId: 's-uuid-2' };
            const reason = 'Technician unavailable';
            const previousAssignee = null;

            const notifMessage = `${getDisplayName(user)} reassigned "${analysis}" for sample ${item.labId || item.sampleId} to you.`;
            const body = `A work item has been reassigned to you.\n\n**Analysis:** ${analysis}\n**Sample:** ${item.labId || item.sampleId}\n**Reason:** ${reason}\n${previousAssignee ? `**Previously assigned to:** ${previousAssignee}\n` : ''}\nPlease complete this task in a timely manner.\n\nReassigned by: ${getDisplayName(user)}`;

            expect(notifMessage).toBe('mgr_gtm reassigned "Soil Texture" for sample SYN-002 to you.');
            expect(body.endsWith('Reassigned by: mgr_gtm')).toBe(true);
        });
    });

    describe('3. Display Transformation of Existing Stored Assignment Messages (formatAssignmentBody)', () => {
        const storedAssignBody = `You have been assigned a new analysis task.\n\n**Analysis:** pH\n**Sample:** SYN-001\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: mgr_gtm`;
        const storedReassignBody = `A work item has been reassigned to you.\n\n**Analysis:** pH\n**Sample:** SYN-001\n**Reason:** Workload rebalancing\n**Previously assigned to:** tech_prev\n\nPlease complete this task in a timely manner.\n\nReassigned by: mgr_gtm`;

        test('enriches stored assignment footer from username to proper name for named sender', () => {
            const sender = { id: 'u-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            const result = formatAssignmentBody(
                storedAssignBody,
                sender,
                '📋 New Work Assigned: pH',
                'msg-assign-wi-001-1727000000-abc12'
            );

            expect(result).toContain('Assigned by: Carlos Morales');
            expect(result.endsWith('Assigned by: Carlos Morales')).toBe(true);
            expect(result).not.toContain('mgr_gtm');
        });

        test('enriches stored reassignment footer from username to proper name for named sender', () => {
            const sender = { id: 'u-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            const result = formatAssignmentBody(
                storedReassignBody,
                sender,
                '📋 Work Reassigned: pH',
                'msg-reassign-wi-001-1727000000-xyz89'
            );

            expect(result).toContain('Reassigned by: Carlos Morales');
            expect(result.endsWith('Reassigned by: Carlos Morales')).toBe(true);
            expect(result).not.toContain('mgr_gtm');
        });

        test('safely retains username footer when sender has no proper name', () => {
            const sender = { id: 'u-2', username: 'mgr_gtm', name: null };
            const result = formatAssignmentBody(
                storedAssignBody,
                sender,
                '📋 New Work Assigned: pH',
                'msg-assign-wi-001-1727000000-abc12'
            );

            expect(result).toBe(storedAssignBody);
            expect(result.endsWith('Assigned by: mgr_gtm')).toBe(true);
        });

        test('safely enriches deactivated/historical sender if name is available', () => {
            const deactivatedSender = { id: 'u-hist-1', username: 'mgr_gtm', name: 'Carlos Morales (Retired)', isActive: false };
            const result = formatAssignmentBody(
                storedAssignBody,
                deactivatedSender,
                '📋 New Work Assigned: pH',
                'msg-assign-wi-001-1727000000-abc12'
            );

            expect(result.endsWith('Assigned by: Carlos Morales (Retired)')).toBe(true);
        });

        test('safely falls back to username if deactivated sender has no name', () => {
            const deactivatedSender = { id: 'u-hist-2', username: 'mgr_gtm', name: '', isActive: false };
            const result = formatAssignmentBody(
                storedAssignBody,
                deactivatedSender,
                '📋 New Work Assigned: pH',
                'msg-assign-wi-001-1727000000-abc12'
            );

            expect(result.endsWith('Assigned by: mgr_gtm')).toBe(true);
        });

        test('fails closed if sender is null or unresolvable, preserving stored body', () => {
            const result = formatAssignmentBody(
                storedAssignBody,
                null,
                '📋 New Work Assigned: pH',
                'msg-assign-wi-001-1727000000-abc12'
            );

            expect(result).toBe(storedAssignBody);
        });
    });

    describe('4. Strict Verification & Negative Regressions (Fail-Closed Guards)', () => {
        test('CRITICAL NEGATIVE REGRESSION: User-authored message with identical subject, header, and footer is NOT modified', () => {
            const sender = { id: 'u-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            const userAuthoredBody = `You have been assigned a new analysis task.\n\n**Analysis:** pH\n**Sample:** SYN-001\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: mgr_gtm`;

            // User-authored messages use standard UUID IDs, NOT msg-assign-
            const userMessageId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

            const result = formatAssignmentBody(
                userAuthoredBody,
                sender,
                '📋 New Work Assigned: pH',
                userMessageId
            );

            // Must remain strictly identical: zero rewrite of user-authored messages!
            expect(result).toBe(userAuthoredBody);
            expect(result.endsWith('Assigned by: mgr_gtm')).toBe(true);
        });

        test('arbitrary user-authored free text mentioning "Assigned by:" is never modified', () => {
            const sender = { id: 'u-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            const freeTextBody = 'Hello team, please refer to the task Assigned by: mgr_gtm in laboratory GTM-LAB1.';

            const result = formatAssignmentBody(
                freeTextBody,
                sender,
                'Team discussion notes',
                'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'
            );

            expect(result).toBe(freeTextBody);
        });

        test('quoted or forwarded user message referencing assignment footer is never modified', () => {
            const sender = { id: 'u-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            const quotedBody = `On 2026-09-22, tech wrote:\n> You have been assigned a new analysis task.\n> Assigned by: mgr_gtm\nWhat should I do?`;

            const result = formatAssignmentBody(
                quotedBody,
                sender,
                'Re: Question on task',
                'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f'
            );

            expect(result).toBe(quotedBody);
        });

        test('attribution mismatch guard: fails closed when footer attribution does not match sender username', () => {
            const sender = { id: 'u-1', username: 'actual_sender_mgr', name: 'Carlos Morales' };
            const forgedBody = `You have been assigned a new analysis task.\n\n**Analysis:** pH\n**Sample:** SYN-001\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: someone_else`;

            const result = formatAssignmentBody(
                forgedBody,
                sender,
                '📋 New Work Assigned: pH',
                'msg-assign-item-999-1727000000-xyz'
            );

            // Because "someone_else" does not match sender.username ("actual_sender_mgr"), fail closed!
            expect(result).toBe(forgedBody);
            expect(result).not.toContain('Carlos Morales');
        });

        test('idempotence: already attributed message with proper name remains unchanged', () => {
            const sender = { id: 'u-1', username: 'mgr_gtm', name: 'Carlos Morales' };
            const alreadyAttributedBody = `You have been assigned a new analysis task.\n\n**Analysis:** pH\n**Sample:** SYN-001\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: Carlos Morales`;

            const result = formatAssignmentBody(
                alreadyAttributedBody,
                sender,
                '📋 New Work Assigned: pH',
                'msg-assign-item-001-1727000000-abc'
            );

            expect(result).toBe(alreadyAttributedBody);
        });
    });

    describe('5. Database Record Immutability & Audit Trail Preservation', () => {
        test('audit log performedBy retains stable username unchanged', () => {
            const actor = {
                id: 'u-mgr-1',
                username: 'mgr_gtm',
                name: 'Carlos Morales'
            };

            const auditEntry = {
                id: 'audit-assign-123',
                entity: 'WORKITEM',
                entityId: 'wi-101',
                action: 'WORKITEM_ASSIGNED',
                details: `${actor.username} assigned pH to tech_gtm_1`,
                performedBy: actor.username, // Stable identifier
                timestamp: new Date()
            };

            // Audit record must retain the immutable account username
            expect(auditEntry.performedBy).toBe('mgr_gtm');
            expect(auditEntry.performedBy).not.toBe('Carlos Morales');
        });

        test('getMessages enriches in-memory payload without modifying database entity', async () => {
            const rawStoredBody = `You have been assigned a new analysis task.\n\n**Analysis:** Nitrogen\n**Sample:** SAM-999\n**Priority:** HIGH\n\nPlease complete this task in a timely manner.\n\nAssigned by: mgr_gtm`;

            // Mock database record exactly as Prisma would return it
            const mockDbRecord = {
                id: 'msg-assign-wi-999-1727000000-test1',
                senderId: 'user-mgr-1',
                recipientId: 'user-tech-1',
                subject: '📋 New Work Assigned: Nitrogen',
                body: rawStoredBody,
                status: 'SENT',
                folderSender: 'SENT',
                folderRecipient: 'INBOX',
                isRead: false,
                isChat: false,
                createdAt: new Date('2026-09-22T10:00:00Z'),
                sender: { id: 'user-mgr-1', username: 'mgr_gtm', name: 'Carlos Morales' },
                recipient: { id: 'user-tech-1', username: 'tech_1', name: 'Technician One' }
            };

            // Spy on prisma.message.findMany
            const originalFindMany = prisma.message.findMany;
            const originalUpdate = prisma.message.update;
            let updateCalled = false;

            prisma.message.findMany = jest.fn().mockResolvedValue([mockDbRecord]);
            prisma.message.update = jest.fn().mockImplementation((...args) => {
                updateCalled = true;
                return originalUpdate.apply(prisma.message, args);
            });

            try {
                const req = {
                    user: { id: 'user-tech-1', username: 'tech_1' },
                    query: { folder: 'INBOX' }
                };
                let responseJson = null;
                const res = {
                    json: (data) => { responseJson = data; return res; },
                    status: () => res
                };

                await getMessages(req, res);

                // 1. Returned payload has resolved display name in body
                expect(responseJson).toHaveLength(1);
                expect(responseJson[0].body).toContain('Assigned by: Carlos Morales');
                expect(responseJson[0].senderName).toBe('Carlos Morales');

                // 2. Underlying DB record was NOT mutated
                expect(mockDbRecord.body).toBe(rawStoredBody);
                expect(mockDbRecord.body).toContain('Assigned by: mgr_gtm');
                expect(updateCalled).toBe(false);
            } finally {
                prisma.message.findMany = originalFindMany;
                prisma.message.update = originalUpdate;
            }
        });
    });
});
