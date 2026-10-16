'use strict';
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const http = require('http');
const db = new Database('/app/server/prisma/dev.db',{readonly:true,fileMustExist:true});
const principal = db.prepare("SELECT id,username,role,tokenVersion FROM User WHERE id=? AND role='SUPER_ADMIN' AND isActive=1 AND mustChangePassword=0").get(process.env.POSTFLIGHT_ADMIN_ID);
db.close();
if (!principal || !process.env.JWT_SECRET) throw new Error('Reviewed principal or authentication configuration unavailable');
const token = jwt.sign(principal,process.env.JWT_SECRET,{expiresIn:'2m'});
async function probe(index) {
    return new Promise((resolve,reject)=>{
        const started = performance.now();
        const deadline = index === 1 ? 30000 : 5000;
        let wallTimer;
        const request = http.get({hostname:'127.0.0.1',port:3000,path:'/api/reference-materials',headers:{Authorization:`Bearer ${token}`},timeout:deadline},response=>{
            let body = ''; response.on('data',chunk=>{body+=chunk});
            response.on('end',()=>{
                clearTimeout(wallTimer);
                const parsed = JSON.parse(body).data;
                console.log(JSON.stringify({probe:index,status:response.statusCode,durationMs:Math.round(performance.now()-started),rows:Array.isArray(parsed)?parsed.length:null}));
                if (response.statusCode !== 200 || !Array.isArray(parsed) || parsed.length !== 0 || performance.now()-started > deadline) reject(new Error('Reference catalogue readiness failed')); else resolve();
            });
            response.on('error',error=>request.destroy(error));
        });
        wallTimer = setTimeout(()=>request.destroy(new Error('Reference catalogue readiness deadline exceeded')),deadline);
        request.on('error',error=>{clearTimeout(wallTimer);reject(error)});
        request.on('timeout',()=>request.destroy(new Error('Reference catalogue readiness timeout')));
    });
}
(async()=>{for(let i=1;i<=3;i++) await probe(i)})().catch(error=>{console.error(error.message);process.exitCode=1});
