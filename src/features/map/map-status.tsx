'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,LoaderCircle,MessageCircle,TriangleAlert,X} from 'lucide-react';
import './map-status.css';

type Props={
  state:'processing'|'awaiting'|'error';
  message:string;
  pendingHintPulse:number;
  onContinue:()=>void;
};

export function MapStatus({state,message,pendingHintPulse,onContinue}:Props){
  const [dismissed,setDismissed]=useState(false);
  const messageRef=useRef<HTMLSpanElement>(null);
  useEffect(()=>{
    if(!pendingHintPulse||state!=='awaiting'||!messageRef.current)return;
    const element=messageRef.current;
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const frames:Keyframe[]=reducedMotion
      ?[{opacity:1,color:'var(--text)'},{opacity:1,color:'var(--text)'},{opacity:1}]
      :[{opacity:1,color:'var(--text)'},{opacity:.15,color:'var(--text)',offset:.22},{opacity:1,color:'var(--text)',offset:.42},{opacity:.15,color:'var(--text)',offset:.62},{opacity:1,color:'var(--text)',offset:.82},{opacity:1,color:'var(--text)'}];
    const animation=element.animate(frames,{delay:650,duration:reducedMotion?900:1250,easing:'ease-in-out'});
    return()=>animation.cancel();
  },[pendingHintPulse,state]);
  if(dismissed)return null;
  const Icon=state==='processing'?LoaderCircle:state==='awaiting'?MessageCircle:TriangleAlert;
  return <div className={'map-notice is-'+state}>
    <div className="map-notice-status" role="status" aria-live="polite" aria-atomic="true">
      <span className="map-notice-icon" aria-hidden="true"><Icon size={15} strokeWidth={1.8}/></span>
      <span ref={messageRef}>{message}</span>
    </div>
    {state!=='processing'&&<button className="map-notice-action" onClick={onContinue}>{state==='awaiting'?'답하기':'대화 확인'}<ArrowUpRight size={13}/></button>}
    <button className="map-notice-close" aria-label="지도 상태 안내 닫기" onClick={()=>setDismissed(true)}><X size={15}/></button>
  </div>;
}
