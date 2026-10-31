<script setup>
import {ref,computed,watch} from 'vue';
import {state,catalog,command,perform,money,label,removeUser} from '../services/operations';
import Swal from 'sweetalert2';
const types=[{key:'users',name:'Usuarios',single:'usuario',icon:'users'},{key:'empresas',name:'Empresas',single:'empresa',icon:'building'},{key:'proveedores',name:'Proveedores',single:'proveedor',icon:'truck'},{key:'insumos',name:'Productos',single:'producto',icon:'box'},{key:'sucursales',name:'Sucursales',single:'sucursal',icon:'store'},{key:'grupos',name:'Grupos',single:'grupo',icon:'layers'}];
const type=ref('users'),id=ref(''),form=ref({}),message=ref(''),modal=ref(false),search=ref(''),visibility=ref('all');
const system=ref({...state.data.config?.[0]});
const meta=computed(()=>types.find(t=>t.key===type.value));
const collection=computed(()=>type.value==='insumos'?'productos':type.value);
const allRows=computed(()=>state.data[collection.value]||[]);
const rows=computed(()=>allRows.value.filter(r=>(visibility.value==='all'||(r.active!==false)===(visibility.value==='active'))&&`${r.nombre||r.name||''} ${r.email||''} ${r.sku||''} ${r.role||''}`.toLowerCase().includes(search.value.toLowerCase())));
const count=t=>(state.data[t==='insumos'?'productos':t]||[]).length;
const name=(list,id)=>state.data[list].find(r=>r.id===id)?.nombre||'Sin asignar';
function reset(){id.value='';form.value={nombre:'',name:'',email:'',password:'',active:true,allBranches:false,id_grupo:'',id_empresa:'',id_proveedor:'',nodo_entrega:'BODEGA',nodos_sucursal:{},precio_compra:0,branchIds:[],companyIds:[],role:'Tienda'};}
watch(type,()=>{reset();search.value='';modal.value=false;},{immediate:true});
watch(()=>form.value.companyIds,ids=>{if(type.value==='users'&&ids)form.value.branchIds=form.value.branchIds.filter(id=>state.data.sucursales.some(b=>b.id===id&&ids.includes(b.id_empresa)));},{deep:true});
function create(){reset();modal.value=true;state.error='';}
function edit(row){id.value=row.id;form.value=JSON.parse(JSON.stringify({...row,password:'',branchIds:row.branchIds||state.data.sucursales.filter(b=>b.active!==false).map(b=>b.id),companyIds:row.companyIds||[],nodos_sucursal:row.nodos_sucursal||{}}));modal.value=true;state.error='';}
const userLoginLabel=r=>{if(!r?.email)return '';return r.email.endsWith('@logisticcontrol.local')?`Usuario: ${r.username||r.name||r.email.split('@')[0]}`:r.email;};
const userBranchesSummary=r=>{
 if(r.role==='Administrador')return 'Acceso global de administración';
 if(r.role==='Bodega'&&r.allBranches)return 'Bodega Central · Todas las sucursales';
 const bNames=(r.branchIds||[]).map(bid=>state.data.sucursales.find(s=>s.id===bid)?.nombre).filter(Boolean);
 return bNames.length?`Sucursal: ${bNames.join(', ')}`:`${r.companyIds?.length||0} empresas · ${r.branchIds?.length||0} sucursales`;
};
async function save(){await perform(async()=>{if(type.value==='users')await command(id.value?`users/${id.value}`:'users',form.value);else await catalog(type.value,id.value,form.value);modal.value=false;reset();message.value='Registro guardado. Los cambios quedaron en el historial.';});}
const saveSystem=()=>perform(async()=>{await command('system-config',system.value);message.value='Identidad del sistema actualizada.';});
async function removeRow(row){
 const nombre=row.nombre||row.name||row.email||row.id;
 const r=await Swal.fire({icon:'warning',title:`¿Eliminar ${meta.value.single}?`,html:`Se eliminará <b>${nombre}</b> de forma permanente.`,showCancelButton:true,confirmButtonText:'Sí, eliminar',cancelButtonText:'Cancelar',confirmButtonColor:'#bc4050'});
 if(!r.isConfirmed)return;
 await perform(async()=>{if(type.value==='users')await removeUser(row.id);else await catalog(type.value,row.id,null,true);message.value=`${meta.value.single[0].toUpperCase()+meta.value.single.slice(1)} eliminado correctamente.`;});
 if(state.error)Swal.fire({icon:'error',title:'No se pudo eliminar',text:state.error});
}
</script>
<template><div class="stack">
<PageHeader title="Administración" description="Organice su operación y controle quién puede acceder." eyebrow="CONTROL DEL SISTEMA" icon="shield"><button class="primary" @click="create"><AppIcon name="plus"/>Agregar {{ meta.single }}</button></PageHeader>
<p v-if="message" class="success" role="status"><AppIcon name="checkCircle"/>{{ message }}</p>
<div class="catalog-type-grid"><button v-for="t in types" :key="t.key" class="catalog-type" :class="{active:type===t.key}" :aria-pressed="type===t.key" @click="type=t.key"><AppIcon :name="t.icon"/><span>{{ t.name }}</span><strong class="type-count">{{ count(t.key) }}</strong></button></div>
<div class="toolbar panel"><label class="filter-search">Buscar en {{ meta.name.toLowerCase() }}<div class="field-with-icon"><AppIcon name="search"/><input type="search" v-model="search" placeholder="Nombre, correo o código"/></div></label><label>Disponibilidad<select v-model="visibility"><option value="all">Todos los registros</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></label><span class="filter-summary">{{ rows.length }} registros</span></div>
<EmptyState v-if="!rows.length" :title="`No hay ${meta.name.toLowerCase()} para mostrar`" description="Agregue un registro o cambie los filtros." :icon="meta.icon"><button class="primary" @click="create"><AppIcon name="plus"/>Agregar {{ meta.single }}</button></EmptyState>
<div class="catalog-grid"><article v-for="r in rows" :key="r.id" class="catalog-card stack-sm" :class="{inactive:r.active===false}"><div class="row between"><span class="icon-tile"><AppIcon :name="meta.icon"/></span><span class="badge" :class="r.active===false?'amber':'green'">{{ r.active===false?'Inactivo':'Activo' }}</span></div><div><h2>{{ r.nombre||r.name||r.id }}</h2><p v-if="r.email" class="muted break-text">{{ type==='users'?userLoginLabel(r):r.email }}</p><p v-if="r.sku" class="muted">{{ r.sku }}</p></div>
<template v-if="type==='users'"><span class="badge blue">{{ label(r.role) }}</span><p class="muted">{{ userBranchesSummary(r) }}</p></template>
<template v-if="type==='insumos'"><p>{{ name('proveedores',r.id_proveedor) }}</p><p class="muted">{{ r.unidad_compra||r.presentacion }} · {{ r.branchIds?.length ?? state.data.sucursales.length }} sucursales</p><strong>{{ money(r.precio_compra) }}</strong></template>
<template v-if="type==='empresas'"><p>{{ name('grupos',r.id_grupo) }}</p><p class="muted">NIT: {{ r.nit||'Sin registrar' }}</p></template>
<template v-if="type==='sucursales'"><p>{{ name('empresas',r.id_empresa) }}</p><p class="muted">{{ r.direccion||'Sin dirección registrada' }}</p></template>
<template v-if="type==='proveedores'"><p class="row"><AppIcon :name="r.nodo_entrega==='BODEGA'?'warehouse':'store'" :size="18"/>{{ r.nodo_entrega==='BODEGA'?'Entrega en bodega':'Directo a tienda' }}</p><p class="muted">{{ r.branchIds ? `${r.branchIds.length} sucursales habilitadas` : 'Todas las sucursales' }} · {{ Object.keys(r.nodos_sucursal||{}).length }} destinos personalizados</p></template>
<div class="catalog-card-footer"><span class="muted" v-if="type==='users'&&r.id===state.profile.uid">Tu cuenta</span><button class="secondary" :disabled="type==='users'&&r.id===state.profile.uid" @click="edit(r)"><AppIcon name="edit"/>Editar</button><button class="danger-button" :disabled="state.loading||(type==='users'&&r.id===state.profile.uid)" @click="removeRow(r)"><AppIcon name="close"/>Eliminar</button></div></article></div>
<details class="panel history-card"><summary><span class="row"><AppIcon name="sliders"/>Identidad del sistema</span><AppIcon name="down"/></summary><form @submit.prevent="saveSystem" class="stack-sm history-body"><div class="form-grid"><label>Nombre del sistema<input v-model="system.systemName" required/></label><label>Logotipo (URL HTTPS)<input type="url" v-model="system.logoUrl"/></label></div><button class="primary" :disabled="state.loading"><AppIcon name="save"/>Guardar identidad</button></form></details>
<AppModal v-if="modal" :title="`${id?'Editar':'Agregar'} ${meta.single}`" :subtitle="meta.name" :icon="meta.icon" :busy="state.loading" @close="modal=false;reset()"><form @submit.prevent="save" class="stack-sm"><p v-if="state.error" class="error" role="alert">{{ state.error }}</p>
        <template v-if="type === 'users'"
          ><div class="notice subtle"><AppIcon name="shield"/>Los permisos se verifican en cada operación. Puede asignar un nombre de usuario o un correo electrónico.</div>
          <div v-if="!id" class="form-grid"><label>Usuario o correo de acceso<input type="text" autocomplete="off" v-model="form.email" placeholder="Ej. erick, elin jalapa o correo@empresa.com" required/></label><label>Contraseña inicial<input type="password" autocomplete="new-password" v-model="form.password" minlength="3" maxlength="128" required/><small class="muted">Mínimo 3 caracteres.</small></label></div>
          <div v-else class="form-grid"><p class="notice subtle" style="margin:0;align-self:center">{{ userLoginLabel(form) || 'Cuenta existente' }}</p><label>Nueva contraseña (opcional)<input type="password" autocomplete="new-password" v-model="form.password" minlength="3" maxlength="128" placeholder="Dejar en blanco para conservar actual"/></label></div>
<label>Nombre<input v-model="form.name" required /></label
          ><label
            >Rol<select v-model="form.role">
              <option
                v-for="role in [
                  'Administrador',
                  'Logistica',
                  'Bodega',
                  'Tienda',
                  'Gerencia',
                  'Auditoria',
                ]"
              >
                {{ role }}
              </option>
            </select></label
          >
          <label v-if="form.role === 'Bodega'" class="check-label">
            <input type="checkbox" v-model="form.allBranches" />
            Acceso a todas las sucursales activas (Bodega Central)
          </label>
          <fieldset class="stack-sm">
            <legend>Empresas autorizadas</legend>
            <label class="check-label" v-for="e in state.data.empresas.filter(e=>e.active!==false)"
              ><input
                type="checkbox"
                :value="e.id"
                v-model="form.companyIds"
              />{{ e.nombre }}</label
            >
          </fieldset>
          <fieldset class="stack-sm">
            <legend>Sucursales autorizadas</legend>
            <label
              v-for="b in state.data.sucursales.filter((b) =>
                form.companyIds.includes(b.id_empresa),
              )"
              ><input
                type="checkbox"
                :value="b.id"
                v-model="form.branchIds"
              />{{ b.nombre }}</label
            >
          </fieldset></template
        ><template v-else
          ><label>Nombre<input v-model="form.nombre" required /></label
          ><label v-if="type === 'empresas'"
            >Grupo<select v-model="form.id_grupo" required>
              <option value="">Seleccione</option>
              <option v-for="g in state.data.grupos.filter(g=>g.active!==false)" :value="g.id">
                {{ g.nombre }}
              </option>
            </select></label
          ><label v-if="type === 'empresas'"
            >NIT<input v-model="form.nit" /></label
          ><label v-if="type === 'sucursales'"
            >Empresa<select v-model="form.id_empresa" :disabled="!!id" required>
              <option value="">Seleccione</option>
              <option v-for="e in state.data.empresas.filter(e=>e.active!==false)" :value="e.id">
                {{ e.nombre }}
              </option>
            </select></label
          ><label v-if="type === 'sucursales'"
            >Dirección<input v-model="form.direccion" /></label
          ><template v-if="type === 'insumos'"
            ><label>Código<input v-model="form.sku" /></label
            ><label
              >Proveedor<select v-model="form.id_proveedor" required>
                <option value="">Seleccione</option>
                <option
                  v-for="s in state.data.proveedores.filter(
                    (s) => s.active !== false,
                  )"
                  :value="s.id"
                >
                  {{ s.nombre }}
                </option>
              </select></label
            ><label>Presentación<input v-model="form.presentacion" /></label
            ><label
              >Unidad de compra<input
                v-model="form.unidad_compra"
                required /></label
            ><label
              >Precio de compra Q<input
                type="number"
                min="0"
                step="0.01"
                v-model="form.precio_compra"
                required
            /></label>
            <fieldset class="stack-sm">
              <legend class="section-title">
                Sucursales que deben contar este producto
              </legend>
              <label class="check-label" v-for="b in state.data.sucursales.filter(b=>b.active!==false)"
                ><input
                  type="checkbox"
                  :value="b.id"
                  v-model="form.branchIds"
                />{{ b.nombre }}</label
              >
            </fieldset></template
          ><template v-if="type === 'proveedores'"
            ><label
              >Destino predeterminado<select v-model="form.nodo_entrega">
                <option value="BODEGA">BODEGA</option>
                <option value="DIRECTO_TIENDA">DIRECTO_TIENDA</option>
              </select></label
            >
            <fieldset class="stack-sm">
              <legend style="font-weight: 650; font-size: 0.9375rem; margin-bottom: 8px;">
                Sucursales habilitadas y destino por tienda
              </legend>
              <p class="muted" style="margin-top: -4px; margin-bottom: 8px;">
                Seleccione qué sucursales pueden trabajar con este proveedor y el tipo de entrega específico para cada una.
              </p>
              <div
                v-for="b in state.data.sucursales.filter((b) => b.active !== false)"
                :key="b.id"
                style="display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: white;"
              >
                <label style="display: flex; align-items: center; gap: 10px; font-weight: 600; cursor: pointer; min-width: 0;">
                  <input
                    type="checkbox"
                    :value="b.id"
                    v-model="form.branchIds"
                  />
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ b.nombre }}</span>
                </label>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                  <span class="muted" style="font-size: 0.75rem;">Destino:</span>
                  <select
                    style="min-height: 38px; padding: 6px 10px; width: auto; font-size: 0.8125rem;"
                    :value="form.nodos_sucursal[b.id] || form.nodo_entrega"
                    @change="form.nodos_sucursal[b.id] = $event.target.value"
                  >
                    <option value="BODEGA">BODEGA</option>
                    <option value="DIRECTO_TIENDA">DIRECTO_TIENDA</option>
                  </select>
                </div>
              </div>
            </fieldset></template
          ></template
        ><label class="active-toggle"><input type="checkbox" v-model="form.active" />Acceso o registro activo</label>
        <p class="muted">
          Desactivar conserva el historial de los registros anteriores.
        </p>

<div class="dialog-footer"><button type="button" class="secondary" :disabled="state.loading" @click="modal=false;reset()">Cancelar</button><button class="primary" :disabled="state.loading"><AppIcon name="save"/>{{ state.loading?'Guardando…':id?'Guardar cambios':'Crear '+meta.single }}</button></div></form></AppModal>
</div></template>
