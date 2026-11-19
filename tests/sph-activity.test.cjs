const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const env={VERCEL:'1',LEGAL_ACTIVITY_DATABASE_URL:'postgres://isolated-qa-only/database',LEGAL_CONNECTION_SECRET:'sph-minimal-test-only-encryption-key-over-32-characters',LEGAL_ADMIN_PATH:'sph-qa-private-admin-route-32-characters'};
function loader(overrides={}){
 const cache=new Map();
 function load(file){
  file=path.resolve(root,file);if(cache.has(file))return cache.get(file);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const exports={};cache.set(file,exports);
  vm.runInNewContext(output,{exports,require:id=>id==='server-only'?{}:overrides[id]||(id.startsWith('@/geo/')?require(path.join(root,'src/geo',id.slice(6))):id.startsWith('@/lib/')?load('src/lib/'+id.slice(6)+'.ts'):id.startsWith('./')?load(path.relative(root,path.resolve(path.dirname(file),id+'.ts'))):require(id)),process:{env,cwd:()=>root},Buffer,Uint8Array,Request,Response,Headers,URL,URLSearchParams,Date,AbortController,setTimeout,clearTimeout,console});return exports;
 }return load;
}
test('SPH encrypts visitor IP and fixed-label events without Blob calls',async()=>{
 const db=new PGlite();await db.exec(fs.readFileSync(path.join(root,'migrations/001-private-activity.sql'),'utf8'));
 let blobCalls=0,dbQueries=0;
 const load=loader({'@neondatabase/serverless':{neon:()=>({query:async(sql,args)=>{dbQueries++;return (await db.query(sql,args)).rows}})},'@vercel/blob':new Proxy({}, {get(){blobCalls++;throw Error('Blob is prohibited')}})});
 const route=load('src/app/api/sph-activity/route.ts'),store=load('src/lib/activity-store.ts'),cipher=load('src/lib/activity-crypto.ts');
 const origin='https://sph-opportunity-agent.vercel.app';
 const item={id:crypto.randomUUID(),visitorId:crypto.randomUUID(),action:'click',detail:'공공 입찰',search:'SHOULD_NEVER_SAVE'};
 const post=(o,events)=>route.POST(new Request('https://law-lake-theta.vercel.app/api/sph-activity',{method:'POST',headers:{origin:o,'Content-Type':'application/json','x-vercel-forwarded-for':'203.0.113.44'},body:JSON.stringify({events})}));
 try{
  assert.equal((await route.OPTIONS(new Request('https://example.com',{headers:{origin}}))).status,204);
  assert.equal((await route.OPTIONS(new Request('https://example.com',{headers:{origin:'https://other.example'}}))).status,403);
  assert.equal((await post('https://other.example',[item])).status,403);
  assert.equal((await post(origin,[{...item,detail:'private email content'}])).status,400);
  assert.equal((await post(origin,[item])).status,204);
  assert.equal((await post(origin,[item])).status,204);
  const rows=(await db.query('SELECT * FROM law_activity.events')).rows;
  assert.equal(rows.length,1);
  assert.equal(rows[0].site,'sph');assert.equal(rows[0].action,'click');
  assert.equal(blobCalls,0);
  assert.equal(dbQueries,4); // one rate-limit check and one batch write per accepted request
  assert(!JSON.stringify(rows).includes('SHOULD_NEVER_SAVE'));
  assert(!JSON.stringify(rows).includes('203.0.113.44'));
  const saved=cipher.decryptActivity(rows[0].payload);
  assert.equal(saved.ip,'203.0.113.44');assert.equal(saved.ipVersion,'IPv4');assert.equal(saved.detail,'공공 입찰');assert.equal(saved.page,'/');
  assert.equal(saved.search,undefined);assert.equal(saved.country,'');
  const report=await store.readActivityReport(1,'sph');
  assert.equal(report.total,1);assert.equal(report.clicks,1);assert.equal(report.uniqueIps,1);
  assert.equal(report.events[0].ip,'203.0.113.44');
 }finally{await db.close()}
});
