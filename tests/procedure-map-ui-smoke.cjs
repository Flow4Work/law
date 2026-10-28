const {chromium}=require('playwright');
const {strict:assert}=require('node:assert');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:1680,height:900},deviceScaleFactor:1});
  const caseData={
   id:'sequence-smoke',name:'재산명시 신청 검증',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
   messages:[{id:'u1',role:'user',content:'재산명시 신청 후 다음 절차를 알려주세요',createdAt:new Date().toISOString()},
             {id:'a1',role:'assistant',content:'재산명시 절차를 확인합니다.',createdAt:new Date().toISOString()}],
   facts:[],sources:[],evidenceStatus:'unverified',progress:{},
   nodes:[{id:'situation',kind:'situation',title:'채무자 재산 파악',description:'재산명시로 재산목록을 확인하려고 합니다.',status:'done'},
    {id:'disclosure',kind:'route',title:'재산명시 신청',description:'법원에 채무자 재산목록 제출을 요구합니다.',status:'possible',
     scenarioRevealed:7,scenarioIndex:0,scenario:{
      steps:[
       {title:'집행권원·관할 확인',description:'집행의 근거 서류와 법원을 확인합니다.'},
       {title:'재산명시 신청서 제출',description:'법원에 신청서를 냅니다.'},
       {title:'법원 접수·심사',description:'법원은 신청을 심사합니다.'},
       {title:'재산명시명령 송달',description:'법원은 채무자에게 명령을 전달합니다.'},
       {title:'채무자 이의 여부',description:'이의신청 기간을 확인합니다.'},
       {title:'명시기일 지정',description:'법원에서 기일을 정합니다.'},
       {title:'재산목록 제출 및 선서',description:'명시기일에 재산목록을 제출합니다.'}],
      outcomes:[{title:'재산목록 확인',description:'재산목록을 확인합니다.'}]
     }}],
   edges:[{source:'situation',target:'disclosure'}]
  };
  await page.addInitScript(({c})=>{
   localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([c]));
   localStorage.setItem('ai-legal-roadmap-active-v1',c.id);
  },{c:caseData});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded',timeout:15000});
  await page.locator('.stage-title').first().waitFor({timeout:18000});
  await page.waitForTimeout(1000);
  const titles=await page.locator('.stage-title').allTextContents();
  const cards=await page.locator('.stage-card').evaluateAll(items=>items.map(c=>({
   title:c.querySelector('.stage-title')?.textContent?.trim(),
   period:c.querySelector('.stage-period')?.textContent?.trim()
  })));
  assert(!titles.some(t=>/집행권원·관할 확인|재산명시 신청서 제출/.test(t)),'Duplicate preflight step appeared');
  for(const t of ['법원 접수·심사','재산명시명령 송달','채무자 이의 여부','명시기일 지정','재산목록 제출 및 선서'])assert(titles.includes(t),'Missing stage: '+t);
  assert(cards.find(c=>c.title==='법원 접수·심사')?.period.includes('1일~3주'));
  assert(cards.find(c=>c.title==='채무자 이의 여부')?.period.includes('법정 1주'));
  await page.getByRole('button',{name:'법원 접수·심사 자세히 알아보기'}).first().click();
  await page.waitForTimeout(250);
  const aside=await page.locator('.detail-panel, .method-detail-panel, aside').allTextContents();
  console.log(JSON.stringify({httpStatus:response.status(),titles,cards,aside:aside.slice(-2).map(x=>x.slice(0,450)),errors},null,2));
  if(errors.length)throw Error(errors.join('; '));
  await page.screenshot({path:path.join(__dirname,'..','.ux-backup','procedure-sequence-20261027','ui-smoke.png')});
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
