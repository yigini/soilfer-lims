const {randomUUID}=require('node:crypto');
const bcrypt=require('bcryptjs');
const policyService=require('./policyService');

// #202: a per-user bench PIN unlocks a shared terminal and re-confirms Record.
// It never signs anyone in; the analyst's JWT session is unchanged. Lockout is
// a security control for the credential itself, not a laboratory policy.
const MAX_FAILURES=5,LOCK_MS=5*60*1000;
const fail=(statusCode,code,message)=>Object.assign(new Error(message),{statusCode,code});

async function setPin(db,actor,{password,pin}={}){
 if(typeof pin!=='string'||!/^\d{4,8}$/.test(pin))throw fail(400,'BENCH_PIN_FORMAT_INVALID','The PIN must be 4 to 8 digits.');
 const user=await db.user.findUnique({where:{id:String(actor.id)}});
 if(!user||typeof password!=='string'||!await bcrypt.compare(password,user.password))
  throw fail(403,'BENCH_PIN_PASSWORD_INVALID','Confirm your password to set a bench PIN.');
 const now=new Date(),pinHash=await bcrypt.hash(pin,10);
 await db.$transaction([
  db.userBenchCredential.upsert({where:{userId:user.id},create:{userId:user.id,pinHash,failedAttempts:0,lockedUntil:null,createdAt:now,updatedAt:now},
   update:{pinHash,failedAttempts:0,lockedUntil:null,updatedAt:now}}),
  db.auditLog.create({data:{id:randomUUID(),entity:'USER',entityId:user.id,action:'BENCH_PIN_SET',performedBy:user.username,
   performedByName:user.name||user.username,timestamp:now,details:JSON.stringify({userId:user.id})}})
 ]);
 return{pinSet:true};
}

async function verifyPin(db,actor,{pin}={}){
 const credential=await db.userBenchCredential.findUnique({where:{userId:String(actor.id)}});
 if(!credential)throw fail(409,'BENCH_PIN_NOT_SET','Set a bench PIN before using bench mode.');
 const now=new Date();
 if(credential.lockedUntil&&credential.lockedUntil>now)throw Object.assign(fail(423,'BENCH_PIN_LOCKED','Too many wrong PINs. Try again later.'),{lockedUntil:credential.lockedUntil});
 if(typeof pin==='string'&&await bcrypt.compare(pin,credential.pinHash)){
  if(credential.failedAttempts||credential.lockedUntil)await db.userBenchCredential.update({where:{userId:credential.userId},data:{failedAttempts:0,lockedUntil:null,updatedAt:now}});
  return{verified:true};
 }
 const failures=credential.failedAttempts+1,locked=failures>=MAX_FAILURES;
 await db.userBenchCredential.update({where:{userId:credential.userId},data:{failedAttempts:locked?0:failures,
  lockedUntil:locked?new Date(now.getTime()+LOCK_MS):null,updatedAt:now}});
 throw fail(locked?423:403,locked?'BENCH_PIN_LOCKED':'BENCH_PIN_INVALID',locked?'Too many wrong PINs. Try again later.':'The PIN is not correct.');
}

// Bench settings come from the analyst's lab policy (#219), never inline literals.
async function benchSettings(db,actor){
 const lab=await policyService.resolveLab(actor.labId,db);
 const read=key=>lab?policyService.get(lab.id,key,{db}):policyService.getStrict(key);
 return{idleLockMinutes:await read('bench.idleLockMinutes'),pinAtRecord:await read('bench.pinAtRecord'),
  pinSet:Boolean(await db.userBenchCredential.findUnique({where:{userId:String(actor.id)},select:{userId:true}}))};
}
module.exports={setPin,verifyPin,benchSettings,MAX_FAILURES};
