require('dotenv').config();
const { db } = require('./config/firebase');

async function fix() {
  const provs = await db.collection('proveedores').get();
  const provIdsMap = {};
  provs.forEach(d => { provIdsMap[d.id.toUpperCase()] = d.id; });

  const prods = await db.collection('productos').get();
  for (const doc of prods.docs) {
    const data = doc.data();
    if (data.id_proveedor && data.id_proveedor === data.id_proveedor.toUpperCase()) {
      const realId = provIdsMap[data.id_proveedor];
      if (realId && realId !== data.id_proveedor) {
        console.log(`Fixing producto ${doc.id}: ${data.id_proveedor} -> ${realId}`);
        await db.collection('productos').doc(doc.id).update({ id_proveedor: realId });
      }
    }
  }

  const pedidos = await db.collection('Pedidos').get();
  for (const doc of pedidos.docs) {
    const data = doc.data();
    if (data.proveedor_id && data.proveedor_nombre === 'Desconocido') {
      const realId = provIdsMap[data.proveedor_id.toUpperCase()] || provIdsMap[data.proveedor_id] || data.proveedor_id;
      const provDoc = await db.collection('proveedores').doc(realId).get();
      if (provDoc.exists) {
        const provName = provDoc.data().nombre;
        console.log(`Fixing pedido ${doc.id}: ${data.proveedor_id} -> ${realId}, name: ${provName}`);
        await db.collection('Pedidos').doc(doc.id).update({ 
          proveedor_id: realId, 
          proveedor_nombre: provName 
        });
      }
    }
  }
  console.log('Fix complete.');
}

fix().catch(console.error);
