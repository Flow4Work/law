import type {LegalCase,RoadmapNode} from './types';
import {COURT_SOURCES} from './legal-guidance';

const base={conditions:[],actions:[],documents:[],documentChecklist:[],cost:'',duration:'',risks:[],sourceIds:[],next:[],detailVersion:3} satisfies Partial<RoadmapNode>;
const nodes:RoadmapNode[]=[
 {...base,id:'civil-now',kind:'situation',status:'current',title:'돌려받지 못한 돈이 있어요',description:'받기로 한 날이 지났어요. 상대가 다투는지, 합의할 수 있는지에 따라 방법이 달라져요.',actions:['받을 금액과 약속한 날짜, 상대가 한 말을 정리해요.'],next:['civil-payment','civil-mediation','civil-suit'],conditions:['아직 신청 전인 금전 청구의 예시예요.'],risks:['상대가 금액을 인정하고 지급일에 합의할 수 있다면 법원에 신청하기 전 협의할 수도 있어요. 다만 약속만 한 상태와 실제로 돈을 받은 상태를 구별하고, 금액·기한·입금 내역을 남겨요.']},
 {...base,id:'civil-payment',kind:'route',status:'possible',title:'지급명령으로 요청하기',description:'서류 심사로 지급을 요청해요. 상대가 이의하면 소송으로 넘어가요.',sourceIds:['guide-court-payment'],actions:['지급기일과 청구금액을 확인하고, 신청서에 쓸 상대방 주소와 근거 자료를 정리해요.'],
  scenario:{suitableWhen:'상대가 돈을 갚아야 한다는 점을 크게 다투지 않고, 서류를 보낼 주소도 알 때 먼저 비교해 볼 수 있어요.',
   steps:[{title:'신청·서류 심사',description:'받을 돈과 이유를 적어 신청해요. 보완 요청이 오면 내용을 고쳐요.'},{title:'상대에게 전달',description:'법원이 지급명령을 보내요. 전달되지 않으면 주소를 고쳐 다시 보내거나 소송으로 넘길지 확인해요.'},{title:'이의 여부 확인',description:'상대가 서류를 받은 뒤 2주 안에 이의하는지에 따라 다음 과정이 달라져요.'}],
   outcomes:[{title:'이의 없이 확정',condition:'상대가 기한 안에 이의하지 않으면',description:'강제집행의 근거가 될 수 있어요. 그래도 돈을 주지 않으면 재산에서 실제로 받는 절차를 따로 살펴봐요.'},{title:'다투면 소송으로',condition:'상대가 적법하게 이의하면',description:'소송으로 넘어가 주장과 증거를 다퉈요. 처음 신청했다고 곧바로 돈을 받는 것은 아니에요.'}],
   transitions:[{targetId:'civil-suit',condition:'상대가 적법하게 이의하거나, 송달 문제로 소송 이행을 검토할 때'}],
   timing:[{kind:'deadline',label:'전달받은 뒤 이의 기간 2주',description:'상대가 지급명령을 받은 날부터 세는 대응 기한이에요. 신청부터 회수까지 끝나는 기간을 뜻하지 않아요.',sourceIds:['guide-court-payment']},{kind:'variable',label:'전체 기간은 송달·이의 여부에 따라',description:'주소를 고치거나 소송으로 넘어가면 더 오래 걸릴 수 있어요.',sourceIds:[]}]},
  documentChecklist:[{name:'지급명령 신청서',necessity:'required',reason:'누구에게 얼마를, 어떤 이유로 청구하는지 법원에 알리는 문서예요.',sourceIds:['guide-court-payment']},{name:'계약서·차용증·송금 내역',necessity:'helpful',reason:'돈을 받을 이유와 금액을 설명하는 데 도움이 돼요. 가진 자료부터 정리해요.',sourceIds:[]},{name:'상대가 채무를 인정한 대화',necessity:'helpful',reason:'금액이나 갚기로 한 날짜가 담긴 부분을 날짜와 함께 보관해요.',sourceIds:[]}],
  risks:['상대가 이미 돈을 빌린 사실이나 금액을 다투고 있다면 이의 후 소송이 될 가능성까지 비교해요. 처음부터 소송으로 진행하는 편이 나을지, 같은 자료를 다시 준비해야 하는지도 살펴봐요.','상대방 주소가 불명확하면 지급명령이 전달되지 않아 절차가 멈출 수 있어요. 알고 있는 주소가 현재 주소인지 확인하고, 법원에서 오는 보완 요청을 놓치지 않아요.']},
 {...base,id:'civil-mediation',kind:'route',status:'possible',title:'합의점을 법원에서 찾기',description:'법원의 도움을 받아 금액과 지급 방법을 조율해요.',sourceIds:['guide-court-mediation'],actions:['전액 지급, 나눠 갚기 등 받아들일 수 있는 조건과 양보하기 어려운 조건을 나눠 적어요.'],
  scenario:{suitableWhen:'금액이나 지급 방법을 조율할 여지가 있고, 서로 받아들일 조건을 찾고 싶을 때 비교해요.',
   steps:[{title:'조정 신청',description:'다투는 내용과 바라는 해결 조건을 법원에 알려요.'},{title:'의견·조건 조율',description:'각자 의견을 말하고 지급액·날짜·방법을 조율해요.'},{title:'합의 또는 결정',description:'합의가 되면 조정조서에 남겨요. 합의되지 않으면 법원이 다른 결정을 할 수 있어요.'}],
   outcomes:[{title:'합의 내용을 조서로',condition:'조정이 성립하면',description:'조정조서는 확정판결과 같은 효력이 있어요. 약속을 지키지 않으면 강제집행을 검토할 수 있어요.'},{title:'결정에 이의하면 소송',condition:'조정을 갈음하는 결정에 적법하게 이의하면',description:'소송절차로 넘어가요. 단순히 합의가 안 됐다는 이유만으로 모든 사건이 같은 방식으로 끝나는 것은 아니에요.'}],
   transitions:[{targetId:'civil-suit',condition:'조정을 갈음하는 결정에 적법한 이의가 있어 소송으로 넘어갈 때'}],
   timing:[{kind:'variable',label:'조정 일정·합의 여부에 따라',description:'기일이 언제 잡히는지, 조건을 조율할 수 있는지에 따라 전체 기간이 달라져요.',sourceIds:[]},{kind:'deadline',label:'갈음하는 결정의 이의 기간 2주',description:'조정을 갈음하는 결정문을 전달받은 날부터 세요. 모든 조정이 2주 만에 끝난다는 뜻은 아니에요.',sourceIds:['guide-court-mediation']}]},
  documentChecklist:[{name:'조정신청서',necessity:'conditional',condition:'서면으로 조정을 신청할 때',reason:'다투는 내용과 원하는 해결 조건을 적어요. 법원 안내에서는 말로 신청하는 방법도 설명해요.',sourceIds:['guide-court-mediation']},{name:'계약·입금 내역과 협의 기록',necessity:'helpful',reason:'왜 분쟁이 생겼고 어디까지 의견이 모였는지 설명할 때 도움이 돼요.',sourceIds:[]}],risks:['합의할 때는 금액뿐 아니라 언제, 어떤 계좌로, 몇 번에 나눠 줄지도 구체적으로 정해요. 한 번이라도 약속을 어기면 어떻게 할지 모호하면 같은 문제로 다시 다툴 수 있어요.']},
 {...base,id:'civil-suit',kind:'route',status:'possible',title:'바로 소송으로 다투기',description:'법원에 주장과 증거를 내고, 돈을 받을 권리를 판단받아요.',actions:['받을 돈의 근거와 상대방의 반박 내용을 나누어 증거를 정리해요.'],
  scenario:{suitableWhen:'상대가 지급 의무나 금액을 다투고 있어 법원의 판단이 필요할 때 비교해요. 소액사건도 민사소송 안의 한 유형이에요.',
   steps:[{title:'소장·증거 제출',description:'왜 얼마를 청구하는지 적고 관련 자료를 내요.'},{title:'상대 답변·심리',description:'상대 주장을 확인하고 필요한 설명과 증거를 보완해요. 중간에 조정이나 합의가 이뤄질 수도 있어요.'},{title:'판결 뒤 대응',description:'판결 내용과 상대방의 지급 여부를 확인해요. 불복이나 집행이 필요한지도 나누어 살펴봐요.'}],
   outcomes:[{title:'판결·합의 후 지급',condition:'받을 금액이 정해지고 상대가 지급하면',description:'실제 받은 금액을 확인해요. 일부만 받았다면 남은 금액을 따로 정리해요.'},{title:'판결 뒤에도 미지급',condition:'집행할 수 있는 상태인데도 돈을 주지 않으면',description:'상대 재산을 확인하고 강제집행을 검토해요. 판결을 받는 일과 돈을 회수하는 일은 구별해야 해요.'},{title:'일부 인정·기각 또는 불복',condition:'청구가 전부 받아들여지지 않거나 상대가 다투면',description:'판결문과 전달 날짜를 보고 다음 대응을 확인해요. 내 주장 전체가 인정된다고 미리 정할 수 없어요.'}],
   transitions:[{targetId:'civil-mediation',condition:'진행 중 조건을 조율할 수 있어 조정을 검토할 때'}],timing:[{kind:'variable',label:'답변·증거·재판 일정에 따라',description:'상대방에게 서류가 전달되는지, 증거를 얼마나 다투는지, 불복이 있는지에 따라 길어질 수 있어요. 확인된 통계 없이 몇 달로 단정하지 않아요.',sourceIds:[]}]},
  documentChecklist:[{name:'소장',necessity:'check',reason:'청구 내용과 이유를 담는 기본 문서예요. 구체적인 접수 방식과 첨부 자료는 법원 안내에서 확인해요.',sourceIds:[]},{name:'계약서·입금 내역·대화 기록',necessity:'helpful',reason:'내 주장과 상대의 반박을 설명할 자료를 날짜순으로 모아요.',sourceIds:[]}],risks:['이겼다는 판결만으로 상대 계좌에서 돈이 자동으로 빠져나오지는 않아요. 상대가 지급하지 않을 때의 회수 방법과 추가 비용까지 함께 생각해요.']}
];
export const CIVIL_DEMO:LegalCase={id:'preview',name:'돈을 돌려받는 방법 비교',createdAt:'',updatedAt:'',messages:[],facts:[],nodes,edges:nodes.slice(1).map(n=>({source:'civil-now',target:n.id})),sources:COURT_SOURCES,evidenceStatus:'partial',demo:true,analysisVersion:3};
