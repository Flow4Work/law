import type {LegalCase,NodeStatus,RoadmapNode} from './types';
import {expandRoadmap,revealedCount} from './scenario-graph';

export function followingSteps(value:LegalCase,id:string):RoadmapNode[]{
 const graph=value.nodes.some(n=>n.scenarioParentId)?value:expandRoadmap(value);
 const ids=new Set([...graph.edges.filter(e=>e.source===id).map(e=>e.target),...(graph.nodes.find(n=>n.id===id)?.next||[])]);
 return graph.nodes.filter(n=>ids.has(n.id)&&n.status!=='unavailable');
}
export function beginStep(value:LegalCase,id:string):LegalCase{
 return advanceStep(value,id);
}
export function completeStep(value:LegalCase,id:string):LegalCase{
 if(!expandRoadmap(value).nodes.some(n=>n.id===id))return value;
 return {...value,progress:{...value.progress,[id]:'done' as NodeStatus},updatedAt:new Date().toISOString(),nodes:value.nodes.map(n=>n.id===id?{...n,status:'done',userConfirmed:true}:n)};
}
export function advanceStep(value:LegalCase,id:string):LegalCase{
 const node=expandRoadmap(value).nodes.find(n=>n.id===id);
 if(!node||node.kind==='situation'||node.status==='unavailable')return value;
 const route=value.nodes.find(n=>n.id===(node.scenarioParentId||id));
 if(!route?.scenario?.steps.length||node.kind==='outcome')return value;
 const count=revealedCount(route);
 const limit=route.scenario.steps.length+(route.scenario.outcomes.length?1:0);
 if(count>=limit)return value;
 // 공개는 실제 진행/완료 기록(status, progress, scenarioIndex)을 쓰지 않습니다.
 // 처음 펼칠 때는 독립적인 확인 버튼을 반복 누르지 않아도 흐름 3단계가 보입니다.
 const nextCount=count===0?Math.min(3,route.scenario.steps.length):Math.min(count+1,limit);
 return {...value,updatedAt:new Date().toISOString(),nodes:value.nodes.map(n=>n.id===route.id?{...n,scenarioRevealed:nextCount}:n)};
}
export function chooseNextStep(value:LegalCase,from:string,id:string):LegalCase{
 if(!followingSteps(value,from).some(n=>n.id===id))return value;
 return beginStep(value,id);
}
