import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const make=(id,title,kind='route')=>({
 id,title,kind,description:'이 단계에서 할 일을 확인해요.',status:'possible',
 conditions:[],actions:[],documents:[],documentChecklist:[],risks:[],sourceIds:[],
 cost:'',duration:'',next:[],detailVersion:3
});
const root=make('start','진행 절차','situation');
const plain=make('plain','명부 등재 신청');
plain.scenario={suitableWhen:'신청 요건을 충족할 때',steps:[
 {title:'법원 심사',description:'접수한 자료와 등재 요건을 심사해요.'},
 {title:'등재 결정',description:'법원이 명부 등재 여부를 결정해요.'}
],outcomes:[],timing:[]};
plain.scenarioRevealed=2;
const warned=make('warned','재산조회 신청');
warned.risks=['재산조회 요건을 갖추기 전에 신청하면 신청이 받아들여지지 않을 수 있어요.'];
root.next=['plain','warned'];
const value={id:'detail-risk-check',name:'주의사항 표시 검증',
 createdAt:'2026-10-27T09:00:00Z',updatedAt:'2026-10-27T09:00:00Z',
 messages:[],nodes:[root,plain,warned],edges:[
  {source:'start',target:'plain'},{source:'start',target:'warned'}
 ],sources:[],facts:[],evidenceStatus:'partial'};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message)); page.setDefaultTimeout(6500);
  await page.addInitScript(({value,theme})=>{
   localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([value]));
   localStorage.setItem('ai-legal-roadmap-active-v1',value.id);
   localStorage.setItem('ai-legal-roadmap-theme-v3',theme);
  },{value,theme});
  let fetches=0;
  await page.route('**/api/step-details',async route=>{
   const payload=route.request().postDataJSON();
   assert.equal(payload.purpose,'documents');
   assert.ok(payload.id.startsWith('scenario:plain:step:'));
   assert.equal(payload.case.nodes[0].id,payload.id,'virtual step is included for verification');
   fetches++;
   const risks=payload.id.endsWith(':0')?['법원 절차에서 실제 불응 여부를 확인하지 않으면 신청이 기각될 수 있어요.']:[];
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    node:{...payload.case.nodes[0],detailVersion:3,actions:[],conditions:[],
     documents:[],documentChecklist:[],cost:'',risks,sourceIds:[]},sources:[]
   })});
  });
  await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
  const open=async name=>{
   await page.getByRole('button',{name:name+' 자세히 알아보기'}).evaluate(el=>el.click());
   await page.locator('.detail-panel').waitFor();
  };
  const fold=page.locator('.detail-panel .detail-fold summary').first();
  await open('명부 등재 신청');
  assert.equal((await fold.innerText()).trim(),'준비할 것');
  await open('재산조회 신청');
  assert.equal((await fold.innerText()).trim(),'준비할 것 · 주의사항');
  await fold.click();
  assert.match(await page.locator('.detail-fold-body').first().innerText(),/신청이 받아들여지지/);

  await open('법원 심사');
  assert.equal((await fold.innerText()).trim(),'준비할 것');
  await fold.click();
  await page.getByText('법원 절차에서 실제 불응 여부를 확인하지 않으면 신청이 기각될 수 있어요.').waitFor();
  assert.equal((await fold.innerText()).trim(),'준비할 것 · 주의사항');

  await open('명부 등재 신청'); // route selection
  await open('법원 심사');
  assert.equal((await fold.innerText()).trim(),'준비할 것 · 주의사항','supplement persists after reselect');
  await fold.click();
  await open('명부 등재 신청'); // route selection
  await open('등재 결정');
  assert.equal((await fold.innerText()).includes('주의사항'),false);
  await fold.click();
  await page.waitForFunction(()=>!document.querySelector('.detail-supplement-status'));
  assert.equal((await page.locator('.detail-panel').innerText()).includes('주의사항'),false,'no invented warning for a verified empty step');
  assert.equal(fetches,2,'only new steps are requested');
  assert.deepEqual(errors,[]);
  console.log('PASS',theme,'risk label is conditional and virtual-step caution is cached',fetches);
  await page.close();
 }
}finally{await browser.close();}
