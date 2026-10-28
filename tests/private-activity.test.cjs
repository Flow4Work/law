const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const secret='test-only-private-activity-encryption-secret';
const adminPath='inspect-test-route-with-32-random-characters';
const testPassword='test-password-valid-only';
const salt='test-salt',hash='s1:'+salt+':'+crypto.scryptSync(testPassword,salt,64).toString('hex');
const env={VERCEL:'1',LEGAL_CONNECTION_SECRET:secret,LEGAL_ADMIN_PATH:adminPath,LEGAL_ADMIN_PASSWORD_HASH:hash};
function load(name,overrides={},extra={}){
 const source=fs.readFileSync(path.join(__dirname,'../src/lib',name+'.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};vm.runInNewContext(compiled,{exports,require:id=>id==='server-only'?{}:overrides[id]||require(id),process:{env:{...env,...extra},cwd:()=>'/test-workspace'},Buffer,Headers,Response,Date,setTimeout,console});return exports;
}
test('password-only admin authentication checks the hash and expires signed sessions',()=>{
 const api=load('activity-crypto');
 assert.equal(api.checkAdminPassword(testPassword),true);assert.equal(api.checkAdminPassword('bad'),false);assert.equal(api.checkAdminPassword(null),false);
 assert.equal(api.adminPathMatches(adminPath),true);assert.equal(api.adminPathMatches('admin'),false);
 const now=Date.now(),token=api.createAdminSession(now);
 assert.equal(api.verifyAdminSession(token,now+1000),true);assert.equal(api.verifyAdminSession(token,now+9*3600000),false);
 assert.equal(api.verifyAdminSession(token.slice(0,-6)+'forged',now),false);
 assert.equal(load('activity-crypto',{}, {LEGAL_CONNECTION_SECRET:'a-different-test-secret-at-least-32-characters'}).verifyAdminSession(token),false);
});
test('activity records are authenticated ciphertext and cannot be read with another key',()=>{
 const api=load('activity-crypto'),value={query:'test-only question',ip:'203.0.113.1'};
 const encrypted=api.encryptActivity(value);assert(!encrypted.includes(value.query));assert(!encrypted.includes(value.ip));
 assert.equal(api.decryptActivity(encrypted).query,value.query);
 assert.throws(()=>api.decryptActivity(encrypted.slice(0,-8)+'tampered'));
 assert.throws(()=>load('activity-crypto',{}, {LEGAL_CONNECTION_SECRET:'a-different-test-secret-at-least-32-characters'}).decryptActivity(encrypted));
});
test('IP geolocation uses supplied city data and never invents a Seoul district',()=>{
 const {activityLocation}=load('activity-location');
 const header=new Headers({'x-vercel-forwarded-for':'203.0.113.1','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul'});
 let value=activityLocation(header);assert.equal(value.city,'서울특별시');assert.equal(value.district,'');
 header.set('x-vercel-ip-city','Gangnam-gu');value=activityLocation(header);assert.equal(value.location,'서울특별시 강남구');
 header.set('x-vercel-ip-city',encodeURIComponent('성동구'));assert.equal(activityLocation(header).district,'성동구');
 header.set('x-vercel-ip-country-region','26');header.set('x-vercel-ip-city','Jung-gu');assert.equal(activityLocation(header).district,'');
 assert.equal(activityLocation(new Headers()).location,'지역 확인 불가');
});
function fakeStore(){
 const entries=new Map();let revision=0;
 class Conflict extends Error{}
 return {entries,api:{BlobPreconditionFailedError:Conflict,BlobNotFoundError:class extends Error{},get:async key=>{
  const entry=entries.get(key);if(!entry)return null;
  return {statusCode:200,blob:{etag:entry.etag},stream:new Response(entry.body).body};
 },put:async(key,body,options)=>{
  assert.equal(options.access,'private');const old=entries.get(key);
  if(options.ifMatch&&options.ifMatch!==old?.etag)throw new Conflict('precondition');
  if(!options.ifMatch&&options.allowOverwrite===false&&old)throw new Error('already exists');
  entries.set(key,{body,etag:String(++revision)});return {};
 }}};
}
test('parallel serverless writers preserve all events; reports and rate limits share durable storage',async()=>{
 const store=fakeStore(),cipher=load('activity-crypto');
 const modules={'@vercel/blob':store.api,'./activity-crypto':cipher,'node:fs/promises':new Proxy({}, {get:()=>()=>{throw Error('Unexpected filesystem access')}})};
 const first=load('activity-store',modules),second=load('activity-store',modules);
 await Promise.all(Array.from({length:20},(_,i)=>(i%2?first:second).appendActivity({id:String(i),at:new Date().toISOString(),ip:'203.0.113.'+(i%2+1),action:i%2?'query':'visit',detail:'safe test question',city:'',district:'',country:'',location:'지역 확인 불가'})));
 const report=await first.readActivityReport(1);assert.equal(report.total,20);assert.equal(report.visits,10);assert.equal(report.queries,10);assert.equal(report.uniqueIps,2);
 assert(![...store.entries.values()].some(value=>value.body.includes('safe test question')));
 for(let i=0;i<5;i++)assert.equal(await (i%2?first:second).claimAdminAttempt('203.0.113.99'),true);
 assert.equal(await first.claimAdminAttempt('203.0.113.99'),false);
});
