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
    const branches = all.sucursales.filter(
      (b) =>
        admin ||
        ((req.user.branchIds || []).includes(b.id) &&
          (req.user.companyIds || []).includes(b.id_empresa)),
    );
    const branchIds = new Set(branches.map((b) => b.id)),
      companyIds = new Set(branches.map((b) => b.id_empresa));
    all.sucursales = branches;
    all.empresas = all.empresas.filter((e) => admin || companyIds.has(e.id));
    all.grupos = all.grupos.filter(
      (g) => admin || all.empresas.some((e) => e.id_grupo === g.id),
    );
    all.productos = all.productos.filter(
      (p) =>
        admin ||
        !Array.isArray(p.branchIds) ||
        p.branchIds.some((b) => branchIds.has(b)),
    );
    all.proveedores = all.proveedores.filter(
      (p) => admin || all.productos.some((i) => i.id_proveedor === p.id),
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
      all[n] = all[n].filter((d) => admin || branchIds.has(d.branchId));
    all.pedidos = all.pedidos.filter(
      (d) => admin || branchIds.has(d.branchId || d.id_sucursal || d.tienda_id),
    );
    all.purchaseOrders = all.purchaseOrders.filter(
      (o) => admin || o.branchIds?.every((b) => branchIds.has(b)),
    );
    all.auditEvents = all.auditEvents.filter(
      (e) => admin || (e.branchId && branchIds.has(e.branchId)),
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
module.exports = router;
