const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const URL='http://127.0.0.1:3700/';
const samples=[
 ['wage-fast',0],['deposit-fast',1],['police-fast',2]
];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const outputs=await Promise.all(samples.map(async([preset,index])=>{
   const context=await browser.newContext();
   const page=await context.newPage();
   let apiCalls=0;
   await page.route('**/api/intake',route=>{apiCalls++;return route.fulfill({status:501,body:'UNEXPECTED API'});});
   await page.route('**/api/analyze',route=>{apiCalls++;return route.fulfill({status:501,body:'UNEXPECTED API'});});
   await page.route('**/api/step-details',route=>{apiCalls++;return route.fulfill({status:501,body:'UNEXPECTED API'});});
   await page.goto(URL,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')||'[]').length>0}catch{return false}},null,{timeout:12000});
   await page.locator('.prompt-cards button').nth(index).click();
   await page.getByRole('button',{name:'메시지 보내기'}).click({timeout:10000});
   const starts=[Date.now()];
   for(let i=0;i<3;i++){
    await page.waitForFunction(step=>{
     const s=document.querySelector('.intake-progress strong')?.textContent||'';
     return s.includes('질문 '+step+' /');
    },i+1,{timeout:20000});
    if(i===0)assert(Date.now()-starts[0]>=2700,preset+' initial loading shorter than 3 sec');
    if(i>0)assert(Date.now()-starts[i]>=2700,preset+' intermediate loading shorter than 3 sec');
    if(preset==='wage-fast'&&i===2)await page.locator('.intake-text-area textarea').fill('2026년 8월 퇴사했으며 지급일을 안내받지 못했어요.');
    else await page.locator('.intake-options button').first().click();
    await page.locator('.intake-next').click();
    starts.push(Date.now());
   }
   await page.waitForFunction(preset=>{
    const arr=JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')||'[]');
    return arr.some(c=>c.examplePreset===preset&&!c.intake&&c.nodes.length>=3);
   },preset,{timeout:20000});
   const data=await page.evaluate(preset=>JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')).find(c=>c.examplePreset===preset),preset);
   assert(Date.now()-starts[3]>=2700,preset+' final loading shorter than 3 sec');
   assert(data.nodes.every(n=>n.kind!=='route'||n.scenario?.steps?.length===3));
   assert.equal(apiCalls,0,preset+' unexpectedly called API');
   await context.close();
   return {preset,routeCount:data.nodes.length-1,apiCalls};
  }));
  // A detailed answer must leave the preset and request the existing intake API.
  const context=await browser.newContext();
  const page=await context.newPage();
  let handoff=0;let questionCount=-1;
  await page.route('**/api/intake',async route=>{
   handoff++;const body=route.request().postDataJSON();
   questionCount=body.plan.questions.length;
   const plan={...body.plan,questions:[...body.plan.questions,{question:'추가 정보를 확인할까요?',choices:['네','아니요','모르겠어요'],why:''}]};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({plan})});
  });
  await page.goto(URL,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')||'[]').length>0}catch{return false}},null,{timeout:12000});
  await page.locator('.prompt-cards button').nth(1).click();
  await page.getByRole('button',{name:'메시지 보내기'}).click({timeout:10000});
  await page.locator('.intake-card').waitFor({timeout:20000});
  await page.locator('.intake-options button').first().click();
  await page.locator('.intake-open-text').click();
  await page.locator('.intake-text-area textarea').fill('집주인이 보증금 일부를 돌려주겠다고 문자로 보냈지만 정확한 반환 날짜를 알려주지 않았어요.');
  await page.locator('.intake-next').click();
  await page.waitForFunction(()=>document.querySelector('.intake-progress strong')?.textContent?.includes('질문 2 /'),null,{timeout:12000});
  const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')).find(c=>c.name.includes('보증금')));
  assert.equal(handoff,1);
  assert.equal(questionCount,1);
  assert.equal(data.examplePreset,undefined);
  assert.equal(data.demo,false);
  outputs.push({preset:'detailed-API-handoff',handoff,questionCount});
  await context.close();
  console.log('PASS '+JSON.stringify(outputs));
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
