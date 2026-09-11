<script setup>
import {computed} from 'vue';
const props=defineProps({status:String});
const names={PENDIENTE:'Por revisar',APROBADO:'Aprobado',ESPERANDO_BODEGA:'Hacia bodega',ESPERANDO_TIENDA:'Hacia tienda',EN_CAMINO_TIENDA:'En traslado',RECIBIDO_BODEGA:'En bodega',CONCILIADO:'Completado',RECHAZADO:'Rechazado',DIFERENCIA_BODEGA:'Diferencia en bodega',DIFERENCIA_TIENDA:'Diferencia en tienda',ENVIADO:'Enviado',EMITIDA:'Emitida'};
const tone=computed(()=>props.status?.startsWith('DIFERENCIA')||props.status==='RECHAZADO'?'danger':['CONCILIADO','APROBADO','ENVIADO'].includes(props.status)?'green':props.status==='PENDIENTE'?'amber':'blue');
</script>
<template><span class="status-badge" :class="tone"><AppIcon :name="tone==='danger'?'alert':tone==='green'?'checkCircle':tone==='amber'?'clock':'truck'" :size="14"/>{{names[status]||status?.replaceAll('_',' ')||'Sin estado'}}</span></template>
