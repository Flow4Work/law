const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 const stages=[
  ['회사에 요구만 해봤다','100만 원 미만','wage-request'],
  ['노동청 진정이나 법률 구조를 시작했다','100만 원~500만 원','wage-status'],
  ['소송이나 지급명령, 판결까지 진행했다','500만 원 이상','wage-court-status']
 ];
 const outputs=await Promise.all(stages.map(async([progress,amount,route],index)=>{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  let calls=[];
  page.on('request',req=>{if(/\/api\/(intake|analyze|step-details)/.test(req.url()))calls.push(req.url())});
  try {
   await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(700);
   await page.getByRole('button',{name:/퇴사했는데 아직 월급을 못 받았어요/}).click();
   const send=page.getByRole('button',{name:'메시지 보내기'});
   await page.waitForTimeout(300);console.log('PROBE '+index,await page.locator('.composer textarea').inputValue(),await send.getAttribute('disabled'));
   assert.equal(await send.isEnabled(),true,'precomputed example should send without a model');
   let t=Date.now();await send.click();
   await page.locator('.intake-card').waitFor({timeout:12000});
   const initialMs=Date.now()-t;
   const initialQ=await page.locator('.intake-card h2').innerText();
   await page.getByRole('button',{name:progress,exact:true}).click();
   t=Date.now();await page.getByRole('button',{name:/이 답변으로 계속/}).click();
   await page.locator('.intake-card h2').getByText(/월급은 어느 정도/).waitFor({timeout:12000});
   const firstMs=Date.now()-t;
   await page.getByRole('button',{name:amount,exact:true}).click();
   t=Date.now();await page.getByRole('button',{name:/이 답변으로 계속/}).click();
   await page.locator('.intake-card textarea').waitFor({timeout:12000});
   const secondMs=Date.now()-t;
   const thirdQ=await page.locator('.intake-card h2').innerText();
   await page.locator('.intake-card textarea').fill('2026년 8월 퇴사, 고용주에게 지급 요청하였으나 미지급 상태입니다.');
   t=Date.now();await page.getByRole('button',{name:/이 답변으로 계속/}).click();
   await page.locator('.react-flow__node[data-id="'+route+'"]').waitFor({timeout:15000});
   const finalMs=Date.now()-t;
   const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')||'[]'));
   const latest=stored.find(c=>c.demo&&c.id!=='portfolio-showcase');
   assert(latest,'saved demo case not found');
   assert.deepEqual(latest.intake,undefined);
   assert.equal(latest.nodes.length,4);
   assert(latest.nodes.some(n=>n.id===route));
   assert.equal(calls.length,0,'demo unexpectedly called API: '+calls.join(' '));
   await page.locator('.react-flow__node[data-id="'+route+'"]').click();
   await page.locator('.detail-panel .step-primary').click();
   await page.locator('.react-flow__node[data-id="scenario:'+route+':step:0"]').waitFor({timeout:9000});
   await page.locator('.detail-panel .step-primary').click();
   await page.locator('.react-flow__node[data-id="scenario:'+route+':outcome:0"]').waitFor({timeout:9000});
   await page.locator('.react-flow__node[data-id="scenario:'+route+':complete:0"]').waitFor({timeout:9000});
   const beforeReload=(await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')||'[]'))).find(c=>c.id===latest.id);
   assert.equal(beforeReload.nodes.find(n=>n.id===route)?.scenarioRevealed,4);
   await page.screenshot({path:require('node:path').join(__dirname,'wage-fast-stage-'+index+'.png')});
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('.react-flow__node[data-id="scenario:'+route+':outcome:0"]').waitFor({timeout:9000});
   assert.equal(calls.length,0,'demo triggered API after expanding flow: '+calls.join(' '));
   const result={index,progress,amount,thirdQ,initialQ,initialMs,firstMs,secondMs,finalMs,nodes:latest.nodes.map(n=>n.id),calls,flowExpanded:true,reloaded:true,detailShown:await page.locator('.detail-panel').count()};
   await context.close();
   return result;
  } catch(e) {await page.screenshot({path:require('node:path').join(__dirname,'wage-fast-ERROR-'+index+'.png')}).catch(()=>{});await context.close();throw Error('Scenario '+index+': '+e.message);}
 }));
 console.log('WAGE_FAST_TEST_RESULTS '+JSON.stringify(outputs));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
