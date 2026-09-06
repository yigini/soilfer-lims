const prisma = require('../prisma');
const validationController = require('./validationController');
const { validateResultEntries } = require('../services/resultEntryPolicy');

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

        // Lab Isolation Check (S07)
        const scopeGuard = require('../utils/scopeGuard');
        if (user && user.role && !scopeGuard.canAccessEntity(user, sample, { labField: 'labId', altLabField: 'assignedLab' })) {
            return res.status(403).json({ error: 'Access denied: Sample not in your Lab scope' });
        }

        if (!['PROCESSING', 'SUBMITTED_PARTIAL', 'ANALYSIS', 'PARTIALLY_COMPLETE'].includes(sample.status)) {
            return res.status(400).json({ error: `Sample is not in Processing phase (current: ${sample.status})` });
        }

        // SD-05: Enforce prerequisite gate on work execution (HTTP 412 Precondition Failed)
        if (sample.preparationStatus !== 'DONE') {
            return res.status(412).json({ error: 'Sample preparation has not been completed' });
        }
        if (sample.dryingStatus !== 'DONE') {
            return res.status(412).json({ error: 'Sample drying has not been completed' });
        }

        const entryError = await validateResultEntries(prisma, sample, measurements, user);
        if (entryError) return res.status(400).json({ error: entryError });

        // Validate
        const validatedMeasurements = await validationController.validateBatch(measurements);
        if (validatedMeasurements.some(m => m.value == null || String(m.value).trim() === '' || m.validation.flags.includes('INVALID_FORMAT'))) {
            return res.status(400).json({ error: 'Every measurement must contain a valid numeric value or supported censoring qualifier.' });
        }

        const operations = [];
        const now = new Date();

        // Append-only results with supersession
        for (const m of validatedMeasurements) {
            const strVal = String(m.value).trim();
            const isCensored = m.validation?.isCensored || /^[<>]/.test(strVal);
            const censoringType = isCensored ? (strVal.startsWith('<') ? 'BELOW_LOQ' : 'ABOVE_RANGE') : 'NONE';
            const numericVal = m.validation?.normalizedValue !== undefined ? m.validation.normalizedValue : (isNaN(Number(strVal.replace(',', '.'))) ? null : Number(strVal.replace(',', '.')));

            const newResultId = `res-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

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
                    enteredBy: user ? user.username : 'SYSTEM',
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
                id: `audit-res-up-${Date.now()}`,
                entity: 'RESULTS',
                entityId: sampleId,
                action: 'UPDATE_RESULTS',
                performedBy: user ? user.username : 'SYSTEM',
                timestamp: now,
                details: `Appended ${measurements.length} defensible results`
            }
        }));

        await prisma.$transaction(async tx => {
            const current = await tx.sample.findUnique({ where: { id: sampleId } });
            if (!current || current.status !== sample.status || current.dryingStatus !== 'DONE' || current.preparationStatus !== 'DONE') {
                throw Object.assign(new Error('Sample readiness changed. Refresh before saving.'), { statusCode: 409 });
            }
            const conflict = await validateResultEntries(tx, current, measurements, user);
            if (conflict) throw Object.assign(new Error(conflict), { statusCode: 409 });
            for (const operation of operations) await operation(tx);
        });

        if (sample.status === 'PROCESSING' || sample.status === 'ANALYSIS') {
            const { transitionSample } = require('../services/sampleStateService');
            await transitionSample(sampleId, 'SUBMITTED_PARTIAL', user, 'Partial results saved').catch(() => {});
        }

        // Auto-derive USDA Texture Class if all 3 fractions (SAND, SILT, CLAY) are present
        try {
            const curResults = await prisma.result.findMany({
                where: { sampleId, isCurrent: true, param: { in: ['SAND', 'SILT', 'CLAY'] } }
            });
            const sandR = curResults.find(r => r.param === 'SAND');
            const siltR = curResults.find(r => r.param === 'SILT');
            const clayR = curResults.find(r => r.param === 'CLAY');
            if (sandR && siltR && clayR) {
                const { calculateUsdaTexture } = require('../utils/soilCalculations');
                const tex = calculateUsdaTexture(sandR.numericValue ?? sandR.value, siltR.numericValue ?? siltR.value, clayR.numericValue ?? clayR.value);
                if (tex.isValid) {
                    const texResultId = `res-tex-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                    await prisma.result.updateMany({
                        where: { sampleId, param: 'TEXTURE', isCurrent: true },
                        data: { isCurrent: false, supersededBy: texResultId }
                    });
                    await prisma.result.create({
                        data: {
                            id: texResultId,
                            sampleId,
                            param: 'TEXTURE',
                            value: tex.className,
                            numericValue: null,
                            unit: '',
                            isValid: true,
                            censoring: 'NONE',
                            basis: 'AIR_DRY',
                            replicateNo: 1,
                            isCurrent: true,
                            provenance: 'DERIVED',
                            enteredBy: user ? user.username : 'SYSTEM_CALC',
                            analysedAt: now,
                            createdAt: now,
                            updatedAt: now
                        }
                    });
                }
            }
        } catch (texErr) {
            console.error('[saveResults] Auto-derivation of texture failed:', texErr);
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
        if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
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
