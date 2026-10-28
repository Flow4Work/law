import {randomUUID} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {ADMIN_COOKIE,adminPathMatches,verifyAdminSession} from '@/lib/activity-crypto';
import {activityLocation,requestAddress,seoulDistrictAt} from '@/lib/activity-location';
import {appendActivity,saveVerifiedDistrict} from '@/lib/activity-store';
import {modelRequestAllowed} from '@/lib/model-request-origin';
export const runtime='nodejs';
export const maxDuration=30;
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
/** The browser's own position is the only signal that can name a district exactly. */
export async function POST(request:NextRequest,{params}:{params:Promise<{adminPath:string}>}){
 const {adminPath}=await params;if(!adminPathMatches(adminPath))return new Response(null,{status:404});
 if(!modelRequestAllowed(request))return new Response(null,{status:403});
 if(!verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value))return NextResponse.json({error:'로그인이 필요합니다.'},{status:401,headers});
 let body;try{body=JSON.parse(await request.text())}catch{return NextResponse.json({error:'위치 정보를 읽지 못했습니다.'},{status:400,headers})}
 const latitude=Number(body?.latitude),longitude=Number(body?.longitude);
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return NextResponse.json({error:'위치 정보를 읽지 못했습니다.'},{status:400,headers});
 const district=seoulDistrictAt(latitude,longitude);
 if(!district)return NextResponse.json({error:'서울 안에서만 구를 확인할 수 있습니다.'},{status:422,headers});
 const ip=requestAddress(request.headers).ip;
 try{
  await saveVerifiedDistrict(ip,district);
  const location=await activityLocation(request.headers,district);
  await appendActivity({id:randomUUID(),at:new Date().toISOString(),...location,action:'location',detail:'브라우저 위치로 구 확인'});
  return NextResponse.json({district,location:location.location},{headers});
 }catch{console.warn('[private-admin] Verified location storage failed');return NextResponse.json({error:'위치를 저장하지 못했습니다.'},{status:503,headers})}
}
