import {NextRequest,NextResponse} from 'next/server';
import {ADMIN_COOKIE,adminPathMatches,verifyAdminSession} from '@/lib/activity-crypto';
import {activityDatabaseConfigured,readGuideActivity} from '@/lib/activity-db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};

export async function GET(request:NextRequest,{params}:{params:Promise<{adminPath:string}>}){
 const {adminPath}=await params;
 if(!adminPathMatches(adminPath))return new Response(null,{status:404});
 if(!verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value)){
  return NextResponse.json({error:'로그인이 필요합니다.'},{status:401,headers});
 }
 const days=Number(request.nextUrl.searchParams.get('days')||1);
 if(![1,7,30].includes(days))return NextResponse.json({error:'조회 기간을 확인해 주세요.'},{status:400,headers});
 try{
  const report=!activityDatabaseConfigured()&&process.env.VERCEL!=='1'?{rows:[],events:[]}:await readGuideActivity(days);
  return NextResponse.json({...report,generatedAt:new Date().toISOString()},{headers});
 }catch{
  console.warn('[sph-guide-activity] Report lookup failed');
  return NextResponse.json({error:'가이드 활동을 불러오지 못했습니다.'},{status:503,headers});
 }
}
