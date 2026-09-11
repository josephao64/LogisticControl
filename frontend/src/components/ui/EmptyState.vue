<script setup>defineProps({title:{type:String,default:'Todo listo para comenzar'},description:String,icon:{type:String,default:'box'}});</script>
<template><div class="empty-state"><span class="empty-icon"><AppIcon :name="icon" :size="30"/></span><h3>{{title}}</h3><p v-if="description">{{description}}</p><slot/></div></template>
