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

        const results = await prisma.result.findMany({
            where: { sampleId }
        });

        // Enrich with parameter metadata (Name from Analysis)
        // Optimization: Fetch all needed analysis definitions in one go
        const paramCodes = [...new Set(results.map(r => r.param))];
        const analyses = await prisma.analysis.findMany({
            where: { code: { in: paramCodes } },
            select: { code: true, name: true }
        });

        const analysisMap = {};
        analyses.forEach(a => analysisMap[a.code] = a.name);

        const enriched = results.map(r => ({
            ...r,
            paramName: analysisMap[r.param] || r.param,
            flags: typeof r.flags === 'string' ? JSON.parse(r.flags) : (r.flags || {})
        }));

        res.json(enriched);
    } catch (error) {
        console.error('[getResults] Error:', error);
        res.status(500).json({ error: 'Failed to fetch results' });
    }
};

exports.saveResults = async (req, res) => {
    const { sampleId } = req.params;
    const { measurements } = req.body; // Array of { param, value, unit }
    const user = req.user;

    try {
        const sample = await prisma.sample.findUnique({ where: { id: sampleId } });
        if (!sample) return res.status(404).json({ error: 'Sample not found' });

        if (sample.status !== 'ANALYSIS' && sample.status !== 'PARTIALLY_COMPLETE') {
            return res.status(400).json({ error: 'Sample is not in Analysis phase' });
        }

        // Validate
        const validatedMeasurements = await validationController.validateBatch(measurements);

        const operations = [];
        const now = new Date();

        // Upsert results
        for (const m of validatedMeasurements) {
            operations.push(prisma.result.upsert({
                where: {
                    sampleId_param: {
                        sampleId: sampleId,
                        param: m.param
                    }
                },
                update: {
                    value: String(m.value),
                    unit: m.unit,
                    updatedAt: now,
                    flags: JSON.stringify(m.validation.flags || {}),
                    isValid: m.validation.valid
                },
                create: {
                    id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    sampleId: sampleId,
                    param: m.param,
                    value: String(m.value),
                    unit: m.unit,
                    updatedAt: now,
                    flags: JSON.stringify(m.validation.flags || {}),
                    isValid: m.validation.valid
                }
            }));
        }

        // Auto-update status to PARTIALLY_COMPLETE if it was just ANALYSIS
        // Using "updateMany" with where clause to catch race condition if needed, or simple update
        // Logic: If currently ANALYSIS, switch to PARTIALLY_COMPLETE.
        if (sample.status === 'ANALYSIS') {
            operations.push(prisma.sample.update({
                where: { id: sampleId },
                data: { status: 'PARTIALLY_COMPLETE' }
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
                details: `Updated ${measurements.length} results`
            }
        }));

        await prisma.$transaction(operations);

        // Return validation feedback
        res.json({
            success: true,
            validation: validatedMeasurements.map(m => ({ param: m.param, flags: m.validation.flags }))
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
        const resultCount = await prisma.result.count({ where: { sampleId } });
        if (resultCount === 0) {
            return res.status(400).json({ error: 'No results entered' });
        }

        await prisma.sample.update({
            where: { id: sampleId },
            data: { status: 'COMPLETED' }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-res-sub-${Date.now()}`,
                entity: 'SAMPLE',
                entityId: sampleId,
                action: 'SUBMIT_FOR_APPROVAL',
                performedBy: user ? user.username : 'SYSTEM',
                timestamp: new Date(),
                details: 'Sample submitted for approval (Status: COMPLETED)'
            }
        });

        res.json({ success: true, status: 'COMPLETED' });
    } catch (error) {
        console.error('[submitForApproval] Error:', error);
        res.status(500).json({ error: 'Failed to submit for approval' });
    }
};
