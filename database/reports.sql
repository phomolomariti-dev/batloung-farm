USE batloung_farm;

-- 1. Five most frequently sold fruits (by boxes sold)
SELECT f.fruit_name, SUM(sd.quantity) AS boxes_sold
FROM sales_details sd JOIN fruits f ON f.fruit_id = sd.fruit_id
GROUP BY f.fruit_id, f.fruit_name
ORDER BY boxes_sold DESC LIMIT 5;

-- 2. Total sales revenue in a date range (inclusive)
SELECT COALESCE(SUM(total_amount),0) AS total_revenue
FROM sales
WHERE sale_date >= '2026-10-01' AND sale_date < DATE_ADD('2026-10-31', INTERVAL 1 DAY);

-- 3. Vendor who purchased the highest number of boxes
SELECT v.vendor_id, v.vendor_name, SUM(sd.quantity) AS total_boxes
FROM vendors v JOIN sales s ON s.vendor_id = v.vendor_id
JOIN sales_details sd ON sd.sale_id = s.sale_id
GROUP BY v.vendor_id, v.vendor_name
ORDER BY total_boxes DESC LIMIT 1;

-- 4. Current stock level for each fruit and packaging size
SELECT f.fruit_name, st.packaging_size, st.available_quantity
FROM stock st JOIN fruits f ON f.fruit_id = st.fruit_id
ORDER BY f.fruit_name, FIELD(st.packaging_size,'small','medium','large');

-- Extra: outstanding balance per vendor
SELECT v.vendor_id, v.vendor_name,
       COALESCE(SUM(s.total_amount),0) AS total_billed,
       COALESCE(SUM(s.amount_paid),0)  AS total_paid,
       COALESCE(SUM(s.total_amount - s.amount_paid),0) AS outstanding_balance
FROM vendors v LEFT JOIN sales s ON s.vendor_id = v.vendor_id
GROUP BY v.vendor_id, v.vendor_name;

-- Raw transaction demo (what the API does internally)
-- BEGIN;
--   UPDATE stock SET available_quantity = available_quantity - 10 WHERE fruit_id=1 AND packaging_size='large';
--   -- fails: CHECK constraint chk_stock_nonneg (only 12 available -> 2 ok; request 15 would fail)
-- ROLLBACK;
