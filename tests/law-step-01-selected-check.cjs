const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const p=await browser.newPage({viewport:{width:1190,height:850}});
 p.on('pageerror',e=>console.error('PAGE_ERROR',e.message));
 await p.goto('http://127.0.0.1:3200/law-project',{waitUntil:'domcontentloaded'});
 const root=p.locator('[data-law-playback="step1"]');await root.scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>document.querySelector('[data-law-playback="step1"]')?.dataset.stage==='2',{timeout:18000}).catch(async e=>{console.log('STAGE_TIMEOUT',e.message.slice(0,100))});
 await p.waitForTimeout(1700);console.log(JSON.stringify(await root.evaluate(el=>({stage:el.dataset.stage,imgVisibility:getComputedStyle(el.querySelector('.law-showcase-viewport>img')).visibility,iframeTransform:getComputedStyle(el.querySelector('iframe')).transform}))));
 await root.screenshot({path:'tests/law-step-01-selected-settled.png'});
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
