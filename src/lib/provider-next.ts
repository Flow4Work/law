import 'server-only';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {resolveProvider} from './models';
import {RequestQueue,retryDelay} from './request-queue';
import {classifyModelFailure} from './model-failures';
import {validateModelEndpoint} from './model-endpoint';
export type AIProgress={phase:string;message:string;retryIn?:number};
type Context={modelId?:string;signal?:AbortSignal;onProgress?:(event:AIProgress)=>void};
const context=new AsyncLocalStorage<Context>();
export const withAIContext=<T>(value:Context,task:()=>Promise<T>)=>context.run(value,task);
const runtime=globalThis as typeof globalThis&{legalRequestQueues?:Map<string,RequestQueue>};
const queues=runtime.legalRequestQueues||(runtime.legalRequestQueues=new Map());
export async function getProvider(_options?:unknown){try{return await resolveProvider(context.getStore()?.modelId)}catch{return null}}
const delay=(ms:number,signal?:AbortSignal)=>new Promise<void>((resolve,reject)=>{const abort=()=>{clearTimeout(timer);reject(new Error('요청을 취소했어요.'))};const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},ms);if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true})});
export async function requestAI(prompt:string,content:string,maxTokens=6000,options:{review?:boolean;json?:boolean}={}):Promise<string>{
 const scope=context.getStore();const cfg=await resolveProvider(scope?.modelId);
 const base=cfg.baseUrl.replace(/\/+$/,'');
 await validateModelEndpoint(base);
 const responses=(cfg.provider==='opencode'||cfg.provider==='bai')&&/^gpt-/i.test(cfg.model);
 const url=base+(responses?'/responses':'/chat/completions');
 const messages=[{role:'system',content:prompt},{role:'user',content}];
 const glm53=cfg.provider==='glm'&&/^glm-5\.3(?:-|$)/i.test(cfg.model)&&!/flash/i.test(cfg.model);
 const effort=cfg.effort||'low';
 const body=responses?{model:cfg.model,input:messages,max_output_tokens:maxTokens}:{model:cfg.model,messages,max_tokens:glm53?maxTokens+(effort==='high'||effort==='max'?20000:8000):maxTokens,temperature:0.2,
  ...(glm53?{thinking:{type:'enabled'},reasoning_effort:effort}:cfg.provider==='glm'?{thinking:{type:'disabled'}}:{}),
  ...(options.json&&['glm','openrouter','opencode'].includes(cfg.provider)?{response_format:{type:'json_object'}}:{})};
 const queueKey=createHash('sha256').update(base+'|'+cfg.key).digest('hex');
 let queue=queues.get(queueKey);if(!queue){queue=new RequestQueue();queues.set(queueKey,queue)}
 if(queue.busy)scope?.onProgress?.({phase:'waiting',message:'앞선 요청이 끝나기를 기다리고 있어요. 순서가 되면 이어서 살펴볼게요.'});
 const release=await queue.acquire(scope?.signal);
 try{
  for(let attempt=0;attempt<3;attempt++){
   scope?.signal?.throwIfAborted();
   const timeout=AbortSignal.timeout(effort==='high'||effort==='max'?210000:150000);
   const signal=scope?.signal?AbortSignal.any([scope.signal,timeout]):timeout;
   let response:Response;
   try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...(cfg.key?{Authorization:'Bearer '+cfg.key}:{}),...(cfg.provider==='openrouter'?{'X-Title':'Legal Roadmap'}:{})},body:JSON.stringify(body),signal,cache:'no-store',redirect:'error'})}
   catch{if(scope?.signal?.aborted)throw new Error(scope.signal.reason?.name==='TimeoutError'?'모델 응답이 오래 걸리고 있어요. 다시 시도하거나 다른 모델을 선택해주세요.':'요청을 취소했어요.');throw new Error(timeout.aborted?'모델 응답이 오래 걸리고 있어요. 다시 시도하거나 다른 모델을 선택해주세요.':'모델 서버에 연결하지 못했어요. 연결 설정과 서버 상태를 확인해주세요.')}
   const json=await response.json().catch(()=>({}));
   if(!response.ok){
    const failure=classifyModelFailure(response.status,json,response.headers.get('retry-after'));
    console.warn('[legal-model-request]',{provider:cfg.provider,model:cfg.model,status:response.status,kind:failure.kind,attempt:attempt+1});
    // Free-tier failures may count toward daily usage; do not resend immediately without an upstream retry hint.
    const freeTier=(cfg.provider==='openrouter'&&/:free$/i.test(cfg.model))||(cfg.provider==='opencode'&&/-free$/i.test(cfg.model));
    if(failure.retryable&&attempt<2&&(!freeTier||Boolean(response.headers.get('retry-after')))){
     const wait=retryDelay(response.headers.get('retry-after'),attempt);
     scope?.onProgress?.({phase:'retrying',message:(failure.kind==='capacity'?'모델 서버가 일시적으로 불안정해':'모델 요청 속도 제한으로')+` ${Math.ceil(wait/1000)}초 뒤 다시 시도해요.`,retryIn:Math.ceil(wait/1000)});
     await delay(wait,scope?.signal);
     continue;
    }
    throw new Error(failure.message);
   }
   const output=responses?(json.output_text||json.output?.flatMap((x:any)=>x.content||[]).filter((x:any)=>x.type==='output_text'||x.type==='text').map((x:any)=>x.text||'').join('\n')):json.choices?.[0]?.message?.content;
   if(typeof output!=='string'||!output.trim())throw new Error('모델이 내용을 완성하지 못했어요. 다시 시도하거나 다른 모델을 선택해주세요.');
   return output.trim();
  }
  throw new Error('모델의 응답을 받지 못했어요.');
 }finally{release()}
}
export function parseObject(raw:string):Record<string,any>{const s=raw.trim();try{return JSON.parse(s)}catch{const from=s.indexOf('{'),to=s.lastIndexOf('}');if(from>=0&&to>from)return JSON.parse(s.slice(from,to+1));throw new Error('응답 형식을 완성하지 못했어요.')}}
export async function requestObject(prompt:string,content:string,maxTokens=5000):Promise<Record<string,any>>{
 const raw=await requestAI(prompt,content,maxTokens,{json:true});
 try{return parseObject(raw)}catch{
  context.getStore()?.onProgress?.({phase:'formatting',message:'정리한 내용의 형식을 다듬고 있어요.'});
  const retry=await requestAI(prompt+'\n앞선 응답 형식이 깨졌다. 중복을 줄이고 모든 배열과 객체를 닫아 유효한 JSON만 출력한다. 없는 사실을 보완하지 않는다.',content,maxTokens,{json:true});
  try{return parseObject(retry)}catch{throw new Error('모델이 지도 형식을 완성하지 못했어요. 다시 시도하거나 다른 모델을 선택해주세요.')}
 }
}
