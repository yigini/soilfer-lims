"""One local, data-only verification of raw Git packaging and build source guards."""
import datetime, hashlib, io, json, pathlib, subprocess, sys, tarfile, traceback

REPO=pathlib.Path(__file__).resolve().parents[2]
SOURCE=REPO/'WP/batch-release-cde8-20261014'
DEST=SOURCE/'actual-cde8-raw-blob-archive-verification-once'
assert not DEST.exists(), 'Consumed verification; never replay or overwrite'
DEST.mkdir()
sys.path.insert(0,str(SOURCE))
from batch_build_contract import SOURCE_FILES, CANDIDATE, TREE, verify_archive_members
from prepare_batch_build import application_index, application_archive

def hashes():return {n:hashlib.sha256((SOURCE/n).read_bytes()).hexdigest() for n in sorted(SOURCE_FILES)}
def save(name,value):
    with (DEST/name).open('x',encoding='utf-8') as f:json.dump(value,f,indent=2)

before=hashes();started=datetime.datetime.now(datetime.UTC).isoformat()
save('command-original.json',{'startedUtc':started,'argv':sys.argv,'cwd':str(REPO),'archiveCommand':'application_index(); application_archive(index); verify_archive_members()','guardCommand':[sys.executable,'-B','verify_build_guards.py'],'sourceSha256Before':before,'productionConnections':0,'dockerOperations':0,'buildsLaunched':0,'archiveExtracted':False})
try:
    index=application_index();archive=application_archive(index)
    with (DEST/'archive-original.tar.gz').open('xb') as f:f.write(archive)
    save('source-index-original.json',index)
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        selected=verify_archive_members(bundle,index)
        selected_count=sum(not m.isdir() for m in selected)
    guards=subprocess.run([sys.executable,'-B','verify_build_guards.py'],cwd=SOURCE,capture_output=True)
    for name,raw in [('guard-stdout-original.log',guards.stdout),('guard-stderr-original.log',guards.stderr)]:
        with (DEST/name).open('xb') as f:f.write(raw)
    after=hashes()
    result={'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exitCode':guards.returncode,'head':CANDIDATE,'tree':TREE,'verifiedGitBlobCount':len(index['entries']),'selectedApplicationBlobCount':selected_count,'archiveBytes':len(archive),'archiveSha256':hashlib.sha256(archive).hexdigest(),'sourceSha256Before':before,'sourceSha256After':after,'sourceUnchanged':before==after,'productionConnections':0,'dockerOperations':0,'buildsLaunched':0,'archiveExtracted':False,'status':'PASS' if guards.returncode==0 and before==after else 'FAILED'}
    save('exit-original.json',result)
    assert guards.returncode==0 and before==after, 'Guard verification failed or source changed'
    print(json.dumps(result))
except BaseException:
    with (DEST/'verification-error-original.log').open('x',encoding='utf-8') as f:traceback.print_exc(file=f)
    raise
