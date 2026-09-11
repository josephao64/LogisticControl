<script setup>
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { state, command, perform, money, label } from "../services/operations";
const route = useRoute(),
  branch = ref(""),
  supplier = ref(""),
  status = ref(""),
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
const requests = computed(() =>
  state.data.pedidos.filter(
    (p) =>
      p.schemaVersion === 2 &&
      (!search.value || `${p.branchName} ${p.supplierName} ${p.id}`.toLowerCase().includes(search.value.toLowerCase())) &&
      (!branch.value || p.branchId === branch.value) &&
      (!supplier.value || p.supplierId === supplier.value) &&
      (!status.value || p.status === status.value),
  ),
);
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
  },
);
function open(p, kind) {
  active.value = p;
  action.value = kind;
  success.value = "";
  form.value = {
    number: "",
    reason: "",
    solution: "",
    reference: "",
    cause: "",
    evidence: "",
    lines: p.items.map((l) => ({
      itemId: l.itemId,
      approvedQty: l.approvedQty ?? l.requestedQty,
      reason: "",
      quantity: Math.max(0, (l.approvedQty ?? 0) - billed(p, l.itemId)),
      unitPrice: l.unitPrice,
      receivedQty: "",
    })),
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
    const data = { ...form.value };
    if (action.value === "invoices")
      data.lines = data.lines.filter((l) => Number(l.quantity) > 0);
    await command(`requests/${active.value.id}/${action.value}`, data);
    active.value = null;
    success.value = "Operación registrada con historial.";
  });
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
  pdf.setFontSize(18);
  pdf.text("Orden de compra", 14, 18);
  pdf.setFontSize(10);
  pdf.text(`Referencia: ${order.id}`, 14, 27);
  pdf.text(`Proveedor: ${order.supplierName}`, 14, 34);
  pdf.text(
    `Entrega comprometida: ${new Date(order.expectedAt).toLocaleString("es-GT")}`,
    14,
    41,
  );
  let y = 50;
  for (const [node, assignments] of Object.entries(order.groups)) {
    for (const a of assignments) {
      if (y > 235) {
        pdf.addPage();
        y = 18;
      }
      const company =
        state.data.empresas.find((e) => e.id === a.companyId)?.nombre ||
        a.companyId;
      pdf.text(`${label(node)} / ${a.branchName}`, 14, y);
      pdf.text(`Facturar a: ${company} / Sucursal: ${a.branchName}`, 14, y + 6);
      autoTable(pdf, {
        startY: y + 10,
        head: [["Producto", "Unidad", "Cantidad", "Precio Q", "Total Q"]],
        body: a.items.map((l) => [
          l.name,
          l.unit,
          l.approvedQty,
          l.unitPrice,
          (l.approvedQty * l.unitPrice).toFixed(2),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] },
      });
      y = pdf.lastAutoTable.finalY + 14;
    }
  }
  if (y > 255) {
    pdf.addPage();
    y = 20;
  }
  pdf.text(`Total: ${money(order.total)}`, 14, y);
  pdf.save(`Orden-${order.id}.pdf`);
}
</script>
<template>
 <div class="stack">
  <PageHeader :title="route.path === '/logistica' ? 'Solicitudes y compras' : 'Recepciones y entregas'" description="Cada pedido, desde el conteo hasta la entrega final." eyebrow="OPERACIÓN" :icon="route.path === '/logistica' ? 'clipboard' : 'truck'" />
  <p v-if="success" class="success" role="status"><AppIcon name="checkCircle"/>{{ success }}</p>
  <div class="toolbar panel">
   <label class="filter-search">Buscar pedido<div class="field-with-icon"><AppIcon name="search"/><input v-model="search" placeholder="Sucursal, proveedor o referencia" type="search"/></div></label>
   <label>Sucursal<select v-model="branch"><option value="">Todas las autorizadas</option><option v-for="b in state.data.sucursales" :key="b.id" :value="b.id">{{ b.nombre }}</option></select></label>
   <label>Proveedor<select v-model="supplier"><option value="">Todos</option><option v-for="s in state.data.proveedores" :key="s.id" :value="s.id">{{ s.nombre }}</option></select></label>
   <label>Estado<select v-model="status"><option value="">Todos</option><option v-for="s in [...new Set(state.data.pedidos.filter(p=>p.schemaVersion===2).map(p=>p.status))]" :key="s" :value="s">{{ label(s) }}</option></select></label>
  </div>
  <div class="row between wrap"><span class="filter-summary">{{ requests.length }} pedidos encontrados</span><div class="segmented" aria-label="Presentación"><button :class="{active:view==='cards'}" @click="view='cards'" :aria-pressed="view==='cards'"><AppIcon name="board"/>Tarjetas</button><button :class="{active:view==='list'}" @click="view='list'" :aria-pressed="view==='list'"><AppIcon name="list"/>Lista</button></div></div>
  <form v-if="selected.length && logistics" @submit.prevent="consolidate" class="selection-panel stack-sm">
   <div class="row between wrap"><strong>{{ selected.length }} solicitudes para consolidar</strong><button type="button" class="ghost" @click="selected=[]">Limpiar selección</button></div>
   <p>Seleccione solicitudes aprobadas de un mismo proveedor. La orden separa empresas, sucursales y destinos.</p>
   <div class="row wrap"><label class="grow">Entrega comprometida en tienda<input type="datetime-local" v-model="expectedAt" required/></label><button class="primary" :disabled="state.loading"><AppIcon name="file"/>Generar orden</button></div>
  </form>
  <EmptyState v-if="!requests.length" title="No hay pedidos en esta vista" description="Pruebe con otro filtro o revise los conteos de sus sucursales." icon="clipboard"/>
  <div class="orders-grid" :class="{'list-view':view==='list'}">
   <article v-for="p in requests" :key="p.id" class="order-card" :class="{selected:selected.includes(p.id)}">
    <div class="order-top"><span class="icon-tile"><AppIcon :name="p.node==='BODEGA'?'warehouse':'store'"/></span><StatusBadge :status="p.status"/></div>
    <div class="order-main"><h2>{{ p.branchName }}</h2><p>{{ p.supplierName }}</p><p class="order-reference">{{ p.id }}</p></div>
    <div class="order-meta"><span><AppIcon name="calendar" :size="15"/>{{ new Date(p.createdAt).toLocaleDateString('es-GT') }}</span><span>{{ label(p.node) }}</span></div>
    <div class="order-preview">{{ p.items.slice(0,2).map(l=>l.name).join(' · ') }}<span v-if="p.items.length>2"> y {{ p.items.length-2 }} más</span></div>
    <div class="order-summary"><span>{{ p.items.length }} productos</span><strong>{{ money(p.total) }}</strong></div>
    <details class="order-details"><summary>Productos y facturas <AppIcon name="down" :size="16"/></summary><div class="stack-sm">
     <div v-for="l in p.items" :key="l.itemId" class="line-card"><strong>{{ l.name }}</strong><dl class="quantity-values"><div><dt>Físico</dt><dd>{{ l.physicalQty }}</dd></div><div><dt>Sugerido</dt><dd>{{ l.suggestedQty }}</dd></div><div><dt>Solicitado</dt><dd>{{ l.requestedQty }}</dd></div><div><dt>Aprobado</dt><dd>{{ l.approvedQty ?? '—' }}</dd></div><div><dt>Facturado</dt><dd>{{ billed(p,l.itemId) }}</dd></div><div><dt>En tienda</dt><dd>{{ p.finalReceived?.[l.itemId] ?? '—' }}</dd></div></dl><p v-if="l.reason" class="line-reason">Encargado: {{ l.reason }}</p><p v-if="l.approvalReason" class="line-reason">Logística: {{ l.approvalReason }}</p></div>
     <span v-for="i in invoices(p)" :key="i.id" class="invoice-chip"><AppIcon name="receipt" :size="16"/>Factura {{ i.number }} · {{ money(i.total) }}</span>
    </div></details>
    <p v-if="p.resolution" class="notice">Solución: {{ p.resolution }}</p>
    <div class="order-actions">
     <template v-if="logistics && p.status==='PENDIENTE'"><button class="primary" @click="open(p,'approve')"><AppIcon name="check"/>Revisar</button><button class="ghost" @click="open(p,'reject')">Rechazar</button></template>
     <label v-if="logistics && p.status==='APROBADO'" class="check-label"><input type="checkbox" v-model="selected" :value="p.id"/>Incluir en orden de compra</label>
     <button v-if="canInvoice(p)" class="secondary" @click="open(p,'invoices')"><AppIcon name="receipt"/>Factura / dividir</button>
     <button v-if="canReceive(p)" class="primary" @click="open(p,'receive')"><AppIcon name="box"/>Recibir</button>
     <button v-if="p.status.startsWith('DIFERENCIA_') && logistics" class="primary" @click="open(p,'resolve')"><AppIcon name="shield"/>Resolver diferencia</button>
     <button v-if="p.status==='RECIBIDO_BODEGA' && ['Administrador','Bodega'].includes(state.profile.role)" class="primary" @click="open(p,'dispatch')"><AppIcon name="truck"/>Despachar</button>
    </div>
   </article>
  </div>
  <section v-if="state.data.purchaseOrders.length" class="stack-sm"><h2 class="section-title"><AppIcon name="file"/>Órdenes de compra</h2><div class="purchase-grid"><article v-for="o in state.data.purchaseOrders" :key="o.id" class="purchase-card stack-sm"><span class="icon-tile blue"><AppIcon name="file"/></span><h3>{{ o.supplierName }}</h3><p class="muted">{{ new Date(o.at).toLocaleDateString('es-GT') }}</p><strong>{{ money(o.total) }}</strong><button class="secondary" @click="download(o)"><AppIcon name="download"/>Descargar PDF</button></article></div></section>
  <AppModal v-if="active" :title="{approve:'Revisar solicitud',reject:'Rechazar solicitud',invoices:'Factura por sucursal',receive:'Registrar recepción',resolve:'Resolver diferencia',dispatch:'Despachar a tienda'}[action]" :subtitle="`${active.branchName} · ${active.supplierName}`" :busy="state.loading" icon="clipboard" @close="active=null">
   <form @submit.prevent="submit" class="stack-sm"><p v-if="state.error" role="alert" class="error">{{ state.error }}</p>
        <template v-if="action === 'approve'"
          ><div v-for="(l, i) in form.lines" class="form-item stack-sm">
            <strong>{{ active.items[i].name }}</strong>
            <p>Solicitado: {{ active.items[i].requestedQty }}</p>
            <label
              >Aprobar<input
                type="number"
                min="0"
                step="any"
                v-model="l.approvedQty"
                required /></label
            ><label
              v-if="Number(l.approvedQty) !== active.items[i].requestedQty"
              >Motivo del cambio<textarea
                v-model="l.reason"
                required
              ></textarea>
            </label></div
        ></template>
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
        <template v-if="action === 'receive'"
          ><p>
            Ingrese únicamente las cantidades que están llegando ahora,
            incluyendo cero. Se sumarán a las recepciones anteriores. Compare lo
            aprobado, facturado y recibido. Una diferencia quedará abierta para
            Logística.
          </p>
          <div v-for="(l, i) in form.lines" class="form-item stack-sm">
            <strong>{{ active.items[i].name }}</strong>
            <p>
              Aprobado: {{ active.items[i].approvedQty }} · Facturado:
              {{ billed(active, l.itemId) }}
              <span v-if="active.warehouseReceived"
                >· Despachado de bodega:
                {{ active.warehouseReceived[l.itemId] }}</span
              >
            </p>
            <p>
              Recibido anteriormente:
              {{
                (active.status.includes("BODEGA")
                  ? active.warehouseReceived
                  : active.finalReceived)?.[l.itemId] || 0
              }}
            </p>
            <label
              >Recibido físicamente en esta entrega<input
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
        <label v-if="action === 'dispatch'"
          >Referencia del traslado o guía<input
            v-model="form.reference"
            required /></label
        >
    <div class="dialog-footer"><button type="button" class="secondary" @click="active=null" :disabled="state.loading">Cancelar</button><button class="primary" :disabled="state.loading"><AppIcon name="save"/>{{ state.loading?'Guardando…':'Confirmar y guardar' }}</button></div>
   </form>
  </AppModal>
 </div>
</template>
