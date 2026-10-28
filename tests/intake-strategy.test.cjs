const fs=require('fs'),path=require('path'),ts=require('typescript'),Module=require('module'),assert=require('node:assert/strict');
const f=path.join(__dirname,'../src/lib/intake.ts');
const compiled=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m=new Module(f,module);m.filename=f;m.paths=module.paths;m._compile(compiled,f);
const {normalizeIntake}=m.exports;
function fake(question,choices=[],routes=[]){return {done:false,question:{question,choices,why:'그 이유가 중요해요.'},routes};}
const original='퇴사했는데 마지막 월급 350만 원을 못 받았어요. 회사에 문자로 요구했지만 해결되지 않았습니다.';
const a=normalizeIntake(fake('퇴사 후 노동청 진정이나 소송 같은 공식 절차를 시작한 적이 있나요?',['아직 없어요','진정 중이에요','판결 받았어요']),original);
assert.equal(a.questions.length,1);
const b=normalizeIntake(fake('노동청이나 법원에서 어떤 절차까지 진행했나요?',['아직 없어요','진정 중이에요','판결 받았어요']),original,{...a,answers:[{choice:'아직 없어요',detail:''}]});
assert.notEqual(b.questions[0].question,b.questions[1].question);assert(!/어떤 절차|공식 절차/.test(b.questions[1].question),b.questions[1].question);
const c=normalizeIntake({done:true,question:null,routes:[]},original,{...b,answers:[...b.answers,{choice:'2026년 7월 10일',detail:''}]});
assert.equal(c.complete,true);assert.equal(c.questions.length,2);
const n=normalizeIntake(fake('퇴사 후 몇 주 지났나요?',['1주일 이내','2주일 이상 1개월 미만','1개월 이상']),'퇴사했어요.');
assert.equal(n.questions[0].choices.length,0);
const k=normalizeIntake(fake('불송치 이유가 무엇인가요?',[],[{title:'검찰 불기소 처분 항고',description:'검찰 불기소에 항고'},{title:'불송치 이의신청 검토',description:'결정문 검토'}]),'경찰 불송치 통지를 받았어요.');
assert(!k.routes.some(r=>r.title.includes('검찰 불기소')));
const {previewIntake,MAX_INTAKE_ROUTES}=m.exports;
for(const count of [1,2,3,4,6,8]){
 const routes=Array.from({length:count},(_,i)=>({title:'서로 다른 경로 '+(i+1),description:'해당 사건에 맞는 독립적인 대응 방법이에요.'}));
 const plan=normalizeIntake(fake('현재 진행 단계는 어디인가요?',[],routes),'여러 해결 방법을 비교하고 싶어요.');
 assert.equal(plan.routes.length,count,'normalization must retain '+count+' routes');
 const preview=previewIntake(plan);
 assert.equal(preview.nodes.length,count+1,'preview must show all '+count+' routes');
 assert.equal(preview.edges.length,count,'each route must remain connected');
}
const overflow=Array.from({length:MAX_INTAKE_ROUTES+2},(_,i)=>({title:'경로 '+i,description:'독립적인 절차'}));
const bounded=normalizeIntake(fake('어떤 단계인가요?',[],overflow),'여러 대응');
assert.equal(bounded.routes.length,MAX_INTAKE_ROUTES,'protect against excessive results without defaulting to three');
const routeHandler=fs.readFileSync(path.join(__dirname,'../src/app/api/intake/route.ts'),'utf8');
assert.match(routeHandler,/routes:\s*\(Array\.isArray\(raw\.routes\).*?\)\.slice\(0,MAX_INTAKE_ROUTES\)/);
const prompt=fs.readFileSync(path.join(__dirname,'../src/lib/intake-strategy.ts'),'utf8');
assert(!/routes는[^\n]+최대 3개/.test(prompt),'AI must not be told to choose exactly three');
console.log('PASS: non-repeated questions, variable route counts 1/2/3/4/6/8, preview graph and safety cap');