const express = require('express');
const { getPurchaseDetails } = require('../controllers/detailController');

const router = express.Router();
router.get('/', getPurchaseDetails);

module.exports = router;
