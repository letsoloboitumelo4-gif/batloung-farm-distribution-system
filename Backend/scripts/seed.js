require('dotenv').config();
const db = require('../config/db');

const suppliers = [
    {
        business_name: 'Highveld Fresh Produce',
        contact_person: 'Thabo Mokoena',
        phone: '+27 11 555 0142',
        province: 'Gauteng',
        address: 'Johannesburg, South Africa'
    },
    {
        business_name: 'Cape Orchard Cooperative',
        contact_person: 'Lerato Ndlovu',
        phone: '+27 21 555 0187',
        province: 'Western Cape',
        address: 'Paarl, Western Cape, South Africa'
    }
];

const fruits = [
    { fruit_name: 'Apples', description: 'Crisp red and green apples', small_price: 22, medium_price: 32, large_price: 45 },
    { fruit_name: 'Bananas', description: 'Fresh ripe bananas', small_price: 18, medium_price: 27, large_price: 38 },
    { fruit_name: 'Oranges', description: 'Juicy seasonal oranges', small_price: 18, medium_price: 28, large_price: 40 },
    { fruit_name: 'Mangoes', description: 'Sweet seasonal mangoes', small_price: 25, medium_price: 35, large_price: 50 },
    { fruit_name: 'Grapes', description: 'Seedless table grapes', small_price: 30, medium_price: 44, large_price: 62 }
];

const vendors = [
    { vendor_name: 'Maseru Market Stall 12', phone_number: '+266 6200 1201', location: 'Maseru Central Market', registration_date: '2026-10-02' },
    { vendor_name: 'Leribe Street Produce', phone_number: '+266 6200 1202', location: 'Hlotse, Leribe', registration_date: '2026-10-09' },
    { vendor_name: 'Roma Fresh Corner', phone_number: '+266 6200 1203', location: 'Roma, Maseru District', registration_date: '2026-10-16' }
];

const purchasePlans = [
    {
        supplier: 0,
        date: '2026-11-12',
        items: [
            { fruit: 'Apples', packaging_size: 'large', quantity: 10, unit_cost: 20 },
            { fruit: 'Bananas', packaging_size: 'medium', quantity: 15, unit_cost: 15 },
            { fruit: 'Oranges', packaging_size: 'small', quantity: 20, unit_cost: 10 }
        ]
    },
    {
        supplier: 1,
        date: '2026-11-13',
        items: [
            { fruit: 'Mangoes', packaging_size: 'medium', quantity: 8, unit_cost: 22 },
            { fruit: 'Grapes', packaging_size: 'small', quantity: 12, unit_cost: 18 },
            { fruit: 'Apples', packaging_size: 'small', quantity: 15, unit_cost: 12 }
        ]
    }
];

const salePlans = [
    {
        vendor: 0,
        date: '2026-11-14',
        payment_method: 'CASH',
        paid: 191,
        items: [
            { fruit: 'Apples', packaging_size: 'small', quantity: 5 },
            { fruit: 'Bananas', packaging_size: 'medium', quantity: 3 }
        ]
    },
    {
        vendor: 1,
        date: '2026-11-15',
        payment_method: 'MOBILE_MONEY',
        paid: 50,
        items: [
            { fruit: 'Oranges', packaging_size: 'small', quantity: 4 },
            { fruit: 'Mangoes', packaging_size: 'medium', quantity: 2 }
        ]
    }
];

async function insertRows(connection, table, columns, rows) {
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ?? (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES (${placeholders})`;
    const ids = [];
    for (const row of rows) {
        const [result] = await connection.query(sql, [table, ...columns.map((column) => row[column])]);
        ids.push(result.insertId);
    }
    return ids;
}

async function seed() {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const tables = ['suppliers', 'fruits', 'vendors', 'purchases', 'purchase_details', 'sales', 'sales_details', 'stock'];
        for (const table of tables) {
            const [rows] = await connection.query('SELECT COUNT(*) AS count FROM ??', [table]);
            if (Number(rows[0].count) > 0) {
                throw new Error(`The ${table} table is not empty. Refusing to add duplicate sample data; no records were changed.`);
            }
        }

        const supplierIds = await insertRows(connection, 'suppliers',
            ['business_name', 'contact_person', 'phone', 'province', 'address'], suppliers);
        const fruitIds = {};
        for (const fruit of fruits) {
            const [result] = await connection.query(
                `INSERT INTO fruits
                 (fruit_name, description, status, small_price, medium_price, large_price)
                 VALUES (?, ?, 'active', ?, ?, ?)`,
                [fruit.fruit_name, fruit.description, fruit.small_price, fruit.medium_price, fruit.large_price]
            );
            fruitIds[fruit.fruit_name] = result.insertId;
        }
        const vendorIds = await insertRows(connection, 'vendors',
            ['vendor_name', 'phone_number', 'location', 'registration_date'], vendors);

        for (const plan of purchasePlans) {
            const total = plan.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0).toFixed(2);
            const [purchase] = await connection.query(
                'INSERT INTO purchases (supplier_id, purchase_date, total_amount) VALUES (?, ?, ?)',
                [supplierIds[plan.supplier], plan.date, total]
            );
            for (const item of plan.items) {
                const fruitId = fruitIds[item.fruit];
                await connection.query(
                    `INSERT INTO purchase_details
                     (purchase_id, fruit_id, quantity, unit_cost, packaging_size)
                     VALUES (?, ?, ?, ?, ?)`,
                    [purchase.insertId, fruitId, item.quantity, item.unit_cost.toFixed(2), item.packaging_size]
                );
                await connection.query(
                    `INSERT INTO stock (fruit_id, packaging_size, available_quantity)
                     VALUES (?, ?, ?)
                     ON DUPLICATE KEY UPDATE available_quantity = available_quantity + VALUES(available_quantity)`,
                    [fruitId, item.packaging_size, item.quantity]
                );
            }
        }

        for (const plan of salePlans) {
            let totalCents = 0;
            const pricedItems = [];
            for (const item of plan.items) {
                const fruitId = fruitIds[item.fruit];
                const priceColumn = `${item.packaging_size}_price`;
                const [prices] = await connection.query(
                    `SELECT \`${priceColumn}\` AS unit_price FROM fruits WHERE fruit_id = ?`,
                    [fruitId]
                );
                const unitPriceCents = Math.round(Number(prices[0].unit_price) * 100);
                totalCents += unitPriceCents * item.quantity;
                pricedItems.push({ ...item, fruitId, unitPriceCents });
            }
            const paidCents = Math.round(plan.paid * 100);
            const status = paidCents === totalCents ? 'PAID' : paidCents > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
            const [sale] = await connection.query(
                `INSERT INTO sales
                 (vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [vendorIds[plan.vendor], plan.date, status, plan.payment_method,
                    (totalCents / 100).toFixed(2), (paidCents / 100).toFixed(2)]
            );
            for (const item of pricedItems) {
                const [stockRows] = await connection.query(
                    `SELECT available_quantity FROM stock
                     WHERE fruit_id = ? AND packaging_size = ? FOR UPDATE`,
                    [item.fruitId, item.packaging_size]
                );
                if (!stockRows.length || Number(stockRows[0].available_quantity) < item.quantity) {
                    throw new Error(`Sample sale would exceed ${item.fruit} ${item.packaging_size} stock.`);
                }
                await connection.query(
                    `INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price)
                     VALUES (?, ?, ?, ?, ?)`,
                    [sale.insertId, item.fruitId, item.packaging_size, item.quantity,
                        (item.unitPriceCents / 100).toFixed(2)]
                );
                await connection.query(
                    `UPDATE stock SET available_quantity = available_quantity - ?
                     WHERE fruit_id = ? AND packaging_size = ?`,
                    [item.quantity, item.fruitId, item.packaging_size]
                );
            }
        }

        await connection.commit();
        console.log('Sample data inserted successfully: 2 suppliers, 5 fruits, 3 vendors, 2 purchases, 2 sales, details, and package-size stock.');
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
        await db.end();
    }
}

seed().catch((error) => {
    console.error('Sample data was not inserted:', error.message);
    process.exitCode = 1;
});
