from pathlib import Path
import subprocess
w=Path(__file__).resolve().parents[2];k=w/'WP/batch-release-kit-be837974-20261016'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()=='0e73be50b2d03886c8cb9ace109a77074d9087aa'
def replace(name,old,new):
 p=k/name;s=p.read_text(encoding='utf-8');assert s.count(old)==1,(name,old[:100]);p.write_text(s.replace(old,new),encoding='utf-8',newline='')
replace('kit_owned.py','writer_main_sites=None):','writer_main_sites=None,writer_statement_sites=None):')
replace('kit_owned.py','main_controls={};journal_results={}','main_controls={};journal_results={};main_results={}\n    statement_admissions={};statement_controls={};statement_attempted=set()')
replace('kit_owned.py','        p.mkdir(mode=0o700)\n',"""        statement_plan=None
        if writer_statement_sites and spec['label'] in writer_statement_sites:
            from kit_capture_statement import capture_statement_plan,recheck_capture_statement
            require(main_plan is not None and writer_plan is not None and disk is not None and callable(no_writers),
                'Statement content requires exact MAIN/journal source and held capacity')
            statement_controls[spec['label']]={}
            for name in ('writer-statement-admission.json','writer-statement-closure.json'):
                held=admit_evidence(p/name,8192,pending=True,reservation=True,future_directory=p)
                require(held is not None,'Statement controls require held ledger tickets before mkdir')
                statement_controls[spec['label']][name]=held
            no_writers();statement_plan=capture_statement_plan(spec,writer_plan,main_plan)
            disk.admit_copy(writer_statement_sites[spec['label']],p,statement_plan['layout'])
            no_writers();recheck_capture_statement(statement_plan,spec,writer_plan,main_plan)
        p.mkdir(mode=0o700)
""")
replace('kit_owned.py',"            main_admissions[spec['label']]=main_plan\n", """            main_admissions[spec['label']]=main_plan
        if statement_plan is not None:
            exclusive_record(p,'writer-statement-admission.json',statement_plan,require_directory_sync,
                held_admission=statement_controls[spec['label']]['writer-statement-admission.json'])
            statement_admissions[spec['label']]=statement_plan
""")
replace('kit_owned.py','            del main_admissions[label]\n',"""            main_results[label]=result;del main_admissions[label]
        if label in statement_admissions:
            from kit_capture_statement import statement_closure_fields
            require(label not in statement_attempted,'Statement content closure is consumed')
            statement_attempted.add(label)
            result=statement_closure_fields(statement_admissions[label],main_results[label],journal_results[label])
            exclusive_record(directory(spec),'writer-statement-closure.json',result,require_directory_sync,
                held_admission=statement_controls[label]['writer-statement-closure.json'])
            del statement_admissions[label]
""")
replace('kit_capture_owned.py','    from kit_capture_main import MAIN_SITES\n','    from kit_capture_main import MAIN_SITES\n    from kit_capture_statement import STATEMENT_SITES\n')
replace('kit_capture_owned.py','writer_main_sites=MAIN_SITES)','writer_main_sites=MAIN_SITES,writer_statement_sites=STATEMENT_SITES)')
replace('kit_capture_budget.py','from kit_copy_admission import copy_layout','from kit_copy_admission import copy_layout\nfrom kit_capture_statement import STATEMENT_SITES,STATEMENT_DB_COST,STATEMENT_FIXED,statement_disk_original,statement_disk_fields')
replace('kit_capture_budget.py',"'capture-206-native-main':0,'capture-214-native-main':0}","'capture-206-native-main':0,'capture-214-native-main':0,\n    **{STATEMENT_SITES[label]:cost for label,cost in STATEMENT_DB_COST.items()}}")
replace('kit_capture_budget.py',"        'capture-206-native-main':copy_layout([G206],0)['declaredAllocationBytes']}","        'capture-206-native-main':copy_layout([G206],0)['declaredAllocationBytes'],\n        STATEMENT_SITES['capture-206-prepare']:STATEMENT_FIXED['capture-206-prepare']}")
replace('kit_capture_budget.py',"        'capture-214-main-journal':copy_layout([JOURNAL_214_GROWTH_EXTRA],0)['declaredAllocationBytes']}","        'capture-214-main-journal':copy_layout([JOURNAL_214_GROWTH_EXTRA],0)['declaredAllocationBytes'],\n        STATEMENT_SITES['capture-214-prepare']:STATEMENT_FIXED['capture-214-prepare']}")
replace('kit_capture_budget.py',"'capture-206-native-main':1},SEAL_DIRECTORY_BYTES)","'capture-206-native-main':1,'capture-206-statement-journal':1},SEAL_DIRECTORY_BYTES)")
replace('kit_capture_budget.py',"'capture-214-native-main':1},SEAL_DIRECTORY_BYTES)","'capture-214-native-main':1,'capture-214-statement-journal':1},SEAL_DIRECTORY_BYTES)")
replace('kit_capture_budget.py','        site=MAIN_SITES.get(label)\n        if site is not None:self.claim(site)','        site=MAIN_SITES.get(label)\n        if site is not None:self.claim(site)\n        site=STATEMENT_SITES.get(label)\n        if site is not None:self.claim(site)')
replace('kit_capture_budget.py','        if site in MAIN_SITES.values():',"""        if site in STATEMENT_SITES.values():
            label=next(label for label,value in STATEMENT_SITES.items() if value==site)
            require(pathlib.Path(destination)==self.root/(label+'-retained-temp'),'Statement accounting directory differs')
            exclusive_record(self.root,statement_disk_original(label),statement_disk_fields(
                self.root,label,{'layout':plan},ceiling,CAPTURE_TABLE_SHA),self.sync)
            return
        if site in MAIN_SITES.values():""")
replace('kit_capture_review.py','from kit_capture_main import MAIN_ORIGINALS','from kit_capture_main import MAIN_ORIGINALS\nfrom kit_capture_statement import STATEMENT_ORIGINALS')
p=k/'kit_capture_review.py';s=p.read_text(encoding='utf-8');assert s.count('|MAIN_ORIGINALS')==2;s=s.replace('|MAIN_ORIGINALS','|MAIN_ORIGINALS|STATEMENT_ORIGINALS');p.write_text(s,encoding='utf-8',newline='')
replace('kit_capture_review.py','    verify_capture_main(files,CAPTURE_ROOT)\n','    verify_capture_main(files,CAPTURE_ROOT)\n    from kit_capture_statement import verify_capture_statements\n    verify_capture_statements(files,CAPTURE_ROOT)\n')
replace('kit_frozen.py',"    'kit_statement_journal.py','statement-journal-source.json',","    'kit_statement_journal.py','statement-journal-source.json',\n    'kit_capture_statement.py','capture-statement-journal-source.json',")
replace('kit_capture_launch.py',"        ('kit_capture_budget.py',['CAPTURE_DB_COST'", "        ('kit_statement_journal.py',['CAPTURE_STATEMENTS']),\n        ('kit_capture_statement.py',['STATEMENT_SITES','STATEMENT_DB_COST','STATEMENT_GROWTH','STATEMENT_FIXED']),\n        ('kit_capture_budget.py',['CAPTURE_DB_COST'")
replace('build_capture_stop_post.py',"    'kit_capture_budget.py':('CAPTURE_DB_COST'", "    'kit_statement_journal.py':('CAPTURE_STATEMENTS',),\n    'kit_capture_statement.py':('STATEMENT_SITES','STATEMENT_DB_COST','STATEMENT_GROWTH','STATEMENT_FIXED','statement_disk_original','STATEMENT_ORIGINALS'),\n    'kit_capture_budget.py':('CAPTURE_DB_COST'")
print('Prepared held conditional statement content graph; source only')
