<script setup>
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { state, command, perform, money, label, removeRequest, removePurchaseOrder } from "../services/operations";
import Swal from "sweetalert2";
const route = useRoute(),
  branch = ref(""),
  supplier = ref(""),
  status = ref(""),
  reviewTab = ref("pending"),
  search = ref(""),
  view = ref("cards"),
  selected = ref([]),
  expectedAt = ref(""),
  active = ref(null),
  action = ref(""),
  form = ref({}),
  success = ref("");
const logistics = computed(() =>
  ["Administrador", "Logistica"].includes(state.profile.role),
);
const isBodegaRoute = computed(() => route.path === "/bodega");
const isLogisticaRoute = computed(() => route.path === "/logistica");
const isTiendaRoute = computed(() => route.path === "/mis-pedidos");
const singleBranchName = computed(() =>
  state.data?.sucursales?.length === 1 ? state.data.sucursales[0].nombre : "",
);

const BODEGA_STAGE_PRIORITY = {
  ESPERANDO_BODEGA: 1,
  DIFERENCIA_BODEGA: 2,
  RECIBIDO_BODEGA: 3,
  EN_CAMINO_TIENDA: 4,
  ESPERANDO_TIENDA: 5,
  DIFERENCIA_TIENDA: 6,
  CONCILIADO: 7,
  COMPLETADO: 8,
};

const TIENDA_STAGE_PRIORITY = {
  EN_CAMINO_TIENDA: 1,
  ESPERANDO_TIENDA: 2,
  DIFERENCIA_TIENDA: 3,
  RECIBIDO_BODEGA: 4,
  ESPERANDO_BODEGA: 5,
  DIFERENCIA_BODEGA: 6,
  APROBADO: 7,
  PENDIENTE: 8,
  CONCILIADO: 9,
  COMPLETADO: 10,
  RECHAZADO: 11,
};

const TRANSPORT_OPTIONS = [
  "Transporte propio / Camión de empresa",
  "Piloto / Ruta interna",
  "Guatex",
  "Cargo Expreso",
  "Forza Delivery",
  "Encomienda / Transporte departamental",
  "Otro",
];

const allBaseRequests = computed(() => {
  const list = state.data.pedidos.filter((p) => {
    if (p.schemaVersion !== 2) return false;
    if (isBodegaRoute.value) {
      if (!p.purchaseOrderId) return false;
      if (["PENDIENTE", "RECHAZADO", "APROBADO"].includes(p.status)) return false;
      if (state.profile.role === "Bodega" && p.node !== "BODEGA") return false;
    }
    if (
      search.value &&
      !`${p.branchName} ${p.supplierName} ${p.id} ${p.guideNumber || ""} ${p.dispatchReference || ""}`
        .toLowerCase()
        .includes(search.value.toLowerCase())
    ) {
      return false;
    }
    if (branch.value && p.branchId !== branch.value) return false;
    if (supplier.value && p.supplierId !== supplier.value) return false;
    return true;
  });

  if (isBodegaRoute.value) {
    return [...list].sort(
      (a, b) =>
        (BODEGA_STAGE_PRIORITY[a.status] || 99) -
          (BODEGA_STAGE_PRIORITY[b.status] || 99) ||
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );
  }
  if (isTiendaRoute.value) {
    return [...list].sort(
      (a, b) =>
        (TIENDA_STAGE_PRIORITY[a.status] || 99) -
          (TIENDA_STAGE_PRIORITY[b.status] || 99) ||
        new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );
  }
  return list;
});

const pendingCount = computed(
  () => allBaseRequests.value.filter((p) => p.status === "PENDIENTE").length,
);

const reviewedCount = computed(
  () => allBaseRequests.value.filter((p) => p.status !== "PENDIENTE").length,
);

const totalCount = computed(() => allBaseRequests.value.length);

const availableStatuses = computed(() => {
  let list = allBaseRequests.value;
  if (isLogisticaRoute.value) {
    if (reviewTab.value === "pending") list = list.filter((p) => p.status === "PENDIENTE");
    else if (reviewTab.value === "reviewed") list = list.filter((p) => p.status !== "PENDIENTE");
  }
  return [...new Set(list.map((p) => p.status))];
});

watch(reviewTab, () => {
  status.value = "";
});

const requests = computed(() =>
  allBaseRequests.value.filter((p) => {
    if (isLogisticaRoute.value) {
      if (reviewTab.value === "pending" && p.status !== "PENDIENTE") return false;
      if (reviewTab.value === "reviewed" && p.status === "PENDIENTE") return false;
    }
    if (status.value && p.status !== status.value) return false;
    return true;
  }),
);

function orderStageDescription(p) {
  switch (p.status) {
    case "PENDIENTE":
      return "Solicitud enviada por tienda · Pendiente de revisión";
    case "APROBADO":
      return "Autorizada · Lista para generar Orden de Compra";
    case "RECHAZADO":
      return "Solicitud rechazada";
    case "ESPERANDO_BODEGA":
      return "OC generada · Esperando entrega del proveedor en Bodega";
    case "DIFERENCIA_BODEGA":
      return "Recepción en Bodega con diferencia pendiente de resolver";
    case "RECIBIDO_BODEGA":
      return `En Bodega Central · Listo para enviar a sucursal ${p.branchName}`;
    case "EN_CAMINO_TIENDA":
      return `En camino a sucursal ${p.branchName} · Pendiente recepción en tienda`;
    case "ESPERANDO_TIENDA":
      return `OC generada · Entrega directa en sucursal ${p.branchName}`;
    case "DIFERENCIA_TIENDA":
      return `Recibido en ${p.branchName} con diferencia pendiente`;
    case "CONCILIADO":
    case "COMPLETADO":
      return `Finalizado · Producto recibido en sucursal ${p.branchName}`;
    default:
      return label(p.status);
  }
}

function orderLifecycleSteps(p) {
  if (!p.purchaseOrderId) return [];
  if (p.node === "BODEGA") {
    const idx =
      ["ESPERANDO_BODEGA", "DIFERENCIA_BODEGA"].includes(p.status)
        ? 0
        : p.status === "RECIBIDO_BODEGA"
          ? 1
          : ["EN_CAMINO_TIENDA", "DIFERENCIA_TIENDA"].includes(p.status)
            ? 2
            : 3;
    const allDone = ["CONCILIADO", "COMPLETADO"].includes(p.status);
    return [
      { key: "oc", label: "OC Proveedor" },
      { key: "bodega", label: "En bodega" },
      { key: "camino", label: "Camino a tienda" },
      { key: "tienda", label: "En tienda" },
    ].map((s, i) => ({
      ...s,
      done: allDone || i < idx,
      current: !allDone && i === idx,
    }));
  }
  const allDone = ["CONCILIADO", "COMPLETADO"].includes(p.status);
  return [
    { key: "oc", label: "OC Proveedor", done: true, current: !allDone },
    { key: "tienda", label: "En tienda", done: allDone, current: false },
  ];
}

function getDefaultExpectedAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const poModalSupplier = ref(null);
const poExpectedAt = ref(getDefaultExpectedAt());

function openPoModal(supplierGroup) {
  poModalSupplier.value = supplierGroup;
  poExpectedAt.value = getDefaultExpectedAt();
}

async function confirmPurchaseOrder() {
  if (!poExpectedAt.value) {
    Swal.fire({
      icon: "warning",
      title: "Fecha requerida",
      text: "Por favor indique la fecha y hora de entrega comprometida.",
    });
    return;
  }
  await perform(async () => {
    const s = poModalSupplier.value;
    const reqIds = s.requests.map((r) => r.id);
    const result = await command("purchase-orders", {
      requestIds: reqIds,
      expectedAt: new Date(poExpectedAt.value).toISOString(),
    });
    poModalSupplier.value = null;
    success.value = `Orden de compra generada para ${s.supplierName} (${s.branchList.length} sucursales). Constancia general descargada.`;
    await download(result);
  });
}

const pendingPurchaseOrderSuppliers = computed(() => {
  const approved = (state.data?.pedidos || []).filter(
    (p) =>
      p.schemaVersion === 2 &&
      p.status === "APROBADO" &&
      !p.purchaseOrderId &&
      (!branch.value || p.branchId === branch.value) &&
      (!supplier.value || p.supplierId === supplier.value),
  );
  const bySupplier = {};
  for (const p of approved) {
    if (!bySupplier[p.supplierId]) {
      bySupplier[p.supplierId] = {
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        requests: [],
        branches: new Map(),
        total: 0,
      };
    }
    bySupplier[p.supplierId].requests.push(p);
    if (!bySupplier[p.supplierId].branches.has(p.branchId)) {
      bySupplier[p.supplierId].branches.set(p.branchId, {
        branchId: p.branchId,
        branchName: p.branchName,
        requests: [],
      });
    }
    bySupplier[p.supplierId].branches.get(p.branchId).requests.push(p);
    bySupplier[p.supplierId].total += p.total || 0;
  }
  return Object.values(bySupplier).map((s) => ({
    ...s,
    branchList: Array.from(s.branches.values()),
  }));
});
const invoices = (p) => state.data.invoices.filter((i) => i.requestId === p.id);
const billed = (p, itemId) =>
  invoices(p).reduce(
    (s, i) => s + (i.lines.find((l) => l.itemId === itemId)?.quantity || 0),
    0,
  );
watch(
  () => route.path,
  () => {
    active.value = null;
    selected.value = [];
    status.value = "";
  },
);
const isBodegaReception = (p) =>
  Boolean(p && ["ESPERANDO_BODEGA", "DIFERENCIA_BODEGA"].includes(p.status));
const needsQuickInvoice = (p) =>
  Boolean(
    p &&
      ["ESPERANDO_BODEGA", "ESPERANDO_TIENDA"].includes(p.status) &&
      invoices(p).length === 0,
  );
const canDispatch = (p) =>
  Boolean(
    p &&
      p.status === "RECIBIDO_BODEGA" &&
      ["Administrador", "Bodega"].includes(state.profile.role),
  );
function open(p, kind) {
  active.value = p;
  action.value = kind;
  success.value = "";
  const inBodegaStage = isBodegaReception(p);
  const fromBodegaToStore =
    p.node === "BODEGA" &&
    ["EN_CAMINO_TIENDA", "DIFERENCIA_TIENDA"].includes(p.status);
  const prefilledStoreInvoice =
    kind === "receive" &&
    !inBodegaStage &&
    p.node === "DIRECTO_TIENDA" &&
    !p.storeInvoiceNumber &&
    invoices(p).length > 0
      ? invoices(p)
          .map((i) => i.number)
          .join(", ")
      : "";
  form.value = {
    number: "",
    invoiceNumber: prefilledStoreInvoice,
    reason: "",
    solution: "",
    reference: "",
    transportMethod: TRANSPORT_OPTIONS[0],
    customTransport: "",
    guideNumber: "",
    dispatchNotes: "",
    cause: "",
    evidence: "",
    lines: p.items.map((l) => {
      const expectedTotal = fromBodegaToStore
        ? (p.warehouseReceived?.[l.itemId] ?? l.approvedQty ?? 0)
        : (l.approvedQty ?? 0);
      const alreadyReceived =
        (inBodegaStage ? p.warehouseReceived : p.finalReceived)?.[l.itemId] ?? 0;
      return {
        itemId: l.itemId,
        approvedQty: l.approvedQty ?? l.requestedQty,
        reason: "",
        quantity: Math.max(0, (l.approvedQty ?? 0) - billed(p, l.itemId)),
        unitPrice: l.unitPrice,
        receivedQty:
          kind === "receive" ? Math.max(0, expectedTotal - alreadyReceived) : "",
      };
    }),
  };
}
const canInvoice = (p) =>
  p.purchaseOrderId &&
  (p.node === "BODEGA"
    ? ["ESPERANDO_BODEGA", "DIFERENCIA_BODEGA"]
    : ["ESPERANDO_TIENDA", "DIFERENCIA_TIENDA"]
  ).includes(p.status) &&
  (["Administrador", "Logistica"].includes(state.profile.role) ||
    state.profile.role === (p.node === "BODEGA" ? "Bodega" : "Tienda"));
const canReceive = (p) =>
  [
    "Administrador",
    ["ESPERANDO_BODEGA", "DIFERENCIA_BODEGA"].includes(p.status)
      ? "Bodega"
      : "Tienda",
  ].includes(state.profile.role) &&
  [
    "ESPERANDO_BODEGA",
    "ESPERANDO_TIENDA",
    "EN_CAMINO_TIENDA",
    "DIFERENCIA_BODEGA",
    "DIFERENCIA_TIENDA",
  ].includes(p.status);
async function submit() {
  await perform(async () => {
    const current = active.value;
    const data = { ...form.value };
    if (action.value === "invoices") {
      data.lines = data.lines.filter((l) => Number(l.quantity) > 0);
      await command(`requests/${current.id}/invoices`, data);
      active.value = null;
      success.value = "Factura registrada correctamente.";
      return;
    }
    if (action.value === "receive") {
      const wasBodega = isBodegaReception(current);
      const invNum = String(data.invoiceNumber || "").trim();
      await command(`requests/${current.id}/receive`, {
        ...data,
        invoiceNumber: invNum,
      });
      active.value = null;
      success.value = wasBodega
        ? `Recepción registrada en Bodega (${current.branchName}). Ahora puede mandar el pedido a su sucursal.`
        : `Recepción confirmada en sucursal ${current.branchName} · Factura: ${invNum.toUpperCase()}. Estado: En tienda (Recibido).`;
      return;
    }
    if (action.value === "dispatch") {
      const transport =
        data.transportMethod === "Otro"
          ? String(data.customTransport || "").trim()
          : String(data.transportMethod || "").trim();
      const guide = String(data.guideNumber || "").trim();
      const notes = String(data.dispatchNotes || "").trim();
      const reference = `${transport} · Guía: ${guide}`;
      const updated = await command(`requests/${current.id}/dispatch`, {
        transportMethod: transport,
        guideNumber: guide,
        dispatchNotes: notes,
        reference,
      });
      const orderForDoc = updated || {
        ...current,
        status: "EN_CAMINO_TIENDA",
        transportMethod: transport,
        guideNumber: guide,
        dispatchNotes: notes,
        dispatchReference: reference,
        dispatchedAt: new Date().toISOString(),
      };
      active.value = null;
      success.value = `Pedido enviado hacia ${current.branchName} (${transport} · Guía ${guide}). Constancia de envío descargada.`;
      await downloadDispatch(orderForDoc);
      return;
    }
    await command(`requests/${current.id}/${action.value}`, data);
    active.value = null;
    success.value = "Operación registrada con historial.";
  });
}

async function downloadDispatch(order) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF();
  const refCode = order.id ? order.id.slice(0, 8).toUpperCase() : "PED";
  const poCode = order.purchaseOrderId
    ? `OC-${order.purchaseOrderId.slice(0, 8).toUpperCase()}`
    : "—";

  // Encabezado corporativo
  pdf.setFillColor(17, 43, 56);
  pdf.rect(0, 0, 210, 27, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text("LOGISTIC CONTROL", 14, 11);
  pdf.setFontSize(9.5);
  pdf.setFont("helvetica", "normal");
  pdf.text("CONSTANCIA DE ENVÍO Y TRASLADO DE BODEGA A SUCURSAL", 14, 19);

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(`ENVÍO #${refCode}`, 196, 16, { align: "right" });

  // Datos de Traslado y Transporte
  pdf.setTextColor(23, 45, 58);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("DATOS DEL TRASLADO Y TRANSPORTE", 14, 35);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  const dispatchedDate = new Date(order.dispatchedAt || Date.now());
  const transportLabel = order.transportMethod || order.dispatchReference || "—";
  const guideLabel = order.guideNumber || order.dispatchReference || "—";

  pdf.text(`Origen: Bodega Central`, 14, 42);
  pdf.text(`Sucursal Destino: ${order.branchName}`, 14, 48);
  pdf.text(`Proveedor de Origen: ${order.supplierName}`, 14, 54);
  pdf.text(`ID Pedido: #${refCode}   |   Orden de Compra: ${poCode}`, 14, 60);

  pdf.setFont("helvetica", "bold");
  pdf.text(`Método de Transporte: ${transportLabel}`, 110, 42);
  pdf.text(`Número de Guía / Placa: ${guideLabel}`, 110, 48);
  pdf.setFont("helvetica", "normal");
  pdf.text(
    `Fecha y Hora de Salida: ${dispatchedDate.toLocaleDateString("es-GT")} ${dispatchedDate.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`,
    110,
    54,
  );
  pdf.text(`Estado del Pedido: EN CAMINO A TIENDA`, 110, 60);

  let startTableY = 68;
  if (order.dispatchNotes) {
    pdf.setFontSize(8.5);
    pdf.setTextColor(80, 96, 108);
    pdf.text(`Observaciones / Piloto: ${order.dispatchNotes}`, 14, 66);
    startTableY = 72;
  }

  const rows = (order.items || []).map((item) => {
    const qtySent = Number(
      order.warehouseReceived?.[item.itemId] ?? item.approvedQty ?? 0,
    );
    const price = Number(item.unitPrice) || 0;
    const subtotal = qtySent * price;
    return [
      item.name,
      item.unit || "Unidad",
      Number(item.approvedQty || 0).toLocaleString("es-GT"),
      qtySent.toLocaleString("es-GT"),
      `Q ${price.toFixed(2)}`,
      `Q ${subtotal.toFixed(2)}`,
    ];
  });

  const totalSent = (order.items || []).reduce((sum, item) => {
    const qtySent = Number(
      order.warehouseReceived?.[item.itemId] ?? item.approvedQty ?? 0,
    );
    return sum + qtySent * (Number(item.unitPrice) || 0);
  }, 0);

  autoTable(pdf, {
    startY: startTableY,
    head: [
      [
        "Producto",
        "Unidad",
        "Cant. Aprobada",
        "Cant. Enviada a Sucursal",
        "Precio Unit.",
        "Subtotal",
      ],
    ],
    body: rows,
    styles: { fontSize: 8.5, cellPadding: 3 },
    headStyles: {
      fillColor: [8, 127, 117],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 251, 251] },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { cellWidth: 24 },
      2: { halign: "center", cellWidth: 28 },
      3: { halign: "center", fontStyle: "bold", cellWidth: 36 },
      4: { halign: "right", cellWidth: 26 },
      5: { halign: "right", fontStyle: "bold", cellWidth: 28 },
    },
  });

  let currentY = pdf.lastAutoTable.finalY + 10;
  if (currentY > 235) {
    pdf.addPage();
    currentY = 20;
  }

  pdf.setFontSize(11.5);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(8, 127, 117);
  pdf.text(`TOTAL TRASLADADO: ${money(totalSent)}`, 196, currentY, {
    align: "right",
  });

  // Firmas de Entrega, Transporte y Recepción en Tienda
  currentY += 26;
  if (currentY > 255) {
    pdf.addPage();
    currentY = 35;
  }

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(97, 116, 129);

  pdf.line(14, currentY, 68, currentY);
  pdf.text("Despachado por\nBodega Central", 41, currentY + 5, {
    align: "center",
  });

  pdf.line(83, currentY, 137, currentY);
  pdf.text(
    `Transportista / Piloto\n${transportLabel.slice(0, 28)}`,
    110,
    currentY + 5,
    { align: "center" },
  );

  pdf.line(152, currentY, 196, currentY);
  pdf.text(
    `Recibido Conforme en Tienda\n${order.branchName}`,
    174,
    currentY + 5,
    { align: "center" },
  );

  pdf.save(
    `Constancia-Envio-${order.branchName.replace(/\s+/g, "_")}-${refCode}.pdf`,
  );
}
async function consolidate() {
  await perform(async () => {
    const result = await command("purchase-orders", {
      requestIds: selected.value,
      expectedAt: new Date(expectedAt.value).toISOString(),
    });
    selected.value = [];
    success.value =
      "Orden registrada. Descargue el documento para enviarlo al proveedor.";
    await download(result);
  });
}
async function download(order) {
  const [{default:jsPDF}, {default:autoTable}] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const pdf = new jsPDF();
  const refCode = order.id ? order.id.slice(0, 8).toUpperCase() : "OC";

  // Encabezado corporativo
  pdf.setFillColor(17, 43, 56); // #112b38
  pdf.rect(0, 0, 210, 26, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text("LOGISTIC CONTROL", 14, 11);
  pdf.setFontSize(9.5);
  pdf.setFont("helvetica", "normal");
  pdf.text("ORDEN DE COMPRA Y CONSTANCIA GENERAL DE ABASTECIMIENTO", 14, 19);

  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text(`No. OC-${refCode}`, 196, 16, { align: "right" });

  // Metadatos del Proveedor y Despacho
  pdf.setTextColor(23, 45, 58);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("DATOS DEL PROVEEDOR Y DESPACHO", 14, 34);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Proveedor: ${order.supplierName}`, 14, 40);
  pdf.text(
    `Fecha de emisión: ${new Date(order.at || Date.now()).toLocaleDateString("es-GT")} ${new Date(order.at || Date.now()).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}`,
    14,
    46,
  );
  pdf.text(
    `Fecha y hora de entrega comprometida: ${new Date(order.expectedAt).toLocaleString("es-GT")}`,
    14,
    52,
  );

  // Extraer todas las filas de todas las sucursales para la constancia general
  const tableRows = [];
  const productTotals = {};
  const branchSet = new Set();

  for (const [node, assignments] of Object.entries(order.groups || {})) {
    for (const a of assignments) {
      branchSet.add(a.branchName);
      const reqRef = a.requestId ? `#${a.requestId.slice(0, 8).toUpperCase()}` : "—";
      const nodeLabel = node === "DIRECTO_TIENDA" ? "Directo Tienda" : "Bodega Central";

      for (const item of a.items || []) {
        const qty = Number(item.approvedQty) || 0;
        const price = Number(item.unitPrice) || 0;
        const subtotal = qty * price;

        tableRows.push([
          a.branchName,
          reqRef,
          nodeLabel,
          item.name,
          item.unit || "Unidad",
          qty.toLocaleString("es-GT"),
          `Q ${price.toFixed(2)}`,
          `Q ${subtotal.toFixed(2)}`,
        ]);

        if (!productTotals[item.name]) {
          productTotals[item.name] = { unit: item.unit || "Unidad", qty: 0, total: 0 };
        }
        productTotals[item.name].qty += qty;
        productTotals[item.name].total += subtotal;
      }
    }
  }

  pdf.setFontSize(8.5);
  pdf.setTextColor(97, 116, 129);
  pdf.text(
    `Sucursales consolidadas (${branchSet.size}): ${Array.from(branchSet).join(", ")}`,
    14,
    58,
  );

  // Tabla consolidada general con todas las sucursales
  autoTable(pdf, {
    startY: 62,
    head: [
      [
        "Sucursal",
        "Ref. Pedido",
        "Destino",
        "Producto",
        "Unidad",
        "Cantidad",
        "Precio Unit.",
        "Subtotal",
      ],
    ],
    body: tableRows,
    styles: { fontSize: 8, cellPadding: 2.8 },
    headStyles: { fillColor: [8, 127, 117], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 251, 251] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 26 },
      1: { cellWidth: 22, fontStyle: "bold", textColor: [67, 127, 176] },
      2: { cellWidth: 24 },
      3: { fontStyle: "bold" },
      4: { cellWidth: 16 },
      5: { halign: "center", fontStyle: "bold", cellWidth: 18 },
      6: { halign: "right", cellWidth: 22 },
      7: { halign: "right", fontStyle: "bold", cellWidth: 24 },
    },
  });

  let currentY = pdf.lastAutoTable.finalY + 9;

  // Tabla resumen por producto (total general a despachar)
  if (currentY > 230) {
    pdf.addPage();
    currentY = 20;
  }

  pdf.setFontSize(9.5);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(23, 45, 58);
  pdf.text("RESUMEN CONSOLIDADO POR PRODUCTO (TOTAL A DESPACHAR)", 14, currentY);

  const summaryRows = Object.entries(productTotals).map(([pName, pData]) => [
    pName,
    pData.unit,
    pData.qty.toLocaleString("es-GT"),
    `Q ${pData.total.toFixed(2)}`,
  ]);

  autoTable(pdf, {
    startY: currentY + 3.5,
    head: [["Producto", "Unidad", "Cantidad Total", "Total Q"]],
    body: summaryRows,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [67, 127, 176], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { fontStyle: "bold" },
      1: { cellWidth: 28 },
      2: { halign: "center", fontStyle: "bold", cellWidth: 32 },
      3: { halign: "right", fontStyle: "bold", cellWidth: 34 },
    },
  });

  currentY = pdf.lastAutoTable.finalY + 10;

  if (currentY > 240) {
    pdf.addPage();
    currentY = 20;
  }

  // Total General
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(8, 127, 117);
  pdf.text(`GRAN TOTAL: ${money(order.total)}`, 196, currentY, { align: "right" });

  // Firmas
  currentY += 22;
  if (currentY > 255) {
    pdf.addPage();
    currentY = 30;
  }

  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(97, 116, 129);

  pdf.line(20, currentY, 90, currentY);
  pdf.text("Firma y Sello Autorizado\nLogística y Abastecimiento", 55, currentY + 5, { align: "center" });

  pdf.line(120, currentY, 190, currentY);
  pdf.text(`Firma y Sello de Recepción\n${order.supplierName}`, 155, currentY + 5, { align: "center" });

  pdf.save(`Constancia-OC-${order.supplierName.replace(/\s+/g, "_")}-${refCode}.pdf`);
}
async function deleteOrder(p) {
  const refCode = p.id ? p.id.slice(0, 8).toUpperCase() : p.id;
  const res = await Swal.fire({
    icon: 'warning',
    title: '¿Eliminar pedido/orden?',
    html: `Se eliminará el pedido <b>${refCode}</b> de <b>${p.branchName}</b> permanentemente.`,
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#bc4050'
  });
  if (!res.isConfirmed) return;
  await perform(async () => {
    await removeRequest(p.id);
    success.value = `Pedido ${refCode} eliminado correctamente.`;
  });
  if (state.error) Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: state.error });
}
async function deletePurchaseOrder(o) {
  const refCode = o.id ? o.id.slice(0, 8).toUpperCase() : o.id;
  const res = await Swal.fire({
    icon: 'warning',
    title: '¿Eliminar orden de compra?',
    html: `Se eliminará la orden de compra <b>${refCode}</b> de <b>${o.supplierName}</b> permanentemente.`,
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#bc4050'
  });
  if (!res.isConfirmed) return;
  await perform(async () => {
    await removePurchaseOrder(o.id);
    success.value = `Orden de compra ${refCode} eliminada correctamente.`;
  });
  if (state.error) Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: state.error });
}
</script>
<template>
 <div class="stack">
  <PageHeader
    :title="
      isLogisticaRoute
        ? 'Solicitudes y compras'
        : isTiendaRoute
          ? singleBranchName
            ? `Mis pedidos y recepciones · ${singleBranchName}`
            : 'Mis pedidos y recepciones'
          : 'Recepciones y envíos de bodega'
    "
    :description="
      isLogisticaRoute
        ? 'Revise solicitudes y genere órdenes de compra consolidadas por proveedor.'
        : isTiendaRoute
          ? 'Consulte el estado en tiempo real de los pedidos de su tienda y confirme la recepción cuando lleguen.'
          : 'Reciba los pedidos con orden de compra generada y envíelos a su sucursal con método de transporte y guía.'
    "
    :eyebrow="
      isLogisticaRoute
        ? 'OPERACIÓN LOGÍSTICA'
        : isTiendaRoute
          ? singleBranchName
            ? `MI SUCURSAL · ${singleBranchName}`
            : 'MI TIENDA'
          : 'BODEGA Y TRASLADOS'
    "
    :icon="isLogisticaRoute ? 'clipboard' : isTiendaRoute ? 'store' : 'warehouse'"
  >
    <router-link
      v-if="isTiendaRoute"
      to="/tienda"
      class="secondary"
      style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; font-weight: 650;"
    >
      <AppIcon name="clipboard" :size="16" />
      Ir a conteo semanal
    </router-link>
  </PageHeader>
  <p v-if="success" class="success" role="status"><AppIcon name="checkCircle"/>{{ success }}</p>
  <div class="toolbar panel">
   <label class="filter-search">Buscar pedido<div class="field-with-icon"><AppIcon name="search"/><input v-model="search" :placeholder="isBodegaRoute || isTiendaRoute ? 'Proveedor, referencia o guía' : 'Sucursal, proveedor o referencia'" type="search"/></div></label>
   <label v-if="state.data.sucursales.length > 1">Sucursal<select v-model="branch"><option value="">Todas las autorizadas</option><option v-for="b in state.data.sucursales" :key="b.id" :value="b.id">{{ b.nombre }}</option></select></label>
   <label>Proveedor<select v-model="supplier"><option value="">Todos</option><option v-for="s in state.data.proveedores" :key="s.id" :value="s.id">{{ s.nombre }}</option></select></label>
   <label>Estado<select v-model="status"><option value="">Todos</option><option v-for="s in availableStatuses" :key="s" :value="s">{{ label(s) }}</option></select></label>
  </div>
  <!-- Pestañas para dividir Pendientes de revisar y Revisadas (solo en Logística) -->
  <div v-if="isLogisticaRoute" class="tabs-scroll" style="margin-top: -6px;">
   <div class="segmented" role="tablist" aria-label="Filtro por estado de revisión">
    <button
     type="button"
     :class="{ active: reviewTab === 'pending' }"
     @click="reviewTab = 'pending'"
     role="tab"
     :aria-selected="reviewTab === 'pending'"
    >
     <AppIcon name="clock" :size="16"/>
     <span>Pendientes de revisar</span>
     <span class="badge" :class="pendingCount > 0 ? 'amber' : ''" style="padding: 2px 8px; font-size: 0.75rem; font-weight: 700;">
      {{ pendingCount }}
     </span>
    </button>

    <button
     type="button"
     :class="{ active: reviewTab === 'reviewed' }"
     @click="reviewTab = 'reviewed'"
     role="tab"
     :aria-selected="reviewTab === 'reviewed'"
    >
     <AppIcon name="checkCircle" :size="16"/>
     <span>Revisadas y autorizadas</span>
     <span class="badge" :class="reviewedCount > 0 ? 'green' : ''" style="padding: 2px 8px; font-size: 0.75rem; font-weight: 700;">
      {{ reviewedCount }}
     </span>
    </button>

    <button
     type="button"
     :class="{ active: reviewTab === 'all' }"
     @click="reviewTab = 'all'"
     role="tab"
     :aria-selected="reviewTab === 'all'"
    >
     <AppIcon name="layers" :size="16"/>
     <span>Todas las solicitudes</span>
     <span class="badge" style="padding: 2px 8px; font-size: 0.75rem; font-weight: 700;">
      {{ totalCount }}
     </span>
    </button>
   </div>
  </div>

  <!-- Panel de Generación de Órdenes de Compra por Proveedor (solo en Logística) -->
  <div v-if="isLogisticaRoute && logistics && pendingPurchaseOrderSuppliers.length && reviewTab !== 'pending'" class="po-consolidation-banner">
    <div class="po-banner-header">
      <div class="row" style="gap: 12px; align-items: center;">
        <span class="icon-tile purple" style="width: 44px; height: 44px; border-radius: 12px;">
          <AppIcon name="file" :size="22" />
        </span>
        <div>
          <span class="eyebrow" style="color: #6b4ba3;">ORDEN DE COMPRA CONSOLIDADA POR PROVEEDOR</span>
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 750; color: var(--ink);">
            Solicitudes autorizadas listas para emitir orden de compra
          </h3>
          <p class="muted" style="margin: 2px 0 0; font-size: 0.8125rem;">
            Genera una sola constancia general por proveedor con todas las sucursales consolidadas y sus IDs de pedido.
          </p>
        </div>
      </div>
    </div>

    <div class="po-suppliers-cards-grid">
      <div
        v-for="sup in pendingPurchaseOrderSuppliers"
        :key="sup.supplierId"
        class="po-supplier-action-card"
      >
        <div class="po-card-info">
          <div class="row between wrap" style="gap: 8px;">
            <h4 class="po-supplier-name">{{ sup.supplierName }}</h4>
            <span class="badge purple" style="font-weight: 700;">
              {{ sup.requests.length }} {{ sup.requests.length === 1 ? 'pedido' : 'pedidos' }}
            </span>
          </div>

          <p class="po-branches-preview">
            <strong>Sucursales:</strong>
            {{ sup.branchList.map(b => b.branchName).join(', ') }}
          </p>

          <div class="po-card-meta">
            <span class="muted">{{ sup.branchList.length }} {{ sup.branchList.length === 1 ? 'sucursal' : 'sucursales' }}</span>
            <strong class="po-card-total">{{ money(sup.total) }}</strong>
          </div>
        </div>

        <button
          type="button"
          class="primary po-btn-generate"
          @click="openPoModal(sup)"
          :disabled="state.loading"
        >
          <AppIcon name="file" :size="16" />
          <span>Generar orden de compra ({{ sup.supplierName }})</span>
        </button>
      </div>
    </div>
  </div>

  <div class="row between wrap">
    <span class="filter-summary">
      {{ isBodegaRoute ? `${requests.length} órdenes activas con orden de compra` : `${requests.length} pedidos encontrados` }}
    </span>
    <div class="segmented" aria-label="Presentación">
      <button :class="{active:view==='cards'}" @click="view='cards'" :aria-pressed="view==='cards'"><AppIcon name="board"/>Tarjetas</button>
      <button :class="{active:view==='list'}" @click="view='list'" :aria-pressed="view==='list'"><AppIcon name="list"/>Lista</button>
    </div>
  </div>
  <form v-if="isLogisticaRoute && selected.length && logistics" @submit.prevent="consolidate" class="selection-panel stack-sm">
   <div class="row between wrap"><strong>{{ selected.length }} solicitudes para consolidar</strong><button type="button" class="ghost" @click="selected=[]">Limpiar selección</button></div>
   <p>Seleccione solicitudes aprobadas de un mismo proveedor. La orden separa empresas, sucursales y destinos.</p>
   <div class="row wrap"><label class="grow">Entrega comprometida en tienda<input type="datetime-local" v-model="expectedAt" required/></label><button class="primary" :disabled="state.loading"><AppIcon name="file"/>Generar orden</button></div>
  </form>
  <EmptyState
   v-if="!requests.length"
   :title="isBodegaRoute ? 'No hay órdenes para recibir o en proceso' : reviewTab === 'pending' ? 'No hay solicitudes pendientes de revisar' : reviewTab === 'reviewed' ? 'No hay solicitudes revisadas' : 'No hay pedidos en esta vista'"
   :description="isBodegaRoute ? 'Aquí aparecen únicamente los pedidos autorizados que ya cuentan con orden de compra generada.' : reviewTab === 'pending' ? 'Todas las solicitudes han sido revisadas o no hay nuevos pedidos pendientes.' : 'Pruebe con otro filtro o cambie de pestaña.'"
   :icon="isBodegaRoute ? 'warehouse' : reviewTab === 'pending' ? 'checkCircle' : 'clipboard'"
  />
  <div class="orders-grid" :class="{'list-view':view==='list'}">
   <article v-for="p in requests" :key="p.id" class="order-card" :class="{selected:selected.includes(p.id)}">
    <div class="order-top"><span class="icon-tile"><AppIcon :name="p.node==='BODEGA'?'warehouse':'store'"/></span><StatusBadge :status="p.status"/></div>
    <div class="order-main"><h2>{{ p.branchName }}</h2><p>{{ p.supplierName }}</p><p class="order-reference">Ref: {{ p.id ? p.id.slice(0, 8).toUpperCase() : '' }}<span v-if="p.purchaseOrderId"> · OC: #{{ p.purchaseOrderId.slice(0, 8).toUpperCase() }}</span></p></div>
    <div class="order-meta"><span><AppIcon name="calendar" :size="15"/>{{ new Date(p.createdAt).toLocaleDateString('es-GT') }}</span><span>{{ label(p.node) }}</span></div>

    <!-- Estado actual del pedido + Trazabilidad en la tarjeta -->
    <div class="card-status-tracker">
      <div class="tracker-header">
        <span class="tracker-eyebrow">Estado actual del pedido</span>
        <strong class="tracker-current-label">{{ label(p.status) }}</strong>
      </div>
      <p class="tracker-desc">{{ orderStageDescription(p) }}</p>

      <div v-if="p.purchaseOrderId" class="tracker-steps">
        <div
          v-for="(step, idx) in orderLifecycleSteps(p)"
          :key="step.key"
          class="tracker-step"
          :class="{ 'is-done': step.done, 'is-current': step.current }"
        >
          <span class="tracker-dot">{{ step.done ? '✓' : idx + 1 }}</span>
          <span class="tracker-step-name">{{ step.label }}</span>
        </div>
      </div>

      <div v-if="p.dispatchReference || p.guideNumber" class="dispatch-info-pill">
        <AppIcon name="truck" :size="15" />
        <div>
          <strong>Envío a {{ p.branchName }}:</strong>
          <span>
            {{ p.transportMethod || 'Transporte registrado' }}
            <template v-if="p.guideNumber"> · Guía: <b>{{ p.guideNumber }}</b></template>
            <template v-else-if="p.dispatchReference"> · {{ p.dispatchReference }}</template>
          </span>
        </div>
      </div>

      <div v-if="p.storeInvoices?.length || p.storeInvoiceNumber" class="dispatch-info-pill store-invoice-pill">
        <AppIcon name="receipt" :size="15" />
        <div>
          <strong>Factura recibida en tienda ({{ p.branchName }}):</strong>
          <span><b>{{ p.storeInvoices?.length ? p.storeInvoices.join(', ') : p.storeInvoiceNumber }}</b></span>
        </div>
      </div>
    </div>

    <div class="order-preview">{{ p.items.slice(0,2).map(l=>l.name).join(' · ') }}<span v-if="p.items.length>2"> y {{ p.items.length-2 }} más</span></div>
    <div class="order-summary"><span>{{ p.items.length }} productos</span><strong>{{ money(p.total) }}</strong></div>
    <details class="order-details"><summary>Productos y facturas <AppIcon name="down" :size="16"/></summary><div class="stack-sm">
     <div v-for="l in p.items" :key="l.itemId" class="line-card"><strong>{{ l.name }}</strong><dl class="quantity-values"><div><dt>Físico</dt><dd>{{ l.physicalQty }}</dd></div><div><dt>Sugerido</dt><dd>{{ l.suggestedQty }}</dd></div><div><dt>Solicitado</dt><dd>{{ l.requestedQty }}</dd></div><div><dt>Aprobado</dt><dd>{{ l.approvedQty ?? '—' }}</dd></div><div><dt>Facturado</dt><dd>{{ billed(p,l.itemId) }}</dd></div><div v-if="p.node==='BODEGA'"><dt>En bodega</dt><dd>{{ p.warehouseReceived?.[l.itemId] ?? '—' }}</dd></div><div><dt>En tienda</dt><dd>{{ p.finalReceived?.[l.itemId] ?? '—' }}</dd></div></dl><p v-if="l.reason" class="line-reason">Encargado: {{ l.reason }}</p><p v-if="l.approvalReason" class="line-reason">Logística: {{ l.approvalReason }}</p></div>
     <span v-for="i in invoices(p)" :key="i.id" class="invoice-chip"><AppIcon name="receipt" :size="16"/>Factura {{ p.node === 'BODEGA' ? 'bodega/proveedor' : 'proveedor' }} {{ i.number }} · {{ money(i.total) }}</span>
     <span v-if="p.storeInvoices?.length || p.storeInvoiceNumber" class="invoice-chip store-chip"><AppIcon name="store" :size="16"/>Factura recibida en tienda: <b>{{ p.storeInvoices?.length ? p.storeInvoices.join(', ') : p.storeInvoiceNumber }}</b></span>
    </div></details>
    <p v-if="p.resolution" class="notice">Solución: {{ p.resolution }}</p>
    <div class="order-actions">
     <template v-if="isLogisticaRoute && logistics && p.status==='PENDIENTE'"><button class="primary" @click="open(p,'approve')"><AppIcon name="check"/>Revisar</button><button class="ghost" @click="open(p,'reject')">Rechazar</button></template>
     <template v-if="isLogisticaRoute && logistics && p.status==='APROBADO'">
      <button
        type="button"
        class="secondary"
        style="border-color: #6b4ba3; color: #6b4ba3; font-weight: 650;"
        @click="openPoModal(pendingPurchaseOrderSuppliers.find(s => s.supplierId === p.supplierId))"
      >
        <AppIcon name="file" :size="15"/>Generar OC ({{ p.supplierName }})
      </button>
      <label class="check-label"><input type="checkbox" v-model="selected" :value="p.id"/>Incluir manual</label>
     </template>
     <button v-if="canInvoice(p)" class="secondary" @click="open(p,'invoices')"><AppIcon name="receipt"/>Factura / dividir</button>
     <button v-if="canReceive(p)" class="primary" @click="open(p,'receive')">
      <AppIcon :name="isBodegaReception(p) ? 'warehouse' : 'box'"/>
      {{ isBodegaReception(p) ? 'Recibir en bodega' : 'Recibir en tienda' }}
     </button>
     <button v-if="canDispatch(p)" class="primary" @click="open(p,'dispatch')">
      <AppIcon name="truck"/>Mandar a {{ p.branchName }}
     </button>
     <button v-if="p.dispatchReference || p.guideNumber" type="button" class="secondary" @click="downloadDispatch(p)">
      <AppIcon name="download" :size="15"/>Constancia envío PDF
     </button>
     <button v-if="p.status.startsWith('DIFERENCIA_') && logistics" class="primary" @click="open(p,'resolve')"><AppIcon name="shield"/>Resolver diferencia</button>
     <button v-if="logistics" class="danger-button" style="margin-left: auto;" :disabled="state.loading" @click="deleteOrder(p)"><AppIcon name="close"/>Eliminar</button>
    </div>
   </article>
  </div>
  <section v-if="isLogisticaRoute && state.data.purchaseOrders.length" class="stack-sm"><h2 class="section-title"><AppIcon name="file"/>Órdenes de compra</h2><div class="purchase-grid"><article v-for="o in state.data.purchaseOrders" :key="o.id" class="purchase-card stack-sm"><span class="icon-tile blue"><AppIcon name="file"/></span><h3>{{ o.supplierName }}</h3><p class="muted">{{ new Date(o.at).toLocaleDateString('es-GT') }}</p><strong>{{ money(o.total) }}</strong><div class="row wrap"><button class="secondary grow" @click="download(o)"><AppIcon name="download"/>Descargar PDF</button><button v-if="logistics" class="danger-button" :disabled="state.loading" @click="deletePurchaseOrder(o)"><AppIcon name="close"/>Eliminar</button></div></article></div></section>
  <AppModal
    v-if="active"
    :title="{
      approve: 'Revisar solicitud',
      reject: 'Rechazar solicitud',
      invoices: 'Factura por sucursal',
      receive: isBodegaReception(active) ? 'Registrar recepción en bodega' : 'Registrar recepción en tienda',
      resolve: 'Resolver diferencia',
      dispatch: `Mandar pedido a sucursal (${active.branchName})`
    }[action]"
    :subtitle="`${active.branchName} · ${active.supplierName}`"
    :busy="state.loading"
    :icon="action === 'receive' ? (isBodegaReception(active) ? 'warehouse' : 'store') : action === 'dispatch' ? 'truck' : 'clipboard'"
    @close="active=null"
  >
   <form @submit.prevent="submit" class="stack-sm"><p v-if="state.error" role="alert" class="error">{{ state.error }}</p>
        <template v-if="action === 'approve'">
          <!-- Resumen de la Solicitud -->
          <div class="review-header-summary">
            <div class="row between wrap" style="gap: 10px;">
              <div>
                <span class="eyebrow" style="margin-bottom: 2px;">SOLICITUD DE ABASTECIMIENTO</span>
                <h3 style="font-size: 1.15rem; font-weight: 750;">{{ active.branchName }} · {{ active.supplierName }}</h3>
                <p class="muted" style="font-size: 0.8125rem;">
                  Ref: <span class="order-reference">#{{ active.id ? active.id.slice(0, 8).toUpperCase() : '' }}</span> ·
                  Fecha: {{ new Date(active.createdAt).toLocaleDateString('es-GT') }} {{ new Date(active.createdAt).toLocaleTimeString('es-GT', {hour:'2-digit', minute:'2-digit'}) }}
                </p>
              </div>
              <div class="row wrap" style="gap: 8px;">
                <span class="badge blue">
                  <AppIcon :name="active.node === 'BODEGA' ? 'warehouse' : 'store'" :size="14" />
                  {{ label(active.node) }}
                </span>
                <span v-if="active.isEmergency" class="badge danger">
                  <AppIcon name="alert" :size="14" />
                  Fuera de horario (Emergencia)
                </span>
                <span class="badge">
                  {{ active.items.length }} {{ active.items.length === 1 ? 'producto' : 'productos' }}
                </span>
              </div>
            </div>

            <!-- Si el conteo semanal incluyó una justificación general de nuevo conteo -->
            <p v-if="state.data.inventoryCounts?.find(c => c.id === active.countId)?.reason" class="notice info" style="margin-top: 10px; padding: 8px 12px; font-size: 0.8125rem;">
              <AppIcon name="history" :size="16" />
              <span><strong>Motivo del conteo adicional:</strong> {{ state.data.inventoryCounts.find(c => c.id === active.countId).reason }}</span>
            </p>
          </div>

          <!-- Items a revisar -->
          <div class="review-items-list stack-sm">
            <div
              v-for="(l, i) in form.lines"
              :key="active.items[i].itemId"
              class="review-item-card"
            >
              <!-- Cabecera del producto -->
              <div class="review-item-top">
                <div class="row" style="gap: 12px; min-width: 0;">
                  <span class="icon-tile" style="width: 38px; height: 38px; border-radius: 10px;">
                    <AppIcon name="box" :size="18" />
                  </span>
                  <div style="min-width: 0;">
                    <h4 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: var(--ink);">
                      {{ active.items[i].name }}
                    </h4>
                    <p class="muted" style="font-size: 0.8125rem; margin-top: 2px;">
                      {{ active.items[i].unit }}
                      <span v-if="active.items[i].sku" class="sku-tag"> · SKU: {{ active.items[i].sku }}</span>
                      <span v-if="active.items[i].unitPrice"> · Precio Q: {{ money(active.items[i].unitPrice) }}</span>
                    </p>
                  </div>
                </div>

                <div style="text-align: right; flex-shrink: 0;">
                  <span class="muted" style="font-size: 0.7rem; font-weight: 650; text-transform: uppercase; display: block;">Total estimado</span>
                  <strong style="font-size: 1.15rem; color: var(--accent);">
                    {{ money((Number(l.approvedQty) || 0) * (active.items[i].unitPrice || 0)) }}
                  </strong>
                </div>
              </div>

              <!-- Cuadrícula completa de Métricas de Inventario -->
              <div class="review-grid-metrics">
                <div class="review-stat-box">
                  <span class="stat-box-title">Inventario Físico</span>
                  <strong class="stat-box-val">{{ active.items[i].physicalQty ?? '0' }}</strong>
                  <span class="stat-box-sub">Reportado en tienda</span>
                </div>

                <div class="review-stat-box">
                  <span class="stat-box-title">Stock Ideal</span>
                  <strong class="stat-box-val">{{ active.items[i].idealQty ?? '—' }}</strong>
                  <span class="stat-box-sub">Meta semanal sucursal</span>
                </div>

                <div class="review-stat-box highlight-blue">
                  <span class="stat-box-title">Sugerido Sistema</span>
                  <strong class="stat-box-val text-blue">{{ active.items[i].suggestedQty ?? '0' }}</strong>
                  <span class="stat-box-sub">Fórmula: Ideal - Físico</span>
                </div>

                <div class="review-stat-box highlight-green">
                  <span class="stat-box-title">Solicitado Tienda</span>
                  <strong class="stat-box-val text-accent">{{ active.items[i].requestedQty ?? '0' }}</strong>
                  <span class="stat-box-sub">Cantidad pedida</span>
                </div>
              </div>

              <!-- Advertencias y Justificaciones de tienda -->
              <div class="review-warnings-stack">
                <!-- Advertencia: Solicitó cantidad diferente al sugerido -->
                <div
                  v-if="active.items[i].requestedQty !== active.items[i].suggestedQty"
                  class="review-warning-pill amber"
                >
                  <AppIcon name="alert" :size="16" />
                  <div>
                    <strong>Diferencia con sugerencia:</strong> Tienda pide <b>{{ active.items[i].requestedQty }}</b> y el sistema sugirió <b>{{ active.items[i].suggestedQty }}</b> (diferencia de {{ active.items[i].requestedQty > active.items[i].suggestedQty ? '+' : '' }}{{ active.items[i].requestedQty - active.items[i].suggestedQty }}).
                  </div>
                </div>

                <!-- Advertencia: Existencia física supera stock ideal -->
                <div
                  v-if="Number(active.items[i].physicalQty) > Number(active.items[i].idealQty)"
                  class="review-warning-pill danger"
                >
                  <AppIcon name="alert" :size="16" />
                  <div>
                    <strong>Existencia física supera el stock ideal:</strong> Hay <b>{{ active.items[i].physicalQty }}</b> en tienda y la meta es <b>{{ active.items[i].idealQty }}</b>.
                  </div>
                </div>

                <!-- Advertencia: Sin stock ideal configurado -->
                <div
                  v-if="active.items[i].idealQty == null || active.items[i].idealQty === '' || Number(active.items[i].idealQty) <= 0"
                  class="review-warning-pill subtle"
                >
                  <AppIcon name="info" :size="16" />
                  <div>
                    <strong>Sin stock ideal configurado:</strong> Este producto no tiene meta configurada para esta sucursal.
                  </div>
                </div>

                <!-- Justificación ingresada por el encargado en el conteo -->
                <div
                  v-if="active.items[i].reason"
                  class="review-warning-pill info"
                >
                  <AppIcon name="clipboard" :size="16" />
                  <div>
                    <strong>Justificación de tienda:</strong>
                    <em>"{{ active.items[i].reason }}"</em>
                  </div>
                </div>
              </div>

              <!-- Sección de Aprobación por Logística -->
              <div class="review-approval-panel">
                <div class="row between wrap" style="gap: 12px; align-items: flex-end;">
                  <div style="flex: 1; min-width: 220px;">
                    <label style="font-size: 0.8125rem; font-weight: 700; color: var(--ink);">
                      Cantidad a autorizar
                      <div class="row" style="gap: 8px; margin-top: 5px;">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          v-model="l.approvedQty"
                          required
                          style="font-size: 1.15rem; font-weight: 750; text-align: center; max-width: 130px; border-color: #81bea9; min-height: 42px;"
                        />
                        <span class="muted" style="font-weight: 600; font-size: 0.875rem;">
                          {{ active.items[i].unit }}
                        </span>
                      </div>
                    </label>
                  </div>

                  <!-- Botones rápidos de conveniencia -->
                  <div class="row wrap" style="gap: 6px;">
                    <button
                      type="button"
                      class="ghost"
                      style="font-size: 0.75rem; padding: 6px 12px; min-height: 36px; background: #edf4f5; border-radius: 8px; font-weight: 600;"
                      @click="l.approvedQty = active.items[i].requestedQty"
                      title="Copiar cantidad solicitada por tienda"
                    >
                      Aprobar solicitado ({{ active.items[i].requestedQty }})
                    </button>
                    <button
                      v-if="active.items[i].suggestedQty !== active.items[i].requestedQty"
                      type="button"
                      class="ghost"
                      style="font-size: 0.75rem; padding: 6px 12px; min-height: 36px; background: #eaf2fc; color: #2a619e; border-radius: 8px; font-weight: 600;"
                      @click="l.approvedQty = active.items[i].suggestedQty"
                      title="Ajustar a sugerencia del sistema"
                    >
                      Aprobar sugerido ({{ active.items[i].suggestedQty }})
                    </button>
                  </div>
                </div>

                <!-- Justificación obligatoria si logística cambia la cantidad solicitada -->
                <div
                  v-if="Number(l.approvedQty) !== active.items[i].requestedQty"
                  class="review-logistics-reason"
                >
                  <label style="color: #9c6e17; font-weight: 650; font-size: 0.8125rem;">
                    Motivo del cambio de aprobación por Logística (Obligatorio)
                    <textarea
                      v-model="l.reason"
                      required
                      placeholder="Explica a la tienda por qué se autoriza una cantidad diferente a la solicitada..."
                      style="margin-top: 6px; border-color: #f2d8a5; min-height: 70px;"
                    ></textarea>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template v-if="action === 'invoices'"
          ><p>
            Para dividir el pedido en varias facturas, registre una a la vez e
            indique los productos y cantidades de cada una. Las cantidades
            restantes quedan disponibles para la siguiente factura.
          </p>
          <label
            >Número de factura<input v-model="form.number" required
          /></label>
          <div
            v-for="(l, i) in form.lines"
            class="form-item form-grid three"
          >
            <strong
              >{{ active.items[i].name }}
              <p class="muted">
                Pendiente de facturar:
                {{
                  Math.max(
                    0,
                    active.items[i].approvedQty - billed(active, l.itemId),
                  )
                }}
              </p></strong
            ><label
              >Cantidad en esta factura<input
                type="number"
                min="0"
                step="any"
                v-model="l.quantity"
                required /></label
            ><label
              >Precio unitario Q<input
                type="number"
                min="0"
                step="0.01"
                v-model="l.unitPrice"
                required
            /></label></div
        ></template>
        <template v-if="action === 'receive'">
          <div class="notice" :class="isBodegaReception(active) ? 'info' : ''" style="margin-bottom: 12px; font-size: 0.8125rem;">
            <AppIcon :name="isBodegaReception(active) ? 'warehouse' : 'store'" :size="18" />
            <span v-if="isBodegaReception(active)">
              <strong>Recepción de mercadería en Bodega Central:</strong> Ingrese las cantidades físicas recibidas del proveedor en bodega. Al confirmar, el pedido pasará a estado <b>"En bodega"</b> listo para mandarlo a su sucursal.
            </span>
            <span v-else>
              <strong>Recepción de mercadería en Tienda ({{ active.branchName }}):</strong> Ingrese las cantidades físicas recibidas en la sucursal. Al confirmar, el pedido pasará a estado <b>"En tienda (Recibido)"</b>.
            </span>
          </div>

          <div
            v-if="!isBodegaReception(active) || needsQuickInvoice(active)"
            class="form-item stack-xs"
            style="background: #f8fbfb; border-color: #cde3de;"
          >
            <label style="font-weight: 700; color: var(--ink);">
              {{
                !isBodegaReception(active)
                  ? `Número de factura recibida en tienda (${active.branchName})`
                  : "Número de factura o envío del proveedor"
              }}
              <input
                v-model="form.invoiceNumber"
                :placeholder="
                  !isBodegaReception(active)
                    ? 'Ej. FAC-004512 / Serie A-1029'
                    : 'Ej. FAC-004512 o Envío #102'
                "
                required
              />
            </label>
            <p class="muted" style="font-size: 0.75rem; margin: 0;">
              <template v-if="!isBodegaReception(active)">
                Obligatorio al recibir en sucursal, tanto para
                <b>{{ active.node === 'BODEGA' ? 'pedidos enviados desde Bodega Central' : 'entregas directas del proveedor' }}</b>.
                <span v-if="active.node === 'BODEGA' && invoices(active).length">
                  (Factura origen en bodega: <b>{{ invoices(active).map(i => i.number).join(', ') }}</b>)
                </span>
              </template>
              <template v-else>
                Aún no hay factura registrada en este pedido; se registrará automáticamente junto con la recepción (use "Factura / dividir" antes si desea dividir en varias facturas).
              </template>
            </p>
          </div>

          <div v-for="(l, i) in form.lines" class="form-item stack-sm">
            <strong>{{ active.items[i].name }}</strong>
            <p>
              Aprobado: {{ active.items[i].approvedQty }} · Facturado:
              {{ billed(active, l.itemId) }}
              <span v-if="active.warehouseReceived"
                >· Recibido en bodega:
                {{ active.warehouseReceived[l.itemId] }}</span
              >
            </p>
            <p>
              Recibido anteriormente:
              {{
                (isBodegaReception(active)
                  ? active.warehouseReceived
                  : active.finalReceived)?.[l.itemId] || 0
              }}
            </p>
            <label
              >Recibido físicamente en {{ isBodegaReception(active) ? 'bodega' : 'tienda' }} (esta entrega)<input
                v-model="l.receivedQty"
                type="number"
                min="0"
                step="any"
                required
            /></label>
          </div>
          <label
            >Causa (obligatoria si hay diferencia)<textarea
              v-model="form.cause"
            ></textarea></label
          ><label
            >Evidencia (enlace o referencia verificable, obligatoria si hay
            diferencia)<input v-model="form.evidence" /></label
        ></template>
        <label v-if="action === 'reject'"
          >Motivo<textarea v-model="form.reason" required></textarea>
        </label>
        <template v-if="action === 'resolve'"
          ><div
            v-for="r in state.data.receipts.filter(
              (r) => r.id === active.lastReceiptId,
            )"
            class="notice amber stack-xs"
          >
            <p>Causa: {{ r.cause }}</p>
            <p>Evidencia: {{ r.evidence }}</p>
            <p v-for="l in r.lines.filter((l) => l.hasDifference)">
              {{ l.name }}: esperado {{ l.expectedQty }}, facturado
              {{ l.invoicedQty }}, recibido acumulado {{ l.cumulativeQty }}
              <strong v-if="l.invoicePriceDifference"
                >· Precio facturado distinto del aprobado</strong
              >
            </p>
          </div>
          <label
            >Solución brindada y motivo de aceptación<textarea
              v-model="form.solution"
              required
              placeholder="Ejemplo: proveedor reconoce el faltante y se acepta la entrega con la solución acordada."
            ></textarea>
          </label>
          <p>
            Al autorizar se acepta la cantidad recibida. No se registra
            contabilidad de notas de crédito.
          </p></template
        >
        <template v-if="action === 'dispatch'">
          <div class="dispatch-modal-summary">
            <div class="row between wrap" style="gap: 10px;">
              <div>
                <span class="eyebrow" style="color: #087f75;">ENVÍO DE BODEGA A SUCURSAL</span>
                <h3 style="margin: 2px 0; font-size: 1.1rem; font-weight: 750; color: var(--ink);">
                  Bodega Central → {{ active.branchName }}
                </h3>
                <p class="muted" style="font-size: 0.8125rem; margin: 0;">
                  Pedido #{{ active.id ? active.id.slice(0, 8).toUpperCase() : '' }} · Proveedor: {{ active.supplierName }}
                </p>
              </div>
              <StatusBadge :status="active.status" />
            </div>

            <div class="dispatch-items-box">
              <strong style="font-size: 0.78rem; text-transform: uppercase; color: var(--muted); display: block; margin-bottom: 6px;">
                Productos en bodega a trasladar:
              </strong>
              <div
                v-for="item in active.items"
                :key="item.itemId"
                class="row between"
                style="font-size: 0.85rem; padding: 4px 0; border-bottom: 1px dashed #e3ecef;"
              >
                <span><strong>{{ item.name }}</strong></span>
                <span style="font-weight: 700; color: #087f75;">
                  {{ active.warehouseReceived?.[item.itemId] ?? item.approvedQty }} {{ item.unit }}
                </span>
              </div>
            </div>
          </div>

          <div class="form-grid two">
            <label>
              Método de transporte
              <select v-model="form.transportMethod" required>
                <option v-for="opt in TRANSPORT_OPTIONS" :key="opt" :value="opt">{{ opt }}</option>
              </select>
            </label>

            <label>
              Número de guía / placa / referencia
              <input
                v-model="form.guideNumber"
                placeholder="Ej. Guía GX-84920 o Placa C-452BJT"
                required
              />
            </label>
          </div>

          <label v-if="form.transportMethod === 'Otro'">
            Especifique el método de transporte
            <input
              v-model="form.customTransport"
              placeholder="Nombre de la empresa de transporte o medio de envío"
              required
            />
          </label>

          <label>
            Piloto / Observaciones del traslado (opcional)
            <input
              v-model="form.dispatchNotes"
              placeholder="Nombre del piloto, marchamo o indicaciones para recepción en tienda"
            />
          </label>

          <p class="notice info" style="font-size: 0.8125rem; margin-top: 4px;">
            <AppIcon name="truck" :size="17" />
            <span>
              Al confirmar, el pedido cambiará su estado a <b>"En camino a tienda"</b> y se generará automáticamente la <b>Constancia de Envío en PDF</b> con los datos de transporte y guía.
            </span>
          </p>
        </template>
    <div class="dialog-footer">
      <button type="button" class="secondary" @click="active=null" :disabled="state.loading">Cancelar</button>
      <button class="primary" :disabled="state.loading">
        <AppIcon :name="action === 'dispatch' ? 'file' : 'save'"/>
        {{
          state.loading
            ? 'Procesando…'
            : action === 'receive'
              ? isBodegaReception(active)
                ? 'Confirmar recepción en bodega'
                : 'Confirmar recepción en tienda'
              : action === 'dispatch'
                ? 'Confirmar envío y generar constancia PDF'
                : 'Confirmar y guardar'
        }}
      </button>
    </div>
   </form>
  </AppModal>

  <!-- Modal Generar Orden de Compra Consolidada por Proveedor -->
  <AppModal
    v-if="poModalSupplier"
    :title="'Generar Orden de Compra: ' + poModalSupplier.supplierName"
    subtitle="Constancia general consolidada para todas las sucursales"
    :busy="state.loading"
    icon="file"
    @close="poModalSupplier = null"
  >
    <form @submit.prevent="confirmPurchaseOrder" class="stack-sm">
      <div class="po-modal-summary">
        <div class="row between wrap" style="gap: 10px;">
          <div>
            <span class="eyebrow" style="color: #6b4ba3;">PROVEEDOR SELECCIONADO</span>
            <h3 style="font-size: 1.2rem; font-weight: 750; margin: 2px 0; color: var(--ink);">
              {{ poModalSupplier.supplierName }}
            </h3>
            <p class="muted" style="font-size: 0.8125rem;">
              {{ poModalSupplier.requests.length }} {{ poModalSupplier.requests.length === 1 ? 'pedido autorizado' : 'pedidos autorizados' }} en {{ poModalSupplier.branchList.length }} {{ poModalSupplier.branchList.length === 1 ? 'sucursal' : 'sucursales' }}.
            </p>
          </div>
          <div style="text-align: right;">
            <span class="muted" style="font-size: 0.72rem; text-transform: uppercase; font-weight: 650; display: block;">Monto total de la orden</span>
            <strong style="font-size: 1.35rem; color: #087f75;">{{ money(poModalSupplier.total) }}</strong>
          </div>
        </div>
      </div>

      <div class="po-preview-table-container">
        <h4 style="font-size: 0.875rem; font-weight: 700; margin: 0 0 8px; color: var(--ink);">
          Desglose de sucursales incluidas en la constancia general:
        </h4>
        <div class="po-table-scroll">
          <table class="po-preview-table">
            <thead>
              <tr>
                <th>Sucursal</th>
                <th>ID Pedido</th>
                <th>Destino</th>
                <th>Productos autorizados</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="req in poModalSupplier.requests" :key="req.id">
                <td style="font-weight: 700; color: var(--ink);">{{ req.branchName }}</td>
                <td>
                  <span class="order-reference">#{{ req.id ? req.id.slice(0, 8).toUpperCase() : '' }}</span>
                </td>
                <td>
                  <span class="badge" :class="req.node === 'DIRECTO_TIENDA' ? 'blue' : ''" style="font-size: 0.72rem; padding: 2px 6px;">
                    {{ label(req.node) }}
                  </span>
                </td>
                <td>
                  <div v-for="item in req.items" :key="item.itemId" style="font-size: 0.8125rem; line-height: 1.4;">
                    <strong>{{ item.name }}:</strong> {{ item.approvedQty }} {{ item.unit }}
                  </div>
                </td>
                <td style="text-align: right; font-weight: 700; color: var(--ink);">
                  {{ money(req.total) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <label style="font-weight: 700; font-size: 0.875rem; color: var(--ink); margin-top: 8px;">
        Fecha y hora de entrega comprometida
        <input
          type="datetime-local"
          v-model="poExpectedAt"
          required
          style="margin-top: 5px; font-size: 0.95rem; font-weight: 600;"
        />
      </label>

      <p class="notice info" style="font-size: 0.8125rem; margin-top: 6px;">
        <AppIcon name="clock" :size="16" />
        <span>
          Al confirmar, el estado de todos estos pedidos pasará a <b>"Tomado por proveedor (OC generada)"</b> y se descargará automáticamente la constancia general en PDF.
        </span>
      </p>

      <div class="dialog-footer">
        <button type="button" class="secondary" @click="poModalSupplier = null" :disabled="state.loading">
          Cancelar
        </button>
        <button type="submit" class="primary" :disabled="state.loading" style="background: #6b4ba3;">
          <AppIcon name="file" :size="16" />
          {{ state.loading ? 'Generando orden...' : 'Emitir Orden y Descargar Constancia PDF' }}
        </button>
      </div>
    </form>
  </AppModal>
 </div>
</template>

<style scoped>
.review-header-summary {
  background: #f8fafb;
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 6px;
}

.review-items-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-item-card {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 2px 8px rgba(18, 42, 56, 0.03);
}

.review-item-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  border-bottom: 1px solid #edf2f4;
  padding-bottom: 12px;
}

.review-grid-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  background: #f7fafb;
  border: 1px solid #eef2f5;
  border-radius: 12px;
  padding: 12px;
}

.review-stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4px;
  border-right: 1px solid #edf2f4;
}

.review-stat-box:last-child {
  border-right: none;
}

.stat-box-title {
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
  margin-bottom: 4px;
}

.stat-box-val {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--ink);
  line-height: 1.1;
}

.stat-box-sub {
  font-size: 0.6875rem;
  color: var(--muted);
  margin-top: 3px;
}

.text-blue {
  color: #2864a6;
}

.text-accent {
  color: var(--accent);
}

.review-warnings-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.review-warning-pill {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.review-warning-pill.amber {
  background: #fff9ec;
  color: #946914;
  border: 1px solid #f6e6c4;
}

.review-warning-pill.danger {
  background: #fff2f0;
  color: #b24a38;
  border: 1px solid #fad3ce;
}

.review-warning-pill.subtle {
  background: #f5f8f9;
  color: var(--muted);
  border: 1px solid var(--line);
}

.review-warning-pill.info {
  background: #edf5fb;
  color: #2a618e;
  border: 1px solid #d4e7f6;
}

.review-approval-panel {
  background: #fbfdfc;
  border: 1px solid #d7ebe3;
  border-radius: 12px;
  padding: 14px 16px;
}

.review-logistics-reason {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #d7ebe3;
}

.sku-tag {
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  color: #6a828e;
  background: #edf3f6;
  padding: 1px 6px;
  border-radius: 4px;
}

@media (max-width: 600px) {
  .review-grid-metrics {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .review-stat-box:nth-child(2) {
    border-right: none;
  }
}

.po-consolidation-banner {
  background: #ffffff;
  border: 1.5px solid #dcd1ee;
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 4px;
  box-shadow: 0 4px 16px rgba(107, 75, 163, 0.05);
}

.po-banner-header {
  margin-bottom: 16px;
}

.po-suppliers-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 14px;
}

.po-supplier-action-card {
  background: #faf8fd;
  border: 1px solid #e3d7f3;
  border-radius: 14px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.po-supplier-action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(107, 75, 163, 0.09);
}

.po-supplier-name {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 750;
  color: var(--ink);
}

.po-branches-preview {
  margin: 8px 0 10px;
  font-size: 0.8125rem;
  color: var(--muted);
  line-height: 1.45;
}

.po-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-top: 10px;
  border-top: 1px dashed #e3d7f3;
}

.po-card-total {
  font-size: 1.2rem;
  font-weight: 750;
  color: #6b4ba3;
}

.po-btn-generate {
  background: #6b4ba3 !important;
  border-color: #6b4ba3 !important;
  color: #ffffff !important;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  font-weight: 700;
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.875rem;
  box-shadow: 0 2px 6px rgba(107, 75, 163, 0.25);
}

.po-btn-generate:hover {
  background: #5b3e8c !important;
}

.po-modal-summary {
  background: #fbf9fe;
  border: 1px solid #e9e0f5;
  border-radius: 12px;
  padding: 14px 16px;
}

.po-preview-table-container {
  margin-top: 6px;
}

.po-table-scroll {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.po-preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.po-preview-table th {
  background: #f3eff9;
  color: #4b3670;
  padding: 10px 12px;
  text-align: left;
  font-weight: 700;
  border-bottom: 1px solid #e3d7f3;
}

.po-preview-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f0f4f6;
  vertical-align: top;
}

.po-preview-table tbody tr:last-child td {
  border-bottom: none;
}

.card-status-tracker {
  background: #f7fafb;
  border: 1px solid #e3ecef;
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tracker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tracker-eyebrow {
  font-size: 0.68rem;
  font-weight: 750;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.tracker-current-label {
  font-size: 0.78rem;
  font-weight: 750;
  color: var(--accent, #087f75);
}

.tracker-desc {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ink);
  font-weight: 600;
  line-height: 1.35;
}

.tracker-steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(64px, 1fr));
  gap: 6px;
  padding-top: 6px;
  border-top: 1px dashed #dce7eb;
}

.tracker-step {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.7rem;
  color: #879ba6;
  font-weight: 600;
}

.tracker-dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #e6eef1;
  color: #6b8290;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 800;
  flex-shrink: 0;
}

.tracker-step.is-done {
  color: #087f75;
}

.tracker-step.is-done .tracker-dot {
  background: #d9f3ee;
  color: #087f75;
}

.tracker-step.is-current {
  color: #172d3a;
  font-weight: 750;
}

.tracker-step.is-current .tracker-dot {
  background: #087f75;
  color: #ffffff;
  box-shadow: 0 0 0 3px rgba(8, 127, 117, 0.16);
}

.tracker-step-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dispatch-info-pill {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: #edf5fb;
  border: 1px solid #d2e5f5;
  color: #21537d;
  border-radius: 9px;
  padding: 7px 10px;
  font-size: 0.78rem;
  line-height: 1.35;
}

.store-invoice-pill {
  background: #edf8f5;
  border-color: #c5e6dc;
  color: #0b645c;
}

.store-chip {
  background: #edf8f5 !important;
  border-color: #c5e6dc !important;
  color: #0b645c !important;
}

.dispatch-modal-summary {
  background: #f7fafb;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dispatch-items-box {
  background: #ffffff;
  border: 1px solid #e4ecef;
  border-radius: 10px;
  padding: 10px 12px;
}
</style>
