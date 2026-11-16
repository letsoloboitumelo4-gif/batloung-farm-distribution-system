const express = require('express');
const {
	addVendor,
	getVendors,
	searchVendors,
	updateVendor,
	deleteVendor
} = require('../controllers/vendorController');

const router = express.Router();
router.get('/search', searchVendors);
router.get('/', getVendors);
router.post('/', addVendor);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

module.exports = router;
