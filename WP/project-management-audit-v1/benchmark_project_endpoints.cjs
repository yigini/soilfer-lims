/**
 * Project HTTP Endpoints Benchmark (30,000+ samples across 100 projects)
 *
 * Requirements:
 * - Isolated synthetic SQLite database with >= 30,000 samples and 100 projects
 * - Real Express HTTP server with projectController handlers
 * - Evaluates:
 *   1. GET /api/projects/:id (Overview, capabilities, stats)
 *   2. GET /api/projects/:id/samples?page=1&limit=50 (Bounded first page list)
 *   3. GET /api/projects/:id/stats (Aggregated statistics)
 * - Measures:
 *   - Response payload sizes (bytes)
 *   - Query counts & execution efficiency per request
 *   - Latency percentiles (min, p50, p95, p99, max over 50 requests each)
 * - Environment recording
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { performance } = require('perf_hooks');
const { createRequire } = require('module');
const { createHash } = require('crypto');

const root = 'C:/Users/yigin/Documents/soilfer-lims';
const req = createRequire(path.join(root, 'server/package.json'));
const Database = req('better-sqlite3');
const jwt = req('jsonwebtoken');
const express = req('express');

const sourceDbPath = path.join(root, 'server/prisma/dev.db');
const beforeHash = createHash('sha256').update(fs.readFileSync(sourceDbPath)).digest('hex');

async function runBenchmark() {
    console.log('='.repeat(75));
    console.log('  STARTING HTTP ENDPOINT BENCHMARK (>=30,000 SAMPLES / 100 PROJECTS)');
    console.log('='.repeat(75));

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-bench-http-'));
    const benchDbPath = path.join(tmpDir, 'bench_30k.db');

    // 1. Extract schema from dev.db
    const sourceDb = new Database(sourceDbPath, { readonly: true, fileMustExist: true });
    const ddl = sourceDb.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND type IN ('table','index') ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END").all();
    sourceDb.close();

    const benchDb = new Database(benchDbPath);
    benchDb.pragma('journal_mode = WAL');
    benchDb.pragma('foreign_keys = OFF');
    for (const row of ddl) {
        benchDb.exec(row.sql);
    }

    console.log('\n--- Step 1: Seeding Synthetic Dataset (36,870 Samples across 100 Projects) ---');
    const startSeed = performance.now();

    // Seed User for Authentication
    const insertUser = benchDb.prepare(`
        INSERT INTO User (id, username, password, email, role, name, labId, countries, isActive, createdAt, updatedAt)
        VALUES ('usr-mgr', 'bench_manager', 'hashed_pwd', 'bench@example.com', 'LAB_MANAGER', 'Bench Manager', 'LAB-OWNER', '["GTM"]', 1, datetime('now'), datetime('now'))
    `);
    insertUser.run();

    // Seed Owner and Servicing Labs
    const insertLab = benchDb.prepare(`
        INSERT INTO Lab (id, code, name, country, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `);
    insertLab.run('LAB-OWNER', 'LAB-OWNER', 'Coordinating Central Lab', 'GTM');
    insertLab.run('LAB-SERVICE', 'LAB-SERVICE', 'Servicing Facility B', 'GTM');

    // Seed 100 Projects
    const insertProject = benchDb.prepare(`
        INSERT INTO Project (id, code, name, description, status, labId, assignedLabIds, countries, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 'ACTIVE', 'LAB-OWNER', '["LAB-SERVICE"]', '["GTM"]', datetime('now'), datetime('now'))
    `);

    const insertProjectLab = benchDb.prepare(`
        INSERT INTO ProjectLab (id, projectCode, labId, role, priority, createdAt)
        VALUES (?, ?, ?, ?, 1, datetime('now'))
    `);

    benchDb.transaction(() => {
        for (let p = 1; p <= 100; p++) {
            const pId = `proj-perf-${p}`;
            const pCode = p === 1 ? 'PERF-TARGET' : `PROJ-PERF-${p}`;
            insertProject.run(pId, pCode, `Performance Project ${p}`, `Benchmark project ${p}`);
            insertProjectLab.run(`pl-owner-${p}`, pCode, 'LAB-OWNER', 'OWNER');
            insertProjectLab.run(`pl-service-${p}`, pCode, 'LAB-SERVICE', 'SERVICING');
        }
    })();

    // Seed 36,870 Samples
    // Target project 'proj-perf-1' ('PERF-TARGET') receives 5,000 samples to benchmark realistic large project queries
    const insertSample = benchDb.prepare(`
        INSERT INTO Sample (
            id, originalId, projectId, projectCode, labId, status,
            dryingStatus, preparationStatus, receptionDate, createdAt, updatedAt
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            'COMPLETED', 'COMPLETED', datetime('now'), datetime('now'), datetime('now')
        )
    `);

    benchDb.transaction(() => {
        for (let s = 1; s <= 36870; s++) {
            let pid, pcode;
            if (s <= 5000) {
                pid = 'proj-perf-1';
                pcode = 'PERF-TARGET';
            } else {
                const projNum = (s % 99) + 2; // Projects 2 to 100
                pid = `proj-perf-${projNum}`;
                pcode = `PROJ-PERF-${projNum}`;
            }
            const statuses = ['EXPECTED', 'RECEIVED', 'PROCESSING', 'COMPLETED', 'RELEASED'];
            const status = statuses[s % statuses.length];
            insertSample.run(
                `SMP-PERF-${s.toString().padStart(6, '0')}`,
                `000${s}`,
                pid,
                pcode,
                'LAB-OWNER',
                status
            );
        }
    })();

    benchDb.close();
    const seedTime = ((performance.now() - startSeed) / 1000).toFixed(2);
    console.log(`✓ Seeded 100 projects and 36,870 samples in ${seedTime}s into ${benchDbPath}`);

    // Set environment to point to benchmark fixture
    process.env.DATABASE_PATH = benchDbPath;
    process.env.DATABASE_URL = 'file:' + benchDbPath;
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'benchmark-jwt-secret-xyz987';

    // 2. Instrument Prisma Client with query event logging to measure exact SQL execution
    const { PrismaClient } = req('./prisma_client');
    const { PrismaBetterSqlite3 } = req('@prisma/adapter-better-sqlite3');
    const adapter = new PrismaBetterSqlite3({ url: `file:${benchDbPath}`, timeout: 5000 });
    const instrumentedPrisma = new PrismaClient({
        adapter,
        log: [{ emit: 'event', level: 'query' }]
    });

    let currentCapturedQueries = [];
    let isCapturingQueries = false;
    instrumentedPrisma['$on']('query', (e) => {
        if (isCapturingQueries) {
            currentCapturedQueries.push(e.query);
        }
    });

    // Populate require.cache so projectController and services invoke instrumentedPrisma
    require.cache[path.resolve(root, 'server/prisma.js')] = { exports: instrumentedPrisma };
    require.cache[path.resolve(root, 'server/prisma/index.js')] = { exports: instrumentedPrisma };

    // Build Express server with actual project routes
    const app = express();
    app.use(express.json());

    const { verifyToken } = req('./middleware/authMiddleware');
    app.use('/api/projects', verifyToken, req('./routes/projectRoutes'));

    const PORT = 4199;
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(PORT, '127.0.0.1', resolve));
    console.log(`✓ Real Express API server listening on http://127.0.0.1:${PORT}`);

    // Create Manager JWT
    const token = jwt.sign(
        { id: 'usr-mgr', username: 'bench_manager', role: 'LAB_MANAGER', labId: 'LAB-OWNER', countries: ['GTM'] },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Helper to make HTTP requests
    function makeRequest(urlPath) {
        return new Promise((resolve, reject) => {
            const start = performance.now();
            const reqObj = http.request(
                {
                    hostname: '127.0.0.1',
                    port: PORT,
                    path: urlPath,
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/json'
                    }
                },
                res => {
                    let data = '';
                    res.on('data', chunk => (data += chunk));
                    res.on('end', () => {
                        const duration = performance.now() - start;
                        resolve({
                            statusCode: res.statusCode,
                            bytes: Buffer.byteLength(data, 'utf8'),
                            duration,
                            body: data
                        });
                    });
                }
            );
            reqObj.on('error', reject);
            reqObj.end();
        });
    }

    // Warm-up
    console.log('\n--- Step 2: Warm-up Requests ---');
    const warm1 = await makeRequest('/api/projects/PERF-TARGET');
    const warm2 = await makeRequest('/api/projects/PERF-TARGET/samples?page=1&limit=50');
    const warm3 = await makeRequest('/api/projects/PERF-TARGET/stats');
    if (warm1.statusCode !== 200 || warm2.statusCode !== 200 || warm3.statusCode !== 200) {
        throw new Error(`Warmup failed: ${warm1.statusCode} / ${warm2.statusCode} / ${warm3.statusCode}`);
    }
    console.log('✓ Warm-up completed (All status 200 OK).');

    // Benchmarking suite comparing Scale A (5,000 samples) vs Scale B (322 samples)
    const benchmarks = [
        {
            name: 'GET /api/projects/:id (Project Overview & Capabilities)',
            path: '/api/projects/PERF-TARGET',
            comparisonPath: '/api/projects/PROJ-PERF-2',
            iterations: 100
        },
        {
            name: 'GET /api/projects/:id/samples?page=1&limit=50 (First-Page Sample List)',
            path: '/api/projects/PERF-TARGET/samples?page=1&limit=50',
            comparisonPath: '/api/projects/PROJ-PERF-2/samples?page=1&limit=50',
            iterations: 100
        },
        {
            name: 'GET /api/projects/:id/stats (Aggregated Statistics)',
            path: '/api/projects/PERF-TARGET/stats',
            comparisonPath: '/api/projects/PROJ-PERF-2/stats',
            iterations: 100
        }
    ];

    const resultsSummary = {};

    console.log('\n--- Step 3: Measuring Query Counts and Empirical Scale Invariance ---');

    for (const bench of benchmarks) {
        // Measure queries at Scale A (5,000 samples)
        isCapturingQueries = true;
        currentCapturedQueries = [];
        const resA = await makeRequest(bench.path);
        isCapturingQueries = false;
        const queriesAt5000 = [...currentCapturedQueries];

        // Measure queries at Scale B (322 samples)
        isCapturingQueries = true;
        currentCapturedQueries = [];
        const resB = await makeRequest(bench.comparisonPath);
        isCapturingQueries = false;
        const queriesAt320 = [...currentCapturedQueries];

        const measuredCount = queriesAt5000.length;
        const countAt320 = queriesAt320.length;
        const isScaleInvariant = measuredCount === countAt320;

        console.log(`\n• ${bench.name}:`);
        console.log(`  - Measured queries at 5,000 samples: ${measuredCount}`);
        console.log(`  - Measured queries at 322 samples:   ${countAt320}`);
        console.log(`  - Empirical Query Growth: ${isScaleInvariant ? 'O(1) Strictly Scale-Invariant (0 query growth across 15x sample count)' : 'Scale dependent'}`);

        // Latency and payload measurement across 100 iterations
        const latencies = [];
        let totalBytes = 0;

        for (let i = 0; i < bench.iterations; i++) {
            const res = await makeRequest(bench.path);
            if (res.statusCode !== 200) {
                throw new Error(`Endpoint ${bench.path} returned status ${res.statusCode}: ${res.body}`);
            }
            latencies.push(res.duration);
            totalBytes += res.bytes;
        }

        latencies.sort((a, b) => a - b);
        const min = latencies[0].toFixed(2);
        const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(2);
        const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
        const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);
        const max = latencies[latencies.length - 1].toFixed(2);
        const avgBytes = Math.round(totalBytes / bench.iterations);

        resultsSummary[bench.name] = {
            path: bench.path,
            iterations: bench.iterations,
            avgPayloadBytes: avgBytes,
            measuredQueryCount: measuredCount,
            measuredQueriesAtScaleA_5000: measuredCount,
            measuredQueriesAtScaleB_322: countAt320,
            queryGrowthModel: isScaleInvariant ? 'O(1) Scale-Invariant' : 'O(N)',
            instrumentationMethod: 'Prisma query event emission listener',
            executedSqlQueries: queriesAt5000,
            latenciesMs: { min: Number(min), p50: Number(p50), p95: Number(p95), p99: Number(p99), max: Number(max) }
        };

        console.log(`  - Bounded Payload Size: ${(avgBytes / 1024).toFixed(2)} KB (${avgBytes} bytes)`);
        console.log(`  - Real HTTP Latencies (${bench.iterations} runs): p50 = ${p50}ms | p95 = ${p95}ms | p99 = ${p99}ms | max = ${max}ms`);
    }

    server.close();

    // 4. Save results to JSON
    const reportData = {
        timestamp: new Date().toISOString(),
        dataset: {
            totalSamples: 36870,
            totalProjects: 100,
            targetProjectSamples: 5000,
            comparisonProjectSamples: 322
        },
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            cpus: os.cpus().length,
            memoryTotalGB: (os.totalmem() / (1024 ** 3)).toFixed(1),
            sqliteJournalMode: 'WAL'
        },
        benchmarks: resultsSummary
    };

    const outPath = path.join(root, 'WP/project-management-audit-v1/benchmark_results.json');
    fs.writeFileSync(outPath, JSON.stringify(reportData, null, 2));
    console.log(`\n✓ Benchmark results written to ${outPath}`);

    // Cleanup temp fixture
    try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}

    // Check dev.db invariant
    const afterHash = createHash('sha256').update(fs.readFileSync(sourceDbPath)).digest('hex');
    if (beforeHash !== afterHash) {
        throw new Error(`CRITICAL: Local dev.db was mutated! Before: ${beforeHash}, After: ${afterHash}`);
    }
    console.log(`\n✓ dev.db Invariant Hash Verified Unchanged: ${afterHash}`);
    console.log('='.repeat(75));
    console.log('  ALL HTTP BENCHMARKS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(75));
}

runBenchmark().catch(err => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
