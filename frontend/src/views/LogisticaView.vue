<script setup>
import { onMounted, computed, ref } from 'vue';
import { usePedidoStore } from '../stores/pedidoStore';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useSuministrosStore } from '../stores/suministrosStore';
import { useTenantStore } from '../stores/tenantStore';
import { useConfigStore } from '../stores/configStore';

const pedidoStore = usePedidoStore();
const suministrosStore = useSuministrosStore();
const tenantStore = useTenantStore();
const configStore = useConfigStore();
const empresaSeleccionada = ref('TODAS'); // Default
const proveedorExport = ref('');

onMounted(() => {
  pedidoStore.fetchPedidos();
  if(suministrosStore.proveedores.length === 0) suministrosStore.fetchProveedores();
  if(tenantStore.empresas.length === 0) tenantStore.fetchEmpresas();
  if(tenantStore.sucursales.length === 0) tenantStore.fetchSucursales();
  if(tenantStore.grupos.length === 0) tenantStore.fetchGrupos();
});

// Initialize cantidad_aprobada
import { watch } from 'vue';
watch(() => pedidoStore.pedidos, (pedidos) => {
  pedidos.forEach(p => {
    if (p.estado === 'PENDIENTE') {
      p.items.forEach(item => {
        if (item.cantidad_aprobada === undefined) {
          item.cantidad_aprobada = item.cantidad_solicitada;
        }
      });
    }
  });
}, { immediate: true, deep: true });

const pedidosPendientes = computed(() => {
  let filtrados = pedidoStore.pedidos.filter(p => p.estado === 'PENDIENTE');
  if (empresaSeleccionada.value !== 'TODAS') {
    filtrados = filtrados.filter(p => (p.id_empresa || '').toLowerCase() === empresaSeleccionada.value.toLowerCase());
  }
  return filtrados;
});

const aprobarPedido = async (id) => {
  const result = await Swal.fire({
    title: '¿Aprobar Pedido?',
    text: '¿Confirmas que este pedido es correcto y lo apuebas para el proveedor?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, aprobar',
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'liquid-crystal-modal' }
  });

  if(result.isConfirmed) {
    try {
      const pedido = pedidoStore.pedidos.find(p => p.id === id);
      const provId = pedido.id_proveedor || pedido.proveedor_id;
      const proveedor = suministrosStore.proveedores.find(p => p.id === provId);
      const diasEntrega = proveedor?.dias_credito || 2;
      const fechaCompromiso = new Date();
      fechaCompromiso.setDate(fechaCompromiso.getDate() + diasEntrega);

      await pedidoStore.modificarPedido(id, {
        estado: 'TOMADO_POR_PROVEEDOR',
        fecha_compromiso: fechaCompromiso.toISOString()
      }, 'Logistica');
      Swal.fire('¡Aprobado!', 'Pedido aprobado exitosamente.', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  }
};

const guardarCambiosYaprobar = async (pedido) => {
  const result = await Swal.fire({
    title: '¿Aprobar con estos cambios?',
    text: 'Se guardarán las cantidades modificadas y el pedido pasará a proveedor.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, aprobar',
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'liquid-crystal-modal' }
  });

  if(result.isConfirmed) {
    try {
      let huboCambios = false;
      const itemsFinales = pedido.items.map(item => {
        if (parseInt(item.cantidad_aprobada) !== parseInt(item.cantidad_solicitada)) {
          huboCambios = true;
        }
        return { ...item, cantidad_solicitada: parseInt(item.cantidad_aprobada) || 0 };
      });

      if (huboCambios) {
        generarConstanciaModificacion(pedido, itemsFinales);
      }

      const provId = pedido.id_proveedor || pedido.proveedor_id;
      const proveedor = suministrosStore.proveedores.find(p => p.id === provId);
      const diasEntrega = proveedor?.dias_credito || 2;
      const fechaCompromiso = new Date();
      fechaCompromiso.setDate(fechaCompromiso.getDate() + diasEntrega);

      const payload = {
        estado: 'TOMADO_POR_PROVEEDOR',
        items: itemsFinales,
        fecha_compromiso: fechaCompromiso.toISOString()
      };

      if (huboCambios) {
        payload.is_rectified = true;
        payload.audit_original_items = pedido.items;
      }

      await pedidoStore.modificarPedido(pedido.id, payload, 'Logistica');
      
      Swal.fire('¡Aprobado!', 'Pedido actualizado y aprobado.', 'success');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  }
};
const calcularEriPedido = (pedido) => {
  let totalTeorico = 0;
  let totalError = 0;
  (pedido.items || []).forEach(item => {
    const teorico = parseInt(item.stock_teorico) || 0;
    const fisico = parseInt(item.cantidad_fisica_reportada) || 0;
    if (teorico > 0) {
      totalTeorico += teorico;
      totalError += Math.abs(teorico - fisico);
    }
  });
  return totalTeorico === 0 ? 100 : Math.max(0, Math.round((1 - (totalError / totalTeorico)) * 100));
};

const alertasPedido = (pedido) => {
  const alertas = [];
  const eri = calcularEriPedido(pedido);
  if (eri < 97) alertas.push({ tipo: 'ERI CRÍTICO', mensaje: `La Exactitud de Inventario (ERI) del pedido es ${eri}%. Revisar diferencias físicas vs teóricas.`, color: 'red' });
  if (pedido.is_emergency) alertas.push({ tipo: 'EMERGENCIA', mensaje: 'Pedido fuera del ciclo normal (Tasa de Emergencia).', color: 'blue' });
  if (pedido.is_rectified) alertas.push({ tipo: 'RECTIFICADO', mensaje: 'El pedido fue rectificado modificando la sugerencia original.', color: 'amber' });
  return alertas;
};

const rechazarPedido = async (id) => {
  const { value: motivo } = await Swal.fire({
    title: 'Rechazar / Devolver Pedido',
    input: 'text',
    inputLabel: 'Motivo del rechazo',
    inputPlaceholder: 'Ej. Exceso de inventario, error de captura...',
    showCancelButton: true,
    confirmButtonText: 'Rechazar Pedido',
    confirmButtonColor: '#d33',
    cancelButtonText: 'Cancelar',
    inputValidator: (value) => {
      if (!value) return '¡Debes ingresar un motivo para rechazarlo!'
    },
    customClass: { popup: 'liquid-crystal-modal' }
  });

  if (motivo) {
    try {
      await pedidoStore.modificarPedido(id, { 
        estado: 'RECHAZADO',
        motivo_rechazo: motivo
      }, 'Logistica');
      Swal.fire('Rechazado', 'El pedido ha sido devuelto a la tienda.', 'info');
    } catch (error) {
      Swal.fire('Error', error.message, 'error');
    }
  }
};

const exportarConstancia = () => {
  if (!proveedorExport.value) return Swal.fire({ title: 'Error', text: 'Selecciona un proveedor', icon: 'error', customClass: { popup: 'liquid-crystal-modal' } });
  const prov = suministrosStore.proveedores.find(p => p.id === proveedorExport.value);
  
  const pedidos = pedidosPendientes.value;
  const porSucursal = {};
  const resumenGlobal = {};
  
  pedidos.forEach(pedido => {
    pedido.items.forEach(item => {
      // Usar cantidad aprobada o solicitada
      const qty = parseInt(item.cantidad_aprobada !== undefined ? item.cantidad_aprobada : item.cantidad_solicitada) || 0;
      if ((item.id_proveedor || '').toLowerCase() === prov.id.toLowerCase() && qty > 0) {
        const sucursalNombre = tenantStore.sucursales.find(s => s.id.toLowerCase() === (pedido.id_sucursal || pedido.tienda_id || '').toLowerCase())?.nombre || pedido.id_sucursal || 'Tienda';
        
        if (!porSucursal[sucursalNombre]) {
          porSucursal[sucursalNombre] = {};
        }
        
        if (!porSucursal[sucursalNombre][item.sku]) {
          porSucursal[sucursalNombre][item.sku] = {
            ...item,
            cantidad_final: 0,
            presentacion: item.presentacion || 'Unidad'
          };
        }
        porSucursal[sucursalNombre][item.sku].cantidad_final += qty;

        if (!resumenGlobal[item.sku]) {
          resumenGlobal[item.sku] = { sku: item.sku, nombre: item.nombre, presentacion: item.presentacion || 'Unidad', total: 0 };
        }
        resumenGlobal[item.sku].total += qty;
      }
    });
  });

  if (Object.keys(porSucursal).length === 0) {
    return Swal.fire({ title: 'Sin datos', text: 'No hay requisiciones pendientes para este proveedor.', icon: 'info', customClass: { popup: 'liquid-crystal-modal' } });
  }

  const doc = new jsPDF();
  doc.setFontSize(22);
  doc.setTextColor(41, 128, 185);
  doc.text('Orden de Compra Oficial', 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Proveedor: ${prov.nombre}`, 14, 30);
  doc.text(`Fecha de Emisión: ${new Date().toLocaleString()}`, 120, 30);
  
  const empresaTexto = empresaSeleccionada.value === 'TODAS' 
    ? 'Consolidado Global (Todas las Empresas)' 
    : (tenantStore.empresas.find(e => e.id === empresaSeleccionada.value)?.nombre || empresaSeleccionada.value);
  doc.text(`Empresa: ${empresaTexto}`, 14, 38);
  doc.text(`Nodo de Entrega: ${prov.nodo_entrega || 'N/A'}`, 120, 38);

  let currentY = 50;

  // 1. Bloques por Sucursal
  for (const [sucursal, items] of Object.entries(porSucursal)) {
    if (currentY > 260) { doc.addPage(); currentY = 20; }

    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.text(`Destino: ${sucursal}`, 14, currentY);
    currentY += 5;

    const tableData = Object.values(items).map(item => [
      item.nombre,
      item.presentacion,
      item.cantidad_final.toString(),
      '-' // Espacio para Total/Costo
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Producto', 'Presentación', 'Cantidad', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185], textColor: [255,255,255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 248, 255] },
      styles: { cellPadding: 3, fontSize: 10 },
      margin: { left: 14 }
    });

    currentY = doc.lastAutoTable.finalY + 12;
  }

  doc.save(`OrdenCompra_${prov.nombre.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`);
  Swal.fire({ title: '¡Exportado!', text: 'Constancia maestra generada con éxito.', icon: 'success', customClass: { popup: 'liquid-crystal-modal' } });
};

const generarConstanciaModificacion = (pedidoOriginal, itemsModificados) => {
  const doc = new jsPDF();
  doc.setFontSize(22);
  doc.setTextColor(231, 76, 60); // Rojo para constancia de cambio
  doc.text('Constancia de Modificación', 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`ID Pedido: ${pedidoOriginal.id}`, 14, 30);
  doc.text(`Aprobador: Logística General`, 120, 30);
  doc.text(`Fecha de Modificación: ${new Date().toLocaleString()}`, 14, 38);

  const tableData = itemsModificados.map(itemNuevo => {
    const itemOriginal = pedidoOriginal.items.find(i => i.sku === itemNuevo.sku);
    return [
      itemNuevo.sku,
      itemNuevo.nombre,
      itemOriginal ? itemOriginal.cantidad_solicitada.toString() : '0',
      itemNuevo.cantidad_solicitada.toString(),
      (parseInt(itemNuevo.cantidad_solicitada) - parseInt(itemOriginal.cantidad_solicitada)).toString()
    ];
  });

  autoTable(doc, {
    startY: 55,
    head: [['SKU', 'Descripción', 'Cant. Original', 'Cant. Aprobada', 'Diferencia']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [231, 76, 60] },
    alternateRowStyles: { fillColor: [253, 237, 236] }
  });

  doc.save(`ConstanciaModificacion_${pedidoOriginal.id}.pdf`);
};

const descargarVoucher = (pedido) => {
  const nombreEmpresa = tenantStore.empresas.find(e => e.id === pedido.id_empresa)?.nombre || pedido.id_empresa || 'Empresa Desconocida';
  const nombreSucursal = tenantStore.sucursales.find(s => s.id === (pedido.id_sucursal || pedido.tienda_id))?.nombre || pedido.id_sucursal || pedido.tienda_id || 'N/A';
  const nombreGrupo = tenantStore.grupos.find(g => g.id === pedido.id_grupo)?.nombre || pedido.id_grupo || 'N/A';
  
  // Inicializar PDF
  const doc = new jsPDF();
  
  // Encabezado
  doc.setFontSize(22);
  doc.setTextColor(41, 128, 185); // Azul
  doc.text('Voucher de Pedido Aprobado', 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`ID Pedido: ${pedido.id}`, 14, 30);
  doc.text(`Fecha: ${new Date(pedido.fecha).toLocaleString()}`, 120, 30);
  
  // Datos del Tenant
  doc.setFontSize(14);
  doc.setTextColor(44, 62, 80);
  doc.text('Datos de Facturación', 14, 46);
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`Razón Social: ${nombreEmpresa}`, 14, 54);
  doc.text(`Grupo: ${nombreGrupo}`, 120, 54);
  doc.text(`Destino: ${nombreSucursal}`, 14, 62);

  // Tabla de Artículos
  const tableData = pedido.items.map(item => [
    item.nombre || item.sku,
    item.presentacion || 'Unidad',
    (item.cantidad_aprobada !== undefined ? item.cantidad_aprobada : item.cantidad_solicitada).toString(),
    item.subtotal ? `Q${parseFloat(item.subtotal).toFixed(2)}` : '-'
  ]);

  autoTable(doc, {
    startY: 85,
    head: [['Producto', 'Presentación', 'Cantidad', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [41, 128, 185] },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  // Pie de página
  const finalY = doc.lastAutoTable.finalY || 85;
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text(`Documento generado automáticamente por ${configStore.config.systemName || 'Administración'}.`, 14, finalY + 20);

  // Guardar PDF
  doc.save(`Voucher_${pedido.id_empresa}_${pedido.id}.pdf`);

  Swal.fire({
    title: '¡Voucher Generado!',
    text: `El PDF se ha descargado a nombre de: ${nombreEmpresa}`,
    icon: 'success',
    timer: 2500,
    showConfirmButton: false,
    customClass: { popup: 'liquid-crystal-modal' }
  });
};
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
      <div>
        <h2 class="text-3xl font-bold text-slate-800">Gestión de Logística</h2>
        <p class="text-slate-500 mt-2">Revisa los pedidos PENDIENTES filtrados por Razón Social.</p>
      </div>
      
      <div class="flex gap-4 items-end">
        <!-- Exportar por Proveedor -->
        <div class="bg-indigo-50 p-2 rounded-xl shadow-sm border border-indigo-100 flex items-end gap-2">
          <div>
            <label class="block text-xs font-bold text-indigo-700 uppercase tracking-wide px-2 mb-1">Exportar Constancia:</label>
            <select v-model="proveedorExport" class="w-full md:w-48 bg-white border border-indigo-200 text-slate-700 rounded-lg px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium cursor-pointer text-sm">
              <option value="" disabled>Seleccione Proveedor</option>
              <option v-for="prov in suministrosStore.proveedores" :key="prov.id" :value="prov.id">
                {{ prov.nombre }}
              </option>
            </select>
          </div>
          <button @click="exportarConstancia" class="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-md transition-colors" title="Exportar Orden de Compra">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
        </div>

        <!-- Selector de Tenant (Empresa) -->
        <div class="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wide px-2 mb-1">Filtrar por Empresa:</label>
          <select v-model="empresaSeleccionada" class="w-full md:w-48 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer text-sm">
            <option value="TODAS">Todas las Empresas</option>
            <option v-for="emp in tenantStore.empresas" :key="emp.id" :value="emp.id">
              {{ emp.nombre }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div class="bg-blue-600 px-6 py-4 flex justify-between items-center">
        <h3 class="font-bold text-white text-lg">Pedidos Pendientes de Aprobación</h3>
        <span class="bg-white text-blue-800 px-3 py-1 rounded-full text-sm font-bold shadow-inner">
          {{ pedidosPendientes.length }}
        </span>
      </div>
      
      <div class="p-6">
        <div v-if="pedidoStore.loading && pedidosPendientes.length === 0" class="flex justify-center py-10">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
        
        <div v-else-if="pedidosPendientes.length === 0" class="text-center py-12">
          <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
          </div>
          <h4 class="text-lg font-bold text-slate-700">Todo al día</h4>
          <p class="text-slate-500 mt-1">No hay pedidos pendientes para la empresa seleccionada.</p>
        </div>

        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div v-for="pedido in pedidosPendientes" :key="pedido.id" class="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow relative">
            <div class="flex justify-between items-start mb-4 border-b border-slate-200 pb-3">
              <div>
                <h3 class="font-bold text-slate-800 mb-2">Pedido <span class="font-mono text-slate-500">#{{ pedido.id }}</span></h3>
                <span class="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md uppercase tracking-wider mb-1 inline-block">Prov: {{ suministrosStore.proveedores.find(p => p.id === (pedido.id_proveedor || pedido.proveedor_id))?.nombre || pedido.proveedor_nombre || pedido.id_proveedor || 'N/A' }}</span>
                <span class="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-1 rounded-md uppercase tracking-wider mb-1 inline-block ml-1">RS: {{ tenantStore.empresas.find(e => e.id.toLowerCase() === (pedido.id_empresa || '').toLowerCase())?.nombre || pedido.id_empresa || 'N/A' }}</span>
                <br>
                <span class="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-md uppercase tracking-wider inline-block mt-1">Sucursal: {{ tenantStore.sucursales.find(s => s.id.toLowerCase() === (pedido.id_sucursal || pedido.tienda_id || '').toLowerCase())?.nombre || pedido.id_sucursal || pedido.tienda_id }}</span>
                <p class="text-xs text-slate-400 mt-2">{{ new Date(pedido.fecha).toLocaleString() }}</p>
              </div>
              <span class="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200 shadow-sm">
                PENDIENTE
              </span>
            </div>

            <!-- Alertas del Pedido -->
            <div v-if="alertasPedido(pedido).length > 0" class="mb-4 space-y-2">
              <div v-for="alerta in alertasPedido(pedido)" :key="alerta.tipo" class="p-3 text-xs rounded-lg border font-medium flex items-start gap-2"
                   :class="{
                     'bg-red-50 border-red-200 text-red-800': alerta.color === 'red',
                     'bg-blue-50 border-blue-200 text-blue-800': alerta.color === 'blue',
                     'bg-amber-50 border-amber-200 text-amber-800': alerta.color === 'amber'
                   }">
                <span v-if="alerta.color === 'red'">⚠️</span>
                <span v-if="alerta.color === 'blue'">ℹ️</span>
                <span v-if="alerta.color === 'amber'">🔄</span>
                <span><strong>{{ alerta.tipo }}:</strong> {{ alerta.mensaje }}</span>
              </div>
            </div>
            
            <div class="mb-4">
              <h4 class="text-sm font-bold text-slate-700 mb-2">Artículos Solicitados:</h4>
              <ul class="space-y-2">
                <li v-for="item in pedido.items" :key="item.sku" class="flex flex-col text-sm bg-white p-3 rounded border border-slate-100 shadow-sm gap-2">
                  <div class="flex justify-between items-start">
                    <span class="font-medium text-slate-700">{{ item.nombre }} <span class="text-xs text-slate-400">({{ item.presentacion || 'Unidad' }})</span></span>
                    <span class="text-xs font-semibold px-2 py-1 rounded" :class="parseInt(item.cantidad_fisica_reportada) < parseInt(item.stock_teorico || 0) ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'">
                      Físico: {{ item.cantidad_fisica_reportada }} / Teórico: {{ item.stock_teorico || 0 }}
                    </span>
                  </div>
                  <div class="flex justify-between items-center mt-1 pt-2 border-t border-slate-50">
                    <span class="text-xs font-bold text-slate-600" :class="item.cantidad_aprobada != item.cantidad_solicitada ? 'text-orange-600' : ''">Aprobar (Solicitó: {{item.cantidad_solicitada}}):</span>
                    <input 
                      type="number" 
                      min="0"
                      v-model="item.cantidad_aprobada"
                      class="w-20 px-2 py-1 border border-slate-300 rounded text-center font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none"
                      :class="item.cantidad_aprobada != item.cantidad_solicitada ? 'bg-orange-50 border-orange-300 text-orange-700' : ''"
                    />
                  </div>
                </li>
              </ul>
            </div>

            <div class="flex gap-2 mt-4 pt-4 border-t border-slate-200 flex-wrap">
              <button @click="descargarVoucher(pedido)" class="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 hover:text-blue-600 transition-colors" title="Descargar Voucher PDF">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>
              <button @click="rechazarPedido(pedido.id)" class="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-semibold rounded-lg text-sm shadow-sm transition-colors" title="Rechazar o Devolver Pedido">
                Rechazar
              </button>
              <button @click="guardarCambiosYaprobar(pedido)" class="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 font-semibold text-sm shadow-md transition-all">
                Guardar y Aprobar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
