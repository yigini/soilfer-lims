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
        if (audit.expectedStatus != null && sample.status !== audit.expectedStatus) {
            throw new TransitionError('Sample changed. Reload before retrying.', 409, 'SAMPLE_STATE_CHANGED');
        }
        if ('id' in data && data.id !== sample.id) throw new TransitionError('Sample identity cannot change during a transition.', 400, 'WORKFLOW_ID_IMMUTABLE');
        rules.assertScope(actor, { ...sample, ...data });
        const currentStatus = workflow.normalizeSampleState(sample.status);
        if (!migrating && nextStatus === 'ACCEPTED') await require('./sampleHoldService').assertNotHeld(client, sample);
        let provenance = {};
        let gateAudit = {};
        if (migrating) {
            provenance = require('./statusMigrationPlan').assertReviewedRow(audit.migrationPlan, 'Sample', sample, nextStatus, performedBy);
            rules.requireReason(reason);
        } else if (currentStatus !== nextStatus) {
            if (nextStatus === 'DRAFT' && (currentStatus !== 'EXPECTED' || audit.action !== 'INTAKE_DRAFT_SAVED' ||
                !hasPermission(actor, 'RECEIVE_SAMPLE'))) {
                throw new TransitionError('Saving an expected specimen as a draft requires the authorized intake action.', 409, 'ILLEGAL_STATUS_TRANSITION');
            }
            const scientificReopen = audit.action === 'SCIENTIFIC_AMENDMENT_AUTHORISED';
            if (scientificReopen) {
                if (!workflow.isScientificAmendmentTransition('Sample', currentStatus, nextStatus)) {
                    throw new TransitionError('The amendment cannot reopen this sample.', 409, 'AMENDMENT_SAMPLE_UNAVAILABLE');
                }
                require('./scientificAmendmentService').assertScientificReopenCapability(client, audit.amendmentCapability, sample, actor);
                rules.requireReason(reason);
            }
            if (!scientificReopen && !workflow.isValidSampleTransition(currentStatus, nextStatus)) {
                throw new TransitionError(`Illegal transition from '${currentStatus}' to '${nextStatus}'.`, 409, 'ILLEGAL_STATUS_TRANSITION', {
                    currentStatus, attemptedStatus: nextStatus, allowedTransitions: workflow.SAMPLE_TRANSITIONS[currentStatus] || []
                });
            }
            provenance = rules.holdData(sample, nextStatus, actor, reason, 'Sample');
            if (nextStatus === 'CANCELLED') rules.requireReason(reason);
        }
        if (!migrating && ['SUBMITTED_PARTIAL', 'SUBMITTED_FULL', 'APPROVED'].includes(nextStatus)) {
            await require('./resultEvidenceService').assertNoPreparationRevert(client, sample.id);
            const gates = require('./gateEvidenceService');
            gateAudit = gates.auditEvidence(await gates.assertGateEvidence(client, { ...sample, ...data }));
        }
        if (!migrating && currentStatus === 'ACCEPTED' && nextStatus === 'PROCESSING') {
            const gates = require('./gateEvidenceService');
            gateAudit = gates.auditEvidence(await gates.assertGateEvidence(client, { ...sample, ...data }));
        }
        if (sample.status === nextStatus && !Object.keys(data).length && !migrating) return sample;
        const changed = await client.sample.updateMany({
            // The row was read inside this SQLite transaction. Keep the CAS on
            // its raw state; DateTime equality would reject historical epoch
            // timestamps that Prisma reads as dates but binds back as ISO text.
            where: { id: sample.id, status: audit.expectedStatus ?? sample.status,
                ...(migrating && { legacyStatus: sample.legacyStatus }) },
            data: { ...data, ...provenance, status: nextStatus, updatedAt: new Date() }
        });
        if (changed.count !== 1) throw new TransitionError('Sample changed. Reload before retrying.', 409, 'SAMPLE_STATE_CHANGED');
        const updated = await client.sample.findUnique({ where: { id: sample.id } });
        if (!migrating && nextStatus === 'ACCEPTED' && ['EXPECTED', 'RECEIVED', 'RECEIVED_REJECTED'].includes(currentStatus)) {
            const requested = typeof updated.requiredAnalyses === 'string' ? JSON.parse(updated.requiredAnalyses) : updated.requiredAnalyses || [];
            if (!Array.isArray(requested)) throw new TransitionError('Requested analyses need review.', 409, 'INTAKE_ANALYSES_INVALID');
            await require('./workItemStateService').reactivateCancelledIntakeWork(client, { sampleId: sample.id,
                previousSampleStatus: currentStatus, analyses: require('./analysisCodesService').normalizeAnalysisCodes(['DRYING', 'PREPARATION', ...requested]),
                actor, reason: reason || 'Sample legally re-accepted at intake' });
        }
        if (sample.status !== nextStatus || migrating) {
            await client.auditLog.create({ data: {
                id: randomUUID(), entity: 'SAMPLE', entityId: sample.id,
                action: audit.action || (migrating ? 'SAMPLE_STATUS_MIGRATED' : 'SAMPLE_STATUS_TRANSITION'),
                details: audit.details || `Status transition from ${sample.status} to ${nextStatus}${reason ? `: ${reason}` : ''}`,
                before: audit.before || JSON.stringify({ status: sample.status, holdPriorStatus: sample.holdPriorStatus ?? null, legacyStatus: sample.legacyStatus ?? null }),
                after: audit.after || JSON.stringify({ status: updated.status, holdPriorStatus: updated.holdPriorStatus ?? null, legacyStatus: updated.legacyStatus ?? null, ...gateAudit }),
                performedBy, sampleId: sample.id, labId: updated.assignedLab || null, timestamp: new Date()
            } });
        }
        return updated;
    });
}

async function createSample(data, actor, options = {}) {
    rules.assertNoRelationWrites(data);
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
            id: randomUUID(), entity: 'SAMPLE', entityId: sample.id, action: options.audit?.action || 'SAMPLE_CREATED', performedBy,
            details: options.audit?.details || JSON.stringify({ status, context: options.context || 'ordinary',
                ...(options.importingUser && { importingUser: rules.actorName(options.importingUser) }) }),
            sampleId: sample.id, labId: sample.assignedLab || null, timestamp: new Date()
        } });
        return sample;
    });
}

async function advanceCompletedGates(sample, actor, tx) {
    await require('./gateEvidenceService').assertGateEvidence(tx, sample);
    if (workflow.normalizeSampleState(sample.status) === 'ACCEPTED') {
        return transitionSample(sample.id, 'PROCESSING', actor, 'Drying and preparation gates completed', {}, tx);
    }
    return sample;
}

async function removePreAnalyticSample(tx, ids, { actor, reason, code = 'SAMPLE_DELETED' }) {
    rules.requireTransaction(tx);
    const performedBy = rules.actorName(actor), note = rules.requireReason(reason);
    if (!Array.isArray(ids) || !ids.length || ids.some(value => typeof value !== 'string' || !value)) {
        throw new TransitionError('Explicit sample ids are required.', 400, 'SAMPLE_IDS_REQUIRED');
    }
    const uniqueIds = [...new Set(ids)], where = { id: { in: uniqueIds } };
    const rows = await tx.sample.findMany({ where });
    if (rows.length !== uniqueIds.length) throw new TransitionError('Sample not found', 404, 'SAMPLE_NOT_FOUND');
    for (const sample of rows) {
        rules.assertScope(actor, sample);
        if (!['DRAFT', 'EXPECTED', 'RECEIVED', 'COLLECTED'].includes(sample.status)) {
            throw new TransitionError('Samples in progress or completed cannot be deleted.', 409, 'ILLEGAL_STATUS_TRANSITION');
        }
    }
    const sampleWhere = { sampleId: { in: uniqueIds } };
    if (await tx.result.count({ where: sampleWhere }) || await tx.spectralData.count({ where: sampleWhere })) {
        throw new TransitionError('Recorded analytical evidence must be retained.', 409, 'CANNOT_DELETE_SAMPLE_WITH_RESULTS');
    }
    await require('./workItemStateService').removeUnstartedWorkItems(tx, sampleWhere, { actor, reason: note });
    await tx.submission.deleteMany({ where: sampleWhere });
    await tx.auditLog.create({ data: { id: randomUUID(), entity: 'SAMPLE', entityId: uniqueIds.length === 1 ? uniqueIds[0] : 'BATCH',
        action: code, performedBy, details: note, before: JSON.stringify(uniqueIds), timestamp: new Date(),
        labId: rows.every(row => (row.assignedLab || row.labId || null) === (rows[0].assignedLab || rows[0].labId || null))
            ? rows[0].assignedLab || rows[0].labId || null : null } });
    const removed = await tx.sample.deleteMany({ where });
    return removed;
}

// Marker compatibility updates preserve the raw lifecycle value, including
// pre-migration legacy states. Only the hold service invokes this narrow writer.
async function writeSampleHoldCompatibility(tx, sample, data, actor) {
    rules.requireTransaction(tx);
    rules.actorName(actor);
    rules.assertScope(actor, sample);
    if (Object.keys(data).some(key => !['metadata', 'fieldMetadata'].includes(key)) ||
        Object.values(data).some(value => value !== null && typeof value !== 'string')) {
        throw new TransitionError('Hold compatibility updates may only change serialized markers.', 400, 'HOLD_MARKER_UPDATE_INVALID');
    }
    return tx.sample.update({ where: { id: sample.id }, data });
}

module.exports = { transitionSample, createSample, advanceCompletedGates, TransitionError, removePreAnalyticSample, writeSampleHoldCompatibility };
