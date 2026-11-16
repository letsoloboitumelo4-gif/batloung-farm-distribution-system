
const express = require('express');
const router = express.Router();

const {
    addFruit,
    getFruits,
    getFruitById,
    updateFruit,
    deleteFruit
} = require('../controllers/fruitController');

router.post('/', addFruit);
router.get('/', getFruits);
router.get('/:id', getFruitById);
router.put('/:id', updateFruit);
router.delete('/:id', deleteFruit);

module.exports = router;
