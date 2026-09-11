import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

// La URL base del backend. En producción esto vendría de variables de entorno de Vite (import.meta.env.VITE_API_URL)
const API_URL = 'http://localhost:3000/api';

export const usePedidoStore = defineStore('pedido', () => {
  const pedidos = ref([]);
  const loading = ref(false);
  const error = ref(null);

  // Estado del borrador (Draft)
  const getInitialDraft = () => {
    const saved = localStorage.getItem('sistemi_pedido_draft');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { active: false, fase: 'auditoria', inventarioFisico: {}, itemsAuditados: [] };
  };

  const draft = ref(getInitialDraft());

  const saveDraft = () => {
    draft.value.active = true;
    localStorage.setItem('sistemi_pedido_draft', JSON.stringify(draft.value));
  };

  const clearDraft = () => {
    draft.value = { active: false, fase: 'auditoria', inventarioFisico: {}, itemsAuditados: [] };
    localStorage.removeItem('sistemi_pedido_draft');
  };

  // Obtener pedidos del backend Express
  const fetchPedidos = async () => {
    loading.value = true;
    error.value = null;
    try {
      const response = await axios.get(`${API_URL}/pedidos`);
      pedidos.value = response.data.data;
    } catch (err) {
      error.value = err.response?.data?.error || err.message;
      console.error('Error fetching pedidos:', err);
    } finally {
      loading.value = false;
    }
  };

  // Crear un nuevo pedido con la regla de auditoría forzada
  const crearPedido = async (pedidoData) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await axios.post(`${API_URL}/pedidos`, pedidoData);
      if (Array.isArray(response.data.data)) {
        pedidos.value.unshift(...response.data.data);
      } else {
        pedidos.value.unshift(response.data.data);
      }
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.error || err.message;
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  };

  // Actualizar estado del pedido
  const actualizarEstado = async (id, nuevoEstado, usuarioRol) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await axios.put(`${API_URL}/pedidos/${id}`, { estado: nuevoEstado }, {
        headers: { 'x-usuario-rol': usuarioRol }
      });
      
      // Actualizar el estado localmente
      const index = pedidos.value.findIndex(p => p.id === id);
      if (index !== -1) {
        pedidos.value[index] = response.data.data;
      }
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.error || err.message;
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  };

  const modificarPedido = async (id, actualizacion, usuarioRol) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await axios.put(`${API_URL}/pedidos/${id}`, actualizacion, {
        headers: { 'x-usuario-rol': usuarioRol }
      });
      
      const index = pedidos.value.findIndex(p => p.id === id);
      if (index !== -1) {
        pedidos.value[index] = response.data.data;
      }
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.error || err.message;
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  };

  const adjuntarGuia = async (id, datosGuia) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await axios.put(`${API_URL}/pedidos/${id}`, { guia: datosGuia, estado: 'EN_CAMINO' }, {
        headers: { 'x-usuario-rol': 'Bodega' } // o el rol que aplique
      });
      
      const index = pedidos.value.findIndex(p => p.id === id);
      if (index !== -1) {
        pedidos.value[index] = response.data.data;
      }
      return response.data;
    } catch (err) {
      error.value = err.response?.data?.error || err.message;
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  };

  const eliminarPedido = async (id) => {
    loading.value = true;
    error.value = null;
    try {
      await axios.delete(`${API_URL}/pedidos/${id}`);
      pedidos.value = pedidos.value.filter(p => p.id !== id);
    } catch (err) {
      error.value = err.response?.data?.error || err.message;
      throw new Error(error.value);
    } finally {
      loading.value = false;
    }
  };

  return {
    pedidos,
    loading,
    error,
    draft,
    saveDraft,
    clearDraft,
    fetchPedidos,
    crearPedido,
    actualizarEstado,
    modificarPedido,
    adjuntarGuia,
    eliminarPedido
  };
});

