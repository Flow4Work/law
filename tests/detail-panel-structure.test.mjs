import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const make=(id,title,status,kind='route')=>({
  id,title,status,kind,description:'',conditions:[],actions:[],documents:[],risks:[],sourceIds:[],
  cost:'',duration:'',next:[],summaryLines:[]
 });
 const root=make('start','집행 방법을 살펴봐요','done','situation');
 const disclose=make('disclose','재산명시 신청','current');
 disclose.description='상대가 재산 목록을 내도록 신청해요.';
 disclose.summaryLines=['상대가 재산 목록을 내도록 신청해요.','찾은 재산은 따로 압류해야 해요.'];
 disclose.userConfirmed=true;disclose.scenarioIndex=1;
 disclose.scenario={suitableWhen:'판결이 있고 채무자 재산을 모를 때',steps:[
  {title:'법원 명령 심사·송달',description:'법원의 명령과 송달을 확인해요.'},
  {title:'재산명시기일 지정',description:'출석할 기일을 확인해요.'},
  {title:'재산목록 제출·확인',description:'제출된 재산목록을 확인해요.'}
 ],outcomes:[],timing:[]};
 const inquiry=make('inquiry','재산조회 신청','possible');
 inquiry.description='법원이 상대 재산을 직접 조회해요.';
 inquiry.summaryLines=['법원이 상대 재산을 직접 조회해요.','재산명시 불응 후에 쓸 수 있어요.'];
 inquiry.scenario={steps:[{title:'신청 요건 확인',description:'조회할 수 있는 요건을 확인해요.'}],outcomes:[],timing:[]};
 root.next=['disclose','inquiry'];
 const value={id:'detail-structure',name:'상세 패널 검증',createdAt:'2026-10-27T09:00:00Z',updatedAt:'2026-10-27T09:00:00Z',
  messages:[],nodes:[root,disclose,inquiry],edges:[{source:'start',target:'disclose'},{source:'start',target:'inquiry'}],sources:[],facts:[],evidenceStatus:'partial'};
 for(const theme of ['light','dark']){
  const page=await browser.newPage({viewport:{width:1520,height:860}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({value,theme})=>{
   localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([value]));
   localStorage.setItem('ai-legal-roadmap-active-v1',value.id);
   localStorage.setItem('ai-legal-roadmap-theme-v1',theme);
  },{value,theme});
  await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
  for(const [id,title,lead,second] of [
   ['disclose','재산명시 신청','상대가 재산 목록을 내도록 신청해요.','찾은 재산은 따로 압류해야 해요.'],
   ['inquiry','재산조회 신청','법원이 상대 재산을 직접 조회해요.','재산명시 불응 후에 쓸 수 있어요.']
  ]){
   await page.getByRole('button',{name:title+' 자세히 알아보기'}).evaluate(button=>button.click());
   const detail=page.locator('.detail-panel');
   await detail.waitFor();
   assert.equal((await detail.locator('.detail-summary').innerText()).trim(),lead);
   assert.ok(!(await detail.locator('.detail-summary').innerText()).includes(second));
   assert.equal(await detail.locator('.detail-head .stage-pill').innerText(),title);
   const mapPill=page.locator('.stage-card .stage-pill.stage-keyword').filter({hasText:title}).first();
   const colors=await Promise.all([mapPill,detail.locator('.detail-head .stage-pill')].map(el=>el.evaluate(n=>{
    const style=getComputedStyle(n);
    return {bg:style.backgroundColor,color:style.color,border:style.borderTopColor,radius:style.borderTopLeftRadius};
   })));
   assert.deepEqual(colors[1],colors[0],theme+' '+title+' keyword mismatch');
   if(id==='disclose'){
    assert.equal(await detail.locator('.scenario-timeline li').count(),3);
    const radius=await detail.locator('.timeline-number').first().evaluate(n=>getComputedStyle(n).borderTopLeftRadius);
    assert.equal(radius,'8px');
    assert.equal(await detail.locator('.scenario-timeline li.active').count(),1);
   }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS',theme,'map/detail keyword consistency, single summary, timeline');
  await page.close();
 }
}finally{await browser.close();}
