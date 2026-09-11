const test = require('node:test');
const assert = require('node:assert/strict');
const memory = require('./memoryRepository');
const {createUsers} = require('../domain/users');
const admin = {uid:'admin',role:'Administrador'};
const body = {name:'Encargada',email:'tienda@example.test',password:'UnaClave123!',role:'Tienda',companyIds:['c1'],branchIds:['b1'],active:true};
function setup() {
 const repo=memory({empresas:{c1:{active:true},c2:{active:true}},sucursales:{b1:{id_empresa:'c1',active:true},b2:{id_empresa:'c2',active:true}}});
 const accounts=new Map(); let failEnable=false;
 const auth={
  async createUser(data){if([...accounts.values()].some(a=>a.email===data.email))throw Object.assign(Error(),{code:'auth/email-already-exists'});accounts.set(data.uid,{...data});return {...data};},
  async getUser(id){if(!accounts.has(id))throw Error('missing');return {...accounts.get(id)};},
  async updateUser(id,data){if(failEnable)throw Error('temporary auth outage');Object.assign(accounts.get(id),data);},
  async revokeRefreshTokens(id){accounts.get(id).revoked=true;}
 };
 return {repo,accounts,service:createUsers(repo,auth),failEnable(value){failEnable=value;}};
}
test('create and retry produce one account and one audit event, without password in storage',async()=>{
 const {repo,accounts,service}=setup();
 const first=await service.create(admin,body,'12345678-1234-1234-1234-123456789abc');
 const second=await service.create(admin,body,'12345678-1234-1234-1234-123456789abc');
 assert.equal(first.id,second.id);assert.equal(accounts.size,1);
 assert.equal(Object.keys(repo.dump().auditEvents).length,1);
 assert.equal(JSON.stringify(repo.dump()).includes(body.password),false);
 assert.equal(repo.dump().users[first.id].active,true);
});
test('cross-company scopes and non-admin account creation are rejected before Auth',async()=>{
 const {accounts,service}=setup();
 await assert.rejects(service.create(admin,{...body,branchIds:['b2']},'12345678-1234-1234-1234-123456789abc'),/sucursal/);
 await assert.rejects(service.create({uid:'store',role:'Tienda'},body,'12345678-1234-1234-1234-123456789abc'));
 assert.equal(accounts.size,0);
});
test('failed provisioning keeps API profile inactive and supports retry',async()=>{
 const x=setup();x.failEnable(true);
 await assert.rejects(x.service.create(admin,body,'12345678-1234-1234-1234-123456789abc'));
 assert.equal(Object.values(x.repo.dump().users)[0].active,false);
 assert.equal([...x.accounts.values()][0].disabled,true);
 x.failEnable(false);
 const result=await x.service.create(admin,body,'12345678-1234-1234-1234-123456789abc');
 assert.equal(result.active,true);assert.equal(result.provisioning,false);
});
test('disabling revokes sessions, preserves audit and prevents self access editing',async()=>{
 const {service,repo,accounts}=setup();
 const created=await service.create(admin,body,'12345678-1234-1234-1234-123456789abc');
 await service.update(admin,created.id,{...body,active:false});
 assert.equal(repo.dump().users[created.id].active,false);
 assert.equal(accounts.get(created.id).disabled,true);assert.equal(accounts.get(created.id).revoked,true);
 assert.equal(Object.keys(repo.dump().auditEvents).length,2);
 await assert.rejects(service.update(admin,'admin',body),/propio acceso/);
});
