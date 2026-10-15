import subprocess,json,hashlib,base64
u='lims-workflow-batch-forward-metadata-cde8c889-20261015t000500z'
raw=subprocess.check_output(['journalctl','-u',u,'--no-pager','-o','json']);assert len(raw)<=2097152
print(json.dumps({'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'base64':base64.b64encode(raw).decode()}))
