# GitHub communication and closure

Use authenticated account yigini. Verify the account with gh api user before posting. Read fresh comments first; don't duplicate previous updates.

The user explicitly authorized implementation, safe deployment, reporting how each issue was solved, and closure after full resolution. Do not ask again for ordinary fixes. Pause only a concretely ambiguous data/policy action, and continue other issues.

## Starting comment

Keep it brief and issue-specific:
“Implementation is starting from the reviewed proposal. I am fixing [specific behavior] and will verify [key outcomes]. This issue will remain open until the change is deployed and checked. [Specific missing input only if applicable.]”

Do not post repeated “still working” comments. Add updates when the diagnosis changes, a blocker needs input, a release is available or verification completes. Public comments must omit credentials, internal infrastructure secrets and sensitive lab records.

## Resolution comment template

### What was wrong
Plain-language explanation with the confirmed cause. Distinguish source diagnosis from reproduced behavior.

### What changed
Concrete before/after example; explain how staff use it and whether existing records require any reviewed correction.

### Verification
- Relevant actual UI/API cases and results; link committed non-sensitive evidence.
- Commit / PR and successful CI link.
- Exact deployed release and date, plus post-deployment checks.
- Content/config release if separate from code.
- Limitations or outstanding acceptance. Never state “all passed” over incomplete cases.

### Status
“Verified deployed; closing this issue” only when its full acceptance is met.
Otherwise: “Deployed, but keeping this open because [specific missing evidence/input]. Next step: [specific action].”

Use gh issue comment with --body-file to preserve Markdown/newlines. Confirm the posted author and URL. Close separately only after the resolution comment and checks. Do not use Fixes/Closes/Resolves in a PR to let a merge close an issue prematurely.

## Issue-specific cautions

- #109: explain optional monthly capacity and independent timezone save.
- #108: distinguish event saved/accepted and instrument readiness; list any historical mismatch still awaiting correction.
- #107: name verified routes/locales and exceptions; key parity is not translation completeness.
- #105: record the agreed receipt responsibility explicitly. Documentation/behavior clarification can resolve this issue without creating automatic reception.
- #104: link the actual external Dashboard fix; a LIMS release cannot establish resolution.
- #103: report the reviewed policy and disposition; no guessed ownership or implied approval from an old report.
- #102: cite actual hardware evidence; leave open if only emulation is available.
- #92: relate closure to current v2 Help/content, not v1 historical tests.
- #106: already closed after reporter confirmation; avoid further comments unless new evidence matters.

At the end give the user a short summary: closed with links, deployed but still open, awaiting input, and any remaining implementation. Use friendly everyday language; avoid dense tool logs or claims of perfection.
