const express = require('express');
const {
    getTopFruits,
    getSalesRevenue,
    getTopVendor,
    getStockReport,
    getOutstandingBalances
} = require('../controllers/reportController');

const router = express.Router();
router.get('/top-fruits', getTopFruits);
router.get('/sales-revenue', getSalesRevenue);
router.get('/top-vendor', getTopVendor);
router.get('/stock', getStockReport);
router.get('/outstanding-balances', getOutstandingBalances);

module.exports = router;
