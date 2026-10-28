import type {IntakePlan} from './intake';
import type {DetailSupplement,LegalCase,RoadmapNode,ScenarioPreview} from './types';
import {SHOWCASE_QUESTIONS,SHOWCASE_STORY,showcaseCase} from './portfolio-showcase';

/**
 * Pre-authored, illustrative fixtures for the explicitly clicked wage example ONLY.
 * No API calls, no claims of verification, and no assumptions that a court judgment exists.
 */
export const WAGE_EXAMPLE_DELAY_MS=3000;
const progressChoices=SHOWCASE_QUESTIONS.questions[0].choices;
const amountChoices=SHOWCASE_QUESTIONS.questions[1].choices;
const scenarios={
  status:{
    suitableWhen:'이미 접수한 기관과 현재 진행 상황을 구별해야 할 때',
    steps:[
      {title:'접수 기관과 사건번호 확인',description:'노동청 진정인지 법률구조 신청인지, 접수 여부를 확인해요.'},
      {title:'조사·상담 진행 상황 확인',description:'담당 기관의 통지와 추가 자료 요청을 확인해요.'},
      {title:'지급 여부 및 후속 절차 검토',description:'돈이 지급되었는지 확인하고 미지급 시 다음 경로를 비교해요.'}
    ],
    outcomes:[
      {title:'임금 지급 완료',condition:'미지급 임금이 모두 입금되면',description:'금액을 확인하고 관련 증빙을 보관해요.',terminal:true},
      {title:'지급되지 않음',condition:'절차 후에도 임금이 지급되지 않으면',description:'진정 진행 상황을 확인하고 민사상 청구를 검토해요.'}
    ],
    transitions:[{targetId:'wage-court',condition:'회수가 필요해 법원 청구를 검토하는 경우'}]
  },
  courtStatus:{
    suitableWhen:'소송·지급명령·판결 중 현재 단계가 명확하지 않을 때',
    steps:[
      {title:'사건과 결정 상태 확인',description:'소송 진행 중인지, 지급명령인지, 판결이 있는지 구별해요.'},
      {title:'송달·확정 여부 확인',description:'결정이나 판결의 송달 및 이의·항소 여부를 확인해요.'},
      {title:'지급 또는 집행 가능성 검토',description:'상대의 지급 여부와 집행 가능한 서류가 있는지 확인해요.'}
    ],
    outcomes:[
      {title:'전액 지급',condition:'상대가 전액 지급하면',description:'입금을 확인하고 절차를 정리해요.',terminal:true},
      {title:'후속 집행 필요',condition:'집행 가능한 권원이 있고도 미지급이면',description:'집행 대상 재산과 채권압류 등 방법을 살펴봐요.'}
    ],
    transitions:[{targetId:'wage-enforce',condition:'집행권원 등 필요한 조건을 충족한 경우'}]
  },
  enforce:{
    suitableWhen:'집행권원이 있고 상대가 임금을 계속 지급하지 않는 경우에만 검토해요.',
    steps:[
      {title:'집행권원과 잔액 확인',description:'판결·결정 등의 집행 가능 여부와 미회수 금액을 확인해요.'},
      {title:'압류 대상 재산 검토',description:'확인된 은행예금·매출채권 등 실제 집행 대상이 있는지 살펴봐요.'},
      {title:'압류·추심 등 진행',description:'해당 재산과 권원에 맞는 법원 절차를 검토해요.'}
    ],
    outcomes:[
      {title:'전액 회수',condition:'미지급금이 모두 회수되면',description:'받은 금액을 확인하고 관련 기록을 정리해요.',terminal:true},
      {title:'일부 회수 또는 미회수',condition:'전액을 받지 못했다면',description:'남은 금액과 다른 집행 대상 재산을 검토해요.',
       nextSteps:[{title:'미회수액 확인',description:'받은 돈을 공제해 남은 금액을 계산해요.'},{title:'다른 집행 수단 검토',description:'추가로 확인되는 재산과 절차를 살펴봐요.'}]}
    ]
  }
} satisfies Record<string,ScenarioPreview>;

function node(id:string,title:string,description:string,scenario:ScenarioPreview):RoadmapNode{
 return {
  id,kind:'route',title,description,status:'possible',detailVersion:3,conditions:[],actions:[],
  documents:[],documentChecklist:[],cost:'',duration:'',risks:[],sourceIds:[],next:[],scenario
 };
}
const statusNode=node('wage-status','기존 진정·구조 진행 상황 확인','신청한 절차의 종류와 현재 진행 단계를 먼저 확인해요.',scenarios.status);
const courtStatusNode=node('wage-court-status','소송·지급명령·판결 상태 확인','이미 시작한 법원 절차와 결정의 효력을 구별해요.',scenarios.courtStatus);
const enforceNode=node('wage-enforce','확정 후 강제집행 검토','집행 가능한 권원이 있을 때 재산 확인과 압류·추심을 검토해요.',scenarios.enforce);
const stageRoutes=[
 ['wage-request','wage-labor','wage-court'],
 ['wage-status','wage-labor','wage-court'],
 ['wage-court-status','wage-court','wage-enforce']
] as const;
function progressIndex(plan:IntakePlan):number{
 return progressChoices.indexOf(plan.answers[0]?.choice||'');
}
export function wageExamplePlan():IntakePlan{
 return {
  original:SHOWCASE_STORY,
  questions:SHOWCASE_QUESTIONS.questions.map(q=>({...q,choices:[...q.choices]})),
  routes:SHOWCASE_QUESTIONS.routes.map(r=>({...r})),
  answers:[]
 };
}
export function nextWageExamplePlan(plan:IntakePlan):IntakePlan{
 const stage=progressIndex(plan);
 const questions=plan.questions.map(q=>({...q,choices:[...q.choices]}));
 if(stage===1){
  questions[2]={question:'노동청 진정이나 법률구조 중 어느 절차를 시작했고, 지금 어떤 단계인가요?',why:'접수 기관과 진행 상태를 구별하면 필요한 다음 절차를 더 분명하게 볼 수 있어요.',choices:[]};
 }else if(stage===2){
  questions[2]={question:'소송·지급명령·판결 중 어디까지 진행했고, 어떤 서류를 받았나요?',why:'소송 중인 상태와 집행할 수 있는 결정·판결을 구별해야 해요.',choices:[]};
 }else if(stage===-1){
  questions[2]={question:'현재까지 진행한 절차와 퇴사 시기, 회사의 답변을 알려주세요.',why:'확인되지 않은 진행 상태는 임의로 완료 처리하지 않아요.',choices:[]};
 }
 const seed=showcaseCase(12).nodes;
 const all=[...seed,statusNode,courtStatusNode,enforceNode];
 const ids=stage>=0?stageRoutes[stage]:stageRoutes[0];
 return {...plan,questions,routes:ids.map(id=>{const n=all.find(n=>n.id===id)!;return {title:n.title,description:n.description}})};
}
export function wageExampleResult(plan:IntakePlan):Pick<LegalCase,'nodes'|'edges'|'facts'|'sources'|'evidenceStatus'|'detailSupplements'> & {reply:string}{
 const stage=progressIndex(plan);
 const amount=plan.answers[1]?.choice||'정확히 모르겠어요';
 const amountLabel=amountChoices.includes(amount)?amount:'금액 미확인';
 const detail=plan.answers[2]?.detail.trim()||plan.answers[2]?.choice.trim()||'추가 상황 미입력';
 const routeIds=stage>=0?stageRoutes[stage]:stageRoutes[0];
 const starting=stage===0?'회사에 지급을 요구한 상태':stage===1?'노동청 진정·법률구조 절차를 시작한 상태':stage===2?'법원 절차를 시작한 상태':'현재 진행 단계가 확인되지 않은 상태';
 const root=showcaseCase(12).nodes.find(n=>n.id==='wage-now')!;
 const available=[...showcaseCase(12).nodes,statusNode,courtStatusNode,enforceNode];
 const routes=routeIds.map(id=>structuredClone(available.find(n=>n.id===id)!));
 const nodes=[{...root,title:'퇴사 후 체불임금 상담',description:`선택한 진행 상황: ${starting}. 체불 금액: ${amountLabel}.`,next:[...routeIds]},...routes];
 const facts=[`진행 상태 선택: ${plan.answers[0]?.choice||'정확히 모르겠어요'}`,`체불 금액 범위: ${amountLabel}`,`추가 진술: ${detail.slice(0,400)}`];
 const detailSupplements:Record<string,DetailSupplement>={};
 for(const route of routes){
   route.scenario?.steps.forEach((step,index)=>{
     detailSupplements[`scenario:${route.id}:step:${index}`]={actions:[step.description||''].filter(Boolean),conditions:step.condition?[step.condition]:[],documents:step.documents||[],documentChecklist:[],cost:step.cost||'',risks:[],sourceIds:step.sourceIds||[],detailVersion:3};
   });
   route.scenario?.outcomes.forEach((outcome,index)=>{
     detailSupplements[`scenario:${route.id}:outcome:${index}`]={actions:[],conditions:outcome.condition?[outcome.condition]:[],documents:[],documentChecklist:[],cost:'',risks:[],sourceIds:[],detailVersion:3};
     outcome.nextSteps?.forEach((step,followIndex)=>{
       detailSupplements[`scenario:${route.id}:outcome:${index}:followup:${followIndex}`]={actions:[step.description||''].filter(Boolean),conditions:step.condition?[step.condition]:[],documents:step.documents||[],documentChecklist:[],cost:step.cost||'',risks:[],sourceIds:step.sourceIds||[],detailVersion:3};
     });
   });
 }
 const reply= `입력하신 단계(${starting})와 금액 범위(${amountLabel})를 기준으로 가능한 경로를 지도에 정리했어요. 각 방법을 선택하면 준비 단계와 결과에 따른 갈림길을 바로 펼칠 수 있어요. 이 화면은 빠른 체험용 사전 구성 예시이며, 입력한 사실과 법적 요건에 대한 개별 검증 결과는 아니에요.`;
 return {nodes,edges:routeIds.map(id=>({source:root.id,target:id})),facts,sources:[],evidenceStatus:'unverified',detailSupplements,reply};
}
