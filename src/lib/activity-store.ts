import 'server-only';
import {get,put,list,BlobPreconditionFailedError,BlobNotFoundError} from '@vercel/blob';
import {mkdir,readFile,writeFile,rename,open} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {decryptActivity,encryptActivity,privateIpKey} from './activity-crypto';
import type {ActivityEvent,ActivityReport} from './activity-types';
const cloud=()=>process.env.VERCEL==='1';
const root=path.join(process.cwd(),'data','private-activity');
const day=(at=Date.now())=>new Date(at+9*60*60*1000).toISOString().slice(0,10);
type Journal={events:ActivityEvent[];limited?:boolean};
const conflicts=(error:unknown)=>error instanceof BlobPreconditionFailedError||/already exists|precondition|412|409/i.test(error&&typeof error==='object'&&'message' in error?String(error.message):'');
async function readJournal(key:string):Promise<{value:Journal;etag?:string}>{
 if(!cloud()){try{return {value:decryptActivity<Journal>(await readFile(path.join(root,key+'.enc'),'utf8'))}}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {value:{events:[]}};throw error}}
 try{const result=await get('activity/days/'+key+'.enc',{access:'private',useCache:false});if(!result||result.statusCode!==200)return {value:{events:[]}};return {value:decryptActivity<Journal>(await new Response(result.stream).text()),etag:result.blob.etag}}
 catch(error){if(error instanceof BlobNotFoundError)return {value:{events:[]}};throw error}
}
let queue=Promise.resolve();
export async function appendActivity(event:ActivityEvent){
 const key=day(Date.parse(event.at));
 if(cloud()){
  // Each event has a unique immutable object. Concurrent serverless requests
  // never need to read, overwrite, or retry a shared daily document.
  await put('activity/overflow/'+key+'/'+event.id+'.enc',encryptActivity({events:[event]}),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/octet-stream'});
  return;
 }
 const append=async()=>{
  const {value}=await readJournal(key);
  const next:Journal={events:[...(value.events||[]),event].slice(-2000),limited:value.limited||(value.events||[]).length>=2000};
  await mkdir(root,{recursive:true});const temporary=path.join(root,key+'-'+randomUUID()+'.tmp');
  await writeFile(temporary,encryptActivity(next),{mode:0o600});await rename(temporary,path.join(root,key+'.enc'));
 };
 const task=queue.then(append);
 queue=task.catch(()=>{});return task;
}
export async function readActivityReport(days:number):Promise<ActivityReport>{
 const count=[1,7,30].includes(days)?days:1;
 const journals:Journal[]=[],overflow:{pathname:string;uploadedAt:Date}[]=[];
 let overflowLimited=false;
 for(let start=0;start<count;start+=5)await Promise.all(Array.from({length:Math.min(5,count-start)},async(_,offset)=>{
  const key=day(Date.now()-(start+offset)*86400000);
  journals.push((await readJournal(key)).value);
  if(cloud()){const result=await list({prefix:'activity/overflow/'+key+'/',limit:1000});overflow.push(...result.blobs);overflowLimited||=result.hasMore}
 }));
 const candidates=overflow.sort((a,b)=>new Date(b.uploadedAt).getTime()-new Date(a.uploadedAt).getTime()).slice(0,1000);
 for(let start=0;start<candidates.length;start+=16)journals.push(...await Promise.all(candidates.slice(start,start+16).map(async blob=>{const result=await get(blob.pathname,{access:'private',useCache:false});return result?.statusCode===200?decryptActivity<Journal>(await new Response(result.stream).text()):{events:[]}})));
 const all=Array.from(new Map(journals.flatMap(value=>value.events||[]).map(event=>[event.id,event])).values()).sort((a,b)=>b.at.localeCompare(a.at));
 return {events:all.slice(0,1000),total:all.length,visits:all.filter(event=>event.action==='visit').length,queries:all.filter(event=>event.action==='query').length,uniqueIps:new Set(all.map(event=>event.ip).filter(ip=>ip!=='확인 불가')).size,days:count,generatedAt:new Date().toISOString(),limited:journals.some(value=>value.limited)||all.length>1000||overflowLimited||overflow.length>1000};
}
/** Five login attempts per IP per ten minutes; storage claims remain valid across serverless instances. */
export async function claimAdminAttempt(ip:string){
 const bucket=Math.floor(Date.now()/600000),fingerprint=privateIpKey(ip);
 for(let slot=0;slot<5;slot++){
  const key=`activity/access/${bucket}/${fingerprint}-${slot}`;
  try{
   if(cloud())await put(key,'1',{access:'private',addRandomSuffix:false,allowOverwrite:false});
   else{const dir=path.join(root,'access',String(bucket));await mkdir(dir,{recursive:true});const handle=await open(path.join(dir,fingerprint+'-'+slot),'wx',0o600);await handle.close()}
   return true;
  }catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST'||conflicts(error))continue;throw error}
 }
 return false;
}
