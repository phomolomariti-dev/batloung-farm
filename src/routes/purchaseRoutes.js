const router = require('express').Router();
const c = require('../controllers/purchaseController');
const v = require('../middleware/validate');

router.post('/', v.requireFields(['supplier_id', 'items']), c.create);
router.get('/', c.getAll);
router.get('/restock-plan', c.restockPlan); // before /:id
router.get('/:id', v.validId, c.getOne);
module.exports = router;
