# Independent HTTP benchmark verification

14 September 2026, 05:40 UTC. App HEAD remains bdab64e (latest deployed app 37521e5). No application changes during this monitor check.

Ran a separate copy of Antigravity's revised instrumented benchmark against disposable synthetic data: `node WP/project-management-audit-v1/independent-http-benchmark.cjs`. Exit 0. Raw evidence is `independent-http-benchmark-results.json`. Independent copy uses its own output filename and retains its temporary fixture rather than recursively deleting it. Source dev.db hash remained 388e85fbc6573509f0c56e0f1db6989fa682c2931af5a90b0b82eeb1a0e6a90b.

Dataset: 36,870 samples across 100 projects, target project 5,000 samples, comparison project 322 samples. Real loopback HTTP requests invoke actual project routes/controllers with an instrumented Prisma adapter. Local Windows ARM64 / Node 24.13.0, 12 logical CPUs, approximately 15.6 GB RAM, SQLite WAL. 100 timed requests per endpoint.

| Endpoint | Local HTTP p95 | Queries at 5,000 / 322 target samples | Mean payload |
|---|---:|---:|---:|
| Project overview/capabilities | 2.23 ms | 7 / 7 | 888 bytes |
| Project samples, first page of 50 | 6.11 ms | 9 / 9 | 9,372 bytes |
| Aggregated project statistics | 13.81 ms | 8 / 8 | 312 bytes |

This independently establishes measured bounded request/query behavior at the two tested sizes and fast local responses for the requested representative dataset. It is not a public-VPS network latency measurement, arbitrary concurrent-user benchmark, or a mathematical proof of constant query execution time. Counts now come from Prisma query events, not hardcoded expectations; the prior 41 benchmark evidence concern is resolved.

## Other progress / next check

- Revised issue #103 report removes guessed national owner names and distinguishes intentional central international governance from unresolved junction migration policy. No production changes were applied.
- Antigravity is actively debugging `execute_browser_journeys_ui.cjs` against a real isolated backend. No final browser journey success accepted this turn. Interim source still mixes API setup/operations and DOM navigation; accept only the actual interactions and assert outcomes at completion. It must not hide missing UI controls behind successful direct-API fallbacks. Do not rerun the in-progress suite concurrently.
- 41 message remains queued; no duplicate sent. Source/test work corresponds to its guidance.
- No need to rerun the completed benchmarks, prior component suite, healthy deployment or DB integrity checks unless changes justify it. Continue focused original journey acceptance and record exact externally blocked decisions separately.
