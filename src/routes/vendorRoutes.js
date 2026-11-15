const router = require('express').Router();
const c = require('../controllers/vendorController');
const v = require('../middleware/validate');

router.post('/', v.requireFields(['vendor_name', 'phone_number', 'location']), v.phoneCheck('phone_number'), v.coordsCheck, c.create);
router.get('/', c.getAll);
// fixed paths must come before /:id
router.get('/search', c.search);
router.get('/balances', c.balances);
router.get('/map', c.map);
router.get('/route-plan', c.routePlan);
router.get('/:id', v.validId, c.getOne);
router.get('/:id/balance', v.validId, c.balanceOne);
router.get('/:id/delivery', v.validId, c.delivery);
router.put('/:id', v.validId, v.noEmptyBody, v.phoneCheck('phone_number'), v.coordsCheck, c.update);
module.exports = router;
