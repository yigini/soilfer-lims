const prisma = require('../prisma');
const workflow = require('../workflowContract');
const crypto = require('crypto');

class TransitionError extends Error {
    constructor(message, statusCode, code, details = {}) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

/**
 * Canonical Sample State Transition Helper
 * Enforces workflowContract rules, performs update, and logs audit record in one transaction.
 *
 * @param {string} sampleId - ID of sample to transition
 * @param {string} nextStatus - Desired next status
 * @param {string|object} actor - Username or req.user object performing the transition
 * @param {string} reason - Justification or note for transition
 * @param {object} extraData - Additional sample fields to update atomically
 * @returns {Promise<object>} - Updated sample
 */
async function transitionSample(sampleId, nextStatus, actor, reason = null, extraData = {}) {
    // 1. Validation of target status
    if (workflow.isLegacySampleState(nextStatus)) {
        throw new TransitionError(
            `Status '${nextStatus}' is a deprecated legacy status and cannot be set.`,
            400,
            'ILLEGAL_LEGACY_STATUS',
            { requestedStatus: nextStatus }
        );
    }

    if (!workflow.isValidSampleState(nextStatus)) {
        throw new TransitionError(
            `Status '${nextStatus}' is not a valid sample state. Allowed states: ${workflow.SAMPLE_STATE_LIST.join(', ')}`,
            400,
            'UNKNOWN_SAMPLE_STATUS',
            { requestedStatus: nextStatus, allowedStates: workflow.SAMPLE_STATE_LIST }
        );
    }

    const actorUsername = typeof actor === 'object' && actor ? (actor.username || actor.name || 'SYSTEM') : (actor || 'SYSTEM');

    // 2. Atomic Transition Transaction
    return await prisma.$transaction(async (tx) => {
        const sample = await tx.sample.findUnique({
            where: { id: String(sampleId) }
        });

        if (!sample) {
            throw new TransitionError(`Sample ${sampleId} not found.`, 404, 'SAMPLE_NOT_FOUND', { sampleId });
        }

        const currentStatus = sample.status;

        // Same status is a no-op update for extraData
        if (currentStatus === nextStatus) {
            if (Object.keys(extraData).length > 0) {
                return await tx.sample.update({
                    where: { id: String(sampleId) },
                    data: { ...extraData }
                });
            }
            return sample;
        }

        // Validate transition graph
        if (!workflow.isValidSampleTransition(currentStatus, nextStatus)) {
            const allowed = workflow.SAMPLE_TRANSITIONS[currentStatus] || [];
            throw new TransitionError(
                `Illegal transition from '${currentStatus}' to '${nextStatus}'. Allowed transitions from '${currentStatus}': [${allowed.join(', ')}]`,
                409,
                'ILLEGAL_STATUS_TRANSITION',
                { currentStatus, attemptedStatus: nextStatus, allowedTransitions: allowed }
            );
        }

        // Execute sample update
        const updatedSample = await tx.sample.update({
            where: { id: String(sampleId) },
            data: {
                status: nextStatus,
                ...extraData,
                updatedAt: new Date()
            }
        });

        // Insert audit log
        await tx.auditLog.create({
            data: {
                id: crypto.randomUUID(),
                entity: 'SAMPLE',
                entityId: String(sampleId),
                action: 'SAMPLE_STATUS_TRANSITION',
                details: `Status transition from ${currentStatus} to ${nextStatus}${reason ? `: ${reason}` : ''}`,
                performedBy: actorUsername,
                sampleId: String(sampleId),
                labId: sample.labId || sample.assignedLab || null,
                timestamp: new Date()
            }
        });

        return updatedSample;
    });
}

module.exports = {
    transitionSample,
    TransitionError
};
