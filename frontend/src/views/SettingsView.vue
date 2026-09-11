<script setup>
import { ref, computed, watch } from "vue";
import { state, command, perform } from "../services/operations";
const branchId = ref(""),
  ideals = ref({}),
  calendars = ref({}),
  message = ref(""),
  reasons = ref({});
const products = computed(() =>
  state.data.productos.filter(
    (p) =>
      p.active !== false &&
      (!p.branchIds || p.branchIds.includes(branchId.value)),
  ),
);
const suppliers = computed(() =>
  state.data.proveedores.filter((s) =>
    products.value.some((p) => p.id_proveedor === s.id),
  ),
);
const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
function load() {
  const s = state.data.branchSettings.find(
    (s) => s.branchId === branchId.value,
  );
  ideals.value = {};
  calendars.value = {};
  for (const p of products.value) ideals.value[p.id] = s?.ideals?.[p.id] ?? "";
  for (const p of suppliers.value)
    calendars.value[p.id] = JSON.parse(
      JSON.stringify(s?.calendars?.[p.id] || { days: [], cutoff: "" }),
    );
}
watch(branchId, load);
const save = () =>
  perform(async () => {
    await command("settings", {
      branchId: branchId.value,
      ideals: ideals.value,
      calendars: calendars.value,
    });
    message.value = "Configuración guardada con historial.";
  });
const propose = () =>
  perform(async () => {
    await command("stock-proposals", { branchId: branchId.value });
    message.value = "Propuesta calculada. Revísela antes de autorizar.";
  });
const accept = (id) =>
  perform(async () => {
    await command(`stock-proposals/${id}/accept`, {
      reason: reasons.value[id],
    });
    load();
    message.value = "Cambio de stock ideal autorizado.";
  });
</script>
<template>
  <div class="stack">
    <PageHeader title="Stock y calendario" description="Planifique el abastecimiento de cada sucursal." eyebrow="PLANIFICACIÓN" icon="sliders"/>
    <p>
      El stock ideal se define manualmente por sucursal. Las propuestas basadas
      en pedidos nunca se aplican sin autorización.
    </p>
    <p v-if="message" class="success">{{ message }}</p>
    <label class="branch-picker"
      >Sucursal<select v-model="branchId">
        <option value="">Seleccione</option>
        <option
          v-for="b in state.data.sucursales.filter((b) => b.active !== false)"
          :value="b.id"
        >
          {{ b.nombre }}
        </option>
      </select></label
    >
    <EmptyState v-if="!branchId" title="Elija una sucursal" description="Configure sus cantidades ideales y días de pedido por proveedor." icon="store"/>
    <form v-if="branchId" @submit.prevent="save" class="stack">
      <section class="panel">
        <h2 class="section-title">Stock para cubrir la semana</h2>
        <div class="form-grid">
          <label v-for="p in products"
            >{{ p.nombre }} · {{ p.unidad_compra || p.presentacion
            }}<input
              type="number"
              min="0"
              step="any"
              v-model="ideals[p.id]"
              required
          /></label>
        </div>
      </section>
      <section class="panel stack">
        <h2 class="section-title">
          Calendario por proveedor · Hora de Guatemala
        </h2>
        <div v-for="s in suppliers" class="calendar-card stack-sm">
          <h3 class="section-title">{{ s.nombre }}</h3>
          <div class="day-pills">
            <label v-for="(day, i) in days"
              ><input
                type="checkbox"
                :value="i"
                v-model="calendars[s.id].days"
              /><span>{{ day }}</span></label
            >
          </div>
          <label class="calendar-cutoff"
            >Hora límite<input
              type="time"
              v-model="calendars[s.id].cutoff"
              required
          /></label>
        </div>
      </section>
      <button class="primary" :disabled="state.loading">
        <AppIcon name="save"/>Guardar configuración</button
      ><button
        type="button"
        class="secondary"
        @click="propose"
        :disabled="state.loading"
      >
        <AppIcon name="spark"/>Calcular propuesta con historial
      </button>
    </form>
    <article
      v-for="p in state.data.stockProposals.filter(
        (p) => p.branchId === branchId && p.status === 'PENDIENTE',
      )"
      class="panel stack-sm"
    >
      <h2 class="section-title">Propuesta pendiente</h2>
      <p>{{ p.method }}</p>
      <p class="notice amber">
        Los pedidos no equivalen al consumo. Revise si el resultado alcanza para
        la semana antes de autorizar.
      </p>
      <div class="stack-xs"><div v-for="(v,id) in p.proposed" :key="id" class="compare-row"><strong>{{ state.data.productos.find(x=>x.id===id)?.nombre || id }}</strong><span>{{ p.previous[id] }} <AppIcon name="arrow" :size="16"/> <strong class="new-value">{{ v }}</strong></span></div></div>
      <label
        >Motivo de autorización<textarea
          v-model="reasons[p.id]"
        ></textarea></label
      ><button
        class="primary"
        @click="accept(p.id)"
        :disabled="state.loading || !reasons[p.id]?.trim()"
      >
        Autorizar cambio
      </button>
    </article>
  </div>
</template>
