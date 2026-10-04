const { IntakeError } = require('./intakeErrors');
const { normalizeAnalysisCodes } = require('./analysisCodesService');
const { validateSelection } = require('./cataloguePolicy');
const projects = require('./projectPolicyService');
const scope = require('../utils/scopeGuard');
const { transitionSample } = require('./sampleStateService');
const profile = require('./intakeProfileService');
const { evaluateChecklistCompliance } = require('./intakeValidationService');

function validateMass(body) {
    for (const unit of [body.receivedMassUnit, body.massUnit]) if (unit !== undefined && unit !== null && unit !== '' && unit !== 'g') throw new IntakeError(422, { code: 'SAMPLE_MASS_UNIT_UNSUPPORTED', message: 'receivedMass is expressed in grams (g).' });
    const value = body.receivedMass;
    if (value === undefined || value === null || value === '') return undefined;
    if (!['number', 'string'].includes(typeof value) || !String(value).trim() || !Number.isFinite(Number(value)) || Number(value) < 0) throw new IntakeError(422, { code: 'SAMPLE_MASS_INVALID', message: 'An observed mass must be a finite non-negative number in grams.' });
    return Number(value);
}
async function receiveSample(tx, { sampleId, body = {}, user, createDataFactory }) {
    const now = new Date();
    if (!user?.username || !Number.isFinite(now.getTime())) throw new IntakeError(422, { code: 'INTAKE_CUSTODY_REQUIRED', message: 'The receiving officer and received-at timestamp are required.' });
    const mass = validateMass(body);
    let sample = sampleId ? await tx.sample.findUnique({ where: { id: String(sampleId) } }) : null;
    if (sampleId && !sample) throw new IntakeError(404, { error: 'Sample not found' });
    if (sample) {
        scope.ensureScope(user, sample, { altLabField: 'assignedLab' });
        if (!['EXPECTED', 'COLLECTED', 'DRAFT'].includes(sample.status)) throw new IntakeError(400, { error: `Cannot receive. Sample must be EXPECTED. Current: ${sample.status}` });
    }
    const labId = sample?.assignedLab || user.labId || (scope.hasGlobalAccess(user) ? body.assignedLab : null);
    const lab = labId && await tx.lab.findUnique({ where: { id: labId } });
    if (!lab?.isActive) throw new IntakeError(400, { code: 'ACTIVE_LAB_REQUIRED', error: 'ACTIVE_LAB_REQUIRED', message: 'Select an active receiving laboratory.' });
    const oldAnalyses = sample?.requiredAnalyses ? JSON.parse(sample.requiredAnalyses) : [];
    const requested = body.requiredAnalyses ?? body.analyses ?? oldAnalyses;
    if (!Array.isArray(requested) || requested.some(code => typeof code !== 'string' || !code.trim())) throw new IntakeError(422, { code: 'INTAKE_CATALOGUE_INVALID', message: 'Requested analyses must be an array of catalogue codes.' });
    const codes = normalizeAnalysisCodes(requested);
    const selected = await validateSelection(codes, { labId, db: tx });
    if (!selected.valid) throw new IntakeError(422, { code: 'INTAKE_CATALOGUE_INVALID', error: selected.error, message: selected.error, issues: selected.issues });
    const reference = sample?.projectId || sample?.projectCode || body.projectId || body.projectCode;
    const resolved = reference ? await projects.resolveProject(reference, tx) : null;
    const admission = projects.canAdmitSample({ project: resolved?.project, channel: sample ? 'PHYSICAL_RECEIPT' : 'WALK_IN', actor: user, labId });
    if (!admission.allowed) throw new IntakeError(422, { error: admission.code || 'PROJECT_ADMISSIONS_BLOCKED', message: admission.reason });
    const custody = {};
    const handover = body.custodyHandoverAt || body.coc?.handoverAt || body.coc?.date;
    if (handover) {
        const at = new Date(handover);
        if (!Number.isFinite(at.getTime())) throw new IntakeError(422, { code: 'INTAKE_CUSTODY_INVALID', message: 'The custody handover date must be valid.' });
        custody.custodyHandoverAt = at;
    }
    for (const field of ['custodyCarrierName', 'custodyTrackingNumber', 'custodySenderSignature', 'receivingOfficerSignature']) if (body[field] !== undefined) custody[field] = body[field] || null;
    if (!sample) {
        if (!createDataFactory) throw new IntakeError(422, { code: 'INTAKE_IDENTIFIER_REQUIRED', message: 'A specimen identifier is required.' });
        const data = await createDataFactory(tx, lab);
        sample = await tx.sample.create({ data: { ...data, status: 'EXPECTED', assignedLab: labId, labId: null, labSampleCode: null, requiredAnalyses: JSON.stringify(codes) } });
    }
    const reception = profile.parseFieldMetadata(sample.receptionData);
    if (body.checklist !== undefined) {
        reception.checklist = body.checklist;
        reception.checklistDraft = !evaluateChecklistCompliance(body.checklist, { isWalkIn: !resolved }).isPassed;
    }
    const metadata = profile.parseFieldMetadata(sample.metadata);
    const events = typeof sample.history === 'string' ? JSON.parse(sample.history) : sample.history || [];
    if (!Array.isArray(events)) throw new IntakeError(409, { code: 'INTAKE_HISTORY_INVALID', message: 'The stored custody history needs review.' });
    events.push({ status: 'RECEIVED', changedBy: user.username, timestamp: now.toISOString(), note: 'Physical arrival recorded; acceptance pending.' });
    return transitionSample(sample.id, 'RECEIVED', user, 'Physical arrival recorded; acceptance pending.', {
        ...custody, receptionDate: now, receivedBy: user.username, receivingOfficerId: user.id ? String(user.id) : null, receivingOfficerName: user.name || user.username,
        requiredAnalyses: JSON.stringify(codes), ...(mass !== undefined ? { receivedMass: mass } : {}),
        receptionData: JSON.stringify({ ...reception, receivedBy: user.username, receivedAt: now.toISOString() }), history: JSON.stringify(events)
    }, tx, { action: 'SAMPLE_RECEIVED', details: JSON.stringify({ summary: 'Physical arrival recorded; acceptance pending.', provenanceHold: metadata.provenanceHold || null }),
        before: JSON.stringify({ status: sample.status }), after: JSON.stringify({ status: 'RECEIVED' }) });
}
module.exports = { receiveSample, validateMass };
