const router = require('express').Router();
const c = require('../controllers/supplierController');
const v = require('../middleware/validate');

router.post('/', v.requireFields(['business_name', 'contact_person', 'phone', 'province', 'address']), v.phoneCheck('phone'), v.provinceCheck, v.coordsCheck, c.create);
router.get('/', c.getAll);
router.get('/compare', c.compare); // before /:id
router.get('/:id/trip', v.validId, c.trip);
router.get('/:id', v.validId, c.getOne);
router.put('/:id', v.validId, v.noEmptyBody, v.phoneCheck('phone'), v.provinceCheck, v.coordsCheck, c.update);
router.delete('/:id', v.validId, c.remove);
module.exports = router;
