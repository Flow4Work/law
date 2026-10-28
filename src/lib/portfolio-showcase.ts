import type {IntakePlan} from './intake';
import {previewIntake} from './intake';
import type {LegalCase,RoadmapNode,Message} from './types';

/** Self-contained, illustrative portfolio playback. Never used for real legal responses. */
export const SHOWCASE_STORY='퇴사했는데 아직 월급을 못 받았어요.';
export const SHOWCASE_DETAIL='2026년 8월에 퇴사했고, 밀린 월급은 약 320만 원입니다. 회사에 지급을 요청했지만 아직 구체적인 날짜를 안내받지 못했습니다.';
export const SHOWCASE_DURATIONS=[2600,3600,4100,3000,3400,3600,3000,3400,3600,3000,4100,3000,3600,3900,3900,4100,3800,3900,3900,3900,4200,4300] as const;
export const SHOWCASE_SCENES={step1:{start:0,end:3},step2:{start:4,end:11},step3:{start:12,end:15},step4:{start:15,end:21}} as const;
export const SHOWCASE_LAST_STAGE=SHOWCASE_DURATIONS.length-1;
export const SHOWCASE_QUESTIONS:IntakePlan={
 original:SHOWCASE_STORY,
 questions:[
  {question:'퇴사하신 뒤 월급을 받기 위해 지금까지 어떤 절차까지 진행하셨나요?',why:'진정·소송·판결·집행 중 어디까지 왔는지에 따라 다음 단계가 완전히 달라집니다.',choices:['회사에 요구만 해봤다','노동청 진정이나 법률 구조를 시작했다','소송이나 지급명령, 판결까지 진행했다']},
  {question:'회사에서 아직 지급하지 않은 월급은 어느 정도인가요?',why:'금액과 미지급 항목을 확인하면 필요한 증빙과 가능한 절차를 구체화할 수 있어요.',choices:['100만 원 미만','100만 원~500만 원','500만 원 이상']},
  {question:'퇴사한 시기와 회사에 지급을 요청한 상황을 알려주세요.',why:'날짜와 회사의 답변을 알면 다음 절차를 더 정확하게 정리할 수 있어요.',choices:[]}
 ],
 routes:[{title:'회사에 임금 지급 요청',description:'미지급액과 지급기일을 정리해 공식적으로 지급을 요청해요.'},{title:'노동청에 임금체불 진정',description:'근로관계와 체불 내용을 확인받고 지급 지도를 요청해요.'},{title:'법원에 지급명령·소송',description:'체불 금액과 증빙을 토대로 법적 청구를 검토해요.'}],
 answers:[]
};
const answers=[{choice:'회사에 요구만 해봤다',detail:''},{choice:'100만 원~500만 원',detail:''},{choice:'',detail:SHOWCASE_DETAIL}];
const base={conditions:[],actions:[],documents:[],documentChecklist:[],cost:'',duration:'',risks:[],sourceIds:[],next:[],detailVersion:3} satisfies Partial<RoadmapNode>;
const nodes:RoadmapNode[]=[
 {...base,id:'wage-now',kind:'situation',title:'퇴사 후 월급을 받지 못했어요',description:'퇴사 후 약 320만 원의 임금이 지급되지 않았고, 회사에 직접 요청한 상태예요.',status:'current',actions:['근로계약, 급여명세와 입금 내역을 모아 미지급액을 정리해요.'],next:['wage-request','wage-labor','wage-court']},
 {...base,id:'wage-request',kind:'route',title:'회사에 정식으로 지급 요청',description:'미지급 금액과 지급 기한을 명시해 기록을 남겨요.',status:'possible',duration:'답변 기한을 정해 진행',actions:['요청한 금액과 지급기일을 서면으로 전달하고 전달 기록을 보관해요.'],risks:['요청만으로 지급이 보장되지는 않아요.'],scenario:{suitableWhen:'회사와 연락이 가능하고 지급 의사를 확인할 여지가 있을 때 검토해요.',steps:[{title:'미지급액 확인',description:'근로기간과 급여·입금 내역을 대조해요.'},{title:'서면 지급 요청',description:'금액과 지급 기한을 적어 전달해요.'},{title:'회사 답변 확인',description:'지급 여부와 약속한 날짜를 확인해요.'}],outcomes:[{title:'전액 지급 완료',condition:'회사에서 전액을 입금하면',description:'입금액을 확인하고 관련 기록을 보관해요.',terminal:true},{title:'미지급 지속',condition:'기한까지 지급되지 않으면',description:'노동청 진정이나 법적 청구를 검토해요.'}],transitions:[{targetId:'wage-labor',condition:'회사에서 지급하지 않거나 지급 약속을 지키지 않는 경우'}]}},
 {...base,id:'wage-labor',kind:'route',title:'노동청에 임금체불 진정',description:'체불 사실을 알리고 근로감독관의 조사를 요청해요.',status:'possible',actions:['급여명세서, 근로계약서, 입금 내역 등 자료를 정리해요.'],risks:['조사 결과와 회사 대응에 따라 실제 지급 여부와 기간은 달라질 수 있어요.'],scenario:{suitableWhen:'임금체불에 관한 행정상 구제 절차를 이용하려는 경우예요.',steps:[{title:'체불 진정 접수',description:'미지급 임금과 근로관계 자료를 제출해요.'},{title:'사실관계 조사',description:'근로감독관이 회사와 근로자 측 자료를 확인해요.'},{title:'지급·후속 대응',description:'지급 여부를 확인하고 필요한 다른 구제 수단을 검토해요.'}],outcomes:[{title:'체불임금 지급',condition:'회사에서 지급하면',description:'실제 입금된 금액을 확인해요.',terminal:true},{title:'지급되지 않으면',condition:'체불이 해결되지 않으면',description:'민사 청구와 집행 가능성을 따로 검토해요.'}],transitions:[{targetId:'wage-court',condition:'체불금을 회수하기 위해 법적 청구가 필요한 경우'}],timing:[{kind:'variable',label:'조사·회사 대응에 따라 달라짐',description:'접수부터 처리까지는 사안별로 차이가 있어요.',sourceIds:[]}]}},
 {...base,id:'wage-court',kind:'route',title:'지급명령·민사소송 검토',description:'미지급 임금의 지급을 법원에 청구하는 방법이에요.',status:'possible',actions:['받을 금액과 입증자료를 정리하고 절차와 비용을 비교해요.'],risks:['지급명령에 이의가 있거나 판결 후에도 미지급이면 후속 절차가 필요해요.'],scenario:{suitableWhen:'회사가 임금을 지급하지 않아 법원 절차를 통해 채권을 확정할 필요가 있을 때 검토해요.',steps:[{title:'청구 자료 준비',description:'근로계약, 임금대장, 미지급 금액 등을 정리해요.'},{title:'지급명령 또는 소송',description:'상대방의 다툼 여부 등을 고려해 절차를 진행해요.'},{title:'결정·판결 확인',description:'결정과 판결의 효력, 불복 여부를 확인해요.'}],outcomes:[{title:'확정 후 자발적 지급',condition:'지급 의무가 정해지고 회사가 돈을 주면',description:'실제로 받은 금액을 확인해 마무리해요.',terminal:true},{title:'확정 후에도 미지급',condition:'회사에서 계속 지급하지 않으면',description:'집행 가능한 재산 확인과 압류·추심 등을 검토해요.'}],timing:[{kind:'variable',label:'송달·다툼 여부에 따라 다름',description:'사건과 법원 절차에 따라 기간이 달라져요.',sourceIds:[]}]}}
];
const demoMap:Pick<LegalCase,'nodes'|'edges'|'sources'>={nodes,edges:[{source:'wage-now',target:'wage-request'},{source:'wage-now',target:'wage-labor'},{source:'wage-now',target:'wage-court'}],sources:[]};
export function showcasePhase(stage:number):'overview'|'composer'|'loading'|'question'|'typing'|'map'|'detail'|'flow'{
 if(stage<=1)return 'overview';if(stage===2)return 'composer';
 if([3,6,9,11].includes(stage))return 'loading';
 if(stage>=16)return 'flow';if(stage>=14)return 'detail';if(stage>=12)return 'map';
 if(stage===10)return 'typing';return 'question';
}
export function showcaseCase(stage:number):LegalCase{
 const now='2026-10-27T12:00:00.000Z';
 const created=(id:string,role:Message['role'],content:string):Message=>({id,role,content,createdAt:now});
 const sent=stage>=3;
 const recordCount=stage>=11?3:stage>=9?2:stage>=6?1:0;
 const msgs:Message[]=sent?[created('showcase-user','user',SHOWCASE_STORY)]:[];
 for(let i=0;i<recordCount;i++){
  msgs.push(created('showcase-q'+i,'assistant',SHOWCASE_QUESTIONS.questions[i].question));
  msgs.push(created('showcase-a'+i,'user',answers[i].choice||answers[i].detail));
 }
 const activeQuestion=stage>=4&&stage<=10;
 const intake=activeQuestion?{...SHOWCASE_QUESTIONS,answers:answers.slice(0,recordCount)}:undefined;
 const generated=stage>=12;
 const busy=[3,6,9,11].includes(stage);
 const data=generated?demoMap:intake?{...previewIntake(intake),sources:[]}: {nodes:[],edges:[],sources:[]};
 if(generated){
  msgs.push(created('showcase-response','assistant','회사에 지급을 요청한 상태라면, 미지급액을 정리한 뒤 노동청 진정이나 법적 청구를 비교해 볼 수 있어요. 지도에서 각 절차의 흐름과 결과별 갈림길을 확인해 보세요.'));
 }
 const expanded=stage>=16;
 return {id:'portfolio-showcase',name:'퇴사 후 임금체불',createdAt:now,updatedAt:now,
  ...data,nodes:generated?nodes.map(n=>n.id==='wage-labor'&&expanded?{...n,scenarioRevealed:stage>=19?4:3}:n):data.nodes,
  messages:msgs,facts:['퇴사 후 미지급 임금 약 320만 원','회사에 직접 지급 요청'],intake, demo:true,evidenceStatus:'unverified'};
}
