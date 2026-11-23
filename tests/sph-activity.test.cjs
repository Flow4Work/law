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
test('registered owner IP is consistently labeled without changing stored events',()=>{
 const {OWNER_IP,activityDeviceLabel}=loader()('src/lib/activity-view.ts');
 assert.equal(OWNER_IP,'14.40.72.231');
 assert.equal(activityDeviceLabel(OWNER_IP),'내 IP');
 assert.equal(activityDeviceLabel('175.193.2.26'),'내 PC');
 assert.equal(activityDeviceLabel('211.234.207.181'),'내 핸드폰');
 assert.equal(activityDeviceLabel('203.0.113.44'),'');
});
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

test('guide records timestamped encrypted IP, submitted text and button actions, deduplicates retries, no Blob',async()=>{
 const {NextRequest}=require('next/server');
 const db=new PGlite();
 await db.exec(fs.readFileSync(path.join(root,'migrations/001-private-activity.sql'),'utf8'));
 let blobCalls=0;
 const load=loader({'@neondatabase/serverless':{neon:()=>({query:async(sql,args)=>(await db.query(sql,args)).rows})},'@vercel/blob':new Proxy({}, {get(){blobCalls++;throw Error('Blob prohibited')}})});
 const intake=load('src/app/api/sph-guide-activity/route.ts');
 const reports=load('src/app/[adminPath]/guide-events/route.ts');
 const cipher=load('src/lib/activity-crypto.ts');
 const origin='https://sph-field-guide-six.vercel.app';
 const visitorId=crypto.randomUUID();
 const events=['visit','service','example','query','click'].map(action=>({id:crypto.randomUUID(),visitorId,action,at:new Date().toISOString(),detail:action==='query'?'보고서 문의 test@example.com':action==='click'?'시각화 탭':'Google Maps'}));
 const post=(items,source=origin)=>intake.POST(new Request('https://law-lake-theta.vercel.app/api/sph-guide-activity',{
  method:'POST',headers:{origin:source,'x-vercel-forwarded-for':'203.0.113.44'},body:JSON.stringify({events:items})
 }));
 const reportUrl='https://law-lake-theta.vercel.app/'+env.LEGAL_ADMIN_PATH+'/guide-events?days=7';
 const context={params:Promise.resolve({adminPath:env.LEGAL_ADMIN_PATH})};
 try{
  assert.equal((await post(events,'https://unrelated.example')).status,403);
  assert.equal((await post([{...events[0],question:'private text'}])).status,400);
  assert.equal((await post(events)).status,204);
  assert.equal((await post(events)).status,204);
  // The deployed SPH sends only id/action; the admin receiver must enrich it without changing SPH.
  const sparse={id:crypto.randomUUID(),action:'query'};
  assert.equal((await post([sparse])).status,204);
  assert.equal((await post([sparse])).status,204);
  const stored=(await db.query("SELECT ip_key, visitor_key, payload FROM law_activity.events WHERE site='sph-guide'")).rows;
  assert.equal(stored.length,6);
  assert(stored.every(row=>row.ip_key!==''&&row.visitor_key!==''&&row.payload!==''));
  assert(!JSON.stringify(stored).includes('203.0.113.44'));
  assert(!JSON.stringify(stored).includes('보고서 문의'));
  assert.equal(blobCalls,0);
  assert.equal((await reports.GET(new NextRequest(reportUrl),context)).status,401);
  const signedIn=new NextRequest(reportUrl,{headers:{cookie:cipher.ADMIN_COOKIE+'='+cipher.createAdminSession()}});
  const result=await reports.GET(signedIn,context);
  assert.equal(result.status,200);
  const {rows,events:recorded}=await result.json();
  assert.equal(rows.length,1);
  const {date,...counts}=rows[0];
  assert.match(date,/^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(counts,{visit:1,service:1,example:1,query:2,click:1});
  assert.equal(recorded.length,6);
  const sparseRecord=recorded.find(item=>item.id===sparse.id);
  assert.equal(sparseRecord.ip,'203.0.113.44');
  assert.equal(sparseRecord.detail,'');
  assert(Number.isFinite(Date.parse(sparseRecord.at)));
  assert(recorded.every(item=>item.ip==='203.0.113.44'&&Number.isFinite(Date.parse(item.at))));
  assert(recorded.some(item=>item.action==='click'&&item.detail==='시각화 탭'));
  assert(recorded.some(item=>item.action==='query'&&item.detail.includes('[이메일]')));
  assert.equal(blobCalls,0);
 }finally{await db.close()}
});
