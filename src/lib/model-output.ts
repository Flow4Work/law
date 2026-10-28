/** Output limits include reasoning on many gateways, not just the visible answer. */
export function outputBudget(provider:string,model:string,visibleTokens:number,json:boolean,effort='low'){
 const visible=json?Math.max(6000,visibleTokens):visibleTokens;
 const reasoning=provider==='bai'||((provider==='opencode')&&/^gpt-/i.test(model))
  ?8192:provider==='glm'&&/^glm-5\.3(?:-|$)/i.test(model)&&!/flash/i.test(model)?(effort==='high'||effort==='max'?20000:8000):0;
 return Math.min(48000,visible+reasoning);
}
const textBlocks=(value:unknown):string=>{
 if(typeof value==='string')return value;
 if(!Array.isArray(value))return '';
 return value.filter(item=>item&&['text','output_text'].includes(item.type)&&typeof item.text==='string').map(item=>item.text).join('\n');
};
export function readModelOutput(data:any,responses:boolean){
 const choice=data?.choices?.[0];
 const output=responses
  ?textBlocks(data?.output_text)||(Array.isArray(data?.output)?data.output.filter((item:any)=>item?.type==='message').map((item:any)=>textBlocks(item.content)).join('\n'):'')
  :textBlocks(choice?.message?.content);
 const usage=data?.usage;
 const reasoningTokens=Number(usage?.output_tokens_details?.reasoning_tokens??usage?.completion_tokens_details?.reasoning_tokens)||0;
 const finishReason=responses?data?.incomplete_details?.reason:choice?.finish_reason;
 const limited=['length','max_tokens','max_output_tokens'].includes(finishReason)
  ||(responses&&data?.status==='incomplete'&&finishReason==null)
  ||(!output.trim()&&(reasoningTokens>0||Boolean(choice?.message?.reasoning_content)||data?.output?.some?.((item:any)=>item?.type==='reasoning')));
 const blocked=finishReason==='content_filter'||(responses&&data?.output?.some?.((item:any)=>item?.content?.some?.((part:any)=>part?.type==='refusal')));
 return {text:output.trim(),limited,blocked,finishReason:typeof finishReason==='string'?finishReason:undefined,status:typeof data?.status==='string'?data.status:undefined,reasoningTokens,outputTokens:Number(usage?.output_tokens??usage?.completion_tokens)||0};
}
export function parseModelObject(raw:string):Record<string,any>{
 const input=raw.trim().replace(/^<think>[\s\S]*?<\/think>\s*/i,'').replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i,'$1').trim();
 const object=(source:string)=>{
  const value=JSON.parse(source);
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('JSON object required');
  return value as Record<string,any>;
 };
 try{return object(input)}catch{
  // Some models prepend an explanation. Never complete broken JSON or invent missing data.
  if(input.startsWith('[')||input.startsWith('"'))throw new Error('응답 형식을 완성하지 못했어요.');
  const from=input.indexOf('{'),to=input.lastIndexOf('}');
  if(from>=0&&to>from)return object(input.slice(from,to+1));
  throw new Error('응답 형식을 완성하지 못했어요.');
 }
}
