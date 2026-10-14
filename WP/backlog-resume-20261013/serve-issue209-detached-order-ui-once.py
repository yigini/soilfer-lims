import datetime,functools,http.server,json,os
from pathlib import Path
root=Path(__file__).resolve().parents[2];dest=root/'output/playwright/issue-209-order-ui'
assert (dest/'orders.html').exists() and not (dest/'http-open-original.json').exists()
log=(dest/'http-stdout-original.log').open('x',encoding='utf8')
class Handler(http.server.SimpleHTTPRequestHandler):
 def log_message(self,fmt,*args):log.write(fmt%args+'\n');log.flush()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(dest)))
record={'openedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'pid':os.getpid(),'url':'http://127.0.0.1:'+str(server.server_port)+'/orders.html','synthetic':True,'productionOperations':0}
(dest/'http-open-original.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8');print(json.dumps(record),flush=True)
try:server.serve_forever()
except KeyboardInterrupt:pass
finally:server.server_close();log.close();(dest/'http-closed-original.json').write_text(json.dumps({'closedUtc':datetime.datetime.now(datetime.UTC).isoformat(),'exit':0})+'\n',encoding='utf8')
