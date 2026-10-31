const router = require("express").Router();
const { randomUUID } = require("node:crypto");
const repo = require("../repositories/firestoreRepository");
const { can, fail } = require("../domain/logistics");
const types = {
  grupos: "grupos",
  empresas: "empresas",
  sucursales: "sucursales",
  proveedores: "proveedores",
  insumos: "productos",
};
const wrap = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (e) {
    next(e);
  }
};
for (const [route, collection] of Object.entries(types)) {
  router.post(
    `/${route}`,
    wrap((req) => save(req, collection, randomUUID())),
  );
  router.put(
    `/${route}/:id`,
    wrap((req) => save(req, collection, req.params.id)),
  );
  router.delete(
    `/${route}/:id`,
    wrap((req) => remove(req, collection, req.params.id)),
  );
}
const dependents = {
  grupos: [["empresas", "id_grupo", "empresas"]],
  empresas: [["sucursales", "id_empresa", "sucursales"]],
  proveedores: [["productos", "id_proveedor", "productos"]],
};
async function remove(req, collection, id) {
  can(req.user, ["Administrador"]);
  return repo.transaction(async (tx) => {
    const before = await tx.get(collection, id);
    fail(before, "Registro no encontrado.", 404);
    for (const [child, field, label] of dependents[collection] || []) {
      const rows = await tx.list(child);
      const n = rows.filter((x) => x[field] === id).length;
      fail(!n, `No se puede eliminar: tiene ${n} ${label} asociados. Elimínelos o reasígnelos primero.`, 400);
    }
    tx.remove(collection, id);
    tx.set("auditEvents", randomUUID(), {
      entityType: collection,
      entityId: id,
      action: "ELIMINAR",
      actorId: req.user.uid,
      before,
      after: null,
      at: new Date().toISOString(),
    });
    return { id, deleted: true };
  });
}
async function save(req, collection, id, deactivate = false) {
  can(req.user, ["Administrador"]);
  return repo.transaction(async (tx) => {
    const before = await tx.get(collection, id);
    if (req.method !== "POST") fail(before, "Registro no encontrado.", 404);
    let data;
    if (deactivate) data = { ...before, active: false };
    else {
      const allowed = {
        grupos: ["nombre"],
        empresas: ["nombre", "id_grupo", "nit"],
        sucursales: ["nombre", "id_empresa", "direccion"],
        proveedores: [
          "nombre",
          "nodo_entrega",
          "nodos_sucursal",
          "branchIds",
          "dias_credito",
        ],
        productos: [
          "nombre",
          "sku",
          "id_proveedor",
          "presentacion",
          "unidad_compra",
          "precio_compra",
          "branchIds",
        ],
      }[collection];
      data = { ...before, active: req.body.active !== false };
      for (const field of allowed)
        if (req.body[field] !== undefined) data[field] = req.body[field];
      fail(
        typeof data.nombre === "string" && data.nombre.trim(),
        "Nombre obligatorio.",
      );
      data.nombre = data.nombre.trim().toUpperCase();
      const duplicates = await tx.list(collection);
      fail(
        !duplicates.some(
          (x) =>
            x.id !== id &&
            x.active !== false &&
            x.nombre?.trim().toUpperCase() === data.nombre,
        ),
        "El nombre ya está registrado.",
        409,
      );
      if (collection === "empresas")
        fail(
          (await tx.get("grupos", data.id_grupo))?.active !== false &&
            (await tx.get("grupos", data.id_grupo)),
          "Grupo inválido.",
        );
      if (collection === "sucursales")
        fail(
          (await tx.get("empresas", data.id_empresa))?.active !== false &&
            (await tx.get("empresas", data.id_empresa)),
          "Empresa inválida.",
        );
      if (collection === "productos") {
        fail(
          typeof data.id_proveedor === "string" &&
            (await tx.get("proveedores", data.id_proveedor)) &&
            (await tx.get("proveedores", data.id_proveedor)).active !== false,
          "Proveedor inválido.",
        );
        fail(
          data.precio_compra !== "" && data.precio_compra != null &&
          Number.isFinite(Number(data.precio_compra)) &&
            Number(data.precio_compra) >= 0,
          "Precio inválido.",
        );
        data.precio_compra = Number(data.precio_compra);
        fail(typeof data.unidad_compra === 'string' && data.unidad_compra.trim(), 'Indique la unidad de compra.');
        data.unidad_compra = data.unidad_compra.trim();
        data.sku = String(data.sku || '').trim().toUpperCase();
        fail(!data.sku || !duplicates.some(p => p.id !== id && String(p.sku || '').trim().toUpperCase() === data.sku), 'El código de producto ya está registrado.', 409);
        fail(Array.isArray(data.branchIds) && (!data.active || data.branchIds.length > 0), 'Asigne el producto al menos a una sucursal.');
        if (data.branchIds) {
          fail(Array.isArray(data.branchIds), "Sucursales inválidas.");
          const branches = await tx.list("sucursales");
          fail(
            data.branchIds.every((id) => branches.some((b) => b.id === id && b.active !== false)),
            "Sucursal no encontrada.",
          );
        }
      }
      if (collection === "proveedores") {
        fail(data.nodos_sucursal && typeof data.nodos_sucursal === 'object' && !Array.isArray(data.nodos_sucursal), 'Los destinos deben ser un mapa de sucursales.');
        const branches = await tx.list('sucursales');
        fail(Object.keys(data.nodos_sucursal).every(id => branches.some(b => b.id === id)), 'Un destino corresponde a una sucursal inexistente.');
        if (data.branchIds !== undefined) {
          fail(Array.isArray(data.branchIds), "Sucursales de proveedor inválidas.");
          fail(data.branchIds.every(id => branches.some(b => b.id === id)), "Una sucursal asignada no existe.");
        }
        if (data.dias_credito !== undefined) {
          fail(Number.isInteger(Number(data.dias_credito)) && Number(data.dias_credito) >= 0, 'Días de crédito inválidos.');
          data.dias_credito = Number(data.dias_credito);
        }
        fail(
          ["BODEGA", "DIRECTO_TIENDA"].includes(data.nodo_entrega),
          "Nodo inválido.",
        );
        if (data.nodos_sucursal)
          fail(
            Object.values(data.nodos_sucursal).every((n) =>
              ["BODEGA", "DIRECTO_TIENDA"].includes(n),
            ),
            "Nodo de sucursal inválido.",
          );
      }
    }
    if (before && collection === 'sucursales' && data.id_empresa !== before.id_empresa) {
      fail(false, 'La empresa de una sucursal existente no puede cambiar. Cree otra sucursal para conservar permisos e historial.');
    }
    if (data.active === false) {
      const dependent = {grupos: ['empresas', 'id_grupo'], empresas: ['sucursales', 'id_empresa'], proveedores: ['productos', 'id_proveedor']}[collection];
      if (dependent) {
        const children = await tx.list(dependent[0]);
        fail(!children.some(x => x.active !== false && x[dependent[1]] === id), 'Desactive primero los registros activos que dependen de este registro.');
      }
    }
    tx.set(collection, id, data);
    tx.set("auditEvents", randomUUID(), {
      entityType: collection,
      entityId: id,
      action: deactivate ? "DESACTIVAR" : "GUARDAR_CATALOGO",
      actorId: req.user.uid,
      before,
      after: data,
      at: new Date().toISOString(),
    });
    return { id, ...data };
  });
}
module.exports = router;
