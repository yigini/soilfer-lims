'use strict';
const templates=require('../services/intakeTemplateService');
const {sendError}=require('../services/intakeCommandService');
exports.list=async(req,res)=>{try{return res.json(await templates.list(req.user,req.params.labId));}catch(err){return sendError(res,err);}};
exports.basic=async(req,res)=>{try{return res.json(await templates.saveBasic(req.user,{...req.body,labId:req.params.labId}));}catch(err){return sendError(res,err);}};
exports.bind=async(req,res)=>{try{return res.json(await templates.bind(req.user,{...req.body,labId:req.params.labId||req.body.labId,projectId:req.params.projectId||null}));}catch(err){return sendError(res,err);}};
exports.projectBindings=async(req,res)=>{try{
    const db=require('../prisma'),labId=req.user.role==='SUPER_ADMIN' ? req.query.labId||req.user.labId : req.user.labId;
    await templates.configureAuthority(req.user,labId,db,req.params.projectId);
    const bindings=await db.intakeTemplateBinding.findMany({where:{labId,projectId:req.params.projectId}});
    return res.json({bindings});
}catch(err){return sendError(res,err);}};
