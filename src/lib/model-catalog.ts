import 'server-only';
import {validateModelEndpoint} from './model-endpoint';

export type CatalogModel={id:string;name:string};
/** Only these two B.AI models may be exposed or selected in this service. */
export const BAI_ALLOWED_MODEL_IDS=['minimax-m3.1-flash','gpt-6-luna'] as const;
export const isAllowedBaiModel=(model:string)=>BAI_ALLOWED_MODEL_IDS.some(id=>id===model);
export function visibleProviderModels(provider:string,catalog:CatalogModel[]):CatalogModel[]{
 if(provider!=='bai')return catalog;
 return BAI_ALLOWED_MODEL_IDS.flatMap(id=>catalog.filter(item=>item.id===id));
}
export function catalogEndpoint(provider:string,baseUrl:string){
  return provider==='opencode'?'https://opencode.ai/inference/v1/models':baseUrl+'/models';
}
export async function listProviderModels(provider:string,baseUrl:string,key:string):Promise<CatalogModel[]>{
  await validateModelEndpoint(baseUrl);
  // Gemini's model directory uses the native ListModels response, while requests use OpenAI-compatible chat.
  if(provider==='gemini'){
    const models:CatalogModel[]=[];
    let pageToken='';
    for(let page=0;page<5;page++){
      const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize','1000');
      if(pageToken)url.searchParams.set('pageToken',pageToken);
      const response=await fetch(url,{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(12000),cache:'no-store',redirect:'error'});
      if(!response.ok){
        if([400,401,403].includes(response.status))throw new Error('Gemini API 키 또는 모델 조회 권한을 확인해주세요.');
        if(response.status===429)throw new Error('Gemini 모델 조회 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
        throw new Error('Gemini 모델 목록 조회에 실패했습니다. (HTTP '+response.status+')');
      }
      const data=await response.json();
      if(!Array.isArray(data.models))throw new Error('Gemini가 모델 목록을 반환하지 않았습니다.');
      for(const item of data.models){
        if(typeof item.name!=='string'||!item.name.startsWith('models/'))continue;
        if(!Array.isArray(item.supportedGenerationMethods)||!item.supportedGenerationMethods.includes('generateContent'))continue;
        const id=item.name.slice(7);
        if(id.length>0&&id.length<=200)models.push({id,name:typeof item.displayName==='string'&&item.displayName.trim()?item.displayName:id});
      }
      pageToken=typeof data.nextPageToken==='string'?data.nextPageToken:'';
      if(!pageToken)break;
    }
    return Array.from(new Map(models.map(m=>[m.id,m])).values());
  }
  const response=await fetch(catalogEndpoint(provider,baseUrl),{
    headers:key?{Authorization:'Bearer '+key}:{},
    signal:AbortSignal.timeout(12000),
    cache:'no-store',redirect:'error'
  });
  if(!response.ok){
    if(response.status===401||response.status===403)throw new Error('모델 목록 조회 권한이 없습니다. API 키 또는 서비스 이용 권한을 확인해주세요.');
    if(response.status===429)throw new Error('요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    throw new Error('모델 목록 조회에 실패했습니다. (HTTP '+response.status+')');
  }
  const result=await response.json();
  if(!Array.isArray(result.data))throw new Error('제공업체가 모델 목록을 반환하지 않았습니다.');
  const items:unknown[]=result.data;
  return items.filter((item):item is {id:string;name?:string}=>!!item&&typeof item==='object'&&typeof (item as {id?:unknown}).id==='string')
    .filter(item=>item.id.length>0&&item.id.length<=200)
    .map(item=>({id:item.id,name:typeof item.name==='string'&&item.name.trim()?item.name:item.id}));
}
