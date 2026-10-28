const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const p=await b.newPage({viewport:{width:1400,height:900}});
 await p.addInitScript(()=>{
  if(location.port==='3200'){
   window.IntersectionObserver=class {
    constructor(callback){this.cb=callback}
    observe(element){this.cb([{target:element,isIntersecting:true}],this)}
    unobserve(){} disconnect(){} takeRecords(){return[]}
   }
  }
 });
 p.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
 await p.goto('http://127.0.0.1:3200/law-project',{waitUntil:'domcontentloaded'});
 const shell=p.locator('[data-law-playback="step4"]');
 await shell.scrollIntoViewIfNeeded();
 await p.waitForFunction(()=>document.querySelector('[data-law-playback="step4"]')?.dataset.stage==='20',{timeout:50000}, {timeout:50000});
 await p.waitForTimeout(1550);
 const frame=p.frames().find(f=>f.url().includes('showcaseScene=step4'));
 const info=await frame.evaluate(()=>{
  const n=document.querySelector('.react-flow__node[data-id="scenario:wage-labor:outcome:0"]');
  const r=n?.getBoundingClientRect();
  return {stage:document.querySelector('[data-showcase-stage]')?.dataset.showcaseStage,rect:r?{x:r.left,y:r.top,w:r.width,h:r.height}:null,detail:document.querySelector('.detail-panel h2')?.textContent,view:document.querySelector('.react-flow__viewport')?.style.transform};
 });
 await shell.screenshot({path:'tests/showcase-step4-inmotion.png'});
 console.log('DYNAMIC_FLOW '+JSON.stringify(info));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
