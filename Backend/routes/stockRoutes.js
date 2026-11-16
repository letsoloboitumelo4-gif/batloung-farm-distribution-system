const express = require('express');
const { getStock, getLowStock } = require('../controllers/stockController');

const router = express.Router();
router.get('/low-stock', getLowStock);
router.get('/', getStock);

module.exports = router;
