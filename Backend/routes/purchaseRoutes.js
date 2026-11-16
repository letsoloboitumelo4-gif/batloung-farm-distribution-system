const express = require('express');
const { addPurchase, getPurchases } = require('../controllers/purchaseController');

const router = express.Router();
router.get('/', getPurchases);
router.post('/', addPurchase);

module.exports = router;
