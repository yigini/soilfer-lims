const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../../output/playwright/issue-214-responsive/charts.html');
const server=http.createServer((req,res)=>{if(req.url.split('?')[0]!=='/charts.html'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(file));});
server.listen(0,'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port+'/charts.html'));