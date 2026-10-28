export type ModelFailure={message:string;retryable:boolean;kind:'rate'|'quota'|'capacity'|'auth'|'invalid'|'server'};
const detailText=(data:unknown):string=>{
 if(!data||typeof data!=='object')return '';
 const outer=data as Record<string,unknown>;
 const error=outer.error&&typeof outer.error==='object'?outer.error as Record<string,unknown>:outer;
 const meta=error.metadata&&typeof error.metadata==='object'?error.metadata as Record<string,unknown>:{};
 return [error.code,error.type,error.message,meta.error_type,meta.raw].filter((v):v is string=>typeof v==='string').join(' ').toLowerCase().slice(0,1500);
};
export function classifyModelFailure(status:number,body:unknown,retryAfter:string|null):ModelFailure{
 const detail=detailText(body);
 if(status===429){
  const exhausted=/insufficient.quota|quota.exceeded|out.of.credits|credit.balance|billing.limit|daily.limit|daily.requests|free.models.per.day|monthly.limit|exceeded.your.quota|payment.required|no.credits|resource.exhausted/.test(detail);
  if(exhausted)return {kind:'quota',retryable:false,message:'선택한 모델의 계정 할당량 또는 크레딧이 부족해 요청할 수 없어요. API 제공자의 사용량을 확인하거나 다른 모델을 선택해주세요. (HTTP 429)'};
  const seconds=retryAfter&&/^\d+(?:\.\d+)?$/.test(retryAfter.trim())?Number(retryAfter):NaN;
  const until=retryAfter&&!Number.isFinite(seconds)?Date.parse(retryAfter)-Date.now():NaN;
  const longWait=Number.isFinite(seconds)?seconds>30:Number.isFinite(until)&&until>30000;
  return {kind:'rate',retryable:!longWait,message:'선택한 모델의 요청 속도 제한이 발생했어요. 잠시 후 다시 시도하거나 다른 모델을 선택해주세요. (HTTP 429)'};
 }
 if(status===503||status===502||status===504||status===500)
  return {kind:'capacity',retryable:true,message:'선택한 모델의 제공자 서버가 일시적으로 응답하지 않아요. 다른 모델을 사용하거나 잠시 후 다시 시도해주세요. (HTTP '+status+')'};
 if(status===401||status===403)return {kind:'auth',retryable:false,message:'선택한 모델의 API 키 또는 이용 권한을 확인해주세요. (HTTP '+status+')'};
 if(status===402)return {kind:'quota',retryable:false,message:'선택한 API의 잔액이나 이용 한도를 확인해주세요. (HTTP 402)'};
 if(status===404)return {kind:'invalid',retryable:false,message:'현재 연결에서 선택한 모델을 찾을 수 없어요. 모델 설정을 확인해주세요. (HTTP 404)'};
 if(status===400||status===422){
  const unsupported=/response.format|json.object|unknown.parameter|unsupported.parameter|unrecognized.request.argument|thinking|temperature|max.tokens|not.supported/.test(detail);
  return {kind:'invalid',retryable:false,message:unsupported?'선택한 모델에서 일부 요청 옵션을 지원하지 않아요. 모델과 요청 형식을 확인해주세요. (HTTP '+status+')':'모델 제공자가 요청 형식을 거절했어요. 모델 설정을 확인해주세요. (HTTP '+status+')'};
 }
 return {kind:'server',retryable:false,message:'모델이 요청을 처리하지 못했어요. (HTTP '+status+')'};
}
