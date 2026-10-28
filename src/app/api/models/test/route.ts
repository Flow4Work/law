import {NextResponse} from 'next/server';
import {modelRequestAllowed} from '@/lib/model-request-origin';
import {withAIContext,requestObject} from '@/lib/provider';
export const runtime='nodejs';
export const maxDuration=240;
export async function POST(request:Request){
 if(!modelRequestAllowed(request))return NextResponse.json({error:'이 서비스 화면에서 확인해주세요.'},{status:403});
 try{
  const body=await request.json();
  const result=await withAIContext({modelId:body.modelId,signal:AbortSignal.any([request.signal,AbortSignal.timeout(220000)])},()=>requestObject('연결 점검 요청입니다. 유효한 JSON 객체 {"message":"연결 완료"}만 짧게 출력하세요.','JSON 응답 연결 점검',256));
  if(typeof result.message!=='string'||!result.message.trim())throw new Error('모델이 JSON 응답을 완성하지 못했어요. 다른 모델을 선택해주세요.');
  return NextResponse.json({ok:true,message:result.message.trim().slice(0,100)});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'연결을 확인하지 못했어요.'},{status:502})}
}
