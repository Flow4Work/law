import 'server-only';
import {mkdir,readFile,writeFile,rename,open} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {decryptActivity,encryptActivity,privateIpKey} from './activity-crypto';
import type {ActivityEvent,ActivityReport,ActivityLocationSnapshot,ActivitySite} from './activity-types';
import {activityDatabaseConfigured,appendDatabaseActivity,readDatabaseReport,readDatabaseLocation,saveDatabaseLocation,claimDatabaseAttempt,type ActivityPage} from './activity-db';
const root=path.join(process.cwd(),'data','private-activity');
const day=(at=Date.now())=>new Date(at+9*3600000).toISOString().slice(0,10);
function localOnly(){if(process.env.VERCEL==='1')throw new Error('LAW activity database is required in production')}
async function readLocal<T>(key:string):Promise<T|null>{
 localOnly();try{return decryptActivity<T>(await readFile(path.join(root,key+'.enc'),'utf8'))}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error}
}
async function writeLocal(key:string,value:unknown){
 localOnly();const filename=path.join(root,key+'.enc');await mkdir(path.dirname(filename),{recursive:true});
 const temporary=filename+'.'+randomUUID()+'.tmp';await writeFile(temporary,encryptActivity(value),{mode:0o600});await rename(temporary,filename);
}
let queue=Promise.resolve();
const reportAttempts=new Map<string,{start:number;count:number}>();
export async function claimReportAttempt(ip:string){
 if(activityDatabaseConfigured())return claimDatabaseAttempt(ip,'report',30);
 localOnly();const now=Date.now(),old=reportAttempts.get(ip);
 if(old&&now-old.start<60000)return ++old.count<=30;
 reportAttempts.set(ip,{start:now,count:1});while(reportAttempts.size>1000)reportAttempts.delete(reportAttempts.keys().next().value!);return true;
}
export async function appendActivity(event:ActivityEvent){
 if(activityDatabaseConfigured())return appendDatabaseActivity(event);
 localOnly();
 const task=queue.then(async()=>{const key=day(Date.parse(event.at)),journal=await readLocal<{events:ActivityEvent[]}>(key)||{events:[]};
  if(!journal.events.some(saved=>saved.id===event.id)){journal.events.push(event);await writeLocal(key,journal)}
 });queue=task.catch(()=>{});return task;
}
export async function readActivityReport(days:number,site:ActivitySite='law',cursor:ActivityPage|null=null):Promise<ActivityReport>{
 if(activityDatabaseConfigured())return readDatabaseReport(days,site,cursor);
 localOnly();const all:ActivityEvent[]=[];
 for(let offset=0;offset<days;offset++)all.push(...(await readLocal<{events:ActivityEvent[]}>(day(Date.now()-offset*86400000)))?.events||[]);
 const events=all.filter(event=>(event.site||'law')===site).sort((a,b)=>b.at.localeCompare(a.at)||b.id.localeCompare(a.id));
 const page=events.filter(event=>!cursor||event.at<cursor.at||event.at===cursor.at&&event.id<cursor.id).slice(0,51),last=page[49];
 return {events:page.slice(0,50),total:events.length,visits:events.filter(e=>e.action==='visit').length,queries:events.filter(e=>e.action==='query').length,
  views:events.filter(e=>e.action==='view_step').length,uniqueIps:new Set(events.map(e=>e.ip)).size,visitors:new Set(events.map(e=>e.visitorId||e.ip)).size,
  days,site,generatedAt:new Date().toISOString(),limited:page.length>50,source:'database',statisticsScope:'period',
  nextCursor:page.length>50?Buffer.from(JSON.stringify({at:last.at,id:last.id})).toString('base64url'):null};
}
export async function readVerifiedDistrict(ip:string){
 return activityDatabaseConfigured()?await readDatabaseLocation<string>(ip,'verified')||'':(await readLocal<{district:string}>('verified/'+privateIpKey(ip)))?.district||'';
}
export async function saveVerifiedDistrict(ip:string,district:string){
 if(activityDatabaseConfigured())return saveDatabaseLocation(ip,'verified',district);
 return writeLocal('verified/'+privateIpKey(ip),{district});
}
export async function readIpLocation(ip:string):Promise<ActivityLocationSnapshot|null>{
 if(activityDatabaseConfigured())return readDatabaseLocation<ActivityLocationSnapshot>(ip,'location');
 const stored=await readLocal<{at:string;snapshot:ActivityLocationSnapshot}>('locations/'+privateIpKey(ip));
 return stored&&Date.now()-Date.parse(stored.at)<86400000?stored.snapshot:null;
}
export async function saveIpLocation(ip:string,snapshot:ActivityLocationSnapshot){
 if(activityDatabaseConfigured())return saveDatabaseLocation(ip,'location',snapshot);
 return writeLocal('locations/'+privateIpKey(ip),{at:new Date().toISOString(),snapshot});
}
export async function claimAdminAttempt(ip:string){
 if(activityDatabaseConfigured())return claimDatabaseAttempt(ip,'login',5);
 localOnly();const bucket=Math.floor(Date.now()/600000),directory=path.join(root,'access',String(bucket));await mkdir(directory,{recursive:true});
 for(let slot=0;slot<5;slot++)try{const handle=await open(path.join(directory,privateIpKey(ip)+'-'+slot),'wx',0o600);await handle.close();return true}
 catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error}
 return false;
}
