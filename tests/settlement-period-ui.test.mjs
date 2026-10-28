import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const base=(id,title,kind='route')=>({id,title,kind,status:'possible',description:'상황에 맞는 다음 순서를 살펴봐요.',conditions:[],actions:[],documents:[],documentChecklist:[],risks:[],sourceIds:[],cost:'',duration:'',next:[]});
const settlement=base('settlement','합의 시도');
settlement.scenarioRevealed=5;
settlement.description='합의서와 처벌불원서를 준비해요. 합의하면 처분에 유리할 수 있어요.';
settlement.scenario={
 suitableWhen:'서로 조건을 조율하려는 경우',
 steps:[{title:'합의 제안',description:'상대에게 의사를 물어요.'},{title:'합의 협의',description:'합의금과 조건을 협의해요.'},{title:'합의서 작성',description:'합의 내용과 서명 내용을 정리해요.'}],
 outcomes:[{title:'합의 성립',condition:'양측이 동의할 경우',description:'합의서에 서명하고 제출해요.'},{title:'합의 결렬',condition:'상대가 거부하면',description:'다른 방법을 결정해요.'}],
 timing:[{kind:'variable',label:'합의 결과에 따라 달라짐',description:'상대 응답과 서명 시기에 따라 달라져요.',sourceIds:[]}]
};
const unknown=base('unknown','사실관계 추가 검토');
unknown.scenario={steps:[],outcomes:[],timing:[{kind:'variable',label:'자료 확인·상대 회신에 따라 달라짐',description:'자료 수집과 상대 회신을 기다리는 기간이에요.',sourceIds:[]}]};
const root=base('root','현재 상황','situation');root.status='current';
const c={id:'settlement-period-smoke',name:'합의 기간 표시',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[],facts:[],sources:[],nodes:[root,settlement,unknown],edges:[{source:'root',target:'settlement'},{source:'root',target:'unknown'}],evidenceStatus:'partial'};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1680,height:960}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(data=>{localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([data]));localStorage.setItem('ai-legal-roadmap-active-v1',data.id)},c);
 const response=await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded',timeout:25000});
 await page.locator('.stage-title').first().waitFor({timeout:25000});
 await page.waitForTimeout(600);
 const cards=await page.locator('.stage-card').evaluateAll(items=>items.map(e=>({title:e.querySelector('.stage-title')?.textContent?.trim(),period:e.querySelector('.stage-period')?.textContent?.trim()})));
 const expected=new Map([['합의 시도','협의 참고 약 2~4주'],['합의 제안','첫 회신 목표 약 3~7일'],['합의 협의','조건 조율 참고 약 2~4주'],['합의서 작성','작성 목표 약 1~3일'],['합의 성립','합의서 서명·제출 시점 기준'],['합의 결렬','협의 결렬 후 다음 방법 선택'],['사실관계 추가 검토','자료 확인·상대 회신에 따라 달라짐']]);
 for(const [title,need] of expected){
  const card=cards.find(x=>x.title===title);
  assert.ok(card,'지도에서 '+title+' 누락: '+JSON.stringify(cards));
  assert.ok(card.period?.includes(need),title+' 기간 오류: '+card.period);
  await page.getByRole('button',{name:title+' 자세히 알아보기'}).first().evaluate(button=>button.click());
  const detail=page.locator('.detail-panel');
  const actual=(await detail.locator('.detail-metrics dd').first().innerText()).trim();
  assert.equal(actual,card.period,title+' 지도/상세 기간 불일치');
  assert.ok(!(await detail.innerText()).includes('기간을 특정하지 못한 이유'),'이전 이유 헤더 재등장');
 }
 const screenText=await page.locator('body').innerText();
 assert.ok(!screenText.includes('기간 근거 미확인'),'금지 문구가 지도/우측 화면에 재등장');
 assert.ok(errors.length===0,'JS 오류: '+errors.join(','));
 console.log('PASS settlement period UI',response.status(),cards,await page.locator('.procedure-group-duration').allTextContents());
}finally{await browser.close()}
