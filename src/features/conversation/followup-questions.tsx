'use client';
import {useState} from 'react';
import {ArrowRight,MessageCircle} from 'lucide-react';
import type {FollowUpQuestion} from '@/lib/types';

export function FollowupQuestions({questions,onApply}:{questions:FollowUpQuestion[];onApply:(answer:string)=>void}){
 const [selected,setSelected]=useState<Record<number,string>>({});
 const [extra,setExtra]=useState('');
 const answers=questions.flatMap((item,index)=>selected[index]?[`${item.question} ${selected[index]}`]:[]);
 const submit=()=>{
  const parts=[...answers];
  if(extra.trim())parts.push(`추가로 알려준 내용: ${extra.trim()}`);
  if(parts.length)onApply('추가로 확인한 내용:\n'+parts.map(part=>'• '+part).join('\n'));
 };
 return <section className="followup-card" aria-label="맞춤 정리에 필요한 질문">
  <div className="followup-heading"><MessageCircle size={16}/><strong>더 맞게 정리하려면</strong></div>
  {questions.map((item,index)=><fieldset className="followup-question" key={index}>
   <legend>{index+1}. {item.question}</legend>
   {item.choices.length>0&&<div className="followup-choices">{item.choices.slice(0,3).map(choice=><button type="button" key={choice} aria-pressed={selected[index]===choice} className={selected[index]===choice?'selected':''} onClick={()=>setSelected(values=>({...values,[index]:values[index]===choice?'':choice}))}>{choice}</button>)}</div>}
  </fieldset>)}
  <label className="followup-extra">직접 덧붙이기<textarea rows={2} value={extra} onFocus={event=>event.currentTarget.scrollIntoView({block:'center',behavior:'smooth'})} onChange={event=>setExtra(event.target.value)} placeholder="예: 보증금 800만 원, 10월 1일에 계약 종료"/></label>
  <button type="button" className="followup-submit" disabled={!answers.length&&!extra.trim()} onClick={submit}><span>이 내용으로 맞춤 정리</span><ArrowRight size={16}/></button>
 </section>;
}
