<script setup>
import { ref, computed, watch } from "vue";
import { state, command, perform } from "../services/operations";
const branchId = ref(""),
  lines = ref({}),
  reason = ref(""),
  message = ref(""), search = ref(""), pendingOnly = ref(false);
const products = computed(() =>
  state.data.productos.filter(
    (p) =>
      p.active !== false &&
      (!p.branchIds || p.branchIds.includes(branchId.value)),
  ),
);
const settings = computed(() =>
  state.data.branchSettings.find((s) => s.branchId === branchId.value),
);
const key = () => `conteo:${state.profile.uid}:${branchId.value}`;
watch(branchId, () => {
  try {
    const d = JSON.parse(localStorage.getItem(key()) || "{}");
    lines.value = d.lines || {};
    reason.value = d.reason || "";
  } catch {
    lines.value = {};
  }
  for (const p of products.value)
    lines.value[p.id] ||= {
      physicalQty: "",
      requestedQty: "",
      reason: "",
      manual: false,
    };

});
watch(
  [lines, reason],
  () => {
    if (branchId.value)
      localStorage.setItem(
        key(),
        JSON.stringify({ lines: lines.value, reason: reason.value }),
      );
  },
  { deep: true },
);
const suggestion = (p) =>
  Math.max(
    (settings.value?.ideals?.[p.id] ?? 0) -
      Number(lines.value[p.id]?.physicalQty || 0),
    0,
  );
function changed(p) {
  if (!lines.value[p.id].manual) lines.value[p.id].requestedQty = suggestion(p);
}
const complete = computed(
  () =>
    products.value.length > 0 &&
    products.value.every((p) => {
      const l = lines.value[p.id];
      return (
        l &&
        l.physicalQty !== "" &&
        l.physicalQty !== null &&
        Number(l.physicalQty) >= 0 &&
        Number.isFinite(Number(l.physicalQty)) &&
        l.requestedQty !== "" &&
        Number(l.requestedQty) >= 0 &&
        (Number(l.requestedQty) === suggestion(p) || l.reason.trim())
      );
    }),
);
const progress = computed(
  () =>
    products.value.filter(
      (p) =>
        lines.value[p.id]?.physicalQty !== "" &&
        lines.value[p.id]?.physicalQty != null,
    ).length,
);
const filled = p => lines.value[p.id]?.physicalQty !== '' && lines.value[p.id]?.physicalQty != null;
const visibleProducts = computed(() => products.value.filter(p => (!search.value || `${p.nombre} ${p.sku || ''}`.toLowerCase().includes(search.value.toLowerCase())) && (!pendingOnly.value || !filled(p))));
const percent = computed(() => products.value.length ? Math.round(progress.value / products.value.length * 100) : 0);
const requestedLines = computed(() => products.value.filter(p => Number(lines.value[p.id]?.requestedQty) > 0).length);
watch(products, () => { for (const p of products.value) lines.value[p.id] ||= {physicalQty:'', requestedQty:'', reason:'', manual:false}; });
function physicalChange(p,value) { lines.value[p.id].physicalQty=value; changed(p); }
async function submit() {
  await perform(async () => {
    const result = await command("counts", {
      branchId: branchId.value,
      reason: reason.value,
      lines: products.value.map((p) => ({
        itemId: p.id,
        ...lines.value[p.id],
      })),
    });
    message.value = result.message;
    const storage = key();
    branchId.value = "";
    lines.value = {};
    localStorage.removeItem(storage);
  });
}
</script>
<template><div class="stack"><PageHeader title="Conteo semanal" eyebrow="Inventario de sucursal" icon="clipboard" description="Revisa cada producto y prepara el abastecimiento de tu semana."><label class="branch-picker">Sucursal<select v-model="branchId"><option value="">Selecciona tu sucursal</option><option v-for="b in state.data.sucursales.filter(b=>b.active!==false)" :key="b.id" :value="b.id">{{b.nombre}}</option></select></label></PageHeader>
<div v-if="message" class="success" role="status"><AppIcon name="checkCircle"/>{{message}}</div>
<EmptyState v-if="!branchId" icon="store" title="Comienza por tu sucursal" description="Selecciona la tienda para cargar sus productos y recuperar tu último borrador."/>
<template v-else><div v-if="!settings" class="notice amber"><AppIcon name="sliders"/><div><strong>Falta preparar esta sucursal</strong><p>Logística debe configurar el stock ideal y el calendario antes del conteo.</p></div></div>
<form v-else class="stack" @submit.prevent="submit"><section class="count-progress"><div class="progress-circle" :style="{'--progress':percent+'%'}"><span>{{percent}}%</span></div><div class="grow"><h2>{{progress}} de {{products.length}} productos contados</h2><p>Ingresa <strong>0</strong> cuando no haya existencias. Todas las casillas deben completarse.</p></div><span class="autosave"><AppIcon name="save" :size="16"/>Borrador en este dispositivo</span></section>
<div class="toolbar"><div class="field-with-icon filter-search"><AppIcon name="search" :size="18"/><input v-model="search" type="search" placeholder="Buscar producto o código" aria-label="Buscar producto"></div><button type="button" :class="pendingOnly?'primary':'secondary'" @click="pendingOnly=!pendingOnly" :aria-pressed="pendingOnly"><AppIcon :name="pendingOnly?'list':'filter'" :size="17"/>{{pendingOnly?'Ver todos':'Solo sin contar'}}</button><span class="filter-summary">{{visibleProducts.length}} productos</span></div>
<div class="product-grid"><article v-for="p in visibleProducts" :key="p.id" class="product-card" :class="{counted:filled(p)}"><header class="product-card-heading"><span class="icon-tile"><AppIcon name="box"/></span><div class="grow"><h3>{{p.nombre}}</h3><p>{{p.unidad_compra||p.presentacion||'Unidad'}} <span v-if="p.sku">· {{p.sku}}</span></p></div><AppIcon v-if="filled(p)" name="checkCircle" style="color:var(--accent)"/></header><div class="product-fields"><QuantityField :model-value="lines[p.id].physicalQty" @update:model-value="physicalChange(p,$event)" label="Existencia física" required/><QuantityField v-model="lines[p.id].requestedQty" @change="lines[p.id].manual=true" label="Cantidad a pedir" required/></div><div class="product-hint"><span>Stock ideal <b>{{settings.ideals?.[p.id]??'—'}}</b></span><span>Sugerencia <b>{{suggestion(p)}}</b></span></div><div v-if="lines[p.id].requestedQty!=='' && Number(lines[p.id].requestedQty)!==suggestion(p)" class="adjustment-field"><label>¿Por qué ajustas la sugerencia?<textarea v-model="lines[p.id].reason" placeholder="Explica el motivo del cambio" required></textarea></label></div></article></div>
<EmptyState v-if="!visibleProducts.length" icon="checkCircle" :title="pendingOnly?'No hay productos pendientes en este filtro':'No encontramos ese producto'" description="Cambia la búsqueda para ver los demás productos."/>
<details class="panel"><summary class="row" style="cursor:pointer;min-height:32px"><AppIcon name="history" :size="18"/><span>¿Es un conteo adicional de esta semana?</span></summary><label style="margin-top:16px">Motivo del nuevo conteo<textarea v-model="reason" placeholder="Obligatorio si ya enviaste un conteo esta semana."></textarea></label></details>
<div class="sticky-actions"><div class="action-label"><strong>{{requestedLines}} productos a solicitar</strong><p>{{complete?'Conteo completo. Listo para enviar.':`${products.length-progress} productos por contar`}}</p></div><button class="primary" :disabled="!complete||state.loading"><AppIcon :name="state.loading?'refresh':'checkCircle'" :class="{spin:state.loading}" :size="18"/>{{state.loading?'Guardando…':'Guardar y enviar'}}</button></div></form></template></div></template>
