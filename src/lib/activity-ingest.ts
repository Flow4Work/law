import {randomUUID} from 'node:crypto';
import {ACTIVITY_LABELS,type ActivityAction,type ActivitySite} from './activity-types';
import {activityLocation,requestAddress} from './activity-location';
import {appendActivity,readIpLocation,readVerifiedDistrict,saveIpLocation} from './activity-store';
/** One shared pipeline for every tracked site, so location and privacy rules never diverge. */
const recent=new Map<string,{start:number;count:number}>();
export async function ingestActivity(request:Request,site:ActivitySite){
 if(!process.env.LEGAL_ADMIN_PATH||!process.env.LEGAL_CONNECTION_SECRET)return new Response(null,{status:204});
 const ip=requestAddress(request.headers).ip;
 const verified=await readVerifiedDistrict(ip);
 const remembered=verified?null:await readIpLocation(ip);
 const location=await activityLocation(request.headers,verified,remembered||undefined),now=Date.now();
 const limit=recent.get(location.ip);if(limit&&now-limit.start<60000){if(limit.count>=60)return new Response(null,{status:429});limit.count++}else recent.set(location.ip,{start:now,count:1});
 let body;try{const text=await request.text();if(text.length>2000)return new Response(null,{status:413});body=JSON.parse(text)}catch{return new Response(null,{status:400})}
 if(!body||typeof body.action!=='string'||!Object.hasOwn(ACTIVITY_LABELS,body.action))return new Response(null,{status:400});
 const event={id:randomUUID(),at:new Date().toISOString(),...location,site,action:body.action as ActivityAction,detail:typeof body.detail==='string'?body.detail.trim().slice(0,400):''};
 try{await appendActivity(event)}catch{console.warn('[private-activity] Storage write failed');return new Response(null,{status:503,headers:{'Cache-Control':'no-store'}})}
 if(!verified&&!remembered&&(location.district||location.isp)){
  try{await saveIpLocation(ip,location)}catch{/* a failed cache write must never lose the record */}
 }
 return new Response(null,{status:204,headers:{'Cache-Control':'no-store'}});
}
