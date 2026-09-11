require('dotenv').config();
const { db } = require('./config/firebase');

async function check() {
  const provs = await db.collection('proveedores').get();
  console.log('--- PROVEEDORES ---');
  provs.forEach(d => console.log(d.id, d.data()));

  const prods = await db.collection('productos').get();
  console.log('--- PRODUCTOS ---');
  prods.forEach(d => console.log(d.id, d.data()));
}

check().catch(console.error);
