const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

const entry=(id,kind='route')=>({id,kind,title:id,description:id+' 안내',status:'possible',
 conditions:[],actions:[],documents:[],risks:[],sourceIds:[],next:[]});
const record={id:'connector-routing-qa',name:'분기선 QA',createdAt:'2026-10-28T00:00:00Z',
 updatedAt:'2026-10-28T00:00:00Z',messages:[],facts:[],sources:[],evidenceStatus:'unverified',
 nodes:[entry('root','situation'),entry('choice-a'),entry('choice-b'),entry('choice-c')],
 edges:['choice-a','choice-b','choice-c'].map(target=>({source:'root',target}))};

test('shared branch uses one stem and selection colors only the chosen leg in both alignments',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 try{
  for(const mode of ['top','center']){
   const context=await browser.newContext({viewport:{width:1440,height:850}});
   await context.addInitScript(({data,align})=>{
    localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([data]));
    localStorage.setItem('ai-legal-roadmap-active-v1',data.id);
    localStorage.setItem('legal-roadmap-alignment-v1',align);
   },{data:record,align:mode});
   const page=await context.newPage();
   await page.goto(process.env.MAP_QA_URL||'http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
   await page.locator('.react-flow__edge').first().waitFor({timeout:14000});
   assert.equal(await page.locator('.react-flow__edge-path[id$="-stem"]').count(),1,mode+' one common stem');
   await page.locator('.react-flow__node[data-id="choice-c"] .stage-open').evaluate(el=>el.click());
   await page.waitForTimeout(220);
   const stem=await page.locator('.react-flow__edge-path[id$="-stem"]').evaluate(el=>({d:el.getAttribute('d'),stroke:getComputedStyle(el).stroke}));
   const parts=stem.d.match(/^M ([^ ]+) ([^ ]+) L ([^ ]+) ([^ ]+)/);
   assert(parts,mode+' parse stem');
   assert.notEqual(stem.stroke,'rgb(200, 16, 46)',mode+' neutral shared stem');
   const laneX=Number(parts[3]);
   const overlay=await page.locator('.react-flow__edge-path[id$="-focused-route"]').evaluateAll(els=>els.map(el=>({d:el.getAttribute('d'),stroke:getComputedStyle(el).stroke})));
   assert.equal(overlay.length,1,mode+' one uninterrupted selected-route overlay');
   assert.equal(overlay[0].stroke,'rgb(200, 16, 46)',mode+' overlay highlighted red');
   assert.ok(overlay[0].d.startsWith('M '+parts[1]+' '+parts[2]+' L '+laneX+' '+parts[2]),mode+' highlight starts at the parent port');
   const redBranches=await page.locator('.react-flow__edge.path-focused .react-flow__edge-path').evaluateAll(els=>els.map(el=>({id:el.id,d:el.getAttribute('d'),stroke:getComputedStyle(el).stroke})));
   assert.equal(redBranches.length,1,mode+' only selected child leg highlighted');
   assert.ok(redBranches[0].d.startsWith('M '+laneX+' '),mode+' red leg begins at split, not at parent');
   assert.equal(redBranches[0].stroke,'rgb(200, 16, 46)');
   const neutralPaths=await page.locator('.react-flow__edge:not(.path-focused) .react-flow__edge-path').count();
   assert.ok(neutralPaths>=4,mode+' neutral siblings remain present');
   await context.close();
  }
 }finally{await browser.close();}
});