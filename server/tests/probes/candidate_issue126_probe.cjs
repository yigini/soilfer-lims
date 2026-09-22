/**
 * Candidate Verification Probe for Issue #126
 *
 * Verifies candidate worktree source attribution:
 * 1. workItemController assignment body expression resolves proper name Carlos Morales.
 * 2. workItemController assignment body expression safely falls back to username mgr_gtm.
 * 3. workItemController reassignment body expression resolves proper name Carlos Morales.
 * 4. messageController formatAssignmentBody enriches stored assignment messages to Carlos Morales.
 * 5. Negative regression: formatAssignmentBody fails closed for user-authored UUID messages.
 * 6. MessagingCenter.jsx confirms {selectedMessage.body} rendering.
 *
 * Does not mutate production, databases, or existing baseline evidence.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-probe-verification-12345';

const rootDir = path.resolve(__dirname, '../../..');

// 1. Inspect candidate workItemController.js
const workItemControllerSrc = fs.readFileSync(path.join(rootDir, 'server/controllers/workItemController.js'), 'utf8');
const { getDisplayName, formatAssignmentBody } = require(path.join(rootDir, 'server/controllers/messageController.js'));

// Extract assignment body template
const assignMatch = workItemControllerSrc.match(/body:\s*(`You have been assigned a new analysis task\.[\s\S]*?`),/);
assert.ok(assignMatch, 'Could not match assignment body template in workItemController.js');
const assignExpr = assignMatch[1];

// Evaluate with named manager
const namedAssignBody = vm.runInNewContext(assignExpr, {
    analysis: 'PH',
    item: { labId: 'SYN-001', sampleId: 'synthetic-uuid', priority: 'NORMAL' },
    priority: 'NORMAL',
    dueDate: null,
    user: { id: 'synthetic-manager', username: 'mgr_gtm', name: 'Carlos Morales' },
    getDisplayName
});
assert.ok(namedAssignBody.endsWith('Assigned by: Carlos Morales'), `Expected proper name footer, got: ${namedAssignBody.split('\n').at(-1)}`);
assert.ok(namedAssignBody.includes('Carlos Morales'), 'Expected body to contain Carlos Morales');

// Evaluate with fallback (null name)
const fallbackAssignBody = vm.runInNewContext(assignExpr, {
    analysis: 'PH',
    item: { labId: 'SYN-001', sampleId: 'synthetic-uuid', priority: 'NORMAL' },
    priority: 'NORMAL',
    dueDate: null,
    user: { id: 'synthetic-manager', username: 'mgr_gtm', name: null },
    getDisplayName
});
assert.ok(fallbackAssignBody.endsWith('Assigned by: mgr_gtm'), `Expected fallback username footer, got: ${fallbackAssignBody.split('\n').at(-1)}`);

// Extract reassignment body template
const reassignMatch = workItemControllerSrc.match(/body:\s*(`A work item has been reassigned to you\.[\s\S]*?`),/);
assert.ok(reassignMatch, 'Could not match reassignment body template in workItemController.js');
const reassignExpr = reassignMatch[1];

const namedReassignBody = vm.runInNewContext(reassignExpr, {
    analysis: 'PH',
    item: { labId: 'SYN-001', sampleId: 'synthetic-uuid' },
    reason: 'Workload balance',
    previousAssignee: 'tech_prev',
    user: { id: 'synthetic-manager', username: 'mgr_gtm', name: 'Carlos Morales' },
    getDisplayName
});
assert.ok(namedReassignBody.endsWith('Reassigned by: Carlos Morales'), `Expected reassignment proper name footer, got: ${namedReassignBody.split('\n').at(-1)}`);

// 2. In-memory display resolution on stored legacy messages
const legacyStoredBody = `You have been assigned a new analysis task.\n\n**Analysis:** PH\n**Sample:** SYN-001\n**Priority:** NORMAL\n\nPlease complete this task in a timely manner.\n\nAssigned by: mgr_gtm`;
const enrichedStoredBody = formatAssignmentBody(
    legacyStoredBody,
    { id: 'synthetic-manager', username: 'mgr_gtm', name: 'Carlos Morales' },
    '📋 New Work Assigned: PH',
    'msg-assign-wi-001-1727000000-abc12'
);
assert.ok(enrichedStoredBody.endsWith('Assigned by: Carlos Morales'), 'Expected formatAssignmentBody to enrich stored legacy message');

// 3. Negative regression: user-authored message with identical text is not rewritten
const userAuthoredResult = formatAssignmentBody(
    legacyStoredBody,
    { id: 'synthetic-manager', username: 'mgr_gtm', name: 'Carlos Morales' },
    '📋 New Work Assigned: PH',
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d' // UUID from user compose
);
assert.equal(userAuthoredResult, legacyStoredBody, 'User-authored message was rewritten; expected fail-closed immutability');
assert.ok(userAuthoredResult.endsWith('Assigned by: mgr_gtm'), 'User-authored message footer must remain unchanged');

// 4. Client-side rendering confirmation
const messagingCenterSrc = fs.readFileSync(path.join(rootDir, 'client/src/components/messaging/MessagingCenter.jsx'), 'utf8');
assert.ok(messagingCenterSrc.includes('{selectedMessage.body}'), 'MessagingCenter.jsx should render selectedMessage.body');

const output = {
    scope: 'Candidate worktree assignment body resolution verification',
    branch: 'fix/issue-126-message-attribution',
    namedAssignFooter: namedAssignBody.split('\n').at(-1),
    fallbackAssignFooter: fallbackAssignBody.split('\n').at(-1),
    namedReassignFooter: namedReassignBody.split('\n').at(-1),
    legacyStoredEnrichedFooter: enrichedStoredBody.split('\n').at(-1),
    userAuthoredNegativeRegressionPreserved: userAuthoredResult.split('\n').at(-1),
    clientRendersSelectedMessageBody: true,
    pass: true
};

console.log(JSON.stringify(output, null, 2));
