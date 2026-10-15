"""Prepare a uniquely named final44 verifier; never replay closed42."""
import ast,pathlib
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/backlog-resume-20261013'
raw=(D/'verify-r2-cap42-local-host-once.py').read_text().replace('42','44')
ast.parse(raw,feature_version=(3,9))
with (D/'verify-r2-cap44-local-host-once.py').open('x',encoding='utf-8') as f:f.write(raw)
