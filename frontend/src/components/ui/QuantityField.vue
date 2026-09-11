<script setup>
const props=defineProps({modelValue:[String,Number],label:String,required:Boolean,disabled:Boolean});
const emit=defineEmits(['update:modelValue','change']);
function update(value){emit('update:modelValue',value);emit('change',value);}
function adjust(delta){const n=props.modelValue===''?0:Number(props.modelValue);update(Math.max(0,Math.round((n+delta)*1000)/1000));}
</script>
<template><label class="quantity-field"><span>{{label}}</span><span class="stepper"><button type="button" @click="adjust(-1)" :disabled="disabled" :aria-label="`Reducir ${label}`"><AppIcon name="minus" :size="16"/></button><input :value="modelValue" @input="update($event.target.value)" type="number" min="0" step="any" inputmode="decimal" :required="required" :disabled="disabled" :aria-label="label" placeholder="—"><button type="button" @click="adjust(1)" :disabled="disabled" :aria-label="`Aumentar ${label}`"><AppIcon name="plus" :size="16"/></button></span></label></template>
