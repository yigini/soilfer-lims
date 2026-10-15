const router=require('express').Router();
const {verifyToken,checkPermission}=require('../middleware/authMiddleware');
const controller=require('../controllers/nonconformityController');
router.use(verifyToken);
router.get('/',checkPermission('VIEW_AUDIT'),controller.list);
router.post('/:id/transitions',checkPermission('APPROVE_RESULTS'),controller.transition);
module.exports=router;
