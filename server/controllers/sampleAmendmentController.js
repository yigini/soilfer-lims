const prisma=require('../prisma');
const service=require('../services/sampleAmendmentCommandService');
const rules=require('../services/workflowStateRules');
function respondError(res,error){
 const mapped=rules.mapStateError(error);
 return res.status(mapped.statusCode||500).json({code:mapped.code||'AMENDMENT_COMMAND_FAILED',error:mapped.message});
}
exports.request=async(req,res)=>{
 try{return res.json(await service.command(prisma,{sampleId:req.params.id,actor:req.user,input:req.body,headerKey:req.headers['x-idempotency-key']}));}
 catch(error){return respondError(res,error);}
};
exports.authorise=async(req,res)=>{
 try{return res.json(await service.command(prisma,{sampleId:req.params.id,amendmentId:req.params.amendmentId,actor:req.user,
  input:req.body,headerKey:req.headers['x-idempotency-key'],authorise:true}));}
 catch(error){return respondError(res,error);}
};
exports.list=async(req,res)=>{
 try{return res.json(await service.listAmendments(prisma,req.params.id,req.user));}
 catch(error){return respondError(res,error);}
};
