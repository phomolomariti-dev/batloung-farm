// Usage (server must be running):  npm run demo:rollback
// Sends a sale with TWO items: item 1 is valid, item 2 asks for more boxes than exist.
// Proves the whole sale is rejected and stock for item 1 is NOT reduced (ROLLBACK).
require('dotenv').config();
const BASE = `http://localhost:${process.env.PORT || 5000}/api`;

const stockOf = async (fruitId, size) => {
  const r = await (await fetch(`${BASE}/stock/fruit/${fruitId}`)).json();
  return r.data.find((s) => s.packaging_size === size).available_quantity;
};

(async () => {
  const before = { apples_small: await stockOf(1, 'small'), apples_large: await stockOf(1, 'large') };
  console.log('Stock BEFORE:', before);

  const res = await fetch(`${BASE}/sales`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendor_id: 1, payment_method: 'CASH', items: [
      { fruit_id: 1, packaging_size: 'small', quantity: 5 },    // valid
      { fruit_id: 1, packaging_size: 'large', quantity: 999 },  // far more than the stock -> whole sale rejected
    ] }),
  });
  console.log('HTTP status:', res.status, await res.json());

  const after = { apples_small: await stockOf(1, 'small'), apples_large: await stockOf(1, 'large') };
  console.log('Stock AFTER :', after);
  console.log(JSON.stringify(before) === JSON.stringify(after)
    ? 'PASS: transaction rolled back, nothing changed.'
    : 'FAIL: stock changed!');
})();
