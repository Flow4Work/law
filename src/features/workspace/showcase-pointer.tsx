'use client';
import {useEffect,useState} from 'react';
import {MousePointer2} from 'lucide-react';

/** Visual indication of recorded clicks; never clicks or controls the real UI. */
export function ShowcasePointer({stage}:{stage:number}){
 const [point,setPoint]=useState<{x:number;y:number}|null>(null);
 useEffect(()=>{
  const target:Record<number,string>={
   1:'.prompt-cards button:first-child',
   2:'.composer-send',
   5:'.intake-options button:first-child',
   8:'.intake-options button:nth-child(2)',
   10:'.intake-text-area textarea',
   13:'.react-flow__node[data-id="wage-request"]',
   14:'.react-flow__node[data-id="wage-labor"]',
   15:'.detail-panel .step-primary',
   16:'.react-flow__node[data-id="scenario:wage-labor:step:0"]',
   17:'.react-flow__node[data-id="scenario:wage-labor:step:1"]',
   18:'.react-flow__node[data-id="scenario:wage-labor:step:2"]',
   19:'.react-flow__node[data-id="scenario:wage-labor:outcome:1"]',
   20:'.react-flow__node[data-id="scenario:wage-labor:outcome:0"]'
  };
  const selector=target[stage];
  if(!selector){setPoint(null);return}
  let timeout:ReturnType<typeof setTimeout>;
  let tries=0;let alive=true;
  const locate=()=>{
   if(!alive)return;
   const element=document.querySelector<HTMLElement>(selector);
   if(element){
    const r=element.getBoundingClientRect();
    if(r.width&&r.height){setPoint({x:r.left+Math.min(r.width*.7,r.width-15),y:r.top+r.height*.55});return}
   }
   if(tries++<12)timeout=setTimeout(locate,125);else setPoint(null);
  };
  locate();
  return()=>{alive=false;clearTimeout(timeout)};
 },[stage]);
 /** Keep the recorded Depth 3 path in frame. Only the isolated showcase uses this camera. */
 useEffect(()=>{
  if(stage<16||stage>20||typeof window==='undefined'||!new URLSearchParams(window.location.search).has('showcase'))return;
  const pathId=stage===16?'scenario:wage-labor:step:0':stage===17?'scenario:wage-labor:step:1':stage===18?'scenario:wage-labor:step:2':stage===19?'scenario:wage-labor:outcome:1':'scenario:wage-labor:outcome:0';
  let canceled=false;
  let frame=0;
  const pan=(animated:boolean)=>{
   if(canceled)return;
   const viewport=document.querySelector<HTMLElement>('.react-flow__viewport');
   const canvas=document.querySelector<HTMLElement>('.react-flow');
   const node=[...document.querySelectorAll<HTMLElement>('.react-flow__node')].find(element=>element.dataset.id===pathId);
   if(!viewport||!canvas||!node||!canvas.clientWidth||!canvas.clientHeight)return;
   const pos=new DOMMatrixReadOnly(node.style.transform);
   const zoom=stage>=19?.84:.96;
   const bias=stage>=19?112:0;
   const x=canvas.clientWidth*.5-(pos.m41+node.offsetWidth/2+bias)*zoom;
   const y=canvas.clientHeight*.51-(pos.m42+node.offsetHeight/2)*zoom;
   const before=new DOMMatrixReadOnly(getComputedStyle(viewport).transform);
   viewport.style.setProperty('transition','none','important');
   cancelAnimationFrame(frame);
   const paint=(a:number,b:number,c:number)=>viewport.style.setProperty('transform',`translate(${a}px,${b}px) scale(${c})`,'important');
   if(!animated){paint(x,y,zoom);return}
   const started=performance.now();
   const move=(now:number)=>{
    if(canceled)return;
    const t=Math.min(1,(now-started)/1150);
    const ease=t*t*(3-2*t);
    paint(before.m41+(x-before.m41)*ease,before.m42+(y-before.m42)*ease,before.a+(zoom-before.a)*ease);
    if(t<1)frame=requestAnimationFrame(move);
   };
   frame=requestAnimationFrame(move);
  };
  const begin=setTimeout(()=>pan(true),180);
  const settle=setTimeout(()=>pan(false),1800);
  return()=>{canceled=true;clearTimeout(begin);clearTimeout(settle);cancelAnimationFrame(frame)};
 },[stage]);
 if(!point)return null;
 return <div className="showcase-pointer" style={{left:point.x,top:point.y}} aria-hidden="true">
  <span className="showcase-pointer-ring"/><MousePointer2 size={23} fill="white" strokeWidth={1.7}/>
 </div>;
}
