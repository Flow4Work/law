const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const cache=new Map();
function load(file){file=path.resolve(__dirname,'../src/lib',file);if(!path.extname(file))file+='.ts';if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(id=>load(path.resolve(path.dirname(file),id)),m,m.exports);return m.exports}
const {mandatoryPrerequisite,separateMandatoryCopy}=load('legal-prerequisites');
const {roadmapCardDisplaySummary}=load('roadmap-card-copy');
const make=(title,kind='route',status='possible')=>({title,kind,status,description:'법원이 상대 재산을 직접 조회해요. 재산명시 불응 후에 쓸 수 있어요.',summaryLines:['법원이 상대 재산을 직접 조회해요.','재산명시 불응 후에 쓸 수 있어요.']});

test('재산조회는 명시 불응만 요구하는 거짓 필수조건을 교체한다',()=>{
 const node=make('재산조회 신청');
 const note=mandatoryPrerequisite(node);
 assert(note?.text.includes('재산명시절차'));
 assert(note?.text.includes('법정 요건'));
 const text=separateMandatoryCopy(roadmapCardDisplaySummary(node),node,note);
 assert.equal(text,'법원이 상대 재산을 직접 조회해요.');
 assert(!text.includes('불응 후'));
});
test('완료 카드에서도 필수요건을 읽고, 일반 권장순서는 빨간색이 아니다',()=>{
 assert(mandatoryPrerequisite(make('재산조회 신청','route','done')));
 for(const title of ['재산조회 결과 확인','재산명시 신청','법원 조정 절차','지급명령 신청','이의 여부 확인']){
  assert.equal(mandatoryPrerequisite(make(title)),null,title);
 }
 assert.equal(mandatoryPrerequisite(make('재산조회 신청','outcome')),null);
});
test('서로 다른 절차의 법정 선행요건을 분류한다',()=>{
 assert(mandatoryPrerequisite(make('채권압류 및 추심 신청'))?.text.includes('근거 문서'));
 assert(mandatoryPrerequisite(make('민사 항소'))?.text.includes('1심 판결'));
 assert(mandatoryPrerequisite(make('지급명령 이의신청'))?.text.includes('송달'));
 assert.equal(mandatoryPrerequisite(make('가압류 신청')),null);
});
test('새로운 분야의 필수 요건은 출처가 검증된 구조화 항목에서만 추가된다',()=>{
 const n={...make('특별 손해배상 신청'),legalPrerequisites:[{type:'required',label:'법정 선행 절차가 필요해요.',sourceIds:['verified']}]};
 assert.equal(mandatoryPrerequisite(n),null);
 const source={id:'verified',kind:'법령',url:'https://law.go.kr/LSW/sample',snippet:'손해배상 신청에는 법정 선행 절차가 필요하다.',title:'손해배상 관련 법령',verifiedAt:'2026-10-27'};
 assert.equal(mandatoryPrerequisite(n,[source])?.origin,'source');
 assert.equal(mandatoryPrerequisite(n,[{...source,url:'https://example.com/unsupported'}]),null);
 assert.equal(mandatoryPrerequisite({...n,legalPrerequisites:[]},[source]),null);
});
