require('dotenv').config();
const db = require('../config/db');

const preflightChecks = [
    {
        table: 'suppliers',
        query: `SELECT COUNT(*) AS count FROM suppliers
                WHERE business_name IS NULL OR TRIM(business_name) = ''
                   OR contact_person IS NULL OR TRIM(contact_person) = ''
                   OR phone IS NULL OR TRIM(phone) = ''
                   OR province IS NULL OR TRIM(province) = ''`,
        message: 'Supplier records contain missing required values.'
    },
    {
        table: 'suppliers',
        query: `SELECT COUNT(*) AS count FROM (
                    SELECT phone FROM suppliers GROUP BY phone HAVING COUNT(*) > 1
                ) duplicates`,
        message: 'Duplicate supplier phone numbers prevent adding the unique constraint.'
    },
    {
        table: 'fruits',
        query: `SELECT COUNT(*) AS count FROM (
                    SELECT fruit_name FROM fruits GROUP BY fruit_name HAVING COUNT(*) > 1
                ) duplicates`,
        message: 'Duplicate fruit names prevent adding the unique constraint.'
    },
    {
        table: 'fruits',
        query: `SELECT COUNT(*) AS count FROM fruits
                WHERE small_price < 0 OR medium_price < 0 OR large_price < 0`,
        message: 'Negative fruit prices prevent adding price constraints.'
    },
    {
        table: 'vendors',
        query: `SELECT COUNT(*) AS count FROM (
                    SELECT phone_number FROM vendors GROUP BY phone_number HAVING COUNT(*) > 1
                ) duplicates`,
        message: 'Duplicate vendor phone numbers prevent adding the unique constraint.'
    },
    {
        table: 'purchases',
        query: 'SELECT COUNT(*) AS count FROM purchases WHERE total_amount < 0',
        message: 'Negative purchase totals prevent adding the total constraint.'
    },
    {
        table: 'purchase_details',
        query: 'SELECT COUNT(*) AS count FROM purchase_details WHERE quantity <= 0 OR unit_cost < 0',
        message: 'Invalid purchase details prevent adding quantity/cost constraints.'
    },
    {
        table: 'sales',
        query: `SELECT COUNT(*) AS count FROM sales
                WHERE total_amount < 0 OR amount_paid < 0 OR amount_paid > total_amount
                   OR NOT (
                       (payment_status = 'PAID' AND amount_paid = total_amount)
                       OR (payment_status = 'PARTIALLY_PAID' AND amount_paid > 0 AND amount_paid < total_amount)
                       OR (payment_status = 'UNPAID' AND amount_paid = 0)
                   )`,
        message: 'Sale totals or payment statuses are inconsistent; fix those rows before applying constraints.'
    },
    {
        table: 'sales_details',
        query: 'SELECT COUNT(*) AS count FROM sales_details WHERE quantity <= 0 OR unit_price < 0',
        message: 'Invalid sales details prevent adding quantity/price constraints.'
    },
    {
        table: 'stock',
        query: 'SELECT COUNT(*) AS count FROM stock WHERE available_quantity < 0',
        message: 'Negative stock prevents adding the stock constraint.'
    }
];

const constraints = [
    ['suppliers', 'uq_suppliers_phone', 'UNIQUE (`phone`)'],
    ['fruits', 'uq_fruits_name', 'UNIQUE (`fruit_name`)'],
    ['fruits', 'chk_fruits_prices_nonnegative', 'CHECK (`small_price` >= 0 AND `medium_price` >= 0 AND `large_price` >= 0)'],
    ['vendors', 'uq_vendors_phone', 'UNIQUE (`phone_number`)'],
    ['purchases', 'chk_purchases_total_nonnegative', 'CHECK (`total_amount` >= 0)'],
    ['purchase_details', 'chk_purchase_details_values', 'CHECK (`quantity` > 0 AND `unit_cost` >= 0)'],
    ['sales', 'chk_sales_amounts', 'CHECK (`total_amount` >= 0 AND `amount_paid` >= 0 AND `amount_paid` <= `total_amount`)'],
    ['sales', 'chk_sales_payment_status', "CHECK ((`payment_status` = 'PAID' AND `amount_paid` = `total_amount`) OR (`payment_status` = 'PARTIALLY_PAID' AND `amount_paid` > 0 AND `amount_paid` < `total_amount`) OR (`payment_status` = 'UNPAID' AND `amount_paid` = 0))"],
    ['sales_details', 'chk_sales_details_values', 'CHECK (`quantity` > 0 AND `unit_price` >= 0)'],
    ['stock', 'chk_stock_quantity_nonnegative', 'CHECK (`available_quantity` >= 0)']
];

async function runMigration() {
    try {
        for (const check of preflightChecks) {
            const [rows] = await db.query(check.query);
            if (Number(rows[0].count) > 0) throw new Error(check.message);
        }

        for (const [table, name, definition] of constraints) {
            const [existing] = await db.query(
                `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                 WHERE CONSTRAINT_SCHEMA = DATABASE()
                   AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
                [table, name]
            );
            if (existing.length > 0) {
                console.log(`Already applied: ${table}.${name}`);
                continue;
            }
            await db.query(`ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\` ${definition}`);
            console.log(`Added: ${table}.${name}`);
        }
        console.log('Database integrity constraints are up to date.');
    } finally {
        await db.end();
    }
}

runMigration().catch((error) => {
    console.error('Integrity migration stopped:', error.message);
    process.exitCode = 1;
});
