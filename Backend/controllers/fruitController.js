const db = require('../config/db');

// Add a fruit
exports.addFruit = async (req, res) => {
    try {
        const {
            fruit_name,
            description,
            status = 'active',
            small_price,
            medium_price,
            large_price
        } = req.body;

        const prices = [small_price, medium_price, large_price].map(Number);
        if (typeof fruit_name !== 'string' || fruit_name.trim() === '' ||
            [small_price, medium_price, large_price].some((price) => price == null) ||
            prices.some((price) => !Number.isFinite(price) || price < 0) ||
            !['active', 'inactive'].includes(status)) {
            return res.status(400).json({
                message: 'Provide a fruit name, non-negative prices for all sizes, and a valid status.'
            });
        }

        const sql = `INSERT INTO fruits
        (fruit_name, description, status, small_price, medium_price, large_price)
        VALUES (?, ?, ?, ?, ?, ?)`;

        const [result] = await db.query(sql, [
            fruit_name.trim(),
            description || null,
            status,
            ...prices
        ]);

        res.status(201).json({
            message: 'Fruit added successfully!',
            fruit_id: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A fruit with this name already exists.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to add fruit.' });
    }
};

// View all fruits
exports.getFruits = async (req, res) => {
    const { status = 'active' } = req.query;
    if (!['active', 'inactive', 'all'].includes(status)) {
        return res.status(400).json({ message: 'status must be active, inactive, or all.' });
    }

    try {
        const [fruits] = status === 'all'
            ? await db.query('SELECT * FROM fruits ORDER BY fruit_id DESC')
            : await db.query(
                'SELECT * FROM fruits WHERE status = ? ORDER BY fruit_id DESC',
                [status]
            );

        res.status(200).json(fruits);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve fruits.' });
    }
};

exports.updateFruit = async (req, res) => {
    const fruitId = Number(req.params.id);
    if (!Number.isInteger(fruitId) || fruitId < 1) {
        return res.status(400).json({ message: 'Fruit ID must be a positive integer.' });
    }

    const allowedFields = new Set([
        'fruit_name', 'description', 'status',
        'small_price', 'medium_price', 'large_price'
    ]);
    const fields = Object.keys(req.body);
    if (fields.length === 0 || fields.some((field) => !allowedFields.has(field))) {
        return res.status(400).json({ message: 'Provide valid fruit fields to update.' });
    }

    for (const [field, value] of Object.entries(req.body)) {
        if (field === 'fruit_name' &&
            (typeof value !== 'string' || value.trim() === '')) {
            return res.status(400).json({ message: 'fruit_name must be a non-empty string.' });
        }
        if (field === 'description' && value !== null && typeof value !== 'string') {
            return res.status(400).json({ message: 'description must be a string or null.' });
        }
        if (field === 'status' && !['active', 'inactive'].includes(value)) {
            return res.status(400).json({ message: 'status must be active or inactive.' });
        }
        if (field.endsWith('_price') &&
            (!Number.isFinite(Number(value)) || Number(value) < 0)) {
            return res.status(400).json({ message: `${field} must be a non-negative number.` });
        }
    }

    try {
        const [existing] = await db.query(
            'SELECT fruit_id FROM fruits WHERE fruit_id = ?',
            [fruitId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Fruit not found.' });
        }

        const updates = Object.entries(req.body);
        const assignments = updates.map(([field]) => `${field} = ?`).join(', ');
        const values = updates.map(([field, value]) => {
            if (field === 'fruit_name' && typeof value === 'string') return value.trim();
            if (field.endsWith('_price')) return Number(value);
            return value;
        });
        await db.query(
            `UPDATE fruits SET ${assignments} WHERE fruit_id = ?`,
            [...values, fruitId]
        );

        const [updated] = await db.query(
            'SELECT * FROM fruits WHERE fruit_id = ?',
            [fruitId]
        );
        res.status(200).json({ message: 'Fruit updated successfully.', fruit: updated[0] });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A fruit with this name already exists.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to update fruit.' });
    }
};

exports.deleteFruit = async (req, res) => {
    const fruitId = Number(req.params.id);
    if (!Number.isInteger(fruitId) || fruitId < 1) {
        return res.status(400).json({ message: 'Fruit ID must be a positive integer.' });
    }

    try {
        const [result] = await db.query(
            'DELETE FROM fruits WHERE fruit_id = ?',
            [fruitId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Fruit not found.' });
        }
        res.status(200).json({ message: 'Fruit deleted successfully.' });
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                message: 'Fruit cannot be deleted because stock or transaction history references it. Set its status to inactive instead.'
            });
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to delete fruit.' });
    }
};