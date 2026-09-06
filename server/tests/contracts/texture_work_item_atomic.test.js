const request = require('supertest');
const app = require('../../app');
const { generateToken } = require('../setup');
const prisma = require('../../prisma');
const { normalizeAnalysisCodes } = require('../../controllers/workItemController');

describe('Texture Work Item & Atomic Linked Results Contracts (Mandatory Corrections 3 & 4)', () => {
    let techToken;
    let labId = 'TUN-LAB1';
    let sampleCounter = 1;

    beforeAll(async () => {
        await prisma.user.upsert({
            where: { username: 'tech_tun_1' },
            update: {},
            create: {
                id: 'user-tech-tun-1',
                username: 'tech_tun_1',
                password: 'Password123!',
                name: 'Tech Tunisia 1',
                email: 'tech_tun_1@example.com',
                role: 'LAB_TECHNICIAN',
                labId: 'TUN-LAB1'
            }
        });

        techToken = generateToken({
            id: 'user-tech-tun-1',
            username: 'tech_tun_1',
            role: 'LAB_TECHNICIAN',
            labId: 'TUN-LAB1'
        });
    });

    describe('Unit: normalizeAnalysisCodes & compound expansion', () => {
        test('maps all texture aliases to canonical TEXTURE', () => {
            const aliases = ['TEXTURE', 'pSA', 'PSA', 'Particle Size Analysis', 'SOIL_PSD_TEXTURE', 'SOIL_TEXTURE'];
            for (const alias of aliases) {
                const normalized = normalizeAnalysisCodes([alias]);
                expect(normalized).toEqual(['TEXTURE']);
            }
        });

        test('deduplicates individual fractions (SAND, SILT, CLAY) when TEXTURE is present', () => {
            const mixed = ['TEXTURE', 'SAND', 'SILT', 'CLAY', 'PH_H2O'];
            const normalized = normalizeAnalysisCodes(mixed);
            expect(normalized).toEqual(['TEXTURE', 'PH_H2O']);
        });

        test('preserves individual fractions if TEXTURE is NOT ordered', () => {
            const fractionsOnly = ['SAND', 'CLAY', 'PH_H2O'];
            const normalized = normalizeAnalysisCodes(fractionsOnly);
            expect(normalized).toEqual(['SAND', 'CLAY', 'PH_H2O']);
        });
    });

    describe('HTTP & Workflow: Atomic Texture Workbench Execution', () => {
        let sampleId;
        let workItemId;

        beforeEach(async () => {
            sampleId = `SMP-TEX-ATOM-${Date.now()}-${sampleCounter++}`;
            const uniqueLabId = `LAB-TEX-${Date.now()}-${sampleCounter}`;

            // Create sample with TEXTURE analysis
            await prisma.sample.create({
                data: {
                    id: sampleId,
                    originalId: `ORIG-${sampleId}`,
                    labId: uniqueLabId,
                    assignedLab: 'TUN-LAB1',
                    status: 'PROCESSING',
                    preparationStatus: 'DONE',
                    dryingStatus: 'DONE',
                    requiredAnalyses: JSON.stringify(['TEXTURE'])
                }
            });

            // Create single work item for TEXTURE
            workItemId = `WI-TEX-${Date.now()}-${sampleCounter}`;
            await prisma.workItem.create({
                data: {
                    id: workItemId,
                    sampleId,
                    labId: 'TUN-LAB1',
                    assignedLab: 'TUN-LAB1',
                    analysis: 'TEXTURE',
                    status: 'IN_PROGRESS',
                    assignedTo: 'tech_tun_1'
                }
            });
        });

        afterEach(async () => {
            try {
                await prisma.workAttempt.deleteMany({ where: { workItemId } });
                await prisma.workItemDraft.deleteMany({ where: { workItemId } });
                await prisma.result.deleteMany({ where: { sampleId } });
                await prisma.workItem.deleteMany({ where: { sampleId } });
                await prisma.sample.deleteMany({ where: { id: sampleId } });
            } catch (e) {
                // cleanup best-effort
            }
        });

        test('Draft saving: persists { sand, silt, clay } object without skipping', async () => {
            const draftPayload = {
                draft: true,
                entries: [
                    {
                        workItemId,
                        values: { sand: 50.0, silt: 35.0, clay: 15.0 },
                        methodologyId: null
                    }
                ]
            };

            const res = await request(app)
                .post('/api/workbench/batch-save')
                .set('Authorization', `Bearer ${techToken}`)
                .send(draftPayload);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.saved).toBe(1);

            // Verify draft in database
            const savedDraft = await prisma.workItemDraft.findUnique({
                where: { workItemId }
            });
            expect(savedDraft).not.toBeNull();
            const parsedValues = JSON.parse(savedDraft.values);
            expect(parsedValues.sand).toBe(50.0);
            expect(parsedValues.silt).toBe(35.0);
            expect(parsedValues.clay).toBe(15.0);
        });

        test('Queue reload contract: GET /api/workbench/queue returns parsed { sand, silt, clay } without positional array dependency', async () => {
            // Save draft with named fractions
            await request(app)
                .post('/api/workbench/batch-save')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    draft: true,
                    entries: [
                        {
                            workItemId,
                            values: { sand: 45.0, silt: 35.0, clay: 20.0 }
                        }
                    ]
                });

            // Fetch queue
            const queueRes = await request(app)
                .get('/api/workbench/queue')
                .set('Authorization', `Bearer ${techToken}`);

            expect(queueRes.statusCode).toBe(200);
            const texGroup = queueRes.body.groups.find(g => g.analysis === 'TEXTURE' || g.analysisCode === 'TEXTURE');
            expect(texGroup).toBeDefined();
            const item = texGroup.items.find(i => i.workItemId === workItemId);
            expect(item).toBeDefined();
            expect(item.draft).toBeDefined();
            expect(item.draft.values).toEqual({ sand: 45.0, silt: 35.0, clay: 20.0 });
            expect(Array.isArray(item.draft.values)).toBe(false);
            expect(item.draft.values.sand).toBe(45.0);
            expect(item.draft.values.silt).toBe(35.0);
            expect(item.draft.values.clay).toBe(20.0);
        });

        test('Preview completion: fails closed if fractions are missing or closure exceeds tolerance', async () => {
            // Missing silt and clay
            const incompleteRes = await request(app)
                .post('/api/workbench/v2/completion/preview')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    entries: [
                        {
                            workItemId,
                            values: { sand: 50.0 }
                        }
                    ]
                });

            expect(incompleteRes.statusCode).toBe(200);
            expect(incompleteRes.body.blockedCount).toBe(1);
            expect(incompleteRes.body.excluded[0].blockers).toContain('INCOMPLETE_FRACTIONS');

            // Gross non-closure (50 + 30 + 10 = 90%)
            const closureRes = await request(app)
                .post('/api/workbench/v2/completion/preview')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    entries: [
                        {
                            workItemId,
                            values: { sand: 50.0, silt: 30.0, clay: 10.0 }
                        }
                    ]
                });

            expect(closureRes.statusCode).toBe(200);
            expect(closureRes.body.blockedCount).toBe(1);
            expect(closureRes.body.excluded[0].blockers).toContain('TEXTURE_CLOSURE_FAILED');
        });

        test('Batch completion: rejects direct commit without fractions', async () => {
            const res = await request(app)
                .post('/api/workbench/batch-save')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    draft: false,
                    entries: [
                        {
                            workItemId,
                            value: 'Sandy Clay' // Attempted plain scalar
                        }
                    ]
                });

            expect([200, 422]).toContain(res.statusCode);
            expect(res.body.saved).toBe(0);
            expect(res.body.errors[0].code).toBe('INCOMPLETE_FRACTIONS');
        });

        test('Batch completion: atomically writes 4 linked results and WorkAttempt on valid fractions', async () => {
            const res = await request(app)
                .post('/api/workbench/batch-save')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    draft: false,
                    entries: [
                        {
                            workItemId,
                            values: { sand: 50.0, silt: 35.0, clay: 15.0 },
                            temperatureC: 22.5,
                            humidityPct: 55.0
                        }
                    ]
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.saved).toBe(1);

            // Verify results in database: 4 current results (SAND, SILT, CLAY, TEXTURE)
            const results = await prisma.result.findMany({
                where: { sampleId, isCurrent: true },
                orderBy: { param: 'asc' }
            });

            expect(results.length).toBe(4);
            const sandR = results.find(r => r.param === 'SAND');
            const siltR = results.find(r => r.param === 'SILT');
            const clayR = results.find(r => r.param === 'CLAY');
            const texR = results.find(r => r.param === 'TEXTURE');

            expect(sandR).toBeDefined();
            expect(sandR.provenance).toBe('MEASURED');
            expect(sandR.numericValue).toBe(50.0);

            expect(siltR).toBeDefined();
            expect(siltR.provenance).toBe('MEASURED');
            expect(siltR.numericValue).toBe(35.0);

            expect(clayR).toBeDefined();
            expect(clayR.provenance).toBe('MEASURED');
            expect(clayR.numericValue).toBe(15.0);

            expect(texR).toBeDefined();
            expect(texR.provenance).toBe('DERIVED');
            expect(texR.value).toBe('Loam');

            // Verify WorkAttempt audit record
            const attempt = await prisma.workAttempt.findFirst({
                where: { workItemId }
            });
            expect(attempt).not.toBeNull();
            expect(attempt.attemptNo).toBe(1);
            const ev = JSON.parse(attempt.evidenceData);
            expect(ev.fractions.sand).toBe(50.0);
            expect(ev.className).toBe('Loam');
            expect(ev.sourceResultIds.length).toBe(4);

            // Verify work item is marked COMPLETED
            const updatedItem = await prisma.workItem.findUnique({
                where: { id: workItemId }
            });
            expect(updatedItem.status).toBe('COMPLETED');
            expect(updatedItem.result).toBe('Loam');
        });
    });
});
