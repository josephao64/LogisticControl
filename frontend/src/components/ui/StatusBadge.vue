<script setup>
import {computed} from 'vue';
const props=defineProps({status:String});
const names={
  PENDIENTE:'Por revisar',
  APROBADO:'Aprobado',
  ESPERANDO_BODEGA:'Tomado por proveedor (OC generada)',
  ESPERANDO_TIENDA:'Tomado por proveedor (OC generada)',
  RECIBIDO_BODEGA:'En bodega',
  EN_CAMINO_TIENDA:'En camino a tienda',
  CONCILIADO:'En tienda (Recibido)',
  COMPLETADO:'En tienda (Recibido)',
  RECHAZADO:'Rechazado',
  DIFERENCIA_BODEGA:'Diferencia en bodega',
  DIFERENCIA_TIENDA:'Diferencia en tienda',
  ENVIADO:'Enviado',
  EMITIDA:'OC Emitida'
};
const tone=computed(()=>{
  if(props.status?.startsWith('DIFERENCIA')||props.status==='RECHAZADO')return 'danger';
  if(['CONCILIADO','COMPLETADO'].includes(props.status))return 'green';
  if(props.status==='APROBADO')return 'blue';
  if(['ESPERANDO_BODEGA','ESPERANDO_TIENDA'].includes(props.status))return 'purple';
  if(props.status==='RECIBIDO_BODEGA')return 'blue';
  if(props.status==='EN_CAMINO_TIENDA')return 'amber';
  if(props.status==='PENDIENTE')return 'amber';
  return 'blue';
});
const iconName=computed(()=>{
  if(props.status?.startsWith('DIFERENCIA')||props.status==='RECHAZADO')return 'alert';
  if(['CONCILIADO','COMPLETADO'].includes(props.status))return 'checkCircle';
  if(props.status==='APROBADO')return 'check';
  if(['ESPERANDO_BODEGA','ESPERANDO_TIENDA'].includes(props.status))return 'file';
  if(props.status==='RECIBIDO_BODEGA')return 'warehouse';
  if(props.status==='EN_CAMINO_TIENDA')return 'truck';
  if(props.status==='PENDIENTE')return 'clock';
  return 'box';
});
</script>
<template><span class="status-badge" :class="tone"><AppIcon :name="iconName" :size="14"/>{{names[status]||status?.replaceAll('_',' ')||'Sin estado'}}</span></template>
