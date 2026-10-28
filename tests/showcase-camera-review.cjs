const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const shots=[['step1',1],['step1',2],['step2',5],['step2',10],['step3',14],['step3',15],['step4',20],['step4',21]];
 const results=[];
 for(const [scene,stage] of shots){
  const page=await browser.newPage({viewport:{width:1400,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3200/law-project?showcaseShot='+stage,{waitUntil:'domcontentloaded',timeout:30000});
  const shell=page.locator('[data-law-playback="'+scene+'"]');
  await shell.scrollIntoViewIfNeeded();
  await page.waitForFunction(([s,v])=>{
   const el=document.querySelector('[data-law-playback="'+s+'"]');
   return el?.dataset.stage===String(v)&&el?.querySelector('.law-showcase-viewport')?.classList.contains('is-live');
  },[scene,stage],{timeout:12000});
  await page.waitForTimeout(1650);
  const check=await shell.evaluate(el=>{
   const frame=el.querySelector('iframe');
   const guide=el.querySelector('.law-scene-guide');
   const img=el.querySelector('.law-showcase-viewport>img');
   const transform=getComputedStyle(frame).transform;
   const scale=Number(transform.slice(7).split(',')[0]);
   return {stage:el.dataset.stage,guide:guide?.innerText,scale,imgVisible:getComputedStyle(img).visibility,iframePresent:!!frame};
  });
  await shell.screenshot({path:'tests/showcase-camera-'+scene+'-'+stage+'.png'});
  results.push({scene,stage,...check,errors});
  await page.close();
 }
 console.log(JSON.stringify(results,null,2));
 await browser.close();
 if(results.some(x=>x.stage!==String(x.stage)||x.imgVisible!=='hidden'||!x.guide||!x.scale||x.errors.length))process.exit(2);
})().catch(e=>{console.error(e);process.exit(1)});
