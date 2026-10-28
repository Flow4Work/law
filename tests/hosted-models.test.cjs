const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../src/lib/models.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
function load(raw){
 const calls=[];
 const exports={};
 const fail=async()=>{calls.push('local IO');throw Error('Hosted connections must not use local IO')};
 vm.runInNewContext(compiled,{exports,require:id=>id==='server-only'?{}:id==='node:fs/promises'?{readFile:fail,writeFile:fail,mkdir:fail}:id==='./model-catalog'?{listProviderModels:fail}:require(id),process:{cwd:()=>'/app',env:{VERCEL:'1',LEGAL_MODEL_CONNECTIONS:raw}},console:{warn(){}},URL,Buffer,AbortSignal,fetch:fail,Date});
 return {api:exports,calls};
}
const cloud={id:'env:cloud',name:'Cloud',provider:'openrouter',model:'test-model',baseUrl:'https://example.com/v1',key:'test-secret'};
test('hosted inventory keeps cloud models without reading files or probing loopback',async()=>{
 const {api,calls}=load(JSON.stringify([cloud]));
 const inventory=await api.getModelInventory(true);
 assert.equal(inventory.readOnly,true);
 assert.equal(inventory.models.length,1);
 assert.equal(inventory.defaultId,cloud.id);
 assert.equal(inventory.models[0].available,true);
 assert(!JSON.stringify(inventory).includes('test-secret'));
 assert(!JSON.stringify(inventory).includes('example.com'));
 assert.equal((await api.resolveProvider(cloud.id)).key,'test-secret');
 assert.deepEqual(calls,[]);
});
test('public connection mutations fail before any file or network operation',async()=>{
 const {api,calls}=load(JSON.stringify([cloud]));
 await assert.rejects(api.saveConnection({}),/운영자/);
 await assert.rejects(api.deleteConnection(cloud.id),/운영자/);
 await assert.rejects(api.deleteModel(cloud.id),/운영자/);
 assert.deepEqual(calls,[]);
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
