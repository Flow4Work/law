const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/features/private-activity/console.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function mount(overrides={},status=200){
 let stateIndex=0,now=10000,requests=0;const effects=[],intervals=new Set(),listeners={},changes=[],exports={};
 const document={visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 const window={location:{pathname:'/qa-admin',search:''},history:{replaceState:()=>{}},setInterval:fn=>{intervals.add(fn);return fn},clearInterval:fn=>intervals.delete(fn),addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 const sites=Object.fromEntries(['portfolio','scout','law','mapforyou'].map(key=>[key,{label:key,host:key,url:'https://example.invalid'}]));
 const react={useState:value=>{const index=stateIndex++;return [Object.hasOwn(overrides,index)?overrides[index]:value,next=>changes.push({index,next})]},useRef:value=>({current:value}),useCallback:fn=>fn,useEffect:fn=>effects.push(fn)};
 class Clock extends Date{static now(){return now}}
 vm.runInNewContext(source,{exports,require:id=>id==='react'?react:id==='react/jsx-runtime'?{jsx:()=>null,jsxs:()=>null}:id==='lucide-react'?{}:id.includes('activity-types')?{ACTIVITY_SITES:sites,ACTIVITY_LABELS:{visit:'visit'}}:id.includes('activity-view')?{activityViewQuery:()=>new URLSearchParams(),activityMatches:()=>true}: {},window,document,Date:Clock,Intl,URLSearchParams,AbortController,setTimeout,clearTimeout,fetch:async()=>{requests++;return {status,ok:status===200,headers:new Headers({'Retry-After':'60'}),json:async()=>({site:'portfolio',days:1,events:[],error:'test failure'})}}});
 exports.PrivateActivityConsole({initiallyAuthenticated:true,initialView:{site:'portfolio',days:1,action:'all',newest:true,location:'all',source:'database',date:''},archiveAvailable:false});
 const cleanups=effects.map(fn=>fn());
 return {intervals,listeners,document,changes,requests:()=>requests,advance:ms=>now+=ms,tick:()=>intervals.forEach(fn=>fn()),cleanup:()=>cleanups.forEach(fn=>fn?.())};
}
test('live console refreshes while visible, refreshes on return, and cancels its timer on unmount',async()=>{
 const c=mount();await flush();assert.equal(c.requests(),1);assert.equal(c.intervals.size,1);
 c.advance(5000);c.tick();await flush();assert.equal(c.requests(),2);
 c.document.visibilityState='hidden';c.advance(5000);c.tick();await flush();assert.equal(c.requests(),2);
 c.document.visibilityState='visible';c.listeners.visibilitychange();await flush();assert.equal(c.requests(),3);
 c.cleanup();assert.equal(c.intervals.size,0);assert.equal(c.listeners.focus,undefined);assert.equal(c.listeners.online,undefined);
});
test('archive, older pages, oldest-first, disabled refresh and signed-out views never poll',async()=>{
 for(const overrides of [{12:'archive'},{14:['older-cursor']},{9:false},{17:false},{0:false}]){const c=mount(overrides);await flush();assert.equal(c.intervals.size,0);c.cleanup()}
});
test('rate limiting backs automatic refresh off, and an expired session returns to signed-out state',async()=>{
 const c=mount({},429);await flush();c.advance(5000);c.tick();await flush();assert.equal(c.requests(),1);c.cleanup();
 const expired=mount({},401);await flush();assert(expired.changes.some(change=>change.index===0&&change.next===false));expired.cleanup();
});
