import type {RoadmapNode} from './types';
import {normalizeLegalProcedureTerms} from './legal-procedure-terms';

// Guard terminology at the data boundary and when rendering old saved maps.
export const procedureName=(value:string,context?:string)=>normalizeLegalProcedureTerms(value,context)
 .replace(/재산\s+명시/g,'재산명시').replace(/재산\s+조회/g,'재산조회')
 .replace(/(재산명시|재산조회)(?:\s*[·ㆍ/]\s*\1)+/g,'$1')
 .replace(/(재산명시|재산조회)\s+\1/g,'$1');
const clean=(value:string)=>procedureName(value).replace(/\*\*/g,'').replace(/\s+/g,' ').trim();

export function validSummaryLines(value:unknown):string[]|undefined{
 if(!Array.isArray(value)||value.length<1||value.length>3)return;
 const lines=value.filter((line):line is string=>typeof line==='string').map(clean);
 if(lines.length!==value.length||lines.some(line=>!line||line.length>24||/…|\.{3}/.test(line)||!/요[.!?]?$/.test(line))||new Set(lines).size!==lines.length)return;
 return lines;
}

// Older saved conversations have no card copy. Use neutral descriptions of the
// procedure, keeping their case-specific facts and qualifications in the detail fold.
const procedureSummaries:Array<[RegExp,string[]]>=[
 [/재산명시.*재산조회|재산조회.*재산명시/,['상대의 재산 목록이나 정보를 확인해요.','신청할 수 있는 조건부터 살펴봐요.']],
 [/재산명시/,['상대가 재산 목록을 내도록 신청해요.','찾은 재산은 따로 압류해야 해요.']],
 [/재산조회/,['법원을 통해 상대 재산을 찾아봐요.','먼저 신청할 수 있는지 확인해요.']],
 [/노동청.*진정|임금체불 진정|체불임금 진정/,['못 받은 임금·퇴직금을 신고해요.','실제 돈을 받는 방법은 따로 살펴봐요.']],
 [/지급명령/,['법원에 돈을 갚으라는 명령을 구해요.','이의가 나오면 소송으로 이어져요.']],
 [/법원.*조정|조정.*법원|합의점/,['법원의 도움으로 합의점을 찾아요.','금액과 지급 방법을 함께 조율해요.']],
 [/민사소송|소송.*다투/,['증거를 내고 법원의 판단을 받아요.','판결 뒤 돈을 받는 방법도 확인해요.']],
 [/합의.*(?:갚|지급)|직접.*받기|갚을.*합의/,['상대와 갚을 금액과 날짜를 정해요.','약속은 문자나 서면으로 남겨요.']],
 [/다른 재산.*압류|재산 압류/,['급여·부동산 등 다른 재산을 살펴봐요.','압류할 재산에 맞춰 법원에 신청해요.']],
 [/집행.*(?:수단|방법|정리|비교)/,['지난 집행 기록과 재산 단서를 모아요.','상담으로 다음 대응을 함께 살펴봐요.']]
];
const stepSummaries:Array<[RegExp,string[]]>=[
 [/재산.*(?:정보 파악|단서|정리)/,['상대의 재산을 찾을 단서를 모아요.']],
 [/법원.*(?:집행|압류).*신청/,['법원에 신청서와 근거 자료를 내요.']],
 [/노동.*진정.*제출/,['밀린 임금과 근무 내역을 적어 신고해요.']],
 [/근로감독관.*조사/,['근무·입금 자료를 내고 조사에 답해요.']]
];
const genericDescription=/^(?:이 단계에서 필요한 내용을 확인해요[.]?|이 단계의 내용을 확인해요[.]?)$/;

export function conciseSummary(node:RoadmapNode):string[]{
 const description=clean(node.description||'');
 const meaningful=description&&!genericDescription.test(description)&&description.replace(/[.!?\s]/g,'')!==clean(node.title).replace(/[.!?\s]/g,'')&&!/^\d+[.)]/.test(description);
 const sentences=meaningful?(description.match(/[^.!?]+[.!?]?(?:\s|$)/g)||[description]).map(clean).filter(Boolean):[];
 // Preserve concise case-specific wording and one-sentence explanations.
 if(meaningful&&description.length<=(node.kind==='situation'?90:44))return [description];
 const generated=validSummaryLines(node.summaryLines);
 if(generated&&(node.kind==='situation'||generated.length<=2))return generated;
 if(node.kind==='route'||(!node.kind&&node.scenario)){
  const known=procedureSummaries.find(([pattern])=>pattern.test(procedureName(node.title,node.description)));
  if(known)return known[1];
 }
 if(generated)return [generated[0],generated[generated.length-1]];
 if(node.kind==='step'){
  const known=stepSummaries.find(([pattern])=>pattern.test(procedureName(node.title,node.description)));
  if(known)return known[1];
 }
 const short:string[]=[];
 for(const sentence of sentences){
  if(short.join(' ').length+sentence.length+(short.length?1:0)>(node.kind==='situation'?90:56)||short.length>=2)break;
  short.push(sentence);
 }
 if(short.length)return [short.join(' ')];
 if(sentences.length)return [sentences[0]];
 const action=node.actions?.map(clean).find(item=>item.length<=56&&/요[.!?]?$/.test(item));
 return [action||'할 일과 필요한 조건을 살펴봐요.'];
}

/** One complete, readable statement for the detail header; extra AI summary lines
 * belong in the supporting information, not as another introduction. */
export function detailHeadline(node:RoadmapNode):string{
 const lines=conciseSummary(node);
 if(node.kind==='situation')return lines.join(' ');
 const first=(lines[0]||'').trim();
 return first.match(/^.+?[.!?](?=\s|$)/)?.[0].trim()||first;
}

/** Do not repeat the headline verbatim inside the expandable description. */
export function supplementaryDescription(node:RoadmapNode,headline:string):string{
 const original=procedureName(node.description||'').trim();
 if(!original)return '';
 const normalized=(s:string)=>clean(s).replace(/[.!?]+$/,'');
 if(normalized(original)===normalized(headline))return '';
 const sentences=(original.match(/[^.!?]+[.!?]?(?:\s|$)/g)||[original]).map(s=>s.trim());
 return sentences.filter(s=>normalized(s)!==normalized(headline)).join(' ');
}

export const CARD_COPY_RULES=`
화면용 문구 규칙(모든 nodes 및 nodeUpdates에 적용):
- summaryLines는 쉬운 문장 1~2개의 배열이다. 내 상황(kind:situation)만 필요하면 3개까지 허용한다. 한 문장으로 충분하면 늘리지 않는다. 각 문장은 공백 포함 24자 이하이며 문장 중간을 끊거나 말줄임표를 쓰지 않는다.
- 첫 문장은 무엇을 하는 방법인지, 둘째 문장은 꼭 알아야 할 행동이나 중요한 한계를 적는다. 제목·단계 목록·같은 말을 반복해 분량을 채우지 않는다.
- description은 쉬운 1~2문장, 총 60자 이내다. 내 상황은 확인된 핵심 사실을 담아 최대 90자까지 쓸 수 있다. 조건과 예외의 나머지는 conditions, risks, scenario에 적는다. 모든 scenario.steps에도 실제 할 일을 쉬운 한 문장으로 설명한다.
- 법원 절차의 고유 명칭은 확인된 법률 용어만 쓴다. 채무자에게 재산 목록 제출을 요구하는 절차는 '재산명시', 법원이 관계 기관의 재산 정보를 확인하는 절차는 '재산조회'다. 확실하지 않은 제도명을 새로 조합하지 말고 실제 행동을 일반어로 설명한다.
- 같은 절차 이름이 반복되면 한 번만 쓴다. '재산명시·재산명시'처럼 중복된 제목을 만들지 않는다. 서로 다른 '재산명시'와 '재산조회'는 구별한다.
- 예: 재산명시 summaryLines=["상대가 재산 목록을 내도록 신청해요.","찾은 재산은 따로 압류해야 해요."]
- 법정 필수 선행조건과 단순 추천 순서·병행 가능·조건부 가능은 서로 다르다. 실제 법령 본문이나 공식 안내로 필수임이 확인된 경우에만 legalPrerequisites:[{"type":"required","label":"짧은 자연스러운 선행조건 문장","sourceIds":["실제 근거 ID"]}]를 추가한다. 그 외에는 빈 배열로 둔다. sourceIds에 검색 결과 제목만 연결한 경우 필수라고 표시하지 않는다.
- legalPrerequisites에 적은 필수 선행조건을 description·summaryLines에서 반복하지 말고, 본문에는 이 절차가 무엇을 하는지와 효과를 적는다. 재산조회는 재산명시 불응만이 유일한 사유가 아니므로 '반드시 재산명시 불응 후'라고 쓰지 않는다. 재산명시절차에서 법정 조회 사유(주소보정 불능·재산목록 부족·명시 불응 등)를 갖추어야 한다. 단순히 앞서 진행되는 일이 있다고 자동으로 필수로 분류하지 않는다.
- 예상 기간에는 근거로 확인된 소요만 쓰고 출처 ID를 붙인다. 숫자 근거가 없으면 scenario.timing의 variable에 실제 변동 요인을 쉬운 말로 적는다. 법정 기한을 전체 소요 기간으로 쓰지 않는다.`;
