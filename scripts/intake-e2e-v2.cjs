const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>console.log('JS_ERROR',e.message));
 page.on('response',r=>{if(r.url().includes('/api/intake')||r.url().includes('/api/analyze'))console.log('HTTP',r.status(),r.url().split('/api/').at(-1))});
 await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.body.innerText.includes('GLM 5.3 Flash'),null,{timeout:15000});
 await page.getByRole('textbox',{name:'내 상황 입력'}).fill('퇴사했는데 마지막 월급 350만 원을 못 받았어요. 회사에 문자로 요구했지만 해결되지 않았습니다.');
 await page.waitForFunction(()=>!document.querySelector('button[aria-label="메시지 보내기"]')?.disabled,null,{timeout:15000});
 await page.getByRole('button',{name:'메시지 보내기'}).click();
 await page.locator('.intake-card').waitFor({timeout:40000});
 console.log('FIRST',await page.locator('.intake-card h2').innerText());
 for(let round=1;round<=3;round++){
  const card=page.locator('.intake-card');
  if(!(await card.count()))break;
  const current=await card.locator('h2').innerText();
  console.log('ROUND',round,current,'BUTTONS',await card.locator('.intake-options>button').count(),'MAP_NODES',await page.locator('.stage-card').count());
  if(await card.locator('.intake-options>button').count()){
    await card.locator('.intake-options>button').first().click();
  }else{
    await card.locator('textarea').fill(round===1?'노동청 진정이나 소송은 아직 제기하지 않았습니다.':round===2?'퇴사한 지 3개월 됐습니다.':'사업주가 지급을 미루고 있습니다.');
  }
  await card.getByRole('button',{name:'이 답변으로 계속'}).click();
  if(round<3){
    await page.waitForFunction(old=>{const q=document.querySelector('.intake-card h2');const hasFinal=document.querySelector('.assistant-copy:not(.error-copy)');return !!hasFinal||(q&&q.textContent!==old)},current,{timeout:55000}).catch(()=>console.log('NEXT_QUESTION_TIMEOUT'));
  }
 }
 await page.waitForFunction(()=>{const data=JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')||'[]');return data.some(x=>x.messages?.some(m=>m.role==='assistant'&&!m.error)&&!x.intake)},null,{timeout:95000}).catch(()=>console.log('FINAL_TIMEOUT'));
 const state=await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')||'[]');return data.find(x=>x.messages?.some(m=>m.role==='user'&&m.content.includes('350만 원')))});
 console.log('FINAL',JSON.stringify({messages:state?.messages?.length,intake:!!state?.intake,nodes:state?.nodes?.length,assistant:state?.messages?.filter(m=>m.role==='assistant').map(m=>({error:m.error,content:m.content.slice(0,140)}))}));
 await browser.close();
})().catch(e=>{console.error('ERROR',e.stack);process.exitCode=1});