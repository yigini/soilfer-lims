const prisma = require('../prisma');
const validationController = require('./validationController');

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

        const enriched = results.map(r => ({
            ...r,
            paramName: analysisMap[r.param]?.name || r.param,
            decimalPlaces: analysisMap[r.param]?.decimalPlaces ?? 2,
            flags: typeof r.flags === 'string' ? JSON.parse(r.flags) : (r.flags || {})
        }));

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

        if (!['PROCESSING', 'SUBMITTED_PARTIAL', 'ANALYSIS', 'PARTIALLY_COMPLETE'].includes(sample.status)) {
            return res.status(400).json({ error: `Sample is not in Processing phase (current: ${sample.status})` });
        }

        // Validate
        const validatedMeasurements = await validationController.validateBatch(measurements);

        const operations = [];
        const now = new Date();

        // Append-only results with supersession
        for (const m of validatedMeasurements) {
            const strVal = String(m.value).trim();
            const isCensored = m.validation?.isCensored || /^[<>]/.test(strVal);
            const censoringType = isCensored ? (strVal.startsWith('<') ? 'BELOW_LOQ' : 'ABOVE_RANGE') : 'NONE';
            const numericVal = m.validation?.normalizedValue !== undefined ? m.validation.normalizedValue : (isNaN(Number(strVal.replace(',', '.'))) ? null : Number(strVal.replace(',', '.')));

            const newResultId = `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

            // Supersede previous active result
            operations.push(prisma.result.updateMany({
                where: {
                    sampleId,
                    param: m.param,
                    isCurrent: true
                },
                data: {
                    isCurrent: false,
                    supersededBy: newResultId
                }
            }));

            // Create new immutable record
            operations.push(prisma.result.create({
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
                    basis: m.basis || 'AIR_DRY',
                    methodologyId: m.methodologyId || null,
                    replicateNo: 1,
                    isCurrent: true,
                    enteredBy: user ? user.username : 'SYSTEM',
                    analysedAt: now,
                    equipmentId: m.equipmentId || null,
                    batchId: m.batchId || null,
                    createdAt: now,
                    updatedAt: now
                }
            }));
        }

        operations.push(prisma.auditLog.create({
            data: {
                id: `audit-res-up-${Date.now()}`,
                entity: 'RESULTS',
                entityId: sampleId,
                action: 'UPDATE_RESULTS',
                performedBy: user ? user.username : 'SYSTEM',
                timestamp: now,
                details: `Appended ${measurements.length} defensible results`
            }
        }));

        await prisma.$transaction(operations);

        if (sample.status === 'PROCESSING' || sample.status === 'ANALYSIS') {
            const { transitionSample } = require('../services/sampleStateService');
            await transitionSample(sampleId, 'SUBMITTED_PARTIAL', user, 'Partial results saved').catch(() => {});
        }

        // Compute cross-parameter sample matrix diagnostics
        const allActiveResults = await prisma.result.findMany({
            where: { sampleId, isCurrent: true }
        });
        const matrixDiagnostics = validationController.validateSampleMatrix(allActiveResults);

        // Return validation feedback
        res.json({
            success: true,
            validation: validatedMeasurements.map(m => ({ param: m.param, flags: m.validation.flags })),
            matrixDiagnostics
        });

    } catch (error) {
        console.error('[saveResults] Error:', error);
        res.status(500).json({ error: 'Failed to save results' });
    }
};

exports.submitForApproval = async (req, res) => {
    const { sampleId } = req.params;
    const user = req.user;

    try {
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

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
