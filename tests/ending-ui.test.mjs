import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const make=(id,title,kind='route')=>({id,title,kind,status:'possible',description:title+'를 진행하는 경우예요.',conditions:[],actions:[],documents:[],documentChecklist:[],risks:[],sourceIds:[],cost:'',duration:'',next:[]});
const root=make('root','현재 상황','situation');root.status='current';
const route=make('route','합의 및 이행 확인');
route.scenarioRevealed=3;
route.scenario={
 suitableWhen:'협의가 가능한 상황',
 steps:[{title:'합의 제안',description:'합의 조건을 제안해요.'},{title:'답변 확인',description:'상대 회신을 확인해요.'}],
 outcomes:[
  {title:'합의 성립',condition:'서로 동의한 경우',description:'협의 절차가 종료돼요.',terminal:true,nextSteps:[]},
  {title:'합의 불성립',condition:'합의하지 못한 경우',description:'다음 대응을 선택해요.',terminal:false,nextSteps:[
   {title:'추가 방법 확인',description:'다른 해결 방법을 확인해요.'},
   {title:'신청 여부 결정',description:'필요한 신청을 결정해요.'}
  ]}
 ]};
const c={id:'ending-ui-smoke',name:'종료와 후속 경로 확인',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[],facts:[],sources:[],nodes:[root,route],edges:[{source:'root',target:'route'}],evidenceStatus:'partial'};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1650,height:930}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(data=>{localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([data]));localStorage.setItem('ai-legal-roadmap-active-v1',data.id)},c);
 await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded',timeout:25000});
 await page.locator('.stage-card.process-completion').waitFor({timeout:15000});
 assert.equal(await page.locator('.stage-card.process-completion').count(),1);
 assert.equal(await page.locator('.stage-card.process-followup').count(),2);
 await page.locator('.stage-card.process-completion .stage-pill').getByText('종료').waitFor({state:'visible',timeout:10000});
 assert.match((await page.locator('.stage-card.process-completion .stage-pill').textContent())||'',/종료/);
 await page.getByRole('button',{name:'합의 및 이행 확인 자세히 알아보기'}).first().evaluate(el=>el.click());
 const detail=page.locator('.detail-panel');
 assert.equal(await detail.locator('.detail-results-grid.has-ending').count(),1);
 assert.equal(await detail.locator('.detail-completion-column').count(),1);
 assert.equal(await detail.locator('.detail-outcomes li').count(),1,'종료 결과가 일반 결과에 중복되어서는 안 됩니다.');
 assert.match(await detail.locator('.detail-outcomes').innerText(),/합의 불성립/);
 assert.doesNotMatch(await detail.locator('.detail-outcomes').innerText(),/합의 성립/);
 assert.match(await detail.locator('.detail-completion-item').innerText(),/합의 성립/);
 for(const width of [1650,980,900]){
  await page.setViewportSize({width,height:930});
  const ongoingBox=await detail.locator('.detail-results-column').first().boundingBox();
  const endingBox=await detail.locator('.detail-completion-column').boundingBox();
  assert.ok(ongoingBox&&endingBox&&endingBox.y>=ongoingBox.y+ongoingBox.height-1,'종료 정보는 결과 아래에 배치되어야 합니다.');
  assert.ok(endingBox.width>=ongoingBox.width-2,'종료 정보가 가느다란 옆 칸으로 눌리면 안 됩니다.');
 }
 await page.setViewportSize({width:1650,height:930});
 await page.getByRole('button',{name:'절차 종료 자세히 알아보기'}).first().evaluate(el=>el.click());
 assert.match(await detail.locator('.detail-head').innerText(),/종료/);
 assert.match(await detail.locator('.detail-metrics').innerText(),/종료 조건 충족 시/);
 await page.getByRole('button',{name:'합의 불성립 자세히 알아보기'}).first().evaluate(el=>el.click());
 assert.match(await detail.locator('.step-actions').innerText(),/추가 방법 확인/);
 await detail.locator('.step-actions .step-choice').first().click();
 assert.match(await detail.locator('.detail-head').innerText(),/후속 절차/);
 assert.deepEqual(errors,[]);
 console.log('PASS completion and continuation UI');
}finally{await browser.close()}
