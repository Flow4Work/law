const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

// Exercise the real TypeScript layout without a browser or external APIs.
const source=fs.readFileSync(path.join(__dirname,'../src/lib/roadmap-layout.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exportsObj={};
vm.runInNewContext(compiled,{exports:exportsObj,require:name=>{
 if(name==='@xyflow/react')return {MarkerType:{ArrowClosed:'arrowclosed'}};
 throw Error('Unexpected import: '+name);
}});
const {calculateRoadmapLayout,focusedRoadmapPath,roundedRoadmapPath,ROADMAP_CARD}=exportsObj;

test('center view balances branches above and below and keeps a single procedure horizontal',()=>{
 const stages=['root','route','first','middle','last'].map(id=>({id,title:id,status:'possible'}));
 const paths=[{source:'root',target:'route'},...['first','middle','last'].map(target=>({source:'route',target}))];
 const centered=calculateRoadmapLayout(stages,paths,'center');
 const map=new Map(centered.nodes.map(n=>[n.id,n]));
 assert.equal(map.get('root').position.y,map.get('route').position.y);
 assert.equal(map.get('route').position.y,map.get('middle').position.y);
 assert.equal(map.get('route').position.y-map.get('first').position.y,map.get('last').position.y-map.get('route').position.y);
 const upper=centered.edges.find(e=>e.target==='first'),lower=centered.edges.find(e=>e.target==='last');
 assert(upper.data.branchMinY<map.get('route').position.y+ROADMAP_CARD.height/2);
 assert(lower.data.branchMaxY>map.get('route').position.y+ROADMAP_CARD.height/2);
 assert.equal(new Set(centered.edges.filter(e=>e.source==='route').map(e=>e.data.laneX)).size,1);
 const top=calculateRoadmapLayout(stages,paths,'top');
 assert.equal(top.nodes.find(n=>n.id==='route').position.y,top.nodes.find(n=>n.id==='first').position.y);
 assert.notEqual(map.get('middle').position.y,top.nodes.find(n=>n.id==='middle').position.y,'center must fan out on both sides, unlike top');
 assert.equal(JSON.stringify(centered),JSON.stringify(calculateRoadmapLayout(stages,paths,'center')),'switching back must restore identical geometry');
});

test('centered branches do not overlap cards or route through unrelated cards',()=>{
 const {nodes,edges}=fixture();const layout=calculateRoadmapLayout(nodes,edges,'center');const map=new Map(layout.nodes.map(n=>[n.id,n]));
 for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++){
  const a=layout.nodes[i],b=layout.nodes[j];assert(a.position.x!==b.position.x||Math.abs(a.position.y-b.position.y)>=ROADMAP_CARD.height);
 }
 for(const edge of layout.edges){const points=routePoints(edge,map);for(let i=1;i<points.length;i++)for(const node of layout.nodes.filter(n=>n.id!==edge.source&&n.id!==edge.target))assert.equal(intersectsSegmentCard(points[i-1],points[i],node),false)}
});

test('four choices remain evenly split above and below even if one has more results',()=>{
 const stages=['root','a','b','c','d','a1','a2','a3'].map(id=>({id,title:id,status:'possible'}));
 const paths=[...['a','b','c','d'].map(target=>({source:'root',target})),...['a1','a2','a3'].map(target=>({source:'a',target}))];
 const {nodes}=calculateRoadmapLayout(stages,paths,'center');const map=new Map(nodes.map(n=>[n.id,n]));
 const rootY=map.get('root').position.y,ys=['a','b','c','d'].map(id=>map.get(id).position.y);
 assert.equal(ys.filter(y=>y<rootY).length,2);assert.equal(ys.filter(y=>y>rootY).length,2);
 assert.equal(rootY-ys[0],ys[3]-rootY);assert.equal(rootY-ys[1],ys[2]-rootY);
});

test('parallel procedures stay horizontal even when their result counts differ',()=>{
 const ids=['root','a','b','c','a1','a2','b1','b2','c1','c2','a-ok','a-no','b-ok','b-no','b-other'];
 const stages=ids.map(id=>({id,title:id,status:'possible'}));
 const paths=[['root','a'],['root','b'],['root','c'],['a','a1'],['a1','a2'],['b','b1'],['b1','b2'],['c','c1'],['c1','c2'],['a2','a-ok'],['a2','a-no'],['b2','b-ok'],['b2','b-no'],['b2','b-other']].map(([source,target])=>({source,target}));
 const layout=calculateRoadmapLayout(stages,paths);
 const map=new Map(layout.nodes.map(n=>[n.id,n]));
 for(const ids of [['a','a1','a2'],['b','b1','b2'],['c','c1','c2']]){
  assert.equal(new Set(ids.map(id=>map.get(id).position.y)).size,1,'a procedure chain must share one horizontal row');
  for(const edge of layout.edges.filter(e=>ids.includes(e.source)&&ids.includes(e.target))){
   const points=routePoints(edge,map);assert.equal(new Set(points.map(p=>p.y)).size,1);
   assert(!roundedRoadmapPath(points).includes('Q'),'a straight connection must never detour through an elbow');
  }
 }
 for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++){
  const a=layout.nodes[i],b=layout.nodes[j];assert(a.position.x!==b.position.x||Math.abs(a.position.y-b.position.y)>=ROADMAP_CARD.height,'reserved branch rows must not overlap');
 }
 for(const edge of layout.edges){const points=routePoints(edge,map);for(let i=1;i<points.length;i++)for(const node of layout.nodes.filter(n=>n.id!==edge.source&&n.id!==edge.target))assert.equal(intersectsSegmentCard(points[i-1],points[i],node),false)}
});

test('a fork continues straight to its first result before branching downward',()=>{
 const stages=['last','first','second','third'].map(id=>({id,title:id,status:'possible'}));
 const {nodes,edges}=calculateRoadmapLayout(stages,['first','second','third'].map(target=>({source:'last',target})));
 const map=new Map(nodes.map(n=>[n.id,n]));
 assert.equal(map.get('last').position.y,map.get('first').position.y);
 assert(map.get('second').position.y>map.get('first').position.y);
 assert(map.get('third').position.y>map.get('second').position.y);
 assert.equal(new Set(edges.map(e=>e.data.laneX)).size,1);
 assert.equal(edges.filter(e=>e.data.branchOwner).length,1);
 const first=edges.find(e=>e.target==='first');assert.equal(new Set(routePoints(first,map).map(p=>p.y)).size,1);
 const shuffled=calculateRoadmapLayout([...stages].reverse(),['first','second','third'].map(target=>({source:'last',target})));
 assert.equal(shuffled.edges.length,3,'incoming ports must work regardless of saved node order');
});

test('Depth 2 keeps compact centered positions when final outcomes grow',()=>{
 const names=['root','upper','middle','lower','upper-step','middle-step','lower-step'];
 const basic=names.map(id=>({id,title:id,kind:id==='root'?'situation':id.includes('step')?'step':'route',status:'possible'}));
 const links=[['root','upper'],['root','middle'],['root','lower'],
  ['upper','upper-step'],['middle','middle-step'],['lower','lower-step']].map(([source,target])=>({source,target}));
 const endings=[
  ...['upper','middle','lower'].flatMap((branch,group)=>Array.from({length:group===2?4:2},(_,i)=>({
   id:branch+'-result-'+i,title:branch+' result '+i,kind:'outcome',status:'possible',
   source:branch+'-step'
  })))
 ];
 for(const alignment of ['top','center']){
  const before=calculateRoadmapLayout(basic,links,alignment);
  const after=calculateRoadmapLayout([...basic,...endings],[
   ...links,...endings.map(({id,source})=>({source,target:id}))
  ],alignment);
  const original=new Map(before.nodes.map(node=>[node.id,node.position.y]));
  const positions=new Map(after.nodes.map(node=>[node.id,node.position.y]));
  for(const id of names)assert.equal(positions.get(id),original.get(id),
   alignment+': downstream results must not move '+id);
  const first=positions.get('upper'),center=positions.get('middle'),last=positions.get('lower');
  assert.equal(center-first,last-center,'immediate choices must remain evenly and tightly spaced');
  assert.ok(center-first<=ROADMAP_CARD.height+60,'Depth 2 must use a compact row pitch');
  if(alignment==='center')assert.equal(positions.get('root'),center,
   'the centered root trunk must line up with the middle choice');
  const resultYs=after.nodes.filter(n=>n.id.includes('-result-')).map(n=>n.position.y);
  assert.ok(Math.min(...resultYs)<first,'upper outcomes should fan upward');
  assert.ok(Math.max(...resultYs)>last,'lower outcomes should fan downward');
  for(let i=0;i<after.nodes.length;i++)for(let j=i+1;j<after.nodes.length;j++){
   const a=after.nodes[i],b=after.nodes[j];
   if(a.position.x===b.position.x)
    assert.ok(Math.abs(a.position.y-b.position.y)>=ROADMAP_CARD.height,
     'no final-outcome collision');
  }
 }
});

function fixture(){
 const ids=['root','a','b','c','d','end'];
 const nodes=ids.map(id=>({id,title:id,kind:id==='root'?'situation':'route',status:'possible'}));
 const edges=['a','b','c','d','end'].map(target=>({source:'root',target}));
 edges.push({source:'a',target:'end'},{source:'c',target:'end'});
 return {nodes,edges};
}
function routePoints(edge,map){
 const s=map.get(edge.source),t=map.get(edge.target);
 const sourceIndex=Number(edge.sourceHandle.slice(4));
 const targetIndex=Number(edge.targetHandle.slice(3));
 const sy=s.position.y+ROADMAP_CARD.height*s.data.sourcePorts[sourceIndex]/100;
 const ty=t.position.y+ROADMAP_CARD.height*t.data.targetPorts[targetIndex]/100;
 const sx=s.position.x+ROADMAP_CARD.width,tx=t.position.x;
 const d=edge.data;
 return d.adjacent
  ?[{x:sx,y:sy},{x:d.laneX,y:sy},{x:d.laneX,y:ty},{x:tx,y:ty}]
  :[{x:sx,y:sy},{x:d.exitX,y:sy},{x:d.exitX,y:d.outerY},{x:d.entryX,y:d.outerY},{x:d.entryX,y:ty},{x:tx,y:ty}];
}
function intersectsSegmentCard(a,b,node){
 const inset=2;
 const x0=node.position.x+inset,x1=node.position.x+ROADMAP_CARD.width-inset;
 const y0=node.position.y+inset,y1=node.position.y+ROADMAP_CARD.height-inset;
 if(Math.abs(a.x-b.x)<1e-5)return a.x>x0&&a.x<x1&&Math.max(a.y,b.y)>y0&&Math.min(a.y,b.y)<y1;
 if(Math.abs(a.y-b.y)<1e-5)return a.y>y0&&a.y<y1&&Math.max(a.x,b.x)>x0&&Math.min(a.x,b.x)<x1;
 throw Error('Non-orthogonal connector detected');
}
test('all connectors route between cards and have stable, separated lanes',()=>{
 const {nodes,edges}=fixture();
 const layout=calculateRoadmapLayout(nodes,edges);
 assert.equal(layout.nodes.length,nodes.length);
 assert.equal(layout.edges.length,edges.length);
 const map=new Map(layout.nodes.map(n=>[n.id,n]));
 for(let i=0;i<layout.nodes.length;i++)for(let j=i+1;j<layout.nodes.length;j++){
  const a=layout.nodes[i],b=layout.nodes[j];
  assert.ok(a.position.x+ROADMAP_CARD.width<=b.position.x||
   b.position.x+ROADMAP_CARD.width<=a.position.x||
   a.position.y+ROADMAP_CARD.height<=b.position.y||
   b.position.y+ROADMAP_CARD.height<=a.position.y,'node boxes must never overlap');
 }
 const lanes=[];
 for(const edge of layout.edges){
  const points=routePoints(edge,map);
  assert.ok(!roundedRoadmapPath(points).includes('NaN'));
  for(let i=1;i<points.length;i++){
   for(const node of layout.nodes.filter(n=>n.id!==edge.source&&n.id!==edge.target)){
    assert.equal(intersectsSegmentCard(points[i-1],points[i],node),false,
      'connector '+edge.source+' -> '+edge.target+' crosses card '+node.id);
   }
  }
  if(edge.data.adjacent){
   lanes.push(edge.data.laneX);
   const s=map.get(edge.source),t=map.get(edge.target);
   assert.ok(edge.data.laneX>=s.position.x+ROADMAP_CARD.width+30);
   assert.ok(edge.data.laneX<=t.position.x-30);
  }else{
   const top=Math.min(...layout.nodes.map(n=>n.position.y));
   const bottom=Math.max(...layout.nodes.map(n=>n.position.y+ROADMAP_CARD.height));
   assert.ok(edge.data.outerY<top||edge.data.outerY>bottom,'skip-column edge must travel around entire map');
  }
 }
 const grouped=new Map();
 for(const edge of layout.edges.filter(e=>e.data.adjacent)){
  const key=edge.source+':'+map.get(edge.source).position.x;
  if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(edge);
 }
 for(const group of grouped.values()){
  assert.equal(new Set(group.map(e=>e.data.laneX)).size,1,'one source must use one aligned fork trunk');
  assert.equal(group.filter(e=>e.data.branchOwner).length,1,'draw shared trunk exactly once');
  assert.ok(group.every(e=>e.data.sharedBranch===(group.length>1)));
 }
 assert.ok(new Set(lanes).size>=3,'different sources have independent lanes');
});

test('selected procedure step highlights every previous depth and arrow, but not later alternatives',()=>{
 const stages=['root','route','step-1','step-2','step-3','other'].map(id=>({
  id,title:id,kind:id==='root'?'situation':id.startsWith('step-')?'step':'route',status:'possible',
  scenarioParentId:id.startsWith('step-')?'route':undefined,
 }));
 const links=[['root','route'],['root','other'],['route','step-1'],['step-1','step-2'],['step-2','step-3']].map(([source,target])=>({source,target}));
 const {nodes,edges}=calculateRoadmapLayout(stages,links);
 const focus=focusedRoadmapPath(nodes,edges,'step-3');
 assert.equal([...focus.nodeIds].sort().join(','),['root','route','step-1','step-2','step-3'].sort().join(','));
 assert.equal(edges.filter(edge=>focus.edgeIds.has(edge.id)).map(edge=>edge.source+'>'+edge.target).join(','),
  ['root>route','route>step-1','step-1>step-2','step-2>step-3'].join(','));
 assert.equal(focus.nodeIds.has('other'),false);
 const second=focusedRoadmapPath(nodes,edges,'step-2');
 assert.equal(second.nodeIds.has('step-3'),false);
});

test('selected route highlights only its own ancestry, never siblings or later branches',()=>{
 const stages=['root','a','b','c','later','terminal'].map(id=>({
  id,title:id,kind:id==='root'?'situation':'route',status:'possible',
 }));
 const links=[
  {source:'root',target:'a'}, {source:'root',target:'b'},
  {source:'root',target:'c'}, {source:'b',target:'later'},
  {source:'later',target:'terminal'},
 ];
 const {nodes,edges}=calculateRoadmapLayout(stages,links);
 const focus=focusedRoadmapPath(nodes,edges,'b');
 const selected=edges.filter(edge=>focus.edgeIds.has(edge.id)).map(edge=>edge.source+'>'+edge.target);
 assert.equal(selected.join(','),'root>b','only edge into the selected option must turn red');
 assert.ok(focus.nodeIds.has('root'));
 assert.ok(focus.nodeIds.has('b'));
 assert.ok(!focus.nodeIds.has('a'));
 assert.ok(!focus.nodeIds.has('c'));
 assert.ok(!focus.nodeIds.has('later'));
 const target=edges.find(edge=>edge.target==='b');
 assert.ok(target.data.sharedBranch);
 assert.equal(edges.filter(e=>e.source==='root'&&e.data.branchOwner).length,1);
 const noSelection=focusedRoadmapPath(nodes,edges,null);
 assert.equal(noSelection.nodeIds,null);
 assert.equal(noSelection.edgeIds.size,0);
});
