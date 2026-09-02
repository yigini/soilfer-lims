const prisma = require('../prisma');
const scopeGuard = require('../utils/scopeGuard');
const { hasPermission } = require('../config/roles');

/**
 * Calculates standard ISO/IEC 17043 & ISO 13528 z-score and outcome.
 * z = (x_lab - x_assigned) / sigma_pt
 * @param {number} assignedValue - Consensus / certified reference value
 * @param {number} labResult - Result reported by the participating laboratory
 * @param {number} uncertainty - Standard deviation for proficiency assessment (sigma_pt) or standard uncertainty
 * @returns {{ zScore: number, outcome: 'SATISFACTORY'|'QUESTIONABLE'|'UNSATISFACTORY' }}
 */
function evaluateProficiency(assignedValue, labResult, uncertainty) {
    const x = Number(labResult);
    const X = Number(assignedValue);
    const sigma = Number(uncertainty && uncertainty > 0 ? uncertainty : 1.0);

    const diff = x - X;
    const z = Number((diff / sigma).toFixed(2));
    const absZ = Math.abs(z);

    let outcome = 'SATISFACTORY';
    if (absZ > 3.0) {
        outcome = 'UNSATISFACTORY';
    } else if (absZ > 2.0) {
        outcome = 'QUESTIONABLE';
    }

    return { zScore: z, outcome };
}

/**
 * Record a new Proficiency Testing (PT) round
 */
exports.recordRound = async (req, res) => {
    const { provider, roundRef, labId, analysisCode, assignedValue, uncertainty, labResult, date, notes } = req.body;
    const user = req.user;

    if (!provider || !roundRef || !analysisCode || assignedValue === undefined || labResult === undefined) {
        return res.status(400).json({ error: 'provider, roundRef, analysisCode, assignedValue, and labResult are required.' });
    }

    // Determine target lab
    const targetLabId = labId || user.labId;
    if (!targetLabId) {
        return res.status(400).json({ error: 'labId is required.' });
    }

    // Lab isolation check: non-super-admins can only record PT for their assigned lab
    if (!scopeGuard.hasGlobalAccess(user) && user.labId && user.labId !== targetLabId) {
        return res.status(403).json({ error: `Access denied: You cannot record PT for lab ${targetLabId}` });
    }

    try {
        const numAssigned = Number(assignedValue);
        const numLab = Number(labResult);
        const numUncertainty = uncertainty !== undefined && uncertainty !== null ? Number(uncertainty) : null;

        if (isNaN(numAssigned) || isNaN(numLab)) {
            return res.status(400).json({ error: 'assignedValue and labResult must be numeric.' });
        }

        const { zScore, outcome } = evaluateProficiency(numAssigned, numLab, numUncertainty);
        const roundId = `PT-${roundRef}-${targetLabId}-${analysisCode}-${Date.now()}`;

        const round = await prisma.proficiencyRound.create({
            data: {
                id: roundId,
                provider: String(provider).trim(),
                roundRef: String(roundRef).trim(),
                labId: targetLabId,
                analysisCode: String(analysisCode).trim().toUpperCase(),
                assignedValue: numAssigned,
                uncertainty: numUncertainty,
                labResult: numLab,
                zScore,
                outcome,
                date: date ? new Date(date) : new Date(),
                notes: notes ? String(notes).trim() : null
            }
        });

        await prisma.auditLog.create({
            data: {
                id: `audit-pt-${Date.now()}`,
                entity: 'PROFICIENCY_ROUND',
                entityId: roundId,
                action: 'RECORD_PT',
                details: `Recorded PT round ${roundRef} for ${analysisCode}: z=${zScore} (${outcome})`,
                performedBy: user.username,
                timestamp: new Date()
            }
        });

        res.status(201).json({ success: true, data: round });
    } catch (error) {
        console.error('[recordRound] Error:', error);
        res.status(500).json({ error: 'Failed to record proficiency round' });
    }
};

/**
 * List / search Proficiency Testing rounds
 */
exports.getRounds = async (req, res) => {
    const { labId, analysisCode, outcome, provider, year } = req.query;
    const user = req.user;

    try {
        let where = {};
        if (!scopeGuard.hasGlobalAccess(user) && user.labId) {
            where.labId = user.labId;
        } else if (labId) {
            where.labId = labId;
        }

        if (analysisCode) where.analysisCode = String(analysisCode).toUpperCase();
        if (outcome) where.outcome = String(outcome).toUpperCase();
        if (provider) where.provider = { contains: provider };

        if (year) {
            const start = new Date(`${year}-01-01T00:00:00.000Z`);
            const end = new Date(`${year}-12-31T23:59:59.999Z`);
            where.date = { gte: start, lte: end };
        }

        const rounds = await prisma.proficiencyRound.findMany({
            where,
            orderBy: { date: 'desc' }
        });

        res.json({ success: true, count: rounds.length, data: rounds });
    } catch (error) {
        console.error('[getRounds] Error:', error);
        res.status(500).json({ error: 'Failed to fetch proficiency rounds' });
    }
};

/**
 * Get Reportable Indicator Summary
 * Required by SoilFER Activity 1.1 / FAO/IAEA PT monitoring
 */
exports.getSummary = async (req, res) => {
    const { labId, year } = req.query;
    const user = req.user;

    try {
        let where = {};
        if (!scopeGuard.hasGlobalAccess(user) && user.labId) {
            where.labId = user.labId;
        } else if (labId) {
            where.labId = labId;
        }

        if (year) {
            const start = new Date(`${year}-01-01T00:00:00.000Z`);
            const end = new Date(`${year}-12-31T23:59:59.999Z`);
            where.date = { gte: start, lte: end };
        }

        const rounds = await prisma.proficiencyRound.findMany({ where });

        // Aggregate by lab
        const byLab = {};
        // Aggregate by analysis
        const byAnalysis = {};

        let satisfactoryCount = 0;
        let questionableCount = 0;
        let unsatisfactoryCount = 0;

        for (const r of rounds) {
            // Lab grouping
            if (!byLab[r.labId]) {
                byLab[r.labId] = { total: 0, satisfactory: 0, questionable: 0, unsatisfactory: 0 };
            }
            byLab[r.labId].total++;
            if (r.outcome === 'SATISFACTORY') byLab[r.labId].satisfactory++;
            else if (r.outcome === 'QUESTIONABLE') byLab[r.labId].questionable++;
            else if (r.outcome === 'UNSATISFACTORY') byLab[r.labId].unsatisfactory++;

            // Analysis grouping
            if (!byAnalysis[r.analysisCode]) {
                byAnalysis[r.analysisCode] = { total: 0, satisfactory: 0, questionable: 0, unsatisfactory: 0 };
            }
            byAnalysis[r.analysisCode].total++;
            if (r.outcome === 'SATISFACTORY') byAnalysis[r.analysisCode].satisfactory++;
            else if (r.outcome === 'QUESTIONABLE') byAnalysis[r.analysisCode].questionable++;
            else if (r.outcome === 'UNSATISFACTORY') byAnalysis[r.analysisCode].unsatisfactory++;

            // Overall
            if (r.outcome === 'SATISFACTORY') satisfactoryCount++;
            else if (r.outcome === 'QUESTIONABLE') questionableCount++;
            else if (r.outcome === 'UNSATISFACTORY') unsatisfactoryCount++;
        }

        const totalRounds = rounds.length;
        const satisfactoryPct = totalRounds > 0 ? Number(((satisfactoryCount / totalRounds) * 100).toFixed(1)) : 0;

        res.json({
            success: true,
            totalRounds,
            satisfactoryPct,
            breakdown: {
                satisfactory: satisfactoryCount,
                questionable: questionableCount,
                unsatisfactory: unsatisfactoryCount
            },
            byLab,
            byAnalysis
        });
    } catch (error) {
        console.error('[getSummary] Error:', error);
        res.status(500).json({ error: 'Failed to fetch proficiency testing summary' });
    }
};

/**
 * Delete a PT round
 */
exports.deleteRound = async (req, res) => {
    const { id } = req.params;
    const user = req.user;

    try {
        if (!hasPermission(user, 'DELETE_SAMPLE') && user.role !== 'LAB_MANAGER') {
            return res.status(403).json({ error: 'Only Lab Managers or Admins can delete PT rounds.' });
        }

        const existing = await prisma.proficiencyRound.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'Round not found' });

        if (!scopeGuard.hasGlobalAccess(user) && user.labId && user.labId !== existing.labId) {
            return res.status(403).json({ error: 'Access denied to this lab record' });
        }

        await prisma.proficiencyRound.delete({ where: { id } });

        res.json({ success: true, message: 'PT round deleted' });
    } catch (error) {
        console.error('[deleteRound] Error:', error);
        res.status(500).json({ error: 'Failed to delete round' });
    }
};

exports.evaluateProficiency = evaluateProficiency;
