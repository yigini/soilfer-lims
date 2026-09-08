"""Build read-only source inventory and export the local appearance mockup."""
from pathlib import Path
import json, re, subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCE = ROOT / 'client/src'
rows = []
for file in sorted(SOURCE.rglob('*')):
    if file.suffix not in ('.jsx', '.js', '.css'):
        continue
    source = file.read_text(encoding='utf-8-sig')
    literals = len(re.findall(r'#[0-9a-fA-F]{3,8}\b', source))
    utilities = len(re.findall(r'(?<![\w-])(?:bg|text|border|ring|fill|stroke)-(?:white|black|gray-\d+|slate-\d+|blue-\d+)', source))
    if not (literals or utilities):
        continue
    samples = []
    for line_no, line in enumerate(source.splitlines(), 1):
        if re.search(r'#[0-9a-fA-F]{3,8}\b|bg-(?:white|slate-950|gray-950)|text-(?:gray|slate)-400', line):
            samples.append({'line': line_no, 'excerpt': line.strip()[:180]})
        if len(samples) == 3:
            break
    rows.append({'file': file.relative_to(ROOT).as_posix(), 'colorLiteralOccurrences': literals,
                 'paletteUtilityOccurrences': utilities, 'hasDarkSelector': 'dark:' in source or '.dark' in source,
                 'examples': samples})
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
(HERE / 'source-inventory.json').write_text(json.dumps({'revision': sha, 'note': 'Static candidates, not confirmed visual defects. Class counts include correctly paired light/dark utilities. Inspect each actual rendered state.', 'files': rows}, indent=2), encoding='utf-8')
lines = ['# Source appearance inventory', '', f'Reviewed source revision: `{sha}`.', '',
         f'{len(rows)} files contain candidate palette utilities or color literals. These are audit candidates, not a defect count. Correctly themed code and intentional paper/brand colors are included.', '',
         '| File | Color literals | Palette utilities | Dark selector present |', '|---|---:|---:|---|']
for r in sorted(rows, key=lambda x: x['colorLiteralOccurrences'] + x['paletteUtilityOccurrences'], reverse=True):
    lines.append(f"| `{r['file']}` | {r['colorLiteralOccurrences']} | {r['paletteUtilityOccurrences']} | {'Yes' if r['hasDarkSelector'] else 'No'} |")
lines += ['', '## Routable pages', '', 'Every route below needs a coverage row in the implementation evidence. Test redirects, public states and role restrictions too.', '']
app = (SOURCE / 'App.jsx').read_text(encoding='utf-8-sig')
for route in re.findall(r'<Route path="([^"]+)"', app):
    lines.append(f'- `{route}`')
(HERE / 'SOURCE_INVENTORY.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
fragment = HERE / 'appearance-preview.fragment.html'
if fragment.exists():
    contents = fragment.read_text(encoding='utf-8')
    (HERE / 'appearance-preview.html').write_text('<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SoilFER appearance proposal</title><style>body{margin:0;padding:16px;background:#e7eae8}*{box-sizing:border-box}</style></head><body>\n' + contents + '\n</body></html>\n', encoding='utf-8')
print(json.dumps({'revision': sha, 'candidateFiles': len(rows), 'exportsBuilt': fragment.exists()}))
