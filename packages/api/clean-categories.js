const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://orderflow_user:password123@localhost:5432/orderflow_dev' }); 
client.connect().then(() => client.query("DELETE FROM categories WHERE name IN ('Starters', 'Main Course', 'Breads & Rice', 'Tandoori Specials', 'Desserts', 'Beverages')"))
  .then(res => console.log('Deleted:', res.rowCount))
  .catch(console.error)
  .finally(() => client.end());
