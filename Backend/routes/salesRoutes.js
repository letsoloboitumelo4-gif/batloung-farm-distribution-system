const express = require('express');
const {
	addSale,
	getSales,
	recordPayment
} = require('../controllers/salesController');

const router = express.Router();
router.get('/', getSales);
router.post('/', addSale);
router.post('/:id/payments', recordPayment);

module.exports = router;
