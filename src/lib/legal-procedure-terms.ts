/**
 * Central terminology boundary. Classify legal processes by explicit vocabulary;
 * do not guess procedure names using the parent description.
 */
import type {LegalCase, RoadmapNode, ScenarioStep} from './types';

const CANONICAL = ['재산명시','재산조회','지급명령','민사조정','민사소송','채권압류','강제집행','추심명령','가압류','경매','임금체불진정'] as const;
const GROUP_ALIASES:Array<[RegExp,string]>=[[/지급명령/,'지급명령'],[/민사소송|소송으로 다투|바로 소송/,'민사소송'],[/민사조정|법원.*조정|조정.*법원|합의점.*법원/,'법원 조정']];
const STEM_ACTION=/\s*(?:신청서?\s*(?:작성|제출|접수)?|진행|절차|요구|청구|접수|제출|검토|살펴보기|확인|하기|요청하기|진행하기)$/;
const FILING=/신청|접수|청구|제출|요구/;
const DECISION=/명령|결정|심리|심사|기일|송달|통지|조사|회신|결과|확인|출석|선서/;

const ORDINARY_PROPERTY_NOUNS=new Set([
 '목록','정보','압류','단서','파악','확인','조사','추적','처분','분할','매각',
 '보전','집행','관리','정리','신고','이전','담보','은닉','상속','증여',
 '가치','현황','내역','상태','소재','평가','보유','회수','채권','채무',
 '수집','검색','추심','경매','파산','청산','배분','이동','형성','축적',
 '소유','침해','변동','등록','취득','양도','세금','신탁','분쟁','확정',
 '명시','조회'
]);
function justifiedPropertyName(value:string,context:string):string {
 // A same-title explicit name is usable. Parent-title alone is not evidence.
 const hasDisclosure=/재산\s*명시/.test(value);
 const hasInquiry=/재산\s*조회/.test(value);
 if(hasDisclosure!==hasInquiry)return hasDisclosure?'재산명시':'재산조회';
 const disclosure=/재산.{0,16}목록.{0,16}(밝히|제출|내|작성)|채무자.{0,14}재산.{0,14}(밝히|목록)|재산을?\s*밝히/.test(context);
 const inquiry=/(?:금융|공공)기관.{0,20}(조회|회신)|재산.{0,12}(전산망|기관.*조회)/.test(context);
 if(disclosure!==inquiry)return disclosure?'재산명시':'재산조회';
 return '재산 확인';
}
function particleFor(text:string,particle:string):string {
 const last=text.charCodeAt(text.length-1);
 const noFinal=last>=0xac00&&last<=0xd7a3&&(last-0xac00)%28===0;
 return noFinal?({으로:'로',을:'를',은:'는',이:'가',과:'와'} as Record<string,string>)[particle]||particle:particle;
}
export function normalizeLegalProcedureTerms(value:string,context=value):string {
 if(!value)return value;
 const spaced=value.replace(/재산\s+명시/g,'재산명시').replace(/재산\s+조회/g,'재산조회');
 return spaced.replace(
  /재산\s*([가-힣]{2})(으로|로|을|를|은|는|이|가|과|와|의)?(?=[\s.,!?…()·/]|$|신청|절차|진행|명령|요청|하기|하다)/g,
  (match,ending:string,particle:string|undefined)=>{
   if(ORDINARY_PROPERTY_NOUNS.has(ending))return match;
   const target=justifiedPropertyName(spaced,context);
   return target+particleFor(target,particle||'');
  }
 );
}
function baseKey(raw:string):string {
 let text=normalizeLegalProcedureTerms(raw).trim().replace(/\s*절차$/,'');
 for(let i=0;i<2;i++)text=text.replace(STEM_ACTION,'').trim();
 return text.replace(/\s+/g,'');
}
/** Collapse repeated compound segments, but preserve different procedures. */
export function normalizeProcedureTitle(value:string):string {
 const text=normalizeLegalProcedureTerms(value).replace(/\s+/g,' ').trim();
 if(!/[·ㆍ/]/.test(text))return text;
 const parts=text.split(/\s*[·ㆍ/]\s*/).filter(Boolean);
 if(parts.length<2)return text;
 const result:string[]=[];
 for(const part of parts){
  const key=baseKey(part);
  const existing=result.findIndex(item=>baseKey(item)===key&&Boolean(key));
  if(existing<0)result.push(part);
  else if(part.length>result[existing].length)result[existing]=part;
 }
 return result.join('·');
}
export function procedureGroupTitle(routeTitle:string):string {
 const normalized=normalizeProcedureTitle(routeTitle);
 const alias=GROUP_ALIASES.find(([pattern])=>pattern.test(normalized));
 if(alias)return alias[1]+' 절차';
 const title=normalized
  .replace(/\s*(?:으로\s*)?(?:요청하기|진행하기|살펴보기|검토하기|하기)$/,'')
  .replace(/(?:\s*절차)+$/,'').trim();
 return title?title+' 절차':'진행 절차';
}
function coreProcedure(title:string,routeTitle:string):string {
 const normalized=normalizeProcedureTitle(title);
 for(const term of CANONICAL)if(normalized.includes(term))return term;
 const parent=normalizeProcedureTitle(routeTitle);
 for(const term of CANONICAL)if(parent.includes(term))return term;
 return baseKey(parent);
}
/** Only duplicate application/filing phases are merged, not later court phases. */
function filingKey(step:ScenarioStep,routeTitle:string):string|null {
 const title=normalizeProcedureTitle(step.title).replace(/\s*\([^)]*\)/g,'').trim();
 // A creditor's initial application is different from a debtor's later asset list,
 // court-ordered evidence, supplementary documents or preparing an application.
 if(/재산목록|보완|증거|자료|답변서|의견서|준비|작성|발급|정리|이의|항소|상고|반소|재심|불복/.test(title))return null;
 if(!FILING.test(title)||DECISION.test(title))return null;
 const core=coreProcedure(title,routeTitle);
 return core?core+':filing':null;
}
export function duplicatedFilingSteps(steps:ScenarioStep[],routeTitle:string):number[] {
 const seen=new Set<string>();
 const duplicate:number[]=[];
 steps.forEach((step,i)=>{
  const key=filingKey(step,routeTitle);
  if(!key)return;
  if(seen.has(key))duplicate.push(i);else seen.add(key);
 });
 return duplicate;
}
/** A route whose title is already an application/filing must advance to the agency's next action.
 * Preparations stay in the route's checklist, not in later map depths. */
export function redundantRouteStepIndices(steps:ScenarioStep[],routeTitle:string):number[] {
 const route=normalizeProcedureTitle(routeTitle).replace(/\s*절차$/,'').trim();
 if(!/(?:신청|청구|접수|제출|요구)$/.test(route))return [];
 const removed:number[]=[];
 for(let i=0;i<steps.length;i++){
  const title=normalizeProcedureTitle(steps[i].title).trim();
  // Only the leading pre-application run can be collapsed. Once the court
  // acts, later filings (objections, corrections, asset lists) are distinct.
  if(/보정|이의|항고|불복|재산목록|선서|명령|결정|송달|기일|심리|법원.*(?:접수|심사)|기관.*(?:접수|심사)/.test(title))break;
  const preparation=/(?:요건|자격|관할|집행권원|집행의 근거|증명|서류|자료|신청서).*(?:확인|준비|검토|작성|발급|점검)|(?:확인|준비|검토|작성)$/.test(title);
  const filing=/(?:신청서?|청구서?|진정서?|소장).*(?:제출|접수|신청)|(?:신청|청구|제출|요구)$/.test(title);
  const related=baseKey(title).includes(baseKey(route))||coreProcedure(title,route)===coreProcedure(route,route)||/(?:신청서|청구서|진정서|소장|관할|집행권원|집행의 근거)/.test(title);
  if(related&&(preparation||filing)){removed.push(i);continue}
  break;
 }
 return removed;
}
export function cleanProcedureSteps(steps:ScenarioStep[],routeTitle:string):ScenarioStep[]{
 const remove=new Set([...duplicatedFilingSteps(steps,routeTitle),...redundantRouteStepIndices(steps,routeTitle)]);
 return steps.filter((_,i)=>!remove.has(i));
}
export function procedureStepIssues(steps:ScenarioStep[],routeTitle:string):string[]{
 const issues:string[]=[];
 steps.forEach((step,i)=>{
  const title=normalizeProcedureTitle(step.title);
  if(/[()（）]/.test(title))issues.push(String(i+1)+'단계: 괄호 안의 예외는 condition/description에 분리하세요.');
  const words=title.match(/(?:^|[\s(·])([가-힣]{1,4}명시)(?=[\s)·]|$)/g)||[];
  if(words.some(word=>word.trim().replace(/^[ (·]/,'')!=='재산명시'))
   issues.push(String(i+1)+'단계: 공식 절차명인지 확인되지 않은 명시 관련 명칭입니다.');
 });
 for(const i of duplicatedFilingSteps(steps,routeTitle))
  issues.push(String(i+1)+'단계: 동일한 신청·요구·접수를 독립된 후속 절차로 다시 만듦. 법원 결정·송달·기일 등의 실제 다음 단계를 확인하세요.');
 for(const i of redundantRouteStepIndices(steps,routeTitle))
  issues.push(String(i+1)+'단계: 방법 카드에서 이미 신청을 선택한 뒤 준비·제출을 다시 진행시켰어요. 신청 다음의 기관 처리부터 작성하세요.');
 return issues;
}

/** Repair existing saved AI maps without deleting user-confirmed progress. */
export function normalizeSavedRoadmapTerms(value:LegalCase):LegalCase {
 if(!Array.isArray(value.nodes))return value;
 const progress={...(value.progress||{})};
 const nodes=value.nodes.map((node:RoadmapNode)=>{
  const title=normalizeProcedureTitle(node.title);
  if(!node.scenario)return {...node,title};
  const steps=node.scenario.steps.map(step=>({...step,title:normalizeProcedureTitle(step.title)}));
  const removed=new Set([...duplicatedFilingSteps(steps,title),...redundantRouteStepIndices(steps,title)]);
  const oldToNew=new Map<number,number>();
  const kept=steps.filter((_,i)=>{
   if(removed.has(i))return false;
   oldToNew.set(i,oldToNew.size);return true;
  });
  if(removed.size){
   const prefix='scenario:'+node.id+':step:';
   const saved=Object.entries(progress).filter(([key])=>key.startsWith(prefix));
   for(const [key] of saved)delete progress[key];
   for(const [key,status] of saved){
    const index=Number(key.slice(prefix.length));
    if(!Number.isInteger(index))continue;
    const mapped=oldToNew.get(index);
    // Never promote a completed application/preflight into a completed court action.
    if(mapped===undefined)continue;
    const destination=prefix+mapped;
    if(status==='done'||!progress[destination])progress[destination]=status;
   }
  }
  const oldRevealed=node.scenarioRevealed;
  const removedRevealed=oldRevealed===undefined?0:[...removed].filter(i=>i<oldRevealed).length;
  const scenarioRevealed=oldRevealed===undefined?undefined:Math.max(0,Math.min(kept.length+1,oldRevealed-removedRevealed));
  const oldIndex=node.scenarioIndex??0;
  const scenarioIndex=removed.size?Math.max(0,oldIndex-[...removed].filter(i=>i<=oldIndex).length):node.scenarioIndex;
  return {...node,title,scenario:{...node.scenario,steps:kept},scenarioIndex,scenarioRevealed};
 });
 return {...value,nodes,progress};
}
