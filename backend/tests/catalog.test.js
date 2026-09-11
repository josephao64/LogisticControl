const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const repo=require('./memoryRepository')({grupos:{g1:{nombre:'GRUPO',active:true}},empresas:{c1:{nombre:'EMPRESA',id_grupo:'g1',active:true}},sucursales:{b1:{nombre:'TIENDA',id_empresa:'c1',active:true}},proveedores:{s1:{nombre:'PROVEEDOR',active:true,nodo_entrega:'BODEGA',nodos_sucursal:{}}},productos:{p1:{nombre:'EXISTENTE',sku:'P001',id_proveedor:'s1',unidad_compra:'Caja',precio_compra:12,branchIds:['b1'],active:true}}});
require.cache[require.resolve('../repositories/firestoreRepository')]={exports:repo};
const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={uid:'admin',role:'Administrador'};next();});app.use(require('../routes/catalogRoutes'));app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
let server,base;
test.before(async()=>{await new Promise(r=>{server=app.listen(0,'127.0.0.1',r)});base=`http://127.0.0.1:${server.address().port}`;});
test.after(()=>new Promise(r=>server.close(r)));
const send=(url,body,method='POST')=>fetch(base+url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const product={nombre:'NUEVO',sku:'P002',id_proveedor:'s1',unidad_compra:'Caja',precio_compra:0,branchIds:['b1'],active:true};
test('catalog creates assigned product with zero price and rejects duplicate SKU',async()=>{
 assert.equal((await send('/insumos',product)).status,200);
 assert.equal((await send('/insumos',{...product,nombre:'OTRO'})).status,409);
});
test('catalog rejects unassigned products and nonexistent delivery destinations',async()=>{
 assert.equal((await send('/insumos',{...product,sku:'P003',nombre:'SIN SURTIDO',branchIds:[]})).status,400);
 assert.equal((await send('/proveedores',{nombre:'OTRO',nodo_entrega:'BODEGA',nodos_sucursal:{missing:'DIRECTO_TIENDA'}})).status,400);
});
test('catalog preserves dependencies and company scope of existing branch',async()=>{
 assert.equal((await send('/proveedores/s1',{},'DELETE')).status,400);
 assert.equal((await send('/sucursales/b1',{nombre:'TIENDA',id_empresa:'missing'},'PUT')).status,400);
 assert.equal(repo.dump().proveedores.s1.active,true);
});
