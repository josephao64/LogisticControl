<script setup>
import { onMounted, ref } from 'vue';
import { useTenantStore } from '../stores/tenantStore';
import Swal from 'sweetalert2';

const tenantStore = useTenantStore();
const activeTab = ref('grupos');

onMounted(() => {
  tenantStore.fetchGrupos();
  tenantStore.fetchEmpresas();
  tenantStore.fetchSucursales();
});

const formGrupo = ref({ nombre: '' });
const formEmpresa = ref({ nombre: '', id_grupo: '' });
const formSucursal = ref({ nombre: '', id_empresa: '', id_grupo: '' });

const saveGrupo = async () => {
  if(!formGrupo.value.nombre) return;
  try {
    await tenantStore.addGrupo({ nombre: formGrupo.value.nombre });
    formGrupo.value.nombre = '';
    Swal.fire('Guardado', 'Grupo corporativo guardado', 'success');
  } catch(e) { Swal.fire('Error', e.message, 'error'); }
};

const saveEmpresa = async () => {
  if(!formEmpresa.value.nombre || !formEmpresa.value.id_grupo) return;
  try {
    await tenantStore.addEmpresa({ ...formEmpresa.value });
    formEmpresa.value.nombre = '';
    Swal.fire('Guardado', 'Razón Social guardada', 'success');
  } catch(e) { Swal.fire('Error', e.message, 'error'); }
};

const saveSucursal = async () => {
  if(!formSucursal.value.nombre || !formSucursal.value.id_empresa) return;
  // Auto asginar el id_grupo en base a la empresa seleccionada para mantener la cascada pura
  const empresaParent = tenantStore.empresas.find(e => e.id === formSucursal.value.id_empresa);
  if(empresaParent) {
    formSucursal.value.id_grupo = empresaParent.id_grupo;
  }

  try {
    await tenantStore.addSucursal({ ...formSucursal.value });
    formSucursal.value.nombre = '';
    Swal.fire('Guardado', 'Sucursal guardada', 'success');
  } catch(e) { Swal.fire('Error', e.message, 'error'); }
};

// --- Acciones de Edición y Eliminación ---
const editGrupo = async (grupo) => {
  const { value: nombre } = await Swal.fire({ title: 'Editar Grupo', input: 'text', inputValue: grupo.nombre, showCancelButton: true });
  if (nombre && nombre !== grupo.nombre) {
    try { await tenantStore.updateGrupo(grupo.id, { nombre }); Swal.fire('Actualizado', '', 'success'); }
    catch(e) { Swal.fire('Error', e.message, 'error'); }
  }
};
const removeGrupo = async (id) => {
  if((await Swal.fire({ title: '¿Eliminar?', text: 'No se puede deshacer', icon: 'warning', showCancelButton: true })).isConfirmed) {
    try { await tenantStore.deleteGrupo(id); Swal.fire('Eliminado', '', 'success'); }
    catch(e) { Swal.fire('Error', e.message, 'error'); }
  }
};

const editEmpresa = async (empresa) => {
  const { value: nombre } = await Swal.fire({ title: 'Editar Razón Social', input: 'text', inputValue: empresa.nombre, showCancelButton: true });
  if (nombre && nombre !== empresa.nombre) {
    try { await tenantStore.updateEmpresa(empresa.id, { nombre }); Swal.fire('Actualizado', '', 'success'); }
    catch(e) { Swal.fire('Error', e.message, 'error'); }
  }
};
const removeEmpresa = async (id) => {
  if((await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true })).isConfirmed) {
    try { await tenantStore.deleteEmpresa(id); Swal.fire('Eliminado', '', 'success'); }
    catch(e) { Swal.fire('Error', e.message, 'error'); }
  }
};

const editSucursal = async (sucursal) => {
  const { value: nombre } = await Swal.fire({ title: 'Editar Sucursal', input: 'text', inputValue: sucursal.nombre, showCancelButton: true });
  if (nombre && nombre !== sucursal.nombre) {
    try { await tenantStore.updateSucursal(sucursal.id, { nombre }); Swal.fire('Actualizado', '', 'success'); }
    catch(e) { Swal.fire('Error', e.message, 'error'); }
  }
};
const removeSucursal = async (id) => {
  if((await Swal.fire({ title: '¿Eliminar?', icon: 'warning', showCancelButton: true })).isConfirmed) {
    try { await tenantStore.deleteSucursal(id); Swal.fire('Eliminado', '', 'success'); }
    catch(e) { Swal.fire('Error', e.message, 'error'); }
  }
};

</script>

<template>
  <div class="max-w-6xl mx-auto">
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-slate-800">Estructura Corporativa (Multi-Tenant)</h2>
      <p class="text-slate-500 mt-2">Gestiona la cascada corporativa para aislar la información del sistema por franquicias o divisiones.</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-4 mb-6 border-b border-slate-200">
      <button @click="activeTab = 'grupos'" class="pb-3 px-2 font-bold transition-colors" :class="activeTab === 'grupos' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-700'">Grupos Corporativos</button>
      <button @click="activeTab = 'empresas'" class="pb-3 px-2 font-bold transition-colors" :class="activeTab === 'empresas' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-700'">Empresas (Razones Sociales)</button>
      <button @click="activeTab = 'sucursales'" class="pb-3 px-2 font-bold transition-colors" :class="activeTab === 'sucursales' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-700'">Sucursales</button>
    </div>

    <div v-if="tenantStore.loading" class="text-center py-8">Cargando datos...</div>
    
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      <!-- Panel Izquierdo: Formulario Dinámico -->
      <div class="md:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
        
        <div v-if="activeTab === 'grupos'">
          <h3 class="font-bold text-slate-700 mb-4 text-lg">Nuevo Grupo Corporativo</h3>
          <input v-model="formGrupo.nombre" placeholder="Ej. Grupo Corporativo Principal" class="w-full mb-4 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          <button @click="saveGrupo" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-colors">Guardar Grupo</button>
        </div>

        <div v-if="activeTab === 'empresas'">
          <h3 class="font-bold text-slate-700 mb-4 text-lg">Nueva Razón Social</h3>
          <label class="block text-xs font-semibold text-slate-500 mb-1">Pertenece al Grupo:</label>
          <select v-model="formEmpresa.id_grupo" class="w-full mb-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
            <option disabled value="">Selecciona un Grupo...</option>
            <option v-for="g in tenantStore.grupos" :key="g.id" :value="g.id">{{ g.nombre }}</option>
          </select>
          <label class="block text-xs font-semibold text-slate-500 mb-1">Nombre de Empresa:</label>
          <input v-model="formEmpresa.nombre" placeholder="Ej. Distribuidora Central S.A." class="w-full mb-4 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          <button @click="saveEmpresa" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-colors">Guardar Empresa</button>
        </div>

        <div v-if="activeTab === 'sucursales'">
          <h3 class="font-bold text-slate-700 mb-4 text-lg">Nueva Sucursal</h3>
          <label class="block text-xs font-semibold text-slate-500 mb-1">Pertenece a la Empresa:</label>
          <select v-model="formSucursal.id_empresa" class="w-full mb-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
            <option disabled value="">Selecciona una Empresa...</option>
            <option v-for="e in tenantStore.empresas" :key="e.id" :value="e.id">{{ e.nombre }}</option>
          </select>
          <label class="block text-xs font-semibold text-slate-500 mb-1">Nombre de Sucursal:</label>
          <input v-model="formSucursal.nombre" placeholder="Ej. Sucursal Zona 10" class="w-full mb-4 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          <button @click="saveSucursal" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg transition-colors">Guardar Sucursal</button>
        </div>

      </div>

      <!-- Panel Derecho: Tabla de Registros -->
      <div class="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        <table v-if="activeTab === 'grupos'" class="w-full text-left">
          <thead class="bg-slate-50 text-slate-500 text-sm uppercase">
            <tr>
              <th class="p-4">ID</th>
              <th class="p-4">Nombre del Grupo</th>
              <th class="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="g in tenantStore.grupos" :key="g.id" class="hover:bg-slate-50">
              <td class="p-4 font-mono text-xs text-slate-400">{{ g.id }}</td><td class="p-4 font-bold text-slate-700">{{ g.nombre }}</td>
              <td class="p-4 text-right space-x-2">
                <button @click="editGrupo(g)" class="text-blue-500 hover:text-blue-700 font-semibold text-sm">Editar</button>
                <button @click="removeGrupo(g.id)" class="text-red-500 hover:text-red-700 font-semibold text-sm">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>

        <table v-if="activeTab === 'empresas'" class="w-full text-left">
          <thead class="bg-slate-50 text-slate-500 text-sm uppercase">
            <tr>
              <th class="p-4">ID</th>
              <th class="p-4">Razón Social</th>
              <th class="p-4">Grupo Padre</th>
              <th class="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="e in tenantStore.empresas" :key="e.id" class="hover:bg-slate-50">
              <td class="p-4 font-mono text-xs text-slate-400">{{ e.id }}</td>
              <td class="p-4 font-bold text-slate-700">{{ e.nombre }}</td>
              <td class="p-4 text-sm text-indigo-600">{{ tenantStore.grupos.find(g => g.id === e.id_grupo)?.nombre || e.id_grupo }}</td>
              <td class="p-4 text-right space-x-2">
                <button @click="editEmpresa(e)" class="text-blue-500 hover:text-blue-700 font-semibold text-sm">Editar</button>
                <button @click="removeEmpresa(e.id)" class="text-red-500 hover:text-red-700 font-semibold text-sm">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>

        <table v-if="activeTab === 'sucursales'" class="w-full text-left">
          <thead class="bg-slate-50 text-slate-500 text-sm uppercase">
            <tr>
              <th class="p-4">ID</th>
              <th class="p-4">Sucursal</th>
              <th class="p-4">Empresa (Tenant)</th>
              <th class="p-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="s in tenantStore.sucursales" :key="s.id" class="hover:bg-slate-50">
              <td class="p-4 font-mono text-xs text-slate-400">{{ s.id }}</td>
              <td class="p-4 font-bold text-slate-700">{{ s.nombre }}</td>
              <td class="p-4 text-sm text-blue-600">{{ tenantStore.empresas.find(e => e.id === s.id_empresa)?.nombre || s.id_empresa }}</td>
              <td class="p-4 text-right space-x-2">
                <button @click="editSucursal(s)" class="text-blue-500 hover:text-blue-700 font-semibold text-sm">Editar</button>
                <button @click="removeSucursal(s.id)" class="text-red-500 hover:text-red-700 font-semibold text-sm">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>

      </div>
    </div>
  </div>
</template>
