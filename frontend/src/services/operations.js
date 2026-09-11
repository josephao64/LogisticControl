import { reactive } from "vue";
import axios from "axios";
import { auth } from "./firebase";
export const state = reactive({
  data: null,
  profile: null,
  loading: false,
  error: "",
});
const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30000,
});
http.interceptors.request.use(async (config) => {
  if (auth?.currentUser)
    config.headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  return config;
});
export async function refresh() {
  const { data } = await http.get("/operacion/snapshot");
  state.data = data.data;
  state.profile = data.data.user;
}
// Retain the same key after an uncertain network outcome; a new payload gets a new key.
export async function command(path, payload = {}) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  const fingerprint = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const storageKey = `operation:${auth.currentUser.uid}:${path}:${fingerprint}`;
  let id = sessionStorage.getItem(storageKey);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(storageKey, id);
  }
  const { data } = await http.post(`/operacion/${path}`, payload, {
    headers: { "Idempotency-Key": id },
  });
  await refresh();
  sessionStorage.removeItem(storageKey);
  return data.data;
}
export async function catalog(type, id, payload, remove = false) {
  const url = `/catalogos/${type}${id ? `/${id}` : ""}`;
  const result = remove
    ? await http.delete(url)
    : id
      ? await http.put(url, payload)
      : await http.post(url, payload);
  await refresh();
  return result.data.data;
}
export async function perform(fn) {
  if (state.loading) return;
  state.loading = true;
  state.error = "";
  try {
    return await fn();
  } catch (e) {
    state.error = e.response?.data?.error || e.message;
  } finally {
    state.loading = false;
  }
}
export const money = (n) =>
  new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" }).format(
    n || 0,
  );
export const label = (s) => String(s || "").replaceAll("_", " ");
