const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/features/private-activity/console.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function mount(overrides={},status=200){
 let stateIndex=0,now=10000,requests=0;const effects=[],intervals=new Set(),listeners={},changes=[],sent=[],exports={};
 const document={visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]},navigator={onLine:true};
 const window={location:{pathname:'/qa-admin',search:''},history:{replaceState:()=>{}},setInterval:fn=>{intervals.add(fn);return fn},clearInterval:fn=>intervals.delete(fn),addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 const sites=Object.fromEntries(['portfolio','scout','law','mapforyou'].map(key=>[key,{label:key,host:key,url:'https://example.invalid'}]));
 const react={useState:value=>{const index=stateIndex++;return [Object.hasOwn(overrides,index)?overrides[index]:value,next=>changes.push({index,next})]},useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:fn=>effects.push(fn)};
 class Clock extends Date{static now(){return now}}
 const helper={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/activity-refresh.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:helper,window,document,navigator,Date:Clock});
 vm.runInNewContext(source,{exports,require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx:()=>null,jsxs:()=>null}:id==='lucide-react'?{}:id.includes('activity-refresh')?helper:id.includes('activity-types')?{ACTIVITY_SITES:sites,ACTIVITY_LABELS:{visit:'visit'}}:id.includes('activity-view')?{activityViewQuery:()=>new URLSearchParams(),activityMatches:()=>true}: {},window,document,Date:Clock,Intl,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async(url,request)=>{const currentStatus=Array.isArray(status)?status[Math.min(requests,status.length-1)]:status;requests++;sent.push(request);return {status:currentStatus,ok:currentStatus===200,headers:new Headers({'Retry-After':'60','ETag':'"qa-report"','X-Activity-Checked-At':new Date(now).toISOString()}),json:async()=>{assert.notEqual(currentStatus,304,'an unchanged response has no JSON body');return {site:'portfolio',days:1,events:[{id:'preserved-record'}],generatedAt:new Date(now).toISOString(),error:'test failure'}}}}});
 exports.PrivateActivityConsole({initiallyAuthenticated:true,initialView:{site:'portfolio',days:1,action:'all',newest:true,location:'all',source:'database',date:''},archiveAvailable:false});
 const cleanups=effects.map(fn=>fn());
 return {intervals,listeners,document,navigator,changes,sent,requests:()=>requests,advance:ms=>now+=ms,tick:()=>intervals.forEach(fn=>fn()),cleanup:()=>cleanups.forEach(fn=>fn?.())};
}
test('live console refreshes while visible, refreshes on return, and cancels its timer on unmount',async()=>{
 const c=mount();await flush();assert.equal(c.requests(),1);assert.equal(c.intervals.size,1);
 c.advance(30000);c.tick();await flush();assert.equal(c.requests(),2);
 c.document.visibilityState='hidden';c.advance(30000);c.tick();await flush();assert.equal(c.requests(),2);
 c.document.visibilityState='visible';c.listeners.visibilitychange();await flush();assert.equal(c.requests(),3);
 c.cleanup();assert.equal(c.intervals.size,0);assert.equal(c.listeners.focus,undefined);assert.equal(c.listeners.online,undefined);
});
test('unchanged reports send a conditional request, preserve records and update the checked time',async()=>{
 const c=mount({},[200,304]);await flush();c.advance(30000);c.tick();await flush();
 assert.equal(c.sent[1].headers['If-None-Match'],'"qa-report"');
 const report=c.changes.filter(change=>change.index===4).at(-1).next;
 assert.equal(report.events[0].id,'preserved-record');assert.equal(report.generatedAt,new Date(40000).toISOString());c.cleanup();
});
test('five minutes without interaction stops polling, and returning online or interacting resumes it',async()=>{
 const c=mount();await flush();
 for(let i=0;i<9;i++){c.advance(30000);c.tick();await flush()}
 assert.equal(c.requests(),10);c.advance(30000);c.tick();await flush();assert.equal(c.requests(),10);
 c.advance(30000);c.tick();await flush();assert.equal(c.requests(),10);
 c.listeners.pointermove();await flush();assert.equal(c.requests(),11);
 c.navigator.onLine=false;c.advance(30000);c.tick();await flush();assert.equal(c.requests(),11);
 c.navigator.onLine=true;c.listeners.online();await flush();assert.equal(c.requests(),12);c.cleanup();
});
test('archive, older pages, oldest-first, disabled refresh and signed-out views never poll',async()=>{
 for(const overrides of [{12:'archive'},{14:['older-cursor']},{9:false},{17:false},{0:false}]){const c=mount(overrides);await flush();assert.equal(c.intervals.size,0);c.cleanup()}
});
test('rate limiting backs automatic refresh off, and an expired session returns to signed-out state',async()=>{
 const c=mount({},429);await flush();c.advance(5000);c.tick();await flush();assert.equal(c.requests(),1);c.cleanup();
 const expired=mount({},401);await flush();assert(expired.changes.some(change=>change.index===0&&change.next===false));expired.cleanup();
});
