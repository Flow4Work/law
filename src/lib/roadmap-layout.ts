import {MarkerType,type Edge,type Node} from '@xyflow/react';
import type {RoadmapEdge,RoadmapNode} from './types';

/** Use one geometry for both React Flow node bounds and edge routing. */
export const ROADMAP_CARD={width:317,height:212} as const;
export type RoadmapAlignment='top'|'center';
// Reserve a genuine routing gutter between columns. Never route inside card bounds.
const COLUMN_GAP=116; // 기본 선택지 간 가로 간격을 절제해 Depth 2의 흐름을 모읍니다.
const PROCEDURE_GAP=72; // 동일 절차의 연속 단계 간격은 유지
const ROW_GAP=54; // Keep Depth 2 options together while reserving room for procedure labels.
const ROW_PITCH=ROADMAP_CARD.height+ROW_GAP;
const MARGIN_X=40;
const MARGIN_Y=60;
type Place={x:number;y:number;depth:number};
type GraphEdge={source:string;target:string;label?:string;id:string};

function handleOffsets(count:number):number[]{
  // A fork must have one visually coherent origin/arrival on the card.
  // Separate handle IDs still allow independent React Flow edges.
  return Array.from({length:Math.max(1,count)},()=>50);
}

/**
 * Deterministic topological-column layout. Positions are recomputed together
 * when the graph changes, so old saved coordinates cannot collide with new nodes.
 */
export function calculateRoadmapLayout(stages:RoadmapNode[],paths:RoadmapEdge[],alignment:RoadmapAlignment='top'):{nodes:Node[];edges:Edge[]}{
  const stageById=new Map(stages.map(stage=>[stage.id,stage]));
  const valid:GraphEdge[]=[];
  const seen=new Set<string>();
  for(const edge of paths){
    if(!stageById.has(edge.source)||!stageById.has(edge.target)||edge.source===edge.target)continue;
    const key=edge.source+'\u0000'+edge.target;
    if(seen.has(key))continue;
    seen.add(key);
    valid.push({...edge,id:'edge-'+valid.length});
  }
  const original=new Map(stages.map((node,i)=>[node.id,i]));
  const parent=new Map(stages.map(node=>[node.id,[] as string[]]));
  const child=new Map(stages.map(node=>[node.id,[] as string[]]));
  const inbound=new Map(stages.map(node=>[node.id,0]));
  for(const edge of valid){
    parent.get(edge.target)!.push(edge.source);
    child.get(edge.source)!.push(edge.target);
    inbound.set(edge.target,(inbound.get(edge.target)||0)+1);
  }

  const depth=new Map(stages.map(node=>[node.id,0]));
  const remaining=new Map(inbound);
  const queue=stages.filter(node=>remaining.get(node.id)===0).map(node=>node.id);
  const processed=new Set<string>();
  for(let i=0;i<queue.length;i++){
    const id=queue[i];
    if(processed.has(id))continue;
    processed.add(id);
    for(const target of child.get(id)||[]){
      depth.set(target,Math.max(depth.get(target)||0,(depth.get(id)||0)+1));
      const count=(remaining.get(target)||0)-1;
      remaining.set(target,count);
      if(count===0)queue.push(target);
    }
  }
  // A malformed cyclic graph still renders rather than stalling indefinitely.
  // Cyclic/backward edges are routed outside the occupied grid below.
  const columns=new Map<number,string[]>();
  for(const stage of stages){
    const level=depth.get(stage.id)||0;
    if(!columns.has(level))columns.set(level,[]);
    columns.get(level)!.push(stage.id);
  }
  const sortedColumns=[...columns.keys()].sort((a,b)=>a-b);
  // Depth 전체가 연속 절차 카드라면 해당 열로 들어가는 간격만 좁힙니다.
  // 일반 분기와 혼합된 열은 원래 간격을 유지해 다른 경로가 겹치지 않게 합니다.
  const columnX=new Map<number,number>();
  let nextX=MARGIN_X;
  sortedColumns.forEach((col,index)=>{
    if(index){
      const previous=sortedColumns[index-1];
      const stepOnly=columns.get(col)!.every(id=>stageById.get(id)?.kind==='step');
      nextX+=(col-previous)*(ROADMAP_CARD.width+(stepOnly?PROCEDURE_GAP:COLUMN_GAP));
    }
    columnX.set(col,nextX);
  });
  const rank=new Map<string,number>();
  for(const col of sortedColumns){
    const ids=columns.get(col)!;
    if(col!==sortedColumns[0]){
      const barycenter=(id:string)=>{
        const known=(parent.get(id)||[]).filter(p=>rank.has(p));
        if(!known.length)return Number.POSITIVE_INFINITY;
        return known.reduce((sum,p)=>sum+rank.get(p)!,0)/known.length;
      };
      ids.sort((a,b)=>barycenter(a)-barycenter(b)||(original.get(a)!-original.get(b)!));
    }
    ids.forEach((id,index)=>rank.set(id,index));
  }

  // Build one stable layout for every branch, not one independent pass for
  // each column. A newly revealed outcome must move its entire procedure
  // family as a unit rather than pushing only one step and bending its arrows.
  const treeChildren=new Map(stages.map(stage=>[stage.id,[] as string[]]));
  const primaryParent=new Map<string,string>();
  for(const stage of stages){
    const candidates=(parent.get(stage.id)||[]).filter(id=>
      processed.has(id)&&processed.has(stage.id)&&(depth.get(id)||0)<(depth.get(stage.id)||0));
    candidates.sort((a,b)=>(depth.get(b)!-depth.get(a)!)||(original.get(a)!-original.get(b)!));
    if(candidates.length){
      primaryParent.set(stage.id,candidates[0]);
      treeChildren.get(candidates[0])!.push(stage.id);
    }
  }
  for(const children of treeChildren.values()){
    children.sort((a,b)=>(rank.get(a)!-rank.get(b)!)||(original.get(a)!-original.get(b)!));
  }

  // Anchor the choice column before laying out deeper outcomes. Letting the
  // last column determine subtree height used to push Depth 2 options apart.
  // Instead, each new column fits around its already-positioned parents.
  const rowPositions=new Map<string,number>();
  for(const col of sortedColumns){
    const ids=columns.get(col)!;
    const preferred=ids.map((id,index)=>{
      const owner=primaryParent.get(id);
      if(!owner||!rowPositions.has(owner)){
        // Independent roots are given stable, non-overlapping slots.
        return index*ROW_PITCH;
      }
      const siblings=(treeChildren.get(owner)||[]).filter(childId=>(depth.get(childId)||0)===col);
      const siblingIndex=siblings.indexOf(id);
      const offset=alignment==='center'
        ?(siblingIndex-(siblings.length-1)/2)*ROW_PITCH
        :siblingIndex*ROW_PITCH;
      return rowPositions.get(owner)!+offset;
    });
    // Isotonic packing: find the closest ordered, non-overlapping positions
    // to the desired ones. Upper outcomes move up and lower outcomes down;
    // ancestors (especially Depth 2) NEVER move when more results appear.
    // Subtracting the row pitch transforms the separation constraint into
    // monotonicity; pooled adjacent violators minimizes total squared shift.
    type Block={first:number;last:number;total:number;size:number};
    const blocks:Block[]=[];
    for(let index=0;index<ids.length;index++){
      blocks.push({first:index,last:index,total:preferred[index]-index*ROW_PITCH,size:1});
      while(blocks.length>1){
        const right=blocks[blocks.length-1],left=blocks[blocks.length-2];
        if(left.total/left.size<=right.total/right.size)break;
        blocks.splice(blocks.length-2,2,{
          first:left.first,last:right.last,total:left.total+right.total,size:left.size+right.size
        });
      }
    }
    for(const block of blocks){
      const start=block.total/block.size;
      for(let index=block.first;index<=block.last;index++)
        rowPositions.set(ids[index],start+index*ROW_PITCH);
    }
  }
  const places=new Map<string,Place>();
  for(const stage of stages){
    const col=depth.get(stage.id)||0;
    places.set(stage.id,{
      x:columnX.get(col)??MARGIN_X,
      y:MARGIN_Y+(rowPositions.get(stage.id)??0),
      depth:col
    });
  }
  const minY=Math.min(...[...places.values()].map(p=>p.y),MARGIN_Y);
  const maxY=Math.max(...[...places.values()].map(p=>p.y+ROADMAP_CARD.height),MARGIN_Y+ROADMAP_CARD.height);
  const midY=(minY+maxY)/2;

  const incomingIds=new Map(stages.map(stage=>[stage.id,[] as GraphEdge[]]));
  const outgoingIds=new Map(stages.map(stage=>[stage.id,[] as GraphEdge[]]));
  for(const edge of valid){
    outgoingIds.get(edge.source)!.push(edge);
    incomingIds.get(edge.target)!.push(edge);
  }
  for(const stage of stages){
    outgoingIds.get(stage.id)!.sort((a,b)=>(places.get(a.target)!.y-places.get(b.target)!.y)||(original.get(a.target)!-original.get(b.target)!));
    incomingIds.get(stage.id)!.sort((a,b)=>(places.get(a.source)!.y-places.get(b.source)!.y)||(original.get(a.source)!-original.get(b.source)!));
  }
  const ports=new Map<string,{sourceIndex:number;targetIndex:number}>();
  for(const stage of stages){
    outgoingIds.get(stage.id)!.forEach((edge,i)=>ports.set(edge.id,{sourceIndex:i,targetIndex:0}));
  }
  for(const stage of stages){
    incomingIds.get(stage.id)!.forEach((edge,i)=>ports.get(edge.id)!.targetIndex=i);
  }

  const nodes:Node[]=stages.map(stage=>{
    const p=places.get(stage.id)!;
    return {
      id:stage.id,type:'stage',position:{x:p.x,y:p.y},
      style:{width:ROADMAP_CARD.width,height:ROADMAP_CARD.height},
      draggable:false,ariaLabel:stage.title,
      data:{stage,sourcePorts:handleOffsets(Math.max(1,outgoingIds.get(stage.id)!.length)),
        targetPorts:handleOffsets(Math.max(1,incomingIds.get(stage.id)!.length)),
        branchHint:incomingIds.get(stage.id)!.find(edge=>edge.label&&edge.label.length>8)?.label},
    };
  });
  // Give one source ONE trunk in each gutter. Previously each outbound
  // arrow had an unrelated vertical lane, crossing the other branches.
  const gutterGroups=new Map<number,Map<string,GraphEdge[]>>();
  for(const edge of valid){
    const s=places.get(edge.source)!;
    const t=places.get(edge.target)!;
    if(t.depth!==s.depth+1)continue;
    if(!gutterGroups.has(s.depth))gutterGroups.set(s.depth,new Map());
    const sources=gutterGroups.get(s.depth)!;
    if(!sources.has(edge.source))sources.set(edge.source,[]);
    sources.get(edge.source)!.push(edge);
  }
  const gutterLanes=new Map<string,{index:number;count:number;owner:boolean;spanMin:number;spanMax:number;shared:boolean}>();
  for(const groups of gutterGroups.values()){
    const entries=[...groups.entries()].sort(([a],[b])=>
      (places.get(a)!.y-places.get(b)!.y)||(original.get(a)!-original.get(b)!));
    entries.forEach(([source,branches],index)=>{
      const sourceY=places.get(source)!.y+ROADMAP_CARD.height/2;
      const targetYs=branches.map(edge=>places.get(edge.target)!.y+ROADMAP_CARD.height/2);
      const spanMin=Math.min(sourceY,...targetYs);
      const spanMax=Math.max(sourceY,...targetYs);
      branches.forEach((edge,branchIndex)=>gutterLanes.set(edge.id,{
        index,count:entries.length,owner:branchIndex===0,spanMin,spanMax,shared:branches.length>1,
      }));
    });
  }
  let outerTop=0,outerBottom=0;
  const edges:Edge[]=valid.map(edge=>{
    const s=places.get(edge.source)!;
    const t=places.get(edge.target)!;
    const port=ports.get(edge.id)!;
    const sp=handleOffsets(Math.max(1,outgoingIds.get(edge.source)!.length))[port.sourceIndex];
    const tp=handleOffsets(Math.max(1,incomingIds.get(edge.target)!.length))[port.targetIndex];
    const sourceY=s.y+ROADMAP_CARD.height*sp/100;
    const targetY=t.y+ROADMAP_CARD.height*tp/100;
    const adjacent=t.depth===s.depth+1;
    // Lanes are spaced globally per gutter; the entire vertical portion
    // stays between card columns, even with numerous incoming/outgoing links.
    const gap=t.x-s.x-ROADMAP_CARD.width;
    const gutterCenter=s.x+ROADMAP_CARD.width+gap/2;
    const lane=gutterLanes.get(edge.id);
    const safeWidth=Math.max(0,gap-72);
    const laneStep=lane&&lane.count>1?Math.min(18,safeWidth/(lane.count-1)):0;
    const laneX=adjacent&&lane?gutterCenter+(lane.index-(lane.count-1)/2)*laneStep:undefined;
    // A skipped/backwards column must travel outside the node grid instead of
    // cutting across intervening cards, and gets its own horizontal corridor.
    const upper=(sourceY+targetY)/2<=midY;
    const outerY=adjacent?undefined:upper?minY-74-(outerTop++*28):maxY+74+(outerBottom++*28);
    const exitX=s.x+ROADMAP_CARD.width+40+Math.min(port.sourceIndex*9,45);
    const entryX=t.x-40-Math.min(port.targetIndex*9,45);
    return {
      id:edge.id,source:edge.source,target:edge.target,
      sourceHandle:'out-'+port.sourceIndex,targetHandle:'in-'+port.targetIndex,
      type:'roadmap',
      data:{outerY,laneX,exitX,entryX,label:edge.label||'',adjacent,
        sharedBranch:adjacent&&Boolean(lane?.shared),branchOwner:lane?.owner===true,
        branchMinY:lane?.spanMin,branchMaxY:lane?.spanMax},
      style:{stroke:'var(--map-edge)',strokeWidth:1.7},
      markerEnd:{type:MarkerType.ArrowClosed,color:'var(--map-edge)',width:15,height:15},
    };
  });
  return {nodes,edges};
}

/**
 * Highlight the complete ancestry path through the clicked card, including
 * intermediate scenario steps. Never fan out into siblings or descendants.
 */
export function focusedRoadmapPath(nodes:Node[],edges:Edge[],focusedId:string|null):
  {nodeIds:Set<string>|null;edgeIds:Set<string>}{
  if(!focusedId)return {nodeIds:null,edgeIds:new Set()};
  const selected=nodes.find(node=>node.id===focusedId);
  if(!selected)return {nodeIds:null,edgeIds:new Set()};
  const anchor=selected.id;
  const inbound=new Set(edges.map(e=>e.target));
  const roots=nodes.filter(n=>(n.data.stage as RoadmapNode).kind==='situation'||!inbound.has(n.id));
  const start=roots.length?roots:[nodes[0]];
  const outgoing=new Map<string,Edge[]>();
  for(const edge of edges){
    if(!outgoing.has(edge.source))outgoing.set(edge.source,[]);
    outgoing.get(edge.source)!.push(edge);
  }
  const queue=start.map(n=>n.id);
  const visited=new Set(queue);
  const previous=new Map<string,Edge>();
  for(let i=0;i<queue.length&&!visited.has(anchor);i++){
    for(const edge of outgoing.get(queue[i])||[]){
      if(visited.has(edge.target))continue;
      visited.add(edge.target);
      previous.set(edge.target,edge);
      queue.push(edge.target);
    }
  }
  const nodeIds=new Set<string>([anchor]);
  const edgeIds=new Set<string>();
  if(!visited.has(anchor))return {nodeIds,edgeIds};
  let current=anchor;
  while(previous.has(current)){
    const edge=previous.get(current)!;
    edgeIds.add(edge.id);
    nodeIds.add(edge.source);
    current=edge.source;
  }
  return {nodeIds,edgeIds};
}

/** Rounded orthogonal SVG routing; no sharp elbows or text on connector lines. */
export function roundedRoadmapPath(points:{x:number;y:number}[],cornerRadius=11):string{
  const clean=points.filter((point,index)=>index===0||point.x!==points[index-1].x||point.y!==points[index-1].y);
  if(!clean.length)return '';
  let path='M '+clean[0].x+' '+clean[0].y;
  for(let i=1;i<clean.length-1;i++){
    const a=clean[i-1],b=clean[i],c=clean[i+1];
    const dx1=b.x-a.x,dy1=b.y-a.y,dx2=c.x-b.x,dy2=c.y-b.y;
    const length1=Math.hypot(dx1,dy1),length2=Math.hypot(dx2,dy2);
    if(!length1||!length2)continue;
    if((dx1*dy2-dy1*dx2)===0){path+=' L '+b.x+' '+b.y;continue;}
    const r=Math.min(cornerRadius,length1/2,length2/2);
    const entry={x:b.x-dx1/length1*r,y:b.y-dy1/length1*r};
    const exit={x:b.x+dx2/length2*r,y:b.y+dy2/length2*r};
    path+=' L '+entry.x+' '+entry.y+' Q '+b.x+' '+b.y+' '+exit.x+' '+exit.y;
  }
  if(clean.length>1)path+=' L '+clean[clean.length-1].x+' '+clean[clean.length-1].y;
  return path;
}
