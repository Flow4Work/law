import 'server-only';
import {get,put,BlobPreconditionFailedError,BlobNotFoundError} from '@vercel/blob';
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
 const append=async()=>{
  for(let attempt=0;attempt<6;attempt++){
   const {value,etag}=await readJournal(key);
   const next:Journal={events:[...(value.events||[]),event].slice(-2000),limited:value.limited||(value.events||[]).length>=2000};
   const encrypted=encryptActivity(next);
   if(!cloud()){await mkdir(root,{recursive:true});const temporary=path.join(root,key+'-'+randomUUID()+'.tmp');await writeFile(temporary,encrypted,{mode:0o600});await rename(temporary,path.join(root,key+'.enc'));return}
   try{await put('activity/days/'+key+'.enc',encrypted,{access:'private',addRandomSuffix:false,contentType:'application/octet-stream',...(etag?{ifMatch:etag}:{allowOverwrite:false})});return}
   catch(error){if(!conflicts(error)||attempt===5)throw error;await new Promise(resolve=>setTimeout(resolve,40*(attempt+1)))}
  }
 };
 const task=queue.then(append);queue=task.catch(()=>{});return task;
}
export async function readActivityReport(days:number):Promise<ActivityReport>{
 const count=[1,7,30].includes(days)?days:1;
 const journals:Journal[]=[];
 for(let start=0;start<count;start+=5)journals.push(...await Promise.all(Array.from({length:Math.min(5,count-start)},(_,offset)=>readJournal(day(Date.now()-(start+offset)*86400000)).then(result=>result.value))));
 const all=journals.flatMap(value=>value.events||[]).sort((a,b)=>b.at.localeCompare(a.at));
 return {events:all.slice(0,1000),total:all.length,visits:all.filter(event=>event.action==='visit').length,queries:all.filter(event=>event.action==='query').length,uniqueIps:new Set(all.map(event=>event.ip).filter(ip=>ip!=='확인 불가')).size,days:count,generatedAt:new Date().toISOString(),limited:journals.some(value=>value.limited)||all.length>1000};
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
