import type {RoadmapNode} from '@/lib/types';
import type {CardPeriod} from '@/features/map/map-durations';

/** 우측 영역의 기간 수치는 지도 카드와 동일한 공통 결과를 사용합니다. */
export type DetailPeriod=CardPeriod & {metricTitle?:string};
export function detailPeriod(node:RoadmapNode,parent:RoadmapNode|undefined,base:CardPeriod):DetailPeriod{
 const kind=node.kind;
 const administrative=/진정 처리|처리기한/.test(base.label);
 const metricTitle=kind==='completion'?'종료 시점':base.category==='variable'?'기간 안내':administrative?'기관 처리기한':kind==='outcome'
  ?base.category==='estimate'?'이후 예상 기간':base.category==='deadline'?'이후 법정 기한':'이후 기간'
  :base.category==='deadline'?'법정 기한':'예상 기간';
 return {...base,metricTitle};
}

export function outcomeGuidance(node:RoadmapNode,parent?:RoadmapNode):{condition:string;nextTitle:string;nextText:string}|null{
 if(node.kind!=='outcome')return null;
 const result=parent?.scenario?.outcomes[node.scenarioOutcome??-1];
 const condition=(result?.condition||node.conditions.find(Boolean)||'').trim();
 const title=[node.title,result?.title||''].join(' ');
 const route=parent?.title||'';
 if(/지급명령/.test(route)){
  if(/확정|이의 없이/.test(title))return {condition,nextTitle:'확정 뒤 할 일',nextText:'확정된 지급명령 정본을 확인하세요. 상대방이 돈을 보내지 않으면 예금·급여 등 재산에 대한 강제집행을 별도로 검토할 수 있습니다.'};
  if(/소송|이의/.test(title))return {condition,nextTitle:'소송으로 넘어가면',nextText:'법원의 이의신청 통지를 확인하고 부족한 인지대·송달료 보정 명령을 놓치지 마세요. 기존 청구 내용과 증거를 소송용으로 정리합니다.'};
 }
 if(/조정|합의점/.test(route)){
  if(/합의|성립|조서/.test(title)&&!/이의|불성립/.test(title))return {condition,nextTitle:'합의 뒤 할 일',nextText:'조정조서에 기재된 금액·지급 날짜·분할 횟수를 확인하세요. 상대방이 지키지 않으면 조정조서를 근거로 강제집행을 검토할 수 있습니다.'};
  if(/이의|소송|불성립/.test(title))return {condition,nextTitle:'소송으로 이어지면',nextText:'조정을 갈음하는 결정에 대한 이의는 정본 송달 후 2주가 법정기한입니다. 소송에 이행되면 추가 인지대·송달료 보정과 증거 제출을 확인하세요.'};
 }
 if(/소송|민사/.test(route)){
  if(/미지급|집행/.test(title))return {condition,nextTitle:'판결 뒤 할 일',nextText:'집행할 수 있는 판결인지 먼저 확인하고, 실제 돈을 받으려면 상대 재산에 맞는 강제집행을 검토하세요.'};
  if(/불복|기각|인정/.test(title))return {condition,nextTitle:'판결 뒤 확인할 것',nextText:'판결문에서 인정된 금액과 기각된 부분을 확인하세요. 항소가 필요한 판결이라면 송달일을 기준으로 법정기한을 계산합니다.'};
  if(/지급/.test(title))return {condition,nextTitle:'돈을 받은 뒤',nextText:'실제 수령한 날짜와 금액을 기록하세요. 일부만 받았다면 남은 금액을 다시 계산합니다.'};
 }
 return {condition,nextTitle:'이 결과 뒤에',nextText:(result?.description||node.description||'해당 결과의 효력과 후속 신청 가능성을 확인하세요.').trim()};
}
