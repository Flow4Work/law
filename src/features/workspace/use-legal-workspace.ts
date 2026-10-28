'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {DetailSupplement,LegalCase,LegalAnswer,LegalSource,Message,RoadmapNode} from '@/lib/types';
import {advanceStep,completeStep} from '@/lib/progress';
import {ANALYSIS_VERSION} from '@/lib/analysis';
import {CIVIL_DEMO} from '@/lib/civil-demo';
import {isPortfolioCapture} from '@/lib/portfolio-capture';
import {SHOWCASE_STORY,SHOWCASE_DURATIONS,SHOWCASE_SCENES,showcaseCase,showcasePhase} from '@/lib/portfolio-showcase';
import {WAGE_EXAMPLE_DELAY_MS,wageExamplePlan,nextWageExamplePlan,wageExampleResult} from '@/lib/wage-example-fast';
import {limitCaseTitle,summarizeCaseTitle} from '@/lib/case-title';
import {expandRoadmap,revealedCount} from '@/lib/scenario-graph';
import {normalizeSavedRoadmapTerms} from '@/lib/legal-procedure-terms';
import type {ModelInventory} from '@/lib/model-types';
import {selectedModelId} from '@/lib/model-selection';
import {readAnalysisStream} from '@/lib/analysis-stream';
import {previewIntake,recordIntakeAnswer,reconcileIntakeResult,intakeSummary,type IntakeAnswer,type IntakePlan} from '@/lib/intake';
import type {AnalysisProgressState} from '@/features/shared/analysis-progress';
import {useMobileLayout} from '@/features/shared/use-mobile-layout';

const STORE='ai-legal-roadmap-cases-v1';
const ACTIVE='ai-legal-roadmap-active-v1';
const PREVIEW_STORE='ai-legal-roadmap-preview-v1';
const THEMESTORE='ai-legal-roadmap-theme-v3';
const AUTO_FOLD_KEY='ai-legal-roadmap-auto-folded-v1';
const blank=():LegalCase=>({id:crypto.randomUUID(),name:'새 대화',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[],nodes:[],edges:[],facts:[],sources:[],evidenceStatus:'unverified'});
const demo:LegalCase=CIVIL_DEMO;
const waitWageExample=(signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 if(signal.aborted){reject(new Error('cancelled'));return}
 const onAbort=()=>{clearTimeout(timer);reject(new Error('cancelled'))};
 const timer=setTimeout(()=>{signal.removeEventListener('abort',onAbort);resolve()},WAGE_EXAMPLE_DELAY_MS);
 signal.addEventListener('abort',onAbort,{once:true});
});
const shortCaseTitle=limitCaseTitle;
export function useLegalWorkspace(){
 const mobile=useMobileLayout();
 const [cases,setCases]=useState<LegalCase[]>([]);
 const [previewCase,setPreviewCase]=useState<LegalCase>(demo);
 const [showcaseStage,setShowcaseStage]=useState(-1);
 const [activeId,setActiveId]=useState<string|null>(null);
 const [hydrated,setHydrated]=useState(false);
 const captureMode=useRef(false);
 const [theme,setTheme]=useState<'light'|'dark'>('light');
 const [historyOpen,setHistoryOpen]=useState(false);
 const [sourcesOpen,setSourcesOpen]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const [intakeHintCaseId,setIntakeHintCaseId]=useState<string|null>(null);
 const [focusId,setFocusId]=useState<string|null>(null);
 const [input,setInput]=useState('');
 const [wageExampleArmed,setWageExampleArmed]=useState(false);
 const wageExampleArmedRef=useRef(false);
 const [mobileView,setMobileView]=useState<'chat'|'map'>('chat');
 const [chatCollapsed,setChatCollapsed]=useState(false);
 const autoFoldedCases=useRef(new Set<string>());
 const inputRef=useRef<HTMLTextAreaElement>(null);
 const [busy,setBusy]=useState(false);
 const [loadingDetails,setLoadingDetails]=useState<Record<string,boolean>>({});
 const [detailErrors,setDetailErrors]=useState<Record<string,string>>({});
 const [loadingProceed,setLoadingProceed]=useState<Record<string,boolean>>({});
 const [proceedErrors,setProceedErrors]=useState<Record<string,string>>({});
 const proceedRequests=useRef(new Set<string>());
 const detailRequests=useRef(new Set<string>());
 const requestVersion=useRef(0);
 const [error,setError]=useState('');
 const [inventory,setInventory]=useState<ModelInventory|null>(null);
 const [preferredModel,setPreferredModel]=useState('');
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [deleteTarget,setDeleteTarget]=useState<string|null>(null);
 const [analysisProgress,setAnalysisProgress]=useState<AnalysisProgressState>({phase:'analyzing',message:'이야기에 맞는 방법을 정리하고 있어요.'});
 const requestAbort=useRef<AbortController|null>(null);
 const busyRef=useRef(false);
 const bottomRef=useRef<HTMLDivElement>(null);
 const active=cases.find(c=>c.id===activeId);
 const current=active||previewCase;
 const preview=!active;
 const chosenModelId=selectedModelId(inventory,active?.modelId,preferredModel);
 const chosenModel=inventory?.models.find(m=>m.id===chosenModelId);
 const deleteValue=cases.find(c=>c.id===deleteTarget);
 const applyInventory=(data:ModelInventory,id?:string)=>{setInventory(data);if(id){const match=data.models.find(m=>m.id===id)||data.models.find(m=>m.id.startsWith(id+':'));if(match){setPreferredModel(match.id);if(active)setCases(values=>values.map(c=>c.id===active.id?{...c,modelId:match.id}:c))}}};
 useEffect(()=>{if(typeof window!=='undefined'&&new URLSearchParams(window.location.search).has('showcase'))return;let alive=true;fetch('/api/models').then(r=>{if(!r.ok)throw new Error();return r.json()}).then(data=>{if(alive)setInventory(data)}).catch(()=>{if(alive)setError('모델 연결 목록을 읽지 못했어요. 모델 연결에서 다시 확인해주세요.')});return()=>{alive=false;requestAbort.current?.abort()}},[]);
 const expanded=useMemo(()=>expandRoadmap(current),[current]);
 const mapCase=useMemo(()=>({...current,nodes:expanded.nodes,edges:expanded.edges}),[current,expanded]);
 const showcaseSelection=activeId==='portfolio-showcase'?showcaseStage===13?'wage-request':showcaseStage===14||showcaseStage===15?'wage-labor':showcaseStage===16?'scenario:wage-labor:step:0':showcaseStage===17?'scenario:wage-labor:step:1':showcaseStage===18?'scenario:wage-labor:step:2':showcaseStage===19?'scenario:wage-labor:outcome:1':showcaseStage>=20?'scenario:wage-labor:outcome:0':null:null;
 const resolvedSelected=showcaseSelection||selected;
 const chosenRaw=mapCase.nodes.find(n=>n.id===resolvedSelected)||null;
 // 지도 노드는 그대로 두고, 하위 절차의 상세 보완 정보만 우측 패널에 덧씁니다.
 const supplement=chosenRaw?.scenarioParentId?current.detailSupplements?.[chosenRaw.id]:undefined;
 const chosen=chosenRaw?(supplement?{...chosenRaw,...supplement}:chosenRaw):null;
 const selectNode=(id:string)=>{
  if(active?.intake){if(mapCase.nodes.some(n=>n.id===id))setIntakeHintCaseId(current.id);return}
  if(busy)return;
  setSelected(id);setFocusId(id);setSourcesOpen(false);
 };
 const hasMessages=Boolean(active?.messages.length);
 const detailKey=current.id+':'+selected;
 const loadDetails=async()=>{
  if(!active||!selected)return;
  if(active.examplePreset==='wage-fast')return; // The entire example graph has local detail fixtures.
  const node=chosen;if(!node||node.kind==='completion'||Boolean(node.linkedRouteId)||(node.detailVersion||0)>=ANALYSIS_VERSION)return;
  const key=current.id+':'+node.id;if(detailRequests.current.has(key))return;
  detailRequests.current.add(key);setLoadingDetails(v=>({...v,[key]:true}));setDetailErrors(v=>({...v,[key]:''}));
  const snapshot=current;
  // scenario에서 동적으로 펼친 카드도 자체 주의사항을 검증할 수 있어야 합니다.
  const requestCase=node.scenarioParentId?{...snapshot,nodes:[node,...snapshot.nodes]}:snapshot;
   try{
    const response=await fetch('/api/step-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({case:requestCase,id:node.id,purpose:'documents'})});
    const payload=await response.json();if(!response.ok)throw new Error(payload.error||'상세 내용을 불러오지 못했어요.');
    setCases(items=>items.map(value=>{
     if(value.id!==snapshot.id||value.messages.length!==snapshot.messages.length)return value;
     const sources=Array.from(new Map([...value.sources,...payload.sources].map(s=>[s.id,s])).values());
     if(node.scenarioParentId){
      const live=expandRoadmap(value).nodes.find(n=>n.id===node.id);
      if(!live||live.title!==node.title||live.description!==node.description)return value;
      const supplement:DetailSupplement={
       actions:payload.node.actions,conditions:payload.node.conditions.length?payload.node.conditions:live.conditions,
       documents:payload.node.documents.length?payload.node.documents:live.documents,
       documentChecklist:payload.node.documentChecklist||[],cost:payload.node.cost||live.cost,
       risks:payload.node.risks,sourceIds:[...new Set([...live.sourceIds,...payload.node.sourceIds])],detailVersion:ANALYSIS_VERSION
      };
      return {...value,detailSupplements:{...value.detailSupplements,[node.id]:supplement},sources};
     }
     if(!value.nodes.some(n=>n.id===node.id&&n.description===node.description))return value;
     // A late document response must not replace the procedure or its reveal cursor.
     return {...value,nodes:value.nodes.map(n=>n.id===node.id?{...n,...payload.node,id:n.id,title:n.title,description:n.description,status:n.status,next:n.next,userConfirmed:n.userConfirmed,scenarioIndex:n.scenarioIndex,scenario:n.scenario,scenarioRevealed:n.scenarioRevealed}:n),sources};
    }));
   }catch(error){setDetailErrors(v=>({...v,[key]:error instanceof Error?error.message:'상세 내용을 불러오지 못했어요.'}))}
   finally{detailRequests.current.delete(key);setLoadingDetails(v=>({...v,[key]:false}))}
 };
 useEffect(()=>{
  // The existing example is fully local: capture it without AI waits or changing saved work.
  captureMode.current=isPortfolioCapture()||new URLSearchParams(window.location.search).has('showcase');
  if(new URLSearchParams(window.location.search).has('showcase')){
   const name=new URLSearchParams(window.location.search).get('showcaseScene');
   const start=name&&name in SHOWCASE_SCENES?SHOWCASE_SCENES[name as keyof typeof SHOWCASE_SCENES].start:0;
   setCases([showcaseCase(start)]);setActiveId('portfolio-showcase');setTheme('light');setChatCollapsed(false);setHydrated(true);return;
  }
  if(captureMode.current){
   setCases([]);setActiveId(null);setPreviewCase(structuredClone(demo));
   setTheme('light');setChatCollapsed(true);setHydrated(true);return;
  }
  try{
    const savedPreview=JSON.parse(localStorage.getItem(PREVIEW_STORE)||'null');
    if(savedPreview?.id===demo.id&&Array.isArray(savedPreview.nodes))setPreviewCase(savedPreview);
    const parsed=JSON.parse(localStorage.getItem(STORE)||'[]');
    const restored:LegalCase[]=Array.isArray(parsed)?parsed.filter(x=>x&&typeof x.id==='string'&&(!x.demo||x.examplePreset==='wage-fast')).slice(0,50).map(x=>{const oldName=typeof x.name==='string'?x.name:'새 대화';const firstMessage=Array.isArray(x.messages)?x.messages.find((m:Message)=>m.role==='user')?.content:'';return normalizeSavedRoadmapTerms({...x,name:summarizeCaseTitle(oldName.endsWith('…')&&firstMessage?firstMessage:oldName)});}):[];
    const savedFoldIds=JSON.parse(localStorage.getItem(AUTO_FOLD_KEY)||'[]');
    autoFoldedCases.current=new Set([...(Array.isArray(savedFoldIds)?savedFoldIds.filter((id:unknown):id is string=>typeof id==='string'):[]),...restored.filter(c=>c.nodes.length>0&&!c.intake).map(c=>c.id)]);
    if(!restored.length){const first=blank();setCases([first]);setActiveId(first.id)}
    else {setCases(restored);const id=localStorage.getItem(ACTIVE);if(id&&restored.some(item=>item.id===id))setActiveId(id);}
    const t=localStorage.getItem(THEMESTORE);if(t==='dark')setTheme('dark');
    setPreferredModel(localStorage.getItem('legal-preferred-model')||'');
  }catch{}setHydrated(true);
 },[]);
 useEffect(()=>{
  if(!new URLSearchParams(window.location.search).has('showcase'))return;
  const params=new URLSearchParams(window.location.search);
  const speed=params.get('showcaseTestSpeed')==='10'?0.1:1;
  const sceneName=params.get('showcaseScene');
  const scene=sceneName&&sceneName in SHOWCASE_SCENES?SHOWCASE_SCENES[sceneName as keyof typeof SHOWCASE_SCENES]:null;
  const pinned=params.get('showcaseStatic');
  const frozen=pinned!==null&&Number.isInteger(Number(pinned))&&Number(pinned)>=0&&Number(pinned)<SHOWCASE_DURATIONS.length;
  const first=frozen?Number(pinned):scene?.start??0;
  const last=scene?.end??SHOWCASE_DURATIONS.length-1;
  let stage=first;let remaining:number=SHOWCASE_DURATIONS[first]*speed;let started=0;
  let paused=frozen||window.parent!==window;let timeout:ReturnType<typeof setTimeout>|undefined;
  const apply=(next:number)=>{
   setShowcaseStage(next);setCases([showcaseCase(next)]);
   setInput(next===2?SHOWCASE_STORY:'');
   const target=next===13?'wage-request':next===14||next===15?'wage-labor':next===16?'scenario:wage-labor:step:0':next===17?'scenario:wage-labor:step:1':next===18?'scenario:wage-labor:step:2':next===19?'scenario:wage-labor:outcome:1':next>=20?'scenario:wage-labor:outcome:0':null;
   setSelected(target);setFocusId(target);setChatCollapsed(next>=12);setHistoryOpen(false);
   setBusy([3,6,9,11].includes(next));
   setAnalysisProgress({phase:next===11?'analyzing':'intake',message:next===11?'조건에 맞는 절차와 결과별 경로를 정리하고 있어요.':'답변을 바탕으로 필요한 확인 질문을 준비하고 있어요.'});
   if(window.parent!==window)window.parent.postMessage({type:'law-showcase:phase',phase:showcasePhase(next),stage:next},'*');
  };
  const schedule=()=>{
   if(paused)return;
   started=Date.now();
   timeout=setTimeout(()=>{stage=stage>=last?first:stage+1;remaining=SHOWCASE_DURATIONS[stage]*speed;apply(stage);schedule()},remaining);
  };
  const onMessage=(event:MessageEvent)=>{
   if(event.source!==window.parent)return;
   if(frozen)return;
   if(event.data==='law-showcase:pause'&&!paused){paused=true;clearTimeout(timeout);remaining=Math.max(0,remaining-(Date.now()-started))}
   if(event.data==='law-showcase:play'&&paused){paused=false;schedule()}
   if(event.data==='law-showcase:replay'){clearTimeout(timeout);stage=first;remaining=SHOWCASE_DURATIONS[first]*speed;apply(first);if(!paused)schedule()}
  };
  window.addEventListener('message',onMessage);
  apply(first);
  if(window.parent!==window)window.parent.postMessage({type:'law-showcase:ready'},'*');
  if(!paused)schedule();
  return()=>{clearTimeout(timeout);window.removeEventListener('message',onMessage)};
 },[]);
 useEffect(()=>{if(hydrated&&!captureMode.current)localStorage.setItem(STORE,JSON.stringify(cases))},[cases,hydrated]);
 useEffect(()=>{if(hydrated&&!captureMode.current)localStorage.setItem(PREVIEW_STORE,JSON.stringify(previewCase))},[previewCase,hydrated]);
 useEffect(()=>{if(hydrated&&!captureMode.current){activeId?localStorage.setItem(ACTIVE,activeId):localStorage.removeItem(ACTIVE)}},[activeId,hydrated]);
 useEffect(()=>{if(hydrated&&!captureMode.current)localStorage.setItem(THEMESTORE,theme)},[theme,hydrated]);
 useEffect(()=>{if(hydrated&&!captureMode.current&&preferredModel)localStorage.setItem('legal-preferred-model',preferredModel)},[preferredModel,hydrated]);
 useEffect(()=>{if(!active?.messages.length&&!busy)return;const list=bottomRef.current?.closest('.conversation-list');if(list)list.scrollTo({top:list.scrollHeight,behavior:'smooth'});},[activeId,active?.messages.length,busy]);
 useEffect(()=>{if(activeId==='portfolio-showcase')return;setSelected(null);setFocusId(null);setIntakeHintCaseId(null);setChatCollapsed(captureMode.current&&!new URLSearchParams(window.location.search).has('showcase'))},[activeId]);
 // Fold once per conversation only after the first completed map, never on provisional intake or later refreshes.
 useEffect(()=>{
   if(!hydrated||!active||busy||active.intake||!active.nodes.length||!active.messages.some(m=>m.role==='assistant'&&!m.error)||autoFoldedCases.current.has(active.id))return;
   autoFoldedCases.current.add(active.id);
   if(!captureMode.current)try{localStorage.setItem(AUTO_FOLD_KEY,JSON.stringify([...autoFoldedCases.current].slice(-100)))}catch{}
   if(window.matchMedia('(min-width: 861px)').matches)setChatCollapsed(true);
   else setMobileView('map');
 },[hydrated,active,busy]);
 const newCase=()=>{wageExampleArmedRef.current=false;setWageExampleArmed(false);const c={...blank(),modelId:chosenModelId||inventory?.defaultId||undefined};setCases(x=>[...x,c]);setActiveId(c.id);setChatCollapsed(false);setSelected(null);setInput('');setError('');setHistoryOpen(false);setMobileView('chat');inputRef.current?.focus()};
 const deleteCase=(id:string)=>{if(!busy)setDeleteTarget(id)};
 const closeTab=(id:string)=>{
  if(busy)return;
  const target=cases.find(c=>c.id===id);
  if(!target)return;
  const untouched=!target.messages.length&&!target.nodes.length&&!target.edges.length&&!target.facts.length&&!target.sources.length&&!target.intake;
  const hasDraft=activeId===id&&input.trim().length>0;
  if(!untouched||hasDraft){deleteCase(id);return}
  const index=cases.findIndex(c=>c.id===id);
  setCases(items=>items.filter(c=>c.id!==id));
  if(activeId===id){setActiveId(cases[index+1]?.id||cases[index-1]?.id||null);setInput('')}
  setDeleteTarget(null);
 };
 const confirmDelete=()=>{if(!deleteValue)return;const index=cases.findIndex(c=>c.id===deleteValue.id);setCases(x=>x.filter(c=>c.id!==deleteValue.id));if(activeId===deleteValue.id)setActiveId(cases[index+1]?.id||cases[index-1]?.id||null);setDeleteTarget(null)};
 const chooseModel=(id:string)=>{setPreferredModel(id);setSelected(null);if(active)setCases(values=>values.map(c=>c.id===active.id?{...c,modelId:id}:c))};
 const startStep=async(id:string)=>{
  const node=mapCase.nodes.find(n=>n.id===id);
  const route=current.nodes.find(n=>n.id===(node?.scenarioParentId||id));
  if(!route||busy||route.status==='unavailable')return;
  const snapshot=current;const key=snapshot.id+':'+id;
  const requestKey=snapshot.id+':'+route.id;
  if(proceedRequests.current.has(requestKey))return;
  proceedRequests.current.add(requestKey);setProceedErrors(v=>({...v,[key]:''}));
  try{
   let scenario=route.scenario;
   if(!scenario?.steps.length){
    setLoadingProceed(v=>({...v,[key]:true}));
    const response=await fetch('/api/step-details',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({case:snapshot,id:route.id,purpose:'procedure'})});
    const payload=await response.json();if(!response.ok)throw new Error(payload.error||'다음 절차를 불러오지 못했어요.');
    scenario=payload.node?.scenario;
    if(!scenario?.steps.length||scenario.steps.some(step=>!step.title?.trim()||!step.description?.trim()))throw new Error('다음 절차를 확인하지 못했어요. 다시 시도해 주세요.');
   }
   const procedure=scenario;
   const update=(value:LegalCase)=>{
    if(value.id!==snapshot.id||value.messages.length!==snapshot.messages.length||!value.nodes.some(n=>n.id===route.id&&n.description===route.description))return value;
    const prepared={...value,nodes:value.nodes.map(n=>n.id===route.id&&!n.scenario?.steps.length?{...n,scenario:procedure,scenarioRevealed:0}:n)};
    return advanceStep(prepared,id);
   };
   // Functional updates preserve document responses and other edits arriving in flight.
   if(active)setCases(items=>items.map(update));else setPreviewCase(update);
   const count=revealedCount(route);
   const nextId='scenario:'+route.id+(count<procedure.steps.length?':step:'+count:':outcome:0');
   // 새 절차를 연 뒤 우측 상세 패널도 해당 카드로 유지합니다.
   setFocusId(nextId);
   setSelected(nextId);
  }catch(error){setProceedErrors(v=>({...v,[key]:error instanceof Error?error.message:'다음 절차를 불러오지 못했어요.'}))}
  finally{proceedRequests.current.delete(requestKey);setLoadingProceed(v=>({...v,[key]:false}))}
 };
 // Kept separate for explicit completion actions; the red explore button never calls it.
 const finishStep=(id:string)=>{if(active)setCases(items=>items.map(value=>value.id===current.id?completeStep(value,id):value));else setPreviewCase(value=>completeStep(value,id))};
 const chooseStep=(_from:string,id:string)=>{setSelected(id);void startStep(id)};
 const submit=useCallback(async(value?:string,refresh=false,modelOverride?:string,snapshotOverride?:LegalCase,recordUserMessage=true)=>{
   const previous=snapshotOverride||active;
   const latestUser=previous?.messages.filter(m=>m.role==='user').slice(-1)[0]?.content;
   const message=(refresh?(latestUser||'현재 상황과 진행 상태를 바탕으로 선택지를 다시 정리해 주세요.'):(value??input)).trim();if(!message||busyRef.current)return;
   // Only the specifically clicked welcome example is precomputed; typed cases keep the AI route.
   if(!refresh&&wageExampleArmedRef.current&&message===SHOWCASE_STORY&&!previous?.messages.length&&!previous?.intake){
     wageExampleArmedRef.current=false;setWageExampleArmed(false);
     const controller=new AbortController();const version=++requestVersion.current;
     requestAbort.current=controller;busyRef.current=true;setBusy(true);
     setAnalysisProgress({phase:'intake',message:'미리 준비한 사례의 확인 질문을 불러오고 있어요.'});
     setInput('');setSelected(null);setError('');
     const createdAt=new Date().toISOString();
     const caseId=previous?.id||crypto.randomUUID();
     const start:LegalCase={...(previous||blank()),id:caseId,demo:true,examplePreset:'wage-fast',name:'퇴사 후 임금체불 · 예시',updatedAt:createdAt,
       messages:[{id:crypto.randomUUID(),role:'user',content:message,createdAt}],nodes:[],edges:[],facts:[],sources:[],intake:undefined};
     setCases(items=>items.some(c=>c.id===caseId)?items.map(c=>c.id===caseId?start:c):[...items,start]);
     setActiveId(caseId);
     try{
       await waitWageExample(controller.signal);
       if(requestVersion.current!==version||controller.signal.aborted)return;
       const plan=wageExamplePlan();
       setCases(items=>items.map(c=>c.id===caseId?{...c,intake:plan,...previewIntake(plan)}:c));
     }catch{
       if(requestVersion.current===version)setCases(items=>items.map(c=>c.id===caseId?{...c,messages:[...c.messages,{id:crypto.randomUUID(),role:'assistant',content:'요청을 멈췄어요. 예시를 다시 시작할 수 있어요.',createdAt:new Date().toISOString()}]}:c));
     }finally{
       if(requestAbort.current===controller){requestAbort.current=null;busyRef.current=false;setBusy(false)}
     }
     return;
   }
   const effectiveModelId=modelOverride&&inventory?.models.some(model=>model.id===modelOverride&&model.available)?modelOverride:chosenModelId;
   const effectiveModel=inventory?.models.find(model=>model.id===effectiveModelId);
   if(!effectiveModel?.available){setSettingsOpen(true);return}
   const controller=new AbortController();const version=++requestVersion.current;requestAbort.current=controller;busyRef.current=true;
   setAnalysisProgress({phase:'analyzing',message:'이야기를 읽고 가능한 방법을 정리하고 있어요.'});
   setBusy(true);setSelected(null);setError('');if(!refresh)setInput('');
   const firstIntake=!refresh&&!snapshotOverride&&!previous?.intake&&!previous?.messages.some(m=>m.role==='user')&&!previous?.nodes.length;
   const base={...(previous||blank()),modelId:effectiveModelId};
   const userMsg:Message={id:crypto.randomUUID(),role:'user',content:message,createdAt:new Date().toISOString()};
   const lastMessage=base.messages[base.messages.length-1];
   const retryMessages=refresh&&lastMessage?.role==='assistant'&&lastMessage.error?base.messages.slice(0,-1):base.messages;
   const baseWithMessage={...base,name:base.messages.length?shortCaseTitle(base.name):summarizeCaseTitle(message),updatedAt:new Date().toISOString(),messages:refresh?retryMessages:recordUserMessage?[...base.messages,userMsg]:base.messages};
   setCases(x=>x.some(c=>c.id===base.id)?x.map(c=>c.id===base.id?baseWithMessage:c):[...x,baseWithMessage]);
   setActiveId(base.id);
   try{
     if(firstIntake){
       setAnalysisProgress({phase:'intake',message:'답변에 따라 달라지는 조건을 먼저 찾고 있어요.'});
       const response=await fetch('/api/intake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,modelId:effectiveModelId}),signal:controller.signal});
       if(!response.ok)throw new Error('확인 질문을 준비하지 못했어요. 다시 시도해 주세요.');
       const data=await response.json();
       if(controller.signal.aborted||requestVersion.current!==version)return;
       const plan: IntakePlan=data.plan;
       const partial=previewIntake(plan);
       setCases(x=>x.map(c=>c.id===base.id?{...c,intake:plan,...partial,updatedAt:new Date().toISOString()}:c));
       return;
     }
     const analysisPrevious=previous?.intake?{...previous,nodes:[],edges:[],facts:[]}:previous;
     const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,previous:analysisPrevious,refresh,modelId:effectiveModelId,stream:true}),signal:controller.signal});
     if(!response.ok){const failure=await response.json().catch(()=>({}));throw new Error(failure.error||'응답을 받지 못했어요.')}
     let payload:any=null;
     await readAnalysisStream(response,event=>{if(controller.signal.aborted||requestVersion.current!==version)return;if(event.type==='status')setAnalysisProgress(event);else if(event.type==='result')payload=event;else if(event.type==='error')throw new Error(event.error)});
     if(controller.signal.aborted||requestVersion.current!==version)return;
     if(!payload?.result)throw new Error('응답 연결이 끊겼어요. 다시 시도해주세요.');
     const result:LegalAnswer=reconcileIntakeResult(payload.result,previous);
     const assistantMsg:Message={id:crypto.randomUUID(),role:'assistant',content:result.answer,options:result.options,
       nextAction:result.nextAction,question:result.question,followUpQuestions:result.followUpQuestions,verified:false,createdAt:new Date().toISOString()};
     const freshSources:LegalSource[]=Array.isArray(payload.sources)?payload.sources:[];
     const sources=Array.from(new Map([...(previous?.sources||[]),...freshSources].map(s=>[s.id,s])).values());
     const facts=Array.from(new Set([...(previous?.facts||[]),...result.facts])).slice(0,30);
     setCases(x=>x.map(c=>c.id===base.id?{...c,intake:undefined,modelId:payload.modelUsed||effectiveModelId,name:summarizeCaseTitle(result.title||c.name),messages:[...c.messages,assistantMsg],facts,
       nodes:result.nodes,edges:result.edges,sources,openQuestions:result.openQuestions||[],analysisVersion:payload.analysisVersion||0,evidenceStatus:payload.evidenceStatus||'unverified',
       lastChecked:payload.checkedAt||undefined,updatedAt:new Date().toISOString()}:c));
   }catch(e){
     if(requestVersion.current!==version)return;
     const cancelled=controller.signal.aborted;
     const msg=cancelled?'요청을 멈췄어요. 대화와 기존 지도는 그대로 남아 있어요.':e instanceof Error?e.message:'연결 오류가 발생했어요.';
     setCases(x=>x.map(c=>c.id===base.id?{...c,messages:[...c.messages,{id:crypto.randomUUID(),role:'assistant',content:msg,error:!cancelled,createdAt:new Date().toISOString()}]}:c));
   }finally{if(requestAbort.current===controller){requestAbort.current=null;busyRef.current=false;setBusy(false)}}
 },[active,input,busy,chosenModelId,inventory]);
 const acceptIntakeAnswer=async(answer:IntakeAnswer)=>{
   if(!active?.intake||busy||busyRef.current)return;
   const originalCase=active;
   const recorded=recordIntakeAnswer(active,answer);
   if(!recorded?.intake)return;
   const plan=recorded.intake;
   if(active.examplePreset==='wage-fast'){
     const nextPlan=nextWageExamplePlan(plan);
     const next:LegalCase={...recorded,intake:nextPlan,...previewIntake(nextPlan)};
     const controller=new AbortController();const version=++requestVersion.current;
     requestAbort.current=controller;busyRef.current=true;setBusy(true);setError('');
     setAnalysisProgress({phase:nextPlan.answers.length>=3?'analyzing':'intake',
       message:nextPlan.answers.length>=3?'선택한 조건에 맞는 사전 구성 경로를 정리하고 있어요.':'다음 질문과 분기 조건을 준비하고 있어요.'});
     setIntakeHintCaseId(null);
     setCases(items=>items.map(c=>c.id===active.id?next:c));
     try{
       await waitWageExample(controller.signal);
       if(requestVersion.current!==version||controller.signal.aborted)return;
       if(nextPlan.answers.length>=nextPlan.questions.length){
         const result=wageExampleResult(nextPlan);
         const assistantMsg:Message={id:crypto.randomUUID(),role:'assistant',content:result.reply,createdAt:new Date().toISOString()};
         setCases(items=>items.map(c=>c.id===active.id?{...c,...result,intake:undefined,messages:[...next.messages,assistantMsg],updatedAt:new Date().toISOString()}:c));
       }else{
         setCases(items=>items.map(c=>c.id===active.id?{...c,intake:nextPlan,...previewIntake(nextPlan)}:c));
       }
     }catch{
       if(requestVersion.current===version)setCases(items=>items.map(c=>c.id===active.id?active:c));
     }finally{
       if(requestAbort.current===controller){requestAbort.current=null;busyRef.current=false;setBusy(false)}
     }
     return;
   }
   const next:LegalCase={...recorded,...previewIntake(plan)};
   setIntakeHintCaseId(null);
   setCases(items=>items.map(c=>c.id===active.id?next:c));
   // A third answer completes the interview without an extra LLM round-trip.
   if(plan.answers.length>=3){void submit(intakeSummary(plan),false,undefined,next,false);return}
   const controller=new AbortController();const version=++requestVersion.current;
   requestAbort.current=controller;busyRef.current=true;setBusy(true);
   setAnalysisProgress({phase:'intake',message:'방금 알려주신 내용을 토대로 다음 핵심 쟁점을 살펴보고 있어요.'});
   try{
     const response=await fetch('/api/intake',{method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({message:plan.original,plan,modelId:chosenModelId}),signal:controller.signal});
     const payload=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(payload.error||'다음 질문을 불러오지 못했어요.');
     if(controller.signal.aborted||requestVersion.current!==version)return;
     const updatedPlan: IntakePlan=payload.plan;
     const updated:LegalCase={...next,intake:updatedPlan,...previewIntake(updatedPlan),updatedAt:new Date().toISOString()};
     setCases(items=>items.map(c=>c.id===next.id?updated:c));
     if(updatedPlan.complete){
       requestAbort.current=null;busyRef.current=false;setBusy(false);
       void submit(intakeSummary(updatedPlan),false,undefined,updated,false);
       return;
     }
   }catch(e){
     if(requestVersion.current!==version)return;
     setCases(items=>items.map(c=>c.id===originalCase.id?{...originalCase,messages:next.messages}:c));
     if(!controller.signal.aborted)setError(e instanceof Error?e.message:'질문을 불러오지 못했어요. 다시 답변해주세요.');
   }finally{
     if(requestAbort.current===controller){requestAbort.current=null;busyRef.current=false;setBusy(false)}
   }
 };
 const alternativeModel=inventory?.models.filter(model=>model.available&&model.id!==chosenModelId).sort((a,b)=>Number(a.provider===chosenModel?.provider)-Number(b.provider===chosenModel?.provider)||Number(b.provider==='openrouter')-Number(a.provider==='openrouter'))[0];
 const retryWithAlternative=()=>{if(!alternativeModel)return;setPreferredModel(alternativeModel.id);if(active)setCases(values=>values.map(value=>value.id===active.id?{...value,modelId:alternativeModel.id}:value));void submit(undefined,true,alternativeModel.id)};
 const example=()=>{setSelected(null);setHistoryOpen(false);setActiveId(null);if(captureMode.current){setPreviewCase(structuredClone(demo));setFocusId(null);setChatCollapsed(true)}};
 const fillInput=(text:string)=>{const armed=text===SHOWCASE_STORY&&!active?.messages.length;wageExampleArmedRef.current=armed;setWageExampleArmed(armed);setInput(text);setSelected(null);setChatCollapsed(false);setMobileView('chat');requestAnimationFrame(()=>inputRef.current?.focus())};
 const changeInput=(text:string)=>{wageExampleArmedRef.current=false;setWageExampleArmed(false);setInput(text)};
 const done=current.nodes.filter(n=>n.status==='done');
 const completedSummary=`완료한 절차 ${done.length}개`;
 const activatedRoutes=current.nodes.filter(n=>n.kind==='route'&&n.userConfirmed&&n.scenario);
 const focusedRoute=activatedRoutes.find(n=>(selected||focusId)===n.id||(selected||focusId)?.startsWith('scenario:'+n.id+':'))||activatedRoutes.find(n=>n.status==='current')||activatedRoutes[0];
 const flowIds=focusedRoute?[focusedRoute.id,...expanded.nodes.filter(n=>n.scenarioParentId===focusedRoute.id&&n.kind==='step').map(n=>n.id),...expanded.nodes.filter(n=>n.scenarioParentId===focusedRoute.id&&n.kind==='outcome').map(n=>n.id)]:[];
 const flowPosition=Math.max(0,flowIds.indexOf(selected||focusId||''));
 const focusFlow=(direction:number)=>{const id=flowIds[flowPosition+direction];if(id){setSelected(null);setFocusId(id)}};
 const sorted=useMemo(()=>[...cases].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt)),[cases]);
 const mapStatusText=active?.intake&&intakeHintCaseId===current.id
  ?'질문에 모두 답하면 각 경로의 절차를 확인할 수 있어요.'
  :busy
  ?analysisProgress.phase==='intake'?(current.nodes.length?'새로운 답변을 바탕으로 다음 내용을 살펴보고 있어요':'말씀해 주신 상황을 살펴보고 있어요')
   :analysisProgress.phase==='sources'?'관련 법률 근거를 확인하고 있어요'
   :analysisProgress.phase==='reviewing'?'선택할 수 있는 방법과 후속 절차를 정리하고 있어요'
   :analysisProgress.phase==='formatting'?'확인한 내용을 흐름도에 반영하고 있어요'
   :current.nodes.length?'새로운 답변을 흐름도에 반영하고 있어요':'가능한 대응 방법을 정리하고 있어요'
  :active?.messages.at(-1)?.error?'흐름도 갱신이 중단됐어요. 대화에서 다시 시도할 수 있어요'
  :active?.intake?'대화의 확인 질문에 답하면 다음 절차가 구체화돼요'
  :'현재까지 확인한 내용을 흐름도에 반영했어요';
 const continueMapConversation=()=>{
   setChatCollapsed(false);
   setMobileView('chat');
   requestAnimationFrame(()=>{
     const selector=active?.messages.at(-1)?.error?'.chat-row.assistant:last-of-type .retry-answer':'.intake-card button, .intake-card textarea';
     const target=document.querySelector<HTMLElement>(selector);
     if(target){target.scrollIntoView({block:'center'});target.focus({preventScroll:true})}
     else{bottomRef.current?.scrollIntoView({block:'end'});inputRef.current?.focus()}
   });
 };
 return {showcaseStage,wageExampleArmed,changeInput,mobile,cases,setCases,activeId,setActiveId,theme,setTheme,historyOpen,setHistoryOpen,sourcesOpen,setSourcesOpen,selected:resolvedSelected,setSelected,focusId,setFocusId,input,setInput,mobileView,setMobileView,chatCollapsed,setChatCollapsed,busy,error,setError,inventory,settingsOpen,setSettingsOpen,analysisProgress,requestAbort,bottomRef,inputRef,active,current,chosen,chosenModelId,chosenModel,deleteValue,loadingDetails,detailErrors,detailKey,loadDetails,loadingProceed,proceedErrors,mapCase,sorted,hasMessages,alternativeModel,newCase,deleteCase,closeTab,confirmDelete,setDeleteTarget,applyInventory,chooseModel,example,fillInput,submit,acceptIntakeAnswer,retryWithAlternative,startStep,finishStep,chooseStep,selectNode,done,completedSummary,mapStatusText,continueMapConversation,flowIds,flowPosition,focusFlow};
}
