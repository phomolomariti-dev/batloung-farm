-- =====================================================================
-- Batloung Farm Distribution System  |  MySQL 8.0.16+ (CHECK constraints)
-- =====================================================================
CREATE DATABASE IF NOT EXISTS batloung_farm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE batloung_farm;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS payments, prices, stock, sales_details, sales, purchase_details, purchases, vendors, fruits, suppliers;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE suppliers (
  supplier_id    INT AUTO_INCREMENT PRIMARY KEY,
  business_name  VARCHAR(120) NOT NULL UNIQUE,
  contact_person VARCHAR(100) NOT NULL,
  phone          VARCHAR(20)  NOT NULL UNIQUE,
  province       ENUM('Gauteng','Free State','KwaZulu-Natal','Western Cape','Eastern Cape',
                      'Limpopo','Mpumalanga','North West') NOT NULL,
  address        VARCHAR(255) NOT NULL,
  latitude       DECIMAL(9,6) NULL,           -- used for the purchase trip time estimate
  longitude      DECIMAL(9,6) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_sup_lat CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_sup_lng CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB;

CREATE TABLE fruits (
  fruit_id    INT AUTO_INCREMENT PRIMARY KEY,
  fruit_name  VARCHAR(60) NOT NULL UNIQUE,
  description VARCHAR(255),
  status      ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE'
) ENGINE=InnoDB;

CREATE TABLE vendors (
  vendor_id         INT AUTO_INCREMENT PRIMARY KEY,
  vendor_name       VARCHAR(100) NOT NULL,
  phone_number      VARCHAR(20)  NOT NULL UNIQUE,
  location          VARCHAR(150) NOT NULL,
  latitude          DECIMAL(9,6) NULL,           -- used for the map + delivery time estimate
  longitude         DECIMAL(9,6) NULL,
  registration_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  CONSTRAINT chk_vendor_lat CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_vendor_lng CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
) ENGINE=InnoDB;

CREATE TABLE purchases (
  purchase_id   INT AUTO_INCREMENT PRIMARY KEY,
  supplier_id   INT NOT NULL,
  purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT chk_purchase_total CHECK (total_amount >= 0),
  CONSTRAINT fk_purchase_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE purchase_details (
  purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_id        INT NOT NULL,
  fruit_id           INT NOT NULL,
  quantity           INT NOT NULL,
  unit_cost          DECIMAL(10,2) NOT NULL,
  packaging_size     ENUM('small','medium','large') NOT NULL,
  CONSTRAINT chk_pd_qty  CHECK (quantity > 0),
  CONSTRAINT chk_pd_cost CHECK (unit_cost > 0),
  CONSTRAINT fk_pd_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pd_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sales (
  sale_id        INT AUTO_INCREMENT PRIMARY KEY,
  vendor_id      INT NOT NULL,
  sale_date      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_status ENUM('PAID','PARTIALLY_PAID','UNPAID') NOT NULL DEFAULT 'UNPAID',
  payment_method ENUM('CASH','MOBILE_MONEY','CREDIT') NOT NULL DEFAULT 'CREDIT',
  total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid    DECIMAL(12,2) NOT NULL DEFAULT 0,
  delivery_status ENUM('PENDING','DELIVERED') NOT NULL DEFAULT 'PENDING',
  delivered_at   DATETIME NULL,
  CONSTRAINT chk_sale_total CHECK (total_amount >= 0),
  CONSTRAINT chk_sale_paid  CHECK (amount_paid >= 0 AND amount_paid <= total_amount),
  CONSTRAINT fk_sale_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sales_details (
  sales_detail_id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id         INT NOT NULL,
  fruit_id        INT NOT NULL,
  packaging_size  ENUM('small','medium','large') NOT NULL,
  quantity        INT NOT NULL,
  unit_price      DECIMAL(10,2) NOT NULL,
  CONSTRAINT chk_sd_qty   CHECK (quantity > 0),
  CONSTRAINT chk_sd_price CHECK (unit_price > 0),
  CONSTRAINT fk_sd_sale  FOREIGN KEY (sale_id)  REFERENCES sales(sale_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sd_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- One row per fruit AND packaging size => separate small / medium / large balances
CREATE TABLE stock (
  stock_id           INT AUTO_INCREMENT PRIMARY KEY,
  fruit_id           INT NOT NULL,
  packaging_size     ENUM('small','medium','large') NOT NULL,
  available_quantity INT NOT NULL DEFAULT 0,
  CONSTRAINT uq_stock_fruit_size UNIQUE (fruit_id, packaging_size),
  CONSTRAINT chk_stock_nonneg CHECK (available_quantity >= 0),   -- prevents negative stock
  CONSTRAINT fk_stock_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Extra: selling price per fruit per packaging size (each size has a different price)
CREATE TABLE prices (
  price_id       INT AUTO_INCREMENT PRIMARY KEY,
  fruit_id       INT NOT NULL,
  packaging_size ENUM('small','medium','large') NOT NULL,
  unit_price     DECIMAL(10,2) NOT NULL,
  CONSTRAINT uq_price_fruit_size UNIQUE (fruit_id, packaging_size),
  CONSTRAINT chk_price_pos CHECK (unit_price > 0),
  CONSTRAINT fk_price_fruit FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Extra: every payment received from a vendor (cash / mobile money). Credit = unpaid balance.
CREATE TABLE payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  sale_id    INT NOT NULL,
  method     ENUM('CASH','MOBILE_MONEY') NOT NULL,
  amount     DECIMAL(12,2) NOT NULL,
  paid_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_pay_amount CHECK (amount > 0),
  CONSTRAINT fk_pay_sale FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_sales_date   ON sales(sale_date);
CREATE INDEX idx_sales_vendor ON sales(vendor_id);

-- ============================ SAMPLE DATA ============================
INSERT INTO suppliers (business_name, contact_person, phone, province, address, latitude, longitude) VALUES
('Joburg Fresh Produce',      'Thabo Mokoena',   '+27 11 555 0101', 'Gauteng',       '12 Market Street, City Deep, Johannesburg',  -26.204100, 28.047300),
('Free State Orchards',       'Anele Dlamini',   '+27 51 555 0102', 'Free State',    'Farm 7, Ficksburg Road, Bloemfontein',       -29.085200, 26.159600),
('Natal Tropical Farms',      'Sipho Nkosi',     '+27 31 555 0103', 'KwaZulu-Natal', '45 Umhlanga Rd, Durban',                     -29.858700, 31.021800),
('Cape Valley Growers',       'Lindiwe Jacobs',  '+27 21 555 0104', 'Western Cape',  'Paarl Valley Estate, Paarl',                 -33.734200, 18.962100),
('Eastern Cape Citrus Co',    'Zola Mbeki',      '+27 41 555 0105', 'Eastern Cape',  'Patensie Citrus Hub, Gqeberha',              -33.960800, 25.602200),
('Limpopo Mango Collective',  'Rudzani Mulaudzi','+27 15 555 0106', 'Limpopo',       'Tzaneen Farm Block 3, Tzaneen',              -23.833200, 30.163500),
('Lowveld Fruit Traders',     'Nomsa Khumalo',   '+27 13 555 0107', 'Mpumalanga',    'Nelspruit Fresh Market, Mbombela',           -25.475300, 30.969400),
('North West Fruit Supply',   'Kabelo Molefe',   '+27 18 555 0108', 'North West',    '9 Industrial Rd, Potchefstroom',             -26.714500, 27.097000);

INSERT INTO fruits (fruit_name, description, status) VALUES
('Apples',   'Crisp red and green apples',        'ACTIVE'),
('Bananas',  'Sweet ripe bananas',                'ACTIVE'),
('Oranges',  'Juicy Valencia oranges',            'ACTIVE'),
('Mangoes',  'Tropical sweet mangoes',            'ACTIVE'),
('Grapes',   'Seedless table grapes',             'ACTIVE');

-- Coordinates are approximate town centres in Lesotho
INSERT INTO vendors (vendor_name, phone_number, location, latitude, longitude, registration_date) VALUES
('Mpho Letsie',        '+266 5800 1001', 'Maseru CBD Taxi Rank',   -29.310000, 27.478000, '2026-01-12'),
('Palesa Mokhele',     '+266 5800 1002', 'Thetsane, Maseru',       -29.340000, 27.505000, '2026-02-03'),
('Tumelo Ramokoatsi',  '+266 5800 1003', 'Teyateyaneng Main Road', -29.150000, 27.740000, '2026-02-20'),
('Lineo Thabane',      '+266 5800 1004', 'Roma Village',           -29.450000, 27.717000, '2026-03-15'),
('Retselisitsoe Mots', '+266 5800 1005', 'Mafeteng Bus Stop',      -29.816000, 27.240000, '2026-04-01'),
('Nthabiseng Phoofolo','+266 5800 1006', 'Maputsoe Border Post',   -28.884000, 27.900000, '2026-05-09');

INSERT INTO prices (fruit_id, packaging_size, unit_price) VALUES
(1,'small',60),(1,'medium',90),(1,'large',120),
(2,'small',45),(2,'medium',70),(2,'large',100),
(3,'small',50),(3,'medium',75),(3,'large',105),
(4,'small',80),(4,'medium',115),(4,'large',150),
(5,'small',100),(5,'medium',150),(5,'large',200);

INSERT INTO purchases (purchase_id, supplier_id, purchase_date, total_amount) VALUES
(1, 1, '2026-10-01 08:30:00', 11750.00),
(2, 6, '2026-10-05 09:15:00', 15950.00),
(3, 2, '2026-10-14 09:00:00',  1480.00),
(4, 4, '2026-10-16 08:00:00',  1300.00),
(5, 3, '2026-10-18 10:00:00',  1390.00);

INSERT INTO purchase_details (purchase_id, fruit_id, quantity, unit_cost, packaging_size) VALUES
(1,1,40,45,'small'),(1,1,30,70,'medium'),(1,1,20,95,'large'),
(1,2,50,35,'small'),(1,2,40,55,'medium'),(1,2,25,80,'large'),
(2,3,40,40,'small'),(2,3,30,60,'medium'),(2,3,20,85,'large'),
(2,4,30,60,'small'),(2,4,25,90,'medium'),(2,4,15,120,'large'),
(2,5,20,80,'small'),(2,5,15,120,'medium'),(2,5,10,160,'large'),
(3,1,10,48,'small'),(3,1,10,100,'large'),
(4,1,10,42,'small'),(4,1,10,88,'large'),
(5,2,15,50,'medium'),(5,2,20,32,'small');

INSERT INTO sales (sale_id, vendor_id, sale_date, payment_status, payment_method, total_amount, amount_paid, delivery_status, delivered_at) VALUES
(1, 1, '2026-10-08 10:00:00', 'PAID',           'CASH',         1660.00, 1660.00, 'DELIVERED', '2026-10-08 12:00:00'),
(2, 2, '2026-10-10 11:30:00', 'PARTIALLY_PAID', 'MOBILE_MONEY', 2800.00, 1000.00, 'DELIVERED', '2026-10-10 13:10:00'),
(3, 3, '2026-10-12 14:45:00', 'UNPAID',         'CREDIT',       2500.00,    0.00, 'PENDING',   NULL),
(4, 4, '2026-11-12 09:30:00', 'PAID',           'MOBILE_MONEY', 5000.00, 5000.00, 'PENDING',   NULL);

INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price) VALUES
(1,1,'large',8,120),(1,2,'medium',10,70),
(2,3,'small',20,50),(2,4,'large',12,150),
(3,5,'large',8,200),(3,1,'small',15,60),
(4,1,'large',25,120),(4,2,'large',20,100);

INSERT INTO payments (sale_id, method, amount, paid_at) VALUES
(1,'CASH',1660.00,'2026-10-08 10:00:00'),
(2,'MOBILE_MONEY',1000.00,'2026-10-10 11:30:00'),
(4,'MOBILE_MONEY',5000.00,'2026-11-12 09:30:00');

-- Stock = purchased - sold (apples/bananas/mangoes/grapes LARGE are intentionally low)
INSERT INTO stock (fruit_id, packaging_size, available_quantity) VALUES
(1,'small',45),(1,'medium',30),(1,'large',7),
(2,'small',70),(2,'medium',45),(2,'large',5),
(3,'small',20),(3,'medium',30),(3,'large',20),
(4,'small',30),(4,'medium',25),(4,'large',3),
(5,'small',20),(5,'medium',15),(5,'large',2);
