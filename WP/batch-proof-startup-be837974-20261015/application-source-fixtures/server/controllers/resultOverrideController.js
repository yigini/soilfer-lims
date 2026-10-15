const db=require('../prisma'),service=require('../services/resultOverrideService');
const refuse=(res,error)=>{const mapped=service.mapError(error);return res.status(mapped.statusCode||500).json({error:mapped.message,code:mapped.code});};
exports.list=async(req,res)=>{try{res.json(await service.list(db,req.user,{workItemId:req.query.workItemId}));}catch(error){refuse(res,error);}};
exports.request=async(req,res)=>{try{res.status(201).json(await service.request(db,req.params.workItemId,req.user,req.body));}catch(error){refuse(res,error);}};
exports.decide=async(req,res)=>{try{res.json(await service.decide(db,req.params.id,req.user,req.body));}catch(error){refuse(res,error);}};
exports.cancel=async(req,res)=>{try{res.json(await service.cancel(db,req.params.id,req.user,req.body));}catch(error){refuse(res,error);}};
