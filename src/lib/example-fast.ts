import type {IntakePlan} from './intake';
import type {DetailSupplement,LegalCase,RoadmapNode,ScenarioPreview,ScenarioStep,ScenarioOutcome} from './types';
import {SHOWCASE_STORY} from './portfolio-showcase';
import {WAGE_EXAMPLE_DELAY_MS,wageExamplePlan,nextWageExamplePlan,wageExampleResult} from './wage-example-fast';

export type ExamplePreset='wage-fast'|'deposit-fast'|'police-fast';
export const EXAMPLE_DELAY_MS=WAGE_EXAMPLE_DELAY_MS;
const DEPOSIT='계약이 끝났는데 보증금을 안 돌려줘요.';
const POLICE='경찰서에 오라는 연락을 받았어요.';

export function presetForStory(story:string):ExamplePreset|null{
 if(story===SHOWCASE_STORY)return 'wage-fast';
 if(story===DEPOSIT)return 'deposit-fast';
 if(story===POLICE)return 'police-fast';
 return null;
}
const q=(question:string,why:string,choices:string[])=>({question,why,choices});
const QUESTIONS={
 'deposit-fast':[
  q('현재 집에 거주하고 계신가요?','이사와 전출 여부에 따라 임차권 보호에 필요한 조치가 달라질 수 있어요.',['아직 거주 중이에요','곧 이사하거나 전출할 예정이에요','이미 이사하거나 전출했어요']),
  q('계약은 어떤 상태인가요?','계약 종료 여부와 관련 다툼을 확인해야 반환청구 방법을 정할 수 있어요.',['계약이 종료된 것이 분명해요','종료 여부를 확인해야 해요','집주인이 계약 종료를 다투고 있어요']),
  q('보증금 반환을 위해 어디까지 진행하셨나요?','이미 진행한 요청이나 법원 절차에 따라 다음 선택이 달라져요.',['아직 별도 조치를 하지 않았어요','집주인에게 반환을 요구했어요','내용증명이나 법원 절차를 진행했어요'])
 ],
 'police-fast':[
  q('경찰에서 어떤 지위로 연락했는지 아시나요?','피의자, 피해자, 참고인 여부에 따라 준비할 내용이 달라져요.',['피의자 또는 신고 대상이라고 들었어요','피해자나 고소인이라고 들었어요','참고인이거나 정확한 지위를 몰라요']),
  q('어떤 방식으로 연락을 받으셨나요?','정식 출석 요청인지 전화 안내인지, 처분 통지인지 구별해야 해요.',['전화나 문자로 연락받았어요','출석요구서 등 서면을 받았어요','결과나 처분 관련 통지를 받았어요']),
  q('현재 경찰 연락에 어떻게 대응하셨나요?','출석 일정과 진행 상태를 확인하고 필요한 다음 행동을 정리해요.',['아직 일정이나 내용을 확인하지 않았어요','담당자와 출석 일정을 조율했어요','이미 출석했거나 진술했어요'])
 ]
} as const;

const step=(title:string,description:string):ScenarioStep=>({title,description});
const outcome=(title:string,condition:string,description:string,terminal=false):ScenarioOutcome=>({title,condition,description,terminal});
function route(id:string,title:string,description:string,steps:ScenarioStep[],outcomes:ScenarioOutcome[],suitableWhen:string,transitions?:ScenarioPreview['transitions']):RoadmapNode{
 return {id,title,description,kind:'route',status:'possible',conditions:[],actions:[],documents:[],documentChecklist:[],cost:'사건별 확인',duration:'사안별로 달라짐',risks:[],sourceIds:[],next:[],detailVersion:3,
  scenario:{suitableWhen,steps,outcomes,transitions,timing:[{label:'처리 기간은 사건에 따라 달라져요',description:'송달, 다툼, 조사, 법원 처리 등에 따라 달라집니다.',kind:'variable',sourceIds:[]}]}
 };
}
const routes:Record<string,RoadmapNode>={
 'deposit-check':route('deposit-check','계약 종료 및 권리 상태 확인','종료 통지, 점유·전입, 보증금 반환 조건을 먼저 구별해요.',
  [step('계약·통지 내역 확인','계약서와 갱신·해지 통지의 날짜 및 내용을 정리해요.'),step('거주·전입·등기 상태 확인','이사·전출 시점과 임차권등기 여부 등을 확인해요.'),step('청구 가능 조건 검토','계약 종료 및 보증금 반환의 전제 조건을 확인해요.')],
  [outcome('청구 조건 확인','계약 종료와 반환 요건이 확인되면','반환 요청이나 법원 청구를 검토해요.'),outcome('종료·권리 다툼','종료 여부나 권리 상태를 다툰다면','관련 자료를 확보하고 개별 상담을 검토해요.')],
  '계약 종료 여부나 권리 보전 상태가 불명확한 경우'),
 'deposit-request':route('deposit-request','집주인에게 반환 요구','보증금 액수와 계약 종료 근거를 정리해 기록을 남겨요.',
  [step('보증금·지급 내역 정리','계약서와 반환받지 못한 금액을 확인해요.'),step('서면 반환 요청','계약 종료 및 반환 요구 내용을 기록이 남는 방법으로 전달해요.'),step('상대방 답변 확인','지급 약속과 실제 입금 여부를 확인해요.')],
  [outcome('보증금 반환 완료','전액 반환되면','입금액과 정산 내역을 확인해요.',true),outcome('미반환·분쟁 지속','기한을 정해 요청했지만 돌려받지 못하면','반환청구 소송 등 가능한 절차를 검토해요.')],
  '계약 종료 및 반환 요구를 설명할 자료가 있는 경우',[{targetId:'deposit-court',condition:'반환 요구 후에도 지급되지 않는 경우'}]),
 'deposit-protect':route('deposit-protect','임차권 보호 조치 검토','이사나 전출 전에 임차권등기명령의 요건과 등기 완료 여부를 확인해요.',
  [step('대항력·우선변제권 확인','점유, 주민등록, 확정일자 등 현재 상태를 확인해요.'),step('임차권등기명령 요건 검토','계약 종료와 미반환 여부 등 신청 조건을 확인해요.'),step('등기 완료 여부 확인','신청만 한 상태와 실제 등기 완료를 구별하고 이사·전출 시점을 판단해요.')],
  [outcome('권리 보전 조치 확인','적절한 요건과 등기 상태가 확인되면','다음 반환청구 방법을 검토해요.'),outcome('보전 상태 불확실','요건 또는 완료 상태가 불분명하면','전출·인도 전에 관련 법률 상담을 받아요.')],
  '보증금을 받지 못한 상태에서 이사·전출을 계획하거나 권리 보전이 걱정되는 경우'),
 'deposit-court':route('deposit-court','지급명령·반환청구 소송','계약 종료와 미지급 사실에 관한 자료로 법원 청구를 검토해요.',
  [step('계약·미반환 증빙 정리','계약서, 종료 통지, 지급 내역과 반환 요청 기록을 준비해요.'),step('청구 방법 비교','지급명령과 민사소송의 요건, 송달과 이의 가능성을 살펴봐요.'),step('법원 결정·판결 확인','확정, 이의 또는 항소 등 진행 상황을 확인해요.')],
  [outcome('자발적 반환','임대인이 반환하면','입금과 정산 내역을 확인해요.',true),outcome('반환 거부 또는 미지급','법원 절차 뒤에도 반환되지 않으면','집행권원과 집행 가능 재산 여부를 검토해요.')],
  '계약 종료 후에도 보증금을 반환받지 못한 경우'),
 'police-status':route('police-status','사건 지위·연락 내용 확인','담당자에게 본인의 지위와 출석 요청 내용을 먼저 확인해요.',
  [step('연락 내용 확인','담당 경찰관과 사건 관련 안내, 연락 방식을 확인해요.'),step('본인 지위 확인','피의자·피해자·참고인 등 안내받은 지위를 구별해요.'),step('요청 목적과 일정 확인','출석 목적, 일시, 준비 자료를 확인해요.')],
  [outcome('출석 필요 사항 확인','지위와 일정을 확인했다면','본인 지위에 맞는 진술 준비를 검토해요.'),outcome('정보가 불명확함','연락 내용이 모호하다면','공식 연락처를 통해 사실관계를 다시 확인해요.')],
  '사건 종류나 본인의 지위가 명확하지 않은 경우'),
 'police-suspect':route('police-suspect','피의자 조사 준비','혐의 내용과 관련 기록을 확인하고 진술·변호인 조력을 검토해요.',
  [step('혐의·조사 일정 확인','안내받은 혐의와 출석 요청 사항을 확인해요.'),step('자료·사실관계 정리','메시지, 사진, 거래내역 등 관련 자료를 사실대로 정리해요.'),step('진술과 조력 검토','진술거부권과 변호인의 조력을 받을 권리 등을 확인해요.')],
  [outcome('조사 후 진행 안내','조사가 진행되면','추가 조사 및 처분 통지 여부를 확인해요.'),outcome('쟁점·자료 추가 필요','새 사실이나 자료가 나오면','추가 자료와 법률 조력을 검토해요.')],
  '피의자 신분 등으로 수사기관의 연락을 받은 경우'),
 'police-victim':route('police-victim','피해 진술·증거 정리','피해 사실과 관련 자료를 시간순으로 정리해요.',
  [step('피해 내용 정리','발생 날짜, 장소, 경위, 피해 내용을 구분해요.'),step('증빙 자료 확보','메시지, 진료 기록, 목격 정보 등 관련 자료를 확인해요.'),step('출석·진술 준비','진술 일정과 추가 제출할 자료를 확인해요.')],
  [outcome('진술·증거 제출','진술과 자료 제출 후','담당자에게 진행 상황과 추가 요청 여부를 확인해요.'),outcome('추가 조치 필요','안전 문제나 추가 피해가 있다면','피해자 보호 및 별도 지원 제도를 검토해요.')],
  '피해자·고소인 등으로 출석 연락을 받은 경우'),
 'police-witness':route('police-witness','참고인 출석 안내 확인','참고인인지 확인하고 아는 사실과 모르는 사실을 구분해요.',
  [step('출석 요청 취지 확인','참고인 지위와 요청 내용, 조사 일정을 확인해요.'),step('기억·자료 정리','직접 보고 들은 사실과 추측을 구분해 정리해요.'),step('진술 진행 확인','진술 취지를 확인하고 필요할 경우 법률 조력을 검토해요.')],
  [outcome('조사 종료','조사 후 추가 요청이 없다면','추가 연락 및 공식 통지 여부를 확인해요.'),outcome('지위·쟁점 변경','조사 중 지위나 쟁점이 달라지면','권리와 대응 방법을 새로 확인해요.')],
  '참고인으로 연락받았거나 지위가 불명확한 경우'),
 'police-notice':route('police-notice','수사 결과·통지서 확인','통지서의 처분명, 날짜, 당사자 지위에 맞는 후속 절차를 확인해요.',
  [step('공식 통지 내용 확인','통지서의 정확한 처분명과 통지받은 날짜를 확인해요.'),step('해당 지위의 권리 확인','피의자·피해자 등 지위에 따라 가능한 대응을 구별해요.'),step('후속 절차·기한 검토','통지 종류에 따른 불복이나 후속 대응 요건을 확인해요.')],
  [outcome('별도 조치 불필요','절차가 끝나고 별도 대응이 필요 없다면','통지서와 관련 기록을 보관해요.',true),outcome('추가 대응 검토','불복이나 추가 수사가 필요한 경우','처분명과 통지일을 토대로 법률 상담을 검토해요.')],
  '공식 수사 결과나 처분 통지를 받은 경우')
};
const routeSets={
 'deposit-fast':[['deposit-request','deposit-court'],['deposit-protect','deposit-request','deposit-court'],['deposit-check','deposit-request','deposit-court']],
 'police-fast':[['police-status','police-suspect'],['police-status','police-victim'],['police-status','police-witness']]
} as const;
function idsFor(preset:'deposit-fast'|'police-fast',plan:IntakePlan):string[]{
 const stage=QUESTIONS[preset][0].choices.indexOf(plan.answers[0]?.choice as never);
 if(stage<0)return preset==='deposit-fast'?['deposit-check','deposit-request']:['police-status','police-witness'];
 if(preset==='deposit-fast'){
  if(plan.answers[1]?.choice!==QUESTIONS['deposit-fast'][1].choices[0]&&plan.answers.length>1)return ['deposit-check','deposit-request'];
  return [...routeSets[preset][Math.max(0,stage)]]; 
 }
 if(plan.answers[1]?.choice===QUESTIONS['police-fast'][1].choices[2])return ['police-status','police-notice'];
 return [...routeSets[preset][Math.max(0,stage)]];
}
export function examplePlan(preset:ExamplePreset):IntakePlan{
 if(preset==='wage-fast')return wageExamplePlan();
 const original=preset==='deposit-fast'?DEPOSIT:POLICE;
 return {original,questions:QUESTIONS[preset].map(question=>({...question,choices:[...question.choices]})),answers:[],
  routes:idsFor(preset,{original,questions:[],answers:[],routes:[]}).map(id=>({title:routes[id].title,description:routes[id].description}))};
}
export function nextExamplePlan(preset:ExamplePreset,plan:IntakePlan):IntakePlan{
 if(preset==='wage-fast')return nextWageExamplePlan(plan);
 const ids=idsFor(preset,plan);
 return {...plan,routes:ids.map(id=>({title:routes[id].title,description:routes[id].description}))};
}
function supplementsFor(nodes:RoadmapNode[]):Record<string,DetailSupplement>{
 const values:Record<string,DetailSupplement>={};
 for(const route of nodes){
  route.scenario?.steps.forEach((s,i)=>{values['scenario:'+route.id+':step:'+i]={
   actions:[s.description||''].filter(Boolean),conditions:s.condition?[s.condition]:[],documents:s.documents||[],documentChecklist:[],cost:s.cost||'',risks:[],sourceIds:[],detailVersion:3};});
  route.scenario?.outcomes.forEach((o,i)=>{values['scenario:'+route.id+':outcome:'+i]={
   actions:[],conditions:o.condition?[o.condition]:[],documents:[],documentChecklist:[],cost:'',risks:[],sourceIds:[],detailVersion:3};});
 }
 return values;
}
export function exampleResult(preset:ExamplePreset,plan:IntakePlan):Pick<LegalCase,'nodes'|'edges'|'facts'|'sources'|'evidenceStatus'|'detailSupplements'> & {reply:string}{
 if(preset==='wage-fast')return wageExampleResult(plan);
 const ids=idsFor(preset,plan);
 const names=plan.answers.map((a,i)=>QUESTIONS[preset][i]?.question+': '+(a.choice||'미확인'));
 const root:RoadmapNode={id:preset+':now',title:preset==='deposit-fast'?'계약 종료 후 보증금 미반환':'경찰 출석 연락을 받은 상황',description:names.join(' / ').slice(0,230),
  kind:'situation',status:'current',conditions:[],actions:[],documents:[],cost:'',duration:'',risks:[],sourceIds:[],next:ids,detailVersion:3};
 const chosen=ids.map(id=>structuredClone(routes[id]));
 return {nodes:[root,...chosen],edges:ids.map(id=>({source:root.id,target:id})),
  facts:names,sources:[],evidenceStatus:'unverified',detailSupplements:supplementsFor(chosen),
  reply:'선택한 상황을 바탕으로 확인할 사항과 가능한 대응 경로를 정리했어요. 각 방법을 누르면 진행 순서와 결과별 다음 선택을 살펴볼 수 있어요. 이 지도는 빠른 체험용 예시로, 개별 사실관계와 법적 요건을 확인한 맞춤 법률 판단은 아니에요.'};
}
