# Independent review of PR291 repair f9bba0db

Status: incomplete/held on the NULL-censoring boundary. Original unit blocker
on5ca14d07 is repaired for tested recording/selection/mean cases. No production
data was used or changed in these Windows tests; the active runtime incident
is a separate PR292 and must not be addressed by blindly releasing PR291.

Exact head f9bba0db17b18d3fe0a7007de8a0784f5e8f789d:2,239 regular raw Git
files SHA1 verified. Eight focused suites ran: seven passed and the expanded
owned matrix failed.96/98 assertions passed. Four additional policy/matrix
suites passed25/25. The independent selected/mean matrix passed14 outcomes.
These are focused evidence, not a full-suite, CI or production Docker pass.

Real retained percent SAND40/SILT40/CLAY19 with CLAY.censoring=NULL still
creates TEXTURE=Loam, one new Result/WorkAttempt and two audit rows. The shared
guard's `row.censoring ?? 'NONE'` assumes a NULL field is explicitly uncensored.
The pre-PR recording path expressly refused every censoring value other than
NONE. Claudio received the observation and has agreed in the native thread
to make NULL censoring refuse strictly. No new scientific authority was inferred.
The original guard expectations are retained for independent retesting on a
new exact head; f9bba0db is not marked PASSED.

The separate duplicate-fraction fixture is invalid. Initial fixture allocation
refused a second execution without a canonical repeat reason. Replacing it with
a duplicate on the same attempt then hit the existing Result uniqueness guard.
Both failures precede texture derivation and are test-fixture problems, not
application regressions. Do not weaken workflow guards to manufacture that
fixture. The pure candidate matrix independently covers duplicate ambiguity.

Claudio's explicit missing-unit/invalid-policy pins: #291comment6111805861.
Missing stored units are never given a current catalogue unit; derivations
refuse them, while the existing blocking closure gate retains exact closure
only with an explicit warning. Invalid stored tolerance never widens/disables
the gate; pre278exact closure remains, and advisory cross-check invalid-policy
refusals remain distinct. Their stored values are not rewritten.
