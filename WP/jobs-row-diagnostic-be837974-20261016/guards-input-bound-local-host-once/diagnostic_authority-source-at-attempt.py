"""Fresh GitHub authority guards for a new diagnostic; pure on import."""

import hashlib,json,re

OLD_INPUT_CANDIDATE='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'

CANDIDATE='be8379745bdfae52ce46496ff26514dc7d729640'

TREE='676b01e71211786d1aeace50f19a0b2c9f9c482e'

MAIN_CI=38772398721

AUDITS=[(295,6146939836,'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a','6d750914d8565acdd496767a7dd935811b5a89b2'),(296,6163165778,'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa','2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'),(297,6178123314,'6bd516c42a07332d0b0653ed150d1526bf7e424e',OLD_INPUT_CANDIDATE),(298,6195167175,'eba02837eaa2ab797cad0572fecada686f660346',CANDIDATE)]

def require(ok,message):
    if not ok:raise RuntimeError(message)

def sha(raw):return hashlib.sha256(raw).hexdigest()

def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()

def exact_json(raw):
    def pairs(items):
        out={}
        for k,v in items:require(k not in out,'Duplicate JSON key');out[k]=v
        return out
    return json.loads(raw,object_pairs_hook=pairs)

def first_line(body):return next((v.strip().strip('*_# ').rstrip('.') for v in body.splitlines() if v.strip()),'')

def current(main,ci,prs,verdicts,comments):
    require(main.get('object',{}).get('sha')==CANDIDATE,'Main changed')
    require(ci.get('id')==MAIN_CI and ci.get('head_sha')==CANDIDATE and ci.get('event')=='push' and ci.get('run_attempt')==1 and ci.get('status')=='completed' and ci.get('conclusion')=='success','Exact completed main CI required')
    for pr,id,head,merge in AUDITS:
        p,v=prs[str(pr)],verdicts[str(pr)]
        require(p.get('merged') is True and p.get('head',{}).get('sha')==head and p.get('merge_commit_sha')==merge,'Application merge identity changed')
        require(v.get('id')==id and v.get('created_at')==v.get('updated_at') and v.get('performed_via_github_app',{}).get('id')==1236702 and v.get('performed_via_github_app',{}).get('slug')=='claude' and first_line(v.get('body','')).startswith('Audit passed: OK to merge and deploy') and head in v['body'],'Application approval changed')
        require(not any(max(c.get('created_at',''),c.get('updated_at',''))>v['created_at'] and 'audit failed' in c.get('body','').lower() for c in comments[str(pr)]),'Later application failure')

RULE_AUTHORITY_PINS={'6189025975': '071b37b60b7489fc47f53aee5d5a91726e967730ebdf40adbc22aef4b047ee7e', '6189658753': '1b293cf3d6b7108293599ffabfc1273ebd5f158f69a6e11f58e467d7ffa42708', '6189669837': '2821ccc164bbf344201e6569f707314a168ae6f308cbece73cc5065d9ad3ac7e', '6191219093': '84289b1c85e65973f26d52199f539e13423d5803c83c38be34a515b089505f8f', '6198899941': '9d7e1490880d76d4bbae73851e4a441a8ea7c9dcd3c16383e79250f94fc6e613', '6200547786': '05604935975efc784fe8d7c52f3a820599c2365de1121370cd345e2eabb0c250'}

R2_ACCEPTED_SHA='b51fe05761cc74071c5b9113464545de6f8a810e531ba9524709d68d5bd582af'

def authority_projection(v):
    out={k:v[k] for k in ['id','body','created_at','updated_at']};app=v.get('performed_via_github_app') or {};out['app']={'id':app.get('id'),'slug':app.get('slug')};return out

def rule_authorities(rules,accepted):
    require(set(rules)==set(RULE_AUTHORITY_PINS),'Complete six current rule authorities required')
    for i,pin in RULE_AUTHORITY_PINS.items():
        v=rules[i];require(v['id']==int(i) and sha(canonical(authority_projection(v)))==pin,'Current rule authority changed '+i)
    require(accepted['id']==6202252017 and sha(canonical(authority_projection(accepted)))==R2_ACCEPTED_SHA,'Actual accepted R2 boundary changed; no further R2 authority')

POST_REBOOT_PINS={'6202595120': '267bfc400e7d1ad92a089e05083a4129407451b7ec06267d1b5d98bb640e555b', '6202615241': '04a0ffc6bbae5b3f6a59586ce8e6f73e46a5040e60d3e5f0e00c5dae0d445cfc'}

def post_reboot_authorities(values):
    require(set(values)==set(POST_REBOOT_PINS),'Current actual post-reboot authorities required')
    for i,pin in POST_REBOOT_PINS.items():
        require(values[i]['id']==int(i) and sha(canonical(authority_projection(values[i])))==pin,'Post-reboot authority changed '+i)

MEMORY_DIRECTION_SHA='cae90fa72e66f14b03737bee5aa1ea380e11c003d8ad3be877c1ee3bd25cc2ac'

def memory_authority(value):
    require(value.get('id')==6203416404 and value.get('created_at')==value.get('updated_at')=='2026-10-15T22:16:57Z' and value.get('performed_via_github_app',{}).get('id')==1236702 and value.get('performed_via_github_app',{}).get('slug')=='claude' and sha(canonical(authority_projection(value)))==MEMORY_DIRECTION_SHA,'Actual memory direction changed')

JOBS_SCOPE_SHA='f80f7eaadca3e6222be296ff9d5660f1ab84756ed59086fc8f9f37ad88403fff'

def jobs_scope_authority(v):
    require(v.get('id')==6204518776 and v.get('created_at')==v.get('updated_at')=='2026-10-15T23:36:01Z' and sha(canonical(authority_projection(v)))==JOBS_SCOPE_SHA,'Actual accepted startup result and jobs scope changed')

DIAGNOSTIC_SCOPE_PINS={'6205842415': '0456da7dd3347cd5081d949a13b4d8a6b14d0bdb895620d8642cf6d38670a03e', '6205724552': '4dc930744235936e2876306876799d788a0169560109a45fa840561ebe27ebc0'}


def diagnostic_scopes(values):
    require(set(values)==set(DIAGNOSTIC_SCOPE_PINS),'Both actual diagnostic directions required')
    for i,pin in DIAGNOSTIC_SCOPE_PINS.items():
        v=values[i];require(v['id']==int(i) and v['created_at']==v['updated_at'] and v.get('performed_via_github_app',{}).get('id')==1236702 and v.get('performed_via_github_app',{}).get('slug')=='claude' and sha(canonical(authority_projection(v)))==pin,'Diagnostic scope changed')

