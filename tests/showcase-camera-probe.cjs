const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const p=await browser.newPage({viewport:{width:1666,height:900}});
const stages=[0,1,2,4,5,7,8,10,12,13,14,15,16,17,18,19,20,21];
const selectors=['.prompt-cards','.prompt-cards button:first-child','.composer','.composer-send','.conversation-panel','.intake-card','.intake-options','.analysis-progress','.detail-panel','.detail-panel .step-primary','.react-flow__node[data-id="wage-now"]','.react-flow__node[data-id="wage-request"]','.react-flow__node[data-id="wage-labor"]','.react-flow__node[data-id="scenario:wage-labor:step:0"]','.react-flow__node[data-id="scenario:wage-labor:step:1"]','.react-flow__node[data-id="scenario:wage-labor:step:2"]','.react-flow__node[data-id="scenario:wage-labor:outcome:1"]','.react-flow__node[data-id="scenario:wage-labor:outcome:0"]'];
for(const stage of stages){
 await p.goto('http://127.0.0.1:3700/?showcase=1&showcaseStatic='+stage,{waitUntil:'domcontentloaded'});
 await p.waitForSelector('[data-showcase-stage="'+stage+'"]',{timeout:10000});
 await p.waitForTimeout(350);
 const data=await p.evaluate(selectors=>selectors.map(q=>{const el=document.querySelector(q);if(!el)return null;const r=el.getBoundingClientRect();return [q,Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)]}).filter(Boolean),selectors);
 console.log(JSON.stringify({stage,data}));
}
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});