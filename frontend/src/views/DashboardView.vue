<script setup>
import { onMounted, computed, ref } from 'vue';
import { usePedidoStore } from '../stores/pedidoStore';
import { useSuministrosStore } from '../stores/suministrosStore';
import { useTenantStore } from '../stores/tenantStore';

const pedidoStore = usePedidoStore();
const suministrosStore = useSuministrosStore();
const tenantStore = useTenantStore();

const sucursalSeleccionada = ref('TODAS');

onMounted(async () => {
  await Promise.all([
    pedidoStore.fetchPedidos(),
    suministrosStore.fetchProveedores(),
    tenantStore.fetchSucursales()
  ]);
});

// Helper function to calculate KPIs for a given set of orders
const calculateKPIs = (pedidos) => {
  const total = pedidos.length || 1;

  // ERI
  let totalTeorico = 0;
  let totalError = 0;
  pedidos.forEach(p => {
    (p.items || []).forEach(item => {
      const teorico = parseInt(item.stock_teorico) || 0;
      const fisico = parseInt(item.cantidad_fisica_reportada) || 0;
      if (teorico > 0) {
        totalTeorico += teorico;
        totalError += Math.abs(teorico - fisico);
      }
    });
  });
  const eri = totalTeorico === 0 ? 100 : Math.max(0, Math.round((1 - (totalError / totalTeorico)) * 100));

  // Emergencia
  const emergencyCount = pedidos.filter(p => p.is_emergency).length;
  const emergencia = Math.round((emergencyCount / total) * 100);

  // Rectificados
  const rectificadosCount = pedidos.filter(p => p.is_rectified).length;
  const rectificados = Math.round((rectificadosCount / total) * 100);

  // OTIF
  const recibidos = pedidos.filter(p => p.fecha_recepcion_bodega || p.fecha_recepcion_tienda);
  let aTiempo = 0;
  let totalPedidoUnits = 0;
  let totalRecibidoUnits = 0;

  recibidos.forEach(p => {
    // On Time
    const fechaRecepcion = new Date(p.fecha_recepcion_tienda || p.fecha_recepcion_bodega);
    const fechaCompromiso = new Date(p.fecha_compromiso || p.fecha);
    if (fechaRecepcion <= fechaCompromiso) aTiempo++;

    // In Full
    (p.items || []).forEach(item => {
      const cant = parseInt(item.cantidad_aprobada !== undefined ? item.cantidad_aprobada : item.cantidad_solicitada) || 0;
      const rec = parseInt(item.cantidad_recibida_tienda !== undefined ? item.cantidad_recibida_tienda : (item.cantidad_recibida_bodega || 0)) || 0;
      totalPedidoUnits += cant;
      totalRecibidoUnits += rec;
    });
  });

  const otifOnTime = recibidos.length === 0 ? 100 : Math.round((aTiempo / recibidos.length) * 100);
  const otifInFull = totalPedidoUnits === 0 ? 100 : Math.round((totalRecibidoUnits / totalPedidoUnits) * 100);

  return { eri, emergencia, rectificados, otifOnTime, otifInFull, totalPedidos: pedidos.length };
};

// Filtered Orders
const pedidosFiltrados = computed(() => {
  if (sucursalSeleccionada.value === 'TODAS') return pedidoStore.pedidos;
  return pedidoStore.pedidos.filter(p => 
    (p.id_sucursal || p.tienda_id) === sucursalSeleccionada.value
  );
});

// Current active KPIs based on filter
const currentKPIs = computed(() => calculateKPIs(pedidosFiltrados.value));

// KPIs per Sucursal (Table Data)
const kpisPorSucursal = computed(() => {
  return tenantStore.sucursales.map(sucursal => {
    const peds = pedidoStore.pedidos.filter(p => (p.id_sucursal || p.tienda_id) === sucursal.id);
    const kpis = calculateKPIs(peds);
    return {
      id: sucursal.id,
      nombre: sucursal.nombre,
      ...kpis
    };
  });
});

// Alertas Tempranas (Anomalías) using global or filtered scope
const alertas = computed(() => {
  const list = [];
  const { eri, otifOnTime, otifInFull, rectificados, emergencia } = currentKPIs.value;
  
  if (eri < 97) {
    list.push({ tipo: 'CRÍTICA', mensaje: `Quiebre de Stock Activo. El ERI está por debajo del 97% (${eri}%). Se requiere auditoría forzada no programada.`, color: 'red' });
  }
  if (otifOnTime < 95 || otifInFull < 95) {
    list.push({ tipo: 'PROVEEDORES', mensaje: `Desviación OTIF detectada. Rendimiento On Time (${otifOnTime}%) o In Full (${otifInFull}%) por debajo del umbral de tolerancia (95%).`, color: 'orange' });
  }
  if (rectificados > 10) {
    list.push({ tipo: 'OPERATIVA', mensaje: `Falla en adopción de promedios semanales. El Índice de Rectificados superó el 10% (${rectificados}%).`, color: 'amber' });
  }
  if (emergencia > 5) {
    list.push({ tipo: 'PLANIFICACIÓN', mensaje: `Exceso de pedidos fuera de fecha. La Tasa de Emergencia es mayor al 5% (${emergencia}%).`, color: 'blue' });
  }

  const estancados = pedidosFiltrados.value.filter(p => {
    if (['PENDIENTE', 'TOMADO_POR_PROVEEDOR', 'EN_CAMINO'].includes(p.estado)) {
      const days = (new Date() - new Date(p.fecha)) / (1000 * 60 * 60 * 24);
      return days > 3;
    }
    return false;
  });

  if (estancados.length > 0) {
    list.push({ tipo: 'LEAD TIME', mensaje: `${estancados.length} pedidos llevan más de 3 días estancados en el flujo logístico.`, color: 'purple' });
  }

  if (list.length === 0) {
    list.push({ tipo: 'OK', mensaje: 'Todos los indicadores operan dentro de los umbrales de tolerancia.', color: 'green' });
  }

  return list;
});
</script>

<template>
  <div class="max-w-7xl mx-auto space-y-8">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
      <div>
        <h2 class="text-3xl font-black text-slate-800 tracking-tight">Dashboard de Control Logístico</h2>
        <p class="text-slate-500 mt-2 text-lg">Centro de mando analítico para la detección de anomalías en tiempo real.</p>
      </div>
      
      <!-- Selector de Sucursal -->
      <div class="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 min-w-[250px]">
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide px-2 mb-1">Filtrar por Sucursal:</label>
        <select v-model="sucursalSeleccionada" class="w-full bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-bold cursor-pointer text-sm transition-all">
          <option value="TODAS">📊 Vista Global (Todas las Sucursales)</option>
          <option v-for="suc in tenantStore.sucursales" :key="suc.id" :value="suc.id">
            🏪 {{ suc.nombre }}
          </option>
        </select>
      </div>
    </div>

    <!-- Top KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- ERI -->
      <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-1 transition-all">
        <h4 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Exactitud Inv. (ERI)</h4>
        <div class="flex items-end gap-4">
          <span class="text-5xl font-black" :class="currentKPIs.eri >= 97 ? 'text-emerald-500' : 'text-red-500'">{{ currentKPIs.eri }}%</span>
        </div>
        <p class="text-sm mt-3 font-medium text-slate-400">Meta: > 97%</p>
        <div class="w-full bg-slate-100 h-2 mt-4 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all" :class="currentKPIs.eri >= 97 ? 'bg-emerald-500' : 'bg-red-500'" :style="{ width: currentKPIs.eri + '%' }"></div>
        </div>
      </div>

      <!-- OTIF -->
      <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-1 transition-all relative overflow-hidden">
        <div class="absolute -right-10 -top-10 w-32 h-32 bg-blue-50 rounded-full"></div>
        <h4 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 relative z-10">Proveedores (OTIF)</h4>
        <div class="flex flex-col gap-3 relative z-10">
          <div class="flex justify-between items-center">
            <span class="text-sm font-bold text-slate-600">On Time</span>
            <span class="text-xl font-black" :class="currentKPIs.otifOnTime >= 95 ? 'text-blue-600' : 'text-orange-500'">{{ currentKPIs.otifOnTime }}%</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-bold text-slate-600">In Full</span>
            <span class="text-xl font-black" :class="currentKPIs.otifInFull >= 95 ? 'text-blue-600' : 'text-orange-500'">{{ currentKPIs.otifInFull }}%</span>
          </div>
        </div>
        <p class="text-sm mt-3 font-medium text-slate-400">Meta Combinada: > 95%</p>
      </div>

      <!-- Rectificados -->
      <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-1 transition-all">
        <h4 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Ped. Rectificados</h4>
        <div class="flex items-end gap-4">
          <span class="text-5xl font-black" :class="currentKPIs.rectificados <= 10 ? 'text-emerald-500' : 'text-amber-500'">{{ currentKPIs.rectificados }}%</span>
        </div>
        <p class="text-sm mt-3 font-medium text-slate-400">Meta: < 10%</p>
        <div class="w-full bg-slate-100 h-2 mt-4 rounded-full overflow-hidden flex justify-end">
          <div class="h-full rounded-full transition-all" :class="currentKPIs.rectificados <= 10 ? 'bg-emerald-500' : 'bg-amber-500'" :style="{ width: currentKPIs.rectificados + '%' }"></div>
        </div>
      </div>

      <!-- Emergencia -->
      <div class="bg-white rounded-2xl p-6 border border-slate-100 shadow-xl shadow-slate-200/40 hover:shadow-2xl hover:-translate-y-1 transition-all">
        <h4 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Tasa Emergencia</h4>
        <div class="flex items-end gap-4">
          <span class="text-5xl font-black" :class="currentKPIs.emergencia <= 5 ? 'text-emerald-500' : 'text-indigo-500'">{{ currentKPIs.emergencia }}%</span>
        </div>
        <p class="text-sm mt-3 font-medium text-slate-400">Meta: < 5%</p>
        <div class="w-full bg-slate-100 h-2 mt-4 rounded-full overflow-hidden flex justify-end">
          <div class="h-full rounded-full transition-all" :class="currentKPIs.emergencia <= 5 ? 'bg-emerald-500' : 'bg-indigo-500'" :style="{ width: currentKPIs.emergencia + '%' }"></div>
        </div>
      </div>
    </div>

    <!-- Monitor de Alertas Tempranas -->
    <div class="bg-white rounded-3xl p-8 border border-slate-100 shadow-xl shadow-slate-200/40">
      <div class="flex items-center gap-4 mb-6">
        <div class="p-3 bg-slate-900 rounded-xl">
          <svg class="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 class="text-2xl font-bold text-slate-800 tracking-tight">Monitor de Alertas Tempranas {{ sucursalSeleccionada !== 'TODAS' ? `(${tenantStore.sucursales.find(s => s.id === sucursalSeleccionada)?.nombre})` : '' }}</h3>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="(alerta, index) in alertas" :key="index" 
             class="p-5 rounded-2xl flex items-start gap-4 border shadow-sm transition-transform hover:-translate-y-1"
             :class="{
               'bg-red-50 border-red-200 text-red-900': alerta.color === 'red',
               'bg-orange-50 border-orange-200 text-orange-900': alerta.color === 'orange',
               'bg-amber-50 border-amber-200 text-amber-900': alerta.color === 'amber',
               'bg-blue-50 border-blue-200 text-blue-900': alerta.color === 'blue',
               'bg-purple-50 border-purple-200 text-purple-900': alerta.color === 'purple',
               'bg-green-50 border-green-200 text-green-900': alerta.color === 'green',
             }">
          <div class="mt-1">
            <svg v-if="alerta.color === 'green'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <h5 class="font-bold text-xs tracking-wider opacity-80 mb-1 uppercase">{{ alerta.tipo }}</h5>
            <p class="font-semibold text-sm leading-snug">{{ alerta.mensaje }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabla Detallada por Sucursal (Visible siempre) -->
    <div class="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
      <div class="bg-slate-800 px-6 py-5 flex justify-between items-center">
        <h3 class="font-bold text-white text-lg">Desglose de Rendimiento por Sucursal</h3>
        <span class="bg-white text-slate-800 px-3 py-1 rounded-full text-xs font-bold shadow-inner">
          Global
        </span>
      </div>
      
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider font-bold text-slate-500">
              <th class="px-6 py-4">Sucursal</th>
              <th class="px-6 py-4 text-center">Volumen Pedidos</th>
              <th class="px-6 py-4 text-center">ERI <span class="text-slate-400 font-normal">(>97%)</span></th>
              <th class="px-6 py-4 text-center">OTIF On-Time <span class="text-slate-400 font-normal">(>95%)</span></th>
              <th class="px-6 py-4 text-center">OTIF In-Full <span class="text-slate-400 font-normal">(>95%)</span></th>
              <th class="px-6 py-4 text-center">Rectificados <span class="text-slate-400 font-normal">(<10%)</span></th>
              <th class="px-6 py-4 text-center">Emergencias <span class="text-slate-400 font-normal">(<5%)</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="suc in kpisPorSucursal" :key="suc.id" class="hover:bg-blue-50/50 transition-colors">
              <td class="px-6 py-4 font-bold text-slate-800 flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">{{ suc.nombre.charAt(0) }}</div>
                {{ suc.nombre }}
              </td>
              <td class="px-6 py-4 text-center font-medium text-slate-600">{{ suc.totalPedidos }}</td>
              <td class="px-6 py-4 text-center font-bold" :class="suc.eri >= 97 ? 'text-emerald-600' : 'text-red-600'">{{ suc.eri }}%</td>
              <td class="px-6 py-4 text-center font-bold" :class="suc.otifOnTime >= 95 ? 'text-emerald-600' : 'text-orange-600'">{{ suc.otifOnTime }}%</td>
              <td class="px-6 py-4 text-center font-bold" :class="suc.otifInFull >= 95 ? 'text-emerald-600' : 'text-orange-600'">{{ suc.otifInFull }}%</td>
              <td class="px-6 py-4 text-center font-bold" :class="suc.rectificados <= 10 ? 'text-emerald-600' : 'text-amber-600'">{{ suc.rectificados }}%</td>
              <td class="px-6 py-4 text-center font-bold" :class="suc.emergencia <= 5 ? 'text-emerald-600' : 'text-indigo-600'">{{ suc.emergencia }}%</td>
            </tr>
            <tr v-if="kpisPorSucursal.length === 0">
              <td colspan="7" class="px-6 py-8 text-center text-slate-500 italic">No hay sucursales registradas</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
