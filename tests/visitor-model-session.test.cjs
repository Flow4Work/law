const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/visitor-model-session.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(secret='test-only-encryption-secret-at-least-32-characters'){
 let stored;const exports={};
 const jar={get:()=>stored?{value:stored.token}:undefined,set:(name,token,options)=>{stored={name,token,options}}};
 vm.runInNewContext(compiled,{exports,require:id=>id==='server-only'?{}:id==='next/headers'?{cookies:async()=>jar}:require(id),process:{env:{LEGAL_CONNECTION_SECRET:secret,VERCEL:'1'}},Buffer});
 return {api:exports,stored:()=>stored};
}
const value={connections:[{id:'visitor:test',name:'Private',provider:'bai',model:'test-model',baseUrl:'https://api.b.ai/v1',key:'private-test-key'}],hiddenModels:[]};
test('visitor credentials survive authenticated encryption without plaintext in the cookie',async()=>{
 const {api,stored}=load();
 await api.writeVisitorModels(value);
 const saved=stored();
 assert.equal(saved.options.httpOnly,true);assert.equal(saved.options.secure,true);assert.equal(saved.options.sameSite,'lax');
 assert.equal(saved.options.maxAge,30*86400);
 assert(!saved.token.includes('private-test-key'));
 assert.equal((await api.readVisitorModels()).connections[0].key,'private-test-key');
 assert.notEqual(api.sealModelSession(value),saved.token);
});
test('modified cookies and a different server secret cannot recover private connections',()=>{
 const {api}=load();const token=api.sealModelSession(value);
 assert.equal(api.openModelSession(token.slice(0,-4)+'abcd').connections.length,0);
 assert.equal(load('another-test-secret-with-at-least-32-characters').api.openModelSession(token).connections.length,0);
 assert.equal(api.openModelSession('invalid').connections.length,0);
});
test('private storage fails explicitly when not configured or over capacity',async()=>{
 assert.throws(()=>load('').api.sealModelSession(value),/저장/);
 await assert.rejects(load().api.writeVisitorModels({connections:Array(9).fill(value.connections[0]),hiddenModels:[]}),/8개/);
 const big={...value,connections:[{...value.connections[0],key:require('node:crypto').randomBytes(4000).toString('hex')}]};
 assert.throws(()=>load().api.sealModelSession(big),/용량/);
});
