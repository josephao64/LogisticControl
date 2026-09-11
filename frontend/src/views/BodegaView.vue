<script setup>
import { onMounted, computed, ref } from 'vue';
import { usePedidoStore } from '../stores/pedidoStore';
import { useTenantStore } from '../stores/tenantStore';
import { useSuministrosStore } from '../stores/suministrosStore';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const pedidoStore = usePedidoStore();
const tenantStore = useTenantStore();
const suministrosStore = useSuministrosStore();
const pedidoEnRecepcion = ref(null);
const facturaInput = ref('');
const cantidadesRecibidas = ref({});

onMounted(() => {
  pedidoStore.fetchPedidos();
  if (tenantStore.sucursales.length === 0) tenantStore.fetchSucursales();
  if (suministrosStore.proveedores.length === 0) suministrosStore.fetchProveedores();
});

const pedidosEnTransito = computed(() => {
  return pedidoStore.pedidos.filter(p => 
    ['TOMADO_POR_PROVEEDOR', 'RECIBIDO_BODEGA'].includes(p.estado) &&
    (p.nodo_entrega === 'BODEGA' || !p.nodo_entrega)
  );
});

const pedidosDespachados = computed(() => {
  return pedidoStore.pedidos.filter(p => 
    ['EN_CAMINO', 'CONCILIADO', 'RECIBIDO_FINALIZADO'].includes(p.estado) &&
    (p.nodo_entrega === 'BODEGA' || !p.nodo_entrega)
  );
});

const iniciarRecepcion = (pedido) => {
  pedidoEnRecepcion.value = pedido;
  facturaInput.value = '';
  cantidadesRecibidas.value = {};
  pedido.items.forEach(item => {
    cantidadesRecibidas.value[item.sku] = item.cantidad_solicitada; // Default to expected
  });
};

const cancelarRecepcion = () => {
  pedidoEnRecepcion.value = null;
};

const confirmarRecepcion = async () => {
  if (!facturaInput.value) {
    return Swal.fire('Error', 'Debe ingresar el número de factura', 'error');
  }

  const itemsActualizados = pedidoEnRecepcion.value.items.map(item => {
    return {
      ...item,
      cantidad_recibida_bodega: cantidadesRecibidas.value[item.sku]
    };
  });

  try {
    await pedidoStore.modificarPedido(pedidoEnRecepcion.value.id, {
      estado: 'RECIBIDO_BODEGA',
      items: itemsActualizados,
      factura_bodega: facturaInput.value,
      fecha_recepcion_bodega: new Date().toISOString()
    }, 'Bodega');
    
    Swal.fire('¡Recibido!', `Pedido registrado en Bodega con factura: ${facturaInput.value}`, 'success');
    pedidoEnRecepcion.value = null;
  } catch (error) {
    Swal.fire('Error', error.message, 'error');
  }
};

const adjuntarGuia = async (pedido) => {
  const { value: formValues } = await Swal.fire({
    title: 'Adjuntar Guía de Transporte',
    html:
      `<input id="swal-transporte" class="swal2-input" placeholder="Método (Ej. Guatex, Propio)">` +
      `<input id="swal-guia" class="swal2-input" placeholder="No. de Guía o Referencia">` +
      `<textarea id="swal-comentario" class="swal2-textarea" placeholder="Notas del Despacho (Opcional)"></textarea>`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Guía y Despachar',
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'liquid-crystal-modal' },
    preConfirm: () => {
      const transporte = document.getElementById('swal-transporte').value;
      const guia = document.getElementById('swal-guia').value;
      const comentario = document.getElementById('swal-comentario').value;
      if (!transporte || !guia) {
        Swal.showValidationMessage('Ambos campos son obligatorios');
        return false;
      }
      return { transporte, guia, comentario };
    }
  });

  if (formValues) {
    try {
      await pedidoStore.adjuntarGuia(pedido.id, formValues);
      
      const pedidoActualizado = { ...pedido, guia: formValues };
      generarConstanciaDespacho(pedidoActualizado);

      Swal.fire({ title: '¡En Camino!', text: 'La guía se adjuntó, el pedido está en camino y se generó la constancia.', icon: 'success', customClass: { popup: 'swal2-popup' } });
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  }
};

const generarConstanciaDespacho = (pedido) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Helpers
  const fillRoundRect = (x, y, w, h, r, color, shadow = false) => {
    ctx.save();
    if (shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 20;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 10;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();
    ctx.restore();
  };

  const strokeRoundRect = (x, y, w, h, r, color, lineWidth = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.stroke();
  };
  
  // Dimensions
  canvas.width = 1200;
  canvas.height = 1100 + (pedido.items.length * 50);
  
  // Background
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Header left
  ctx.fillStyle = '#4c1d68'; // Dark purple
  ctx.font = '300 42px sans-serif';
  ctx.fillText('CONSTANCIA DE', 60, 90);
  ctx.font = '400 42px sans-serif';
  ctx.fillText('DESPACHO (BODEGA)', 60, 140);
  
  // Header right (Rounded box)
  fillRoundRect(720, 50, 420, 110, 10, '#ffffff', false);
  strokeRoundRect(720, 50, 420, 110, 10, '#94a3b8');
  
  const guia = pedido.guia || {};
  ctx.fillStyle = '#1e293b';
  ctx.font = '400 26px sans-serif';
  ctx.fillText('PEDIDO: ', 750, 95);
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#4c1d68';
  ctx.fillText(pedido.id, 860, 95);
  
  ctx.fillStyle = '#1e293b';
  ctx.font = '400 26px sans-serif';
  ctx.fillText('GUÍA: ', 750, 135);
  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#000000';
  ctx.fillText(guia.guia || 'N/A', 830, 135);
  
  let currentY = 240;
  
  // Shipment Overview Box
  fillRoundRect(60, currentY - 50, 320, 60, 10, '#ffffff', true); // Tab
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(60, currentY - 20, 320, 30); // Connect tab to box
  fillRoundRect(60, currentY, 1080, 230, 10, '#ffffff', true); // Main box
  strokeRoundRect(60, currentY, 1080, 230, 10, '#cbd5e1'); // Main box border
  strokeRoundRect(60, currentY - 50, 320, 60, 10, '#cbd5e1'); // Tab border
  ctx.fillRect(61, currentY - 2, 318, 4); // Hide tab bottom border
  
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Resumen del Despacho', 90, currentY - 15);
  ctx.fillText('Ruta y Detalles', 90, currentY + 40);
  
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('ORIGEN: Bodega Central', 130, currentY + 90);
  
  const sucursalNombre = tenantStore.sucursales.find(s => s.id === (pedido.id_sucursal || pedido.tienda_id))?.nombre || pedido.id_sucursal || pedido.tienda_id || 'N/A';
  ctx.fillText(`DESTINO: ${sucursalNombre}`, 680, currentY + 90);
  
  // Line separator
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(90, currentY + 120);
  ctx.lineTo(1110, currentY + 120);
  ctx.stroke();
  
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('[Fecha de Pedido:]', 90, currentY + 160);
  ctx.fillText('[Fecha de Envío:]', 90, currentY + 200);
  
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(new Date(pedido.fecha).toLocaleString(), 290, currentY + 160);
  ctx.fillText(new Date().toLocaleString(), 290, currentY + 200);
  
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('[Método de Envío:]', 630, currentY + 160);
  ctx.fillText('[Recepción en Bodega:]', 630, currentY + 200);
  
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(guia.transporte || 'N/A', 860, currentY + 160);
  ctx.fillText(pedido.fecha_recepcion_bodega ? new Date(pedido.fecha_recepcion_bodega).toLocaleString() : (pedido.fecha_actualizacion ? new Date(pedido.fecha_actualizacion).toLocaleString() : 'N/A'), 860, currentY + 200);
  
  currentY += 270;
  
  // Table
  // Header
  ctx.fillStyle = '#9772a8'; // Light purple
  ctx.beginPath();
  ctx.moveTo(60 + 10, currentY);
  ctx.lineTo(1140 - 10, currentY);
  ctx.quadraticCurveTo(1140, currentY, 1140, currentY + 10);
  ctx.lineTo(1140, currentY + 50);
  ctx.lineTo(60, currentY + 50);
  ctx.lineTo(60, currentY + 10);
  ctx.quadraticCurveTo(60, currentY, 60 + 10, currentY);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PRODUCTO', 90, currentY + 32);
  ctx.fillText('PRESENTACIÓN', 450, currentY + 32);
  ctx.fillText('CANTIDAD DESPACHADA', 800, currentY + 32);
  
  currentY += 50;
  
  // Body
  pedido.items.forEach((item, index) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(60, currentY, 1080, 50);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(60, currentY, 1080, 50);
    
    ctx.fillStyle = '#0f172a';
    ctx.font = '20px sans-serif';
    ctx.fillText(item.nombre || item.sku, 90, currentY + 32);
    ctx.fillText(item.presentacion || 'Unidad', 450, currentY + 32);
    
    ctx.font = 'bold 20px sans-serif';
    const cant = (item.cantidad_recibida_bodega !== undefined ? item.cantidad_recibida_bodega : (item.cantidad_aprobada || item.cantidad_solicitada)).toString();
    ctx.fillText(cant, 800, currentY + 32);
    
    currentY += 50;
  });
  
  currentY += 40;
  
  // Notas del Despacho Box
  fillRoundRect(60, currentY, 1080, 200, 10, '#ffffff', true);
  strokeRoundRect(60, currentY, 1080, 200, 10, '#cbd5e1');
  
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Notas del Despacho', 120, currentY + 45);
  
  fillRoundRect(90, currentY + 70, 1020, 100, 8, '#f1f5f9');
  strokeRoundRect(90, currentY + 70, 1020, 100, 8, '#cbd5e1');
  
  ctx.fillStyle = '#475569';
  ctx.font = '20px sans-serif';
  
  // Text wrap function
  const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
    if (!text || text.trim() === '') {
      context.fillText('Sin comentarios.', x, y);
      return;
    }
    const words = text.split(' ');
    let line = '';
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        context.fillText(line, x, y);
        line = words[n] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, y);
  };
  
  wrapText(ctx, guia.comentario, 110, currentY + 110, 980, 28);
  
  currentY += 280;
  
  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '16px sans-serif';
  ctx.fillText('Guatemala', 560, currentY + 20);
  ctx.fillText('2026', 580, currentY + 40);

  // Download
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `Despacho_Bodega_${pedido.id}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-slate-800">Control de Bodega</h2>
      <p class="text-slate-500 mt-2">Gestiona la recepción de insumos enrutados a BODEGA e ingresa facturas para trazabilidad.</p>
    </div>

    <div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div class="bg-purple-600 px-6 py-4 flex justify-between items-center">
        <h3 class="font-bold text-white text-lg">Recepciones Pendientes (Nodo: BODEGA)</h3>
        <span class="bg-white text-purple-800 px-3 py-1 rounded-full text-sm font-bold shadow-inner">
          {{ pedidosEnTransito.length }}
        </span>
      </div>
      
      <div class="p-6">
        <div v-if="pedidoStore.loading && pedidosEnTransito.length === 0" class="flex justify-center py-10">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
        
        <div v-else-if="pedidosEnTransito.length === 0" class="text-center py-12">
          <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg class="w-8 h-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <h4 class="text-lg font-bold text-slate-700">Bodega despejada</h4>
          <p class="text-slate-500 mt-1">No hay entregas pendientes de proveedores en este nodo.</p>
        </div>

        <div v-else-if="pedidoEnRecepcion">
          <div class="mb-4">
            <button @click="cancelarRecepcion" class="text-slate-500 hover:text-slate-700 font-semibold mb-4 flex items-center gap-2">
              <span>&larr;</span> Volver a Lista
            </button>
            <h3 class="text-xl font-bold text-slate-800">Auditoría de Recepción - Pedido #{{ pedidoEnRecepcion.id }}</h3>
          </div>
          
          <div class="mb-6">
            <label class="block text-sm font-bold text-slate-700 mb-2">Número de Factura del Proveedor <span class="text-red-500">*</span></label>
            <input type="text" v-model="facturaInput" class="w-full md:w-1/2 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Ej. FAC-001234" />
          </div>

          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <h4 class="font-bold text-slate-700 mb-4">Cruce de Cantidades</h4>
            <div class="space-y-3">
              <div v-for="item in pedidoEnRecepcion.items" :key="item.sku" class="flex flex-col md:flex-row justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm gap-4">
                <div class="flex-1">
                  <p class="font-bold text-slate-800">{{ item.nombre }} <span class="text-xs text-slate-500 font-mono">({{ item.presentacion || 'Unidad' }})</span></p>
                  <p class="text-sm text-slate-500">Cantidad Pedida: <span class="font-bold text-blue-600">{{ item.cantidad_solicitada }}</span></p>
                </div>
                <div class="flex items-center gap-3">
                  <label class="text-sm font-bold text-slate-700">Cant. Recibida:</label>
                  <input type="number" min="0" v-model="cantidadesRecibidas[item.sku]" class="w-24 px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-purple-500 outline-none" />
                </div>
              </div>
            </div>
            
            <div class="mt-6 flex justify-end">
              <button @click="confirmarRecepcion" class="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold shadow-md hover:bg-purple-700 transition-colors">
                Finalizar Recepción y Conciliar
              </button>
            </div>
          </div>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="pedido in pedidosEnTransito" :key="pedido.id" class="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col relative">
            <div class="mb-3">
               <span class="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-md uppercase tracking-wider block mb-1">Proveedor: {{ suministrosStore.proveedores.find(p => p.id === (pedido.id_proveedor || pedido.proveedor_id))?.nombre || pedido.proveedor_nombre || pedido.proveedor_id || pedido.id_proveedor || 'N/A' }}</span>
               <span class="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-md uppercase tracking-wider block">Sucursal Destino: {{ tenantStore.sucursales.find(s => s.id === (pedido.id_sucursal || pedido.tienda_id))?.nombre || pedido.id_sucursal || pedido.tienda_id || 'N/A' }}</span>
            </div>
            <p class="text-sm text-slate-500 font-mono mt-1">ID: {{ pedido.id }}</p>
            
            <div class="my-4 flex-grow">
               <div class="p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                 <p class="text-sm font-semibold text-slate-700">{{ pedido.items?.length || 0 }} Artículos esperados</p>
               </div>
            </div>

            <div class="mt-auto pt-4 border-t border-slate-200">
              <div v-if="pedido.estado === 'TOMADO_POR_PROVEEDOR'">
                <button @click="iniciarRecepcion(pedido)" class="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-semibold text-sm shadow-md transition-transform transform active:scale-95 flex justify-center items-center gap-2">
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                  Recibir Físico y Factura
                </button>
              </div>
              <div v-else class="text-center p-3 bg-green-50 border border-green-200 rounded-lg shadow-inner">
                <p class="text-sm font-bold text-green-700 flex justify-center items-center gap-1">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                  Recibido en Bodega
                </p>
                <div v-if="pedido.guia" class="mt-2 text-xs font-mono bg-white p-2 rounded border border-blue-100 text-blue-800">
                  Transp: <b>{{ pedido.guia.transporte }}</b><br/>Guía: <b>{{ pedido.guia.guia }}</b>
                </div>
                <button v-else @click="adjuntarGuia(pedido)" class="mt-3 w-full py-1.5 text-xs bg-white text-blue-600 border border-blue-200 font-semibold rounded hover:bg-blue-50 transition-colors">Adjuntar Guía de Transporte</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Historial de Despachos -->
    <div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mt-8">
      <div class="bg-slate-700 px-6 py-4 flex justify-between items-center">
        <h3 class="font-bold text-white text-lg">Historial de Despachos (En Camino / Entregados)</h3>
        <span class="bg-slate-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-inner">
          {{ pedidosDespachados.length }}
        </span>
      </div>
      
      <div class="p-6">
        <div v-if="pedidosDespachados.length === 0" class="text-center py-8">
          <p class="text-slate-500">No hay despachos recientes.</p>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="pedido in pedidosDespachados" :key="pedido.id" class="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow flex flex-col relative">
            <div class="mb-3">
               <span class="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-wider block mb-1">Proveedor: {{ suministrosStore.proveedores.find(p => p.id === (pedido.id_proveedor || pedido.proveedor_id))?.nombre || pedido.proveedor_nombre || pedido.proveedor_id || pedido.id_proveedor || 'N/A' }}</span>
               <span class="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-1 rounded-md uppercase tracking-wider block">Destino: {{ tenantStore.sucursales.find(s => s.id === (pedido.id_sucursal || pedido.tienda_id))?.nombre || pedido.id_sucursal || pedido.tienda_id || 'N/A' }}</span>
            </div>
            <p class="text-sm text-slate-500 font-mono mt-1 mb-2">ID: {{ pedido.id }}</p>
            
            <div v-if="pedido.guia" class="text-xs font-mono bg-blue-50 p-2 rounded border border-blue-100 text-blue-800 mb-4">
              Transp: <b>{{ pedido.guia.transporte }}</b><br/>Guía: <b>{{ pedido.guia.guia }}</b>
            </div>

            <div class="mt-auto pt-4 border-t border-slate-200 flex justify-between items-center">
              <span class="text-xs font-bold" :class="pedido.estado === 'EN_CAMINO' ? 'text-indigo-600' : 'text-green-600'">
                {{ pedido.estado.replace('_', ' ') }}
              </span>
              <button @click="generarConstanciaDespacho(pedido)" class="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 font-bold rounded-lg transition-colors text-xs flex items-center gap-1 shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Constancia
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
