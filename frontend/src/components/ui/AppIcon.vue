<script setup>
import {computed} from 'vue';
const props=defineProps({name:{type:String,default:'box'},size:{type:[Number,String],default:20}});
// Small functional line icons, with the same 24 px grid and stroke weight.
const paths={
 box:['M12 3 3 8l9 5 9-5-9-5Z','M3 8v9l9 5 9-5V8','M12 13v9','m7.5 5.5 9 5'],
 grid:['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'],
 clipboard:['M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3','M9 3h6v4H9z','m8 14 2 2 5-5'],
 truck:['M3 5h11v12H3zM14 10h4l3 4v3h-7','M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z'],
 warehouse:['M3 21V9l9-6 9 6v12','M7 21V11h10v10M7 15h10M7 18h10'],
 store:['M3 10h18l-2-7H5l-2 7ZM4 10v11h16V10M9 21v-7h6v7'],
 chart:['M4 3v18h17M8 16v-4M13 16V8M18 16V5'],
 sliders:['M4 6h16M4 12h16M4 18h16','M8 3v6M16 9v6M10 15v6'],
 users:['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 7M18 15a5 5 0 0 1 4 5'],
 building:['M4 21V3h12v18M16 10h5v11M8 7h4M8 11h4M8 15h4M9 21v-3h2v3'],
 layers:['m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5'],
 search:['M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15ZM16 16l5 5'],
 plus:['M12 5v14M5 12h14'],minus:['M5 12h14'],close:['m6 6 12 12M6 18 18 6'],menu:['M4 6h16M4 12h16M4 18h16'],
 check:['m5 12 4 4L19 6'],chevron:['m9 5 7 7-7 7'],down:['m6 9 6 6 6-6'],arrow:['M4 12h16m-6-6 6 6-6 6'],
 clock:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2'],
 calendar:['M4 5h16v16H4zM8 2v6M16 2v6M4 10h16M8 14h1M15 14h1M8 18h1'],
 refresh:['M20 8a9 9 0 0 0-15-3L2 8M2 2v6h6M4 16a9 9 0 0 0 15 3l3-3M22 22v-6h-6'],
 logout:['M9 4H4v16h5M10 12h11m-5-5 5 5-5 5'],
 shield:['m12 2 8 3v6c0 6-8 11-8 11S4 17 4 11V5l8-3Z','m8 11 3 3 5-5'],
 mail:['M3 5h18v14H3zM3 5l9 8 9-8'],lock:['M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3'],
 eye:['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z','M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
 info:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 11v6M12 7h.01'],
 alert:['m12 3 10 18H2L12 3ZM12 9v5M12 17h.01'],
 file:['M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h6'],
 download:['M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'],
 edit:['m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 15v5Z'],
 history:['M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l4 2'],
 filter:['M3 4h18l-7 8v7l-4 2v-9L3 4Z'],
 spark:['m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'],
 pin:['M12 22s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13ZM12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
 save:['M4 3h13l4 4v14H3V3h1ZM7 3v6h9V3M7 21v-8h10v8'],
 checkCircle:['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z','m7 12 3 3 7-7'],
 receipt:['M5 2l3 2 4-2 4 2 3-2v20l-3-2-4 2-4-2-3 2V2ZM8 8h8M8 12h8M8 16h5'],
 bell:['M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4'],
 list:['M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01'],
 board:['M3 3h18v18H3zM9 3v18M15 3v18M5 7h2M11 7h2M17 7h2'],
};
const data=computed(()=>paths[props.name]||paths.box);
</script>
<template><svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" class="app-icon"><path v-for="(d,i) in data" :key="i" :d="d"/></svg></template>
