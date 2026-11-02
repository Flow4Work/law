'use client';
import {useEffect,useRef} from 'react';
import {usePathname} from 'next/navigation';
import {recordActivity} from '@/lib/activity-client';
export function ActivityRecorder(){
 const pathname=usePathname(),recordedPath=useRef('');
 useEffect(()=>{
  if(recordedPath.current!==pathname){recordedPath.current=pathname;if(pathname==='/')recordActivity('visit')}
 },[pathname]);
 useEffect(()=>{
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
