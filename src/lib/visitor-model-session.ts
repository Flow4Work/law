import 'server-only';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {cookies} from 'next/headers';

export type VisitorConnection={id:string;name:string;provider:string;model:string;baseUrl:string;key:string;effort?:'low'|'high'|'max'};
export type VisitorModelSession={connections:VisitorConnection[];hiddenModels:string[]};
export const VISITOR_MODEL_COOKIE='legal-model-connections-v1';
const empty=():VisitorModelSession=>({connections:[],hiddenModels:[]});
function secret(){
 const value=process.env.LEGAL_CONNECTION_SECRET;
 if(!value||value.length<32)throw new Error('개인 API 연결 저장을 준비하고 있어요. 잠시 후 다시 시도해주세요.');
 return createHash('sha256').update(value).digest();
}
export function sealModelSession(value:VisitorModelSession){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',secret(),iv);
 const encrypted=Buffer.concat([cipher.update(deflateRawSync(Buffer.from(JSON.stringify(value)))),cipher.final()]);
 const token=Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
 if(token.length>3700)throw new Error('이 브라우저에 저장할 수 있는 연결 용량을 넘었어요. 사용하지 않는 연결을 삭제해주세요.');
 return token;
}
export function openModelSession(token:string):VisitorModelSession{
 try{
  if(token.length>3700)return empty();
  const bytes=Buffer.from(token,'base64url');
  const cipher=createDecipheriv('aes-256-gcm',secret(),bytes.subarray(0,12));
  cipher.setAuthTag(bytes.subarray(12,28));
  const value=JSON.parse(inflateRawSync(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]),{maxOutputLength:32768}).toString('utf8'));
  if(!Array.isArray(value.connections)||!Array.isArray(value.hiddenModels))return empty();
  const connections=value.connections.filter((item:unknown):item is VisitorConnection=>{
   if(!item||typeof item!=='object')return false;
   const entry=item as Record<string,unknown>;
   return ['id','name','provider','model','baseUrl','key'].every(field=>typeof entry[field]==='string')&&String(entry.id).startsWith('visitor:');
  }).slice(0,8);
  return {connections,hiddenModels:value.hiddenModels.filter((id:unknown)=>typeof id==='string'&&id.startsWith('visitor:')).slice(0,64)};
 }catch{return empty()}
}
export async function readVisitorModels(){
 const store=await cookies();
 const token=store.get(VISITOR_MODEL_COOKIE)?.value;
 return token?openModelSession(token):empty();
}
export async function writeVisitorModels(value:VisitorModelSession){
 if(value.connections.length>8)throw new Error('개인 연결은 최대 8개까지 저장할 수 있어요. 사용하지 않는 연결을 삭제해주세요.');
 const store=await cookies();
 store.set(VISITOR_MODEL_COOKIE,sealModelSession(value),{httpOnly:true,secure:process.env.VERCEL==='1',sameSite:'lax',path:'/',maxAge:60*60*24*30});
}
