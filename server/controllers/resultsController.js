const crypto = require('crypto');
const prisma = require('../prisma');
const { deriveTextureResult } = require('../services/textureResultService');
const validationController = require('./validationController');
const { validateResultEntries } = require('../services/resultEntryPolicy');
const stateRules = require('../services/workflowStateRules');
const resultEvidence = require('../services/resultEvidenceService');
const gateEvidence = require('../services/gateEvidenceService');

async function assertResultSaveReadiness(db, sample, user) {
    stateRules.assertScope(user, sample);
    resultEvidence.assertAmendable(sample);
    if (!['PROCESSING', 'SUBMITTED_PARTIAL'].includes(sample.status)) {
        throw new stateRules.TransitionError(`Sample is not in Processing phase (current: ${sample.status})`, 400, 'SAMPLE_NOT_PROCESSING');
    }
    const report = await gateEvidence.loadGateEvidence(db, sample);
    if (report.blocked.some(gate => gate.mismatch)) gateEvidence.assertEvidence(report);
    for (const [gate, message] of [['PREPARATION', 'Sample preparation has not been completed'], ['DRYING', 'Sample drying has not been completed']]) {
        if (report.blocked.some(blocked => blocked.analysis === gate)) throw Object.assign(new Error(message), { statusCode: 412 });
    }
    return report;
}

exports.getResults = async (req, res) => {
    const { sampleId } = req.params;
    const user = req.user;

    try {
        // Fetch sample with lab fields for scope check
        const sample = await prisma.sample.findUnique({
            where: { id: sampleId },
            select: { id: true, labId: true, assignedLab: true, country: true, projectCode: true }
        });

        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // Lab Isolation Check (Phase 1 - Scope Guard)
        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample not in your Lab scope' });
        }

        const EXCLUDED_GATE_CODES = ['DRYING', 'PREPARATION', 'PREP', 'SAMPLE_PREP', 'SIEVING', 'MILLING', 'HOMOGENIZATION', 'ARCHIVING', 'DISPOSAL'];

        const results = await prisma.result.findMany({
            where: {
                sampleId,
                isCurrent: true,
                param: { notIn: EXCLUDED_GATE_CODES }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Enrich with parameter metadata (Name from Analysis)
        // Optimization: Fetch all needed analysis definitions in one go
        const paramCodes = [...new Set(results.map(r => r.param))];
        const analyses = await prisma.analysis.findMany({
            where: { code: { in: paramCodes } },
            select: { code: true, name: true, decimalPlaces: true, units: true }
        });

        const analysisMap = {};
        analyses.forEach(a => analysisMap[a.code] = a);

        const enriched = await Promise.all(results.map(async r => ({
            ...r,
            paramName: await require('../services/analysisService').getAnalysisName(r.param),
            decimalPlaces: analysisMap[r.param]?.decimalPlaces ?? 2,
            flags: typeof r.flags === 'string' ? JSON.parse(r.flags) : (r.flags || {})
        })));

        res.json(enriched);
    } catch (error) {
        console.error('[getResults] Error:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
};

exports.getResultHistory = async (req, res) => {
    const { sampleId, param } = req.params;
    const user = req.user;

    try {
        const sample = await prisma.sample.findUnique({
            where: { id: sampleId },
            select: { id: true, labId: true, assignedLab: true, country: true, projectCode: true }
        });

        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        const scopeGuard = require('../utils/scopeGuard');
        if (!scopeGuard.canAccessEntity(user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample not in your Lab scope' });
        }

        const where = { sampleId };
        if (param) where.param = param;

        const history = await prisma.result.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ history });
    } catch (error) {
        console.error('[getResultHistory] Error:', error);
        res.status(500).json({ error: 'Failed to fetch result history' });
    }
};

exports.saveResults = async (req, res) => {
    const { sampleId } = req.params;
    const { measurements } = req.body; // Array of { param, value, unit, methodologyId, equipmentId, batchId }
    const user = req.user;

    try {
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        const performedBy = stateRules.actorName(user);
        await assertResultSaveReadiness(prisma, sample, user);
        const outcome = await stateRules.inTransaction(prisma, async tx => {
            const current = await tx.sample.findUnique({ where: { id: sampleId } });
            if (!current) throw new stateRules.TransitionError('Sample not found.', 404, 'SAMPLE_NOT_FOUND');
            const gateReport = await assertResultSaveReadiness(tx, current, user);
            if (current.status !== sample.status) throw new stateRules.TransitionError('Sample readiness changed. Refresh before saving.', 409, 'SAMPLE_STATE_CHANGED');
            const entryError = await validateResultEntries(tx, current, measurements, user);
            if (entryError) throw Object.assign(new Error(entryError), { statusCode: 400 });

            // Validate
            const validatedMeasurements = await validationController.validateBatch(measurements, tx);
            if (validatedMeasurements.some(m => m.value == null || String(m.value).trim() === '' || m.validation.flags.includes('INVALID_FORMAT'))) {
                throw Object.assign(new Error('Every measurement must contain a valid numeric value or supported censoring qualifier.'), { statusCode: 400 });
            }

            const operations = [];
            const now = new Date();

            // Append-only results with supersession
            for (const m of validatedMeasurements) {
                const strVal = String(m.value).trim();
                const isCensored = m.validation?.isCensored || /^[<>]/.test(strVal);
                const censoringType = isCensored ? (strVal.startsWith('<') ? 'BELOW_LOQ' : 'ABOVE_RANGE') : 'NONE';
                const numericVal = m.validation?.normalizedValue !== undefined ? m.validation.normalizedValue : (isNaN(Number(strVal.replace(',', '.'))) ? null : Number(strVal.replace(',', '.')));

                const newResultId = crypto.randomUUID();

                const repNo = (m.replicateNo !== undefined && m.replicateNo !== null) ? Number(m.replicateNo) : 1;
                const validBasis = ['AIR_DRY', 'OVEN_DRY', 'FIELD_MOIST'].includes(m.basis) ? m.basis : 'AIR_DRY';

                // Supersede previous active result ONLY for the matching replicate number
                operations.push(db => db.result.updateMany({
                    where: {
                        sampleId,
                        param: m.param,
                        replicateNo: repNo,
                        isCurrent: true
                    },
                    data: {
                        isCurrent: false,
                        supersededBy: newResultId
                    }
                }));

                // Create new immutable record
                operations.push(db => db.result.create({
                    data: {
                        id: newResultId,
                        sampleId,
                        param: m.param,
                        value: strVal,
                        numericValue: numericVal,
                        unit: m.unit || null,
                        flags: JSON.stringify(m.validation?.flags || []),
                        isValid: m.validation?.valid,
                        censoring: censoringType,
                        basis: validBasis,
                        provenance: m.provenance || 'MEASURED',
                        methodologyId: m.methodologyId || null,
                        replicateNo: repNo,
                        isCurrent: true,
                        enteredBy: performedBy,
                        analysedAt: now,
                        equipmentId: m.equipmentId || null,
                        batchId: m.batchId || null,
                        createdAt: now,
                        updatedAt: now
                    }
                }));
            }

            operations.push(db => db.auditLog.create({
                data: {
                    id: crypto.randomUUID(),
                    entity: 'RESULTS',
                    entityId: sampleId,
                    action: 'UPDATE_RESULTS',
                    performedBy,
                    timestamp: now,
                    after: JSON.stringify(gateEvidence.auditEvidence(gateReport)),
                    details: `Appended ${measurements.length} defensible results`
                }
            }));

            for (const operation of operations) await operation(tx);
            const replicates = new Set(validatedMeasurements.filter(m => ['SAND', 'SILT', 'CLAY'].includes(m.param)).map(m => Number(m.replicateNo ?? 1)));
            for (const replicateNo of replicates) await deriveTextureResult(tx, { sampleId, replicateNo, actor: user?.username, now });

            // Compute cross-parameter sample matrix diagnostics
            const allActiveResults = await tx.result.findMany({
                where: { sampleId, isCurrent: true }
            });
            const matrixDiagnostics = validationController.validateSampleMatrix(allActiveResults);
            return { validatedMeasurements, matrixDiagnostics };
        });

        // Return validation feedback
        res.json({
            success: true,
            validation: outcome.validatedMeasurements.map(m => ({ param: m.param, flags: m.validation.flags })),
            matrixDiagnostics: outcome.matrixDiagnostics
        });

    } catch (error) {
        console.error('[saveResults] Error:', error);
        if (error.statusCode) return res.status(error.statusCode).json({ error: error.message,
            ...(error.code && { code: error.code }), ...(error.details && { details: error.details }) });
        res.status(500).json({ error: 'Failed to save results' });
    }
};

exports.submitForApproval = async (req, res) => {
    const { sampleId } = req.params;
    const user = req.user;

    try {
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        // Lab Isolation Check (S07)
        const scopeGuard = require('../utils/scopeGuard');
        if (user && user.role && !scopeGuard.canAccessEntity(user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample not in your Lab scope' });
        }

        // Check if results exist
        const allActiveResults = await prisma.result.findMany({ where: { sampleId, isCurrent: true } });
        if (allActiveResults.length === 0) {
            return res.status(400).json({ error: 'No results entered' });
        }

        const matrixDiagnostics = validationController.validateSampleMatrix(allActiveResults);
        if (matrixDiagnostics.isBlocking) {
            return res.status(422).json({
                error: 'BLOCKING_MATRIX_DIAGNOSTICS',
                message: 'Scientific matrix validation failed: ' + matrixDiagnostics.blockingErrors.map(b => b.message).join('; '),
                blockingErrors: matrixDiagnostics.blockingErrors,
                matrixDiagnostics
            });
        }

        const { transitionSample } = require('../services/sampleStateService');
        const updated = await transitionSample(sampleId, 'SUBMITTED_FULL', user, 'Results submitted for manager approval');

        res.json({ success: true, status: 'SUBMITTED_FULL', sample: updated, matrixDiagnostics });
    } catch (error) {
        console.error('[submitForApproval] Error:', error);
        res.status(500).json({ error: 'Failed to submit for approval' });
    }
};
