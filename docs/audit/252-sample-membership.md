# QC sample membership (#252)

Implementation follows #162 pins6062062478 and #252 pin6062398663.
New run creation uses the existing native builder and requires membership.
Stored PROFILE_ONLY identity and evidence are retained. An attempted same-ID
native conversion through membership or rebuild refuses with
QC_RUN_PROFILE_ONLY_STORED; ordinary non-native compatibility membership and
QC entry remain separate. LEGACY_MIGRATED behavior is unchanged.

The stored-profile test helper uses the actual service and an explicit actor
and input in isolated test context. It supplies preexisting data without a
fake HTTP status, direct analytical writes or a production switch.

BatchModal now sends selected work into the native builder and opens its run
worksheet. Missing methods use the existing actor-scoped catalogue for this
analysis; recorded methods cannot be overridden. Unknown metadata, conflicting
recorded methods, no offered method and missing edit permission block creation.
The creation form contains no fixed method, tray capacity or QC defaults. The
server resolves sequence capacity and QC through its existing policy/rule path.
All new messages are additive qcMembership keys in the five client and server
locales. PROFILE_ONLY history retains stored evidence and explains why a new
native run is needed; the LEGACY_MIGRATED rebuild action remains unchanged.

Retained compatibility setup uses visible, real stored-profile fixtures,
guarded by both assertFixtureContext and the actual SQLite connection's owned
test-file path. No QC/status/numeric/history/preservation assertion is weakened.
The retired create route has separate stable 400/zero-write checks, and a
refused new run cannot receive QC (404/zero writes).

Contract changes under pin6062398663: PROFILE_ONLY conversion/rebuild returns
409 with QC_RUN_PROFILE_ONLY_STORED and preserves all rows. Separate new native
runs retain the manual-instrument, calibration, membership and reopen/frozen
checks formerly reached by conversion. The open compatibility rebuild UI test
now exercises LEGACY_MIGRATED; a new PROFILE_ONLY test proves no conversion
action. Each affected fixture case is listed in the PR's Applied by precedent.

The PR records the complete server, client build/lint and CI receipts for its
exact head. There is no schema migration or backfill (0 rows). Audit readiness
depends on successful verification and Claude's exact-head verdict; production
operations remain subject to the recorded freeze.

The branch starts at main283a8bb and does not contain #190. Its core,
historical factory and owner/attempt fixture hunks must remain untouched.
