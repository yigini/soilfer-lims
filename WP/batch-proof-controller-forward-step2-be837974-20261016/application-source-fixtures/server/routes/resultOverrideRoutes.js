const router=require('express').Router();
const {verifyToken,checkPermission}=require('../middleware/authMiddleware');
const controller=require('../controllers/resultOverrideController');
router.use(verifyToken);
router.get('/',controller.list);
router.post('/work-items/:workItemId',checkPermission('ENTER_RESULTS'),controller.request);
router.post('/:id/decision',checkPermission('APPROVE_RESULTS'),controller.decide);
router.post('/:id/cancel',controller.cancel);
module.exports=router;
