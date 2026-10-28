const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1190,height:900},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3200/law-project',{waitUntil:'domcontentloaded',timeout:30000});
 const root=page.locator('[data-law-playback="step1"]');
 await root.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>document.querySelector('[data-law-playback="step1"] .law-showcase-viewport')?.classList.contains('is-live'),{timeout:15000});
 await page.waitForTimeout(2600);
 const check=await root.evaluate(el=>{
  const wrap=el.querySelector('.law-showcase-viewport'),img=wrap.querySelector('img'),frame=wrap.querySelector('iframe');
  return {stage:el.dataset.stage,isLive:wrap.classList.contains('is-live'),fallbackVisibility:getComputedStyle(img).visibility,frameVisibility:getComputedStyle(frame).visibility,frameTransform:getComputedStyle(frame).transform,fallbackComplete:img.complete&&img.naturalWidth>0,framePresent:!!frame};
 });
 await root.screenshot({path:'tests/law-step-01-overlay-after-fix.png'});
 console.log(JSON.stringify({check,errors},null,2));
 await browser.close();
 if(check.isLive!==true||check.fallbackVisibility!=='hidden'||!check.framePresent||errors.length)process.exit(2);
})().catch(e=>{console.error(e);process.exit(1)});
