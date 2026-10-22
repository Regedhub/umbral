import {randomBytes,randomUUID,scrypt as derive,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
const scrypt=promisify(derive),cost={N:131072,r:8,p:1,maxmem:192*1024*1024};
const digest=token=>createHash('sha256').update(token).digest('hex');
const validName=name=>typeof name==='string'&&/^[A-Za-z0-9_]{3,16}$/.test(name);
const validPassword=password=>typeof password==='string'&&password.length>=12&&password.length<=128;
export async function hashPassword(password){if(!validPassword(password))throw Error('Invalid password');const salt=randomBytes(16);const key=await scrypt(password,salt,32,cost);return ['scrypt',cost.N,cost.r,cost.p,salt.toString('hex'),key.toString('hex')].join('$');}
export async function verifyPassword(password,encoded){if(!validPassword(password)||typeof encoded!=='string')return false;const a=encoded.split('$');if(a.length!==6||a[0]!=='scrypt'||+a[1]!==cost.N||+a[2]!==8||+a[3]!==1||!/^[a-f0-9]{32}$/.test(a[4])||!/^[a-f0-9]{64}$/.test(a[5]))return false;const key=await scrypt(password,Buffer.from(a[4],'hex'),32,cost);return timingSafeEqual(key,Buffer.from(a[5],'hex'));}
function profile(user){return {id:user.id,username:user.username,role:user.role,mustChangePassword:!!user.must_change_password,disabled:!!user.disabled};}
export class PostgresAccounts {
 constructor(pool){this.pool=pool;}
 async init(seed){const client=await this.pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(9017055)');await client.query(`CREATE TABLE IF NOT EXISTS umbral_users(id uuid PRIMARY KEY,username varchar(16) NOT NULL,username_key varchar(16) UNIQUE NOT NULL,password_hash text NOT NULL,role varchar(8) NOT NULL CHECK(role IN ('player','admin')),disabled boolean NOT NULL DEFAULT false,must_change_password boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());CREATE TABLE IF NOT EXISTS umbral_sessions(token_hash char(64) PRIMARY KEY,user_id uuid NOT NULL REFERENCES umbral_users(id) ON DELETE CASCADE,expires_at timestamptz NOT NULL);CREATE INDEX IF NOT EXISTS umbral_sessions_user ON umbral_sessions(user_id);`);const old=await client.query('SELECT role FROM umbral_users WHERE username_key=$1',[seed.username.toLowerCase()]);if(old.rows.length&&old.rows[0].role!=='admin')throw Error('Reserved owner name conflict');await client.query("INSERT INTO umbral_users(id,username,username_key,password_hash,role,must_change_password) VALUES($1,$2,$3,$4,'admin',true) ON CONFLICT(username_key) DO NOTHING",[seed.id,seed.username,seed.username.toLowerCase(),seed.passwordHash]);await client.query('DELETE FROM umbral_sessions WHERE expires_at<=now()');await client.query('COMMIT');}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}}
 async user(name){return (await this.pool.query('SELECT * FROM umbral_users WHERE username_key=$1',[name.toLowerCase()])).rows[0];}
 async register(user){try{return (await this.pool.query("INSERT INTO umbral_users(id,username,username_key,password_hash,role) VALUES($1,$2,$3,$4,'player') RETURNING *",[user.id,user.username,user.username.toLowerCase(),user.password_hash])).rows[0];}catch(error){if(error.code==='23505')return null;throw error;}}
 async session(hash,id,expiry){await this.pool.query('DELETE FROM umbral_sessions WHERE expires_at<=now()');await this.pool.query('INSERT INTO umbral_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)',[hash,id,new Date(expiry)]);await this.pool.query('DELETE FROM umbral_sessions WHERE user_id=$1 AND token_hash NOT IN (SELECT token_hash FROM umbral_sessions WHERE user_id=$1 ORDER BY expires_at DESC LIMIT 5)',[id]);}
 async authenticate(hash,now){return (await this.pool.query('SELECT u.* FROM umbral_sessions s JOIN umbral_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>$2 AND NOT u.disabled',[hash,new Date(now)])).rows[0];}
 async logout(hash){await this.pool.query('DELETE FROM umbral_sessions WHERE token_hash=$1',[hash]);}
 async list(){return (await this.pool.query('SELECT id,username,role,disabled,must_change_password FROM umbral_users ORDER BY created_at LIMIT 100')).rows;}
 async status(id,disabled){return (await this.pool.query("UPDATE umbral_users SET disabled=$2 WHERE id=$1 AND role='player' RETURNING id",[id,disabled])).rowCount;}
 async revoke(id){await this.pool.query('DELETE FROM umbral_sessions WHERE user_id=$1',[id]);}
 async password(id,encoded){await this.pool.query('UPDATE umbral_users SET password_hash=$2,must_change_password=false WHERE id=$1',[id,encoded]);await this.revoke(id);}
}
export function createAccountApi(store,{now=Date.now}={}){
 const limits=new Map();let hashing=false;
 const reply=(status,error,extra={})=>({status,json:{ok:status<400,error,...extra}});
 async function expensive(action){if(hashing)return reply(429,'El servidor está ocupado. Intenta de nuevo en unos segundos.');hashing=true;try{return await action();}finally{hashing=false;}}
 return async function dispatch({method,path,body={},token='',ip='unknown'}){
  if(path==='/accounts/status'&&method==='GET')return reply(200,'',{enabled:true});
  const current=now();if(limits.size>4096)for(const [key,value]of limits)if(value.until<current)limits.delete(key);
  let entry=limits.get(ip);if(!entry||entry.until<current){if(limits.size>=4096&&!limits.has(ip))return reply(429,'El servidor está ocupado. Intenta más tarde.');entry={until:current+60000,count:0,posts:0};limits.set(ip,entry);}entry.count++;if(method==='POST')entry.posts++;if(entry.count>80||entry.posts>20)return reply(429,'Demasiados intentos. Espera un minuto.');
  if(!body||Array.isArray(body)||typeof body!=='object')return reply(400,'Solicitud inválida.');
  if(path==='/accounts/register'&&method==='POST'){
   if(!validName(body.username)||!validPassword(body.password))return reply(400,'Nombre: 3–16 letras, números o _. Contraseña: 12–128 caracteres.');
   return expensive(async()=>{const password_hash=await hashPassword(body.password);const user=await store.register({id:randomUUID(),username:body.username,password_hash});return user?reply(201,'',{user:profile(user)}):reply(409,'Ese nombre no está disponible.');});
  }
  if(path==='/accounts/login'&&method==='POST'){
   if(!validName(body.username)||!validPassword(body.password))return reply(401,'Nombre o contraseña incorrectos.');
   return expensive(async()=>{const user=await store.user(body.username);if(!user){await hashPassword(body.password);return reply(401,'Nombre o contraseña incorrectos.');}const valid=await verifyPassword(body.password,user.password_hash);if(!valid||user.disabled)return reply(401,'Nombre o contraseña incorrectos.');const secret=randomBytes(32).toString('base64url');await store.session(digest(secret),user.id,current+86400000);return reply(200,'',{token:secret,user:profile(user)});});
  }
  if(!/^[A-Za-z0-9_-]{43}$/.test(token))return reply(401,'Inicia sesión.');
  const user=await store.authenticate(digest(token),current);if(!user)return reply(401,'Tu sesión ha terminado. Inicia sesión otra vez.');
  if(path==='/accounts/me'&&method==='GET')return reply(200,'',{user:profile(user)});
  if(path==='/accounts/logout'&&method==='POST'){await store.logout(digest(token));return reply(200,'');}
  if(path==='/accounts/password'&&method==='POST'){
   if(!validPassword(body.newPassword))return reply(400,'La contraseña nueva debe tener 12–128 caracteres.');
   return expensive(async()=>{if(!await verifyPassword(body.password,user.password_hash))return reply(401,'La contraseña actual no es correcta.');await store.password(user.id,await hashPassword(body.newPassword));return reply(200,'',{signInAgain:true});});
  }
  if(!path.startsWith('/accounts/admin/'))return reply(404,'Ruta desconocida.');
  if(user.role!=='admin'||user.must_change_password)return reply(403,user.must_change_password?'Cambia primero tu contraseña de administrador.':'Solo el administrador puede usar esta función.');
  if(path==='/accounts/admin/users'&&method==='GET')return reply(200,'',{users:(await store.list()).map(profile)});
  if(path==='/accounts/admin/status'&&method==='POST'){
   if(typeof body.userId!=='string'||!/^[a-f0-9-]{36}$/.test(body.userId)||typeof body.disabled!=='boolean')return reply(400,'Selecciona una cuenta válida.');
   if(!await store.status(body.userId,body.disabled))return reply(400,'No se puede cambiar esa cuenta.');await store.revoke(body.userId);return reply(200,'');
  }
  return reply(404,'Ruta desconocida.');
 };
}
export function accountHttpHandler(){
 let dispatch,ready=false;
 const initialization=(async()=>{if(!process.env.DATABASE_URL)return;const seed=JSON.parse(await readFile(new URL('./owner-bootstrap.json',import.meta.url),'utf8'));if(!validName(seed.username)||seed.role!=='admin'||!/^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(seed.passwordHash||''))throw Error('Invalid owner bootstrap');const {Pool}=await import('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:8000});pool.on('error',()=>console.error('UMBRAL_ACCOUNTS_DATABASE_UNAVAILABLE'));const store=new PostgresAccounts(pool);await store.init(seed);dispatch=createAccountApi(store);ready=true;console.log('UMBRAL_ACCOUNTS_READY');})().catch(()=>console.error('UMBRAL_ACCOUNTS_SETUP_REQUIRED'));
 return {get ready(){return ready;},async handle(req,res){
  if(!req.url?.startsWith('/accounts/'))return false;
  const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
  try{await initialization;if(req.url==='/accounts/status'&&req.method==='GET'){send(200,{ok:true,enabled:ready,error:ready?'':'El registro todavía no está activado en este servidor.'});return true;}if(!ready){send(503,{ok:false,error:'El registro todavía no está activado en este servidor.'});return true;}let data='';for await(const chunk of req){data+=chunk.toString('utf8');if(Buffer.byteLength(data)>4096){send(413,{ok:false,error:'Solicitud demasiado grande.'});return true;}}let body={};try{if(data)body=JSON.parse(data);}catch{send(400,{ok:false,error:'Solicitud inválida.'});return true;}const authorization=req.headers.authorization||'';const result=await dispatch({method:req.method,path:req.url,body,token:authorization.startsWith('Bearer ')?authorization.slice(7):'',ip:req.socket.remoteAddress||'unknown'});send(result.status,result.json);}catch{send(503,{ok:false,error:'No se pudo acceder a las cuentas. Intenta más tarde.'});}return true;
 }};
}
