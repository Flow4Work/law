'use client';
import {useEffect,useRef} from 'react';
import type {ReactNode} from 'react';
import {ChevronDown,ChevronRight,Check,ExternalLink,LoaderCircle,X,ArrowRight,RotateCcw,CheckCircle2} from 'lucide-react';
import type {DocumentRecommendation,LegalCase,LegalSource,RoadmapNode} from '@/lib/types';
import {ANALYSIS_VERSION} from '@/lib/analysis';
import {detailHeadline,procedureName,supplementaryDescription} from '@/lib/concise-copy';
import {routeKeyword} from '@/lib/roadmap-card-copy';
import {durationLabel,durationSourceIds,scenarioTiming,OUTCOME_LABEL} from '@/lib/legal-copy';
import {mapCardPeriod} from '@/features/map/map-durations';
import {detailPeriod,outcomeGuidance} from './detail-period';
import {followingSteps} from '@/lib/progress';
import {scenarioParent,revealedCount} from '@/lib/scenario-graph';
import {isTerminalOutcome} from '@/lib/scenario-endings';
import {useMobileLayout} from '@/features/shared/use-mobile-layout';
import {displayDate} from '@/features/shared/date-format';
const DURATION_NOISE=/^(사건별 확인( 필요)?|확인 필요|미정|미확인|정보 없음|상황에 따라 다름)[.!]?$/;
const RISK_NOISE=/^(인정 여부는 조사 결과에 따름|사건별 확인|상황에 따라 다름)[.!]?$/;
function cleanText(value?:string){const text=(value||'').trim();return text&&!DURATION_NOISE.test(text)?text:''}
function DetailFold({label,children,onOpen}:{label:string;children:ReactNode;onOpen?:()=>void}){
 return <details className="detail-fold" onToggle={event=>{if(event.currentTarget.open)onOpen?.()}}><summary><span>{label}</span><ChevronDown size={16} className="fold-chevron"/></summary><div className="detail-fold-body">{children}</div></details>;
}
function FoldList({title,items}:{title:string;items:string[]}){
 if(!items.length)return null;
 return <div className="fold-group"><h4>{title}</h4><ul>{items.map((item,i)=><li key={i}>{item}</li>)}</ul></div>;
}
function FoldText({title,text}:{title:string;text:string}){
 if(!text)return null;
 return <div className="fold-group"><h4>{title}</h4><p>{text}</p></div>;
}
function DocumentItems({node,sources}:{node:RoadmapNode;sources:LegalSource[]}){
 const rawDocs:DocumentRecommendation[]=node.documentChecklist?.length?node.documentChecklist:node.documents.map(name=>({name,necessity:'check',reason:'',sourceIds:[]}));
 // 공식 목록으로 확인되지 않은 '필수', 상황 설명이 없는 '상황별'은 단정하지 않습니다.
 const docs=rawDocs.map(doc=>{
  if(doc.necessity==='required'&&!sources.some(s=>doc.sourceIds.includes(s.id)&&s.requiredDocuments?.some(name=>doc.name.replace(/\s/g,'').includes(name.replace(/\s/g,'')))))return {...doc,necessity:'check' as const};
  if(doc.necessity==='conditional'&&!doc.condition?.trim())return {...doc,necessity:'check' as const};
  return doc;
 });
 if(!docs.length)return null;
 const labels={required:'필수',helpful:'도움',conditional:'상황별',check:'확인'};
 return <div className="fold-group"><h4>필요한 자료</h4><ul className="fold-documents">{docs.map((doc,i)=><li key={doc.name+i}><div className="fold-doc-name"><strong>{doc.name}</strong><span className={'doc-tag '+doc.necessity}>{labels[doc.necessity]}</span></div>{doc.reason&&<p>{doc.reason}</p>}{doc.condition&&<small>{doc.condition}</small>}</li>)}</ul></div>;
}
type TimelineStep={title:string;description?:string;condition?:string;duration?:string};
function flowIndex(node:RoadmapNode){
 if(!node.scenario?.steps.length)return -1;
 // 사용자가 실제로 완료한 경우에만 모든 단계를 완료로 표시합니다.
 if(node.status==='done')return node.scenario.steps.length;
 if(node.userConfirmed&&node.status==='current')return node.scenarioIndex||0;
 return -1;
}
function ScenarioTimeline({steps,activeIndex,label}:{steps:TimelineStep[];activeIndex:number;label:string}){
 if(!steps.length)return null;
 return <section className="detail-block flow-block"><h3 className="detail-label">{label}</h3><ol className="scenario-timeline">{steps.map((step,i)=>{
  const state=activeIndex<0?'':i<activeIndex?'done':i===activeIndex?'active':'upcoming';
  const duration=durationLabel(step.duration);
  return <li key={i} className={state||undefined} aria-current={state==='active'?'step':undefined}><span className="timeline-number">{state==='done'?<Check size={13} strokeWidth={3}/>:<span className="timeline-digit">{i+1}</span>}</span><div><strong>{step.title}</strong>{step.condition&&<small>{step.condition}</small>}{step.description&&<p>{step.description}</p>}{duration&&<em>{duration.label}</em>}</div></li>;
 })}</ol></section>;
}
function ScenarioOutcomes({node}:{node:RoadmapNode}){
 const outcomes=node.scenario?.outcomes||[];
 if(!outcomes.length)return null;
 // 종료 결과를 가능한 결과에서 다시 반복하지 않고, 한 화면 폭을 온전히 사용합니다.
 const ongoing=outcomes.filter(outcome=>!isTerminalOutcome(outcome));
 const completed=outcomes.filter(isTerminalOutcome);
 return <section className="detail-block detail-results-block"><div className={'detail-results-grid'+(completed.length?' has-ending':'')}>
   {ongoing.length>0&&<div className="detail-results-column"><h3 className="detail-label">가능한 결과</h3><ul className="detail-outcomes">{ongoing.map((outcome,i)=><li key={i}><strong>{outcome.title||(outcome.likelihood?OUTCOME_LABEL[outcome.likelihood]:'')}</strong>{outcome.condition&&<small>{outcome.condition}</small>}{(outcome.summary||outcome.description)&&<p>{outcome.summary||outcome.description}</p>}{Boolean(outcome.nextSteps?.length)&&<small className="detail-next-flow">다음: {outcome.nextSteps!.map(step=>step.title).join(' → ')}</small>}</li>)}</ul></div>}
   {completed.length>0&&<div className="detail-results-column detail-completion-column"><h3 className="detail-label">종료</h3><div className="detail-completion-list">{completed.map((outcome,i)=>{const summary=(outcome.summary||outcome.description||'').trim();const condition=(outcome.condition||'').trim();return <div className="detail-completion-item" key={i}><span className="completion-icon" aria-hidden="true"><CheckCircle2 size={16} strokeWidth={1.9}/></span><div className="completion-copy"><strong>{outcome.title||(outcome.likelihood?OUTCOME_LABEL[outcome.likelihood]:'종료')}</strong>{summary&&<p>{summary}</p>}{condition&&condition!==summary&&<small>조건 · {condition}</small>}</div></div>})}</div></div>}
 </div></section>;
}
export function DetailPanel({node,onClose,onBegin,onComplete,onChoose,sources,value,onSelect,busy,loading,detailError,onRetry,proceedLoading,proceedError}:{node:RoadmapNode;onClose:()=>void;onBegin:(id:string)=>void;onComplete:(id:string)=>void;onChoose:(from:string,id:string)=>void;sources:LegalSource[];value:LegalCase;onSelect:(id:string)=>void;busy:boolean;loading:boolean;detailError?:string;onRetry:()=>void;proceedLoading:boolean;proceedError?:string}){
 const mobile=useMobileLayout();
 const closeRef=useRef<HTMLButtonElement>(null);
 const scrollRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{scrollRef.current?.scrollTo({top:0});if(typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('showcase'))return;const previous=document.activeElement;closeRef.current?.focus();return()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus()}},[node.id]);
 const timingSources=node.scenario?.timing?.flatMap(t=>t.sourceIds)||[];
 const durationIds=durationSourceIds(node);
 const links=sources.filter(x=>node.sourceIds.includes(x.id)||timingSources.includes(x.id)||durationIds.includes(x.id)||node.scenarioParentId&&value.nodes.find(n=>n.id===node.scenarioParentId)?.sourceIds.includes(x.id)).sort((a,b)=>Number(b.kind==='공식 안내')-Number(a.kind==='공식 안내'));
 const nextNodes=followingSteps(value,node.id);
 const parent=scenarioParent(value,node);
 const procedure=parent||node;
 const parentLabel=parent?routeKeyword(parent).replace(/\s+(신청|발송)$/,''):'';
 const contextLabel=node.kind==='step'
  ?`${parentLabel?parentLabel+' ':''}진행 절차 ${(node.scenarioStep??0)+1}단계`
  :node.kind==='outcome'
  ?`${parentLabel?parentLabel+' ':''}가능한 결과 ${(node.scenarioOutcome??0)+1}`
  :node.kind==='completion'?'종료'
  :node.kind==='followup'?`${parentLabel?parentLabel+' ':''}후속 절차`
  :node.kind==='situation'?'내 상황':routeKeyword(node);
 const period=detailPeriod(node,parent,mapCardPeriod(node,parent));
 const outcomeDetails=outcomeGuidance(node,parent);
 const revealed=revealedCount(procedure);
 const hasMore=!procedure.scenario?.steps.length||revealed<procedure.scenario.steps.length+(procedure.scenario.outcomes.length?1:0);
 const isCurrentProcess=Boolean(parent&&node.kind==='step'&&node.scenarioStep===(parent.scenarioIndex||0)&&parent.status==='current');
 const pending=node.id===value.pendingNextFrom&&node.status==='done';
 const nextChoices=followingSteps(value,node.id);
 const {deadlines,variable,estimate}=scenarioTiming(node);
 const timingNotes=[
  ...deadlines.map(item=>`기한 — ${item.label.trim()}${item.description?' · '+item.description.trim():''}`),
  ...(estimate?[`예상 기간 — ${estimate.label.trim()}${estimate.description?' · '+estimate.description.trim():''}`]:[]),
  ...variable.map(item=>`달라지는 조건 — ${item.label.trim()}${item.description?' · '+item.description.trim():''}`)
 ];
 const stepCount=node.scenario?.steps.length||0;
 const actions=node.actions.filter(item=>item.trim()&&item.trim()!==node.description.trim());
 const risks=node.risks.filter(item=>item.trim()&&!RISK_NOISE.test(item.trim()));
 const prepareLabel=[node.kind==='completion'?'종료 조건':node.kind==='outcome'?'조건':'준비할 것',...(cleanText(node.cost)?['비용']:[]),...(risks.length?['주의사항']:[])].join(' · ');
 const headline=detailHeadline(node);
 const descriptionSupplement=supplementaryDescription(node,headline);
 const showSummary=Boolean(node.description||node.summaryLines?.length);
 const documentCount=node.documentChecklist?.length||node.documents.length;
 // 비어 있는 접이식 영역은 숨기되, 아직 검증 전이면 사용자가 준비 정보를 조회할 수 있게 둡니다.
 const hasPrepare=node.kind==='completion'?Boolean(node.conditions.length):Boolean(
  cleanText(node.scenario?.suitableWhen)||
  (node.kind!=='outcome'&&descriptionSupplement)||actions.length||documentCount||node.conditions.length||
  cleanText(node.cost)||timingNotes.length||risks.length||
  (node.detailVersion||0)<ANALYSIS_VERSION||loading||detailError
 );
 const footerChoiceIds=new Set<string>();
 if(parent||node.kind==='situation')nextNodes.forEach(item=>footerChoiceIds.add(item.id));
 if(pending)nextChoices.forEach(item=>footerChoiceIds.add(item.id));
 const seen=new Set<string>();
 const related=[...(node.scenario?.transitions||[]).map(item=>({id:item.targetId,hint:item.condition||''})),...node.next.map(id=>({id,hint:''}))]
  .map(item=>({...item,target:value.nodes.find(candidate=>candidate.id===item.id)}))
  .filter((item):item is {id:string;hint:string;target:RoadmapNode}=>Boolean(item.target)&&item.id!==node.id&&item.target?.kind!=='step'&&item.target?.kind!=='outcome'&&!footerChoiceIds.has(item.id))
  .filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;});
 return <>{mobile&&<button className="mobile-detail-scrim" aria-label="상세 설명을 닫고 지도 보기" onClick={onClose}/>}<aside className="detail-panel" role={mobile?'dialog':'complementary'} aria-modal={mobile||undefined} aria-labelledby={'detail-title-'+node.id} onKeyDown={e=>{if(e.key==='Escape')onClose()}}>
    <div className="mobile-sheet-handle" aria-hidden="true"/><div className="detail-head"><span className={'stage-pill '+(node.kind==='completion'?'stage-completion':node.kind==='route'||(!node.kind&&node.scenario)?'stage-keyword':node.kind==='outcome'?'stage-outcome':node.status)}>{contextLabel}</span><button ref={closeRef} className="icon-btn" onClick={onClose} title="설명 닫기" aria-label="설명 닫기"><X size={20}/></button></div>
    <div className="detail-scroll" ref={scrollRef}>
     <div className="detail-title-block"><h2 id={'detail-title-'+node.id}>{procedureName(node.title)}</h2>{showSummary&&<p className="detail-summary"><strong>{node.kind==='outcome'?procedureName(node.description):headline}</strong></p>}{outcomeDetails?.condition&&<p className="detail-outcome-condition"><b>해당 조건</b> {outcomeDetails.condition}</p>}{node.kind==='completion'&&<p className="detail-completion-banner"><CheckCircle2 size={16}/> 종료 요건을 충족한 경우에만 해당 절차가 끝나요.</p>}</div>
     {node.kind!=='situation'&&<dl className="detail-metrics"><div><dt>{period.metricTitle||'예상 기간'}</dt><dd>{period.label}</dd></div><div><dt>{node.kind==='completion'?'상태':node.kind==='outcome'?'결과':node.kind==='followup'?'다음 흐름':'절차'}</dt><dd>{node.kind==='completion'?'조건부 종료':node.kind==='followup'?(node.linkedRouteId?'다른 경로':node.scenarioFollowUp!==undefined?`${node.scenarioFollowUp+1}번째 후속 단계`:'후속 확인'):node.kind==='outcome'&&parent?.scenario?.outcomes.length?<><b>{(node.scenarioOutcome??0)+1}</b> / {parent.scenario.outcomes.length}갈래</>:stepCount>0?<><b>{stepCount}</b>단계</>:parent?.scenario?.steps.length?<><b>{(node.scenarioStep||0)+1}</b> / {parent.scenario.steps.length}단계</>:'확인 예정'}</dd></div></dl>}
     {period.category==='variable'&&period.note&&<div className="detail-period-reason"><strong>일정이 달라지는 이유</strong><p>{period.note}</p></div>}
     {period.sourceName==='실제 처리사례 1건'&&<p className="detail-period-sample">공개된 실제 사건 1건 기준 · 법원 평균 통계 아님</p>}
     {deadlines.length>0&&<p className="detail-deadline"><b aria-hidden="true">기한</b><span>{deadlines.map(item=>item.label).join(' · ')}</span></p>}
     <ScenarioTimeline steps={node.scenario?.steps||[]} activeIndex={flowIndex(node)} label="이렇게 흘러가요"/>
     {!node.scenario&&node.kind==='step'&&parent?.scenario?.steps.length?<ScenarioTimeline steps={parent.scenario.steps} activeIndex={flowIndex(parent)} label="전체 절차"/>:null}
     <ScenarioOutcomes node={node}/>
     {outcomeDetails&&<section className="detail-block detail-result-next"><h3 className="detail-label">{outcomeDetails.nextTitle}</h3><p>{outcomeDetails.nextText}</p></section>}
     {related.length>0&&<section className="detail-block"><h3 className="detail-label">다른 방법 알아보기</h3><div className="detail-links">{related.map(item=><button key={item.id} className="detail-link" onClick={()=>onSelect(item.id)}><span><strong>{item.target.title}</strong>{item.hint&&<small>{item.hint}</small>}</span><ChevronRight size={16}/></button>)}</div></section>}
     {hasPrepare&&<DetailFold key={node.id+':prepare'} label={prepareLabel} onOpen={onRetry}>
      <FoldText title={node.kind==='route'?'이 방법이 맞는 상황':'이 상황에 맞는 경우'} text={(node.scenario?.suitableWhen||'').trim()}/>
      {descriptionSupplement&&node.kind!=='outcome'&&<FoldText title="상세 조건과 설명" text={descriptionSupplement}/>}
      <FoldList title={node.kind==='situation'?'지금 할 일':'시작하기 전에'} items={actions}/>
      <DocumentItems node={node} sources={sources}/>
      <FoldList title="먼저 확인할 것" items={node.conditions}/>
      <FoldText title="예상 비용" text={cleanText(node.cost)}/>
      <FoldList title="예상 기간과 기한" items={timingNotes}/>
      <FoldList title="주의사항" items={risks}/>
      {loading&&<p className="detail-supplement-status" role="status"><LoaderCircle className="spin" size={13} aria-hidden="true"/><span>준비 정보를 확인하고 있어요</span></p>}
      {!loading&&detailError&&<div className="detail-supplement-error" role="status"><span>추가 정보를 불러오지 못했어요.</span><button type="button" onClick={onRetry} title={detailError}><RotateCcw size={13} aria-hidden="true"/>다시 시도</button></div>}
     </DetailFold>}
     {links.length>0&&<DetailFold key={node.id+':sources'} label="법률 근거"><div className="detail-sources">{links.map(src=><a key={src.id} href={src.url} target="_blank" rel="noopener noreferrer"><span><strong>{src.title}</strong>{src.kind==='공식 안내'&&src.snippet?<p>{src.snippet}</p>:null}<small>{src.kind}{src.effectiveDate?' · 시행 '+displayDate(src.effectiveDate):src.date?' · '+displayDate(src.date):''}</small></span><ExternalLink size={13}/></a>)}</div></DetailFold>}
    </div>
   {(node.kind==='situation'||node.kind==='route'||node.kind==='step'||((node.kind==='outcome'||node.kind==='followup')&&(nextNodes.length>0||node.linkedRouteId)))&&<div className="step-actions">
    {node.kind==='situation'?<><strong>살펴볼 방법을 선택하세요</strong>{nextNodes.map(next=><button className="step-choice" key={next.id} onClick={()=>onSelect(next.id)}><span>{next.title}</span><ChevronRight size={16}/></button>)}</>
     :node.kind==='outcome'||node.kind==='followup'?<><strong>{node.linkedRouteId?'연결된 방법':'이어서 살펴볼 과정'}</strong>{node.linkedRouteId&&<button className="step-choice" disabled={busy} onClick={()=>onSelect(node.linkedRouteId!)}><span>{value.nodes.find(item=>item.id===node.linkedRouteId)?.title||'연결된 방법 보기'}</span><ArrowRight size={16}/></button>}{nextNodes.map(next=><button key={next.id} disabled={busy} className={'step-choice'+(next.kind==='completion'?' completion-choice':'')} onClick={()=>onSelect(next.id)}><span>{next.kind==='completion'?'종료 · ':''}{next.title}</span>{next.kind==='completion'?<CheckCircle2 size={16}/>:<ArrowRight size={16}/>}</button>)}</>
     :<button disabled={busy||proceedLoading||node.status==='unavailable'||!hasMore} className="step-primary" onClick={()=>onBegin(node.id)} aria-busy={proceedLoading} title={proceedError}>{proceedLoading?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>}<span>{proceedLoading?'불러오는 중…':proceedError?'다음 절차 다시 불러오기':!hasMore?'후속 절차를 모두 펼쳤어요':revealed===0&&node.kind==='route'?'이 방법으로 진행':procedure.scenario&&revealed>=procedure.scenario.steps.length?'가능한 결과 보기':'다음 절차 보기'}</span></button>}
   </div>}
 </aside></>;
}
