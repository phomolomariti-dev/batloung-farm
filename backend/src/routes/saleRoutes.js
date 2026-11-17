const router = require('express').Router();
const c = require('../controllers/saleController');
const v = require('../middleware/validate');

router.post('/', v.requireFields(['vendor_id', 'items']), c.create);
router.get('/', c.getAll);
router.get('/pending-deliveries', c.pending); // before /:id
router.get('/:id', v.validId, c.getOne);
router.patch('/:id/delivery', v.validId, v.requireFields(['status']), c.setDelivery);
router.post('/:id/payments', v.validId, v.requireFields(['method', 'amount']), c.addPayment);
module.exports = router;
