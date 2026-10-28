const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/model-endpoint.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(address='93.184.216.34'){
 const exports={};vm.runInNewContext(compiled,{exports,require:id=>id==='server-only'?{}:id==='node:dns/promises'?{lookup:async()=>[{address}]}:require(id),process:{env:{VERCEL:'1'}},URL});return exports;
}
test('public model endpoints reject private, loopback, metadata and redirected address classes',async()=>{
 const api=load();
 for(const address of ['127.0.0.1','10.0.0.1','169.254.169.254','172.16.0.1','192.168.0.1','100.64.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1'])assert.equal(api.publicModelAddress(address),false,address);
 for(const url of ['http://api.example.com/v1','https://localhost/v1','https://127.0.0.1/v1','https://api.example.com:1234/v1','https://user:pass@example.com/v1'])await assert.rejects(api.validateModelEndpoint(url));
 await assert.rejects(load('10.1.2.3').validateModelEndpoint('https://api.example.com/v1'));
 await api.validateModelEndpoint('https://api.example.com/v1');
 assert.equal(api.publicModelAddress('2606:4700:4700::1111'),true);
});
