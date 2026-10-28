const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const cache=new Map();
function load(file){
 file=path.resolve(__dirname,'../src/lib',file);
 if(!path.extname(file))file+='.ts';
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',js)(id=>load(path.resolve(path.dirname(file),id)),module,module.exports);
 return module.exports;
}
const {expandRoadmap}=load('scenario-graph.ts');
const {isTerminalOutcome}=load('scenario-endings.ts');
const {CIVIL_DEMO}=load('civil-demo.ts');
const input=()=>structuredClone(CIVIL_DEMO);
function revealed(value,id){value.nodes.find(n=>n.id===id).scenarioRevealed=4;return value;}
test('settlement is a conditional green end node, not an already finished user action',()=>{
 const value=revealed(input(),'civil-mediation');
 const graph=expandRoadmap(value);
 const outcome=graph.nodes.find(n=>n.kind==='outcome'&&n.title==='합의 내용을 조서로');
 assert(outcome);
 const completed=graph.nodes.find(n=>n.kind==='completion'&&n.scenarioOutcome===outcome.scenarioOutcome);
 assert(completed);
 assert.equal(completed.status,'possible');
 assert(graph.edges.some(e=>e.source===outcome.id&&e.target===completed.id));
 assert(!value.nodes.some(n=>n.kind==='completion'));
});
test('confirmed judgment, attachment, or no objection do not mean money was collected',()=>{
 for(const title of ['이의 없이 확정','판결 확정','압류 결정'])assert.equal(isTerminalOutcome({title,description:''}),false);
});
test('actual next steps extend beyond result while never inventing a terminal status',()=>{
 const value=revealed(input(),'civil-payment');
 const route=value.nodes.find(n=>n.id==='civil-payment');
 route.scenario.outcomes=[{title:'재산 확인',description:'상대 재산이 확인돼요.',terminal:false,nextSteps:[
  {title:'재산 압류 신청',description:'확인된 대상에 강제집행을 신청해요.'},
  {title:'추심 및 배당',description:'결정에 따라 추심·배당을 살펴봐요.'},
  {title:'회수액 확인',description:'받은 돈과 남은 채권을 계산해요.'}
 ]}];
 const graph=expandRoadmap(value);
 const outcome=graph.nodes.find(n=>n.kind==='outcome'&&n.title==='재산 확인');
 const follow=graph.nodes.filter(n=>n.kind==='followup'&&n.scenarioOutcome===0&&n.scenarioFollowUp!==undefined);
 assert.equal(follow.length,3);
 assert(graph.edges.some(e=>e.source===outcome.id&&e.target===follow[0].id));
 assert(graph.edges.some(e=>e.source===follow[0].id&&e.target===follow[1].id));
 assert(graph.edges.some(e=>e.source===follow[1].id&&e.target===follow[2].id));
 assert(!graph.nodes.some(n=>n.kind==='completion'));
});
test('conditional cross-route handoff stays a separate node, not an edge that moves a Depth 2 route',()=>{
 const graph=expandRoadmap(revealed(input(),'civil-payment'));
 const denied=graph.nodes.find(n=>n.kind==='outcome'&&n.title==='이의 없이 확정');
 const objected=graph.nodes.find(n=>n.kind==='outcome'&&n.title==='다투면 소송으로');
 assert(denied&&!denied.next.includes('civil-suit'));
 assert(objected&&objected.next.includes('civil-suit'));
 assert(graph.nodes.some(n=>n.linkedRouteId==='civil-suit'));
 assert(!graph.edges.some(e=>e.target==='civil-suit'&&e.source.startsWith('scenario:')));
});

test('a successful settlement never branches to the dispute-only lawsuit transition',()=>{
 const graph=expandRoadmap(revealed(input(),'civil-mediation'));
 const success=graph.nodes.find(n=>n.kind==='outcome'&&n.title==='합의 내용을 조서로');
 assert(success);
 assert(!success.next.includes('civil-suit'));
 assert(!graph.nodes.some(n=>n.kind==='followup'&&n.scenarioOutcome===success.scenarioOutcome&&n.linkedRouteId==='civil-suit'));
});
