import {NextRequest,NextResponse} from 'next/server';
import {ADMIN_COOKIE,adminPathMatches,verifyAdminSession} from '@/lib/activity-crypto';
import {readActivityReport,claimReportAttempt} from '@/lib/activity-store';
import {requestAddress} from '@/lib/activity-location';
import {decodeActivityCursor} from '@/lib/activity-db';
import {readActivityArchive,validateArchiveRequest} from '@/lib/activity-archive';
import {isActivitySite} from '@/lib/activity-types';
export const runtime='nodejs';
export const maxDuration=30;
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:NextRequest,{params}:{params:Promise<{adminPath:string}>}){
 const {adminPath}=await params;if(!adminPathMatches(adminPath))return new Response(null,{status:404});
 if(!verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))return NextResponse.json({error:'로그인이 필요합니다.'},{status:401,headers});
 const query=request.nextUrl.searchParams,site=query.get('site')||'law',days=Number(query.get('days')||1),cursor=query.get('cursor');
 const source=query.get('source')||'database',date=query.get('date')||'';
 let page;
 try{
  if(!isActivitySite(site)||![1,7,30].includes(days)||!['database','archive'].includes(source))throw new Error();
  if(source==='archive')validateArchiveRequest(date,cursor);else page=decodeActivityCursor(cursor);
 }catch{return NextResponse.json({error:'조회 조건이 올바르지 않습니다.'},{status:400,headers})}
 try{
  if(!await claimReportAttempt(requestAddress(request.headers).ip))return NextResponse.json({error:'조회 요청이 많습니다. 잠시 후 다시 시도해주세요.'},{status:429,headers:{...headers,'Retry-After':'60'}});
  const report=source==='archive'?await readActivityArchive(date,site,cursor):await readActivityReport(days,site,page||null);
  return NextResponse.json(report,{headers});
 }catch{console.warn('[private-admin] Activity storage read failed');return NextResponse.json({error:'기록을 불러오지 못했습니다. 과거 기록은 페이지당 1MB 이내에서만 조회합니다.'},{status:503,headers})}
}
