<script setup>
import { ref, computed } from "vue";
import { state, label } from "../services/operations";
import { metrics } from "../domain/metrics";
const branch = ref(""),
  from = ref(""),
  to = ref(""),
  tab = ref("conteos");
const inScope = (row) =>
  (!branch.value || row.branchId === branch.value) &&
  (!from.value || (row.at || row.createdAt || "").slice(0, 10) >= from.value) &&
  (!to.value || (row.at || row.createdAt || "").slice(0, 10) <= to.value);
const counts = computed(() =>
  state.data.inventoryCounts
    .filter(inScope)
    .sort((a, b) => b.at.localeCompare(a.at)),
);
const requests = computed(() =>
  state.data.pedidos.filter((p) => p.schemaVersion === 2 && inScope(p)),
);
const kpi = computed(() => metrics(requests.value));
const branchName = (id) =>
  state.data.sucursales.find((b) => b.id === id)?.nombre || id;
const tables = computed(() =>
  tab.value === "movimientos"
    ? state.data.movements.filter(inScope)
    : tab.value === "auditoria"
      ? state.data.auditEvents.filter(inScope)
      : state.data.pedidos.filter(
          (p) =>
            p.schemaVersion !== 2 &&
            (!branch.value || (p.id_sucursal || p.tienda_id) === branch.value),
        ),
);
const n = (value) => (value === null ? "Sin datos" : `${value}%`);
function exportCsv() {
  const rows = [
    [
      "Sucursal",
      "Fecha",
      "Producto",
      "Fisico",
      "Ideal",
      "Sugerido",
      "Solicitado",
      "Motivo",
    ],
    ...counts.value.flatMap((c) =>
      c.lines.map((l) => [
        branchName(c.branchId),
        c.at,
        l.name,
        l.physicalQty,
        l.idealQty,
        l.suggestedQty,
        l.requestedQty,
        l.reason,
      ]),
    ),
  ];
  const escape = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'" + "$&")
      .replaceAll('"', '""') +
    '"';
  const url = URL.createObjectURL(
    new Blob(
      ["\uFEFF" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "historial-conteos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const compliance=computed(()=>state.data.weeklyCompliance.filter(b=>!branch.value||b.branchId===branch.value));
const completed=computed(()=>compliance.value.filter(b=>b.completed).length);
const alerts=computed(()=>state.data.alerts.filter(a=>!a.resolved&&inScope(a)));
const person=id=>state.data.users?.find(u=>u.id===id)?.name||id||'Sistema';
const date=value=>value?new Date(value).toLocaleString('es-GT'):'Sin fecha';
const fields={name:'Nombre',nombre:'Nombre',active:'Activo',role:'Rol',companyIds:'Empresas',branchIds:'Sucursales',email:'Correo',precio_compra:'Precio',id_proveedor:'Proveedor',unidad_compra:'Unidad',status:'Estado',ideals:'Stock ideal',calendars:'Calendario',systemName:'Nombre del sistema',logoUrl:'Logotipo'};
const display=value=>value===undefined||value===null?'Sin registrar':typeof value==='boolean'?(value?'Sí':'No'):typeof value==='object'?JSON.stringify(value):String(value);
const changes=row=>[...new Set([...Object.keys(row.before||{}),...Object.keys(row.after||{})])].filter(k=>k!=='id'&&JSON.stringify(row.before?.[k])!==JSON.stringify(row.after?.[k])).map(k=>({key:k,title:fields[k]||label(k),before:display(row.before?.[k]),after:display(row.after?.[k])}));
</script>
<template><div class="stack">
<PageHeader title="Vista general" description="El pulso de sus sucursales y la trazabilidad de cada operación." eyebrow="CENTRO DE CONTROL" icon="chart"><button class="secondary" @click="exportCsv"><AppIcon name="download"/>Exportar conteos</button></PageHeader>
<div class="toolbar panel"><label class="grow">Sucursal<select v-model="branch"><option value="">Todas las autorizadas</option><option v-for="b in state.data.sucursales" :key="b.id" :value="b.id">{{ b.nombre }}</option></select></label><label>Desde<input type="date" v-model="from"/></label><label>Hasta<input type="date" v-model="to" :min="from||undefined"/></label></div>
<div class="metrics-grid"><MetricCard title="Entrega a tiempo" :value="n(kpi.onTime)" hint="Recepción final en tienda" icon="clock" :percent="kpi.onTime"/><MetricCard title="Entregas completas" :value="n(kpi.inFull)" hint="Cantidad aprobada cubierta" icon="box" tone="blue" :percent="kpi.inFull"/><MetricCard title="Solicitudes rectificadas" :value="n(kpi.rectified)" hint="Cambios durante la revisión" icon="edit" tone="purple"/><MetricCard title="Fuera de calendario" :value="n(kpi.emergencies)" hint="Pedidos extraordinarios" icon="calendar" tone="amber"/></div>
<div class="dashboard-columns"><section class="panel stack-sm"><div class="row between wrap"><h2 class="section-title"><AppIcon name="clipboard"/>Conteo de esta semana</h2><span class="badge green">{{ completed }} / {{ compliance.length }}</span></div><div class="progress-track"><span :style="{width:(compliance.length?completed/compliance.length*100:0)+'%'}"></span></div><div v-for="b in compliance" :key="b.branchId" class="branch-compliance"><div class="row"><span class="icon-tile" :class="{amber:!b.completed}"><AppIcon :name="b.completed?'checkCircle':'clock'"/></span><div><strong>{{ b.branchName }}</strong><p class="muted">{{ b.completed?'Todos los productos contados':'Conteo completo pendiente' }}</p></div></div><span class="badge" :class="b.completed?'green':'amber'">{{ b.completed?'Listo':'Pendiente' }}</span></div><p v-if="!compliance.length" class="muted">No hay sucursales activas en esta selección.</p></section>
<section class="panel stack-sm"><div class="row between"><h2 class="section-title"><AppIcon name="alert"/>Diferencias abiertas</h2><span class="badge amber">{{ alerts.length }}</span></div><EmptyState v-if="!alerts.length" title="Sin diferencias pendientes" description="No hay alertas abiertas para estos filtros." icon="checkCircle"/><div v-for="a in alerts" :key="a.id" class="alert-entry"><strong>{{ branchName(a.branchId) }}</strong><p>{{ a.cause }}</p><small class="muted">Responsable: {{ person(a.responsibleId) }}</small></div></section></div>
<div class="notice subtle"><AppIcon name="info"/><div>Tiempo promedio hasta tienda: <strong>{{ kpi.leadHours===null?'Sin datos':kpi.leadHours+' horas' }}</strong>. La existencia se confirma con el conteo manual; las entradas posteriores no descuentan consumo.</div></div>
<div class="row between wrap"><h2 class="section-title"><AppIcon name="history"/>Historial de la operación</h2><span class="muted">{{ kpi.total }} solicitudes en el período</span></div>
<div class="tabs-scroll segmented"><button v-for="[v,t] in [['conteos','Conteos'],['movimientos','Movimientos'],['auditoria','Cambios'],['historico','Pedidos anteriores']]" :key="v" :class="{active:tab===v}" :aria-pressed="tab===v" @click="tab=v">{{ t }}</button></div>
<template v-if="tab==='conteos'"><EmptyState v-if="!counts.length" title="Aún no hay conteos" description="Los conteos completos aparecerán aquí con sus cantidades y motivos." icon="clipboard"/><details v-for="c in counts" :key="c.id" class="history-card panel"><summary><div class="row"><span class="icon-tile"><AppIcon name="clipboard"/></span><div><h3>{{ branchName(c.branchId) }}</h3><p class="muted">{{ date(c.at) }} · {{ c.lines.length }} productos</p></div></div><AppIcon name="down" class="expand-icon"/></summary><div class="history-body stack-sm"><p class="muted">Responsable: {{ person(c.createdBy) }} · Semana: {{ c.week }}</p><div class="history-lines"><div v-for="l in c.lines" :key="l.itemId" class="line-card"><strong>{{ l.name }}</strong><dl class="quantity-values"><div><dt>Físico</dt><dd>{{ l.physicalQty }}</dd></div><div><dt>Ideal</dt><dd>{{ l.idealQty }}</dd></div><div><dt>Sugerido</dt><dd>{{ l.suggestedQty }}</dd></div><div><dt>Solicitado</dt><dd>{{ l.requestedQty }}</dd></div></dl><p v-if="l.reason" class="line-reason">{{ l.reason }}</p></div></div></div></details></template>
<template v-else><p v-if="tab==='historico'" class="notice subtle">Los pedidos anteriores se conservan para consulta; no se convierten en conteos completos.</p><EmptyState v-if="!tables.length" title="Sin registros en este período" description="Cambie la sucursal o las fechas para consultar otros registros." icon="history"/><div class="timeline"><article v-for="row in tables" :key="row.id" class="timeline-item"><span class="icon-tile"><AppIcon :name="tab==='movimientos'?'box':'history'"/></span><div class="timeline-content stack-xs"><div class="row between wrap"><h3>{{ label(row.action||row.type||row.estado) || 'Registro' }}</h3><span class="time">{{ date(row.at||row.fecha) }}</span></div><p class="muted">{{ branchName(row.branchId||row.id_sucursal||row.tienda_id)||'Administración general' }} · {{ person(row.actorId) }}</p><p v-if="row.itemId">{{ state.data.productos.find(p=>p.id===row.itemId)?.nombre||row.itemId }}: <strong>{{ row.qty }}</strong> · Saldo registrado {{ row.balanceAfter }}</p><p v-if="row.reason">{{ row.reason }}</p><details class="activity-detail"><summary>Ver cambios y detalles</summary><div v-if="changes(row).length" class="diff-list"><div v-for="change in changes(row)" :key="change.key" class="diff-item"><strong>{{ change.title }}</strong><del>{{ change.before }}</del><ins>{{ change.after }}</ins></div></div><div v-else class="diff-list"><div v-for="(value,key) in row" :key="key" class="diff-item"><strong>{{ fields[key]||label(key) }}</strong><span class="break-text">{{ display(value) }}</span></div></div></details></div></article></div></template>
</div></template>
