"""Standing accepted authority predicates only; no historical operation approval.

Copied AST definitions from accepted18763698 proof_contract.py. The source
and exact-kit review for this new release remain separate mandatory checks.
Unicode canonicalization remains the accepted ensure_ascii=False domain.
Importing this module performs no I/O.
"""
import hashlib,json

OLD_INPUT_CANDIDATE='cde8c8896f5f9d5f1ab07b0ae16b1a765e0a6367'

CANDIDATE='be8379745bdfae52ce46496ff26514dc7d729640'

TREE='676b01e71211786d1aeace50f19a0b2c9f9c482e'

IMAGE='sha256:acc158447f5571068bf150fc0e8fa6f0889aeb38f9aec8be08978d903bd5be6a'

BUILD_RECEIPT_SHA='cd3a2757d8ecb0bf933f49231031eb7fb61eb5abaac17d05f3585c1baaf89f0a'

BUILD_SOURCE='4de3e334d8e498783a4cf20df4a5f93acfdbeb21'

BUILD_PASS=6200145007

MAIN_CI=38772398721

AUDITS=[(295,6146939836,'1a0702b3be410ac1dcdd9dc92f0f0c3dd2774a3a','6d750914d8565acdd496767a7dd935811b5a89b2'),(296,6163165778,'5e0b32830f961b3236c7cf8f74cf8f676e98fbaa','2242bcb4861a7085bb95e78e0e7b1e4edf11d1b8'),(297,6178123314,'6bd516c42a07332d0b0653ed150d1526bf7e424e',OLD_INPUT_CANDIDATE),(298,6195167175,'eba02837eaa2ab797cad0572fecada686f660346',CANDIDATE)]

def require(ok,message):
    if not ok:raise RuntimeError(message)

def sha(raw):return hashlib.sha256(raw).hexdigest()

def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()

def first_line(body):return next((v.strip().strip('*_# ').rstrip('.') for v in body.splitlines() if v.strip()),'')

def current(main,ci,prs,verdicts,comments):
    require(main.get('object',{}).get('sha')==CANDIDATE,'Main changed')
    require(ci.get('id')==MAIN_CI and ci.get('head_sha')==CANDIDATE and ci.get('event')=='push' and ci.get('run_attempt')==1 and ci.get('status')=='completed' and ci.get('conclusion')=='success','Exact completed main CI required')
    for pr,id,head,merge in AUDITS:
        p,v=prs[str(pr)],verdicts[str(pr)]
        require(p.get('merged') is True and p.get('head',{}).get('sha')==head and p.get('merge_commit_sha')==merge,'Application merge identity changed')
        require(v.get('id')==id and v.get('created_at')==v.get('updated_at') and v.get('performed_via_github_app',{}).get('id')==1236702 and v.get('performed_via_github_app',{}).get('slug')=='claude' and first_line(v.get('body','')).startswith('Audit passed: OK to merge and deploy') and head in v['body'],'Application approval changed')
        require(not any(max(c.get('created_at',''),c.get('updated_at',''))>v['created_at'] and 'audit failed' in c.get('body','').lower() for c in comments[str(pr)]),'Later application failure')

def qualified(receipt,raw,inspect):
    require(sha(raw)==BUILD_RECEIPT_SHA and receipt.get('status')=='NEW_STARTUP_APP_IMAGE_BUILT_NOT_PROVED_OR_DEPLOYED','Original qualified receipt differs')
    require(receipt.get('head')==CANDIDATE and receipt.get('tree')==TREE and receipt.get('image')==IMAGE and receipt.get('toolingCommit')==BUILD_SOURCE and receipt.get('sourceReviewId')==BUILD_PASS and receipt.get('exitCode')==0 and receipt.get('error') is None and receipt.get('newBuildCount')==1,'Build qualification binding differs')
    require(inspect.get('Id')==IMAGE and inspect.get('Size')==receipt['imageBytes']==414683521 and inspect['Config']['Labels'].get('org.opencontainers.image.revision')==CANDIDATE and inspect.get('Os')=='linux' and inspect.get('Architecture')=='amd64','Qualified image differs')
    require(all(r['unexplainedGrowthBytes']==0 for r in receipt['diskGrowth']['filesystems'].values()),'Build residual is not zero')
    require(sha(canonical(inspect))=='d7b790d8dfcc4bd784e3a923a8dbbb2b8eb4de1ffa7571641b8fef015021d7ec','Entire qualified image object differs')
    require(receipt.get('applicationIndexSha256')=='c7ee2de3e0cbad7aad9be99b8a74f5ddc070f033b70b9595b7f7c754e99156db','Qualified manifest SHA differs')

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

DIAGNOSTIC_ACCEPTED_SHA='e4ed0595412a6965e33e5fed5118e0d023f0acb9b5cb07035b27936d7b29c829'

def diagnostic_accepted(v):
    require(v.get('id')==6206990387 and v.get('created_at')==v.get('updated_at')=='2026-10-16T02:55:36Z' and sha(canonical(authority_projection(v)))==DIAGNOSTIC_ACCEPTED_SHA,'Actual Step1 diagnostic acceptance changed')
    require(first_line(v['body'])=='Diagnostic result review: ACCEPTED (023000, Step 1 only, not release qualified)','Actual diagnostic acceptance missing')

STEP2_DIRECTION_PINS={'6205724552':'4dc930744235936e2876306876799d788a0169560109a45fa840561ebe27ebc0','6205842415':'0456da7dd3347cd5081d949a13b4d8a6b14d0bdb895620d8642cf6d38670a03e','6206214444':'58128f5bcee6dd307f6e5a8c1ecafbb5adb386a6667460e6434f8740478ea5eb','6206990387':DIAGNOSTIC_ACCEPTED_SHA,'6207912526':'513d07ab1027432492f811cee32155e58197398b54853802cc76b5cc8fde1ea2'}

def step2_authorities(values):
    require(set(values)==set(STEP2_DIRECTION_PINS),'All current Step2 diagnostic/privacy authorities required')
    for i,pin in STEP2_DIRECTION_PINS.items():
        v=values[i];require(v.get('id')==int(i) and v.get('created_at')==v.get('updated_at') and (v.get('performed_via_github_app') or {}).get('id')==1236702 and (v.get('performed_via_github_app') or {}).get('slug')=='claude' and sha(canonical(authority_projection(v)))==pin,'Step2 diagnostic/privacy authority changed')

ATTEMPT_AUTHORITY_PINS={'6208837867':'f260602d431018eacf632a04fc331515ed53746e9d08b8a2ba938e5d2650927d','6210719791':'94c17911c87ec6e9d860001528deab785f24a0c6c83ea69af09b6308c257fe97'}

def attempt_authorities(values):
    require(set(values)==set(ATTEMPT_AUTHORITY_PINS),'Both actual forward acceptances required')
    for key,pin in ATTEMPT_AUTHORITY_PINS.items():
        value=values[key];app=value.get('performed_via_github_app') or {}
        require(value.get('id')==int(key) and value.get('created_at')==value.get('updated_at') and app.get('id')==1236702 and app.get('slug')=='claude' and sha(canonical(authority_projection(value)))==pin,'Actual forward acceptance changed')
