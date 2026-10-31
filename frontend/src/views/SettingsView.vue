<script setup>
import { ref, computed, watch } from "vue";
import { state, command, perform } from "../services/operations";

const branchId = ref(""),
  ideals = ref({}),
  calendars = ref({}),
  message = ref(""),
  reasons = ref({}),
  activeTab = ref("all"),
  search = ref("");

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

const unassignedProducts = computed(() =>
  products.value.filter(
    (p) => !suppliers.value.some((s) => s.id === p.id_proveedor),
  ),
);

const supplierProducts = (supplierId) =>
  products.value.filter((p) => p.id_proveedor === supplierId);

const filteredSuppliers = computed(() => {
  let list = suppliers.value;
  if (activeTab.value !== "all") {
    list = list.filter((s) => s.id === activeTab.value);
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) ||
        supplierProducts(s.id).some((p) =>
          `${p.nombre} ${p.sku || ""}`.toLowerCase().includes(q),
        ),
    );
  }
  return list;
});

const supplierNode = (s) => {
  const node = s.nodos_sucursal?.[branchId.value] || s.nodo_entrega || "BODEGA";
  return node === "DIRECTO_TIENDA" ? "Directo a tienda" : "Bodega";
};

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
  activeTab.value = "all";
  search.value = "";
}

watch(branchId, load);

const configuredIdealsCount = computed(() =>
  products.value.filter(
    (p) => ideals.value[p.id] !== "" && ideals.value[p.id] != null,
  ).length,
);

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
    <PageHeader
      title="Stock y calendario"
      description="Planifique el abastecimiento, horarios de pedido y metas de stock por proveedor."
      eyebrow="PLANIFICACIÓN"
      icon="sliders"
    />

    <p v-if="message" class="success" role="status">
      <AppIcon name="checkCircle" />{{ message }}
    </p>

    <!-- Selector de sucursal -->
    <div class="panel toolbar">
      <label class="branch-picker" style="margin: 0; min-width: 260px;">
        Sucursal a configurar
        <select v-model="branchId">
          <option value="">Seleccione una sucursal</option>
          <option
            v-for="b in state.data.sucursales.filter((b) => b.active !== false)"
            :key="b.id"
            :value="b.id"
          >
            {{ b.nombre }}
          </option>
        </select>
      </label>

      <div v-if="branchId" class="field-with-icon filter-search" style="margin-left: auto;">
        <AppIcon name="search" :size="18" />
        <input
          v-model="search"
          type="search"
          placeholder="Buscar producto o proveedor..."
          aria-label="Buscar en stock y calendario"
        />
      </div>

      <span v-if="branchId" class="filter-summary">
        {{ products.length }} productos · {{ suppliers.length }} proveedores
      </span>
    </div>

    <!-- Estado vacío si no hay sucursal elegida -->
    <EmptyState
      v-if="!branchId"
      title="Elija una sucursal"
      description="Seleccione la sucursal para gestionar sus productos organizados por proveedor, sus horarios de corte y el stock ideal semanal."
      icon="store"
    />

    <!-- Contenido cuando hay sucursal -->
    <form v-else @submit.prevent="save" class="stack">
      <!-- Tabs dinámicas por proveedor -->
      <div v-if="suppliers.length > 0" class="tabs-scroll">
        <div class="segmented" role="tablist" aria-label="Filtro por proveedor">
          <button
            type="button"
            :class="{ active: activeTab === 'all' }"
            @click="activeTab = 'all'"
            role="tab"
            :aria-selected="activeTab === 'all'"
          >
            <AppIcon name="layers" :size="16" />
            <span>Todos los proveedores</span>
            <span class="badge" style="font-size: 0.7rem; padding: 2px 7px;">
              {{ products.length }}
            </span>
          </button>

          <button
            v-for="s in suppliers"
            :key="s.id"
            type="button"
            :class="{ active: activeTab === s.id }"
            @click="activeTab = s.id"
            role="tab"
            :aria-selected="activeTab === s.id"
          >
            <AppIcon name="truck" :size="16" />
            <span>{{ s.nombre }}</span>
            <span class="badge" style="font-size: 0.7rem; padding: 2px 7px;">
              {{ supplierProducts(s.id).length }}
            </span>
          </button>
        </div>
      </div>

      <!-- Alerta si no se encontraron resultados por búsqueda -->
      <EmptyState
        v-if="!filteredSuppliers.length && !unassignedProducts.length"
        icon="search"
        title="Sin resultados para la búsqueda"
        description="Pruebe cambiando los términos o restablezca el filtro de búsqueda."
      />

      <!-- Tarjetas segmentadas por Proveedor -->
      <div class="stack">
        <article
          v-for="s in filteredSuppliers"
          :key="s.id"
          class="panel stack-sm supplier-card"
        >
          <!-- Encabezado del Proveedor -->
          <header class="supplier-header">
            <div class="row wrap" style="gap: 14px;">
              <span class="icon-tile blue">
                <AppIcon name="truck" :size="22" />
              </span>
              <div>
                <h2>{{ s.nombre }}</h2>
                <div class="row wrap" style="gap: 8px; margin-top: 6px;">
                  <span class="badge blue">
                    <AppIcon
                      :name="supplierNode(s) === 'Bodega' ? 'warehouse' : 'store'"
                      :size="14"
                    />
                    {{ supplierNode(s) }}
                  </span>
                  <span class="badge">
                    <AppIcon name="box" :size="14" />
                    {{ supplierProducts(s.id).length }} {{ supplierProducts(s.id).length === 1 ? 'producto' : 'productos' }}
                  </span>
                  <span
                    v-if="calendars[s.id]?.days?.length && calendars[s.id]?.cutoff"
                    class="badge green"
                  >
                    <AppIcon name="checkCircle" :size="14" />
                    Horario configurado
                  </span>
                  <span v-else class="badge amber">
                    <AppIcon name="alert" :size="14" />
                    Falta horario de pedido
                  </span>
                </div>
              </div>
            </div>
          </header>

          <!-- Sección 1: Calendario y Horario del Proveedor -->
          <div class="supplier-schedule-box">
            <div class="section-subheading">
              <span class="title-with-icon">
                <AppIcon name="calendar" :size="16" />
                Días de pedido y horario de corte
              </span>
              <span class="muted" style="font-size: 0.75rem;">
                Zona horaria: Guatemala (UTC-6)
              </span>
            </div>

            <div class="schedule-inputs-row">
              <div class="day-pills">
                <label v-for="(day, i) in days" :key="i">
                  <input
                    type="checkbox"
                    :value="i"
                    v-model="calendars[s.id].days"
                  />
                  <span>{{ day }}</span>
                </label>
              </div>

              <div class="cutoff-wrap">
                <AppIcon name="clock" :size="18" style="color: var(--muted);" />
                <label>
                  <span>Hora límite de envío</span>
                  <input
                    type="time"
                    v-model="calendars[s.id].cutoff"
                    required
                  />
                </label>
              </div>
            </div>
          </div>

          <!-- Sección 2: Productos del Proveedor y Stock Ideal -->
          <div class="supplier-products-box">
            <div class="section-subheading">
              <span class="title-with-icon">
                <AppIcon name="box" :size="16" />
                Productos asignados y Stock Ideal Semanal
              </span>
              <span class="muted" style="font-size: 0.75rem;">
                Cantidad meta en tienda para la semana
              </span>
            </div>

            <div v-if="!supplierProducts(s.id).length" class="notice subtle">
              Este proveedor no tiene productos asignados para esta sucursal.
            </div>

            <div v-else class="products-grid-layout">
              <div
                v-for="p in supplierProducts(s.id)"
                :key="p.id"
                class="product-item-card"
              >
                <div class="product-item-details">
                  <span class="product-item-icon">
                    <AppIcon name="box" :size="16" />
                  </span>
                  <div style="min-width: 0;">
                    <strong class="break-text">{{ p.nombre }}</strong>
                    <p class="muted">
                      {{ p.unidad_compra || p.presentacion || 'Unidad' }}
                      <span v-if="p.sku" class="order-reference">· {{ p.sku }}</span>
                    </p>
                  </div>
                </div>

                <div class="product-ideal-box">
                  <label>
                    <span class="ideal-label-text">Stock ideal semanal</span>
                    <div class="ideal-field-wrapper">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        v-model="ideals[p.id]"
                        placeholder="0"
                        required
                      />
                      <span class="unit-badge">
                        {{ p.unidad_compra || p.presentacion || 'U' }}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </article>

        <!-- Productos sin proveedor asignado si existen -->
        <article
          v-if="(activeTab === 'all' || activeTab === 'unassigned') && unassignedProducts.length"
          class="panel stack-sm supplier-card"
          style="border-left: 4px solid #e09f3e;"
        >
          <header class="supplier-header">
            <div class="row wrap" style="gap: 14px;">
              <span class="icon-tile amber">
                <AppIcon name="alert" :size="20" />
              </span>
              <div>
                <h2>Otros productos (Sin proveedor asignado)</h2>
                <p class="muted">
                  Configure su stock ideal semanal mientras se les asigna un proveedor en el catálogo.
                </p>
              </div>
            </div>
          </header>

          <div class="products-grid-layout">
            <div
              v-for="p in unassignedProducts"
              :key="p.id"
              class="product-item-card"
            >
              <div class="product-item-details">
                <span class="product-item-icon">
                  <AppIcon name="box" :size="16" />
                </span>
                <div style="min-width: 0;">
                  <strong class="break-text">{{ p.nombre }}</strong>
                  <p class="muted">
                    {{ p.unidad_compra || p.presentacion || 'Unidad' }}
                    <span v-if="p.sku" class="order-reference">· {{ p.sku }}</span>
                  </p>
                </div>
              </div>

              <div class="product-ideal-box">
                <label>
                  <span class="ideal-label-text">Stock ideal semanal</span>
                  <div class="ideal-field-wrapper">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      v-model="ideals[p.id]"
                      placeholder="0"
                      required
                    />
                    <span class="unit-badge">
                      {{ p.unidad_compra || p.presentacion || 'U' }}
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </article>
      </div>

      <!-- Barra de acciones fijas / sticky para guardar -->
      <div class="sticky-actions">
        <div class="action-label">
          <strong>{{ configuredIdealsCount }} de {{ products.length }} metas de stock</strong>
          <p>
            {{
              configuredIdealsCount === products.length
                ? 'Todos los productos tienen stock configurado'
                : `${products.length - configuredIdealsCount} productos pendientes`
            }}
          </p>
        </div>

        <div class="row wrap" style="gap: 10px;">
          <button
            type="button"
            class="secondary"
            @click="propose"
            :disabled="state.loading"
          >
            <AppIcon name="spark" />
            Calcular propuesta con historial
          </button>

          <button class="primary" :disabled="state.loading">
            <AppIcon
              :name="state.loading ? 'refresh' : 'save'"
              :class="{ spin: state.loading }"
            />
            {{ state.loading ? 'Guardando…' : 'Guardar configuración' }}
          </button>
        </div>
      </div>
    </form>

    <!-- Propuestas de stock pendientes -->
    <article
      v-for="p in state.data.stockProposals.filter(
        (p) => p.branchId === branchId && p.status === 'PENDIENTE',
      )"
      :key="p.id"
      class="panel stack-sm"
    >
      <h2 class="section-title">Propuesta pendiente</h2>
      <p>{{ p.method }}</p>
      <p class="notice amber">
        Los pedidos no equivalen al consumo. Revise si el resultado alcanza para
        la semana antes de autorizar.
      </p>
      <div class="stack-xs">
        <div
          v-for="(v, id) in p.proposed"
          :key="id"
          class="compare-row"
        >
          <strong>{{ state.data.productos.find((x) => x.id === id)?.nombre || id }}</strong>
          <span>
            {{ p.previous[id] }}
            <AppIcon name="arrow" :size="16" />
            <strong class="new-value">{{ v }}</strong>
          </span>
        </div>
      </div>
      <label>
        Motivo de autorización
        <textarea v-model="reasons[p.id]"></textarea>
      </label>
      <button
        type="button"
        class="primary"
        @click="accept(p.id)"
        :disabled="state.loading || !reasons[p.id]?.trim()"
      >
        Autorizar cambio
      </button>
    </article>
  </div>
</template>

<style scoped>
.supplier-card {
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 22px;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(18, 42, 56, 0.03);
  transition: box-shadow 0.2s, border-color 0.2s;
}

.supplier-card:hover {
  box-shadow: 0 6px 20px rgba(18, 42, 56, 0.06);
}

.supplier-header {
  border-bottom: 1px solid #edf2f4;
  padding-bottom: 16px;
  margin-bottom: 6px;
}

.supplier-header h2 {
  font-size: 1.2rem;
  letter-spacing: -0.02em;
}

.supplier-schedule-box {
  background: #fbfcfd;
  border: 1px solid #eef3f6;
  border-radius: 14px;
  padding: 16px 18px;
  margin-top: 10px;
}

.supplier-products-box {
  margin-top: 14px;
}

.section-subheading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.title-with-icon {
  font-weight: 700;
  font-size: 0.875rem;
  color: var(--ink);
  display: flex;
  align-items: center;
  gap: 8px;
}

.schedule-inputs-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.cutoff-wrap {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 6px 14px;
}

.cutoff-wrap label {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cutoff-wrap label span {
  font-size: 0.6875rem;
  font-weight: 650;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cutoff-wrap input {
  min-height: 32px;
  padding: 2px 6px;
  margin: 0;
  border: 0;
  font-weight: 700;
  font-size: 0.9375rem;
  background: transparent;
  outline: none;
}

.products-grid-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.product-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px 16px;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 14px;
  transition: border-color 0.16s, box-shadow 0.16s;
}

.product-item-card:hover {
  border-color: #bcdfd2;
  box-shadow: 0 4px 12px rgba(8, 127, 117, 0.06);
}

.product-item-details {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.product-item-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--soft);
  color: var(--accent);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.product-ideal-box {
  flex-shrink: 0;
}

.product-ideal-box label {
  margin: 0;
}

.ideal-label-text {
  font-size: 0.6875rem;
  font-weight: 650;
  color: var(--muted);
  display: block;
  margin-bottom: 4px;
  text-align: right;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.ideal-field-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid #cfded8;
  border-radius: 10px;
  overflow: hidden;
  background: #ffffff;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.ideal-field-wrapper:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(8, 127, 117, 0.12);
}

.ideal-field-wrapper input {
  width: 78px;
  min-height: 38px;
  text-align: center;
  font-weight: 750;
  font-size: 1rem;
  border: 0 !important;
  outline: none;
  box-shadow: none !important;
  padding: 4px;
}

.unit-badge {
  padding: 6px 10px;
  background: #f2f8f6;
  font-size: 0.75rem;
  color: var(--accent);
  font-weight: 650;
  border-left: 1px solid #dbe8e3;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .products-grid-layout {
    grid-template-columns: 1fr;
  }
  .schedule-inputs-row {
    flex-direction: column;
    align-items: stretch;
  }
  .cutoff-wrap {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
