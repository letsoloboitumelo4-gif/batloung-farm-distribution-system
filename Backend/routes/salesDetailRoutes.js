const express = require('express');
const { getSalesDetails } = require('../controllers/detailController');

const router = express.Router();
router.get('/', getSalesDetails);

module.exports = router;
