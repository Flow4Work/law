import test from 'node:test';
import assert from 'node:assert/strict';
import {mobileMap,routeBranches} from '../src/lib/mobile-roadmap.ts';

const node=(id,extra={})=>({id,title:id,status:'possible',...extra});
const value=(nodes,edges)=>({nodes,edges});

test('only immediate choices belong to the comparison; later steps and merged results stay in their paths',()=>{
  const graph=value([node('now',{kind:'situation'}),node('a'),node('b'),node('later'),node('merged')],[{source:'now',target:'a'},{source:'now',target:'b'},{source:'a',target:'later'},{source:'later',target:'merged'},{source:'b',target:'merged'}]);
  assert.deepEqual(mobileMap(graph).routes.map(n=>n.id),['a','b']);
  assert.equal(routeBranches(graph,'a')[0].children[0].node.id,'merged');
  assert.equal(routeBranches(graph,'b')[0].node.id,'merged');
});

test('edge conditions stay attached to the right branch regardless of node order',()=>{
  const graph=value([node('paid'),node('unpaid'),node('route')],[{source:'route',target:'unpaid',label:'지급하지 않으면'},{source:'route',target:'paid',label:'지급하면'}]);
  assert.deepEqual(routeBranches(graph,'route').map(b=>[b.node.id,b.condition]),[['unpaid','지급하지 않으면'],['paid','지급하면']]);
});

test('cyclic and stale edges do not cause infinite traversal or phantom results',()=>{
  const graph=value([node('a'),node('b')],[{source:'a',target:'b'},{source:'b',target:'a'},{source:'a',target:'missing'}]);
  const branches=routeBranches(graph,'a');
  assert.equal(branches.length,1);assert.equal(branches[0].children.length,0);
});

test('completed chosen routes remain comparable while old completed steps do not become choices',()=>{
  const graph=value([node('now',{kind:'situation'}),node('done',{kind:'route',status:'done',userConfirmed:true}),node('old',{status:'done'}),node('future')],[{source:'now',target:'done'},{source:'now',target:'old'},{source:'now',target:'future'}]);
  assert.deepEqual(mobileMap(graph).routes.map(n=>n.id),['done','future']);
});

test('legacy graphs use the first remaining root and exclude generated descendants from comparison',()=>{
  const graph=value([node('past',{status:'done'}),node('current',{status:'current'}),node('route'),node('step',{kind:'step',scenarioParentId:'route'})],[{source:'past',target:'current'},{source:'current',target:'route'},{source:'route',target:'step'}]);
  assert.equal(mobileMap(graph).root.id,'current');assert.deepEqual(mobileMap(graph).routes.map(n=>n.id),['route']);
});

test('a provisional map without steps stays a choice without invented follow-up nodes',()=>{
  const graph=value([node('now',{kind:'situation'}),node('route',{actions:['자료 확인']})],[{source:'now',target:'route'}]);
  assert.equal(mobileMap(graph).routes.length,1);assert.deepEqual(routeBranches(graph,'route'),[]);
  assert.deepEqual(graph.nodes[1].actions,['자료 확인']);
});
