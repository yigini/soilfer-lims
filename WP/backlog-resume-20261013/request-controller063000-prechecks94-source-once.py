"""One exact-source request for two prechecks. No host operations."""
import pathlib,json,subprocess,sys,datetime,hashlib
W=pathlib.Path(__file__).resolve().parents[2]
REL='WP/controller063000-prechecks-be837974-20261016/'
B=W/REL;D=B/'exact-source-review94-once';HEAD='a6d8c5d5085bbe07cb649f858ec00acf0e3f8ee1'
assert not D.exists();D.mkdir();sys.dont_write_bytecode=True;sys.path.insert(0,str(B))
import diagnostic_contract as c
import diagnostic_authority as authority
import prepare_diagnostic as prep
original=subprocess.check_output;captures=[]
def call(args,*a,**k):
    raw=original(args,*a,**k)
    if args[:2]==['gh','api']:
        n='api-original-'+str(len(captures)).zfill(2)+'.json';(D/n).write_bytes(raw)
        captures.append({'path':n,'argv':args,'bytes':len(raw),'sha256':c.sha(raw)})
    return raw
subprocess.check_output=call
assert prep.git('rev-parse','HEAD').decode().strip()==HEAD and prep.git('branch','--show-current').decode().strip()=='audit/release-eb6de2e8' and not prep.git('diff','--cached','--name-only').strip()
files,index=prep.source_index(HEAD);evidence=authority.current_evidence();c.accepted(evidence['accepted063000']);bindings=c.tokens(index)
marker='controller063000-prechecks94-a6d8c5d5-accepted6208837867'
assert not any(marker in v['body'] for v in evidence['sourceComments'])
publication=json.loads((B/'source94-publication-once/publication-index.json').read_bytes())
paths=[r['path'] for r in publication['bindings']]
raw=prep.git('cat-file','--batch',input=('\n'.join(HEAD+':'+n for n in paths)+'\n').encode());at=0
for row in publication['bindings']:
    end=raw.index(b'\n',at);given,kind,length=raw[at:end].decode().split();length=int(length);at=end+1
    data=raw[at:at+length];at+=length
    assert kind=='blob' and given==row['gitBlobOid'] and len(data)==row['length'] and c.sha(data)==row['sha256'] and raw[at:at+1]==b'\n';at+=1
assert at==len(raw)
for n,digest in json.loads((W/'WP/startup-order-readiness-20261015/full-pinned-copy-retention-bound-ordinary-once/source-before.json').read_bytes()).items():assert c.sha((W/n).read_bytes())==digest
source_lines='\n'.join('- `'+n+'` SHA256 `'+v['sha256']+'` ('+str(v['bytes'])+' bytes, Git blob `'+v['blob']+'`)' for n,v in index['files'].items())
mapped=[]
for e in json.loads((B/'writer-map.json').read_bytes())['entries']:
    refs=', '.join('`'+v['file']+':'+str(v['firstLine'])+'-'+str(v['lastLine'])+'@be837974`' for v in e['writerSites']) or 'Qualification/parser/history bound; no app writer for this extra conservative constraint'
    mapped.append('- `'+e['comparatorFile']+':'+str(e['line'])+' '+e['function']+'`: '+str(e['message'])+' -> '+refs+(' **INTENTIONAL REFUSAL of existing-conflict in-place revision985-1014**' if e['role']=='INTENTIONAL_REFUSAL_IN_PLACE_CONFLICT_REVISION' else ''))
intro=f"""@claude

Please review the complete NEW graph for the TWO pre-attempt checks in actual6208837867. Acknowledgement of that direction is bundled ONLY here. Actual result6208657786 is answered;05:38:06 result native fallback CANCELLED/never repeat. Consumed063000/572d/PASS620818/root/unit/package/operators stay immutable FAILED/NOT_RELEASE_QUALIFIED/no retry/replay.

Exact source `{HEAD}`;26 review bindings (18Python+1JS+7metadata/app),143 independently rawGitOID/SHA256/length verified publication files. Final94 LOCAL+94 ACTUALhostPython3.9.23 guards closed PASS/all sources unchanged. Acceptance publication29177822891e35e98486d5c4ccd4ba4b3b4e6fab/49raw retained actual full unedited6208837867. Fresh mainbe837974/CI38772398721attempt1push CLOSED SUCCESS/four audits/six rules/two postreboot pins/memory/jobs/diagnostic/privacy/R2 accepted/191CLOSED verified. All1333 frozen app inputs and old31source unchanged.

Complete source/evidence: https://github.com/yigini/soilfer-lims/tree/{HEAD}/{REL}
Publication: https://github.com/yigini/soilfer-lims/blob/{HEAD}/{REL}source94-publication-once/publication-index.json
Exact97-predicate AST/writer map: https://github.com/yigini/soilfer-lims/blob/{HEAD}/{REL}writer-map.json

Please audit these concrete limitations: actual LOCAL Node24 evaluates the ENTIRE unpatched bound controller, with only noncrypto application imports inert to prevent app/Prisma/network initialization. Its unmodified computeEvidenceFingerprint emits345bfa7727c61604, fed through checked_cross. HostPython uses this retained actualLOCALNode response; NO hostNode execution claim. Existing-conflict in-place revision985-1014 is deliberately refused as Old metadata array changed, explicitly explained in the map below; no silent allowance. Any such actual C1 refusal needs new reviewed direction/no retry.

All real Docker/SSH/operators are blocked during guard suites; SQLite ONLY new retained synthetic fixtures. HostPython sources IN MEMORY/0remotePython sourcefiles. Numeric currentPID reader/plainbytes equal and own_snapshot expected outsideunitmembership refusal are unpatched actual host exercises. Rendered ACTUAL uploader/capacity-before-root/unit properties are exercised with CLOSED FAKE in-memory Path/processes. Its dispatched:true stdout is FAKE, NOT an operational launch/root/unit. Earlier missing dependency/VMmodule/bootstrap render failures are retained honestly; no operational check or proof replay.

The real hook command path remains reserved for your reviewed C2. It uses new unpatched stop_exact(readonly_call->realcall), wrapper permits ONLYps/inspect. Typeexec/805306368Swap0/UMask0077/journal transient unit, BOTH alreadySTOPPED exact063000owners. Every call records argv/exit/elapsed +stdoutstderrSHA256/length BEFORE predicates including timeout. Raw inspect includes environment/JWT_SECRET, remains HOST0400 NEVER FETCH/PUBLISH; stderr only after separate content review. Per-owner phases/static-site public_failure else HMAC converted AFTER key. Empty-stderr rule unchanged; one-owner error cannot block other; every error FAIL; no vacuous success. No actual stop/start permitted.

C1 uses exactly proof_jobs181-182 verify_copy arguments on NEWcopied mains ONLY, with original6mainWALSHM hash/stat beforeafter, retained first-completion fetch/fourrefusalIDs/full112schema42receipts/every addedholdauditconsumed/zero refusals. Results only counts/classifications/static literals/keyed hashes;186/22remain log counts until validated. No productionDB/containers/runtime network; fresh private32byteHMACHOST0400. Beforeafter ownunitcgroup805Swap0/OOM0. R4 floor10556150894+4GiBlogs+ADDITIONAL10GB+two563326976Bcopy allocations+exactfuturepackage BEFORE ROOT ONLY, freshbeforeUNIT/runtime;500MBunexplained abort. Own-root allocated-stat growth versus filesystem free drop is conservative and explicitly NOT a whole-store physical measurement; no du.

Order: NEW exactSourcePASS -> C1 and C2 ONE run EACH/no retry -> actualCl acceptance of BOTHresults -> DISTINCT attempt graph binding acceptance -> its own NEWexactSourcePASS/freshR4+10GB/unusedrootunit/ONEattempt. This source grants no qualification attempt/kit/gate/deploy/mainmerge. Proposed root `{c.ROOT}`, units `{c.UNITS['comparator']}` and `{c.UNITS['hook']}` remain UNCREATEDbyus/no operational package/check. Sourceprepare/launch/runtime UNEXECUTED except import/compile/closedfakeguards. Freshunused checks required after actualPASS. Sequential check launches; hook refuses while comparator active.

Full concrete graph notes:
"""
body=intro+(B/'README.md').read_text(encoding='utf-8')+'\n\nExact bindings:\n'+source_lines+'\n\nComplete literal approval bindings (please include EVERY token with first line Source review: PASS):\n```\n'+'\n'.join(bindings)+'\n```\n\nEvery comparator require -> bound writer or explicit conservative qualification bound:\n'+'\n'.join(mapped)+'\n\n<!-- '+marker+' -->\n'
assert len(body)<65000
for n,value in [('source-index.json',index),('post-request.json',{'body':body}),('current-authority-evidence.json',evidence),('api-command-index.json',captures)]:
    (D/n).write_bytes(c.canonical(value)+b'\n')
(D/'review-body-utf8.txt').write_bytes(body.encode())
(D/'pre-helper-generator-refusal-derived.json').write_bytes(c.canonical({'recordType':'TOOL_OUTPUT_TRANSCRIPTION','error':'Outer Python generator nested triple-quote SyntaxError; no helper file created; subsequent missing-file exit2; no GitHubPOST/host/source mutation','correctedBy':'Direct apply_patch unique helper'})+b'\n')
(D/'post-intent.json').write_bytes(c.canonical({'marker':marker,'bodySha256':c.sha(body.encode()),'sourceHead':HEAD,'startedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'onePostNeverReplay':True}))
r=subprocess.run(['gh','api','repos/yigini/soilfer-lims/issues/162/comments','--method','POST','--input',str(D/'post-request.json')],capture_output=True,timeout=90)
(D/'actual-post-response.json').write_bytes(r.stdout);(D/'post-stderr.log').write_bytes(r.stderr);(D/'post-exit.json').write_bytes(c.canonical({'returnCode':r.returncode}))
assert r.returncode==0,'Unknown POST outcome inspect SAME history NEVER repost'
v=json.loads(r.stdout);assert v['body']==body
fresh=call(['gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(v['id'])]);(D/'actual-fresh-readback.json').write_bytes(fresh)
a=json.loads(fresh);assert a['body']==body and a['id']==v['id'] and a['created_at']==a['updated_at']
record={'commentId':v['id'],'url':v['html_url'],'createdUtc':v['created_at'],'sourceHead':HEAD,'bodySha256':c.sha(body.encode()),'marker':marker,'requestResponseFreshReadbackEqual':True,'sourceBindings':len(index['files']),'approvalTokens':len(bindings),'newExactSourcePassPending':True,'nativeFallbackNoEarlierUtc':(datetime.datetime.fromisoformat(v['created_at'].replace('Z','+00:00'))+datetime.timedelta(minutes=20)).isoformat(),'oldResultNativeFallbackCancelledAnswered':True,'hostOperations':0}
(D/'delivery-record.json').write_bytes(c.canonical(record)+b'\n')
print(json.dumps(record))
