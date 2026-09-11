const test = require("node:test"),
  assert = require("node:assert/strict");
const { createLogistics, key, calendarState } = require("../domain/logistics");
const memory = require("./memoryRepository");
const admin = { uid: "admin", role: "Administrador" },
  log = {
    uid: "log",
    role: "Logistica",
    branchIds: ["b1", "b2"],
    companyIds: ["c1", "c2"],
  },
  store = {
    uid: "store",
    role: "Tienda",
    branchIds: ["b1"],
    companyIds: ["c1"],
  },
  warehouse = {
    uid: "wh",
    role: "Bodega",
    branchIds: ["b1", "b2"],
    companyIds: ["c1", "c2"],
  };
function setup(node = "DIRECTO_TIENDA") {
  const seed = {
    empresas: {
      c1: { nombre: "Empresa 1", id_grupo: "g1" },
      c2: { nombre: "Empresa 2", id_grupo: "g1" },
    },
    sucursales: {
      b1: { nombre: "Jalapa", id_empresa: "c1" },
      b2: { nombre: "Pinula", id_empresa: "c2" },
    },
    productos: {
      x: {
        nombre: "Queso",
        id_proveedor: "s1",
        precio_compra: 25,
        branchIds: ["b1", "b2"],
      },
    },
    proveedores: {
      s1: {
        nombre: "Proveedor",
        nodo_entrega: node,
        nodos_sucursal: { b2: "BODEGA" },
      },
    },
    branchSettings: {
      b1: {
        ideals: { x: 10 },
        calendars: { s1: { days: [1], cutoff: "11:00" } },
      },
      b2: {
        ideals: { x: 10 },
        calendars: { s1: { days: [1], cutoff: "11:00" } },
      },
    },
  };
  const repo = memory(seed),
    service = createLogistics(repo, () => new Date("2026-09-07T16:00:00Z"));
  return { repo, service };
}
const count = (branchId = "b1", physicalQty = 0, requestedQty = 10) => ({
  branchId,
  lines: [{ itemId: "x", physicalQty, requestedQty }],
});
async function ordered(ctx, node) {
  const c = await ctx.service.count(store, count(), "c");
  const id = c.requestIds[0];
  await ctx.service.approve(
    log,
    id,
    { lines: [{ itemId: "x", approvedQty: 10 }] },
    "a",
  );
  await ctx.service.purchase(
    log,
    { requestIds: [id], expectedAt: "2026-09-08T12:00:00Z" },
    "p",
  );
  return id;
}
const invoice = (number = "F1", quantity = 10) => ({
  number,
  lines: [{ itemId: "x", quantity, unitPrice: 25 }],
});
test("zero is a complete count; empty/missing/negative quantities rejected", async () => {
  const { service, repo } = setup();
  for (const physicalQty of ["", null, -1])
    await assert.rejects(
      service.count(store, count("b1", physicalQty), "bad" + physicalQty),
    );
  await assert.rejects(
    service.count(store, { branchId: "b1", lines: [] }, "missing"),
  );
  const r = await service.count(store, count(), "ok");
  assert.equal(repo.dump().inventoryCounts[r.countId].lines[0].physicalQty, 0);
  assert.equal(repo.dump().pedidos[r.requestIds[0]].total, 250);
});
test("count with no purchases retains every product and creates no requests", async () => {
  const { service, repo } = setup();
  const r = await service.count(store, count("b1", 10, 0), "c");
  assert.equal(r.requestIds.length, 0);
  assert.equal(repo.dump().inventoryCounts[r.countId].lines.length, 1);
});
test("encargado adjustment needs reason; logistics correction preserves originals", async () => {
  const { service, repo } = setup();
  await assert.rejects(
    service.count(store, count("b1", 0, 8), "bad"),
    /motivo/,
  );
  const body = count("b1", 0, 8);
  body.lines[0].reason = "Existencia externa confirmada";
  const r = await service.count(store, body, "c");
  const id = r.requestIds[0];
  await assert.rejects(
    service.approve(
      log,
      id,
      { lines: [{ itemId: "x", approvedQty: 7 }] },
      "bad",
    ),
    /motivo/,
  );
  await service.approve(
    log,
    id,
    { lines: [{ itemId: "x", approvedQty: 7, reason: "Ajuste de cobertura" }] },
    "a",
  );
  const p = repo.dump().pedidos[id];
  assert.equal(p.items[0].suggestedQty, 10);
  assert.equal(p.items[0].requestedQty, 8);
  assert.equal(p.items[0].approvedQty, 7);
  assert.equal(p.total, 175);
  assert.ok(
    Object.values(repo.dump().auditEvents).some(
      (e) =>
        e.before?.items?.[0].approvedQty === null &&
        e.after?.items?.[0].approvedQty === 7,
    ),
  );
});
test("scope and roles enforced", async () => {
  const { service } = setup();
  await assert.rejects(
    service.count(store, count("b2"), "x"),
    (e) => e.status === 403,
  );
  await assert.rejects(
    service.settings(store, { branchId: "b1" }, "s"),
    (e) => e.status === 403,
  );
  const r = await service.count(store, count(), "c");
  await assert.rejects(
    service.approve(store, r.requestIds[0], {}, "a"),
    (e) => e.status === 403,
  );
});
test("retry/concurrent calls produce a single count and operation", async () => {
  const { service, repo } = setup();
  const results = await Promise.all([
    service.count(store, count(), "same"),
    service.count(store, count(), "same"),
  ]);
  assert.equal(results[0].countId, results[1].countId);
  assert.equal(Object.keys(repo.dump().inventoryCounts).length, 1);
});
test("order requires approval, separates nodes in one supplier order", async () => {
  const { service, repo } = setup();
  const a = await service.count(store, count(), "c1"),
    b = await service.count(admin, count("b2"), "c2");
  const ids = [...a.requestIds, ...b.requestIds];
  await assert.rejects(
    service.purchase(
      log,
      { requestIds: ids, expectedAt: "2026-09-08T12:00:00Z" },
      "bad",
    ),
    /aprobadas/,
  );
  for (const id of ids)
    await service.approve(
      log,
      id,
      { lines: [{ itemId: "x", approvedQty: 10 }] },
      id,
    );
  const o = await service.purchase(
    log,
    { requestIds: ids, expectedAt: "2026-09-08T12:00:00Z" },
    "p",
  );
  assert.equal(o.groups.BODEGA.length, 1);
  assert.equal(o.groups.DIRECTO_TIENDA.length, 1);
  assert.equal(o.total, 500);
  await assert.rejects(
    service.purchase(
      log,
      { requestIds: ids, expectedAt: "2026-09-08T12:00:00Z" },
      "again",
    ),
  );
});
test("invoice partitions conserve ordered quantities and unique company/provider/number", async () => {
  const c = setup(),
    id = await ordered(c);
  await c.service.invoice(store, id, invoice("F1", 3), "i1");
  await c.service.invoice(store, id, invoice("F2", 3), "i2");
  await c.service.invoice(store, id, invoice("F3", 4), "i3");
  await assert.rejects(
    c.service.invoice(store, id, invoice("F4", 1), "i4"),
    /excede/,
  );
  await assert.rejects(
    c.service.invoice(store, id, invoice(" f1 ", 1), "dup"),
    /registrada/,
  );
  assert.equal(Object.keys(c.repo.dump().invoices).length, 3);
});
test("receipt with difference cannot close until Logistics records solution", async () => {
  const c = setup(),
    id = await ordered(c);
  await c.service.invoice(store, id, invoice(), "i");
  await assert.rejects(
    c.service.receive(
      store,
      id,
      { lines: [{ itemId: "x", receivedQty: 8 }] },
      "bad",
    ),
    /causa/,
  );
  assert.equal(Object.keys(c.repo.dump().receipts || {}).length, 0);
  await c.service.receive(
    store,
    id,
    {
      lines: [{ itemId: "x", receivedQty: 8 }],
      cause: "Faltaron dos",
      evidence: "Acta de recepción 15",
    },
    "r",
  );
  assert.equal(c.repo.dump().pedidos[id].status, "DIFERENCIA_TIENDA");
  assert.equal(c.repo.dump().inventoryBalances[key("b1", "x")].qtyOnHand, 8);
  await assert.rejects(
    c.service.resolve(store, id, { solution: "Acepto" }, "unauthorized"),
    (e) => e.status === 403,
  );
  await c.service.resolve(
    log,
    id,
    {
      solution:
        "Proveedor reconoce el faltante. Se acepta sin entrega restante.",
    },
    "resolve",
  );
  assert.equal(c.repo.dump().pedidos[id].status, "CONCILIADO");
  assert.equal(c.repo.dump().inventoryBalances[key("b1", "x")].qtyOnHand, 8);
});
test("warehouse stock, dispatch and final store receipt have separate states", async () => {
  const c = setup("BODEGA"),
    id = await ordered(c);
  await c.service.invoice(warehouse, id, invoice(), "i");
  await assert.rejects(
    c.service.receive(
      store,
      id,
      { lines: [{ itemId: "x", receivedQty: 10 }] },
      "wrong",
    ),
    (e) => e.status === 403,
  );
  await c.service.receive(
    warehouse,
    id,
    { lines: [{ itemId: "x", receivedQty: 10 }] },
    "r",
  );
  assert.equal(c.repo.dump().pedidos[id].status, "RECIBIDO_BODEGA");
  await c.service.dispatch(warehouse, id, { reference: "G-1" }, "d");
  assert.equal(
    c.repo.dump().inventoryBalances[key("BODEGA:c1", "x")].qtyOnHand,
    0,
  );
  await c.service.receive(
    store,
    id,
    { lines: [{ itemId: "x", receivedQty: 10 }] },
    "r2",
  );
  assert.equal(c.repo.dump().pedidos[id].status, "CONCILIADO");
  assert.equal(c.repo.dump().inventoryBalances[key("b1", "x")].qtyOnHand, 10);
  await assert.rejects(
    c.service.receive(
      store,
      id,
      { lines: [{ itemId: "x", receivedQty: 10 }] },
      "repeat",
    ),
  );
});
test("next manual count resets physical observation without inventing consumption", async () => {
  const c = setup(),
    id = await ordered(c);
  await c.service.invoice(store, id, invoice(), "i");
  await c.service.receive(
    store,
    id,
    { lines: [{ itemId: "x", receivedQty: 10 }] },
    "r",
  );
  await c.service.count(
    store,
    { ...count("b1", 3, 7), reason: "Nuevo conteo confirmado" },
    "new",
  );
  assert.equal(c.repo.dump().inventoryBalances[key("b1", "x")].qtyOnHand, 3);
});
test("calendar is Guatemala local time with inclusive cutoff", () => {
  assert.equal(
    calendarState(new Date("2026-09-07T17:00:00Z"), {
      days: [1],
      cutoff: "11:00",
    }).emergency,
    false,
  );
  assert.equal(
    calendarState(new Date("2026-09-07T17:01:00Z"), {
      days: [1],
      cutoff: "11:00",
    }).emergency,
    true,
  );
  assert.equal(
    calendarState(new Date("2026-09-07T02:00:00Z"), {
      days: [1],
      cutoff: "11:00",
    }).week,
    "2026-08-31",
  );
});
test("partial deliveries accumulate once and complete the order", async () => {
  const c = setup(),
    id = await ordered(c);
  await c.service.invoice(store, id, invoice("F1", 6), "i1");
  await c.service.receive(
    store,
    id,
    {
      lines: [{ itemId: "x", receivedQty: 6 }],
      cause: "Entrega parcial",
      evidence: "Acta 1",
    },
    "r1",
  );
  await c.service.invoice(store, id, invoice("F2", 4), "i2");
  await c.service.receive(
    store,
    id,
    { lines: [{ itemId: "x", receivedQty: 4 }] },
    "r2",
  );
  assert.equal(c.repo.dump().pedidos[id].finalReceived.x, 10);
  assert.equal(c.repo.dump().inventoryBalances[key("b1", "x")].qtyOnHand, 10);
  assert.equal(c.repo.dump().pedidos[id].status, "CONCILIADO");
  assert.equal(
    Object.values(c.repo.dump().alerts).filter((a) => !a.resolved).length,
    0,
  );
  await c.service.receive(
    store,
    id,
    { lines: [{ itemId: "x", receivedQty: 4 }] },
    "r2",
  );
  assert.equal(c.repo.dump().inventoryBalances[key("b1", "x")].qtyOnHand, 10);
});
test("invoice price differences require an explicit resolution", async () => {
  const c = setup(),
    id = await ordered(c);
  const data = invoice();
  data.lines[0].unitPrice = 30;
  await c.service.invoice(store, id, data, "i");
  await assert.rejects(
    c.service.receive(
      store,
      id,
      { lines: [{ itemId: "x", receivedQty: 10 }] },
      "r",
    ),
    /causa/,
  );
});
test("stock proposals need approval and do not mutate ideals automatically", async () => {
  const c = setup();
  await c.service.count(store, count("b1", 2, 8), "c1");
  const later = createLogistics(c.repo, () => new Date("2026-09-14T16:00:00Z"));
  await later.count(store, count("b1", 4, 6), "c2");
  const p = await later.propose(log, { branchId: "b1" }, "proposal");
  assert.equal(p.proposed.x, 7);
  assert.equal(c.repo.dump().branchSettings.b1.ideals.x, 10);
  await assert.rejects(
    later.acceptProposal(store, p.id, { reason: "Cambio" }, "bad"),
    (e) => e.status === 403,
  );
  await later.acceptProposal(
    log,
    p.id,
    { reason: "Revisado con registros de la sucursal" },
    "accept",
  );
  assert.equal(c.repo.dump().branchSettings.b1.ideals.x, 7);
});
test("transaction rolls back the count if a provider calendar is absent", async () => {
  const c = setup();
  await c.repo.transaction(async (tx) =>
    tx.set("branchSettings", "b1", { ideals: { x: 10 }, calendars: {} }),
  );
  await assert.rejects(c.service.count(store, count(), "fail"), /calendario/);
  assert.equal(Object.keys(c.repo.dump().inventoryCounts || {}).length, 0);
  assert.equal(Object.keys(c.repo.dump().movements || {}).length, 0);
});
