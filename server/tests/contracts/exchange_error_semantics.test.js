const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const crypto = require('crypto');
const exchangePolicyService = require('../../services/exchangePolicyService');
const exchangeStateService = require('../../services/exchangeStateService');

describe('Issue #140 Work Package A0: Exchange Eligibility 503 Semantics & Invariants', () => {
    let testKey;
    let rawKey;
    let sampleApproved;
    let sampleProcessing;
    let sampleHold;
    const timestamp = Date.now();

    beforeAll(async () => {
        exchangeStateService.getDb();
        // 1. Create test samples
        sampleApproved = await createSampleFixture(prisma, {
            data: {
                id: `a0-sample-approved-${timestamp}`,
                originalId: `ORIG-A0-APP-${timestamp}`,
                labId: `LAB-A0-APP-${timestamp}`,
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'APPROVED',
                depthTopCm: 0,
                depthBottomCm: 20,
                latitude: 14.5,
                longitude: -90.5
            }
        });
        // Pin6060286651: explicit accepted owners and one final attempt per original row.
        await createWorkItemFixture(prisma, { data: { id: `${sampleApproved.id}-PH_H2O`, sampleId: sampleApproved.id,
            analysis: 'PH_H2O', assignedLab: sampleApproved.assignedLab, status: 'ACCEPTED' } });
        for (const data of [
                        {
                            id: `res-a0-1-${timestamp}`,
                            param: 'PH_H2O',
                            value: '6.5',
                            numericValue: 6.5,
                            unit: 'pH_units',
                            isCurrent: true,
                            provenance: 'MEASURED'
                        }
                    ].map(result => ({ ...result, sampleId: sampleApproved.id }))) await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED', data });

        sampleProcessing = await createSampleFixture(prisma, {
            data: {
                id: `a0-sample-proc-${timestamp}`,
                originalId: `ORIG-A0-PROC-${timestamp}`,
                labId: `LAB-A0-PROC-${timestamp}`,
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'PROCESSING',
                depthTopCm: 0,
                depthBottomCm: 20
            }
        });

        sampleHold = await createSampleFixture(prisma, {
            data: {
                id: `a0-sample-hold-${timestamp}`,
                originalId: `ORIG-A0-HOLD-${timestamp}`,
                labId: `LAB-A0-HOLD-${timestamp}`,
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'ON_HOLD',
                metadata: JSON.stringify({
                    provenanceHold: {
                        status: 'AMBIGUOUS_PROVENANCE_HOLD',
                        reason: 'Conflicting field submissions'
                    }
                })
            }
        });

        // 2. Create test API Key with full capabilities
        rawKey = `slims_live_a0_${timestamp}`;
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        testKey = await prisma.apiKey.create({
            data: {
                id: `key-a0-${timestamp}`,
                name: 'A0 Test Consumer Key',
                keyHash,
                keyPrefix: rawKey.slice(0, 12),
                role: 'NSIS_CONSUMER',
                labs: JSON.stringify(['GTM-LAB1']),
                countries: JSON.stringify(['GTM']),
                projects: JSON.stringify(['SOILFER-GTM']),
                capabilities: JSON.stringify(['SPATIAL', 'SPECTRAL', 'SNAPSHOT', 'RECEIPT']),
                isActive: true
            }
        });

        const connId = `conn_a0_${timestamp}`;
        await prisma.apiKey.update({ where: { id: testKey.id }, data: { connectionId: connId } });
        const { getDb } = require('../../services/exchangeStateService');
        const db = getDb();
        db.prepare(`
            INSERT INTO _exchange_connections (id, name, capabilities, countries, projects, labs, auth_version, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, 'ACTIVE', datetime('now'), datetime('now'))
        `).run(
            connId,
            testKey.name,
            testKey.capabilities,
            testKey.countries,
            testKey.projects,
            testKey.labs
        );
        db.prepare(`
            INSERT INTO _exchange_connection_keys (id, connection_id, api_key_id, key_status, created_at)
            VALUES (?, ?, ?, 'ACTIVE', datetime('now'))
        `).run(`link_a0_${timestamp}`, connId, testKey.id);
    });

    // Pin6060286651: retain analytical and scope parents until whole-owned-DB teardown.

    describe('E07-min: Unforgeable Request Correlation & Headers', () => {
        test('Generates server-assigned X-Request-Id prefixed with xchg_ even before authentication', async () => {
            const res = await request(app).get('/api/v2/data-exchange/samples'); // no auth header

            expect(res.status).toBe(401);
            expect(res.headers['x-request-id']).toBeDefined();
            expect(res.headers['x-request-id']).toMatch(/^xchg_[0-9a-f]{16}$/);
            expect(res.body.requestId).toBe(res.headers['x-request-id']);
        });

        test('Preserves client correlation ID format or overwrites with unforgeable server ID', async () => {
            const res = await request(app)
                .get('/api/v2/data-exchange/capabilities')
                .set('X-Request-Id', 'client-forged-id');

            expect(res.status).toBe(200);
            expect(res.headers['x-request-id']).toMatch(/^xchg_[0-9a-f]{16}$/);
        });
    });

    describe('E02 & E05: Baseline Publication Invariants & Genuine Empty', () => {
        test('Returns 200 OK with eligible approved sample and excludes processing & held samples', async () => {
            const res = await request(app)
                .get('/api/v2/data-exchange/samples')
                .set('X-API-Key', rawKey);

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('success');
            const items = res.body.data;
            const ids = items.map(s => s.id || s.specimenId);
            expect(ids).toContain(sampleApproved.id);
            expect(ids).not.toContain(sampleProcessing.id);
            expect(ids).not.toContain(sampleHold.id);
        });

        test('E02: Genuine empty query returns 200 OK with empty array (never 503)', async () => {
            const v2Res = await request(app)
                .get('/api/v2/data-exchange/samples?country=NON_EXISTENT_COUNTRY')
                .set('X-API-Key', rawKey);

            expect(v2Res.status).toBe(200);
            expect(v2Res.body.status).toBe('success');
            expect(v2Res.body.data).toEqual([]);
            expect(v2Res.body.total).toBe(0);

            const v1Res = await request(app)
                .get('/api/v1/data-exchange/samples?country=NON_EXISTENT_COUNTRY')
                .set('X-API-Key', rawKey);

            expect(v1Res.status).toBe(200);
            expect(v1Res.body.status).toBe('success');
            expect(v1Res.body.data).toEqual([]);
            expect(v1Res.body.meta.total).toBe(0);
        });
    });

    describe('E03: Single Policy Resolution & Total Coherence', () => {
        test('buildSampleWhere is called once per getSamples request, avoiding duplicate hold scans', async () => {
            const spy = jest.spyOn(exchangePolicyService, 'buildSampleWhere');
            const res = await request(app)
                .get('/api/v2/data-exchange/samples?limit=1')
                .set('X-API-Key', rawKey);

            expect(res.status).toBe(200);
            expect(spy).toHaveBeenCalledTimes(1);
            spy.mockRestore();
        });
    });

    describe('E01: Fail-Closed HTTP 503 Error Semantics Across All 4 Aliases & Endpoints', () => {
        let holdSpy;

        beforeEach(() => {
            holdSpy = jest.spyOn(exchangePolicyService, 'getHeldSampleIds').mockImplementation(() => {
                throw new Error('SQLITE_BUSY: /srv/private/lab.db; SELECT secret FROM Sample; token=private-fixture');
            });
        });

        afterEach(() => {
            if (holdSpy) holdSpy.mockRestore();
        });

        test('1. All 4 exchange aliases fail-closed with 503, Retry-After: 5, and X-Request-Id on /samples', async () => {
            const aliases = [
                '/api/v1/data-exchange/samples',
                '/api/v1/sis/samples',
                '/api/v2/data-exchange/samples',
                '/api/v2/sis/samples'
            ];

            for (const endpoint of aliases) {
                const res = await request(app)
                    .get(endpoint)
                    .set('X-API-Key', rawKey);

                expect(res.status).toBe(503);
                expect(res.headers['retry-after']).toBe('5');
                expect(res.headers['x-request-id']).toMatch(/^xchg_[0-9a-f]{16}$/);
                expect(res.body).toEqual({
                    error: 'Service Unavailable',
                    code: 'EXCHANGE_ELIGIBILITY_UNAVAILABLE',
                    message: 'Exchange publication eligibility evaluation is temporarily unavailable.',
                    retryAfter: 5,
                    requestId: res.headers['x-request-id']
                });
                expect(JSON.stringify(res.body)).not.toMatch(/private|SQLITE|SELECT|token=/);
            }
        });

        test('2. Single sample detail endpoints fail-closed with 503', async () => {
            const v1Res = await request(app)
                .get(`/api/v1/data-exchange/samples/${sampleApproved.id}`)
                .set('X-API-Key', rawKey);

            expect(v1Res.status).toBe(503);
            expect(v1Res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
            expect(v1Res.headers['retry-after']).toBe('5');

            const v2Res = await request(app)
                .get(`/api/v2/data-exchange/samples/${sampleApproved.id}`)
                .set('X-API-Key', rawKey);

            expect(v2Res.status).toBe(503);
            expect(v2Res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
            expect(v2Res.headers['retry-after']).toBe('5');
        });

        test('3. GeoJSON endpoints fail-closed with 503', async () => {
            const v1Res = await request(app)
                .get('/api/v1/data-exchange/geojson')
                .set('X-API-Key', rawKey);

            expect(v1Res.status).toBe(503);
            expect(v1Res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');

            const v2Res = await request(app)
                .get('/api/v2/data-exchange/geojson')
                .set('X-API-Key', rawKey);

            expect(v2Res.status).toBe(503);
            expect(v2Res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
        });

        test('4. V1 Results matrix fails-closed with 503', async () => {
            const res = await request(app)
                .get('/api/v1/data-exchange/results')
                .set('X-API-Key', rawKey);

            expect(res.status).toBe(503);
            expect(res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
        });

        test('5. V2 Observations endpoint fails-closed with 503', async () => {
            const res = await request(app)
                .get('/api/v2/data-exchange/observations')
                .set('X-API-Key', rawKey);

            expect(res.status).toBe(503);
            expect(res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
        });

        test('6. Spectra endpoints fail-closed with 503', async () => {
            const v1Res = await request(app)
                .get('/api/v1/data-exchange/spectra')
                .set('X-API-Key', rawKey);

            expect(v1Res.status).toBe(503);
            expect(v1Res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');

            const v2Res = await request(app)
                .get('/api/v2/data-exchange/spectra')
                .set('X-API-Key', rawKey);

            expect(v2Res.status).toBe(503);
            expect(v2Res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
        });

        test('7. V1 Sync endpoint fails-closed with 503', async () => {
            const res = await request(app)
                .get('/api/v1/data-exchange/sync?updatedSince=2026-01-01T00:00:00Z')
                .set('X-API-Key', rawKey);

            expect(res.status).toBe(503);
            expect(res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
        });

        test('8. Stats endpoints fail-closed with 503', async () => {
            const v1Res = await request(app)
                .get('/api/v1/data-exchange/stats')
                .set('X-API-Key', rawKey);

            expect(v1Res.status).toBe(503);
            expect(v1Res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');

            const v2Res = await request(app)
                .get('/api/v2/data-exchange/stats')
                .set('X-API-Key', rawKey);

            expect(v2Res.status).toBe(503);
            expect(v2Res.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
        });

        test('9. Snapshot and changes error routing through handleExchangeError with 503', async () => {
            const { ExchangeEligibilityUnavailableError } = exchangePolicyService;
            const snapSpy = jest.spyOn(exchangeStateService, 'createSnapshot').mockImplementationOnce(() => {
                throw new ExchangeEligibilityUnavailableError('Simulated snapshot eligibility failure');
            });

            const snapRes = await request(app)
                .post('/api/v2/data-exchange/snapshots')
                .set('X-API-Key', rawKey)
                .send({ label: 'test-failing-snapshot' });

            expect(snapRes.status).toBe(503);
            expect(snapRes.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
            expect(snapRes.headers['retry-after']).toBe('5');
            expect(snapRes.headers['x-request-id']).toMatch(/^xchg_[0-9a-f]{16}$/);
            snapSpy.mockRestore();

            const changeSpy = jest.spyOn(exchangeStateService, 'getChanges').mockImplementationOnce(() => {
                throw new ExchangeEligibilityUnavailableError('Simulated changes eligibility failure');
            });

            const changeRes = await request(app)
                .get('/api/v2/data-exchange/changes')
                .set('X-API-Key', rawKey);

            expect(changeRes.status).toBe(503);
            expect(changeRes.body.code).toBe('EXCHANGE_ELIGIBILITY_UNAVAILABLE');
            expect(changeRes.headers['retry-after']).toBe('5');
            expect(changeRes.headers['x-request-id']).toMatch(/^xchg_[0-9a-f]{16}$/);
            changeSpy.mockRestore();
        });
    });

    describe('Client Error (4xx) Preservation', () => {
        test('Preserves 400 Bad Request on invalid parameter without converting to 503', async () => {
            const res = await request(app)
                .get('/api/v1/data-exchange/sync') // missing required updatedSince
                .set('X-API-Key', rawKey);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Bad Request');
        });

        test('Preserves 404 Not Found on non-existent specimen without converting to 503', async () => {
            const res = await request(app)
                .get('/api/v2/data-exchange/samples/NON_EXISTENT_SPECIMEN_ID')
                .set('X-API-Key', rawKey);

            expect(res.status).toBe(404);
        });

        test('Preserves 401 Unauthorized on invalid API key token', async () => {
            const res = await request(app)
                .get('/api/v2/data-exchange/samples')
                .set('X-API-Key', 'slims_invalid_token');

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Unauthorized');
            expect(res.headers['x-request-id']).toMatch(/^xchg_[0-9a-f]{16}$/);
        });
    });
});
