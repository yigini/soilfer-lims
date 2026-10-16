"""Read fresh current main, audits and every standing scope. No host calls."""
import json,subprocess,pathlib
import proof_contract as old
from diagnostic_contract import accepted,ACCEPTED_ID
def read(path):return json.loads(subprocess.check_output(['gh','api',path]))
def current_evidence():
    base='repos/yigini/soilfer-lims/';out={'main':read(base+'git/ref/heads/main'),'ci':read(base+'actions/runs/'+str(old.MAIN_CI)),'prs':{},'verdicts':{},'comments':{}}
    for pr,id,head,merge in old.AUDITS:
        key=str(pr);out['prs'][key]=read(base+'pulls/'+key);out['verdicts'][key]=read(base+'issues/comments/'+str(id))
        out['comments'][key]=[c for page in json.loads(subprocess.check_output(['gh','api','--paginate','--slurp',base+'issues/'+key+'/comments?per_page=100'])) for c in page]
    old.current(out['main'],out['ci'],out['prs'],out['verdicts'],out['comments'])
    for field,pins,validate in [('rules',old.RULE_AUTHORITY_PINS,None),('postReboot',old.POST_REBOOT_PINS,old.post_reboot_authorities),('step2',old.STEP2_DIRECTION_PINS,old.step2_authorities)]:
        out[field]={id:read(base+'issues/comments/'+id) for id in pins}
        if validate:validate(out[field])
    out['r2']=read(base+'issues/comments/6202252017');old.rule_authorities(out['rules'],out['r2'])
    for field,id,validate in [('memory',6203416404,old.memory_authority),('jobs',6204518776,old.jobs_scope_authority),('diagnostic',6206990387,old.diagnostic_accepted),('accepted063000',ACCEPTED_ID,accepted)]:
        out[field]=read(base+'issues/comments/'+str(id));validate(out[field])
    old.require(read(base+'issues/191')['state']=='closed','Issue191 must remain closed')
    out['sourceComments']=[c for page in json.loads(subprocess.check_output(['gh','api','--paginate','--slurp',base+'issues/162/comments?per_page=100'])) for c in page]
    return out
