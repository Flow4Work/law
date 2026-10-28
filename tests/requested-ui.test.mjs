import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:850}});
  const messages=[{id:'u1',role:'user',content:'판결문이 있고 압류했는데 회수하지 못했습니다.',createdAt:'2026-10-27T04:00:00.000Z'},{id:'a1',role:'assistant',content:'추가적인 집행 방법을 확인할 수 있어요.',nextAction:'판결문(집행의 근거 문서)과 지급이 확정된 금액을 준비하고, 상대방의 다른 재산(부동산·자동차·급여 등)을 떠올릴 수 있는 정보를 정리하세요.',createdAt:'2026-10-27T04:01:00.000Z'}];
  await page.addInitScript(({messages})=>{
   const now='2026-10-27T04:01:00.000Z';
   const c={id:'smoke-case',name:'계좌 압류 후 회수',createdAt:now,updatedAt:now,messages,nodes:[],edges:[],facts:[],sources:[],evidenceStatus:'unverified'};
   localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([c]));
   localStorage.setItem('ai-legal-roadmap-active-v1','smoke-case');
  },{messages});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('.next-action').waitFor({timeout:15000});
  const next=page.locator('.next-action');
  assert.equal(await next.getByText('다음으로 할 일').count(),1);
  const style=await next.evaluate(el=>({bg:getComputedStyle(el).backgroundColor,side:getComputedStyle(el).borderLeftWidth,width:el.getBoundingClientRect().width,pane:el.closest('.conversation-panel').getBoundingClientRect().width}));
  assert.notEqual(style.bg,'rgba(0, 0, 0, 0)');
  assert.ok(style.width<=style.pane);
  assert.ok(parseFloat(style.side)>=2);
  await page.getByRole('button',{name:'모델 연결과 설정'}).click();
  await page.locator('.model-dialog').waitFor();
  assert.equal(await page.locator('.settings-tabs [role="tab"]').count(),2);
  assert.equal(await page.locator('.settings-service-details').evaluate(e=>e.open),false);
  await page.getByRole('tab',{name:'모델 연결'}).click();
  assert.equal(await page.locator('.settings-provider-grid [role="radio"]').count(),4);
  assert.equal(await page.locator('.settings-connect-fields select').count(),0);
  await page.getByRole('tab',{name:/내 모델/}).click();
  await page.locator('.settings-service-details summary').click();
  assert.equal(await page.locator('.settings-service-details').evaluate(e=>e.open),true);
  await page.getByRole('button',{name:'설정 닫기'}).click();
  await page.getByRole('button',{name:'대화 기록'}).click();
  await page.locator('.history-list').waitFor();
  assert.equal(await page.locator('.conversation-list').count(),0);
  assert.equal(await page.locator('.composer').count(),0);
  assert.equal(await page.locator('.history-entry').count(),1);
  await page.locator('.history-entry-open').first().click();
  assert.equal(await page.locator('.history-list').count(),0);
  await page.locator('.next-action').waitFor();
  await page.getByRole('button',{name:'대화 기록'}).click();
  await page.locator('.history-example').click();
  if(width===1440){
   await page.locator('.stage-card.situation-card').first().waitFor({timeout:10000});
   const node=await page.locator('.stage-card.situation-card').first().evaluate(el=>({bg:getComputedStyle(el).backgroundColor,panel:getComputedStyle(el).getPropertyValue('--panel').trim()}));
   console.log('situation',node);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS',width,'next-action and settings and history',style);
  await page.close();
 }
} finally {await browser.close()}
