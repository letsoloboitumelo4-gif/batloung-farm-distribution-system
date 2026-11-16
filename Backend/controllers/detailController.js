const db = require('../config/db');

exports.getPurchaseDetails = async (req, res) => {
    const { purchase_id } = req.query;
    if (purchase_id !== undefined &&
        (!Number.isInteger(Number(purchase_id)) || Number(purchase_id) < 1)) {
        return res.status(400).json({ message: 'purchase_id must be a positive integer.' });
    }

    try {
        const sql = `SELECT pd.*, f.fruit_name
                     FROM purchase_details pd
                     JOIN fruits f ON f.fruit_id = pd.fruit_id
                     ${purchase_id === undefined ? '' : 'WHERE pd.purchase_id = ?'}
                     ORDER BY pd.purchase_detail_id DESC`;
        const [details] = purchase_id === undefined
            ? await db.query(sql)
            : await db.query(sql, [Number(purchase_id)]);
        res.status(200).json(details);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve purchase details.' });
    }
};

exports.getSalesDetails = async (req, res) => {
    const { sale_id } = req.query;
    if (sale_id !== undefined &&
        (!Number.isInteger(Number(sale_id)) || Number(sale_id) < 1)) {
        return res.status(400).json({ message: 'sale_id must be a positive integer.' });
    }

    try {
        const sql = `SELECT sd.*, f.fruit_name
                     FROM sales_details sd
                     JOIN fruits f ON f.fruit_id = sd.fruit_id
                     ${sale_id === undefined ? '' : 'WHERE sd.sale_id = ?'}
                     ORDER BY sd.sales_detail_id DESC`;
        const [details] = sale_id === undefined
            ? await db.query(sql)
            : await db.query(sql, [Number(sale_id)]);
        res.status(200).json(details);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve sales details.' });
    }
};
