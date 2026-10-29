'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ReactFlow,Controls,Background,BackgroundVariant,Handle,Position,BaseEdge,MarkerType,useReactFlow,ViewportPortal,type EdgeProps,type NodeProps} from '@xyflow/react';
import {ChevronRight,Check,Clock3} from 'lucide-react';
import type {LegalCase,LegalSource,RoadmapNode} from '@/lib/types';
import {NODE_STATUS} from '@/lib/types';
import {calculateRoadmapLayout,focusedRoadmapPath,roundedRoadmapPath,ROADMAP_CARD,type RoadmapAlignment} from '@/lib/roadmap-layout';
import {routeKeyword,roadmapCardDisplaySummary,roadmapParallelNote} from '@/lib/roadmap-card-copy';
import {mandatoryPrerequisite,separateMandatoryCopy} from '@/lib/legal-prerequisites';
import {mapCardPeriod,groupProcedurePeriod,groupProcedureTitle} from './map-durations';
import {isPortfolioCapture} from '@/lib/portfolio-capture';
import {procedureName} from '@/lib/concise-copy';
function StageNode({data,selected}:NodeProps){
 const d=data as {stage:RoadmapNode;parentRoute?:RoadmapNode;peerRoutes?:RoadmapNode[];legalSources?:LegalSource[];onOpen:()=>void;pending?:boolean;sourcePorts?:number[];targetPorts?:number[];branchHint?:string;isRoot?:boolean};
 const n=d.stage;
 // Saved maps predating the kind field still need factual-root and actionable-route styling.
 const visualKind=n.kind||(d.isRoot?'situation':'route');
 const branchCondition=visualKind==='outcome'||visualKind==='completion'?(n.conditions[0]||d.branchHint):undefined;
 const period=mapCardPeriod({...n,kind:visualKind},d.parentRoute);
 const mandatoryNote=mandatoryPrerequisite({...n,kind:visualKind},d.legalSources);
 const displaySummary=separateMandatoryCopy(roadmapCardDisplaySummary({...n,kind:visualKind},branchCondition),n,mandatoryNote);
 // Three-line descriptions keep their content: a parallel hint is only added when two lines fit.
 const summaryLines=displaySummary.split('\n');
 const shortDescription=summaryLines.length<=2&&summaryLines.every(line=>line.length<=36)&&displaySummary.replace(/\n/g,'').length<=49;
 const parallelNote=!mandatoryNote&&shortDescription?roadmapParallelNote({...n,kind:visualKind},d.peerRoutes||[]):null;
 return <div className={'stage-card status-'+n.status+(visualKind==='situation'?' situation-card':'')+(n.scenario?' scenario-card':'')+(n.scenarioParentId?' process-'+visualKind:'')+(selected?' selected':'')}>
    <button className="stage-open" aria-label={procedureName(n.title)+' 자세히 알아보기'} onClick={e=>{e.stopPropagation();d.onOpen()}}/>
    {(d.targetPorts||[50]).map((percent,i)=><Handle key={i} type="target" id={'in-'+i} position={Position.Left} style={{top:percent+'%'}} className="flow-handle"/>)}
    <div className="stage-card-top"><span className={'stage-pill '+(visualKind==='completion'?'stage-completion':visualKind==='route'?'stage-keyword':n.status)}>{visualKind==='situation'?'내 상황':visualKind==='step'?'진행 절차':visualKind==='outcome'?'가능한 결과':visualKind==='followup'?'후속 절차':visualKind==='completion'?'종료':visualKind==='route'?routeKeyword(n):NODE_STATUS[n.status].label}</span>{n.status==='verify'&&n.kind!=='outcome'&&n.kind!=='completion'&&<span className="stage-state verify">확인 필요</span>}{n.status==='done'&&<span className="stage-state done"><Check size={12}/>완료</span>}</div>
    <div className="stage-title">{procedureName(n.title)}</div>
    <div className={'stage-description'+(branchCondition?' stage-condition':'')+(mandatoryNote?' stage-description-required':'')}>{displaySummary}</div>
    {mandatoryNote&&<div className="stage-required-note" title="법적 필수 선행조건">{mandatoryNote.text}</div>}
    {parallelNote&&<div className="stage-parallel-note">{parallelNote}</div>}
    {d.pending&&<div className="node-future-skeleton" aria-label="아직 확인 중인 절차" aria-hidden="true"><i/><i/></div>}
    {!d.pending&&<div className="stage-card-footer"><span className={'stage-period '+period.category} title={period.note}>{period.label&&<Clock3 size={13}/>} {period.label}</span><span>자세히 보기 <ChevronRight size={13}/></span></div>}
    {(d.sourcePorts||[50]).map((percent,i)=><Handle key={i} type="source" id={'out-'+i} position={Position.Right} style={{top:percent+'%'}} className="flow-handle"/>)}
 </div>;
}
const nodeTypes={stage:StageNode};
function RoadmapConnector({id,sourceX,sourceY,targetX,targetY,markerEnd,style,data}:EdgeProps){
 const outerY=typeof data?.outerY==='number'?data.outerY:Math.min(sourceY,targetY)-75;
 const adjacent=data?.adjacent===true&&targetX>sourceX+40;
 const laneX=typeof data?.laneX==='number'?data.laneX:(sourceX+targetX)/2;
 const exitX=typeof data?.exitX==='number'?data.exitX:sourceX+40;
 const entryX=typeof data?.entryX==='number'?data.entryX:targetX-40;
 // Multiple alternatives share ONE trunk. Only the owner draws it; each
 // alternative draws its own horizontal arrow from the trunk to its card.
 // This creates intentional T-junctions, never unrelated crossed arrows.
 if(adjacent&&data?.sharedBranch===true){
  const minY=typeof data.branchMinY==='number'?data.branchMinY:Math.min(sourceY,targetY);
  const maxY=typeof data.branchMaxY==='number'?data.branchMaxY:Math.max(sourceY,targetY);
  const radius=Math.min(16,Math.max(0,(targetX-laneX)/3));
  const topCurve=minY<sourceY-.5;
  const bottomCurve=maxY>sourceY+.5;
  const trunkTop=minY+(topCurve?radius:0);
  const trunkBottom=maxY-(bottomCurve?radius:0);
  // One owner renders the shared spine; each child renders ONLY its own leg.
  // Never draw a complete selected path on top of a sibling's neutral path.
  const top=Math.abs(targetY-minY)<.5&&topCurve;
  const bottom=Math.abs(targetY-maxY)<.5&&bottomCurve;
  const leg=top
   ?`M ${laneX} ${targetY+radius} Q ${laneX} ${targetY} ${laneX+radius} ${targetY} L ${targetX} ${targetY}`
   :bottom
   ?`M ${laneX} ${targetY-radius} Q ${laneX} ${targetY} ${laneX+radius} ${targetY} L ${targetX} ${targetY}`
   :`M ${laneX} ${targetY} L ${targetX} ${targetY}`;
  const selectedY=typeof data.sharedSelectedY==='number'?data.sharedSelectedY:null;
  const neutralStyle={...style,stroke:'var(--map-edge)',strokeWidth:1.4};
  const activeStyle={...style,stroke:'var(--accent)',strokeWidth:2.1};
  // Paint the entire neutral trunk first. Never split it into separate
  // colored segments: a sibling edge can otherwise overpaint the short
  // rounded join and leave a visible grey gap in the selected red route.
  const spine=`M ${laneX} ${trunkTop} L ${laneX} ${trunkBottom}`;
  // The selected route is one continuous overlay from the source handle all
  // the way to the destination handle. Its last turn uses the exact radius
  // of the shared leg, so the highlight cannot stop before the arrow.
  const activeTop=selectedY!==null&&topCurve&&Math.abs(selectedY-minY)<.5;
  const activeBottom=selectedY!==null&&bottomCurve&&Math.abs(selectedY-maxY)<.5;
  const activePath=selectedY===null?'':activeTop
    ?`M ${sourceX} ${sourceY} L ${laneX} ${sourceY} L ${laneX} ${selectedY+radius} Q ${laneX} ${selectedY} ${laneX+radius} ${selectedY} L ${targetX} ${selectedY}`
    :activeBottom
    ?`M ${sourceX} ${sourceY} L ${laneX} ${sourceY} L ${laneX} ${selectedY-radius} Q ${laneX} ${selectedY} ${laneX+radius} ${selectedY} L ${targetX} ${selectedY}`
    :`M ${sourceX} ${sourceY} L ${laneX} ${sourceY} L ${laneX} ${selectedY} L ${targetX} ${selectedY}`;
  return <>
   {data.branchOwner===true&&<>
    <BaseEdge id={id+'-stem'} path={`M ${sourceX} ${sourceY} L ${laneX} ${sourceY}`} style={neutralStyle}/>
    {trunkBottom>trunkTop+.5&&<BaseEdge id={id+'-spine'} path={spine} style={neutralStyle}/>}
   </>}
   <BaseEdge id={id} path={leg} markerEnd={markerEnd} style={style}/>
   {data.branchOwner===true&&selectedY!==null&&<BaseEdge id={id+'-focused-route'} path={activePath} style={activeStyle}/>}
  </>;
 }
 // Single links use a rounded orthogonal path inside the empty gutter.
 const points=adjacent
  ?[{x:sourceX,y:sourceY},{x:laneX,y:sourceY},{x:laneX,y:targetY},{x:targetX,y:targetY}]
  :[{x:sourceX,y:sourceY},{x:exitX,y:sourceY},{x:exitX,y:outerY},{x:entryX,y:outerY},{x:entryX,y:targetY},{x:targetX,y:targetY}];
 return <BaseEdge id={id} path={roundedRoadmapPath(points)} markerEnd={markerEnd} style={style}/>;
}
const edgeTypes={roadmap:RoadmapConnector};
export function Canvas({value,selected,focusId,onSelect,busy}:{value:LegalCase;selected:string|null;focusId:string|null;onSelect:(id:string)=>void;busy:boolean}){
 const [alignment,setAlignment]=useState<RoadmapAlignment>('top');
 const [alignmentLoaded,setAlignmentLoaded]=useState(false);
 useEffect(()=>{if(!isPortfolioCapture())try{if(localStorage.getItem('legal-roadmap-alignment-v1')==='center')setAlignment('center')}catch{}setAlignmentLoaded(true)},[]);
 useEffect(()=>{if(alignmentLoaded&&!isPortfolioCapture())try{localStorage.setItem('legal-roadmap-alignment-v1',alignment)}catch{}},[alignment,alignmentLoaded]);
 const graph=useMemo(()=>{
  const visible=value.nodes;
  return calculateRoadmapLayout(visible.length?visible:value.nodes,value.edges,alignment);
 },[value.nodes,value.edges,alignment]);
 const {setViewport,getViewport}=useReactFlow();
 const changeAlignment=(next:RoadmapAlignment)=>{
  if(next===alignment)return;
  const anchor=graph.nodes.find(n=>n.id===(selected||focusId))||graph.nodes.find(n=>(n.data.stage as RoadmapNode).kind==='situation')||graph.nodes[0];
  const nextGraph=calculateRoadmapLayout(value.nodes,value.edges,next);
  const nextAnchor=nextGraph.nodes.find(n=>n.id===anchor?.id);
  const root=nextGraph.nodes.find(n=>(n.data.stage as RoadmapNode).kind==='situation');
  const choices=root?nextGraph.edges.filter(edge=>edge.source===root.id).map(edge=>nextGraph.nodes.find(n=>n.id===edge.target)).filter((n):n is typeof nextGraph.nodes[number]=>Boolean(n)):[];
  const bounds=canvasRef.current?.getBoundingClientRect();
  setAlignment(next);
  // 펼친 절차 카드를 보고 있었다면 정렬 후에도 해당 절차 묶음이 화면에 남게 합니다.
  const focusedStage=nextAnchor?.data.stage as RoadmapNode|undefined;
  if(bounds&&focusedStage?.kind==='step'&&focusedStage.scenarioParentId){
   const steps=nextGraph.nodes.filter(n=>{
    const stage=n.data.stage as RoadmapNode;
    return stage.kind==='step'&&stage.scenarioParentId===focusedStage.scenarioParentId;
   });
   if(steps.length>=2){
    const minX=Math.min(...steps.map(n=>n.position.x));
    const maxX=Math.max(...steps.map(n=>n.position.x+ROADMAP_CARD.width));
    const zoom=Math.min(1,Math.max(.42,(bounds.width-48)/(maxX-minX)));
    const y=nextAnchor?.position.y??steps[0].position.y;
    setViewport({x:bounds.width/2-(minX+maxX)/2*zoom,y:bounds.height/2-(y+ROADMAP_CARD.height/2)*zoom,zoom},{duration:200});
    return;
   }
  }
  // 상세 카드를 선택하지 않은 상태라면 Depth 1과 Depth 2 선택지 전체를 프레이밍합니다.
  if(root&&choices.length>=2&&bounds){
   const frame=[root,...choices];
   const left=Math.min(...frame.map(n=>n.position.x));
   const right=Math.max(...frame.map(n=>n.position.x+ROADMAP_CARD.width));
   const top=Math.min(...frame.map(n=>n.position.y));
   const bottom=Math.max(...frame.map(n=>n.position.y+ROADMAP_CARD.height));
   const zoom=Math.min(1,Math.max(.42,Math.min((bounds.width-72)/(right-left),(bounds.height-132)/(bottom-top))));
   setViewport({x:34-left*zoom,y:(bounds.height-(bottom-top)*zoom)/2-top*zoom,zoom},{duration:200});
  }else if(anchor&&nextAnchor){
   const viewport=getViewport();
   setViewport({...viewport,x:viewport.x+(anchor.position.x-nextAnchor.position.x)*viewport.zoom,y:viewport.y+(anchor.position.y-nextAnchor.position.y)*viewport.zoom},{duration:180});
  }
 };
 const canvasRef=useRef<HTMLDivElement>(null);
 const [ready,setReady]=useState(false);
 const initialized=useRef(false);
 const previousNodeIds=useRef(new Set<string>());
 const previousContent=useRef(new Map<string,string>());
 const [updatedIds,setUpdatedIds]=useState<Set<string>>(new Set());
 useEffect(()=>{
  const next=new Map(graph.nodes.map(node=>[node.id,JSON.stringify(node.data.stage)]));
  const changed=new Set([...next].filter(([id,content])=>previousContent.current.size>0&&previousContent.current.get(id)!==content).map(([id])=>id));
  previousContent.current=next;
  setUpdatedIds(changed);
  if(!changed.size)return;
  const timer=setTimeout(()=>setUpdatedIds(new Set()),2800);
  return()=>clearTimeout(timer);
 },[graph.nodes]);
 const procedureGroups=useMemo(()=>{
  const groups=new Map<string,typeof graph.nodes>();
  for(const node of graph.nodes){
   const stage=node.data.stage as RoadmapNode;
   if(stage.kind!=='step'||!stage.scenarioParentId)continue;
   const existing=groups.get(stage.scenarioParentId)||[];
   existing.push(node);groups.set(stage.scenarioParentId,existing);
  }
  return [...groups.entries()].map(([id,steps])=>{
   const owner=graph.nodes.find(node=>node.id===id);
   const route=owner?.data.stage as RoadmapNode|undefined;
   if(!owner||!route)return null;
   // 연속으로 같은 높이에 놓인 2개 이상의 절차 카드만 실제로 묶습니다.
   // 각 끝점은 카드의 바깥 모서리 대신 중앙에 맞춰 불필요한 긴 점선을 피합니다.
   if(steps.length<2)return null;
   const ys=steps.map(item=>item.position.y);
   if(Math.max(...ys)-Math.min(...ys)>2)return null;
   const left=Math.min(...steps.map(item=>item.position.x+ROADMAP_CARD.width/2));
   const right=Math.max(...steps.map(item=>item.position.x+ROADMAP_CARD.width/2));
   const top=Math.min(...ys)-38;
   return {id,title:groupProcedureTitle(route),period:groupProcedurePeriod(route),left,width:right-left,top};
  }).filter((group):group is {id:string;title:string;period:ReturnType<typeof groupProcedurePeriod>;left:number;width:number;top:number}=>Boolean(group));
 },[graph.nodes]);
 const focusedPath=useMemo(()=>focusedRoadmapPath(graph.nodes,graph.edges,selected||focusId),[graph,selected,focusId]);
 const focusedIds=focusedPath.nodeIds;
 const edges=useMemo(()=>{
  // Each shared gutter owns exactly one stem. Find the selected child height
  // once and pass it to that stem owner; child edges only paint their legs.
  const nodeY=new Map(graph.nodes.map(node=>[node.id,node.position.y+ROADMAP_CARD.height/2]));
  const selectedTargets=new Map<string,number>();
  for(const edge of graph.edges){
   if(edge.data?.sharedBranch&&focusedPath.edgeIds.has(edge.id)){
    const y=nodeY.get(edge.target);
    if(y!==undefined)selectedTargets.set(edge.source,y);
   }
  }
  return graph.edges.map(edge=>{
   const highlighted=focusedPath.edgeIds.has(edge.id);
   const sharedSelectedY=edge.data?.sharedBranch?selectedTargets.get(edge.source):undefined;
   const color=highlighted?'var(--accent)':'var(--map-edge)';
   const ownsActiveStem=edge.data?.branchOwner===true&&sharedSelectedY!==undefined;
   return {...edge,data:{...edge.data,selectedBranch:highlighted,sharedSelectedY},
    className:highlighted?'path-focused':ownsActiveStem?undefined:focusedIds?'path-muted':undefined,
    // The owner paints the uninterrupted highlight above all sibling legs.
    zIndex:ownsActiveStem?10:edge.zIndex,
    style:{...edge.style,stroke:color,strokeWidth:highlighted?2.1:1.4},
    markerEnd:{type:MarkerType.ArrowClosed,color,width:12,height:12}};
  });
 },[graph.edges,graph.nodes,focusedPath,focusedIds]);
 const nodes=useMemo(()=>{
  const hasIncoming=new Set(graph.edges.map(edge=>edge.target));
  return graph.nodes.map(n=>{
  const stage=n.data.stage as RoadmapNode;
  const pending=(Boolean(value.intake)||busy)&&stage.kind==='route'&&stage.status==='verify'&&!stage.scenario;
  // Expanded procedure cards remain readable even when another path is focused.
  const dimmed=Boolean(focusedIds&&!focusedIds.has(n.id)&&stage.kind!=='step');
  const className=[!previousNodeIds.current.has(n.id)?'roadmap-node-enter':'',updatedIds.has(n.id)?'roadmap-node-updated':'',dimmed?'roadmap-node-muted':'',focusedIds?.has(n.id)?'roadmap-node-focused':'',focusedIds?.has(n.id)&&n.id!==(selected||focusId)?'roadmap-node-ancestor':''].filter(Boolean).join(' ');
  return {...n,selected:n.id===selected,className,data:{...n.data,isRoot:!hasIncoming.has(n.id),pending,peerRoutes:value.nodes,legalSources:value.sources,parentRoute:value.nodes.find(route=>route.id===stage.scenarioParentId),onOpen:()=>onSelect(n.id)}};
 });
 },[graph.nodes,graph.edges,selected,value.nodes,value.sources,value.intake,busy,onSelect,updatedIds,focusedIds]);
 useEffect(()=>{previousNodeIds.current=new Set(graph.nodes.map(n=>n.id))},[graph.nodes]);
 // The viewport belongs to React Flow; data refreshes and ResizeObserver updates must not reset it.
 useEffect(()=>{
  if(!ready||initialized.current||!graph.nodes.length)return;
  const frame=requestAnimationFrame(()=>{
   if(!canvasRef.current)return;
   initialized.current=true;
   const root=graph.nodes.find(n=>(n.data.stage as RoadmapNode).kind==='situation')||graph.nodes[0];
   // Fit the situation and its immediate choices, NOT every distant outcome.
   // A large final fork must not push the important Depth 2 cards off-screen.
   const choices=graph.edges.filter(edge=>edge.source===root.id)
    .map(edge=>graph.nodes.find(node=>node.id===edge.target))
    .filter((node):node is typeof graph.nodes[number]=>Boolean(node));
   const frame=choices.length?[root,...choices]:[root];
   const top=Math.min(...frame.map(node=>node.position.y));
   const bottom=Math.max(...frame.map(node=>node.position.y+ROADMAP_CARD.height));
   const height=canvasRef.current.clientHeight;
   const zoom=Math.min(1,Math.max(.42,(height-110)/(bottom-top+16)));
   setViewport({x:36-root.position.x*zoom,y:(height-(bottom-top)*zoom)/2-top*zoom,zoom});
  });
  return()=>cancelAnimationFrame(frame);
 },[ready,graph.nodes,setViewport,alignment]);
 const lastFocus=useRef<string|null>(null);
 useEffect(()=>{
  if(!ready||!initialized.current||!focusId||focusId===lastFocus.current)return;
  const node=graph.nodes.find(n=>n.id===focusId);if(!node)return;
  lastFocus.current=focusId;
  const bounds=canvasRef.current?.getBoundingClientRect();if(!bounds)return;
  const stage=node.data.stage as RoadmapNode;
  // In the repeatable capture example, keep the actual fork and its preceding
  // step together, so both results remain visible while opening either detail.
  if(isPortfolioCapture()&&stage.kind==='outcome'&&stage.scenarioParentId){
   const fork=graph.nodes.filter(item=>{
    const entry=item.data.stage as RoadmapNode;
    return entry.scenarioParentId===stage.scenarioParentId&&(entry.kind==='outcome'||entry.kind==='step'&&entry.scenarioStep===(value.nodes.find(route=>route.id===stage.scenarioParentId)?.scenario?.steps.length||0)-1);
   });
   const left=Math.min(...fork.map(item=>item.position.x));
   const right=Math.max(...fork.map(item=>item.position.x+ROADMAP_CARD.width));
   const top=Math.min(...fork.map(item=>item.position.y));
   const bottom=Math.max(...fork.map(item=>item.position.y+ROADMAP_CARD.height));
   const zoom=Math.min(1,(bounds.width-54)/(right-left),(bounds.height-112)/(bottom-top));
   setViewport({x:bounds.width/2-(left+right)/2*zoom,y:bounds.height/2-(top+bottom)/2*zoom,zoom},{duration:210});
   return;
  }
  // 절차가 한 번에 펼쳐질 때 마지막 카드가 잘리지 않도록 연속 단계를 함께 조망합니다.
  // 충분히 넓은 화면에선 해당 방법 카드까지 넣고, 좁으면 절차 카드만 우선 배치합니다.
  if(stage.kind==='step'&&stage.scenarioParentId&&stage.scenarioStep===0){
   const sequence=graph.nodes.filter(item=>{
    const entry=item.data.stage as RoadmapNode;
    return entry.kind==='step'&&entry.scenarioParentId===stage.scenarioParentId;
   });
   if(sequence.length>=2){
    const route=graph.nodes.find(item=>item.id===stage.scenarioParentId);
    const minStep=Math.min(...sequence.map(item=>item.position.x));
    const maxStep=Math.max(...sequence.map(item=>item.position.x+ROADMAP_CARD.width));
    const withRoute=route?minStep-route.position.x+maxStep-minStep:maxStep-minStep;
    const showRoute=Boolean(route&&withRoute+56<=bounds.width);
    const visible=showRoute&&route?[route,...sequence]:sequence;
    const minX=Math.min(...visible.map(item=>item.position.x));
    const maxX=Math.max(...visible.map(item=>item.position.x+ROADMAP_CARD.width));
    const available=Math.max(100,bounds.width-44);
    const zoom=Math.min(1,available/(maxX-minX));
    setViewport({x:bounds.width/2-(minX+maxX)/2*zoom,y:bounds.height/2-(node.position.y+ROADMAP_CARD.height/2)*zoom,zoom},{duration:210});
    return;
   }
  }
  const zoom=1;
  setViewport({x:bounds.width*.5-(node.position.x+ROADMAP_CARD.width/2)*zoom,y:bounds.height*.5-(node.position.y+ROADMAP_CARD.height/2)*zoom,zoom},{duration:180});
 },[focusId,ready,graph.nodes,setViewport]);
 return <div className="canvas-surface" ref={canvasRef}>
  <div className="map-alignment-switch" role="group" aria-label="지도 정렬 방식">
   <button type="button" aria-label="위쪽 정렬로 보기" aria-pressed={alignment==='top'} onClick={()=>changeAlignment('top')}>위쪽 정렬</button>
   <button type="button" aria-label="가운데 정렬로 보기" aria-pressed={alignment==='center'} onClick={()=>changeAlignment('center')}>가운데 정렬</button>
  </div>
  <ReactFlow onInit={()=>setReady(true)} nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
    onNodeClick={(_,n)=>onSelect(n.id)} nodesDraggable={false} nodesConnectable={false}
    elementsSelectable fitViewOptions={{padding:.17,minZoom:.62,maxZoom:1.02}} minZoom={.42} maxZoom={1.6}
    zoomOnScroll={false} panOnScroll zoomActivationKeyCode="Control" zoomOnPinch preventScrolling
    proOptions={{hideAttribution:true}} defaultEdgeOptions={{type:'roadmap'}} className="roadmap-flow" aria-label="가능한 방법과 상황별 선택지 지도" ariaLabelConfig={{'controls.zoomIn.ariaLabel':'확대','controls.zoomOut.ariaLabel':'축소','controls.fitView.ariaLabel':'전체 보기'}}>
    <Background variant={BackgroundVariant.Dots} gap={28} size={.8} color="var(--map-grid-line)"/>
    <ViewportPortal>{procedureGroups.map(group=><div key={group.id} className="procedure-group-bracket" style={{left:group.left,top:group.top,width:group.width}} aria-hidden="true"><svg className="procedure-group-bracket-line" width={group.width} height={35} viewBox={`0 0 ${group.width} 35`} preserveAspectRatio="none"><path d={`M 1 31 L 1 23 Q 1 12 12 12 H ${group.width-12} Q ${group.width-1} 12 ${group.width-1} 23 V 31`}/></svg><span style={{left:group.width/2}} title={group.period.note}><strong>{group.title}</strong><span className={'procedure-group-duration'+(group.period.estimated?'':' is-unverified')}>{group.period.label}</span></span></div>)}</ViewportPortal>
    <Controls showInteractive={false} position="bottom-right" aria-label="지도 크기 조절"><button className="react-flow__controls-button readable-scale" aria-label="읽기 편한 크기로 보기" title="읽기 편한 크기 (100%)" onClick={()=>{const root=graph.nodes.find(n=>(n.data.stage as RoadmapNode).kind==='situation')||graph.nodes[0];if(root)setViewport({x:36-root.position.x,y:86-Math.min(...graph.nodes.map(n=>n.position.y)),zoom:1},{duration:180})}}>1:1</button></Controls>
 </ReactFlow><div className="map-reading-guide"><span className="map-path-key"/>{focusedIds?'빨간 선은 선택한 경로예요':'카드를 눌러 경로를 살펴보세요'}<span className="map-pan-hint">드래그하여 이동</span></div></div>;
}
