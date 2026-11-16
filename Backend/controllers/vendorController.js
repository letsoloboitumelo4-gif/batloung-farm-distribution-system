const db = require('../config/db');

const isValidDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

exports.getVendors = async (req, res) => {
    try {
        const [vendors] = await db.query(
            'SELECT * FROM vendors ORDER BY vendor_id DESC'
        );
        res.status(200).json(vendors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to retrieve vendors.' });
    }
};

exports.addVendor = async (req, res) => {
    try {
        const { vendor_name, phone_number, location, registration_date } = req.body;
        if (typeof vendor_name !== 'string' || vendor_name.trim() === '' ||
            typeof phone_number !== 'string' || phone_number.trim() === '' ||
            !isValidDate(registration_date) ||
            (location !== undefined && location !== null && typeof location !== 'string')) {
            return res.status(400).json({
                message: 'Provide a vendor name, phone number, valid registration date (YYYY-MM-DD), and optional text location.'
            });
        }

        const [result] = await db.query(
            `INSERT INTO vendors (vendor_name, phone_number, location, registration_date)
             VALUES (?, ?, ?, ?)`,
            [vendor_name.trim(), phone_number.trim(), location?.trim() || null, registration_date]
        );
        res.status(201).json({
            message: 'Vendor added successfully.',
            vendor_id: result.insertId
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A vendor with this phone number already exists.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to add vendor.' });
    }
};

exports.searchVendors = async (req, res) => {
    const query = req.query.q;
    if (typeof query !== 'string' || query.trim() === '') {
        return res.status(400).json({ message: 'Provide a non-empty q search value.' });
    }

    try {
        const searchTerm = `%${query.trim()}%`;
        const [vendors] = await db.query(
            `SELECT * FROM vendors
             WHERE vendor_name LIKE ? OR phone_number LIKE ?
             ORDER BY vendor_name`,
            [searchTerm, searchTerm]
        );
        res.status(200).json(vendors);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to search vendors.' });
    }
};

exports.updateVendor = async (req, res) => {
    const vendorId = Number(req.params.id);
    if (!Number.isInteger(vendorId) || vendorId < 1) {
        return res.status(400).json({ message: 'Vendor ID must be a positive integer.' });
    }

    const allowedFields = new Set([
        'vendor_name', 'phone_number', 'location', 'registration_date'
    ]);
    const entries = Object.entries(req.body);
    if (entries.length === 0 || entries.some(([field]) => !allowedFields.has(field))) {
        return res.status(400).json({ message: 'Provide valid vendor fields to update.' });
    }

    for (const [field, value] of entries) {
        if (field === 'vendor_name' &&
            (typeof value !== 'string' || value.trim() === '')) {
            return res.status(400).json({ message: 'vendor_name must be a non-empty string.' });
        }
        if (field === 'phone_number' &&
            (typeof value !== 'string' || value.trim() === '')) {
            return res.status(400).json({ message: 'phone_number must be a non-empty string.' });
        }
        if (field === 'location' && value !== null && typeof value !== 'string') {
            return res.status(400).json({ message: 'location must be a string or null.' });
        }
        if (field === 'registration_date' && !isValidDate(value)) {
            return res.status(400).json({
                message: 'registration_date must be a valid date in YYYY-MM-DD format.'
            });
        }
    }

    try {
        const [existing] = await db.query(
            'SELECT vendor_id FROM vendors WHERE vendor_id = ?',
            [vendorId]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: 'Vendor not found.' });
        }

        const assignments = entries.map(([field]) => `${field} = ?`).join(', ');
        const values = entries.map(([field, value]) => {
            if (field === 'location' && value === null) return null;
            return typeof value === 'string' ? value.trim() : value;
        });
        await db.query(
            `UPDATE vendors SET ${assignments} WHERE vendor_id = ?`,
            [...values, vendorId]
        );
        const [updated] = await db.query(
            'SELECT * FROM vendors WHERE vendor_id = ?',
            [vendorId]
        );
        res.status(200).json({ message: 'Vendor updated successfully.', vendor: updated[0] });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'A vendor with this phone number already exists.' });
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to update vendor.' });
    }
};

exports.deleteVendor = async (req, res) => {
    const vendorId = Number(req.params.id);
    if (!Number.isInteger(vendorId) || vendorId < 1) {
        return res.status(400).json({ message: 'Vendor ID must be a positive integer.' });
    }

    try {
        const [result] = await db.query(
            'DELETE FROM vendors WHERE vendor_id = ?',
            [vendorId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Vendor not found.' });
        }
        res.status(200).json({ message: 'Vendor deleted successfully.' });
    } catch (error) {
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({
                message: 'Vendor cannot be deleted because sales history references this vendor.'
            });
        }
        console.error(error);
        res.status(500).json({ message: 'Failed to delete vendor.' });
    }
};
