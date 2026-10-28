import {NextResponse} from 'next/server';
import {requestObject,withAIContext} from '@/lib/provider';
import {normalizeIntake,type IntakePlan,type IntakeAnswer,type IntakeQuestion} from '@/lib/intake';
import {INTAKE_INTERVIEW_PROMPT,legalIntakeContext} from '@/lib/intake-strategy';

export const runtime='nodejs';
export const maxDuration=30;
const cap=(v:unknown,length=300)=>typeof v==='string'?v.trim().slice(0,length):'';
function readPlan(value:unknown,original:string):IntakePlan|undefined{
 if(!value||typeof value!=='object')return;
 const raw=value as Record<string,unknown>;
 if(cap(raw.original,7000)!==original)return;
 const questions=(Array.isArray(raw.questions)?raw.questions:[]).slice(0,3).flatMap((q:unknown)=>{
  if(!q||typeof q!=='object')return [];
  const v=q as Record<string,unknown>;
  const question=cap(v.question,240);
  if(!question)return [];
  return [{question,choices:(Array.isArray(v.choices)?v.choices:[]).map(x=>cap(x,100)).filter(Boolean).slice(0,3),why:cap(v.why,100)} as IntakeQuestion];
 });
 const answers=(Array.isArray(raw.answers)?raw.answers:[]).slice(0,questions.length).map((a:unknown)=>{
  const x=a&&typeof a==='object'?a as Record<string,unknown>:{};
  return {choice:cap(x.choice,120),detail:cap(x.detail,1500)} as IntakeAnswer;
 });
 return {
  original,questions,answers,
  routes:(Array.isArray(raw.routes)?raw.routes:[]).slice(0,3).flatMap((r:unknown)=>{
   const x=r&&typeof r==='object'?r as Record<string,unknown>:{};
   const title=cap(x.title,75),description=cap(x.description,260);
   return title&&description?[{title,description,excludeWhen:[]}]:[];
  }),
  complete:false,
  facts:(Array.isArray(raw.facts)?raw.facts:[]).map(x=>cap(x,180)).filter(Boolean).slice(0,10),
  missing:(Array.isArray(raw.missing)?raw.missing:[]).map(x=>cap(x,180)).filter(Boolean).slice(0,6)
 };
}
export async function POST(request:Request){
 let data:Record<string,unknown>={};
 try{data=await request.json()}catch{return NextResponse.json({error:'요청 내용을 읽지 못했어요.'},{status:400})}
 const message=cap(data.message,7000);
 if(!message)return NextResponse.json({error:'먼저 사건 내용을 알려주세요.'},{status:400});
 const prior=readPlan(data.plan,message);
 if(prior&&prior.answers.length<prior.questions.length)return NextResponse.json({error:'현재 질문에 답한 뒤 진행해주세요.'},{status:400});
 if(prior&&prior.answers.length>=3)return NextResponse.json({plan:normalizeIntake({done:true},message,prior),mode:'complete'});
 const legalNotes=legalIntakeContext(message+' '+(prior?.answers||[]).map(a=>a.choice+' '+a.detail).join(' '));
 let raw:Record<string,unknown>={};
 let fallback=false;
 try{
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(26000)]);
  raw=await withAIContext({
   modelId:cap(data.modelId,150)||undefined,
   signal
  },()=>requestObject(INTAKE_INTERVIEW_PROMPT,JSON.stringify({
   currentDate:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),
   originalStory:message,
   alreadyAsked:prior?.questions||[],
   alreadyAnswered:(prior?.answers||[]).map((answer,i)=>({question:prior!.questions[i]?.question,choice:answer.choice,detail:answer.detail})),
   totalAnswered:prior?.answers.length||0,
   relevantOfficialPrinciples:legalNotes,
   instruction:prior?'직전 답변으로 쟁점이 달라졌는지 판단해 다음 한 개 질문과 수정된 임시 경로를 제시하세요. 두 개의 질문에 이미 답했고 핵심 분기가 충분하면 done=true로 마무리하세요.':'처음 받은 이야기에서 이미 알려진 사실을 제외하고 핵심 법적 분기를 가장 많이 바꿀 첫 질문을 제시하세요.'
  }),1250));
 }catch{fallback=true}
 const plan=normalizeIntake(raw,message,prior);
 return NextResponse.json({plan,mode:fallback?'fallback':'model'},{headers:{'Cache-Control':'no-store'}});
}
