const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/lib/model-failures.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleExports={};
vm.runInNewContext(compiled,{exports:moduleExports,Date,Number,String,Boolean,Object,RegExp});
const {classifyModelFailure}=moduleExports;

test('quota 429 is not retried as a temporary outage',()=>{
 const value=classifyModelFailure(429,{error:{code:'insufficient_quota',message:'credits exhausted'}},null);
 assert.equal(value.kind,'quota');
 assert.equal(value.retryable,false);
 assert.match(value.message,/할당량|크레딧/);
});
test('rate 429 with short backoff is temporarily retryable',()=>{
 const value=classifyModelFailure(429,{error:{code:'rate_limit_exceeded'}},'3');
 assert.equal(value.kind,'rate');
 assert.equal(value.retryable,true);
 assert.match(value.message,/HTTP 429/);
});
test('rate 429 with long Retry-After does not perform ineffective retry',()=>{
 const value=classifyModelFailure(429,{error:{type:'rate_limit'}},'600');
 assert.equal(value.retryable,false);
});
test('503 is capacity outage, not a quota message',()=>{
 const value=classifyModelFailure(503,{error:{message:'Service unavailable'}},null);
 assert.equal(value.kind,'capacity');
 assert.equal(value.retryable,true);
 assert.doesNotMatch(value.message,/요청 한도/);
});
test('authorization, billing and parameter errors are distinct and not retried',()=>{
 for(const [status,kind] of [[401,'auth'],[402,'quota'],[400,'invalid'],[404,'invalid']]){
  const value=classifyModelFailure(status,{},null);
  assert.equal(value.kind,kind);
  assert.equal(value.retryable,false);
 }
});
