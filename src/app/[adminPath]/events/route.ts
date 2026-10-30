import {NextRequest,NextResponse} from 'next/server';
import {ADMIN_COOKIE,adminPathMatches,verifyAdminSession} from '@/lib/activity-crypto';
import {readActivityReport,claimReportAttempt} from '@/lib/activity-store';
import {requestAddress} from '@/lib/activity-location';
import {decodeActivityCursor} from '@/lib/activity-db';
import {readActivityArchive,validateArchiveRequest} from '@/lib/activity-archive';
import {ACTIVITY_LABELS,isActivitySite} from '@/lib/activity-types';
import {modelRequestAllowed} from '@/lib/model-request-origin';
export const runtime='nodejs';
export const maxDuration=30;
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
async function report(request:NextRequest,{params}:{params:Promise<{adminPath:string}>}){
 const {adminPath}=await params;if(!adminPathMatches(adminPath))return new Response(null,{status:404});
 if(!verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))return NextResponse.json({error:'로그인이 필요합니다.'},{status:401,headers});
 const query=request.nextUrl.searchParams,site=query.get('site')||'law',days=Number(query.get('days')||1),cursor=query.get('cursor');
 const source=query.get('source')||'database',date=query.get('date')||'';
 const action=query.get('action')||'all',location=query.get('location')||'all',order=query.get('order')||'newest';let search='';
 let page;
 try{
  if(!isActivitySite(site)||![1,7,30].includes(days)||!['database','archive'].includes(source))throw new Error();
  if(action!=='all'&&!Object.hasOwn(ACTIVITY_LABELS,action)||!['all','district','missing','high','medium','low'].includes(location)||!['newest','oldest'].includes(order))throw new Error();
  if(request.method==='POST'){
   if(!modelRequestAllowed(request))return NextResponse.json({error:'허용되지 않은 요청입니다.'},{status:403,headers});
   if(Number(request.headers.get('content-length'))>1000)throw new Error();
   const text=await request.text();if(text.length>1000)throw new Error();const body=JSON.parse(text);
   if(typeof body?.search!=='string'||body.search.length>200)throw new Error();search=body.search.trim();
  }
  if(source==='archive')validateArchiveRequest(date,cursor);else page=decodeActivityCursor(cursor);
 }catch{return NextResponse.json({error:'조회 조건이 올바르지 않습니다.'},{status:400,headers})}
 if(source==='archive'&&!process.env.BLOB_READ_WRITE_TOKEN)return NextResponse.json({error:'과거 암호화 기록은 기존 계정에 보존되어 있습니다. 현재 관리자에는 연결되지 않았으며, Blob 조회는 실행하지 않았습니다.'},{status:409,headers});
 try{
  if(!await claimReportAttempt(requestAddress(request.headers).ip))return NextResponse.json({error:'조회 요청이 많습니다. 잠시 후 다시 시도해주세요.'},{status:429,headers:{...headers,'Retry-After':'60'}});
  const result=source==='archive'?await readActivityArchive(date,site,cursor):await readActivityReport(days,site,page||null,{search,action,location,newest:order==='newest'});
  return NextResponse.json({...result,viewerIp:requestAddress(request.headers).ip},{headers});
 }catch{console.warn('[private-admin] Activity storage read failed');return NextResponse.json({error:source==='archive'?'과거 기록을 불러오지 못했습니다. 안전 조회 한도는 페이지당 1MB입니다.':'신규 기록 DB를 조회하지 못했습니다. 잠시 후 조회 새로고침을 눌러주세요.'},{status:503,headers})}
}
export const GET=report;
export const POST=report;
