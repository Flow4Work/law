const{chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const p=await b.newPage({viewport:{width:1666,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:3700/?showcase=1&showcaseStatic=20',{waitUntil:'domcontentloaded'});
 await p.waitForSelector('.react-flow__node[data-id="scenario:wage-labor:outcome:0"]',{timeout:12000});
 await p.waitForTimeout(2200);
 const result=await p.evaluate(()=>{
  const node=document.querySelector('.react-flow__node[data-id="scenario:wage-labor:outcome:0"]');
  const r=node?.getBoundingClientRect();
  return{transform:document.querySelector('.react-flow__viewport')?.style.transform,rect:r?{x:r.x,y:r.y,width:r.width,height:r.height}:null,detail:document.querySelector('.detail-panel h2')?.textContent};
 });
 await p.screenshot({path:'tests/showcase-depth3-corrected.png'});
 console.log(JSON.stringify({result,errors},null,2));
 await b.close();
 if(!result.rect||result.rect.x<60||result.rect.x>1230||errors.length)process.exit(2)
})().catch(e=>{console.error(e);process.exit(1)});
