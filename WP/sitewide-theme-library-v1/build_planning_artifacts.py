"""Build local design proposals and contrast evidence; never modifies application files."""
import json, pathlib, re, subprocess, datetime, html

folder = pathlib.Path(__file__).resolve().parent
repo = folder.parent.parent
def mode(canvas, surface, text, muted, primary, on_primary, sidebar, side_text, control):
    return dict(canvas=canvas, surface=surface, raised=surface, text=text, muted=muted,
                primary=primary, onPrimary=on_primary, sidebar=sidebar,
                sideText=side_text, control=control, link=primary, focus=primary)
def light(canvas, primary, sidebar):
    return mode(canvas, '#FFFFFF', '#253A32', '#58665E', primary, '#FFFFFF', sidebar, '#F3F6EF', '#757F78')
def dark(canvas, surface, primary, on_primary, sidebar):
    return mode(canvas, surface, '#F1F4F3', '#BBC7C2', primary, on_primary, sidebar, '#F1F4F3', '#909D97')

themes = [
 dict(id='soilfer-classic', name='SoilFER Classic', description='Keep the familiar SoilFER identity.',
      light=mode('#F5F3ED','#FFFFFF','#253A32','#58665E','#256348','#FFFFFF','#173F32','#F3F6EF','#829087'),
      dark=mode('#25282B','#2E3236','#F1F4F3','#BBC7C2','#91D2AF','#173127','#243932','#F1F4F3','#8C9B95')),
 dict(id='forest', name='Forest', description='Soft green and quiet surfaces for everyday soil work.',
      light=light('#F2F6F1','#245B3D','#1B392B'),
      dark=dark('#252B27','#303A33','#9DD7AA','#1B3324','#26382B')),
 dict(id='terra', name='Terra', description='Warm clay tones with clear white work surfaces.',
      light=light('#F7F2ED','#865039','#493226'),
      dark=dark('#2C2927','#3A3330','#E6B298','#342821','#3B2E27')),
 dict(id='mineral', name='Mineral', description='Neutral slate for tables, precision and instrument work.',
      light=light('#F2F4F6','#43556D','#283545'),
      dark=dark('#272B30','#333A42','#ABC2D7','#232F39','#293440')),
 dict(id='watershed', name='Watershed', description='Restrained teal, suitable for soil and future water analysis.',
      light=light('#F0F6F5','#166879','#173F44'),
      dark=dark('#252D2E','#303B3D','#89CFD2','#163739','#263C3F')),
 dict(id='nutrient', name='Nutrient', description='Muted olive inspired by soil fertility and nutrient work.',
      light=light('#F5F5ED','#596024','#373B23'),
      dark=dark('#2A2D25','#353B2E','#C4D48E','#30381C','#303A25')),
 dict(id='clear-contrast', name='Clear Contrast', description='Stronger edges and text with minimal decoration.',
      light=mode('#FFFFFF','#FFFFFF','#111111','#303030','#003E70','#FFFFFF','#182B3B','#FFFFFF','#404040'),
      dark=mode('#161616','#202020','#FFFFFF','#DEDEDE','#90C9FF','#102A40','#202020','#FFFFFF','#C0C0C0')),
]
themes[0]['light']['link'] = '#206477'
themes[0]['dark']['link'] = '#9CD4E1'
themes[0]['dark']['raised'] = '#34393C'
status = {
 'light': dict(success=('#246044','#EAF4ED'),warning=('#7F5710','#FCF2DA'),danger=('#9B3842','#FAEDEF'),info=('#206477','#E4F1F3')),
 'dark': dict(success=('#A5DABA','#31493B'),warning=('#F0D083','#494030'),danger=('#F3AFB5','#4A343B'),info=('#9CD4E1','#2E4149')),
}
def lum(s):
    rgb=[int(s[i:i+2],16)/255 for i in (1,3,5)]
    rgb=[v/12.92 if v<=0.04045 else ((v+0.055)/1.055)**2.4 for v in rgb]
    return sum(a*b for a,b in zip(rgb,(.2126,.7152,.0722)))
def contrast(a,b):
    a,b=sorted((lum(a),lum(b)),reverse=True)
    return (a+.05)/(b+.05)
checks=[]
for t in themes:
    for m in ['light','dark']:
        p=t[m]
        pairs=[]
        for bg in ['canvas','surface','raised']:
            for fg in ['text','muted','link']:
                pairs.append((fg+'/'+bg,p[fg],p[bg],7 if t['id']=='clear-contrast' else 4.5))
            for fg in ['control','focus']:
                pairs.append((fg+'/'+bg,p[fg],p[bg],3))
        pairs += [('button',p['onPrimary'],p['primary'],4.5),('sidebar',p['sideText'],p['sidebar'],4.5)]
        for name,(fg,bg) in status[m].items(): pairs.append(('status/'+name,fg,bg,4.5))
        for name,fg,bg,minimum in pairs:
            ratio=contrast(fg,bg)
            checks.append(dict(theme=t['id'],mode=m,pair=name,foreground=fg,background=bg,
                               ratio=round(ratio,4),minimum=minimum,passExact=ratio>=minimum))
payload=dict(status='PLANNING ONLY', description='Proposed core colours, not complete production token sets or accessibility certification.',
             themes=themes, semanticStatus=status)
(folder/'THEME-CONCEPTS.json').write_text(json.dumps(payload,indent=2)+'\n',encoding='utf8')
report=dict(status='PLANNING ONLY',calculation='WCAG sRGB relative luminance; threshold applied before rounding',
            checkedPairs=len(checks),passed=sum(x['passExact'] for x in checks),checks=checks,
            limitations=['Core opaque token pairs only. Rendered interaction states, alpha layers, charts, logos, focus adjacency and every screen require implementation QA.',
                         'No browser/device/application/production tests performed by this calculation.'])
(folder/'CONTRAST-CHECK.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
srcs=sorted(p for p in (repo/'client/src').rglob('*') if p.is_file() and p.suffix in ['.js','.jsx','.css','.ts','.tsx'])
inventory=[]
for p in srcs:
    s=p.read_text(encoding='utf8')
    literals=len(re.findall(r'#[0-9A-Fa-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(',s))
    utilities=len(re.findall(r'\b(?:bg|text|border|ring|fill|stroke)-(?:gray|slate|white|black|blue|green|red|amber|emerald|purple)',s))
    inventory.append(dict(path=str(p.relative_to(repo)).replace('\\','/'),literalColourCount=literals,
                          paletteUtilityCount=utilities,usesSemanticTokens=('sf-' in s or '--sf-' in s)))
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
routes=re.findall(r'<Route\s+path="([^"]+)"',(repo/'client/src/App.jsx').read_text(encoding='utf8'))
(folder/'SOURCE-INVENTORY.json').write_text(json.dumps(dict(sourceCommit=revision,inspectionDate='2026-09-30',
    note='Static source candidates; literals and utilities are not automatically defects. Inspect paper, domain colours and images separately.',
    files=inventory,routes=routes),indent=2)+'\n',encoding='utf8')

page=r'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SoilFER proposed theme library</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ed;color:#253a32;font:16px/1.55 system-ui,sans-serif}main{max-width:1320px;margin:auto;padding:clamp(18px,4vw,48px)}h1{font-size:clamp(26px,4vw,42px);margin:6px 0 12px;letter-spacing:-.025em}h2{margin:0;font-size:18px}p{max-width:850px}.note{display:inline-block;border:1px solid #829087;border-radius:8px;padding:6px 12px;background:#fff;font-size:14px}.controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:24px 0}button,select{font:inherit;min-height:48px;border:1px solid #757f78;border-radius:8px;padding:8px 16px;background:white;color:#253a32;cursor:pointer}button:focus-visible,select:focus-visible{outline:3px solid #256348;outline-offset:3px}button[aria-pressed=true]{background:#256348;color:white}#gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,325px),1fr));gap:24px}.theme{background:white;border:1px solid #829087;border-radius:12px;overflow:hidden}.caption{padding:20px}.caption p{margin:8px 0 0;font-size:14px}.demo{background:var(--canvas);color:var(--text);display:grid;grid-template-columns:78px minmax(0,1fr);min-height:290px;font-size:13px}.side{background:var(--sidebar);color:var(--sideText);padding:18px 12px;display:flex;flex-direction:column;gap:20px}.work{padding:18px;min-width:0}.card{border:1px solid var(--control);background:var(--surface);border-radius:8px;padding:12px;margin-top:14px}.muted{color:var(--muted)}.stats{display:flex;justify-content:space-between;gap:8px}.num{font-size:27px;font-weight:650}.row{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid var(--control);padding:9px 0}.badge{background:var(--successBg);color:var(--success);padding:2px 6px;border-radius:4px;font-size:12px}.primary{display:inline-block;background:var(--primary);color:var(--onPrimary);padding:8px 12px;border-radius:6px;font-weight:650;margin-top:12px}.swatches{display:flex;gap:8px;margin-top:14px}.swatch{width:28px;height:28px;border:1px solid #757F78;border-radius:50%}.footer{margin-top:32px;font-size:14px}a{color:#206477}.small{max-width:390px;margin:auto;width:100%}.small .demo{grid-template-columns:1fr}.small .side{flex-direction:row;justify-content:space-between;padding:10px 16px}.small .work{padding:16px}@media(max-width:400px){.demo{grid-template-columns:1fr}.side{flex-direction:row;gap:10px}.caption{padding:16px}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}@media(forced-colors:active){.theme,.card{border:1px solid CanvasText}.primary{border:1px solid ButtonText}.swatch{forced-color-adjust:none}}
</style><main><span class="note">Planning preview · fictional examples · no connection to the LIMS</span><h1>Theme choices for SoilFER</h1><p>Soil comes first. Choose a calm, readable identity for daily laboratory work. Each colour family has a Light and a Dark version; layout and the meaning of status colours stay consistent.</p><div class="controls"><button id="light" aria-pressed="true">Light</button><button id="dark" aria-pressed="false">Dark</button><label for="size">Preview width</label><select id="size"><option value="wide">Gallery</option><option value="small">Phone layout</option></select></div><div id="gallery"></div><p class="footer">These are proposed colour directions, not a finished theme selector. Computed core contrast checks pass, but full application, accessibility and real mobile QA remain required. <a href="IMPLEMENTATION-PLAN.md">Implementation plan</a> · <a href="CONTRAST-CHECK.json">Contrast evidence</a></p></main><script>
const themes=THEMES,status=STATUS;let mode='light';
function render(){document.querySelector('#gallery').innerHTML=themes.map(t=>{const p=t[mode];const css=Object.entries(p).map(([k,v])=>'--'+k+':'+v).join(';')+';--success:'+status[mode].success[0]+';--successBg:'+status[mode].success[1];return '<article class="theme"><div class="caption"><h2>'+t.name+'</h2><p>'+t.description+'</p></div><div class="demo" style="'+css+'"><aside class="side"><b>SF</b><span>Samples</span><span>Results</span><span>Lab</span></aside><div class="work"><b>Laboratory overview</b><div class="muted">Example soil laboratory</div><div class="card stats"><div><div class="muted">Samples</div><div class="num">128</div></div><div><div class="muted">Ready for review</div><div class="num">12</div></div></div><div class="card"><div class="row"><b>SL-2026-0142</b><span class="badge">Approved</span></div><div class="row"><span>Soil pH</span><b>6.8</b></div><span class="primary">Open sample</span></div></div></div><div class="caption swatches" aria-label="Proposed palette">'+['canvas','surface','primary','sidebar'].map(k=>'<span class="swatch" style="background:'+p[k]+'" title="'+k+' '+p[k]+'"></span>').join('')+'</div></article>'}).join('');document.querySelectorAll('.controls button').forEach(b=>b.setAttribute('aria-pressed',b.id===mode));}
document.querySelector('#light').onclick=()=>{mode='light';render()};document.querySelector('#dark').onclick=()=>{mode='dark';render()};document.querySelector('#size').onchange=e=>document.querySelector('#gallery').classList.toggle('small',e.target.value==='small');render();
</script></html>'''.replace('THEMES',json.dumps(themes)).replace('STATUS',json.dumps(status))
(folder/'THEME-PREVIEW.html').write_text(page,encoding='utf8')
failures=[x for x in checks if not x['passExact']]
print(json.dumps(dict(sourceCommit=revision,sourceFiles=len(srcs),routes=len(routes),themes=len(themes),pairs=len(checks),failures=failures),indent=2))
if failures: raise SystemExit(1)
