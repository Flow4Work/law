'use client';

import {useRef,useState,type CSSProperties} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,Check,ChevronRight,Clock3,GitBranch,ListTree,Route} from 'lucide-react';
import type {LegalCase,RoadmapNode} from '@/lib/types';
import {mobileMap,routeBranches,type MobileBranch} from '@/lib/mobile-roadmap';
import {roadmapCardSummary,roadmapCardDisplaySummary,roadmapParallelNote} from '@/lib/roadmap-card-copy';
import {mandatoryPrerequisite,separateMandatoryCopy} from '@/lib/legal-prerequisites';
import {mapCardPeriod} from './map-durations';
import {procedureName} from '@/lib/concise-copy';
import './mobile-roadmap.css';

type Props={value:LegalCase;selected:string|null;onSelect:(id:string)=>void;onChat:()=>void;busy:boolean};

export function MobileRoadmap({value,selected,onSelect,onChat,busy}:Props) {
  const {root,routes}=mobileMap(value);
  const [view,setView]=useState<'overview'|'path'>('overview');
  const [routeId,setRouteId]=useState<string|null>(null);
  const scrollRef=useRef<HTMLDivElement>(null);
  const headingRef=useRef<HTMLHeadingElement>(null);
  const selectedNode=value.nodes.find(n=>n.id===selected);
  const route=routes.find(n=>n.id===(selectedNode?.scenarioParentId||selected))||routes.find(n=>n.id===routeId)||routes.find(n=>n.userConfirmed&&n.status==='current')||routes[0];
  const routeIndex=routes.findIndex(n=>n.id===route?.id);
  const awaiting=Boolean(value.intake);
  const branches=route?routeBranches(value,route.id):[];
  const changeView=(next:'overview'|'path',id?:string)=>{
    if(id)setRouteId(id);
    setView(next);
    scrollRef.current?.scrollTo({top:0});
    requestAnimationFrame(()=>headingRef.current?.focus({preventScroll:true}));
  };
  const details=(node:RoadmapNode)=>awaiting?onChat():onSelect(node.id);
  const renderBranches=(branches:MobileBranch[])=> <ul className="journey-graph-branches">{branches.map(branch=><li key={branch.node.id}>
    {branch.condition&&<span className="journey-condition">{branch.condition}</span>}
    <button className="journey-graph-node" onClick={()=>details(branch.node)} disabled={busy}><span>{procedureName(branch.node.title)}</span><ChevronRight size={16}/></button>
    {branch.node.description&&<p>{branch.node.description}</p>}
    {branch.children.length>0&&renderBranches(branch.children)}
  </li>)}</ul>;
  if(!root)return null;
  return <div className="mobile-journey" aria-label="가능한 방법과 상황별 선택지 지도">
    <div className="journey-view-switch" role="group" aria-label="지도 보기 방식">
      <button aria-pressed={view==='overview'} onClick={()=>changeView('overview')}><ListTree size={16}/>한눈에 비교</button>
      <button aria-pressed={view==='path'} disabled={!routes.length} onClick={()=>changeView('path')}><Route size={16}/>경로 따라가기</button>
    </div>
    <div className="journey-scroll" ref={scrollRef}>
      <div className="journey-page-heading"><div><span className="journey-eyebrow">{view==='overview'?'나의 선택지 지도':'선택한 경로의 흐름'}</span><h2 ref={headingRef} tabIndex={-1}>{view==='overview'?'어떤 길로 갈 수 있나요?':'어떻게 이어지나요?'}</h2></div><span className="journey-count">{view==='overview'?`${routes.length}개 경로`:`${routeIndex+1} / ${routes.length}`}</span></div>
      {view==='overview'?<>
        <button className="journey-origin" onClick={()=>details(root)} disabled={busy} aria-label="현재 상황 자세히 보기"><span className="journey-origin-dot" aria-hidden="true"/><span className="journey-origin-copy"><span className="journey-eyebrow">출발 · 현재 상황</span><strong>{root.title==='현재 상황'?'지금 나의 상황':root.title}</strong><span className="journey-origin-description">{root.description}</span></span><ChevronRight size={16}/></button>
        {routes.length>0?<><div className="journey-fork-label"><GitBranch size={15}/><span>상황에 따라 갈리는 {routes.length}가지 경로</span></div>
          <ol className="journey-options">{routes.map((node,index)=><li key={node.id} style={{'--route-accent':`var(--route-${index%4+1})`} as CSSProperties}>
            <button className="journey-option" onClick={()=>changeView('path',node.id)}>
              <span className="journey-option-top"><span className="journey-route-number">경로 {String(index+1).padStart(2,'0')}</span>{node.userConfirmed&&<span className={'journey-started '+(node.status==='done'?'done':'current')}><Check size={12}/>{node.status==='done'?'완료':'진행 중'}</span>}{node.status==='verify'&&<span className="journey-check">확인 필요</span>}<ArrowRight size={18}/></span>
              <strong>{procedureName(node.title)}</strong><p>{separateMandatoryCopy(roadmapCardDisplaySummary(node),node,mandatoryPrerequisite(node,value.sources))}</p>{mandatoryPrerequisite(node,value.sources)?<span className="journey-required-note">{mandatoryPrerequisite(node,value.sources)?.text}</span>:roadmapParallelNote(node,routes)&&<span className="journey-parallel-note">{roadmapParallelNote(node,routes)}</span>}
              <span className="journey-option-bottom"><span>{awaiting?'질문에 답하면 절차가 구체화돼요':mapCardPeriod(node).label}</span><b>흐름 보기 <ChevronRight size={13}/></b></span>
            </button>
          </li>)}</ol><p className="journey-footnote">경로는 진행 순서가 아니에요. 내 상황에 맞는 방법을 눌러 비교해 보세요.</p></>:<div className="journey-pending"><strong>다음 선택지를 정리하고 있어요</strong><p>대화에서 현재 상황을 조금 더 알려주세요.</p><button onClick={onChat}>대화로 돌아가기 <ArrowRight size={15}/></button></div>}
      </>:route&&<>
        <label className="journey-route-picker"><span>비교할 경로</span><select value={route.id} onChange={event=>changeView('path',event.target.value)}>{routes.map((node,index)=><option key={node.id} value={node.id}>{String(index+1).padStart(2,'0')} · {procedureName(node.title)}</option>)}</select></label>
        <div className="journey-context"><span className="journey-eyebrow">출발</span><span>{root.description||root.title}</span><ArrowDown size={16}/></div>
        <section className="journey-path" style={{'--route-accent':`var(--route-${routeIndex%4+1})`} as CSSProperties} aria-label={route.title+' 진행 흐름'}>
          <div className="journey-route-head"><span className="journey-route-number">경로 {String(routeIndex+1).padStart(2,'0')}</span><h3>{procedureName(route.title)}</h3><p>{separateMandatoryCopy(roadmapCardDisplaySummary(route),route,mandatoryPrerequisite(route,value.sources))}</p>{mandatoryPrerequisite(route,value.sources)?<span className="journey-required-note">{mandatoryPrerequisite(route,value.sources)?.text}</span>:roadmapParallelNote(route,routes)&&<span className="journey-parallel-note">{roadmapParallelNote(route,routes)}</span>}<button disabled={busy} onClick={()=>details(route)}>{awaiting?'질문에 답하고 구체화하기':'준비 자료·상세 설명'}<ChevronRight size={16}/></button></div>
          {route.scenario?.steps.length?<>
            <ol className="journey-timeline" aria-label="진행 순서">{route.scenario.steps.map((step,index)=>{
              const stage=value.nodes.find(n=>n.scenarioParentId===route.id&&n.scenarioStep===index);
              if(!stage)return null;
              const completed=stage.status==='done';
              const current=stage.status==='current';
              return <li key={index} className={(completed?'is-complete':'')+(current?' is-current':'')}><span className="journey-step-number">{completed?<Check size={14}/>:String(index+1).padStart(2,'0')}</span><div className="journey-step"><div className="journey-step-heading"><h4>{procedureName(step.title)}</h4>{current&&<span className="journey-current-label">진행 중</span>}</div>{step.condition&&<span className="journey-condition">{step.condition}</span>}{step.description&&<p>{step.description}</p>}{step.duration&&<span className="journey-duration"><Clock3 size={12}/>{step.duration}</span>}{stage&&<button disabled={busy} onClick={()=>details(stage)}>이 단계 자세히 <ChevronRight size={14}/></button>}</div></li>;
            })}</ol>
            {value.nodes.some(n=>n.scenarioParentId===route.id&&n.kind==='outcome')&&<section className="journey-results"><h4><GitBranch size={17}/>이후, 상황에 따라 갈려요</h4><ul>{value.nodes.filter(n=>n.scenarioParentId===route.id&&n.kind==='outcome').map(outcome=><li key={outcome.id}><span className="journey-condition">{outcome.conditions[0]||'가능한 결과'}</span><strong>{procedureName(outcome.title)}</strong><p>{outcome.description}</p><div className="journey-step"><button disabled={busy} onClick={()=>details(outcome)}>결과 자세히 <ChevronRight size={14}/></button></div>
             {route.scenario?.outcomes[outcome.scenarioOutcome??-1]?.nextSteps?.map((step,stepIndex)=>{
               const continued=value.nodes.find(item=>item.id==='scenario:'+route.id+':outcome:'+outcome.scenarioOutcome+':followup:'+stepIndex);
               return <button key={stepIndex} type="button" className="journey-followup-step" onClick={()=>continued&&details(continued)} disabled={busy||!continued}><span>후속 {stepIndex+1}</span><strong>{step.title}</strong><ChevronRight size={14}/></button>;
             })}</li>)}</ul>
             {value.nodes.filter(n=>n.scenarioParentId===route.id&&n.kind==='completion').map(node=><button key={node.id} className="journey-completion" onClick={()=>details(node)} disabled={busy}><Check size={16}/><span><strong>종료 · {node.title}</strong><small>{node.description}</small></span><ChevronRight size={16}/></button>)}
          </section>}
          </>:<>{route.actions.length>0&&<section className="journey-preparation"><h4>먼저 확인할 일</h4><ul>{route.actions.map((action,i)=><li key={i}>{action}</li>)}</ul></section>}{branches.length>0? <section className="journey-results"><h4><GitBranch size={17}/>이 경로에서 이어지는 과정</h4>{renderBranches(branches)}</section>:<div className="journey-pending"><strong>{awaiting?'아직 절차를 확인하는 중이에요':'후속 절차는 상세 설명에서 확인해요'}</strong><p>{awaiting?'대화의 확인 질문에 답하면, 이 경로의 진행 단계와 결과를 구체화할 수 있어요.':'현재 확인된 선택지예요. 자세한 내용을 열어 준비 자료와 다음 행동을 확인해 보세요.'}</p><button disabled={busy} onClick={()=>details(route)}>{awaiting?'대화에서 이어서 답하기':'상세 설명 보기'}<ArrowRight size={15}/></button></div>}</>}
          {Boolean(route.scenario?.timing?.length)&&<section className="journey-timing"><h4><Clock3 size={16}/>기한과 예상 기간</h4>{route.scenario!.timing!.map((time,index)=><div key={index}><span>{time.kind==='deadline'?'확인할 기한':time.kind==='estimate'?'예상 소요':'상황에 따라 달라요'}</span><strong>{time.label}</strong><p>{time.description}</p></div>)}</section>}
          {Boolean(route.scenario?.transitions?.length)&&<section className="journey-transitions"><h4>다른 경로로 이어질 때</h4>{route.scenario!.transitions!.map((transition,index)=>{const next=routes.find(n=>n.id===transition.targetId);return next?<button key={index} onClick={()=>changeView('path',next.id)}><span>{transition.condition}<strong>{next.title}</strong></span><ArrowRight size={17}/></button>:null})}</section>}
        </section>
        <button className="journey-back" onClick={()=>changeView('overview')}><ArrowLeft size={16}/>모든 경로 다시 비교하기</button>
      </>}
    </div>
  </div>;
}
