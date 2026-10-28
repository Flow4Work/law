'use client';
import {useEffect,useRef} from 'react';
import {recordActivity} from '@/lib/activity-client';
export function ActivityRecorder(){
 const mounted=useRef(false);
 useEffect(()=>{
  if(!mounted.current){mounted.current=true;recordActivity('visit')}
  const click=(event:MouseEvent)=>{
   const target=event.target instanceof Element?event.target.closest('button'):null;
   const label=target?.getAttribute('aria-label')||'';
   if(label==='모델 연결과 설정'||label==='모델 연결과 관리')recordActivity('settings');
   if(label==='공식 자료 보기')recordActivity('sources');
  };
  document.addEventListener('click',click);return()=>document.removeEventListener('click',click);
 },[]);
 return null;
}
