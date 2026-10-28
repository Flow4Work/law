'use client';
import {useEffect,useState} from 'react';
import {SHOWCASE_DETAIL} from '@/lib/portfolio-showcase';
import {ArrowRight,ChevronDown,MessageCircle} from 'lucide-react';
import type {IntakeAnswer,IntakePlan} from '@/lib/intake';

export function IntakeQuestions({plan,onAnswer,showcaseStage=-1}:{plan:IntakePlan;onAnswer:(answer:IntakeAnswer)=>void;showcaseStage?:number}){
 const [choice,setChoice]=useState('');
 const [detail,setDetail]=useState('');
 const [openInput,setOpenInput]=useState(false);
 useEffect(()=>{if(showcaseStage===5)setChoice('회사에 요구만 해봤다');if(showcaseStage===8)setChoice('100만 원~500만 원')},[showcaseStage]);
 useEffect(()=>{if(showcaseStage!==10)return;setOpenInput(true);setDetail('');let size=0;const timer=setInterval(()=>{size=Math.min(SHOWCASE_DETAIL.length,size+2);setDetail(SHOWCASE_DETAIL.slice(0,size));if(size===SHOWCASE_DETAIL.length)clearInterval(timer)},42);return()=>clearInterval(timer)},[showcaseStage]);
 const step=plan.answers.length;
 const item=plan.questions[step];
 if(!item)return null;
 const options=item.choices.length===3?item.choices:[];
 const freeOpen=openInput||options.length===0;
 const submit=()=>{
  const value=detail.trim();
  if(!choice&&!value)return;
  onAnswer({choice,detail:value.slice(0,1500)});
 };
 const unknownPresent=options.some(c=>/모르|확실하지|기억나지|불명확/.test(c));
 return <section className="intake-card" aria-label="사건의 핵심 확인 질문">
   <div className="intake-progress"><span><MessageCircle size={15}/> 핵심 사실 확인</span><span className="intake-waiting" role="status"><i aria-hidden="true"/>답변 대기</span><strong>질문 {step+1} / 최대 3</strong></div>
   <div className="intake-progress-track" aria-hidden="true"><span style={{width:Math.min(100,((step+1)/3)*100)+'%'}}/></div>
   <h2>{item.question}</h2>
   {item.why&&<p className="intake-hint">{item.why}</p>}
   {options.length>0&&<div className="intake-options" role="group" aria-label={item.question}>
     {options.map((value,i)=><button key={i} type="button" className={choice===value?'is-selected':''} aria-pressed={choice===value} onClick={()=>setChoice(c=>c===value?'':value)}><span className="intake-radio" aria-hidden="true"/><span>{value}</span></button>)}
   </div>}
   {options.length>0&&!freeOpen&&<button className="intake-open-text" type="button" onClick={()=>setOpenInput(true)} aria-expanded={false}><span>직접 답변하거나 내용 추가</span><ChevronDown size={15}/></button>}
   {freeOpen&&<div className="intake-text-area">
     <label htmlFor={'intake-extra-'+step}>{options.length?'답변에 덧붙일 내용':'구체적인 내용을 적어주세요'}</label>
     <textarea id={'intake-extra-'+step} autoFocus={options.length===0} value={detail} rows={3} maxLength={1500} onChange={e=>setDetail(e.target.value)} placeholder={options.length?'예: 실제 금액, 통지서의 문구 등':'가능하면 날짜, 진행 단계, 핵심 문구를 적어주세요. 주민번호나 상세 주소는 필요하지 않아요.'}/>
   </div>}
   <div className="intake-buttons">
     {!unknownPresent&&<button type="button" className="intake-unknown" onClick={()=>onAnswer({choice:'정확히 모르겠어요',detail:''})}>정확히 모르겠어요</button>}
     <button type="button" className="intake-next" disabled={!choice&&!detail.trim()} onClick={submit}>이 답변으로 계속<ArrowRight size={16}/></button>
   </div>
 </section>;
}
