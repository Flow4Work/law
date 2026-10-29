const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(__dirname,'../src/lib',file);if(!path.extname(file))file+='.ts';if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',js)(id=>load(path.resolve(path.dirname(file),id)),m,m.exports);return m.exports;}
const {beginStep,advanceStep,completeStep,chooseNextStep}=load('progress.ts');
const {expandRoadmap}=load('scenario-graph.ts');
const {normalizeAnalysis}=load('analysis.ts');
const {CIVIL_DEMO}=load('civil-demo.ts');
const base=()=>structuredClone(CIVIL_DEMO);
const steps=v=>expandRoadmap(v).nodes.filter(n=>n.scenarioParentId==='civil-payment'&&n.kind==='step');
test('initial exploration reveals three procedures without writing completion or active progress',()=>{
 let v=base();const initial=structuredClone(v);assert.equal(steps(v).length,0);
 for(let i=0;i<1;i++){
  v=beginStep(v,'civil-payment');
  assert.equal(steps(v).length,3);assert.equal(v.nodes.find(n=>n.id==='civil-payment').scenarioRevealed,3);
  assert.equal(v.progress,undefined);assert.deepEqual(v.nodes.map(n=>[n.status,n.userConfirmed,n.scenarioIndex]),initial.nodes.map(n=>[n.status,n.userConfirmed,n.scenarioIndex]));assert(steps(v).every(n=>n.status==='possible'));
 }
 const graph=expandRoadmap(v);for(let i=0;i<3;i++)assert(graph.edges.some(e=>e.source===(i===0?'civil-payment':'scenario:civil-payment:step:'+(i-1))&&e.target==='scenario:civil-payment:step:'+i));
 assert.deepEqual(v.messages,initial.messages);
});
test('results appear only on the following click and can lead to another method before any completion',()=>{
 let v=beginStep(base(),'civil-payment');assert(!expandRoadmap(v).nodes.some(n=>n.kind==='outcome'));
 v=advanceStep(v,'scenario:civil-payment:step:2');const graph=expandRoadmap(v);assert.equal(graph.nodes.filter(n=>n.kind==='outcome').length,2);
 const result=chooseNextStep(v,'scenario:civil-payment:outcome:1','civil-suit');assert.equal(result.nodes.find(n=>n.id==='civil-suit').scenarioRevealed,3);assert.equal(result.progress,undefined);assert.equal(steps(result).length,3);
 assert.equal(chooseNextStep(v,'civil-payment','civil-mediation'),v);
});
test('explicit completion changes only its target and does not reveal or start another step',()=>{
 const v=beginStep(base(),'civil-payment');const done=completeStep(v,'scenario:civil-payment:step:0');assert.equal(steps(done)[0].status,'done');assert.equal(done.nodes.find(n=>n.id==='civil-payment').status,'possible');assert.equal(steps(done).length,3);
 const next=advanceStep(done,'scenario:civil-payment:step:0');assert.equal(steps(next).length,3);assert.equal(steps(next)[0].status,'done');assert.equal(steps(next)[1].status,'possible');assert.equal(done.progress['scenario:civil-payment:step:0'],'done');
});
test('legacy expanded records, actual done cards, edges, and conversations survive',()=>{
 let v=base();v.nodes[1]={...v.nodes[1],userConfirmed:true,status:'current',scenarioIndex:1};v.nodes[0].status='done';v.messages=[{id:'original',role:'user',content:'기존 기록',createdAt:''}];const graph=expandRoadmap(v);assert(graph.nodes.some(n=>n.id==='civil-now'));assert.equal(steps(v).length,3);assert.equal(steps(v)[0].status,'done');assert(graph.edges.some(e=>e.source==='civil-now'&&e.target==='civil-payment'));assert.equal(beginStep(v,'civil-payment'),v);assert.equal(v.messages[0].content,'기존 기록');
});
test('reveal cursor and procedure cache survive serialization and map reanalysis',()=>{
 const v=JSON.parse(JSON.stringify(beginStep(base(),'civil-payment')));assert.equal(steps(v).length,3);const raw={nodes:base().nodes,edges:base().edges};const result=normalizeAnalysis(raw,v,v.sources);const route=result.nodes.find(n=>n.id==='civil-payment');assert.equal(route.scenarioRevealed,3);assert.deepEqual(route.scenario,v.nodes[1].scenario);assert.equal(steps({...v,...result}).length,3);
});
test('independent routes advance independently and terminal clicks are idempotent',()=>{
 let v=beginStep(base(),'civil-payment');v=beginStep(v,'civil-mediation');assert.equal(steps(v).length,3);assert.equal(v.nodes.find(n=>n.id==='civil-mediation').scenarioRevealed,3);for(let i=0;i<6;i++)v=advanceStep(v,'civil-payment');assert.equal(v.nodes.find(n=>n.id==='civil-payment').scenarioRevealed,4);assert.equal(advanceStep(v,'civil-payment'),v);
});
