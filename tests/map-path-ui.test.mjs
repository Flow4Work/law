import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const caseRecord={
  id:'map-path-regression',name:'절차 경로 시각 검증',createdAt:'2026-10-27T08:00:00Z',
  updatedAt:'2026-10-27T08:00:00Z',messages:[{id:'q',role:'user',content:'판결을 받은 뒤 다른 재산을 압류하려고 합니다.'}],
  facts:[],sources:[],evidenceStatus:'unverified',
  nodes:[
    {id:'root',kind:'situation',title:'판결 후 재산 압류',description:'판결 이후 다른 재산을 찾아야 하는 상황이에요.',status:'current',conditions:[],actions:[],documents:[],risks:[],sourceIds:[],next:['route','alternative']},
    {id:'route',kind:'route',title:'다른 재산 압류 진행',description:'급여·부동산 등 다른 재산을 살펴봐요.',status:'possible',conditions:[],actions:[],documents:[],risks:[],sourceIds:[],next:[],scenarioRevealed:3,
      scenario:{suitableWhen:'압류할 재산이 확인되면 진행해요.',steps:[
        {title:'채무자 재산 정보 파악',description:'상대의 재산을 찾을 단서를 모아요.'},
        {title:'관할 법원에 강제집행 신청',description:'법원에 신청서와 근거 자료를 내요.'},
        {title:'압류 결정 후 배당요구',description:'압류 결과와 후속 조건을 살펴봐요.'},
      ],outcomes:[]}},
    {id:'alternative',kind:'route',title:'재산정렬 신청',description:'채무자가 재산 목록을 제출하도록 요청해요.',status:'possible',conditions:[],actions:[],documents:[],risks:[],sourceIds:[],next:[]}
  ],
  edges:[{source:'root',target:'route'},{source:'root',target:'alternative'}]
};

test('map keeps clicked procedure ancestry/edges highlighted and all steps readable',async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
  try{
    for(const theme of ['light','dark']){
      const context=await browser.newContext({viewport:{width:1660,height:900}});
      await context.addInitScript(({record,mode})=>{
        localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([record]));
        localStorage.setItem('ai-legal-roadmap-active-v1',record.id);
        localStorage.setItem('ai-legal-roadmap-theme-v3',mode);
      },{record:caseRecord,mode:theme});
      const page=await context.newPage();
      await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
      await page.locator('.react-flow__node:has(.stage-card.process-step)').first().waitFor({timeout:12000});
      assert.equal(await page.locator('.react-flow__node:has(.stage-card.process-step)').count(),3);
      const titles=await page.locator('.react-flow__node .stage-title').allTextContents();
      assert.ok(!titles.some(title=>title.includes('재산정렬')),JSON.stringify({theme,titles}));
      assert.ok(titles.some(title=>title.includes('재산명시')),JSON.stringify({theme,titles}));
      await page.locator('.react-flow__node:has-text("압류 결정 후 배당요구") .stage-open').evaluate(el=>el.click());
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.react-flow__node.roadmap-node-ancestor').count(),4,theme+' ancestry');
      assert.equal(await page.locator('.react-flow__edge.path-focused').count(),4,theme+' arrows');
      const expectedPale=theme==='light'?'rgb(232, 160, 167)':'rgb(185, 107, 118)';
      const ancestorColors=await page.locator('.react-flow__node.roadmap-node-ancestor .stage-card').evaluateAll(items=>items.map(el=>getComputedStyle(el).borderColor));
      assert.ok(ancestorColors.every(color=>color===expectedPale),JSON.stringify({theme,ancestorColors}));
      const selectedStrokeGroups=await page.locator('.react-flow__edge.path-focused').evaluateAll(items=>items.map(edge=>
        [...edge.querySelectorAll('.react-flow__edge-path')].map(path=>getComputedStyle(path).stroke)));
      assert.ok(selectedStrokeGroups.every(colors=>colors.includes('rgb(200, 16, 46)')),
        JSON.stringify({theme,selectedStrokeGroups}));
      assert.equal(await page.locator('.react-flow__node.roadmap-node-muted:has(.stage-card.process-step)').count(),0,theme+' steps should not fade');
      const styles=await page.locator('.react-flow__node:has(.stage-card.process-step) .stage-description').evaluateAll(items=>items.map(el=>({
        color:getComputedStyle(el).color,
        opacity:getComputedStyle(el.closest('.react-flow__node')).opacity,
      })));
      assert.equal(styles.length,3);
      assert.ok(styles.every(item=>item.opacity==='1'),JSON.stringify({theme,styles}));
      assert.ok(new Set(styles.map(item=>item.color)).size===1,JSON.stringify({theme,styles}));
      await context.close();
    }
  }finally{
    await browser.close();
  }
});
