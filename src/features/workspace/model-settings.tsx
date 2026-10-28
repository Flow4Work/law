'use client';

import {useEffect,useRef,useState,type KeyboardEvent} from 'react';
import {ArrowLeft,ArrowRight,Check,ChevronDown,ChevronUp,CircleCheck,KeyRound,Layers3,LoaderCircle,Plus,RefreshCw,Search,Server,ShieldCheck,Trash2,X} from 'lucide-react';
import type {ModelInventory,ModelChoice} from '@/lib/model-types';
import {providerName} from '@/lib/model-selection';

type Props={
 inventory:ModelInventory|null;
 currentModelId?:string;
 initialProvider?:string;
 onClose:()=>void;
 onChanged:(inventory:ModelInventory,id?:string)=>void;
};
type CatalogModel={id:string;name:string};
type Tab='select'|'add'|'manage';
type Mode='reuse'|'new';
type Action='refresh'|'catalog'|'save'|'delete'|null;
const services=[
 {id:'openrouter',label:'OpenRouter',caption:'다양한 AI 모델'},
 {id:'glm',label:'GLM / Z.AI',caption:'GLM 공식 API'},
 {id:'gemini',label:'Google Gemini',caption:'Google AI Studio'},
 {id:'opencode',label:'OpenCode',caption:'OpenCode 모델'},
 {id:'bai',label:'B.AI',caption:'B.AI 클라우드'},
 {id:'local',label:'로컬 서버',caption:'Ollama · LM Studio'},
 {id:'custom',label:'다른 API',caption:'OpenAI 호환 API'}
];
const getUrl=(provider:string)=>provider==='openrouter'?'https://openrouter.ai/api/v1':provider==='bai'?'https://api.b.ai/v1':provider==='glm'?'https://api.z.ai/api/paas/v4':provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/openai':provider==='opencode'?'https://opencode.ai/inference/openai/v1':provider==='local'?'http://127.0.0.1:11434/v1':'';
const connectionRoot=(value:ModelChoice)=>value.id.replace(/:(?:high|low|flash)$/,'');
function arrowKeys(event:KeyboardEvent<HTMLDivElement>){
 if(!['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(event.key))return;
 const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
 if(!buttons.length)return;
 const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
 const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:['ArrowRight','ArrowDown'].includes(event.key)?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;
 event.preventDefault();buttons[next].focus();buttons[next].click();
}
function Pages({page,total,onPage}:{page:number;total:number;onPage:(n:number)=>void}){
 if(total<=1)return <span className="lm-pages-empty"/>;
 return <nav className="lm-pages" aria-label="목록 페이지">
  <button type="button" aria-label="이전 페이지" disabled={page===0} onClick={()=>onPage(page-1)}><ArrowLeft size={16}/></button>
  <span>{page+1}<em> / {total}</em></span>
  <button type="button" aria-label="다음 페이지" disabled={page>=total-1} onClick={()=>onPage(page+1)}><ArrowRight size={16}/></button>
 </nav>;
}

export function ModelSettings({inventory,currentModelId,initialProvider,onClose,onChanged}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 const modelListRef=useRef<HTMLDivElement>(null);
 const readOnly=inventory?.readOnly===true;
 const [tab,setTab]=useState<Tab>(inventory?.readOnly||inventory?.models.length?'select':'add');
 const [mode,setMode]=useState<Mode>('new');
 const [provider,setProvider]=useState(initialProvider||'openrouter');
 const [baseUrl,setBaseUrl]=useState(getUrl(initialProvider||'openrouter'));
 const [apiKey,setApiKey]=useState('');
 const [connectionId,setConnectionId]=useState('');
 const [replaceId,setReplaceId]=useState('');
 const [editingId,setEditingId]=useState('');
 const [catalog,setCatalog]=useState<CatalogModel[]>([]);
 const [catalogLoaded,setCatalogLoaded]=useState(false);
 const [catalogSearch,setCatalogSearch]=useState('');
 const [selectedCatalog,setSelectedCatalog]=useState('');
 const [search,setSearch]=useState('');
 const [candidate,setCandidate]=useState(currentModelId||'');
 const [catalogPage,setCatalogPage]=useState(0);
 const [connectionPage,setConnectionPage]=useState(0);
 const [managePage,setManagePage]=useState(0);
 const [expandedConnection,setExpandedConnection]=useState('');
 const [connectionCatalog,setConnectionCatalog]=useState<Record<string,CatalogModel[]>>({});
 const [connectionSearch,setConnectionSearch]=useState('');
 const [connectionSelected,setConnectionSelected]=useState('');
 const [connectionLoading,setConnectionLoading]=useState('');
 const [action,setAction]=useState<Action>(null);
 const [notice,setNotice]=useState('');
 const [error,setError]=useState('');
 const [testing,setTesting]=useState<string|null>(null);
 const [testResults,setTestResults]=useState<Record<string,string>>({});
 const [deletePending,setDeletePending]=useState('');
 const [modelDeletePending,setModelDeletePending]=useState('');

 const models=inventory?.models||[];
 const current=models.find(m=>m.id===currentModelId)||models.find(m=>m.id===inventory?.defaultId)||models[0];
 const manageConnections=Array.from(new Map(models.map(m=>[connectionRoot(m),m])).values());
 const connections=manageConnections.filter(m=>m.available);
 const chosenConnection=connections.find(m=>connectionRoot(m)===connectionId)||connections[0];
 const isReuse=mode==='reuse'&&Boolean(chosenConnection);
 const availableCount=models.filter(m=>m.available).length;
 const filteredModels=models.filter(m=>(m.name+' '+m.model+' '+providerName(m.provider)).toLowerCase().includes(search.trim().toLowerCase()))
  .sort((a,b)=>Number(b.id===current?.id)-Number(a.id===current?.id));
 const filteredCatalog=catalog.filter(m=>(m.name+' '+m.id).toLowerCase().includes(catalogSearch.trim().toLowerCase()));
 const catalogPageCount=Math.max(1,Math.ceil(filteredCatalog.length/4));
 const showingCatalog=filteredCatalog.slice(0,80);
 const connectionPageCount=Math.max(1,Math.ceil(connections.length/4));
 const showingConnections=connections.slice(connectionPage*4,(connectionPage+1)*4);
 const managePageCount=Math.max(1,Math.ceil(manageConnections.length/4));
 const showingManaged=manageConnections;

 useEffect(()=>{const target=dialog.current;target?.showModal();return()=>target?.close()},[]);
 useEffect(()=>{if(readOnly)setTab('select')},[readOnly]);
 useEffect(()=>{setCandidate(currentModelId||'')},[currentModelId]);
 useEffect(()=>{setCatalogPage(v=>Math.min(v,catalogPageCount-1))},[catalogPageCount]);
 useEffect(()=>{setConnectionPage(v=>Math.min(v,connectionPageCount-1))},[connectionPageCount]);
 useEffect(()=>{setManagePage(v=>Math.min(v,managePageCount-1))},[managePageCount]);
 const resetCatalog=()=>{setCatalog([]);setCatalogLoaded(false);setSelectedCatalog('');setCatalogSearch('');setCatalogPage(0);setError('');setNotice('')};
 const swapMode=(next:Mode)=>{setMode(next);setReplaceId('');setEditingId('');resetCatalog()};
 const swapProvider=(next:string)=>{setProvider(next);setBaseUrl(getUrl(next));setApiKey('');resetCatalog()};
 const swapTab=(next:Tab)=>{setTab(next);setError('');setNotice('');setDeletePending('');setModelDeletePending('');setExpandedConnection('')};
 const switchConnection=async(model:ModelChoice)=>{
  const root=connectionRoot(model);
  if(expandedConnection===root){setExpandedConnection('');return}
  setExpandedConnection(root);setConnectionSearch('');setConnectionSelected(model.model);setError('');setNotice('');
  if(connectionCatalog[root])return;
  setConnectionLoading(root);
  try{
   const response=await fetch('/api/models/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionId:model.id})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'모델 목록을 불러오지 못했습니다.');
   setConnectionCatalog(prev=>({...prev,[root]:Array.isArray(data.models)?data.models:[]}));
  }catch(e){setError(e instanceof Error?e.message:'모델 목록을 불러오지 못했습니다.');setExpandedConnection('')}
  finally{setConnectionLoading('')}
 };
 const confirmConnection=async(model:ModelChoice)=>{
  if(!connectionSelected)return;
  const root=connectionRoot(model);
  setAction('save');setError('');setNotice('');
  try{
   const entry=(connectionCatalog[root]||[]).find(item=>item.id===connectionSelected);
   if(!entry)throw new Error('목록에서 모델을 선택해주세요.');
   const response=await fetch('/api/models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionId:model.id,model:entry.id,name:entry.name,...(root.startsWith('saved:')?{replaceId:root}:{})})});
   const data:ModelInventory&{id?:string;error?:string}=await response.json();
   if(!response.ok)throw new Error(data.error||'모델을 변경하지 못했습니다.');
   const match=data.models.find(item=>(item.id===data.id||item.id.startsWith(data.id+':'))&&item.model===entry.id);
   onChanged(data,match?.id||data.id);
   setCandidate(match?.id||data.id||'');setExpandedConnection('');setConnectionCatalog(prev=>{const copy={...prev};delete copy[root];return copy});
   setNotice('선택한 모델로 변경했습니다.');
  }catch(e){setError(e instanceof Error?e.message:'모델 변경 실패')}
  finally{setAction(null)}
 };
 const refresh=async()=>{
  setAction('refresh');setError('');setNotice('');
  try{
   const response=await fetch('/api/models?refresh=1',{cache:'no-store'});
   if(!response.ok)throw new Error('모델 목록을 새로 확인하지 못했습니다.');
   const data:ModelInventory=await response.json();onChanged(data);setNotice('연결 상태를 새로 확인했습니다.');
  }catch(e){setError(e instanceof Error?e.message:'연결 확인 실패')}
  finally{setAction(null)}
 };
 const fetchCatalog=async()=>{
  setAction('catalog');resetCatalog();
  try{
   const payload=isReuse?{connectionId:chosenConnection.id}:{provider,baseUrl,key:apiKey};
   const response=await fetch('/api/models/catalog',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'모델 목록을 가져오지 못했습니다.');
   const fetched:CatalogModel[]=Array.isArray(data.models)?data.models:[];
   setCatalog(fetched);setCatalogLoaded(true);
   if(!fetched.length)setNotice('이 연결에서 제공하는 모델이 없습니다.');
  }catch(e){setError(e instanceof Error?e.message:'모델 목록을 불러오지 못했습니다.')}
  finally{setAction(null)}
 };
 const save=async()=>{
  if(!selectedCatalog)return;
  setAction('save');setError('');setNotice('');
  try{
   const activeProvider=isReuse?chosenConnection.provider:provider;
   const prefix=activeProvider==='bai'?'B.AI · ':activeProvider==='openrouter'?'OpenRouter · ':activeProvider==='local'?'로컬 · ':activeProvider==='opencode'?'OpenCode · ':'';
   const chosen=catalog.find(m=>m.id===selectedCatalog);
   const name=prefix+(chosen?.name||selectedCatalog);
   const payload=isReuse?{connectionId:chosenConnection.id,model:selectedCatalog,name,...(replaceId?{replaceId}:{})}:{provider,baseUrl,key:apiKey,model:selectedCatalog,name};
   const response=await fetch('/api/models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'모델을 저장하지 못했습니다.');
   const match=data.models?.find((m:ModelChoice)=>m.id===data.id||(m.id.startsWith(data.id+':')&&m.model===selectedCatalog));
   onChanged(data,match?.id||data.id);
   setCandidate(match?.id||data.id);setApiKey('');setReplaceId('');setEditingId('');resetCatalog();setTab('select');
   setNotice('모델을 추가하고 적용했습니다.');
  }catch(e){setError(e instanceof Error?e.message:'모델 저장 실패')}
  finally{setAction(null)}
 };
 const remove=async(model:ModelChoice)=>{
  const id=connectionRoot(model);
  setAction('delete');setError('');setNotice('');
  try{
   const response=await fetch('/api/models',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({connectionId:id})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'연결을 삭제하지 못했습니다.');
   onChanged(data);setDeletePending('');
   if(connectionId===id){setConnectionId('');setReplaceId('');setEditingId('');resetCatalog()}
   if(candidate===model.id)setCandidate('');
   setNotice('선택한 연결을 목록에서 삭제했습니다.');
  }catch(e){setError(e instanceof Error?e.message:'연결 삭제 실패')}
  finally{setAction(null)}
 };
 const removeModel=async(model:ModelChoice)=>{
  setAction('delete');setError('');setNotice('');
  try{
   const response=await fetch('/api/models',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({modelId:model.id})});
   const data:ModelInventory & {error?:string}=await response.json();
   if(!response.ok)throw new Error(data.error||'모델을 삭제하지 못했습니다.');
   const remaining=data.models.some(m=>m.id===candidate&&m.available);
   onChanged(data);
   if(!remaining)setCandidate(data.models.find(m=>m.id===data.defaultId)?.id||data.models.find(m=>m.available)?.id||'');
   setModelDeletePending('');
   setNotice('선택한 모델을 목록에서 삭제했습니다.');
  }catch(e){setError(e instanceof Error?e.message:'모델 삭제 실패')}
  finally{setAction(null)}
 };
 const test=async(id:string)=>{
  setTesting(id);setTestResults(v=>({...v,[id]:''}));
  try{
   const response=await fetch('/api/models/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({modelId:id})});
   const data=await response.json();
   setTestResults(v=>({...v,[id]:response.ok?'짧은 API 응답 정상 · 긴 분석은 별도 제한될 수 있어요.':data.error||'응답이 없습니다.'}));
  }catch{setTestResults(v=>({...v,[id]:'연결을 확인하지 못했습니다.'}))}
  finally{setTesting(null)}
 };
 const confirmSelection=()=>{
  if(!inventory||!models.some(m=>m.id===candidate&&m.available))return;
  onChanged(inventory,candidate);onClose();
 };
 return <dialog ref={dialog} className="model-dialog lm-dialog" aria-labelledby="lm-title" onCancel={e=>{e.preventDefault();onClose()}} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="lm-header">
   <div className="lm-heading"><span className="lm-mark"><Layers3 size={20}/></span><div><h2 id="lm-title">AI 모델 설정</h2><p>{readOnly?'등록된 모델 중 사용할 모델을 선택하세요.':'모델 선택, 변경, API 연결을 관리합니다.'}</p></div></div>
   <button type="button" className="lm-close" aria-label="설정 닫기" onClick={onClose}><X size={19}/></button>
  </div>
  <div className="lm-tabs" role="tablist" aria-label="모델 설정 메뉴" onKeyDown={arrowKeys}>
   <button type="button" id="lm-tab-select" role="tab" aria-controls="lm-panel-select" aria-selected={tab==='select'} tabIndex={tab==='select'?0:-1} disabled={action!==null} onClick={()=>swapTab('select')}>모델 선택 <span>{models.length}</span></button>
   {!readOnly&&<button type="button" id="lm-tab-manage" role="tab" aria-controls="lm-panel-manage" aria-selected={tab!=='select'} tabIndex={tab!=='select'?0:-1} disabled={action!==null} onClick={()=>swapTab('manage')}>API 연결 <span>{manageConnections.length}</span></button>}
  </div>
  <div className="lm-body">
   {readOnly&&<p className="lm-notification">AI 연결은 운영자가 관리해요. 모델 선택은 이 브라우저에만 적용돼요.</p>}
   {error&&<p role="alert" className="lm-notification lm-error">{error}</p>}
   {notice&&<p role="status" className="lm-notification"><CircleCheck size={15}/>{notice}</p>}
   {tab==='select'?<section className="lm-choose" id="lm-panel-select" role="tabpanel" aria-labelledby="lm-tab-select">
    <div className="lm-active">
     <div className="lm-active-icon"><Check size={17}/></div>
     <div className="lm-active-copy"><span>현재 사용 중인 모델</span><strong>{current?.name||'연결된 모델 없음'}</strong><small>{current?providerName(current.provider):'먼저 모델을 연결해주세요.'}</small></div>
     <button type="button" onClick={refresh} disabled={action!==null} className="lm-outline-btn"><RefreshCw size={15} className={action==='refresh'?'spin':''}/> 연결 확인</button>
    </div>
    <div className="lm-list-heading"><strong>모델 선택 <span>{availableCount}개 사용 가능 · 선택 후 확인</span></strong></div>
    <label className="lm-search"><Search size={17}/><input type="search" aria-label="모델 검색" placeholder="모델 이름이나 서비스로 검색" value={search} onChange={e=>{setSearch(e.target.value);modelListRef.current?.scrollTo({top:0})}}/></label>
    {filteredModels.length?<div ref={modelListRef} className="lm-model-grid" role="radiogroup" aria-label="사용할 모델">
     {filteredModels.map(m=><article className={'lm-model '+(m.id===candidate?'lm-model-current':'')+(!m.available?' lm-model-disabled':'')} key={m.id}>
      <button type="button" className="lm-model-choice" role="radio" disabled={!m.available||action!==null} aria-checked={m.id===candidate} onClick={()=>setCandidate(m.id)}>
       <span className="lm-indicator">{m.id===candidate&&<Check size={12}/>}</span>
       <span className="lm-model-info"><strong title={m.name}>{m.name}</strong><small title={m.model}>{providerName(m.provider)} · {m.model}</small></span>
       {m.id===current?.id&&<span className="lm-in-use">사용 중</span>}
      </button>
      <button type="button" className="lm-test" disabled={!m.available||action!==null||testing!==null} aria-label={m.name+' 응답 확인'} title="모델 응답 확인" onClick={()=>test(m.id)}>{testing===m.id?<LoaderCircle className="spin" size={15}/>:<RefreshCw size={15}/>}</button>
      {!readOnly&&<button type="button" className="lm-model-remove" disabled={action!==null} aria-label={m.name+' 모델 삭제'} title="모델 삭제" onClick={()=>{setModelDeletePending(m.id);setError('');setNotice('')}}><Trash2 size={15}/></button>}
      {testResults[m.id]&&<div className={'lm-test-result '+(testResults[m.id].startsWith('짧은 API 응답 정상')?'lm-test-ok':'')} role="status">{testResults[m.id]}</div>}
      {!m.available&&m.reason&&<div className="lm-test-result" role="status">{m.reason}</div>}
      {modelDeletePending===m.id&&<div className="lm-model-delete-confirm" role="group" aria-label={m.name+' 삭제 확인'}>
       <span>이 모델을 목록에서 삭제할까요?</span>
       <button type="button" disabled={action!==null} onClick={()=>setModelDeletePending('')}>취소</button>
       <button type="button" className="lm-danger-confirm" disabled={action!==null} onClick={()=>removeModel(m)}>{action==='delete'?'삭제 중':'삭제 확인'}</button>
      </div>}
     </article>)}
    </div>:<div className="lm-blank">{models.length?'검색 결과가 없습니다.':readOnly?'아직 연결된 모델이 없어요. 운영자가 AI 연결을 준비하고 있어요.':'연결된 모델이 없습니다. 모델을 먼저 추가해주세요.'}</div>}
    <div className="lm-footer lm-select-footer"><span className="lm-list-count">전체 {filteredModels.length}개 모델</span>
     <div className="lm-footer-actions">{!readOnly&&<button type="button" className="lm-outline-btn" onClick={()=>{swapMode('new');swapTab('add')}}><Plus size={15}/> 모델 추가</button>}
      <button type="button" className="lm-primary" disabled={!candidate||!models.some(m=>m.id===candidate&&m.available)||candidate===currentModelId||action!==null} onClick={confirmSelection}><Check size={16}/> 선택 확인</button></div>
    </div>
   </section>:tab==='manage'?<section className="lm-manage" id="lm-panel-manage" role="tabpanel" aria-labelledby="lm-tab-manage">
    <div className="lm-manage-heading"><strong>연결된 API</strong><span>서비스별 모델을 선택하고 확인하면 적용됩니다.</span></div>
    {showingManaged.length?<div className="lm-managed-list">
     {showingManaged.map(c=><article className={'lm-managed '+(expandedConnection===connectionRoot(c)?'lm-managed-open':'')} key={connectionRoot(c)}>
      <div className="lm-managed-row">
       <span className="lm-service-symbol"><Server size={17}/></span>
       <div className="lm-managed-copy"><strong>{providerName(c.provider)}{!c.available?' · 사용 불가':''}</strong><small title={c.model}>{c.model}</small></div>
       {deletePending===connectionRoot(c)?<div className="lm-delete-actions"><span>연결을 삭제할까요?</span><button type="button" disabled={action!==null} onClick={()=>setDeletePending('')}>취소</button><button type="button" className="lm-danger-confirm" disabled={action!==null} onClick={()=>remove(c)}>{action==='delete'?'삭제 중':'삭제'}</button></div>
       :<div className="lm-managed-actions">
        <button type="button" className="lm-dropdown-trigger" aria-expanded={expandedConnection===connectionRoot(c)} disabled={action!==null||Boolean(connectionLoading&&connectionLoading!==connectionRoot(c))} onClick={()=>switchConnection(c)}>
         {connectionLoading===connectionRoot(c)?<LoaderCircle size={14} className="spin"/>:expandedConnection===connectionRoot(c)?<ChevronUp size={15}/>:<ChevronDown size={15}/>} 모델 변경
        </button>
        <button type="button" className="lm-delete" aria-label={providerName(c.provider)+' 연결 삭제'} disabled={action!==null} onClick={()=>{setExpandedConnection('');setDeletePending(connectionRoot(c))}}><Trash2 size={16}/></button>
       </div>}
      </div>
      {expandedConnection===connectionRoot(c)&&<div className="lm-inline-picker">
       <div className="lm-inline-caption"><span>변경할 모델</span><small>선택만으로는 변경되지 않습니다.</small></div>
       {connectionLoading===connectionRoot(c)?<div className="lm-inline-loading"><LoaderCircle size={15} className="spin"/> 모델을 확인하고 있어요.</div>:
        <><label className="lm-search"><Search size={16}/><input type="search" aria-label={providerName(c.provider)+' 모델 검색'} placeholder="모델 이름 또는 ID 검색" value={connectionSearch} onChange={e=>setConnectionSearch(e.target.value)}/></label>
        <div className="lm-inline-options" role="radiogroup" aria-label={providerName(c.provider)+' 모델 목록'}>
         {(connectionCatalog[connectionRoot(c)]||[]).filter(item=>(item.name+' '+item.id).toLowerCase().includes(connectionSearch.toLowerCase())).slice(0,80).map(item=>
          <button type="button" key={item.id} role="radio" aria-checked={connectionSelected===item.id} className={'lm-inline-option '+(connectionSelected===item.id?'lm-inline-option-active':'')} onClick={()=>setConnectionSelected(item.id)} disabled={action!==null}>
           <span className="lm-indicator">{connectionSelected===item.id&&<Check size={11}/>}</span><span><strong>{item.name}</strong><small>{item.id}</small></span>
          </button>)}
         {!connectionCatalog[connectionRoot(c)]?.some(item=>(item.name+' '+item.id).toLowerCase().includes(connectionSearch.toLowerCase()))&&<div className="lm-inline-empty">검색 결과가 없습니다.</div>}
        </div>
        <div className="lm-inline-footer"><button type="button" className="lm-outline-btn" onClick={()=>setExpandedConnection('')} disabled={action!==null}>취소</button>
         <button type="button" className="lm-primary" disabled={action!==null||!connectionSelected||connectionSelected===c.model||!connectionCatalog[connectionRoot(c)]?.some(item=>item.id===connectionSelected)} onClick={()=>confirmConnection(c)}>
          {action==='save'?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>} 변경 확인
         </button>
        </div></>}
      </div>}
     </article>)}
    </div>:<div className="lm-blank">연결된 API가 없습니다. 아래에서 새 API를 추가할 수 있어요.</div>}
    <div className="lm-footer"><span className="lm-list-count">{manageConnections.length}개 API 연결</span><button type="button" className="lm-primary" onClick={()=>{swapMode('new');swapTab('add')}}><Plus size={16}/> 새 API 연결</button></div>
   </section>:<section className={'lm-add'+(catalogLoaded?' lm-catalog-open':'')} id="lm-panel-add" role="tabpanel" aria-labelledby="lm-tab-manage">
    <div className="lm-add-left">
     <button type="button" className="lm-back" onClick={()=>swapTab('manage')}><ArrowLeft size={15}/> 연결 목록</button>
     <div className="lm-step-title"><strong>서비스 선택</strong></div>
     <div className="lm-service-list" aria-label="API 서비스" onKeyDown={arrowKeys}>
      {services.map(s=><button key={s.id} type="button" className={'lm-service '+(s.id===provider?'lm-service-active':'')} aria-pressed={provider===s.id} disabled={action!==null} onClick={()=>swapProvider(s.id)}>
       <span><strong>{s.label}</strong><small>{s.caption}</small></span>{s.id===provider&&<Check size={15}/>}
      </button>)}
     </div>
     <div className="lm-left-note"><ShieldCheck size={14}/>API 키는 서버에 암호화해 저장합니다.</div>
    </div>
    <div className="lm-add-right">
     <div className="lm-step-title"><strong>{catalogLoaded?'사용할 모델 선택':'API 키 연결'}</strong></div>
     {!catalogLoaded?<div className="lm-connect-form">
      <div className="lm-selected-api"><span>새 API 연결</span><strong>{providerName(provider)}</strong><small>{provider==='local'?'로컬 모델 서버가 실행 중이어야 합니다.':'키를 입력한 후 사용할 모델을 선택하세요.'}</small></div>
      {<div className="lm-fields">
       {provider!=='openrouter'&&provider!=='bai'&&provider!=='gemini'&&provider!=='opencode'&&<label>API 주소<input type="url" autoComplete="off" value={baseUrl} disabled={action!==null} placeholder="https://api.example.com/v1" onChange={e=>{setBaseUrl(e.target.value);resetCatalog()}}/></label>}
       {provider!=='local'&&<label>API 키<input type="password" autoComplete="new-password" placeholder="API 키를 입력하세요" value={apiKey} disabled={action!==null} onChange={e=>{setApiKey(e.target.value);resetCatalog()}}/></label>}
      </div>}
      <div className="lm-connection-explanation"><KeyRound size={16}/><span>선택한 서비스의 사용 가능한 모델 목록을 확인합니다.</span></div>
      <button type="button" className="lm-fetch" disabled={action!==null||(!isReuse&&((provider!=='local'&&provider!=='opencode'&&!apiKey.trim())||!baseUrl.trim()))} onClick={fetchCatalog}>{action==='catalog'?<LoaderCircle className="spin" size={17}/>:<RefreshCw size={17}/>} {action==='catalog'?'모델 목록 확인 중':'모델 목록 불러오기'}</button>
     </div>:<div className="lm-catalog-stage">
      <div className="lm-catalog-meta"><span>{providerName(provider)} · {filteredCatalog.length.toLocaleString()}개 모델</span><button type="button" disabled={action!==null} onClick={()=>setCatalogLoaded(false)}><ArrowLeft size={14}/> 연결 변경</button></div>
      <label className="lm-search"><Search size={17}/><input type="search" aria-label="추가할 모델 검색" value={catalogSearch} onChange={e=>{setCatalogSearch(e.target.value);setCatalogPage(0)}} placeholder="모델 이름 또는 ID 검색"/></label>
      {showingCatalog.length?<div className="lm-catalog-list" role="radiogroup" aria-label="추가할 모델" onKeyDown={arrowKeys}>
       {showingCatalog.map(item=><button key={item.id} type="button" className={'lm-catalog-item '+(selectedCatalog===item.id?'lm-catalog-chosen':'')} role="radio" aria-checked={selectedCatalog===item.id} disabled={action!==null} onClick={()=>setSelectedCatalog(item.id)}>
        <span className="lm-indicator">{selectedCatalog===item.id&&<Check size={12}/>}</span><span><strong title={item.name}>{item.name}</strong><small title={item.id}>{item.id}</small></span>
       </button>)}
      </div>:<p className="lm-blank">{catalog.length?'검색 결과가 없습니다.':'사용 가능한 모델이 없습니다.'}</p>}
      <div className="lm-catalog-footer"><span className="lm-list-count">{filteredCatalog.length>80?'검색하면 더 많은 모델을 찾을 수 있어요.':'모델을 고른 후 확인하세요.'}</span><button type="button" className="lm-primary" disabled={!selectedCatalog||action!==null} onClick={save}>{action==='save'?<LoaderCircle size={16} className="spin"/>:<Check size={16}/>} 저장하고 적용</button></div>
     </div>}
    </div>
   </section>}
  </div>
 </dialog>;
}
