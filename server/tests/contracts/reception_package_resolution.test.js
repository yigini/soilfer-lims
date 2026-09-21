const request = require('supertest');
const app = require('../../app');
const { generateToken } = require('../setup');
const { usersDb, samplesDb } = require('../../db');
const prisma = require('../../prisma');
const { resolveAnalysisGroup } = require('../../controllers/receptionController');

describe('Reception Package ID Resolution & Boundary Contracts (Mandatory Correction 1)', () => {
    describe('Unit: resolveAnalysisGroup resolution logic', () => {
        const fixtureGroups = [
            { id: 'a-b', name: 'A Dash B Package', analyses: ['PH_H2O'] },
            { id: 'ab', name: 'AB Combined Package', analyses: ['EC'] },
            { id: 'ROUTINE_SOIL', name: 'Routine Soil Fertility', analyses: ['PH_H2O', 'EC', 'P_OLSEN'] },
            { id: 'SALINITY_BASIC', name: 'Basic Salinity', analyses: ['EC', 'PH_H2O'] }
        ];

        test('Rule 1: Exact canonical ID takes precedence over earlier fuzzy matches', () => {
            // 'a-b' is first in the list, but requesting exact 'ab' MUST resolve to 'ab'
            const resExactAb = resolveAnalysisGroup('ab', fixtureGroups);
            expect(resExactAb.error).toBeUndefined();
            expect(resExactAb.canonicalId).toBe('ab');
            expect(resExactAb.group.name).toBe('AB Combined Package');

            // Requesting exact 'a-b' resolves to 'a-b'
            const resExactDash = resolveAnalysisGroup('a-b', fixtureGroups);
            expect(resExactDash.error).toBeUndefined();
            expect(resExactDash.canonicalId).toBe('a-b');
            expect(resExactDash.group.name).toBe('A Dash B Package');
        });

        test('Rule 2: Case-insensitive match works cleanly when unambiguous', () => {
            const res = resolveAnalysisGroup('routine_soil', fixtureGroups);
            expect(res.error).toBeUndefined();
            expect(res.canonicalId).toBe('ROUTINE_SOIL');

            const resCaps = resolveAnalysisGroup('AB', fixtureGroups);
            expect(resCaps.error).toBeUndefined();
            expect(resCaps.canonicalId).toBe('ab');
        });

        test('Rule 3: Punctuation normalization works cleanly when unambiguous', () => {
            const res = resolveAnalysisGroup('routine-soil', fixtureGroups);
            expect(res.error).toBeUndefined();
            expect(res.canonicalId).toBe('ROUTINE_SOIL');
        });

        test('Rule 4: Ambiguous normalized match fails closed', () => {
            // 'a_b' normalizes to 'ab', which collides with both 'a-b' and 'ab'
            const res = resolveAnalysisGroup('a_b', fixtureGroups);
            expect(res.error).toBe('AMBIGUOUS_PACKAGE_ID');
            expect(res.code).toBe('AMBIGUOUS_PACKAGE_ID');
        });

        test('Rule 5: Non-string and empty IDs fail closed with INVALID_PACKAGE_ID', () => {
            expect(resolveAnalysisGroup(null, fixtureGroups).code).toBe('INVALID_PACKAGE_ID');
            expect(resolveAnalysisGroup(undefined, fixtureGroups).code).toBe('INVALID_PACKAGE_ID');
            expect(resolveAnalysisGroup(12345, fixtureGroups).code).toBe('INVALID_PACKAGE_ID');
            expect(resolveAnalysisGroup('', fixtureGroups).code).toBe('INVALID_PACKAGE_ID');
            expect(resolveAnalysisGroup('   ', fixtureGroups).code).toBe('INVALID_PACKAGE_ID');
            expect(resolveAnalysisGroup({}, fixtureGroups).code).toBe('INVALID_PACKAGE_ID');
            expect(resolveAnalysisGroup([], fixtureGroups).code).toBe('INVALID_PACKAGE_ID');
        });

        test('Rule 6: Unknown package fails closed with PACKAGE_NOT_FOUND', () => {
            const res = resolveAnalysisGroup('NONEXISTENT_PACKAGE_XYZ', fixtureGroups);
            expect(res.error).toBe('PACKAGE_NOT_FOUND');
            expect(res.code).toBe('PACKAGE_NOT_FOUND');
        });
    });

    describe('API: HTTP Boundary Enforcement in sample acceptance', () => {
        let mgrToken;
        let testSampleId;

        beforeAll(async () => {
            const suffix = Date.now();
            const mgr = usersDb.create({ username: `pkg_mgr_${suffix}`, role: 'LAB_MANAGER', labId: 'LAB_PKG_TEST', countries: ['PKG'] });
            mgrToken = generateToken(mgr);

            // Clean any conflicting test packages in DB
            await prisma.analysisGroup.deleteMany({
                where: { id: { in: ['pkg-test-a-b', 'pkg-test-ab'] } }
            });

            // Seed two competing packages for testing collisions: 'pkg-test-a-b' and 'pkg-test-ab'
            await prisma.analysisGroup.createMany({
                data: [
                    { id: 'pkg-test-a-b', name: 'Test Dash Package', labId: null, analyses: JSON.stringify(['PH_H2O']) },
                    { id: 'pkg-test-ab', name: 'Test Combined Package', labId: null, analyses: JSON.stringify(['EC']) }
                ]
            });
        });

        afterAll(async () => {
            await prisma.analysisGroup.deleteMany({
                where: { id: { in: ['pkg-test-a-b', 'pkg-test-ab'] } }
            });
        });

        let testOriginalId;

        beforeEach(async () => {
            const suffix = Math.floor(Math.random() * 100000);
            testOriginalId = `PKG_ORIG_${suffix}`;
            const createRes = await request(app)
                .post('/api/samples/walkin')
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({
                    originalId: testOriginalId,
                    submitter: 'Package Tester',
                    countryCode: 'PKG',
                    analyses: ['PH_H2O']
                });
            testSampleId = createRes.body.sample.id;
        });

        test('Accept with exact second package ID persists canonical ID, not the first collision', async () => {
            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({
                    originalId: testOriginalId,
                    decision: 'ACCEPT',
                    receivedMass: 500,
                    checklist: { labelLegible: true, containerIntact: true, noLeakage: true, massAdequate: true, cocPresent: true },
                    analysisGroupIds: ['pkg-test-ab']
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify sample persisted in database has the exact canonical 'pkg-test-ab', not 'pkg-test-a-b'
            const savedSample = await prisma.sample.findUnique({ where: { id: res.body.id } });
            const savedGroups = JSON.parse(savedSample.analysisGroupIds || '[]');
            expect(savedGroups).toContain('pkg-test-ab');
            expect(savedGroups).not.toContain('pkg-test-a-b');
        });

        test('Accept with non-string package ID returns 400 with INVALID_PACKAGE_ID', async () => {
            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({
                    originalId: testOriginalId,
                    decision: 'ACCEPT',
                    receivedMass: 500,
                    checklist: { labelLegible: true, containerIntact: true, noLeakage: true, massAdequate: true, cocPresent: true },
                    analysisGroupIds: [12345]
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('INVALID_PACKAGE_ID');
        });

        test('Accept with unknown package ID returns 400 with PACKAGE_NOT_FOUND', async () => {
            const res = await request(app)
                .post('/api/reception/intake')
                .set('Authorization', `Bearer ${mgrToken}`)
                .send({
                    originalId: testOriginalId,
                    decision: 'ACCEPT',
                    receivedMass: 500,
                    checklist: { labelLegible: true, containerIntact: true, noLeakage: true, massAdequate: true, cocPresent: true },
                    analysisGroupIds: ['totally-unknown-pack-999']
                });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('PACKAGE_NOT_FOUND');
        });
    });
});
