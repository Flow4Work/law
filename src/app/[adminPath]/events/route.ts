import {NextRequest,NextResponse} from 'next/server';
import {ADMIN_COOKIE,adminPathMatches,verifyAdminSession} from '@/lib/activity-crypto';
import {readActivityReport,readIpLocation,readVerifiedDistrict} from '@/lib/activity-store';
import {isActivitySite,type ActivityEvent} from '@/lib/activity-types';
export const runtime='nodejs';
export const maxDuration=30;
export const dynamic='force-dynamic';
const LOCATION_KEYS=['country','city','district','location','districtSource','districtConfidence','districtEvidence','locationNote','isp','asn','networkType','networkRisk'] as const;
/**
 * One address must not read differently from one minute to the next. Older records keep the
 * answer that was stored with them, so every row for an IP is aligned to the answer that
 * address resolves to now.
 */
async function alignLocations(events:ActivityEvent[]){
 const ips=[...new Set(events.map(event=>event.ip).filter(ip=>ip&&ip!=='확인 불가'&&ip!=='127.0.0.1'))].slice(0,50);
 if(!ips.length)return events;
 const latest=new Map<string,ActivityEvent>();
 for(const event of events)if(!latest.has(event.ip))latest.set(event.ip,event);
 const aligned=new Map<string,Record<string,unknown>>();
 await Promise.all(ips.map(async ip=>{
  const verified=await readVerifiedDistrict(ip);
  if(verified){aligned.set(ip,{country:'KR',city:'서울특별시',district:verified,location:`서울특별시 ${verified}`,districtSource:'verified',districtConfidence:'high',districtEvidence:`브라우저 위치 확인 ${verified}`,locationNote:''});return}
  const remembered=await readIpLocation(ip);
  if(remembered){aligned.set(ip,remembered);return}
  // Nothing stored yet: trust the newest record for that address, which was resolved with
  // the current rules, so older rows cannot contradict it.
  const newest=latest.get(ip);
  if(newest)aligned.set(ip,newest as unknown as Record<string,unknown>);
 }));
 if(!aligned.size)return events;
 return events.map(event=>{
  const value=aligned.get(event.ip);
  if(!value)return event;
  const patch:Record<string,unknown>={};
  for(const key of LOCATION_KEYS)if(value[key]!==undefined)patch[key]=value[key];
  return {...event,...patch};
 });
}
export async function GET(request:NextRequest,{params}:{params:Promise<{adminPath:string}>}){
 const {adminPath}=await params;if(!adminPathMatches(adminPath))return new Response(null,{status:404});
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
 if(!verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))return NextResponse.json({error:'로그인이 필요합니다.'},{status:401,headers});
 try{
  const site=request.nextUrl.searchParams.get('site');
  const report=await readActivityReport(Number(request.nextUrl.searchParams.get('days')||1),isActivitySite(site)?site:'law');
  return NextResponse.json({...report,events:await alignLocations(report.events)},{headers});
 }catch{console.warn('[private-admin] Activity storage read failed');return NextResponse.json({error:'기록을 불러오지 못했습니다. 다시 시도해주세요.'},{status:503,headers})}
}
