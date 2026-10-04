const crypto = require('crypto');
const intake = require('./intakeService');
const { IntakeError } = require('./intakeErrors');
const { allocateConsignmentNumber } = require('./consignmentNumberService');
const projects = require('./projectPolicyService');
const observations = require('./batchIntakeObservationsService');

function expectedCount(value) {
    if (value === undefined) return null;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) throw new IntakeError(422, { code: 'CONSIGNMENT_EXPECTED_COUNT_INVALID', message: 'The declared count must be a positive integer.' });
    return value;
}
function discrepancy(declared, received) {
    return declared == null ? { status: 'NOT_DECLARED', difference: null } : { status: declared === received ? 'MATCH' : declared > received ? 'MISSING' : 'EXCESS', difference: received - declared };
}
function rowError(error, row, sample) {
    return { row: row + 1, originalId: sample?.originalId || sample?.id || null, code: error.code || 'INTAKE_ROW_FAILED',
        message: error.message, ...(error.payload || {}), ...(error.reason ? { reason: error.reason } : {}) };
}
function failRows(errors, allFailed = false) {
    const commonCode = errors.length && errors.every(error => error.code === errors[0].code) ? errors[0].code : 'CONSIGNMENT_ROWS_FAILED';
    const warnings = errors.filter(error => error.code === 'MASS_DEFICIT').map(error => ({ row: error.row, originalId: error.originalId, code: error.code, massDeficitInfo: error.massDeficitInfo }));
    throw new IntakeError(422, { success: false, code: allFailed ? 'CONSIGNMENT_ALL_ROWS_FAILED' : commonCode,
        error: allFailed ? 'Every consignment row failed validation.' : errors.length && errors.every(error => error.error === errors[0].error) && errors[0].error || 'Consignment rows failed validation; no intake was committed.', errors,
        ...(warnings.length ? { warnings, massDeficitInfo: warnings[0].massDeficitInfo } : {}) });
}
async function receiveConsignment(tx, { body, user, expectedSnapshots }) {
    intake.requireTransaction(tx);
    const { consignment: header = {}, defaults = {}, samples = [], bulkApplications = [], allowPartial = false } = body;
    if (!Array.isArray(samples) || !samples.length) throw new IntakeError(400, { error: 'At least one sample is required for batch intake' });
    if (typeof allowPartial !== 'boolean') throw new IntakeError(422, { code: 'CONSIGNMENT_ALLOW_PARTIAL_INVALID', message: 'allowPartial must be a boolean.' });
    const declared = expectedCount(header.expectedCount);
    const now = new Date();
    const lab = user.labId && await tx.lab.findUnique({ where: { id: user.labId } });
    if (!lab?.isActive) throw new IntakeError(403, { code: 'MISSING_LAB_SCOPE', message: 'Select an active receiving laboratory.' });
    for (const value of [header.deliveredAt, header.custodyHandoverAt]) if (value != null && value !== '' && !Number.isFinite(new Date(value).getTime())) throw new IntakeError(422, { code: 'INTAKE_CUSTODY_INVALID', message: 'The custody date must be valid.' });
    const project = header.projectId || header.projectCode ? await projects.resolveProject(header.projectId || header.projectCode, tx) : null;
    const applications = observations.normalizeApplications(bulkApplications, samples);
    const plans = [], errors = [], seen = new Set();
    for (const [index, sample] of samples.entries()) {
        try {
            if (!sample || typeof sample !== 'object' || Array.isArray(sample)) throw new IntakeError(422, { code: 'INTAKE_ROW_INVALID', message: 'Each consignment row must be a specimen object.' });
            const originalId = String(sample.originalId || sample.id || '').trim();
            if (!originalId) throw new IntakeError(422, { code: 'INTAKE_IDENTIFIER_REQUIRED', message: 'A specimen identifier is required.' });
            if (seen.has(originalId)) throw new IntakeError(422, { code: 'DUPLICATE_INTAKE_ROW', message: 'This identifier appears more than once in the consignment.' });
            seen.add(originalId);
            const observed = observations.observations(sample, applications);
            const rowProject = sample.projectId || sample.projectCode;
            if (project && rowProject) {
                const resolved = await projects.resolveProject(rowProject, tx);
                if (!resolved || resolved.id !== project.id) throw new IntakeError(400, { code: 'CROSS_PROJECT_CONFLICT', message: 'The row belongs to a different project.' });
            }
            const input = { ...defaults, ...sample, ...observed, originalId,
                massWarningAcknowledged: sample.massWarningAcknowledged === true,
                projectId: project?.id || rowProject || null, isWalkIn: !project && !rowProject,
                decision: ['REJECT', 'REJECTED', 'RECEIVED_REJECTED'].includes(sample.status) ? 'REJECTED' : 'ACCEPTED', isDraft: false,
                ncReason: sample.rejectionReason || sample.ncReason || defaults.ncReason || 'Sample non-conformance recorded during batch reception',
                intakeChannel: 'MANIFEST', exceptionRecord: sample.exceptionRecord || body.exceptionRecord, exceptionReason: sample.exceptionReason || body.exceptionReason,
                approvalId: sample.approvalId || body.approvalId || body.approvalToken,
                custodyHandoverAt: sample.custodyHandoverAt || header.custodyHandoverAt || header.deliveredAt || now.toISOString(),
                custodyCarrierName: sample.custodyCarrierName || header.custodyCarrierName || header.deliveredBy,
                custodyTrackingNumber: sample.custodyTrackingNumber || header.custodyTrackingNumber || header.deliveryNoteRef,
                custodySenderSignature: sample.custodySenderSignature || header.custodySenderSignature,
                receivingOfficerSignature: sample.receivingOfficerSignature || header.receivingOfficerSignature,
                samplingDetails: { ...defaults.samplingDetails, ...sample.samplingDetails, ...(sample.coordinates ? { coordinates: sample.coordinates } : {}) }
            };
            const plan = await intake.prepareIntake(tx, { body: input, user, expectedSnapshot: expectedSnapshots?.[index], newSampleId: crypto.randomUUID(), initialFieldMetadata: sample.fieldMetadata || (sample.collectionDate ? { collectionDate: sample.collectionDate } : {}) });
            plans.push({ index, plan });
        } catch (error) { errors.push(rowError(error, index, sample)); }
    }
    if (!allowPartial && errors.length) failRows(errors);
    if (!plans.length) failRows(errors, true);
    const code = await allocateConsignmentNumber(tx, { labReference: lab.id, projectCode: project?.code, issuedAt: now });
    const consignment = await tx.consignment.create({ data: {
        id: crypto.randomUUID(), code, labId: lab.id, projectCode: project?.code || null,
        submitterName: header.submitterName || header.submitter?.name || null, submitterOrg: header.submitterOrg || header.submitter?.organization || null,
        submitterPhone: header.submitterPhone || header.submitter?.phone || null, submitterEmail: header.submitterEmail || header.submitter?.email || null,
        deliveredBy: header.deliveredBy || null, deliveredAt: header.deliveredAt ? new Date(header.deliveredAt) : null,
        receivedBy: user.username, receivedAt: now, deliveryNoteRef: header.deliveryNoteRef || null, expectedCount: declared,
        custodyHandoverAt: header.custodyHandoverAt ? new Date(header.custodyHandoverAt) : header.deliveredAt ? new Date(header.deliveredAt) : now,
        custodyCarrierName: header.custodyCarrierName || header.deliveredBy || null, custodyTrackingNumber: header.custodyTrackingNumber || header.deliveryNoteRef || null,
        custodySenderSignature: header.custodySenderSignature || null, receivingOfficerId: user.id ? String(user.id) : null,
        receivingOfficerName: user.name || user.username, receivingOfficerSignature: header.receivingOfficerSignature || `CONFIRMED:${user.username}:${now.toISOString()}`,
        notes: header.notes || null, metadata: header.metadata ? JSON.stringify(header.metadata) : null
    } });
    const processed = [], approvals = new Map();
    for (const { index, plan } of plans) {
        const savepoint = `intake_row_${index}`;
        if (allowPartial) await tx.$executeRawUnsafe(`SAVEPOINT "${savepoint}"`);
        try {
            plan.updateData.consignmentId = consignment.id;
            plan.updateData.receptionData = JSON.stringify({ ...JSON.parse(plan.updateData.receptionData || '{}'), consignmentCode: code, deliveryNoteRef: consignment.deliveryNoteRef });
            const commit = plan.responseKind === 'rejected' ? intake.rejectSample : intake.acceptSample;
            const result = await commit(tx, { body: plan.body, user: plan.user }, plan, { consumeApproval: false });
            processed.push(result);
            if (plan.approval?.mode === 'STORED_APPROVAL') approvals.set(plan.approval.approvalId, plan.approval);
            if (allowPartial) await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`);
        } catch (error) {
            if (allowPartial) { await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT "${savepoint}"`); await tx.$executeRawUnsafe(`RELEASE SAVEPOINT "${savepoint}"`); }
            errors.push(rowError(error, index, samples[index]));
            if (!allowPartial) failRows(errors);
        }
    }
    if (!processed.length) failRows(errors, true);
    for (const approval of approvals.values()) await intake.consumeStoredApproval(tx, approval);
    const acceptedCount = processed.filter(result => result.sample.status === 'ACCEPTED').length, rejectedCount = processed.length - acceptedCount;
    const final = await tx.consignment.update({ where: { id: consignment.id }, data: { sampleCount: processed.length, acceptedCount, rejectedCount,
        status: rejectedCount === processed.length ? 'REJECTED' : rejectedCount ? 'PARTIAL' : 'RECEIVED' } });
    await tx.auditLog.create({ data: { id: crypto.randomUUID(), entity: 'CONSIGNMENT', entityId: final.id, action: 'CONSIGNMENT_BATCH_RECEIVED',
        details: JSON.stringify({ summary: `Consignment ${code} received with ${processed.length} samples (${acceptedCount} accepted, ${rejectedCount} rejected).`,
            failedRowCount: errors.length, bulkApplications: applications, discrepancy: discrepancy(declared, processed.length),
            massDeficitAcknowledgements: processed.filter(result => result.sample.massWarningAcknowledged).map(result => result.sample.originalId) }),
        performedBy: user.username, timestamp: now, labId: lab.id } });
    return { success: true, consignment: { ...final, discrepancy: discrepancy(declared, processed.length) },
        samples: processed.map(({ response, sample }) => ({ ...response, rejectionReason: sample.rejectionReason, receivedMass: sample.receivedMass })),
        errors: errors.sort((a, b) => a.row - b.row), failedRows: errors.length, message: `Batch received ${processed.length} samples under Consignment ${code}.` };
}
module.exports = { receiveConsignment, expectedCount, discrepancy };
