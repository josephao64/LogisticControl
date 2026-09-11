import { createRouter, createWebHistory } from "vue-router";
import { state } from "../services/operations";
const routes = [
  { path: "/", redirect: "/dashboard" },
  {
    path: "/tienda",
    component: () => import("../views/CountView.vue"),
    meta: { roles: ["Administrador", "Tienda"] },
  },
  {
    path: "/logistica",
    component: () => import("../views/OperationsView.vue"),
    meta: { roles: ["Administrador", "Logistica"] },
  },
  {
    path: "/bodega",
    component: () => import("../views/OperationsView.vue"),
    meta: { roles: ["Administrador", "Bodega", "Tienda", "Logistica"] },
  },
  { path: "/dashboard", component: () => import("../views/HistoryView.vue") },
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
  { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
];
const router = createRouter({ history: createWebHistory(), routes });
router.beforeEach((to) =>
  state.profile && to.meta.roles && !to.meta.roles.includes(state.profile.role)
    ? "/dashboard"
    : true,
);
export default router;
