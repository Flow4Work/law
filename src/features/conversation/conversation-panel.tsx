'use client';
import {useEffect,type RefObject} from 'react';
import {Plus,Trash2,PanelLeftClose,ArrowRight,AlertCircle,X,LoaderCircle,ArrowUp} from 'lucide-react';
import type {LegalCase} from '@/lib/types';
import {EXAMPLE_QUESTIONS} from '@/lib/types';
import type {ModelInventory} from '@/lib/model-types';
import type {IntakeAnswer} from '@/lib/intake';
import {ModelPicker} from './model-picker';
import {AnalysisProgress,type AnalysisProgressState} from '@/features/shared/analysis-progress';
import {IntakeQuestions} from './intake-questions';
import {ChatMessage} from './chat-message';
const formatHistoryTime=(value:string)=>{
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '날짜 미확인';
 const parts=new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(date);
 const get=(type:string)=>parts.find(part=>part.type===type)?.value||'';
 return get('year')+'.'+get('month')+'.'+get('day')+' '+get('hour')+':'+get('minute');
};

export type ConversationPanelProps={
 showcaseStage?:number;pendingHintPulse:number; historyOpen:boolean; sorted:LegalCase[]; activeId:string|null; active:LegalCase|undefined; current:LegalCase;
 busy:boolean; hasMessages:boolean; input:string; chosenModelId:string; chosenModelAvailable:boolean; alternateRetryAvailable:boolean; alternateRetryLabel:string;
 inventory:ModelInventory|null; analysisProgress:AnalysisProgressState; error:string;
 bottomRef:RefObject<HTMLDivElement|null>; inputRef:RefObject<HTMLTextAreaElement|null>;
 newCase:()=>void; deleteCase:(id:string)=>void; fillInput:(value:string)=>void;
 submit:(value?:string,refresh?:boolean)=>void; acceptIntakeAnswer:(answer:IntakeAnswer)=>void; retryWithAlternative:()=>void;
 chooseModel:(id:string)=>void; onCollapse:()=>void; onOpenCase:(id:string)=>void; onCancel:()=>void;
 onShowMap:()=>void; onDismissError:()=>void; onInputChange:(value:string)=>void; onOpenSettings:()=>void;
};
export function ConversationPanel({showcaseStage=-1,pendingHintPulse,historyOpen,sorted,activeId,active,current,busy,hasMessages,input,chosenModelId,chosenModelAvailable,alternateRetryAvailable,alternateRetryLabel,inventory,analysisProgress,error,bottomRef,inputRef,newCase,deleteCase,fillInput,submit,acceptIntakeAnswer,retryWithAlternative,chooseModel,onCollapse,onOpenCase,onCancel,onShowMap,onDismissError,onInputChange,onOpenSettings}:ConversationPanelProps){
useEffect(()=>{
 if(!pendingHintPulse||!active?.intake)return;
 const card=document.querySelector<HTMLElement>('.conversation-panel .intake-card');
 if(!card)return;
 const computed=getComputedStyle(card);
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const redBackground=card.closest('.app-shell.dark')?'#382326':'#fff0f0';
 const frames:Keyframe[]=reducedMotion
  ?[{backgroundColor:computed.backgroundColor,borderColor:computed.borderColor},{backgroundColor:redBackground,borderColor:'#dc7777',offset:.35},{backgroundColor:redBackground,borderColor:'#dc7777',offset:.7},{backgroundColor:computed.backgroundColor,borderColor:computed.borderColor}]
  :[{backgroundColor:computed.backgroundColor,borderColor:computed.borderColor,transform:'translateX(0)'},{backgroundColor:redBackground,borderColor:'#dc7777',transform:'translateX(-3px)',offset:.18},{backgroundColor:redBackground,borderColor:'#dc7777',transform:'translateX(3px)',offset:.31},{backgroundColor:redBackground,borderColor:'#dc7777',transform:'translateX(-2px)',offset:.44},{backgroundColor:redBackground,borderColor:'#dc7777',transform:'translateX(2px)',offset:.58},{backgroundColor:redBackground,borderColor:'#dc7777',transform:'translateX(0)',offset:.72},{backgroundColor:computed.backgroundColor,borderColor:computed.borderColor,transform:'translateX(0)'}];
 const animation=card.animate(frames,{duration:850,easing:'ease-in-out'});
 return()=>animation.cancel();
},[pendingHintPulse,active?.intake]);
return (
<section className="conversation-panel" aria-label="내 상황 이야기하기">
       {historyOpen?<><div className="chat-top has-messages history-heading"><h1>대화 기록</h1><span>{sorted.length}개</span>{current.nodes.length>0&&<button className="chat-fold-toggle" type="button" onClick={()=>onCollapse()} title="왼쪽 대화창 접기" aria-label="대화창 접기"><PanelLeftClose size={17}/><span>대화 접기</span></button>}</div>
       <div className="history-list" aria-label="저장된 대화 목록">
         <div className="history-list-intro"><span>최근 대화</span><button type="button" onClick={newCase} disabled={busy}><Plus size={15}/>새 대화</button></div>
         {sorted.length===0&&<p className="history-empty">저장된 대화가 없어요. 새 대화를 시작해 보세요.</p>}
         {sorted.map(c=>{
          const questions=c.messages.filter(message=>message.role==='user');
          const preview=questions.at(-1)?.content?.trim()||c.messages.at(-1)?.content?.trim()||'아직 대화 내용이 없어요.';
          return <div className={'history-entry'+(c.id===activeId?' active':'')} key={c.id}>
           <button className="history-entry-open" type="button" disabled={busy} onClick={()=>{onOpenCase(c.id)}} aria-current={c.id===activeId?'page':undefined}>
             <span className="history-entry-copy">
               <span className="history-entry-title"><strong title={c.name}>{c.name}</strong>{c.id===activeId&&<span className="history-current">현재</span>}</span>
               <span className="history-entry-preview">{preview}</span>
               <span className="history-entry-meta"><time dateTime={c.updatedAt}>{formatHistoryTime(c.updatedAt)}</time><span>질문 {questions.length}개</span></span>
             </span>
           </button>
           <button className="history-entry-delete" type="button" aria-label={c.name+' 삭제'} disabled={busy} onClick={()=>deleteCase(c.id)}><Trash2 size={15}/></button>
         </div>})}
       </div></>:<>
       <div className={'chat-top'+(hasMessages?' has-messages':'')}><h1>{hasMessages?'대화':'어떤 일이 있었나요?'}</h1>{!hasMessages&&<p>편하게 이야기하면, 가능한 방법을 정리해요.</p>}{current.nodes.length>0&&<button className="chat-fold-toggle" type="button" onClick={()=>onCollapse()} title="왼쪽 대화창 접기" aria-label="대화창 접기"><PanelLeftClose size={17}/><span>대화 접기</span></button>}</div>
       <div className="conversation-list" aria-live="polite" aria-busy={busy}>
         {(!active||!active.messages.length)&&<div className="welcome-block">
           <div className="suggestion-label">이런 고민부터 이야기할 수 있어요</div>
           <div className="prompt-cards">{EXAMPLE_QUESTIONS.map((x,i)=><button key={x} onClick={()=>fillInput(x)} disabled={busy}><span className="prompt-category">{['회사에서','집 계약에서','경찰 연락을 받고'][i]}</span><span className="prompt-title">{x}</span><ArrowRight size={18}/></button>)}</div>
         </div>}
         {active?.messages.map((m,index,messages)=><ChatMessage item={m} key={m.id} showFollowups={index===messages.length-1&&!active?.intake} onFollowupApply={answer=>submit(answer,false)} onRetryOther={m.error&&alternateRetryAvailable?retryWithAlternative:undefined} retryOtherLabel={alternateRetryLabel} onRetry={()=>submit(undefined,true)}/>)}
         {active?.intake&&active.intake.answers.length<active.intake.questions.length&&!busy&&<IntakeQuestions key={active.id+':'+active.intake.answers.length} plan={active.intake} onAnswer={acceptIntakeAnswer} showcaseStage={showcaseStage}/>}
         {busy&&<AnalysisProgress progress={analysisProgress} onCancel={()=>onCancel()} onShowMap={()=>onShowMap()}/>}
         <div ref={bottomRef}/>
       </div>
       {error&&<div className="inline-alert" role="alert"><AlertCircle size={16}/><span>{error}</span><button aria-label="오류 안내 닫기" onClick={onDismissError}><X size={16}/></button></div>}
       <div className="chat-bottom">
         <div className="composer"><textarea ref={inputRef} aria-label="내 상황 입력" value={input} onChange={e=>onInputChange(e.target.value)} rows={3} disabled={busy||Boolean(active?.intake)} placeholder={active?.intake?'위의 질문에 답해주세요.':'어떤 일이 있었나요? 편하게 적어주세요.'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();submit()}}}/>
          <div className="composer-toolbar"><ModelPicker inventory={inventory} value={chosenModelId} disabled={busy} onChange={chooseModel} onManage={()=>onOpenSettings()}/><button className="composer-send" disabled={!input.trim()||busy||Boolean(active?.intake)||(showcaseStage<0&&!chosenModelAvailable)} aria-label="메시지 보내기" onClick={()=>submit()}>{busy?<LoaderCircle size={18} className="spin"/>:<ArrowUp size={19}/>}</button></div>
         </div>
       </div>
       </>}
     </section>
);
}
