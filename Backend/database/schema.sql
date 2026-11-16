CREATE DATABASE IF NOT EXISTS batloung_farm
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE batloung_farm;

CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id INT NOT NULL AUTO_INCREMENT,
    business_name VARCHAR(100) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    province VARCHAR(50) NOT NULL,
    address VARCHAR(255) DEFAULT NULL,
    PRIMARY KEY (supplier_id),
    CONSTRAINT uq_suppliers_phone UNIQUE (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS fruits (
    fruit_id INT NOT NULL AUTO_INCREMENT,
    fruit_name VARCHAR(50) NOT NULL,
    description TEXT,
    status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    small_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    medium_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    large_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (fruit_id),
    CONSTRAINT uq_fruits_name UNIQUE (fruit_name),
    CONSTRAINT chk_fruits_prices_nonnegative
        CHECK (small_price >= 0 AND medium_price >= 0 AND large_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS vendors (
    vendor_id INT NOT NULL AUTO_INCREMENT,
    vendor_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    location VARCHAR(150) DEFAULT NULL,
    registration_date DATE NOT NULL,
    PRIMARY KEY (vendor_id),
    CONSTRAINT uq_vendors_phone UNIQUE (phone_number)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchases (
    purchase_id INT NOT NULL AUTO_INCREMENT,
    supplier_id INT NOT NULL,
    purchase_date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (purchase_id),
    KEY idx_purchases_supplier (supplier_id),
    CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id)
        REFERENCES suppliers (supplier_id),
    CONSTRAINT chk_purchases_total_nonnegative CHECK (total_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_details (
    purchase_detail_id INT NOT NULL AUTO_INCREMENT,
    purchase_id INT NOT NULL,
    fruit_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    packaging_size ENUM('small', 'medium', 'large') NOT NULL,
    PRIMARY KEY (purchase_detail_id),
    KEY idx_purchase_details_purchase (purchase_id),
    KEY idx_purchase_details_fruit (fruit_id),
    CONSTRAINT fk_purchase_details_purchase FOREIGN KEY (purchase_id)
        REFERENCES purchases (purchase_id),
    CONSTRAINT fk_purchase_details_fruit FOREIGN KEY (fruit_id)
        REFERENCES fruits (fruit_id),
    CONSTRAINT chk_purchase_details_values CHECK (quantity > 0 AND unit_cost >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales (
    sale_id INT NOT NULL AUTO_INCREMENT,
    vendor_id INT NOT NULL,
    sale_date DATE NOT NULL,
    payment_status ENUM('PAID', 'PARTIALLY_PAID', 'UNPAID') NOT NULL DEFAULT 'UNPAID',
    payment_method ENUM('CASH', 'MOBILE_MONEY', 'CREDIT') NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    PRIMARY KEY (sale_id),
    KEY idx_sales_vendor (vendor_id),
    CONSTRAINT fk_sales_vendor FOREIGN KEY (vendor_id)
        REFERENCES vendors (vendor_id),
    CONSTRAINT chk_sales_amounts
        CHECK (total_amount >= 0 AND amount_paid >= 0 AND amount_paid <= total_amount),
    CONSTRAINT chk_sales_payment_status CHECK (
        (payment_status = 'PAID' AND amount_paid = total_amount)
        OR (payment_status = 'PARTIALLY_PAID' AND amount_paid > 0 AND amount_paid < total_amount)
        OR (payment_status = 'UNPAID' AND amount_paid = 0)
    )
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sales_details (
    sales_detail_id INT NOT NULL AUTO_INCREMENT,
    sale_id INT NOT NULL,
    fruit_id INT NOT NULL,
    packaging_size ENUM('small', 'medium', 'large') NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (sales_detail_id),
    KEY idx_sales_details_sale (sale_id),
    KEY idx_sales_details_fruit (fruit_id),
    CONSTRAINT fk_sales_details_sale FOREIGN KEY (sale_id)
        REFERENCES sales (sale_id),
    CONSTRAINT fk_sales_details_fruit FOREIGN KEY (fruit_id)
        REFERENCES fruits (fruit_id),
    CONSTRAINT chk_sales_details_values CHECK (quantity > 0 AND unit_price >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock (
    stock_id INT NOT NULL AUTO_INCREMENT,
    fruit_id INT NOT NULL,
    packaging_size ENUM('small', 'medium', 'large') NOT NULL,
    available_quantity INT NOT NULL DEFAULT 0,
    PRIMARY KEY (stock_id),
    CONSTRAINT uq_stock_fruit_size UNIQUE (fruit_id, packaging_size),
    CONSTRAINT fk_stock_fruit FOREIGN KEY (fruit_id)
        REFERENCES fruits (fruit_id),
    CONSTRAINT chk_stock_quantity_nonnegative CHECK (available_quantity >= 0)
) ENGINE=InnoDB;
