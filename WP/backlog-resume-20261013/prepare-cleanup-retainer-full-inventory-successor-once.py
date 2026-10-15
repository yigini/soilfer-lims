"""Prepare a new read-only retainer for all FIVE known controller outputs."""
import pathlib
R=pathlib.Path(__file__).resolve().parents[2];H=R/'WP/backlog-resume-20261013';target=H/'retain-approved-safe-set-closed-all-five-records-once.py';assert not target.exists()
s=(H/'retain-approved-safe-set-closed-receipt-once.py').read_text(encoding='utf-8')
old="'approval-and-plan.json','before.json','item-results.jsonl','receipt.json'";new="'approval-and-plan.json','before.json','cache-before-original.json','item-results.jsonl','receipt.json'";assert s.count(old)==1
s=s.replace(old,new).replace('closed-receipt-retention-once','closed-receipt-retention-complete-once');compile(s,str(target),'exec');target.write_text(s,encoding='utf-8')
for n in ['publish-safe-set-closed-cleanup-evidence-once.py','post-safe-set-6189633644-closed-receipt-once.py']:
 p=H/n;t=p.read_text(encoding='utf-8');t=t.replace('closed-receipt-retention-once','closed-receipt-retention-complete-once');p.write_text(t,encoding='utf-8')
print('Prepared new read-only all-five-record retainer; refused predecessor unchanged.')
