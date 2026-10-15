import pathlib
p=pathlib.Path('/opt/lims/releases/workflow-batch-startup-be837974-20261015T230000Z')
for a in [p,*p.parents]:assert not a.is_symlink(),'Root ancestor alias'
assert p.parent==pathlib.Path('/opt/lims/releases') and p.parent.resolve(strict=True)==p.parent and not p.exists()
p.mkdir(mode=0o700)
