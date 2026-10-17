from pathlib import Path
k=Path(r'C:/Users/yigin/.codex/worktrees/audit-qc-integration/soilfer-lims/WP/batch-release-kit-be837974-20261016')
def replace(name,old,new):
 p=k/name;s=p.read_text(encoding='utf8');assert s.count(old)==1,(name,old[:80]);p.write_text(s.replace(old,new),encoding='utf8',newline='')
replace('kit_capture_main.py',"    inventory=capture_native_inventory(label,observation['schema'])", "    require(all(row[3]<=profile['bound']['originalPages'] for row in observation['schema']['rows']),\n        'Schema root page exceeds the bound source database')\n    inventory=capture_native_inventory(label,observation['schema'])")
replace('kit_capture_main.py',"        'Exact original native MAIN admission required')\n    after=", "        'Exact original native MAIN admission required')\n    require(journal_closed.get('label')==plan['label'] and journal_closed.get('admissionSha256')==plan['journalAdmissionSha256'],\n        'Native MAIN closure must follow its exact journal transaction')\n    after=")
replace('verify_kit_capture_copy.py',"    writer.execute('CREATE TABLE _schema_migrations(id TEXT PRIMARY KEY)')\n    writer.executemany('INSERT INTO _schema_migrations VALUES(?)',[(str(n),) for n in range(39)])\n    for n in range(105):writer.execute('CREATE TABLE t'+str(n)+'(id INTEGER PRIMARY KEY,value TEXT)')", "    from kit_capture_native_inventory import RECEIPT_SQL\n    writer.execute(RECEIPT_SQL)\n    writer.executemany('INSERT INTO _schema_migrations(id) VALUES(?)',[(str(n),) for n in range(39)])\n    writer.execute('CREATE TABLE WorkAttempt(id TEXT PRIMARY KEY,aliquotId TEXT)')\n    for n in range(104):writer.execute('CREATE TABLE t'+str(n)+'(id INTEGER PRIMARY KEY,value TEXT)')")
replace('verify_kit_capture_science.py',"            journal_plan=capture_journal_plan(spec)\n            current.disk.admit_copy", "            journal_plan=capture_journal_plan(spec)\n            from kit_capture_main import capture_main_plan,MAIN_SITES\n            main_plan=capture_main_plan(spec,journal_plan)\n            current.disk.admit_copy(MAIN_SITES[label],target,main_plan['layout'])\n            current.disk.admit_copy")
replace('verify_kit_capture_science.py',"            exclusive_record(tmp,'writer-journal-admission.json',journal_plan,False)", "            exclusive_record(tmp,'writer-journal-admission.json',journal_plan,False)\n            exclusive_record(tmp,'writer-main-admission.json',main_plan,False)")
replace('verify_kit_capture_science.py',"                db.execute('INSERT INTO _schema_migrations VALUES(?)',(CHAIN[issue][1],))", "                db.execute('INSERT INTO _schema_migrations(id,details) VALUES(?,?)',(CHAIN[issue][1],'LOCAL scientific SQL stand-in'))")
replace('verify_kit_capture_science.py',"            exclusive_record(tmp,'writer-journal-closure.json',close_capture_journal(journal_plan),False)", "            journal_closed=close_capture_journal(journal_plan)\n            exclusive_record(tmp,'writer-journal-closure.json',journal_closed,False)\n            from kit_capture_main import main_closure_fields\n            exclusive_record(tmp,'writer-main-closure.json',main_closure_fields(main_plan,journal_closed),False)")
# Explicit synthetic package records: root pages and UTF-8 now agree with their
# declared page-count geometry; no private DB contents are invented as actual.
replace('verify_kit_capture_review.py',"header[18:20]=bytes([1,1]);header[24:28]", "header[18:20]=bytes([1,1]);header[21:24]=bytes([64,32,32]);header[56:60]=(1).to_bytes(4,'big');header[24:28]")
replace('verify_kit_capture_review.py',"    before=profile(1,'a');initial=", "    before=profile(128,'a');initial=")
replace('verify_kit_capture_review.py',"'dev.db':[7,inode,4096,1,1,stat.S_IFREG|0o600,1]", "'dev.db':[7,inode,128*4096,128,128,stat.S_IFREG|0o600,1]")
replace('verify_kit_capture_review.py',"enumerate(CAPTURE_JOURNAL_SITES.items(),2)", "enumerate(CAPTURE_JOURNAL_SITES.items(),129)")
replace('verify_kit_capture_review.py',"'b' if ordinal==2 else 'c'", "'b' if ordinal==129 else 'c'")
replace('verify_kit_capture_review.py',"'maximumBytes':(budget.db*JOURNAL_DB_COST*125+99)//100", "'maximumBytes':__import__('kit_capture_budget').capture_ceiling(budget.db,budget.assets,label,site)")
replace('verify_kit_capture_review.py',"    snapshot=exact_json(files['capture-snapshot-provenance.json'])\n    triple=", "    snapshot=exact_json(files['capture-snapshot-provenance.json'])\n    snapshot['backup']={'bytes':128*4096,'sha256':'a'*64}\n    initial['initialCloneByteIdentity']={'':snapshot['backup'],'-wal':None,'-shm':None}\n    triple=")
replace('verify_kit_capture_review.py',"        schema={'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,\n            'rows':[['table','fixture','fixture',2,'CREATE TABLE fixture(id TEXT)']]}", """        from kit_capture_native_inventory import RECEIPT_SQL,RECEIPT_INDEX
        rows=[['table','_schema_migrations','_schema_migrations',2,RECEIPT_SQL],
            ['index',RECEIPT_INDEX,'_schema_migrations',3,None],
            ['table','WorkAttempt','WorkAttempt',4,'CREATE TABLE WorkAttempt(id TEXT)']]
        rows += [['table','t'+str(n),'t'+str(n),5+n,'CREATE TABLE t'+str(n)+'(id TEXT)'] for n in range(104)]
        if issue!='initial':
            rows += [['table',name,name,109+n,'CREATE TABLE '+name+'(id TEXT)'] for n,name in enumerate(('SampleContainer','ContainerSequence'))]
        if issue=='214':
            rows += [['table',name,name,111+n,'CREATE TABLE '+name+'(id TEXT)'] for n,name in enumerate(('ControlLimitProposal','ControlLimitSet','QcReviewObligation','QcReviewResolution'))]
        schema={'version':1,'scope':'DECLARED_COMPLETE_SQLITE_SCHEMA','encoding':1,'rows':rows}""")
needle="    files['capture-clone-provenance.json']=canonical(initial)+b'\\n'\n"
p=k/'verify_kit_capture_review.py';s=p.read_text(encoding='utf8');assert s.count(needle)==2
last=s.rfind(needle);s=s[:last]+s[last:].replace(needle,needle+'''
    from kit_capture_main import MAIN_SITES,MAIN_SCHEMA,main_disk_original,main_plan_fields,main_closure_fields
    from kit_capture_budget import capture_ceiling
    for label,site in MAIN_SITES.items():
        original_name=MAIN_SCHEMA[label];observation=exact_json(files[original_name])
        original={'file':original_name,'bytes':len(files[original_name]),'sha256':sha(files[original_name])}
        journal=exact_json(files[label+'-retained-temp/writer-journal-admission.json'])
        main=main_plan_fields(label,observation,original,journal)
        files[label+'-retained-temp/writer-main-admission.json']=canonical(main)+b'\\n'
        closed=main_closure_fields(main,exact_json(files[label+'-retained-temp/writer-journal-closure.json']))
        files[label+'-retained-temp/writer-main-closure.json']=canonical(closed)+b'\\n'
        reservation={'site':site,'destination':str(target),'layout':main['layout'],
            'maximumBytes':capture_ceiling(budget.db,budget.assets,label,site),'beforeDestinationCreation':False,
            'beforeMainFileExtension':True,'stageTableSha256':CAPTURE_TABLE_SHA,'neverRetry':True,
            'sqliteTemporaryFilesAndGlobalFilesystemClosureClaimed':False,'mainFileLengthOrVfsPreallocationBounded':False}
        files[main_disk_original(label)]=canonical(reservation)+b'\\n'
''',1);p.write_text(s,encoding='utf8',newline='')
# New schema observations cross-check their declared table inventory too.
replace('kit_schema_collection.py',"    for issue in ('206','214'):\n        name='capture-schema-'", "    require(sum(row[0]=='table' and not row[1].startswith('sqlite_') for row in initial['schema']['rows'])==snapshot['tableCount'],\n        'Complete schema table inventory differs from initial logical provenance')\n    for issue in ('206','214'):\n        name='capture-schema-'")
replace('kit_schema_collection.py',"        preservation=exact_json(files['capture-'+issue+'-preservation.json'])\n", "        preservation=exact_json(files['capture-'+issue+'-preservation.json'])\n        require(sum(row[0]=='table' and not row[1].startswith('sqlite_') for row in value['schema']['rows'])==preservation['totalTables'],\n            'Complete schema table inventory differs from preparation preservation')\n")
for filename in ('verify_kit_capture_journal_package.py','verify_kit_capture_controller.py','verify_kit_schema_collection.py'):
 p=k/filename;s=p.read_text(encoding='utf8');s=s.replace("len(receipt['files']),28)","len(receipt['files']),34)").replace("['originalFileCount'],28)","['originalFileCount'],34)");p.write_text(s,encoding='utf8',newline='')
# Native preflight fixture: collect on a NEW owned reader, then create a NEW
# target from its detached backup. No retained target is queried by preflight.
p=k/'verify_kit_capture_journal.py';s=p.read_text(encoding='utf8')
start=s.index('        root=directory();target=database(root)',s.index('    def test_actual_local_native_engine')) if '    def test_actual_local_native_engine' in s else -1
if start<0:
 methods=[line for line in s.splitlines() if line.startswith('    def test_') and ('preflight' in line or 'engine' in line)];print('Native method names',methods)
else:
 s=s[:start]+s[start:].replace('        root=directory();target=database(root)', '''        root=directory();setup=root/'new-source';setup.mkdir();source=database(setup)
        from kit_capture_native_inventory import RECEIPT_SQL
        from retained_files import seal
        with sqlite3.connect(source) as db:
            db.execute(RECEIPT_SQL);db.execute('CREATE TABLE WorkAttempt(id TEXT)')
        backup,_=seal(root,'fresh-production-snapshot',source,lambda:None,schema_original='capture-schema-initial.json')
        parent=root/'scientific-database';parent.mkdir();target=parent/'dev.db';shutil.copyfile(backup,target);target.chmod(0o600)''',1)
 needle="        admission.write_bytes(canonical(plan)+b'\\n');admission.chmod(0o400);os.link(admission,str(admission)+'.pending')"
 assert s.count(needle)==1
 s=s.replace(needle,needle+'''
        from kit_capture_main import main_plan_fields
        from kit_contract import sha
        raw=(root/'capture-schema-initial.json').read_bytes();observation=json.loads(raw)
        main=main_plan_fields('capture-206-prepare',observation,{'file':'capture-schema-initial.json','bytes':len(raw),'sha256':sha(raw)},plan)
        main_path=temp/'writer-main-admission.json';main_path.write_bytes(canonical(main)+b'\\n')
        main_path.chmod(0o400);os.link(main_path,str(main_path)+'.pending')''')
 p.write_text(s,encoding='utf8',newline='')
print('Prepared actual LOCAL and explicit synthetic source-chain fixtures; no test executed')