'use client';
import {useEffect,useState} from 'react';
import {Check,Clock3,LoaderCircle,GitBranch} from 'lucide-react';
export type AnalysisProgressState={phase:string;message:string;retryIn?:number};
const activityByPhase:Record<string,string[]>={
 intake:[
  '사건의 현재 단계와 필요한 정보를 구분하고 있어요.',
  '다음 절차를 판단할 핵심 조건을 살펴보고 있어요.',
  '빠진 정보가 없는지 확인 질문을 정리하고 있어요.'
 ],
 analyzing:[
  '이미 진행한 절차와 앞으로의 절차를 구분하고 있어요.',
  '선택할 수 있는 대응 방법을 비교하고 있어요.',
  '결과에 따라 달라지는 경로를 살펴보고 있어요.',
  '지도에 표시할 진행 순서를 정리하고 있어요.'
 ],
 sources:[
  '관련 법령과 공식 안내를 대조하고 있어요.',
  '각 대응 방법에 필요한 근거를 확인하고 있어요.',
  '절차별로 적용할 수 있는 기준을 살펴보고 있어요.'
 ],
 reviewing:[
  '절차가 이어지는 순서에 빠진 부분이 없는지 살펴보고 있어요.',
  '갈림길과 후속 절차를 한 번 더 비교하고 있어요.',
  '기간이나 진행 조건에 주의할 부분을 점검하고 있어요.'
 ],
 formatting:[
  '정리한 절차를 지도에서 볼 수 있는 구조로 다듬고 있어요.',
  '각 방법의 연결 관계와 설명을 정돈하고 있어요.',
  '화면에 표시할 답변을 마무리하고 있어요.'
 ],
 waiting:['요청 순서를 확인하고 있어요. 앞선 처리가 끝나면 이어서 진행해요.'],
 retrying:['연결을 다시 시도하는 중이에요. 지금까지의 대화는 유지돼요.']
};
export function AnalysisProgress({progress,onCancel,onShowMap}:{progress:AnalysisProgressState;onCancel:()=>void;onShowMap?:()=>void}){
 const [elapsed,setElapsed]=useState(0);useEffect(()=>{const start=Date.now();const timer=setInterval(()=>setElapsed(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer)},[]);
 const phase=progress.phase==='sources'?1:['reviewing','formatting'].includes(progress.phase)?2:0;
 const activityList=activityByPhase[progress.phase]||activityByPhase.analyzing;
 const activityIndex=Math.floor(elapsed/5)%activityList.length;
 const steps=progress.phase==='intake'?['상황 확인','조건 검토','질문 준비']:['경로 정리','자료 확인','내용 점검'];
 const title=progress.phase==='intake'?'확인할 질문을 준비하고 있어요':progress.phase==='retrying'?'다시 연결하고 있어요':progress.phase==='waiting'?'요청을 기다리고 있어요':progress.phase==='sources'?'공식 자료를 확인하고 있어요':progress.phase==='reviewing'?'내용을 점검하고 있어요':progress.phase==='formatting'?'답변을 마무리하고 있어요':'가능한 경로를 정리하고 있어요';
 return <div className="chat-row assistant">
  <span className="assistant-icon"><GitBranch size={17} aria-hidden="true"/></span>
  <div className="analysis-progress">
   <div className="progress-status" role="status" aria-live="polite" aria-atomic="true">
    <div className="progress-title"><span className="progress-symbol"><LoaderCircle className="spin" size={17} aria-hidden="true"/></span><strong>{title}</strong></div>
    <p>{progress.message}</p>
   </div>
   <div className="progress-activity" aria-label="현재 검토 중인 내용">
    <span className="progress-activity-bars" aria-hidden="true"><i/><i/><i/></span>
    <span className="progress-activity-copy" key={progress.phase+':'+activityIndex}>{activityList[activityIndex]}</span>
   </div>
   <ol className="progress-steps" aria-label="답변 준비 단계">
    {steps.map((step,i)=><li className={i<phase?'finished':i===phase?'active':''} aria-label={i<phase?`${step} 완료`:step} aria-current={i===phase?'step':undefined} key={step}>
     <span className="progress-step-number" aria-hidden="true">{i<phase?<Check size={13}/>:i+1}</span>
     <span>{step}</span>
    </li>)}
   </ol>
   <div className="progress-meta">
    <span className="progress-elapsed" role="timer" aria-label={`경과 시간 ${elapsed}초`}><Clock3 size={14} aria-hidden="true"/>{elapsed}초 경과</span>
    <div className="progress-actions">{onShowMap&&<button type="button" className="progress-map" onClick={onShowMap}>지도 보기</button>}<button type="button" onClick={onCancel}>중지</button></div>
   </div>
  </div>
 </div>;
}
export function MapSkeleton(){return <div className="map-skeleton" role="status" aria-label="선택지 지도를 만들고 있어요"><div className="skeleton-caption"><LoaderCircle className="spin" size={17}/><span>대화에 맞는 경로를 정리하고 있어요</span></div><div className="skeleton-graph desktop-skeleton" aria-hidden="true"><div className="skeleton-node skeleton-root"><i/><b/><span/><span/></div><div className="skeleton-connector"/><div className="skeleton-branches">{[0,1,2].map(i=><div className="skeleton-node" key={i}><i/><b/><span/><span/><em/></div>)}</div></div><div className="mobile-skeleton-graph" aria-hidden="true"><div className="mobile-skeleton-node root"><i/><b/><span/></div><div className="mobile-skeleton-caption">가능한 방법을 나누고 있어요</div>{[0,1,2].map(i=><div className="mobile-skeleton-node" key={i}><i/><b/><span/><span/></div>)}</div></div>}
