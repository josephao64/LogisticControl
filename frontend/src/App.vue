<script setup>
import {ref,computed,onBeforeUnmount} from 'vue';
import {onAuthStateChanged,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {auth,configured} from './services/firebase';
import {state,refresh,perform} from './services/operations';
import {useRouter,useRoute} from 'vue-router';
const router=useRouter(),route=useRoute(),email=ref(''),password=ref(''),ready=ref(false),user=ref(null),menu=ref(false),showPassword=ref(false);
const routes=[
 {path:'/dashboard',title:'Resumen e historial',short:'Resumen',icon:'chart',roles:['Administrador','Logistica','Tienda','Bodega','Gerencia','Auditoria']},
 {path:'/tienda',title:'Conteo semanal',short:'Conteo',icon:'clipboard',roles:['Administrador','Tienda']},
 {path:'/logistica',title:'Solicitudes y órdenes',short:'Solicitudes',icon:'layers',roles:['Administrador','Logistica']},
 {path:'/bodega',title:'Recepciones y entregas',short:'Entregas',icon:'truck',roles:['Administrador','Bodega','Tienda','Logistica']},
 {path:'/parametros',title:'Stock y calendario',short:'Stock',icon:'sliders',roles:['Administrador','Logistica']},
 {path:'/catalogos',title:'Catálogos y accesos',short:'Catálogos',icon:'grid',roles:['Administrador']},
];
const links=computed(()=>routes.filter(r=>r.roles.includes(state.profile?.role)));
const current=computed(()=>routes.find(r=>r.path===route.path));
const userName=computed(()=>state.profile?.name||user.value?.email||'Usuario');
const initials=computed(()=>userName.value.split(/[\s@]+/).slice(0,2).map(n=>n[0]).join('').toUpperCase());
const alerts=computed(()=>state.data?.alerts?.filter(a=>!a.resolved).length||0);
const systemName=computed(()=>state.data?.config?.[0]?.systemName||'Logistic Control');
const dateLabel=new Intl.DateTimeFormat('es-GT',{dateStyle:'medium',timeZone:'America/Guatemala'}).format(new Date());
let unsubscribe;
if(auth)unsubscribe=onAuthStateChanged(auth,async u=>{
 user.value=u;state.data=null;state.profile=null;state.error='';
 if(u){try{await refresh();}catch(e){state.error=e.response?.data?.error||'No pudimos conectar con el servidor. Revisa que esté iniciado.';}}
 ready.value=true;
 if(state.profile&&!links.value.some(r=>r.path===router.currentRoute.value.path))router.replace(links.value[0].path);
});else ready.value=true;
onBeforeUnmount(()=>unsubscribe?.());
const login=()=>perform(()=>signInWithEmailAndPassword(auth,email.value,password.value));
const logout=async()=>{menu.value=false;await perform(()=>signOut(auth));password.value='';};
</script>
<template>
 <div v-if="!ready" class="loading-screen"><span class="brand-symbol"><AppIcon name="box" :size="26"/></span><AppIcon name="refresh" class="spin"/><p>Cargando tu espacio de trabajo…</p></div>
 <main v-else-if="!user||!state.profile" class="login-page">
  <aside class="login-brand"><div class="brand"><span class="brand-symbol"><AppIcon name="box" :size="25"/></span><div><strong>Logistic Control</strong><small>Gestión de abastecimiento</small></div></div><div class="login-story"><span class="eyebrow" style="color:#82cab9">Operación centralizada</span><h2>Cada sucursal.<br>Cada pedido.<br>Todo conectado.</h2><p>Un espacio para organizar el abastecimiento y acompañar cada entrega.</p><div class="login-stages"><div v-for="[icon,text] in [['clipboard','Conteos completos'],['layers','Compras por proveedor'],['shield','Recepciones con trazabilidad']]" :key="icon" class="login-stage"><span class="icon-tile"><AppIcon :name="icon"/></span><strong>{{text}}</strong></div></div></div><footer>Acceso por usuario, empresa y sucursal</footer></aside>
  <div class="login-form-wrap"><form @submit.prevent="login" class="login-form"><div><span class="icon-tile"><AppIcon name="lock"/></span><h1>{{user?'Conectemos tu cuenta':'Bienvenido de nuevo'}}</h1><p>{{user?'Revisa tu acceso para continuar.':'Ingresa para continuar con tu operación.'}}</p></div><div v-if="!configured" class="error"><AppIcon name="info"/>Falta configurar Firebase. Consulta la guía incluida en el sistema.</div><template v-else-if="!user"><label>Correo electrónico<div class="field-with-icon" style="margin-top:8px"><AppIcon name="mail"/><input v-model="email" type="email" autocomplete="username" placeholder="tu@correo.com" required></div></label><label>Contraseña<div class="field-with-icon" style="margin-top:8px"><AppIcon name="lock"/><input v-model="password" :type="showPassword?'text':'password'" autocomplete="current-password" placeholder="Ingresa tu contraseña" required><button type="button" class="icon-button" @click="showPassword=!showPassword" :aria-label="showPassword?'Ocultar contraseña':'Mostrar contraseña'" :aria-pressed="showPassword"><AppIcon name="eye" :size="18"/></button></div></label><button class="primary full" :disabled="state.loading"><AppIcon v-if="state.loading" name="refresh" class="spin"/>{{state.loading?'Ingresando…':'Ingresar al sistema'}}<AppIcon v-if="!state.loading" name="arrow" :size="18"/></button></template><template v-else><div class="notice"><AppIcon name="shield"/><p>Tu cuenta necesita un perfil autorizado y una conexión activa con el servidor.</p></div><button class="primary full" type="button" @click="perform(refresh)" :disabled="state.loading"><AppIcon name="refresh"/>Reintentar conexión</button><button class="ghost" type="button" @click="logout">Usar otra cuenta</button></template><div v-if="state.error" role="alert" class="error"><AppIcon name="alert"/><span>{{state.error}}</span></div><details class="login-help"><summary><AppIcon name="info" :size="17"/>¿Necesitas acceso?</summary><p>Solicita tu cuenta y la asignación de sucursales al administrador. Si es la primera instalación, sigue los pasos de LEEME_PRIMERO.txt.</p></details></form></div>
 </main>
 <div v-else class="app-layout"><a href="#contenido" class="skip-link">Ir al contenido</a><div v-if="state.loading" class="progress-line" role="status" aria-label="Actualizando datos"></div>
  <aside class="sidebar"><div class="brand"><img v-if="state.data?.config?.[0]?.logoUrl" :src="state.data.config[0].logoUrl" alt="Logo de la empresa"><span v-else class="brand-symbol"><AppIcon name="box" :size="24"/></span><div class="brand-copy"><strong>{{systemName}}</strong><small>Abastecimiento</small></div></div><p class="nav-caption">Espacio de trabajo</p><nav aria-label="Navegación principal"><router-link v-for="r in links" :key="r.path" :to="r.path" class="nav-link" :title="r.title"><AppIcon :name="r.icon"/><span>{{r.title}}</span><AppIcon v-if="r.path===route.path" name="chevron" :size="15" class="nav-arrow"/></router-link></nav><div class="sidebar-bottom"><div class="sidebar-user"><span class="avatar">{{initials}}</span><div class="user-copy"><strong>{{userName}}</strong><small>{{state.profile.role}}</small></div></div><button @click="logout" :disabled="state.loading" title="Cerrar sesión"><AppIcon name="logout" :size="18"/><span>Cerrar sesión</span></button></div></aside>
  <div class="workspace"><header class="topbar"><div class="row"><button class="icon-button mobile-only" @click="menu=true" aria-label="Abrir navegación"><AppIcon name="menu"/></button><div class="breadcrumb"><span class="section-prefix">Mi operación</span><AppIcon name="chevron" :size="14" class="section-prefix"/><strong>{{current?.title}}</strong></div></div><div class="topbar-actions"><span class="date-label">{{dateLabel}}</span><button class="icon-button" @click="perform(refresh)" :disabled="state.loading" title="Actualizar datos" aria-label="Actualizar datos"><AppIcon name="refresh" :class="{spin:state.loading}" :size="19"/></button><router-link to="/dashboard" class="icon-button alerts-button" :aria-label="`${alerts} diferencias pendientes. Ver resumen.`"><AppIcon name="bell" :size="20"/><b v-if="alerts">{{alerts>9?'9+':alerts}}</b></router-link><span class="avatar desktop-only">{{initials}}</span></div></header>
   <main id="contenido" class="workspace-content" tabindex="-1"><div v-if="state.error" role="alert" class="error" style="margin-bottom:20px"><AppIcon name="alert"/><span class="grow">{{state.error}}</span><button class="icon-button" @click="state.error=''" aria-label="Ocultar mensaje"><AppIcon name="close" :size="16"/></button></div><router-view v-if="state.data" v-slot="{Component}"><Transition name="page" mode="out-in"><component :is="Component" :key="route.path"/></Transition></router-view><EmptyState v-else title="Cargando tu operación" icon="refresh"/></main>
  </div>
  <nav class="bottom-nav" aria-label="Accesos rápidos"><router-link v-for="r in links.slice(0,4)" :key="r.path" :to="r.path"><AppIcon :name="r.icon"/><span>{{r.short}}</span></router-link><button @click="menu=true" aria-label="Más opciones"><AppIcon name="menu"/><span>Más</span></button></nav>
  <AppModal v-if="menu" title="Tu espacio de trabajo" :subtitle="`${userName} · ${state.profile.role}`" icon="grid" @close="menu=false"><nav class="drawer-nav" aria-label="Navegación móvil"><router-link v-for="r in links" :key="r.path" :to="r.path" @click="menu=false"><AppIcon :name="r.icon"/><span class="grow">{{r.title}}</span><AppIcon name="chevron" :size="16"/></router-link><div class="divider"></div><button @click="logout" :disabled="state.loading"><AppIcon name="logout"/>Cerrar sesión</button></nav></AppModal>
 </div>
</template>
