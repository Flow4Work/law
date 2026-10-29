'use client';
import type {ActivityAction} from './activity-types';
let visitorId='';
function visitor(){
 if(visitorId)return visitorId;
 try{visitorId=localStorage.getItem('law-visitor-v1')||crypto.randomUUID();localStorage.setItem('law-visitor-v1',visitorId)}catch{visitorId=crypto.randomUUID()}
 return visitorId;
}
export function recordActivity(action:ActivityAction,detail=''){
 if(typeof window==='undefined'||window.location.pathname!=='/'||new URLSearchParams(window.location.search).has('showcase'))return;
 void fetch('/api/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:crypto.randomUUID(),visitorId:visitor(),page:window.location.pathname,action,detail:detail.trim().slice(0,400)}),keepalive:true}).catch(()=>{});
}
