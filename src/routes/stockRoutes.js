const router = require('express').Router();
const c = require('../controllers/stockController');
const v = require('../middleware/validate');

router.get('/', c.getAll);
router.get('/low', c.getLow);
router.get('/fruit/:id', v.validId, c.getByFruit);
module.exports = router;
