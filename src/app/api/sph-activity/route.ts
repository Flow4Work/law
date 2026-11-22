import {appendDatabaseActivities,activityDatabaseConfigured,claimDatabaseAttempt} from '@/lib/activity-db';
import {requestAddress} from '@/lib/activity-location';
import type {ActivityAction,ActivityEvent} from '@/lib/activity-types';

export const runtime='nodejs';
export const maxDuration=10;

// Only fixed UI labels are accepted. Search terms, lead data, email content and URLs are never accepted.
const allowed:Partial<Record<ActivityAction,ReadonlySet<string>>>={
 visit:new Set(['서비스 접속']),
 click:new Set(['공공 입찰','기업 발굴','알림 열기','모두 읽음','연결 설정','입찰 조회 이력','전체 공고','저장한 공고','정렬 변경','메일 작성','메일 발송','목록으로','설정 닫기']),
 query:new Set(['검색 적용']),
 view_step:new Set(['입찰 상세 보기','기업 상세 보기'])
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cors=(origin:string)=>({
 'Access-Control-Allow-Origin':origin,
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Access-Control-Allow-Headers':'Content-Type',
 'Access-Control-Max-Age':'86400',
 'Vary':'Origin',
 'Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff'
});
export async function OPTIONS(request:Request){
 const origin=request.headers.get('origin');
 return origin==='https://sph-opportunity-agent.vercel.app'
  ?new Response(null,{status:204,headers:cors(origin)})
  :new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin!=='https://sph-opportunity-agent.vercel.app')return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});
 const headers=cors(origin);
 if(!activityDatabaseConfigured())return new Response(null,{status:503,headers});
 if(Number(request.headers.get('content-length'))>1600)return new Response(null,{status:413,headers});
 let body:unknown;
 try{const raw=await request.text();if(raw.length>1600)throw new Error();body=JSON.parse(raw)}catch{return new Response(null,{status:400,headers})}
 if(!body||typeof body!=='object'||!('events'in body)||!Array.isArray(body.events)||body.events.length<1||body.events.length>5)return new Response(null,{status:400,headers});
 const incoming=body.events as unknown[];
 for(const event of incoming){
  if(!event||typeof event!=='object')return new Response(null,{status:400,headers});
  const item=event as Record<string,unknown>;
  if(typeof item.id!=='string'||!uuid.test(item.id)||typeof item.visitorId!=='string'||!uuid.test(item.visitorId)||
   typeof item.action!=='string'||typeof item.detail!=='string'||!allowed[item.action as ActivityAction]?.has(item.detail))return new Response(null,{status:400,headers});
 }
 const address=requestAddress(request.headers);
 const ip=address.ip;
 const at=new Date().toISOString();
 const events:ActivityEvent[]=incoming.map(raw=>{
  const item=raw as {id:string;visitorId:string;action:ActivityAction;detail:string};
  return {id:item.id,visitorId:item.visitorId,at,site:'sph',page:'/',ip,country:'',
   ipVersion:address.ipVersion,city:'',district:'',location:'',districtSource:'unavailable',
   action:item.action,detail:item.detail};
 });
 try{
  if(!await claimDatabaseAttempt(ip,'sph',15))return new Response(null,{status:429,headers:{...headers,'Retry-After':'60'}});
  const inserted=await appendDatabaseActivities(events);
  if(inserted.length)console.info('[sph-activity] stored',inserted.join(','));
  return new Response(null,{status:204,headers});
 }catch{console.warn('[sph-activity] Minimal activity storage unavailable');return new Response(null,{status:503,headers})}
}
