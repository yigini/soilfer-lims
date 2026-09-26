#!/usr/bin/env node
/**
 * SoilFER-LIMS Data Exchange Reference Client (V2 Lossless)
 *
 * Implements Issue #140 exchange protocol client:
 * - Capabilities discovery (GET /api/v2/data-exchange/capabilities)
 * - Scoped specimen registry harvest (GET /api/v2/data-exchange/samples)
 * - Lossless observations matrix (GET /api/v2/data-exchange/observations)
 * - Spatial GeoJSON retrieval (GET /api/v2/data-exchange/geojson)
 * - Scoped dataset statistics (GET /api/v2/data-exchange/stats)
 * - Durable point-in-time snapshot export (POST /api/v2/data-exchange/snapshots, GET pages)
 * - Monotonic change feed continuous polling (GET /api/v2/data-exchange/changes)
 * - Delivery receipt submission (POST /api/v2/data-exchange/receipts)
 *
 * Usage:
 *   node data_exchange_reference_client.cjs --url http://localhost:5000 --key <API_KEY>
 *   EXCHANGE_BASE_URL=http://localhost:5000 EXCHANGE_API_KEY=<API_KEY> node data_exchange_reference_client.cjs
 *   node data_exchange_reference_client.cjs --verify  (runs self-verification mode)
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');

// Parse CLI arguments
const args = process.argv.slice(2);
function getArg(flag, fallback = null) {
    const idx = args.indexOf(flag);
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
    const prefix = `${flag}=`;
    const found = args.find(a => a.startsWith(prefix));
    if (found) return found.slice(prefix.length);
    return fallback;
}
const hasFlag = (flag) => args.includes(flag);

if (hasFlag('--help') || hasFlag('-h')) {
    console.log(`
SoilFER-LIMS Data Exchange Reference Client (V2 Lossless)
Usage:
  node data_exchange_reference_client.cjs [options]

Options:
  --url <url>       Base URL of SoilFER-LIMS server (default: EXCHANGE_BASE_URL or http://localhost:5000)
  --key <apiKey>    API key for authentication (default: EXCHANGE_API_KEY)
  --profile <name>  Exchange profile: core-lossless-v2 or opennsis (default: core-lossless-v2)
  --country <iso>   Optional country code filter (e.g. KEN, ZMB, GTM)
  --limit <num>     Page limit for records (default: 5)
  --verify          Run self-verification test suite
  --help, -h        Show this help message
`);
    process.exit(0);
}

const BASE_URL = getArg('--url', process.env.EXCHANGE_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_KEY = getArg('--key', process.env.EXCHANGE_API_KEY || '');
const PROFILE = getArg('--profile', 'core-lossless-v2');
const COUNTRY = getArg('--country', null);
const LIMIT = parseInt(getArg('--limit', '5'), 10) || 5;
const IS_VERIFY = hasFlag('--verify');

// HTTP Client helper
function request(method, path, body = null, customHeaders = {}) {
    return new Promise((resolve, reject) => {
        const fullUrl = new URL(path, BASE_URL);
        const isHttps = fullUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const headers = {
            'Accept': 'application/json',
            'User-Agent': 'SoilFER-LIMS-Reference-Client/2.0',
            ...customHeaders
        };
        if (API_KEY) {
            headers['X-API-Key'] = API_KEY;
        }

        let bodyData = null;
        if (body) {
            bodyData = typeof body === 'string' ? body : JSON.stringify(body);
            headers['Content-Type'] = 'application/json';
            headers['Content-Length'] = Buffer.byteLength(bodyData);
        }

        const options = {
            method,
            hostname: fullUrl.hostname,
            port: fullUrl.port || (isHttps ? 443 : 80),
            path: fullUrl.pathname + fullUrl.search,
            headers
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    statusText: res.statusMessage,
                    headers: res.headers,
                    data: parsed
                });
            });
        });

        req.on('error', err => reject(err));
        if (bodyData) req.write(bodyData);
        req.end();
    });
}

// Verification / Workflow Runner
async function runClientWorkflow() {
    console.log('================================================================');
    console.log('   SoilFER-LIMS Data Exchange Reference Client (V2 Lossless)    ');
    console.log('================================================================');
    console.log(`[Config] Target Base URL : ${BASE_URL}`);
    console.log(`[Config] API Key         : ${API_KEY ? `${API_KEY.slice(0, 14)}...` : '(None - will test public/fail-closed response)'}`);
    console.log(`[Config] Profile         : ${PROFILE}`);
    console.log(`[Config] Page Limit      : ${LIMIT}`);
    console.log('----------------------------------------------------------------\n');

    let passedSteps = 0;
    let totalSteps = 0;

    async function step(name, runner) {
        totalSteps++;
        process.stdout.write(`Step ${totalSteps}: ${name} ... `);
        try {
            const start = Date.now();
            const result = await runner();
            const duration = Date.now() - start;
            console.log(`\x1b[32mOK\x1b[0m (${duration}ms)`);
            if (result) {
                console.log(`   └─> ${result}`);
            }
            passedSteps++;
            return true;
        } catch (err) {
            console.log(`\x1b[31mFAILED\x1b[0m`);
            console.error(`   └─> Error: ${err.message}`);
            if (err.response) {
                console.error(`   └─> Server Status: ${err.response.status} - ${JSON.stringify(err.response.data)}`);
            }
            return false;
        }
    }

    // 1. Discover Server Capabilities
    let capabilities = null;
    await step('Capabilities Discovery (GET /api/v2/data-exchange/capabilities)', async () => {
        const res = await request('GET', '/api/v2/data-exchange/capabilities');
        if (res.status !== 200) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        capabilities = res.data;
        const profiles = capabilities.supportedProfiles?.join(', ') || 'none';
        const formats = capabilities.supportedFormats?.join(', ') || 'none';
        return `Version: ${capabilities.version || capabilities.schemaVersion}, Profiles: [${profiles}], Formats: [${formats}]`;
    });

    // 2. Dataset Statistics
    await step('Dataset Statistics (GET /api/v2/data-exchange/stats)', async () => {
        const res = await request('GET', '/api/v2/data-exchange/stats');
        if (res.status !== 200) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        const s = res.data.data || res.data;
        return `Published Samples: ${s.totalSamplesPublished || 0}, Laboratories: ${s.authorizedLaboratories?.length || 0}`;
    });

    // 3. Lossless Specimen Registry
    let firstSampleId = null;
    await step(`Harvest Specimen Registry (GET /api/v2/data-exchange/samples?limit=${LIMIT}&profile=${PROFILE})`, async () => {
        let path = `/api/v2/data-exchange/samples?limit=${LIMIT}&profile=${PROFILE}`;
        if (COUNTRY) path += `&country=${COUNTRY}`;
        const res = await request('GET', path);
        if (res.status !== 200) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        const records = res.data.data || [];
        if (records.length > 0) {
            firstSampleId = records[0].specimenId;
        }
        const hasNext = Boolean(res.data.pagination?.nextCursor);
        return `Received ${records.length} specimens, nextCursor: ${hasNext ? 'yes' : 'none'}`;
    });

    // 4. Specimen Detail (if available)
    if (firstSampleId) {
        await step(`Retrieve Specimen Detail (GET /api/v2/data-exchange/samples/${firstSampleId})`, async () => {
            const res = await request('GET', `/api/v2/data-exchange/samples/${firstSampleId}`);
            if (res.status !== 200) {
                const err = new Error(`HTTP ${res.status}`);
                err.response = res;
                throw err;
            }
            const s = res.data.data;
            const depths = `${s.depth?.topCm ?? 'null'} - ${s.depth?.bottomCm ?? 'null'} cm`;
            const coords = s.spatial?.coordinates ? `[${s.spatial.coordinates.join(', ')}]` : 'null';
            return `ID: ${s.specimenId}, Lab: ${s.laboratoryId}, Depths: ${depths}, Coords: ${coords}`;
        });
    }

    // 5. Analytical Observations Matrix
    await step(`Analytical Observations (GET /api/v2/data-exchange/observations?limit=${LIMIT})`, async () => {
        const res = await request('GET', `/api/v2/data-exchange/observations?limit=${LIMIT}`);
        if (res.status !== 200) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        const obs = res.data.data || [];
        return `Retrieved ${obs.length} observations with basis & censoring metadata`;
    });

    // 6. Spatial GeoJSON (RFC 7946)
    await step('Spatial FeatureCollection (GET /api/v2/data-exchange/geojson)', async () => {
        const res = await request('GET', '/api/v2/data-exchange/geojson');
        if (res.status !== 200) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        const fc = res.data;
        if (fc.type !== 'FeatureCollection') {
            throw new Error(`Expected FeatureCollection, received type: ${fc.type}`);
        }
        if (fc.crs) {
            throw new Error('RFC 7946 violation: root crs object must not be present');
        }
        return `RFC 7946 compliant FeatureCollection with ${fc.features?.length || 0} features`;
    });

    // 7. Resumable Export Snapshot
    let snapshotId = null;
    await step('Create Export Snapshot (POST /api/v2/data-exchange/snapshots)', async () => {
        const payload = {
            profile: PROFILE,
            pageSize: LIMIT,
            filter: COUNTRY ? { country: COUNTRY } : {}
        };
        const res = await request('POST', '/api/v2/data-exchange/snapshots', payload);
        if (res.status !== 200 && res.status !== 201) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        snapshotId = res.data.snapshotId;
        return `Snapshot created: ${snapshotId}, Total Items: ${res.data.totalItems || 0}, Pages: ${res.data.totalPages || 0}`;
    });

    // 8. Read Snapshot Pages (if snapshot created)
    if (snapshotId) {
        await step(`Read Snapshot Pages (GET /api/v2/data-exchange/snapshots/${snapshotId}/pages)`, async () => {
            const res = await request('GET', `/api/v2/data-exchange/snapshots/${snapshotId}/pages?limit=${LIMIT}`);
            if (res.status !== 200) {
                const err = new Error(`HTTP ${res.status}`);
                err.response = res;
                throw err;
            }
            const items = res.data.data || [];
            return `Page 1 read: ${items.length} items, nextCursor: ${res.data.nextCursor ? 'present' : 'end'}`;
        });
    }

    // 9. Change Feed Continuous Polling
    await step('Monotonic Change Feed (GET /api/v2/data-exchange/changes)', async () => {
        const res = await request('GET', `/api/v2/data-exchange/changes?limit=${LIMIT}`);
        if (res.status !== 200) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        const changes = res.data.changes || [];
        const nextCursor = res.data.nextCursor;
        return `Received ${changes.length} events, cursor: ${nextCursor ? nextCursor.slice(0, 20) + '...' : 'none'}`;
    });

    // 10. Submit Delivery Receipt
    await step('Submit Delivery Receipt (POST /api/v2/data-exchange/receipts)', async () => {
        const payload = {
            snapshotId: snapshotId || 'manual-sync-run',
            consumerSystemId: 'opennsis-national-pilot',
            recordsReceived: 1,
            status: 'SUCCESS',
            notes: 'Batch verification complete'
        };
        const res = await request('POST', '/api/v2/data-exchange/receipts', payload);
        if (res.status !== 200) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        const r = res.data.receipt || {};
        return `Receipt logged with ID: ${r.receiptId || r.id || 'ok'}, status: ${r.status || 'ACKNOWLEDGED'}`;
    });

    console.log('\n----------------------------------------------------------------');
    console.log(`Execution Summary: ${passedSteps}/${totalSteps} checks passed.`);
    console.log('================================================================');

    if (passedSteps === totalSteps) {
        console.log('\x1b[32mAll V2 exchange contract checks passed successfully.\x1b[0m\n');
        process.exit(0);
    } else {
        console.error('\x1b[31mOne or more exchange checks failed.\x1b[0m\n');
        process.exit(1);
    }
}

// Self-Verification Mode using supertest against express app
async function runSelfVerification() {
    console.log('Running Reference Client self-verification against in-process app...');
    const prisma = require('../prisma');
    const crypto = require('crypto');
    const app = require('../app');
    const supertest = require('supertest');
    const request = supertest(app);

    const ts = Date.now();
    const rawKey = `slims_live_refclient_${ts}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    let testKeyId = `key-refclient-${ts}`;

    try {
        // 1. Test public capabilities discovery (no key)
        const capRes = await request.get('/api/v2/data-exchange/capabilities');
        console.log(`[PASS] Capabilities (unauthenticated): status=${capRes.status}, schema=${capRes.body?.schemaVersion}`);
        if (capRes.status !== 200) throw new Error('Capabilities endpoint returned non-200');

        // Create temporary key with wildcard lab scope
        await prisma.apiKey.create({
            data: {
                id: testKeyId,
                name: 'Reference Client Self-Test Key',
                keyHash,
                keyPrefix: rawKey.slice(0, 12),
                role: 'NSIS_CONSUMER',
                countries: JSON.stringify(['*']),
                labs: JSON.stringify(['*']),
                isActive: true
            }
        });

        // 2. Capabilities authenticated
        const capAuthRes = await request.get('/api/v2/data-exchange/capabilities')
            .set('X-API-Key', rawKey);
        if (capAuthRes.status !== 200 || capAuthRes.body.status !== 'success') {
            throw new Error('Capabilities with key failed');
        }
        console.log(`[PASS] Capabilities (authenticated): schema=${capAuthRes.body.schemaVersion}, contract=${capAuthRes.body.contractVersion}`);

        // 3. Stats
        const statsRes = await request.get('/api/v2/data-exchange/stats')
            .set('X-API-Key', rawKey);
        if (statsRes.status !== 200) throw new Error(`Stats endpoint failed: ${statsRes.status}`);
        console.log(`[PASS] Stats: totalSamples=${statsRes.body.data?.totalSamplesPublished ?? statsRes.body.totalSamplesPublished ?? 0}`);

        // 4. Samples Registry
        const samplesRes = await request.get('/api/v2/data-exchange/samples?limit=5')
            .set('X-API-Key', rawKey);
        if (samplesRes.status !== 200) throw new Error(`Samples endpoint failed: ${samplesRes.status}`);
        console.log(`[PASS] Samples: count=${samplesRes.body.data?.length || 0}`);

        // 5. Observations Matrix
        const obsRes = await request.get('/api/v2/data-exchange/observations?limit=5')
            .set('X-API-Key', rawKey);
        if (obsRes.status !== 200) throw new Error(`Observations endpoint failed: ${obsRes.status}`);
        console.log(`[PASS] Observations: count=${obsRes.body.data?.length || 0}`);

        // 6. Spatial GeoJSON
        const geoRes = await request.get('/api/v2/data-exchange/geojson')
            .set('X-API-Key', rawKey);
        if (geoRes.status !== 200 || geoRes.body.type !== 'FeatureCollection') {
            throw new Error(`GeoJSON endpoint failed: ${geoRes.status}`);
        }
        if (geoRes.body.crs) throw new Error('RFC 7946 violation: root crs present');
        console.log(`[PASS] Spatial GeoJSON: features=${geoRes.body.features?.length || 0}, RFC 7946 compliant`);

        // 7. Resumable Export Snapshot
        const snapRes = await request.post('/api/v2/data-exchange/snapshots')
            .set('X-API-Key', rawKey)
            .send({ profile: 'core-lossless-v2', pageSize: 10 });
        if (snapRes.status !== 200 && snapRes.status !== 201) {
            throw new Error(`Snapshots creation failed: ${snapRes.status}`);
        }
        const createdSnapId = snapRes.body.snapshotId;
        console.log(`[PASS] Snapshots created: id=${createdSnapId}, total=${snapRes.body.totalItems}`);

        // 8. Snapshot Pages
        const pageRes = await request.get(`/api/v2/data-exchange/snapshots/${createdSnapId}/pages?limit=10`)
            .set('X-API-Key', rawKey);
        if (pageRes.status !== 200) throw new Error(`Snapshot pages failed: ${pageRes.status}`);
        console.log(`[PASS] Snapshot Pages: items=${pageRes.body.data?.length || 0}`);

        // 9. Change Feed Continuous Sync
        const changesRes = await request.get('/api/v2/data-exchange/changes?limit=10')
            .set('X-API-Key', rawKey);
        if (changesRes.status !== 200) throw new Error(`Change feed failed: ${changesRes.status}`);
        console.log(`[PASS] Change Feed: events=${changesRes.body.changes?.length || 0}`);

        // 10. Delivery Receipts
        const receiptRes = await request.post('/api/v2/data-exchange/receipts')
            .set('X-API-Key', rawKey)
            .send({
                snapshotId: createdSnapId,
                consumerSystemId: 'refclient-selftest',
                recordsReceived: 2,
                status: 'SUCCESS',
                notes: 'Self-verification receipt check'
            });
        if (receiptRes.status !== 200) throw new Error(`Delivery receipts failed: ${receiptRes.status}`);
        console.log(`[PASS] Delivery Receipts: id=${receiptRes.body.receipt?.receiptId || receiptRes.body.receipt?.id}, status=${receiptRes.body.receipt?.status}`);

        console.log('\nAll 10 Reference Client verification checks passed successfully against in-process app.');
        process.exit(0);
    } catch (err) {
        console.error('\nSelf-verification failed:', err.message);
        if (err.response) console.error('Response:', err.response.body);
        process.exit(1);
    } finally {
        try {
            await prisma.apiKey.delete({ where: { id: testKeyId } });
        } catch (_) {}
    }
}

if (IS_VERIFY) {
    runSelfVerification();
} else {
    runClientWorkflow().catch(err => {
        console.error('Fatal execution error:', err);
        process.exit(1);
    });
}
