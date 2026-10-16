"""Collision-safe single-pass VALUE rendering, compiled before any transport."""
import re
def render(template,values,label):
    tokens=set(re.findall(r'\b[A-Z][A-Z0-9_]*_VALUE\b',template))
    if tokens!=set(values):raise RuntimeError('Remote template token inventory differs '+label)
    for name,value in values.items():
        if not re.fullmatch(r'[A-Z][A-Z0-9_]*_VALUE',name):raise RuntimeError('Invalid remote token')
        compile(repr(value),label+'-'+name,'eval')
    result=re.sub(r'\b[A-Z][A-Z0-9_]*_VALUE\b',lambda m:repr(values[m[0]]),template)
    compile(result,label,'exec')
    return result.encode()
