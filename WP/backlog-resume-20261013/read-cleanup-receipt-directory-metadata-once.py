"""Explain the receipt-retainer inventory refusal using directory metadata only."""
import json,pathlib,subprocess
R=pathlib.Path(__file__).resolve().parents[2];D=R/'WP/yy-approved-safe-set-cleanup-20261015/receipt-directory-metadata-once';assert not D.exists();D.mkdir()
source="import json,pathlib,stat; p=pathlib.Path('/opt/lims/cleanup-receipts/yy-safe-set-6189633644'); print(json.dumps([{'name':q.name,'isFile':q.is_file(),'isDir':q.is_dir(),'isSymlink':q.is_symlink(),'bytes':q.lstat().st_size,'mode':stat.S_IMODE(q.lstat().st_mode)} for q in sorted(p.iterdir())]))"
(D/'source.py').write_text(source);p=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=15','root@46.19.33.37','python3','-B','-'],input=source.encode(),cwd=R,capture_output=True,timeout=30);(D/'stdout-original.json').write_bytes(p.stdout);(D/'stderr-original.log').write_bytes(p.stderr);assert p.returncode==0;print(p.stdout.decode())
