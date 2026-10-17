from pathlib import Path
k=Path(__file__).resolve().parents[2]/'WP/batch-release-kit-be837974-20261016'
def replace(name,old,new):
 p=k/name;s=p.read_text(encoding='utf-8');assert s.count(old)==1,(name,old[:80]);p.write_text(s.replace(old,new),encoding='utf-8',newline='')
replace('verify_kit_capture_science.py',"            main_plan=capture_main_plan(spec,journal_plan)\n", """            main_plan=capture_main_plan(spec,journal_plan)
            from kit_capture_statement import capture_statement_plan,STATEMENT_SITES
            statement_plan=capture_statement_plan(spec,journal_plan,main_plan)
            current.disk.admit_copy(STATEMENT_SITES[label],tmp,statement_plan['layout'])
""")
replace('verify_kit_capture_science.py',"            exclusive_record(tmp,'writer-main-admission.json',main_plan,False)","            exclusive_record(tmp,'writer-main-admission.json',main_plan,False)\n            exclusive_record(tmp,'writer-statement-admission.json',statement_plan,False)")
replace('verify_kit_capture_science.py',"            exclusive_record(tmp,'writer-main-closure.json',main_closure_fields(main_plan,journal_closed),False)","""            main_closed=main_closure_fields(main_plan,journal_closed)
            exclusive_record(tmp,'writer-main-closure.json',main_closed,False)
            from kit_capture_statement import statement_closure_fields
            exclusive_record(tmp,'writer-statement-closure.json',statement_closure_fields(statement_plan,main_closed,journal_closed),False)""")
replace('verify_kit_capture_journal.py',"        main_path.chmod(0o400);os.link(main_path,str(main_path)+'.pending')", """        main_path.chmod(0o400);os.link(main_path,str(main_path)+'.pending')
        from kit_capture_statement import statement_plan_fields
        statement=statement_plan_fields('capture-206-prepare',main,plan)
        statement_path=temp/'writer-statement-admission.json'
        statement_path.write_bytes(canonical(statement)+b'\\n');statement_path.chmod(0o400)
        os.link(statement_path,str(statement_path)+'.pending')""")
# Every synthetic package independently carries the additional controls, never
# a test bypass of their semantics.
p=k/'verify_kit_capture_review.py';s=p.read_text(encoding='utf-8')
needle="        files[main_disk_original(label)]=canonical(reservation)+b'\\n'\n";assert s.count(needle)==1
s=s.replace(needle,needle+"""        from kit_capture_statement import statement_plan_fields,statement_closure_fields,statement_disk_fields,statement_disk_original,STATEMENT_SITES
        statement=statement_plan_fields(label,main,journal)
        files[label+'-retained-temp/writer-statement-admission.json']=canonical(statement)+b'\\n'
        statement_closed=statement_closure_fields(statement,closed,exact_json(files[label+'-retained-temp/writer-journal-closure.json']))
        files[label+'-retained-temp/writer-statement-closure.json']=canonical(statement_closed)+b'\\n'
        ceiling=capture_ceiling(budget.db,budget.assets,label,STATEMENT_SITES[label])
        files[statement_disk_original(label)]=canonical(statement_disk_fields(CAPTURE_ROOT,label,statement,ceiling,CAPTURE_TABLE_SHA))+b'\\n'
""")
p.write_text(s,encoding='utf-8',newline='')
for p in k.glob('verify_kit_*.py'):
 s=p.read_text(encoding='utf-8');old=s
 s=s.replace("len(receipt['files']),34)","len(receipt['files']),40)").replace("['originalFileCount'],34)","['originalFileCount'],40)")
 s=s.replace('CAPTURE_TOTAL_DB_COPIES,1605)','CAPTURE_TOTAL_DB_COPIES,1641)').replace('CAPTURE_DB_EQUIVALENTS,2007)','CAPTURE_DB_EQUIVALENTS,2052)')
 if s!=old:p.write_text(s,encoding='utf-8',newline='')
replace('verify_kit_capture_main.py',"{'capture-206-main-journal','capture-206-native-main'}", "{'capture-206-main-journal','capture-206-native-main','capture-206-statement-journal'}")
replace('verify_kit_capture_main.py',"sum(row['fixedBytes'] for row in budgets.CAPTURE_TABLE),8118001664)","sum(row['fixedBytes'] for row in budgets.CAPTURE_TABLE),8118001664+sum(__import__('kit_capture_statement').STATEMENT_FIXED.values()))")
print('Prepared native scientific stand-ins and full synthetic package originals; no tests run')
