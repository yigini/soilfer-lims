"""Prepare unique new-render50 guard wrapper without replaying closed44."""
import ast,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/backlog-resume-20261013'
text=(D/'verify-r2-cap44-local-host-once.py').read_text()
changes=[('WP/r2-cache-cap-acc15844-20261015','WP/r2-cache-cap-render-acc15844-20261015'),('source-local-host44-once','source-local-host50-once'),('assert count==44,count','assert count==50,count'),("b'Ran 44 tests'","b'Ran 50 tests'"),('suite.countTestCases()==44','suite.countTestCases()==50'),("host.get('guardTestCount')==44","host.get('guardTestCount')==50"),("'authority-source-preparation-once'/n","'source-preparation-once'/n"),("for n in ['build-receipt.json','image-inspect-original.json']","for n in ['build-receipt.json','image-inspect-original.json','failed-r2-upload-source.py','prior-r2-render-refusal.json']")]
for before,after in changes:
    assert text.count(before)==1,(before,text.count(before));text=text.replace(before,after)
ast.parse(text,feature_version=(3,9))
with (D/'verify-r2-render50-local-host-once.py').open('x',encoding='utf-8') as f:f.write(text)
