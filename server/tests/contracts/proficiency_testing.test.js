const prisma = require('../../prisma');
const { evaluateProficiency, recordRound, getSummary } = require('../../controllers/ptController');

describe('WP-30: Proficiency Testing Model & Reportable Indicators', () => {
    let createdRoundIds = [];
    const testLabId = 'LAB-PT-TEST';

    beforeAll(async () => {
        // Ensure test lab exists
        await prisma.lab.upsert({
            where: { id: testLabId },
            create: { id: testLabId, code: 'PT-TEST', name: 'PT Test Laboratory', country: 'Global' },
            update: {}
        });
    });

    afterAll(async () => {
        if (createdRoundIds.length > 0) {
            await prisma.proficiencyRound.deleteMany({ where: { id: { in: createdRoundIds } } });
        }
        await prisma.lab.delete({ where: { id: testLabId } }).catch(() => {});
    });

    test('1. evaluateProficiency calculates z-score and outcomes per ISO 13528', () => {
        // Assigned: 50.0, std dev: 5.0

        // Lab result: 52.0 -> z = +0.40 -> SATISFACTORY (|z| <= 2)
        const res1 = evaluateProficiency(50.0, 52.0, 5.0);
        expect(res1.zScore).toBe(0.40);
        expect(res1.outcome).toBe('SATISFACTORY');

        // Lab result: 62.0 -> z = +2.40 -> QUESTIONABLE (2 < |z| <= 3)
        const res2 = evaluateProficiency(50.0, 62.0, 5.0);
        expect(res2.zScore).toBe(2.40);
        expect(res2.outcome).toBe('QUESTIONABLE');

        // Lab result: 70.0 -> z = +4.00 -> UNSATISFACTORY (|z| > 3)
        const res3 = evaluateProficiency(50.0, 70.0, 5.0);
        expect(res3.zScore).toBe(4.00);
        expect(res3.outcome).toBe('UNSATISFACTORY');

        // Negative z-score
        const res4 = evaluateProficiency(50.0, 42.0, 5.0);
        expect(res4.zScore).toBe(-1.60);
        expect(res4.outcome).toBe('SATISFACTORY');
    });

    test('2. recordRound creates a proficiency round with calculated z-score and outcome', async () => {
        const req = {
            body: {
                provider: 'GLOSOLAN-RingTrial',
                roundRef: 'GLOSOLAN-2026-SOIL-1',
                labId: testLabId,
                analysisCode: 'PH',
                assignedValue: 6.50,
                uncertainty: 0.25,
                labResult: 6.60,
                date: '2026-06-15',
                notes: 'FAO/IAEA ring trial submission'
            },
            user: { username: 'qa_manager', role: 'SUPER_ADMIN' }
        };
        let responseData = null;
        const res = {
            status: jest.fn().mockReturnThis(),
            json: (d) => { responseData = d; }
        };

        await recordRound(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(responseData).not.toBeNull();
        expect(responseData.success).toBe(true);

        const round = responseData.data;
        createdRoundIds.push(round.id);

        expect(round.assignedValue).toBe(6.50);
        expect(round.labResult).toBe(6.60);
        expect(round.zScore).toBe(0.40);
        expect(round.outcome).toBe('SATISFACTORY');

        const dbRecord = await prisma.proficiencyRound.findUnique({ where: { id: round.id } });
        expect(dbRecord).not.toBeNull();
        expect(dbRecord.roundRef).toBe('GLOSOLAN-2026-SOIL-1');
    });

    test('3. getSummary aggregates reportable indicators per laboratory and analysis', async () => {
        // Record a second round for SOC with questionable outcome
        const req2 = {
            body: {
                provider: 'Wepal',
                roundRef: 'ISE-2026-2',
                labId: testLabId,
                analysisCode: 'SOC',
                assignedValue: 20.0,
                uncertainty: 1.5,
                labResult: 23.5, // z = 2.33 -> QUESTIONABLE
                date: '2026-08-01'
            },
            user: { username: 'qa_manager', role: 'SUPER_ADMIN' }
        };
        const res2 = {
            status: jest.fn().mockReturnThis(),
            json: (d) => { createdRoundIds.push(d.data.id); }
        };
        await recordRound(req2, res2);

        // Fetch summary
        const summaryReq = {
            query: { labId: testLabId },
            user: { username: 'qa_manager', role: 'SUPER_ADMIN' }
        };
        let summaryData = null;
        const summaryRes = {
            json: (d) => { summaryData = d; }
        };

        await getSummary(summaryReq, summaryRes);
        expect(summaryData).not.toBeNull();
        expect(summaryData.totalRounds).toBe(2);
        expect(summaryData.breakdown.satisfactory).toBe(1);
        expect(summaryData.breakdown.questionable).toBe(1);
        expect(summaryData.breakdown.unsatisfactory).toBe(0);
        expect(summaryData.satisfactoryPct).toBe(50.0);

        expect(summaryData.byLab[testLabId]).toBeDefined();
        expect(summaryData.byLab[testLabId].total).toBe(2);

        expect(summaryData.byAnalysis['PH']).toBeDefined();
        expect(summaryData.byAnalysis['PH'].satisfactory).toBe(1);

        expect(summaryData.byAnalysis['SOC']).toBeDefined();
        expect(summaryData.byAnalysis['SOC'].questionable).toBe(1);
    });
});
