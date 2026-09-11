import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './assets/index.css'
import App from './App.vue'

import AppIcon from './components/ui/AppIcon.vue'
import PageHeader from './components/ui/PageHeader.vue'
import EmptyState from './components/ui/EmptyState.vue'
import StatusBadge from './components/ui/StatusBadge.vue'
import AppModal from './components/ui/AppModal.vue'
import QuantityField from './components/ui/QuantityField.vue'
import MetricCard from './components/ui/MetricCard.vue'

const app = createApp(App)
for (const [name, component] of Object.entries({AppIcon, PageHeader, EmptyState, StatusBadge, AppModal, QuantityField, MetricCard})) app.component(name, component)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
