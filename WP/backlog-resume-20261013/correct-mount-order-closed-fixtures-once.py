"""Correct closed synthetic fixtures only; original568 run remains immutable."""
import json,pathlib
W=pathlib.Path(__file__).resolve().parents[2];B=W/'WP/batch-proof-mount-order-forward-be837974-20261016'
D=B/'first568-fixture-failure-correction-once';assert not D.exists();D.mkdir()
for name,before,after in [
 ('verify_mount_order_guards.py','            if timeout:raise subprocess.TimeoutExpired(args,30)\n',''),
 ('verify_proof_guards.py','2026-10-16T04:15:00Z','2026-10-16T07:50:00Z'),
 ('verify_proof_guards.py','2026-10-16T04:16:00Z','2026-10-16T07:51:00Z')]:
 p=B/name;raw=p.read_bytes()
 if not (D/name).exists():(D/name).write_bytes(raw)
 s=raw.decode();assert s.count(before)==1;p.write_text(s.replace(before,after),encoding='utf-8',newline='\n')
old=W/'WP/backlog-resume-20261013/verify-mount-order-attempt-local-host-first-once.py'
new=W/'WP/backlog-resume-20261013/verify-mount-order-attempt-local-host-complete-once.py';assert not new.exists()
s=old.read_text(encoding='utf-8').replace('source-local-host-mount-order-first-once','source-local-host-mount-order-complete-once').replace('lims-mount-order-guards-first-20261016T081500Z','lims-mount-order-guards-complete-20261016T082000Z')
compile(s,str(new),'exec');new.write_text(s,encoding='utf-8',newline='\n')
(D/'correction-derived.json').write_text(json.dumps({'recordType':'DERIVED_FROM_CLOSED_ORIGINALS','originalTests':568,'originalFailures':136,'hostStarted':False,'cause':'New stand-in function keyword timeout=30 shadowed its outer timeout flag, accidentally raising on every successful ps; two historical rejection fixture clocks predated the newly advanced source review fixture.','correction':'Remove redundant shadowed timeout branch; dedicated real-call timeout test remains. Advance only the two later-rejection synthetic clocks. No runtime or guard predicate change, assertion weakened, operator replay or host call.'}),encoding='utf-8')
print(new.relative_to(W).as_posix())
