'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ListOrdered,Plus,X} from 'lucide-react';
import type {LegalCase} from '@/lib/types';
import {limitCaseTitle} from '@/lib/case-title';
export function ConversationTabs({cases,activeId,busy,onExample,onSelect,onNew,onDelete,onMove}:{cases:LegalCase[];activeId:string|null;busy:boolean;onExample:()=>void;onSelect:(id:string)=>void;onNew:()=>void;onDelete:(id:string)=>void;onMove:(id:string,target:string)=>void}){
 const [dragging,setDragging]=useState<string|null>(null);const [over,setOver]=useState<string|null>(null);const [managerOpen,setManagerOpen]=useState(false);
 const list=useRef<HTMLDivElement>(null);
 useEffect(()=>{list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'})},[activeId,cases]);
 useEffect(()=>{
  const element=list.current;if(!element)return;
  let frame=0;
  const observer=new ResizeObserver(()=>{
   cancelAnimationFrame(frame);
   frame=requestAnimationFrame(()=>{const active=element.querySelector('[aria-selected="true"]');(active?.closest('.conversation-tab')||active)?.scrollIntoView({block:'nearest',inline:'nearest'})});
  });
  observer.observe(element);
  return()=>{observer.disconnect();cancelAnimationFrame(frame)};
 },[]);
 useEffect(()=>{if(busy)setManagerOpen(false)},[busy]);
 return <><div ref={list} className="conversation-tabs" role="tablist" aria-label="대화 탭"><button role="tab" disabled={busy} aria-selected={!activeId} onClick={onExample}>예시</button>{cases.map((c,index)=><div role="presentation" className={'conversation-tab'+(c.id===activeId?' active':'')+(over===c.id&&dragging!==c.id?' drag-over':'')+(dragging===c.id?' dragging':'')} key={c.id} draggable={!busy}
  onDragStart={e=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',c.id);setDragging(c.id)}}
  onDragOver={e=>{if(!busy&&dragging){e.preventDefault();e.dataTransfer.dropEffect='move';setOver(c.id)}}}
  onDrop={e=>{e.preventDefault();if(!busy&&dragging)onMove(dragging,c.id);setDragging(null);setOver(null)}} onDragEnd={()=>{setDragging(null);setOver(null)}}>
  <button role="tab" disabled={busy} aria-selected={c.id===activeId} title={c.name+' · 끌어서 순서 변경 · Alt+←/→'} onClick={()=>onSelect(c.id)} onKeyDown={e=>{if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();const target=cases[index+(e.key==='ArrowLeft'?-1:1)];if(target)onMove(c.id,target.id)}}}>{limitCaseTitle(c.name)}</button><button className="tab-close" disabled={busy} aria-label={c.name+' 대화 삭제'} title="대화 삭제" onClick={()=>onDelete(c.id)}><X size={15}/></button>
 </div>)}<button className="tab-add" disabled={busy} onClick={onNew} aria-label="새 대화 탭"><Plus size={17}/></button><button className="tab-manage" disabled={busy||cases.length<2} onClick={()=>setManagerOpen(true)} aria-label="대화 탭 순서 바꾸기"><ListOrdered size={18}/></button></div>
 {managerOpen&&<div className="tab-manager-layer" role="presentation"><button className="tab-manager-backdrop" aria-label="탭 순서 변경 닫기" onClick={()=>setManagerOpen(false)}/><section className="tab-manager" role="dialog" aria-modal="true" aria-labelledby="tab-manager-title"><div className="tab-manager-head"><div><span>대화 탭</span><h2 id="tab-manager-title">순서 바꾸기</h2></div><button autoFocus aria-label="탭 순서 변경 닫기" onClick={()=>setManagerOpen(false)}><X size={20}/></button></div><p>화살표를 눌러 탭 위치를 바꿀 수 있어요.</p><div className="tab-manager-list">{cases.map((c,index)=><div key={c.id}><strong title={c.name}>{limitCaseTitle(c.name)}</strong><span>{index+1}</span><button aria-label={c.name+' 탭을 왼쪽으로 이동'} disabled={busy||index===0} onClick={()=>onMove(c.id,cases[index-1].id)}><ArrowLeft size={18}/></button><button aria-label={c.name+' 탭을 오른쪽으로 이동'} disabled={busy||index===cases.length-1} onClick={()=>onMove(c.id,cases[index+1].id)}><ArrowRight size={18}/></button></div>)}</div><button className="tab-manager-done" onClick={()=>setManagerOpen(false)}>완료</button></section></div>}</>;
}
export function DeleteConversation({name,onCancel,onConfirm}:{name:string;onCancel:()=>void;onConfirm:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const d=ref.current;d?.showModal();return()=>d?.close()},[]);
 return <dialog ref={ref} className="delete-dialog" aria-labelledby="delete-title" onCancel={onCancel} onClick={e=>{if(e.target===e.currentTarget)onCancel()}}><h2 id="delete-title">정말 삭제하시겠어요?</h2><strong>{name}</strong><p>이 대화와 선택지 지도가 함께 삭제돼요.</p><div><button autoFocus onClick={onCancel}>취소</button><button className="delete-confirm" onClick={onConfirm}>삭제</button></div></dialog>;
}
