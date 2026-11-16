require('dotenv').config();
const db = require('../config/db');

const tests = [
    ['unique fruit name', "UPDATE fruits SET fruit_name = 'Apples' WHERE fruit_id = 2", 'ER_DUP_ENTRY'],
    ['non-negative fruit price', 'UPDATE fruits SET small_price = -1 WHERE fruit_id = 1', 'ER_CHECK_CONSTRAINT_VIOLATED'],
    ['positive purchase quantity', 'UPDATE purchase_details SET quantity = 0 WHERE purchase_detail_id = 1', 'ER_CHECK_CONSTRAINT_VIOLATED'],
    ['consistent payment status', "UPDATE sales SET payment_status = 'PAID', amount_paid = 0 WHERE sale_id = 2", 'ER_CHECK_CONSTRAINT_VIOLATED'],
    ['non-negative stock', 'UPDATE stock SET available_quantity = -1 WHERE stock_id = 1', 'ER_CHECK_CONSTRAINT_VIOLATED']
];

async function checkConstraints() {
    const connection = await db.getConnection();
    let failed = false;
    try {
        await connection.beginTransaction();
        for (const [label, sql, expectedCode] of tests) {
            try {
                await connection.query(sql);
                console.error(`FAIL: ${label} was accepted.`);
                failed = true;
            } catch (error) {
                if (error.code !== expectedCode) {
                    console.error(`FAIL: ${label} returned ${error.code}; expected ${expectedCode}.`);
                    failed = true;
                } else {
                    console.log(`PASS: ${label} rejected (${error.code}).`);
                }
            }
        }
    } catch (error) {
        console.error('Integrity test failed:', error.message);
        failed = true;
    } finally {
        try {
            await connection.rollback();
        } catch (error) {
            console.error('Test rollback failed:', error.message);
            failed = true;
        }
        connection.release();
        await db.end();
    }
    if (failed) process.exitCode = 1;
}

checkConstraints();
