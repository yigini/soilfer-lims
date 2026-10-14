"""Prepare a new CLOSED-only exact297/head/run retainer; no CI dispatch or replay."""
from pathlib import Path
wp=Path(__file__).parent;target=wp/'retain-issue209-source-pr-ci-terminal-once.py';assert not target.exists()
s=(wp/'retain-issue214-source-pr-ci-terminal-once.py').read_text(encoding='utf8')
s=s.replace('issue214-scanner-call-form-source-pr-created','issue209-classified-source-pr-created').replace('issue214-source-pr-ci-open-boundary','issue209-source-pr-ci-open-boundary').replace('issue214-scanner-call-form-full','issue209-full-classified-ordinary').replace('issue214-ci-','issue209-ci-').replace('issue214-original.json','issue209-original.json').replace('/issues/214','/issues/209')
s=s.replace('==55','==122').replace('365','370').replace('5547','5642').replace('2026-10-13 #214','2026-10-14 #209').replace('#214 and206','#209,#214 and206').replace('control chart CI','order revision CI')
s=s.replace("assert opening['head']==head and opening['number']==number and opening['attempt']==1","assert opening['head']==head and opening['number']==number==297 and opening['attempt']==1\nassert identifier==38615738432 and head=='562cab2d24b25a500041a44abf384ffc4dbfad7c'")
compile(s,str(target),'exec');target.write_bytes(s.encode());print(target.name+' PREPARED/UNUSED')
