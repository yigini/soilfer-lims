const prisma=require('../prisma');
const service=require('../services/nonconformityService');
const {mapStateError}=require('../services/workflowStateRules');
function refuse(res,original) {
    const error=mapStateError(original);
    return res.status(error.statusCode||500).json({error:error.message,code:error.code||'NCR_FAILED'});
}
exports.list=async(req,res)=>{
    try{res.json({rows:await service.list(prisma,req.user,req.query)});}catch(error){refuse(res,error);}
};
exports.transition=async(req,res)=>{
    try{res.json(await service.transition(prisma,req.params.id,req.user,req.body));}catch(error){refuse(res,error);}
};
