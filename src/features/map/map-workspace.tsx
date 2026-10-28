'use client';
import {ReactFlowProvider} from '@xyflow/react';
import {PanelLeftOpen,RotateCcw,BookOpen,X,ChevronDown,ChevronRight,ExternalLink,ArrowRight,GitBranch} from 'lucide-react';
import type {LegalCase,RoadmapNode} from '@/lib/types';
import {ConversationTabs} from '@/features/workspace/conversation-tabs';
import {MapStatus} from './map-status';
import {MapSkeleton} from '@/features/shared/analysis-progress';
import {MobileRoadmap} from './mobile-roadmap';
import {Canvas} from './roadmap-canvas';
import {displayDate} from '@/features/shared/date-format';
export type MapWorkspaceProps={
 pendingHintPulse:number;onPendingNode:()=>void;
 chatCollapsed:boolean;current:LegalCase;cases:LegalCase[];activeId:string|null;active:LegalCase|undefined;busy:boolean;
 sourcesOpen:boolean;done:RoadmapNode[];completedSummary:string;mapStatusText:string;
 mobile:boolean;mapCase:LegalCase;selected:string|null;focusId:string|null;flowIds:string[];flowPosition:number;
 onExpandChat:()=>void;onExample:()=>void;onNewCase:()=>void;onOpenCase:(id:string)=>void;onDeleteCase:(id:string)=>void;onMoveCase:(id:string,target:string)=>void;
 onRefresh:()=>void;onToggleSources:()=>void;onCloseSources:()=>void;onSelectNode:(id:string)=>void;
 onContinueConversation:()=>void;onShowChat:()=>void;onFocusFlow:(direction:number)=>void;onFillInput:(text:string)=>void;
};
export function MapWorkspace({pendingHintPulse,onPendingNode,chatCollapsed,current,cases,activeId,active,busy,sourcesOpen,done,completedSummary,mapStatusText,mobile,mapCase,selected,focusId,flowIds,flowPosition,onExpandChat,onExample,onNewCase,onOpenCase,onDeleteCase,onMoveCase,onRefresh,onToggleSources,onCloseSources,onSelectNode,onContinueConversation,onShowChat,onFocusFlow,onFillInput}:MapWorkspaceProps){
const handleNodeSelect=(id:string)=>{
 const node=mapCase.nodes.find(item=>item.id===id);
 if(active?.intake&&node?.kind==='route'&&node.status==='verify'&&!node.scenario){
  onSelectNode(id);
  onPendingNode();
  return;
 }
 onSelectNode(id);
};
return (
<div className="map-workspace">
       <div className="visual-header">
         {chatCollapsed&&current.nodes.length>0&&<button className="chat-expand-toggle" type="button" onClick={()=>onExpandChat()} title="대화창 다시 펼치기" aria-label="대화창 펼치기"><PanelLeftOpen size={17}/><span>대화 열기</span></button>}
         <ConversationTabs cases={cases} activeId={activeId} busy={busy} onExample={onExample} onNew={onNewCase} onSelect={onOpenCase} onDelete={onDeleteCase} onMove={onMoveCase}/>
         <div className="visual-tools">{!active?.intake&&active?.messages.some(m=>m.role==='user')&&<button disabled={busy} className="refresh-map" onClick={onRefresh} title="새 이야기와 진행 상황을 반영해 지도를 다시 만들어요"><RotateCcw size={15}/><span>지도 업데이트</span></button>}<button className="sources-trigger" aria-label="공식 자료 보기" aria-expanded={sourcesOpen} onClick={onToggleSources}><BookOpen size={17}/><span>공식 자료</span>{current.sources.length>0&&<b>{current.sources.length}</b>}</button></div>
         {sourcesOpen&&<div className="official-sources-popover"><div className="official-sources-head"><strong>검색된 공식 자료</strong><button aria-label="근거 목록 닫기" onClick={onCloseSources}><X size={18}/></button></div>{current.sources.length?current.sources.map(src=><a href={src.url} key={src.id} target="_blank" rel="noopener noreferrer"><span className="official-source-category">{src.kind}</span><span><strong>{src.title}</strong>{(src.effectiveDate||src.date)&&<small>{src.effectiveDate?'시행일 '+displayDate(src.effectiveDate):'자료 날짜 '+displayDate(src.date||'')}</small>}</span><ExternalLink size={15}/></a>):<div className="source-empty">연결된 공식 자료가 없어요.</div>}</div>}
       </div>
       <div className="map-feedback-row">
       {!busy&&done.length>0&&<div className="completed-path" role="status" aria-label="현재 진행 상황">
         <span className="completed-path-dot" aria-hidden="true"/>
         <span className="completed-path-copy"><strong>{completedSummary}</strong></span>
         <details className="completed-path-history"><summary>지난 절차 {done.length}개 <ChevronDown size={14}/></summary>
           <div className="completed-path-items">{done.map(n=><button key={n.id} type="button" title={n.title} onClick={()=>onSelectNode(n.id)}>{n.title}<ChevronRight size={14}/></button>)}</div>
         </details>
       </div>}
         {(busy||Boolean(active?.intake)||Boolean(active?.messages.at(-1)?.error))&&<MapStatus key={current.id+':'+(busy?'processing':active?.messages.at(-1)?.error?'error':'awaiting')} state={busy?'processing':active?.messages.at(-1)?.error?'error':'awaiting'} message={mapStatusText} pendingHintPulse={pendingHintPulse} onContinue={onContinueConversation}/>}
       </div>
       <div className="diagram-content">
         {busy&&!current.nodes.length?<MapSkeleton/>:<><div className="graph-wrapper">{current.nodes.length>0?<>{mobile?<MobileRoadmap key={current.id} value={mapCase} selected={selected} onSelect={handleNodeSelect} onChat={onShowChat} busy={busy}/>:<div className="desktop-roadmap"><ReactFlowProvider key={current.id}><Canvas value={mapCase} selected={selected} focusId={focusId} busy={busy||Boolean(active?.intake)} onSelect={handleNodeSelect}/></ReactFlowProvider></div>}{!mobile&&flowIds.length>1&&<div className="map-flow-navigation" aria-label="절차별 지도 이동"><button disabled={flowPosition===0} onClick={()=>onFocusFlow(-1)} aria-label="이전 절차 보기"><ChevronRight size={16} className="flip-horizontal"/></button><span>절차와 결과 {flowPosition+1}/{flowIds.length}</span><button disabled={flowPosition===flowIds.length-1} onClick={()=>onFocusFlow(1)} aria-label="다음 절차 보기"><ArrowRight size={17}/></button></div>}</>:<div className="map-empty"><div className="map-empty-icon"><GitBranch size={32}/></div><h3>이야기를 따라 선택지가 펼쳐져요</h3><p>가능한 방법과 다음 상황을 여기에 정리해요.</p><button onClick={()=>onFillInput('')}>내 상황 이야기하기 <ArrowRight size={17}/></button></div>}</div>
         </>}
       </div>
      </div>
);
}
