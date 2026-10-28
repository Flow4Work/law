'use client';
import {Scale,RotateCcw,ArrowRight,MessageCircle} from 'lucide-react';
import type {Message} from '@/lib/types';
import {FollowupQuestions} from './followup-questions';
export function ChatMessage({item,onRetry,onRetryOther,retryOtherLabel,showFollowups,onFollowupApply}:{item:Message;onRetry:()=>void;onRetryOther?:()=>void;retryOtherLabel:string;showFollowups:boolean;onFollowupApply:(answer:string)=>void}){
 return <div className={'chat-row '+item.role}>
   {item.role==='assistant'&&<span className="assistant-icon"><Scale size={14}/></span>}
   <div className="chat-content">
    {item.role==='user'?<div className="user-bubble">{item.content}</div>:<>
     <p className={'assistant-copy'+(item.error?' error-copy':'')}>{item.content}</p>{item.error&&<div className="retry-actions"><button className="retry-answer" onClick={onRetry}><RotateCcw size={15}/> 다시 시도</button>{onRetryOther&&<button className="retry-answer retry-fast" onClick={onRetryOther}>{retryOtherLabel}</button>}</div>}
     {!item.error && item.options&&item.options.length>0&&<div className="answer-options"><div className="answer-label">이런 방법을 살펴볼 수 있어요</div>{item.options.map((v,i)=><div key={i} className="answer-option"><span>{i+1}</span><p>{v}</p></div>)}</div>}
     {item.nextAction&&<section className="next-action" aria-label="다음으로 할 일"><div className="next-action-heading"><span className="next-action-symbol"><ArrowRight size={17} strokeWidth={2} aria-hidden="true"/></span><strong>다음으로 할 일</strong></div><p>{item.nextAction}</p></section>}
     {showFollowups&&item.followUpQuestions?.length?<FollowupQuestions questions={item.followUpQuestions} onApply={onFollowupApply}/>:item.question&&<div className="question-note"><MessageCircle size={14}/>{item.question}</div>}
    </>}
   </div>
 </div>;
}
