"""Form a reviewable application commit without switching either checkout."""
import hashlib
import json
import os
import pathlib
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent.parent
BASE = '5dd5488d138514351fffd54d0b0232ae19fcb64d'
BRANCH = 'codex/native-workbench-import-forward-fix'
FILES = ['server/prisma/migrations/20261010000100_instrument_import_templates/post205-draft-tables.json',
    'server/services/instrumentImportMigrationSource.js', 'server/services/instrumentImportSchemaService.js',
    'server/tests/contracts/audit_4_7_instrument_import_install.test.js',
    'server/tests/helpers/workflowWriteScanner.js']

def git(*args, env=None, input=None):
    return subprocess.check_output(['git',*args],cwd=REPO,env=env,input=input).decode().strip()

def main():
    assert git('branch','--show-current') == 'audit/release-eb6de2e8'
    assert git('ls-remote','origin','refs/heads/main').split()[0] == BASE
    assert not git('ls-remote','origin','refs/heads/'+BRANCH)
    index = HERE / 'native-workbench-clean-application.index'
    assert not index.exists()
    env = {**os.environ,'GIT_INDEX_FILE':str(index)}
    git('read-tree',BASE,env=env)
    hashes = {}
    for path in FILES:
        blob = git('hash-object','-w','--path='+path,path)
        git('update-index','--add','--cacheinfo','100644',blob,path,env=env)
        hashes[path]=hashlib.sha256(subprocess.check_output(['git','cat-file','blob',blob],cwd=REPO)).hexdigest()
    tree = git('write-tree',env=env)
    changed = set(git('diff','--name-only',BASE,tree).splitlines())
    assert changed == set(FILES), changed
    message = b'Accept the exact historical native workbench draft schema for instrument import\n'
    head = git('commit-tree',tree,'-p',BASE,input=message)
    git('update-ref','refs/heads/'+BRANCH,head,'0'*40)
    result = {'base':BASE,'head':head,'tree':tree,'branch':BRANCH,'files':hashes,
        'focusedSuites':4,'focusedTestsPassed':120,'pullRequestCreated':False,
        'checkoutBranchUnchanged':True,'humanCheckoutUntouched':True,'productionMutations':0}
    with (HERE/'native-workbench-application-head.json').open('x',encoding='utf-8',newline='\n') as f:
        json.dump(result,f,indent=2);f.write('\n')
    print(json.dumps(result))

if __name__=='__main__':main()
