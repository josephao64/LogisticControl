<script setup>
import { ref } from 'vue';
import { useConfigStore } from '../stores/configStore';
import Swal from 'sweetalert2';

const configStore = useConfigStore();

const formData = ref({
  systemName: configStore.config.systemName,
  logoUrl: configStore.config.logoUrl,
  logoText: configStore.config.logoText
});

const saveSettings = () => {
  configStore.saveConfig(formData.value);
  Swal.fire({
    title: '¡Guardado!',
    text: 'Configuración actualizada correctamente.',
    icon: 'success',
    customClass: { popup: 'liquid-crystal-modal' }
  });
};
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-slate-800">Configuración del Sistema</h2>
      <p class="text-slate-500 mt-2">Personaliza la apariencia y el comportamiento global del sistema.</p>
    </div>

    <div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      <div class="p-6 md:p-8">
        <form @submit.prevent="saveSettings" class="space-y-6">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Nombre del Sistema</label>
            <input 
              type="text" 
              v-model="formData.systemName"
              class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
              placeholder="Ej. Mi Sistema Logístico"
            />
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">Texto Corto del Logo (2-3 letras)</label>
            <input 
              type="text" 
              v-model="formData.logoText"
              maxlength="3"
              class="w-full md:w-1/3 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
              placeholder="Ej. MSL"
            />
            <p class="text-xs text-slate-500 mt-2">Este texto se muestra si no hay una URL de imagen de logo definida.</p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-2">URL del Logo (Opcional)</label>
            <input 
              type="url" 
              v-model="formData.logoUrl"
              class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
              placeholder="https://ejemplo.com/logo.png"
            />
          </div>

          <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-4">
            <span class="text-sm font-semibold text-slate-600">Vista previa:</span>
            <div class="flex-shrink-0 flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm">
              <img v-if="formData.logoUrl" :src="formData.logoUrl" alt="Logo" class="w-10 h-10 object-contain rounded-xl" />
              <div v-else class="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <span class="text-white font-bold text-xl tracking-tighter">{{ formData.logoText }}</span>
              </div>
              <h1 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">{{ formData.systemName }}</h1>
            </div>
          </div>

          <div class="flex justify-end pt-4 border-t border-slate-200">
            <button type="submit" class="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-lg shadow-blue-500/30 transition-all transform active:scale-95">
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
