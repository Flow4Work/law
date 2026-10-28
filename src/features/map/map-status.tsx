'use client';

import {useState} from 'react';
import {ArrowUpRight,LoaderCircle,MessageCircle,TriangleAlert,X} from 'lucide-react';
import './map-status.css';

type Props={
  state:'processing'|'awaiting'|'error';
  message:string;
  onContinue:()=>void;
};

export function MapStatus({state,message,onContinue}:Props){
  const [dismissed,setDismissed]=useState(false);
  if(dismissed)return null;
  const Icon=state==='processing'?LoaderCircle:state==='awaiting'?MessageCircle:TriangleAlert;
  return <div className={'map-notice is-'+state}>
    <div className="map-notice-status" role="status" aria-live="polite" aria-atomic="true">
      <span className="map-notice-icon" aria-hidden="true"><Icon size={15} strokeWidth={1.8}/></span>
      <span>{message}</span>
    </div>
    {state!=='processing'&&<button className="map-notice-action" onClick={onContinue}>{state==='awaiting'?'답하기':'대화 확인'}<ArrowUpRight size={13}/></button>}
    <button className="map-notice-close" aria-label="지도 상태 안내 닫기" onClick={()=>setDismissed(true)}><X size={15}/></button>
  </div>;
}
