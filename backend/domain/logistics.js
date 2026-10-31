const { randomUUID, createHash } = require("node:crypto");
class BusinessError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (condition, message, status) => {
  if (!condition) throw new BusinessError(message, status);
};
const qty = (value) => {
  fail(
    value !== "" &&
    value !== null &&
    value !== undefined &&
    ["number", "string"].includes(typeof value) &&
    String(value).trim() !== "" &&
    Number.isFinite(Number(value)) &&
    Number(value) >= 0,
    "Complete todas las cantidades con números mayores o iguales a cero.",
  );
  return Number(value);
};
const required = (value, name) => {
  fail(typeof value === "string" && value.trim(), `Falta ${name}.`);
  return value.trim();
};
const key = (...parts) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex");
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const can = (user, roles) =>
  fail(roles.includes(user.role), "No tiene permiso para esta operación.", 403);
const scope = (user, branch) => {
  fail(branch, "Sucursal no encontrada.", 404);
  fail(
    user.role === "Administrador" ||
    (user.role === "Bodega" && user.allBranches === true) ||
    ((user.branchIds || []).includes(branch.id) &&
      (user.companyIds || []).includes(branch.id_empresa)),
    "Sucursal fuera de su alcance.",
    403,
  );
};
const isAssigned = (product, branchId) =>
  product.active !== false &&
  (!Array.isArray(product.branchIds) || product.branchIds.includes(branchId));
function calendarState(date, calendar) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guatemala",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const local = `${parts.year}-${parts.month}-${parts.day}`;
  const d = new Date(`${local}T12:00:00Z`),
    day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return {
    week: d.toISOString().slice(0, 10),
    emergency: !(
      calendar.days.includes(day) &&
      `${parts.hour}:${parts.minute}` <= calendar.cutoff
    ),
  };
}
function createLogistics(repo, now = () => new Date()) {
  async function execute(user, requestId, action, fn) {
    fail(user && user.uid, "Sesión requerida.", 401);
    required(requestId, "identificador de operación");
    return repo.transaction(async (tx) => {
      const receiptId = key(user.uid, action, requestId);
      const previous = await tx.get("operations", receiptId);
      if (previous) return previous.result;
      const at = now().toISOString(),
        correlationId = randomUUID();
      const audit = (entityType, entityId, before, after, reason = "") =>
        tx.set("auditEvents", randomUUID(), {
          actorId: user.uid,
          role: user.role,
          action,
          entityType,
          entityId,
          branchId: after?.branchId || before?.branchId || null,
          before: before || null,
          after: after || null,
          reason,
          at,
          correlationId,
        });
      const result = await fn(tx, at, audit, correlationId);
      tx.set("operations", receiptId, {
        actorId: user.uid,
        action,
        result,
        at,
      });
      return result;
    });
  }
  const branchFor = async (tx, user, branchId) => {
    const b = await tx.get("sucursales", required(branchId, "sucursal"));
    scope(user, b);
    fail(b.active !== false, "La sucursal está inactiva.");
    return b;
  };
  const orderFor = async (tx, user, id) => {
    const p = await tx.get("pedidos", id);
    fail(
      p && p.schemaVersion === 2,
      "Solicitud no disponible en el flujo nuevo. Los pedidos históricos requieren conciliación manual.",
      409,
    );
    await branchFor(tx, user, p.branchId);
    return p;
  };
  return {
    async count(user, data, requestId) {
      can(user, ["Administrador", "Tienda"]);
      return execute(user, requestId, "CONTEO", async (tx, at, audit) => {
        const branch = await branchFor(tx, user, data.branchId);
        const company = await tx.get("empresas", branch.id_empresa);
        fail(
          company && company.active !== false,
          "La empresa de la sucursal no está disponible.",
        );
        const products = (await tx.list("productos")).filter((p) =>
          isAssigned(p, branch.id),
        );
        fail(products.length > 0, "Configure el surtido de la sucursal.");
        fail(
          Array.isArray(data.lines) && data.lines.length === products.length,
          "Debe contar todos los productos asignados.",
        );
        const submitted = new Map(data.lines.map((l) => [l.itemId, l]));
        fail(
          submitted.size === products.length,
          "Hay productos repetidos en el conteo.",
        );
        const settings = await tx.get("branchSettings", branch.id);
        fail(
          settings,
          "Configure stock ideal y calendarios para esta sucursal.",
        );
        const allSuppliers = await tx.list("proveedores");
        const lines = products.map((p) => {
          const input = submitted.get(p.id);
          fail(input, `Falta contar ${p.nombre}.`);
          const physicalQty = qty(input.physicalQty),
            idealQty = qty(settings.ideals?.[p.id]);
          const suggestedQty = Math.max(idealQty - physicalQty, 0),
            requestedQty = qty(input.requestedQty);
          const reason =
            requestedQty !== suggestedQty
              ? required(input.reason, `motivo del ajuste de ${p.nombre}`)
              : "";
          const supplier = allSuppliers.find(
            (s) => s.id === p.id_proveedor && s.active !== false,
          );
          fail(supplier, `Proveedor no válido para ${p.nombre}.`);
          const node =
            supplier.nodos_sucursal?.[branch.id] || supplier.nodo_entrega;
          fail(
            ["BODEGA", "DIRECTO_TIENDA"].includes(node),
            `Configure el destino de ${supplier.nombre}.`,
          );
          return {
            itemId: p.id,
            sku: p.sku || p.id,
            name: p.nombre,
            unit: p.unidad_compra || p.presentacion || "Unidad",
            supplierId: supplier.id,
            supplierName: supplier.nombre,
            node,
            physicalQty,
            idealQty,
            suggestedQty,
            requestedQty,
            approvedQty: null,
            reason,
            unitPrice: qty(p.precio_compra ?? 0),
          };
        });
        const week = calendarState(new Date(at), {
          days: [1],
          cutoff: "23:59",
        }).week;
        const weeklyId = key(branch.id, week),
          existing = await tx.get("weeklyCounts", weeklyId);
        if (existing)
          required(data.reason, "motivo del conteo adicional de esta semana");
        const countId = randomUUID();
        const count = {
          branchId: branch.id,
          companyId: branch.id_empresa,
          groupId: company.id_grupo || null,
          week,
          lines,
          status: "ENVIADO",
          createdBy: user.uid,
          at,
          reason: data.reason || "",
          previousCountId: existing?.countId || null,
        };
        const balances = await Promise.all(
          lines.map((l) =>
            tx.get("inventoryBalances", key(branch.id, l.itemId)),
          ),
        );
        tx.set("inventoryCounts", countId, count);
        tx.set("weeklyCounts", weeklyId, {
          branchId: branch.id,
          week,
          countId,
          at,
        });
        lines.forEach((l, i) => {
          const balance = {
            branchId: branch.id,
            itemId: l.itemId,
            qtyOnHand: l.physicalQty,
            basis: "CONTEO_MANUAL",
            countId,
            at,
            version: (balances[i]?.version || 0) + 1,
          };
          tx.set("inventoryBalances", key(branch.id, l.itemId), balance);
          tx.set("movements", randomUUID(), {
            branchId: branch.id,
            itemId: l.itemId,
            type: "CONTEO_MANUAL",
            qty: l.physicalQty - (balances[i]?.qtyOnHand || 0),
            balanceAfter: l.physicalQty,
            countId,
            at,
            actorId: user.uid,
          });
        });
        const groups = {};
        for (const l of lines.filter((l) => l.requestedQty > 0))
          (groups[l.supplierId] ||= []).push(l);
        const requests = [];
        for (const [supplierId, items] of Object.entries(groups)) {
          const calendar = settings.calendars?.[supplierId];
          fail(calendar, "Configure el calendario del proveedor y sucursal.");
          const id = randomUUID(),
            p = {
              schemaVersion: 2,
              branchId: branch.id,
              branchName: branch.nombre,
              companyId: branch.id_empresa,
              groupId: company.id_grupo || null,
              countId,
              supplierId,
              supplierName: items[0].supplierName,
              node: items[0].node,
              items,
              status: "PENDIENTE",
              createdAt: at,
              createdBy: user.uid,
              isEmergency: calendarState(new Date(at), calendar).emergency,
              total: round(
                items.reduce((s, l) => s + l.requestedQty * l.unitPrice, 0),
              ),
              version: 1,
            };
          tx.set("pedidos", id, p);
          audit("pedidos", id, null, p);
          requests.push(id);
        }
        audit("inventoryCounts", countId, null, count, data.reason);
        return {
          countId,
          requestIds: requests,
          message: requests.length
            ? "Conteo y solicitudes registrados."
            : "Conteo completo registrado. No necesita solicitar productos.",
        };
      });
    },
    async approve(user, id, data, requestId) {
      can(user, ["Administrador", "Logistica"]);
      return execute(user, requestId, "APROBAR", async (tx, at, audit) => {
        const p = await orderFor(tx, user, id);
        fail(p.status === "PENDIENTE", "La solicitud ya fue revisada.", 409);
        fail(
          Array.isArray(data.lines) &&
          data.lines.length === p.items.length &&
          new Set(data.lines.map((l) => l.itemId)).size === p.items.length,
          "Revise todas las líneas.",
        );
        const items = p.items.map((l) => {
          const input = data.lines.find((x) => x.itemId === l.itemId);
          fail(input, "Falta una línea.");
          const approvedQty = qty(input.approvedQty);
          return {
            ...l,
            approvedQty,
            approvalReason:
              approvedQty !== l.requestedQty
                ? required(input.reason, `motivo del cambio de ${l.name}`)
                : "",
          };
        });
        fail(
          items.some((l) => l.approvedQty > 0),
          "Para rechazar toda la solicitud utilice Rechazar.",
        );
        const next = {
          ...p,
          items,
          status: "APROBADO",
          approvedAt: at,
          approvedBy: user.uid,
          isRectified: items.some((l) => l.approvedQty !== l.requestedQty),
          version: p.version + 1,
          total: round(
            items.reduce((s, l) => s + l.approvedQty * l.unitPrice, 0),
          ),
        };
        tx.set("pedidos", id, next);
        audit("pedidos", id, p, next);
        return next;
      });
    },
    async reject(user, id, data, requestId) {
      can(user, ["Administrador", "Logistica"]);
      return execute(user, requestId, "RECHAZAR", async (tx, at, audit) => {
        const p = await orderFor(tx, user, id);
        fail(
          p.status === "PENDIENTE",
          "Solo puede rechazar solicitudes pendientes.",
          409,
        );
        const reason = required(data.reason, "motivo");
        const next = { ...p, status: "RECHAZADO", reason, updatedAt: at };
        tx.set("pedidos", id, next);
        audit("pedidos", id, p, next, reason);
        return next;
      });
    },
    async purchase(user, data, requestId) {
      can(user, ["Administrador", "Logistica"]);
      return execute(user, requestId, "ORDEN_COMPRA", async (tx, at, audit) => {
        fail(
          Array.isArray(data.requestIds) &&
          data.requestIds.length > 0 &&
          new Set(data.requestIds).size === data.requestIds.length,
          "Seleccione solicitudes distintas.",
        );
        const ps = await Promise.all(
          data.requestIds.map((id) => orderFor(tx, user, id)),
        );
        fail(
          ps.every((p) => p.status === "APROBADO" && !p.purchaseOrderId),
          "Solo se consolidan solicitudes aprobadas sin orden.",
          409,
        );
        fail(
          ps.every((p) => p.supplierId === ps[0].supplierId),
          "Una orden corresponde a un proveedor.",
        );
        const expectedAt = required(
          data.expectedAt,
          "fecha de entrega comprometida",
        );
        fail(
          Number.isFinite(Date.parse(expectedAt)) &&
          Date.parse(expectedAt) >= Date.parse(at),
          "Fecha de compromiso inválida.",
        );
        const id = randomUUID(),
          groups = {};
        ps.forEach((p) => {
          (groups[p.node] ||= []).push({
            requestId: p.id,
            companyId: p.companyId,
            branchId: p.branchId,
            branchName: p.branchName,
            items: p.items.filter((l) => l.approvedQty > 0),
          });
        });
        const order = {
          supplierId: ps[0].supplierId,
          supplierName: ps[0].supplierName,
          requestIds: data.requestIds,
          branchIds: [...new Set(ps.map((p) => p.branchId))],
          groups,
          expectedAt,
          at,
          createdBy: user.uid,
          status: "EMITIDA",
          total: round(ps.reduce((s, p) => s + p.total, 0)),
        };
        tx.set("purchaseOrders", id, order);
        ps.forEach((p) => {
          const n = {
            ...p,
            purchaseOrderId: id,
            status:
              p.node === "BODEGA" ? "ESPERANDO_BODEGA" : "ESPERANDO_TIENDA",
            expectedAt,
          };
          tx.set("pedidos", p.id, n);
          audit("pedidos", p.id, p, n);
        });
        audit("purchaseOrders", id, null, order);
        return { id, ...order };
      });
    },
    async invoice(user, id, data, requestId) {
      can(user, ["Administrador", "Logistica", "Bodega", "Tienda"]);
      return execute(user, requestId, "FACTURA", async (tx, at, audit) => {
        const p = await orderFor(tx, user, id);
        fail(
          p.purchaseOrderId &&
          (p.node === "BODEGA"
            ? ["ESPERANDO_BODEGA", "DIFERENCIA_BODEGA"]
            : ["ESPERANDO_TIENDA", "DIFERENCIA_TIENDA"]
          ).includes(p.status),
          "El pedido no admite facturas.",
          409,
        );
        if (user.role === "Bodega")
          fail(p.node === "BODEGA", "La entrega es directa.", 403);
        if (user.role === "Tienda")
          fail(
            p.node === "DIRECTO_TIENDA",
            "La factura corresponde a bodega.",
            403,
          );
        const number = required(data.number, "número de factura")
          .normalize("NFKC")
          .toUpperCase()
          .replace(/\s+/g, " ");
        const invoiceKey = key(p.companyId, p.supplierId, id, number);
        fail(
          !(await tx.get("invoices", invoiceKey)),
          "La factura ya está registrada en este pedido.",
          409,
        );
        fail(
          Array.isArray(data.lines) &&
          data.lines.length > 0 &&
          new Set(data.lines.map((l) => l.itemId)).size === data.lines.length,
          "Incluya productos distintos en la factura.",
        );
        const prior = (await tx.list("invoices")).filter(
          (i) => i.requestId === id,
        );
        const lines = data.lines.map((l) => {
          const item = p.items.find((i) => i.itemId === l.itemId);
          fail(item, "Producto ajeno al pedido.");
          const quantity = qty(l.quantity);
          fail(quantity > 0, "La cantidad facturada debe ser positiva.");
          const used = prior.reduce(
            (s, i) =>
              s + (i.lines.find((x) => x.itemId === l.itemId)?.quantity || 0),
            0,
          );
          fail(
            used + quantity <= item.approvedQty,
            `La división de facturas excede lo aprobado para ${item.name}.`,
          );
          return {
            itemId: l.itemId,
            name: item.name,
            quantity,
            unitPrice: qty(l.unitPrice),
          };
        });
        const inv = {
          invoiceKey,
          requestId: id,
          purchaseOrderId: p.purchaseOrderId,
          branchId: p.branchId,
          companyId: p.companyId,
          supplierId: p.supplierId,
          number,
          lines,
          total: round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)),
          at,
          actorId: user.uid,
        };
        tx.set("invoices", invoiceKey, inv);
        audit("invoices", invoiceKey, null, inv);
        return { id: invoiceKey, ...inv };
      });
    },
    async receive(user, id, data, requestId) {
      can(user, ["Administrador", "Bodega", "Tienda"]);
      return execute(user, requestId, "RECEPCION", async (tx, at, audit) => {
        const p = await orderFor(tx, user, id),
          final =
            p.node === "DIRECTO_TIENDA" ||
            ["EN_CAMINO_TIENDA", "DIFERENCIA_TIENDA"].includes(p.status);
        const stage = final ? "TIENDA" : "BODEGA";
        fail(
          final
            ? [
              "ESPERANDO_TIENDA",
              "EN_CAMINO_TIENDA",
              "DIFERENCIA_TIENDA",
            ].includes(p.status)
            : ["ESPERANDO_BODEGA", "DIFERENCIA_BODEGA"].includes(p.status),
          "Estado incompatible con la recepción.",
          409,
        );
        if (user.role !== "Administrador")
          fail(
            user.role === (final ? "Tienda" : "Bodega"),
            "Rol incorrecto para la recepción.",
            403,
          );
        fail(
          Array.isArray(data.lines) &&
          data.lines.length === p.items.length &&
          new Set(data.lines.map((l) => l.itemId)).size === p.items.length,
          "Complete todas las líneas recibidas, incluyendo ceros.",
        );
        const rawInvoice =
          typeof data.invoiceNumber === "string"
            ? data.invoiceNumber
                .trim()
                .normalize("NFKC")
                .toUpperCase()
                .replace(/\s+/g, " ")
            : "";
        const storeInvoiceNumber = final
          ? required(rawInvoice, "número de factura recibida en tienda")
              .normalize("NFKC")
              .toUpperCase()
              .replace(/\s+/g, " ")
          : "";
        const invoices = (await tx.list("invoices")).filter(
          (i) => i.requestId === id,
        );
        let autoInvoiceDoc = null;
        let existingAutoInv = null;
        if (invoices.length === 0 && rawInvoice) {
          const autoInvoiceKey = key(p.companyId, p.supplierId, id, rawInvoice);
          existingAutoInv = await tx.get("invoices", autoInvoiceKey);
          const autoLines = p.items
            .filter((i) => qty(i.approvedQty) > 0)
            .map((i) => ({
              itemId: i.itemId,
              name: i.name,
              quantity: qty(i.approvedQty),
              unitPrice: qty(i.unitPrice),
            }));
          if (autoLines.length > 0) {
            autoInvoiceDoc = {
              invoiceKey: autoInvoiceKey,
              requestId: id,
              purchaseOrderId: p.purchaseOrderId,
              branchId: p.branchId,
              companyId: p.companyId,
              supplierId: p.supplierId,
              number: rawInvoice,
              lines: autoLines,
              total: round(
                autoLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0),
              ),
              at,
              actorId: user.uid,
            };
            invoices.push(existingAutoInv || autoInvoiceDoc);
          }
        }
        fail(
          invoices.length > 0,
          "Ingrese el número de factura antes de recibir.",
        );
        const lines = p.items.map((item) => {
          const input = data.lines.find((l) => l.itemId === item.itemId);
          fail(input, "Falta una cantidad recibida.");
          const receivedQty = qty(input.receivedQty),
            previousQty =
              (final ? p.finalReceived : p.warehouseReceived)?.[item.itemId] ||
              0,
            cumulativeQty = previousQty + receivedQty,
            invoicedQty = invoices.reduce(
              (s, i) =>
                s +
                (i.lines.find((l) => l.itemId === item.itemId)?.quantity || 0),
              0,
            );
          const invoicePriceDifference = invoices.some((i) =>
            i.lines.some(
              (l) => l.itemId === item.itemId && l.unitPrice !== item.unitPrice,
            ),
          );
          const expectedQty =
            p.node === "BODEGA" && final
              ? (p.warehouseReceived?.[item.itemId] ?? 0)
              : item.approvedQty;
          return {
            itemId: item.itemId,
            name: item.name,
            orderedQty: item.approvedQty,
            expectedQty,
            invoicedQty,
            invoicePriceDifference,
            receivedQty,
            previousQty,
            cumulativeQty,
            hasDifference:
              ((!final || p.node === "DIRECTO_TIENDA") &&
                invoicePriceDifference) ||
              cumulativeQty !== expectedQty ||
              ((!final || p.node === "DIRECTO_TIENDA") &&
                invoicedQty !== item.approvedQty),
          };
        });
        const hasDifference = lines.some((l) => l.hasDifference);
        const previousAlert = p.status.startsWith("DIFERENCIA_")
          ? await tx.get("alerts", p.lastReceiptId)
          : null;
        const previousReceipt = previousAlert
          ? await tx.get("receipts", p.lastReceiptId)
          : null;
        const cause = hasDifference
          ? required(data.cause, "causa de la diferencia")
          : "";
        const evidence = hasDifference
          ? required(data.evidence, "evidencia de la diferencia")
          : "";
        const receiptId = randomUUID();
        const recordedInvoiceNumber = final
          ? storeInvoiceNumber
          : rawInvoice || invoices.map((i) => i.number).join(", ");
        const receipt = {
          requestId: id,
          branchId: p.branchId,
          stage,
          invoiceNumber: recordedInvoiceNumber,
          lines,
          hasDifference,
          cause,
          evidence,
          at,
          actorId: user.uid,
          status: hasDifference ? "DIFERENCIA" : "ACEPTADA",
        };
        const location =
          stage === "BODEGA" ? `BODEGA:${p.companyId}` : p.branchId;
        const balances = await Promise.all(
          lines.map((l) =>
            tx.get("inventoryBalances", key(location, l.itemId)),
          ),
        );
        if (autoInvoiceDoc && !existingAutoInv) {
          tx.set("invoices", autoInvoiceDoc.invoiceKey, autoInvoiceDoc);
          audit("invoices", autoInvoiceDoc.invoiceKey, null, autoInvoiceDoc);
        }
        tx.set("receipts", receiptId, receipt);
        if (previousAlert) {
          tx.set("alerts", previousAlert.id, {
            ...previousAlert,
            resolved: true,
            resolution: "CONTINUA_EN_RECEPCION",
            nextReceiptId: receiptId,
            resolvedAt: at,
          });
          tx.set("receipts", previousReceipt.id, {
            ...previousReceipt,
            status: "CONTINUA_EN_RECEPCION",
            nextReceiptId: receiptId,
          });
        }
        lines.forEach((l, i) => {
          const balance = (balances[i]?.qtyOnHand || 0) + l.receivedQty;
          tx.set("inventoryBalances", key(location, l.itemId), {
            branchId: p.branchId,
            locationId: location,
            itemId: l.itemId,
            qtyOnHand: balance,
            basis:
              stage === "TIENDA"
                ? "CONTEO_MAS_ENTRADAS_SIN_CONSUMO"
                : "MOVIMIENTOS_BODEGA",
            at,
            version: (balances[i]?.version || 0) + 1,
          });
          tx.set("movements", randomUUID(), {
            branchId: p.branchId,
            locationId: location,
            itemId: l.itemId,
            type: `RECEPCION_${stage}`,
            qty: l.receivedQty,
            balanceAfter: balance,
            receiptId,
            requestId: id,
            actorId: user.uid,
            at,
          });
        });
        const next = {
          ...p,
          status: hasDifference
            ? `DIFERENCIA_${stage}`
            : final
              ? "CONCILIADO"
              : "RECIBIDO_BODEGA",
          lastReceiptId: receiptId,
          updatedAt: at,
        };
        if (stage === "BODEGA") {
          next.warehouseReceived = Object.fromEntries(
            lines.map((l) => [l.itemId, l.cumulativeQty]),
          );
          if (recordedInvoiceNumber)
            next.bodegaInvoiceNumber = recordedInvoiceNumber;
        }
        if (final) {
          next.finalReceived = Object.fromEntries(
            lines.map((l) => [l.itemId, l.cumulativeQty]),
          );
          next.storeInvoiceNumber = storeInvoiceNumber;
          next.storeInvoices = [
            ...new Set([...(p.storeInvoices || []), storeInvoiceNumber]),
          ];
          next.finalReceivedAt = at;
          if (!hasDifference) next.closedAt = at;
        }
        tx.set("pedidos", id, next);
        if (hasDifference)
          tx.set("alerts", receiptId, {
            branchId: p.branchId,
            requestId: id,
            receiptId,
            type: "DIFERENCIA",
            cause,
            evidence,
            responsibleId: user.uid,
            resolved: false,
            at,
          });
        audit("receipts", receiptId, null, receipt, cause);
        audit("pedidos", id, p, next);
        return next;
      });
    },
    async resolve(user, id, data, requestId) {
      can(user, ["Administrador", "Logistica"]);
      return execute(
        user,
        requestId,
        "RESOLVER_DIFERENCIA",
        async (tx, at, audit) => {
          const p = await orderFor(tx, user, id);
          fail(
            p.status.startsWith("DIFERENCIA_"),
            "No hay diferencia pendiente.",
            409,
          );
          const solution = required(data.solution, "solución acordada");
          const receipt = await tx.get("receipts", p.lastReceiptId),
            alert = await tx.get("alerts", p.lastReceiptId);
          const final = p.status === "DIFERENCIA_TIENDA";
          const next = {
            ...p,
            status: final ? "CONCILIADO" : "RECIBIDO_BODEGA",
            resolution: solution,
            resolvedBy: user.uid,
            resolvedAt: at,
            ...(final ? { closedAt: at } : {}),
          };
          tx.set("receipts", receipt.id, {
            ...receipt,
            status: "ACEPTADA_CON_SOLUCION",
            solution,
            resolvedBy: user.uid,
            resolvedAt: at,
          });
          tx.set("alerts", alert.id, {
            ...alert,
            resolved: true,
            solution,
            resolvedBy: user.uid,
            resolvedAt: at,
          });
          tx.set("pedidos", id, next);
          audit("pedidos", id, p, next, solution);
          return next;
        },
      );
    },
    async dispatch(user, id, data, requestId) {
      can(user, ["Administrador", "Bodega"]);
      return execute(user, requestId, "DESPACHAR", async (tx, at, audit) => {
        const p = await orderFor(tx, user, id);
        fail(
          p.status === "RECIBIDO_BODEGA",
          "Debe recibir y resolver las diferencias antes de despachar.",
          409,
        );
        const transportMethod = String(data.transportMethod || "").trim();
        const guideNumber = String(data.guideNumber || "").trim();
        const dispatchNotes = String(data.dispatchNotes || "").trim();
        const computedRef =
          data.reference ||
          (transportMethod && guideNumber
            ? `${transportMethod} · Guía: ${guideNumber}`
            : guideNumber);
        const reference = required(computedRef, "método de transporte y guía");
        const entries = Object.entries(p.warehouseReceived),
          location = `BODEGA:${p.companyId}`;
        const balances = await Promise.all(
          entries.map(([itemId]) =>
            tx.get("inventoryBalances", key(location, itemId)),
          ),
        );
        entries.forEach(([itemId, q], i) => {
          fail(
            balances[i] && balances[i].qtyOnHand >= q,
            "Saldo de bodega insuficiente.",
            409,
          );
          const balance = balances[i].qtyOnHand - q;
          tx.set("inventoryBalances", key(location, itemId), {
            ...balances[i],
            qtyOnHand: balance,
            at,
            version: balances[i].version + 1,
          });
          tx.set("movements", randomUUID(), {
            branchId: p.branchId,
            locationId: location,
            itemId,
            type: "DESPACHO_BODEGA",
            qty: -q,
            balanceAfter: balance,
            requestId: id,
            actorId: user.uid,
            at,
          });
        });
        const next = {
          ...p,
          status: "EN_CAMINO_TIENDA",
          transportMethod: transportMethod || null,
          guideNumber: guideNumber || reference,
          dispatchNotes: dispatchNotes || null,
          dispatchReference: reference,
          dispatchedAt: at,
          dispatchedBy: user.uid,
        };
        tx.set("pedidos", id, next);
        audit("pedidos", id, p, next);
        return next;
      });
    },
    async settings(user, data, requestId) {
      can(user, ["Administrador", "Logistica"]);
      return execute(
        user,
        requestId,
        "CONFIGURAR_SUCURSAL",
        async (tx, at, audit) => {
          const b = await branchFor(tx, user, data.branchId),
            before = await tx.get("branchSettings", b.id);
          const products = (await tx.list("productos")).filter((p) =>
            isAssigned(p, b.id),
          );
          const ideals = {};
          products.forEach((p) => {
            ideals[p.id] = qty(data.ideals?.[p.id]);
          });
          const calendars = {};
          for (const supplierId of new Set(
            products.map((p) => p.id_proveedor),
          )) {
            const c = data.calendars?.[supplierId];
            fail(
              c &&
              Array.isArray(c.days) &&
              c.days.length > 0 &&
              c.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
              /^([01]\d|2[0-3]):[0-5]\d$/.test(c.cutoff),
              "Defina días y hora límite para cada proveedor.",
            );
            calendars[supplierId] = {
              days: [...new Set(c.days)],
              cutoff: c.cutoff,
            };
          }
          const next = {
            branchId: b.id,
            ideals,
            calendars,
            at,
            actorId: user.uid,
          };
          tx.set("branchSettings", b.id, next);
          audit("branchSettings", b.id, before, next);
          return next;
        },
      );
    },
    async propose(user, data, requestId) {
      can(user, ["Administrador", "Logistica"]);
      return execute(
        user,
        requestId,
        "PROPONER_STOCK",
        async (tx, at, audit) => {
          const b = await branchFor(tx, user, data.branchId),
            settings = await tx.get("branchSettings", b.id);
          fail(settings, "Configure primero el stock ideal.");
          const counts = (await tx.list("inventoryCounts"))
            .filter((c) => c.branchId === b.id)
            .sort((a, b) => b.at.localeCompare(a.at));
          const weeks = [...new Set(counts.map((c) => c.week))].slice(0, 4);
          fail(
            weeks.length >= 2,
            "Se necesitan al menos dos semanas de conteos.",
          );
          const latest = weeks.map((w) => counts.find((c) => c.week === w));
          const proposed = {};
          for (const itemId of Object.keys(settings.ideals)) {
            const values = latest
              .map(
                (c) => c.lines.find((l) => l.itemId === itemId)?.requestedQty,
              )
              .filter((v) => v !== undefined);
            proposed[itemId] = values.length
              ? Math.ceil(values.reduce((a, b) => a + b, 0) / values.length)
              : settings.ideals[itemId];
          }
          const id = randomUUID(),
            p = {
              branchId: b.id,
              status: "PENDIENTE",
              previous: settings.ideals,
              proposed,
              sourceCountIds: latest.map((c) => c.id),
              method:
                "Promedio de cantidades solicitadas en el último conteo de hasta cuatro semanas; no representa consumo.",
              at,
              actorId: user.uid,
            };
          tx.set("stockProposals", id, p);
          audit("stockProposals", id, null, p);
          return { id, ...p };
        },
      );
    },
    async acceptProposal(user, id, data, requestId) {
      can(user, ["Administrador", "Logistica"]);
      return execute(
        user,
        requestId,
        "AUTORIZAR_STOCK",
        async (tx, at, audit) => {
          const p = await tx.get("stockProposals", id);
          fail(p && p.status === "PENDIENTE", "Propuesta no disponible.", 409);
          await branchFor(tx, user, p.branchId);
          const s = await tx.get("branchSettings", p.branchId);
          fail(
            JSON.stringify(s.ideals) === JSON.stringify(p.previous),
            "El stock cambió desde la propuesta. Genere otra.",
            409,
          );
          const reason = required(data.reason, "motivo de autorización");
          const n = { ...s, ideals: p.proposed, at, actorId: user.uid };
          tx.set("branchSettings", p.branchId, n);
          tx.set("stockProposals", id, {
            ...p,
            status: "AUTORIZADA",
            approvedBy: user.uid,
            approvedAt: at,
            reason,
          });
          audit("branchSettings", p.branchId, s, n, reason);
          return n;
        },
      );
    },
  };
}
module.exports = {
  createLogistics,
  BusinessError,
  fail,
  scope,
  can,
  isAssigned,
  key,
  calendarState,
};
