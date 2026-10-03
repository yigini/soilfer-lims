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
| A0: exchange errors and timing | Complete, including public error redaction | [PR158](https://github.com/yigini/soilfer-lims/pull/158) plus independently accepted [PR159](https://github.com/yigini/soilfer-lims/pull/159), merged main `8b0ac597f7ce527dfe13397a379f5f383fdd4cbc` | 21 focused correction tests; exact PR CI37148724783 and exact merged-main CI37149597786 SUCCESS; read-only live postflight31/31 plus role gates | Independently verified live, image `sha256:68b6780e170d5f24977e129ecf35621dcc5f1f35dc54557409effc99d5b73b98`, tag `v3.5.33-8b0ac59`. See RELEASE-EVIDENCE-A0.md. |
| A: profile identities, fixture and measured speed | Implemented locally; candidate review/release pending, Codex sole writer | Branch `codex/issue-140-profile-identity`, based on exact main above | 186 distinct focused checks passed; all five synthetic specimens processed through real mounted lab workflow; browser light/graphite/mobile inspection; authenticated copy p95 1.96s → 0.36s. See ACCEPTANCE-EVIDENCE-A.md. | Not deployed |
| B1: consistent online/offline intake and basic settings | Pending | Pending | Pending | Pending |
| B2: custom criteria/context and bounded editor | Pending | Pending | Pending | Pending |

Use ACCEPTANCE-CHECKLIST.md for the finite item-level evidence. On 3 October 2026, owner authorized Codex takeover for implementation, testing, and release verification. Antigravity writing has stopped; all timers cancelled; worktree preserved intact for Codex.

## Historical Codex takeover checkpoint (superseded by delivery record above)

Codex is the sole product writer following the owner's explicit takeover request. Agy acknowledged the handoff in the existing LIMS Dev conversation and reported that nothing was deployed. Its partial A files remain intact in `C:/Users/yigin/Documents/soilfer-lims-profile-intake`. Active Codex checkout: `C:/Users/yigin/.codex/worktrees/profile-intake-delivery/soilfer-lims`, branch `codex/profile-intake-delivery`, starting from the exact PR158 merge above.

Independent review of PR158 found that the new eligibility503 response reflected underlying database exception messages. Production cutover remains held while the small follow-up is reviewed: one constant public message, private underlying cause, truthful classification of eligibility failures, server-only correlation, and route-template diagnostics without bag IDs/query data.

Focused verification on 3 October 2026 in the isolated Codex checkout used a disposable test copy (no production mutation):

```text
node node_modules/jest/bin/jest.js --runInBand --runTestsByPath tests/contracts/exchange_diagnostics_privacy.test.js tests/contracts/exchange_error_semantics.test.js --testMatch '**/*.test.js'
```

Result: **2 suites, 21 tests passed**. The route tests inject sensitive-looking database errors through all four deployed aliases; the new tests cover public redaction, unrelated errors and minimized phase diagnostics. The explicit testMatch override accommodates Jest path matching under the Windows `.codex` worktree; the initial default-match attempts found no tests and are not counted as verification. GitHub/review/deployment evidence for this follow-up is pending. No claim of full A0 release completion is made.

## Current continuation

Codex owns complete A0/A/B1/B2 delivery. Agy remains idle. A0 is accepted and live; do not reopen its unchanged acceptance. A is implemented and has focused evidence; it still requires exact candidate review/CI and the safe release gates. B1 and B2 remain required. Keep issue140 open for actual receiver grouping/replay/amendment/withdrawal evidence; no external acknowledgement gate. Close issue156 only after complete B1+B2 live verification. Six theme physical/manual qualifications remain separate and pending. The earlier takeover checkpoint above is historical and no longer describes current A0 deployment status.

Inventory on the read-only563,322,880-byte production copy (SHA256 `61551adf698668f696f93aa0742610316e1943e3309734fa237b1ad94032275e`) plus independently captured live journal:38,566 samples,0 canonical references,37,898 legacy keys,668 missing source references,7 held records,0 malformed metadata,0 conflicting explicit pit aliases. Retained copy journal3 rows plus live journal3 rows (overlap possible),0 frozen snapshot items,0 historical non-null profile keys in these artifacts. Zero published keys in these retained artifacts is not proof that all past live reads were unknown; preserve exact legacy identities before relevant context mutations. No broad backfill or production identity mutation occurred. Private row-level report stays outside Git.

