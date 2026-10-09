const prisma = require('../prisma');
const rounds = require('../services/proficiencyRoundService');
const policyService = require('../services/policyService');

function respondError(res, error, fallback) {
    if (!error.statusCode) console.error('[proficiencyRound] Error:', error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : fallback,
        ...(error.code && { code: error.code }) });
}
async function roundView(req, round) {
    if (!round.legacyScoreFlag) return round;
    const key = round.legacyScoreFlag === 'SIGMA_MISSING' ? 'legacySigmaMissing' : 'legacySigmaNonpositive';
    const locale = ['en', 'es', 'es-419', 'fr', 'pt'].includes(req.locale) ? req.locale : 'en';
    return { ...round, warnings: [{ code: round.legacyScoreFlag,
        message: require(`../locales/${locale}.json`).proficiencyTesting[key] }] };
}

/**
 * Record a new Proficiency Testing (PT) round
 */
exports.recordRound = async (req, res) => {
    try {
        const round = await rounds.record(req.user, req.body, { db: prisma });
        res.status(201).json({ success: true, data: await roundView(req, round) });
    } catch (error) {
        respondError(res, error, 'Failed to record proficiency round');
    }
};

exports.updateRound = async (req, res) => {
    try { res.json({ success: true, data: await roundView(req, await rounds.update(req.user, req.params.id, req.body, { db: prisma })) }); }
    catch (error) { respondError(res, error, 'Failed to update proficiency round'); }
};

/**
 * List / search Proficiency Testing rounds
 */
exports.getRounds = async (req, res) => {
    const { analysisCode, outcome, provider, year } = req.query;

    try {
        const where = rounds.visibleWhere(req.user, req.query);

        if (analysisCode) where.analysisCode = String(analysisCode).trim();
        if (outcome) where.outcome = String(outcome).toUpperCase();
        if (provider) where.provider = { contains: provider };

        if (year) {
            const start = new Date(`${year}-01-01T00:00:00.000Z`);
            const end = new Date(`${year}-12-31T23:59:59.999Z`);
            where.date = { gte: start, lte: end };
        }

        const records = await prisma.proficiencyRound.findMany({
            where,
            orderBy: { date: 'desc' }
        });

        res.json({ success: true, count: records.length, data: await Promise.all(records.map(row => roundView(req, row))) });
    } catch (error) {
        respondError(res, error, 'Failed to fetch proficiency rounds');
    }
};

/**
 * Get Reportable Indicator Summary
 * Required by SoilFER Activity 1.1 / FAO/IAEA PT monitoring
 */
exports.getSummary = async (req, res) => {
    const { year } = req.query;

    try {
        const where = rounds.visibleWhere(req.user, req.query);

        if (year) {
            const start = new Date(`${year}-01-01T00:00:00.000Z`);
            const end = new Date(`${year}-12-31T23:59:59.999Z`);
            where.date = { gte: start, lte: end };
        }

        const records = await prisma.proficiencyRound.findMany({ where });

        // Aggregate by lab
        const byLab = {};
        // Aggregate by analysis
        const byAnalysis = {};

        let satisfactoryCount = 0;
        let questionableCount = 0;
        let unsatisfactoryCount = 0;

        for (const r of records) {
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

        const totalRounds = records.length;
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
        respondError(res, error, 'Failed to fetch proficiency testing summary');
    }
};

/**
 * Delete a PT round
 */
exports.deleteRound = async (req, res) => {
    try {
        const round = await rounds.softDelete(req.user, req.params.id, req.body?.reason, { db: prisma });
        res.json({ success: true, data: await roundView(req, round) });
    } catch (error) {
        respondError(res, error, 'Failed to delete round');
    }
};
