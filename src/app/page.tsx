'use client';
import '@xyflow/react/dist/style.css';
import '@/features/map/scenarios.css';
import '@/features/workspace/workspace-controls.css';
import '@/features/map/roadmap-canvas.css';
import '@/features/workspace/workspace-layout.css';
import '@/features/methods/detail-panel.css';
import '@/features/workspace/model-settings.css';
import '@/features/workspace/readability.css';
import {GitBranch,Plus,Clock3,Settings2,Moon,Sun,MessageCircle} from 'lucide-react';
import {reorderItems} from '@/lib/case-order';
import {mobileMap} from '@/lib/mobile-roadmap';
import {DeleteConversation} from '@/features/workspace/conversation-tabs';
import {ModelSettings} from '@/features/workspace/model-settings';
import {ConversationPanel} from '@/features/conversation/conversation-panel';
import {MapWorkspace} from '@/features/map/map-workspace';
import {DetailPanel} from '@/features/methods/method-detail-panel';
import {useLegalWorkspace} from '@/features/workspace/use-legal-workspace';
import {ShowcasePointer} from '@/features/workspace/showcase-pointer';

function App(){
 const {showcaseStage,wageExampleArmed,changeInput,mobile,cases,setCases,activeId,setActiveId,theme,setTheme,historyOpen,setHistoryOpen,sourcesOpen,setSourcesOpen,selected,setSelected,focusId,setFocusId,input,setInput,mobileView,setMobileView,chatCollapsed,setChatCollapsed,busy,error,setError,inventory,settingsOpen,setSettingsOpen,analysisProgress,requestAbort,bottomRef,inputRef,active,current,chosen,chosenModelId,chosenModel,deleteValue,loadingDetails,detailErrors,detailKey,loadDetails,loadingProceed,proceedErrors,mapCase,sorted,hasMessages,alternativeModel,newCase,deleteCase,closeTab,confirmDelete,setDeleteTarget,applyInventory,chooseModel,example,fillInput,submit,acceptIntakeAnswer,retryWithAlternative,startStep,finishStep,chooseStep,selectNode,done,completedSummary,mapStatusText,continueMapConversation,flowIds,flowPosition,focusFlow}=useLegalWorkspace();
 return <main className={'app-shell '+theme+' mobile-'+mobileView+(!current.nodes.length&&!busy?' is-start':'')+(chatCollapsed&&current.nodes.length?' chat-collapsed':'')} data-theme={theme} data-showcase-stage={showcaseStage}>
   <aside className="workspace-rail" aria-label="기본 메뉴" onKeyDown={e=>{if(e.key==='Escape')setHistoryOpen(false)}}>
     <div className="rail-brand" title="법률 로드맵" aria-label="법률 로드맵"><GitBranch size={23}/></div>
     <nav className="rail-menu" aria-label="작업 메뉴">
       <button className="rail-button rail-new" onClick={newCase} disabled={busy} aria-label="새 대화" title="새 대화"><Plus size={20}/><span>새 대화</span></button>
       <div className="case-switch-wrap">
         <button className={'rail-button'+(historyOpen?' is-active':'')} onClick={()=>{setChatCollapsed(false);setHistoryOpen(v=>!v);setMobileView('chat')}} aria-label="대화 기록" aria-expanded={historyOpen} aria-pressed={historyOpen} title="대화 기록"><Clock3 size={20}/><span>기록</span></button>
       </div>
     </nav>
     <div className="rail-utilities">
       <button className="rail-button" onClick={()=>setSettingsOpen(true)} aria-label="모델 연결과 설정" title="모델 연결과 설정"><Settings2 size={19}/><span>설정</span></button>
       <button className="rail-button rail-theme" aria-label={theme==='light'?'어두운 화면으로 바꾸기':'밝은 화면으로 바꾸기'} title={theme==='light'?'어두운 화면':'밝은 화면'} onClick={()=>setTheme(t=>t==='light'?'dark':'light')}>{theme==='light'?<Moon size={19}/>:<Sun size={19}/>}</button>
     </div>
   </aside>
   <div className="mobile-navigation" aria-label="화면 선택"><button aria-pressed={mobileView==='chat'} onClick={()=>setMobileView('chat')}><MessageCircle size={17}/> 대화하기</button><button aria-pressed={mobileView==='map'} disabled={!current.nodes.length&&!busy} onClick={()=>setMobileView('map')}><GitBranch size={17}/> 선택지 보기 <span>{mobileMap(mapCase).routes.length}</span></button></div>
   <div className="main-panels">
     <ConversationPanel showcaseStage={showcaseStage} historyOpen={historyOpen} sorted={sorted} activeId={activeId} active={active} current={current} busy={busy} hasMessages={hasMessages} input={input} chosenModelId={chosenModelId} chosenModelAvailable={Boolean(chosenModel?.available)||wageExampleArmed} alternateRetryAvailable={Boolean(alternativeModel)} alternateRetryLabel={alternativeModel?alternativeModel.name+'로 재시도':''} inventory={inventory} analysisProgress={analysisProgress} error={error} bottomRef={bottomRef} inputRef={inputRef} newCase={newCase} deleteCase={deleteCase} fillInput={fillInput} submit={submit} acceptIntakeAnswer={acceptIntakeAnswer} retryWithAlternative={retryWithAlternative} chooseModel={chooseModel} onCollapse={()=>setChatCollapsed(true)} onOpenCase={id=>{setActiveId(id);setHistoryOpen(false);setError('')}} onCancel={()=>requestAbort.current?.abort()} onShowMap={()=>setMobileView('map')} onDismissError={()=>setError('')} onInputChange={changeInput} onOpenSettings={()=>setSettingsOpen(true)}/>
     <section className={'visual-panel'+(chosen?' has-details':'')} aria-label="상황별 선택지 지도">
      <MapWorkspace chatCollapsed={chatCollapsed} current={current} cases={cases} activeId={activeId} active={active} busy={busy} sourcesOpen={sourcesOpen} done={done} completedSummary={completedSummary} mapStatusText={mapStatusText} mobile={mobile} mapCase={mapCase} selected={selected} focusId={focusId} flowIds={flowIds} flowPosition={flowPosition} onExpandChat={()=>setChatCollapsed(false)} onExample={example} onNewCase={newCase} onOpenCase={id=>{setActiveId(id);setHistoryOpen(false);setSelected(null);setSourcesOpen(false);setError('')}} onDeleteCase={closeTab} onMoveCase={(id,target)=>setCases(values=>reorderItems(values,id,target))} onRefresh={()=>submit(undefined,true)} onToggleSources={()=>setSourcesOpen(v=>!v)} onCloseSources={()=>setSourcesOpen(false)} onSelectNode={selectNode} onContinueConversation={continueMapConversation} onShowChat={()=>setMobileView('chat')} onFocusFlow={focusFlow} onFillInput={fillInput}/>
      {chosen&&<DetailPanel node={chosen} onClose={()=>setSelected(null)} onBegin={startStep} onComplete={finishStep} onChoose={chooseStep} sources={current.sources} value={mapCase} onSelect={selectNode} busy={busy} loading={Boolean(loadingDetails[detailKey])} detailError={detailErrors[detailKey]} onRetry={loadDetails} proceedLoading={Boolean(loadingProceed[detailKey])} proceedError={proceedErrors[detailKey]}/>}
     </section>
   </div>
   {showcaseStage>=0&&<ShowcasePointer stage={showcaseStage}/>}
   {deleteValue&&<DeleteConversation name={deleteValue.name} onCancel={()=>setDeleteTarget(null)} onConfirm={confirmDelete}/>}
   {settingsOpen&&<ModelSettings inventory={inventory} currentModelId={chosenModelId} onClose={()=>setSettingsOpen(false)} onChanged={applyInventory}/>}
 </main>;
}
export default function Home(){return <App/>}
