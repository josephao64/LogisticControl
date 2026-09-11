const { db } = require('../config/firebase');

class SuministrosService {
  async getProveedores() {
    const snapshot = await db.collection('proveedores').get();
    const proveedores = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Refactor: Agregamos atributos lógicos clave si no existen
      proveedores.push({
        id: doc.id,
        nombre: data.nombre,
        nodo_entrega: data.nodo_entrega || 'BODEGA', // BODEGA o DIRECTO_TIENDA
        dias_credito: data.dias_credito || 15,
        nodos_sucursal: data.nodos_sucursal || {} // Configuración específica por sucursal
      });
    });
    return proveedores;
  }

  async getInsumos() {
    const snapshot = await db.collection('productos').get();
    const insumos = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      insumos.push({
        id: doc.id,
        sku: data.sku,
        nombre: data.nombre,
        id_proveedor: data.id_proveedor || 'PROV_DESCONOCIDO',
        promedio_uso_semanal: data.promedio_uso_semanal || 10,
        promedios_sucursal: data.promedios_sucursal || {},
        stock_minimo: data.stock_minimo || 5,
        presentacion: data.presentacion || '',
        unidad_compra: data.unidad_compra || '',
        precio_compra: data.precio_compra || 0
      });
    });
    return insumos;
  }

  async addProveedor(data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id') && key !== 'sku') {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    const exists = await db.collection('proveedores').where('nombre', '==', data.nombre).get();
    if (!exists.empty) throw new Error('El proveedor ya existe');

    const docRef = await db.collection('proveedores').add(cleanData);
    return { id: docRef.id, ...cleanData };
  }

  async addInsumo(data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id') && key !== 'sku') {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    const exists = await db.collection('productos').where('nombre', '==', data.nombre).get();
    if (!exists.empty) throw new Error('El insumo ya existe');

    const docRef = await db.collection('productos').add(cleanData);
    return { id: docRef.id, ...cleanData };
  }

  async updateProveedor(id, data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id') && key !== 'sku') {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    await db.collection('proveedores').doc(id).update(cleanData);
    return { id, ...cleanData };
  }

  async deleteProveedor(id) {
    await db.collection('proveedores').doc(id).delete();
    return { id };
  }

  async updateInsumo(id, data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id') && key !== 'sku') {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    await db.collection('productos').doc(id).update(cleanData);
    return { id, ...cleanData };
  }

  async deleteInsumo(id) {
    await db.collection('productos').doc(id).delete();
    return { id };
  }
}

module.exports = new SuministrosService();
