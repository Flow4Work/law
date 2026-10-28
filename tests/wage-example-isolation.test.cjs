const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 try{
  for(const mode of ['typed-wage','deposit-card']){
   const context=await browser.newContext({viewport:{width:1366,height:800}});
   const page=await context.newPage();
   const calls=[];
   await page.route('**/api/models',async route=>route.fulfill({contentType:'application/json',body:JSON.stringify({defaultId:'mock-model',lawApiConnected:true,connections:[],models:[{id:'mock-model',name:'Test Model',provider:'openrouter',model:'mock',source:'mock',available:true}]})}));
   await page.route('**/api/intake',async route=>{const post=route.request().postDataJSON();calls.push(post);await route.fulfill({contentType:'application/json',body:JSON.stringify({plan:{original:post.message,questions:[{question:'정상 AI 확인 질문',why:'test',choices:['첫째','둘째','셋째']}],routes:[{title:'임시 경로',description:'mock'}],answers:[]}})});});
   await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
   await page.waitForTimeout(650);
   if(mode==='typed-wage')await page.locator('.composer textarea').fill('퇴사했는데 아직 월급을 못 받았어요.');
   else await page.getByRole('button',{name:/계약이 끝났는데 보증금을 안 돌려줘요/}).click();
   const send=page.getByRole('button',{name:'메시지 보내기'});
   assert(await send.isEnabled());
   await send.click();
   await page.locator('.intake-card h2').getByText('정상 AI 확인 질문').waitFor({timeout:8000});
   assert.equal(calls.length,1,'Expected normal API route for '+mode);
   const cases=await page.evaluate(()=>JSON.parse(localStorage.getItem('ai-legal-roadmap-cases-v1')||'[]'));
   assert(!cases.some(c=>c.examplePreset==='wage-fast'));
   console.log('ISOLATION_PASS '+mode+' apiCalls='+calls.length);
   await context.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
