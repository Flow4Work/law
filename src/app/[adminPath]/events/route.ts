import {NextRequest,NextResponse} from 'next/server';
import {ADMIN_COOKIE,adminPathMatches,verifyAdminSession} from '@/lib/activity-crypto';
import {readActivityReport} from '@/lib/activity-store';
export const runtime='nodejs';
export const maxDuration=30;
export const dynamic='force-dynamic';
export async function GET(request:NextRequest,{params}:{params:Promise<{adminPath:string}>}){
 const {adminPath}=await params;if(!adminPathMatches(adminPath))return new Response(null,{status:404});
 const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
 if(!verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))return NextResponse.json({error:'로그인이 필요합니다.'},{status:401,headers});
 try{return NextResponse.json(await readActivityReport(Number(request.nextUrl.searchParams.get('days')||1)),{headers})}
 catch{console.warn('[private-admin] Activity storage read failed');return NextResponse.json({error:'기록을 불러오지 못했습니다. 다시 시도해주세요.'},{status:503,headers})}
}
