const db = require('../config/db');

// Add supplier
exports.addSupplier = async (req, res) => {
    try {
        const { business_name, contact_person, phone, province, address } = req.body;

        if (!business_name || !contact_person || !phone || !province) {
            return res.status(400).json({
                message: 'Please fill in all required fields.'
            });
        }

        const sql = `INSERT INTO suppliers
        (business_name, contact_person, phone, province, address)
        VALUES (?, ?, ?, ?, ?)`;

        const [result] = await db.query(sql, [
            business_name, contact_person, phone, province, address || null
        ]);

        res.status(201).json({
            message: 'Supplier added successfully!',
            supplier_id: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A supplier with this phone number already exists.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to add supplier.' });
    }
};

// View all suppliers
exports.getSuppliers = async (req, res) => {
    try {
        const [suppliers] = await db.query(
            'SELECT * FROM suppliers ORDER BY supplier_id DESC'
        );

        res.status(200).json(suppliers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve suppliers.' });
    }
};

exports.getSupplierById = async (req, res) => {
    const supplierId = Number(req.params.id);
    if (!Number.isInteger(supplierId) || supplierId < 1) {
        return res.status(400).json({ message: 'Supplier ID must be a positive integer.' });
    }

    try {
        const [suppliers] = await db.query(
            'SELECT * FROM suppliers WHERE supplier_id = ?',
            [supplierId]
        );
        if (suppliers.length === 0) {
            return res.status(404).json({ message: 'Supplier not found.' });
        }
        res.status(200).json(suppliers[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve supplier.' });
    }
};

exports.updateSupplier = async (req, res) => {
    const supplierId = Number(req.params.id);
    if (!Number.isInteger(supplierId) || supplierId < 1) {
        return res.status(400).json({ message: 'Supplier ID must be a positive integer.' });
    }

    const allowedFields = {
        business_name: true,
        contact_person: true,
        phone: true,
        province: true,
        address: true
    };
    const entries = Object.entries(req.body).filter(([field]) => allowedFields[field]);
    const hasUnknownFields = Object.keys(req.body).some((field) => !allowedFields[field]);
    if (entries.length === 0 || hasUnknownFields) {
        return res.status(400).json({ message: 'Provide valid supplier fields to update.' });
    }

    for (const [field, value] of entries) {
        if (field === 'address' && (value === null || typeof value === 'string')) {
            continue;
        }
        if (typeof value !== 'string' || value.trim() === '') {
            return res.status(400).json({ message: `${field} must be a non-empty string.` });
        }
    }

    try {
        const [existing] = await db.query(
            'SELECT supplier_id FROM suppliers WHERE supplier_id = ?',
            [supplierId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Supplier not found.' });
        }

        const columns = entries.map(([field]) => `${field} = ?`).join(', ');
        const values = entries.map(([field, value]) =>
            field === 'address' && typeof value === 'string' ? value.trim() :
                typeof value === 'string' ? value.trim() : value
        );
        await db.query(
            `UPDATE suppliers SET ${columns} WHERE supplier_id = ?`,
            [...values, supplierId]
        );

        const [updated] = await db.query(
            'SELECT * FROM suppliers WHERE supplier_id = ?',
            [supplierId]
        );
        res.status(200).json({
            message: 'Supplier updated successfully.',
            supplier: updated[0]
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A supplier with this phone number already exists.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to update supplier.' });
    }
};

exports.deleteSupplier = async (req, res) => {
    const supplierId = Number(req.params.id);
    if (!Number.isInteger(supplierId) || supplierId < 1) {
        return res.status(400).json({ message: 'Supplier ID must be a positive integer.' });
    }

    try {
        const [result] = await db.query(
            'DELETE FROM suppliers WHERE supplier_id = ?',
            [supplierId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Supplier not found.' });
        }
        res.status(200).json({ message: 'Supplier deleted successfully.' });
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                message: 'Supplier cannot be deleted because it has recorded purchases.'
            });
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to delete supplier.' });
    }
};