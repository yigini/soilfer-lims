"""Retain closed42 bytes before tightening R2 preservation and unknown outcome guards."""
import json,pathlib
R=pathlib.Path(__file__).resolve().parents[2];S=R/'WP/r2-cache-cap-acc15844-20261015';D=S/'post42-preservation-refinement-before-bytes-once'
assert not D.exists();D.mkdir()
for name in ['r2_contract.py','r2_cache.py','prepare_r2.py','launch_r2.py','verify_r2.py']:
    with (D/name).open('xb') as f:f.write((S/name).read_bytes())
with (D/'reason.json').open('x',encoding='utf-8') as f:json.dump({'closed42BothPassed':True,'refinement':'Require known normal predecessor and qualified candidate in complete preserved inventories; cap-not-reached status must not say PASS; add real core unknown-prune receipt and 32-invocation plan bound guards. No cache operation.'},f)
