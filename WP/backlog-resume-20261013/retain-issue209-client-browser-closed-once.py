"""Retain the actual closed client/build and detached Chromium UI proofs once."""
import datetime,hashlib,json,re,subprocess,sys
from pathlib import Path
sys.stdout.reconfigure(encoding='utf8')
root=Path(__file__).resolve().parents[2];wp=Path(__file__).parent;dest=wp/'issue209-order-browser-closed';out=root/'output/playwright/issue-209-order-ui'
assert not dest.exists();dest.mkdir()
build=wp/'issue209-order-client-build-lint';summary=json.loads((build/'summary.json').read_bytes())
assert summary['sourceUnchanged'] and all(row['exitCode']==0 for row in summary['commands'])
before=json.loads((build/'source-before.json').read_bytes());assert before==json.loads((build/'source-after.json').read_bytes())
for path,digest in before.items():assert hashlib.sha256((root/path).read_bytes()).hexdigest()==digest,path
assert '14 problems (0 errors, 14 warnings)' in (build/'lint-stdout-original.log').read_text(encoding='utf8')
inputs=json.loads((out/'fixture-inputs.json').read_bytes())
assert inputs['sourceSha256']==hashlib.sha256((root/'client/src/components/sample/AnalysisUpdateModal.jsx').read_bytes()).hexdigest()
def result(name):
 text=(out/name).read_text(encoding='utf8');return json.JSONDecoder().raw_decode(text[text.index('{'):])[0]
desktop=result('desktop-layout-original.txt');ready=result('desktop-keyboard-ready-original.txt');saved=result('desktop-saved-payload-original.txt')
mobile=result('mobile-layout-original.txt');approved=result('mobile-approved-proof-original.txt')
assert desktop=={'width':1440,'documentWidth':1440,'saveDisabled':True}
assert ready=={'focused':'Save Changes','reason':'Reviewed complete soil panel','saveDisabled':False}
assert saved['requests']==[{'method':'PUT','url':'/api/samples/UI-ORDER-SAMPLE/analyses','input':{'analyses':['PH_H2O','SOC'],'analysisGroupIds':['UI-BUNDLE'],'reason':'Reviewed complete soil panel'}}]
assert mobile['width']==mobile['documentWidth']==390 and mobile['modalBounds']['x']>=0 and mobile['modalBounds']['right']<=390 and mobile['saveDisabled'] and mobile['notice']
assert approved=={'reason':'Reviewed amendment request','saveDisabled':True,'putCount':0}
assert "Browser 'issue209-order-ui' closed" in (out/'browser-closed-original.txt').read_text(encoding='utf8')
state=subprocess.run(['powershell','-NoProfile','-Command',"$taskServer=Get-Process -Id 44388 -ErrorAction SilentlyContinue; $taskListener=Get-NetTCPConnection -LocalPort 50625 -State Listen -ErrorAction SilentlyContinue; @{serverAbsent=($null -eq $taskServer); listenerAbsent=($null -eq $taskListener)} | ConvertTo-Json -Compress"],cwd=root,capture_output=True,check=True).stdout
assert json.loads(state)=={'serverAbsent':True,'listenerAbsent':True}
(dest/'server-after-stop-original.json').write_bytes(state)
copied={}
def copy(source,target):
 assert not target.exists();target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(source.read_bytes());copied[source.relative_to(root).as_posix()]=target.relative_to(root).as_posix()
references=set()
for source in out.iterdir():
 if source.is_file():
  copy(source,dest/'original-output'/source.name)
  if source.suffix=='.txt':
   for ref in re.findall(r'\.playwright-cli[\\/][^()\s#]+',source.read_text(encoding='utf8')):references.add(ref.replace('\\','/'))
for ref in references:
 source=root/ref
 if source.is_file():copy(source,dest/'actual-cli-snapshots'/source.name)
pins={p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for directory in [dest,build] for p in directory.rglob('*') if p.is_file()}
record={'retainedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'status':'CLOSED_ACTUAL_CHROMIUM_DETACHED_UI_PASS','synthetic':True,'productionOperations':0,
 'client':summary,'lintErrors':0,'baselineLintWarnings':14,'desktop':desktop,'keyboardReady':ready,'actualSavedRequests':saved['requests'],'mobile':mobile,'approved':approved,
 'browserClosed':True,'fixtureServerAbsent':True,'fixtureServerSessionExit':1,'fixtureServerFinallyRecordAbsent':not (out/'http-closed-original.json').exists(),
 'stopPrecision':'Ctrl-C session returned exit1; independently verified actual PID44388 and listener50625 absent; no restart/replay.',
 'initialNavigationRefusal':'CLI blocked file protocol after opening browser; existing isolated session navigated once to owned localhost fixture. Original refusal retained, not an application failure.',
 'console':'Initial processing navigation logged favicon404 and React development info; approved navigation has zero errors. No JS application exception observed.',
 'copiedOriginalFiles':copied,'rawFiles':pins,'fullServerVerified':False}
(dest/'index.json').write_bytes((json.dumps(record,indent=2)+'\n').encode())
lead='''## 2026-10-14 #209 actual detached Chromium UI and stock client build/lint PASS

Stock build/lint closed09:12:36.846425UTC/both0/sourceunchanged/0lintErrors14samebaselinewarnings. Actual production AnalysisUpdateModal JSX in isolated synthetic Chromium passed desktop1440x1050/mobile390x844: mandatoryreason blocksblankSave, actualkeyboardTab/Tab/Enter submitscompletePH_H2O+SOC+reason payload, approvednotice readable afterscroll/Save staysdisabled evenwithreason/0PUT. Documentwidth390/modal358withinviewport; screenshots visuallyinspected. OriginalHTML/inputs/screenshots/CLIoutputs/actualsnapshots+sourcepins retained issue209-order-browser-closed/index.json. Initialfileprotocol refused then existingownedbrowser navigatedlocalhost; favicon404 retainedhonestly, noapplicationJS exception. Browserclosed; serverCtrlCsessionexit1/nofinallyrecord but actualPID44388+listener50625 independentlyABSENT, neverrestarthelper. No runner/fixture/browser remains. Prior10/270 source regressionPASS cc90bf53/allfrozeninputs/exact370discovery; realDocker/fullserver stillrequired, NOTfull209PASS/PR/ready/audit. NEXTbroaderhistoricalownedfixturecontexts/fullordinaryverification. ActualCl2096163271808/standingcontinuation authorized; no productionconnectioncollectionoperation. PR296/main214CI COMPLETEgreen366/5566/fdf07fef;214+206undeployed/open/allhandoffs onceimmutable. Samewriter/humancontent/103noapply/historyguards hold.

'''
readmes=['WP/audit-release-eb6de2e8/README.md','WP/runtime-recovery-kobo/README.md']
for name in readmes:
 f=root/name;f.write_bytes(lead.encode()+f.read_bytes())
owned=list(pins)+[(dest/'index.json').relative_to(root).as_posix()]+readmes+[Path(__file__).relative_to(root).as_posix()]+[
 'WP/backlog-resume-20261013/'+name for name in ['verify-issue209-order-client-build-lint-once.py','prepare-issue209-detached-order-browser-fixture-once.cjs','serve-issue209-detached-order-ui-once.py']]
def git(*args):return subprocess.run(['git',*args],cwd=root,capture_output=True,check=True).stdout
assert git('branch','--show-current').strip()==b'audit/release-eb6de2e8' and not git('diff','--cached','--name-only').strip()
git('add','-f','--',*owned);assert set(git('diff','--cached','--name-only').decode().splitlines())<=set(owned)
for name,pin in pins.items():assert hashlib.sha256(git('show',':'+name)).hexdigest()==pin['sha256'],name
git('commit','-m','audit(209): retain actual Chromium UI and stock client build lint PASS')
retained=git('rev-parse','HEAD').decode().strip()
for name,pin in pins.items():assert hashlib.sha256(git('show',retained+':'+name)).hexdigest()==pin['sha256'],name
git('push','origin','HEAD:refs/heads/audit/release-eb6de2e8');assert git('ls-remote','origin','refs/heads/audit/release-eb6de2e8').decode().split()[0]==retained
print(json.dumps({'auditHead':retained,'verifiedRawBlobs':len(pins),'clientBuildLint':'PASS','actualDetachedChromium':'PASS','fullServerVerified':False,'productionOperations':0}))
