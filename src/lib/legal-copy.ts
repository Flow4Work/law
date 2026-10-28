import type {OutcomeLikelihood,RoadmapNode} from './types';

/**
 * 패널 표시용 법률 문구 정리.
 * 지도 카드/레이아웃은 건드리지 않고, 상세 패널과 생성 데이터 정규화에서만 사용합니다.
 */

const UNIT_DAYS:Record<string,number>={일:1,주:7,개월:30,달:30,년:365};
/** "약 2~4주"처럼 기간만 적은 짧은 표현. "2주 안에 신청" 같은 법정 기한 문장은 제외합니다. */
const SHAPE=/^(?:약\s*|대략\s*|보통\s*|통상\s*|평균\s*)?(\d+(?:\.\d+)?)(?:\s*(?:~|-|–)\s*(\d+(?:\.\d+)?))?\s*(일|주|개월|달|년)(?:\s*(?:정도|가량|소요))?$/;
const DEADLINE_HINT=/이내|안에|까지|마감|전에|부터|기한|법정|제출일|송달일/;

export type DurationCopy={label:string;minDays:number;maxDays:number};

/** "약 2~4주", "30~60일"처럼 숫자로 확인된 기간만 남깁니다. */
export function parseDurationDays(value?:string):{minDays:number;maxDays:number}|null{
 const text=(value||'').replace(/\s+/g,' ').trim();
 if(!text||DEADLINE_HINT.test(text))return null;
 const shape=text.match(SHAPE);
 if(!shape)return null;
 const lo=Number(shape[1]);const hi=shape[2]?Number(shape[2]):lo;const unit=shape[3];
 if(!Number.isFinite(lo)||!Number.isFinite(hi)||lo<=0||hi<=0)return null;
 const days=UNIT_DAYS[unit];
 const minDays=Math.round(Math.min(lo,hi)*days);
 const maxDays=Math.round(Math.max(lo,hi)*days);
 return minDays===maxDays?{minDays,maxDays:minDays}:{minDays,maxDays};
}

export function formatDurationDays(minDays:number,maxDays:number):string{
 const lo=Math.max(1,Math.round(Math.min(minDays,maxDays)));
 const hi=Math.max(lo,Math.round(Math.max(minDays,maxDays)));
 const pick=(value:number,unit:number)=>Math.max(1,Math.round(value/unit));
 if(hi<=14){
  const unit=hi>=7&&lo>=7?7:1;
  const suffix=unit===7?'주':'일';
  const a=pick(lo,unit);const b=pick(hi,unit);
  return a===b?`약 ${a}${suffix}`:`약 ${a}~${b}${suffix}`;
 }
 if(hi<=90){
  const a=pick(lo,7);const b=pick(hi,7);
  return a===b?`약 ${a}주`:`약 ${a}~${b}주`;
 }
 const a=pick(lo,30);const b=pick(hi,30);
 return a===b?`약 ${a}개월`:`약 ${a}~${b}개월`;
}

/** 이미 "약 2~4주" 형태로 쓰인 문장은 그대로, 아니면 숫자 범위로 정리합니다. */
export function durationLabel(value?:string):DurationCopy|null{
 const text=(value||'').replace(/\s+/g,' ').trim();
 const days=parseDurationDays(text);
 if(!days)return null;
 const compact=text.replace(/^(?:대략|보통|통상|평균)\s*/,'').replace(/\s*(?:정도|가량|소요)$/,'').replace(/^약\s*/,'');
 return {...days,label:'약 '+compact};
}

/**
 * 화면에 표시할 예상 기간. 공식 근거(sourceIds)로 확인된 수치만 인정합니다.
 * - scenario.timing의 estimate(수치+출처)
 * - durationMinDays/MaxDays + durationSourceIds
 * 근거가 없으면 null을 돌려주고 패널은 기간 확인 상태를 표시합니다.
 */
export function nodeDuration(node:RoadmapNode):DurationCopy|null{
 for(const estimate of node.scenario?.timing||[]){
  if(estimate.kind!=='estimate'||!estimate.sourceIds.length)continue;
  const copy=durationLabel(estimate.label);if(copy)return copy;
  // 일부 자료는 기간을 문장이 아닌 minDays/maxDays 숫자로 전달합니다.
  const lower=estimate.minDays??estimate.maxDays;
  const upper=estimate.maxDays??estimate.minDays;
  if(lower!==undefined&&upper!==undefined&&Number.isFinite(lower)&&Number.isFinite(upper)&&lower>0&&upper>0){
   return {label:formatDurationDays(lower,upper),minDays:Math.min(lower,upper),maxDays:Math.max(lower,upper)};
  }
 }
 const legacy=node.durationSourceIds?.length?durationLabel(node.duration):null;
 if(legacy)return legacy;
 const raw=node.durationMinDays??node.durationMaxDays;
 if(raw!==undefined&&raw!==null&&node.durationSourceIds?.length){
  return {label:formatDurationDays(node.durationMinDays??raw,node.durationMaxDays??raw),minDays:node.durationMinDays??raw,maxDays:node.durationMaxDays??raw};
 }
 return null;
}

/** 기간 근거로 연결된 출처 ID (법률 근거 접힘 영역에 함께 노출) */
export function durationSourceIds(node:RoadmapNode):string[]{
 const ids=[...(node.durationSourceIds||[])];
 for(const item of node.scenario?.timing||[])if(item.kind==='estimate')ids.push(...item.sourceIds);
 return Array.from(new Set(ids));
}

/** 긴 괄호 설명을 제목에서 덜어냅니다. 문서명 자체는 documents/documentChecklist에 남깁니다. */
export function plainStepTitle(title:string):string{
 const text=title.replace(/\s+/g,' ').trim();
 const stripped=text.replace(/\s*\([^)]*\)/g,'').replace(/\s{2,}/g,' ').trim();
 if(stripped.length>=8&&stripped.length<text.length)return stripped;
 return text;
}

/** 예상 기간과 법정 기한을 섞지 않기 위해 종류별로 나눕니다. */
export function scenarioTiming(node:RoadmapNode){
 const timing=node.scenario?.timing||[];
 return {
  estimate:timing.find(item=>item.kind==='estimate'&&item.sourceIds.length>0&&durationLabel(item.label)),
  deadlines:timing.filter(item=>item.kind==='deadline'&&item.label.trim()),
  variable:timing.filter(item=>item.kind==='variable'&&item.label.trim())
 };
}

export const OUTCOME_LABEL:Record<OutcomeLikelihood,string>={
 full:'전부 회수',partial:'일부 회수',hard:'회수 어려움',other:'결과가 달라짐'
};
