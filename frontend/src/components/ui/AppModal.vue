<script setup>
import {ref,onMounted,onBeforeUnmount} from 'vue';
const props=defineProps({title:String,subtitle:String,busy:Boolean,icon:{type:String,default:'edit'}});
const emit=defineEmits(['close']);const dialog=ref(null);let previousOverflow='';
const headingId=`dialog-${Math.random().toString(36).slice(2)}`;
function close(){if(!props.busy)emit('close');}
onMounted(()=>{previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.value.showModal();});
onBeforeUnmount(()=>{document.body.style.overflow=previousOverflow;dialog.value?.close();});
</script>
<template><Teleport to="body"><dialog ref="dialog" class="app-dialog" :aria-labelledby="headingId" @cancel.prevent="close" @click="e=>{if(e.target===dialog)close()}"><section class="dialog-shell"><header class="dialog-heading"><span class="icon-tile"><AppIcon :name="icon"/></span><div><h2 :id="headingId">{{title}}</h2><p>{{subtitle}}</p></div><button type="button" class="icon-button" aria-label="Cerrar ventana" @click="close" :disabled="busy"><AppIcon name="close"/></button></header><div class="dialog-body"><slot/></div></section></dialog></Teleport></template>
