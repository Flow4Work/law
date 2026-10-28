import type {LegalCase,RoadmapEdge,RoadmapNode,ScenarioOutcome,ScenarioTransition,ScenarioStep} from './types';
import {durationLabel,plainStepTitle} from './legal-copy';
import {completionText,isTerminalOutcome,matchingTransitions} from './scenario-endings';

/** '이의하지 않으면'을 '이의하면'과 같은 소송 분기로 연결하지 않습니다. */
export function outcomeMatchesTransition(outcome:ScenarioOutcome,transition:ScenarioTransition):boolean{
 return matchingTransitions(outcome,[transition]).length>0;
}

export function revealedCount(route:RoadmapNode):number {
 // Existing saved map disclosure and actual progress are independent.
 return route.scenarioRevealed??(route.userConfirmed&&route.scenario?route.scenario.steps.length+1:0);
}

function generatedStep(id:string,route:RoadmapNode,step:ScenarioStep,kind:'step'|'followup',index:number,outcomeIndex?:number):RoadmapNode{
 const copy=durationLabel(step.duration);
 return {
  id,title:plainStepTitle(step.title),description:step.description||'이 단계에서 필요한 내용을 확인해요.',
  status:'possible',kind,scenarioParentId:route.id,
  scenarioStep:kind==='step'?index:undefined,scenarioOutcome:outcomeIndex,
  scenarioFollowUp:kind==='followup'?index:undefined,
  conditions:step.condition?[step.condition]:[],actions:[],documents:step.documents||[],
  cost:step.cost||'',duration:copy?.label||'',durationSourceIds:copy?step.sourceIds||[]:[],
  risks:[],sourceIds:step.sourceIds||[],next:[],
 };
}

/** A result can branch to an actual ending, additional work, or another existing route.
 * These are distinct: missing successor data must never be treated as "finished". */
export function expandRoadmap(value:LegalCase):{nodes:RoadmapNode[];edges:RoadmapEdge[]} {
 const nodes:RoadmapNode[]=[...value.nodes];
 const ids=new Set(nodes.map(node=>node.id));
 const edges:RoadmapEdge[]=value.edges.filter(edge=>ids.has(edge.source)&&ids.has(edge.target));
 const added=new Set(ids);
 const addNode=(node:RoadmapNode)=>{if(added.has(node.id))return;nodes.push(node);added.add(node.id)};
 const addEdge=(source:string,target:string,label?:string)=>{
  if(source!==target&&!edges.some(edge=>edge.source===source&&edge.target===target))edges.push({source,target,label});
 };
 for(const route of value.nodes){
  if(!route.scenario||!revealedCount(route))continue;
  const scenario=route.scenario;
  let source=route.id;
  scenario.steps.slice(0,Math.min(7,revealedCount(route))).forEach((step,index)=>{
   const id='scenario:'+route.id+':step:'+index;
   const stage=generatedStep(id,route,step,'step',index);
   stage.status=value.progress?.[id]||(route.scenarioRevealed===undefined&&index<(route.scenarioIndex||0)?'done':'possible');
   addNode(stage);
   addEdge(source,id,index===0?'시작':undefined);
   source=id;
  });
  if(revealedCount(route)<=scenario.steps.length)continue;
  scenario.outcomes.slice(0,5).forEach((outcome,index)=>{
   const outcomeId='scenario:'+route.id+':outcome:'+index;
   const transitions=matchingTransitions(outcome,scenario.transitions||[])
    .filter(item=>ids.has(item.targetId)&&item.targetId!==route.id);
   addNode({
    id:outcomeId,title:outcome.title,description:outcome.description,status:'verify',kind:'outcome',
    scenarioParentId:route.id,scenarioOutcome:index,
    conditions:outcome.condition?[outcome.condition]:[],actions:[],documents:[],cost:'',duration:'',
    risks:[],sourceIds:[],next:transitions.map(item=>item.targetId),
   });
   addEdge(source,outcomeId,outcome.condition?.slice(0,24));
   let last=outcomeId;
   (outcome.nextSteps||[]).slice(0,4).forEach((step,stepIndex)=>{
    const id='scenario:'+route.id+':outcome:'+index+':followup:'+stepIndex;
    const stage=generatedStep(id,route,step,'followup',stepIndex,index);
    addNode(stage);
    addEdge(last,id,stepIndex===0?'이후 절차':undefined);
    last=id;
   });
   // A handoff points to an existing route without dragging its original Depth 2
   // card to a much later column or creating a cycle between sibling routes.
   for(const [transitionIndex,transition] of transitions.entries()){
    const target=value.nodes.find(n=>n.id===transition.targetId);
    if(!target)continue;
    const id='scenario:'+route.id+':outcome:'+index+':handoff:'+transitionIndex;
    addNode({
     id,title:target.title,description:transition.condition,status:'possible',kind:'followup',
     scenarioParentId:route.id,scenarioOutcome:index,linkedRouteId:target.id,
     conditions:[transition.condition],actions:[],documents:[],cost:'',duration:'',
     risks:[],sourceIds:target.sourceIds,next:[],
    });
    addEdge(outcomeId,id,transition.label||'다른 방법');
   }
   if(isTerminalOutcome(outcome)){
    const id='scenario:'+route.id+':complete:'+index;
    addNode({
     id,title:'절차 종료',description:completionText(outcome),status:'possible',kind:'completion',
     scenarioParentId:route.id,scenarioOutcome:index,
     conditions:outcome.condition?[outcome.condition]:[],actions:[],documents:[],cost:'',duration:'',
     risks:[],sourceIds:[],next:[],
    });
    addEdge(last,id,'종료');
   }
  });
 }
 return {nodes,edges};
}
export function scenarioParent(value:LegalCase,node:RoadmapNode):RoadmapNode|undefined {
 return node.scenarioParentId?value.nodes.find(item=>item.id===node.scenarioParentId):undefined;
}
