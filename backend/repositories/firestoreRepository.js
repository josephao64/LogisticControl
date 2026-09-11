const { db } = require("../config/firebase");
module.exports = {
  transaction: (fn) =>
    db.runTransaction(async (native) => {
      const writes = [];
      const tx = {
        get: async (collection, id) => {
          const s = await native.get(db.collection(collection).doc(id));
          return s.exists ? { ...s.data(), id: s.id } : null;
        },
        list: async (collection) => {
          const s = await native.get(db.collection(collection));
          return s.docs.map((d) => ({ ...d.data(), id: d.id }));
        },
        set: (collection, id, data) => {
          const clean = { ...data };
          delete clean.id;
          writes.push([collection, id, clean]);
        },
      };
      const result = await fn(tx);
      // All reads precede all writes; operation receipt and audit commit atomically.
      if (writes.length > 450) {
        const e = new Error(
          "La operación supera el límite seguro. Reduzca las solicitudes incluidas.",
        );
        e.status = 400;
        throw e;
      }
      writes.forEach(([c, id, d]) => native.set(db.collection(c).doc(id), d));
      return result;
    }),
};
