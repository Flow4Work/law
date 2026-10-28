'use client';
import type {ActivityAction} from './activity-types';
export function recordActivity(action:ActivityAction,detail=''){
 if(typeof window==='undefined'||window.location.pathname!=='/'||new URLSearchParams(window.location.search).has('showcase'))return;
 void fetch('/api/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,detail:detail.trim().slice(0,400)}),keepalive:true}).catch(()=>{});
}
