<script setup>
import { ref, computed, watch } from "vue";
import { state, command, perform } from "../services/operations";

const branchId = ref(""),
  lines = ref({}),
  reason = ref(""),
  message = ref(""),
  search = ref(""),
  pendingOnly = ref(false),
  view = ref("list");

const activeBranches = computed(() =>
  (state.data?.sucursales || []).filter((b) => b.active !== false),
);

function initLinesForBranch() {
  if (!branchId.value) return;
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
}

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

const supplierName = (supplierId) =>
  state.data.proveedores?.find((s) => s.id === supplierId)?.nombre || "";

watch(branchId, () => {
  initLinesForBranch();
});

watch(
  activeBranches,
  (list) => {
    if (list.length === 1 && branchId.value !== list[0].id) {
      branchId.value = list[0].id;
    }
  },
  { immediate: true },
);

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

const suggestion = (p) => {
  const ideal = settings.value?.ideals?.[p.id];
  if (ideal === undefined || ideal === null || ideal === "") return 0;
  return Math.max(Number(ideal) - Number(lines.value[p.id]?.physicalQty || 0), 0);
};

const hasMissingIdeal = (p) => {
  const ideal = settings.value?.ideals?.[p.id];
  return ideal === undefined || ideal === null || ideal === "" || Number(ideal) < 0;
};

const isPhysicalExceeded = (p) => {
  const ideal = settings.value?.ideals?.[p.id];
  if (ideal === undefined || ideal === null || ideal === "") return false;
  const phys = lines.value[p.id]?.physicalQty;
  if (phys === "" || phys === null || phys === undefined) return false;
  return Number(phys) > Number(ideal);
};

function changed(p) {
  if (!lines.value[p.id].manual) lines.value[p.id].requestedQty = suggestion(p);
}

function physicalChange(p, value) {
  lines.value[p.id].physicalQty = value;
  changed(p);
}

function adjustQty(p, field, delta) {
  const current = lines.value[p.id]?.[field] === "" ? 0 : Number(lines.value[p.id]?.[field] || 0);
  const nextVal = Math.max(0, Math.round((current + delta) * 1000) / 1000);
  if (field === "physicalQty") {
    physicalChange(p, nextVal);
  } else {
    lines.value[p.id].requestedQty = nextVal;
    lines.value[p.id].manual = true;
  }
}

const complete = computed(
  () =>
    products.value.length > 0 &&
    products.value.every((p) => {
      const l = lines.value[p.id];
      const validNumbers =
        l &&
        l.physicalQty !== "" &&
        l.physicalQty !== null &&
        Number(l.physicalQty) >= 0 &&
        Number.isFinite(Number(l.physicalQty)) &&
        l.requestedQty !== "" &&
        Number(l.requestedQty) >= 0;
      if (!validNumbers) return false;

      // Requiere justificación si ajustó la cantidad a pedir o si la existencia física excedió el stock ideal
      const adjustedRequest = Number(l.requestedQty) !== suggestion(p);
      const exceededStock = isPhysicalExceeded(p);
      if (adjustedRequest || exceededStock) {
        return Boolean(l.reason && l.reason.trim());
      }
      return true;
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

const filled = (p) =>
  lines.value[p.id]?.physicalQty !== "" &&
  lines.value[p.id]?.physicalQty != null;

const visibleProducts = computed(() =>
  products.value.filter(
    (p) =>
      (!search.value ||
        `${p.nombre} ${p.sku || ""} ${supplierName(p.id_proveedor)}`
          .toLowerCase()
          .includes(search.value.toLowerCase())) &&
      (!pendingOnly.value || !filled(p)),
  ),
);

const percent = computed(() =>
  products.value.length
    ? Math.round((progress.value / products.value.length) * 100)
    : 0,
);

const requestedLines = computed(
  () =>
    products.value.filter((p) => Number(lines.value[p.id]?.requestedQty) > 0)
      .length,
);

watch(products, () => {
  for (const p of products.value)
    lines.value[p.id] ||= {
      physicalQty: "",
      requestedQty: "",
      reason: "",
      manual: false,
    };
});

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
    localStorage.removeItem(storage);
    lines.value = {};
    reason.value = "";
    if (activeBranches.value.length === 1) {
      branchId.value = activeBranches.value[0].id;
      initLinesForBranch();
    } else {
      branchId.value = "";
    }
  });
}
</script>

<template>
  <div class="stack">
    <PageHeader
      :title="activeBranches.length === 1 ? `Conteo semanal · ${activeBranches[0].nombre}` : 'Conteo semanal'"
      :eyebrow="activeBranches.length === 1 ? `SUCURSAL ${activeBranches[0].nombre}` : 'INVENTARIO DE SUCURSAL'"
      icon="clipboard"
      description="Revisa cada producto y prepara el abastecimiento de tu semana de forma ágil y ordenada."
    >
      <div v-if="activeBranches.length === 1" class="row wrap" style="gap: 10px;">
        <span class="badge green" style="padding: 8px 14px; font-size: 0.85rem; font-weight: 700;">
          <AppIcon name="store" :size="16" />
          Sucursal: {{ activeBranches[0].nombre }}
        </span>
        <router-link v-if="state.profile?.role === 'Tienda'" to="/mis-pedidos" class="secondary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 10px; font-weight: 650;">
          <AppIcon name="box" :size="16" />
          Ver mis pedidos y recepciones
        </router-link>
      </div>
      <label v-else class="branch-picker">
        Sucursal
        <select v-model="branchId">
          <option value="">Selecciona tu sucursal</option>
          <option
            v-for="b in activeBranches"
            :key="b.id"
            :value="b.id"
          >
            {{ b.nombre }}
          </option>
        </select>
      </label>
    </PageHeader>

    <div v-if="message" class="success" role="status">
      <AppIcon name="checkCircle" />{{ message }}
    </div>

    <EmptyState
      v-if="!branchId"
      icon="store"
      title="Comienza por tu sucursal"
      description="Selecciona la tienda para cargar sus productos y recuperar tu último borrador."
    />

    <template v-else>
      <div v-if="!settings" class="notice amber">
        <AppIcon name="sliders" />
        <div>
          <strong>Falta preparar esta sucursal</strong>
          <p>Logística debe configurar el stock ideal y el calendario antes del conteo.</p>
        </div>
      </div>

      <form v-else class="stack" @submit.prevent="submit">
        <!-- Barra de progreso -->
        <section class="count-progress">
          <div class="progress-circle" :style="{ '--progress': percent + '%' }">
            <span>{{ percent }}%</span>
          </div>
          <div class="grow">
            <h2>{{ progress }} de {{ products.length }} productos contados</h2>
            <p>Ingresa <strong>0</strong> cuando no haya existencias. Todas las casillas deben completarse.</p>
          </div>
          <span class="autosave">
            <AppIcon name="save" :size="16" />Borrador en este dispositivo
          </span>
        </section>

        <!-- Barra de herramientas con buscador y selector de vista -->
        <div class="toolbar">
          <div class="field-with-icon filter-search">
            <AppIcon name="search" :size="18" />
            <input
              v-model="search"
              type="search"
              placeholder="Buscar producto, código o proveedor..."
              aria-label="Buscar producto"
            />
          </div>

          <button
            type="button"
            :class="pendingOnly ? 'primary' : 'secondary'"
            @click="pendingOnly = !pendingOnly"
            :aria-pressed="pendingOnly"
          >
            <AppIcon :name="pendingOnly ? 'list' : 'filter'" :size="17" />
            {{ pendingOnly ? 'Ver todos' : 'Solo sin contar' }}
          </button>

          <!-- Conmutador de vista Lista / Tarjetas -->
          <div class="segmented" aria-label="Modo de visualización">
            <button
              type="button"
              :class="{ active: view === 'list' }"
              @click="view = 'list'"
              :aria-pressed="view === 'list'"
            >
              <AppIcon name="list" :size="16" />
              Lista
            </button>
            <button
              type="button"
              :class="{ active: view === 'cards' }"
              @click="view = 'cards'"
              :aria-pressed="view === 'cards'"
            >
              <AppIcon name="board" :size="16" />
              Tarjetas
            </button>
          </div>

          <span class="filter-summary">{{ visibleProducts.length }} productos</span>
        </div>

        <!-- VISTA TIPO LISTA COMPACTA (Por defecto) -->
        <div v-if="view === 'list' && visibleProducts.length" class="count-list-container panel">
          <!-- Encabezado de la tabla -->
          <div class="count-list-header">
            <div class="col-product">Producto / Proveedor</div>
            <div class="col-stat text-center">Stock Ideal</div>
            <div class="col-input text-center">Existencia Física</div>
            <div class="col-stat text-center">Sugerido</div>
            <div class="col-input text-center">Cantidad a Pedir</div>
            <div class="col-status text-center">Estado</div>
          </div>

          <!-- Filas de productos -->
          <div class="count-list-body">
            <div
              v-for="p in visibleProducts"
              :key="p.id"
              class="count-list-item"
              :class="{
                'item-counted': filled(p),
                'item-exceeded': isPhysicalExceeded(p),
                'item-no-ideal': hasMissingIdeal(p)
              }"
            >
              <div class="count-main-row">
                <!-- Columna: Producto -->
                <div class="col-product">
                  <div class="row" style="gap: 12px; min-width: 0;">
                    <span class="product-status-dot" :class="{ counted: filled(p) }">
                      <AppIcon :name="filled(p) ? 'check' : 'box'" :size="15" />
                    </span>
                    <div style="min-width: 0;">
                      <div class="row wrap" style="gap: 6px; align-items: baseline;">
                        <strong class="product-name">{{ p.nombre }}</strong>
                        <span class="product-subtext">{{ p.unidad_compra || p.presentacion || 'Unidad' }}</span>
                      </div>
                      <div class="product-meta-row">
                        <span v-if="p.sku" class="sku-tag">{{ p.sku }}</span>
                        <span v-if="supplierName(p.id_proveedor)" class="supplier-tag">
                          {{ supplierName(p.id_proveedor) }}
                        </span>
                        <span v-if="hasMissingIdeal(p)" class="badge-mini amber">
                          Sin stock ideal
                        </span>
                        <span v-if="isPhysicalExceeded(p)" class="badge-mini danger">
                          Supera ideal
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Columna: Stock Ideal -->
                <div class="col-stat text-center">
                  <span class="stat-ideal-val">
                    {{ settings.ideals?.[p.id] ?? '—' }}
                  </span>
                  <span class="mobile-label">Ideal</span>
                </div>

                <!-- Columna: Existencia Física -->
                <div class="col-input">
                  <div class="compact-stepper">
                    <button
                      type="button"
                      @click="adjustQty(p, 'physicalQty', -1)"
                      :aria-label="`Restar existencia ${p.nombre}`"
                    >
                      <AppIcon name="minus" :size="14" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      :value="lines[p.id].physicalQty"
                      @input="physicalChange(p, $event.target.value)"
                      placeholder="0"
                      required
                    />
                    <button
                      type="button"
                      @click="adjustQty(p, 'physicalQty', 1)"
                      :aria-label="`Sumar existencia ${p.nombre}`"
                    >
                      <AppIcon name="plus" :size="14" />
                    </button>
                  </div>
                  <span class="mobile-label">Físico</span>
                </div>

                <!-- Columna: Sugerido -->
                <div class="col-stat text-center">
                  <strong class="stat-suggested-val" :class="{ active: suggestion(p) > 0 }">
                    {{ suggestion(p) }}
                  </strong>
                  <span class="mobile-label">Sugerido</span>
                </div>

                <!-- Columna: Cantidad a Pedir -->
                <div class="col-input">
                  <div class="compact-stepper">
                    <button
                      type="button"
                      @click="adjustQty(p, 'requestedQty', -1)"
                      :aria-label="`Restar pedido ${p.nombre}`"
                    >
                      <AppIcon name="minus" :size="14" />
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      v-model="lines[p.id].requestedQty"
                      @change="lines[p.id].manual = true"
                      placeholder="0"
                      required
                    />
                    <button
                      type="button"
                      @click="adjustQty(p, 'requestedQty', 1)"
                      :aria-label="`Sumar pedido ${p.nombre}`"
                    >
                      <AppIcon name="plus" :size="14" />
                    </button>
                  </div>
                  <span class="mobile-label">A pedir</span>
                </div>

                <!-- Columna: Estado -->
                <div class="col-status text-center">
                  <span v-if="filled(p)" class="status-icon green" title="Producto contado">
                    <AppIcon name="checkCircle" :size="18" />
                  </span>
                  <span v-else class="status-icon muted" title="Pendiente de contar">
                    <AppIcon name="clock" :size="16" />
                  </span>
                </div>
              </div>

              <!-- Fila Inset compacta de justificación obligatoria -->
              <div
                v-if="(lines[p.id].requestedQty !== '' && Number(lines[p.id].requestedQty) !== suggestion(p)) || isPhysicalExceeded(p)"
                class="count-inline-alert"
                :class="isPhysicalExceeded(p) ? 'alert-danger' : 'alert-warning'"
              >
                <div class="alert-content">
                  <AppIcon name="alert" :size="16" />
                  <div class="alert-text">
                    <span v-if="isPhysicalExceeded(p)">
                      <strong>Existencia supera el stock ideal</strong> (Tienes {{ lines[p.id].physicalQty }} vs ideal {{ settings.ideals?.[p.id] }}). Justificación requerida:
                    </span>
                    <span v-else>
                      <strong>Ajuste sobre sugerencia</strong> (Pides {{ lines[p.id].requestedQty }} vs sugerido {{ suggestion(p) }}). Justificación requerida:
                    </span>
                  </div>
                </div>
                <input
                  type="text"
                  v-model="lines[p.id].reason"
                  :placeholder="isPhysicalExceeded(p) ? 'Explica la causa del excedente en tienda o error de conteo' : 'Explica el motivo del ajuste sobre la sugerencia'"
                  required
                  class="compact-reason-input"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- VISTA TIPO TARJETAS (Alternativa compactada) -->
        <div v-else-if="view === 'cards' && visibleProducts.length" class="product-grid">
          <article
            v-for="p in visibleProducts"
            :key="p.id"
            class="product-card"
            :class="{
              counted: filled(p),
              'border-amber': isPhysicalExceeded(p),
              'border-red': hasMissingIdeal(p)
            }"
          >
            <header class="product-card-heading">
              <span class="icon-tile"><AppIcon name="box" /></span>
              <div class="grow">
                <h3>{{ p.nombre }}</h3>
                <p>
                  {{ p.unidad_compra || p.presentacion || 'Unidad' }}
                  <span v-if="p.sku">· {{ p.sku }}</span>
                  <span v-if="supplierName(p.id_proveedor)"> · {{ supplierName(p.id_proveedor) }}</span>
                </p>
              </div>
              <AppIcon v-if="filled(p)" name="checkCircle" style="color:var(--accent)" />
            </header>

            <div v-if="hasMissingIdeal(p)" class="notice amber" style="margin-bottom: 12px; padding: 8px 12px; font-size: 0.8125rem;">
              <AppIcon name="alert" :size="16" />
              <span><strong>Sin stock ideal configurado:</strong> Sin meta para esta sucursal.</span>
            </div>

            <div v-if="isPhysicalExceeded(p)" class="notice amber" style="margin-bottom: 12px; padding: 8px 12px; font-size: 0.8125rem;">
              <AppIcon name="alert" :size="16" />
              <span><strong>¡Existencia supera el stock ideal!</strong> ({{ lines[p.id].physicalQty }} vs ideal {{ settings.ideals?.[p.id] }}).</span>
            </div>

            <div class="product-fields">
              <QuantityField
                :model-value="lines[p.id].physicalQty"
                @update:model-value="physicalChange(p, $event)"
                label="Existencia física"
                required
              />
              <QuantityField
                v-model="lines[p.id].requestedQty"
                @change="lines[p.id].manual = true"
                label="Cantidad a pedir"
                required
              />
            </div>

            <div class="product-hint">
              <span>Stock ideal <b>{{ settings.ideals?.[p.id] ?? '—' }}</b></span>
              <span>Sugerencia <b>{{ suggestion(p) }}</b></span>
            </div>

            <div
              v-if="(lines[p.id].requestedQty !== '' && Number(lines[p.id].requestedQty) !== suggestion(p)) || isPhysicalExceeded(p)"
              class="adjustment-field"
            >
              <label>
                <span v-if="isPhysicalExceeded(p)">¿Por qué supera el stock ideal? (Obligatorio)</span>
                <span v-else>¿Por qué ajustas la sugerencia? (Obligatorio)</span>
                <textarea
                  v-model="lines[p.id].reason"
                  :placeholder="isPhysicalExceeded(p) ? 'Explica la causa del excedente en tienda o error de conteo' : 'Explica el motivo del cambio'"
                  required
                ></textarea>
              </label>
            </div>
          </article>
        </div>

        <EmptyState
          v-if="!visibleProducts.length"
          icon="checkCircle"
          :title="pendingOnly ? 'No hay productos pendientes en este filtro' : 'No encontramos ese producto'"
          description="Cambia la búsqueda para ver los demás productos."
        />

        <details class="panel">
          <summary class="row" style="cursor:pointer; min-height:32px">
            <AppIcon name="history" :size="18" />
            <span>¿Es un conteo adicional de esta semana?</span>
          </summary>
          <label style="margin-top:16px">
            Motivo del nuevo conteo
            <textarea
              v-model="reason"
              placeholder="Obligatorio si ya enviaste un conteo esta semana."
            ></textarea>
          </label>
        </details>

        <!-- Barra flotante de acciones -->
        <div class="sticky-actions">
          <div class="action-label">
            <strong>{{ requestedLines }} productos a solicitar</strong>
            <p>
              {{
                complete
                  ? 'Conteo completo. Listo para enviar.'
                  : `${products.length - progress} productos por contar`
              }}
            </p>
          </div>
          <button class="primary" :disabled="!complete || state.loading">
            <AppIcon
              :name="state.loading ? 'refresh' : 'checkCircle'"
              :class="{ spin: state.loading }"
              :size="18"
            />
            {{ state.loading ? 'Guardando…' : 'Guardar y enviar' }}
          </button>
        </div>
      </form>
    </template>
  </div>
</template>

<style scoped>
.count-list-container {
  padding: 0;
  border-radius: 18px;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid var(--line);
  box-shadow: 0 4px 16px rgba(18, 42, 56, 0.04);
}

.count-list-header {
  display: grid;
  grid-template-columns: minmax(240px, 2.5fr) 90px 145px 90px 145px 60px;
  gap: 12px;
  align-items: center;
  padding: 13px 20px;
  background: #f7fafb;
  border-bottom: 1px solid var(--line);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.text-center {
  text-align: center;
}

.count-list-body {
  display: flex;
  flex-direction: column;
}

.count-list-item {
  border-bottom: 1px solid #edf2f5;
  transition: background 0.14s ease;
}

.count-list-item:last-child {
  border-bottom: none;
}

.count-list-item:hover {
  background: #f9fbfb;
}

.count-list-item.item-counted {
  background: #fafdfc;
}

.count-list-item.item-exceeded {
  background: #fffdf9;
}

.count-main-row {
  display: grid;
  grid-template-columns: minmax(240px, 2.5fr) 90px 145px 90px 145px 60px;
  gap: 12px;
  align-items: center;
  padding: 11px 20px;
}

.col-product {
  min-width: 0;
}

.product-status-dot {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #f0f4f6;
  color: var(--muted);
  display: grid;
  place-items: center;
  flex-shrink: 0;
  transition: all 0.2s ease;
}

.product-status-dot.counted {
  background: #e8f6f1;
  color: var(--accent);
}

.product-name {
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ink);
  overflow-wrap: anywhere;
}

.product-subtext {
  font-size: 0.8125rem;
  color: var(--muted);
}

.product-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 2px;
}

.sku-tag {
  font-family: ui-monospace, monospace;
  font-size: 0.6875rem;
  color: #6a828e;
  background: #edf3f6;
  padding: 1px 6px;
  border-radius: 4px;
}

.supplier-tag {
  font-size: 0.6875rem;
  color: #3b6683;
  background: #edf4fa;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.badge-mini {
  font-size: 0.6875rem;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 650;
}

.badge-mini.amber {
  background: #fff3dc;
  color: #9c6e17;
}

.badge-mini.danger {
  background: #feeceb;
  color: #b83d32;
}

.stat-ideal-val {
  font-size: 0.9375rem;
  font-weight: 650;
  color: #556e7b;
}

.stat-suggested-val {
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--muted);
}

.stat-suggested-val.active {
  color: var(--accent);
}

.compact-stepper {
  display: flex;
  align-items: center;
  border: 1px solid #d9e3e7;
  border-radius: 10px;
  background: #ffffff;
  overflow: hidden;
  height: 38px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.compact-stepper:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(8, 127, 117, 0.14);
}

.compact-stepper button {
  width: 32px;
  height: 100%;
  border: 0;
  background: transparent;
  color: #657e8a;
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.15s;
}

.compact-stepper button:hover {
  background: #f0f7f5;
  color: var(--accent);
}

.compact-stepper input {
  width: 100%;
  min-width: 0;
  border: 0 !important;
  outline: none;
  box-shadow: none !important;
  text-align: center;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--ink);
  background: transparent;
  padding: 0 4px;
}

.status-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.status-icon.green {
  color: var(--accent);
}

.status-icon.muted {
  color: #a4b6bf;
}

.mobile-label {
  display: none;
}

.count-inline-alert {
  padding: 8px 18px 10px 58px;
  border-top: 1px dashed var(--line);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.count-inline-alert.alert-warning {
  background: #fffdf8;
}

.count-inline-alert.alert-danger {
  background: #fff9f8;
}

.alert-content {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8125rem;
}

.alert-warning .alert-content {
  color: #946914;
}

.alert-danger .alert-content {
  color: #b24a38;
}

.compact-reason-input {
  width: 100%;
  border: 1px solid #d9e3e7;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 0.8125rem;
  background: #ffffff;
  min-height: 34px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.compact-reason-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(8, 127, 117, 0.14);
}

@media (max-width: 900px) {
  .count-list-header {
    display: none;
  }
  .count-main-row {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 14px 16px;
  }
  .mobile-label {
    display: block;
    font-size: 0.6875rem;
    font-weight: 650;
    text-transform: uppercase;
    color: var(--muted);
    margin-top: 2px;
  }
  .col-stat, .col-input {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .compact-stepper {
    width: 100%;
    max-width: 220px;
  }
  .count-inline-alert {
    padding: 10px 16px;
  }
}
</style>
