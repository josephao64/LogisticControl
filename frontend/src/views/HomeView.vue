<script setup>
import { useConfigStore } from '../stores/configStore';
import { useRouter } from 'vue-router';

const configStore = useConfigStore();
const router = useRouter();

const modules = [
  {
    title: 'Tienda (Pedidos)',
    description: 'Genera pedidos realizando la auditoría de inventario físico previo.',
    icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z',
    path: '/tienda',
    bgClass: 'bg-gradient-to-br from-emerald-400 to-green-600',
    shadowClass: 'shadow-green-500/30'
  },
  {
    title: 'Logística',
    description: 'Triage de pedidos, consolidación por proveedor y generación de Vouchers.',
    icon: 'M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h10z M13 8h6l2 3v5h-8V8z',
    path: '/logistica',
    bgClass: 'bg-gradient-to-br from-blue-500 to-indigo-600',
    shadowClass: 'shadow-blue-500/30'
  },
  {
    title: 'Bodega',
    description: 'Recepción física de mercadería y registro de facturas.',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    path: '/bodega',
    bgClass: 'bg-gradient-to-br from-purple-500 to-fuchsia-600',
    shadowClass: 'shadow-purple-500/30'
  },
  {
    title: 'Maestros',
    description: 'Administración de proveedores, productos base y configuración logística.',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    path: '/maestros',
    bgClass: 'bg-gradient-to-br from-amber-400 to-orange-500',
    shadowClass: 'shadow-orange-500/30'
  },
  {
    title: 'Configuración',
    description: 'Ajustes globales, nombre del sistema y logotipo.',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    path: '/configuracion',
    bgClass: 'bg-gradient-to-br from-slate-600 to-slate-800',
    shadowClass: 'shadow-slate-500/30'
  }
];

const navigateTo = (path) => {
  router.push(path);
};
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <div class="text-center mb-16 animate-fade-in-up">
      <div class="w-24 h-24 mx-auto mb-6 bg-white rounded-3xl shadow-xl flex items-center justify-center p-2 transform rotate-3 hover:rotate-0 transition-transform duration-300">
        <img v-if="configStore.config.logoUrl" :src="configStore.config.logoUrl" alt="Logo" class="w-full h-full object-contain rounded-2xl" />
        <div v-else class="w-full h-full bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-inner">
          <span class="text-white font-bold text-4xl tracking-tighter">{{ configStore.config.logoText }}</span>
        </div>
      </div>
      <h2 class="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 mb-4 tracking-tight">
        Bienvenido a {{ configStore.config.systemName }}
      </h2>
      <p class="text-xl text-slate-500 max-w-2xl mx-auto font-medium">
        El motor inteligente de logística y distribución. Selecciona un módulo para continuar con tu operativa diaria.
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-4 sm:px-0">
      <div 
        v-for="(mod, index) in modules" 
        :key="index"
        @click="navigateTo(mod.path)"
        class="group cursor-pointer bg-white rounded-3xl p-8 border border-slate-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 relative overflow-hidden"
      >
        <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-100 to-transparent rounded-bl-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-150"></div>
        
        <div :class="[mod.bgClass, mod.shadowClass]" class="w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg transform group-hover:rotate-6 transition-transform duration-300 relative z-10">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="mod.icon"></path></svg>
        </div>
        
        <h3 class="text-2xl font-bold text-slate-800 mb-3 relative z-10 group-hover:text-blue-600 transition-colors">{{ mod.title }}</h3>
        <p class="text-slate-500 leading-relaxed relative z-10">{{ mod.description }}</p>
        
        <div class="mt-6 flex items-center text-sm font-bold text-slate-400 group-hover:text-blue-600 transition-colors relative z-10">
          Entrar al módulo
          <svg class="w-4 h-4 ml-2 transform group-hover:translate-x-2 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
