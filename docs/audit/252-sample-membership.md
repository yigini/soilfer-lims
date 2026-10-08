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

This is a WIP checkpoint. Still required: BatchModal membership/method choice,
additive qcMembership strings in all five locales, stored-run rebuild UI,
explicit contract/precedent fixture adaptations, preservation/refusal tests,
full server/client verification and a separate audited PR. No migration,
backfill, production operation or readiness claim at this checkpoint.

The branch starts at main283a8bb and does not contain #190. Its core,
historical factory and owner/attempt fixture hunks must remain untouched.
