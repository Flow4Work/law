const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const p=await b.newPage({viewport:{width:1400,height:900}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('http://127.0.0.1:3200/law-project',{waitUntil:'domcontentloaded'});
const root=p.locator('[data-law-playback="step4"]');await root.scrollIntoViewIfNeeded();
for(let i=0;i<6;i++){
 await p.waitForTimeout(3000);
 const outer=await root.evaluate(e=>({stage:e.dataset.stage,visible:e.getBoundingClientRect().top,iframe:e.querySelector('iframe')?.src,guide:e.querySelector('.law-scene-guide-counter')?.textContent,live:e.querySelector('.law-showcase-viewport')?.classList.contains('is-live')}));
 console.log('SAMPLE '+i+' '+JSON.stringify(outer));
}
await b.close()})().catch(console.error);