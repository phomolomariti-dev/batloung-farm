const router = require('express').Router();
const c = require('../controllers/fruitController');
const v = require('../middleware/validate');

router.post('/', v.requireFields(['fruit_name']), c.create);
router.get('/', c.getAll);
router.get('/:id', v.validId, c.getOne);
router.put('/:id', v.validId, v.noEmptyBody, c.update);
module.exports = router;
