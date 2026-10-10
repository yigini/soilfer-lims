# Pip's independent PR #289 verification

Application head: `a9e24600b381e4c0c4c7a2bd06caa1bec9584de6`.
Completed and exit code verified on October 10, 2026, before 20:32 UTC.

Owned runner: `C:/Users/yigin/AppData/Local/Temp/soilfer-audit193-tests-5eba963e`,
detached at the exact PR head. It uses its existing isolated dependencies and
test database. Raw Git comparison before checkout showed only the owned
node_modules runtime and generated help RELEASE_MANIFEST publication metadata
differed. No application or test assertions/selection were changed.

From the runner's server directory, with `TZ=Europe/Rome` and
`NODE_OPTIONS=--max-old-space-size=8192`:

```text
npm.cmd test -- --runInBand tests/contracts/audit_3_1_attempt_install.test.js tests/security/audit_1_2_state_writes.test.js tests/contracts/audit_3_1_attempt_sql_guards.test.js
```

Result: **3/3 suites, 301/301 tests pass, zero skips, exit 0, 116.437 seconds**.
This is focused validation, not a substitute for Claudio's full-suite CI or
formal exact-head audit. Claudio's separate reported focused count is 201;
the command above selects three suites and yielded 301.

Retained local log:
`C:/Users/yigin/AppData/Local/Temp/audit191-link-a9e24600-focused.log`.
SHA256: `300b3d3746ec8dfb4b377781c8a2496d086aef284deed6cf32f176c994a37746`.

The primary workspace database remains unchanged at SHA256
`490b8c4782bdc5300e729dbcafe9f01dd695995a7d6c69f3002dde9b75cf1835`.
No production data/review action, installer, quiesce or deployment occurred.
No kit helper integration or fresh-copy retry has started while the formal
current-head audit and CI remain pending.
