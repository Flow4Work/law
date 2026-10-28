import type {LegalSource,RoadmapNode} from './types';
import {procedureName} from './concise-copy';

/** A legally mandatory prerequisite is different from a common order or a parallel option. */
export type RequiredNotice={text:string;lawUrl:string;origin:'statute'|'source'};
type LawRule={test:(title:string)=>boolean;text:string;lawUrl:string;duplicate:RegExp};

/** Verified statutory rules, not per-card ID fixes. Dates: Civil Execution Act 2026-02-01, Civil Procedure Act 2026-10-02. */
const RULES:LawRule[]=[
 {
  test:title=>/^재산조회(?:\s*(?:신청|절차))?$/.test(title),
  text:'재산명시절차에서 법정 요건을 갖춰야 해요.',
  lawUrl:'https://law.go.kr/LSW/lsLinkCommonInfo.do?lsJoLnkSeq=1026912903',
  duplicate:/재산명시|명시절차|명시\s*불응|먼저\s*신청할\s*수\s*있는지/
 },
 {
  test:title=>/^(?:채권|계좌|예금|급여|재산|부동산)\s*(?:압류|추심)(?:\s*(?:및|·|과|와)\s*(?:추심|압류))?(?:\s*(?:신청|명령|절차))?$|^강제집행(?:\s*(?:신청|절차))?$/.test(title),
  text:'집행할 수 있는 근거 문서가 필요해요.',
  lawUrl:'https://www.law.go.kr/LSW/lsInfoP.do?ancYnChk=&chrClsCd=010202&efYd=20260201&lsiSeq=268837&urlMode=lsInfoP',
  duplicate:/집행(?:할\s*수\s*있는|력|의\s*근거|권원)|집행문|확정판결/
 },
 {
  test:title=>/^(?:민사\s*)?항소(?:장\s*(?:제출|접수)|\s*(?:신청|제기))?$/.test(title),
  text:'1심 판결이 있어야 항소할 수 있어요.',
  lawUrl:'https://www.law.go.kr/LSW/lsInfoP.do?ancNo=21993&ancYd=20260929&efYd=20261002&lsiSeq=290113',
  duplicate:/1심\s*판결|판결서|원심\s*판결/
 },
 {
  test:title=>/^지급명령\s*(?:에\s*대한\s*)?이의신청$/.test(title),
  text:'지급명령 송달 후 2주 안에 이의해요.',
  lawUrl:'https://www.law.go.kr/LSW/lsInfoP.do?ancNo=21993&ancYd=20260929&efYd=20261002&lsiSeq=290113',
  duplicate:/지급명령.*(?:송달|받은|이의\s*기간)/
 }
];

/** Only explicit, official-source-backed requirements can extend the verified catalogue. */
export function mandatoryPrerequisite(node:RoadmapNode,sources:LegalSource[]=[]):RequiredNotice|null{
 if(!['route','step'].includes(node.kind||'')||node.status==='unavailable')return null;
 const title=procedureName(node.title).replace(/\s+/g,' ').trim();
 const rule=RULES.find(rule=>rule.test(title));
 if(rule)return {text:rule.text,lawUrl:rule.lawUrl,origin:'statute'};
 for(const candidate of node.legalPrerequisites||[]){
  if(candidate.type!=='required'||!candidate.label||candidate.label.length>48)continue;
  const sourceIds=Array.isArray(candidate.sourceIds)?candidate.sourceIds:[];
  const procedureTerms=(title.match(/[가-힣]{2,}/g)||[]).filter(term=>!/^(?:신청|절차|확인|진행|법원|특별|대응)$/.test(term));
  const support=sources.find(s=>sourceIds.includes(s.id)&&
   ((s.kind==='법령'&&/(law\.go\.kr)/.test(s.url))||s.kind==='공식 안내')&&
   Boolean(s.snippet)&&/(하여야|해야|필요|한하여|경우|후|이내)/.test(s.snippet||'')&&
   procedureTerms.some(term=>(s.title+' '+s.snippet).replace(/\s+/g,'').includes(term)));
  if(support)return {text:candidate.label,lawUrl:support.url,origin:'source'};
 }
 return null;
}

/** Remove only repetitive requirement-only trailing sentences from the ordinary black copy. */
export function separateMandatoryCopy(summary:string,node:RoadmapNode,notice:RequiredNotice|null):string{
 if(!notice)return summary;
 const rule=RULES.find(rule=>rule.test(procedureName(node.title).replace(/\s+/g,' ').trim()));
 const sentences=summary.split(/(?<=[.!?])\s+|\n/).map(s=>s.trim()).filter(Boolean);
 const kept=sentences.filter((sentence,index)=>{
  if(index===0)return true;
  if(rule&&rule.duplicate.test(sentence)&&/(?:후|뒤|먼저|있어야|필요|해야|확인|갖춰|불응|충족)/.test(sentence))return false;
  const normalize=(s:string)=>s.replace(/[.!?\s]/g,'');
  return normalize(sentence)!==normalize(notice.text);
 });
 return kept.join('\n');
}
