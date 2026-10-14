import datetime,json,subprocess
rows=[]
for argv in [['ctr','--version'],['ctr','content','--help'],['ctr','snapshots','--help'],['ctr','images','list','--help'],['docker','buildx','du','--help']]:
 try:
  result=subprocess.run(argv,capture_output=True,text=True,timeout=10)
  rows.append({'argv':argv,'exitCode':result.returncode,'stdout':result.stdout,'stderr':result.stderr})
 except subprocess.TimeoutExpired as e:rows.append({'argv':argv,'status':'INTERFACE_HELP_TIMEOUT','timeoutSeconds':10})
print(json.dumps({'status':'EXISTING_CLI_INTERFACE_HELP_ONLY','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':rows,'imageInspectCalls':0,'attributionCollectorsRun':0,'imageAdoptions':0,'newReceipts':0,'productionConnections':0,'remoteFilesWritten':0}))
