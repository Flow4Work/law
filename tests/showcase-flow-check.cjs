const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const p=await browser.newPage({viewport:{width:1666,height:900},deviceScaleFactor:2});
 await p.goto('http://127.0.0.1:3700/?showcase=1&showcaseScene=step4&showcaseTestSpeed=10',{waitUntil:'domcontentloaded'});
 await p.waitForSelector('[data-showcase-stage="20"]',{timeout:20000});
 await p.waitForTimeout(120);
 const report=await p.evaluate(()=>{const v=document.querySelector('.react-flow__viewport');const n=document.querySelector('[data-id="scenario:wage-labor:outcome:0"]');const r=n?.getBoundingClientRect();return{viewport:v?.style.transform,rect:r?{x:r.x,y:r.y,w:r.width,h:r.height}:null,selected:document.querySelector('.detail-panel h2')?.textContent,stage:document.querySelector('[data-showcase-stage]')?.getAttribute('data-showcase-stage')}});
 console.log(JSON.stringify(report));
 if(report.rect&&report.rect.x>0&&report.rect.x<1260){await p.screenshot({path:'C:/Users/동호/projects/portfolio-reference-3200/assets/law-step-04.png'});console.log('Playback capture saved');}
 await browser.close();
})();
