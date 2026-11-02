const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
function client(statuses=[204],options={}){
 const sent=[],timers=[],stored=new Map([['law-visitor-v1',options.saved||'broken-old-id']]),warnings=[];
 const exports={},window={location:{pathname:options.pathname||'/',search:options.search||''}};
 const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/activity-client.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,window,crypto:options.fallback?{getRandomValues:crypto.getRandomValues.bind(crypto)}:crypto,Uint8Array,AbortController,URLSearchParams,console:{warn:m=>warnings.push(m)},
  localStorage:{getItem:k=>{if(options.storageBlocked)throw Error();return stored.get(k)},setItem:(k,v)=>stored.set(k,v)},
  setTimeout:(fn,ms)=>{if(ms<10000)timers.push(fn);return fn},clearTimeout:()=>{},
  fetch:async(url,request)=>{sent.push({url,...request});const status=statuses[Math.min(sent.length-1,statuses.length-1)];if(status==='offline')throw Error();return {ok:status>=200&&status<300,status}}
 });
 return {...exports,sent,timers,stored,warnings};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('LAW retries transient failures with one event ID and stops after three attempts',async()=>{
 const c=client(['offline',503,204]);c.recordActivity('visit');
 await flush();c.timers.shift()();await flush();c.timers.shift()();await flush();
 assert.equal(c.sent.length,3);assert.equal(new Set(c.sent.map(r=>r.body)).size,1);assert.equal(c.warnings.length,0);
 const fail=client([503]);fail.recordActivity('visit');for(let i=0;i<3;i++){await flush();fail.timers.shift()?.()}
 assert.equal(fail.sent.length,3);assert.equal(fail.warnings.length,1);assert.equal(fail.timers.length,0);
});
test('LAW does not retry rejected or throttled events or log question contents',async()=>{
 for(const status of [400,403,429]){const c=client([status]);c.recordActivity('query','private question');await flush();assert.equal(c.sent.length,1);assert.equal(c.timers.length,0);assert(!c.warnings.join('').includes('private question'))}
});
test('LAW repairs invalid IDs, supports blocked storage and older UUID APIs, and excludes admin/showcases',async()=>{
 for(const options of [{},{storageBlocked:true},{fallback:true}]){const c=client([204],options);c.recordActivity('visit');c.recordActivity('settings');await flush();const events=c.sent.map(r=>JSON.parse(r.body));assert.match(events[0].visitorId,/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i);assert.equal(events[0].visitorId,events[1].visitorId);assert.notEqual(events[0].id,events[1].id);assert.equal(c.stored.size,1)}
 for(const options of [{pathname:'/inspect-private'},{search:'?showcase=1'}]){const c=client([204],options);c.recordActivity('visit');assert.equal(c.sent.length,0)}
});
test('LAW records a visit when entering home from the admin route without duplicate strict effects',()=>{
 let pathname='/inspect-private',ref={current:''},effects=[],last=[],visits=0;
 const exports={},source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/features/workspace/activity-recorder.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(source,{exports,require:id=>id==='react'?{useRef:()=>ref,useEffect:(fn,deps)=>effects.push({fn,deps})}:id==='next/navigation'?{usePathname:()=>pathname}:{recordActivity:()=>visits++},document:{addEventListener:()=>{},removeEventListener:()=>{}}});
 const render=()=>{effects=[];exports.ActivityRecorder();effects.forEach(({fn,deps},i)=>{if(!last[i]||deps.some((v,j)=>v!==last[i][j]))fn();last[i]=deps})};
 render();assert.equal(visits,0);pathname='/';render();assert.equal(visits,1);effects[0].fn();assert.equal(visits,1);pathname='/inspect-private';render();pathname='/';render();assert.equal(visits,2);
});
