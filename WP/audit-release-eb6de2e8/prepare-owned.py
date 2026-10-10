"""Build then rehearse an owned copy; never invokes production execution."""
import pathlib, subprocess, sys

if __name__ == '__main__':
    root = pathlib.Path(__file__).resolve().parent
    assert root.parent == pathlib.Path('/opt/lims/releases')
    assert root.name.startswith('combined-eb6de2e8-')
    for script in ['build-candidate.py','rehearse.py']:
        subprocess.run([sys.executable,str(root/script)],check=True)
