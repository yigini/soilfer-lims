# Audit 2.3 retained assertion map

Baseline: origin/main at 9f298cc2734a341d734bcd037ebf3ebf44725996. Current paths/lines identify the reviewable #186 implementation; regenerate after edits that move assertions. This is a per-assertion map for every changed pre-existing test file, including fixture-only edits. All 1672 baseline assertions have a current counterpart: 1660 retain the same assertion expression, and 12 explicitly translate deprecated storage access or pinned boundary behavior. New #186 tests are additional coverage. No test is skipped, disabled or weakened.

Six translations read the same evidence through normalized storage or its computed view. The other six belong to the specifically pinned malformed-input case in `qc_batch_evaluation`: a null submitted blank and missing required observations must return 400 QC_VALUES_MISSING with zero writes, rather than persist fabricated failure evidence. The map identifies the response, missing types and unchanged database assertions individually. This boundary translation follows the issue's parts 1–2 scope instructions; valid numeric failures retain their existing QC_FAIL behavior.

Fixture and helper edits without baseline assertions are mapped below. Every prior source-hash check, disposable-file restriction and workflow assertion remains active.

| Helper hunk before (main) | Current | Purpose and retained protection |
| --- | --- | --- |
| server/tests/globalSetup.js:46 | server/tests/globalSetup.js:46 | After the existing release installers, dry-run and apply the actual QC run installer with its reviewed fingerprint on the owned test database. |
| server/tests/helpers/legacyWorkflowDatabase.js:155 | server/tests/helpers/legacyWorkflowDatabase.js:155 | Account for precisely four nullable Batch fields and all eight new models when comparing the unchanged historical datamodel; partial new model sets still refuse. |
| server/tests/helpers/legacyWorkflowDatabase.js:228 | server/tests/helpers/legacyWorkflowDatabase.js:237 | Leave the three new release partial indexes for the actual installer when creating a schema-only disposable historical file. No installed database indexes are removed. |
| server/tests/helpers/workflowFixtures.js:63 | server/tests/helpers/workflowFixtures.js:63 | Keep QC-referenced sample/work-item fixture rows until owned database teardown. Existing ownership restrictions remain; cleanup only deletes explicitly selected, unreferenced fixture ids. |
| server/tests/helpers/workflowWriteScanner.js:20 | server/tests/helpers/workflowWriteScanner.js:20 | Add exact QC run loader and migration source hashes alongside all retained release hashes. |
| server/tests/helpers/workflowWriteScanner.js:195 | server/tests/helpers/workflowWriteScanner.js:198 | Resolve SQL from the new reviewed loader through the same source scanner. |
| server/tests/helpers/workflowWriteScanner.js:267 | server/tests/helpers/workflowWriteScanner.js:272 | Allow schemaSql only for the QC run loader; require the exact const binding, named import and unmixed loader source. Existing reference/QC-rule paths retain their checks. |
| server/tests/helpers/workflowWriteScanner.js:287 | server/tests/helpers/workflowWriteScanner.js:292 | Retain binding immutability and SHA256 verification; recognize the QC schema/guard boundary only after both exact source hashes match. |

## server/tests/contracts/audit_0_14_number_entry.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_0_14_number_entry.test.js:35 | server/tests/contracts/audit_0_14_number_entry.test.js:35 | expect({ status: response.status, body: response.body }).toMatchObject({ status: 200, body: { saved: 1 } }) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:37 | server/tests/contracts/audit_0_14_number_entry.test.js:37 | expect(result).toMatchObject({ value: canonical, rawInput: raw, numericValue, isCurrent: true }) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:42 | server/tests/contracts/audit_0_14_number_entry.test.js:42 | expect(response.status).toBe(422) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:42 | server/tests/contracts/audit_0_14_number_entry.test.js:42 | expect(response.body.errors[0].code).toBe(code) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:43 | server/tests/contracts/audit_0_14_number_entry.test.js:43 | expect(await prisma.result.count({ where: { sampleId: f.sampleId } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:44 | server/tests/contracts/audit_0_14_number_entry.test.js:44 | expect(await prisma.workItem.findUnique({ where: { id: f.workItemId } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:49 | server/tests/contracts/audit_0_14_number_entry.test.js:49 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:49 | server/tests/contracts/audit_0_14_number_entry.test.js:49 | expect(response.body.saved).toBe(1) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:51 | server/tests/contracts/audit_0_14_number_entry.test.js:51 | expect(rows.filter(row => row.isCurrent)).toHaveLength(4) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:52 | server/tests/contracts/audit_0_14_number_entry.test.js:52 | expect(rows.find(row => row.param === 'SAND')).toMatchObject({ value: '6.85', numericValue: 6.85, rawInput: '6,85' }) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:53 | server/tests/contracts/audit_0_14_number_entry.test.js:53 | expect(rows.find(row => row.param === 'SILT')).toMatchObject({ value: '43.15', numericValue: 43.15, rawInput: '43,15' }) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:54 | server/tests/contracts/audit_0_14_number_entry.test.js:54 | expect(rows.find(row => row.param === 'TEXTURE').rawInput).toBe('{"sand":"6,85","silt":"43,15","clay":"50"}') | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:55 | server/tests/contracts/audit_0_14_number_entry.test.js:55 | expect(rows.find(row => row.param === 'TEXTURE' && row.isCurrent).rawInput).toBe('{"sand":"6,85","silt":"43,15","clay":"50"}') | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:60 | server/tests/contracts/audit_0_14_number_entry.test.js:60 | expect(await getNumberFormat(lab)).toEqual({ decimal: '.', thousands: ',' }) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:62 | server/tests/contracts/audit_0_14_number_entry.test.js:62 | expect({ status: response.status, body: response.body }).toMatchObject({ status: 200, body: { saved: 1 } }) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:62 | server/tests/contracts/audit_0_14_number_entry.test.js:62 | expect((await prisma.result.findFirst({ where: { sampleId: f.sampleId } })).value).toBe('1234') | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:72 | server/tests/contracts/audit_0_14_number_entry.test.js:72 | expect(refused.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:72 | server/tests/contracts/audit_0_14_number_entry.test.js:72 | expect(refused.body.code).toBe('NUMBER_FORMAT_POLICY_INVALID') | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:73 | server/tests/contracts/audit_0_14_number_entry.test.js:73 | expect(await prisma.result.count({ where: { sampleId: invalid.sampleId } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:74 | server/tests/contracts/audit_0_14_number_entry.test.js:74 | expect(await prisma.workItem.findUnique({ where: { id: invalid.workItemId } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:78 | server/tests/contracts/audit_0_14_number_entry.test.js:78 | expect((await patch({ decimalSeparator: ',', thousandsSeparator: '.' })).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:80 | server/tests/contracts/audit_0_14_number_entry.test.js:80 | expect(JSON.parse(stored.settings)).toEqual({ language: 'fr', dateFormat: 'YYYY-MM-DD', decimalSeparator: ',', thousandsSeparator: '.' }) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:82 | server/tests/contracts/audit_0_14_number_entry.test.js:82 | expect(audit.details).toContain('settings') | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:83 | server/tests/contracts/audit_0_14_number_entry.test.js:83 | expect((await patch({ decimalSeparator: '.', thousandsSeparator: '.' })).body.code).toBe('NUMBER_FORMAT_POLICY_INVALID') | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:84 | server/tests/contracts/audit_0_14_number_entry.test.js:84 | expect((await prisma.lab.findUnique({ where: { id: lab } })).settings).toBe(stored.settings) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:91 | server/tests/contracts/audit_0_14_number_entry.test.js:92 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:91 | server/tests/contracts/audit_0_14_number_entry.test.js:92 | expect(response.body.evaluation.duplicates[0].value1).toBe(6.85) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:93 | server/tests/contracts/audit_0_14_number_entry.test.js:95 | expect(JSON.parse(row.details).rawInput).toEqual({ value1: '6,85', value2: '6,87' }) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:98 | server/tests/contracts/audit_0_14_number_entry.test.js:101 | expect(response.status).toBe(400) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:98 | server/tests/contracts/audit_0_14_number_entry.test.js:101 | expect(response.body.code).toBe('AMBIGUOUS_NUMBER') | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:99 | server/tests/contracts/audit_0_14_number_entry.test.js:102 | expect((await prisma.batch.findUnique({ where: { id: batchId } })).status).toBe('OPEN') | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:100 | server/tests/contracts/audit_0_14_number_entry.test.js:103 | expect(await prisma.batchQcResult.count({ where: { batchId } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_14_number_entry.test.js:101 | server/tests/contracts/audit_0_14_number_entry.test.js:104 | expect(await prisma.auditLog.count({ where: { entityId: batchId } })).toBe(0) | Retained |

## server/tests/contracts/audit_0_15_duplicate_loq.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:17 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:18 | expect(parseDuplicateObservation(raw, format)).toMatchObject({ valid: true, censored: 'BELOW', rawInput: raw }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:20 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:21 | expect(parseDuplicateObservation(raw, format)).toMatchObject({ valid: true, censored: 'ABOVE' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:23 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:24 | expect(parseDuplicateObservation(raw, format).valid).toBe(false) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:31 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:32 | expect(evaluateDuplicate({ value1, value2 }, { loq: .1 })).toMatchObject({ status, criterion, rpd: null }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:34 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:35 | expect(evaluateDuplicate({ value1: '<0.1', value2: '≤0.2' })).toMatchObject({ status: 'PASS', value1: null, value2: null, notes: expect.arrayContaining(['NO_LOQ', 'CENSORED_PAIR', 'CENSORING_LIMITS_DIFFER']), censoringLimits: [{ qualifier: '<', limit: .1, literalLoq: false }, { qualifier: '<=', limit: .2, literalLoq: false }] }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:76 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:107 | expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:78 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:109 | expect(typed).toMatchObject({ status: 'PASS', value1: .02, value2: .05, rpd: null }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:79 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:110 | expect(details).toMatchObject({ loq: .1, loqSource: 'METHODOLOGY', methodologyId, criterion: 'ABSOLUTE_DIFFERENCE', rawInput: { value1: '0,02', value2: '0,05' } }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:80 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:111 | expect((await prisma.batch.findUnique({ where: { id: batch.id } })).status).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:91 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:122 | expect((await evaluate(batch, payload(value1, value2))).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:93 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:124 | expect(typed.status).toBe(status) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:93 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:124 | expect(details.criterion).toBe(criterion) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:94 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:125 | expect(details.rawInput).toEqual({ value1: String(value1), value2: String(value2) }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:95 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:126 | expect(typed.value1).toBeNull() | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:96 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:127 | expect(typed.value2).toBeNull() | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:97 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:128 | expect((await prisma.batch.findUnique({ where: { id: batch.id } })).status).toBe(status === 'PASS' ? 'QC_PASS' : 'QC_FAIL') | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:101 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:132 | expect((await evaluate(fallback.batch, payload(.02, .05))).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:102 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:133 | expect((await duplicate(fallback.batch)).details).toMatchObject({ loq: .1, loqSource: 'ANALYSIS', methodologyId: null }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:104 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:135 | expect((await evaluate(mixed.batch, payload(7, 7))).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:105 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:136 | expect((await duplicate(mixed.batch)).details).toMatchObject({ loq: null, notes: ['NO_LOQ', 'METHOD_AMBIGUOUS'], criterion: 'RPD' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:114 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:145 | expect((await evaluate(batch, data)).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:116 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:147 | expect(details.censoringLimits.map(observation => observation.limit)).toEqual([1.234, 1.234]) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:117 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:148 | expect(details.rawInput).toEqual(data.duplicates[0].rawInput) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:124 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:155 | expect((await evaluate(batch, payload(-1, 1))).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:126 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:157 | expect(after).toMatchObject({ value: '42', numericValue: 42, rawInput: '42', isCurrent: true, isValid: false }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:127 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:158 | expect(JSON.parse(after.flags)).toContain('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:128 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:159 | expect(await prisma.result.count({ where: { batchId: batch.id } })).toBe(1) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:129 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:160 | expect(await prisma.auditLog.count({ where: { entityId: batch.id } })).toBeGreaterThan(0) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:135 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:166 | expect(response.status).toBe(400) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:136 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:167 | expect(response.body).toMatchObject({ code: 'QC_VALUES_MISSING', missingTypes: ['BLANK'] }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:137 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:168 | expect(response.body.code).toBe('INVALID_NUMBER') | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:138 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:169 | expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:139 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:170 | expect(await prisma.batchQcResult.count({ where: { batchId: batch.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:140 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:171 | expect(await prisma.auditLog.count({ where: { entityId: batch.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:156 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:184 | expect(response.status).toBe(400) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:156 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:184 | expect(response.body.code).toBe('INVALID_NUMBER') | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:157 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:185 | expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:158 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:186 | expect(await prisma.batchQcResult.findMany({ where: { batchId: batch.id }, orderBy: { id: 'asc' } })).toEqual(beforeRows) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:159 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:187 | expect(await prisma.auditLog.findMany({ where: { entityId: batch.id }, orderBy: { id: 'asc' } })).toEqual(beforeAudit) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:164 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:192 | expect(response.status).toBe(400) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:164 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:192 | expect(response.body).toMatchObject({ code: 'QC_VALUES_MISSING', missingTypes: ['DUPLICATE'] }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:165 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:193 | expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:166 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:194 | expect(await prisma.batchQcResult.count({ where: { batchId: batch.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:167 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:195 | expect(await prisma.auditLog.count({ where: { entityId: batch.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:172 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:200 | expect(response.status).toBe(400) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:172 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:200 | expect(response.body.code).toBe('AMBIGUOUS_NUMBER') | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:173 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:201 | expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:174 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:202 | expect(await prisma.batchQcResult.count({ where: { batchId: batch.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:175 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:203 | expect(await prisma.auditLog.count({ where: { entityId: batch.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:181 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:209 | expect(evaluateDuplicate({ value1, value2 })).toMatchObject({ status: 'INVALID', rpd: null, criterion: 'INVALID_NONPOSITIVE' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:185 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:213 | expect(result).toMatchObject({ status: 'PASS', criterion: 'ABSOLUTE_DIFFERENCE', loq: .1, loqSource: 'METHODOLOGY', methodologyId: 'method', rpd: null }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:186 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:214 | expect(result.absoluteDifference).toBeCloseTo(.03) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:189 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:217 | expect(evaluateDuplicate({ value1: .02, value2: .15 }, { loq: .1 })).toMatchObject({ status: 'FAIL', criterion: 'ABSOLUTE_DIFFERENCE' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:192 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:220 | expect(evaluateDuplicate({ value1: .5, value2: .5 }, { loq: .1 })).toMatchObject({ status: 'PASS', criterion: 'RPD', rpd: 0 }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:193 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:221 | expect(evaluateDuplicate({ value1: .5, value2: .6 }, { loq: .1 })).toMatchObject({ status: 'FAIL', criterion: 'RPD' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:196 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:224 | expect(evaluateDuplicate({ value1: .02, value2: .05 })).toMatchObject({ status: 'FAIL', criterion: 'RPD', notes: ['NO_LOQ'] }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:197 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:225 | expect(evaluateDuplicate({ value1: 7, value2: 7 }).details).toContain('NO_LOQ') | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:200 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:228 | expect(evaluateBatchQc({ duplicates: [{ value1: -1, value2: 1 }] })).toMatchObject({ overallStatus: 'QC_FAIL', summary: { failed: 1, passed: 0 } }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:225 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:253 | expect(policy).toMatchObject({ loq: .1, loqSource: 'METHODOLOGY', methodologyId: actualId }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:226 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:254 | expect(evaluateDuplicate({ value1: .02, value2: .05 }, policy).status).toBe('PASS') | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:232 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:260 | expect(policy).toMatchObject({ loq: .1, loqSource: 'ANALYSIS', methodologyId: null }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:233 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:261 | expect(evaluateDuplicate({ value1: .02, value2: .05 }, policy).criterion).toBe('ABSOLUTE_DIFFERENCE') | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:237 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:265 | expect(await resolveDuplicatePolicy(batch, prisma)).toMatchObject({ loq: .1, loqSource: 'ANALYSIS_VALIDATION' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:242 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:270 | expect(policy).toMatchObject({ loq: null, loqSource: null, noLoqReason: 'METHOD_AMBIGUOUS' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:243 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:271 | expect(evaluateDuplicate({ value1: .02, value2: .05 }, policy)).toMatchObject({ status: 'FAIL', criterion: 'RPD', notes: ['NO_LOQ', 'METHOD_AMBIGUOUS'] }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:259 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:287 | expect(result).toMatchObject({ loq: .1, loqSource: 'METHODOLOGY', methodologyId: 'recorded' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:260 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:288 | expect(fixture.methodology.findUnique).toHaveBeenCalledWith({ where: { id: 'recorded' }, select: { loq: true } }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:261 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:289 | expect(fixture.result.findMany.mock.calls[0][0].where).toEqual({ batchId: 'batch', param: 'analysis', isCurrent: true, sampleId: { in: ['sample'] } }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:264 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:292 | expect(await resolveDuplicatePolicy(batch, db({ members: [{ sampleId: 'sample', methodologyId: 'method' }], methodLoq: .1 }))).toMatchObject({ loq: .1, loqSource: 'METHODOLOGY', methodologyId: 'method' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:268 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:296 | expect(await resolveDuplicatePolicy(batch, fixture)).toMatchObject({ loq, loqSource, methodologyId: null }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:269 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:297 | expect(fixture.methodology.findUnique).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:274 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:302 | expect(policy).toMatchObject({ loq: null, loqSource: null, methodologyId: null, noLoqReason: 'METHOD_AMBIGUOUS' }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:275 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:303 | expect(evaluateDuplicate({ value1: 7, value2: 7 }, policy).notes).toEqual(['NO_LOQ', 'METHOD_AMBIGUOUS']) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:281 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:309 | expect(spy).toHaveBeenCalledWith('lab', 'qc.duplicateNearLoqMultiplier', { analysisCode: 'analysis', methodologyId: 'method', db: fixture }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_loq.test.js:282 | server/tests/contracts/audit_0_15_duplicate_loq.test.js:310 | expect(spy).toHaveBeenCalledWith('lab', 'qc.duplicateMaxRpd', { analysisCode: 'analysis', methodologyId: 'method', db: fixture }) | Retained |

## server/tests/contracts/audit_0_15_duplicate_ui.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_0_15_duplicate_ui.test.js:91 | server/tests/contracts/audit_0_15_duplicate_ui.test.js:92 | expect(host.find('evaluate-qc-btn').props.disabled).toBe(false) | Retained |
| server/tests/contracts/audit_0_15_duplicate_ui.test.js:93 | server/tests/contracts/audit_0_15_duplicate_ui.test.js:94 | expect(host.axios.post).toHaveBeenCalledTimes(1) | Retained |
| server/tests/contracts/audit_0_15_duplicate_ui.test.js:94 | server/tests/contracts/audit_0_15_duplicate_ui.test.js:95 | expect(host.axios.post.mock.calls[0][1].duplicates[0].rawInput).toEqual({ value1: first, value2: second }) | Retained |
| server/tests/contracts/audit_0_15_duplicate_ui.test.js:95 | server/tests/contracts/audit_0_15_duplicate_ui.test.js:96 | expect(host.axios.post.mock.calls[0][1].duplicates[0].value1).toBe(first.trim().toLowerCase() === '<loq' ? '<LOQ' : first) | Retained |
| server/tests/contracts/audit_0_15_duplicate_ui.test.js:99 | server/tests/contracts/audit_0_15_duplicate_ui.test.js:100 | expect(host.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_0_15_duplicate_ui.test.js:101 | server/tests/contracts/audit_0_15_duplicate_ui.test.js:102 | expect(host.axios.post).not.toHaveBeenCalled() | Retained |

## server/tests/contracts/audit_0_1_qc_values.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_0_1_qc_values.test.js:49 | server/tests/contracts/audit_0_1_qc_values.test.js:47 | expect(res.status).toBe(400) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:50 | server/tests/contracts/audit_0_1_qc_values.test.js:48 | expect(res.body.code).toBe('QC_VALUES_MISSING') | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:51 | server/tests/contracts/audit_0_1_qc_values.test.js:49 | expect(await prisma.batch.findUnique({ where: { id: batchId } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:52 | server/tests/contracts/audit_0_1_qc_values.test.js:50 | expect(await prisma.batchQcResult.count({ where: { batchId } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:53 | server/tests/contracts/audit_0_1_qc_values.test.js:51 | expect(await prisma.auditLog.count({ where: { entityId: batchId } })).toBe(auditCount) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:59 | server/tests/contracts/audit_0_1_qc_values.test.js:57 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:60 | server/tests/contracts/audit_0_1_qc_values.test.js:58 | expect(res.body.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:61 | server/tests/contracts/audit_0_1_qc_values.test.js:59 | expect(res.body.evaluation.blanks[0].value).toBe(0) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:71 | server/tests/contracts/audit_0_1_qc_values.test.js:70 | expect(await prisma.batch.findUnique({ where: { id: batchId } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:72 | server/tests/contracts/audit_0_1_qc_values.test.js:71 | expect(await prisma.batchQcResult.findMany({ where: { batchId }, orderBy: { id: 'asc' } })).toEqual(rows) | Translated: expect(await prisma.qcMeasurement.findMany({ where: { batchId }, orderBy: { id: 'asc' } })).toEqual(rows) |
| server/tests/contracts/audit_0_1_qc_values.test.js:160 | server/tests/contracts/audit_0_1_qc_values.test.js:161 | expect(host.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:162 | server/tests/contracts/audit_0_1_qc_values.test.js:163 | expect(host.axios.post).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:170 | server/tests/contracts/audit_0_1_qc_values.test.js:171 | expect(host.find(id).props.value).toBe('') | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:172 | server/tests/contracts/audit_0_1_qc_values.test.js:173 | expect(host.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:174 | server/tests/contracts/audit_0_1_qc_values.test.js:175 | expect(host.axios.post).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:175 | server/tests/contracts/audit_0_1_qc_values.test.js:176 | expect(host.axios.put).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:188 | server/tests/contracts/audit_0_1_qc_values.test.js:189 | expect(host.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:190 | server/tests/contracts/audit_0_1_qc_values.test.js:191 | expect(host.axios.post).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:193 | server/tests/contracts/audit_0_1_qc_values.test.js:194 | expect(host.find('evaluate-qc-btn').props.disabled).toBe(false) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:195 | server/tests/contracts/audit_0_1_qc_values.test.js:196 | expect(host.axios.post).toHaveBeenCalledWith('/api/qc/batches/fixture-batch/evaluate', { blanks: [{ value: 0, rawInput: { value: '0' } }], controls: [{ expected: 7, measured: 7.03, rawInput: { expected: '7,00', measured: '7,03' } }], duplicates: [{ value1: 6.85, value2: 6.87, rawInput: { value1: '6,85', value2: '6,87' } }] }) | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:201 | server/tests/contracts/audit_0_1_qc_values.test.js:202 | expect(host.find('qc-blank-input').props.value).toBe('') | Retained |
| server/tests/contracts/audit_0_1_qc_values.test.js:202 | server/tests/contracts/audit_0_1_qc_values.test.js:203 | expect(host.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |

## server/tests/contracts/audit_0_2_qc_lock.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_0_2_qc_lock.test.js:34 | server/tests/contracts/audit_0_2_qc_lock.test.js:36 | expect(res.status).toBe(201) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:49 | server/tests/contracts/audit_0_2_qc_lock.test.js:62 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:50 | server/tests/contracts/audit_0_2_qc_lock.test.js:63 | expect(res.body.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:95 | server/tests/contracts/audit_0_2_qc_lock.test.js:108 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:96 | server/tests/contracts/audit_0_2_qc_lock.test.js:109 | expect(res.body.code).toBe('QC_BATCH_LOCKED') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:97 | server/tests/contracts/audit_0_2_qc_lock.test.js:110 | expect(await evidence(batchId)).toEqual(before) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:107 | server/tests/contracts/audit_0_2_qc_lock.test.js:120 | expect(res.status).toBe(expectedStatus) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:108 | server/tests/contracts/audit_0_2_qc_lock.test.js:121 | expect(res.body.code).toBe('QC_BATCH_LOCKED') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:109 | server/tests/contracts/audit_0_2_qc_lock.test.js:122 | expect(await evidence(batchId)).toEqual(before) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:112 | server/tests/contracts/audit_0_2_qc_lock.test.js:125 | expect(update.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:113 | server/tests/contracts/audit_0_2_qc_lock.test.js:126 | expect(await evidence(batchId)).toEqual(before) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:122 | server/tests/contracts/audit_0_2_qc_lock.test.js:135 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:123 | server/tests/contracts/audit_0_2_qc_lock.test.js:136 | expect(res.body.code).toBe('QC_BATCH_MEMBERSHIP_LOCKED') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:124 | server/tests/contracts/audit_0_2_qc_lock.test.js:137 | expect(await evidence(batchId)).toEqual(before) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:130 | server/tests/contracts/audit_0_2_qc_lock.test.js:143 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:131 | server/tests/contracts/audit_0_2_qc_lock.test.js:144 | expect(res.body.status).toBe('QC_FAIL') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:132 | server/tests/contracts/audit_0_2_qc_lock.test.js:145 | expect((await evidence(batchId)).batch.status).toBe('QC_FAIL') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:140 | server/tests/contracts/audit_0_2_qc_lock.test.js:153 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:142 | server/tests/contracts/audit_0_2_qc_lock.test.js:155 | expect(after.batch.status).toBe('OPEN') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:143 | server/tests/contracts/audit_0_2_qc_lock.test.js:156 | expect(after.batch.qcResults).toBeNull() | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:144 | server/tests/contracts/audit_0_2_qc_lock.test.js:157 | expect(after.rows).toEqual([]) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:148 | server/tests/contracts/audit_0_2_qc_lock.test.js:161 | expect(snapshots).toHaveLength(oldCount + 1) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:150 | server/tests/contracts/audit_0_2_qc_lock.test.js:163 | expect(event.snapshot).toEqual({ qcResults: JSON.parse(before.batch.qcResults), qcItems: before.rows, status: 'QC_PASS', disposition: null, workItemIds: JSON.parse(before.batch.workItemIds), actor: { id: jwt.decode(tokens.LAB_MANAGER).id, username: jwt.decode(tokens.LAB_MANAGER).username }, timestamp: expect.any(String), reason: 'New run after instrument service' }) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:156 | server/tests/contracts/audit_0_2_qc_lock.test.js:169 | expect(JSON.parse(after.audit.at(-1).details)).toEqual(event) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:157 | server/tests/contracts/audit_0_2_qc_lock.test.js:170 | expect(after.audit).toHaveLength(before.audit.length + 1) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:158 | server/tests/contracts/audit_0_2_qc_lock.test.js:171 | expect(canPublish({ status: 'APPROVED' }, null, { role: 'LAB_MANAGER' }, { qcBatches: [after.batch] }).allowed).toBe(false) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:167 | server/tests/contracts/audit_0_2_qc_lock.test.js:180 | expect(res.status).toBe(status) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:168 | server/tests/contracts/audit_0_2_qc_lock.test.js:181 | expect(res.body.code).toBe(code) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:169 | server/tests/contracts/audit_0_2_qc_lock.test.js:182 | expect(await evidence(batchId)).toEqual(before) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:179 | server/tests/contracts/audit_0_2_qc_lock.test.js:192 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:183 | server/tests/contracts/audit_0_2_qc_lock.test.js:196 | expect(events.at(-1).snapshot.qcItems).toEqual(before.rows) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:184 | server/tests/contracts/audit_0_2_qc_lock.test.js:197 | expect(after.audit.map(row => JSON.parse(row.details))).toEqual(events) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:186 | server/tests/contracts/audit_0_2_qc_lock.test.js:199 | expect(reopenEvents[1].seq).toBeGreaterThan(reopenEvents[0].seq) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:187 | server/tests/contracts/audit_0_2_qc_lock.test.js:200 | expect(JSON.parse((await evidence(batchId)).batch.history)).toEqual(expect.arrayContaining(reopenEvents)) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:201 | server/tests/contracts/audit_0_2_qc_lock.test.js:214 | expect(res.status).toBe(500) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:202 | server/tests/contracts/audit_0_2_qc_lock.test.js:215 | expect(await evidence(batchId)).toEqual(before) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:212 | server/tests/contracts/audit_0_2_qc_lock.test.js:225 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:213 | server/tests/contracts/audit_0_2_qc_lock.test.js:226 | expect(res.body.code).toBe('QC_FAIL_BLOCKER') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:214 | server/tests/contracts/audit_0_2_qc_lock.test.js:227 | expect((await prisma.workItem.findUnique({ where: { id: fixture.workItemId } })).status).toBe('SUBMITTED') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:215 | server/tests/contracts/audit_0_2_qc_lock.test.js:228 | expect(await prisma.reviewDecision.count({ where: { workItemId: fixture.workItemId } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:221 | server/tests/contracts/audit_0_2_qc_lock.test.js:234 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:222 | server/tests/contracts/audit_0_2_qc_lock.test.js:235 | expect((await prisma.workItem.findUnique({ where: { id: fixture.workItemId } })).status).toBe('ACCEPTED') | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:224 | server/tests/contracts/audit_0_2_qc_lock.test.js:237 | expect(evaluation.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:233 | server/tests/contracts/audit_0_2_qc_lock.test.js:246 | expect(canPublish({ status: 'APPROVED' }, null, { role: 'LAB_MANAGER' }, { qcBatches: [{ id: 'qc', status, disposition }] }).allowed).toBe(allowed) | Retained |
| server/tests/contracts/audit_0_2_qc_lock.test.js:239 | server/tests/contracts/audit_0_2_qc_lock.test.js:252 | expect(await qcController.checkItemBatchStatus('unavailable')).toMatchObject({ allowed: false, status: 'ERROR' }) | Retained |

## server/tests/contracts/audit_0_3_publication.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_0_3_publication.test.js:71 | server/tests/contracts/audit_0_3_publication.test.js:72 | expect((await generate(f)).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:72 | server/tests/contracts/audit_0_3_publication.test.js:73 | expect(await prisma.result.count({ where: { sampleId: f.sampleId, param: analysis } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:82 | server/tests/contracts/audit_0_3_publication.test.js:83 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:83 | server/tests/contracts/audit_0_3_publication.test.js:84 | expect(res.body.code).toBe('ACCEPTED_ITEM_WITHOUT_EVIDENCE') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:84 | server/tests/contracts/audit_0_3_publication.test.js:85 | expect(res.body.workItemIds).toEqual([f.spectralItem.id]) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:85 | server/tests/contracts/audit_0_3_publication.test.js:86 | expect(await prisma.spectralData.findUnique({ where: { id: f.scan.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:86 | server/tests/contracts/audit_0_3_publication.test.js:87 | expect(await prisma.report.count({ where: { sampleId: f.sampleId } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:91 | server/tests/contracts/audit_0_3_publication.test.js:92 | expect((await generate(f)).body.code).toBe('ACCEPTED_ITEM_WITHOUT_EVIDENCE') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:93 | server/tests/contracts/audit_0_3_publication.test.js:94 | expect((await generate(f)).status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:97 | server/tests/contracts/audit_0_3_publication.test.js:98 | expect((await generate(f)).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:103 | server/tests/contracts/audit_0_3_publication.test.js:104 | expect(saved.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:104 | server/tests/contracts/audit_0_3_publication.test.js:105 | expect(saved.body.saved).toBe(1) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:105 | server/tests/contracts/audit_0_3_publication.test.js:106 | expect((await prisma.result.findFirst({ where: { sampleId: acquisition.sampleId, param: analysis, isCurrent: true } })).numericValue).toBe(12) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:106 | server/tests/contracts/audit_0_3_publication.test.js:107 | expect((await prisma.result.findUnique({ where: { id: acquisition.result.id } })).isCurrent).toBe(false) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:107 | server/tests/contracts/audit_0_3_publication.test.js:108 | expect((await prisma.result.findUnique({ where: { id: f.result.id } })).isCurrent).toBe(true) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:134 | server/tests/contracts/audit_0_3_publication.test.js:135 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:134 | server/tests/contracts/audit_0_3_publication.test.js:135 | expect(res.body.code).toBe('SAMPLE_NOT_APPROVED') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:139 | server/tests/contracts/audit_0_3_publication.test.js:140 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:139 | server/tests/contracts/audit_0_3_publication.test.js:140 | expect(res.body.code).toBe('ITEMS_NOT_ACCEPTED') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:139 | server/tests/contracts/audit_0_3_publication.test.js:140 | expect(res.body.workItemIds).toEqual([f.item.id]) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:140 | server/tests/contracts/audit_0_3_publication.test.js:141 | expect(await prisma.report.count({ where: { sampleId: f.sampleId } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:145 | server/tests/contracts/audit_0_3_publication.test.js:146 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:145 | server/tests/contracts/audit_0_3_publication.test.js:146 | expect(res.body.code).toBe('ITEMS_NOT_ACCEPTED') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:150 | server/tests/contracts/audit_0_3_publication.test.js:151 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:150 | server/tests/contracts/audit_0_3_publication.test.js:151 | expect(res.body.code).toBe('QC_BATCH_PENDING') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:155 | server/tests/contracts/audit_0_3_publication.test.js:155 | expect((await generate(f)).body.code).toBe('QC_BATCH_PENDING') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:159 | server/tests/contracts/audit_0_3_publication.test.js:159 | expect(canPublish({ status: 'APPROVED', workItems: [{ id: 'w', sampleId: 's', analysis: 'PH_H2O', status: 'ACCEPTED' }], results: [result] }, null, manager).code).toBe('QC_BATCH_PENDING') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:164 | server/tests/contracts/audit_0_3_publication.test.js:164 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:164 | server/tests/contracts/audit_0_3_publication.test.js:164 | expect(res.body.code).toBe('QC_POLICY_UNRESOLVED') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:166 | server/tests/contracts/audit_0_3_publication.test.js:166 | expect((await generate(await fixture())).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:172 | server/tests/contracts/audit_0_3_publication.test.js:172 | expect((await generate(f)).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:173 | server/tests/contracts/audit_0_3_publication.test.js:173 | expect((await reportValues(f)).values).toHaveLength(1) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:179 | server/tests/contracts/audit_0_3_publication.test.js:179 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:179 | server/tests/contracts/audit_0_3_publication.test.js:179 | expect(res.body.code).toBe('RESULT_UNGOVERNED') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:179 | server/tests/contracts/audit_0_3_publication.test.js:179 | expect(res.body.params).toEqual(['PH_H2O']) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:184 | server/tests/contracts/audit_0_3_publication.test.js:184 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:184 | server/tests/contracts/audit_0_3_publication.test.js:184 | expect(res.body.code).toBe('ACCEPTED_ITEM_WITHOUT_VALID_RESULT') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:184 | server/tests/contracts/audit_0_3_publication.test.js:184 | expect(res.body.workItemIds).toEqual([f.item.id]) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:189 | server/tests/contracts/audit_0_3_publication.test.js:189 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:191 | server/tests/contracts/audit_0_3_publication.test.js:191 | expect(values).toHaveLength(0) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:192 | server/tests/contracts/audit_0_3_publication.test.js:192 | expect(content.meta.assembly.omittedByDisposition).toEqual([{ param: 'PH_H2O', itemIds: [f.item.id] }]) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:193 | server/tests/contracts/audit_0_3_publication.test.js:193 | expect((await reviewedState(f)).result).toEqual(before.result) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:199 | server/tests/contracts/audit_0_3_publication.test.js:199 | expect((await generate(f)).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:201 | server/tests/contracts/audit_0_3_publication.test.js:201 | expect(values).toHaveLength(1) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:201 | server/tests/contracts/audit_0_3_publication.test.js:201 | expect(content.meta.assembly.omittedByDisposition).toEqual([]) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:202 | server/tests/contracts/audit_0_3_publication.test.js:202 | expect((await reviewedState(f)).result).toEqual(before.result) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:207 | server/tests/contracts/audit_0_3_publication.test.js:207 | expect((await reportValues(f)).values.map(row => row.param).sort()).toEqual(['CLAY', 'SAND', 'SILT', 'TEXTURE']) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:208 | server/tests/contracts/audit_0_3_publication.test.js:208 | expect(governsResult({ ...f.item, analysis: 'SAND' }, { ...f.result, param: 'CLAY' })).toBe(false) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:213 | server/tests/contracts/audit_0_3_publication.test.js:213 | expect(isReviewedReportResult(result, [item])).toBe(false) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:214 | server/tests/contracts/audit_0_3_publication.test.js:214 | expect(isReviewedReportResult({ ...result, methodologyId: null }, [item])).toBe(true) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:219 | server/tests/contracts/audit_0_3_publication.test.js:219 | expect((await reportValues(f)).values).toHaveLength(1) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:223 | server/tests/contracts/audit_0_3_publication.test.js:223 | expect((await reportValues(returned)).values).toHaveLength(0) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:224 | server/tests/contracts/audit_0_3_publication.test.js:224 | expect((await prisma.workItem.findUnique({ where: { id: other.id } })).status).toBe('ACCEPTED') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:231 | server/tests/contracts/audit_0_3_publication.test.js:231 | expect(policy).toHaveBeenCalledWith(labId, 'qc.mode', { analysisCode: 'PH_H2O', methodologyId: null, db: expect.objectContaining({ lab: expect.anything() }) }) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:233 | server/tests/contracts/audit_0_3_publication.test.js:233 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:233 | server/tests/contracts/audit_0_3_publication.test.js:233 | expect(res.body.code).toBe('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:235 | server/tests/contracts/audit_0_3_publication.test.js:235 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:238 | server/tests/contracts/audit_0_3_publication.test.js:238 | expect(content.resultGroups.flatMap(group => group.items)).toHaveLength(1) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:239 | server/tests/contracts/audit_0_3_publication.test.js:239 | expect(content.qcWarnings).toEqual([{ batchId: f.batch.id, analysisCode: 'PH_H2O', qcStatus: 'QC_FAIL', dispositionDecision: null }]) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:240 | server/tests/contracts/audit_0_3_publication.test.js:240 | expect(content.qcWarningStatement).toMatch(/QC warning/) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:242 | server/tests/contracts/audit_0_3_publication.test.js:242 | expect((await prisma.report.findUnique({ where: { id: res.body.id } })).content).toBe(report.content) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:244 | server/tests/contracts/audit_0_3_publication.test.js:244 | expect((await reviewedState(f)).result).toEqual(before.result) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:250 | server/tests/contracts/audit_0_3_publication.test.js:250 | expect((await reportValues(f)).values).toHaveLength(0) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:251 | server/tests/contracts/audit_0_3_publication.test.js:251 | expect((await reviewedState(f)).result).toEqual(before.result) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:252 | server/tests/contracts/audit_0_3_publication.test.js:252 | expect((await generate(f)).status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:255 | server/tests/contracts/audit_0_3_publication.test.js:255 | expect(isInvalidOnlyByQcFailure({ isValid: false, flags })).toBe(false) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:260 | server/tests/contracts/audit_0_3_publication.test.js:260 | expect((await reportValues(f, language)).content.qcWarningStatement).toBe(require('../../locales/${language}.json').resultReports.qcWarningStatement) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:265 | server/tests/contracts/audit_0_3_publication.test.js:265 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:267 | server/tests/contracts/audit_0_3_publication.test.js:267 | expect(after.item.status).toBe('REPEAT_REQUIRED') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:267 | server/tests/contracts/audit_0_3_publication.test.js:267 | expect(after.result.isValid).toBe(false) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:268 | server/tests/contracts/audit_0_3_publication.test.js:268 | expect(after.result.value).toBe('7.2') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:268 | server/tests/contracts/audit_0_3_publication.test.js:268 | expect(after.result.numericValue).toBe(7.2) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:269 | server/tests/contracts/audit_0_3_publication.test.js:269 | expect(JSON.parse(after.result.flags)).toEqual(['METHOD_NOTE', 'REVIEW_RETURNED']) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:271 | server/tests/contracts/audit_0_3_publication.test.js:271 | expect(JSON.parse(log.details)).toEqual({ workItemId: f.item.id, reason: 'Recheck drift' }) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:273 | server/tests/contracts/audit_0_3_publication.test.js:273 | expect(values).toHaveLength(0) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:273 | server/tests/contracts/audit_0_3_publication.test.js:273 | expect(content.workItems[0].result).toBeNull() | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:280 | server/tests/contracts/audit_0_3_publication.test.js:280 | expect((await returnItem('individual', f)).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:282 | server/tests/contracts/audit_0_3_publication.test.js:282 | expect(results).toHaveLength(4) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:283 | server/tests/contracts/audit_0_3_publication.test.js:283 | expect(results.every(row => row.isValid === false && JSON.parse(row.flags).includes('REVIEW_RETURNED'))).toBe(true) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:284 | server/tests/contracts/audit_0_3_publication.test.js:284 | expect(await prisma.auditLog.count({ where: { sampleId: f.sampleId, entity: 'RESULT', action: 'REVIEW_RETURNED' } })).toBe(4) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:291 | server/tests/contracts/audit_0_3_publication.test.js:291 | expect(res.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:291 | server/tests/contracts/audit_0_3_publication.test.js:291 | expect(res.body.code).toBe('RESULT_FLAGS_INVALID') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:292 | server/tests/contracts/audit_0_3_publication.test.js:292 | expect(await reviewedState(f)).toEqual(before) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:297 | server/tests/contracts/audit_0_3_publication.test.js:297 | expect((await returnItem('individual', f)).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:298 | server/tests/contracts/audit_0_3_publication.test.js:298 | expect((await prisma.result.findUnique({ where: { id: f.result.id } })).isValid).toBe(false) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:305 | server/tests/contracts/audit_0_3_publication.test.js:305 | expect((await returnItem(path, f)).status).toBe(500) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:306 | server/tests/contracts/audit_0_3_publication.test.js:306 | expect(await reviewedState(f)).toEqual(before) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:317 | server/tests/contracts/audit_0_3_publication.test.js:317 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:322 | server/tests/contracts/audit_0_3_publication.test.js:322 | expect(returned.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:322 | server/tests/contracts/audit_0_3_publication.test.js:322 | expect(returned.body.code).toBe('AMENDMENT_WORKFLOW_REQUIRED') | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:323 | server/tests/contracts/audit_0_3_publication.test.js:323 | expect(await reviewedState(f)).toEqual(records) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:324 | server/tests/contracts/audit_0_3_publication.test.js:324 | expect(await prisma.submission.findUnique({ where: { id: f.submission.id } })).toEqual(submissionBefore) | Retained |
| server/tests/contracts/audit_0_3_publication.test.js:325 | server/tests/contracts/audit_0_3_publication.test.js:325 | expect(await prisma.report.findUnique({ where: { id: before.id } })).toEqual(before) | Retained |

## server/tests/contracts/audit_0_7_resubmission.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_0_7_resubmission.test.js:42 | server/tests/contracts/audit_0_7_resubmission.test.js:42 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:44 | server/tests/contracts/audit_0_7_resubmission.test.js:44 | expect(item.status).toBe('REPEAT_REQUIRED') | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:44 | server/tests/contracts/audit_0_7_resubmission.test.js:44 | expect(item.submissionId).toBeNull() | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:46 | server/tests/contracts/audit_0_7_resubmission.test.js:46 | expect(history[0]).toEqual({ action: 'SUBMITTED', submissionId: f.submission.id }) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:47 | server/tests/contracts/audit_0_7_resubmission.test.js:47 | expect(history.at(-1).submissionId).toBe(f.submission.id) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:48 | server/tests/contracts/audit_0_7_resubmission.test.js:48 | expect(history.at(-1).reason \|\| history.at(-1).note).toBe(reason) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:49 | server/tests/contracts/audit_0_7_resubmission.test.js:49 | expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).workItemIds).toBe(f.submission.workItemIds) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:50 | server/tests/contracts/audit_0_7_resubmission.test.js:50 | expect((await prisma.result.findUnique({ where: { id: f.result.id } })).numericValue).toBe(6.2) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:52 | server/tests/contracts/audit_0_7_resubmission.test.js:52 | expect(beforeQueue.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:54 | server/tests/contracts/audit_0_7_resubmission.test.js:54 | expect(saved.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:54 | server/tests/contracts/audit_0_7_resubmission.test.js:54 | expect(saved.body.saved).toBe(1) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:56 | server/tests/contracts/audit_0_7_resubmission.test.js:56 | expect(preview.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:56 | server/tests/contracts/audit_0_7_resubmission.test.js:56 | expect(preview.body.totalCompletedItems).toBe(1) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:57 | server/tests/contracts/audit_0_7_resubmission.test.js:57 | expect(preview.body.eligibleSamples[0].items.map(item => item.workItemId)).toContain(f.item.id) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:59 | server/tests/contracts/audit_0_7_resubmission.test.js:59 | expect(queue.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:59 | server/tests/contracts/audit_0_7_resubmission.test.js:59 | expect(queue.body.stats.readyToSubmitCount).toBe(beforeQueue.body.stats.readyToSubmitCount + 1) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:60 | server/tests/contracts/audit_0_7_resubmission.test.js:60 | expect(queue.body.groups.flatMap(group => group.items).map(item => item.workItemId)).toContain(f.item.id) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:62 | server/tests/contracts/audit_0_7_resubmission.test.js:62 | expect(old.value).toBe('6.2') | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:62 | server/tests/contracts/audit_0_7_resubmission.test.js:62 | expect(old.numericValue).toBe(6.2) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:62 | server/tests/contracts/audit_0_7_resubmission.test.js:62 | expect(old.isCurrent).toBe(false) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:63 | server/tests/contracts/audit_0_7_resubmission.test.js:63 | expect((await prisma.result.findFirst({ where: { sampleId: f.sampleId, isCurrent: true } })).numericValue).toBe(6.4) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:70 | server/tests/contracts/audit_0_7_resubmission.test.js:71 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:72 | server/tests/contracts/audit_0_7_resubmission.test.js:73 | expect(item.status).toBe('REPEAT_REQUIRED') | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:72 | server/tests/contracts/audit_0_7_resubmission.test.js:73 | expect(item.submissionId).toBeNull() | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:73 | server/tests/contracts/audit_0_7_resubmission.test.js:74 | expect(JSON.parse(item.history).at(-1)).toMatchObject({ submissionId: f.submission.id, reason, action: 'REANALYZE_BATCH' }) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:74 | server/tests/contracts/audit_0_7_resubmission.test.js:75 | expect(await prisma.workItem.findUnique({ where: { id: accepted.id } })).toEqual(accepted) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:75 | server/tests/contracts/audit_0_7_resubmission.test.js:76 | expect((await prisma.result.findUnique({ where: { id: f.result.id } })).numericValue).toBe(6.2) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:76 | server/tests/contracts/audit_0_7_resubmission.test.js:77 | expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).workItemIds).toBe(f.submission.workItemIds) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:81 | server/tests/contracts/audit_0_7_resubmission.test.js:82 | expect((await returned('individual', f)).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:83 | server/tests/contracts/audit_0_7_resubmission.test.js:84 | expect(item.submissionId).toBeNull() | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:83 | server/tests/contracts/audit_0_7_resubmission.test.js:84 | expect(JSON.parse(item.history).at(-1)).toMatchObject({ submissionId: null, reason }) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:84 | server/tests/contracts/audit_0_7_resubmission.test.js:85 | expect((await post('/api/workbench/batch-save', { draft: false, entries: [{ workItemId: f.item.id, value: '6.5' }] }, technician)).body.saved).toBe(1) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:85 | server/tests/contracts/audit_0_7_resubmission.test.js:86 | expect((await post('/api/workbench/v2/submissions/preview', { workItemIds: [f.item.id] }, technician)).body.totalCompletedItems).toBe(1) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:95 | server/tests/contracts/audit_0_7_resubmission.test.js:96 | expect((await returned(route, f)).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:96 | server/tests/contracts/audit_0_7_resubmission.test.js:97 | expect((await post('/api/workbench/batch-save', { draft: false, entries: [{ workItemId: f.item.id, value: '6.4' }] }, technician)).body.saved).toBe(1) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:98 | server/tests/contracts/audit_0_7_resubmission.test.js:99 | expect(submitted.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:101 | server/tests/contracts/audit_0_7_resubmission.test.js:102 | expect(before).toMatchObject({ status: 'SUBMITTED', submissionId: newSubmissionId }) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:110 | server/tests/contracts/audit_0_7_resubmission.test.js:111 | expect(refused.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:110 | server/tests/contracts/audit_0_7_resubmission.test.js:111 | expect(refused.body.code).toBe('ITEM_NOT_SUBMITTED') | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:111 | server/tests/contracts/audit_0_7_resubmission.test.js:112 | expect(refused.body.errors).toEqual([{ workItemId: f.item.id, code: 'ITEM_NOT_IN_SUBMISSION' }]) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:112 | server/tests/contracts/audit_0_7_resubmission.test.js:113 | expect(await prisma.workItem.findUnique({ where: { id: f.item.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:113 | server/tests/contracts/audit_0_7_resubmission.test.js:114 | expect(await prisma.reviewDecision.count()).toBe(decisionsBefore) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:114 | server/tests/contracts/audit_0_7_resubmission.test.js:115 | expect(await prisma.auditLog.count()).toBe(auditsBefore) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:115 | server/tests/contracts/audit_0_7_resubmission.test.js:116 | expect(await prisma.submission.findUnique({ where: { id: f.submission.id } })).toEqual(oldPackage) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:120 | server/tests/contracts/audit_0_7_resubmission.test.js:121 | expect(foreign.status).toBe(403) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:120 | server/tests/contracts/audit_0_7_resubmission.test.js:121 | expect(await prisma.auditLog.count()).toBe(auditsBefore) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:122 | server/tests/contracts/audit_0_7_resubmission.test.js:123 | expect(shorthand.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:123 | server/tests/contracts/audit_0_7_resubmission.test.js:124 | expect(shorthand.body.results).toEqual([{ workItemId: remaining.id, status: 'ACCEPTED', decision: 'ACCEPT' }]) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:124 | server/tests/contracts/audit_0_7_resubmission.test.js:125 | expect(await prisma.workItem.findUnique({ where: { id: f.item.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:125 | server/tests/contracts/audit_0_7_resubmission.test.js:126 | expect(await prisma.reviewDecision.findMany({ where: { workItemId: f.item.id } })).toEqual(itemDecisionsBefore) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:126 | server/tests/contracts/audit_0_7_resubmission.test.js:127 | expect(await prisma.auditLog.findMany({ where: { entityId: f.item.id } })).toEqual(itemAuditsBefore) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:127 | server/tests/contracts/audit_0_7_resubmission.test.js:128 | expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).status).toBe('REVIEWED') | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:131 | server/tests/contracts/audit_0_7_resubmission.test.js:132 | expect(currentReview.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:132 | server/tests/contracts/audit_0_7_resubmission.test.js:133 | expect((await prisma.workItem.findUnique({ where: { id: f.item.id } })).status).toBe('ACCEPTED') | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:133 | server/tests/contracts/audit_0_7_resubmission.test.js:134 | expect(await prisma.reviewDecision.findFirst({ where: { workItemId: f.item.id, decision: 'ACCEPT' } })).toMatchObject({ submissionItemId: newSubmissionId }) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:134 | server/tests/contracts/audit_0_7_resubmission.test.js:135 | expect((await prisma.result.findUnique({ where: { id: f.result.id } })).value).toBe('6.2') | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:138 | server/tests/contracts/audit_0_7_resubmission.test.js:140 | expect((await post('/api/qc/batches/${f.batch.id}/disposition', { decision: 'REANALYZE_BATCH', reason })).status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:139 | server/tests/contracts/audit_0_7_resubmission.test.js:141 | expect((await post('/api/workbench/batch-save', { draft: false, entries: [{ workItemId: f.item.id, value: '6.4' }] }, technician)).body.saved).toBe(1) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:141 | server/tests/contracts/audit_0_7_resubmission.test.js:143 | expect(submitted.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:145 | server/tests/contracts/audit_0_7_resubmission.test.js:147 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:145 | server/tests/contracts/audit_0_7_resubmission.test.js:147 | expect(response.body.results).toEqual([]) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:146 | server/tests/contracts/audit_0_7_resubmission.test.js:148 | expect(await prisma.workItem.findUnique({ where: { id: f.item.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:147 | server/tests/contracts/audit_0_7_resubmission.test.js:149 | expect(await prisma.reviewDecision.count()).toBe(decisionsBefore) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:148 | server/tests/contracts/audit_0_7_resubmission.test.js:150 | expect(await prisma.auditLog.count()).toBe(auditsBefore + 1) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:149 | server/tests/contracts/audit_0_7_resubmission.test.js:151 | expect(await prisma.auditLog.findFirst({ where: { entityId: f.submission.id, action: 'SUBMISSION_REVIEWED' } })).toMatchObject({ details: '0 items reviewed; 1 moved to later submissions' }) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:152 | server/tests/contracts/audit_0_7_resubmission.test.js:154 | expect((await prisma.submission.findUnique({ where: { id: f.submission.id } })).status).toBe('REVIEWED') | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:154 | server/tests/contracts/audit_0_7_resubmission.test.js:156 | expect(alreadyReviewed.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:155 | server/tests/contracts/audit_0_7_resubmission.test.js:157 | expect(alreadyReviewed.body).toMatchObject({ code: 'SUBMISSION_NOT_REVIEWABLE', status: 'REVIEWED' }) | Retained |
| server/tests/contracts/audit_0_7_resubmission.test.js:156 | server/tests/contracts/audit_0_7_resubmission.test.js:158 | expect(await prisma.auditLog.count()).toBe(auditsBefore + 1) | Retained |

## server/tests/contracts/audit_0_8_report_truthfulness.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:39 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:42 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:53 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:56 | expect(new Set(reports.map(r => r.reportNumberBase)).size).toBe(2) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:54 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:57 | expect(reports.every(r => r.revision === 0)).toBe(true) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:56 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:59 | expect(sequences[1]).toBe(sequences[0] + 1) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:64 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:67 | expect([second.reportNumberBase, third.reportNumberBase]).toEqual([first.reportNumberBase, first.reportNumberBase]) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:65 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:68 | expect([second.revision, third.revision]).toEqual([1, 2]) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:66 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:69 | expect(JSON.parse(third.content).reportNumber).toBe('${first.reportNumberBase} rev 2') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:67 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:70 | expect(JSON.parse(third.content).publication.replacesReportNumber).toBe('${first.reportNumberBase} rev 1') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:68 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:71 | expect(await prisma.reportSequence.findUnique({ where: { labId_year: { labId, year: counter.year } } })).toEqual(counter) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:69 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:72 | expect((await generate(await fixture())).reportNumberBase).toMatch(/^NEW-/) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:77 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:80 | expect(next.reportNumberBase).toBe('${prefix}-v2') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:78 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:81 | expect(next.revision).toBe(1) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:79 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:82 | expect(JSON.parse(next.content).publication.replacesReportId).toBe(v2.id) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:80 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:83 | expect((await prisma.report.findUnique({ where: { id: v1.id } })).content).toBe(v1.content) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:83 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:86 | expect(pdf.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:85 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:88 | expect(calls).toContain('${prefix}-v1') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:86 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:89 | expect(calls).toContain('Issue Date: 2020-03-04') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:87 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:90 | expect(calls).toContain('Status: SUPERSEDED') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:88 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:91 | expect(calls.some(value => value.includes('SUPERSEDED') && value.includes('${prefix}-v2'))).toBe(true) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:94 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:97 | expect(response.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:94 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:97 | expect(response.body.code).toBe('REPORT_NUMBER_CONFLICT') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:95 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:98 | expect(await prisma.report.count({ where: { sampleId: a.sampleId } })).toBe(1) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:102 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:105 | expect(response.status).toBe(409) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:102 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:105 | expect(response.body.code).toBe('REPORT_NUMBER_CONFLICT') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:109 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:112 | expect(prisma.$transaction(async tx => { reserved = await allocateReportIdentity(tx, { sampleId: f.sampleId, lab, publishedAt: now, resolveFormat: () => policy.get(labId, 'report.numberFormat', { db: tx }) }); throw new Error('synthetic downstream failure'); })).rejects.toThrow('synthetic downstream failure') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:113 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:116 | expect(await prisma.reportSequence.findUnique({ where: { labId_year: { labId, year } } })).toEqual(before) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:114 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:117 | expect(await prisma.report.count({ where: { sampleId: f.sampleId } })).toBe(0) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:115 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:118 | expect((await generate(f)).reportNumberBase).toBe(reserved.reportNumberBase) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:119 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:122 | expect(publicationYear(instant, 'Europe/Rome')).toBe(2027) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:120 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:123 | expect(publicationYear(instant, 'America/Guatemala')).toBe(2026) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:121 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:124 | expect(publicationYear(instant, null)).toBe(2026) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:122 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:125 | expect(publicationYear(instant, 'invalid')).toBe(2026) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:131 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:134 | expect(db.prepare('SELECT * FROM Report').get()).toEqual({ id: 'old', content, reportNumberBase: null, revision: null }) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:133 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:136 | expect(() => db.prepare('INSERT INTO Report VALUES (?, ?, ?, ?)').run('two', '{}', 'base', 0)).toThrow(/UNIQUE/) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:134 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:137 | expect(db.prepare('SELECT count(*) AS n FROM ReportSequence').get().n).toBe(0) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:140 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:143 | expect(content.evidence.qc.withinLimits).toBe(false) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:141 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:144 | expect(content.qcStatement).toContain('PH_H2O') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:141 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:144 | expect(content.qcStatement).toContain(f.batch.id) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:142 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:145 | expect(content.qcStatement).toContain('Matrix effect reviewed') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:143 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:146 | expect(content.qcStatement).not.toBe(require('../../locales/en.json').resultReports.qcWithinLimits) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:145 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:148 | expect(pass.evidence.qc.withinLimits).toBe(true) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:146 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:149 | expect(pass.qcStatement).toBe(require('../../locales/en.json').resultReports.qcWithinLimits) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:149 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:152 | expect(freezeReportEvidence([result], items, [{ id: 'pass', status: 'QC_PASS' }, { id: 'pending', status: 'RUNNING' }]).qc.withinLimits).toBe(false) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:154 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:157 | expect(content.qcStatement).toContain('RUNNING') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:154 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:157 | expect(content.evidence.qc.withinLimits).toBe(false) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:156 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:159 | expect(missing.qc.withinLimits).toBe(false) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:156 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:159 | expect(missing.qc.deviations[0].qcStatus).toBe('NOT_RECORDED') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:162 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:165 | expect(text.preparationStatement).toContain(labels.notRecorded) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:166 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:169 | expect(pdf.subarray(0, 5).toString()).toBe('%PDF-') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:168 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:171 | expect(values).toContain('Issue Date: 2021-02-03') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:168 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:171 | expect(values).toContain('Status: SUPERSEDED') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:169 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:172 | expect(values.some(value => value.includes(labels.superseded) && value.includes('exact-old rev 1'))).toBe(true) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:170 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:173 | expect(values).toContain(text.qcStatement) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:170 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:173 | expect(values).toContain(text.preparationStatement) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:171 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:174 | expect(values.join('\n')).not.toMatch(/40°C\|ISO 11464\|All batch Quality Control checks/) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:176 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:179 | expect(share.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:180 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:183 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:181 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:184 | expect(text.mock.calls.some(([value]) => String(value).includes('SUPERSEDED') && String(value).includes('${second.reportNumberBase} rev 1'))).toBe(true) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:184 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:187 | expect(publicPdf.status).toBe(410) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:185 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:188 | expect(publicPdf.body.code).toBe('REPORT_SUPERSEDED') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:186 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:189 | expect(text).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:192 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:195 | expect(evidence.preparation[0].recordedBy).toBe('analyst') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:193 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:196 | expect(describeReportEvidence(evidence).preparationStatement).toContain('Actual sieve: 2 mm') | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:194 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:197 | expect(freezeReportEvidence([], [{ ...item, result: JSON.stringify({ ...receipt, checks: [true, false] }) }], []).preparation).toEqual([]) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:195 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:198 | expect(freezeReportEvidence([], [{ ...item, result: JSON.stringify({ ...receipt, steps: [] }) }], []).preparation).toEqual([]) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:196 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:199 | expect(describeReportEvidence(freezeReportEvidence([], [], [])).preparationStatement).toMatch(/not recorded/i) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:202 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:205 | expect(pages).toHaveBeenCalledTimes(1) | Retained |
| server/tests/contracts/audit_0_8_report_truthfulness.test.js:203 | server/tests/contracts/audit_0_8_report_truthfulness.test.js:206 | expect(text.mock.calls.filter(([value]) => String(value).includes('2021-02-03'))).toHaveLength(2) | Retained |

## server/tests/contracts/audit_1_0_lab_policies.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_1_0_lab_policies.test.js:29 | server/tests/contracts/audit_1_0_lab_policies.test.js:29 | expect(current.version).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:29 | server/tests/contracts/audit_1_0_lab_policies.test.js:29 | expect(current.presetCode).toBeNull() | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:31 | server/tests/contracts/audit_1_0_lab_policies.test.js:31 | expect(current.values[key]).not.toBeUndefined() | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:32 | server/tests/contracts/audit_1_0_lab_policies.test.js:32 | expect(await policy.get(labId, key)).toEqual(registry[key].presets.ISO17025_STRICT) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:34 | server/tests/contracts/audit_1_0_lab_policies.test.js:34 | expect(await prisma.labPolicy.count({ where: { labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:36 | server/tests/contracts/audit_1_0_lab_policies.test.js:36 | expect(await policy.get(lab.code, 'qc.mode')).toBe('REQUIRED_BLOCKING') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:41 | server/tests/contracts/audit_1_0_lab_policies.test.js:41 | expect(await policy.get(labId, 'qc.duplicateMaxRpd')).toBe(10) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:42 | server/tests/contracts/audit_1_0_lab_policies.test.js:42 | expect(await policy.get(labId, 'qc.duplicateMaxRpd', context)).toBe(22) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:44 | server/tests/contracts/audit_1_0_lab_policies.test.js:44 | expect(await policy.get(labId, 'qc.duplicateMaxRpd', context)).toBe(10) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:46 | server/tests/contracts/audit_1_0_lab_policies.test.js:46 | expect(await policy.get(labId, 'qc.duplicateMaxRpd', context)).toBe(12) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:48 | server/tests/contracts/audit_1_0_lab_policies.test.js:48 | expect((await policy.resolve(labId, 'qc.duplicateMaxRpd', context)).source).toBe('ANALYSIS_OVERRIDE') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:49 | server/tests/contracts/audit_1_0_lab_policies.test.js:49 | expect(await policy.get(labId, 'qc.duplicateMaxRpd', context)).toBe(13) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:51 | server/tests/contracts/audit_1_0_lab_policies.test.js:51 | expect(await policy.resolve(labId, 'qc.duplicateMaxRpd', context)).toMatchObject({ value: 14, source: 'METHOD_OVERRIDE', version: 4, scope: { analysisCode, methodologyId } }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:52 | server/tests/contracts/audit_1_0_lab_policies.test.js:52 | expect(await policy.get(labId, 'qc.duplicateMaxRpd', { profile, analysisCode })).toBe(13) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:53 | server/tests/contracts/audit_1_0_lab_policies.test.js:53 | expect(await policy.get(labId, 'qc.duplicateMaxRpd', { profile })).toBe(12) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:58 | server/tests/contracts/audit_1_0_lab_policies.test.js:58 | expect(first).toMatchObject({ version: 1, presetCode: null }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:58 | server/tests/contracts/audit_1_0_lab_policies.test.js:58 | expect(first.values['bench.idleLockMinutes']).toBe(27) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:60 | server/tests/contracts/audit_1_0_lab_policies.test.js:60 | expect(explicit.values['bench.idleLockMinutes']).toBe(5) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:62 | server/tests/contracts/audit_1_0_lab_policies.test.js:62 | expect(inherited.values['bench.idleLockMinutes']).toBe(27) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:62 | server/tests/contracts/audit_1_0_lab_policies.test.js:62 | expect(inherited.values['qc.duplicateMaxRpd']).toBe(17) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:63 | server/tests/contracts/audit_1_0_lab_policies.test.js:63 | expect(await prisma.labPolicyOverride.count({ where: { labId, revokedAt: null } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:69 | server/tests/contracts/audit_1_0_lab_policies.test.js:69 | expect(second.version).toBe(2) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:71 | server/tests/contracts/audit_1_0_lab_policies.test.js:71 | expect(historical).toMatchObject({ value: old.value, reason: old.reason, setBy: old.setBy, setAt: old.setAt }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:72 | server/tests/contracts/audit_1_0_lab_policies.test.js:72 | expect(historical.revokedAt).toBeInstanceOf(Date) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:74 | server/tests/contracts/audit_1_0_lab_policies.test.js:74 | expect(logs).toHaveLength(2) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:75 | server/tests/contracts/audit_1_0_lab_policies.test.js:75 | expect(JSON.parse(logs[1].before).values['qc.duplicateMaxRpd']).toBe(12) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:76 | server/tests/contracts/audit_1_0_lab_policies.test.js:76 | expect(JSON.parse(logs[1].after).values['qc.duplicateMaxRpd']).toBe(13) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:77 | server/tests/contracts/audit_1_0_lab_policies.test.js:77 | expect(JSON.parse(logs[1].details)).toMatchObject({ reason: 'Laboratory approved policy', policyVersion: 2 }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:78 | server/tests/contracts/audit_1_0_lab_policies.test.js:78 | expect(edit([{ key: 'qc.duplicateMaxRpd', value: 14 }], { expectedVersion: 1 })).rejects.toMatchObject({ statusCode: 409, code: 'POLICY_VERSION_CONFLICT' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:79 | server/tests/contracts/audit_1_0_lab_policies.test.js:79 | expect(await prisma.auditLog.count({ where: { labId } })).toBe(2) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:85 | server/tests/contracts/audit_1_0_lab_policies.test.js:85 | expect(result.status).toBe(400) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:85 | server/tests/contracts/audit_1_0_lab_policies.test.js:85 | expect(result.body.code).toBe('POLICY_VALUE_INVALID') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:86 | server/tests/contracts/audit_1_0_lab_policies.test.js:86 | expect(await prisma.labPolicy.count({ where: { labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:86 | server/tests/contracts/audit_1_0_lab_policies.test.js:86 | expect(await prisma.auditLog.count({ where: { labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:89 | server/tests/contracts/audit_1_0_lab_policies.test.js:89 | expect(edit([{ key: 'qc.mode', value: 'ADVISORY' }], { reason: '' })).rejects.toMatchObject({ statusCode: 400, code: 'POLICY_REASON_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:91 | server/tests/contracts/audit_1_0_lab_policies.test.js:91 | expect(edit([{ key: 'qc.mode', value: 'OFF', methodologyId }])).rejects.toMatchObject({ statusCode: 422, code: 'POLICY_SCOPE_INVALID' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:92 | server/tests/contracts/audit_1_0_lab_policies.test.js:92 | expect(edit([{ key: 'qc.mode', value: 'OFF', analysisCode, methodologyId: 'foreign' }])).rejects.toMatchObject({ code: 'POLICY_SCOPE_INVALID' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:93 | server/tests/contracts/audit_1_0_lab_policies.test.js:93 | expect(edit([{ key: 'numbers.decimalSeparator', value: ',', analysisCode }])).rejects.toMatchObject({ code: 'POLICY_SCOPE_INVALID' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:98 | server/tests/contracts/audit_1_0_lab_policies.test.js:98 | expect(await policy.get(labId, 'qc.mode')).toBe('ADVISORY') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:98 | server/tests/contracts/audit_1_0_lab_policies.test.js:98 | expect(await policy.get(foreign, 'qc.mode')).toBe('REQUIRED_BLOCKING') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:99 | server/tests/contracts/audit_1_0_lab_policies.test.js:99 | expect((await request(app).get('/api/labs/${labId}/policies').set('Authorization', 'Bearer ${technician}')).body.canEdit).toBe(false) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:100 | server/tests/contracts/audit_1_0_lab_policies.test.js:100 | expect((await request(app).patch('/api/labs/${labId}/policies').set('Authorization', 'Bearer ${technician}').send({ presetCode: 'BASIC', reason: 'No permission' })).status).toBe(403) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:101 | server/tests/contracts/audit_1_0_lab_policies.test.js:101 | expect((await request(app).get('/api/labs/${foreign}/policies').set('Authorization', 'Bearer ${manager}')).status).toBe(403) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:102 | server/tests/contracts/audit_1_0_lab_policies.test.js:102 | expect(policy.change(actor, foreign, { presetCode: 'BASIC', reason: 'Foreign change' })).rejects.toMatchObject({ statusCode: 403 }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:106 | server/tests/contracts/audit_1_0_lab_policies.test.js:106 | expect((await patch({ decimalSeparator: ',' })).body.code).toBe('POLICY_REASON_REQUIRED') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:107 | server/tests/contracts/audit_1_0_lab_policies.test.js:107 | expect((await patch({ decimalSeparator: ',', thousandsSeparator: '.', reason: 'Local number format', expectedVersion: 0 })).status).toBe(200) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:108 | server/tests/contracts/audit_1_0_lab_policies.test.js:108 | expect(await getNumberFormat(labId)).toEqual({ decimal: ',', thousands: '.' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:109 | server/tests/contracts/audit_1_0_lab_policies.test.js:109 | expect(await prisma.auditLog.count({ where: { labId } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:111 | server/tests/contracts/audit_1_0_lab_policies.test.js:111 | expect(await getNumberFormat(labId)).toEqual({ decimal: ',', thousands: '.' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:112 | server/tests/contracts/audit_1_0_lab_policies.test.js:112 | expect((await patch({ decimalSeparator: '.', thousandsSeparator: null, reason: 'Stale editor', expectedVersion: 0 })).body.code).toBe('POLICY_VERSION_CONFLICT') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:113 | server/tests/contracts/audit_1_0_lab_policies.test.js:113 | expect(await getNumberFormat(labId)).toEqual({ decimal: ',', thousands: '.' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:122 | server/tests/contracts/audit_1_0_lab_policies.test.js:122 | expect(dry).toMatchObject({ mode: 'DRY_RUN', counts: { labsScanned: 2, labsToChange: 1, inheritedRowsToCreate: 1, explicitRowsToCreate: 0, overridesToCreate: 2, invalidLabs: 0 } }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:123 | server/tests/contracts/audit_1_0_lab_policies.test.js:123 | expect(await prisma.labPolicy.count({ where: { labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:125 | server/tests/contracts/audit_1_0_lab_policies.test.js:125 | expect(applied.auditRowsCreated).toBe(1) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:126 | server/tests/contracts/audit_1_0_lab_policies.test.js:126 | expect(await prisma.labPolicy.findUnique({ where: { labId } })).toMatchObject({ presetCode: null, version: 1 }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:127 | server/tests/contracts/audit_1_0_lab_policies.test.js:127 | expect(await prisma.labPolicy.count({ where: { labId: untouched } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:128 | server/tests/contracts/audit_1_0_lab_policies.test.js:128 | expect((await prisma.lab.findUnique({ where: { id: labId } })).settings).toBe(settings) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:129 | server/tests/contracts/audit_1_0_lab_policies.test.js:129 | expect(await getNumberFormat(labId)).toEqual({ decimal: ',', thousands: '.' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:130 | server/tests/contracts/audit_1_0_lab_policies.test.js:130 | expect((await migrateLegacyNumberPolicies({ db })).counts).toMatchObject({ labsToChange: 0, overridesToCreate: 0, existingKeysSkipped: 2 }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:131 | server/tests/contracts/audit_1_0_lab_policies.test.js:131 | expect((await migrateLegacyNumberPolicies({ db, apply: true })).auditRowsCreated).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:133 | server/tests/contracts/audit_1_0_lab_policies.test.js:133 | expect(row.reason).toBe('migrated from Lab.settings') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:141 | server/tests/contracts/audit_1_0_lab_policies.test.js:141 | expect(edit([{ key: 'qc.duplicateMaxRpd', value: 13 }])).rejects.toThrow('Simulated audit storage failure') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:143 | server/tests/contracts/audit_1_0_lab_policies.test.js:143 | expect((await policy.snapshot(labId)).version).toBe(1) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:144 | server/tests/contracts/audit_1_0_lab_policies.test.js:144 | expect(await prisma.labPolicyOverride.findUnique({ where: { id: previous.id } })).toEqual(previous) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:145 | server/tests/contracts/audit_1_0_lab_policies.test.js:145 | expect(await prisma.labPolicyOverride.count({ where: { labId } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:146 | server/tests/contracts/audit_1_0_lab_policies.test.js:146 | expect(await prisma.auditLog.count({ where: { labId } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:152 | server/tests/contracts/audit_1_0_lab_policies.test.js:152 | expect(JSON.parse(lab.settings)).toEqual({ language: 'fr', unrelated: 42, decimalSeparator: ',', thousandsSeparator: null }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:154 | server/tests/contracts/audit_1_0_lab_policies.test.js:154 | expect(JSON.parse(log.details).compatibilityCopy).toMatchObject({ written: true, after: { decimalSeparator: ',', thousandsSeparator: null } }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:157 | server/tests/contracts/audit_1_0_lab_policies.test.js:157 | expect(JSON.parse(lab.settings)).toEqual({ language: 'fr', unrelated: 42, decimalSeparator: '.', thousandsSeparator: null }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:158 | server/tests/contracts/audit_1_0_lab_policies.test.js:158 | expect(await prisma.auditLog.count({ where: { labId } })).toBe(2) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:158 | server/tests/contracts/audit_1_0_lab_policies.test.js:158 | expect((await policy.snapshot(labId)).version).toBe(2) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:164 | server/tests/contracts/audit_1_0_lab_policies.test.js:164 | expect(await getNumberFormat(labId, { snapshot: recorded })).toEqual({ decimal: ',', thousands: '.' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:165 | server/tests/contracts/audit_1_0_lab_policies.test.js:165 | expect(await getNumberFormat(labId)).toEqual({ decimal: '.', thousands: ',' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:166 | server/tests/contracts/audit_1_0_lab_policies.test.js:166 | expect(recorded.version).toBe(1) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:174 | server/tests/contracts/audit_1_0_lab_policies.test.js:174 | expect(JSON.parse(copied)).toEqual({ language: 'fr', decimalSeparator: '.', thousandsSeparator: null }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:176 | server/tests/contracts/audit_1_0_lab_policies.test.js:176 | expect((await prisma.lab.findUnique({ where: { id: labId } })).settings).toBe(copied) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:178 | server/tests/contracts/audit_1_0_lab_policies.test.js:178 | expect(JSON.parse((await prisma.lab.findUnique({ where: { id: labId } })).settings).decimalSeparator).toBe(',') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:182 | server/tests/contracts/audit_1_0_lab_policies.test.js:182 | expect(edit([{ key: 'numbers.decimalSeparator', value: ',' }])).rejects.toMatchObject({ statusCode: 409, code: 'LAB_SETTINGS_INVALID' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:183 | server/tests/contracts/audit_1_0_lab_policies.test.js:183 | expect((await prisma.lab.findUnique({ where: { id: labId } })).settings).toBe(settings) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:184 | server/tests/contracts/audit_1_0_lab_policies.test.js:184 | expect(await prisma.labPolicy.count({ where: { labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:184 | server/tests/contracts/audit_1_0_lab_policies.test.js:184 | expect(await prisma.labPolicyOverride.count({ where: { labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:185 | server/tests/contracts/audit_1_0_lab_policies.test.js:185 | expect(await prisma.auditLog.count({ where: { labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:195 | server/tests/contracts/audit_1_0_lab_policies.test.js:195 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:195 | server/tests/contracts/audit_1_0_lab_policies.test.js:195 | expect(response.body.data[0].SOC).toBe(20) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:196 | server/tests/contracts/audit_1_0_lab_policies.test.js:196 | expect(response.body.meta.selectionPolicies).toEqual([expect.objectContaining({ labId, version: 1, rule: 'LATEST_VALID', source: 'LAB_OVERRIDE' })]) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:198 | server/tests/contracts/audit_1_0_lab_policies.test.js:198 | expect(log.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:199 | server/tests/contracts/audit_1_0_lab_policies.test.js:199 | expect(log.entityId).toBe(response.body.meta.exportId) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:200 | server/tests/contracts/audit_1_0_lab_policies.test.js:200 | expect(JSON.parse(log.details).selectionPolicies[0]).toMatchObject({ labId, version: 1, rule: 'LATEST_VALID' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:202 | server/tests/contracts/audit_1_0_lab_policies.test.js:202 | expect(await prisma.auditLog.findUnique({ where: { id: log.id } })).toEqual(log) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:213 | server/tests/contracts/audit_1_0_lab_policies.test.js:215 | expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:215 | server/tests/contracts/audit_1_0_lab_policies.test.js:218 | expect(JSON.parse(evaluated.qcResults)).toMatchObject({ overallStatus: 'QC_PASS', policyVersion: 1, policyValues: { 'qc.blankMaxAllowed': .2, 'qc.controlMinRecovery': 80, 'qc.controlMaxRecovery': 120, 'qc.duplicateMaxRpd': 30 } }) | Translated: expect(require('../../services/qcRunViewService').batchApiView(normalized).qcResults).toMatchObject({ overallStatus: 'QC_PASS', policyVersion: 1, policyValues: { 'qc.blankMaxAllowed': .2, 'qc.controlMinRecovery': 80, 'qc.controlMaxRecovery': 120, 'qc.duplicateMaxRpd': 30 } }) |
| server/tests/contracts/audit_1_0_lab_policies.test.js:219 | server/tests/contracts/audit_1_0_lab_policies.test.js:222 | expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(evaluated) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:220 | server/tests/contracts/audit_1_0_lab_policies.test.js:223 | expect(await prisma.batchQcResult.findMany({ where: { batchId: batch.id }, orderBy: { id: 'asc' } })).toEqual(typed) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:227 | server/tests/contracts/audit_1_0_lab_policies.test.js:230 | expect(response.status).toBe(201) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:228 | server/tests/contracts/audit_1_0_lab_policies.test.js:231 | expect(response.body).toMatchObject({ profile: 'CUSTOM', maxCapacity: 7 }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:237 | server/tests/contracts/audit_1_0_lab_policies.test.js:240 | expect({ status: response.status, body: response.body }).toMatchObject({ status: 200 }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:239 | server/tests/contracts/audit_1_0_lab_policies.test.js:242 | expect(report.policyVersion).toBe(1) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:239 | server/tests/contracts/audit_1_0_lab_policies.test.js:242 | expect(JSON.parse(report.content).policy).toMatchObject({ version: 1, presetCode: 'ADVISORY' }) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:241 | server/tests/contracts/audit_1_0_lab_policies.test.js:244 | expect(await prisma.report.findUnique({ where: { id: report.id } })).toEqual(report) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:247 | server/tests/contracts/audit_1_0_lab_policies.test.js:250 | expect(valid(key, value)).toBe(true) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:248 | server/tests/contracts/audit_1_0_lab_policies.test.js:251 | expect(policy.getStrict('qc.runProfiles')).toEqual(DEFAULT_RUN_PROFILES) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:249 | server/tests/contracts/audit_1_0_lab_policies.test.js:252 | expect(evaluateBlank({ value: .04 }).status).toBe('PASS') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:250 | server/tests/contracts/audit_1_0_lab_policies.test.js:253 | expect(evaluateControl({ expected: 100, measured: 95 }).status).toBe('PASS') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:251 | server/tests/contracts/audit_1_0_lab_policies.test.js:254 | expect(evaluateDuplicate({ value1: 100, value2: 100 }).status).toBe('PASS') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:253 | server/tests/contracts/audit_1_0_lab_policies.test.js:256 | expect(resolveRunProfile('SOC', '', null, 'toString').profileKey).toBe('RACK_40') | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:259 | server/tests/contracts/audit_1_0_lab_policies.test.js:262 | expect(source).not.toMatch(/\b0\.05\b\|\b90(?:\.0)?\b\|\b110(?:\.0)?\b/) | Retained |
| server/tests/contracts/audit_1_0_lab_policies.test.js:260 | server/tests/contracts/audit_1_0_lab_policies.test.js:263 | expect(source).not.toMatch(/(?:maxRpd\|RPD)\s*[:=][^\n]*\b10\b/) | Retained |

## server/tests/contracts/audit_1_2_guard_installer.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_1_2_guard_installer.test.js:30 | server/tests/contracts/audit_1_2_guard_installer.test.js:30 | expect(child.error).toBeUndefined() | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:34 | server/tests/contracts/audit_1_2_guard_installer.test.js:34 | expect(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger'").all()).toEqual([]) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:35 | server/tests/contracts/audit_1_2_guard_installer.test.js:35 | expect(db.prepare('SELECT COUNT(*) AS n FROM Sample').get().n).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:53 | server/tests/contracts/audit_1_2_guard_installer.test.js:53 | expect(child.error).toBeUndefined() | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:57 | server/tests/contracts/audit_1_2_guard_installer.test.js:57 | expect(child.status).not.toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:59 | server/tests/contracts/audit_1_2_guard_installer.test.js:59 | expect(error.error).toBe(code) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:60 | server/tests/contracts/audit_1_2_guard_installer.test.js:60 | expect(fingerprint(file)).toBe(before) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:61 | server/tests/contracts/audit_1_2_guard_installer.test.js:61 | expect(child.stdout).toBe('') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:78 | server/tests/contracts/audit_1_2_guard_installer.test.js:78 | expect(fs.statSync(immutable.path).mode & 0o222).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:80 | server/tests/contracts/audit_1_2_guard_installer.test.js:80 | expect(dry.status).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:80 | server/tests/contracts/audit_1_2_guard_installer.test.js:80 | expect(dry.stderr).toBe('') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:82 | server/tests/contracts/audit_1_2_guard_installer.test.js:82 | expect(report).toMatchObject({ mode: 'DRY_RUN', schemaReady: false, blockedCount: 0 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:83 | server/tests/contracts/audit_1_2_guard_installer.test.js:83 | expect(fingerprint(immutable.path)).toBe(immutable.sha256) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:84 | server/tests/contracts/audit_1_2_guard_installer.test.js:84 | expect(fs.existsSync('${immutable.path}${suffix}')).toBe(false) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:124 | server/tests/contracts/audit_1_2_guard_installer.test.js:124 | expect(stdout).toContain('Enterprise Server running on') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:129 | server/tests/contracts/audit_1_2_guard_installer.test.js:129 | expect(accepted).toBe(true) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:131 | server/tests/contracts/audit_1_2_guard_installer.test.js:131 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:131 | server/tests/contracts/audit_1_2_guard_installer.test.js:131 | expect(await response.json()).toMatchObject({ status: 'ok' }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:148 | server/tests/contracts/audit_1_2_guard_installer.test.js:148 | expect(fs.realpathSync(path.dirname(directory))).toBe(fs.realpathSync(tmp)) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:149 | server/tests/contracts/audit_1_2_guard_installer.test.js:149 | expect(path.basename(directory)).toMatch(/^installer_sources_/) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:160 | server/tests/contracts/audit_1_2_guard_installer.test.js:160 | expect(dry.status).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:161 | server/tests/contracts/audit_1_2_guard_installer.test.js:161 | expect(JSON.parse(dry.stdout)).toMatchObject({ mode: 'DRY_RUN', classification: 'FRESH_PRISMA', inventory: { candidateCount: 0, unmappedCount: 0, blockedCount: 0 } }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:163 | server/tests/contracts/audit_1_2_guard_installer.test.js:163 | expect(fingerprint(file)).toBe(drySha) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:164 | server/tests/contracts/audit_1_2_guard_installer.test.js:164 | expect(child.status).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:166 | server/tests/contracts/audit_1_2_guard_installer.test.js:166 | expect(outcome).toMatchObject({ mode: 'APPLIED', classification: 'FRESH_PRISMA', totalChanges: 1, postflight: { integrity: 'ok', foreignKeyViolations: [], marker: { id: MARKER, details } } }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:168 | server/tests/contracts/audit_1_2_guard_installer.test.js:168 | expect(outcome.postflight.guards).toHaveLength(11) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:173 | server/tests/contracts/audit_1_2_guard_installer.test.js:173 | expect(db.prepare('SELECT * FROM _schema_migrations WHERE id=?').get('v3_lab_operations_20260906')) .toEqual({ id: 'v3_lab_operations_20260906', appliedAt: '2026-09-06 14:15:52', details: 'original marker bytes' }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:183 | server/tests/contracts/audit_1_2_guard_installer.test.js:183 | expect(noop).toMatchObject({ mode: 'NO_OP', classification: 'COMPLETE', totalChanges: 0, statements: [] }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:184 | server/tests/contracts/audit_1_2_guard_installer.test.js:184 | expect(counters.length).toBeGreaterThan(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:184 | server/tests/contracts/audit_1_2_guard_installer.test.js:184 | expect(counters.every(n => n === 0)).toBe(true) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:185 | server/tests/contracts/audit_1_2_guard_installer.test.js:185 | expect(fingerprint(file)).toBe(before) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:186 | server/tests/contracts/audit_1_2_guard_installer.test.js:186 | expect(second.status).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:187 | server/tests/contracts/audit_1_2_guard_installer.test.js:187 | expect(JSON.parse(second.stdout)).toMatchObject({ mode: 'NO_OP', classification: 'COMPLETE', totalChanges: 0 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:188 | server/tests/contracts/audit_1_2_guard_installer.test.js:188 | expect(fingerprint(file)).toBe(before) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:199 | server/tests/contracts/audit_1_2_guard_installer.test.js:199 | expect(dry.status).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:200 | server/tests/contracts/audit_1_2_guard_installer.test.js:200 | expect(JSON.parse(dry.stdout)).toMatchObject({ classification: 'PRE_179', mode: 'DRY_RUN', inventory: { candidateCount: 0, unmappedCount: 0, blockedCount: 0 } }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:202 | server/tests/contracts/audit_1_2_guard_installer.test.js:202 | expect(fingerprint(snapshot.path)).toBe(snapshot.sha256) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:202 | server/tests/contracts/audit_1_2_guard_installer.test.js:202 | expect(before).toBe(snapshot.sha256) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:205 | server/tests/contracts/audit_1_2_guard_installer.test.js:205 | expect(db.prepare('SELECT value,numericValue,unit FROM Result WHERE id=?').get('r-${id}')).toEqual({ value: '1.8', numericValue: 1.8, unit: '%' }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:206 | server/tests/contracts/audit_1_2_guard_installer.test.js:206 | expect(db.prepare('SELECT history,status FROM Sample WHERE id=?').get(id)).toEqual({ history: '[{"original":true}]', status: 'ACCEPTED' }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:207 | server/tests/contracts/audit_1_2_guard_installer.test.js:207 | expect(db.prepare('SELECT details FROM _schema_migrations WHERE id=?').get(MARKER).details).toBe(details) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:216 | server/tests/contracts/audit_1_2_guard_installer.test.js:216 | expect(error).toMatchObject({ code: 'WORKFLOW_STATUS_PLAN_REQUIRED', exitStatus: 1 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:217 | server/tests/contracts/audit_1_2_guard_installer.test.js:217 | expect(error.afterSha).toBe(error.beforeSha) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:217 | server/tests/contracts/audit_1_2_guard_installer.test.js:217 | expect(error.beforeSha).toMatch(/^[a-f0-9]{64}$/) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:218 | server/tests/contracts/audit_1_2_guard_installer.test.js:218 | expect(fs.existsSync(file)).toBe(false) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:223 | server/tests/contracts/audit_1_2_guard_installer.test.js:223 | expect(record.report).toMatchObject({ candidateCount: 3, unmappedCount: 0, blockedCount: 0 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:227 | server/tests/contracts/audit_1_2_guard_installer.test.js:227 | expect(before.Sample.find(row => row.id === record.id).status).toBe('COLLECTED') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:228 | server/tests/contracts/audit_1_2_guard_installer.test.js:228 | expect(before.WorkItem[0]).toMatchObject({ status: 'PENDING', version: 7, legacyStatus: null }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:231 | server/tests/contracts/audit_1_2_guard_installer.test.js:231 | expect(pending.differences[0]).toMatchObject({ candidateCount: 3, blockedCount: 0, unmappedCount: 0 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:234 | server/tests/contracts/audit_1_2_guard_installer.test.js:234 | expect(legacyRows(fixture.file)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:239 | server/tests/contracts/audit_1_2_guard_installer.test.js:239 | expect(mapped.status).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:239 | server/tests/contracts/audit_1_2_guard_installer.test.js:239 | expect(mapped.stderr).toBe('') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:240 | server/tests/contracts/audit_1_2_guard_installer.test.js:240 | expect(JSON.parse(mapped.stdout)).toMatchObject({ mode: 'APPLIED', changedRows: 3, auditsAdded: 3, unmappedCount: 0 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:242 | server/tests/contracts/audit_1_2_guard_installer.test.js:242 | expect(after[table]).toEqual(before[table]) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:245 | server/tests/contracts/audit_1_2_guard_installer.test.js:245 | expect(row.status).toBe(candidate.to) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:245 | server/tests/contracts/audit_1_2_guard_installer.test.js:245 | expect(row.legacyStatus).toBe(original.status) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:248 | server/tests/contracts/audit_1_2_guard_installer.test.js:248 | expect(retained).toEqual(original) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:249 | server/tests/contracts/audit_1_2_guard_installer.test.js:249 | expect(row.version).toBe(original.version + 1) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:251 | server/tests/contracts/audit_1_2_guard_installer.test.js:251 | expect(after.AuditLog).toHaveLength(before.AuditLog.length + 3) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:252 | server/tests/contracts/audit_1_2_guard_installer.test.js:252 | expect(after.AuditLog.slice(0, before.AuditLog.length)).toEqual(before.AuditLog) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:253 | server/tests/contracts/audit_1_2_guard_installer.test.js:253 | expect(after.AuditLog.slice(before.AuditLog.length).every(row => row.performedBy === 'system:status-migration')).toBe(true) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:255 | server/tests/contracts/audit_1_2_guard_installer.test.js:255 | expect(startup.status).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:256 | server/tests/contracts/audit_1_2_guard_installer.test.js:256 | expect(JSON.parse(startup.stdout)).toMatchObject({ classification: 'COMPLETE', mode: 'NO_OP', totalChanges: 0, inventory: { candidateCount: 0, unmappedCount: 0, blockedCount: 0 }, postflight: { integrity: 'ok', foreignKeyViolations: [], marker: { id: MARKER, details } } }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:259 | server/tests/contracts/audit_1_2_guard_installer.test.js:259 | expect(fingerprint(fixture.file)).toBe(completedSha) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:259 | server/tests/contracts/audit_1_2_guard_installer.test.js:259 | expect(legacyRows(fixture.file)).toEqual(after) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:268 | server/tests/contracts/audit_1_2_guard_installer.test.js:268 | expect(error).toMatchObject({ code: 'WORKFLOW_STATUS_PLAN_STALE', exitStatus: 1 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:269 | server/tests/contracts/audit_1_2_guard_installer.test.js:269 | expect(error.beforeSha).toMatch(/^[a-f0-9]{64}$/) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:269 | server/tests/contracts/audit_1_2_guard_installer.test.js:269 | expect(error.afterSha).toBe(error.beforeSha) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:270 | server/tests/contracts/audit_1_2_guard_installer.test.js:270 | expect(fs.existsSync(file)).toBe(false) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:275 | server/tests/contracts/audit_1_2_guard_installer.test.js:275 | expect(record.report.unmappedCount).toBe(1) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:278 | server/tests/contracts/audit_1_2_guard_installer.test.js:278 | expect(error).toMatchObject({ code: 'WORKFLOW_STATUS_PLAN_REQUIRED', exitStatus: 1 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:279 | server/tests/contracts/audit_1_2_guard_installer.test.js:279 | expect(error.afterSha).toBe(error.beforeSha) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:279 | server/tests/contracts/audit_1_2_guard_installer.test.js:279 | expect(fs.existsSync(file)).toBe(false) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:293 | server/tests/contracts/audit_1_2_guard_installer.test.js:293 | expect(refused.differences[0]).toMatchObject({ blockedCount: 1 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:294 | server/tests/contracts/audit_1_2_guard_installer.test.js:294 | expect(legacyRows(fixture.file)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:314 | server/tests/contracts/audit_1_2_guard_installer.test.js:314 | expect(() => beforeGuards({ actor: 'system:fixture', ...record.rows, file, ...options })).toThrow() | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:315 | server/tests/contracts/audit_1_2_guard_installer.test.js:315 | expect(fs.existsSync(file)).toBe(false) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:322 | server/tests/contracts/audit_1_2_guard_installer.test.js:322 | expect(child).toMatchObject({ code: 1, accepted: false }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:323 | server/tests/contracts/audit_1_2_guard_installer.test.js:323 | expect(JSON.parse(child.stderr)).toMatchObject({ error: 'WORKFLOW_GUARDS_NOT_INSTALLED', nextStep: expect.any(String) }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:324 | server/tests/contracts/audit_1_2_guard_installer.test.js:324 | expect(child.stdout).not.toMatch(/SCHEDULER\|Enterprise Server\|\[PRISMA\]/) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:325 | server/tests/contracts/audit_1_2_guard_installer.test.js:325 | expect(fingerprint(file)).toBe(before) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:325 | server/tests/contracts/audit_1_2_guard_installer.test.js:325 | expect(record.report.candidateCount).toBe(3) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:330 | server/tests/contracts/audit_1_2_guard_installer.test.js:330 | expect(child).toMatchObject({ code: 1, accepted: false }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:331 | server/tests/contracts/audit_1_2_guard_installer.test.js:331 | expect(JSON.parse(child.stderr)).toMatchObject({ error: 'WORKFLOW_GUARDS_NOT_INSTALLED' }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:332 | server/tests/contracts/audit_1_2_guard_installer.test.js:332 | expect(child.stdout).not.toMatch(/SCHEDULER\|Enterprise Server\|\[PRISMA\]/) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:332 | server/tests/contracts/audit_1_2_guard_installer.test.js:332 | expect(fingerprint(file)).toBe(before) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:339 | server/tests/contracts/audit_1_2_guard_installer.test.js:339 | expect(child).toMatchObject({ code: 1, accepted: false }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:340 | server/tests/contracts/audit_1_2_guard_installer.test.js:340 | expect(JSON.parse(child.stderr)).toMatchObject({ error: 'WORKFLOW_STATUS_PLAN_PENDING' }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:341 | server/tests/contracts/audit_1_2_guard_installer.test.js:341 | expect(child.stdout).not.toMatch(/SCHEDULER\|Enterprise Server\|\[PRISMA\]/) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:341 | server/tests/contracts/audit_1_2_guard_installer.test.js:341 | expect(fingerprint(fixture.file)).toBe(before) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:347 | server/tests/contracts/audit_1_2_guard_installer.test.js:347 | expect(child).toMatchObject({ code: 1, accepted: false }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:349 | server/tests/contracts/audit_1_2_guard_installer.test.js:349 | expect(refused.error).toBe('WORKFLOW_GUARDS_SCHEMA_MISMATCH') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:350 | server/tests/contracts/audit_1_2_guard_installer.test.js:350 | expect(refused.differences.some(item => item.object === 'Sample_status_insert_guard')).toBe(true) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:351 | server/tests/contracts/audit_1_2_guard_installer.test.js:351 | expect(child.stdout).not.toMatch(/SCHEDULER\|Enterprise Server\|\[PRISMA\]/) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:351 | server/tests/contracts/audit_1_2_guard_installer.test.js:351 | expect(fingerprint(file)).toBe(before) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:356 | server/tests/contracts/audit_1_2_guard_installer.test.js:356 | expect(child).toMatchObject({ code: 1, accepted: false }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:357 | server/tests/contracts/audit_1_2_guard_installer.test.js:357 | expect(JSON.parse(child.stderr)).toMatchObject({ error: 'DATABASE_NOT_FOUND' }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:358 | server/tests/contracts/audit_1_2_guard_installer.test.js:358 | expect(child.stdout).not.toMatch(/SCHEDULER\|Enterprise Server\|\[PRISMA\]/) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:358 | server/tests/contracts/audit_1_2_guard_installer.test.js:358 | expect(fs.existsSync(file)).toBe(false) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:368 | server/tests/contracts/audit_1_2_guard_installer.test.js:382 | expect(child.accepted).toBe(true) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:370 | server/tests/contracts/audit_1_2_guard_installer.test.js:384 | expect(ready).toMatchObject({ classification: 'COMPLETE', totalChanges: 0, inventory: { candidateCount: 0, unmappedCount: 0, blockedCount: 0 } }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:374 | server/tests/contracts/audit_1_2_guard_installer.test.js:388 | expect(child.stdout.indexOf('WORKFLOW_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on')) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:376 | server/tests/contracts/audit_1_2_guard_installer.test.js:390 | expect(holdsReady).toMatchObject({ classification: 'COMPLETE', totalChanges: 0 }) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:377 | server/tests/contracts/audit_1_2_guard_installer.test.js:391 | expect(child.stdout.indexOf('SAMPLE_HOLD_STARTUP_READY')).toBeLessThan(child.stdout.indexOf('Enterprise Server running on')) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:390 | server/tests/contracts/audit_1_2_guard_installer.test.js:407 | expect(error.differences.length).toBeGreaterThan(0) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:391 | server/tests/contracts/audit_1_2_guard_installer.test.js:408 | expect(JSON.stringify(error.differences)).toContain('objects match the source but the marker is absent') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:404 | server/tests/contracts/audit_1_2_guard_installer.test.js:421 | expect(fingerprint(target)).toBe(definition.sha256) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:411 | server/tests/contracts/audit_1_2_guard_installer.test.js:428 | expect(dockerfile).toContain( 'COPY server/prisma/migrations/${definition.directory}/migration.sql /app/server/.migrations-backup/179/${definition.directory}/migration.sql') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:423 | server/tests/contracts/audit_1_2_guard_installer.test.js:440 | expect(entry.indexOf('node scripts/install_workflow_state_guards.js --apply')).toBeGreaterThan(entry.indexOf('node scripts/migrate_sitewide_theme_library.js')) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:424 | server/tests/contracts/audit_1_2_guard_installer.test.js:441 | expect(entry.indexOf('node scripts/install_workflow_state_guards.js --apply')).toBeLessThan(entry.indexOf('exec node index.js')) | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:425 | server/tests/contracts/audit_1_2_guard_installer.test.js:442 | expect(entry).toContain('set -e') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:427 | server/tests/contracts/audit_1_2_guard_installer.test.js:444 | expect(() => parseArguments(args)).toThrow() | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:428 | server/tests/contracts/audit_1_2_guard_installer.test.js:445 | expect(entry).not.toContain('--reviewed-status-sha256') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:429 | server/tests/contracts/audit_1_2_guard_installer.test.js:446 | expect(() => beforeGuards({ actor: 'system:fixture', installWorkflowStateGuards: option })).toThrow('default schema-only') | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:432 | server/tests/contracts/audit_1_2_guard_installer.test.js:449 | expect(() => beforeGuards({ actor: 'system:fixture', file, ...options })).toThrow() | Retained |
| server/tests/contracts/audit_1_2_guard_installer.test.js:433 | server/tests/contracts/audit_1_2_guard_installer.test.js:450 | expect(fs.existsSync(file)).toBe(false) | Retained |

## server/tests/contracts/audit_1_2_state_authority.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_1_2_state_authority.test.js:32 | server/tests/contracts/audit_1_2_state_authority.test.js:32 | expect(audit).toHaveLength(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:33 | server/tests/contracts/audit_1_2_state_authority.test.js:33 | expect(audit[0]).toMatchObject({ entity: 'SAMPLE', action: 'CREATE_KOBO_SYNC', performedBy: manager.username, sampleId: sample.id }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:34 | server/tests/contracts/audit_1_2_state_authority.test.js:34 | expect(JSON.parse(audit[0].details)).toEqual({ status: 'EXPECTED', context: 'ordinary' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:46 | server/tests/contracts/audit_1_2_state_authority.test.js:46 | expect(request()).rejects.toMatchObject({ statusCode: 400, code: 'WORKFLOW_RELATION_WRITE_REFUSED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:47 | server/tests/contracts/audit_1_2_state_authority.test.js:47 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:53 | server/tests/contracts/audit_1_2_state_authority.test.js:53 | expect(outcome.removed).toEqual(['PH_H2O']) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:54 | server/tests/contracts/audit_1_2_state_authority.test.js:54 | expect(await client.workItem.findUnique({ where: { id: item.id } })).toBeNull() | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:56 | server/tests/contracts/audit_1_2_state_authority.test.js:56 | expect(audit).toHaveLength(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:57 | server/tests/contracts/audit_1_2_state_authority.test.js:57 | expect(audit[0]).toMatchObject({ analysisCode: item.analysis, labId: manager.labId, sampleId: sample.id, performedBy: manager.username }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:58 | server/tests/contracts/audit_1_2_state_authority.test.js:58 | expect(JSON.parse(audit[0].before)).toEqual([expect.objectContaining({ id: item.id, analysisCode: item.analysis, labId: manager.labId })]) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:64 | server/tests/contracts/audit_1_2_state_authority.test.js:64 | expect(samples.transitionSample(current.sample.id, current.sample.status, manager, null, { workItems: { [command]: [{ id: other.item.id }] } }, client)) .rejects.toMatchObject({ statusCode: 400, code: 'WORKFLOW_RELATION_WRITE_REFUSED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:67 | server/tests/contracts/audit_1_2_state_authority.test.js:67 | expect(await snapshot(current.sample.id)).toEqual(beforeCurrent) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:67 | server/tests/contracts/audit_1_2_state_authority.test.js:67 | expect(await snapshot(other.sample.id)).toEqual(beforeOther) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:73 | server/tests/contracts/audit_1_2_state_authority.test.js:73 | expect(removed.count).toBe(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:74 | server/tests/contracts/audit_1_2_state_authority.test.js:74 | expect(await client.sample.findUnique({ where: { id: sample.id } })).toBeNull() | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:76 | server/tests/contracts/audit_1_2_state_authority.test.js:76 | expect(audit).toHaveLength(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:77 | server/tests/contracts/audit_1_2_state_authority.test.js:77 | expect(audit[0]).toMatchObject({ labId: manager.labId, performedBy: manager.username }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:136 | server/tests/contracts/audit_1_2_state_authority.test.js:136 | expect(analysisOrders.reviseAnalyses(sample.id, { analyses }, manager, { mode, tx: client, idempotencyKey: id() })).rejects.toMatchObject({ statusCode: 409, code: 'AMENDMENT_WORKFLOW_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:138 | server/tests/contracts/audit_1_2_state_authority.test.js:138 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:147 | server/tests/contracts/audit_1_2_state_authority.test.js:147 | expect(outcome).toMatchObject({ sample: { status: 'PROCESSING', requiredAnalyses: '["PH_H2O","SOC"]' }, added: ['SOC'] }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:148 | server/tests/contracts/audit_1_2_state_authority.test.js:148 | expect(await client.workItem.findFirst({ where: { sampleId: sample.id, analysis: 'SOC' } })).toMatchObject({ status: 'NOT_ASSIGNED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:150 | server/tests/contracts/audit_1_2_state_authority.test.js:150 | expect(saved.orders).toHaveLength(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:151 | server/tests/contracts/audit_1_2_state_authority.test.js:151 | expect(saved.orders[0].lines.map(line => line.analysis).sort()).toEqual(['PH_H2O', 'SOC']) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:152 | server/tests/contracts/audit_1_2_state_authority.test.js:152 | expect(saved.audits.filter(row => row.action === 'SAMPLE_STATUS_TRANSITION')).toHaveLength(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:153 | server/tests/contracts/audit_1_2_state_authority.test.js:153 | expect(saved.receipts).toHaveLength(mode === 'order' ? 1 : 0) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:160 | server/tests/contracts/audit_1_2_state_authority.test.js:160 | expect(client.$transaction(tx => reconciliation.reconcileWorkItemsForSample(sample, ['PH_H2O', 'SOC'], manager, 'Add', tx))) .rejects.toMatchObject({ code: 'AMENDMENT_WORKFLOW_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:162 | server/tests/contracts/audit_1_2_state_authority.test.js:162 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:170 | server/tests/contracts/audit_1_2_state_authority.test.js:170 | expect(analysisOrders.reviseAnalyses(sample.id, { analyses: ['SOC'], reason: 'Change the ordered parameter' }, manager, { mode, tx: client })) .rejects.toMatchObject({ statusCode: 409, code: 'WORKITEM_REMOVAL_STATE_CONFLICT', details: { refused: [{ workItemId: item.id, analysis: item.analysis, status, resolution: expect.any(String) }] } }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:174 | server/tests/contracts/audit_1_2_state_authority.test.js:174 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:182 | server/tests/contracts/audit_1_2_state_authority.test.js:182 | expect(client.$transaction(tx => analysisOrders.reviseAnalyses(sample.id, { analyses: ['PH_H2O', 'SOC'] }, manager, { mode, tx: { ...tx, sampleOrderRevision: { ...tx.sampleOrderRevision, create: async () => { throw new Error('Injected order failure'); } } } }))) .rejects.toThrow('Injected order failure') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:185 | server/tests/contracts/audit_1_2_state_authority.test.js:185 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:194 | server/tests/contracts/audit_1_2_state_authority.test.js:194 | expect(analysisOrders.reviseAnalyses(sample.id, { analyses: ['PH_H2O', 'SOC'] }, manager, { mode: 'order', tx: client, idempotencyKey: id() })).rejects.toThrow('Injected receipt failure') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:196 | server/tests/contracts/audit_1_2_state_authority.test.js:196 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:204 | server/tests/contracts/audit_1_2_state_authority.test.js:204 | expect(client.$transaction(tx => analysisOrders.reviseAnalyses(sample.id, { analyses: [], reason: 'Insufficient material' }, manager, { tx: { ...tx, auditLog: { ...tx.auditLog, create: async args => { if (args.data.action === 'ANALYSES_UPDATE') throw new Error('Injected analysis audit failure'); return tx.auditLog.create(args); } } } }))).rejects.toThrow('Injected analysis audit failure') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:209 | server/tests/contracts/audit_1_2_state_authority.test.js:209 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:227 | server/tests/contracts/audit_1_2_state_authority.test.js:228 | expect(updated).toMatchObject({ status: 'REPEAT_REQUIRED', reviewedBy: manager.username, reviewedAt: expect.any(Date) }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:228 | server/tests/contracts/audit_1_2_state_authority.test.js:229 | expect(JSON.parse(updated.history)).toEqual([ { note: 'Existing task history' }, expect.objectContaining({ action: decision, reason: 'Control outside configured acceptance' }) ]) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:229 | server/tests/contracts/audit_1_2_state_authority.test.js:230 | expect(await client.result.findUnique({ where: { id: result.id } })).toMatchObject({ value: result.value, numericValue: result.numericValue, unit: result.unit }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:230 | server/tests/contracts/audit_1_2_state_authority.test.js:231 | expect(await client.auditLog.count({ where: { entityId: item.id, action: decision } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:240 | server/tests/contracts/audit_1_2_state_authority.test.js:241 | expect(after).toMatchObject({ status, reviewedBy: before.reviewedBy, reviewedAt: before.reviewedAt, reanalysisReason: before.reanalysisReason, reanalysisRequestedBy: before.reanalysisRequestedBy, submissionId: before.submissionId }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:242 | server/tests/contracts/audit_1_2_state_authority.test.js:243 | expect(JSON.parse(after.history)).toHaveLength(2) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:252 | server/tests/contracts/audit_1_2_state_authority.test.js:254 | expect(qcDispositions.dispositionBatch(batch.id, 'REJECT_BATCH', 'Rejected failed QC batch', manager, client)) .rejects.toMatchObject({ statusCode: 409, code, details: { items: [{ workItemId: item.id, analysis: 'PH_H2O', status }] } }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:254 | server/tests/contracts/audit_1_2_state_authority.test.js:256 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:255 | server/tests/contracts/audit_1_2_state_authority.test.js:257 | expect(await snapshot(second.sample.id)).toEqual(secondBefore) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:256 | server/tests/contracts/audit_1_2_state_authority.test.js:258 | expect(await client.batch.findUnique({ where: { id: batch.id } })).toEqual(batchBefore) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:257 | server/tests/contracts/audit_1_2_state_authority.test.js:259 | expect(await client.auditLog.count({ where: { entityId: batch.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:266 | server/tests/contracts/audit_1_2_state_authority.test.js:268 | expect(await client.workItem.findUnique({ where: { id: item.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:274 | server/tests/contracts/audit_1_2_state_authority.test.js:276 | expect(client.$transaction(tx => qcDispositions.dispositionBatch(batch.id, 'REJECT_BATCH', 'Rejected failed QC batch', manager, { ...tx, auditLog: { ...tx.auditLog, create: async args => { if (args.data.action === 'QC_DISPOSITION') throw new Error('Injected QC audit failure'); return tx.auditLog.create(args); } } }))).rejects.toThrow('Injected QC audit failure') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:279 | server/tests/contracts/audit_1_2_state_authority.test.js:281 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:280 | server/tests/contracts/audit_1_2_state_authority.test.js:282 | expect(await client.batch.findUnique({ where: { id: batch.id } })).toEqual(batchBefore) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:292 | server/tests/contracts/audit_1_2_state_authority.test.js:295 | expect(await snapshot(sampleId)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:300 | server/tests/contracts/audit_1_2_state_authority.test.js:303 | expect(commitReview(client, item, 'REPEAT_REQUIRED', manager, { history: '[]', reanalysisReason: 'Review correction' }, operations, null, { reason: 'Review correction' })) .rejects.toMatchObject({ statusCode: 409, code: 'AMENDMENT_WORKFLOW_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:303 | server/tests/contracts/audit_1_2_state_authority.test.js:306 | expect(operations).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:304 | server/tests/contracts/audit_1_2_state_authority.test.js:307 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:305 | server/tests/contracts/audit_1_2_state_authority.test.js:308 | expect(await client.reviewDecision.findMany({ where: { sampleId: sample.id } })).toEqual(decisions) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:311 | server/tests/contracts/audit_1_2_state_authority.test.js:314 | expect(commitReview(client, item, 'REPEAT_REQUIRED', { ...manager, labId: 'OTHER-LAB' }, { history: '[]', reanalysisReason: 'Review correction' }, operations, null, { reason: 'Review correction' })) .rejects.toMatchObject({ statusCode: 403, code: 'ACCESS_DENIED_LAB' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:314 | server/tests/contracts/audit_1_2_state_authority.test.js:317 | expect(operations).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:315 | server/tests/contracts/audit_1_2_state_authority.test.js:318 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:326 | server/tests/contracts/audit_1_2_state_authority.test.js:329 | expect(updated.status).toBe('REPEAT_REQUIRED') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:327 | server/tests/contracts/audit_1_2_state_authority.test.js:330 | expect(await client.sample.findUnique({ where: { id: sample.id } })).toMatchObject({ dryingStatus: 'PENDING' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:328 | server/tests/contracts/audit_1_2_state_authority.test.js:331 | expect(await client.resultEvidenceEvent.findMany({ where: { resultId: result.id } })) .toEqual([expect.objectContaining({ eventType: 'PREP_REVERTED', gate: 'DRYING', reason })]) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:330 | server/tests/contracts/audit_1_2_state_authority.test.js:333 | expect(await client.result.findUnique({ where: { id: result.id } })).toEqual(result) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:337 | server/tests/contracts/audit_1_2_state_authority.test.js:340 | expect(client.$transaction(tx => commitReview({ $transaction: callback => callback({ ...tx, resultEvidenceEvent: { ...tx.resultEvidenceEvent, create: async () => { throw new Error('Injected evidence failure'); } } }) }, item, 'REPEAT_REQUIRED', manager, { status: 'REPEAT_REQUIRED', history: JSON.stringify([{ status: 'REPEAT_REQUIRED', reason }]) }, inner => gates.resetReviewedGate(item, manager, reason, inner), null, { reason }))).rejects.toThrow('Injected evidence failure') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:341 | server/tests/contracts/audit_1_2_state_authority.test.js:344 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:346 | server/tests/contracts/audit_1_2_state_authority.test.js:349 | expect(samples.createSample({ id: sampleId, originalId: sampleId, status: 'APPROVED', assignedLab: manager.labId }, manager, { tx: client })) .rejects.toMatchObject({ code: 'INITIAL_STATE_NOT_ALLOWED', statusCode: 409 }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:348 | server/tests/contracts/audit_1_2_state_authority.test.js:351 | expect(await client.sample.count({ where: { id: sampleId } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:349 | server/tests/contracts/audit_1_2_state_authority.test.js:352 | expect(await client.auditLog.count({ where: { entityId: sampleId } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:351 | server/tests/contracts/audit_1_2_state_authority.test.js:354 | expect(sample.status).toBe('EXPECTED') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:352 | server/tests/contracts/audit_1_2_state_authority.test.js:355 | expect(work.createWorkItem({ id: id(), sampleId, analysis: 'PH_H2O', status: 'ASSIGNED' }, manager, { tx: client })) .rejects.toMatchObject({ code: 'INITIAL_STATE_NOT_ALLOWED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:355 | server/tests/contracts/audit_1_2_state_authority.test.js:358 | expect(item.status).toBe('NOT_ASSIGNED') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:356 | server/tests/contracts/audit_1_2_state_authority.test.js:359 | expect(await client.auditLog.count({ where: { sampleId } })).toBe(2) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:363 | server/tests/contracts/audit_1_2_state_authority.test.js:366 | expect(sample).toMatchObject({ status: 'APPROVED', approvedBy: null, approvedAt: null }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:365 | server/tests/contracts/audit_1_2_state_authority.test.js:368 | expect(audit.performedBy).toBe('system:legacy-import') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:366 | server/tests/contracts/audit_1_2_state_authority.test.js:369 | expect(JSON.parse(audit.details).importingUser).toBe(manager.username) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:367 | server/tests/contracts/audit_1_2_state_authority.test.js:370 | expect(samples.createSample({ ...data, id: id(), originalId: id(), approvedBy: manager.username }, 'system:legacy-import', { context: 'legacy-import', importingUser: manager, tx: client })).rejects.toMatchObject({ code: 'LEGACY_IMPORT_APPROVAL_REFUSED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:369 | server/tests/contracts/audit_1_2_state_authority.test.js:372 | expect(samples.createSample({ ...data, id: id(), originalId: id() }, 'system:legacy-import', { context: 'legacy-import', importingUser: technician, tx: client })).rejects.toMatchObject({ code: 'LEGACY_IMPORT_NOT_AUTHORIZED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:374 | server/tests/contracts/audit_1_2_state_authority.test.js:377 | expect(() => rules.assertFixtureContext({ DATABASE_PATH: '/tmp/isolated.db' })).toThrow('explicitly isolated') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:375 | server/tests/contracts/audit_1_2_state_authority.test.js:378 | expect(() => rules.assertFixtureContext({ ALLOW_WORKFLOW_FIXTURES: '1', DATABASE_PATH: '/tmp/isolated.db' })).toThrow('explicitly isolated') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:376 | server/tests/contracts/audit_1_2_state_authority.test.js:379 | expect(() => rules.assertFixtureContext({ NODE_ENV: 'test', DATABASE_PATH: '/production/live.db', PRODUCTION_DATABASE_PATH: '/production/live.db' })).toThrow('explicitly isolated') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:377 | server/tests/contracts/audit_1_2_state_authority.test.js:380 | expect(() => rules.assertFixtureContext({ NODE_ENV: 'test', DATABASE_PATH: path.resolve(__dirname, '../../prisma/dev.db') })).toThrow('explicitly isolated') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:378 | server/tests/contracts/audit_1_2_state_authority.test.js:381 | expect(() => rules.assertFixtureContext({ ALLOW_WORKFLOW_FIXTURES: '1', DATABASE_PATH: '/tmp/isolated.db', PRODUCTION_DATABASE_PATH: '/production/live.db' })).not.toThrow() | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:384 | server/tests/contracts/audit_1_2_state_authority.test.js:387 | expect(samples.transitionSample(sample.id, 'PROCESSING', manager, 'Attempted reopen', {}, client)) .rejects.toMatchObject({ code: 'ILLEGAL_STATUS_TRANSITION', statusCode: 409 }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:386 | server/tests/contracts/audit_1_2_state_authority.test.js:389 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:392 | server/tests/contracts/audit_1_2_state_authority.test.js:395 | expect(samples.transitionSample(sample.id, 'ON_HOLD', manager, ' ', {}, client)).rejects.toMatchObject({ code: 'TRANSITION_REASON_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:393 | server/tests/contracts/audit_1_2_state_authority.test.js:396 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:395 | server/tests/contracts/audit_1_2_state_authority.test.js:398 | expect(held.holdPriorStatus).toBe('PROCESSING') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:396 | server/tests/contracts/audit_1_2_state_authority.test.js:399 | expect(samples.transitionSample(sample.id, 'ACCEPTED', manager, 'Restart intake', {}, client)).rejects.toMatchObject({ code: 'HOLD_PRIOR_STATUS_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:397 | server/tests/contracts/audit_1_2_state_authority.test.js:400 | expect((await samples.transitionSample(sample.id, 'PROCESSING', manager, 'Instrument available', {}, client)).holdPriorStatus).toBeNull() | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:398 | server/tests/contracts/audit_1_2_state_authority.test.js:401 | expect((await work.transitionWorkItem(item.id, 'ON_HOLD', manager, 'Waiting for reagent', {}, client)).holdPriorStatus).toBe('IN_PROGRESS') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:399 | server/tests/contracts/audit_1_2_state_authority.test.js:402 | expect(work.transitionWorkItem(item.id, 'ASSIGNED', manager, 'Resume', {}, client)).rejects.toMatchObject({ code: 'HOLD_PRIOR_STATUS_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:400 | server/tests/contracts/audit_1_2_state_authority.test.js:403 | expect((await work.transitionWorkItem(item.id, 'IN_PROGRESS', manager, 'Reagent delivered', {}, client)).holdPriorStatus).toBeNull() | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:404 | server/tests/contracts/audit_1_2_state_authority.test.js:407 | expect((await samples.transitionSample('hold-history', 'PROCESSING', manager, 'History reviewed', {}, client)).holdPriorStatus).toBeNull() | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:406 | server/tests/contracts/audit_1_2_state_authority.test.js:409 | expect(samples.transitionSample('hold-unknown', 'PROCESSING', technician, 'Guess', {}, client)).rejects.toMatchObject({ code: 'HOLD_RECOVERY_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:407 | server/tests/contracts/audit_1_2_state_authority.test.js:410 | expect(await snapshot('hold-unknown')).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:408 | server/tests/contracts/audit_1_2_state_authority.test.js:411 | expect((await samples.transitionSample('hold-unknown', 'ACCEPTED', manager, 'Legacy hold recovery reviewed', {}, client)).status).toBe('ACCEPTED') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:415 | server/tests/contracts/audit_1_2_state_authority.test.js:418 | expect(work.transitionWorkItem(item.id, 'COMPLETED', technician, 'Completed', {}, client, { expected: item })) .rejects.toMatchObject({ code: 'WORKITEM_STATE_CHANGED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:417 | server/tests/contracts/audit_1_2_state_authority.test.js:420 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:423 | server/tests/contracts/audit_1_2_state_authority.test.js:426 | expect(samples.transitionSample(sample.id, 'SUBMITTED_FULL', { ...manager, labId: 'OTHER-LAB' }, null, {}, client)).rejects.toMatchObject({ statusCode: 403 }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:424 | server/tests/contracts/audit_1_2_state_authority.test.js:427 | expect(samples.transitionSample(sample.id, 'SUBMITTED_FULL', manager, null, { status: 'ARCHIVED' }, client)).rejects.toMatchObject({ code: 'STATUS_OVERRIDE_REFUSED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:425 | server/tests/contracts/audit_1_2_state_authority.test.js:428 | expect(work.transitionWorkItem(item.id, 'COMPLETED', technician, null, { holdPriorStatus: 'ASSIGNED' }, client)).rejects.toMatchObject({ code: 'STATE_METADATA_NOT_ALLOWED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:426 | server/tests/contracts/audit_1_2_state_authority.test.js:429 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:432 | server/tests/contracts/audit_1_2_state_authority.test.js:435 | expect(work.transitionWorkItem(item.id, 'COMPLETED', technician, 'No checklist', {}, client)).rejects.toMatchObject({ code: 'OPERATIONAL_CONFIRMATION_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:433 | server/tests/contracts/audit_1_2_state_authority.test.js:436 | expect(work.transitionWorkItem(item.id, 'AWAITING_VERIFICATION', technician, 'Unconfigured', {}, client)).rejects.toMatchObject({ code: 'OPERATIONAL_VERIFICATION_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:434 | server/tests/contracts/audit_1_2_state_authority.test.js:437 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:437 | server/tests/contracts/audit_1_2_state_authority.test.js:440 | expect(work.transitionWorkItem(item.id, 'WAIVED', manager, 'Skip', {}, client)).rejects.toMatchObject({ code: 'OPERATIONAL_VERIFICATION_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:438 | server/tests/contracts/audit_1_2_state_authority.test.js:441 | expect((await work.transitionWorkItem(item.id, 'COMPLETED', manager, 'Verified', {}, client, { action: 'OPERATION_VERIFIED', decision: 'ACCEPT' })).status).toBe('COMPLETED') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:440 | server/tests/contracts/audit_1_2_state_authority.test.js:443 | expect(work.transitionWorkItem(item.id, 'COMPLETED', manager, 'Duplicate verification', {}, client, { action: 'OPERATION_VERIFIED', decision: 'ACCEPT' })).rejects.toMatchObject({ code: 'WORKITEM_NOT_AWAITING_VERIFICATION' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:453 | server/tests/contracts/audit_1_2_state_authority.test.js:456 | expect(changed.legacyStatus).toBe(original.status) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:454 | server/tests/contracts/audit_1_2_state_authority.test.js:457 | expect(transition(entityId, original.status, manager, 'Unreviewed revert', {}, client)).rejects.toMatchObject({ code: 'ILLEGAL_LEGACY_STATUS' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:458 | server/tests/contracts/audit_1_2_state_authority.test.js:461 | expect(await model.findUnique({ where: { id: entityId } })).toMatchObject({ status: original.status, legacyStatus: null }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:459 | server/tests/contracts/audit_1_2_state_authority.test.js:462 | expect(transition(entityId, original.status, 'system:status-migration', 'Second restore', {}, client, { migrationPlan: reviewedRevert })).rejects.toMatchObject({ code: 'STATUS_MIGRATION_PLAN_STALE' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:461 | server/tests/contracts/audit_1_2_state_authority.test.js:464 | expect(await client.auditLog.count({ where: { entityId, performedBy: 'system:status-migration' } })).toBe(2) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:463 | server/tests/contracts/audit_1_2_state_authority.test.js:466 | expect((await client.sample.findUnique({ where: { id: 'legacy-unmapped' } })).status).toBe('VALIDATED') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:466 | server/tests/contracts/audit_1_2_state_authority.test.js:469 | expect((await client.sample.update({ where: { id: 'legacy-unmapped' }, data: { clientName: 'Metadata update' } })).status).toBe('VALIDATED') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:472 | server/tests/contracts/audit_1_2_state_authority.test.js:475 | expect(() => migration.reviewPlan({ ...plan, rows: [{ ...plan.rows[0], to: 'PROCESSING' }] }, migration.planFingerprint(plan))) .toThrow('fingerprint does not match') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:477 | server/tests/contracts/audit_1_2_state_authority.test.js:480 | expect(samples.transitionSample(row.id, 'APPROVED', 'system:status-migration', 'Stale review', {}, client, { migrationPlan: reviewed })) .rejects.toMatchObject({ code: 'STATUS_MIGRATION_PLAN_STALE' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:479 | server/tests/contracts/audit_1_2_state_authority.test.js:482 | expect(await snapshot(row.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:487 | server/tests/contracts/audit_1_2_state_authority.test.js:490 | expect(await evidence.recordPreparationRevert(tx, sample, 'PREPARATION', 'Material prepared again', manager)).toBe(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:491 | server/tests/contracts/audit_1_2_state_authority.test.js:494 | expect(work.transitionWorkItem(item.id, 'SUBMITTED', technician, 'Submit', {}, client)).rejects.toMatchObject({ code: 'PREP_REVERTED_RESULTS' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:492 | server/tests/contracts/audit_1_2_state_authority.test.js:495 | expect(samples.transitionSample(sample.id, 'APPROVED', manager, 'Approve', {}, client)).rejects.toMatchObject({ code: 'PREP_REVERTED_RESULTS' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:493 | server/tests/contracts/audit_1_2_state_authority.test.js:496 | expect(evidence.clearPreparationRevert(sample.id, result.id, 'PREPARATION', 'Reviewed', manager, client)).rejects.toMatchObject({ code: 'GATE_NOT_DONE' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:494 | server/tests/contracts/audit_1_2_state_authority.test.js:497 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:496 | server/tests/contracts/audit_1_2_state_authority.test.js:499 | expect(evidence.clearPreparationRevert(sample.id, result.id, 'PREPARATION', 'Reviewed', technician, client)).rejects.toMatchObject({ code: 'PREPARATION_CLEARANCE_FORBIDDEN' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:497 | server/tests/contracts/audit_1_2_state_authority.test.js:500 | expect((await evidence.clearPreparationRevert(sample.id, result.id, 'PREPARATION', 'Reprepared material verified', manager, client)).cleared).toBe(true) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:499 | server/tests/contracts/audit_1_2_state_authority.test.js:502 | expect(await client.result.findUnique({ where: { id: result.id } })).toEqual(result) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:501 | server/tests/contracts/audit_1_2_state_authority.test.js:504 | expect(rules.inTransaction(client, tx => tx.resultEvidenceEvent.update({ where: { id: event.id }, data: { reason: 'Overwritten' } }))) .rejects.toMatchObject({ statusCode: 409, code: 'RESULT_EVIDENCE_IMMUTABLE' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:503 | server/tests/contracts/audit_1_2_state_authority.test.js:506 | expect(rules.inTransaction(client, tx => tx.resultEvidenceEvent.delete({ where: { id: event.id } }))) .rejects.toMatchObject({ statusCode: 409, code: 'RESULT_EVIDENCE_IMMUTABLE' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:517 | server/tests/contracts/audit_1_2_state_authority.test.js:520 | expect(await client.resultEvidenceEvent.count({ where: { resultId: old.id } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:518 | server/tests/contracts/audit_1_2_state_authority.test.js:521 | expect((await client.result.findUnique({ where: { id: old.id } })).value).toBe('6.2') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:524 | server/tests/contracts/audit_1_2_state_authority.test.js:527 | expect(client.$transaction(async tx => { await samples.transitionSample(sample.id, 'ON_HOLD', manager, 'Hold pending review', {}, tx); throw new Error('Injected later-operation failure'); })).rejects.toThrow('Injected later-operation failure') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:528 | server/tests/contracts/audit_1_2_state_authority.test.js:531 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:532 | server/tests/contracts/audit_1_2_state_authority.test.js:535 | expect(Object.values(registry['gate.verificationRequired'].presets)).toEqual([false, false, false]) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:537 | server/tests/contracts/audit_1_2_state_authority.test.js:540 | expect(dryOutcome.sample).toMatchObject({ status: 'ACCEPTED', dryingStatus: 'DONE', preparationStatus: 'PENDING' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:539 | server/tests/contracts/audit_1_2_state_authority.test.js:542 | expect(prepOutcome.sample).toMatchObject({ status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:540 | server/tests/contracts/audit_1_2_state_authority.test.js:543 | expect(await client.submission.count({ where: { sampleId: sample.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:541 | server/tests/contracts/audit_1_2_state_authority.test.js:544 | expect(await client.auditLog.count({ where: { entityId: prep.id, action: 'OPERATION_CONFIRMED' } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:551 | server/tests/contracts/audit_1_2_state_authority.test.js:554 | expect(outcome.workItem.status).toBe('AWAITING_VERIFICATION') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:552 | server/tests/contracts/audit_1_2_state_authority.test.js:555 | expect(outcome.sample.preparationStatus).toBe('PENDING') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:553 | server/tests/contracts/audit_1_2_state_authority.test.js:556 | expect(JSON.parse(outcome.workItem.history).at(-1)).toMatchObject({ policyVersion: 1, verificationPolicy: true, verificationRequired: true }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:554 | server/tests/contracts/audit_1_2_state_authority.test.js:557 | expect(JSON.parse((await client.auditLog.findFirst({ where: { entityId: item.id, action: 'OPERATION_CONFIRMED' } })).details).verificationPolicy).toBe(true) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:555 | server/tests/contracts/audit_1_2_state_authority.test.js:558 | expect((await operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'REJECT', note: 'Repeat preparation', db: client })).status).toBe('REPEAT_REQUIRED') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:556 | server/tests/contracts/audit_1_2_state_authority.test.js:559 | expect((await client.sample.findUnique({ where: { id: sample.id } })).preparationStatus).toBe('PENDING') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:557 | server/tests/contracts/audit_1_2_state_authority.test.js:560 | expect(await client.resultEvidenceEvent.count({ where: { sampleId: sample.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:560 | server/tests/contracts/audit_1_2_state_authority.test.js:563 | expect(accepted.sample).toMatchObject({ status: 'PROCESSING', dryingStatus: 'DONE', preparationStatus: 'DONE' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:561 | server/tests/contracts/audit_1_2_state_authority.test.js:564 | expect((await client.reviewDecision.findMany({ where: { workItemId: item.id } })).map(row => row.decision).sort()).toEqual(['ACCEPT', 'RETURN']) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:563 | server/tests/contracts/audit_1_2_state_authority.test.js:566 | expect(operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'ACCEPT', db: client })).rejects.toMatchObject({ code: 'WORKITEM_NOT_AWAITING_VERIFICATION' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:564 | server/tests/contracts/audit_1_2_state_authority.test.js:567 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:571 | server/tests/contracts/audit_1_2_state_authority.test.js:574 | expect(outcome.workItem.status).toBe('AWAITING_VERIFICATION') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:572 | server/tests/contracts/audit_1_2_state_authority.test.js:575 | expect(JSON.parse(outcome.workItem.history).at(-1)).toMatchObject({ verificationPolicy: false, verificationRequested: true }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:574 | server/tests/contracts/audit_1_2_state_authority.test.js:577 | expect(accepted.sample.status).toBe('PROCESSING') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:580 | server/tests/contracts/audit_1_2_state_authority.test.js:583 | expect(client.$transaction(tx => policyService.mutateInTransaction(manager, manager.labId, { changes: [{ key: 'gate.verificationRequired', value: true, ...change }], reason: 'Invalid gate scope' }, tx))).rejects.toMatchObject({ statusCode: 422, code: 'POLICY_SCOPE_INVALID' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:584 | server/tests/contracts/audit_1_2_state_authority.test.js:587 | expect(await client.labPolicy.findUnique({ where: { labId: manager.labId } })).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:592 | server/tests/contracts/audit_1_2_state_authority.test.js:595 | expect(response.status).toHaveBeenCalledWith(409) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:593 | server/tests/contracts/audit_1_2_state_authority.test.js:596 | expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AMENDMENT_WORKFLOW_REQUIRED' })) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:594 | server/tests/contracts/audit_1_2_state_authority.test.js:597 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:602 | server/tests/contracts/audit_1_2_state_authority.test.js:605 | expect(outcomes.filter(row => row.status === 'fulfilled')).toHaveLength(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:603 | server/tests/contracts/audit_1_2_state_authority.test.js:606 | expect(outcomes.find(row => row.status === 'rejected').reason).toMatchObject({ code: 'WORKITEM_NOT_AWAITING_VERIFICATION' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:604 | server/tests/contracts/audit_1_2_state_authority.test.js:607 | expect(await client.reviewDecision.count({ where: { workItemId: item.id } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:605 | server/tests/contracts/audit_1_2_state_authority.test.js:608 | expect(await client.auditLog.count({ where: { entityId: item.id, action: 'OPERATION_VERIFIED' } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:623 | server/tests/contracts/audit_1_2_state_authority.test.js:626 | expect(operations.verifyOperation({ actor: manager, workItemId: item.id, decision: 'ACCEPT', db: client })).rejects.toThrow('Injected decision insertion failure') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:625 | server/tests/contracts/audit_1_2_state_authority.test.js:628 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:626 | server/tests/contracts/audit_1_2_state_authority.test.js:629 | expect(await client.reviewDecision.count({ where: { workItemId: item.id } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:632 | server/tests/contracts/audit_1_2_state_authority.test.js:635 | expect(rules.inTransaction(client, tx => tx.batch.update({ where: { id: batch.id }, data: { status: 'QC_PASS_WITH_WARNING' } }))) .rejects.toMatchObject({ statusCode: 409, code: 'INVALID_BATCH_STATUS' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:634 | server/tests/contracts/audit_1_2_state_authority.test.js:637 | expect((await client.batch.findUnique({ where: { id: batch.id } })).status).toBe('OPEN') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:637 | server/tests/contracts/audit_1_2_state_authority.test.js:640 | expect(rules.inTransaction(client, tx => tx.reviewDecision.update({ where: { id: decision.id }, data: { decision: 'ACCEPT' } }))) .rejects.toMatchObject({ statusCode: 409, code: 'REVIEW_DECISION_IMMUTABLE' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:639 | server/tests/contracts/audit_1_2_state_authority.test.js:642 | expect(await client.reviewDecision.findUnique({ where: { id: decision.id } })).toEqual(decision) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:649 | server/tests/contracts/audit_1_2_state_authority.test.js:652 | expect(gates.changeGate({ sampleId: sample.id, gate: 'PREPARATION', status: 'PENDING', reason: ' ', actor: manager, db: client })) .rejects.toMatchObject({ code: 'TRANSITION_REASON_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:651 | server/tests/contracts/audit_1_2_state_authority.test.js:654 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:653 | server/tests/contracts/audit_1_2_state_authority.test.js:656 | expect(outcome.resultEvidenceCount).toBe(2) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:654 | server/tests/contracts/audit_1_2_state_authority.test.js:657 | expect(outcome.sample.preparationStatus).toBe('PENDING') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:655 | server/tests/contracts/audit_1_2_state_authority.test.js:658 | expect(outcome.workItem.status).toBe('NOT_ASSIGNED') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:656 | server/tests/contracts/audit_1_2_state_authority.test.js:659 | expect(await client.result.findMany({ where: { sampleId: sample.id }, orderBy: { id: 'asc' } })).toEqual(before.results) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:657 | server/tests/contracts/audit_1_2_state_authority.test.js:660 | expect(await client.resultEvidenceEvent.count({ where: { resultId: results[2].id } })).toBe(0) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:658 | server/tests/contracts/audit_1_2_state_authority.test.js:661 | expect(await client.auditLog.count({ where: { entityId: item.id, action: 'GATE_REVERTED' } })).toBe(1) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:659 | server/tests/contracts/audit_1_2_state_authority.test.js:662 | expect(evidence.assertNoPreparationRevert(client, sample.id)).rejects.toMatchObject({ code: 'PREP_REVERTED_RESULTS' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:666 | server/tests/contracts/audit_1_2_state_authority.test.js:669 | expect(held.sample).toMatchObject({ status: 'ON_HOLD', holdPriorStatus: 'ACCEPTED', dryingStatus: 'FAILED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:667 | server/tests/contracts/audit_1_2_state_authority.test.js:670 | expect(held.workItem).toMatchObject({ status: 'ON_HOLD', holdPriorStatus: 'ASSIGNED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:669 | server/tests/contracts/audit_1_2_state_authority.test.js:672 | expect(gates.changeGate({ sampleId: sample.id, gate: 'DRYING', status: 'PENDING', actor: manager, db: client })) .rejects.toMatchObject({ code: 'TRANSITION_REASON_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:671 | server/tests/contracts/audit_1_2_state_authority.test.js:674 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:673 | server/tests/contracts/audit_1_2_state_authority.test.js:676 | expect(released.sample).toMatchObject({ status: 'ACCEPTED', holdPriorStatus: null }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:674 | server/tests/contracts/audit_1_2_state_authority.test.js:677 | expect(released.workItem).toMatchObject({ status: 'ASSIGNED', holdPriorStatus: null }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:675 | server/tests/contracts/audit_1_2_state_authority.test.js:678 | expect((await client.workItem.findUnique({ where: { id: item.id } })).result).toContain('Gate Failed') | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:681 | server/tests/contracts/audit_1_2_state_authority.test.js:684 | expect(gates.changeGate({ sampleId: sample.id, gate: 'DRYING', status: 'PENDING', reason: 'Requested revert', actor: manager, db: client })) .rejects.toMatchObject({ code: 'AMENDMENT_WORKFLOW_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:683 | server/tests/contracts/audit_1_2_state_authority.test.js:686 | expect(await snapshot(sample.id)).toEqual(before) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:691 | server/tests/contracts/audit_1_2_state_authority.test.js:694 | expect(gates.changeGate({ sampleId: sample.id, gate: 'DRYING', status: 'PENDING', reason: 'Revert request', actor: manager, db: client })) .rejects.toMatchObject({ code: 'AMENDMENT_WORKFLOW_REQUIRED' }) | Retained |
| server/tests/contracts/audit_1_2_state_authority.test.js:693 | server/tests/contracts/audit_1_2_state_authority.test.js:696 | expect(await snapshot(sample.id)).toEqual(before) | Retained |

## server/tests/contracts/audit_1_4_uuid_transactions.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:101 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:101 | expect(weakAuditIds(source)).not.toEqual([]) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:102 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:102 | expect(weakAuditIds('db.auditLog.create({ data: { id: crypto.randomUUID(), timestamp: Date.now() } });')).toEqual([]) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:114 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:114 | expect(failures).toEqual([]) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:161 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:161 | expect(generated).toHaveLength(500) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:162 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:162 | expect(new Set(generated.map(row => row.id)).size).toBe(500) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:163 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:163 | expect(row.id).toMatch(uuid) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:165 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:165 | expect(audits).toHaveLength(500) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:166 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:166 | expect(new Set(audits.map(row => row.id)).size).toBe(500) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:167 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:167 | expect(row.id).toMatch(uuid) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:169 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:169 | expect(new Map(stored.map(row => [row.id, row.originalId]))).toEqual(new Map(samples.map(row => [row.id, row.originalId]))) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:181 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:181 | expect(diagnoseCurrentResults(db)).toEqual({ groupCount: 1, currentRowCount: 2, groups: [{ sampleId: 'sample', param: 'PH', replicateNo: 1, currentCount: 2 }] }) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:183 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:183 | expect(db.prepare('SELECT * FROM Result ORDER BY id').all()).toEqual(before) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:197 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:198 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:199 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:201 | expect(rows).toHaveLength(4) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:200 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:202 | expect(new Set(rows.map(row => row.id)).size).toBe(4) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:201 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:203 | expect(row.id).toMatch(uuid) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:203 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:205 | expect(snapshot.id).toMatch(uuid) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:209 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:211 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:213 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:215 | expect(row.value).toBe(old.value) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:214 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:216 | expect(row.isCurrent).toBe(old.replicateNo === 1) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:215 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:217 | expect(row.supersededBy).toMatch(uuid) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:218 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:220 | expect(texture.value).toBe(calculateUsdaTexture(50, 35, 15).className) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:219 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:221 | expect(texture.id).toMatch(uuid) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:220 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:222 | expect(after.filter(row => row.replicateNo === 2 && row.isCurrent)).toHaveLength(4) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:227 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:229 | expect((await sampleSave(f, measurements(2))).status).toBe(500) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:228 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:230 | expect(await prisma.result.findMany({ where: { sampleId: f.sampleId }, orderBy: { id: 'asc' } })) .toEqual([...f.rows].sort((a, b) => a.id.localeCompare(b.id))) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:230 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:232 | expect(await prisma.auditLog.count()).toBe(audits) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:242 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:244 | expect(response.status).toBe(500) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:243 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:245 | expect(await prisma.workItem.findUnique({ where: { id: item.id } })).toEqual(item) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:244 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:246 | expect(await prisma.result.findMany({ where: { sampleId: f.sampleId }, orderBy: { id: 'asc' } })) .toEqual([...f.rows].sort((a, b) => a.id.localeCompare(b.id))) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:246 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:248 | expect(await prisma.auditLog.count()).toBe(audits) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:248 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:250 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:248 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:250 | expect(response.body.saved).toBe(1) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:250 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:252 | expect(rows.find(row => row.param === 'TEXTURE' && row.replicateNo === 2 && row.isCurrent).value) .toBe(calculateUsdaTexture(20, 20, 60).className) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:252 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:254 | expect(rows.find(row => row.id === old.id)).toEqual(old) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:254 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:256 | expect(audit.id).toMatch(uuid) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:261 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:263 | expect(method).not.toBeNull() | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:281 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:283 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:281 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:283 | expect(response.body.importedResults).toBe(1) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:283 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:285 | expect(rows.find(row => row.id === f.rows[0].id)).toMatchObject({ value: '5', isCurrent: false }) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:284 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:286 | expect(rows.find(row => row.id === f.rows[1].id)).toEqual(f.rows[1]) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:286 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:288 | expect(current.id).toMatch(uuid) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:286 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:288 | expect(current.value).toBe('6.5') | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:287 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:289 | expect(rows.find(row => row.id === f.rows[0].id).supersededBy).toBe(current.id) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:289 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:291 | expect(audit.id).toMatch(uuid) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:297 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:299 | expect((await executeImport(f.request)).status).toBe(500) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:298 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:300 | expect(await prisma.sample.findUnique({ where: { id: newSampleId } })).toBeNull() | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:299 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:301 | expect(await prisma.result.findMany({ where: { sampleId: f.sampleId }, orderBy: { replicateNo: 'asc' } })).toEqual(f.rows) | Retained |
| server/tests/contracts/audit_1_4_uuid_transactions.test.js:300 | server/tests/contracts/audit_1_4_uuid_transactions.test.js:302 | expect(await prisma.auditLog.count()).toBe(audits) | Retained |

## server/tests/contracts/audit_2_1_reference_placement.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_2_1_reference_placement.test.js:40 | server/tests/contracts/audit_2_1_reference_placement.test.js:41 | expect(response.status).toBe(201) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:45 | server/tests/contracts/audit_2_1_reference_placement.test.js:46 | expect(response.status).toBe(201) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:76 | server/tests/contracts/audit_2_1_reference_placement.test.js:82 | expect(response).toMatchObject({ status: 409, body: { code: 'REFERENCE_MATERIAL_INELIGIBLE' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:77 | server/tests/contracts/audit_2_1_reference_placement.test.js:83 | expect(response.body.details.reason).toBeTruthy() | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:77 | server/tests/contracts/audit_2_1_reference_placement.test.js:83 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:84 | server/tests/contracts/audit_2_1_reference_placement.test.js:90 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:84 | server/tests/contracts/audit_2_1_reference_placement.test.js:90 | expect(response.body.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:86 | server/tests/contracts/audit_2_1_reference_placement.test.js:92 | expect(saved).toMatchObject({ referenceMaterialId: rm.id, referenceValueId: original.id, referenceUse: 'CRM', expected: 7.123456, referenceSnapshot: { methodologyId: methodA, materialStatus: 'ACTIVE', materialExpiry: expires.toISOString(), valueType: 'CERTIFIED', coverageFactor: null } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:88 | server/tests/contracts/audit_2_1_reference_placement.test.js:94 | expect(row).toMatchObject({ referenceMaterialId: rm.id, referenceValueId: original.id, expected: 7.123456 }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:89 | server/tests/contracts/audit_2_1_reference_placement.test.js:95 | expect(JSON.parse(row.details).referenceSnapshot).toEqual(saved.referenceSnapshot) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:91 | server/tests/contracts/audit_2_1_reference_placement.test.js:97 | expect(correction.status).toBe(201) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:94 | server/tests/contracts/audit_2_1_reference_placement.test.js:100 | expect(later.controls[0].referenceSnapshot).toEqual(saved.referenceSnapshot) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:94 | server/tests/contracts/audit_2_1_reference_placement.test.js:100 | expect(later.controls[0].referenceValueId).toBe(original.id) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:96 | server/tests/contracts/audit_2_1_reference_placement.test.js:102 | expect(reevaluated.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:97 | server/tests/contracts/audit_2_1_reference_placement.test.js:103 | expect(JSON.parse(reevaluated.body.batch.qcResults).controls[0]).toMatchObject({ referenceValueId: original.id, expected: 7.123456, referenceSnapshot: saved.referenceSnapshot }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:99 | server/tests/contracts/audit_2_1_reference_placement.test.js:105 | expect(await place(id, endpoint, [{ ...saved, id: randomUUID(), measured: 7.12 }])).toMatchObject({ status: 409, body: { code: 'REFERENCE_MATERIAL_INELIGIBLE' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:100 | server/tests/contracts/audit_2_1_reference_placement.test.js:106 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:112 | server/tests/contracts/audit_2_1_reference_placement.test.js:118 | expect(await place(id, endpoint, [{ referenceMaterialId: rm.id, measured: 7.123456, ...input }])).toMatchObject({ status, body: { code } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:113 | server/tests/contracts/audit_2_1_reference_placement.test.js:119 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:122 | server/tests/contracts/audit_2_1_reference_placement.test.js:128 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:123 | server/tests/contracts/audit_2_1_reference_placement.test.js:129 | expect(response).toMatchObject({ status: 409, body: { code: ['CALIBRATION_STANDARD', 'BLANK_MATRIX'].includes(kind) ? 'REFERENCE_USE_INCOMPATIBLE' : 'REFERENCE_VALUE_NOT_CERTIFIED' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:123 | server/tests/contracts/audit_2_1_reference_placement.test.js:129 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:132 | server/tests/contracts/audit_2_1_reference_placement.test.js:138 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:132 | server/tests/contracts/audit_2_1_reference_placement.test.js:138 | expect(JSON.parse(response.body.batch.qcResults).controls[0].referenceValueId).toBe(resolved.id) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:134 | server/tests/contracts/audit_2_1_reference_placement.test.js:140 | expect(await place(next, 'update', [{ referenceMaterialId: rm.id, referenceUse: 'CRM', referenceValueId: resolved.id === generic.id ? specific.id : generic.id, measured: 7 }])) .toMatchObject({ status: 409, body: { code: 'REFERENCE_VALUE_MISMATCH' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:136 | server/tests/contracts/audit_2_1_reference_placement.test.js:142 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:143 | server/tests/contracts/audit_2_1_reference_placement.test.js:149 | expect(await place(id, endpoint, [{ referenceMaterialId: rm.id, referenceUse: 'CRM', measured: 7 }])) .toMatchObject({ status: 409, body: { code: 'REFERENCE_VALUE_METHOD_AMBIGUOUS' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:145 | server/tests/contracts/audit_2_1_reference_placement.test.js:151 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:151 | server/tests/contracts/audit_2_1_reference_placement.test.js:157 | expect(await place(id, 'evaluate', [{ expected: 7, measured: 7 }])).toMatchObject({ status: 200, body: { status: 'QC_PASS' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:153 | server/tests/contracts/audit_2_1_reference_placement.test.js:159 | expect(otherList.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:153 | server/tests/contracts/audit_2_1_reference_placement.test.js:159 | expect(otherList.body.data.some(row => row.id === rm.id)).toBe(false) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:155 | server/tests/contracts/audit_2_1_reference_placement.test.js:161 | expect(await call('patch', '/api/reference-materials/${rm.id}/status', { status: 'RETIRED', reason: 'Outside scope' }, otherToken)).toMatchObject({ status: 403 }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:156 | server/tests/contracts/audit_2_1_reference_placement.test.js:162 | expect(await call('post', '/api/reference-materials', { name: 'Unauthorized' }, techToken)).toMatchObject({ status: 403 }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:157 | server/tests/contracts/audit_2_1_reference_placement.test.js:163 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:162 | server/tests/contracts/audit_2_1_reference_placement.test.js:168 | expect(await call('post', '/api/reference-materials/${rm.id}/values', { analysisCode, unit, assignedValue: 7, expandedUncertainty: 0.1, valueType: 'CERTIFIED' })) .toMatchObject({ status: 400, body: { code: 'REFERENCE_COVERAGE_FACTOR_REQUIRED' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:164 | server/tests/contracts/audit_2_1_reference_placement.test.js:170 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:167 | server/tests/contracts/audit_2_1_reference_placement.test.js:173 | expect(first.coverageFactor).toBe(1.96) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:169 | server/tests/contracts/audit_2_1_reference_placement.test.js:175 | expect(await call('post', '/api/reference-materials/${rm.id}/values', { methodologyId, analysisCode, unit, assignedValue: 7, valueType: 'CERTIFIED' })) .toMatchObject({ status: 409, body: { code: 'REFERENCE_VALUE_CURRENT_EXISTS' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:171 | server/tests/contracts/audit_2_1_reference_placement.test.js:177 | expect(snapshot()).toEqual(prior) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:180 | server/tests/contracts/audit_2_1_reference_placement.test.js:186 | expect(await call('post', '/api/reference-materials/${rm.id}/values/${old.id}/correct', { assignedValue: 8, reason: 'Owned fault test' })).toMatchObject({ status: 500 }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:181 | server/tests/contracts/audit_2_1_reference_placement.test.js:187 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:181 | server/tests/contracts/audit_2_1_reference_placement.test.js:187 | expect((await prisma.referenceValue.findUnique({ where: { id: old.id } })).supersededById).toBeNull() | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:186 | server/tests/contracts/audit_2_1_reference_placement.test.js:192 | expect((await place(id, 'update', [{ referenceMaterialId: rm.id, referenceUse: 'CRM', measured: 7.123456 }])).status).toBe(200) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:188 | server/tests/contracts/audit_2_1_reference_placement.test.js:194 | expect(corrected.status).toBe(201) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:190 | server/tests/contracts/audit_2_1_reference_placement.test.js:196 | expect(wire(oldAfter)).toMatchObject({ ...old, supersededById: corrected.body.data.id, supersededAt: expect.any(String), supersededBy: actor.username, correctionReason: 'Certificate transcription' }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:193 | server/tests/contracts/audit_2_1_reference_placement.test.js:199 | expect(await call('post', '/api/reference-materials/${rm.id}/values/${old.id}/correct', { assignedValue: 9, reason: 'Second correction' })) .toMatchObject({ status: 409, body: { code: 'REFERENCE_VALUE_SUPERSEDED' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:197 | server/tests/contracts/audit_2_1_reference_placement.test.js:203 | expect(prisma.$executeRawUnsafe('UPDATE "ReferenceValue" SET "${field}"=? WHERE id=?', next, old.id)).rejects.toThrow('REFERENCE_VALUE_IMMUTABLE') | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:198 | server/tests/contracts/audit_2_1_reference_placement.test.js:204 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:200 | server/tests/contracts/audit_2_1_reference_placement.test.js:206 | expect(prisma.$executeRawUnsafe('DELETE FROM "ReferenceValue" WHERE id=?', old.id)).rejects.toThrow('REFERENCE_VALUE_REFERENCED') | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:201 | server/tests/contracts/audit_2_1_reference_placement.test.js:207 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:203 | server/tests/contracts/audit_2_1_reference_placement.test.js:209 | expect((await place(id, 'update', [{ expected: 8, measured: 8 }])).status).toBe(200) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:205 | server/tests/contracts/audit_2_1_reference_placement.test.js:211 | expect(prisma.$executeRawUnsafe('DELETE FROM "ReferenceValue" WHERE id=?', old.id)).rejects.toThrow('REFERENCE_VALUE_REFERENCED') | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:206 | server/tests/contracts/audit_2_1_reference_placement.test.js:212 | expect(snapshot()).toEqual(historical) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:212 | server/tests/contracts/audit_2_1_reference_placement.test.js:218 | expect(corrected.status).toBe(201) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:215 | server/tests/contracts/audit_2_1_reference_placement.test.js:221 | expect(prisma.$executeRawUnsafe('DELETE FROM "ReferenceValue" WHERE id=?', id)).rejects.toThrow('REFERENCE_VALUE_REFERENCED') | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:216 | server/tests/contracts/audit_2_1_reference_placement.test.js:222 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:224 | server/tests/contracts/audit_2_1_reference_placement.test.js:230 | expect(listed.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:225 | server/tests/contracts/audit_2_1_reference_placement.test.js:231 | expect(listed.body.data.find(row => row.id === rm.id)).toMatchObject({ expiryWarningDays: 2, daysToExpiry: 5, expiryWarning: false, eligible: true }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:226 | server/tests/contracts/audit_2_1_reference_placement.test.js:232 | expect(listed.body.data.find(row => row.id === expired.id)).toMatchObject({ status: 'ACTIVE', reason: 'EXPIRED', eligible: false }) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:227 | server/tests/contracts/audit_2_1_reference_placement.test.js:233 | expect(snapshot()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:251 | server/tests/contracts/audit_2_1_reference_placement.test.js:257 | expect(() => installReferenceMaterials({ dbPath: fixture.file, apply: true })).toThrow(expect.objectContaining({ code: 'REFERENCE_INTEGRITY_REFUSED', differences: expect.arrayContaining([expect.objectContaining({ type: 'SUPERSESSION', id: oldId })]) })) | Retained |
| server/tests/contracts/audit_2_1_reference_placement.test.js:253 | server/tests/contracts/audit_2_1_reference_placement.test.js:259 | expect(createHash('sha256').update(fs.readFileSync(fixture.file)).digest('hex')).toBe(before) | Retained |

## server/tests/contracts/audit_2_1_reference_ui.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_2_1_reference_ui.test.js:58 | server/tests/contracts/audit_2_1_reference_ui.test.js:59 | expect(content(tree)).toContain('LOT-A') | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:58 | server/tests/contracts/audit_2_1_reference_ui.test.js:59 | expect(content(tree)).toContain('5') | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:58 | server/tests/contracts/audit_2_1_reference_ui.test.js:59 | expect(content(tree)).toContain('referenceMaterials.expiryWarning') | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:59 | server/tests/contracts/audit_2_1_reference_ui.test.js:60 | expect(view.button('referenceMaterials.addMaterial')).toBeUndefined() | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:61 | server/tests/contracts/audit_2_1_reference_ui.test.js:62 | expect(content(view.all())).toContain('7.123456') | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:61 | server/tests/contracts/audit_2_1_reference_ui.test.js:62 | expect(content(view.all())).toContain('2.5') | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:62 | server/tests/contracts/audit_2_1_reference_ui.test.js:63 | expect(view.button('referenceMaterials.correct')).toBeUndefined() | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:62 | server/tests/contracts/audit_2_1_reference_ui.test.js:63 | expect(view.all().filter(node => node.type === 'form')).toHaveLength(0) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:63 | server/tests/contracts/audit_2_1_reference_ui.test.js:64 | expect(view.axios.get).toHaveBeenCalledTimes(1) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:63 | server/tests/contracts/audit_2_1_reference_ui.test.js:64 | expect(view.axios.post).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:70 | server/tests/contracts/audit_2_1_reference_ui.test.js:71 | expect(view.field('analysisCode')).toBeUndefined() | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:70 | server/tests/contracts/audit_2_1_reference_ui.test.js:71 | expect(view.field('methodologyId')).toBeUndefined() | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:71 | server/tests/contracts/audit_2_1_reference_ui.test.js:72 | expect(view.field('reason').props.required).toBe(true) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:71 | server/tests/contracts/audit_2_1_reference_ui.test.js:72 | expect(view.field('coverageFactor').props.required).toBe(true) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:75 | server/tests/contracts/audit_2_1_reference_ui.test.js:76 | expect(view.axios.post).toHaveBeenCalledWith('/api/reference-materials/owned-reference/values/owned-value/correct', expect.objectContaining({ analysisCode: 'PH_H2O', methodologyId: '', assignedValue: '7.25', coverageFactor: 2.5, reason: 'Certificate transcription' })) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:77 | server/tests/contracts/audit_2_1_reference_ui.test.js:78 | expect(material.values[0].assignedValue).toBe(7.123456) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:83 | server/tests/contracts/audit_2_1_reference_ui.test.js:84 | expect(view.field('reason').props.required).toBe(true) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:87 | server/tests/contracts/audit_2_1_reference_ui.test.js:88 | expect(view.axios.patch).toHaveBeenCalledWith('/api/reference-materials/owned-reference/status', { status: 'QUARANTINED', reason: 'Damaged seal' }) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:98 | server/tests/contracts/audit_2_1_reference_ui.test.js:99 | expect(nodes(view.find('qc-reference-material')).find(node => node.type === 'option' && node.props.value === 'expired').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:100 | server/tests/contracts/audit_2_1_reference_ui.test.js:101 | expect(view.find('qc-ctrl-exp-input').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:100 | server/tests/contracts/audit_2_1_reference_ui.test.js:101 | expect(view.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:101 | server/tests/contracts/audit_2_1_reference_ui.test.js:102 | expect(view.axios.post).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:103 | server/tests/contracts/audit_2_1_reference_ui.test.js:104 | expect(view.find('evaluate-qc-btn').props.disabled).toBe(false) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:105 | server/tests/contracts/audit_2_1_reference_ui.test.js:106 | expect(control).toEqual({ referenceMaterialId: material.id, referenceUse: 'CRM', measured: 7.12, rawInput: { expected: null, measured: '7.12' } }) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:106 | server/tests/contracts/audit_2_1_reference_ui.test.js:107 | expect(Object.hasOwn(control, 'expected')).toBe(false) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:106 | server/tests/contracts/audit_2_1_reference_ui.test.js:107 | expect(Object.hasOwn(control, 'methodologyId')).toBe(false) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:113 | server/tests/contracts/audit_2_1_reference_ui.test.js:114 | expect(nodes(view.find('qc-reference-material')).find(node => node.type === 'option' && node.props.value === material.id).props.disabled).toBe(false) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:115 | server/tests/contracts/audit_2_1_reference_ui.test.js:116 | expect(view.axios.post.mock.calls[0][1].controls[0]).toMatchObject({ id: 'placed-control', referenceValueId: 'original-certificate', referenceUse: 'CRM' }) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:123 | server/tests/contracts/audit_2_1_reference_ui.test.js:124 | expect(keys(client.referenceMaterials)).toEqual(keys(english)) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:123 | server/tests/contracts/audit_2_1_reference_ui.test.js:124 | expect(keys(server.referenceMaterials)).toEqual(keys(english)) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:127 | server/tests/contracts/audit_2_1_reference_ui.test.js:128 | expect(client.referenceMaterials.errors[code]).toEqual(expect.any(String)) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:128 | server/tests/contracts/audit_2_1_reference_ui.test.js:129 | expect(client.policies.keys.referenceMaterials_expiryWarningDays).toEqual(expect.any(String)) | Retained |
| server/tests/contracts/audit_2_1_reference_ui.test.js:129 | server/tests/contracts/audit_2_1_reference_ui.test.js:130 | expect(server.policies.keys.referenceMaterials_expiryWarningDays).toEqual(expect.any(String)) | Retained |

## server/tests/contracts/audit_2_2_qc_rules.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_2_2_qc_rules.test.js:25 | server/tests/contracts/audit_2_2_qc_rules.test.js:28 | expect(snapshot).toMatchObject({ source: 'DEFAULT_RULE', id: null, version: null, resolved: { duplicateMode: { value: 'ABS_DIFF', source: 'SHIPPED_ANALYSIS_DEFAULT' }, duplicateAbsMax: { value: 0.2 }, blankPerBatch: { value: 0 } } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:30 | server/tests/contracts/audit_2_2_qc_rules.test.js:33 | expect(evaluation.overallStatus).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:31 | server/tests/contracts/audit_2_2_qc_rules.test.js:34 | expect(evaluation.duplicates[0]).toMatchObject({ criterion: 'ABS_DIFF', status: 'PASS', absMax: 0.2 }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:32 | server/tests/contracts/audit_2_2_qc_rules.test.js:35 | expect(evaluation.summary.requirements.BLANK).toMatchObject({ required: 0, found: 0, source: 'NOT_USED' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:33 | server/tests/contracts/audit_2_2_qc_rules.test.js:36 | expect(evaluateDuplicate({ value1: 7, value2: 7.3 }, policy.duplicate)).toMatchObject({ criterion: 'ABS_DIFF', status: 'FAIL' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:34 | server/tests/contracts/audit_2_2_qc_rules.test.js:37 | expect(evaluateDuplicate({ value1: 7, value2: 7.2 }, policy.duplicate)).toMatchObject({ criterion: 'ABS_DIFF', status: 'PASS' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:35 | server/tests/contracts/audit_2_2_qc_rules.test.js:38 | expect(evaluateDuplicate({ value1: 7, value2: 7.20000001 }, policy.duplicate)).toMatchObject({ status: 'FAIL' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:45 | server/tests/contracts/audit_2_2_qc_rules.test.js:48 | expect((await resolve(f)).resolved).toMatchObject({ duplicateAbsMax: { value: 0.4, source: 'METHOD_OVERRIDE' }, duplicateMode: { source: 'SHIPPED_ANALYSIS_DEFAULT' }, blankAbsLimit: { value: 0.1, source: 'LAB_OVERRIDE' } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:46 | server/tests/contracts/audit_2_2_qc_rules.test.js:49 | expect((await resolve(f, { methodologyId: null })).resolved.duplicateAbsMax).toMatchObject({ value: 0.3, source: 'ANALYSIS_OVERRIDE' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:48 | server/tests/contracts/audit_2_2_qc_rules.test.js:51 | expect(saved.qcRule.resolved.duplicateAbsMax).toEqual({ value: 0.5, source: 'QC_RULE' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:49 | server/tests/contracts/audit_2_2_qc_rules.test.js:52 | expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:50 | server/tests/contracts/audit_2_2_qc_rules.test.js:53 | expect(await prisma.auditLog.count({ where: { entity: 'QC_RULE', entityId: saved.rule.id } })).toBe(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:57 | server/tests/contracts/audit_2_2_qc_rules.test.js:60 | expect(snapshot.resolved.duplicateMode).toMatchObject({ value: 'RPD', source: 'REGISTRY_DEFAULT' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:64 | server/tests/contracts/audit_2_2_qc_rules.test.js:67 | expect((await resolve(f)).resolved.duplicateAbsMax.value).toBe(0.4) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:66 | server/tests/contracts/audit_2_2_qc_rules.test.js:69 | expect(generic).toMatchObject({ methodologyId: null, notes: ['METHOD_AMBIGUOUS'], resolved: { duplicateAbsMax: { value: 0.6 } } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:73 | server/tests/contracts/audit_2_2_qc_rules.test.js:76 | expect(second.rule.version).toBe(2) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:74 | server/tests/contracts/audit_2_2_qc_rules.test.js:77 | expect(await prisma.qcRule.findUnique({ where: { id: first.rule.id } })).toEqual(stored) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:75 | server/tests/contracts/audit_2_2_qc_rules.test.js:78 | expect(JSON.stringify(first.qcRule)).toBe(frozen) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:77 | server/tests/contracts/audit_2_2_qc_rules.test.js:80 | expect(reset.rule.version).toBe(3) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:77 | server/tests/contracts/audit_2_2_qc_rules.test.js:80 | expect(Object.values(reset.rule.criteria).every(value => value === null)).toBe(true) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:78 | server/tests/contracts/audit_2_2_qc_rules.test.js:81 | expect(reset.qcRule.resolved.duplicateAbsMax).toMatchObject({ value: 0.2, source: 'SHIPPED_ANALYSIS_DEFAULT' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:81 | server/tests/contracts/audit_2_2_qc_rules.test.js:84 | expect(prisma.qcRule.update({ where: { id: first.rule.id }, data: { reason: 'overwrite' } })).rejects.toMatchObject({ code: 'P2003' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:82 | server/tests/contracts/audit_2_2_qc_rules.test.js:85 | expect(prisma.qcRule.delete({ where: { id: first.rule.id } })).rejects.toMatchObject({ code: 'P2003' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:83 | server/tests/contracts/audit_2_2_qc_rules.test.js:86 | expect(await prisma.qcRule.findUnique({ where: { id: first.rule.id } })).toEqual(stored) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:89 | server/tests/contracts/audit_2_2_qc_rules.test.js:92 | expect((await resolve(f)).source).toBe('DEFAULT_RULE') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:90 | server/tests/contracts/audit_2_2_qc_rules.test.js:93 | expect((await resolve(f, { evaluatedAt: saved.rule.effectiveFrom })).version).toBe(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:91 | server/tests/contracts/audit_2_2_qc_rules.test.js:94 | expect(save(f, {}, { expectedVersion: 1, effectiveFrom: new Date(Date.now() - 60000).toISOString() })).rejects.toMatchObject({ statusCode: 422, code: 'QC_RULE_EFFECTIVE_FROM_INVALID' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:92 | server/tests/contracts/audit_2_2_qc_rules.test.js:95 | expect(save(f, {}, { expectedVersion: 0 })).rejects.toMatchObject({ statusCode: 409, code: 'QC_RULE_VERSION_CONFLICT' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:93 | server/tests/contracts/audit_2_2_qc_rules.test.js:96 | expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:98 | server/tests/contracts/audit_2_2_qc_rules.test.js:101 | expect(save(f, criteria)).rejects.toMatchObject({ statusCode: 422, code: 'QC_RULE_MODE_UNSUPPORTED' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:99 | server/tests/contracts/audit_2_2_qc_rules.test.js:102 | expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:100 | server/tests/contracts/audit_2_2_qc_rules.test.js:103 | expect(await prisma.auditLog.count({ where: { entity: 'QC_RULE', labId: f.labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:105 | server/tests/contracts/audit_2_2_qc_rules.test.js:108 | expect(save(f, { crmRecoveryMin: 120 })).rejects.toMatchObject({ code: 'QC_RULE_VALUE_INVALID' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:106 | server/tests/contracts/audit_2_2_qc_rules.test.js:109 | expect(save(f, {}, { reason: ' ' })).rejects.toMatchObject({ code: 'QC_RULE_REASON_REQUIRED', statusCode: 400 }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:107 | server/tests/contracts/audit_2_2_qc_rules.test.js:110 | expect(rules.change({ role: 'LAB_TECHNICIAN', labId: f.labId }, f, { db: prisma })).rejects.toMatchObject({ statusCode: 403 }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:109 | server/tests/contracts/audit_2_2_qc_rules.test.js:112 | expect(rules.change({ username: 'fixture', role: 'LAB_MANAGER', labId: other.labId }, f, { db: prisma })).rejects.toMatchObject({ statusCode: 403, code: 'TARGET_OUTSIDE_SCOPE' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:110 | server/tests/contracts/audit_2_2_qc_rules.test.js:113 | expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:117 | server/tests/contracts/audit_2_2_qc_rules.test.js:120 | expect(saved.warnings).toEqual([{ code: 'QC_RULE_LOQ_MISSING', notes: [] }]) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:118 | server/tests/contracts/audit_2_2_qc_rules.test.js:121 | expect(evaluateBlank({ value: 0 }, { mode: 'LT_LOQ', loq: null })).toMatchObject({ status: 'INVALID', criterion: 'NO_LOQ' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:119 | server/tests/contracts/audit_2_2_qc_rules.test.js:122 | expect(evaluateBlank({ value: -100 }, { mode: 'LT_LOQ', loq: 1 })).toMatchObject({ status: 'FAIL' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:120 | server/tests/contracts/audit_2_2_qc_rules.test.js:123 | expect(evaluateBlank({ value: -0.5 }, { mode: 'LT_HALF_LOQ', loq: 1 })).toMatchObject({ status: 'FAIL' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:121 | server/tests/contracts/audit_2_2_qc_rules.test.js:124 | expect(evaluateBlank({ value: -0.49 }, { mode: 'LT_HALF_LOQ', loq: 1 })).toMatchObject({ status: 'PASS' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:137 | server/tests/contracts/audit_2_2_qc_rules.test.js:140 | expect(failed.overallStatus).toBe('QC_FAIL') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:138 | server/tests/contracts/audit_2_2_qc_rules.test.js:141 | expect(failed.summary.requirements).toMatchObject({ DUPLICATE: { required: 4, found: 2, source: 'RULE' }, CONTROL: { required: 1, found: 1, source: 'PROFILE' }, LRM: { required: 1, found: 0, source: 'RULE' } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:139 | server/tests/contracts/audit_2_2_qc_rules.test.js:142 | expect(failed.summary.missingRequired.map(row => row.type)).toEqual(['DUPLICATE', 'LRM']) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:141 | server/tests/contracts/audit_2_2_qc_rules.test.js:144 | expect(passed.overallStatus).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:147 | server/tests/contracts/audit_2_2_qc_rules.test.js:150 | expect(result.overallStatus).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:149 | server/tests/contracts/audit_2_2_qc_rules.test.js:152 | expect(result.summary.missingRequired.map(row => row.type)).toEqual(['DUPLICATE', 'LRM']) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:150 | server/tests/contracts/audit_2_2_qc_rules.test.js:153 | expect(result.summary.warnings).toHaveLength(2) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:151 | server/tests/contracts/audit_2_2_qc_rules.test.js:154 | expect(result.summary.missingRequired).toEqual([]) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:158 | server/tests/contracts/audit_2_2_qc_rules.test.js:161 | expect(result.overallStatus).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:158 | server/tests/contracts/audit_2_2_qc_rules.test.js:161 | expect(result.blanks[0].status).toBe('FAIL') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:158 | server/tests/contracts/audit_2_2_qc_rules.test.js:161 | expect(result.summary.warnings).toHaveLength(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:160 | server/tests/contracts/audit_2_2_qc_rules.test.js:163 | expect(evaluateBatchQc({ blanks: [{ value: 100 }] }, { policy: { qcRule: defaults, qcMode: 'ADVISORY', sampleCount: 0 } }).overallStatus).toBe('QC_FAIL') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:169 | server/tests/contracts/audit_2_2_qc_rules.test.js:173 | expect(response.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:169 | server/tests/contracts/audit_2_2_qc_rules.test.js:173 | expect(response.body.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:171 | server/tests/contracts/audit_2_2_qc_rules.test.js:175 | expect(JSON.parse(before.qcResults).summary.qcRule.id).toBe(first.rule.id) | Translated: expect(view.qcResults.summary.qcRule.id).toBe(first.rule.id) |
| server/tests/contracts/audit_2_2_qc_rules.test.js:172 | server/tests/contracts/audit_2_2_qc_rules.test.js:176 | expect(JSON.parse(row.details).qcRule).toMatchObject({ id: first.rule.id, version: 1, resolved: { duplicateAbsMax: { value: 0.4, source: 'QC_RULE' } } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:174 | server/tests/contracts/audit_2_2_qc_rules.test.js:178 | expect(await prisma.batch.findUnique({ where: { id: batch.id } })).toEqual(before) | Translated: expect(await normalizedEvidence(batch.id)).toEqual(before) |
| server/tests/contracts/audit_2_2_qc_rules.test.js:175 | server/tests/contracts/audit_2_2_qc_rules.test.js:179 | expect(await prisma.batchQcResult.findMany({ where: { batchId: batch.id } })).toEqual(rows) | Translated: expect(batchApiView(await normalizedEvidence(batch.id)).qcItems).toEqual(rows) |
| server/tests/contracts/audit_2_2_qc_rules.test.js:181 | server/tests/contracts/audit_2_2_qc_rules.test.js:185 | expect(attempts.filter(row => row.status === 'fulfilled')).toHaveLength(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:182 | server/tests/contracts/audit_2_2_qc_rules.test.js:186 | expect(attempts.find(row => row.status === 'rejected').reason).toMatchObject({ statusCode: 409, code: 'QC_RULE_VERSION_CONFLICT' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:183 | server/tests/contracts/audit_2_2_qc_rules.test.js:187 | expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:184 | server/tests/contracts/audit_2_2_qc_rules.test.js:188 | expect(await prisma.auditLog.count({ where: { entity: 'QC_RULE', labId: f.labId } })).toBe(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:188 | server/tests/contracts/audit_2_2_qc_rules.test.js:192 | expect(evaluateControl({ expected: 7, measured: 7.2, referenceUse: 'CRM' }, { crmMode: 'ABS_WINDOW', crmAbsWindow: 0.2 })) .toMatchObject({ criterion: 'ABS_WINDOW', status: 'PASS' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:190 | server/tests/contracts/audit_2_2_qc_rules.test.js:194 | expect(evaluateControl({ expected: 7, measured: 7, referenceUse: 'CRM' }, { crmMode: 'ABS_WINDOW', crmAbsWindow: null })) .toMatchObject({ criterion: 'RECOVERY', notes: ['ABS_WINDOW_UNSET'] }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:192 | server/tests/contracts/audit_2_2_qc_rules.test.js:196 | expect(evaluateControl({ expected: 100, measured: 108, referenceUse: 'LRM' }, { lrmMode: 'CONTROL_CHART', lrmWindowPct: 5 })) .toMatchObject({ status: 'FAIL', notes: ['PROVISIONAL_NO_CHART'], lrmWindowPct: 5 }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:201 | server/tests/contracts/audit_2_2_qc_rules.test.js:205 | expect(read.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:201 | server/tests/contracts/audit_2_2_qc_rules.test.js:205 | expect(read.body.data).toMatchObject({ expectedVersion: 0, fieldPolicies: { duplicateAbsMax: 'qc.duplicateAbsMax' } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:203 | server/tests/contracts/audit_2_2_qc_rules.test.js:207 | expect(forbidden.status).toBe(403) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:205 | server/tests/contracts/audit_2_2_qc_rules.test.js:209 | expect(saved.status).toBe(201) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:205 | server/tests/contracts/audit_2_2_qc_rules.test.js:209 | expect(saved.body.data.rule.approvedBy).toBeDefined() | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:207 | server/tests/contracts/audit_2_2_qc_rules.test.js:211 | expect(raced.status).toBe(409) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:207 | server/tests/contracts/audit_2_2_qc_rules.test.js:211 | expect(raced.body.code).toBe('QC_RULE_VERSION_CONFLICT') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:220 | server/tests/contracts/audit_2_2_qc_rules.test.js:226 | expect(partial.status).toBe(400) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:220 | server/tests/contracts/audit_2_2_qc_rules.test.js:226 | expect(partial.body.code).toBe('QC_VALUES_MISSING') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:220 | server/tests/contracts/audit_2_2_qc_rules.test.js:226 | expect(await state()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:222 | server/tests/contracts/audit_2_2_qc_rules.test.js:228 | expect(malformed.status).toBe(400) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:222 | server/tests/contracts/audit_2_2_qc_rules.test.js:228 | expect(malformed.body.code).toBe('QC_VALUES_MISSING') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:222 | server/tests/contracts/audit_2_2_qc_rules.test.js:228 | expect(await state()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:225 | server/tests/contracts/audit_2_2_qc_rules.test.js:231 | expect(omitted.status).toBe(400) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:225 | server/tests/contracts/audit_2_2_qc_rules.test.js:231 | expect(omitted.body.code).toBe('QC_VALUES_MISSING') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:225 | server/tests/contracts/audit_2_2_qc_rules.test.js:231 | expect(await state()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:227 | server/tests/contracts/audit_2_2_qc_rules.test.js:233 | expect(insufficient.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:227 | server/tests/contracts/audit_2_2_qc_rules.test.js:233 | expect(insufficient.body.status).toBe('QC_FAIL') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:228 | server/tests/contracts/audit_2_2_qc_rules.test.js:234 | expect(insufficient.body.evaluation.summary.missingRequired).toEqual([expect.objectContaining({ type: 'DUPLICATE', required: 2, found: 1 })]) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:230 | server/tests/contracts/audit_2_2_qc_rules.test.js:236 | expect(omitted.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:230 | server/tests/contracts/audit_2_2_qc_rules.test.js:236 | expect(omitted.body.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:231 | server/tests/contracts/audit_2_2_qc_rules.test.js:237 | expect(omitted.body.evaluation.summary.warnings).toEqual(expect.arrayContaining([ expect.objectContaining({ type: 'DUPLICATE', required: 2, found: 0 }), expect.objectContaining({ type: 'LRM', required: 1, found: 0 })])) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:233 | server/tests/contracts/audit_2_2_qc_rules.test.js:239 | expect(omitted.body.evaluation.summary.missingRequired).toEqual([]) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:241 | server/tests/contracts/audit_2_2_qc_rules.test.js:247 | expect(response.status).toBe(422) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:241 | server/tests/contracts/audit_2_2_qc_rules.test.js:247 | expect(response.body.code).toBe('QC_RULE_SCOPE_INVALID') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:243 | server/tests/contracts/audit_2_2_qc_rules.test.js:249 | expect(await prisma.qcRule.count({ where: { labId: f.labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:244 | server/tests/contracts/audit_2_2_qc_rules.test.js:250 | expect(await prisma.auditLog.count({ where: { entity: 'QC_RULE', labId: f.labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:250 | server/tests/contracts/audit_2_2_qc_rules.test.js:256 | expect(empty.overallStatus).toBe('OPEN') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:251 | server/tests/contracts/audit_2_2_qc_rules.test.js:257 | expect(empty.summary.missingRequired).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'DUPLICATE', required: 4, found: 0 })])) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:252 | server/tests/contracts/audit_2_2_qc_rules.test.js:258 | expect(empty.summary.totalQcSamples).toBe(0) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:259 | server/tests/contracts/audit_2_2_qc_rules.test.js:265 | expect(evaluateDuplicate({ value1, value2 }, policy.duplicate)).toMatchObject({ criterion: 'ABS_DIFF', status: 'PASS', absMax: 3 }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:260 | server/tests/contracts/audit_2_2_qc_rules.test.js:266 | expect(evaluateDuplicate({ value1, value2 }, { mode: 'RPD' })).toMatchObject({ status: 'INVALID', criterion: 'INVALID_NONPOSITIVE' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:262 | server/tests/contracts/audit_2_2_qc_rules.test.js:268 | expect(evaluated.overallStatus).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:272 | server/tests/contracts/audit_2_2_qc_rules.test.js:279 | expect(evaluated.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:272 | server/tests/contracts/audit_2_2_qc_rules.test.js:279 | expect(evaluated.body.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:281 | server/tests/contracts/audit_2_2_qc_rules.test.js:288 | expect(response.status).toBe(409) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:281 | server/tests/contracts/audit_2_2_qc_rules.test.js:288 | expect(response.body.code).toBe('POLICY_QC_RULE_CONFLICT') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:282 | server/tests/contracts/audit_2_2_qc_rules.test.js:289 | expect(await state()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:283 | server/tests/contracts/audit_2_2_qc_rules.test.js:290 | expect((await request(app).get('/api/qc/batches').set('Authorization', 'Bearer ${token}')).status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:284 | server/tests/contracts/audit_2_2_qc_rules.test.js:291 | expect((await request(app).get('/api/qc/batches/${batch.id}').set('Authorization', 'Bearer ${token}')).status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:290 | server/tests/contracts/audit_2_2_qc_rules.test.js:297 | expect(policies.change(actor, f.labId, { expectedVersion: 0, reason: 'Method upper bound', changes: [ { key: 'qc.controlMaxRecovery', value: 92, analysisCode: f.analysisCode, methodologyId: f.methodologyId }] }, { db: prisma })) .rejects.toMatchObject({ statusCode: 409, code: 'POLICY_QC_RULE_CONFLICT' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:293 | server/tests/contracts/audit_2_2_qc_rules.test.js:300 | expect(await prisma.labPolicy.count({ where: { labId: f.labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:294 | server/tests/contracts/audit_2_2_qc_rules.test.js:301 | expect(await prisma.labPolicyOverride.count({ where: { labId: f.labId } })).toBe(0) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:302 | server/tests/contracts/audit_2_2_qc_rules.test.js:309 | expect(await prisma.qcRule.findUnique({ where: { id: first.rule.id } })).toEqual(before) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:303 | server/tests/contracts/audit_2_2_qc_rules.test.js:310 | expect((await resolve(f)).resolved).toMatchObject({ crmRecoveryMin: { value: 90 }, crmRecoveryMax: { value: 92 } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:316 | server/tests/contracts/audit_2_2_qc_rules.test.js:325 | expect(evaluated.status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:316 | server/tests/contracts/audit_2_2_qc_rules.test.js:325 | expect(evaluated.body.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:328 | server/tests/contracts/audit_2_2_qc_rules.test.js:337 | expect(response.status).toBe(409) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:328 | server/tests/contracts/audit_2_2_qc_rules.test.js:337 | expect(response.body.code).toBe('QC_RULE_POLICY_CONFLICT') | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:329 | server/tests/contracts/audit_2_2_qc_rules.test.js:338 | expect(await state()).toEqual(before) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:330 | server/tests/contracts/audit_2_2_qc_rules.test.js:339 | expect((await resolve(f)).resolved).toMatchObject({ crmRecoveryMin: { value: 90 }, crmRecoveryMax: { value: 92 } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:331 | server/tests/contracts/audit_2_2_qc_rules.test.js:340 | expect((await request(app).get('/api/qc/batches').set('Authorization', 'Bearer ${token}')).status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:332 | server/tests/contracts/audit_2_2_qc_rules.test.js:341 | expect((await request(app).get('/api/qc/batches/${batch.id}').set('Authorization', 'Bearer ${token}')).status).toBe(200) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:340 | server/tests/contracts/audit_2_2_qc_rules.test.js:349 | expect(saved.rule.version).toBe(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:341 | server/tests/contracts/audit_2_2_qc_rules.test.js:350 | expect((await resolve(f)).resolved).toMatchObject({ crmRecoveryMin: { value: 91 }, crmRecoveryMax: { value: 92 } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:342 | server/tests/contracts/audit_2_2_qc_rules.test.js:351 | expect(await prisma.auditLog.count({ where: { labId: f.labId, entity: 'QC_RULE' } })).toBe(1) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:354 | server/tests/contracts/audit_2_2_qc_rules.test.js:363 | expect(effective.id).toBe(method.rule.id) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:355 | server/tests/contracts/audit_2_2_qc_rules.test.js:364 | expect(effective.resolved).toMatchObject({ crmRecoveryMin: { value: 90 }, crmRecoveryMax: { value: 92 } }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:369 | server/tests/contracts/audit_2_2_qc_rules.test.js:378 | expect(save({ ...f, methodologyId: otherMethod.id }, { duplicateAbsMax: 0.4 })).rejects.toMatchObject({ statusCode: 409, code: 'QC_RULE_POLICY_CONFLICT' }) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:370 | server/tests/contracts/audit_2_2_qc_rules.test.js:379 | expect(await prisma.qcRule.findMany({ where: { labId: f.labId } })).toEqual(beforeRules) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:371 | server/tests/contracts/audit_2_2_qc_rules.test.js:380 | expect(await prisma.auditLog.findMany({ where: { labId: f.labId } })).toEqual(beforeAudits) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:373 | server/tests/contracts/audit_2_2_qc_rules.test.js:382 | expect(await prisma.qcRule.findUnique({ where: { id: scheduled.id } })).toEqual(scheduled) | Retained |
| server/tests/contracts/audit_2_2_qc_rules.test.js:374 | server/tests/contracts/audit_2_2_qc_rules.test.js:383 | expect((await resolve(f, { evaluatedAt: scheduled.effectiveFrom })).resolved).toMatchObject({ crmRecoveryMin: { value: 90 }, crmRecoveryMax: { value: 92 } }) | Retained |

## server/tests/contracts/audit_2_2_qc_ui.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/audit_2_2_qc_ui.test.js:51 | server/tests/contracts/audit_2_2_qc_ui.test.js:52 | expect(view.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:52 | server/tests/contracts/audit_2_2_qc_ui.test.js:53 | expect(view.all().filter(node => String(node.props?.['data-testid'] \|\| '').startsWith('qc-extra-')).every(node => node.props.value === '')).toBe(true) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:54 | server/tests/contracts/audit_2_2_qc_ui.test.js:55 | expect(view.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:58 | server/tests/contracts/audit_2_2_qc_ui.test.js:59 | expect(view.find('evaluate-qc-btn').props.disabled).toBe(false) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:61 | server/tests/contracts/audit_2_2_qc_ui.test.js:62 | expect(payload.blanks).toEqual([]) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:61 | server/tests/contracts/audit_2_2_qc_ui.test.js:62 | expect(payload.duplicates).toHaveLength(4) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:61 | server/tests/contracts/audit_2_2_qc_ui.test.js:62 | expect(payload.controls).toHaveLength(2) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:62 | server/tests/contracts/audit_2_2_qc_ui.test.js:63 | expect(payload.duplicates[0].rawInput).toEqual({ value1: '7', value2: '7.1' }) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:67 | server/tests/contracts/audit_2_2_qc_ui.test.js:68 | expect(view.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:68 | server/tests/contracts/audit_2_2_qc_ui.test.js:69 | expect(view.find('qc-add-CONTROL')).toBeDefined() | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:68 | server/tests/contracts/audit_2_2_qc_ui.test.js:69 | expect(view.find('qc-add-DUPLICATE')).toBeDefined() | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:70 | server/tests/contracts/audit_2_2_qc_ui.test.js:71 | expect(view.find('evaluate-qc-btn').props.disabled).toBe(false) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:72 | server/tests/contracts/audit_2_2_qc_ui.test.js:73 | expect(view.axios.post.mock.calls[0][1]).toMatchObject({ blanks: [{ value: 0 }], controls: [], duplicates: [] }) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:80 | server/tests/contracts/audit_2_2_qc_ui.test.js:81 | expect(view.find('evaluate-qc-btn').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:81 | server/tests/contracts/audit_2_2_qc_ui.test.js:82 | expect(view.axios.post).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:83 | server/tests/contracts/audit_2_2_qc_ui.test.js:84 | expect(view.find('evaluate-qc-btn').props.disabled).toBe(false) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:92 | server/tests/contracts/audit_2_2_qc_ui.test.js:93 | expect(view.all().filter(node => node.type === 'input' && node.props.type === 'checkbox').every(node => node.props.checked)).toBe(true) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:93 | server/tests/contracts/audit_2_2_qc_ui.test.js:94 | expect(view.button('policies.save').props.disabled).toBe(true) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:95 | server/tests/contracts/audit_2_2_qc_ui.test.js:96 | expect(editor.props.value).toBe('') | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:99 | server/tests/contracts/audit_2_2_qc_ui.test.js:100 | expect(view.axios.post).toHaveBeenCalledWith('/api/qc/rules', expect.objectContaining({ expectedVersion: 4, criteria: expect.objectContaining({ duplicateAbsMax: 0.3, blankPerBatch: null }), reason: 'Method precision approved' })) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:102 | server/tests/contracts/audit_2_2_qc_ui.test.js:103 | expect(view.axios.post.mock.calls.at(-1)[1]).toMatchObject({ reset: true, reason: 'Restore defaults' }) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:106 | server/tests/contracts/audit_2_2_qc_ui.test.js:107 | expect(view.find('qc-rule-editor')).toBeDefined() | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:106 | server/tests/contracts/audit_2_2_qc_ui.test.js:107 | expect(view.button('policies.save')).toBeUndefined() | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:107 | server/tests/contracts/audit_2_2_qc_ui.test.js:108 | expect(view.find('qc-rule-reset')).toBeUndefined() | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:107 | server/tests/contracts/audit_2_2_qc_ui.test.js:108 | expect(view.all().filter(node => node.type === 'input')).toHaveLength(0) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:108 | server/tests/contracts/audit_2_2_qc_ui.test.js:109 | expect(view.axios.post).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:112 | server/tests/contracts/audit_2_2_qc_ui.test.js:113 | expect(client.qcRules).toEqual(server.qcRules) | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:113 | server/tests/contracts/audit_2_2_qc_ui.test.js:114 | expect(typeof client.policies.keys[key.replaceAll('.', '_')]).toBe('string') | Retained |
| server/tests/contracts/audit_2_2_qc_ui.test.js:114 | server/tests/contracts/audit_2_2_qc_ui.test.js:115 | expect(typeof client.qcRules.errors[key]).toBe('string') | Retained |

## server/tests/contracts/candidate_release_review_fixes.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/candidate_release_review_fixes.test.js:135 | server/tests/contracts/candidate_release_review_fixes.test.js:135 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:137 | server/tests/contracts/candidate_release_review_fixes.test.js:137 | expect(reportIds).toContain(reportAPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:138 | server/tests/contracts/candidate_release_review_fixes.test.js:138 | expect(reportIds).not.toContain(reportBPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:146 | server/tests/contracts/candidate_release_review_fixes.test.js:146 | expect(res.status).toBe(403) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:147 | server/tests/contracts/candidate_release_review_fixes.test.js:147 | expect(res.body.error).toMatch(/scope/i) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:155 | server/tests/contracts/candidate_release_review_fixes.test.js:155 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:157 | server/tests/contracts/candidate_release_review_fixes.test.js:157 | expect(reportIds).toContain(reportAPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:158 | server/tests/contracts/candidate_release_review_fixes.test.js:158 | expect(reportIds).not.toContain(reportBPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:166 | server/tests/contracts/candidate_release_review_fixes.test.js:166 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:167 | server/tests/contracts/candidate_release_review_fixes.test.js:167 | expect(res.body.reports).toEqual([]) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:168 | server/tests/contracts/candidate_release_review_fixes.test.js:168 | expect(res.body.pagination.total).toBe(0) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:177 | server/tests/contracts/candidate_release_review_fixes.test.js:177 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:179 | server/tests/contracts/candidate_release_review_fixes.test.js:179 | expect(reportIds).toContain(reportASup.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:180 | server/tests/contracts/candidate_release_review_fixes.test.js:180 | expect(reportIds).toContain(reportAPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:181 | server/tests/contracts/candidate_release_review_fixes.test.js:181 | expect(reportIds).not.toContain(reportBPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:196 | server/tests/contracts/candidate_release_review_fixes.test.js:196 | expect(searchRes.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:198 | server/tests/contracts/candidate_release_review_fixes.test.js:198 | expect(reportIds).toContain(reportAPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:199 | server/tests/contracts/candidate_release_review_fixes.test.js:199 | expect(reportIds).not.toContain(reportBPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:206 | server/tests/contracts/candidate_release_review_fixes.test.js:206 | expect(detailRes.status).toBe(403) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:207 | server/tests/contracts/candidate_release_review_fixes.test.js:207 | expect(detailRes.body.error).toMatch(/scope/i) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:227 | server/tests/contracts/candidate_release_review_fixes.test.js:227 | expect(searchRes.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:229 | server/tests/contracts/candidate_release_review_fixes.test.js:229 | expect(reportIds).toContain(reportAPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:230 | server/tests/contracts/candidate_release_review_fixes.test.js:230 | expect(reportIds).not.toContain(reportBPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:236 | server/tests/contracts/candidate_release_review_fixes.test.js:236 | expect(detailRes.status).toBe(403) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:268 | server/tests/contracts/candidate_release_review_fixes.test.js:268 | expect(searchRes.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:270 | server/tests/contracts/candidate_release_review_fixes.test.js:270 | expect(reportIds).toContain(reportAPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:271 | server/tests/contracts/candidate_release_review_fixes.test.js:271 | expect(reportIds).not.toContain(reportBPub.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:278 | server/tests/contracts/candidate_release_review_fixes.test.js:278 | expect(detailRes.status).toBe(403) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:279 | server/tests/contracts/candidate_release_review_fixes.test.js:279 | expect(detailRes.body.error).toMatch(/scope/i) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:286 | server/tests/contracts/candidate_release_review_fixes.test.js:286 | expect(ownDetailRes.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:397 | server/tests/contracts/candidate_release_review_fixes.test.js:397 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:399 | server/tests/contracts/candidate_release_review_fixes.test.js:399 | expect(allItems).toContain(localItem.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:400 | server/tests/contracts/candidate_release_review_fixes.test.js:400 | expect(allItems).not.toContain(crossLabItem.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:408 | server/tests/contracts/candidate_release_review_fixes.test.js:408 | expect(res.status).toBe(403) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:409 | server/tests/contracts/candidate_release_review_fixes.test.js:409 | expect(res.body.error).toBe('FORBIDDEN') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:417 | server/tests/contracts/candidate_release_review_fixes.test.js:417 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:419 | server/tests/contracts/candidate_release_review_fixes.test.js:419 | expect(res.body.stats.myWorkCount).toBe(1) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:441 | server/tests/contracts/candidate_release_review_fixes.test.js:441 | expect(draftsRes.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:443 | server/tests/contracts/candidate_release_review_fixes.test.js:443 | expect(draftItemIds).not.toContain(crossLabItem.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:450 | server/tests/contracts/candidate_release_review_fixes.test.js:450 | expect(queueRes.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:451 | server/tests/contracts/candidate_release_review_fixes.test.js:451 | expect(queueRes.body.stats.totalDrafts).toBe(0) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:458 | server/tests/contracts/candidate_release_review_fixes.test.js:458 | expect([403, 500]).toContain(discardRes.status) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:465 | server/tests/contracts/candidate_release_review_fixes.test.js:465 | expect(clearRes.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:466 | server/tests/contracts/candidate_release_review_fixes.test.js:466 | expect(clearRes.body.count).toBe(0) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:504 | server/tests/contracts/candidate_release_review_fixes.test.js:504 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:506 | server/tests/contracts/candidate_release_review_fixes.test.js:506 | expect(allItems).not.toContain(conflictItem.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:507 | server/tests/contracts/candidate_release_review_fixes.test.js:507 | expect(allItems).toContain(localItem.id) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:510 | server/tests/contracts/candidate_release_review_fixes.test.js:510 | expect(res.body.stats.myWorkCount).toBe(1) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:511 | server/tests/contracts/candidate_release_review_fixes.test.js:511 | expect(res.body.stats.totalItems).toBe(1) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:638 | server/tests/contracts/candidate_release_review_fixes.test.js:639 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:639 | server/tests/contracts/candidate_release_review_fixes.test.js:640 | expect(res.body.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:643 | server/tests/contracts/candidate_release_review_fixes.test.js:644 | expect(updatedComp.status).toBe('REPEAT_REQUIRED') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:644 | server/tests/contracts/candidate_release_review_fixes.test.js:645 | expect(updatedComp.reanalysisReason).toBe('Control standard outside tolerance') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:648 | server/tests/contracts/candidate_release_review_fixes.test.js:649 | expect(updatedAcc.status).toBe('ACCEPTED') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:652 | server/tests/contracts/candidate_release_review_fixes.test.js:653 | expect(updatedRelSmp.status).toBe('COMPLETED') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:664 | server/tests/contracts/candidate_release_review_fixes.test.js:665 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:665 | server/tests/contracts/candidate_release_review_fixes.test.js:666 | expect(res.body.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:666 | server/tests/contracts/candidate_release_review_fixes.test.js:667 | expect(res.body.idempotent).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:677 | server/tests/contracts/candidate_release_review_fixes.test.js:678 | expect(conflictRes.status).toBe(409) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:678 | server/tests/contracts/candidate_release_review_fixes.test.js:679 | expect(conflictRes.body.error).toBe('DISPOSITION_CONFLICT') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:757 | server/tests/contracts/candidate_release_review_fixes.test.js:758 | expect(result.allowed).toBe(false) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:758 | server/tests/contracts/candidate_release_review_fixes.test.js:759 | expect(result.exceptionRequired).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:759 | server/tests/contracts/candidate_release_review_fixes.test.js:760 | expect(result.code).toBe('EXCEPTION_REQUIRED') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:774 | server/tests/contracts/candidate_release_review_fixes.test.js:775 | expect(res.status).toBe(422) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:775 | server/tests/contracts/candidate_release_review_fixes.test.js:776 | expect(res.body.error).toBe('EXCEPTION_REQUIRED') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:795 | server/tests/contracts/candidate_release_review_fixes.test.js:796 | expect(res.status).toBe(422) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:796 | server/tests/contracts/candidate_release_review_fixes.test.js:797 | expect(res.body.error).toBe('EXCEPTION_NOT_AUTHORIZED') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:852 | server/tests/contracts/candidate_release_review_fixes.test.js:853 | expect(dryResult.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:853 | server/tests/contracts/candidate_release_review_fixes.test.js:854 | expect(dryResult.dryRun).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:854 | server/tests/contracts/candidate_release_review_fixes.test.js:855 | expect(dryResult.applied).toBe(false) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:855 | server/tests/contracts/candidate_release_review_fixes.test.js:856 | expect(dryResult.needsMigration).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:856 | server/tests/contracts/candidate_release_review_fixes.test.js:857 | expect(dryResult.missingColumns).toEqual( expect.arrayContaining(['templateId', 'templateVersion', 'policyConfig', 'programmeCode', 'parentProjectId']) ) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:859 | server/tests/contracts/candidate_release_review_fixes.test.js:860 | expect(hashBefore).toBe(hashAfter) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:865 | server/tests/contracts/candidate_release_review_fixes.test.js:866 | expect(cols.length).toBe(7) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:896 | server/tests/contracts/candidate_release_review_fixes.test.js:897 | expect(idxCountBefore).toBe(0) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:901 | server/tests/contracts/candidate_release_review_fixes.test.js:902 | expect(dryResult.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:902 | server/tests/contracts/candidate_release_review_fixes.test.js:903 | expect(dryResult.dryRun).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:903 | server/tests/contracts/candidate_release_review_fixes.test.js:904 | expect(dryResult.applied).toBe(false) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:904 | server/tests/contracts/candidate_release_review_fixes.test.js:905 | expect(dryResult.needsMigration).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:905 | server/tests/contracts/candidate_release_review_fixes.test.js:906 | expect(dryResult.missingColumns).toEqual([]) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:906 | server/tests/contracts/candidate_release_review_fixes.test.js:907 | expect(dryResult.missingIndex).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:913 | server/tests/contracts/candidate_release_review_fixes.test.js:914 | expect(idxCountAfter).toBe(0) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:914 | server/tests/contracts/candidate_release_review_fixes.test.js:915 | expect(hashBefore).toBe(hashAfter) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:918 | server/tests/contracts/candidate_release_review_fixes.test.js:919 | expect(applyResult.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:919 | server/tests/contracts/candidate_release_review_fixes.test.js:920 | expect(applyResult.applied).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:920 | server/tests/contracts/candidate_release_review_fixes.test.js:921 | expect(applyResult.addedColumns).toEqual([]) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:921 | server/tests/contracts/candidate_release_review_fixes.test.js:922 | expect(applyResult.createdIndex).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:926 | server/tests/contracts/candidate_release_review_fixes.test.js:927 | expect(idxCountFinal).toBe(1) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:930 | server/tests/contracts/candidate_release_review_fixes.test.js:931 | expect(rerunResult.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:931 | server/tests/contracts/candidate_release_review_fixes.test.js:932 | expect(rerunResult.applied).toBe(false) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:932 | server/tests/contracts/candidate_release_review_fixes.test.js:933 | expect(rerunResult.missingIndex).toBe(false) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:940 | server/tests/contracts/candidate_release_review_fixes.test.js:941 | expect(result.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:941 | server/tests/contracts/candidate_release_review_fixes.test.js:942 | expect(result.applied).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:942 | server/tests/contracts/candidate_release_review_fixes.test.js:943 | expect(result.totalProjects).toBe(1) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:946 | server/tests/contracts/candidate_release_review_fixes.test.js:947 | expect(row.code).toBe('PRJ-LEGACY') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:947 | server/tests/contracts/candidate_release_review_fixes.test.js:948 | expect(row.templateId).toBe('GENERIC_OPEN_INTAKE') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:948 | server/tests/contracts/candidate_release_review_fixes.test.js:949 | expect(row.templateVersion).toBe('1.0.0') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:949 | server/tests/contracts/candidate_release_review_fixes.test.js:950 | expect(row.policyConfig).toBeNull() | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:950 | server/tests/contracts/candidate_release_review_fixes.test.js:951 | expect(row.programmeCode).toBeNull() | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:951 | server/tests/contracts/candidate_release_review_fixes.test.js:952 | expect(row.parentProjectId).toBeNull() | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:955 | server/tests/contracts/candidate_release_review_fixes.test.js:956 | expect(fkIssues).toEqual([]) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:961 | server/tests/contracts/candidate_release_review_fixes.test.js:962 | expect(rerun.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:962 | server/tests/contracts/candidate_release_review_fixes.test.js:963 | expect(rerun.applied).toBe(false) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:963 | server/tests/contracts/candidate_release_review_fixes.test.js:964 | expect(rerun.missingColumns).toEqual([]) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:968 | server/tests/contracts/candidate_release_review_fixes.test.js:969 | expect(() => migrateProjectTemplatesAndPolicy(nonExistentDb)).toThrow( /Target database file not found/ ) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:980 | server/tests/contracts/candidate_release_review_fixes.test.js:981 | expect(() => migrateProjectTemplatesAndPolicy(missingTableDbPath)).toThrow( /Table "Project" does not exist/ ) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:994 | server/tests/contracts/candidate_release_review_fixes.test.js:995 | expect(() => migrateProjectTemplatesAndPolicy(rollbackDbPath)).toThrow( /Foreign key check failed/ ) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1004 | server/tests/contracts/candidate_release_review_fixes.test.js:1005 | expect(colNames).toEqual(['id', 'code', 'name', 'status', 'parentRef']) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1005 | server/tests/contracts/candidate_release_review_fixes.test.js:1006 | expect(colNames).not.toContain('templateId') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1006 | server/tests/contracts/candidate_release_review_fixes.test.js:1007 | expect(colNames).not.toContain('parentProjectId') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1064 | server/tests/contracts/candidate_release_review_fixes.test.js:1065 | expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1087 | server/tests/contracts/candidate_release_review_fixes.test.js:1088 | expect(preSnapshots.results.count).toBe(2) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1088 | server/tests/contracts/candidate_release_review_fixes.test.js:1089 | expect(preSnapshots.reports.count).toBe(3) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1089 | server/tests/contracts/candidate_release_review_fixes.test.js:1090 | expect(preSnapshots.shareLinks.count).toBe(1) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1090 | server/tests/contracts/candidate_release_review_fixes.test.js:1091 | expect(preSnapshots.auditLogs.count).toBe(2) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1091 | server/tests/contracts/candidate_release_review_fixes.test.js:1092 | expect(preSnapshots.projects.count).toBe(2) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1095 | server/tests/contracts/candidate_release_review_fixes.test.js:1096 | expect(migResult.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1096 | server/tests/contracts/candidate_release_review_fixes.test.js:1097 | expect(migResult.applied).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1097 | server/tests/contracts/candidate_release_review_fixes.test.js:1098 | expect(migResult.totalProjects).toBe(2) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1098 | server/tests/contracts/candidate_release_review_fixes.test.js:1099 | expect(migResult.addedColumns).toEqual([ 'templateId', 'templateVersion', 'policyConfig', 'programmeCode', 'parentProjectId' ]) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1127 | server/tests/contracts/candidate_release_review_fixes.test.js:1128 | expect(postSnapshots.results.hash).toBe(preSnapshots.results.hash) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1128 | server/tests/contracts/candidate_release_review_fixes.test.js:1129 | expect(postSnapshots.reports.hash).toBe(preSnapshots.reports.hash) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1129 | server/tests/contracts/candidate_release_review_fixes.test.js:1130 | expect(postSnapshots.shareLinks.hash).toBe(preSnapshots.shareLinks.hash) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1130 | server/tests/contracts/candidate_release_review_fixes.test.js:1131 | expect(postSnapshots.auditLogs.hash).toBe(preSnapshots.auditLogs.hash) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1131 | server/tests/contracts/candidate_release_review_fixes.test.js:1132 | expect(postSnapshots.workItems.hash).toBe(preSnapshots.workItems.hash) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1132 | server/tests/contracts/candidate_release_review_fixes.test.js:1133 | expect(postSnapshots.samples.hash).toBe(preSnapshots.samples.hash) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1133 | server/tests/contracts/candidate_release_review_fixes.test.js:1134 | expect(postSnapshots.batches.hash).toBe(preSnapshots.batches.hash) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1134 | server/tests/contracts/candidate_release_review_fixes.test.js:1135 | expect(postSnapshots.labs.hash).toBe(preSnapshots.labs.hash) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1135 | server/tests/contracts/candidate_release_review_fixes.test.js:1136 | expect(postSnapshots.users.hash).toBe(preSnapshots.users.hash) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1139 | server/tests/contracts/candidate_release_review_fixes.test.js:1140 | expect(legacyQueryRows.length).toBe(2) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1140 | server/tests/contracts/candidate_release_review_fixes.test.js:1141 | expect(legacyQueryRows[0].code).toBe('PRJ-GTM-ALPHA') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1141 | server/tests/contracts/candidate_release_review_fixes.test.js:1142 | expect(legacyQueryRows[1].code).toBe('PRJ-KEN-BETA') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1152 | server/tests/contracts/candidate_release_review_fixes.test.js:1153 | expect(attemptUpgrade).toMatchObject({ classification: 'COMPLETE', backfillCount: 0, counts: { results: 2, linked: 0 } }) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1156 | server/tests/contracts/candidate_release_review_fixes.test.js:1157 | expect(verified.prepare('SELECT ${originalResultFields} FROM "Result" ORDER BY id').all()).toEqual(preSnapshots.results.rows) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1165 | server/tests/contracts/candidate_release_review_fixes.test.js:1166 | expect(projects.length).toBe(2) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1166 | server/tests/contracts/candidate_release_review_fixes.test.js:1167 | expect(projects[0].templateId).toBe('GENERIC_OPEN_INTAKE') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1167 | server/tests/contracts/candidate_release_review_fixes.test.js:1168 | expect(projects[0].templateVersion).toBe('1.0.0') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1168 | server/tests/contracts/candidate_release_review_fixes.test.js:1169 | expect(projects[0].policyConfig).toBeNull() | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1169 | server/tests/contracts/candidate_release_review_fixes.test.js:1170 | expect(projects[0].programmeCode).toBeNull() | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1170 | server/tests/contracts/candidate_release_review_fixes.test.js:1171 | expect(projects[0].parentProjectId).toBeNull() | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1173 | server/tests/contracts/candidate_release_review_fixes.test.js:1174 | expect(results.length).toBe(2) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1174 | server/tests/contracts/candidate_release_review_fixes.test.js:1175 | expect(results[0].value).toBe('6.85') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1175 | server/tests/contracts/candidate_release_review_fixes.test.js:1176 | expect(results[0].numericValue).toBe(6.85) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1176 | server/tests/contracts/candidate_release_review_fixes.test.js:1177 | expect(results[1].value).toBe('7.12') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1177 | server/tests/contracts/candidate_release_review_fixes.test.js:1178 | expect(results[1].numericValue).toBe(7.12) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1180 | server/tests/contracts/candidate_release_review_fixes.test.js:1181 | expect(shareLinks.length).toBe(1) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1181 | server/tests/contracts/candidate_release_review_fixes.test.js:1182 | expect(shareLinks[0].tokenHash).toBe('synthetic-token-hash-pub1') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1184 | server/tests/contracts/candidate_release_review_fixes.test.js:1185 | expect(auditLogs.length).toBe(2) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1194 | server/tests/contracts/candidate_release_review_fixes.test.js:1195 | expect(openIntakeDesk.allowed).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1212 | server/tests/contracts/candidate_release_review_fixes.test.js:1213 | expect(deskNoException.allowed).toBe(false) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1213 | server/tests/contracts/candidate_release_review_fixes.test.js:1214 | expect(deskNoException.exceptionRequired).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1214 | server/tests/contracts/candidate_release_review_fixes.test.js:1215 | expect(deskNoException.code).toBe('EXCEPTION_REQUIRED') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1225 | server/tests/contracts/candidate_release_review_fixes.test.js:1226 | expect(deskWithManagerException.allowed).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1234 | server/tests/contracts/candidate_release_review_fixes.test.js:1235 | expect(manifestAllowed.allowed).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1243 | server/tests/contracts/candidate_release_review_fixes.test.js:1244 | expect(koboDenied.allowed).toBe(false) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1244 | server/tests/contracts/candidate_release_review_fixes.test.js:1245 | expect(koboDenied.exceptionRequired).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1293 | server/tests/contracts/candidate_release_review_fixes.test.js:1294 | expect(outLine).toBeDefined() | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1296 | server/tests/contracts/candidate_release_review_fixes.test.js:1297 | expect(httpResults.techSearch.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1297 | server/tests/contracts/candidate_release_review_fixes.test.js:1298 | expect(httpResults.techSearch.reports).toContain('REP-PUB') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1298 | server/tests/contracts/candidate_release_review_fixes.test.js:1299 | expect(httpResults.techSearch.reports).not.toContain('REP-KEN') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1300 | server/tests/contracts/candidate_release_review_fixes.test.js:1301 | expect(httpResults.techKenDetail.status).toBe(403) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1302 | server/tests/contracts/candidate_release_review_fixes.test.js:1303 | expect(httpResults.natSearch.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1303 | server/tests/contracts/candidate_release_review_fixes.test.js:1304 | expect(httpResults.natSearch.reports).toContain('REP-PUB') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1304 | server/tests/contracts/candidate_release_review_fixes.test.js:1305 | expect(httpResults.natSearch.reports).not.toContain('REP-KEN') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1306 | server/tests/contracts/candidate_release_review_fixes.test.js:1307 | expect(httpResults.pmSearch.status).toBe(200) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1307 | server/tests/contracts/candidate_release_review_fixes.test.js:1308 | expect(httpResults.pmSearch.reports).toContain('REP-KEN') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1308 | server/tests/contracts/candidate_release_review_fixes.test.js:1309 | expect(httpResults.pmSearch.reports).not.toContain('REP-PUB') | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1312 | server/tests/contracts/candidate_release_review_fixes.test.js:1313 | expect(rerun.success).toBe(true) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1313 | server/tests/contracts/candidate_release_review_fixes.test.js:1314 | expect(rerun.applied).toBe(false) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1314 | server/tests/contracts/candidate_release_review_fixes.test.js:1315 | expect(rerun.missingColumns).toEqual([]) | Retained |
| server/tests/contracts/candidate_release_review_fixes.test.js:1315 | server/tests/contracts/candidate_release_review_fixes.test.js:1316 | expect(rerun.totalProjects).toBe(2) | Retained |

## server/tests/contracts/deployment_readiness_bootstrap.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:44 | server/tests/contracts/deployment_readiness_bootstrap.test.js:44 | expect(res.status).toBe(1) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:45 | server/tests/contracts/deployment_readiness_bootstrap.test.js:45 | expect(res.stdout + res.stderr).toMatch(/Invalid mode: invalid_mode/i) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:65 | server/tests/contracts/deployment_readiness_bootstrap.test.js:65 | expect(res.status).toBe(1) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:66 | server/tests/contracts/deployment_readiness_bootstrap.test.js:66 | expect(res.stdout + res.stderr).toMatch(/Supported Node\.js (LTS )?required/i) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:106 | server/tests/contracts/deployment_readiness_bootstrap.test.js:106 | expect(res.status).not.toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:108 | server/tests/contracts/deployment_readiness_bootstrap.test.js:108 | expect(res.stdout).not.toMatch(/Database ready/i) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:110 | server/tests/contracts/deployment_readiness_bootstrap.test.js:110 | expect(res.stdout).not.toMatch(/Setup Complete/i) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:114 | server/tests/contracts/deployment_readiness_bootstrap.test.js:114 | expect(trace).not.toMatch(/SEED SHOULD NOT BE CALLED/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:152 | server/tests/contracts/deployment_readiness_bootstrap.test.js:152 | expect(res.status).toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:157 | server/tests/contracts/deployment_readiness_bootstrap.test.js:157 | expect(match).not.toBeNull() | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:181 | server/tests/contracts/deployment_readiness_bootstrap.test.js:181 | expect(res.status).toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:188 | server/tests/contracts/deployment_readiness_bootstrap.test.js:188 | expect(emptyHash1).toBe(emptyHash2) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:193 | server/tests/contracts/deployment_readiness_bootstrap.test.js:193 | expect(configuredHash1).toBe(configuredHash2) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:194 | server/tests/contracts/deployment_readiness_bootstrap.test.js:194 | expect(emptyHash1).not.toBe(configuredHash1) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:261 | server/tests/contracts/deployment_readiness_bootstrap.test.js:261 | expect(first.status).toBe(77) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:263 | server/tests/contracts/deployment_readiness_bootstrap.test.js:263 | expect(firstTrace).toMatch(/npx prisma db push/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:264 | server/tests/contracts/deployment_readiness_bootstrap.test.js:264 | expect(firstTrace).toMatch(/node seed\.js/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:271 | server/tests/contracts/deployment_readiness_bootstrap.test.js:271 | expect(secondTrace).toMatch(/node seed\.js/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:272 | server/tests/contracts/deployment_readiness_bootstrap.test.js:272 | expect(secondTrace).not.toMatch(/npx prisma db push/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:279 | server/tests/contracts/deployment_readiness_bootstrap.test.js:279 | expect(thirdTrace).not.toMatch(/node seed\.js/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:280 | server/tests/contracts/deployment_readiness_bootstrap.test.js:280 | expect(thirdTrace).not.toMatch(/npx prisma db push/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:312 | server/tests/contracts/deployment_readiness_bootstrap.test.js:312 | expect(res.status).not.toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:313 | server/tests/contracts/deployment_readiness_bootstrap.test.js:313 | expect(res.stdout + res.stderr).toMatch(/Database inspection failed/i) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:314 | server/tests/contracts/deployment_readiness_bootstrap.test.js:314 | expect(res.stdout).not.toMatch(/LIMS_STARTED_SUCCESS/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:378 | server/tests/contracts/deployment_readiness_bootstrap.test.js:381 | expect(res.status).toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:379 | server/tests/contracts/deployment_readiness_bootstrap.test.js:382 | expect(res.stdout).toMatch(/LIMS_STARTED_SUCCESS/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:380 | server/tests/contracts/deployment_readiness_bootstrap.test.js:383 | expect(res.stdout + res.stderr).not.toMatch(/Database inspection failed/i) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:381 | server/tests/contracts/deployment_readiness_bootstrap.test.js:384 | expect(res.stdout).toContain('"mode": "NO_OP"') | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:382 | server/tests/contracts/deployment_readiness_bootstrap.test.js:385 | expect(res.stdout).toContain('"classification": "COMPLETE"') | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:383 | server/tests/contracts/deployment_readiness_bootstrap.test.js:386 | expect(res.stdout).toContain('"totalChanges": 0') | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:384 | server/tests/contracts/deployment_readiness_bootstrap.test.js:387 | expect(hashDb()).toBe(beforeSha) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:396 | server/tests/contracts/deployment_readiness_bootstrap.test.js:399 | expect(db.prepare('SELECT count(*) n FROM ${table}').get().n).toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:413 | server/tests/contracts/deployment_readiness_bootstrap.test.js:416 | expect(res.status).toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:414 | server/tests/contracts/deployment_readiness_bootstrap.test.js:417 | expect(res.stdout).toMatch(/Using existing default laboratory/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:415 | server/tests/contracts/deployment_readiness_bootstrap.test.js:418 | expect(res.stdout).toMatch(/Created user: admin/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:423 | server/tests/contracts/deployment_readiness_bootstrap.test.js:426 | expect(labCount).toBe(1) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:424 | server/tests/contracts/deployment_readiness_bootstrap.test.js:427 | expect(userCount).toBe(1) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:425 | server/tests/contracts/deployment_readiness_bootstrap.test.js:428 | expect(adminUser.role).toBe('LAB_MANAGER') | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:426 | server/tests/contracts/deployment_readiness_bootstrap.test.js:429 | expect(adminUser.labId).toBe('lab-preexisting') | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:446 | server/tests/contracts/deployment_readiness_bootstrap.test.js:449 | expect(baseRes.status).toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:448 | server/tests/contracts/deployment_readiness_bootstrap.test.js:451 | expect(baseConfig.services.lims).toBeDefined() | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:449 | server/tests/contracts/deployment_readiness_bootstrap.test.js:452 | expect(baseConfig.services.lims.image).toMatch(/soilfer-lims/) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:450 | server/tests/contracts/deployment_readiness_bootstrap.test.js:453 | expect(baseConfig.services.lims.environment.DEPLOYMENT_MODE).toBe('local') | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:460 | server/tests/contracts/deployment_readiness_bootstrap.test.js:463 | expect(globalRes.status).toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:462 | server/tests/contracts/deployment_readiness_bootstrap.test.js:465 | expect(globalConfig.services.lims.environment.DEPLOYMENT_MODE).toBe('global') | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:472 | server/tests/contracts/deployment_readiness_bootstrap.test.js:475 | expect(nginxRes.status).toBe(0) | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:474 | server/tests/contracts/deployment_readiness_bootstrap.test.js:477 | expect(nginxConfig.services.nginx).toBeDefined() | Retained |
| server/tests/contracts/deployment_readiness_bootstrap.test.js:475 | server/tests/contracts/deployment_readiness_bootstrap.test.js:478 | expect(nginxConfig.services.lims.environment.DEPLOYMENT_MODE).toBe('local') | Retained |

## server/tests/contracts/native_spectral_parsers.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/native_spectral_parsers.test.js:191 | server/tests/contracts/native_spectral_parsers.test.js:191 | expect(parsed.format).toBe('OPUS') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:192 | server/tests/contracts/native_spectral_parsers.test.js:192 | expect(parsed.instrument).toBe('Bruker Tensor 27') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:193 | server/tests/contracts/native_spectral_parsers.test.js:193 | expect(parsed.resolution).toBe(4.0) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:194 | server/tests/contracts/native_spectral_parsers.test.js:194 | expect(parsed.coAddedScans).toBe(64) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:195 | server/tests/contracts/native_spectral_parsers.test.js:195 | expect(parsed.backgroundRef).toMatch(/32 scans/) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:196 | server/tests/contracts/native_spectral_parsers.test.js:196 | expect(parsed.quantity).toBe('ABSORBANCE') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:197 | server/tests/contracts/native_spectral_parsers.test.js:197 | expect(parsed.axisUnit).toBe('WAVENUMBER_CM1') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:198 | server/tests/contracts/native_spectral_parsers.test.js:198 | expect(parsed.axisDirection).toBe('DESCENDING') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:199 | server/tests/contracts/native_spectral_parsers.test.js:199 | expect(parsed.wavelengths.length).toBe(50) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:200 | server/tests/contracts/native_spectral_parsers.test.js:200 | expect(parsed.values.length).toBe(50) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:201 | server/tests/contracts/native_spectral_parsers.test.js:201 | expect(parsed.wavelengths[0]).toBe(4000) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:202 | server/tests/contracts/native_spectral_parsers.test.js:202 | expect(parsed.wavelengths[49]).toBe(400) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:209 | server/tests/contracts/native_spectral_parsers.test.js:209 | expect(parsed.format).toBe('ASD') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:210 | server/tests/contracts/native_spectral_parsers.test.js:210 | expect(parsed.instrument).toBe('ASD FieldSpec') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:211 | server/tests/contracts/native_spectral_parsers.test.js:211 | expect(parsed.quantity).toBe('REFLECTANCE') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:212 | server/tests/contracts/native_spectral_parsers.test.js:212 | expect(parsed.axisUnit).toBe('WAVELENGTH_NM') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:213 | server/tests/contracts/native_spectral_parsers.test.js:213 | expect(parsed.axisDirection).toBe('ASCENDING') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:214 | server/tests/contracts/native_spectral_parsers.test.js:214 | expect(parsed.wavelengths.length).toBe(80) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:215 | server/tests/contracts/native_spectral_parsers.test.js:215 | expect(parsed.wavelengths[0]).toBe(350) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:222 | server/tests/contracts/native_spectral_parsers.test.js:222 | expect(parsed.format).toBe('SPC') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:223 | server/tests/contracts/native_spectral_parsers.test.js:223 | expect(parsed.instrument).toBe('Thermo GRAMS / SPC') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:224 | server/tests/contracts/native_spectral_parsers.test.js:224 | expect(parsed.quantity).toBe('ABSORBANCE') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:225 | server/tests/contracts/native_spectral_parsers.test.js:225 | expect(parsed.axisUnit).toBe('WAVENUMBER_CM1') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:226 | server/tests/contracts/native_spectral_parsers.test.js:226 | expect(parsed.wavelengths.length).toBe(60) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:246 | server/tests/contracts/native_spectral_parsers.test.js:246 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:247 | server/tests/contracts/native_spectral_parsers.test.js:247 | expect(res.body.results.success).toBe(1) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:254 | server/tests/contracts/native_spectral_parsers.test.js:254 | expect(savedScan).not.toBeNull() | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:255 | server/tests/contracts/native_spectral_parsers.test.js:255 | expect(savedScan.sourceFormat).toBe('OPUS') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:256 | server/tests/contracts/native_spectral_parsers.test.js:256 | expect(savedScan.resolution).toBe(4.0) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:257 | server/tests/contracts/native_spectral_parsers.test.js:257 | expect(savedScan.coAddedScans).toBe(32) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:258 | server/tests/contracts/native_spectral_parsers.test.js:258 | expect(savedScan.backgroundRef).toMatch(/16 scans/) | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:259 | server/tests/contracts/native_spectral_parsers.test.js:259 | expect(savedScan.quantity).toBe('ABSORBANCE') | Retained |
| server/tests/contracts/native_spectral_parsers.test.js:260 | server/tests/contracts/native_spectral_parsers.test.js:260 | expect(savedScan.axisUnit).toBe('WAVENUMBER_CM1') | Retained |

## server/tests/contracts/qc_batch_evaluation.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/qc_batch_evaluation.test.js:54 | server/tests/contracts/qc_batch_evaluation.test.js:56 | expect(batchRes.statusCode).toBe(201) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:91 | server/tests/contracts/qc_batch_evaluation.test.js:93 | expect(addRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:92 | server/tests/contracts/qc_batch_evaluation.test.js:94 | expect(addRes.body.error).toContain('exceeds maximum batch capacity of 40') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:102 | server/tests/contracts/qc_batch_evaluation.test.js:104 | expect(batchRes.statusCode).toBe(201) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:149 | server/tests/contracts/qc_batch_evaluation.test.js:151 | expect(failRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:150 | server/tests/contracts/qc_batch_evaluation.test.js:152 | expect(failRes.body.error).toContain('does not match batch analysis') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:158 | server/tests/contracts/qc_batch_evaluation.test.js:160 | expect(passRes.statusCode).toBe(200) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:159 | server/tests/contracts/qc_batch_evaluation.test.js:161 | expect(passRes.body.success).toBe(true) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:199 | server/tests/contracts/qc_batch_evaluation.test.js:201 | expect(sealRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:200 | server/tests/contracts/qc_batch_evaluation.test.js:202 | expect(sealRes.body.error).toContain('already sealed') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:210 | server/tests/contracts/qc_batch_evaluation.test.js:212 | expect(batchRes.statusCode).toBe(201) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:212 | server/tests/contracts/qc_batch_evaluation.test.js:214 | expect(batchRes.body.runProfile).toBeDefined() | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:213 | server/tests/contracts/qc_batch_evaluation.test.js:215 | expect(batchRes.body.runProfile.capacity).toBe(24) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:214 | server/tests/contracts/qc_batch_evaluation.test.js:216 | expect(batchRes.body.runProfile.qcSlots.length).toBeGreaterThanOrEqual(3) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:249 | server/tests/contracts/qc_batch_evaluation.test.js:251 | expect(addRes.statusCode).toBe(200) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:256 | server/tests/contracts/qc_batch_evaluation.test.js:258 | expect(getRes.statusCode).toBe(200) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:257 | server/tests/contracts/qc_batch_evaluation.test.js:259 | expect(getRes.body.runProfile.profileKey).toBe('CENTRIFUGE_24') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:258 | server/tests/contracts/qc_batch_evaluation.test.js:260 | expect(getRes.body.data.workItems.length).toBe(2) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:259 | server/tests/contracts/qc_batch_evaluation.test.js:261 | expect(getRes.body.data.workItems[0].id).toBe(wid1) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:260 | server/tests/contracts/qc_batch_evaluation.test.js:262 | expect(getRes.body.data.workItems[0].rackPosition).toBe(3) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:261 | server/tests/contracts/qc_batch_evaluation.test.js:263 | expect(getRes.body.data.workItems[1].id).toBe(wid2) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:262 | server/tests/contracts/qc_batch_evaluation.test.js:264 | expect(getRes.body.data.workItems[1].rackPosition).toBe(4) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:271 | server/tests/contracts/qc_batch_evaluation.test.js:273 | expect(batchRes.statusCode).toBe(201) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:273 | server/tests/contracts/qc_batch_evaluation.test.js:275 | expect(batchRes.body.runProfile.capacity).toBe(96) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:274 | server/tests/contracts/qc_batch_evaluation.test.js:276 | expect(batchRes.body.runProfile.qcSlots.some(s => s.position === 96)).toBe(true) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:283 | server/tests/contracts/qc_batch_evaluation.test.js:285 | expect(batchRes.statusCode).toBe(201) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:290 | server/tests/contracts/qc_batch_evaluation.test.js:292 | expect(foreignRes.statusCode).toBe(403) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:291 | server/tests/contracts/qc_batch_evaluation.test.js:293 | expect(foreignRes.body.error).toContain('outside your laboratory scope') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:306 | server/tests/contracts/qc_batch_evaluation.test.js:308 | expect(foreignUpdate.statusCode).toBe(403) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:307 | server/tests/contracts/qc_batch_evaluation.test.js:309 | expect(foreignUpdate.body.error).toContain('outside your laboratory scope') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:322 | server/tests/contracts/qc_batch_evaluation.test.js:324 | expect(foreignEval.statusCode).toBe(403) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:329 | server/tests/contracts/qc_batch_evaluation.test.js:331 | expect(foreignAdd.statusCode).toBe(403) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:339 | server/tests/contracts/qc_batch_evaluation.test.js:341 | expect(batchRes.statusCode).toBe(201) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:369 | server/tests/contracts/qc_batch_evaluation.test.js:371 | expect(addRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:370 | server/tests/contracts/qc_batch_evaluation.test.js:372 | expect(addRes.body.error).toContain('reserved for QC slot') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:412 | server/tests/contracts/qc_batch_evaluation.test.js:414 | expect(dupPayloadRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:413 | server/tests/contracts/qc_batch_evaluation.test.js:415 | expect(dupPayloadRes.body.error).toContain('Duplicate rack position') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:423 | server/tests/contracts/qc_batch_evaluation.test.js:425 | expect(addWid1.statusCode).toBe(200) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:434 | server/tests/contracts/qc_batch_evaluation.test.js:436 | expect(collisionRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:435 | server/tests/contracts/qc_batch_evaluation.test.js:437 | expect(collisionRes.body.error).toContain('already occupied') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:475 | server/tests/contracts/qc_batch_evaluation.test.js:477 | expect(removeRes.statusCode).toBe(200) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:476 | server/tests/contracts/qc_batch_evaluation.test.js:478 | expect(removeRes.body.success).toBe(true) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:480 | server/tests/contracts/qc_batch_evaluation.test.js:482 | expect(checkWi.batchId).toBeNull() | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:481 | server/tests/contracts/qc_batch_evaluation.test.js:483 | expect(checkWi.rackPosition).toBeNull() | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:497 | server/tests/contracts/qc_batch_evaluation.test.js:499 | expect(updateRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:498 | server/tests/contracts/qc_batch_evaluation.test.js:500 | expect(updateRes.body.error).toContain('without evaluated QC evidence') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:516 | server/tests/contracts/qc_batch_evaluation.test.js:518 | expect(updateRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:517 | server/tests/contracts/qc_batch_evaluation.test.js:519 | expect(updateRes.body.error).toContain('failed acceptance criteria') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:536 | server/tests/contracts/qc_batch_evaluation.test.js:538 | expect(updateRes.statusCode).toBe(200) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:537 | server/tests/contracts/qc_batch_evaluation.test.js:539 | expect(updateRes.body.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:552 | server/tests/contracts/qc_batch_evaluation.test.js:554 | expect(techClose.statusCode).toBe(403) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:559 | server/tests/contracts/qc_batch_evaluation.test.js:561 | expect(mgrClose.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:560 | server/tests/contracts/qc_batch_evaluation.test.js:562 | expect(mgrClose.body.error).toContain('QC must be passed') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:585 | server/tests/contracts/qc_batch_evaluation.test.js:587 | expect(closeRes.statusCode).toBe(200) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:592 | server/tests/contracts/qc_batch_evaluation.test.js:594 | expect(editRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:593 | server/tests/contracts/qc_batch_evaluation.test.js:595 | expect(editRes.body.error).toContain('Batch is CLOSED and cannot be modified') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:616 | server/tests/contracts/qc_batch_evaluation.test.js:619 | expect(res.statusCode).toBe(200) | Translated: expect(res.statusCode).toBe(400) |
| server/tests/contracts/qc_batch_evaluation.test.js:617 | server/tests/contracts/qc_batch_evaluation.test.js:620 | expect(res.body.status).toBe('QC_FAIL') | Translated: expect(res.body.code).toBe('QC_VALUES_MISSING') |
| server/tests/contracts/qc_batch_evaluation.test.js:619 | server/tests/contracts/qc_batch_evaluation.test.js:622 | expect(batch.status).toBe('QC_FAIL') | Translated: expect(await evidenceBatch(batchId)).toEqual(before) |
| server/tests/contracts/qc_batch_evaluation.test.js:621 | server/tests/contracts/qc_batch_evaluation.test.js:623 | expect(parsed.blanks[0].value).toBeNull() | Translated: expect(await prisma.qcMeasurement.count({ where: { batchId } })).toBe(0) |
| server/tests/contracts/qc_batch_evaluation.test.js:622 | server/tests/contracts/qc_batch_evaluation.test.js:624 | expect(parsed.blanks[0].status).toBe('FAIL') | Translated: expect(await prisma.qcEvaluation.count({ where: { batchId } })).toBe(0) |
| server/tests/contracts/qc_batch_evaluation.test.js:623 | server/tests/contracts/qc_batch_evaluation.test.js:621 | expect(parsed.summary.missingRequired).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'CONTROL' }), expect.objectContaining({ type: 'DUPLICATE' })])) | Translated: expect(res.body.missingTypes).toEqual(expect.arrayContaining(['BLANK', 'CONTROL', 'DUPLICATE'])) |
| server/tests/contracts/qc_batch_evaluation.test.js:654 | server/tests/contracts/qc_batch_evaluation.test.js:655 | expect(evalRes.statusCode).toBe(400) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:655 | server/tests/contracts/qc_batch_evaluation.test.js:656 | expect(evalRes.body.error).toContain('CLOSED') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:658 | server/tests/contracts/qc_batch_evaluation.test.js:659 | expect(batch.status).toBe('CLOSED') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:679 | server/tests/contracts/qc_batch_evaluation.test.js:680 | expect(passedBatch.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:689 | server/tests/contracts/qc_batch_evaluation.test.js:690 | expect(clearRes.statusCode).toBe(403) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:690 | server/tests/contracts/qc_batch_evaluation.test.js:691 | expect(clearRes.body.code).toBe('QC_REOPEN_PERMISSION_REQUIRED') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:691 | server/tests/contracts/qc_batch_evaluation.test.js:692 | expect((await prisma.batch.findUnique({ where: { id: batchId } })).qcResults).toBe(passedBatch.qcResults) | Translated: expect((await evidenceBatch(batchId)).qcResults).toBe(passedBatch.qcResults) |
| server/tests/contracts/qc_batch_evaluation.test.js:697 | server/tests/contracts/qc_batch_evaluation.test.js:698 | expect(reopenRes.statusCode).toBe(200) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:698 | server/tests/contracts/qc_batch_evaluation.test.js:699 | expect(reopenRes.body.status).toBe('OPEN') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:701 | server/tests/contracts/qc_batch_evaluation.test.js:702 | expect(batch.status).toBe('OPEN') | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:702 | server/tests/contracts/qc_batch_evaluation.test.js:703 | expect(batch.qcResults).toBeNull() | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:703 | server/tests/contracts/qc_batch_evaluation.test.js:704 | expect(batch.disposition).toBeNull() | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:704 | server/tests/contracts/qc_batch_evaluation.test.js:705 | expect(await prisma.batchQcResult.count({ where: { batchId } })).toBe(0) | Retained |
| server/tests/contracts/qc_batch_evaluation.test.js:706 | server/tests/contracts/qc_batch_evaluation.test.js:707 | expect(snapshots.at(-1).snapshot.qcResults).toEqual(JSON.parse(passedBatch.qcResults)) | Retained |

## server/tests/contracts/qc_controls.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/qc_controls.test.js:51 | server/tests/contracts/qc_controls.test.js:51 | expect(blankPass.status).toBe('PASS') | Retained |
| server/tests/contracts/qc_controls.test.js:53 | server/tests/contracts/qc_controls.test.js:53 | expect(blankFail.status).toBe('FAIL') | Retained |
| server/tests/contracts/qc_controls.test.js:58 | server/tests/contracts/qc_controls.test.js:58 | expect(dupPass.status).toBe('PASS') | Retained |
| server/tests/contracts/qc_controls.test.js:59 | server/tests/contracts/qc_controls.test.js:59 | expect(dupPass.rpd).toBeCloseTo(2.90, 1) | Retained |
| server/tests/contracts/qc_controls.test.js:63 | server/tests/contracts/qc_controls.test.js:63 | expect(dupFail.status).toBe('FAIL') | Retained |
| server/tests/contracts/qc_controls.test.js:64 | server/tests/contracts/qc_controls.test.js:64 | expect(dupFail.rpd).toBeCloseTo(18.18, 1) | Retained |
| server/tests/contracts/qc_controls.test.js:69 | server/tests/contracts/qc_controls.test.js:69 | expect(crmPass.status).toBe('PASS') | Retained |
| server/tests/contracts/qc_controls.test.js:70 | server/tests/contracts/qc_controls.test.js:70 | expect(crmPass.recoveryPct).toBe(98.0) | Retained |
| server/tests/contracts/qc_controls.test.js:74 | server/tests/contracts/qc_controls.test.js:74 | expect(crmFail.status).toBe('FAIL') | Retained |
| server/tests/contracts/qc_controls.test.js:75 | server/tests/contracts/qc_controls.test.js:75 | expect(crmFail.recoveryPct).toBe(72.0) | Retained |
| server/tests/contracts/qc_controls.test.js:84 | server/tests/contracts/qc_controls.test.js:84 | expect(createRes.status).toBe(201) | Retained |
| server/tests/contracts/qc_controls.test.js:86 | server/tests/contracts/qc_controls.test.js:86 | expect(createRes.body.status).toBe('OPEN') | Retained |
| server/tests/contracts/qc_controls.test.js:94 | server/tests/contracts/qc_controls.test.js:94 | expect(addRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_controls.test.js:96 | server/tests/contracts/qc_controls.test.js:96 | expect(wi.batchId).toBe(batchId) | Retained |
| server/tests/contracts/qc_controls.test.js:109 | server/tests/contracts/qc_controls.test.js:110 | expect(evalRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_controls.test.js:110 | server/tests/contracts/qc_controls.test.js:111 | expect(evalRes.body.status).toBe('QC_FAIL') | Retained |
| server/tests/contracts/qc_controls.test.js:111 | server/tests/contracts/qc_controls.test.js:112 | expect(evalRes.body.evaluation.duplicates[0].status).toBe('FAIL') | Retained |
| server/tests/contracts/qc_controls.test.js:133 | server/tests/contracts/qc_controls.test.js:134 | expect(reviewRes.status).toBe(409) | Retained |
| server/tests/contracts/qc_controls.test.js:134 | server/tests/contracts/qc_controls.test.js:135 | expect(reviewRes.body.error).toMatch(/FAILED QC Batch/) | Retained |
| server/tests/contracts/qc_controls.test.js:147 | server/tests/contracts/qc_controls.test.js:148 | expect(dispRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_controls.test.js:148 | server/tests/contracts/qc_controls.test.js:149 | expect(dispRes.body.disposition.decision).toBe('PROCEED_WITH_WARNING') | Retained |
| server/tests/contracts/qc_controls.test.js:158 | server/tests/contracts/qc_controls.test.js:159 | expect(reviewRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_controls.test.js:167 | server/tests/contracts/qc_controls.test.js:168 | expect(lockedRes.status).toBe(409) | Retained |
| server/tests/contracts/qc_controls.test.js:168 | server/tests/contracts/qc_controls.test.js:169 | expect(lockedRes.body.code).toBe('QC_BATCH_LOCKED') | Retained |
| server/tests/contracts/qc_controls.test.js:174 | server/tests/contracts/qc_controls.test.js:175 | expect(createRes.status).toBe(201) | Retained |
| server/tests/contracts/qc_controls.test.js:184 | server/tests/contracts/qc_controls.test.js:185 | expect(evalRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_controls.test.js:185 | server/tests/contracts/qc_controls.test.js:186 | expect(evalRes.body.status).toBe('QC_PASS') | Retained |
| server/tests/contracts/qc_controls.test.js:186 | server/tests/contracts/qc_controls.test.js:187 | expect(evalRes.body.evaluation.summary.failed).toBe(0) | Retained |

## server/tests/contracts/qc_disposition_flagging.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/qc_disposition_flagging.test.js:65 | server/tests/contracts/qc_disposition_flagging.test.js:59 | expect(blankPass.status).toBe('PASS') | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:67 | server/tests/contracts/qc_disposition_flagging.test.js:61 | expect(blankFail.status).toBe('FAIL') | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:71 | server/tests/contracts/qc_disposition_flagging.test.js:65 | expect(dupPass.status).toBe('PASS') | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:73 | server/tests/contracts/qc_disposition_flagging.test.js:67 | expect(dupFail.status).toBe('FAIL') | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:77 | server/tests/contracts/qc_disposition_flagging.test.js:71 | expect(crmPass.status).toBe('PASS') | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:79 | server/tests/contracts/qc_disposition_flagging.test.js:73 | expect(crmFail.status).toBe('FAIL') | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:98 | server/tests/contracts/qc_disposition_flagging.test.js:93 | expect(res.status).not.toHaveBeenCalled() | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:99 | server/tests/contracts/qc_disposition_flagging.test.js:94 | expect(res.json).toHaveBeenCalled() | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:103 | server/tests/contracts/qc_disposition_flagging.test.js:99 | expect(typedRows.length).toBe(3) | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:104 | server/tests/contracts/qc_disposition_flagging.test.js:100 | expect(typedRows.some(r => r.type === 'BLANK' && r.status === 'FAIL')).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:105 | server/tests/contracts/qc_disposition_flagging.test.js:101 | expect(typedRows.some(r => r.type === 'DUPLICATE' && r.status === 'PASS')).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:109 | server/tests/contracts/qc_disposition_flagging.test.js:105 | expect(flaggedResult.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:111 | server/tests/contracts/qc_disposition_flagging.test.js:107 | expect(flags).toContain('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:133 | server/tests/contracts/qc_disposition_flagging.test.js:130 | expect(res.json).toHaveBeenCalled() | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:137 | server/tests/contracts/qc_disposition_flagging.test.js:134 | expect(restoredResult.isValid).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:139 | server/tests/contracts/qc_disposition_flagging.test.js:136 | expect(flags).not.toContain('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/qc_disposition_flagging.test.js:140 | server/tests/contracts/qc_disposition_flagging.test.js:137 | expect(flags).toContain('QC_WARNING_OVERRIDDEN') | Retained |

## server/tests/contracts/qc_disposition_release_gate.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/qc_disposition_release_gate.test.js:175 | server/tests/contracts/qc_disposition_release_gate.test.js:179 | expect(crossLabRes.status).toBe(403) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:182 | server/tests/contracts/qc_disposition_release_gate.test.js:186 | expect(res.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:183 | server/tests/contracts/qc_disposition_release_gate.test.js:187 | expect(res.body.data.id).toBe(batch1.id) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:184 | server/tests/contracts/qc_disposition_release_gate.test.js:188 | expect(res.body.data.status).toBe('QC_FAIL') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:185 | server/tests/contracts/qc_disposition_release_gate.test.js:189 | expect(res.body.data.notes).toContain('pH slope drift') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:188 | server/tests/contracts/qc_disposition_release_gate.test.js:192 | expect(res.body.data.qcResults).toBeDefined() | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:189 | server/tests/contracts/qc_disposition_release_gate.test.js:193 | expect(res.body.data.qcResults.controls).toHaveLength(1) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:190 | server/tests/contracts/qc_disposition_release_gate.test.js:194 | expect(res.body.data.qcResults.controls[0].status).toBe('FAIL') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:191 | server/tests/contracts/qc_disposition_release_gate.test.js:195 | expect(res.body.data.qcResults.controls[0].recovery).toBe(111.4) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:194 | server/tests/contracts/qc_disposition_release_gate.test.js:198 | expect(res.body.data.workItems).toHaveLength(1) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:195 | server/tests/contracts/qc_disposition_release_gate.test.js:199 | expect(res.body.data.workItems[0].id).toBe(workItem1.id) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:196 | server/tests/contracts/qc_disposition_release_gate.test.js:200 | expect(res.body.data.workItems[0].sampleId).toBe(sample1.id) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:197 | server/tests/contracts/qc_disposition_release_gate.test.js:201 | expect(res.body.data.workItems[0].sample.originalId).toBe(sample1.originalId) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:200 | server/tests/contracts/qc_disposition_release_gate.test.js:204 | expect(res.body.runProfile).toBeDefined() | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:214 | server/tests/contracts/qc_disposition_release_gate.test.js:218 | expect(eligibility.allowed).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:215 | server/tests/contracts/qc_disposition_release_gate.test.js:219 | expect(eligibility.blockers.some(b => b.startsWith('QC_BATCH_FAILED'))).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:228 | server/tests/contracts/qc_disposition_release_gate.test.js:235 | expect(publishCheck.allowed).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:229 | server/tests/contracts/qc_disposition_release_gate.test.js:236 | expect(publishCheck.code).toBe('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:235 | server/tests/contracts/qc_disposition_release_gate.test.js:242 | expect(genRes.status).toBe(409) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:236 | server/tests/contracts/qc_disposition_release_gate.test.js:243 | expect(genRes.body.code).toBe('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:246 | server/tests/contracts/qc_disposition_release_gate.test.js:253 | expect(techRes.status).toBe(403) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:253 | server/tests/contracts/qc_disposition_release_gate.test.js:260 | expect(crossMgrRes.status).toBe(403) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:260 | server/tests/contracts/qc_disposition_release_gate.test.js:267 | expect(emptyReasonRes.status).toBe(400) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:271 | server/tests/contracts/qc_disposition_release_gate.test.js:278 | expect(validRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:272 | server/tests/contracts/qc_disposition_release_gate.test.js:279 | expect(validRes.body.success).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:273 | server/tests/contracts/qc_disposition_release_gate.test.js:280 | expect(validRes.body.disposition.decision).toBe('PROCEED_WITH_WARNING') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:274 | server/tests/contracts/qc_disposition_release_gate.test.js:281 | expect(validRes.body.disposition.by).toBe(lab1Manager.username) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:279 | server/tests/contracts/qc_disposition_release_gate.test.js:286 | expect(parsedDisp.decision).toBe('PROCEED_WITH_WARNING') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:284 | server/tests/contracts/qc_disposition_release_gate.test.js:291 | expect(auditLogs).toHaveLength(1) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:285 | server/tests/contracts/qc_disposition_release_gate.test.js:292 | expect(auditLogs[0].performedBy).toBe(lab1Manager.username) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:286 | server/tests/contracts/qc_disposition_release_gate.test.js:293 | expect(auditLogs[0].details).toContain('PROCEED_WITH_WARNING') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:299 | server/tests/contracts/qc_disposition_release_gate.test.js:306 | expect(repeatRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:300 | server/tests/contracts/qc_disposition_release_gate.test.js:307 | expect(repeatRes.body.success).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:301 | server/tests/contracts/qc_disposition_release_gate.test.js:308 | expect(repeatRes.body.idempotent).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:307 | server/tests/contracts/qc_disposition_release_gate.test.js:314 | expect(auditLogs).toHaveLength(1) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:322 | server/tests/contracts/qc_disposition_release_gate.test.js:329 | expect(eligibility.allowed).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:323 | server/tests/contracts/qc_disposition_release_gate.test.js:330 | expect(eligibility.blockers).toHaveLength(0) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:331 | server/tests/contracts/qc_disposition_release_gate.test.js:338 | expect(publishCheck.allowed).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:341 | server/tests/contracts/qc_disposition_release_gate.test.js:348 | expect(exceptionsRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:344 | server/tests/contracts/qc_disposition_release_gate.test.js:351 | expect(pendingRows.some(r => r.key === batch1.id)).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:351 | server/tests/contracts/qc_disposition_release_gate.test.js:358 | expect(inspectRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:352 | server/tests/contracts/qc_disposition_release_gate.test.js:359 | expect(inspectRes.body.data.disposition.decision).toBe('PROCEED_WITH_WARNING') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:353 | server/tests/contracts/qc_disposition_release_gate.test.js:360 | expect(inspectRes.body.data.history.length).toBeGreaterThanOrEqual(3) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:374 | server/tests/contracts/qc_disposition_release_gate.test.js:381 | expect(res.status).toBe(400) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:375 | server/tests/contracts/qc_disposition_release_gate.test.js:382 | expect(res.body.error).toBe('INVALID_DISPOSITION_DECISION') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:471 | server/tests/contracts/qc_disposition_release_gate.test.js:479 | expect(dispRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:476 | server/tests/contracts/qc_disposition_release_gate.test.js:484 | expect(flags1).toContain('QC_WARNING_OVERRIDDEN') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:477 | server/tests/contracts/qc_disposition_release_gate.test.js:485 | expect(flags1).not.toContain('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:478 | server/tests/contracts/qc_disposition_release_gate.test.js:486 | expect(flags1).toContain('MANUAL_INVALID') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:479 | server/tests/contracts/qc_disposition_release_gate.test.js:487 | expect(refreshedRes1.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:483 | server/tests/contracts/qc_disposition_release_gate.test.js:491 | expect(refreshedRes2.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:485 | server/tests/contracts/qc_disposition_release_gate.test.js:493 | expect(flags2).toEqual(['QC_BATCH_FAILED']) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:489 | server/tests/contracts/qc_disposition_release_gate.test.js:497 | expect(refreshedRes3.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:491 | server/tests/contracts/qc_disposition_release_gate.test.js:499 | expect(flags3).toEqual(['QC_BATCH_FAILED']) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:540 | server/tests/contracts/qc_disposition_release_gate.test.js:549 | expect(dispRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:544 | server/tests/contracts/qc_disposition_release_gate.test.js:553 | expect(refreshedWi.status).toBe('REPEAT_REQUIRED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:545 | server/tests/contracts/qc_disposition_release_gate.test.js:554 | expect(refreshedWi.reanalysisReason).toContain('Calibration curve failed') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:546 | server/tests/contracts/qc_disposition_release_gate.test.js:555 | expect(refreshedWi.reanalysisRequestedBy).toBe(lab1Manager.username) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:561 | server/tests/contracts/qc_disposition_release_gate.test.js:570 | expect(auditQcRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:566 | server/tests/contracts/qc_disposition_release_gate.test.js:575 | expect(auditQcRes.body.qcFailedCount).toBeDefined() | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:651 | server/tests/contracts/qc_disposition_release_gate.test.js:660 | expect(refUnflagged.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:655 | server/tests/contracts/qc_disposition_release_gate.test.js:664 | expect(refSensor.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:656 | server/tests/contracts/qc_disposition_release_gate.test.js:665 | expect(JSON.parse(refSensor.flags)).toContain('SENSOR_FAILURE') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:660 | server/tests/contracts/qc_disposition_release_gate.test.js:669 | expect(refReject.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:664 | server/tests/contracts/qc_disposition_release_gate.test.js:673 | expect(refQcOnly.isValid).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:665 | server/tests/contracts/qc_disposition_release_gate.test.js:674 | expect(JSON.parse(refQcOnly.flags)).not.toContain('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:764 | server/tests/contracts/qc_disposition_release_gate.test.js:773 | expect(JSON.parse(refArch.flags)).toEqual(['QC_BATCH_FAILED']) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:768 | server/tests/contracts/qc_disposition_release_gate.test.js:777 | expect(JSON.parse(refDisp.flags)).toEqual(['QC_BATCH_FAILED']) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:772 | server/tests/contracts/qc_disposition_release_gate.test.js:781 | expect(JSON.parse(refPub.flags)).toEqual(['QC_BATCH_FAILED']) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:805 | server/tests/contracts/qc_disposition_release_gate.test.js:815 | expect(firstRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:816 | server/tests/contracts/qc_disposition_release_gate.test.js:826 | expect(conflictRes.status).toBe(409) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:817 | server/tests/contracts/qc_disposition_release_gate.test.js:827 | expect(conflictRes.body.error).toBe('DISPOSITION_CONFLICT') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:856 | server/tests/contracts/qc_disposition_release_gate.test.js:867 | expect(resA.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:857 | server/tests/contracts/qc_disposition_release_gate.test.js:868 | expect(resB.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:863 | server/tests/contracts/qc_disposition_release_gate.test.js:874 | expect(dispEntries.length).toBe(1) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:931 | server/tests/contracts/qc_disposition_release_gate.test.js:949 | expect(dispRes.status).toBe(200) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:935 | server/tests/contracts/qc_disposition_release_gate.test.js:953 | expect(refActive.status).toBe('REPEAT_REQUIRED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:939 | server/tests/contracts/qc_disposition_release_gate.test.js:957 | expect(refAccepted.status).toBe('ACCEPTED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:943 | server/tests/contracts/qc_disposition_release_gate.test.js:961 | expect(refCompleted.status).toBe('REPEAT_REQUIRED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:944 | server/tests/contracts/qc_disposition_release_gate.test.js:962 | expect(refCompleted.reanalysisReason).toBe('Reanalyze active items only') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:988 | server/tests/contracts/qc_disposition_release_gate.test.js:1008 | expect(afterFail.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:990 | server/tests/contracts/qc_disposition_release_gate.test.js:1010 | expect(failFlags).toContain('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:991 | server/tests/contracts/qc_disposition_release_gate.test.js:1011 | expect(failFlags).toContain('ORIGINALLY_INVALID') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:997 | server/tests/contracts/qc_disposition_release_gate.test.js:1017 | expect(afterPass.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:999 | server/tests/contracts/qc_disposition_release_gate.test.js:1019 | expect(passFlags).not.toContain('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1040 | server/tests/contracts/qc_disposition_release_gate.test.js:1060 | expect(afterWarn.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1042 | server/tests/contracts/qc_disposition_release_gate.test.js:1062 | expect(warnFlags).toContain('QC_WARNING_OVERRIDDEN') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1043 | server/tests/contracts/qc_disposition_release_gate.test.js:1063 | expect(warnFlags).not.toContain('QC_BATCH_FAILED') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1083 | server/tests/contracts/qc_disposition_release_gate.test.js:1103 | expect(afterFail.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1088 | server/tests/contracts/qc_disposition_release_gate.test.js:1108 | expect(afterPass.isValid).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1089 | server/tests/contracts/qc_disposition_release_gate.test.js:1109 | expect(JSON.parse(afterPass.flags)).toEqual([]) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1095 | server/tests/contracts/qc_disposition_release_gate.test.js:1115 | expect(afterWarn.isValid).toBe(true) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1096 | server/tests/contracts/qc_disposition_release_gate.test.js:1116 | expect(JSON.parse(afterWarn.flags)).toContain('QC_WARNING_OVERRIDDEN') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1152 | server/tests/contracts/qc_disposition_release_gate.test.js:1172 | expect(refUnknown.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1153 | server/tests/contracts/qc_disposition_release_gate.test.js:1173 | expect(JSON.parse(refUnknown.flags)).toContain('CUSTOM_SENSOR_DRIFT') | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1156 | server/tests/contracts/qc_disposition_release_gate.test.js:1176 | expect(refMalformed.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1205 | server/tests/contracts/qc_disposition_release_gate.test.js:1225 | expect(refRes.isValid).toBe(false) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1206 | server/tests/contracts/qc_disposition_release_gate.test.js:1226 | expect(JSON.parse(refRes.flags)).toEqual(['QC_BATCH_FAILED']) | Retained |
| server/tests/contracts/qc_disposition_release_gate.test.js:1220 | server/tests/contracts/qc_disposition_release_gate.test.js:1240 | expect(flagBatchResults(mockPrismaError, 'batch-err', 'QC_PASS')).rejects.toThrow('Database connection failed') | Retained |

## server/tests/contracts/sample_assignment_identity.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/contracts/sample_assignment_identity.test.js:137 | server/tests/contracts/sample_assignment_identity.test.js:137 | expect(resAll.status).toBe(200) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:138 | server/tests/contracts/sample_assignment_identity.test.js:138 | expect(resAll.body.data.length).toBe(26) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:139 | server/tests/contracts/sample_assignment_identity.test.js:139 | expect(resAll.body.pagination.total).toBe(26) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:143 | server/tests/contracts/sample_assignment_identity.test.js:143 | expect(firstItem.sampleLabId).toBe(sample26LabCode) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:144 | server/tests/contracts/sample_assignment_identity.test.js:144 | expect(firstItem.originalId).toBe(sample26OriginalId) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:145 | server/tests/contracts/sample_assignment_identity.test.js:145 | expect(firstItem.projectCode).toBe('SOILFER-US') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:146 | server/tests/contracts/sample_assignment_identity.test.js:146 | expect(firstItem.sample).toBeDefined() | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:147 | server/tests/contracts/sample_assignment_identity.test.js:147 | expect(firstItem.sample.labId).toBe(sample26LabCode) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:148 | server/tests/contracts/sample_assignment_identity.test.js:148 | expect(firstItem.sample.originalId).toBe(sample26OriginalId) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:156 | server/tests/contracts/sample_assignment_identity.test.js:156 | expect(resPage1.status).toBe(200) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:157 | server/tests/contracts/sample_assignment_identity.test.js:157 | expect(resPage1.body.data.length).toBe(10) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:158 | server/tests/contracts/sample_assignment_identity.test.js:158 | expect(resPage1.body.pagination.total).toBe(26) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:159 | server/tests/contracts/sample_assignment_identity.test.js:159 | expect(resPage1.body.pagination.totalPages).toBe(3) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:160 | server/tests/contracts/sample_assignment_identity.test.js:160 | expect(resPage1.body.pagination.page).toBe(1) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:164 | server/tests/contracts/sample_assignment_identity.test.js:164 | expect(workspace.counters.totalTasks).toBe(26) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:165 | server/tests/contracts/sample_assignment_identity.test.js:165 | expect(workspace.counters.gates).toBe(2) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:166 | server/tests/contracts/sample_assignment_identity.test.js:166 | expect(workspace.counters.derived).toBe(3) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:167 | server/tests/contracts/sample_assignment_identity.test.js:167 | expect(workspace.counters.ordered).toBe(22) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:168 | server/tests/contracts/sample_assignment_identity.test.js:168 | expect(workspace.counters.unassigned).toBe(26) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:194 | server/tests/contracts/sample_assignment_identity.test.js:194 | expect(sampleRow).toBeDefined() | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:195 | server/tests/contracts/sample_assignment_identity.test.js:195 | expect(sampleRow.sampleId).toBe(sample26Id) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:196 | server/tests/contracts/sample_assignment_identity.test.js:196 | expect(sampleRow.labId).toBe(sample26LabCode) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:197 | server/tests/contracts/sample_assignment_identity.test.js:197 | expect(sampleRow.originalId).toBe(sample26OriginalId) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:198 | server/tests/contracts/sample_assignment_identity.test.js:198 | expect(sampleRow.sampleDisplayId).toBe(sample26LabCode) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:199 | server/tests/contracts/sample_assignment_identity.test.js:199 | expect(sampleRow.title).toBe(sample26LabCode) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:200 | server/tests/contracts/sample_assignment_identity.test.js:200 | expect(sampleRow.projectCode).toBe('SOILFER-US') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:201 | server/tests/contracts/sample_assignment_identity.test.js:201 | expect(sampleRow.route).toContain('returnTo=${encodeURIComponent('/manager-queue?lane=review')}') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:209 | server/tests/contracts/sample_assignment_identity.test.js:209 | expect(subRes.status).toBe(200) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:212 | server/tests/contracts/sample_assignment_identity.test.js:212 | expect(returnedSub).toBeDefined() | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:213 | server/tests/contracts/sample_assignment_identity.test.js:213 | expect(returnedSub.sampleLabId).toBe(sample26LabCode) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:214 | server/tests/contracts/sample_assignment_identity.test.js:214 | expect(returnedSub.originalId).toBe(sample26OriginalId) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:215 | server/tests/contracts/sample_assignment_identity.test.js:215 | expect(returnedSub.projectCode).toBe('SOILFER-US') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:226 | server/tests/contracts/sample_assignment_identity.test.js:226 | expect(sandItem.isDerived).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:227 | server/tests/contracts/sample_assignment_identity.test.js:227 | expect(sandItem.derivedFrom).toBe('TEXTURE') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:228 | server/tests/contracts/sample_assignment_identity.test.js:228 | expect(siltItem.isDerived).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:229 | server/tests/contracts/sample_assignment_identity.test.js:229 | expect(siltItem.derivedFrom).toBe('TEXTURE') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:230 | server/tests/contracts/sample_assignment_identity.test.js:230 | expect(clayItem.isDerived).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:231 | server/tests/contracts/sample_assignment_identity.test.js:231 | expect(clayItem.derivedFrom).toBe('TEXTURE') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:235 | server/tests/contracts/sample_assignment_identity.test.js:235 | expect(mismatchIssue).toBeUndefined() | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:252 | server/tests/contracts/sample_assignment_identity.test.js:252 | expect(partialEval.allowed).toBe(false) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:253 | server/tests/contracts/sample_assignment_identity.test.js:253 | expect(partialEval.blockers.some(b => b.includes('CLAY'))).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:269 | server/tests/contracts/sample_assignment_identity.test.js:269 | expect(completeEval.allowed).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:282 | server/tests/contracts/sample_assignment_identity.test.js:282 | expect(sandReqEval.allowed).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:342 | server/tests/contracts/sample_assignment_identity.test.js:342 | expect(prematureRes.status).toBe(409) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:343 | server/tests/contracts/sample_assignment_identity.test.js:343 | expect(prematureRes.body.code).toBe('UNAPPROVED_WORK_ITEMS') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:344 | server/tests/contracts/sample_assignment_identity.test.js:344 | expect(prematureRes.body.blockers).toBeDefined() | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:345 | server/tests/contracts/sample_assignment_identity.test.js:345 | expect(prematureRes.body.blockers.length).toBeGreaterThan(0) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:363 | server/tests/contracts/sample_assignment_identity.test.js:363 | expect(approvedRes.status).toBe(200) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:364 | server/tests/contracts/sample_assignment_identity.test.js:364 | expect(approvedRes.body.success).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:365 | server/tests/contracts/sample_assignment_identity.test.js:365 | expect(approvedRes.body.status).toBe('APPROVED') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:369 | server/tests/contracts/sample_assignment_identity.test.js:369 | expect(approvedSample.status).toBe('APPROVED') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:382 | server/tests/contracts/sample_assignment_identity.test.js:382 | expect(bulkRes.status).toBe(403) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:383 | server/tests/contracts/sample_assignment_identity.test.js:383 | expect(bulkRes.body.code).toBe('CROSS_LAB_ASSIGNMENT_DENIED') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:384 | server/tests/contracts/sample_assignment_identity.test.js:384 | expect(bulkRes.body.error).toMatch(/Cannot assign to technician in different lab/i) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:394 | server/tests/contracts/sample_assignment_identity.test.js:394 | expect(singleRes.status).toBe(403) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:395 | server/tests/contracts/sample_assignment_identity.test.js:395 | expect(singleRes.body.code).toBe('CROSS_LAB_ASSIGNMENT_DENIED') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:396 | server/tests/contracts/sample_assignment_identity.test.js:396 | expect(singleRes.body.error).toMatch(/Cannot assign to technician in different lab/i) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:402 | server/tests/contracts/sample_assignment_identity.test.js:402 | expect(wsApproved.capabilities.canFinalApprove.allowed).toBe(false) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:403 | server/tests/contracts/sample_assignment_identity.test.js:403 | expect(wsApproved.capabilities.canArchive.allowed).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:404 | server/tests/contracts/sample_assignment_identity.test.js:404 | expect(wsApproved.capabilities.canDispose.allowed).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:408 | server/tests/contracts/sample_assignment_identity.test.js:408 | expect(ws26.capabilities.canFinalApprove.allowed).toBe(false) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:409 | server/tests/contracts/sample_assignment_identity.test.js:409 | expect(ws26.nextAction.action).toBe('ASSIGN') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:423 | server/tests/contracts/sample_assignment_identity.test.js:423 | expect(skippedDryingEval.allowed).toBe(true) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:435 | server/tests/contracts/sample_assignment_identity.test.js:435 | expect(pendingPrepEval.allowed).toBe(false) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:436 | server/tests/contracts/sample_assignment_identity.test.js:436 | expect(pendingPrepEval.blockers).toHaveLength(1) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:437 | server/tests/contracts/sample_assignment_identity.test.js:437 | expect(pendingPrepEval.blockers[0]).toContain('Preparation gate') | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:480 | server/tests/contracts/sample_assignment_identity.test.js:481 | expect(ws.capabilities.canFinalApprove.allowed).toBe(false) | Retained |
| server/tests/contracts/sample_assignment_identity.test.js:481 | server/tests/contracts/sample_assignment_identity.test.js:482 | expect(ws.capabilities.canFinalApprove.blockers.some(b => b.includes('QC_BATCH_FAILED'))).toBe(true) | Retained |

## server/tests/scenarios/qc_batch.test.js

| Before (main) | Current | Matcher / preserved assertion | Mapping |
| --- | --- | --- | --- |
| server/tests/scenarios/qc_batch.test.js:58 | server/tests/scenarios/qc_batch.test.js:58 | expect(res.status).toBe(201) | Retained |
| server/tests/scenarios/qc_batch.test.js:60 | server/tests/scenarios/qc_batch.test.js:60 | expect(res.body.status).toBe('OPEN') | Retained |
| server/tests/scenarios/qc_batch.test.js:69 | server/tests/scenarios/qc_batch.test.js:69 | expect(res.status).toBe(200) | Retained |
| server/tests/scenarios/qc_batch.test.js:73 | server/tests/scenarios/qc_batch.test.js:73 | expect(wi.batchId).toBe(batchId) | Retained |
| server/tests/scenarios/qc_batch.test.js:84 | server/tests/scenarios/qc_batch.test.js:86 | expect(failRes.status).toBe(200) | Retained |
| server/tests/scenarios/qc_batch.test.js:85 | server/tests/scenarios/qc_batch.test.js:87 | expect(failRes.body.status).toBe('QC_FAIL') | Retained |
| server/tests/scenarios/qc_batch.test.js:102 | server/tests/scenarios/qc_batch.test.js:104 | expect(reviewRes.status).toBe(409) | Retained |
| server/tests/scenarios/qc_batch.test.js:103 | server/tests/scenarios/qc_batch.test.js:105 | expect(reviewRes.body.error).toMatch(/FAILED QC Batch/) | Retained |
| server/tests/scenarios/qc_batch.test.js:113 | server/tests/scenarios/qc_batch.test.js:115 | expect(res.status).toBe(200) | Retained |
