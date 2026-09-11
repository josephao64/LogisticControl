const { db } = require('../config/firebase');

class TenantService {
  async getGrupos() {
    const snapshot = await db.collection('grupos').get();
    const result = [];
    if (snapshot.forEach) snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
    return result;
  }

  async addGrupo(data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id')) {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    const exists = await db.collection('grupos').where('nombre', '==', cleanData.nombre).get();
    if (!exists.empty) throw new Error('El grupo ya existe');

    const docRef = await db.collection('grupos').add(cleanData);
    return { id: docRef.id, ...cleanData };
  }

  async getEmpresas() {
    const snapshot = await db.collection('empresas').get();
    const result = [];
    if (snapshot.forEach) snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
    return result;
  }

  async addEmpresa(data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id')) {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    const exists = await db.collection('empresas').where('nombre', '==', cleanData.nombre).get();
    if (!exists.empty) throw new Error('La empresa ya existe');

    const docRef = await db.collection('empresas').add(cleanData);
    return { id: docRef.id, ...cleanData };
  }

  async getSucursales() {
    const snapshot = await db.collection('sucursales').get();
    const result = [];
    if (snapshot.forEach) snapshot.forEach(doc => result.push({ id: doc.id, ...doc.data() }));
    return result;
  }

  async addSucursal(data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id')) {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    const exists = await db.collection('sucursales').where('nombre', '==', cleanData.nombre).get();
    if (!exists.empty) throw new Error('La sucursal ya existe');

    const docRef = await db.collection('sucursales').add(cleanData);
    return { id: docRef.id, ...cleanData };
  }

  async updateGrupo(id, data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id')) {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    await db.collection('grupos').doc(id).update(cleanData);
    return { id, ...cleanData };
  }

  async deleteGrupo(id) {
    await db.collection('grupos').doc(id).delete();
    return { id };
  }

  async updateEmpresa(id, data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id')) {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    await db.collection('empresas').doc(id).update(cleanData);
    return { id, ...cleanData };
  }

  async deleteEmpresa(id) {
    await db.collection('empresas').doc(id).delete();
    return { id };
  }

  async updateSucursal(id, data) {
    const cleanData = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        if (typeof data[key] === 'string' && !key.toLowerCase().includes('id')) {
          cleanData[key] = data[key].toUpperCase();
        } else {
          cleanData[key] = data[key];
        }
      }
    }
    await db.collection('sucursales').doc(id).update(cleanData);
    return { id, ...cleanData };
  }

  async deleteSucursal(id) {
    await db.collection('sucursales').doc(id).delete();
    return { id };
  }
}

module.exports = new TenantService();
