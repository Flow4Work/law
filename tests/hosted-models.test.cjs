const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/lib/models.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function load(raw,options={}){
 const calls=[];
 const exports={};
 const sessions=new Map();let visitor='a';
 const session=()=>sessions.get(visitor)||{connections:[],hiddenModels:[]};
 const fail=async()=>{calls.push('local IO');throw Error('Hosted connections must not use local IO')};
 vm.runInNewContext(compiled,{exports,require:id=>id==='server-only'?{}:id==='node:fs/promises'?{readFile:fail,writeFile:fail,mkdir:fail}:id==='./visitor-model-session'?{readVisitorModels:async()=>session(),writeVisitorModels:async value=>sessions.set(visitor,JSON.parse(JSON.stringify(value)))}:id==='./model-catalog'?{listProviderModels:async()=>options.catalog||[{id:'test-model',name:'Test Model'}],isAllowedBaiModel:model=>['minimax-m3.1-flash','gpt-6-luna'].includes(model),visibleProviderModels:(provider,models)=>provider==='bai'?['minimax-m3.1-flash','gpt-6-luna'].flatMap(id=>models.filter(m=>m.id===id)):models}:require(id),process:{cwd:()=>'/app',env:{VERCEL:'1',LEGAL_MODEL_CONNECTIONS:raw,...options.env}},console:{warn(){}},URL,Buffer,AbortSignal,fetch:fail,Date});
 return {api:exports,calls,visitor:id=>{visitor=id}};
}
const cloud={id:'env:cloud',name:'Cloud',provider:'openrouter',model:'test-model',baseUrl:'https://example.com/v1',key:'test-secret'};
test('hosted inventory keeps cloud models without reading files or probing loopback',async()=>{
 const {api,calls}=load(JSON.stringify([cloud]));
 const inventory=await api.getModelInventory(true);
 assert.equal(inventory.readOnly,false);
 assert.equal(inventory.browserScoped,true);
 assert.equal(inventory.models[0].editable,false);
 assert.equal(inventory.models.length,1);
 assert.equal(inventory.defaultId,cloud.id);
 assert.equal(inventory.models[0].available,true);
 assert(!JSON.stringify(inventory).includes('test-secret'));
 assert(!JSON.stringify(inventory).includes('example.com'));
 assert.equal((await api.resolveProvider(cloud.id)).key,'test-secret');
 assert.deepEqual(calls,[]);
});
test('public visitors cannot mutate the shared operator connections',async()=>{
 const {api,calls}=load(JSON.stringify([cloud]));
 await assert.rejects(api.saveConnection({connectionId:cloud.id}),/공용/);
 await assert.rejects(api.deleteConnection(cloud.id),/공용/);
 await assert.rejects(api.deleteModel(cloud.id),/공용/);
 assert.deepEqual(calls,[]);
});
test('visitors add, reload, use, replace and delete only their own private connections',async()=>{
 const {api,calls,visitor}=load(JSON.stringify([cloud]));
 const id=await api.saveConnection({provider:'custom',key:'visitor-key',baseUrl:'https://example.com/v1',model:'test-model',name:'My Model'});
 assert.match(id,/^visitor:/);
 const inventory=await api.getModelInventory();
 assert.equal(inventory.models.length,2);
 assert.equal(inventory.models.find(m=>m.id===id).editable,true);
 assert(!JSON.stringify(inventory).includes('visitor-key'));
 assert.equal((await api.resolveProvider(id)).key,'visitor-key');
 visitor('b');
 assert.equal((await api.getModelInventory()).models.length,1);
 await assert.rejects(api.resolveProvider(id));
 await assert.rejects(api.deleteConnection(id));
 visitor('a');
 assert.equal(await api.saveConnection({connectionId:id,replaceId:id,model:'test-model',name:'Renamed'}),id);
 assert.equal((await api.resolveProvider(id)).name,'Renamed');
 await api.deleteModel(id);
 assert.equal((await api.getModelInventory()).models.length,1);
 assert.deepEqual(calls,[]);
});
test('B.AI exposes only approved models, prefers Luna, and rejects blocked choices',async()=>{
 const catalog=[{id:'claude-opus-5.5',name:'Claude Opus'},{id:'gpt-6-luna',name:'GPT-6 Luna'},{id:'minimax-m3.1-flash',name:'MiniMax M3.1 Flash'}];
 const {api}=load('',{env:{b_ai:'test-bai-key',BAI_MODEL:'claude-opus-5.5'},catalog});
 const inventory=await api.getModelInventory();
 assert.deepEqual(Array.from(inventory.models,m=>m.model),['minimax-m3.1-flash','gpt-6-luna']);
 assert.equal(inventory.defaultId,'env:bai:gpt-6-luna');
 assert.equal((await api.resolveProvider(inventory.defaultId)).key,'test-bai-key');
 await assert.rejects(api.resolveProvider('env:bai:claude-opus-5.5'),/선택한 모델의 연결을 확인/);
 await assert.rejects(api.saveConnection({provider:'bai',key:'test-bai-key',model:'claude-opus-5.5'}),/MiniMax M3.1 Flash/);
 assert(!JSON.stringify(inventory).includes('test-bai-key'));
});
test('fallback order is GPT-6 Luna, connected GLM, then MiniMax',async()=>{
 const glm={...cloud,id:'env:glm',provider:'glm',model:'glm-5.3',isDefault:true};
 const catalog=[{id:'gpt-6-luna',name:'GPT-6 Luna'},{id:'minimax-m3.1-flash',name:'MiniMax M3.1 Flash'}];
 const withAll=load(JSON.stringify([glm]),{env:{b_ai:'bai-key'},catalog});
 assert.equal((await withAll.api.getModelInventory()).defaultId,'env:bai:gpt-6-luna');
 const withoutLuna=load(JSON.stringify([glm]),{env:{b_ai:'bai-key'},catalog:catalog.slice(1)});
 assert.equal((await withoutLuna.api.getModelInventory()).defaultId,'env:glm:flash');
 const withoutGlm=load('',{env:{b_ai:'bai-key'},catalog:catalog.slice(1)});
 assert.equal((await withoutGlm.api.getModelInventory()).defaultId,'env:bai:minimax-m3.1-flash');
});
test('hosted runtime excludes local providers and tolerates absent or malformed configuration',async()=>{
 for(const raw of ['', '{invalid', '{}',JSON.stringify([{...cloud,provider:'local',baseUrl:'http://127.0.0.1:11434/v1'},{...cloud,id:'env:loopback',baseUrl:'http://localhost:1234/v1'},null])]){
  const {api,calls}=load(raw);
  assert.equal((await api.getModelInventory()).models.length,0);
  assert.deepEqual(calls,[]);
 }
});
test('GLM variants retain unique identifiers after migration',async()=>{
 const {api}=load(JSON.stringify([{...cloud,id:'env:glm',provider:'glm',model:'glm-5.3',isDefault:true}]));
 const inventory=await api.getModelInventory();
 assert.equal(inventory.models.length,3);
 assert.equal(new Set(inventory.models.map(m=>m.id)).size,3);
 assert.equal(inventory.defaultId,'env:glm:flash');
});
