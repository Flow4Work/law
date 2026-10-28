'use client';

import {Check,ChevronDown,SlidersHorizontal,Search,Plus} from 'lucide-react';
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import type {ModelInventory} from '@/lib/model-types';
import {composerModelLabel,providerName} from '@/lib/model-selection';

type Props={
  inventory:ModelInventory|null;
  value:string;
  disabled?:boolean;
  onChange:(id:string)=>void;
  onManage:()=>void;
};

export function ModelPicker({inventory,value,disabled=false,onChange,onManage}:Props){
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const root=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const popover=useRef<HTMLDivElement>(null);
  const search=useRef<HTMLInputElement>(null);
  const id=useId();
  const models=inventory?.models||[];
  const current=models.find(model=>model.id===value);
  const shortLabel=composerModelLabel(current);
  const filtered=models.filter(model=>(model.name+' '+model.model+' '+providerName(model.provider)).toLowerCase().includes(query.trim().toLowerCase()));
  const groups=Array.from(new Set(filtered.map(model=>providerName(model.provider))));
  const close=()=>{setOpen(false);trigger.current?.focus()};

  // Native popovers keep the workspace theme while escaping the composer's
  // rounded clipping area and the conversation panel's overflow boundary.
  useLayoutEffect(()=>{
    const panel=popover.current;
    if(!open||!panel)return;
    const place=()=>{
      const anchor=trigger.current?.getBoundingClientRect();
      if(!anchor)return;
      const viewport=window.visualViewport;
      const left=viewport?.offsetLeft||0;
      const top=viewport?.offsetTop||0;
      const width=viewport?.width||window.innerWidth;
      const height=viewport?.height||window.innerHeight;
      const margin=12,gap=8;
      const menuWidth=Math.min(330,width-margin*2);
      const above=Math.max(0,anchor.top-top-gap-margin);
      const below=Math.max(0,top+height-anchor.bottom-gap-margin);
      const opensAbove=above>=200||above>=below;
      panel.style.left=Math.max(left+margin,Math.min(anchor.left,left+width-menuWidth-margin))+'px';
      panel.style.width=menuWidth+'px';
      panel.style.maxHeight=(opensAbove?above:below)+'px';
      panel.style.top=opensAbove?'auto':anchor.bottom+gap+'px';
      panel.style.bottom=opensAbove?window.innerHeight-anchor.top+gap+'px':'auto';
    };
    place();panel.showPopover();
    window.addEventListener('resize',place);
    window.addEventListener('scroll',place,true);
    window.visualViewport?.addEventListener('resize',place);
    window.visualViewport?.addEventListener('scroll',place);
    return()=>{
      window.removeEventListener('resize',place);
      window.removeEventListener('scroll',place,true);
      window.visualViewport?.removeEventListener('resize',place);
      window.visualViewport?.removeEventListener('scroll',place);
      if(panel.isConnected)panel.hidePopover();
    };
  },[open]);

  useEffect(()=>{
    if(!open)return;
    setQuery('');search.current?.focus();
    const outside=(event:PointerEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false)};
    document.addEventListener('pointerdown',outside);
    return()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  useEffect(()=>{if(disabled)setOpen(false)},[disabled]);

  return <div className="model-picker" ref={root} onKeyDown={event=>{
    if(event.key==='Escape'&&open){event.stopPropagation();close()}
    if(!open||!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    if((event.key==='Home'||event.key==='End')&&event.target===search.current)return;
    const options=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)')||[]);
    if(!options.length)return;
    event.preventDefault();const index=options.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?options.length-1:event.key==='ArrowDown'?(index+1)%options.length:(index-1+options.length)%options.length;
    options[next].focus();
  }}>
    <button ref={trigger} className="model-picker-trigger" type="button" aria-label={'답변 모델 선택'+(current?.name?': '+current.name:'')} title={current?.name||'답변 모델 선택'} aria-haspopup="dialog" aria-controls={id} aria-expanded={open} disabled={disabled} onClick={()=>setOpen(value=>!value)}>
      <span className="model-picker-label" aria-hidden="true">{shortLabel}</span>
      <ChevronDown className={open?'is-open':''} size={12} aria-hidden="true"/>
    </button>
    <button className="model-settings-trigger" type="button" aria-label="모델 연결과 관리" title="모델 연결과 관리" disabled={disabled} onClick={onManage}><SlidersHorizontal size={17}/></button>
    {open&&<div ref={popover} popover="manual" id={id} className="model-picker-popover" role="dialog" aria-label="답변 모델 선택 메뉴">
      <div className="model-picker-heading">답변 모델</div>
      <label className="model-picker-search"><Search size={15}/><input ref={search} type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="모델 검색" aria-label="답변 모델 검색"/></label>
      <div className="model-picker-options" role="listbox" aria-label="답변 모델 목록">
        {groups.map(group=><div key={group} role="group" aria-label={group}><div className="model-picker-group">{group}</div>{filtered.filter(model=>providerName(model.provider)===group).map(model=>{
          const selected=model.id===current?.id;
          return <button key={model.id} type="button" className={'model-picker-option '+(selected?'selected':'')} role="option" aria-selected={selected} disabled={!model.available} onClick={()=>{onChange(model.id);close()}}>
            <span><strong>{model.name}</strong><small>{model.available?providerName(model.provider):model.reason||providerName(model.provider)+' · 연결 확인 필요'}</small></span>
            {selected&&<Check size={16}/>}
          </button>;
        })}</div>)}
        {!filtered.length&&<p className="model-picker-empty">{models.length?'검색 결과가 없어요.':'연결된 모델이 없어요.'}</p>}
      </div>
      <button className="model-picker-manage" type="button" onClick={()=>{setOpen(false);onManage()}}><Plus size={15}/>모델 연결·관리</button>
    </div>}
  </div>;
}
