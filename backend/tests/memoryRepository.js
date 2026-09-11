// Transactional test double: rollback and serialization, no cloud connections.
module.exports = function memoryRepository(seed = {}) {
  let data = structuredClone(seed),
    queue = Promise.resolve();
  return {
    dump: () => structuredClone(data),
    transaction(fn) {
      const operation = queue.then(async () => {
        const draft = structuredClone(data);
        const tx = {
          get: async (c, id) =>
            draft[c]?.[id] ? { ...structuredClone(draft[c][id]), id } : null,
          list: async (c) =>
            Object.entries(draft[c] || {}).map(([id, d]) => ({
              ...structuredClone(d),
              id,
            })),
          set: (c, id, d) => {
            draft[c] ||= {};
            draft[c][id] = structuredClone(d);
            delete draft[c][id].id;
          },
        };
        const result = await fn(tx);
        data = draft;
        return result;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
};
