const {chromium}=require('playwright');
const fs=require('fs');
const prefix='C:/Users/동호/projects/portfolio-reference-3200/assets/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const items=[['law-step-01.png',2],['law-step-02.png',5],['law-step-03.png',14],['law-step-04.png',20],['law-showcase-main.png',14]];
 const results=[];
 for(const [file,stage] of items){
  const page=await browser.newPage({viewport:{width:1666,height:900},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3700/?showcase=1&showcaseStatic='+stage,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('[data-showcase-stage="'+stage+'"]',{timeout:30000});
  if(stage===5) await page.waitForSelector('.intake-card',{timeout:10000});
  if(stage===14||stage===20){
   await page.waitForSelector('.react-flow__node',{timeout:15000});
   await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);
  const state=await page.evaluate(()=>({
    stage:document.querySelector('[data-showcase-stage]')?.getAttribute('data-showcase-stage'),
    questions:document.querySelectorAll('.intake-card').length,
    nodes:document.querySelectorAll('.react-flow__node').length,
    detail:document.querySelector('.detail-panel h2')?.textContent||'',
    enabled:!(document.querySelector('.composer-send')?.disabled??true),
    text:document.querySelector('.composer textarea')?.value||''
  }));
  await page.screenshot({path:prefix+file,animations:'disabled'});
  results.push({file,stage,bytes:fs.statSync(prefix+file).size,...state,errors});
  await page.close();
 }
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const browserErrors=[];page.on('pageerror',e=>browserErrors.push(e.message));
 await page.goto('http://127.0.0.1:3200/law-project',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForSelector('.law-showcase-step',{timeout:10000});
 const portfolio=await page.evaluate(()=>({
   steps:document.querySelectorAll('.law-showcase-step').length,
   titles:Array.from(document.querySelectorAll('.law-showcase-intro h3')).map(e=>e.textContent),
   main:document.querySelector('.law-main-picture img')?.getAttribute('src'),
   imageUrls:Array.from(document.querySelectorAll('.law-main-picture img,.law-showcase-viewport img')).map(e=>e.getAttribute('src')),
   iframes:document.querySelectorAll('.law-scene-frame').length
 }));
 await page.screenshot({path:'C:/Users/동호/projects/ai-legal-roadmap/tests/law-portfolio-first-screen.png',animations:'disabled'});
 console.log(JSON.stringify({results,portfolio,browserErrors},null,2));
 await browser.close();
 if(portfolio.steps!==4||portfolio.iframes!==4||portfolio.imageUrls.some(x=>!fs.existsSync(prefix+x.split('/').pop()))||browserErrors.length||results.some(x=>x.errors.length)||results[0].enabled!==true||results[2].nodes<4||results[3].nodes<=4)process.exit(2);
})().catch(e=>{console.error(e);process.exit(1)});
