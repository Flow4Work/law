import type {IntakePlan} from './intake';
export type NodeStatus = 'current' | 'possible' | 'done' | 'verify' | 'unavailable';
export type LegalSource = {
  id: string; title: string; url: string; kind: '법령' | '판례' | '공식 안내';
  date?: string; effectiveDate?: string; snippet?: string; verifiedAt: string;
  requiredDocuments?:string[];
};
export type DocumentRecommendation={name:string;necessity:'required'|'helpful'|'conditional'|'check';reason:string;condition?:string;sourceIds:string[]};
export type OutcomeLikelihood='full'|'partial'|'hard'|'other';
export type LegalPrerequisite={type:'required'|'conditional'|'recommended';label:string;sourceIds:string[]};
export type ScenarioStep={title:string;description?:string;condition?:string;duration?:string;documents?:string[];cost?:string;sourceIds?:string[]};
export type ScenarioOutcome={title:string;description:string;condition?:string;summary?:string;likelihood?:OutcomeLikelihood;terminal?:boolean;nextSteps?:ScenarioStep[]};
export type ScenarioTransition={targetId:string;condition:string;label?:string};
export type ScenarioTiming={label:string;description:string;kind:'deadline'|'variable'|'estimate';sourceIds:string[];minDays?:number;maxDays?:number};
export type ScenarioPreview={
 suitableWhen:string;
 steps:ScenarioStep[];
 outcomes:ScenarioOutcome[];
 transitions?:ScenarioTransition[];
 timing?:ScenarioTiming[];
};
export type RoadmapNode = {
  id: string; title: string; description: string; status: NodeStatus;
  /** 카드 전용 핵심 세 문장. 문장마다 24자 이하이며 원문과 별도로 보관합니다. */
  summaryLines?:string[];
  /** Verified legal dependencies, separate from general explanatory copy. */
  legalPrerequisites?:LegalPrerequisite[];
  conditions: string[]; actions: string[]; documents: string[];
  cost: string; duration: string; risks: string[]; sourceIds: string[]; next: string[];
  /** 근거가 확인된 예상 기간만 숫자로 보관합니다. 없으면 확인 상태를 표시합니다. */
  durationMinDays?:number; durationMaxDays?:number; durationSourceIds?:string[];
  documentChecklist?:DocumentRecommendation[];
  userConfirmed?:boolean;
  detailVersion?:number;
  kind?:'situation'|'route'|'step'|'outcome'|'followup'|'completion';
  linkedRouteId?:string;
  scenarioFollowUp?:number;
  scenario?:ScenarioPreview;
  scenarioIndex?:number;
  /** 공개한 절차 수. steps.length + 1이면 결과 갈래까지 공개. 완료 상태와 별개입니다. */
  scenarioRevealed?:number;
  scenarioParentId?:string;
  scenarioStep?:number;
  scenarioOutcome?:number;
};
export type RoadmapEdge = {source:string;target:string;label?:string};
export type FollowUpQuestion={question:string;choices:string[]};
export type LegalAnswer = {
  answer: string; options: string[]; nextAction: string; question: string;
  facts: string[]; nodes: RoadmapNode[]; edges: RoadmapEdge[];
  title?:string; openQuestions?:string[]; followUpQuestions?:FollowUpQuestion[];
};
export type Message = {id:string;role:'user'|'assistant';content:string;createdAt:string;
  options?:string[]; nextAction?:string; question?:string; followUpQuestions?:FollowUpQuestion[]; verified?:boolean; error?:boolean};
export type DetailSupplement={
  actions:string[]; conditions:string[]; documents:string[]; documentChecklist:DocumentRecommendation[];
  cost:string; risks:string[]; sourceIds:string[]; detailVersion:number;
};
export type LegalCase = {
  id:string; name:string; updatedAt:string; createdAt:string; messages:Message[];
  facts:string[]; nodes:RoadmapNode[]; edges:RoadmapEdge[]; sources:LegalSource[];
  evidenceStatus:'verified'|'unverified'|'partial'; lastChecked?:string; demo?:boolean; examplePreset?:'wage-fast'|'deposit-fast'|'police-fast';
  progress?:Record<string,NodeStatus>; pendingNextFrom?:string;
  /** 펼쳐진 하위 절차의 준비 정보는 지도 원본을 변경하지 않고 별도로 보관합니다. */
  detailSupplements?:Record<string,DetailSupplement>;
  openQuestions?:string[]; analysisVersion?:number; modelId?:string; intake?:IntakePlan;
};
export const NODE_STATUS:Record<NodeStatus,{label:string;color:string}>={
  current:{label:'지금 상황',color:'#d60a1f'},possible:{label:'살펴볼 방법',color:'#626262'},
  done:{label:'여기까지 했어요',color:'#64748b'},verify:{label:'먼저 확인해요',color:'#383838'},
  unavailable:{label:'다른 방법을 살펴봐요',color:'#94a3b8'}
};
export const EXAMPLE_QUESTIONS = [
  '퇴사했는데 아직 월급을 못 받았어요.',
  '계약이 끝났는데 보증금을 안 돌려줘요.',
  '경찰서에 오라는 연락을 받았어요.'
];
const BASE_DEMO_NODES:RoadmapNode[] = [
  {id:'demo-start',title:'돈을 받을 판결을 받았어요',description:'법원에서 돈을 주라는 판결을 받았지만, 상대가 아직 돈을 주지 않았어요.',status:'done',conditions:['승소 판결 존재'],actions:['판결문과 송달 내역 확보'],documents:['판결문'],cost:'사건별 확인',duration:'사건별 확인',risks:['판결 확정 여부와 집행 가능 여부를 확인해야 합니다.'],sourceIds:[],next:['demo-check']},
  {id:'demo-check',title:'돈을 받으려면 무엇이 필요할까요?',description:'판결문으로 돈을 받아낼 수 있는지, 먼저 필요한 서류를 확인해요.',status:'current',conditions:['판결로 돈을 받아내는 데 필요한 서류를 확인해요.'],actions:['판결문이 어떤 상태인지, 추가 서류가 필요한지 확인해요.'],documents:['판결문','판결문이 상대에게 전달됐다는 증명서 등 필요한 서류'],cost:'발급·신청 수수료 확인',duration:'서류 발급 및 심사에 따라 다름',risks:['판결문 등 문서 종류에 따라 필요한 준비가 달라져요.'],sourceIds:[],next:['demo-bank','demo-property','demo-disclose']},
  {id:'demo-bank',title:'상대방의 은행을 알고 있어요',description:'은행에 있는 돈으로 돌려받는 방법을 살펴봐요.',status:'possible',conditions:['어느 은행에 어떤 돈이 있는지 확인할 단서가 있어요.'],actions:['돈을 맡은 은행과 돌려받을 금액을 확인해요.','어느 법원에 어떻게 신청하는지 확인해요.'],documents:['집행 서류','채권 명세'],cost:'법원 수수료와 서류 전달 비용을 확인해요.',duration:'법원 처리 기간에 따라 달라짐',risks:['계좌에 돈이 적으면 비용을 들여도 돌려받는 돈이 적을 수 있어요.'],sourceIds:[],next:['demo-recover']},
  {id:'demo-property',title:'다른 재산을 알고 있어요',description:'부동산이나 월급 등에서 돈을 받을 방법을 살펴봐요.',status:'possible',conditions:['어떤 재산에서 돈을 받을지, 필요한 조건을 확인해요.'],actions:['알고 있는 재산과 돈을 받을 단서를 정리해요.','그 재산에서 돈을 받을 수 있는지 확인해요.'],documents:['재산 관련 단서'],cost:'조사·집행 비용 확인',duration:'재산 유형별 상이',risks:['돌려받을 수 있는 돈과 드는 비용을 함께 살펴봐요.'],sourceIds:[],next:['demo-recover']},
  {id:'demo-disclose',title:'어떤 재산이 있는지 몰라요',description:'법원을 통해 재산 목록을 확인할 수 있는지 알아봐요.',status:'verify',conditions:['신청할 수 있는 조건과 예외를 확인해요.'],actions:['신청 조건과 어느 법원에 낼지 확인해요.'],documents:['판결문 등 신청에 필요한 서류'],cost:'법원 수수료와 서류 전달 비용을 확인해요.',duration:'법원 절차에 따라 다름',risks:['내 상황에서 신청할 수 있는지 먼저 확인해요.'],sourceIds:[],next:['demo-recover']},
  {id:'demo-recover',title:'받은 돈과 남은 돈을 확인해요',description:'받은 돈과 아직 못 받은 돈을 나누어 다음 행동을 정해요.',status:'verify',conditions:['집행 결과 확인'],actions:['변제·집행 결과 정리'],documents:['수령 증빙'],cost:'절차에 따라 달라짐',duration:'회수 수단별 상이',risks:['사건별 채권 잔액을 따로 계산해야 합니다.'],sourceIds:[],next:[]}
];
const DEMO_DETAILS:Record<string,Partial<RoadmapNode>>={
 'demo-check':{documentChecklist:[
  {name:'판결문',necessity:'conditional',reason:'누가 누구에게 얼마를 지급하라는 판결인지 확인하는 데 써요.',condition:'판결을 근거로 돈을 받는 절차를 준비할 때',sourceIds:[]},
  {name:'판결문 전달 내역과 관련 증명서',necessity:'check',reason:'상대방에게 판결문이 전달됐는지 확인하는 자료예요. 어떤 증명서가 필요한지는 준비하는 절차에서 확인해요.',sourceIds:[]},
  {name:'최근 입금 내역',necessity:'helpful',reason:'이미 받은 금액을 빼고 아직 받지 못한 돈을 계산할 때 도움이 돼요.',sourceIds:[]}
 ],risks:['판결을 받았다고 상대 계좌에서 돈이 자동으로 빠져나오는 것은 아니에요. 먼저 판결문과 전달 내역을 확인하고, 실제로 돈을 받기 위해 어떤 신청을 해야 하는지 나누어 살펴봐요.','상대가 일부라도 돈을 줬다면 그 금액을 따로 기록해요. 처음 판결 금액만 보고 진행하면 남은 금액을 잘못 계산할 수 있으니 최근 입금 내역도 함께 확인해요.']},
 'demo-bank':{documentChecklist:[
  {name:'판결문 등 집행 근거 문서',necessity:'conditional',reason:'돈을 받을 권리를 어떤 문서로 확인할 수 있는지 살펴보는 데 필요해요.',condition:'판결 등을 근거로 집행을 준비할 때',sourceIds:[]},
  {name:'돌려받을 금액 계산표',necessity:'helpful',reason:'받을 돈과 이미 받은 돈을 나누어 신청 금액을 정리할 수 있어요.',sourceIds:[]}
 ],risks:['상대가 이용하는 은행을 알아도 그 계좌에 돈이 있다는 뜻은 아니에요. 진행 비용을 먼저 쓰고도 회수하지 못할 수 있으니 알고 있는 은행 정보와 예상 비용을 함께 살펴봐요.','이미 받은 돈이나 상대가 지급한 금액이 있다면 계산표에서 빠뜨리지 말아요. 입금 날짜와 금액을 기록해 두면 청구하는 금액을 설명하기 쉬워요.']}
};
export const DEMO_NODES:RoadmapNode[]=BASE_DEMO_NODES.map(n=>({...n,...DEMO_DETAILS[n.id],detailVersion:2}));
export const DEMO_EDGES:RoadmapEdge[]=[
  {source:'demo-start',target:'demo-check'},
  {source:'demo-check',target:'demo-bank',label:'은행을 알면'},
  {source:'demo-check',target:'demo-property',label:'다른 재산을 알면'},
  {source:'demo-check',target:'demo-disclose',label:'재산을 모르면'},
  {source:'demo-bank',target:'demo-recover'},
  {source:'demo-property',target:'demo-recover'},
  {source:'demo-disclose',target:'demo-recover'}
];
