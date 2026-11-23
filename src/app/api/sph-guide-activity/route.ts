import {activityDatabaseConfigured,appendGuideActivities,claimDatabaseAttempt,type GuideIncomingEvent} from '@/lib/activity-db';
import {requestAddress} from '@/lib/activity-location';
import {GUIDE_ACTIVITY_LABELS,type GuideAction} from '@/lib/activity-types';

export const runtime='nodejs';
export const maxDuration=10;

const origin='https://sph-field-guide-six.vercel.app';
const headers={
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'Content-Type',
 'Vary':'Origin',
 'Cache-Control':'no-store'
};
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const scrub=(text:string)=>text
 .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[이메일]')
 .replace(/(?:\+?82[-.\s]?)?01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g,'[전화번호]')
 .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|Bearer\s+[A-Za-z0-9._-]{16,})\b/gi,'[인증정보]')
 .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();

export function OPTIONS(request:Request){
 return request.headers.get('origin')===origin?new Response(null,{status:204,headers}):new Response(null,{status:403});
}

export async function POST(request:Request){
 if(request.headers.get('origin')!==origin)return new Response(null,{status:403});
 if(!activityDatabaseConfigured())return new Response(null,{status:503,headers});
 if(Number(request.headers.get('content-length'))>5000)return new Response(null,{status:413,headers});
 const events:GuideIncomingEvent[]=[];
 try{
  const raw=await request.text();
  if(raw.length>5000)return new Response(null,{status:413,headers});
  const body=JSON.parse(raw);
  if(!body||Object.keys(body).length!==1||!Array.isArray(body.events)||!body.events.length||body.events.length>5)throw new Error();
  const receivedAt=new Date().toISOString(),now=Date.parse(receivedAt);
  for(const item of body.events){
   if(!item||typeof item!=='object'||Object.keys(item).some(key=>!['id','action','detail','visitorId','at'].includes(key))||
    typeof item.id!=='string'||!idPattern.test(item.id)||
    typeof item.action!=='string'||!Object.hasOwn(GUIDE_ACTIVITY_LABELS,item.action)||
    (item.detail!==undefined&&typeof item.detail!=='string')||
    (item.visitorId!==undefined&&(typeof item.visitorId!=='string'||!idPattern.test(item.visitorId)))||
    (item.at!==undefined&&(typeof item.at!=='string'||!Number.isFinite(Date.parse(item.at)))))throw new Error();
   const action=item.action as GuideAction;
   const maxLength=action==='query'||action==='example'?350:140;
   const detail=scrub((item.detail||'').slice(0,1000)).slice(0,maxLength);
   const eventTime=item.at?Date.parse(item.at):now;
   const at=eventTime<=now&&now-eventTime<=120000?new Date(eventTime).toISOString():receivedAt;
   events.push({id:item.id,action,detail,visitorId:item.visitorId||item.id,at});
  }
 }catch{return new Response(null,{status:400,headers})}
 const address=requestAddress(request.headers);
 try{
  // Two database calls per accepted batch: atomic rate limit and one encrypted INSERT.
  if(!await claimDatabaseAttempt(address.ip,'sph-guide',15)){
   return new Response(null,{status:429,headers:{...headers,'Retry-After':'60'}});
  }
  const country=(request.headers.get('x-vercel-ip-country')||'').slice(0,2).toUpperCase();
  const rawCity=request.headers.get('x-vercel-ip-city')||'';
  let city='';try{city=decodeURIComponent(rawCity).slice(0,80)}catch{/* Unavailable. */}
  await appendGuideActivities(events,address,/^[A-Z]{2}$/.test(country)?country:'',city);
  return new Response(null,{status:204,headers});
 }catch{
  console.warn('[sph-guide-activity] Activity database unavailable');
  return new Response(null,{status:503,headers});
 }
}
