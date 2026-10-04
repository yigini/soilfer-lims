# Pre-audit work preservation

On 4 October 2026, the current checkout was `docs/issue155-final-records`
at `878e894`, already pushed and merged by PR #157. There were no tracked
source edits and 935 untracked files.

The project-related untracked documents, synthetic audit evidence,
verification helpers, historical release scripts and PR comment drafts
are preserved by the WIP branch `audit/wip-pre-october-handoff`.
These historical scripts are records, not instructions to run a release.
This branch is not intended to merge into main.

The `.tmp` tree included unrelated copied Codex runtime/session history,
local SQLite databases, downloaded research PDFs and generated protocol
schemas. It was moved intact to the local archive
`C:/Users/yigin/.codex/local-archives/soilfer-lims/pre-october-handoff-20261004/scratch`.
A file-size and SHA-256 manifest is alongside it. Private session history
and database artifacts are intentionally not uploaded to GitHub. No
analytical records or audit data were deleted or modified.

Audit implementation starts from `origin/main` on a separate branch per issue.
