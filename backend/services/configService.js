const { db } = require('../config/firebase');

const CONFIG_COLLECTION = 'config';
const GLOBAL_DOC = 'global';

class ConfigService {
  async getConfig() {
    try {
      const doc = await db.collection(CONFIG_COLLECTION).doc(GLOBAL_DOC).get();
      if (!doc.exists) {
        // Return default config
        return {
          systemName: 'Logistic Control',
          logoUrl: '',
          logoText: 'LC'
        };
      }
      return doc.data();
    } catch (error) {
      throw new Error(`Error al obtener la configuración: ${error.message}`);
    }
  }

  async saveConfig(configData) {
    try {
      await db.collection(CONFIG_COLLECTION).doc(GLOBAL_DOC).set(configData, { merge: true });
      return await this.getConfig();
    } catch (error) {
      throw new Error(`Error al guardar la configuración: ${error.message}`);
    }
  }
}

module.exports = new ConfigService();
