
const express = require('express');
const router = express.Router();

const {
    addFruit,
    getFruits,
    updateFruit,
    deleteFruit
} = require('../controllers/fruitController');

router.post('/', addFruit);
router.get('/', getFruits);
router.put('/:id', updateFruit);
router.delete('/:id', deleteFruit);

module.exports = router;
