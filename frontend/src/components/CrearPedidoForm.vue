<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { usePedidoStore } from '../stores/pedidoStore';
import Swal from 'sweetalert2';

const props = defineProps({
  itemsAuditados: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['pedido-confirmado', 'volver-auditoria']);
const pedidoStore = usePedidoStore();

// Usar el borrador si existe y tiene items, sino usar los props
const initialItems = (pedidoStore.draft.itemsAuditados && pedidoStore.draft.itemsAuditados.length > 0) 
  ? pedidoStore.draft.itemsAuditados 
  : props.itemsAuditados;

const itemsPedido = ref(JSON.parse(JSON.stringify(initialItems)));
const enviando = ref(false);

watch(itemsPedido, (newVal) => {
  pedidoStore.draft.itemsAuditados = newVal;
  pedidoStore.saveDraft();
}, { deep: true });


const totalItems = computed(() => {
  return itemsPedido.value.reduce((total, item) => total + parseInt(item.cantidad_solicitada || 0), 0);
});

const confirmarPedido = () => {
  enviando.value = true;
  // Validar que al menos haya 1 item con cantidad solicitada > 0
  if (totalItems.value <= 0) {
    Swal.fire({
      title: 'Atención',
      text: 'El pedido debe contener al menos un producto a solicitar.',
      icon: 'warning',
      customClass: { popup: 'liquid-crystal-modal' }
    });
    enviando.value = false;
    return;
  }
  emit('pedido-confirmado', itemsPedido.value);
};
</script>

<template>
  <div class="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
    <div class="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-8 relative overflow-hidden">
      <div class="absolute -right-10 -top-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
      <h2 class="text-2xl font-bold text-white relative z-10 flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        Ingresar Pedido al Sistema
      </h2>
      <p class="text-emerald-100 mt-2 text-sm relative z-10">Revisa las sugerencias basadas en tu auditoría y ajusta las cantidades que deseas pedir.</p>
    </div>

    <div class="p-6">
      <div class="space-y-4 mb-6">
        <div v-for="item in itemsPedido" :key="item.sku" class="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div class="flex-1">
            <h3 class="font-bold text-slate-800">{{ item.nombre }}</h3>
            <div class="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span class="bg-slate-200 px-2 py-0.5 rounded text-xs font-mono">SKU: {{ item.sku }}</span>
              <span>Físico reportado: <strong>{{ item.cantidad_fisica_reportada }}</strong></span>
            </div>
          </div>
          
          <div class="flex items-center gap-3">
            <label class="text-sm font-semibold text-slate-700">Cant. a pedir:</label>
            <input 
              type="number" 
              min="0"
              v-model="item.cantidad_solicitada"
              class="w-24 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-between items-center pt-6 border-t border-slate-200">
        <button 
          @click="emit('volver-auditoria')"
          class="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-lg transition-colors"
        >
          &larr; Volver a Auditoría
        </button>
        
        <div class="flex items-center gap-4">
          <div class="text-right mr-4">
            <span class="block text-xs text-slate-500 uppercase tracking-wider font-bold">Total a pedir</span>
            <span class="block text-2xl font-black text-emerald-600">{{ totalItems }} u.</span>
          </div>
          <button 
            @click="confirmarPedido"
            :disabled="enviando || totalItems <= 0"
            class="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all transform active:scale-95 flex items-center gap-2"
          >
            <span v-if="enviando">Enviando...</span>
            <span v-else>Enviar Pedido (PENDIENTE)</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
