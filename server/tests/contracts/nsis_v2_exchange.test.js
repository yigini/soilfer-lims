const { createExecutionResultFixture } = require('../helpers/workAttemptFixtures');
const { createSampleFixture, createWorkItemFixture } = require('../helpers/workflowFixtures');
const request = require('supertest');
const app = require('../../app');
const prisma = require('../../prisma');
const crypto = require('crypto');

describe('Issue #140 Work Packages P3 & P4: V2 Data Exchange API Contracts', () => {
    let testKey;
    let sample1;
    let sample2NoLabId;
    let snapshotId;
    let highWaterSequence;

    beforeAll(async () => {
        // Install the publication journal before creating released fixtures.
        require('../../services/exchangeStateService').getDb();
        const timestamp = Date.now();

        // 1. Sample with full lab accession and 2 replicate results
        sample1 = await createSampleFixture(prisma, {
            data: {
                id: `v2-specimen-1-${timestamp}`,
                originalId: `FIELD-V2-001-${timestamp}`,
                labId: `LAB-2026-V2-001-${timestamp}`,
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'APPROVED',
                depthTopCm: 0,
                depthBottomCm: 15.5,
                horizon: 'Ap',
                latitude: 14.6349,
                longitude: -90.5069,
                elevation: 1500,
                fieldMetadata: JSON.stringify({
                    site_id: { value: 'PLOT-ALPHA' },
                    collectionDate: '2026-04-10',
                    collector: 'Dr. Maria Perez'
                })
            }
        });
        // Pin6060286651: explicit accepted owners and one final attempt per original row.
        await createWorkItemFixture(prisma, { data: { id: `${sample1.id}-PH_H2O`, sampleId: sample1.id,
            analysis: 'PH_H2O', assignedLab: sample1.assignedLab, status: 'ACCEPTED' } });
        for (const data of [
                        {
                            id: `res-v2-1-${timestamp}`,
                            param: 'PH_H2O',
                            value: '6.4',
                            numericValue: 6.4,
                            unit: 'pH_units',
                            replicateNo: 1,
                            basis: 'AIR_DRY',
                            censoring: 'NONE',
                            isCurrent: true
                        },
                        {
                            id: `res-v2-2-${timestamp}`,
                            param: 'PH_H2O',
                            value: '6.5',
                            numericValue: 6.5,
                            unit: 'pH_units',
                            replicateNo: 2,
                            basis: 'AIR_DRY',
                            censoring: 'NONE',
                            isCurrent: true
                        }
                    ].map(result => ({ ...result, sampleId: sample1.id }))) await createExecutionResultFixture(prisma, { attemptStatus: 'ACCEPTED', data });
        const attempts = await prisma.workAttempt.findMany({ where: { workItemId: `${sample1.id}-PH_H2O` }, orderBy: { attemptNo: 'asc' } });
        expect(attempts).toHaveLength(2);
        expect(attempts.map(attempt => attempt.attemptNo)).toEqual([1, 2]);
        const results = await prisma.result.findMany({ where: { sampleId: sample1.id }, orderBy: { replicateNo: 'asc' } });
        expect(results.map(result => result.attemptId)).toEqual(attempts.map(attempt => attempt.id));
        expect(results.map(result => ({ value: result.value, replicateNo: result.replicateNo })))
            .toEqual([{ value: '6.4', replicateNo: 1 }, { value: '6.5', replicateNo: 2 }]);

        // 2. Approved sample WITHOUT labId (walk-in or field registry without lab accession)
        sample2NoLabId = await createSampleFixture(prisma, {
            data: {
                id: `v2-specimen-2-${timestamp}`,
                originalId: `FIELD-V2-002-${timestamp}`,
                labId: null, // No lab accession
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'APPROVED',
                depthTopCm: 15.5,
                depthBottomCm: 30.0,
                latitude: 14.6500,
                longitude: -90.5200,
                fieldMetadata: JSON.stringify({
                    site_id: 'PLOT-ALPHA',
                    collectionDate: '2026-04-10'
                })
            }
        });

        // API Key with access to GTM-LAB1
        const rawKey = `slims_live_v2_${timestamp}`;
        const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
        testKey = await prisma.apiKey.create({
            data: {
                id: `key-v2-${timestamp}`,
                name: 'V2 Test Pipeline',
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
        const connId = `conn_${testKey.id}`;
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
        `).run(`conn_key_${timestamp}`, connId, testKey.id);
        testKey.rawKey = rawKey;
    });

    // Pin6060286651: retain analytical and scope parents until whole-owned-DB teardown.

    test('1. GET /api/v2/data-exchange/capabilities advertises supported contracts & features', async () => {
        const res = await request(app)
            .get('/api/v2/data-exchange/capabilities')
            .set('X-API-Key', testKey.rawKey);

        expect(res.status).toBe(200);
        expect(res.body.contractVersion).toBe('2.0.0');
        expect(res.body.schemaVersion).toBe('2026-09-issue140-v2');
        expect(res.body.supportedProfiles).toContain('opennsis');
        expect(res.body.features.losslessObservations).toBe(true);
        expect(res.body.features.resumableSnapshots).toBe(true);

        // Verify legacy alias /api/v2/sis/capabilities
        const aliasRes = await request(app)
            .get('/api/v2/sis/capabilities')
            .set('X-API-Key', testKey.rawKey);
        expect(aliasRes.status).toBe(200);
        expect(aliasRes.body.contractVersion).toBe('2.0.0');
    });

    test('2. GET /api/v2/data-exchange/samples returns structured V2 envelope and items', async () => {
        const res = await request(app)
            .get('/api/v2/data-exchange/samples')
            .set('X-API-Key', testKey.rawKey);

        expect(res.status).toBe(200);
        expect(res.body.schemaVersion).toBe('2026-09-issue140-v2');
        expect(res.body.count).toBeGreaterThanOrEqual(2);

        const found = res.body.data.find(s => s.specimenId === sample1.id);
        expect(found).toBeDefined();
        expect(found.fieldSampleId).toBe(sample1.originalId);
        expect(found.labSampleId).toBe(sample1.labId);
        expect(found.profile.code).toBe('PLOT-ALPHA');
        expect(found.profile.namespace).toBe('SOILFER-GTM');
        expect(found.profile.key).toBe('SOILFER-GTM:PLOT-ALPHA');
        expect(found.sampling.depths.topCm).toBe(0);
        expect(found.sampling.depths.bottomCm).toBe(15.5);
        expect(found.sampling.depths.horizon).toBe('Ap');
        expect(found.sampling.location.coordinates).toEqual([-90.5069, 14.6349]); // [lng, lat]
    });

    test('3. Strict OpenNSIS Profile (?profile=opennsis) excludes specimens missing lab accession', async () => {
        const res = await request(app)
            .get('/api/v2/data-exchange/samples?profile=opennsis')
            .set('X-API-Key', testKey.rawKey);

        expect(res.status).toBe(200);
        const specimenIds = res.body.data.map(s => s.specimenId);

        // Sample 1 (has labId) is included
        expect(specimenIds).toContain(sample1.id);

        // Sample 2 (labId is null) is strictly excluded under OpenNSIS profile
        expect(specimenIds).not.toContain(sample2NoLabId.id);
    });

    test('4. GET /api/v2/data-exchange/observations preserves all replicate determinations', async () => {
        const res = await request(app)
            .get(`/api/v2/data-exchange/observations?param=PH_H2O`)
            .set('X-API-Key', testKey.rawKey);

        expect(res.status).toBe(200);
        expect(res.body.schemaVersion).toBe('2026-09-issue140-v2');

        const sample1Obs = res.body.data.filter(o => o.specimenId === sample1.id);
        expect(sample1Obs).toHaveLength(2); // Both replicates present!

        const rep1 = sample1Obs.find(o => o.replicateNo === 1);
        const rep2 = sample1Obs.find(o => o.replicateNo === 2);
        expect(rep1.asMeasured.value).toBe(6.4);
        expect(rep2.asMeasured.value).toBe(6.5);
    });

    test('5. GET /api/v2/data-exchange/geojson complies with RFC 7946 (no obsolete crs member)', async () => {
        const res = await request(app)
            .get('/api/v2/data-exchange/geojson')
            .set('X-API-Key', testKey.rawKey);

        expect(res.status).toBe(200);
        expect(res.body.type).toBe('FeatureCollection');
        expect(res.body.crs).toBeUndefined(); // RFC 7946 Section 4 removes CRS

        const feature = res.body.features.find(f => f.id === sample1.id);
        expect(feature).toBeDefined();
        expect(feature.geometry.coordinates).toEqual([-90.5069, 14.6349]); // [lng, lat]
        expect(feature.properties.specimenId).toBe(sample1.id);
        expect(feature.properties.profile.code).toBe('PLOT-ALPHA');
    });

    test('6. POST /api/v2/data-exchange/snapshots creates bounded snapshot and reads pages', async () => {
        // Create Snapshot
        const createRes = await request(app)
            .post('/api/v2/data-exchange/snapshots')
            .set('X-API-Key', testKey.rawKey)
            .send({ ttlHours: 24 });

        expect(createRes.status).toBe(201);
        expect(createRes.body.snapshotId).toBeDefined();
        expect(createRes.body.totalSamples).toBeGreaterThanOrEqual(2);
        expect(createRes.body.highWaterSequence).toBeDefined();
        expect(createRes.body.nextCursor).toBeDefined();
        snapshotId = createRes.body.snapshotId;
        highWaterSequence = createRes.body.highWaterSequence;

        // Read Snapshot Pages
        const pageRes = await request(app)
            .get(`/api/v2/data-exchange/snapshots/${snapshotId}/pages?limit=10`)
            .set('X-API-Key', testKey.rawKey);

        expect(pageRes.status).toBe(200);
        expect(pageRes.body.snapshotId).toBe(snapshotId);
        expect(pageRes.body.count).toBeGreaterThanOrEqual(2);
    });

    test('7. Continuous synchronization change feed returns changes with cursor', async () => {
        const res = await request(app)
            .get('/api/v2/data-exchange/changes?limit=10')
            .set('X-API-Key', testKey.rawKey);

        expect(res.status).toBe(200);
        expect(res.body.changes).toBeDefined();
        expect(res.body.nextCursor).toBeDefined();
        expect(res.body.count).toBeGreaterThanOrEqual(2);

        // Test invalid cursor returns 410 CURSOR_EXPIRED
        const invalidRes = await request(app)
            .get('/api/v2/data-exchange/changes?cursor=invalid-non-base64')
            .set('X-API-Key', testKey.rawKey);

        expect(invalidRes.status).toBe(410);
        expect(invalidRes.body.code).toBe('CURSOR_EXPIRED');
    });

    test('8. POST /api/v2/data-exchange/receipts logs delivery receipt without mutating DB samples', async () => {
        const receiptPayload = {
            snapshotId,
            batchId: snapshotId,
            importedCount: 1,
            quarantinedCount: 1,
            checkpoint: `seq_${highWaterSequence || 1}`,
            errors: [{ specimenId: sample2NoLabId.id, reason: 'MISSING_LAB_ACCESSION' }]
        };

        const res = await request(app)
            .post('/api/v2/data-exchange/receipts')
            .set('X-API-Key', testKey.rawKey)
            .send(receiptPayload);

        expect(res.status).toBe(200);
        expect(res.body.receipt.receiptId).toBeDefined();
        expect(res.body.receipt.status).toBe('ACKNOWLEDGED');

        // Exact retry is idempotent
        const retryExact = await request(app)
            .post('/api/v2/data-exchange/receipts')
            .set('X-API-Key', testKey.rawKey)
            .send(receiptPayload);
        expect(retryExact.status).toBe(200);
        expect(retryExact.body.receipt.idempotent).toBe(true);

        // Conflicting retry with different counts returns 409 RECEIPT_CONFLICT
        const retryConflict = await request(app)
            .post('/api/v2/data-exchange/receipts')
            .set('X-API-Key', testKey.rawKey)
            .send({ ...receiptPayload, importedCount: 0 });
        expect(retryConflict.status).toBe(409);
        expect(retryConflict.body.code).toBe('RECEIPT_CONFLICT');

        // Confirm sample records were NOT mutated
        const checkSample = await prisma.sample.findUnique({
            where: { id: sample1.id }
        });
        expect(checkSample.status).toBe('APPROVED');
    });

    test('9. GET /api/v2/data-exchange/geojson keyset seek and cachedTotal pagination contract', async () => {
        const timestamp = Date.now();
        const p1 = await createSampleFixture(prisma, {
            data: {
                id: `seek-t1-${timestamp}`,
                originalId: `FIELD-S1-${timestamp}`,
                labId: `LAB-S1-${timestamp}`,
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'APPROVED',
                approvedAt: new Date(),
                updatedAt: new Date('2032-01-01T00:00:00.500Z'),
                latitude: 14.6300,
                longitude: -90.5000
            }
        });

        const p2 = await createSampleFixture(prisma, {
            data: {
                id: `seek-t2-${timestamp}`,
                originalId: `FIELD-S2-${timestamp}`,
                labId: `LAB-S2-${timestamp}`,
                assignedLab: 'GTM-LAB1',
                country: 'GTM',
                projectCode: 'SOILFER-GTM',
                status: 'APPROVED',
                approvedAt: new Date(),
                updatedAt: new Date('2032-01-01T00:00:00.000Z'),
                latitude: 14.6310,
                longitude: -90.5010
            }
        });

        const res1 = await request(app)
            .get('/api/v2/data-exchange/geojson?limit=1')
            .set('X-API-Key', testKey.rawKey);

        expect(res1.status).toBe(200);
        expect(res1.body.features.length).toBe(1);
        expect(res1.body.hasMore).toBe(true);
        expect(res1.body.nextCursor).toBeDefined();
        const totalInitial = res1.body.total;

        const res2 = await request(app)
            .get(`/api/v2/data-exchange/geojson?limit=1&cursor=${encodeURIComponent(res1.body.nextCursor)}`)
            .set('X-API-Key', testKey.rawKey);

        expect(res2.status).toBe(200);
        expect(res2.body.features.length).toBe(1);
        expect(res2.body.total).toBe(totalInitial);
        // The second feature must NOT be the same as the first feature (no cycling)
        expect(res2.body.features[0].id).not.toBe(res1.body.features[0].id);
    });
});
