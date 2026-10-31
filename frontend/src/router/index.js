import { createRouter, createWebHistory } from "vue-router";
import { state } from "../services/operations";

export function homeForRole(role) {
  if (role === "Bodega") return "/bodega";
  if (role === "Tienda") return "/tienda";
  if (role === "Logistica") return "/logistica";
  return "/dashboard";
}

const routes = [
  { path: "/", redirect: () => homeForRole(state.profile?.role) },
  {
    path: "/tienda",
    component: () => import("../views/CountView.vue"),
    meta: { roles: ["Administrador", "Tienda"] },
  },
  {
    path: "/mis-pedidos",
    component: () => import("../views/OperationsView.vue"),
    meta: { roles: ["Tienda", "Administrador"] },
  },
  {
    path: "/logistica",
    component: () => import("../views/OperationsView.vue"),
    meta: { roles: ["Administrador", "Logistica"] },
  },
  {
    path: "/bodega",
    component: () => import("../views/OperationsView.vue"),
    meta: { roles: ["Administrador", "Bodega", "Logistica"] },
  },
  {
    path: "/dashboard",
    component: () => import("../views/HistoryView.vue"),
    meta: { roles: ["Administrador", "Logistica", "Gerencia", "Auditoria"] },
  },
  {
    path: "/parametros",
    component: () => import("../views/SettingsView.vue"),
    meta: { roles: ["Administrador", "Logistica"] },
  },
  {
    path: "/catalogos",
    component: () => import("../views/CatalogView.vue"),
    meta: { roles: ["Administrador"] },
  },
  { path: "/:pathMatch(.*)*", redirect: () => homeForRole(state.profile?.role) },
];
const router = createRouter({ history: createWebHistory(), routes });
router.beforeEach((to) =>
  state.profile && to.meta.roles && !to.meta.roles.includes(state.profile.role)
    ? homeForRole(state.profile.role)
    : true,
);
export default router;
