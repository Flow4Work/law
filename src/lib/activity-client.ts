'use client';
import type {ActivityAction} from './activity-types';
let visitorId='';
const uuidPattern=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function uuid(){
 if(crypto.randomUUID)return crypto.randomUUID();
 const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function visitor(){
 if(visitorId)return visitorId;
 try{const saved=localStorage.getItem('law-visitor-v1');visitorId=saved&&uuidPattern.test(saved)?saved:uuid();localStorage.setItem('law-visitor-v1',visitorId)}catch{visitorId=visitorId||uuid()}
 return visitorId;
}
async function send(body:string){
 // Keep the same event ID across bounded retries so an uncertain response cannot double-count.
 // Questions stay in memory; no persistent telemetry queue is created.
 for(let attempt=0;attempt<3;attempt++){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch('/api/activity',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true,signal:controller.signal});
   if(response.ok)return;
   if(![408,500,502,503,504].includes(response.status)){console.warn('[law] 활동 기록 전송 실패: '+response.status);return}
  }catch{/* bounded retry below */}finally{clearTimeout(timeout)}
  if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));
 }
 console.warn('[law] 활동 기록 전송 실패');
}
export function recordActivity(action:ActivityAction,detail=''){
 if(typeof window==='undefined'||window.location.pathname!=='/'||new URLSearchParams(window.location.search).has('showcase'))return;
 if(window.location.hostname.endsWith('.vercel.app')&&window.location.hostname!=='law-lake-theta.vercel.app')return;
 try{void send(JSON.stringify({id:uuid(),visitorId:visitor(),page:window.location.pathname,action,detail:detail.trim().slice(0,400)}))}catch{console.warn('[law] 활동 기록을 준비하지 못했습니다.')}
}
