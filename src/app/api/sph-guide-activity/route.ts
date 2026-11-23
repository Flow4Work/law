import {activityDatabaseConfigured,appendGuideActivities,claimDatabaseAttempt} from '@/lib/activity-db';
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

export function OPTIONS(request:Request){
 return request.headers.get('origin')===origin?new Response(null,{status:204,headers}):new Response(null,{status:403});
}

export async function POST(request:Request){
 if(request.headers.get('origin')!==origin)return new Response(null,{status:403});
 if(!activityDatabaseConfigured())return new Response(null,{status:503,headers});
 if(Number(request.headers.get('content-length'))>1000)return new Response(null,{status:413,headers});
 const events:{id:string;action:GuideAction}[]=[];
 try{
  const raw=await request.text();
  if(raw.length>1000)return new Response(null,{status:413,headers});
  const body=JSON.parse(raw);
  if(!body||Object.keys(body).length!==1||!Array.isArray(body.events)||!body.events.length||body.events.length>5)throw new Error();
  for(const item of body.events){
   if(!item||Object.keys(item).length!==2||typeof item.id!=='string'||!idPattern.test(item.id)||
    typeof item.action!=='string'||!Object.hasOwn(GUIDE_ACTIVITY_LABELS,item.action))throw new Error();
   events.push({id:item.id,action:item.action});
  }
 }catch{return new Response(null,{status:400,headers})}
 try{
  // The request address is used for the existing rate limiter only.
  if(!await claimDatabaseAttempt(requestAddress(request.headers).ip,'sph-guide',15)){
   return new Response(null,{status:429,headers:{...headers,'Retry-After':'60'}});
  }
  const inserted=await appendGuideActivities(events);
  if(inserted.length)console.info('[sph-guide-activity] stored',inserted.join(','));
  return new Response(null,{status:204,headers});
 }catch{
  console.warn('[sph-guide-activity] Activity storage unavailable');
  return new Response(null,{status:503,headers});
 }
}
