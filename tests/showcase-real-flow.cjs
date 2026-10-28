const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const p=await browser.newPage({viewport:{width:1400,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:3200/law-project',{waitUntil:'domcontentloaded'});
 const root=p.locator('[data-law-playback="step4"]');await root.scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>document.querySelector('[data-law-playback="step4"]')?.dataset.stage==='20',{timeout:55000});
 await p.waitForTimeout(1700);
 const child=p.frames().find(f=>f.url().includes('showcaseScene=step4'));
 const details=child?await child.evaluate(()=>{
 const vp=document.querySelector('.react-flow__viewport');
 const target=document.querySelector('.react-flow__node[data-id="scenario:wage-labor:outcome:0"]');
 const rect=target?.getBoundingClientRect();
 return {stage:document.querySelector('[data-showcase-stage]')?.getAttribute('data-showcase-stage'),viewport:vp?.style.transform,target:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,detail:document.querySelector('.detail-panel h2')?.textContent};
 }):null;
 const outer=await root.evaluate(e=>({guide:e.querySelector('.law-scene-guide')?.innerText,transform:e.querySelector('iframe')?.style.transform}));
 await root.screenshot({path:'tests/showcase-real-flow-step4-20.png'});
 console.log(JSON.stringify({outer,details,errors},null,2));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
