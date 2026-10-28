const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const p=await b.newPage({viewport:{width:1400,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:3200/law-project?showcaseShot=20',{waitUntil:'domcontentloaded'});
const shell=p.locator('[data-law-playback="step4"]');await shell.scrollIntoViewIfNeeded();
await p.waitForFunction(()=>document.querySelector('[data-law-playback="step4"] .law-showcase-viewport')?.classList.contains('is-live'),{timeout:12000});
await p.waitForTimeout(2500);
const child=p.frames().find(f=>f.url().includes('showcaseScene=step4'));
const state=await child.evaluate(()=>{const n=document.querySelector('.react-flow__node[data-id="scenario:wage-labor:outcome:0"]');const r=n?.getBoundingClientRect();return {outcomeX:r?.x,viewport:document.querySelector('.react-flow__viewport')?.style.transform,detail:document.querySelector('.detail-panel h2')?.textContent}});
const shellState=await shell.evaluate(e=>({guide:e.querySelector('.law-scene-guide')?.innerText,zoom:getComputedStyle(e.querySelector('iframe')).transform,imageFallback:getComputedStyle(e.querySelector('.law-showcase-viewport>img')).visibility}));
await shell.screenshot({path:'tests/showcase-final-step4-portfolio.png'});
await p.waitForTimeout(600);
console.log('AFTER_SCREEN',await child.evaluate(()=>({computed:getComputedStyle(document.querySelector('.react-flow__viewport')).transform,rect:document.querySelector('.react-flow__node[data-id="scenario:wage-labor:outcome:0"]').getBoundingClientRect().x,root:document.querySelector('.react-flow__node[data-id="wage-now"]').getBoundingClientRect().x})));
await shell.screenshot({path:'tests/showcase-final-step4-portfolio-second.png'});
console.log(JSON.stringify({state,shellState,errors},null,2));await b.close();
if(errors.length||!state.outcomeX||state.outcomeX>1200||shellState.imageFallback!=='hidden')process.exit(2)
})().catch(e=>{console.error(e);process.exit(1)});