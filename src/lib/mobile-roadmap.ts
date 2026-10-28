import type {LegalCase, RoadmapNode} from './types';

export type MobileBranch = {node:RoadmapNode; condition?:string; children:MobileBranch[]};

export function mobileMap(value:LegalCase) {
  const nodes=value.nodes.filter(n=>n.status!=='done'||Boolean(n.scenarioParentId)||(n.kind==='route'&&n.userConfirmed));
  const ids=new Set(nodes.map(n=>n.id));
  const edges=value.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
  const root=nodes.find(n=>n.kind==='situation')||nodes.find(n=>!edges.some(e=>e.target===n.id));
  const linked=root?nodes.filter(n=>edges.some(e=>e.source===root.id&&e.target===n.id)):[];
  const routes=linked.length?linked:nodes.filter(n=>n.id!==root?.id&&!n.scenarioParentId&&!edges.some(e=>e.target===n.id));
  return {root,routes};
}

// Follow graph edges rather than array order. Keep a merged node in each incoming
// branch, but stop cycles on the current path so malformed graphs cannot recurse.
export function routeBranches(value:LegalCase,routeId:string):MobileBranch[] {
  const nodes=new Map(value.nodes.map(n=>[n.id,n]));
  const visit=(id:string,path:Set<string>):MobileBranch[]=>value.edges
    .filter(e=>e.source===id&&nodes.has(e.target)&&!path.has(e.target))
    .map(e=>({node:nodes.get(e.target)!,condition:e.label,children:visit(e.target,new Set([...path,e.target]))}));
  return visit(routeId,new Set([routeId]));
}
