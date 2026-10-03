# Profile and intake implementation status

Owner authorization: 3 October 2026, after reviewing Opus v2. Proceed with A0 → A → B1 → B2, including safe push/merge/deployment after technical acceptance, without waiting for Eloi or Marcos to reply.

## Verified preparation

- Latest issue bodies and comments read from GitHub; no new contributor response at this review.
- The owner's existing comments were updated in place and read back byte-for-byte: [#140 delivery/retry notice](https://github.com/yigini/soilfer-lims/issues/140#issuecomment-5972150911), [#156 full staged delivery](https://github.com/yigini/soilfer-lims/issues/156#issuecomment-5972151075).
- Opus v2 amended for pinned draft revisions, existing offline integrity, historical profile identity stability, actual routed error handling and full B1+B2 scope. No product or production mutation performed by package preparation.
- Existing theme runtime remains accepted; its hardware/manual qualification monitor is separate.

## Delivery record

Handoff submitted on 3 October 2026 at 18:48 UTC to the existing LIMSI / LIMS Dev conversation (`80c11c12-5cb7-4455-a433-01544d488498`), preserving the empty composer and using its existing Gemini 3.8 Flash High model. A fresh observation verified the submitted user message, empty composer, running execution and Agy reading `ANTIGRAVITY-HANDOFF.md`. No duplicate prompt or parallel implementation conversation was created. Concrete code/PR/deployment evidence remains pending below.

Package validation: nine nonempty files including the example; eight relative Markdown document links resolve; 54 acceptance IDs are unique; preview JavaScript syntax and static accessibility references pass; example JSON parses. These are asset-integrity checks, not product or rendered-browser acceptance.

| Increment | Implementation | PR / exact head | CI / acceptance | Deployment / live verification |
|---|---|---|---|---|
| A0: exchange errors and timing | Completed & Merged | [PR #158](https://github.com/yigini/soilfer-lims/pull/158) merged to `main` at `32f04e2195047e824eb76bc89ea0a0a779ad9097` (head `178e0c8083e579c69a97c66af51304fbb6ebf633`) | Verified (E01, E02, E03, E05, E07-min, E11; 31/31 contract tests pass). PR CI 37147180087 passed. Merged-main CI 37147737802 in progress. | Production cutover held per owner instruction (database path redaction to be applied by Codex). Nothing deployed. |
| A: profile identities, fixture and measured speed | Partial (Handoff to Codex) | Branch `feat/issue-140-a-profile-identities-fixture` | In-progress (P01-P03, P10 partial; unit tests pass; contract tests pending Codex completion) | Not deployed |
| B1: consistent online/offline intake and basic settings | Pending | Pending | Pending | Pending |
| B2: custom criteria/context and bounded editor | Pending | Pending | Pending | Pending |

Use ACCEPTANCE-CHECKLIST.md for the finite item-level evidence. On 3 October 2026, owner authorized Codex takeover for implementation, testing, and release verification. Antigravity writing has stopped; all timers cancelled; worktree preserved intact for Codex.

## Codex implementation checkpoint

Codex is the sole product writer following the owner's explicit takeover request. Agy acknowledged the handoff in the existing LIMS Dev conversation and reported that nothing was deployed. Its partial A files remain intact in `C:/Users/yigin/Documents/soilfer-lims-profile-intake`. Active Codex checkout: `C:/Users/yigin/.codex/worktrees/profile-intake-delivery/soilfer-lims`, branch `codex/profile-intake-delivery`, starting from the exact PR158 merge above.

Independent review of PR158 found that the new eligibility503 response reflected underlying database exception messages. Production cutover remains held while the small follow-up is reviewed: one constant public message, private underlying cause, truthful classification of eligibility failures, server-only correlation, and route-template diagnostics without bag IDs/query data.

Focused verification on 3 October 2026 in the isolated Codex checkout used a disposable test copy (no production mutation):

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/contracts/exchange_diagnostics_privacy.test.js tests/contracts/exchange_error_semantics.test.js --testMatch '**/*.test.js'
```

Result: **2 suites, 21 tests passed**. The route tests inject sensitive-looking database errors through all four deployed aliases; the new tests cover public redaction, unrelated errors and minimized phase diagnostics. The explicit testMatch override accommodates Jest path matching under the Windows `.codex` worktree; the initial default-match attempts found no tests and are not counted as verification. GitHub/review/deployment evidence for this follow-up is pending. No claim of full A0 release completion is made.

