const {chromium}=require('playwright');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
const data={id:'layout-qa',name:'그래프 레이아웃 품질 검사',createdAt:'2026-10-27T00:00:00.000Z',updatedAt:'2026-10-27T00:00:00.000Z',messages:[],facts:[],sources:[],evidenceStatus:'unverified',nodes:[],edges:[],analysisVersion:0};
const mk=(id,title,kind='route',other={})=>({id,title,kind,description:title+'의 진행 조건과 후속 절차를 상세 화면에서 확인할 수 있습니다. 관련되는 내용은 길어질 수 있습니다.',status:'possible',conditions:[],actions:[],documents:[],cost:'',duration:'',risks:[],sourceIds:[],next:[],...other});
data.nodes=[
mk('start','회사에 해결을 요구한 뒤 진행하는 방법','situation',{status:'current'}),
mk('a','조사와 지급 지연 대응','route',{status:'current',userConfirmed:true,scenario:{suitableWhen:'지급 지연이 계속되며 사업주의 대응이 필요할 때',steps:[{title:'지급 명령 요청',description:'절차를 위한 증빙 준비'},{title:'결정문 송달',description:'사업주에게 서류 송달'},{title:'다음 절차 확인',description:'이의 여부 확인'}],outcomes:[{title:'지급을 받는 경우',description:'절차 종료',condition:'사업주가 지급하면'},{title:'이의 신청이 있는 경우',description:'재판으로 이행',condition:'이의 제기시'},{title:'지급되지 않는 경우',description:'집행 절차',condition:'돈을 지급하지 않으면'}]}}),
mk('b','행정기관 신고와 사실관계 확인'),
mk('c','형사 절차 및 검찰 송치'),
mk('d','추가 재산확인과 집행 경로'),
mk('e','집행이 어려운 경우 대안','outcome'),
mk('f','합의에 따른 지급','outcome')
];
data.edges=[{source:'start',target:'a'},{source:'start',target:'b'},{source:'start',target:'c'},{source:'b',target:'d',label:'행정기관 절차 이후'},{source:'c',target:'e',label:'다른 절차 필요시'},{source:'a',target:'f',label:'지급되는 경우'},{source:'start',target:'d',label:'복합조건'},{source:'d',target:'e'}];
for(const viewport of [{width:1440,height:900},{width:1080,height:740}]){
const page=await browser.newPage({viewport,deviceScaleFactor:1});
const errors=[];
page.on('pageerror',err=>errors.push(err.message));
await page.addInitScript(fixture=>{
 localStorage.setItem('ai-legal-roadmap-cases-v1',JSON.stringify([fixture]));
 localStorage.setItem('ai-legal-roadmap-active-v1',fixture.id);
 localStorage.setItem('ai-legal-roadmap-theme-v1','light');
},data);
await page.goto('http://127.0.0.1:3700/',{waitUntil:'domcontentloaded'});
await page.locator('.react-flow__node').first().waitFor({timeout:18000});
await page.waitForTimeout(1300);
const metrics=await page.evaluate(()=>{
 const nodes=[...document.querySelectorAll('.react-flow__node')].map(x=>({id:x.getAttribute('data-id'),rect:x.getBoundingClientRect(),el:x}));
 const overlap=[];
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
  const a=nodes[i].rect,b=nodes[j].rect;
  const w=Math.min(a.right,b.right)-Math.max(a.left,b.left);
  const h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
  if(w>2&&h>2)overlap.push({a:nodes[i].id,b:nodes[j].id,w,h});
 }
 let crossings=[];
 const paths=[...document.querySelectorAll('.react-flow__edge-path')];
 for(const p of paths){
  const total=p.getTotalLength(),matrix=p.getScreenCTM(),edge=p.closest('.react-flow__edge'),key=edge?.getAttribute('data-id')||'';
  for(let i=1;i<150;i++){
   const point=p.getPointAtLength(total*i/150);
   const view=new DOMPoint(point.x,point.y).matrixTransform(matrix);
   const hit=nodes.find(n=>view.x>n.rect.left+9&&view.x<n.rect.right-9&&view.y>n.rect.top+9&&view.y<n.rect.bottom-9);
   if(hit){crossings.push({edge:key,hit:hit.id});break}
  }
 }
 return {nodeCount:nodes.length,edgeCount:paths.length,overlap,crossings,viewport:document.querySelector('.react-flow__viewport')?.getAttribute('transform'),labels:document.querySelectorAll('.react-flow__edge-text').length};
});
if(metrics.overlap.length||metrics.crossings.length||metrics.edgeCount!==data.edges.length+6||errors.length)throw Error('Layout regression: '+JSON.stringify({metrics,errors}));
if(viewport.width===1440){await page.locator('button.theme-button').click();await page.waitForTimeout(280);}
await page.locator('.react-flow__node[data-id="a"] .stage-open').click();
await page.locator('.detail-panel').waitFor({timeout:5000});
const chosen=await page.locator('.detail-panel h2').innerText();
if(!chosen.includes('조사와 지급 지연 대응'))throw Error('Detail panel did not open the selected node: '+chosen);
await page.locator('.detail-head .icon-btn').first().click();
await page.locator('.react-flow__controls-zoomin').click();
await page.locator('.react-flow__controls-zoomout').click();
await page.mouse.move(viewport.width*.7,viewport.height*.65);
await page.mouse.wheel(0,300);
await page.keyboard.down('Control');await page.mouse.wheel(0,-280);await page.keyboard.up('Control');
await page.waitForTimeout(350);
console.log(JSON.stringify({size:viewport,metrics,errors}));
await page.close();
}
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
