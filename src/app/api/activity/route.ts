import {randomUUID} from 'node:crypto';
import {ACTIVITY_LABELS,type ActivityAction} from '@/lib/activity-types';
import {activityLocation} from '@/lib/activity-location';
import {appendActivity} from '@/lib/activity-store';
import {modelRequestAllowed} from '@/lib/model-request-origin';
export const runtime='nodejs';
export const maxDuration=30;
const recent=new Map<string,{start:number;count:number}>();
export async function POST(request:Request){
 if(!modelRequestAllowed(request))return new Response(null,{status:403});
 if(!process.env.LEGAL_ADMIN_PATH||!process.env.LEGAL_CONNECTION_SECRET)return new Response(null,{status:204});
 const location=await activityLocation(request.headers),now=Date.now();
 if(recent.size>1000)for(const [key,value] of recent)if(now-value.start>60000)recent.delete(key);
 const limit=recent.get(location.ip);if(limit&&now-limit.start<60000){if(limit.count>=60)return new Response(null,{status:429});limit.count++}else recent.set(location.ip,{start:now,count:1});
 let body;try{const text=await request.text();if(text.length>2000)return new Response(null,{status:413});body=JSON.parse(text)}catch{return new Response(null,{status:400})}
 if(!body||typeof body.action!=='string'||!Object.hasOwn(ACTIVITY_LABELS,body.action))return new Response(null,{status:400});
 const event={id:randomUUID(),at:new Date().toISOString(),...location,action:body.action as ActivityAction,detail:typeof body.detail==='string'?body.detail.trim().slice(0,400):''};
 try{await appendActivity(event)}catch{console.warn('[private-activity] Storage write failed');return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}})}
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
