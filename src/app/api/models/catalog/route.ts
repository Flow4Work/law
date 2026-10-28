import {NextResponse} from 'next/server';
import {modelRequestAllowed} from '@/lib/model-request-origin';
import {findConfiguredProvider,validBaseUrl,validLocalBaseUrl} from '@/lib/models';
import {listProviderModels} from '@/lib/model-catalog';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!modelRequestAllowed(request))return NextResponse.json({error:'이 서비스 화면에서 확인해주세요.'},{status:403});
 try{
  const body=await request.json();
  if(!body||typeof body!=='object')throw new Error('API 연결 정보를 입력해주세요.');
  const existing=typeof body.connectionId==='string'&&body.connectionId?await findConfiguredProvider(body.connectionId):null;
  const provider=existing?.provider||body.provider;
  const base=existing?.baseUrl||(provider==='openrouter'?'https://openrouter.ai/api/v1':provider==='bai'?'https://api.b.ai/v1':provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/openai':provider==='opencode'?'https://opencode.ai/inference/openai/v1':provider==='local'?validLocalBaseUrl(String(body.baseUrl||'')):validBaseUrl(String(body.baseUrl||'')));
  const key=existing?.key||(typeof body.key==='string'?body.key.trim():'');
  if(!existing&&provider!=='local'&&provider!=='opencode'&&!key)return NextResponse.json({error:'API 키를 입력해주세요.'},{status:400});
  return NextResponse.json({models:await listProviderModels(provider,base,key)});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'모델 목록을 가져오지 못했습니다.'},{status:400})}
}
