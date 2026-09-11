import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export const useTenantStore = defineStore('tenant', () => {
  const grupos = ref([]);
  const empresas = ref([]);
  const sucursales = ref([]);
  const loading = ref(false);
  const error = ref(null);

  const fetchGrupos = async () => {
    loading.value = true;
    try {
      const response = await axios.get(`${API_URL}/tenant/grupos`);
      grupos.value = response.data.data;
    } catch (err) { error.value = err.message; } finally { loading.value = false; }
  };

  const addGrupo = async (data) => {
    try {
      await axios.post(`${API_URL}/tenant/grupos`, data);
      await fetchGrupos();
    } catch (err) { throw err; }
  };

  const fetchEmpresas = async () => {
    loading.value = true;
    try {
      const response = await axios.get(`${API_URL}/tenant/empresas`);
      empresas.value = response.data.data;
    } catch (err) { error.value = err.message; } finally { loading.value = false; }
  };

  const addEmpresa = async (data) => {
    try {
      await axios.post(`${API_URL}/tenant/empresas`, data);
      await fetchEmpresas();
    } catch (err) { throw err; }
  };

  const fetchSucursales = async () => {
    loading.value = true;
    try {
      const response = await axios.get(`${API_URL}/tenant/sucursales`);
      sucursales.value = response.data.data;
    } catch (err) { error.value = err.message; } finally { loading.value = false; }
  };

  const addSucursal = async (data) => {
    try {
      await axios.post(`${API_URL}/tenant/sucursales`, data);
      await fetchSucursales();
    } catch (err) { throw err; }
  };

  const updateGrupo = async (id, data) => {
    try {
      await axios.put(`${API_URL}/tenant/grupos/${id}`, data);
      await fetchGrupos();
    } catch (err) { throw err; }
  };

  const deleteGrupo = async (id) => {
    try {
      await axios.delete(`${API_URL}/tenant/grupos/${id}`);
      await fetchGrupos();
    } catch (err) { throw err; }
  };

  const updateEmpresa = async (id, data) => {
    try {
      await axios.put(`${API_URL}/tenant/empresas/${id}`, data);
      await fetchEmpresas();
    } catch (err) { throw err; }
  };

  const deleteEmpresa = async (id) => {
    try {
      await axios.delete(`${API_URL}/tenant/empresas/${id}`);
      await fetchEmpresas();
    } catch (err) { throw err; }
  };

  const updateSucursal = async (id, data) => {
    try {
      await axios.put(`${API_URL}/tenant/sucursales/${id}`, data);
      await fetchSucursales();
    } catch (err) { throw err; }
  };

  const deleteSucursal = async (id) => {
    try {
      await axios.delete(`${API_URL}/tenant/sucursales/${id}`);
      await fetchSucursales();
    } catch (err) { throw err; }
  };

  return {
    grupos, empresas, sucursales, loading, error,
    fetchGrupos, addGrupo, updateGrupo, deleteGrupo,
    fetchEmpresas, addEmpresa, updateEmpresa, deleteEmpresa,
    fetchSucursales, addSucursal, updateSucursal, deleteSucursal
  };
});
