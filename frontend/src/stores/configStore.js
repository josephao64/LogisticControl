import { defineStore } from 'pinia';
import { ref } from 'vue';
import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export const useConfigStore = defineStore('config', () => {
  const getInitialConfig = () => {
    const saved = localStorage.getItem('sistemi_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return { 
      systemName: 'Logistic Control', 
      logoUrl: '',
      logoText: 'LC'
    };
  };

  const config = ref(getInitialConfig());

  const fetchConfig = async () => {
    try {
      const response = await axios.get(`${API_URL}/config`);
      if (response.data && response.data.data) {
        config.value = { ...config.value, ...response.data.data };
        localStorage.setItem('sistemi_config', JSON.stringify(config.value));
      }
    } catch (err) {
      console.error('Error fetching config:', err);
    }
  };

  const saveConfig = async (newConfig) => {
    try {
      const response = await axios.post(`${API_URL}/config`, newConfig);
      if (response.data && response.data.data) {
        config.value = { ...config.value, ...response.data.data };
        localStorage.setItem('sistemi_config', JSON.stringify(config.value));
      }
    } catch (err) {
      console.error('Error saving config:', err);
      // Fallback a localStorage si falla la API
      config.value = { ...config.value, ...newConfig };
      localStorage.setItem('sistemi_config', JSON.stringify(config.value));
    }
  };

  return {
    config,
    fetchConfig,
    saveConfig
  };
});
