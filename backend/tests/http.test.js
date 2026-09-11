const test = require("node:test"),
  assert = require("node:assert/strict");
const rows = {
  users: {
    good: {
      role: "Tienda",
      companyIds: ["c1"],
      branchIds: ["b1"],
      active: true,
    },
    inactive: { role: "Administrador", active: false },
  },
  sucursales: {
    b1: { nombre: "Jalapa", id_empresa: "c1" },
    b2: { nombre: "Pinula", id_empresa: "c2" },
  },
  empresas: { c1: { nombre: "Empresa 1" }, c2: { nombre: "Empresa 2" } },
  pedidos: {
    p1: { branchId: "b1", schemaVersion: 2 },
    p2: { branchId: "b2", schemaVersion: 2 },
  },
  auditEvents: { a1: { branchId: "b2" } },
};
const fakeDb = {
  collection(name) {
    return {
      get: async () => ({
        docs: Object.entries(rows[name] || {}).map(([id, data]) => ({
          id,
          data: () => data,
        })),
      }),
      doc(id) {
        return {
          get: async () => ({
            exists: !!rows[name]?.[id],
            data: () => rows[name]?.[id],
          }),
        };
      },
    };
  },
};
require.cache[require.resolve("../config/firebase")] = {
  exports: {
    db: fakeDb,
    auth: {
      verifyIdToken: async (token) => {
        if (!["good", "inactive"].includes(token)) throw Error("invalid");
        return { uid: token };
      },
    },
  },
};
const app = require("../server");
let server, base;
test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => new Promise((resolve) => server.close(resolve)));
test("forged role header without a verified session cannot mutate", async () => {
  const r = await fetch(`${base}/api/operacion/counts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-usuario-rol": "Logistica",
    },
    body: "{}",
  });
  assert.equal(r.status, 401);
});
test("inactive profile is rejected even with verified token", async () => {
  const r = await fetch(`${base}/api/operacion/snapshot`, {
    headers: { Authorization: "Bearer inactive" },
  });
  assert.equal(r.status, 403);
});
test("snapshot does not disclose another branch", async () => {
  const r = await fetch(`${base}/api/operacion/snapshot`, {
    headers: { Authorization: "Bearer good" },
  });
  assert.equal(r.status, 200);
  const { data } = await r.json();
  assert.deepEqual(
    data.pedidos.map((p) => p.id),
    ["p1"],
  );
  assert.deepEqual(
    data.sucursales.map((p) => p.id),
    ["b1"],
  );
  assert.equal(data.auditEvents.length, 0);
});
test("legacy unvalidated update endpoint is unavailable", async () => {
  const r = await fetch(`${base}/api/pedidos/p1`, {
    method: "PUT",
    headers: {
      Authorization: "Bearer good",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ estado: "CONCILIADO" }),
  });
  assert.equal(r.status, 404);
});
test("valid Tienda token cannot approve by forging its role header", async () => {
  const r = await fetch(`${base}/api/operacion/requests/p1/approve`, {
    method: "POST",
    headers: {
      Authorization: "Bearer good",
      "x-usuario-rol": "Logistica",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(r.status, 403);
});
