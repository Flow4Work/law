import type {LegalAnswer,LegalCase,RoadmapEdge,RoadmapNode} from './types';

export type IntakeQuestion={question:string;choices:string[];why?:string};
export type IntakeRoute={title:string;description:string;excludeWhen?:{questionIndex:number;choiceIndex:number}[]};
export type IntakeAnswer={choice:string;detail:string};
export type IntakePlan={
 original:string; questions:IntakeQuestion[]; routes:IntakeRoute[]; answers:IntakeAnswer[];
 complete?:boolean; facts?:string[]; missing?:string[];
};
export function recordIntakeAnswer(value:LegalCase,answer:IntakeAnswer):LegalCase|null{
 const plan=value.intake;
 const index=plan?.answers.length??0;
 const question=plan?.questions[index];
 if(!plan||!question||(!answer.choice.trim()&&!answer.detail.trim()))return null;
 const createdAt=new Date().toISOString();
 const questionId=`${value.id}:intake:${index}:question`;
 const answerId=`${value.id}:intake:${index}:answer`;
 return {...value,updatedAt:createdAt,intake:{...plan,answers:[...plan.answers,answer]},messages:[
  ...value.messages.filter(message=>message.id!==questionId&&message.id!==answerId),
  {id:questionId,role:'assistant',content:question.question,createdAt},
  {id:answerId,role:'user',content:[answer.choice.trim(),answer.detail.trim()].filter(Boolean).join('\n'),createdAt}
 ]};
}
const str=(value:unknown,max=180)=>typeof value==='string'?value.trim().slice(0,max):'';
const list=(value:unknown,max=4)=>Array.isArray(value)?value.flatMap(x=>typeof x==='string'&&x.trim()?[x.trim().slice(0,170)]:[]).slice(0,max):[];
const q=(question:string,choices:string[],why:string):IntakeQuestion=>({question,choices,why});

// Used only as an operational fallback when no AI answer is available.
// This never replaces the primary, legally informed model interview.
function recoveryQuestion(story:string,plan?:IntakePlan):IntakeQuestion{
 const text=story+' '+(plan?.answers||[]).map(a=>a.choice+' '+a.detail).join(' ');
 const asked=(plan?.questions||[]).map(x=>x.question).join(' ');
 const choices=(question:string,values:string[],why:string)=>q(question,values,why);
 const labor=/임금|월급|급여|퇴사|체불|퇴직금|해고/.test(text);
 const housing=/보증금|월세|전세|임대차|임차|집주인/.test(text);
 const criminal=/불송치|고소|경찰|검찰|폭행|사기|피의자|형사|스토킹/.test(text);
 const candidates:IntakeQuestion[]=labor?[
  /판결|압류|강제집행|집행권원/.test(story)?
   choices('판결 이후 지금까지 어떤 집행을 진행했고 실제로 회수한 금액이 있나요?',[],'이미 판결을 받았다면 다음은 회수 단계예요.'):
   choices('노동청이나 법원에서 어떤 절차까지 진행했나요?',['아직 공식 절차를 시작하지 않았어요','진정이나 소송이 진행 중이에요','판결이나 결정문까지 받았어요'],'절차에 따라 다음 대응이 크게 달라져요.'),
  choices('지급받지 못한 것은 어떤 항목이며 얼마인가요?',[],'청구 대상과 금액에 따라 대응을 정해요.'),
  choices('마지막 임금 지급일 또는 퇴사일은 언제인가요?',[],'지급 시점과 시효 판단에 중요해요.')
 ]:housing?[
  /계약.{0,8}(끝|종료|만료|해지)/.test(story)?
   choices('보증금을 받지 못한 채 이사했거나 전출할 예정인가요?',['아직 살고 있어요','이사하거나 전출할 예정이에요','이미 이사하거나 전출했어요'],'퇴거 시점에 따라 권리 보전 방법이 달라져요.'):
   choices('계약이 법적으로 종료된 상태인가요?',['종료되었어요','아직 계약기간 중이에요','종료 여부를 다투고 있어요'],'계약 종료가 반환청구 절차의 핵심 요건이에요.'),
  choices('임차권등기명령을 신청하거나 등기 완료를 확인했나요?',['아직 신청하지 않았어요','신청만 했어요','등기 완료를 확인했어요'],'신청과 등기 완료는 법적 효과가 달라요.'),
  choices('집주인이 반환을 거부하는 이유나 계약 관련 다툼은 무엇인가요?',[],'분쟁 사유에 따라 절차가 달라져요.')
 ]:criminal?[
  /불송치|불기소|약식명령|결정|처분/.test(story)?
   choices('받은 공식 통지서의 정확한 처분명과 받은 날짜는 언제인가요?',[],'처분 종류와 통지일에 따라 불복 절차가 달라져요.'):
   choices('경찰에서 어떤 지위로 연락했나요?',['피의자 또는 신고 대상이에요','피해자 또는 고소인이에요','참고인인지 등 아직 모르겠어요'],'본인의 사건 지위에 따라 권리가 달라져요.'),
  choices('공식 처분 통지나 출석 요청서를 받았나요?',['출석 요청을 받았어요','처분 결과 통지를 받았어요','전화로만 전달받았어요'],'통지 종류에 따라 대응이 달라져요.'),
  choices('상대방 주장과 다른 핵심 사실이나 증거는 무엇인가요?',[],'증거의 쟁점이 실제 대응을 바꿀 수 있어요.')
 ]:[
  choices('이미 소송이나 결정·판결을 받은 상태인가요?',['아직 법적 절차를 시작하지 않았어요','진행 중인 절차가 있어요','판결이나 공식 결정을 받았어요'],'현재 단계에 맞는 절차를 찾아야 해요.'),
  choices('상대방이 법적으로 다투는 핵심 사실은 무엇인가요?',[],'쟁점에 따라 적용 법률과 대응이 달라져요.'),
  choices('문제가 발생한 날짜와 관련 문서를 간단히 알려주시겠어요?',[],'기한이나 권리 성립 여부를 확인해요.')
 ];
 const earlier=asked.replace(/\s+/g,'');
 const alreadyHasAmount=/\d[\d,.]*\s*(원|만원|만\s*원|억원|억\s*원)/.test(story);
 const hasProgressQuestion=/노동청|진정|소송|법원|공식.{0,4}절차/.test(asked);
 return candidates.find(c=>{
  if(earlier.includes(c.question.replace(/\s+/g,'')))return false;
  if(hasProgressQuestion&&/노동청이나 법원에서 어떤 절차/.test(c.question))return false;
  if(alreadyHasAmount&&/어떤 항목이며 얼마/.test(c.question))return false;
  if((plan?.questions||[]).some(x=>questionTopic(x.question)===questionTopic(c.question)))return false;
  return true;
 })||candidates[Math.min(plan?.answers.length||0,candidates.length-1)];
}
function questionTopic(value:string):string{
 const t=value.replace(/\s/g,'');
 if(/압류|집행|추심|매각|환가|회수한|제3채무자/.test(t))return 'enforcement';
 if(/불송치.*이유|처분.*이유|불복.*근거/.test(t))return 'criminal-reason';
 if(/퇴사일|퇴직일|지급일|시점|언제|날짜|기간/.test(t))return 'date';
 if(/얼마|금액|액수/.test(t))return 'amount';
 if(/전입|전출|이사|거주|주민등록/.test(t))return 'housing-possession';
 if(/피의자|피해자|고소인|참고인|지위|신분/.test(t))return 'standing';
 if(/증거|자료|서류|기록|입증/.test(t))return 'evidence';
 if(/불송치|불기소|기소|통지서|결정서|처분/.test(t))return 'official-decision';
 if(/노동청|진정|소송|법원|판결|공식.{0,4}절차|고소|신고|어디까지진행|시작한적/.test(t))return 'procedure-stage';
 return 'other:'+t.slice(0,18);
}
function fallbackRoutes(story:string,prior?:IntakePlan):IntakeRoute[]{
 if(prior?.routes?.length)return prior.routes;
 if(/임금|급여|월급|퇴사|퇴직금|체불/.test(story)){
  return /판결|강제집행|압류/.test(story)?[
   {title:'집행 상태 확인',description:'판결문과 이미 진행한 압류·집행 내역을 확인해요.'},
   {title:'현실적인 회수 방법',description:'압류 가능한 재산과 매각·추심 가능성을 구별해요.'}
  ]:[
   {title:'체불 범위 확인',description:'이미 지급된 금액과 남은 청구액을 구별해요.'},
   {title:'공식 구제 절차',description:'진정과 소송 중 현재 단계에 맞는 절차를 검토해요.'}
  ];
 }
 if(/보증금|전세|임대차|월세/.test(story))return [
  {title:'반환요건 확인',description:'계약 종료와 보증금 반환 조건을 확인해요.'},
  {title:'권리 보전 검토',description:'이사 또는 전출 전후 필요한 조치를 살펴봐요.'}
 ];
 if(/경찰|수사|고소|폭행|불송치|검찰/.test(story))return [
  {title:'사건 단계 확인',description:'공식 통지와 법적 지위를 구별해요.'},
  {title:'단계별 대응',description:'확인된 처분에 맞는 절차를 검토해요.'}
 ];
 return [{title:'권리와 사건 단계 확인',description:'현재 적용되는 법적 요건을 구별해요.'},{title:'가능한 대응 검토',description:'확인된 사실에 맞는 절차를 좁혀가요.'}];
}

export function normalizeIntake(raw:unknown,original:string,prior?:IntakePlan):IntakePlan{
 const obj=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const previous: IntakePlan|undefined=prior;
 const questions=[...(previous?.questions||[])];
 const answers=[...(previous?.answers||[])];
 const existing=new Set(questions.map(item=>item.question.replace(/\s+/g,'')));
 const qraw=obj.question&&typeof obj.question==='object'?obj.question as Record<string,unknown>:null;
 let nextQuestion=qraw&&str(qraw.question,230)?{
  question:str(qraw.question,155),
  choices:list(qraw.choices,3).slice(0,3),
  why:str(qraw.why,100)
 }:null;
 if(nextQuestion&&nextQuestion.choices.length!==3)nextQuestion.choices=[];
 // Exact dates, amounts and loosely bounded time ranges are better entered directly.
 if(nextQuestion&&/(언제|정확한 날짜|며칠|몇\s*(주|달|개월)|얼마나|기간|시점|금액|얼마)/.test(nextQuestion.question)&&nextQuestion.choices.some(c=>/\d+|월|년|주일/.test(c)))nextQuestion.choices=[];
 if(nextQuestion&&existing.has(nextQuestion.question.replace(/\s+/g,'')))nextQuestion=null;
 if(nextQuestion){
  const category=questionTopic(nextQuestion.question);
  if(!category.startsWith('other:')&&questions.some(q=>questionTopic(q.question)===category))nextQuestion=null;
 }
 const shouldComplete=answers.length>=3||(answers.length>=2&&obj.done===true);
 if(!shouldComplete&&questions.length<3){
  questions.push(nextQuestion||recoveryQuestion(original,previous));
 }
 if(!questions.length)questions.push(recoveryQuestion(original));
 const rawRoutes=Array.isArray(obj.routes)?obj.routes:[];
 const policeOnly=/불송치/.test(original)&&!/불기소/.test(original);
 const enforced=/승소|판결|강제집행|압류/.test(original);
 const digital=/가상자산|코인|토큰|FANC|이전청구권|반환청구권/.test(original);
 const routes=rawRoutes.slice(0,3).flatMap(entry=>{
  if(!entry||typeof entry!=='object')return [];
  const item=entry as Record<string,unknown>;
  const title=str(item.title,75),description=str(item.description,260);
  if(!title||!description)return [];
  if(policeOnly&&/검찰.{0,7}불기소|불기소.{0,8}항고/.test(title))return [];
  if(enforced&&/처음부터.{0,8}소송|지급명령.{0,8}신청|노동청.{0,8}진정/.test(title))return [];
  if(digital&&/은행계좌|거래소 계좌|채권자배당/.test(title))return [];
  // Never remove a legal possibility based on an unverified or interpretive exclusion.
  return [{title,description,excludeWhen:[] as IntakeRoute['excludeWhen']}];
 });
 return {
  original:str(original,7000),
  questions:questions.slice(0,3),
  routes:routes.length?routes:fallbackRoutes(original,previous),
  answers,
  complete:shouldComplete,
  facts:list(obj.facts,12).length?list(obj.facts,12):previous?.facts||[],
  missing:list(obj.missing,8).length?list(obj.missing,8):previous?.missing||[]
 };
}

export function previewIntake(plan:IntakePlan):Pick<LegalCase,'nodes'|'edges'>{
 const root:RoadmapNode={
  id:'intake-situation',title:'현재 상황',description:plan.original.slice(0,230),status:'current',kind:'situation',
  conditions:[],actions:[],documents:[],cost:'',duration:'',risks:[],sourceIds:[],next:[]
 };
 const nodes:RoadmapNode[]=[root,...plan.routes.slice(0,3).map((route,index)=>({
  id:'intake-route-'+index,title:route.title,description:route.description,
  status:'verify' as const,kind:'route' as const,
  conditions:['추가 사실 및 법적 근거 확인 전이에요.'],actions:[],documents:[],cost:'',duration:'',risks:[],sourceIds:[],next:[]
 }))];
 const edges:RoadmapEdge[]=nodes.slice(1).map(node=>({source:root.id,target:node.id}));
 root.next=edges.map(edge=>edge.target);
 return {nodes,edges};
}
/** Match the verified analysis to the provisional IDs when it refers to the same actual subject.
 * This preserves React Flow's card identity without keeping discarded legal paths.
 */
export function reconcileIntakeResult(result:LegalAnswer,previous?:LegalCase):LegalAnswer{
 if(!previous?.intake?.routes.length||!previous.nodes.length)return result;
 const mapping=new Map<string,string>();
 const originalRoot=previous.nodes.find(node=>node.kind==='situation');
 const analyzedRoot=result.nodes.find(node=>node.kind==='situation')||result.nodes.find(node=>!result.edges.some(edge=>edge.target===node.id));
 if(originalRoot&&analyzedRoot&&originalRoot.id!==analyzedRoot.id)mapping.set(analyzedRoot.id,originalRoot.id);
 const normalize=(title:string)=>title.replace(/\s+/g,'');
 for(const node of result.nodes.filter(item=>item.kind==='route')){
  const prior=previous.nodes.find(item=>item.kind==='route'&&normalize(item.title)===normalize(node.title));
  if(prior&&prior.id!==node.id&&!result.nodes.some(item=>item.id===prior.id)&&![...mapping.values()].includes(prior.id))mapping.set(node.id,prior.id);
 }
 if(!mapping.size)return result;
 const mapId=(id:string)=>mapping.get(id)||id;
 return {...result,
  nodes:result.nodes.map(node=>({...node,id:mapId(node.id),next:node.next.map(mapId),
   scenario:node.scenario?.transitions?{...node.scenario,transitions:node.scenario.transitions.map(t=>({...t,targetId:mapId(t.targetId)}))}:node.scenario
  })),
  edges:result.edges.map(edge=>({...edge,source:mapId(edge.source),target:mapId(edge.target)}))
 };
}
export function intakeSummary(plan:IntakePlan):string{
 return '상담에서 확인한 내용:\n'+plan.answers.map((answer,i)=>{
  const label=plan.questions[i]?.question||'추가로 확인한 사항';
  return label+'\n'+[answer.choice,answer.detail].filter(Boolean).join(' / ');
 }).join('\n\n');
}
