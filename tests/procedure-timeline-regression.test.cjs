const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const transpile=file=>ts.transpileModule(fs.readFileSync(path.resolve(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const terms={};
new Function('exports',transpile('../src/lib/legal-procedure-terms.ts'))(terms);
const durationModule={};
new Function('exports','require',transpile('../src/features/map/map-durations.ts'))(durationModule,name=>{
 if(name==='@/lib/legal-copy')return {nodeDuration:()=>null};
 if(name==='@/lib/legal-procedure-terms')return {procedureGroupTitle:terms.procedureGroupTitle};
 throw Error('Unexpected import '+name);
});
const {mapCardPeriod,groupProcedurePeriod}=durationModule;
const step=title=>({title,description:'',kind:'step',status:'possible'});
const route={title:'재산명시 신청',kind:'route',status:'possible'};
test('filing route removes preliminaries and duplicated submission, not judicial actions',()=>{
 const original=['집행권원·관할 확인','재산명시 신청서 제출','법원 접수·심사','재산명시명령 송달','채무자 이의 여부','명시기일 지정','재산목록 제출 및 선서'].map(title=>({title,description:'설명'}));
 const cleaned=terms.cleanProcedureSteps(original,route.title);
 assert.deepEqual(cleaned.map(x=>x.title),original.slice(2).map(x=>x.title));
 assert.equal(terms.cleanProcedureSteps(original,'재산명시').length,original.length);
 assert.equal(terms.procedureStepIssues(cleaned,route.title).length,0);
});
test('each asset-disclosure step has its own time scope, never inherited overall time',()=>{
 assert.match(mapCardPeriod(route).label,/전체/);
 const order=mapCardPeriod(step('법원 접수·심사'),route);
 assert.match(order.label,/명령.*1일~3주/);
 const service=mapCardPeriod(step('재산명시명령 송달'),route);
 assert.doesNotMatch(service.label,/1~3개월|전체/);
 const objection=mapCardPeriod(step('채무자 이의 여부'),route);
 assert.match(objection.label,/법정 1주/);
 const hearing=mapCardPeriod(step('명시기일 지정'),route);
 assert.match(hearing.label,/7주~3개월/);
 const list=mapCardPeriod(step('재산목록 제출 및 선서'),route);
 assert.equal(list.label,'지정된 기일 당일');
 const submission=mapCardPeriod(step('재산명시 신청서 제출'),route);
 assert.doesNotMatch(submission.label,/1~3개월|전체/);
});
test('group header reuses route-wide duration without summing individual step deadlines',()=>{
 assert.equal(groupProcedurePeriod({title:'지급명령으로 요청하기',kind:'route'}).label,'전체 약 4~8주');
 assert.equal(groupProcedurePeriod({title:'합의점을 법원에서 찾기',kind:'route'}).label,'전체 약 1~4개월');
 assert.equal(groupProcedurePeriod({title:'민사소송',kind:'route'}).label,'1심 평균 약 5~13개월');
 assert.equal(groupProcedurePeriod({title:'재산명시 신청',kind:'route'}).label,'전체 약 2~4개월');
 const provisional=groupProcedurePeriod({title:'가압류 신청',kind:'route'});
 assert.equal(provisional.label,'전체 기간 근거 미확인');
 assert.equal(provisional.estimated,false);
 assert.equal(groupProcedurePeriod({title:'분류되지 않은 절차',kind:'route'}).estimated,false);
});
test('other procedure steps do not silently inherit route-wide durations',()=>{
 const parent={title:'민사조정 신청',kind:'route'};
 const period=mapCardPeriod(step('신청서 제출'),parent);
 assert.doesNotMatch(period.label,/전체/);
});
test('debtor registry timing is resolved separately from disclosure and clearly identifies one-case evidence',()=>{
 const register={title:'채무불이행자 명부 등재 절차',kind:'route'};
 const full=mapCardPeriod(register);
 assert.match(full.label,/사례 약 6주/);
 assert.match(full.note,/1건/);
 assert.doesNotMatch(full.label,/평균/);
 assert.match(groupProcedurePeriod(register).label,/약 6주/);
 const check=mapCardPeriod(step('불응 사실 확인'),register);
 assert.equal(check.category,'variable');
 assert.match(check.note,/사건기록/);
 const apply=mapCardPeriod(step('명부 등재 신청'),register);
 assert.match(apply.label,/접수→결정 사례 약 6주/);
 assert.match(apply.note,/제출에 6주가 필요한 것은 아닙니다/);
 const unknown=mapCardPeriod({title:'분류되지 않은 절차',kind:'route'});
 assert.equal(unknown.category,'variable');
 assert.match(unknown.note,/실제 사건 처리기간/);
});

test('completed preliminary stages must not mark judicial action completed',()=>{
 const snapshot={id:'saved',progress:{'scenario:route:step:0':'done','scenario:route:step:1':'done','scenario:route:step:2':'possible'},
 nodes:[{id:'route',title:'재산명시 신청',scenarioRevealed:3,scenarioIndex:2,
 scenario:{steps:[{title:'집행권원·관할 확인'},{title:'재산명시 신청서 제출'},{title:'법원 명령 심사'}],outcomes:[]}}]};
 const result=terms.normalizeSavedRoadmapTerms(snapshot);
 assert.deepEqual(result.nodes[0].scenario.steps.map(x=>x.title),['법원 명령 심사']);
 assert.equal(result.progress['scenario:route:step:0'],'possible');
 assert.equal(result.nodes[0].scenarioRevealed,1);
});
