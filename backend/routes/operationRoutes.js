const router = require("express").Router();
const { randomUUID } = require("node:crypto");
const { db, auth } = require("../config/firebase");
const repo = require("../repositories/firestoreRepository");
const {
  createLogistics,
  fail,
  scope,
  can,
  calendarState,
} = require("../domain/logistics");
const service = createLogistics(repo);
const wrap = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (e) {
    next(e);
  }
};
const operationId = (req) => req.headers["idempotency-key"];
router.get(
  "/me",
  wrap(async (req) => req.user),
);
router.get(
  "/snapshot",
  wrap(async (req) => {
    const names = [
      "sucursales",
      "empresas",
      "grupos",
      "productos",
      "proveedores",
      "branchSettings",
      "inventoryCounts",
      "pedidos",
      "purchaseOrders",
      "invoices",
      "receipts",
      "alerts",
      "movements",
      "stockProposals",
      "auditEvents",
      "config",
    ];
    const snapshots = await Promise.all(
      names.map((n) => db.collection(n).get()),
    );
    const all = Object.fromEntries(
      names.map((n, i) => [
        n,
        snapshots[i].docs.map((d) => ({ ...d.data(), id: d.id })),
      ]),
    );
    const admin = req.user.role === "Administrador";
    const fullScope =
      admin || (req.user.role === "Bodega" && req.user.allBranches === true);
    const branches = all.sucursales.filter(
      (b) =>
        fullScope ||
        ((req.user.branchIds || []).includes(b.id) &&
          (req.user.companyIds || []).includes(b.id_empresa)),
    );
    const branchIds = new Set(branches.map((b) => b.id)),
      companyIds = new Set(branches.map((b) => b.id_empresa));
    all.sucursales = branches;
    all.empresas = all.empresas.filter((e) => fullScope || companyIds.has(e.id));
    all.grupos = all.grupos.filter(
      (g) => fullScope || all.empresas.some((e) => e.id_grupo === g.id),
    );
    all.productos = all.productos.filter(
      (p) =>
        fullScope ||
        !Array.isArray(p.branchIds) ||
        p.branchIds.some((b) => branchIds.has(b)),
    );
    all.proveedores = all.proveedores.filter(
      (p) => fullScope || all.productos.some((i) => i.id_proveedor === p.id),
    );
    for (const n of [
      "branchSettings",
      "inventoryCounts",
      "invoices",
      "receipts",
      "alerts",
      "movements",
      "stockProposals",
    ])
      all[n] = all[n].filter((d) => fullScope || branchIds.has(d.branchId));
    all.pedidos = all.pedidos.filter(
      (d) => fullScope || branchIds.has(d.branchId || d.id_sucursal || d.tienda_id),
    );
    all.purchaseOrders = all.purchaseOrders.filter(
      (o) => fullScope || o.branchIds?.some((b) => branchIds.has(b)),
    );
    all.auditEvents = all.auditEvents.filter(
      (e) => fullScope || (e.branchId && branchIds.has(e.branchId)),
    );
    if (
      !["Administrador", "Logistica", "Gerencia", "Auditoria"].includes(
        req.user.role,
      )
    ) {
      all.auditEvents = [];
      all.stockProposals = [];
    }
    all.users = admin
      ? (await db.collection("users").get()).docs.map((d) => ({
          ...d.data(),
          id: d.id,
        }))
      : [];
    const week = calendarState(new Date(), { days: [1], cutoff: "23:59" }).week;
    const weeklyCompliance = branches
      .filter((b) => b.active !== false)
      .map((b) => ({
        branchId: b.id,
        branchName: b.nombre,
        week,
        completed: all.inventoryCounts.some(
          (c) => c.branchId === b.id && c.week === week,
        ),
      }));
    return { ...all, weeklyCompliance, user: req.user };
  }),
);
router.post(
  "/counts",
  wrap((req) => service.count(req.user, req.body, operationId(req))),
);
router.post(
  "/settings",
  wrap((req) => service.settings(req.user, req.body, operationId(req))),
);
router.post(
  "/stock-proposals",
  wrap((req) => service.propose(req.user, req.body, operationId(req))),
);
router.post(
  "/stock-proposals/:id/accept",
  wrap((req) =>
    service.acceptProposal(req.user, req.params.id, req.body, operationId(req)),
  ),
);
router.post(
  "/purchase-orders",
  wrap((req) => service.purchase(req.user, req.body, operationId(req))),
);
for (const [path, method] of Object.entries({
  approve: "approve",
  reject: "reject",
  invoices: "invoice",
  receive: "receive",
  resolve: "resolve",
  dispatch: "dispatch",
}))
  router.post(
    `/requests/:id/${path}`,
    wrap((req) =>
      service[method](req.user, req.params.id, req.body, operationId(req)),
    ),
  );
router.delete(
  "/requests/:id",
  wrap(async (req) => {
    can(req.user, ["Administrador", "Logistica"]);
    const id = req.params.id;
    return repo.transaction(async (tx) => {
      const pedido = await tx.get("pedidos", id);
      fail(pedido, "Solicitud no encontrada.", 404);

      // 1. Eliminar facturas vinculadas
      const invoices = await tx.list("invoices");
      for (const inv of invoices) {
        if (inv.requestId === id) tx.remove("invoices", inv.id);
      }

      // 2. Eliminar recepciones vinculadas
      const receipts = await tx.list("receipts");
      for (const rec of receipts) {
        if (rec.requestId === id) tx.remove("receipts", rec.id);
      }

      // 3. Eliminar alertas vinculadas
      const alerts = await tx.list("alerts");
      for (const alt of alerts) {
        if (alt.requestId === id) tx.remove("alerts", alt.id);
      }

      // 4. Eliminar movimientos vinculados
      const movements = await tx.list("movements");
      for (const mov of movements) {
        if (mov.requestId === id) tx.remove("movements", mov.id);
      }

      // 5. Limpiar u omitir orden de compra vinculada
      const pos = await tx.list("purchaseOrders");
      for (const po of pos) {
        if (po.requestIds && po.requestIds.includes(id)) {
          const remaining = po.requestIds.filter((rid) => rid !== id);
          if (remaining.length === 0) {
            tx.remove("purchaseOrders", po.id);
          } else {
            tx.set("purchaseOrders", po.id, {
              ...po,
              requestIds: remaining,
              orders: (po.orders || []).filter((o) => o.requestId !== id),
            });
          }
        }
      }

      // 6. Eliminar el pedido de Firestore
      tx.remove("pedidos", id);

      // 7. Auditoría
      tx.set("auditEvents", randomUUID(), {
        entityType: "pedidos",
        entityId: id,
        action: "ELIMINAR_SOLICITUD",
        actorId: req.user.uid,
        before: pedido,
        after: null,
        at: new Date().toISOString(),
      });

      return { id, deleted: true };
    });
  }),
);
router.delete(
  "/purchase-orders/:id",
  wrap(async (req) => {
    can(req.user, ["Administrador", "Logistica"]);
    const id = req.params.id;
    return repo.transaction(async (tx) => {
      const po = await tx.get("purchaseOrders", id);
      fail(po, "Orden de compra no encontrada.", 404);

      // Desvincular purchaseOrderId en pedidos
      const pedidos = await tx.list("pedidos");
      for (const p of pedidos) {
        if (p.purchaseOrderId === id || (po.requestIds && po.requestIds.includes(p.id))) {
          const clean = { ...p };
          delete clean.purchaseOrderId;
          tx.set("pedidos", p.id, clean);
        }
      }

      // Eliminar orden de compra
      tx.remove("purchaseOrders", id);

      // Auditoría
      tx.set("auditEvents", randomUUID(), {
        entityType: "purchaseOrders",
        entityId: id,
        action: "ELIMINAR_ORDEN_COMPRA",
        actorId: req.user.uid,
        before: po,
        after: null,
        at: new Date().toISOString(),
      });

      return { id, deleted: true };
    });
  }),
);
router.post(
  "/system-config",
  wrap(async (req) => {
    can(req.user, ["Administrador"]);
    const data = {
      systemName: String(req.body.systemName || "Logistic Control").trim(),
      logoText: String(req.body.logoText || "LC").slice(0, 5),
      logoUrl: String(req.body.logoUrl || "").trim(),
    };
    fail(
      !data.logoUrl || /^https:\/\//.test(data.logoUrl),
      "Utilice una dirección HTTPS para el logotipo.",
    );
    await repo.transaction(async (tx) => {
      const before = await tx.get("config", "global");
      tx.set("config", "global", data);
      tx.set("auditEvents", randomUUID(), {
        entityType: "config",
        entityId: "global",
        action: "CONFIGURAR_SISTEMA",
        actorId: req.user.uid,
        before,
        after: data,
        at: new Date().toISOString(),
      });
    });
    return data;
  }),
);
const users = require('../domain/users').createUsers(repo, auth);
router.post('/users', wrap(req => users.create(req.user, req.body, operationId(req))));
router.post('/users/:id', wrap(req => users.update(req.user, req.params.id, req.body)));
router.delete('/users/:id', wrap(req => users.remove(req.user, req.params.id)));
module.exports = router;
