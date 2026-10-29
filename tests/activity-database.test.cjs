const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const root=path.resolve(__dirname,'..'),adminPath='qa-private-admin-route-32-characters';
const env={VERCEL:'1',LEGAL_ACTIVITY_DATABASE_URL:'postgres://isolated-qa-only/database',LEGAL_CONNECTION_SECRET:'isolated-test-encryption-key-at-least-32-characters',LEGAL_ADMIN_PATH:adminPath,LEGAL_IP_LOOKUP:'off'};
function loader(overrides={},extra={}){
 const cache=new Map();
 function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const exports={};cache.set(file,exports);
  vm.runInNewContext(output,{exports,require:id=>id==='server-only'?{}:overrides[id]||(id.startsWith('@/geo/')?require(path.join(root,'src/geo',id.slice(6))):id.startsWith('@/lib/')?load('src/lib/'+id.slice(6)+'.ts'):id.startsWith('./')?load(path.relative(root,path.resolve(path.dirname(file),id+'.ts'))):require(id)),process:{env:{...env,...extra},cwd:()=>root},Buffer,Uint8Array,Request,Response,Headers,URL,URLSearchParams,Date,AbortController,setTimeout,clearTimeout,console});return exports;
 }return load;
}
test('dedicated Postgres persists encrypted events, deduplicates IDs and paginates exact aggregates with zero Blob calls',async()=>{
 const directory=path.join(root,'data','qa-postgres-'+crypto.randomUUID());fs.mkdirSync(directory,{recursive:true});
 let db=new PGlite(directory);await db.exec(fs.readFileSync(path.join(root,'migrations/001-private-activity.sql'),'utf8'));
 let blobCalls=0;const forbidden=new Proxy({}, {get:()=>()=>{blobCalls++;throw Error('Unexpected Blob call')}});
 const load=loader({'@neondatabase/serverless':{neon:()=>({query:async(sql,args)=>(await db.query(sql,args)).rows})},'@vercel/blob':forbidden});
 const store=load('src/lib/activity-store.ts'),database=load('src/lib/activity-db.ts');
 const base={at:new Date().toISOString(),visitorId:crypto.randomUUID(),page:'/',ip:'203.0.113.11',country:'KR',city:'서울특별시',district:'광진구',location:'서울특별시 광진구',action:'visit',detail:'test-only private question'};
 try{
  const events=Array.from({length:121},(_,index)=>({...base,id:String(index).padStart(5,'0'),action:index%2?'query':'visit'}));
  await Promise.all(events.map(event=>store.appendActivity(event)));
  await store.appendActivity(events[0]);
  await store.appendActivity({...base,id:'other-site',site:'portfolio'});
  await store.appendActivity({...base,id:'map-event',site:'mapforyou',action:'view_step'});
  await store.appendActivity({...base,id:'scout-event',site:'scout',action:'query'});
  const first=await store.readActivityReport(1,'law');assert.equal(first.total,121);assert.equal(first.visits,61);assert.equal(first.queries,60);assert.equal(first.uniqueIps,1);assert.equal(first.visitors,1);assert.equal(first.events.length,50);assert(first.nextCursor);assert.equal(first.regions[0].district,'광진구');
  const second=await store.readActivityReport(1,'law',database.decodeActivityCursor(first.nextCursor));
  const third=await store.readActivityReport(1,'law',database.decodeActivityCursor(second.nextCursor));
  assert.equal(new Set([...first.events,...second.events,...third.events].map(e=>e.id)).size,121);assert.equal(third.events.length,21);assert.equal(third.nextCursor,null);
  assert.equal((await store.readActivityReport(7,'portfolio')).total,1);assert.equal((await store.readActivityReport(30,'scout')).queries,1);assert.equal((await store.readActivityReport(7,'mapforyou')).views,1);
  const stored=(await db.query('SELECT * FROM law_activity.events')).rows;assert(!JSON.stringify(stored).includes(base.detail));assert(!JSON.stringify(stored).includes(base.ip));assert(!JSON.stringify(stored).includes(base.visitorId));
  await store.saveVerifiedDistrict(base.ip,'광진구');assert.equal(await store.readVerifiedDistrict(base.ip),'광진구');
  await store.saveIpLocation(base.ip,base);assert.equal((await store.readIpLocation(base.ip)).district,'광진구');
  for(let i=0;i<5;i++)assert.equal(await store.claimAdminAttempt('login-qa'),true);assert.equal(await store.claimAdminAttempt('login-qa'),false);
  const ingest=load('src/lib/activity-ingest.ts');const id=crypto.randomUUID();
  const send=body=>ingest.ingestActivity(new Request('https://qa.example/api/activity',{method:'POST',headers:{'content-type':'application/json'},body}),'law');
  assert.equal((await send('{bad')).status,400);assert.equal((await send(JSON.stringify({action:'invalid'}))).status,400);
  assert.equal((await send(JSON.stringify({action:'visit',id:'invalid'}))).status,400);assert.equal((await send('x'.repeat(2001))).status,413);
  assert.equal((await send(JSON.stringify({action:'query',id,detail:'isolated-ingest-question'}))).status,204);
  assert.equal((await send(JSON.stringify({action:'query',id,detail:'isolated-ingest-question'}))).status,204);
  assert.equal((await db.query('SELECT count(*)::int n FROM law_activity.events WHERE id=$1',[id])).rows[0].n,1);
  assert.equal(blobCalls,0);
  await db.close();db=new PGlite(directory);assert.equal((await store.readActivityReport(1,'law')).total,122);
  assert.throws(()=>database.decodeActivityCursor('bad'),/Invalid cursor/);
 }finally{await db.close()}
});
test('archive preflights byte limits, bounds downloads, caches immutable records and never writes',async()=>{
 let gets=0,lists=0,writes=0,size=100;let cipher;
 const event={id:'old',at:new Date().toISOString(),ip:'203.0.113.8',site:'law',action:'visit',country:'KR',city:'',district:'',location:'',detail:'preserved historical question'};
 const blob={list:async({limit})=>{lists++;assert(limit<=20);return {blobs:[{pathname:'activity/overflow/2026-10-28/old.enc',size}],hasMore:false}},get:async()=>{gets++;return {statusCode:200,stream:new Response(cipher.encryptActivity({events:[event]})).body}},put:async()=>{writes++;throw Error('Archive must be read-only')}};
 const load=loader({'@vercel/blob':blob});cipher=load('src/lib/activity-crypto.ts');const archive=load('src/lib/activity-archive.ts');
 const cursor=Buffer.from(JSON.stringify({phase:'overflow'})).toString('base64url');
 const first=await archive.readActivityArchive('2026-10-28','law',cursor);assert.equal(first.events[0].detail,event.detail);assert.equal(first.statisticsScope,'page');
 await archive.readActivityArchive('2026-10-28','law',cursor);assert.equal(gets,1);assert.equal(writes,0);
 size=1024*1024+1;await assert.rejects(archive.readActivityArchive('2026-10-27','law',cursor),/budget/);assert.equal(gets,1);
 assert.throws(()=>archive.validateArchiveRequest('2026-02-31',null));assert.throws(()=>archive.validateArchiveRequest('2026-10-28','invalid'));
 const route=load('src/app/[adminPath]/events/route.ts'),{NextRequest}=require('next/server');
 const before=lists;const response=await route.GET(new NextRequest('https://qa.example/'+adminPath+'/events?source=archive&date=2026-10-28'),{params:Promise.resolve({adminPath})});
 assert.equal(response.status,401);assert.equal(lists,before);assert.match(response.headers.get('cache-control'),/no-store/);
});
