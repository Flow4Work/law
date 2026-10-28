const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const mkNode=(id,title,kind,status,description)=>({id,title,kind,status,description,conditions:[],actions:[],documents:[],cost:'',duration:'',risks:[],sourceIds:[],next:kind==='situation'?['intake-route-0','intake-route-1']:[]});
const original='퇴사했는데 임금이 지급되지 않았습니다.';
const plan={original,questions:[{question:'현재 어떤 공식 절차를 진행했나요?',choices:['아직 없습니다','진정 진행 중','판결 받았습니다'],why:'법적 단계에 따라 다릅니다'}],routes:[{title:'지급 청구 검토',description:'청구 가능한 금액을 살펴봐요.'},{title:'공식 절차 검토',description:'진정과 소송의 요건을 구별해요.'}],answers:[]};
const nodes=[mkNode('intake-situation','현재 상황','situation','current',original),mkNode('intake-route-0','지급 청구 검토','route','verify','청구 가능한 금액을 살펴봐요.'),mkNode('intake-route-1','공식 절차 검토','route','verify','진정과 소송의 요건을 구별해요.')];
const edges=[{source:'intake-situation',target:'intake-route-0'},{source:'intake-situation',target:'intake-route-1'}];
const stamp=new Date().toISOString();
const seed={id:'map-regression-case',name:'임금 청구',createdAt:stamp,updatedAt:stamp,messages:[{id:'user1',role:'user',content:original,createdAt:stamp}],nodes,edges, facts:[],sources:[],evidenceStatus:'unverified',intake:plan};
const checks=[];
function check(label,pass,detail=''){checks.push({label,pass,detail});console.log((pass?'PASS ':'FAIL ')+label+' '+detail);}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  const page=await context.newPage();
  const errs=[];
  page.on('pageerror',e=>errs.push(String(e)));
  await page.addInitScript(value=>{localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([value]));localStorage.setItem('ai-legal-roadmap-active-v1',value.id)},seed);
  await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('.roadmap-flow .stage-card').first().waitFor({timeout:15000});
  await page.waitForTimeout(350);
  check('provisional-nodes',await page.locator('.roadmap-flow .stage-card').count()===3);
  check('pending-only-skeleton',await page.locator('.roadmap-flow .node-future-skeleton').count()===2);
  check('friendly-message',(await page.locator('.map-status').innerText()).includes('왼쪽 질문'));
  const css=await page.locator('.diagram-content').evaluate(el=>({margin:getComputedStyle(el).margin,border:getComputedStyle(el).borderTopWidth,overflow:getComputedStyle(el).overflow}));
  check('canvas-fills-panel',css.margin==='0px'&&css.border==='0px',JSON.stringify(css));
  const pane=page.locator('.react-flow__viewport');
  const before=await pane.getAttribute('style');
  const rect=await page.locator('.roadmap-flow').boundingBox();
  await page.mouse.move(rect.x+rect.width*.73,rect.y+rect.height*.63);
  for(let i=0;i<4;i++)await page.mouse.wheel(0,240);
  await page.waitForTimeout(180);
  const after=await pane.getAttribute('style');
  check('wheel-pans-graph',before!==after,after||'');
  check('no-container-scroll',await page.locator('.graph-wrapper').evaluate(el=>el.scrollTop===0&&getComputedStyle(el).overflow==='hidden'));
  const z0=await pane.getAttribute('style');
  await page.keyboard.down('Control');
  await page.mouse.wheel(0,-350);
  await page.keyboard.up('Control');
  await page.waitForTimeout(200);
  const z1=await pane.getAttribute('style');
  check('ctrl-wheel-graph-change',z0!==z1,z1||'');
  await page.locator('.react-flow__controls-zoomout').click({timeout:5000});
  await page.locator('.react-flow__controls-zoomin').click({timeout:5000});
  await page.locator('.react-flow__controls-fitview').click({timeout:5000});
  check('controls-available',await page.locator('.react-flow__controls-button').count()===3);
  for(const w of [1050,1620,1120]){await page.setViewportSize({width:w,height:800});await page.waitForTimeout(100);}
  check('resize-graph-intact',await page.locator('.roadmap-flow .stage-card').count()===3);
  check('edges-intact',await page.locator('.roadmap-flow .react-flow__edge').count()===2);
  check('no-pageerror',errs.length===0,errs.join(' | '));
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:/선택지 보기/}).click();
  check('mobile-map',await page.locator('.mobile-roadmap-list:visible .mobile-roadmap-card').count()===3);
  check('mobile-status',await page.locator('.map-status:visible').count()===1);
  console.log('SUMMARY '+JSON.stringify(checks));
  if(checks.some(v=>!v.pass))process.exitCode=1;
 }catch(e){console.log('BROWSER_FAILURE',e.stack||e.message);process.exitCode=1;}
 finally{await browser.close();}
})();