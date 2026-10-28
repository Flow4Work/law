import {NextRequest,NextResponse} from 'next/server';
import {ADMIN_COOKIE,adminPathMatches,checkAdminPassword,createAdminSession} from '@/lib/activity-crypto';
import {requestAddress} from '@/lib/activity-location';
import {claimAdminAttempt} from '@/lib/activity-store';
import {modelRequestAllowed} from '@/lib/model-request-origin';
export const runtime='nodejs';
export const maxDuration=30;
type Context={params:Promise<{adminPath:string}>};
export async function POST(request:NextRequest,{params}:Context){
 const {adminPath}=await params;if(!adminPathMatches(adminPath))return new Response(null,{status:404});
 if(!modelRequestAllowed(request))return new Response(null,{status:403});
 let body;try{const text=await request.text();if(text.length>1000)return new Response(null,{status:413});body=JSON.parse(text)}catch{return new Response(null,{status:400})}
 try{
  if(!await claimAdminAttempt(requestAddress(request.headers).ip))return NextResponse.json({error:'로그인 시도가 많습니다. 최대 10분 후 다시 시도해주세요.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':'600'}});
  if(!checkAdminPassword(body?.password))return NextResponse.json({error:'비밀번호가 일치하지 않습니다.'},{status:401,headers:{'Cache-Control':'no-store'}});
  const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set(ADMIN_COOKIE,createAdminSession(),{httpOnly:true,secure:process.env.VERCEL==='1',sameSite:'strict',path:'/'+adminPath,maxAge:8*60*60});
  return response;
 }catch{console.warn('[private-admin] Login storage unavailable');return NextResponse.json({error:'로그인을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
export async function DELETE(request:NextRequest,{params}:Context){
 const {adminPath}=await params;if(!adminPathMatches(adminPath))return new Response(null,{status:404});
 if(!modelRequestAllowed(request))return new Response(null,{status:403});
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 response.cookies.set(ADMIN_COOKIE,'',{httpOnly:true,secure:process.env.VERCEL==='1',sameSite:'strict',path:'/'+adminPath,maxAge:0});return response;
}
