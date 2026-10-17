"""Complete shared evidence allowance held before an owned CLI is created.

This is source-only allocation admission, not a filesystem preallocation or a
claim that all fifteen future lifecycles fit. The next CLI refuses BEFORE
create if its full allowance no longer fits. Existing per-owner memory guards,
raw inspection predicates, child transaction and600-second clock are unchanged.
"""
import kit_evidence
from kit_contract import require

MIB=1024**2
CLI_MEMORY_OBSERVATIONS=302
CLI_INSPECTIONS=2*CLI_MEMORY_OBSERVATIONS+4
CLI_COMMANDS=CLI_INSPECTIONS+4
# <=600 periodic reads during the child clock; create/created inspection,
# the bounded final inspection/memory tail and logs add <120. The remaining
# eighty reads conservatively cover fixed command-boundary rounding. Blocking
# synchronous file I/O cannot create another periodic observer thread.
CLI_CONTROLLER_OBSERVATIONS=800
CLI_ENVELOPE={'commands':2512*MIB,'memory':268*MIB,'controller':136*MIB,'journal':64*MIB}


def bounds():
    a=kit_evidence.allocation
    # Successful inspections retain <=4MiB stdout and EMPTY stderr. One failed
    # command can spend64MiB stderr, then it aborts this lifecycle. The former
    #128MiB final Docker-log allowance becomes64MiB of native CLI pipe
    # originals BEFORE mkdir, outside this window, plus64MiB failure headroom.
    commands=(CLI_INSPECTIONS*(a(4*MIB+1)+a(0))+
        2*(a(128+1)+a(0))+a(16+1)+a(0)+a(64*MIB+1))
    # Existing256MiB per-owner data allowance includes the summary. Add EVERY
    # raw/sample/refusal entry; originals are root files, with no nested dirs.
    memory=256*MIB+(CLI_MEMORY_OBSERVATIONS*9+8)*4096+64*1024
    # Eight original bounded16KiB reads, each with an entry; one <=8KiB
    # reference record. No predicate or original kernel byte is discarded.
    controller=CLI_CONTROLLER_OBSERVATIONS*(8*a(16384)+a(8192))
    # Two <=8KiB atomic records per command, two full16MiB lifecycle records,
    # fixed spec intent/permit/completion and nested control-directory metadata.
    journal=CLI_COMMANDS*2*a(8192,2)+2*a(16*MIB,2)+128*1024
    result={'commands':commands,'memory':memory,'controller':controller,'journal':journal}
    require(all(result[k]<=CLI_ENVELOPE[k] for k in result),'CLI source maxima exceed their pre-start envelope')
    require(sum(CLI_ENVELOPE.values())<=sum(kit_evidence.SHARES.values()),'CLI envelope exceeds its shared evidence pool')
    return result


def begin_cli_evidence(label):
    bounds()
    if kit_evidence._runtime is None:return None
    return kit_evidence._runtime.begin_window('cli-'+label,CLI_ENVELOPE)
