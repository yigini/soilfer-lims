const fs = require('node:fs');
const path = require('node:path');
const workflow = require('../../workflowContract');

test('approved and terminal samples cannot return to processing', () => {
    for (const status of ['APPROVED', 'ARCHIVED', 'DISPOSED', 'CANCELLED', 'RELEASED']) {
        expect(workflow.isValidSampleTransition(status, 'PROCESSING')).toBe(false);
    }
    expect(workflow.isValidSampleTransition('SUBMITTED_FULL', 'PROCESSING')).toBe(true);
});

test('legacy aliases retain their approved meaning without promoting unmapped values', () => {
    expect(workflow.normalizeSampleState('COLLECTED')).toBe('EXPECTED');
    expect(workflow.normalizeSampleState('REJECTED')).toBe('RECEIVED_REJECTED');
    expect(workflow.normalizeSampleState('RELEASED')).toBe('APPROVED');
    expect(workflow.normalizeWorkItemState('REANALYSIS_REQUIRED')).toBe('REPEAT_REQUIRED');
    expect(workflow.normalizeWorkItemState('QA_PENDING')).toBe('SUBMITTED');
    for (const value of ['VALIDATED', 'PENDING', 'NON_CONFORMING']) {
        expect(workflow.normalizeSampleState(value)).toBe(value);
    }
    expect(workflow.normalizeWorkItemState('VALIDATED')).toBe('VALIDATED');
});

test('verification is a work-item gate state with restricted outgoing edges', () => {
    expect(workflow.SAMPLE_STATE_LIST).not.toContain('AWAITING_VERIFICATION');
    expect(workflow.WORK_ITEM_STATE_LIST).toContain('AWAITING_VERIFICATION');
    expect(workflow.WORK_ITEM_TRANSITIONS.AWAITING_VERIFICATION).toEqual(['COMPLETED', 'REPEAT_REQUIRED']);
    expect(workflow.isValidWorkItemTransition('AWAITING_VERIFICATION', 'ON_HOLD')).toBe(false);
    expect(workflow.isValidWorkItemTransition('AWAITING_VERIFICATION', 'WAIVED')).toBe(false);
    expect(workflow.WORK_ITEM_TRANSITIONS.CANCELLED).toEqual([]);
});

test('repeat aliases have the same outgoing edges and new review targets use REPEAT_REQUIRED', () => {
    expect(workflow.WORK_ITEM_TRANSITIONS.REPEAT_REQUIRED).toEqual(workflow.WORK_ITEM_TRANSITIONS.REANALYSIS_REQUIRED);
    expect(workflow.WORK_ITEM_TRANSITIONS.SUBMITTED).toContain('REPEAT_REQUIRED');
    expect(workflow.WORK_ITEM_TRANSITIONS.SUBMITTED).not.toContain('REANALYSIS_REQUIRED');
});

test('client workflow contract is byte-identical to the server source', () => {
    const server = fs.readFileSync(path.resolve(__dirname, '../../workflowContract.js'));
    const client = fs.readFileSync(path.resolve(__dirname, '../../../client/src/utils/workflowContract.js'));
    expect(client.equals(server)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../client/package.json'), 'utf8'));
    expect(pkg.scripts.prebuild).toBe('node scripts/generate-workflow-contract.cjs');
});
