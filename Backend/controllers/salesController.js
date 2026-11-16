const db = require('../config/db');

const validSizes = new Set(['small', 'medium', 'large']);
const priceColumns = {
    small: 'small_price',
    medium: 'medium_price',
    large: 'large_price'
};
const paymentMethods = new Set(['CASH', 'MOBILE_MONEY', 'CREDIT']);
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

exports.getSales = async (req, res) => {
    try {
        const [sales] = await db.query(
            `SELECT s.*, v.vendor_name
             FROM sales s
             JOIN vendors v ON v.vendor_id = s.vendor_id
             ORDER BY s.sale_id DESC`
        );
        res.status(200).json(sales);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve sales.' });
    }
};

// Create a sale and its line items atomically; prices come from the fruits table.
exports.addSale = async (req, res) => {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {};
    const {
        vendor_id,
        sale_date,
        payment_method,
        amount_paid = 0,
        items
    } = body;
    const paidCents = toCents(amount_paid);

    if (!isPositiveInteger(vendor_id) || !isValidDate(sale_date) ||
        !paymentMethods.has(payment_method) || paidCents === null ||
        !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            message: 'A valid vendor ID, sale date (YYYY-MM-DD), payment method, non-negative amount paid, and at least one item are required.'
        });
    }

    for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item) ||
            !isPositiveInteger(item.fruit_id) ||
            !isPositiveInteger(item.quantity) ||
            !validSizes.has(item.packaging_size)) {
            return res.status(400).json({
                message: 'Each item needs a valid fruit ID, package size, and positive whole quantity.'
            });
        }
    }

    // Aggregate duplicate fruit/size lines so their combined quantity is checked
    // against stock before any sale rows or stock reductions are written.
    const requestedStock = new Map();
    for (const item of items) {
        const key = `${Number(item.fruit_id)}:${item.packaging_size}`;
        const quantity = (requestedStock.get(key)?.quantity || 0) + Number(item.quantity);
        if (!Number.isSafeInteger(quantity)) {
            return res.status(400).json({ message: 'Requested quantity is too large.' });
        }
        requestedStock.set(key, {
            fruitId: Number(item.fruit_id),
            size: item.packaging_size,
            quantity
        });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const [vendors] = await connection.query(
            'SELECT vendor_id FROM vendors WHERE vendor_id = ?',
            [Number(vendor_id)]
        );
        if (vendors.length === 0) {
            const error = new Error('Vendor not found.');
            error.statusCode = 404;
            throw error;
        }

        const pricedItems = [];
        let totalCents = 0;

        for (const item of items) {
            const fruitId = Number(item.fruit_id);
            const quantity = Number(item.quantity);
            const size = item.packaging_size;
            const [fruits] = await connection.query(
                `SELECT ${priceColumns[size]} AS unit_price
                 FROM fruits WHERE fruit_id = ? AND status = 'active'`,
                [fruitId]
            );
            if (fruits.length === 0) {
                const error = new Error(`Active fruit ${fruitId} not found.`);
                error.statusCode = 404;
                throw error;
            }

            const priceCents = toCents(fruits[0].unit_price);
            if (priceCents === null) {
                const error = new Error('Fruit has an invalid selling price.');
                error.statusCode = 400;
                throw error;
            }

            const [stocks] = await connection.query(
                `SELECT available_quantity FROM stock
                 WHERE fruit_id = ? AND packaging_size = ? FOR UPDATE`,
                [fruitId, size]
            );
            const requested = requestedStock.get(`${fruitId}:${size}`).quantity;
            if (stocks.length === 0 || Number(stocks[0].available_quantity) < requested) {
                const error = new Error(`Insufficient ${size} stock for fruit ${fruitId}.`);
                error.statusCode = 409;
                throw error;
            }

            totalCents += priceCents * quantity;
            if (!Number.isSafeInteger(totalCents) || totalCents > 9999999999) {
                const error = new Error('Sale total exceeds the supported amount.');
                error.statusCode = 400;
                throw error;
            }
            pricedItems.push({ fruitId, quantity, size, priceCents });
        }

        const total = (totalCents / 100).toFixed(2);
        if (paidCents > totalCents) {
            const error = new Error('Amount paid cannot exceed the sale total.');
            error.statusCode = 400;
            throw error;
        }
        const paymentStatus = paidCents === totalCents
            ? 'PAID'
            : paidCents > 0 ? 'PARTIALLY_PAID' : 'UNPAID';

        const [saleResult] = await connection.query(
            `INSERT INTO sales
             (vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [Number(vendor_id), sale_date, paymentStatus, payment_method, total, (paidCents / 100).toFixed(2)]
        );

        for (const item of pricedItems) {
            await connection.query(
                `INSERT INTO sales_details
                 (sale_id, fruit_id, packaging_size, quantity, unit_price)
                 VALUES (?, ?, ?, ?, ?)`,
                [saleResult.insertId, item.fruitId, item.size, item.quantity, (item.priceCents / 100).toFixed(2)]
            );
            await connection.query(
                `UPDATE stock SET available_quantity = available_quantity - ?
                 WHERE fruit_id = ? AND packaging_size = ?`,
                [item.quantity, item.fruitId, item.size]
            );
        }

        await connection.commit();
        res.status(201).json({
            message: 'Sale recorded and stock updated.',
            sale_id: saleResult.insertId,
            total_amount: total,
            amount_paid: (paidCents / 100).toFixed(2),
            payment_status: paymentStatus
        });
    } catch (error) {
        console.error(error);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Sale rollback failed:', rollbackError);
            }
        }
        const statusCode = error.statusCode ||
            (error.code === 'ER_NO_REFERENCED_ROW_2' ? 404 : 500);
        res.status(statusCode).json({
            message: error.statusCode ? error.message :
                statusCode === 404 ? 'Vendor or fruit not found.' : 'Failed to record sale.'
        });
    } finally {
        if (connection) connection.release();
    }
};

// Apply a later cash/mobile-money payment to an unpaid or partially paid sale.
exports.recordPayment = async (req, res) => {
    const saleId = Number(req.params.id);
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {};
    const amountCents = toCents(body.amount);
    const paymentMethod = body.payment_method;

    if (!isPositiveInteger(req.params.id) || amountCents === null || amountCents < 1 ||
        !['CASH', 'MOBILE_MONEY'].includes(paymentMethod)) {
        return res.status(400).json({
            message: 'Provide a valid sale ID, positive payment amount (up to two decimals), and CASH or MOBILE_MONEY method.'
        });
    }

    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();
        const [sales] = await connection.query(
            `SELECT total_amount, amount_paid
             FROM sales WHERE sale_id = ? FOR UPDATE`,
            [saleId]
        );
        if (sales.length === 0) {
            const error = new Error('Sale not found.');
            error.statusCode = 404;
            throw error;
        }

        const totalCents = toCents(sales[0].total_amount);
        const currentPaidCents = toCents(sales[0].amount_paid);
        if (totalCents === null || currentPaidCents === null || currentPaidCents > totalCents) {
            const error = new Error('Sale has invalid payment totals.');
            error.statusCode = 409;
            throw error;
        }
        if (amountCents > totalCents - currentPaidCents) {
            const error = new Error('Payment cannot exceed the outstanding balance.');
            error.statusCode = 400;
            throw error;
        }

        const updatedPaidCents = currentPaidCents + amountCents;
        const paymentStatus = updatedPaidCents === totalCents
            ? 'PAID'
            : 'PARTIALLY_PAID';
        await connection.query(
            `UPDATE sales
             SET amount_paid = ?, payment_status = ?, payment_method = ?
             WHERE sale_id = ?`,
            [(updatedPaidCents / 100).toFixed(2), paymentStatus, paymentMethod, saleId]
        );
        await connection.commit();

        res.status(200).json({
            message: 'Payment recorded successfully.',
            sale_id: saleId,
            amount_paid: (updatedPaidCents / 100).toFixed(2),
            outstanding_balance: ((totalCents - updatedPaidCents) / 100).toFixed(2),
            payment_status: paymentStatus,
            payment_method: paymentMethod
        });
    } catch (error) {
        console.error(error);
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Payment rollback failed:', rollbackError);
            }
        }
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({
            message: error.statusCode ? error.message : 'Failed to record payment.'
        });
    } finally {
        if (connection) connection.release();
    }
};
