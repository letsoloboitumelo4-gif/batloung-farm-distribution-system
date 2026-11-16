
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const supplierRoutes = require('./routes/supplierRoutes');
const fruitRoutes = require('./routes/fruitRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const purchaseDetailRoutes = require('./routes/purchaseDetailRoutes');
const salesRoutes = require('./routes/salesRoutes');
const salesDetailRoutes = require('./routes/salesDetailRoutes');
const stockRoutes = require('./routes/stockRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const db = require('./config/db');

const app = express();

const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim()).filter(Boolean)
    : true;
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

// Homepage test
app.get('/', (req, res) => {
    res.send('Batloung Farm Backend is running!');
});

// Test MySQL connection
app.get('/api/db-test', async (req, res) => {
    try {
        const [result] = await db.query('SELECT 1 AS test');

        res.status(200).json({
            message: 'MySQL database connected successfully!',
            result
        });
    } catch (error) {
        console.error('Database error:', error.message);

        res.status(500).json({
            message: 'Database connection failed. Check your settings.'
        });
    }
});

app.use('/api/suppliers', supplierRoutes);
app.use('/api/fruits', fruitRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/purchase-details', purchaseDetailRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/sales-details', salesDetailRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/reports', reportRoutes);
app.use(notFound);
app.use(errorHandler);

// Start server even if database is temporarily unavailable
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});