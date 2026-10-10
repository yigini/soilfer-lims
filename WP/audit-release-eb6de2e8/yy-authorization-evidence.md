Pip directly inspected YY's original decision in Claude's LIMS Audit project,
thread "Progress recap and remaining work", on October 10, 2026.

The original human message reads: "go with the deploy".
The decision card asks: "Deploy automatically once the release kit passes
review and rehearsal?" Its selected answer reads: "Auto after review",
"You chose 5:55 PM". This is 15:55 UTC in Europe/Rome. The card was visible
in the native Claude window, not inferred from Claudio's report. Pip captured
the window state, inspected the card, and changed no decision.

GitHub's corresponding ledger records the precise timestamps as
15:55:24 UTC (typed message) and 15:55:35 UTC (decision):
https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6099376595

The separate "Main now" scope choice was directly inspected in the LIMS audit
thread during initial preparation. The corresponding ledger records
15:56:52 UTC:
https://github.com/yigini/soilfer-lims/issues/162#issuecomment-6099391578

Claudio subsequently pinned main eb6de2e8 plus only the independently audited
installer-memory repair (#287). #205 and #284 remain excluded. The final
application commit must be bound explicitly in his exact kit review.

This authorizes production execution only after the exact final kit and fresh
production-copy rehearsal both pass. It does not waive the #190 row-plan,
reserve, preservation, current-head audit or CI gates. No further YY go is
required once those conditions are met; failed gates still refuse execution.

The coordinator's yyGo evidence hash refers to this transcription of original
human decisions, not to a manufactured new approval or an audit pass.
