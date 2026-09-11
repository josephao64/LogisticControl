import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export const useSuministrosStore = defineStore('suministros', () => {
  const proveedores = ref([]);
  const insumos = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const fetchProveedores = async () => {
    loading.value = true;
    try {
      const response = await axios.get(`${API_URL}/suministros/proveedores`);
      proveedores.value = response.data.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const fetchInsumos = async () => {
    loading.value = true;
    try {
      const response = await axios.get(`${API_URL}/suministros/insumos`);
      insumos.value = response.data.data;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const addProveedor = async (data) => {
    try {
      await axios.post(`${API_URL}/suministros/proveedores`, data);
      await fetchProveedores();
    } catch (err) { throw err; }
  };

  const addInsumo = async (data) => {
    try {
      await axios.post(`${API_URL}/suministros/insumos`, data);
      await fetchInsumos();
    } catch (err) { throw err; }
  };

  const updateProveedor = async (id, data) => {
    try {
      await axios.put(`${API_URL}/suministros/proveedores/${id}`, data);
      await fetchProveedores();
    } catch (err) { throw err; }
  };

  const deleteProveedor = async (id) => {
    try {
      await axios.delete(`${API_URL}/suministros/proveedores/${id}`);
      await fetchProveedores();
    } catch (err) { throw err; }
  };

  const updateInsumo = async (id, data) => {
    try {
      await axios.put(`${API_URL}/suministros/insumos/${id}`, data);
      await fetchInsumos();
    } catch (err) { throw err; }
  };

  const deleteInsumo = async (id) => {
    try {
      await axios.delete(`${API_URL}/suministros/insumos/${id}`);
      await fetchInsumos();
    } catch (err) { throw err; }
  };

  return {
    proveedores,
    insumos,
    loading,
    error,
    fetchProveedores,
    fetchInsumos,
    addProveedor,
    updateProveedor,
    deleteProveedor,
    addInsumo,
    updateInsumo,
    deleteInsumo
  };
});
