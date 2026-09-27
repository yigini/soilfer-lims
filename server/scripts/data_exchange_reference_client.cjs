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
 *   node data_exchange_reference_client.cjs --verify  (runs isolated in-memory verification)
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
  --limit <num>       Page limit for records (default: 5)
  --receipt           Submit authenticated delivery receipt with receiver-reported evidence
  --imported <num>    Receiver-reported successfully imported specimen count
  --quarantined <num> Receiver-reported quarantined specimen count (default: 0)
  --verify            Run isolated synthetic verification harness
  --help, -h          Show this help message
`);
    process.exit(0);
}

const BASE_URL = getArg('--url', process.env.EXCHANGE_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const API_KEY = getArg('--key', process.env.EXCHANGE_API_KEY || '');
const PROFILE = getArg('--profile', 'core-lossless-v2');
const COUNTRY = getArg('--country', null);
const LIMIT = parseInt(getArg('--limit', '5'), 10) || 5;
const SUBMIT_RECEIPT = hasFlag('--receipt');
const IMPORTED_ARG = getArg('--imported', null);
const QUARANTINED_ARG = getArg('--quarantined', null);
const IS_VERIFY = hasFlag('--verify');

// HTTP Client helper
function request(method, path, body = null, customHeaders = {}) {
    return new Promise((resolve, reject) => {
        const fullUrl = new URL(path, BASE_URL);
        const isHttps = fullUrl.protocol === 'https:';
        const isLocalhost = fullUrl.hostname === 'localhost' || fullUrl.hostname === '127.0.0.1' || fullUrl.hostname === '::1';
        if (!isHttps && API_KEY && !isLocalhost) {
            return reject(new Error(`Insecure transport rejected: API key must not be transmitted over unencrypted HTTP to remote host '${fullUrl.hostname}'. Use HTTPS.`));
        }
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
                } catch (e) {
                    parsed = data;
                }
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    data: parsed
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (bodyData) {
            req.write(bodyData);
        }
        req.end();
    });
}

// Main workflow runner
async function runClientWorkflow() {
    console.log('================================================================');
    console.log('SoilFER-LIMS Data Exchange Reference Client (V2)');
    console.log('Target:', BASE_URL);
    console.log('Profile:', PROFILE);
    if (COUNTRY) console.log('Country Scope:', COUNTRY);
    console.log('================================================================\n');

    let totalSteps = 0;
    let passedSteps = 0;

    async function step(name, runner) {
        totalSteps++;
        process.stdout.write(`[Step ${totalSteps}] ${name}... `);
        const start = Date.now();
        try {
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
        return `Version: ${capabilities.contractVersion || capabilities.schemaVersion}, Profiles: [${profiles}]`;
    });

    // 2. Dataset Statistics
    await step('Dataset Statistics (GET /api/v2/data-exchange/stats)', async () => {
        const res = await request('GET', '/api/v2/data-exchange/stats');
        if (res.status !== 200) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        const m = res.data.metrics || {};
        return `Published Samples: ${m.publishedSamples || 0}, Total Eligible: ${m.totalEligibleSamples || 0}, Laboratories: ${m.registeredLabs || 0}`;
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
        const nextCursor = res.data.nextCursor;
        return `Received ${records.length} specimens, nextCursor: ${nextCursor ? nextCursor.slice(0, 16) + '...' : 'none'}`;
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
            const depths = s.sampling?.depths?.intervalLabel || 'unspecified';
            const coords = s.sampling?.location?.coordinates ? `[${s.sampling.location.coordinates.join(', ')}]` : 'null';
            return `ID: ${s.specimenId}, Lab: ${s.laboratoryId || 'none'}, Depths: ${depths}, Coords: ${coords}`;
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
            filter: COUNTRY ? { country: COUNTRY } : {}
        };
        const res = await request('POST', '/api/v2/data-exchange/snapshots', payload);
        if (res.status !== 200 && res.status !== 201) {
            const err = new Error(`HTTP ${res.status}`);
            err.response = res;
            throw err;
        }
        snapshotId = res.data.snapshotId;
        return `Snapshot created: ${snapshotId}, Total Samples: ${res.data.totalSamples || 0}`;
    });

    // 8. Read Snapshot Pages (if snapshot created)
    let harvestedCount = 0;
    if (snapshotId) {
        await step(`Read Snapshot Pages (GET /api/v2/data-exchange/snapshots/${snapshotId}/pages)`, async () => {
            let pageNum = 0;
            let currentCursor = null;
            let totalHarvested = 0;
            do {
                pageNum++;
                let path = `/api/v2/data-exchange/snapshots/${snapshotId}/pages?limit=${LIMIT}`;
                if (currentCursor) path += `&cursor=${encodeURIComponent(currentCursor)}`;
                const res = await request('GET', path);
                if (res.status !== 200) {
                    const err = new Error(`HTTP ${res.status}`);
                    err.response = res;
                    throw err;
                }
                const items = res.data.data || [];
                totalHarvested += items.length;
                currentCursor = res.data.nextCursor || null;
            } while (currentCursor && pageNum < 100);

            harvestedCount = totalHarvested;
            return `Retrieved ${totalHarvested} items across ${pageNum} page(s) (retrieval only; receiver import status pending).`;
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
        return `Received ${changes.length} events, cursor: ${nextCursor ? nextCursor.slice(0, 16) + '...' : 'none'}`;
    });

    // 10. Submit Delivery Receipt (requires explicit receiver-reported import evidence)
    if (SUBMIT_RECEIPT && snapshotId) {
        await step('Submit Delivery Receipt (POST /api/v2/data-exchange/receipts)', async () => {
            const importedCount = IMPORTED_ARG !== null ? parseInt(IMPORTED_ARG, 10) : null;
            const quarantinedCount = QUARANTINED_ARG !== null ? parseInt(QUARANTINED_ARG, 10) : 0;
            if (importedCount === null) {
                return 'Receipt skipped: retrieval is not verified import. Provide --imported <count> with receiver-reported evidence to submit receipt.';
            }
            const reportedTotal = importedCount + quarantinedCount;
            const payload = {
                snapshotId,
                importedCount,
                quarantinedCount,
                checkpoint: reportedTotal > 0 ? `item_${reportedTotal}` : undefined
            };
            const res = await request('POST', '/api/v2/data-exchange/receipts', payload);
            if (res.status !== 200) {
                const err = new Error(`HTTP ${res.status}`);
                err.response = res;
                throw err;
            }
            const r = res.data.receipt || {};
            return `Receipt acknowledged with ID: ${r.receiptId}, status: ${r.status} (receiver-reported: ${importedCount} imported, ${quarantinedCount} quarantined)`;
        });
    }

    console.log('\n----------------------------------------------------------------');
    console.log(`Execution Summary: ${passedSteps}/${totalSteps} checks passed.`);
    console.log('================================================================');

    if (passedSteps === totalSteps) {
        console.log('\x1b[32mAll V2 exchange contract checks completed successfully.\x1b[0m\n');
        process.exit(0);
    } else {
        console.error('\x1b[31mOne or more exchange checks failed.\x1b[0m\n');
        process.exit(1);
    }
}

// Self-Verification Mode: completely isolated synthetic harness using in-memory database
async function runSelfVerification() {
    console.log('Running isolated reference verification harness (in-memory, non-destructive)...');
    const { execFileSync } = require('child_process');
    const path = require('path');
    const probeScript = path.resolve(__dirname, 'test_issue140_probes.cjs');
    try {
        const out = execFileSync(process.execPath, [probeScript], { encoding: 'utf8' });
        console.log(out);
        console.log('\x1b[32mIsolated self-verification passed. No production/development database touched.\x1b[0m');
        process.exit(0);
    } catch (err) {
        console.error('Self-verification failure:', err.stdout || err.message);
        process.exit(1);
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
