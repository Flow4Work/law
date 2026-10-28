import type {DocumentRecommendation,LegalAnswer,LegalCase,LegalSource,NodeStatus,RoadmapEdge,RoadmapNode,OutcomeLikelihood,LegalPrerequisite} from './types';
import {durationLabel,plainStepTitle} from './legal-copy';
import {procedureName,validSummaryLines} from './concise-copy';
import {normalizeProcedureTitle,procedureStepIssues,cleanProcedureSteps} from './legal-procedure-terms';

export const ANALYSIS_VERSION=3;
export const text=(value:unknown,limit=600)=>typeof value==='string'?value.trim().slice(0,limit):'';
export function naturalText(value:unknown,limit=600,context?:string):string{
 return procedureName(text(value,limit),context).replace(/한다(?=[.!?](?:\s|$)|$)/g,'해요').replace(/할 수 있다(?=[.!?](?:\s|$)|$)/g,'할 수 있어요').replace(/절차다(?=[.!?](?:\s|$)|$)/g,'절차예요').replace(/모은다(?=[.!?](?:\s|$)|$)/g,'모아요').replace(/찾는다(?=[.!?](?:\s|$)|$)/g,'찾아요').replace(/연다(?=[.!?](?:\s|$)|$)/g,'열어요').replace(/변제기/g,'갚기로 한 날').replace(/대여금/g,'빌려준 돈').replace(/집행권원/g,'집행의 근거 문서');
}
export const strings=(value:unknown,limit=12,itemLimit=600):string[]=>Array.isArray(value)?value.filter((v):v is string=>typeof v==='string').map(v=>naturalText(v,itemLimit)).filter(Boolean).slice(0,limit):[];
export function applyReview(draft:Record<string,any>,review:Record<string,any>):Record<string,any>{
 const remove=new Set(strings(review.removeNodeIds,16,70));
 const updates=new Map((Array.isArray(review.nodeUpdates)?review.nodeUpdates:[]).filter(n=>n&&typeof n.id==='string').map(n=>[n.id,n]));
 const nodes=(Array.isArray(draft.nodes)?draft.nodes:[]).filter(n=>!remove.has(n.id)).map(n=>({...n,...updates.get(n.id),id:n.id}));
 for(const node of Array.isArray(review.addNodes)?review.addNodes:[])if(node&&typeof node.id==='string'&&!nodes.some(n=>n.id===node.id))nodes.push(node);
 const output:Record<string,any>={...draft,nodes,edges:Array.isArray(review.edges)?review.edges:draft.edges};
 for(const key of ['answer','options','question','openQuestions','followUpQuestions'])if(typeof review[key]==='string'||Array.isArray(review[key]))output[key]=review[key];
 return output;
}
const statuses=new Set<NodeStatus>(['current','possible','done','verify','unavailable']);
function checklist(raw:unknown,sources:LegalSource[]):DocumentRecommendation[]{
 if(!Array.isArray(raw))return [];
 return raw.slice(0,10).flatMap(item=>{
  if(!item||typeof item!=='object')return [];
  const name=text(item.name,100);if(!name)return [];
  const sourceIds=strings(item.sourceIds).filter(id=>sources.some(s=>s.id===id));
  let necessity:DocumentRecommendation['necessity']=['required','helpful','conditional','check'].includes(item.necessity)?item.necessity:'check';
  // A statute's search-result title does not establish mandatory attachments.
  const plainName=name.replace(/[\s·()（）]/g,'');
  if(necessity==='required'&&!sources.some(s=>sourceIds.includes(s.id)&&s.kind==='공식 안내'&&s.requiredDocuments?.some(d=>plainName.includes(d.replace(/[\s·()（）]/g,'')))))necessity='check';
  // A "상황별" document without the situation cannot guide the user.
  if(necessity==='conditional'&&!naturalText(item.condition,260))necessity='check';
  return [{name,necessity,reason:naturalText(item.reason,400),condition:naturalText(item.condition,260)||undefined,sourceIds}];
 });
}
export function normalizeAnalysis(raw:Record<string,any>,previous:LegalCase|undefined,sources:LegalSource[]):LegalAnswer{
 const old=new Map((previous?.nodes||[]).map(n=>[n.id,n]));
 const byTitle=new Map((previous?.nodes||[]).map(n=>[n.title.replace(/\s/g,''),n]));
 const remap=new Map<string,string>();
 const entries=(Array.isArray(raw.nodes)?raw.nodes:[]).filter(n=>n&&typeof n==='object').slice(0,16);
 entries.forEach((n,i)=>{const proposed=text(n.id,70)||'step-'+i;const prior=old.get(proposed)||byTitle.get(text(n.title,100).replace(/\s/g,''));remap.set(proposed,prior?.id||proposed)});
 const nodes:RoadmapNode[]=entries.map((n,i)=>{
  const proposed=text(n.id,70)||'step-'+i;const id=remap.get(proposed)!;const prior=old.get(id);
  const manual=previous?.progress?.[id]||(prior?.status==='done'?'done':undefined);
  const status=manual||(statuses.has(n.status)?n.status:'verify');
  const docs=checklist(n.documentChecklist,sources);
  const inferredKind=n.kind||(/^situation[-_]/.test(id)?'situation':undefined);
  const durationCopy=durationLabel(n.duration);
  const scenario=inferredKind!=='situation'&&n.scenario&&typeof n.scenario==='object'?{
   suitableWhen:naturalText(n.scenario.suitableWhen,400),
   steps:(Array.isArray(n.scenario.steps)?n.scenario.steps:[]).slice(0,7).filter((s:any)=>s&&text(s.title)).map((s:any)=>{
    const stepDuration=durationLabel(text(s.duration,250));
    return {title:plainStepTitle(normalizeProcedureTitle(naturalText(s.title,90,text(s.description,500)))),description:naturalText(s.description,500),condition:naturalText(s.condition,260),duration:stepDuration?.label||'',documents:strings(s.documents,8),cost:text(s.cost,200),sourceIds:strings(s.sourceIds).filter(id=>sources.some(x=>x.id===id))};
   }),
   outcomes:(Array.isArray(n.scenario.outcomes)?n.scenario.outcomes:[]).slice(0,5).filter((s:any)=>s&&text(s.title)).map((s:any)=>({title:naturalText(s.title,70,text(s.description,500)),summary:naturalText(s.summary,140)||undefined,likelihood:(['full','partial','hard','other'].includes(s.likelihood)?s.likelihood:undefined) as OutcomeLikelihood|undefined,description:naturalText(s.description,500),condition:naturalText(s.condition,260),terminal:typeof s.terminal==='boolean'?s.terminal:undefined,nextSteps:(Array.isArray(s.nextSteps)?s.nextSteps:[]).slice(0,4).filter((step:any)=>step&&text(step.title)).map((step:any)=>({title:plainStepTitle(normalizeProcedureTitle(naturalText(step.title,90))),description:naturalText(step.description,500),condition:naturalText(step.condition,260),duration:durationLabel(text(step.duration,250))?.label||'',documents:strings(step.documents,8),cost:text(step.cost,200),sourceIds:strings(step.sourceIds).filter(id=>sources.some(x=>x.id===id))}))})),
   transitions:(Array.isArray(n.scenario.transitions)?n.scenario.transitions:[]).slice(0,5).filter((s:any)=>s&&text(s.targetId)&&(text(s.condition)||text(s.label))).map((s:any)=>({targetId:remap.get(text(s.targetId,70))||text(s.targetId,70),label:naturalText(s.label,40)||undefined,condition:naturalText(s.condition,260)||naturalText(s.label,40)})),
   timing:(Array.isArray(n.scenario.timing)?n.scenario.timing:[]).slice(0,4).filter((s:any)=>s&&text(s.label)&&text(s.description)).map((s:any)=>{
    const minDays=Number(s.minDays);const maxDays=Number(s.maxDays);
    return {label:text(s.label,100),description:naturalText(s.description,400),kind:(['deadline','variable','estimate'].includes(s.kind)?s.kind:'variable') as 'deadline'|'variable'|'estimate',sourceIds:strings(s.sourceIds).filter(id=>sources.some(x=>x.id===id)),minDays:Number.isFinite(minDays)&&minDays>0?Math.round(minDays):undefined,maxDays:Number.isFinite(maxDays)&&maxDays>0?Math.round(maxDays):undefined};
   }).filter((s:any)=>(s.kind==='variable'||s.sourceIds.length>0)&&(s.kind!=='estimate'||Boolean(durationLabel(s.label))))
  }:undefined;
  if(scenario)scenario.steps=cleanProcedureSteps(scenario.steps,text(n.title,100));
  const legalPrerequisites:LegalPrerequisite[]=(Array.isArray(n.legalPrerequisites)?n.legalPrerequisites:[]).slice(0,3).flatMap((item:any)=>{
   if(!item||!['required','conditional','recommended'].includes(item.type))return [];
   const label=naturalText(item.label,48);
   const sourceIds=strings(item.sourceIds,5,120).filter(id=>sources.some(s=>s.id===id));
   return label&&sourceIds.length?[{type:item.type,label,sourceIds}]:[];
  });
  return {id,title:normalizeProcedureTitle(naturalText(n.title,100,text(n.description,1000)+' '+text(n.scenario?.suitableWhen,400)))||'먼저 확인할 내용',description:naturalText(n.description,1000),summaryLines:validSummaryLines(n.summaryLines),legalPrerequisites,status,
     conditions:strings(n.conditions,6),actions:strings(n.actions,8).map(value=>value.replace(/(문의|확인|정리|수집|보관|제출|신청|준비|요청|검토|상담|대응|계산|제기)$/,'$1해요')),documents:strings(n.documents,10),documentChecklist:docs,
   cost:text(n.cost,300),duration:durationCopy?.label||'',durationMinDays:durationCopy?.minDays,durationMaxDays:durationCopy?.maxDays,durationSourceIds:strings(n.durationSourceIds,6).filter(id=>sources.some(s=>s.id===id)),risks:strings(n.risks,5,1500).flatMap(s=>s.split(/\n\s*\n/)).slice(0,5),sourceIds:strings(n.sourceIds).filter(id=>sources.some(s=>s.id===id)),next:[],userConfirmed:Boolean(manual),kind:['situation','route','step','outcome'].includes(inferredKind)?inferredKind:undefined,scenario:prior?.scenarioRevealed&&prior.scenario?prior.scenario:scenario,scenarioRevealed:prior?.scenarioRevealed,scenarioIndex:manual&&prior?.scenarioIndex!==undefined?Math.min(prior.scenarioIndex,Math.max(0,(scenario?.steps.length||1)-1)):0};
 }).filter((n,i,all)=>all.findIndex(item=>item.id===n.id)===i);
 for(const prior of previous?.nodes||[]){
  if((previous?.progress?.[prior.id]||prior.status==='done')&&!nodes.some(n=>n.id===prior.id))nodes.push({...prior,userConfirmed:true});
 }
 const ids=new Set(nodes.map(n=>n.id));const edges:RoadmapEdge[]=[];
 for(const item of Array.isArray(raw.edges)?raw.edges:[]){
  const source=remap.get(text(item?.source,70))||text(item?.source,70);const target=remap.get(text(item?.target,70))||text(item?.target,70);
  if(!ids.has(source)||!ids.has(target)||source===target||edges.some(e=>e.source===source&&e.target===target))continue;
  edges.push({source,target,label:text(item.label,120)||undefined});
 }
 // Retain history edges only for explicitly confirmed steps; obsolete AI branches can disappear.
 for(const edge of previous?.edges||[]){
  if(ids.has(edge.source)&&ids.has(edge.target)&&nodes.find(n=>n.id===edge.source)?.userConfirmed&&!edges.some(e=>e.source===edge.source&&e.target===edge.target))edges.push(edge);
 }
 for(const n of nodes){n.next=edges.filter(e=>e.source===n.id).map(e=>e.target);if(n.scenario?.transitions)n.scenario.transitions=n.scenario.transitions.filter(t=>ids.has(t.targetId)&&t.targetId!==n.id)}
 if(!nodes.some(n=>n.status==='current')){const root=nodes.find(n=>n.status!=='done'&&!edges.some(e=>e.target===n.id&&nodes.find(p=>p.id===e.source)?.status!=='done'));if(root)root.status='current'}
 let followUpQuestions=(Array.isArray(raw.followUpQuestions)?raw.followUpQuestions:[]).slice(0,3).flatMap((item:any)=>{
  if(!item||typeof item!=='object')return [];
  const question=naturalText(item.question,220);if(!question)return [];
  return [{question,choices:strings(item.choices,3,100)}];
 });
 if(!followUpQuestions.length){
  const fallbackQuestions=strings(raw.openQuestions,3,220);
  const fallback=fallbackQuestions.length?fallbackQuestions:(text(raw.question,220)?[text(raw.question,220)]:[]);
  followUpQuestions=fallback.map(question=>({question,choices:[]}));
 }
 return {title:text(raw.title,50),answer:naturalText(raw.answer,5000),options:strings(raw.options,10),nextAction:naturalText(raw.nextAction,1000),question:text(raw.question,700),facts:strings(raw.facts,20),openQuestions:strings(raw.openQuestions,6),followUpQuestions,nodes,edges};
}
export function findAnalysisIssues(answer:LegalAnswer,input:string):string[]{
 const issues:string[]=[];
 if(/확정금융채권|퇴직금.{0,8}금융.{0,8}담보/.test([answer.answer,...answer.options,...answer.nodes.map(n=>n.title+' '+n.description)].join(' ')))issues.push('존재와 의미를 확인할 수 없는 퇴직금 금융·담보 제도를 만들어냄. 이 선택지를 답변과 지도에서 제거하고, 공식적으로 확인한 임금체불 해결 절차만 안내할 것.');
 const hasNoticeCondition=(node:RoadmapNode)=>{
  const incoming=answer.edges.filter(e=>e.target===node.id);
  const parents=incoming.map(e=>answer.nodes.find(n=>n.id===e.source)).filter((n):n is RoadmapNode=>Boolean(n));
  const own=[node.description,...node.conditions,...incoming.map(e=>e.label||'')].join(' ');
  return /(불송치|통지|처분)/.test(own)&&/(경우|라면|이면|일 때|확인|받은|받았|고소인|피해자)/.test(own)
   ||parents.some(n=>/통지|처분/.test([n.title,n.description,...n.actions].join(' '))&&/확인/.test([n.title,n.description,...n.actions].join(' ')));
 };
 for(const n of answer.nodes){
  if(n.scenario?.steps.length)issues.push(...procedureStepIssues(n.scenario.steps,n.title).map(issue=>n.id+': '+issue));
  const copy=[n.title,n.description,...n.actions].join(' ');
  if(/노동위원회/.test(copy)&&/임금|월급|퇴직금|체불/.test(input)&&/진정|체불/.test(copy)&&!/부당해고|부당노동행위|구제신청/.test(copy))issues.push(n.id+': 임금체불 진정의 기관을 노동위원회로 잘못 안내함. 관할 지방고용노동관서 안내로 수정.');
  if(/진정/.test(copy)&&/지급을?\s*강제하는 절차(다|예요|에요|입니다)|자동으로.{0,8}(지급됩니다|회수됩니다|지급돼요|회수돼요)/.test(copy))issues.push(n.id+': 진정과 실제 돈의 회수·강제집행을 혼동함.');
  if(/경찰|폭행/.test(input)&&!/불송치|불기소|약식명령|판결문|수사결과통지/.test(input)&&/이의신청|항고/.test(n.title)&&!hasNoticeCondition(n))issues.push(n.id+': 정식 처분을 확인하지 않고 불복 절차를 제시함. 먼저 통지서의 처분명·지위·통지일을 확인해야 함.');
  if(!n.description)issues.push(n.id+': 설명이 비어 있음.');
  if(/불송치/.test(n.title)&&n.scenario?.timing?.some(t=>t.kind==='deadline'&&/(기한이 정해|\d+\s*(일|주|개월|년))/.test(t.description+' '+t.label)&&!/3\s*개월/.test(t.description+' '+t.label)))issues.push(n.id+': 불송치 이의신청의 법정 신청기한은 2026년 10월 2일 시행 형사소송법 제245조의7에 따라 원칙적으로 통지 수령일부터 3개월이다. 적용 대상·예외·통지 수령일을 확인해 수정할 것.');
 }
 const children=new Map(answer.nodes.map(n=>[n.id,answer.edges.filter(e=>e.source===n.id).map(e=>e.target)]));
 const seen=new Set<string>();const stack=new Set<string>();
 function visit(id:string):boolean{if(stack.has(id))return true;if(seen.has(id))return false;seen.add(id);stack.add(id);for(const next of children.get(id)||[])if(visit(next))return true;stack.delete(id);return false}
 if(answer.nodes.some(n=>visit(n.id)))issues.push('미래 경로의 연결선이 순환함. 되돌아가는 이력을 제외하고 상황별 다음 단계만 연결할 것.');
 return issues;
}
