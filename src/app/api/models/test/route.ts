import {NextResponse} from 'next/server';
import {modelRequestAllowed} from '@/lib/model-request-origin';
import {withAIContext,requestAI} from '@/lib/provider';
export const runtime='nodejs';
export const maxDuration=240;
export async function POST(request:Request){
 if(!modelRequestAllowed(request))return NextResponse.json({error:'이 서비스 화면에서 확인해주세요.'},{status:403});
 try{const body=await request.json();const result=await withAIContext({modelId:body.modelId,signal:request.signal},()=>requestAI('연결 점검 요청입니다. 한국어로 연결 완료라고 짧게 답하세요.','연결 점검',100));return NextResponse.json({ok:true,message:result.slice(0,100)})}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'연결을 확인하지 못했어요.'},{status:502})}
}
