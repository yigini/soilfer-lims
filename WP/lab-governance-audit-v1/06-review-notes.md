# Review notes and boundaries

The package is ready to review and hand off. It does not change the deployed laboratory system or authorize production account changes by itself.

## Local audit evidence

`probe-results.json` records 31 isolated checks. Two are positive controls: same-lab enforcement in the normal Users API, and inactive-user rejection in HTTP authentication. The other 29 checks reproduce the specific behavior described. There are 29 grouped findings; finding and probe numbers are different because several findings have multiple probes and some are source-only.

The runner executes real handler/module source but uses explicit synthetic adapters for authentication inputs, persistence and external dependencies. The offline completion probe uses a synthetic scientific parser to isolate its missing authorization/state boundary. It cannot certify real database success, atomicity or scientific validity. P12 checks the generated query against the real schema; it does not run a Prisma database query. The user-delete probe has no foreign keys; real referenced-user deletion may fail. These limits are part of the evidence, not errors to suppress.

## Prototype review

The prototype passed 33 automated checks: all six tabs at 1440, 768, 390 and 320 pixels; search; access review and required inputs; stale-revision recovery; connection-error behavior; invitation review; national read-only delegation state; pause/resume impact; dark mobile view; dialog Escape. There were no JavaScript page errors and no network requests. Desktop, access-review, dark and mobile screenshots were also visually inspected.

The prototype is English only and illustrative. Production needs all five locales, exact current role/domain policies, real pagination, full accessibility testing and complete functional workflows. Several navigation controls deliberately show a connection explanation instead of opening the live application. Nothing in the preview sends mail, grants access, creates staff, changes a database or claims to be production-ready UI code.

Screenshot files:

- [Desktop overview](preview-desktop.png)
- [Staff access review](preview-access-review.png)
- [Dark people workspace](preview-dark.png)
- [Mobile people workspace](preview-mobile.png)

## Key release distinctions

- **Audited** means reviewed with the evidence and limitations described here.
- **Implemented** requires source changes against the current repository.
- **Tested** requires strict-schema integration and real role journeys, beyond this preview and synthetic runner.
- **Pushed** requires confirmed GitHub commits.
- **Deployed** requires verified production build/schema and read-only smoke evidence.

Antigravity must report those states separately and explain what each change means for laboratory staff. No promise of “zero issues” is justified by a plan, a mockup or a successful frontend build.
