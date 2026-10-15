"""Publish actual human decisions and guarded exact-set source before execution."""
import hashlib,json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-approved-safe-set-cleanup-20261015';BASE='50dea47ad291a58b2c67f1965939d71de1f3b69c'
def cmd(*a):return subprocess.check_output(a,cwd=R)
def sha(b):return hashlib.sha256(b).hexdigest()
def raw(ref,n):
 b=cmd('git','show',ref+':'+n);oid=cmd('git','rev-parse',ref+':'+n).decode().strip();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==oid;return b
assert cmd('git','rev-parse','HEAD').decode().strip()==BASE and not cmd('git','diff','--cached','--name-only').strip()
assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==BASE
for id,name in [(6189658753,'standing-rule'),(6189669837,'standing-rule-activation')]:
 b=cmd('gh','api','repos/yigini/soilfer-lims/issues/comments/'+str(id));v=json.loads(b);assert v['id']==id and v['performed_via_github_app']['id']==1236702 and v['performed_via_github_app']['slug']=='claude'
 with (D/(name+'-original.json')).open('xb') as f:f.write(b)
 (D/(name+'-readable.txt')).write_text(v['body'],encoding='utf-8')
test=json.loads((D/'platform-guard-successor-once/summary.json').read_bytes());assert test['status']=='PASS' and test['localTests']==test['hostTests']==10 and test['allSourceUnchanged']
assert test['operatorSha256']==sha((D/'cleanup_exact_safe_set.py').read_bytes()) and test['planSha256']==sha((D/'approved-plan.json').read_bytes())
lead='''## 2026-10-15 YY ACTUAL SAFE-SET APPROVAL6189633644 and standing rule ACTIVE6189669837

Actual freshnativehuman B Safe set only /12:09PM card READ (agent0input) +FULLofficialCl6189633644/10:10:04UTC binds420919list. ONLY65exactcacheIDs+B3failed_db duplicate+I1Museumprev093649+P1metadata233000/P2-020000/P3-023000 approved,4,956,528,049B estimate. B1issue155/B2issue159distinctrestorepoints STAY. Conditions freshiteminuse/shared/child/hash/keeper/imageconsumer/prooffileGitchecks immediatelyBEFOREeachremoval; changedSKIPnosubstitution; exactID/pathONLY/no blanketprune; itemreceipt+dfBEFOREAFTER. NativeandGHretained at WP/yy-approved-safe-set-cleanup-20261015. Source cleanup_exact_safe_set.py/approved-plan.json preparedNOTEXECUTED;10local+10ACTUALLinuxPython3.9.23 syntheticguardsPASS/sourceunchanged. InitialWindowsfixture O_NOFOLLOW AttributeError9PASS1ERROR retainedhonestly/sourceunchanged/nohostoperation, onlytestfixtureportableflagpatchsuccessor resolved; actualLinuxusesrealO_NOFOLLOW. New93proofGitcopies reverifiedbeforeplan. Single-usehostreceiptintentplanned /opt/lims/cleanup-receipts/yy-safe-set-6189633644; existingintentrefuses/replaynever. CachemutationONEanchoredfull-IDfiltereach, exactreadonlydufilterbeforeprune, leavesfirst/fullDFandunapprovedchildguard. Exactimage rm --no-prune/no force/no otherimage; ONLY93approvedflatproof files+root afterfreshhashes/nodeps; singleduplicateB3unlinkafterstablebothhashes/keeperretained. No remoteoperator dispatched yet at this checkpoint.

Actualstandingrule6189658753/10:11:33UTC and ACTIVATION6189669837/10:12:11UTC FULLGH+native A Approve rule/12:12PM+completedreply READ, agentneveranswershumancard. ActiveR1boundedCLOSEDderivedcopiesONLY withpublishedsmall-evidenceGitmatches/eachremovedSHA+lengthANDno filewithoutverifiedcopyelsewhere/nodeps/notlatestpassingcandidate; keep small evidence and allunverifiedraw050000060000. R2afterSUCCESSFULbuild cache5GB/noinuseorimageshared/no daemonrestartconfigchange. R3monthlyLIMSlistONLY/allcontainer/config/env/releaserefs/currentpreviouscandidateANDnonLIMSkept. R4computedrequirementPLUS10GBheadroomBEFOREeachbuild/proof; nofitSTOP/reportqualifiedR1options. R5NObackupremoval/offhostdestinationpendingYY. ExactearlierSAFESET proceedsseparatelyexplicit6189633644, sooneapprovedMuseum+duplicatebackup allowedONLYthatone-timeauthority. No blanketprune. EachR1/R2itemreceipt+dfClhourlyaudit. Ruleisnotauthoritytoinfer rawDBduplicatefromhashrecordalone orremoveoldunverifiedcopies. Nextfreshapp/build/proofsourcebudgetmustincludeR4headroom; no cde8/B5retry or historicalhelperreplay.

User latest checkdecisionwithClaudio addressed by freshFULLGH+actualnativecard/reply read; no repeatmessage/ACK needed. Appperformance scope6189025975/telemetry4PASS862079 stillcurrent/notcompletefix/noPR/newbuild/proof. Noactiveproductionproof. All scientific/refusal/integrity/hash/report/805306368/600/forward-only/no103 guards hold. These actual approvals supersede old no-cleanup-approval/list-only checkpoint only for their EXACT stated scope.

'''
readme=R/'WP/audit-release-eb6de2e8/README.md';readme.write_bytes(lead.encode()+readme.read_bytes())
out=D/'authority-and-source-index.json';assert not out.exists()
paths=sorted(p for p in D.rglob('*') if p.is_file())+[R/'WP/backlog-resume-20261013'/n for n in ['prepare-approved-safe-set-6189633644-once.py','verify-approved-safe-set-platform-guards-once.py']]+[pathlib.Path(__file__),readme]
paths=[p for p in paths if '__pycache__' not in p.parts]
out.write_text(json.dumps({'status':'APPROVED_EXACT_SET_SOURCE_AND_GUARDS_PUBLISHED_NOT_EXECUTED','authority':6189633644,'standingRule':6189658753,'activation':6189669837,'tests':test,'files':[{'path':p.relative_to(R).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in paths]},sort_keys=True,indent=2),encoding='utf-8');paths.append(out);names=[p.relative_to(R).as_posix() for p in paths]
assert len(names)==len(set(names))
for at in range(0,len(names),15):cmd('git','-c','core.autocrlf=false','-c','core.longpaths=true','add','-f','--',*names[at:at+15])
assert set(cmd('git','diff','--cached','--name-only').decode().splitlines())==set(names);tree=cmd('git','write-tree').decode().strip()
for p,n in zip(paths,names):assert raw(tree,n)==p.read_bytes(),n
cmd('git','commit','-m','Retain YY exact safe-set approval and guarded cleanup source');head=cmd('git','rev-parse','HEAD').decode().strip()
for p,n in zip(paths,names):assert raw(head,n)==p.read_bytes(),n
cmd('git','push','origin','audit/release-eb6de2e8');assert cmd('git','ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==head
print(json.dumps({'head':head,'verifiedOwnedBlobs':len(paths),'safeSetApproved':True,'standingRuleActive':True,'operatorExecuted':False,'localTests':10,'actualHostTests':10}))
