import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceStep,beginStep,completeStep,chooseNextStep} from '../src/lib/progress.ts';
import {applyReview,findAnalysisIssues,naturalText,normalizeAnalysis} from '../src/lib/analysis.ts';
import {reconcileIntakeResult} from '../src/lib/intake.ts';

const step=(id,status='possible')=>({id,title:id,description:'확인한 내용을 정리해요.',status,conditions:[],actions:[],documents:[],cost:'',duration:'',risks:[],sourceIds:[],next:[]});
const scenario=(nodes,edges)=>({id:'test',name:'test',createdAt:'',updatedAt:'',messages:[],facts:[],sources:[],evidenceStatus:'unverified',nodes:nodes.map(n=>({...n,next:edges.filter(e=>e.source===n.id).map(e=>e.target)})),edges});

test('explicit completion records only the completed step and leaves its successor untouched',()=>{
 const value=scenario([step('a','current'),step('b')],[{source:'a',target:'b'}]);
 const result=completeStep(value,'a');assert.equal(result.nodes[0].status,'done');assert.equal(result.nodes[1].status,'possible');assert.equal(result.progress.a,'done');assert.equal(result.pendingNextFrom,undefined);
});

test('a branch can be explored without completing its parent; unrelated choices are rejected',()=>{
 const route={...step('c'),kind:'route',scenario:{suitableWhen:'',steps:[{title:'신청',description:'신청해요.'}],outcomes:[]}};
 const value=scenario([step('a','current'),step('b'),route,step('unrelated')],[{source:'a',target:'b'},{source:'a',target:'c'}]);
 assert.equal(chooseNextStep(value,'a','unrelated'),value);
 const chosen=chooseNextStep(value,'a','c');assert.equal(chosen.nodes[2].scenarioRevealed,1);assert.equal(chosen.nodes[2].status,'possible');assert.equal(chosen.nodes[0].status,'current');assert.equal(chosen.progress,undefined);
});

test('completion does not implicitly start a successor whose requirements are unknown',()=>{
 const value=scenario([step('a','current'),step('b','verify')],[{source:'a',target:'b'}]);const result=completeStep(value,'a');assert.equal(result.nodes[1].status,'verify');assert.equal(result.pendingNextFrom,undefined);
});

test('independent active paths and actual completion records survive exploration',()=>{
 const value=scenario([step('a','current'),step('parallel','current')],[]);const done=completeStep(value,'a');assert.equal(done.nodes[1].status,'current');assert.equal(beginStep(done,'a').nodes[0].status,'done');
});

test('normalization preserves user-confirmed history and allows obsolete AI branches to change',()=>{
 const previous=scenario([step('a','done'),step('old'),step('manual','current')],[{source:'a',target:'manual'},{source:'old',target:'manual'}]);previous.progress={a:'done',manual:'current'};
 const result=normalizeAnalysis({answer:'확인해요.',nodes:[step('manual','possible'),step('new')],edges:[{source:'manual',target:'new'}]},previous,[]);
 assert.equal(result.nodes.find(n=>n.id==='a').status,'done');assert.equal(result.nodes.find(n=>n.id==='manual').status,'current');assert(!result.edges.some(e=>e.source==='old'));assert(result.edges.some(e=>e.source==='a'&&e.target==='manual'));
});
test('required documents cannot be inferred from a statute search title',()=>{
 const node={...step('a'),documentChecklist:[{name:'근로계약서',necessity:'required',reason:'근무한 사실을 보여줘요.',sourceIds:['law-1']}]};
 const sources=[{id:'law-1',title:'근로기준법',kind:'법령',url:'https://www.law.go.kr',verifiedAt:''}];
 assert.equal(normalizeAnalysis({nodes:[node],edges:[]},undefined,sources).nodes[0].documentChecklist[0].necessity,'check');
});
test('long understandable warnings and more than two real branches are retained',()=>{
 const risk='합의서에 서명하기 전에 어떤 청구를 포기하는지 확인해요. 이미 받은 돈뿐 아니라 아직 받지 못한 돈까지 포기하는 문구가 들어 있을 수 있어요.';
 const nodes=[{...step('a','current'),risks:[risk]},...['b','c','d','e'].map(id=>step(id))];
 const edges=nodes.slice(1).map(n=>({source:'a',target:n.id}));const result=normalizeAnalysis({nodes,edges},undefined,[]);
 assert.equal(result.edges.length,4);assert.equal(result.nodes[0].risks[0],risk);
});
test('wrong wage complaint agency and unsupported criminal appeal are caught',()=>{
 const base={answer:'',options:[],nextAction:'',question:'',facts:[],edges:[]};
 assert(findAnalysisIssues({...base,nodes:[{...step('wrong'),title:'노동위원회 진정',description:'임금체불 진정을 해요.'}]},'임금을 못 받았어요.').length);
 assert(findAnalysisIssues({...base,nodes:[{...step('appeal'),title:'불송치 이의신청'}]},'경찰이 쌍방폭행이라 끝내라고 말했어요.').length);
 assert.equal(findAnalysisIssues({...base,nodes:[{...step('check','current'),title:'경찰의 통지 내용을 확인해요'}]},'경찰이 쌍방폭행이라 끝내라고 말했어요.').length,0);
});
test('cyclic future paths are rejected',()=>{
 const value={answer:'',options:[],nextAction:'',question:'',facts:[],nodes:[step('a'),step('b')],edges:[{source:'a',target:'b'},{source:'b',target:'a'}]};assert(findAnalysisIssues(value,'').some(s=>s.includes('순환')));
});
test('review edits remove an invented method from both nodes and options',()=>{
 const result=applyReview({nodes:[step('good'),step('bad')],options:['정상 안내','잘못된 안내'],edges:[]},{removeNodeIds:['bad'],options:['정상 안내']});assert.deepEqual(result.nodes.map(n=>n.id),['good']);assert.deepEqual(result.options,['정상 안내']);
});
test('a conditional future appeal is allowed after notice verification',()=>{
 const a={...step('confirm','current'),title:'수사결과 통지서를 확인해요'};const b={...step('appeal','verify'),title:'불송치 이의신청 검토',conditions:['불송치 통지를 받은 고소인이나 피해자인 경우']};
 assert.equal(findAnalysisIssues({answer:'',options:[],nextAction:'',question:'',facts:[],nodes:[a,b],edges:[{source:'confirm',target:'appeal',label:'불송치 통지를 받았다면'}]},'경찰이 쌍방폭행이라며 사과하라고 말했어요.').length,0);
});
test('invented financial methods are rejected without rejecting a truthful limitation',()=>{
 const base={answer:'',options:[],nextAction:'',question:'',facts:[],edges:[]};assert(findAnalysisIssues({...base,nodes:[{...step('fake'),title:'퇴직금 확정금융채권 담보 확인'}]},'퇴직금을 못 받았어요.').length);
 assert.equal(findAnalysisIssues({...base,nodes:[{...step('real'),description:'진정만으로 돈이 자동으로 회수되는 것은 아니에요.'}]},'퇴직금을 못 받았어요.').length,0);
});
test('common formal endings become plain polite Korean without changing facts',()=>{
 assert.equal(naturalText('금액을 확인한다. 자료를 모은다.'),'금액을 확인해요. 자료를 모아요.');
});


test('route previews keep outcomes and transitions without adding extra graph edges',()=>{
 const result=normalizeAnalysis({nodes:[{...step('root','current'),kind:'situation',scenario:{steps:[{title:'redundant'}]}},{...step('route'),kind:'route',scenario:{suitableWhen:'상대 답변에 따라 달라져요',steps:[{title:'신청'},{title:'답변'}],outcomes:[{title:'합의',description:'수령을 확인해요'}],transitions:[{targetId:'other',condition:'다툴 때'},{targetId:'missing',condition:'없는 경로'}],timing:[{kind:'deadline',label:'2주',description:'전달받은 뒤',sourceIds:[]},{kind:'variable',label:'송달에 따라',description:'주소에 따라 달라져요',sourceIds:[]}]}},step('other')],edges:[{source:'root',target:'route'}]},undefined,[]);
 assert.equal(result.nodes[0].scenario,undefined);const preview=result.nodes[1].scenario;assert.equal(preview.steps.length,2);assert.equal(preview.outcomes.length,1);assert.deepEqual(preview.transitions.map(t=>t.targetId),['other']);assert.equal(preview.timing.length,1);assert.equal(preview.timing[0].kind,'variable');assert.equal(result.edges.length,1);
});
test('exploring a chosen route opens its initial preview without advancing actual completion',()=>{
 const node={...step('route'),kind:'route',scenario:{suitableWhen:'',steps:[{title:'a',description:'첫 단계예요.'},{title:'b',description:'다음 단계예요.'}],outcomes:[]}};
 const value=scenario([node,{...step('root','current'),kind:'situation'}],[]);const next=advanceStep(value,'route');assert.equal(next.nodes[0].scenarioRevealed,2);assert.equal(next.nodes[0].scenarioIndex,undefined);assert.equal(next.nodes[0].status,'possible');const later=advanceStep(next,'route');assert.equal(later,next);assert.equal(later.nodes[0].status,'possible');assert.equal(later.progress,undefined);assert.equal(advanceStep(value,'root'),value);
});

test('unsupported statutory deadline for police nonforwarding objection is rejected',()=>{
 const node={...step('objection'),title:'불송치 이의신청',conditions:['정식 불송치 통지를 받은 피해자인 경우'],scenario:{steps:[],outcomes:[],timing:[{kind:'deadline',label:'이의신청 기한',description:'통지를 받은 날부터 기한이 정해져 있어요.',sourceIds:['guide-police-nonforwarding']}]}};
 const answer={answer:'',options:[],facts:[],nextAction:'',question:'',nodes:[node],edges:[]};assert(findAnalysisIssues(answer,'경찰 정식 불송치 통지').some(x=>x.includes('법정 신청기한')));
});


test('citing an official guide alone cannot make any supporting evidence mandatory',()=>{
 const guide={id:'guide',kind:'공식 안내',requiredDocuments:['지급명령 신청서']};
 const raw={nodes:[{...step('a'),documentChecklist:[{name:'지급명령 신청서',necessity:'required',sourceIds:['guide']},{name:'송금 내역',necessity:'required',sourceIds:['guide']}]}],edges:[]};
 const docs=normalizeAnalysis(raw,undefined,[guide]).nodes[0].documentChecklist;assert.equal(docs[0].necessity,'required');assert.equal(docs[1].necessity,'check');
});


test('final intake analysis preserves provisional card identities and removes discarded branches',()=>{
 const previous={...scenario([
  {...step('intake-situation','current'),kind:'situation',title:'현재 상황'},
  {...step('intake-route-0','verify'),kind:'route',title:'기존에 확인된 경로'},
  {...step('intake-route-1','verify'),kind:'route',title:'탈락할 가능성'}
 ],[{source:'intake-situation',target:'intake-route-0'},{source:'intake-situation',target:'intake-route-1'}]),
 intake:{original:'상황',routes:[{title:'기존에 확인된 경로',description:'설명'}],questions:[],answers:[]}};
 const result={answer:'',options:[],nextAction:'',question:'',facts:[],nodes:[
  {...step('new-root','current'),kind:'situation',title:'분석 완료된 현재 상황',next:['new-route','new-path']},
  {...step('new-route'),kind:'route',title:'기존에 확인된 경로'},
  {...step('new-path'),kind:'route',title:'새로운 대안'}
 ],edges:[{source:'new-root',target:'new-route'},{source:'new-root',target:'new-path'}]};
 const updated=reconcileIntakeResult(result,previous);
 assert(updated.nodes.some(node=>node.id==='intake-situation'&&node.title==='분석 완료된 현재 상황'));
 assert(updated.nodes.some(node=>node.id==='intake-route-0'));
 assert(updated.nodes.some(node=>node.id==='new-path'));
 assert(!updated.nodes.some(node=>node.id==='intake-route-1'));
 assert(updated.edges.some(edge=>edge.source==='intake-situation'&&edge.target==='intake-route-0'));
 assert(updated.nodes[0].next.includes('intake-route-0'));
});
