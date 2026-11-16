const db = require('../config/db');

const validSizes = new Set(['small', 'medium', 'large']);
const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const toCents = (value) => {
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const text = String(value);
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
    const amount = Number(text);
    if (!Number.isFinite(amount) || amount > 99999999.99) return null;
    return Math.round(amount * 100);
};
const isPositiveInteger = (value) =>
    (typeof value === 'number' || typeof value === 'string') &&
    /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

exports.getPurchases = async (req, res) => {
    try {
        const [purchases] = await db.query(
            `SELECT p.*, s.business_name
             FROM purchases p
             JOIN suppliers s ON s.supplier_id = p.supplier_id
             ORDER BY p.purchase_id DESC`
        );
        res.status(200).json(purchases);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve purchases.' });
    }
};

// Create a purchase and its line items together; received quantities increase stock.
exports.addPurchase = async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {};
    const { supplier_id, purchase_date, items } = body;
    if (!isPositiveInteger(supplier_id) || !isValidDate(purchase_date) ||
        !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            message: 'A valid supplier ID, purchase date (YYYY-MM-DD), and at least one item are required.'
        });
    }

    for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item) ||
            !isPositiveInteger(item.quantity) ||
            !isPositiveInteger(item.fruit_id) ||
            toCents(item.unit_cost) === null ||
            !validSizes.has(item.packaging_size)) {
            return res.status(400).json({
                message: 'Each item needs a valid fruit ID, package size, positive whole quantity, and unit cost with up to two decimals.'
            });
        }
    }

    const totalCents = items.reduce(
        (sum, item) => sum + Number(item.quantity) * toCents(item.unit_cost), 0
    );
    if (!Number.isSafeInteger(totalCents) || totalCents > 9999999999) {
        return res.status(400).json({ message: 'Purchase total exceeds the supported amount.' });
    }
    const total = (totalCents / 100).toFixed(2);
    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [suppliers] = await connection.query(
            'SELECT supplier_id FROM suppliers WHERE supplier_id = ?',
            [Number(supplier_id)]
        );
        if (suppliers.length === 0) {
            const error = new Error('Supplier not found.');
            error.statusCode = 404;
            throw error;
        }

        const [purchaseResult] = await connection.query(
            `INSERT INTO purchases (supplier_id, purchase_date, total_amount)
             VALUES (?, ?, ?)`,
            [Number(supplier_id), purchase_date, total]
        );

        for (const item of items) {
            const [fruits] = await connection.query(
                'SELECT fruit_id FROM fruits WHERE fruit_id = ?',
                [Number(item.fruit_id)]
            );
            if (fruits.length === 0) {
                const error = new Error(`Fruit ${item.fruit_id} not found.`);
                error.statusCode = 404;
                throw error;
            }

            await connection.query(
                `INSERT INTO purchase_details
                 (purchase_id, fruit_id, quantity, unit_cost, packaging_size)
                 VALUES (?, ?, ?, ?, ?)`,
                [purchaseResult.insertId, Number(item.fruit_id), Number(item.quantity),
                    (toCents(item.unit_cost) / 100).toFixed(2), item.packaging_size]
            );
            await connection.query(
                `INSERT INTO stock (fruit_id, packaging_size, available_quantity)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 available_quantity = available_quantity + VALUES(available_quantity)`,
                [Number(item.fruit_id), item.packaging_size, Number(item.quantity)]
            );
        }

        await connection.commit();
        res.status(201).json({
            message: 'Purchase recorded and stock updated.',
            purchase_id: purchaseResult.insertId,
            total_amount: total
        });
    } catch (error) {
        console.error(error);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Purchase rollback failed:', rollbackError);
            }
        }
        const statusCode = error.statusCode ||
            (error.code === 'ER_NO_REFERENCED_ROW_2' ? 404 : 500);
        res.status(statusCode).json({
            message: error.message === 'Supplier not found.' || error.message.endsWith('not found.')
                ? error.message
                : statusCode === 404
                    ? 'Supplier or fruit not found.'
                    : 'Failed to record purchase.'
        });
    } finally {
        if (connection) connection.release();
    }
};
