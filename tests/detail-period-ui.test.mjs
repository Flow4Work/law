import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1540,height:900}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const makeNode=(id,title,kind='route')=>({id,title,kind,status:'possible',description:'법원 절차를 안내해요.',conditions:[],actions:[],documents:[],documentChecklist:[],risks:[],sourceIds:[],cost:'',duration:'',next:[]});
 const payment=makeNode('civil-payment','지급명령으로 요청하기');
 payment.description='서류 심사로 지급을 요청해요. 상대가 이의하면 소송으로 넘어가요.';
 payment.scenarioRevealed=4;
 payment.scenario={suitableWhen:'상대가 돈을 갚아야 한다는 점을 크게 다투지 않을 때',steps:[
 {title:'신청·서류 심사',description:'신청해요.'},{title:'상대에게 전달',description:'지급명령을 보내요.'},{title:'이의 여부 확인',description:'송달 뒤 2주 이의 여부를 확인해요.'}
 ],outcomes:[
 {title:'이의 없이 확정',condition:'상대가 기한 안에 이의하지 않으면',description:'강제집행의 근거가 될 수 있어요. 그래도 돈을 주지 않으면 재산에서 실제로 받는 절차를 따로 살펴봐요.'},
 {title:'다투면 소송으로',condition:'상대가 적법하게 이의하면',description:'소송으로 넘어가 주장과 증거를 다퉈요. 처음 신청했다고 곧바로 돈을 받는 것은 아니에요.'}
 ],transitions:[{targetId:'civil-suit',condition:'상대가 적법하게 이의하면'}],timing:[]};
 payment.scenario.steps[0].duration='약 2~3주';
 payment.scenario.steps[0].sourceIds=['qa-verified-step'];
 const mediation=makeNode('civil-mediation','합의점을 법원에서 찾기');
 mediation.scenario={suitableWhen:'합의할 여지가 있을 때',steps:[{title:'신청',description:'신청서를 제출해요.'},{title:'의견 조율',description:'조건을 정해요.'},{title:'결과',description:'결론을 확인해요.'}],outcomes:[],timing:[]};
 const suit=makeNode('civil-suit','바로 소송으로 다투기');
 suit.scenario={suitableWhen:'다툼이 있을 때',steps:[{title:'소장 제출',description:'제출해요.'}],outcomes:[],timing:[]};
 const sourced=makeNode('sourced','근거 있는 별도 절차');
 sourced.scenario={steps:[],outcomes:[],timing:[{kind:'estimate',label:'처리과정',description:'',sourceIds:['qa-source'],minDays:60,maxDays:120}]};
 const nodes=[payment,mediation,suit,sourced];
 const c={id:'period-smoke',name:'법률 기간 QA',createdAt:'2026-10-27T09:00:00.000Z',updatedAt:'2026-10-27T09:00:00.000Z',messages:[],facts:[],nodes,edges:[],sources:[],evidenceStatus:'partial'};
 await page.addInitScript(data=>{localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([data]));localStorage.setItem('ai-legal-roadmap-active-v1',data.id);},c);
 await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
 await page.locator('.stage-card').first().waitFor({timeout:20000});
 console.log('NODES',await page.locator('.stage-title').allTextContents());
 for(const [title,needles] of [
  ['이의 없이 확정',['송달 후 법정 2주','확정 뒤 할 일','강제집행','해당 조건']],
  ['다투면 소송으로',['1심 평균 약 6~13개월','소송으로 넘어가면','인지대','상대가 적법하게 이의하면']],
  ['합의점을 법원에서 찾기',['약 1~4개월']],
  ['바로 소송으로 다투기',['1심 평균 약 6~13개월']],
  ['신청·서류 심사',['약 2~3주']],
  ['근거 있는 별도 절차',['약 2~4개월']]
 ]){
  await page.getByRole('button',{name:title+' 자세히 알아보기'}).evaluate(button=>button.click());
  const detail=page.locator('.detail-panel');
  await detail.waitFor();
  const all=await detail.innerText();
  for(const phrase of needles)assert.ok(all.includes(phrase),title+' missed '+phrase+'\n'+all);
  const stage=page.getByRole('button',{name:title+' 자세히 알아보기'}).locator('..');
  const mapPeriod=(await stage.locator('.stage-period').innerText()).trim();
  const detailPeriod=(await detail.locator('.detail-metrics dd').first().innerText()).trim();
  assert.equal(mapPeriod,detailPeriod,title+' 지도/상세 기간이 불일치');
  assert.equal(await detail.locator('.detail-metrics a,.detail-metrics small').count(),0,'복잡한 기간 설명/링크 재등장');
  assert.ok(!all.includes('후속 기간 별도'),title+' unexpected outdated text');
  assert.ok(!all.includes('전체 기간 확인 필요'),title+' unexpected duration placeholder');
  if(title==='이의 없이 확정')assert.ok(!all.includes('이어서 살펴볼 방법'), '확정 갈래에 잘못된 소송 링크가 나타납니다.');
  console.log('PASS',title,all.slice(0,310).replaceAll('\n',' / '));
 }
 assert.deepEqual(errors,[]);
 console.log('PASS no JS errors');
 await page.close();
}finally{await browser.close();}
