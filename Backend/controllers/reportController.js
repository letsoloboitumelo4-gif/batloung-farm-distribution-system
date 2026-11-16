const db = require('../config/db');

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

exports.getTopFruits = async (req, res) => {
    try {
        const [fruits] = await db.query(
            `SELECT f.fruit_id, f.fruit_name, SUM(sd.quantity) AS boxes_sold
             FROM sales_details sd
             JOIN sales s ON s.sale_id = sd.sale_id
             JOIN fruits f ON f.fruit_id = sd.fruit_id
             GROUP BY f.fruit_id, f.fruit_name
             ORDER BY boxes_sold DESC, f.fruit_name ASC
             LIMIT 5`
        );
        res.status(200).json(fruits);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve top-selling fruits.' });
    }
};

exports.getSalesRevenue = async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!isValidDate(start_date) || !isValidDate(end_date) || start_date > end_date) {
        return res.status(400).json({
            message: 'Provide valid start_date and end_date values (YYYY-MM-DD), with start_date no later than end_date.'
        });
    }

    try {
        const [rows] = await db.query(
            `SELECT ? AS start_date, ? AS end_date,
                    COALESCE(SUM(total_amount), 0.00) AS total_sales_revenue,
                    COUNT(*) AS sales_count
             FROM sales
             WHERE sale_date >= ? AND sale_date <= ?`,
            [start_date, end_date, start_date, end_date]
        );
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to calculate sales revenue.' });
    }
};

exports.getTopVendor = async (req, res) => {
    try {
        const [vendors] = await db.query(
            `SELECT v.vendor_id, v.vendor_name,
                    SUM(sd.quantity) AS boxes_purchased
             FROM vendors v
             JOIN sales s ON s.vendor_id = v.vendor_id
             JOIN sales_details sd ON sd.sale_id = s.sale_id
             GROUP BY v.vendor_id, v.vendor_name
             ORDER BY boxes_purchased DESC, v.vendor_name ASC
             LIMIT 1`
        );
        res.status(200).json(vendors[0] || null);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve the top vendor.' });
    }
};

exports.getStockReport = async (req, res) => {
    try {
        const [stock] = await db.query(
            `SELECT f.fruit_id, f.fruit_name, sizes.packaging_size,
                    COALESCE(st.available_quantity, 0) AS available_quantity
             FROM fruits f
             CROSS JOIN (
                 SELECT 'small' AS packaging_size
                 UNION ALL SELECT 'medium'
                 UNION ALL SELECT 'large'
             ) sizes
             LEFT JOIN stock st
               ON st.fruit_id = f.fruit_id
              AND st.packaging_size = sizes.packaging_size
             ORDER BY f.fruit_name,
                      FIELD(sizes.packaging_size, 'small', 'medium', 'large')`
        );
        res.status(200).json(stock);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve the stock report.' });
    }
};

exports.getOutstandingBalances = async (req, res) => {
    try {
        const [vendors] = await db.query(
            `SELECT v.vendor_id, v.vendor_name, v.phone_number,
                    COALESCE(SUM(GREATEST(s.total_amount - s.amount_paid, 0)), 0.00)
                        AS outstanding_balance
             FROM vendors v
             LEFT JOIN sales s ON s.vendor_id = v.vendor_id
             GROUP BY v.vendor_id, v.vendor_name, v.phone_number
             ORDER BY outstanding_balance DESC, v.vendor_name ASC`
        );
        res.status(200).json(vendors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve vendor balances.' });
    }
};
