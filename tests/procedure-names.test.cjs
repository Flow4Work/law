const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const file=path.resolve(__dirname,'../src/lib/legal-procedure-terms.ts');
const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleExports={};new Function('exports',js)(moduleExports);
const {normalizeLegalProcedureTerms,normalizeProcedureTitle,procedureGroupTitle,procedureStepIssues,duplicatedFilingSteps,normalizeSavedRoadmapTerms}=moduleExports;
const step=(title,description='내용')=>({title,description});
test('deposit-return map uses natural Korean even for old malformed AI labels',()=>{
 assert.equal(normalizeProcedureTitle('보증금 반환NO'),'보증금 반환 요구');
 assert.equal(normalizeProcedureTitle('보증금 반환ENO'),'보증금 반환 요구');
 assert.equal(normalizeLegalProcedureTerms('보증금 반환EN0'),'보증금 반환 요구');
 assert.equal(normalizeProcedureTitle('보증금 반환소송 검토'),'보증금 반환소송 검토');
 assert.equal(normalizeProcedureTitle('계좌 NO'),'계좌 NO');
 const existing={nodes:[{id:'r1',title:'보증금 반환ENO',description:'임대인에게 보증금 반환하고 열쇠를 반환하는 절차를 검토합니다.',scenario:{steps:[step('보증금 반환NO')],outcomes:[{title:'보증금 반환ENO',description:'보증금 반환NO'}]}}]};
 const normalized=normalizeSavedRoadmapTerms(existing);
 assert.equal(normalized.nodes[0].title,'보증금 반환 요구');
 assert.match(normalized.nodes[0].description,/임대인에게 보증금 반환을 요구하고/);
 assert.equal(normalized.nodes[0].scenario.steps.length,0); // Repeated application is already the route.
 assert.equal(normalized.nodes[0].scenario.outcomes[0].title,'보증금 반환 요구');
 assert.equal(normalized.nodes[0].scenario.outcomes[0].description,'보증금 반환 요구');
});
test('repeated names fold, genuinely distinct legal procedures remain distinct',()=>{
 assert.equal(normalizeProcedureTitle('재산명시·재산명시 신청'),'재산명시 신청');
 assert.equal(procedureGroupTitle('재산명시·재산명시 신청'),'재산명시 신청 절차');
 assert.equal(procedureGroupTitle('재산명시 신청 절차'),'재산명시 신청 절차');
 assert.equal(normalizeProcedureTitle('재산명시·재산조회 신청'),'재산명시·재산조회 신청');
 assert.equal(normalizeProcedureTitle('지급명령·지급명령 신청'),'지급명령 신청');
});
test('no contextual legal name guessing for unknown words',()=>{
 assert.equal(normalizeLegalProcedureTerms('재산추적 확인','재산명시 신청'),'재산추적 확인');
 assert.equal(normalizeLegalProcedureTerms('재산명시 요구','재산조회 신청'),'재산명시 요구');
 assert.equal(normalizeLegalProcedureTerms('재산 명시 신청'),'재산명시 신청');
});
test('duplicate filing is rejected, later court order and debtor asset list are preserved',()=>{
 const bad=[step('재산명시 신청서 제출'),step('재산명시 요구(가명시 후 필요 시)'),step('재산명시명령 송달')];
 assert.deepEqual(duplicatedFilingSteps(bad,'재산명시 신청'),[1]);
 assert(procedureStepIssues(bad,'재산명시 신청').length>=2);
 const valid=[step('재산명시 신청서 제출'),step('법원 재산명시명령 송달'),step('재산명시기일에 재산목록 제출'),step('재산조회 신청')];
 assert.deepEqual(duplicatedFilingSteps(valid,'재산명시'),[]);
 assert.deepEqual(procedureStepIssues(valid,'재산명시'),[]);
 assert(procedureStepIssues(valid,'재산명시 신청').length>0);
});
test('saved map repair merges only repeated filing, remaps reveal and preserves progress',()=>{
 const caseData={id:'c1',progress:{'scenario:r1:step:0':'done','scenario:r1:step:1':'done','scenario:r1:step:2':'possible'},
  nodes:[{id:'r1',title:'재산명시·재산명시 신청',scenarioIndex:2,scenarioRevealed:3,
   scenario:{steps:[step('재산명시 신청서 제출'),step('재산명시 요구(가명시 후 필요 시)'),step('법원 결정 및 명시기일 통지')],outcomes:[]}}]};
 const repaired=normalizeSavedRoadmapTerms(caseData);
 assert.equal(repaired.nodes[0].title,'재산명시 신청');
 assert.deepEqual(repaired.nodes[0].scenario.steps.map(x=>x.title),['법원 결정 및 명시기일 통지']);
 assert.equal(repaired.nodes[0].scenarioRevealed,1);
 assert.equal(repaired.nodes[0].scenarioIndex,0);
 assert.equal(repaired.progress['scenario:r1:step:0'],'possible');
 assert.equal(repaired.progress['scenario:r1:step:1'],undefined);
 assert.equal(repaired.progress['scenario:r1:step:2'],undefined);
 assert.equal(caseData.nodes[0].scenario.steps.length,3);
});
