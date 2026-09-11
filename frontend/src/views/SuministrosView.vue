<script setup>
import { onMounted, ref } from 'vue';
import { useSuministrosStore } from '../stores/suministrosStore';
import { useTenantStore } from '../stores/tenantStore';
import Swal from 'sweetalert2';

const suministrosStore = useSuministrosStore();
const tenantStore = useTenantStore();
const activeTab = ref('proveedores');

onMounted(() => {
  suministrosStore.fetchProveedores();
  suministrosStore.fetchInsumos();
  if (tenantStore.sucursales.length === 0) tenantStore.fetchSucursales();
});

const provForm = ref({ nombre: '', dias_credito: 15, nodo_entrega: 'BODEGA' });
const isSubmittingProv = ref(false);
const addProv = async () => {
  if(!provForm.value.nombre || isSubmittingProv.value) return;
  isSubmittingProv.value = true;
  try {
    await suministrosStore.addProveedor({ ...provForm.value });
    provForm.value.nombre = '';
  } catch (error) {
    Swal.fire('Error', error.message || 'Error al guardar proveedor', 'error');
  } finally {
    isSubmittingProv.value = false;
  }
};

const insForm = ref({ nombre: '', presentacion: '', unidad_compra: '', precio_compra: 0, sku: '', id_proveedor: '', promedio_uso_semanal: 10, stock_minimo: 5 });
const isSubmittingIns = ref(false);
const addIns = async () => {
  if(!insForm.value.nombre || !insForm.value.id_proveedor || isSubmittingIns.value) return;
  isSubmittingIns.value = true;
  try {
    await suministrosStore.addInsumo({ ...insForm.value });
    insForm.value.nombre = '';
    insForm.value.presentacion = '';
    insForm.value.unidad_compra = '';
    insForm.value.precio_compra = 0;
    insForm.value.sku = '';
  } catch (error) {
    Swal.fire('Error', error.message || 'Error al guardar insumo', 'error');
  } finally {
    isSubmittingIns.value = false;
  }
};

const editProv = async (prov) => {
  const { value: formValues } = await Swal.fire({
    title: 'Editar Proveedor',
    html:
      `<input id="swal-input1" class="swal2-input" placeholder="Razón Social" value="${prov.nombre}">` +
      `<select id="swal-input2" class="swal2-select w-full" style="display:flex; max-width:100%; margin: 1em auto;">` +
        `<option value="BODEGA" ${prov.nodo_entrega === 'BODEGA' ? 'selected' : ''}>Nodo: Bodega Central</option>` +
        `<option value="DIRECTO_TIENDA" ${prov.nodo_entrega === 'DIRECTO_TIENDA' ? 'selected' : ''}>Nodo: Directo a Sucursal</option>` +
      `</select>` +
      `<input id="swal-input3" class="swal2-input" type="number" placeholder="Días de crédito" value="${prov.dias_credito}">`,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Cambios',
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'liquid-crystal-modal' },
    preConfirm: () => {
      const nombre = document.getElementById('swal-input1').value;
      const nodo_entrega = document.getElementById('swal-input2').value;
      const dias_credito = document.getElementById('swal-input3').value;
      if (!nombre) {
        Swal.showValidationMessage('El nombre es obligatorio');
        return false;
      }
      return { nombre, nodo_entrega, dias_credito: Number(dias_credito) };
    }
  });

  if (formValues) {
    try {
      await suministrosStore.updateProveedor(prov.id, formValues);
      Swal.fire({ title: 'Actualizado!', text: 'Proveedor actualizado correctamente.', icon: 'success', customClass: { popup: 'liquid-crystal-modal' } });
    } catch (e) {
      Swal.fire({ title: 'Error', text: 'No se pudo actualizar el proveedor.', icon: 'error', customClass: { popup: 'liquid-crystal-modal' } });
    }
  }
};

const editIns = async (ins) => {
  const proveedoresOptions = suministrosStore.proveedores.map(p => 
    `<option value="${p.id}" ${ins.id_proveedor === p.id ? 'selected' : ''}>${p.nombre}</option>`
  ).join('');

  const { value: formValues } = await Swal.fire({
    title: 'Editar Insumo',
    html: `<div class="grid grid-cols-2 gap-4 text-left p-4">` +
        `<div><label class="block text-xs font-bold text-slate-700">SKU</label><input id="swal-ins-1" class="swal2-input !m-0 w-full" placeholder="SKU" value="${ins.sku}"></div>` +
        `<div><label class="block text-xs font-bold text-slate-700">Nombre de insumo</label><input id="swal-ins-2" class="swal2-input !m-0 w-full" placeholder="Nombre" value="${ins.nombre}"></div>` +
        `<div><label class="block text-xs font-bold text-slate-700">Presentación</label><input id="swal-ins-pres" class="swal2-input !m-0 w-full" placeholder="Caja, Galón" value="${ins.presentacion || ''}"></div>` +
        `<div><label class="block text-xs font-bold text-slate-700">Unidad de Compra</label><input id="swal-ins-ucomp" class="swal2-input !m-0 w-full" placeholder="10 kg, 5 L" value="${ins.unidad_compra || ''}"></div>` +
        `<div><label class="block text-xs font-bold text-slate-700">Precio Compra (Q)</label><input id="swal-ins-pcomp" class="swal2-input !m-0 w-full" type="number" step="0.01" placeholder="0.00" value="${ins.precio_compra || 0}"></div>` +
        `<div><label class="block text-xs font-bold text-slate-700">Proveedor</label><select id="swal-ins-3" class="swal2-select !m-0 w-full text-sm"><option disabled value="">Selecciona...</option>${proveedoresOptions}</select></div>` +
        `<div><label class="block text-xs font-bold text-slate-700">Stock Mínimo</label><input id="swal-ins-4" class="swal2-input !m-0 w-full" type="number" value="${ins.stock_minimo}"></div>` +
        `<div><label class="block text-xs font-bold text-slate-700">Uso Semanal</label><input id="swal-ins-5" class="swal2-input !m-0 w-full" type="number" value="${ins.promedio_uso_semanal}"></div>` +
      `</div>`,
    width: '600px',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Cambios',
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'liquid-crystal-modal' },
    preConfirm: () => {
      const sku = document.getElementById('swal-ins-1').value;
      const nombre = document.getElementById('swal-ins-2').value;
      const presentacion = document.getElementById('swal-ins-pres').value;
      const unidad_compra = document.getElementById('swal-ins-ucomp').value;
      const precio_compra = document.getElementById('swal-ins-pcomp').value;
      const id_proveedor = document.getElementById('swal-ins-3').value;
      const stock_minimo = document.getElementById('swal-ins-4').value;
      const promedio_uso_semanal = document.getElementById('swal-ins-5').value;
      if (!nombre || !id_proveedor) {
        Swal.showValidationMessage('El nombre y proveedor son obligatorios');
        return false;
      }
      return { 
        sku, 
        nombre, 
        presentacion, 
        unidad_compra, 
        precio_compra: Number(precio_compra), 
        id_proveedor, 
        stock_minimo: Number(stock_minimo), 
        promedio_uso_semanal: Number(promedio_uso_semanal) 
      };
    }
  });

  if (formValues) {
    try {
      await suministrosStore.updateInsumo(ins.id, formValues);
      Swal.fire({ title: 'Actualizado!', text: 'Insumo actualizado correctamente.', icon: 'success', customClass: { popup: 'liquid-crystal-modal' } });
    } catch (e) {
      Swal.fire({ title: 'Error', text: 'No se pudo actualizar el insumo.', icon: 'error', customClass: { popup: 'liquid-crystal-modal' } });
    }
  }
};

const delProv = async (id) => {
  const result = await Swal.fire({
    title: '¿Eliminar proveedor?',
    text: "Esta acción no se puede deshacer.",
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
      await suministrosStore.deleteProveedor(id);
      Swal.fire({ title: 'Eliminado!', text: 'El proveedor ha sido eliminado.', icon: 'success', customClass: { popup: 'liquid-crystal-modal' } });
    } catch (e) {
      Swal.fire({ title: 'Error', text: 'No se pudo eliminar el proveedor.', icon: 'error', customClass: { popup: 'liquid-crystal-modal' } });
    }
  }
};

const delIns = async (id) => {
  const result = await Swal.fire({
    title: '¿Eliminar insumo?',
    text: "Esta acción no se puede deshacer.",
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
      await suministrosStore.deleteInsumo(id);
      Swal.fire({ title: 'Eliminado!', text: 'El insumo ha sido eliminado.', icon: 'success', customClass: { popup: 'liquid-crystal-modal' } });
    } catch (e) {
      Swal.fire({ title: 'Error', text: 'No se pudo eliminar el insumo.', icon: 'error', customClass: { popup: 'liquid-crystal-modal' } });
    }
  }
};

const configNodos = async (prov) => {
  let htmlNodos = `<div style="text-align: left; max-height: 400px; overflow-y: auto;">`;
  htmlNodos += `<p class="mb-4 text-sm text-slate-500">Configura el nodo de entrega para cada sucursal. Si no seleccionas ninguno, se usará el modo global del proveedor (<b>${prov.nodo_entrega}</b>).</p>`;
  
  const nodos_sucursal = prov.nodos_sucursal || {};
  
  tenantStore.sucursales.forEach(suc => {
    const val = nodos_sucursal[suc.id] || '';
    htmlNodos += `
      <div class="mb-3">
        <label class="block text-xs font-bold text-slate-700 mb-1">${suc.nombre}</label>
        <select id="nodo_suc_${suc.id}" class="swal2-select" style="display:flex; width: 100%; margin: 0; padding: 0.5em; font-size: 0.875rem;">
          <option value="" ${val === '' ? 'selected' : ''}>-- Usar Global (${prov.nodo_entrega}) --</option>
          <option value="BODEGA" ${val === 'BODEGA' ? 'selected' : ''}>Bodega Central</option>
          <option value="DIRECTO_TIENDA" ${val === 'DIRECTO_TIENDA' ? 'selected' : ''}>Directo a Sucursal</option>
        </select>
      </div>
    `;
  });
  htmlNodos += `</div>`;

  const { value: formValues } = await Swal.fire({
    title: `Nodos: ${prov.nombre}`,
    html: htmlNodos,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Configuración',
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'liquid-crystal-modal' },
    preConfirm: () => {
      const newNodos = {};
      tenantStore.sucursales.forEach(suc => {
        const select = document.getElementById(`nodo_suc_${suc.id}`);
        if (select && select.value) {
          newNodos[suc.id] = select.value;
        }
      });
      return newNodos;
    }
  });

  if (formValues) {
    try {
      await suministrosStore.updateProveedor(prov.id, { nodos_sucursal: formValues });
      Swal.fire({ title: 'Actualizado!', text: 'Nodos por sucursal guardados correctamente.', icon: 'success', customClass: { popup: 'liquid-crystal-modal' } });
    } catch (e) {
      Swal.fire({ title: 'Error', text: 'No se pudo actualizar los nodos.', icon: 'error', customClass: { popup: 'liquid-crystal-modal' } });
    }
  }
};

const configPromedios = async (prod) => {
  let htmlPromedios = `<div style="text-align: left; max-height: 400px; overflow-y: auto;">`;
  htmlPromedios += `<p class="mb-4 text-sm text-slate-500">Configura el promedio de uso semanal específico para cada sucursal. Si dejas el campo vacío, se usará el promedio global (<b>${prod.promedio_uso_semanal}</b>).</p>`;
  
  const promedios_sucursal = prod.promedios_sucursal || {};
  
  tenantStore.sucursales.forEach(suc => {
    const val = promedios_sucursal[suc.id] || '';
    htmlPromedios += `
      <div class="mb-3 flex items-center justify-between">
        <label class="block text-xs font-bold text-slate-700">${suc.nombre}</label>
        <input id="prom_suc_${suc.id}" type="number" min="0" class="swal2-input" style="width: 100px; margin: 0; padding: 0.5em; text-align: center;" placeholder="${prod.promedio_uso_semanal}" value="${val}">
      </div>
    `;
  });
  htmlPromedios += `</div>`;

  const { value: formValues } = await Swal.fire({
    title: `Promedios: ${prod.nombre}`,
    html: htmlPromedios,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar Configuración',
    cancelButtonText: 'Cancelar',
    customClass: { popup: 'liquid-crystal-modal' },
    preConfirm: () => {
      const newPromedios = {};
      tenantStore.sucursales.forEach(suc => {
        const input = document.getElementById(`prom_suc_${suc.id}`);
        if (input && input.value !== '') {
          newPromedios[suc.id] = Number(input.value);
        }
      });
      return newPromedios;
    }
  });

  if (formValues) {
    try {
      await suministrosStore.updateInsumo(prod.id, { promedios_sucursal: formValues });
      Swal.fire({ title: 'Actualizado!', text: 'Promedios por sucursal guardados correctamente.', icon: 'success', customClass: { popup: 'liquid-crystal-modal' } });
    } catch (e) {
      Swal.fire({ title: 'Error', text: 'No se pudo actualizar los promedios.', icon: 'error', customClass: { popup: 'liquid-crystal-modal' } });
    }
  }
};
</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-slate-800">Gestión de Suministros</h2>
      <p class="text-slate-500 mt-2">Administra los proveedores y sus insumos asignados, y configura los nodos de entrega.</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-4 mb-6 border-b border-slate-200">
      <button 
        @click="activeTab = 'proveedores'"
        class="pb-3 px-2 font-bold transition-colors"
        :class="activeTab === 'proveedores' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-700'"
      >
        Proveedores
      </button>
      <button 
        @click="activeTab = 'insumos'"
        class="pb-3 px-2 font-bold transition-colors"
        :class="activeTab === 'insumos' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-700'"
      >
        Insumos
      </button>
    </div>

    <div v-if="suministrosStore.loading" class="text-center py-8 flex justify-center">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      <!-- Left Panel Forms -->
      <div class="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
        <div v-if="activeTab === 'proveedores'">
          <h3 class="font-bold text-slate-700 mb-4 text-lg">Nuevo Proveedor</h3>
          <input v-model="provForm.nombre" placeholder="Razón Social" class="w-full mb-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" />
          <select v-model="provForm.nodo_entrega" class="w-full mb-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none">
            <option value="BODEGA">Nodo: Bodega Central</option>
            <option value="DIRECTO_TIENDA">Nodo: Directo a Sucursal</option>
          </select>
          <input v-model="provForm.dias_credito" type="number" placeholder="Días de crédito" class="w-full mb-4 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" />
          <button @click="addProv" :disabled="isSubmittingProv" class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition-colors">
            {{ isSubmittingProv ? 'Guardando...' : 'Guardar Proveedor' }}
          </button>
        </div>

        <div v-if="activeTab === 'insumos'">
          <h3 class="font-bold text-slate-700 mb-4 text-lg">Nuevo Insumo</h3>
          <input v-model="insForm.sku" placeholder="SKU" class="w-full mb-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" />
          <input v-model="insForm.nombre" placeholder="Nombre de insumo" class="w-full mb-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" />
          <input v-model="insForm.presentacion" placeholder="Presentación (Ej. Caja, Galón)" class="w-full mb-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" />
          <div class="flex gap-2 mb-3">
            <input v-model="insForm.unidad_compra" placeholder="Unid. Compra (Ej. 10 kg)" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" />
            <input v-model="insForm.precio_compra" type="number" step="0.01" placeholder="Precio" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm" />
          </div>
          <select v-model="insForm.id_proveedor" class="w-full mb-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none">
            <option disabled value="">Selecciona Proveedor...</option>
            <option v-for="p in suministrosStore.proveedores" :key="p.id" :value="p.id">{{ p.nombre }}</option>
          </select>
          <div class="flex gap-2 mb-4">
            <input v-model="insForm.stock_minimo" type="number" placeholder="Stock Mínimo" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" />
            <input v-model="insForm.promedio_uso_semanal" type="number" placeholder="Uso Semanal" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none" />
          </div>
          <button @click="addIns" :disabled="isSubmittingIns" class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg transition-colors">
            {{ isSubmittingIns ? 'Guardando...' : 'Guardar Insumo' }}
          </button>
        </div>
      </div>

      <!-- Right Panel Tables -->
      <div class="md:col-span-2 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        
      <!-- Tabla Proveedores -->
      <div v-if="activeTab === 'proveedores'" class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm uppercase tracking-wider">
              <th class="p-4 font-semibold">ID</th>
              <th class="p-4 font-semibold">Razón Social del Proveedor</th>
              <th class="p-4 font-semibold">Días de Crédito</th>
              <th class="p-4 font-semibold">Nodo de Entrega</th>
              <th class="p-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="prov in suministrosStore.proveedores" :key="prov.id" class="hover:bg-slate-50 transition-colors">
              <td class="p-4 text-sm font-mono text-slate-500">{{ prov.id }}</td>
              <td class="p-4 text-sm font-bold text-slate-800">{{ prov.nombre }}</td>
              <td class="p-4 text-sm text-slate-600">{{ prov.dias_credito }} días</td>
              <td class="p-4">
                <span class="px-3 py-1 rounded-full text-xs font-bold uppercase" 
                      :class="prov.nodo_entrega === 'BODEGA' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'">
                  {{ prov.nodo_entrega }}
                </span>
              </td>
              <td class="p-4 text-right">
                <button @click="configNodos(prov)" class="text-indigo-500 hover:text-indigo-700 font-bold text-sm mr-3">Config. Nodos</button>
                <button @click="editProv(prov)" class="text-blue-500 hover:text-blue-700 font-bold text-sm mr-3">Editar</button>
                <button @click="delProv(prov.id)" class="text-red-500 hover:text-red-700 font-bold text-sm">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Tabla Insumos -->
      <div v-if="activeTab === 'insumos'" class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm uppercase tracking-wider">
              <th class="p-4 font-semibold">SKU / Insumo</th>
              <th class="p-4 font-semibold">Detalles de Compra</th>
              <th class="p-4 font-semibold">Proveedor Asignado</th>
              <th class="p-4 font-semibold text-center">Stock Mín. / Uso Sem.</th>
              <th class="p-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="prod in suministrosStore.insumos" :key="prod.id" class="hover:bg-slate-50 transition-colors">
              <td class="p-4">
                <div class="font-bold text-slate-800">{{ prod.nombre }}</div>
                <div class="text-xs text-slate-400 font-mono">{{ prod.sku || 'N/A' }}</div>
              </td>
              <td class="p-4 text-sm text-slate-600">
                <div><span class="font-semibold text-slate-500">Pres:</span> {{ prod.presentacion || 'N/A' }}</div>
                <div><span class="font-semibold text-slate-500">U/C:</span> {{ prod.unidad_compra || 'N/A' }}</div>
                <div v-if="prod.precio_compra"><span class="font-semibold text-slate-500">Precio:</span> {{ Number(prod.precio_compra).toLocaleString('es-GT', {style: 'currency', currency: 'GTQ'}) }}</div>
              </td>
              <td class="p-4 text-sm text-slate-600 font-bold">
                {{ suministrosStore.proveedores.find(p => p.id === prod.id_proveedor)?.nombre || prod.id_proveedor }}
              </td>
              <td class="p-4 text-center">
                <div class="flex flex-col gap-1 items-center">
                  <span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold" title="Stock Mínimo">Min: {{ prod.stock_minimo }}</span>
                  <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold" title="Uso Semanal">Uso: {{ prod.promedio_uso_semanal }}</span>
                </div>
              </td>
              <td class="p-4 text-right flex flex-col gap-1 items-end">
                <button @click="configPromedios(prod)" class="text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-indigo-50 px-2 py-1 rounded">Config. Promedios</button>
                <div class="flex gap-2 mt-1">
                  <button @click="editIns(prod)" class="text-blue-500 hover:text-blue-700 font-bold text-xs">Editar</button>
                  <button @click="delIns(prod.id)" class="text-red-500 hover:text-red-700 font-bold text-xs">Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
  </div>
</template>
