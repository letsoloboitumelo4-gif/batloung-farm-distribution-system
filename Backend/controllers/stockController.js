const db = require('../config/db');

exports.getStock = async (req, res) => {
    try {
        const [stock] = await db.query(
            `SELECT st.stock_id, f.fruit_id, f.fruit_name,
                    sizes.packaging_size,
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
        res.status(500).json({ message: 'Failed to retrieve stock.' });
    }
};

exports.getLowStock = async (req, res) => {
    const threshold = req.query.threshold === undefined
        ? 10
        : Number(req.query.threshold);
    if (!Number.isInteger(threshold) || threshold < 0) {
        return res.status(400).json({
            message: 'threshold must be a non-negative whole number.'
        });
    }

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
             WHERE f.status = 'active'
               AND COALESCE(st.available_quantity, 0) <= ?
             ORDER BY available_quantity, f.fruit_name,
                      FIELD(sizes.packaging_size, 'small', 'medium', 'large')`,
            [threshold]
        );
        res.status(200).json(stock);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve low-stock items.' });
    }
};
