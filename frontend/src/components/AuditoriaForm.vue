<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { usePedidoStore } from '../stores/pedidoStore';
import { useSuministrosStore } from '../stores/suministrosStore';
import Swal from 'sweetalert2';

const pedidoStore = usePedidoStore();
const suministrosStore = useSuministrosStore();
const props = defineProps({
  sucursalId: {
    type: String,
    required: true
  },
  isSubmitting: {
    type: Boolean,
    default: false
  }
});
const emit = defineEmits(['auditoria-completada']);

const productos = computed(() => suministrosStore.insumos);

onMounted(() => {
  if(suministrosStore.insumos.length === 0) {
    suministrosStore.fetchInsumos();
  }
});

const formState = ref(pedidoStore.draft.formState || {});

watch(formState, (newVal) => {
  pedidoStore.draft.formState = newVal;
  pedidoStore.saveDraft();
}, { deep: true });

// Initialize formState for products if they don't exist
watch(productos, (prods) => {
  if (prods && prods.length > 0) {
    prods.forEach(p => {
      const key = p.id;
      if (!formState.value[key]) {
        formState.value[key] = { fisico: '', pedir: '' };
      }
    });
  }
}, { immediate: true });

const getPromedioParaSucursal = (prod) => {
  if (props.sucursalId && prod.promedios_sucursal && prod.promedios_sucursal[props.sucursalId] !== undefined) {
    return parseInt(prod.promedios_sucursal[props.sucursalId]);
  }
  return parseInt(prod.promedio_uso_semanal) || 0;
};

const onFisicoChange = (id) => {
  const item = formState.value[id];
  const prod = productos.value.find(p => p.id === id);
  if (item.fisico !== '' && item.fisico !== null) {
    const fisicoNum = parseInt(item.fisico) || 0;
    const promedio = getPromedioParaSucursal(prod);
    const sugerido = promedio - fisicoNum;
    
    // Solo auto-sugiere si el campo está completamente vacío
    if (item.pedir === '') {
      item.pedir = sugerido > 0 ? sugerido : 0;
    }
  }
};

const totalItemsPedir = computed(() => {
  return Object.values(formState.value).reduce((total, item) => total + (parseInt(item.pedir) || 0), 0);
});

const progresoAuditoria = computed(() => {
  if (productos.value.length === 0) return 0;
  const auditados = productos.value.filter(p => {
    const val = formState.value[p.id]?.fisico;
    // Considerado auditado si no está vacío y es diferente de 0
    return val !== '' && val !== null && Number(val) !== 0;
  }).length;
  return Math.round((auditados / productos.value.length) * 100);
});

const procesarPedido = () => {
  // Validación de Auditoría Forzada
  const faltantes = productos.value.filter(p => {
    const val = formState.value[p.id]?.fisico;
    return val === '' || val === null || Number(val) === 0;
  });

  if (faltantes.length > 0) {
    return Swal.fire({
      title: 'Auditoría Incompleta',
      text: `Falta reportar el inventario físico válido de ${faltantes.length} insumos. Recuerda que no se permiten valores en 0 en el inventario.`,
      icon: 'warning',
      customClass: { popup: 'swal2-popup' } // Assuming this relies on global styles from index.css
    });
  }
  
  const itemsFinales = [];
  
  productos.value.forEach(p => {
    const estado = formState.value[p.id] || { fisico: '', pedir: '' };
    const pPedir = parseInt(estado.pedir) || 0;
    const pFisico = estado.fisico !== '' && estado.fisico !== null ? parseInt(estado.fisico) : null;
    
    itemsFinales.push({
      sku: p.sku || p.id,
      nombre: p.nombre,
      presentacion: p.presentacion || 'Unidad',
      id_proveedor: p.id_proveedor,
      cantidad_fisica_reportada: pFisico || 0,
      cantidad_solicitada: pPedir,
      stock_teorico: getPromedioParaSucursal(p),
      precio_compra: Number(p.precio_compra) || 0
    });
  });

  emit('auditoria-completada', itemsFinales);
};
</script>

<template>
  <div class="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden transition-all duration-500 hover:shadow-2xl">
    <div class="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8 relative overflow-hidden">
      <div class="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
      <h2 class="text-2xl font-bold text-white relative z-10 flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        Auditoría Forzada y Pedido Integrado
      </h2>
      <p class="text-blue-100 mt-2 text-sm relative z-10">Debes realizar el conteo físico de todos los insumos para poder procesar tu pedido.</p>
    </div>

    <!-- Barra de progreso -->
    <div class="px-6 py-4 bg-slate-50 border-b border-slate-200">
      <div class="flex justify-between text-sm font-bold text-slate-700 mb-2">
        <span>Progreso de Auditoría Forzada</span>
        <span :class="progresoAuditoria === 100 ? 'text-green-600' : 'text-blue-600'">{{ progresoAuditoria }}%</span>
      </div>
      <div class="w-full bg-slate-200 rounded-full h-3 shadow-inner overflow-hidden">
        <div 
          class="h-3 rounded-full transition-all duration-500 relative" 
          :class="progresoAuditoria === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'"
          :style="{ width: progresoAuditoria + '%' }"
        >
          <div class="absolute top-0 left-0 bottom-0 right-0 bg-white/20 w-full animate-pulse"></div>
        </div>
      </div>
      <p class="text-xs text-slate-500 mt-2 font-medium">Nota: El inventario físico no puede quedar vacío ni ser 0. El campo "A Pedir" sí puede ser 0.</p>
    </div>

    <div class="p-6">
      <div v-if="productos.length === 0" class="text-center py-10">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p class="text-slate-500 mt-4">Cargando catálogo de insumos...</p>
      </div>

      <div v-else class="space-y-4">
        <!-- Encabezado de tabla (solo Desktop) -->
        <div class="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-slate-50 rounded-t-lg border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
          <div class="col-span-6">Insumo</div>
          <div class="col-span-3 text-center">Inv. Físico Actual</div>
          <div class="col-span-3 text-center">Cantidad a Pedir</div>
        </div>

        <div v-for="producto in productos" :key="producto.id" class="group relative flex flex-col md:grid md:grid-cols-12 gap-4 items-center p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
          <div class="w-full md:col-span-6 flex flex-col">
            <h3 class="font-bold text-slate-800">{{ producto.nombre }}</h3>
            <div class="flex gap-2 items-center mt-1 self-start">
              <span class="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded-md">SKU: {{ producto.sku || 'N/A' }}</span>
              <span class="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100">Promedio: {{ getPromedioParaSucursal(producto) }}</span>
            </div>
          </div>
          
          <div class="w-full md:col-span-3 flex justify-between md:justify-center items-center">
            <label class="md:hidden text-sm font-semibold text-slate-600">Inv. Físico:</label>
            <input 
              type="number" 
              min="1"
              v-model="formState[producto.id].fisico"
              @input="onFisicoChange(producto.id)"
              class="w-24 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm text-center"
              placeholder="Ej. 1"
            />
          </div>

          <div class="w-full md:col-span-3 flex justify-between md:justify-center items-center">
            <label class="md:hidden text-sm font-semibold text-slate-600">A Pedir:</label>
            <div class="flex flex-col items-center relative">
              <input 
                type="number" 
                min="0"
                v-model="formState[producto.id].pedir"
                class="w-24 px-3 py-2 bg-green-50 border border-green-300 rounded-lg text-green-800 font-bold focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all shadow-sm text-center"
                placeholder="0"
              />
              <span v-if="formState[producto.id].fisico !== '' && formState[producto.id].fisico !== null" class="absolute -bottom-5 text-[10px] font-bold text-slate-400 whitespace-nowrap">
                Sugerencia: {{ Math.max(0, getPromedioParaSucursal(producto) - (parseInt(formState[producto.id].fisico) || 0)) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-8 pt-6 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div class="text-center md:text-left">
          <span class="block text-sm text-slate-500 font-semibold uppercase">Total Unidades a Pedir</span>
          <span class="text-3xl font-black text-blue-700">{{ totalItemsPedir }}</span>
        </div>
        
        <button 
          @click="procesarPedido"
          :disabled="progresoAuditoria < 100 || isSubmitting"
          class="w-full md:w-auto px-8 py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 flex justify-center items-center gap-2 shadow-lg"
          :class="(progresoAuditoria === 100 && !isSubmitting) ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-blue-500/25' : 'bg-slate-300 cursor-not-allowed opacity-70 shadow-none'"
        >
          <span v-if="isSubmitting" class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
          {{ isSubmitting ? 'Procesando...' : 'Confirmar y Enviar Pedido' }}
        </button>
      </div>
    </div>
  </div>
</template>
