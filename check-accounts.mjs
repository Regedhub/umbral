import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createAccountApi,hashPassword,verifyPassword} from './accounts.mjs';
class MemoryStore {
 users=[];sessions=new Map();
 async user(name){return this.users.find(u=>u.username.toLowerCase()===name.toLowerCase());}
 async register(user){if(await this.user(user.username))return null;const u={...user,role:'player',disabled:false,must_change_password:false};this.users.push(u);return u;}
 async session(hash,id,expires){this.sessions.set(hash,{id,expires});}
 async authenticate(hash,now){const session=this.sessions.get(hash);if(!session||session.expires<=now)return;return this.users.find(u=>u.id===session.id&&!u.disabled);}
 async logout(hash){this.sessions.delete(hash);}
 async list(){return this.users;}
 async status(id,disabled){const u=this.users.find(u=>u.id===id&&u.role==='player');if(!u)return 0;u.disabled=disabled;return 1;}
 async revoke(id){for(const [hash,s]of this.sessions)if(s.id===id)this.sessions.delete(hash);}
 async password(id,encoded){const u=this.users.find(u=>u.id===id);u.password_hash=encoded;u.must_change_password=false;await this.revoke(id);}
}
const store=new MemoryStore();let time=1000;const api=createAccountApi(store,{now:()=>time});let callId=0;
const call=(path,body={},token='',method='POST')=>api({path,body,token,method,ip:'test-'+(++callId)});
const ownerPassword='TestOnly-Owner-Password-9017',playerPassword='TestOnly-Player-Password-9017';
store.users.push({id:randomUUID(),username:'UmbralAdmin',password_hash:await hashPassword(ownerPassword),role:'admin',disabled:false,must_change_password:true});
assert.equal(await verifyPassword(ownerPassword,store.users[0].password_hash),true);
assert.equal(await verifyPassword('Wrong-Test-Password-9017',store.users[0].password_hash),false);
assert.equal((await call('/accounts/register',{username:'Bad|Name',password:playerPassword})).status,400);
assert.equal((await call('/accounts/register',{username:'PlayerOne',password:'short'})).status,400);
let result=await call('/accounts/register',{username:'PlayerOne',password:playerPassword,role:'admin'});assert.equal(result.status,201);assert.equal(result.json.user.role,'player');assert.equal(JSON.stringify(result).includes('password_hash'),false);
assert.equal((await call('/accounts/register',{username:'playerone',password:playerPassword})).status,409);
assert.equal((await call('/accounts/register',{username:'umbraladmin',password:playerPassword})).status,409);
assert.equal((await call('/accounts/login',{username:'PlayerOne',password:'Incorrect-Password-9017'})).status,401);
const playerLogin=await call('/accounts/login',{username:'playerone',password:playerPassword});assert.equal(playerLogin.status,200);const playerToken=playerLogin.json.token;assert.equal(playerToken.length,43);assert.equal(store.sessions.has(playerToken),false);
assert.equal((await call('/accounts/admin/users',{},playerToken,'GET')).status,403);
assert.equal((await call('/accounts/admin/users',{},'f'.repeat(43),'GET')).status,401);
let ownerLogin=await call('/accounts/login',{username:'UmbralAdmin',password:ownerPassword});let ownerToken=ownerLogin.json.token;assert.equal((await call('/accounts/admin/users',{},ownerToken,'GET')).status,403);
const newOwnerPassword='TestOnly-Changed-Owner-Password-9017';assert.equal((await call('/accounts/password',{password:ownerPassword,newPassword:newOwnerPassword},ownerToken)).status,200);assert.equal((await call('/accounts/me',{},ownerToken,'GET')).status,401);
ownerLogin=await call('/accounts/login',{username:'UmbralAdmin',password:newOwnerPassword});ownerToken=ownerLogin.json.token;assert.equal((await call('/accounts/admin/users',{},ownerToken,'GET')).json.users.length,2);
assert.equal((await call('/accounts/admin/status',{userId:store.users[0].id,disabled:true},ownerToken)).status,400);
assert.equal((await call('/accounts/admin/status',{userId:store.users[1].id,disabled:true},playerToken)).status,403);
assert.equal((await call('/accounts/admin/status',{userId:store.users[1].id,disabled:true},ownerToken)).status,200);
assert.equal((await call('/accounts/me',{},playerToken,'GET')).status,401);
assert.equal((await call('/accounts/login',{username:'PlayerOne',password:playerPassword})).status,401);
assert.equal((await call('/accounts/admin/status',{userId:store.users[1].id,disabled:false},ownerToken)).status,200);
const fresh=await call('/accounts/login',{username:'PlayerOne',password:playerPassword});assert.equal(fresh.status,200);time+=86400001;assert.equal((await call('/accounts/me',{},fresh.json.token,'GET')).status,401);
const logout=await call('/accounts/login',{username:'PlayerOne',password:playerPassword});assert.equal((await call('/accounts/logout',{},logout.json.token)).status,200);assert.equal((await call('/accounts/me',{},logout.json.token,'GET')).status,401);
for(let i=0;i<20;i++)await api({method:'POST',path:'/accounts/login',body:{},ip:'rate-limit'});assert.equal((await api({method:'POST',path:'/accounts/login',body:{},ip:'rate-limit'})).status,429);
console.log('UMBRAL_ACCOUNTS_LOGIC_PASS: salted scrypt, role escalation rejected, reserved owner, initial password change, hashed expiring sessions, logout, suspension/revocation and rate limit; in-memory store only, no deployed database or HTTP listener');
