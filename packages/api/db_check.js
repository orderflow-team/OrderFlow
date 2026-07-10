const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://orderflow_user:password123@localhost:5432/orderflow_dev"
  });
  await client.connect();

  console.log('--- CUSTOMERS ---');
  const customersRes = await client.query("SELECT id, name, phone, outstanding_amount FROM customers WHERE name ILIKE '%Walk-in%' LIMIT 5");
  console.log(customersRes.rows);

  if (customersRes.rows.length > 0) {
    const custId = customersRes.rows[0].id;
    
    console.log('--- ORDERS ---');
    const ordersRes = await client.query("SELECT id, order_number, total_amount, status FROM orders WHERE customer_id = $1", [custId]);
    console.log(ordersRes.rows);

    if (ordersRes.rows.length > 0) {
      console.log('--- PAYMENTS ---');
      const paymentsRes = await client.query("SELECT id, order_id, amount, payment_method, status FROM payments WHERE order_id = ANY($1::uuid[])", [ordersRes.rows.map(o => o.id)]);
      console.log(paymentsRes.rows);
    }

    console.log('--- LEDGERS ---');
    const ledgersRes = await client.query("SELECT id, type, amount, description FROM ledgers WHERE customer_id = $1", [custId]);
    console.log(ledgersRes.rows);
  }

  await client.end();
}

run().catch(console.error);
