<script setup>
import { ref, onMounted } from 'vue';
import { usePedidoStore } from '../stores/pedidoStore';
import { useTenantStore } from '../stores/tenantStore';
import { useSuministrosStore } from '../stores/suministrosStore';
import AuditoriaForm from '../components/AuditoriaForm.vue';
import CrearPedidoForm from '../components/CrearPedidoForm.vue';
import Swal from 'sweetalert2';

const pedidoStore = usePedidoStore();
const tenantStore = useTenantStore();
const suministrosStore = useSuministrosStore();
const showNuevoPedido = ref(false);
const pedidoEnRecepcionTienda = ref(null);
const facturaTiendaInput = ref('');
const cantidadesRecibidasTienda = ref({});
const miSucursal = ref('');

onMounted(() => {
  pedidoStore.fetchPedidos();
  if (tenantStore.sucursales.length === 0) tenantStore.fetchSucursales();
  if (tenantStore.empresas.length === 0) tenantStore.fetchEmpresas();
  if (suministrosStore.proveedores.length === 0) suministrosStore.fetchProveedores();
});

const isSubmitting = ref(false);

const onAuditoriaCompletada = async (itemsFinales) => {
  if (isSubmitting.value) return; // Prevenir doble clic

  if (!miSucursal.value) {
    return Swal.fire('Error', 'Selecciona tu sucursal en el panel superior antes de pedir.', 'error');
  }
  
  isSubmitting.value = true;
  const suc = tenantStore.sucursales.find(s => s.id === miSucursal.value);
  const emp = tenantStore.empresas.find(e => e.id === suc.id_empresa);

  const pedidosPorProveedor = {};
  itemsFinales.forEach(item => {
    const provId = item.id_proveedor || 'DESCONOCIDO';
    if (!pedidosPorProveedor[provId]) pedidosPorProveedor[provId] = [];
    pedidosPorProveedor[provId].push(item);
  });

  try {
    const promises = [];
    for (const provId in pedidosPorProveedor) {
      const items = pedidosPorProveedor[provId];
      const proveedor = suministrosStore.proveedores.find(p => p.id === provId);
      const nodo = (proveedor && proveedor.nodos_sucursal && proveedor.nodos_sucursal[miSucursal.value]) 
        ? proveedor.nodos_sucursal[miSucursal.value] 
        : (proveedor ? proveedor.nodo_entrega : 'BODEGA');

      const is_emergency = ![1, 4].includes(new Date().getDay());
      const pedidoData = {
        items: items,
        id_grupo: emp ? emp.id_grupo : 'DESCONOCIDO',
        id_empresa: suc.id_empresa,
        id_sucursal: suc.id,
        id_proveedor: provId,
        nodo_entrega: nodo,
        is_emergency: is_emergency
      };
      promises.push(pedidoStore.crearPedido(pedidoData));
    }
    
    await Promise.all(promises);

    Swal.fire({
      title: '¡Éxito!',
      text: `¡Se generaron ${Object.keys(pedidosPorProveedor).length} pedido(s) separados por proveedor exitosamente!`,
      icon: 'success',
      customClass: { popup: 'liquid-crystal-modal' }
    });
    showNuevoPedido.value = false;
    pedidoStore.clearDraft(); // LIMPIAR BORRADOR AL TERMINAR
  } catch (error) {
    Swal.fire({
      title: 'Error',
      text: 'Error al crear pedido: ' + error.message,
      icon: 'error',
      customClass: { popup: 'liquid-crystal-modal' }
    });
  } finally {
    isSubmitting.value = false;
  }
};

const onPedidoConfirmado = async (itemsFinales) => {
  try {
    const pedidoData = {
      items: itemsFinales,
      // Lógica de Tenant Escalable Corporativa
      id_grupo: 'GRP_CORP_CENTRAL',
      id_empresa: 'EMP_NORTE_SA',
      id_sucursal: 'SUC_ZONA_10'
    };
    await pedidoStore.crearPedido(pedidoData);
    Swal.fire({
      title: '¡Éxito!',
      text: '¡Pedido PENDIENTE creado exitosamente!',
      icon: 'success',
      customClass: { popup: 'liquid-crystal-modal' }
    });
    showNuevoPedido.value = false;
    fasePedido.value = 'auditoria';
    itemsAuditadosDraft.value = [];
    pedidoStore.clearDraft(); // LIMPIAR BORRADOR AL TERMINAR
  } catch (error) {
    Swal.fire({
      title: 'Error',
      text: 'Error al crear pedido: ' + error.message,
      icon: 'error',
      customClass: { popup: 'liquid-crystal-modal' }
    });
  }
};

const iniciarNuevoPedido = () => {
  showNuevoPedido.value = true;
  pedidoStore.clearDraft();
  pedidoStore.saveDraft();
};

const reanudarBorrador = () => {
  showNuevoPedido.value = true;
};

const cancelarNuevoPedido = async () => {
  const result = await Swal.fire({
    title: '¿Cancelar Pedido?',
    text: '¿Estás seguro de salir? Tu progreso se guardará como borrador para cuando regreses.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, salir',
    cancelButtonText: 'Quedarme',
    customClass: { popup: 'liquid-crystal-modal' }
  });
  if(result.isConfirmed) {
    showNuevoPedido.value = false;
  }
};

const eliminarBorrador = async () => {
  const result = await Swal.fire({
    title: '¿Descartar Borrador?',
    text: '¿Deseas descartar el borrador y perder este progreso?',
    icon: 'error',
    showCancelButton: true,
    confirmButtonText: 'Sí, descartar',
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'liquid-crystal-modal' }
  });
  if(result.isConfirmed) {
    pedidoStore.clearDraft();
  }
};

const iniciarRecepcionTienda = (pedido) => {
  pedidoEnRecepcionTienda.value = pedido;
  facturaTiendaInput.value = pedido.factura_bodega || '';
  cantidadesRecibidasTienda.value = {};
  pedido.items.forEach(item => {
    const despachada = item.cantidad_recibida_bodega !== undefined ? item.cantidad_recibida_bodega : (item.cantidad_aprobada || item.cantidad_solicitada);
    cantidadesRecibidasTienda.value[item.sku] = despachada;
  });
};

const cancelarRecepcionTienda = () => {
  pedidoEnRecepcionTienda.value = null;
};

const confirmarRecepcionTienda = async () => {
  // Factura o ID de traslado puede ser opcional al corroborar datos de entrega


  let conDiscrepancia = false;
  const itemsActualizados = pedidoEnRecepcionTienda.value.items.map(item => {
    const recibido = parseInt(cantidadesRecibidasTienda.value[item.sku]) || 0;
    const despachada = item.cantidad_recibida_bodega !== undefined ? item.cantidad_recibida_bodega : (item.cantidad_aprobada || item.cantidad_solicitada);
    if (recibido !== parseInt(despachada)) {
      conDiscrepancia = true;
    }
    return {
      ...item,
      cantidad_recibida_tienda: recibido
    };
  });

  if (conDiscrepancia) {
    const result = await Swal.fire({
      title: 'Discrepancia Detectada',
      text: 'Existen diferencias entre lo pedido y lo recibido físicamente. ¿Deseas registrar esta diferencia en el sistema?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar con diferencia',
      cancelButtonText: 'Revisar nuevamente',
      customClass: { popup: 'liquid-crystal-modal' }
    });
    if (!result.isConfirmed) return;
  }

  try {
    await pedidoStore.modificarPedido(pedidoEnRecepcionTienda.value.id, {
      estado: 'CONCILIADO',
      items: itemsActualizados,
      numero_factura: facturaTiendaInput.value,
      fecha_recepcion_tienda: new Date().toISOString()
    }, 'Tienda');
    Swal.fire('¡Conciliado!', 'El inventario ha ingresado correctamente a la sucursal.', 'success');
    pedidoEnRecepcionTienda.value = null;
  } catch (error) {
    Swal.fire('Error', error.message, 'error');
  }
};

const eliminarPedido = async (id) => {
  const result = await Swal.fire({
    title: '¿Eliminar Pedido?',
    text: "Esta acción no se puede deshacer. ¿Seguro que deseas eliminarlo permanentemente?",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'liquid-crystal-modal' }
  });

  if (result.isConfirmed) {
    try {
      await pedidoStore.eliminarPedido(id);
      Swal.fire({ title: 'Eliminado', text: 'El pedido ha sido eliminado.', icon: 'success', customClass: { popup: 'liquid-crystal-modal' } });
    } catch (e) {
      Swal.fire({ title: 'Error', text: e.message || 'No se pudo eliminar el pedido.', icon: 'error', customClass: { popup: 'liquid-crystal-modal' } });
    }
  }
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <!-- Banner de Borrador -->
    <div v-if="pedidoStore.draft.active && !showNuevoPedido" class="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div class="flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        <div>
          <h3 class="font-bold text-orange-800">Tienes un pedido en curso (No guardado)</h3>
          <p class="text-sm text-orange-600">Saliste de la pestaña antes de enviar el pedido. Tu progreso está a salvo.</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button @click="eliminarBorrador" class="px-3 py-1.5 text-sm font-semibold text-orange-700 hover:bg-orange-100 rounded-lg transition-colors">Descartar</button>
        <button @click="reanudarBorrador" class="px-4 py-1.5 text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-md transition-colors">Continuar Borrador</button>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <h2 class="text-2xl font-bold text-slate-800">Panel de Sucursal</h2>
        <p class="text-slate-500 text-sm">Gestiona tus pedidos y reporta inventarios de tu sucursal.</p>
      </div>
      
      <div class="flex items-center gap-4">
        <div class="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
          <label class="text-xs font-bold text-slate-500 mr-2">Mi Sucursal:</label>
          <select v-model="miSucursal" class="bg-transparent font-bold text-blue-700 outline-none">
            <option value="" disabled>Selecciona tu tienda...</option>
            <option v-for="suc in tenantStore.sucursales" :key="suc.id" :value="suc.id">{{ suc.nombre }}</option>
          </select>
        </div>

        <button v-if="!showNuevoPedido && !pedidoStore.draft.active" @click="iniciarNuevoPedido" class="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 transition-all transform active:scale-95">
          + Nuevo Pedido
        </button>
        <button v-else-if="showNuevoPedido" @click="cancelarNuevoPedido" class="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all">
          Guardar y Salir
        </button>
      </div>
    </div>

    <div class="mb-6 flex gap-2" v-if="showNuevoPedido">
      <div class="flex-1 p-3 rounded-xl border text-center font-bold bg-blue-100 border-blue-300 text-blue-700">
        Auditoría Física y Generación de Pedido
      </div>
    </div>

    <transition mode="out-in" enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 translate-y-4" enter-to-class="opacity-100 translate-y-0" leave-active-class="transition duration-200 ease-in" leave-from-class="opacity-100 translate-y-0" leave-to-class="opacity-0 translate-y-4">
      
      <div v-if="showNuevoPedido">
        <AuditoriaForm :sucursal-id="miSucursal" :is-submitting="isSubmitting" @auditoria-completada="onAuditoriaCompletada" />
      </div>
      
      <div v-else class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h3 class="text-lg font-bold text-slate-800">Tus Pedidos Recientes</h3>
          <button @click="pedidoStore.fetchPedidos()" class="text-sm font-semibold text-blue-600 hover:underline">Actualizar</button>
        </div>
        
        <div v-if="pedidoStore.loading && pedidoStore.pedidos.length === 0" class="flex justify-center py-10">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        
        <div v-else>
          <div v-if="pedidoStore.pedidos.length === 0" class="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p class="text-slate-500 font-medium">No has realizado pedidos aún.</p>
          </div>

          <ul v-else-if="!pedidoEnRecepcionTienda" class="space-y-4">
            <li v-for="pedido in pedidoStore.pedidos" :key="pedido.id" class="p-5 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors">
              <div>
                <h3 class="font-bold text-slate-800">Pedido <span class="text-sm text-slate-500 font-mono">#{{ pedido.id }}</span></h3>
                <p class="text-sm text-slate-500 mb-1">{{ new Date(pedido.fecha).toLocaleString() }}</p>
                <div class="flex items-center gap-2 mb-1 flex-wrap">
                  <span class="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider">Prov: {{ suministrosStore.proveedores.find(p => p.id === (pedido.id_proveedor || pedido.proveedor_id))?.nombre || pedido.proveedor_nombre || pedido.id_proveedor || pedido.proveedor_id || 'N/A' }}</span>
                  <span class="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-md uppercase tracking-wider">Suc: {{ tenantStore.sucursales.find(s => s.id === (pedido.id_sucursal || pedido.tienda_id))?.nombre || pedido.id_sucursal || pedido.tienda_id || 'N/A' }}</span>
                </div>
                <p v-if="pedido.estado === 'RECHAZADO'" class="text-xs text-red-600 mt-1 font-semibold bg-red-50 inline-block px-2 py-0.5 rounded border border-red-100">Motivo de rechazo: {{ pedido.motivo_rechazo || 'No especificado' }}</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide border" 
                      :class="{
                        'bg-amber-100 text-amber-800 border-amber-200': pedido.estado === 'PENDIENTE',
                        'bg-blue-100 text-blue-800 border-blue-200': pedido.estado === 'TOMADO_POR_PROVEEDOR',
                        'bg-purple-100 text-purple-800 border-purple-200': pedido.estado === 'RECIBIDO_BODEGA' || pedido.estado === 'ENTREGA_EN_BODEGA',
                        'bg-indigo-100 text-indigo-800 border-indigo-200': pedido.estado === 'EN_CAMINO',
                        'bg-green-100 text-green-800 border-green-200': pedido.estado === 'CONCILIADO' || pedido.estado === 'RECIBIDO_FINALIZADO',
                        'bg-red-100 text-red-800 border-red-200': pedido.estado === 'RECHAZADO'
                      }">
                  {{ pedido.estado }}
                </span>
                
                <button 
                  v-if="pedido.estado === 'EN_CAMINO' || (pedido.estado === 'TOMADO_POR_PROVEEDOR' && pedido.nodo_entrega === 'DIRECTO_TIENDA')" 
                  @click="iniciarRecepcionTienda(pedido)" 
                  class="px-3 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 shadow-md transition-colors"
                >
                  Recibir Físico
                </button>
                <button 
                  @click="eliminarPedido(pedido.id)" 
                  class="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors border border-red-200"
                  title="Eliminar Pedido"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </li>
          </ul>

          <div v-else>
            <div class="mb-4">
              <button @click="cancelarRecepcionTienda" class="text-slate-500 hover:text-slate-700 font-semibold mb-4 flex items-center gap-2">
                <span>&larr;</span> Volver a Lista
              </button>
              <h3 class="text-xl font-bold text-slate-800">Conciliación de Ingreso a Tienda - Pedido #{{ pedidoEnRecepcionTienda.id }}</h3>
            </div>
            
            <div v-if="pedidoEnRecepcionTienda.guia" class="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <h4 class="text-sm font-bold text-blue-800 mb-2">Datos de Entrega a Corroborar:</h4>
              <p class="text-sm text-blue-700"><b>Transporte / Método:</b> {{ pedidoEnRecepcionTienda.guia.transporte }}</p>
              <p class="text-sm text-blue-700"><b>No. de Guía:</b> {{ pedidoEnRecepcionTienda.guia.guia }}</p>
            </div>
            
            <div class="mb-6">
              <label class="block text-sm font-bold text-slate-700 mb-2">Confirmación de Traslado o Remisión <span class="text-slate-400 font-normal">(Opcional)</span></label>
              <input type="text" v-model="facturaTiendaInput" class="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" placeholder="Ingresa ID de traslado o déjalo vacío si no aplica" />
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div class="space-y-3">
                <div v-for="item in pedidoEnRecepcionTienda.items" :key="item.sku" class="flex flex-col md:flex-row justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm gap-4">
                  <div class="flex-1">
                    <p class="font-bold text-slate-800">{{ item.nombre }} <span class="text-xs text-slate-500 font-mono">({{ item.presentacion || 'Unidad' }})</span></p>
                    <p class="text-sm text-slate-500">Cantidad Despachada: <span class="font-bold text-blue-600">{{ item.cantidad_recibida_bodega !== undefined ? item.cantidad_recibida_bodega : (item.cantidad_aprobada || item.cantidad_solicitada) }}</span></p>
                  </div>
                  <div class="flex items-center gap-3">
                    <label class="text-sm font-bold text-slate-700">Cant. Recibida Físicamente:</label>
                    <input type="number" min="0" v-model="cantidadesRecibidasTienda[item.sku]" class="w-24 px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-green-500 outline-none" />
                  </div>
                </div>
              </div>
              
              <div class="mt-6 flex justify-end">
                <button @click="confirmarRecepcionTienda" class="px-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow-md hover:bg-green-700 transition-colors">
                  Finalizar Conciliación
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

