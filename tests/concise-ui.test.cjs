const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(__dirname,'../src/lib',file);if(!path.extname(file))file+='.ts';if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>load(path.resolve(path.dirname(file),id)),m,m.exports);return m.exports}
const {conciseSummary,validSummaryLines,procedureName,detailHeadline,supplementaryDescription}=load('concise-copy');
const {roadmapCardSummary,roadmapCardDisplaySummary,roadmapParallelNote,routeKeyword,roadmapCardFooter}=load('roadmap-card-copy');
const {normalizeAnalysis}=load('analysis');
const {nodeDuration,scenarioTiming}=load('legal-copy');
const {selectedModelId}=load('model-selection');

test('long saved method descriptions become two simple sentences while preserving full detail',()=>{
 const description='계좌 압류로 돈을 찾지 못했을 때, 법원에 신청해 채무자가 자기 재산을 목록으로 밝히도록 하는 절차예요. 이미 승소 판결이나 확정 지급명령 같은 집행 근거가 있으니 이 단계를 바로 진행할 수 있어요. 밝혀진 재산이 있으면 그 재산에 다시 압류를 신청해요.';
 const node={kind:'route',title:'재산정렬 신청',description};
 const lines=conciseSummary(node);
 assert.equal(lines.length,2);assert(lines.every(line=>line.length<=24&&line.endsWith('요.')));
 assert(!/[.…]{3}|재산정렬/.test(roadmapCardSummary(node)));
 assert.equal(node.description,description);assert.equal(routeKeyword(node),'재산명시 신청');
});
test('structured copy accepts one or two sentences and retains legacy three-sentence data',()=>{
 const lines=['퇴직금 지급을 요청해요.','관련 자료를 모아 신고해요.','합의금은 대상을 따로 확인해요.'];
 assert.deepEqual(validSummaryLines(lines),lines);
 assert.deepEqual(validSummaryLines(lines.slice(0,1)),lines.slice(0,1));
 assert.deepEqual(validSummaryLines(lines.slice(0,2)),lines.slice(0,2));
 for(const invalid of [[],[...lines,'넷째 문장이에요.'],['가'.repeat(25),...lines.slice(1)],['계속…',...lines.slice(1)],['문장 중간에',...lines.slice(1)],[lines[0],lines[0],lines[2]]])assert.equal(validSummaryLines(invalid),undefined);
 const raw={nodes:[{id:'r',kind:'route',title:'재산정렬',description:'재산정렬을 신청해요.',summaryLines:lines}],edges:[]};
 const node=normalizeAnalysis(raw,undefined,[]).nodes[0];
 // An invented title with no evidence of disclosure vs inquiry remains non-specific.
 assert.equal(node.title,'재산 확인');assert.equal(node.description,'재산 확인을 신청해요.');assert.deepEqual(node.summaryLines,lines);
});

test('duplicate procedure names are removed without confusing disclosure with inquiry',()=>{
 assert.equal(procedureName('재산명시·재산명시 신청'),'재산명시 신청');
 assert.equal(procedureName('재산명시·재산정렬 신청'),'재산명시 신청');
 assert.equal(procedureName('재산 명시 재산 명시 신청'),'재산명시 신청');
 assert.equal(procedureName('재산명시·재산조회 신청'),'재산명시·재산조회 신청');
});

test('short explanations stay short and case facts are not replaced by an action list',()=>{
 const description='승소 판결이 있지만 계좌에서 돈을 받지 못했어요. 다른 재산을 찾을지 살펴보는 상황이에요.';
 assert.deepEqual(conciseSummary({kind:'situation',title:'계좌 압류 뒤 대응',description}),[description]);
 assert.deepEqual(conciseSummary({kind:'route',title:'직접 협의',description:'갚을 날짜를 상대와 정해요.'}),['갚을 날짜를 상대와 정해요.']);
 const step=conciseSummary({kind:'step',title:'채무자 재산 정보 파악',description:'이 단계에서 필요한 내용을 확인해요.'});
 assert(step[0].includes('단서'));assert(!step.includes('채무자 재산 정보 파악'));
});

test('detail headers show one useful sentence and folded copy omits exact repetition',()=>{
 const disclose={kind:'route',title:'재산명시 신청',description:'상대가 재산 목록을 내도록 신청해요.',summaryLines:['상대가 재산 목록을 내도록 신청해요.','찾은 재산은 따로 압류해야 해요.']};
 const inquiry={kind:'route',title:'재산조회 신청',description:'법원이 상대 재산을 직접 조회해요.',summaryLines:['법원이 상대 재산을 직접 조회해요.','재산명시 불응 후에 쓸 수 있어요.']};
 assert.equal(detailHeadline(disclose),'상대가 재산 목록을 내도록 신청해요.');
 assert.equal(detailHeadline(inquiry),'법원이 상대 재산을 직접 조회해요.');
 assert.equal(supplementaryDescription(disclose,detailHeadline(disclose)),'');
 assert.equal(supplementaryDescription(inquiry,detailHeadline(inquiry)),'');
 const compound={kind:'route',title:'예금 압류',description:'상대 계좌의 잔액을 확인해요. 법원에 압류를 신청해요.'};
 assert.equal(detailHeadline(compound),'상대 계좌의 잔액을 확인해요.');
 assert.equal(supplementaryDescription(compound,detailHeadline(compound)),'법원에 압류를 신청해요.');
});

test('map cards break before short follow-ups but flow long ones inline',()=>{
 const short='받을 돈과 이유를 적어 신청해요. 보완 요청이 오면 내용을 고쳐요.';
 const long='법원이 지급명령을 보내요. 전달되지 않으면 주소를 고쳐 다시 보내거나 소송으로 넘길지 확인해요.';
 assert.equal(roadmapCardDisplaySummary({kind:'situation',title:'신청·서류 심사',description:short}),short.replace('. ','.\n'));
 assert.equal(roadmapCardDisplaySummary({kind:'situation',title:'상대에게 전달',description:long}),long);
 assert.equal(roadmapCardDisplaySummary({kind:'situation',title:'단일 설명',description:'서류를 제출해요.'}),'서류를 제출해요.');
});

test('parallel-procedure map hint only appears for grounded independent routes',()=>{
 const route=(id,title,status='possible')=>({id,title,kind:'route',status});
 const name=route('list','채무불이행자 명부 등재');
 const disclosure=route('disclose','재산명시 신청');
 const inquiry=route('inquiry','재산조회 신청');
 const garnishment=route('seize','채권압류 및 추심 신청');
 const attachment=route('attach','가압류 신청');
 const claim=route('lawsuit','민사소송');
 assert.equal(roadmapParallelNote(name,[name,disclosure,inquiry]),'요건 충족 시 재산명시·조회와 병행해요.');
 assert.equal(roadmapParallelNote(name,[name,disclosure]),'요건 충족 시 재산명시와 병행해요.');
 assert.equal(roadmapParallelNote(disclosure,[name,disclosure,inquiry]),null);
 assert.equal(roadmapParallelNote(inquiry,[name,disclosure,inquiry]),null);
 assert.equal(roadmapParallelNote(garnishment,[garnishment,disclosure]),'집행 요건 충족 시 재산명시와 병행해요.');
 assert.equal(roadmapParallelNote(disclosure,[disclosure,garnishment]),'압류할 재산이 있으면 병행 가능해요.');
 assert.equal(roadmapParallelNote(disclosure,[disclosure,attachment]),null);
 assert.equal(roadmapParallelNote(attachment,[attachment,claim]),'요건 충족 시 소송과 병행 가능해요.');
 assert.equal(roadmapParallelNote(claim,[attachment,claim]),'요건 충족 시 가압류와 병행 가능해요.');
 assert.equal(roadmapParallelNote(name,[name,route('hidden','재산명시 신청','unavailable')]),null);
 assert.equal(roadmapParallelNote({...name,kind:'step'},[name,disclosure]),null);
 assert.equal(roadmapParallelNote(name,[name,claim]),null);
});

test('card footers explain what to explore rather than counting steps or outcomes',()=>{
 for(const kind of ['situation','route','step','outcome']){
  const footer=roadmapCardFooter({kind,scenario:{steps:[{title:'신청'}],outcomes:[{title:'결과'}]}});
  assert(footer.endsWith('?'));assert(!/\d|단계|가지 결과/.test(footer));
 }
});
test('explicit case and preferred model choices outrank the server default, with an available fallback',()=>{
 const inventory={defaultId:'fast',models:[{id:'fast',available:true},{id:'external',available:true},{id:'offline',available:false}]};
 assert.equal(selectedModelId(inventory,undefined,'external'),'external');
 assert.equal(selectedModelId(inventory,'external','fast'),'external');
 assert.equal(selectedModelId(inventory,'offline','external'),'external');
 assert.equal(selectedModelId(inventory,undefined,'removed'),'fast');
 assert.equal(selectedModelId({...inventory,defaultId:'offline'},'removed'),'fast');
 assert.equal(selectedModelId(null),'');
});
test('elapsed estimates require sources; a response deadline is never promoted to duration',()=>{
 const node={duration:'',scenario:{timing:[{kind:'deadline',label:'2주 안에 신청',sourceIds:['s']},{kind:'estimate',label:'약 4~6주',sourceIds:[]},{kind:'variable',label:'송달 여부에 따라 달라져요',sourceIds:[]}]}};
 assert.equal(nodeDuration(node),null);assert.equal(scenarioTiming(node).estimate,undefined);
 node.scenario.timing.push({kind:'estimate',label:'약 2~4주',sourceIds:['s']});
 assert.equal(nodeDuration(node).label,'약 2~4주');
 assert.equal(nodeDuration({duration:'약 3~5주',durationSourceIds:['s']}).label,'약 3~5주');
});
