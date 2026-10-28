import {NextResponse} from 'next/server';
import {deleteConnection,deleteModel,getModelInventory,saveConnection} from '@/lib/models';
import {modelRequestAllowed} from '@/lib/model-request-origin';
export const runtime='nodejs';
const sameOrigin=modelRequestAllowed;
export async function GET(request:Request){
 return NextResponse.json(await getModelInventory(new URL(request.url).searchParams.has('refresh')),{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'이 서비스 화면에서 연결해주세요.'},{status:403});
 try{const id=await saveConnection(await request.json());return NextResponse.json({id,...await getModelInventory(true)})}
 catch(error){return NextResponse.json({error:error instanceof Error?error.message:'연결을 저장하지 못했습니다.'},{status:400})}
}
export async function DELETE(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'이 서비스 화면에서 삭제해주세요.'},{status:403});
 try{const body=await request.json();
  if(typeof body.modelId==='string')await deleteModel(body.modelId);
  else if(typeof body.connectionId==='string')await deleteConnection(body.connectionId);
  else throw new Error('삭제할 모델 또는 연결을 선택해주세요.');
  return NextResponse.json(await getModelInventory(true));
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'연결을 삭제하지 못했습니다.'},{status:400})}
}
