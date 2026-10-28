import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=(id,title,kind='route')=>({
 id,title,kind,status:'possible',description:'진행 순서와 다음 상황을 확인해요.',
 conditions:[],actions:[],documents:[],risks:[],sourceIds:[],next:[],
});
const routes=[
 {id:'payment',title:'지급명령으로 요청하기',outcomes:2},
 {id:'mediation',title:'합의점을 법원에서 찾기',outcomes:2},
 {id:'suit',title:'바로 소송으로 다투기',outcomes:4},
].map(route=>({
 ...base(route.id,route.title),scenarioRevealed:4,
 scenario:{
  suitableWhen:'사건에 맞춰 선택해요.',
  steps:Array.from({length:3},(_,i)=>({title:route.title+' '+(i+1)+'단계',description:'법원 절차를 진행해요.'})),
  outcomes:Array.from({length:route.outcomes},(_,i)=>({title:route.title+' 결과 '+(i+1),condition:'상황에 따라',description:'결과에 맞춰 대응해요.'}))
 }
}));
const demo={
 id:'map-space-regression',name:'지도 정렬 및 묶음 여백 확인',createdAt:'2026-10-27T08:00:00Z',
 updatedAt:'2026-10-27T08:00:00Z',messages:[{id:'q',role:'user',content:'법원에 신청할 방법을 비교해 주세요.'}],
 nodes:[base('root','현재 진행 상황','situation'),...routes],edges:routes.map(route=>({source:'root',target:route.id})),
 facts:[],sources:[],evidenceStatus:'unverified'
};
const rect=async(page,id)=>page.locator('.react-flow__node[data-id="'+id+'"]').evaluate(el=>{
 const {top,left,width,height}=el.getBoundingClientRect();
 return {top,left,width,height,cy:top+height/2};
});
const nearly=(a,b,tol=2)=>assert.ok(Math.abs(a-b)<tol,`Expected ${a} ~= ${b}`);
const intersects=(a,b)=>Math.min(a.left+a.width,b.left+b.width)>Math.max(a.left,b.left)+1 &&
 Math.min(a.top+a.height,b.top+b.height)>Math.max(a.top,b.top)+1;

test('top and center arrangements reserve clear procedure-header space and never kink a single chain',async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
 try {
  for(const alignment of ['top','center']){
   const context=await browser.newContext({viewport:{width:1800,height:950}});
   await context.addInitScript(({record,alignment})=>{
    localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([record]));
    localStorage.setItem('ai-legal-roadmap-active-v1',record.id);
    localStorage.setItem('legal-roadmap-alignment-v1',alignment);
   },{record:demo,alignment});
   const page=await context.newPage();
   await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
   await page.locator('.procedure-group-bracket>span').first().waitFor({timeout:10000});
   // Let React Flow's initial viewport settle before measuring screen coordinates.
   await page.waitForTimeout(450);
   assert.equal(await page.locator('.procedure-group-bracket>span').count(),3);
   const surface=await page.locator('.canvas-surface').boundingBox();
   for(const route of routes){
    const choice=await rect(page,route.id);
    assert.ok(choice.top>=surface.y+4&&choice.top+choice.height<=surface.y+surface.height-4,
     alignment+': every Depth 2 choice should fit vertically on the first screen');
   }
   const labels=await page.locator('.procedure-group-bracket>span').allTextContents();
   assert.ok(labels.some(label=>label.includes('지급명령 절차')&&label.includes('전체 약 4~8주')));
   assert.ok(labels.some(label=>label.includes('법원 조정 절차')&&label.includes('전체 약 1~4개월')));
   assert.ok(labels.some(label=>label.includes('민사소송 절차')&&label.includes('1심 평균 약 5~13개월')));
   const allRects=await page.locator('.react-flow__node-stage').evaluateAll(els=>els.map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,id:el.getAttribute('data-id')};
   }));
   const bracketRects=await page.locator('.procedure-group-bracket>span').evaluateAll(els=>els.map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height};
   }));
   for(const label of bracketRects)for(const card of allRects)
    assert.equal(intersects(label,card),false,`${alignment}: header collides with ${card.id}`);
   for(let i=0;i<allRects.length;i++)for(let j=i+1;j<allRects.length;j++)
    assert.equal(intersects(allRects[i],allRects[j]),false,`${alignment}: cards collide ${allRects[i].id} and ${allRects[j].id}`);
   for(const route of routes){
    const routeRect=await rect(page,route.id);
    const steps=await Promise.all([0,1,2].map(index=>rect(page,'scenario:'+route.id+':step:'+index)));
    for(const step of steps.slice(1))nearly(step.cy,steps[0].cy);
    nearly(routeRect.cy,steps[0].cy);
    const outcomes=await Promise.all(Array.from({length:route.scenario.outcomes.length},(_,index)=>
      rect(page,'scenario:'+route.id+':outcome:'+index)));
    for(let i=1;i<outcomes.length;i++)
     assert.ok(outcomes[i].cy>outcomes[i-1].cy+outcomes[i-1].height,
      alignment+': outcomes must fan out without touching');
    // Dense choice rows take precedence over centering every distant result.
    if(alignment==='center'&&route.id==='payment')
     assert.ok(outcomes[0].cy<routeRect.cy,'upper outcomes should spread upward');
    if(alignment==='center'&&route.id==='suit')
     assert.ok(outcomes.at(-1).cy>routeRect.cy,'lower outcomes should spread downward');
   }
   if(alignment==='center'){
    const root=await rect(page,'root');
    const first=await rect(page,'payment'),last=await rect(page,'suit');
    nearly(root.cy,(first.cy+last.cy)/2);
   }
   // Changing the alignment inside the live map must recalculate every fork.
   const other=alignment==='top'?'center':'top';
   const label=other==='center'?'가운데 정렬로 보기':'위쪽 정렬로 보기';
   await page.locator('.map-alignment-switch button[aria-label="'+label+'"]').click();
   await page.waitForTimeout(300);
   for(const route of routes){
    const lastStep=await rect(page,'scenario:'+route.id+':step:2');
    const outcomes=await Promise.all(Array.from({length:route.scenario.outcomes.length},(_,index)=>
      rect(page,'scenario:'+route.id+':outcome:'+index)));
    const routeRect=await rect(page,route.id);
    nearly(lastStep.cy,routeRect.cy);
    assert.ok(outcomes.at(-1).cy>outcomes[0].cy,'switched layout must keep outcome order');
   }
   await context.close();
  }
 }finally{await browser.close()}
});
