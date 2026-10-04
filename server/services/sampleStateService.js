const { randomUUID } = require('node:crypto');
const workflow = require('../workflowContract');
const { hasPermission } = require('../config/roles');
const rules = require('./workflowStateRules');
const { TransitionError } = rules;

/** The only Sample status writer; state, provenance and audit commit together. */
async function transitionSample(sampleId, nextStatus, actor, reason = null, extraData = {}, tx = null, audit = {}) {
    const performedBy = rules.actorName(actor);
    const migrating = !!audit.migrationPlan;
    if (!migrating && (workflow.isLegacySampleState(nextStatus) || nextStatus in workflow.LEGACY_SAMPLE_STATE_MAP)) {
        throw new TransitionError(`Status '${nextStatus}' is a deprecated legacy status and cannot be set.`, 409, 'ILLEGAL_LEGACY_STATUS');
    }
    if (!migrating && !workflow.isValidSampleState(nextStatus)) {
        throw new TransitionError(`Status '${nextStatus}' is not a valid sample state.`, 400, 'UNKNOWN_SAMPLE_STATUS');
    }
    const data = rules.updateData(extraData, nextStatus);
    return rules.inTransaction(tx, async client => {
        const sample = await client.sample.findUnique({ where: { id: String(sampleId) } });
        if (!sample) throw new TransitionError(`Sample ${sampleId} not found.`, 404, 'SAMPLE_NOT_FOUND');
        rules.assertScope(actor, sample);
        if ('id' in data && data.id !== sample.id) throw new TransitionError('Sample identity cannot change during a transition.', 400, 'WORKFLOW_ID_IMMUTABLE');
        rules.assertScope(actor, { ...sample, ...data });
        const currentStatus = workflow.normalizeSampleState(sample.status);
        let provenance = {};
        if (migrating) {
            provenance = require('./statusMigrationPlan').assertReviewedRow(audit.migrationPlan, 'Sample', sample, nextStatus, performedBy);
            rules.requireReason(reason);
        } else if (currentStatus !== nextStatus) {
            if (!workflow.isValidSampleTransition(currentStatus, nextStatus)) {
                throw new TransitionError(`Illegal transition from '${currentStatus}' to '${nextStatus}'.`, 409, 'ILLEGAL_STATUS_TRANSITION', {
                    currentStatus, attemptedStatus: nextStatus, allowedTransitions: workflow.SAMPLE_TRANSITIONS[currentStatus] || []
                });
            }
            provenance = rules.holdData(sample, nextStatus, actor, reason, 'Sample');
            if (nextStatus === 'CANCELLED') rules.requireReason(reason);
        }
        if (!migrating && ['SUBMITTED_PARTIAL', 'SUBMITTED_FULL', 'APPROVED'].includes(nextStatus)) {
            await require('./resultEvidenceService').assertNoPreparationRevert(client, sample.id);
        }
        if (sample.status === nextStatus && !Object.keys(data).length && !migrating) return sample;
        const changed = await client.sample.updateMany({
            // The row was read inside this SQLite transaction. Keep the CAS on
            // its raw state; DateTime equality would reject historical epoch
            // timestamps that Prisma reads as dates but binds back as ISO text.
            where: { id: sample.id, status: sample.status,
                ...(migrating && { legacyStatus: sample.legacyStatus }) },
            data: { ...data, ...provenance, status: nextStatus, updatedAt: new Date() }
        });
        if (changed.count !== 1) throw new TransitionError('Sample changed. Reload before retrying.', 409, 'SAMPLE_STATE_CHANGED');
        const updated = await client.sample.findUnique({ where: { id: sample.id } });
        if (sample.status !== nextStatus || migrating) {
            await client.auditLog.create({ data: {
                id: randomUUID(), entity: 'SAMPLE', entityId: sample.id,
                action: audit.action || (migrating ? 'SAMPLE_STATUS_MIGRATED' : 'SAMPLE_STATUS_TRANSITION'),
                details: audit.details || `Status transition from ${sample.status} to ${nextStatus}${reason ? `: ${reason}` : ''}`,
                before: audit.before || JSON.stringify({ status: sample.status, holdPriorStatus: sample.holdPriorStatus ?? null, legacyStatus: sample.legacyStatus ?? null }),
                after: audit.after || JSON.stringify({ status: updated.status, holdPriorStatus: updated.holdPriorStatus ?? null, legacyStatus: updated.legacyStatus ?? null }),
                performedBy, sampleId: sample.id, labId: updated.assignedLab || null, timestamp: new Date()
            } });
        }
        return updated;
    });
}

async function createSample(data, actor, options = {}) {
    const performedBy = rules.actorName(actor);
    const status = data.status || 'EXPECTED';
    if (options.context === 'fixture') {
        rules.assertFixtureContext();
        if (performedBy !== 'system:fixture' || !workflow.isValidSampleState(status)) {
            throw new TransitionError('Invalid workflow fixture actor or state.', 409, 'WORKFLOW_FIXTURE_REFUSED');
        }
    } else if (options.context === 'legacy-import') {
        if (performedBy !== 'system:legacy-import' || status !== 'APPROVED' ||
            !hasPermission(options.importingUser, 'RECEIVE_SAMPLE')) {
            throw new TransitionError('Historical import creation is not authorized.', 403, 'LEGACY_IMPORT_NOT_AUTHORIZED');
        }
        rules.assertScope(options.importingUser, data);
        const reception = JSON.parse(data.receptionData || '{}');
        if (reception.isLegacy !== true || data.approvedAt != null || data.approvedBy != null) {
            throw new TransitionError('Historical imports cannot invent an approval identity.', 409, 'LEGACY_IMPORT_APPROVAL_REFUSED');
        }
    } else {
        if (!['EXPECTED', 'DRAFT'].includes(status)) throw new TransitionError('A new sample must start at EXPECTED or DRAFT.', 409, 'INITIAL_STATE_NOT_ALLOWED');
        rules.assertScope(actor, data);
    }
    if (data.holdPriorStatus != null || data.legacyStatus != null) throw new TransitionError('Creation cannot set state provenance.', 400, 'STATE_METADATA_NOT_ALLOWED');
    return rules.inTransaction(options.tx, async client => {
        const sample = await client.sample.create({ data: { ...data, status } });
        await client.auditLog.create({ data: {
            id: randomUUID(), entity: 'SAMPLE', entityId: sample.id, action: 'SAMPLE_CREATED', performedBy,
            details: JSON.stringify({ status, context: options.context || 'ordinary',
                ...(options.importingUser && { importingUser: rules.actorName(options.importingUser) }) }),
            sampleId: sample.id, labId: sample.assignedLab || null, timestamp: new Date()
        } });
        return sample;
    });
}

module.exports = { transitionSample, createSample, TransitionError };
