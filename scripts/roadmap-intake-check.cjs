const {chromium}=require('playwright');
const original='퇴직 후 임금이 지급되지 않았어요.';
const mkNode=(id,title,kind,status,description,next=[])=>({id,title,kind,status,description,next,conditions:[],actions:[],documents:[],cost:'',duration:'',risks:[],sourceIds:[]});
const routes=[{title:'체불 금액 확인',description:'아직 지급되지 않은 항목을 확인해요.'},{title:'공식 구제 검토',description:'현재 단계에서 가능한 방법을 살펴봐요.'}];
const qs=[{question:'어떤 절차까지 진행했나요?',choices:['아직 시작 전','접수 진행 중','공식 결정 받음']},{question:'지급하지 않은 항목은 무엇인가요?',choices:['급여','퇴직금','둘 다']},{question:'관련 서류를 가지고 있나요?',choices:['있어요','일부만 있어요','아직 없어요']}];
const plan={original,routes,questions:[qs[0]],answers:[]};
const stamp=new Date().toISOString();
const seed={id:'map-intake-smoke',name:'체불임금',createdAt:stamp,updatedAt:stamp,
 messages:[{id:'start',role:'user',content:original,createdAt:stamp}],facts:[],sources:[],evidenceStatus:'unverified',intake:plan,
 nodes:[mkNode('intake-situation','현재 상황','situation','current',original,['intake-route-0','intake-route-1']),...routes.map((r,i)=>mkNode('intake-route-'+i,r.title,'route','verify',r.description))],
 edges:[{source:'intake-situation',target:'intake-route-0'},{source:'intake-situation',target:'intake-route-1'}]};
const result={title:'체불임금',answer:'확인한 사항을 바탕으로 다음 방법을 설명해요.',options:[],nextAction:'증빙을 정리해요.',question:'',facts:[],openQuestions:['서류 확인 필요'],followUpQuestions:[],
 nodes:[mkNode('root-rebuilt','현재 상황 정리','situation','current',original,['route-rebuilt','new-procedure']),
 mkNode('route-rebuilt','체불 금액 확인','route','verify','지급받지 못한 금액을 확인해요.'),
 mkNode('new-procedure','법적 절차 검토','route','verify','공식적으로 진행 가능한 절차를 확인해요.')],
 edges:[{source:'root-rebuilt',target:'route-rebuilt'},{source:'root-rebuilt',target:'new-procedure'}]};
const results=[];
const check=(name,ok,detail='')=>{results.push([name,ok]);console.log((ok?'PASS ':'FAIL ')+name+' '+detail)};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1460,height:860}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/models',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({
    defaultId:'glm:flash',models:[{id:'glm:flash',name:'테스트 모델',provider:'glm',model:'glm-5.3-flash',source:'test',available:true}],
    connections:[],lawApiConnected:false})}));
  await page.route('**/api/intake',async route=>{
    const data=route.request().postDataJSON();
    const stage=data.plan.answers.length;
    const expanded={...data.plan,questions:qs.slice(0,Math.min(3,stage+1)),complete:false};
    await new Promise(done=>setTimeout(done,90));
    await route.fulfill({contentType:'application/json',body:JSON.stringify({plan:expanded})});
  });
  let analyzeCalls=0;
  await page.route('**/api/analyze',async route=>{
    analyzeCalls++;
    if(analyzeCalls===2){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'일시적인 연결 오류'})});return;}
    const stream=[
      {type:'status',phase:'sources',message:'공식 자료 확인 중'},
      {type:'status',phase:'reviewing',message:'검토 중'},
      {type:'result',result,sources:[],analysisVersion:3,evidenceStatus:'partial'}
    ].map(x=>'data: '+JSON.stringify(x)+'\n\n').join('');
    await route.fulfill({contentType:'text/event-stream',body:stream});
  });
  await page.addInitScript(value=>{if(!localStorage.getItem('ai-legal-roadmap-cases-v1')){localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([value]));localStorage.setItem('ai-legal-roadmap-active-v1',value.id);}},seed);
  await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
  await page.locator('.roadmap-flow .stage-card').first().waitFor();
  await page.waitForTimeout(400);
  const before=await page.locator('.react-flow__viewport').getAttribute('style');
  for(let index=0;index<3;index++){
   await page.locator('.intake-options button').first().click();
   await page.locator('.intake-next').click();
   if(index<2)await page.locator('.intake-card h2').filter({hasText:qs[index+1].question}).waitFor({timeout:10000});
  }
  await page.getByText('확인한 사항을 바탕으로 다음 방법을 설명해요.').waitFor({timeout:15000});
  check('all-three-answers-processed',analyzeCalls===1);
  check('confirmed-root-id-preserved',await page.locator('.react-flow__node[data-id="intake-situation"]').count()===1);
  check('matching-route-id-preserved',await page.locator('.react-flow__node[data-id="intake-route-0"]').count()===1);
  check('obsolete-route-discarded',await page.locator('.react-flow__node[data-id="intake-route-1"]').count()===0);
  check('new-route-added',await page.locator('.react-flow__node[data-id="new-procedure"]').count()===1);
  check('skeletons-clear-on-result',await page.locator('.node-future-skeleton').count()===0);
  check('viewport-preserved',before===await page.locator('.react-flow__viewport').getAttribute('style'));
  await page.locator('.refresh-map').click();
  await page.getByText('일시적인 연결 오류').waitFor({timeout:15000});
  check('api-error-visible',(await page.locator('.map-status').innerText()).includes('중단'));
  check('api-error-keeps-map',await page.locator('.roadmap-flow .stage-card').count()===3);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.roadmap-flow .stage-card').first().waitFor();
  check('reload-restores-map',await page.locator('.react-flow__node[data-id="new-procedure"]').count()===1);
  check('reload-restores-error-state',(await page.locator('.map-status').innerText()).includes('중단'));
  check('no-page-exceptions',errors.length===0,errors.join(' | '));
  console.log('SUMMARY '+JSON.stringify(results));
  if(results.some(x=>!x[1]))process.exitCode=1;
 }catch(e){console.log('TEST_ERROR',e.stack||e.message);process.exitCode=1}
 finally{await browser.close()}
})();