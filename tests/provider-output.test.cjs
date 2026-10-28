const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(config,results){
 const calls=[],progress=[],cache=new Map();
 function moduleFile(name){
  if(cache.has(name))return cache.get(name);
  const exports={};cache.set(name,exports);
  const source=fs.readFileSync(path.join(__dirname,'../src/lib',name+'.ts'),'utf8');
  const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(compiled,{exports,require:id=>id==='server-only'?{}:id==='./models'?{resolveProvider:async()=>({id:'test',baseUrl:'https://api.b.ai/v1',key:'test-secret',provider:'bai',model:'minimax-m3.1-flash',...config})}:id==='./model-endpoint'?{validateModelEndpoint:async()=>{}}:id.startsWith('./')?moduleFile(id.slice(2)):require(id),AbortSignal,AbortController,Response,Date,setTimeout,clearTimeout,console:{warn(){}},fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});const next=results.shift();assert(next,'unexpected extra request');return Response.json(next.data,{status:next.status||200})}});
  return exports;
 }
 return {api:moduleFile('provider-next'),calls,progress};
}
const chat=(content,finish_reason='stop',extra={})=>({data:{choices:[{message:{content,...extra},finish_reason}]}});
test('B.AI reasoning-only length response is retried with room for a complete object',async()=>{
 const {api,calls,progress}=load({},[chat(null,'length',{reasoning_content:'thinking'}),chat('{"answer":"complete","nodes":[]}')]);
 const result=await api.withAIContext({onProgress:p=>progress.push(p)},()=>api.requestObject('Return JSON','test',2500));
 assert.equal(result.answer,'complete');assert.equal(calls.length,2);
 assert(calls[0].body.max_tokens>=14000);
 assert(calls[1].body.max_tokens>calls[0].body.max_tokens);
 assert.equal(calls[0].body.response_format,undefined);
 assert.equal(calls[0].body.reasoning_effort,'low');
 assert.equal(calls[0].body.temperature,undefined);
 assert(progress.some(p=>p.phase==='formatting'));
});
test('GPT Responses receives JSON mode and includes only assistant text, excluding reasoning',async()=>{
 const {api,calls}=load({model:'gpt-5.4-mini'},[{data:{status:'incomplete',incomplete_details:{reason:'max_output_tokens'},output:[{type:'reasoning',summary:[]}]}},{data:{status:'completed',output:[{type:'reasoning',content:[{type:'text',text:'not the answer'}]},{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}]}}]);
 const result=await api.requestObject('Return JSON','test',2500);
 assert.equal(result.ok,true);assert.match(calls[0].url,/\/responses$/);
 assert.equal(calls[0].body.text.format.type,'json_object');
 assert(calls[1].body.max_output_tokens>calls[0].body.max_output_tokens);
 assert.equal(calls[0].body.max_tokens,undefined);
});
test('partial JSON with a length finish reason is never accepted as a completed map',async()=>{
 const {api,calls}=load({},[chat('{"answer":"partial"}','length'),chat('{"answer":"complete"}')]);
 assert.equal((await api.requestObject('JSON','test',2500)).answer,'complete');
 assert.equal(calls.length,2);
});
test('repeated output exhaustion stops after one expansion with a specific error',async()=>{
 const {api,calls}=load({},[chat(null,'length'),chat(null,'length')]);
 await assert.rejects(api.requestObject('JSON','test'),/응답 길이 제한/);assert.equal(calls.length,2);
});
test('text content blocks are supported and thought wrappers are excluded from JSON',async()=>{
 const {api}=load({},[chat([{type:'text',text:'<think>internal</think>\n```json\n{"ok":true}\n```'}])]);
 assert.equal((await api.requestObject('JSON','test')).ok,true);
 for(const invalid of ['null','[]','[{"ok":true}]','"hello"','{"broken":'])assert.throws(()=>api.parseObject(invalid));
});
test('malformed JSON retries with a larger budget, without inventing missing fields',async()=>{
 const {api,calls}=load({},[chat('{"answer":'),chat('{"answer":"complete"}')]);
 assert.equal((await api.requestObject('JSON','test',2500)).answer,'complete');
 assert(calls[1].body.max_tokens>calls[0].body.max_tokens);
 assert.equal(calls[1].body.messages[1].content,'test');
});
test('explicitly unsupported JSON mode falls back once, while auth and billing do not retry',async()=>{
 const {api,calls}=load({model:'claude-haiku-4.5'},[{status:400,data:{error:{message:'response_format json_object is not supported'}}},chat('{"ok":true}')]);
 assert.equal((await api.requestObject('JSON','test')).ok,true);assert.equal(calls[1].body.response_format,undefined);
 for(const status of [401,402,403]){
  const {api,calls}=load({},[{status,data:{error:{message:'denied'}}}]);
  await assert.rejects(api.requestObject('JSON','test'),new RegExp('HTTP '+status));assert.equal(calls.length,1);
 }
});
test('content filtering and failed Responses never publish partial answers',async()=>{
 for(const response of [chat('partial','content_filter'),{data:{status:'failed',error:{message:'failed'},output:[{type:'message',content:[{type:'output_text',text:'partial'}]}]}}]){
  const {api,calls}=load({model:response.data.status?'gpt-5.4-mini':'minimax-m3.1-flash'},[response]);
  await assert.rejects(api.requestAI('test','test'));assert.equal(calls.length,1);
 }
});
test('MiniMax gateways that reject effort controls fall back once without losing JSON validation',async()=>{
 const {api,calls}=load({},[{status:400,data:{error:{message:'reasoning_effort is an unsupported parameter'}}},chat('{"ok":true}')]);
 assert.equal((await api.requestObject('JSON','test')).ok,true);
 assert.equal(calls[0].body.reasoning_effort,'low');assert.equal(calls[1].body.reasoning_effort,undefined);
 assert.equal(calls.length,2);
});
