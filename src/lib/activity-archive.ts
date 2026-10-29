import 'server-only';
import {get,list} from '@vercel/blob';
import {decryptActivity} from './activity-crypto';
import type {ActivityEvent,ActivityReport,ActivitySite} from './activity-types';
// Explicit, authenticated, read-only history. Never called by event ingestion.
const MAX_BYTES=1024*1024,MAX_FILES=20;
type Position={phase:'daily'|'overflow';offset?:number;cursor?:string};
const cache=new Map<string,{until:number;events:ActivityEvent[]}>();
const pending=new Map<string,Promise<ActivityEvent[]>>();
const pages=new Map<string,{until:number;value:Promise<ActivityReport>}>();
function decode(cursor:string|null):Position{
 if(!cursor)return {phase:'daily',offset:0};
 if(cursor.length>3000)throw new Error('Invalid archive cursor');
 try{const p=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
  if(!['daily','overflow'].includes(p.phase)||p.offset!==undefined&&(!Number.isSafeInteger(p.offset)||p.offset<0||p.offset>100000)||p.cursor!==undefined&&(typeof p.cursor!=='string'||p.cursor.length>2000))throw new Error();return p;
 }catch{throw new Error('Invalid archive cursor')}
}
const encode=(value:Position)=>Buffer.from(JSON.stringify(value)).toString('base64url');
export function validateArchiveRequest(date:string,cursor:string|null){
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(date)||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Invalid archive date');
 decode(cursor);
}
async function readBounded(key:string,size:number):Promise<ActivityEvent[]>{
 const active=pending.get(key);if(active)return active;
 const value=readBoundedOnce(key,size);pending.set(key,value);
 try{return await value}finally{pending.delete(key)}
}
async function readBoundedOnce(key:string,size:number):Promise<ActivityEvent[]>{
 const cached=cache.get(key);if(cached&&cached.until>Date.now())return cached.events;
 if(size>MAX_BYTES)throw new Error('Archive file exceeds safe read budget');
 const result=await get(key,{access:'private',useCache:true});
 if(!result||result.statusCode!==200)throw new Error('Archive unavailable');
 const reader=result.stream.getReader(),chunks:Uint8Array[]=[];let bytes=0;
 try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;
  if(bytes>MAX_BYTES){await reader.cancel();throw new Error('Archive file exceeds safe read budget')}chunks.push(part.value)}}finally{reader.releaseLock()}
 const journal=decryptActivity<{events:ActivityEvent[]}>(Buffer.concat(chunks).toString('utf8'));
 if(!Array.isArray(journal.events))throw new Error('Invalid archive');
 cache.set(key,{until:Date.now()+300000,events:journal.events});while(cache.size>20)cache.delete(cache.keys().next().value!);
 return journal.events;
}
export async function readActivityArchive(date:string,site:ActivitySite,cursor:string|null):Promise<ActivityReport>{
 validateArchiveRequest(date,cursor);const key=JSON.stringify([date,site,cursor]),cached=pages.get(key);
 if(cached&&cached.until>Date.now())return cached.value;
 const value=readArchivePage(date,site,cursor);pages.set(key,{until:Date.now()+60000,value});
 while(pages.size>12)pages.delete(pages.keys().next().value!);
 try{return await value}catch(error){pages.delete(key);throw error}
}
async function readArchivePage(date:string,site:ActivitySite,cursor:string|null):Promise<ActivityReport>{
 validateArchiveRequest(date,cursor);const position=decode(cursor);let events:ActivityEvent[]=[],nextCursor:string|null=null;
 if(position.phase==='daily'){
  const result=await list({prefix:'activity/days/'+date+'.enc',limit:1});
  const file=result.blobs.find(blob=>blob.pathname==='activity/days/'+date+'.enc');
  const all=file?(await readBounded(file.pathname,file.size)).filter(event=>(event.site||'law')===site):[];
  const offset=position.offset||0;events=all.slice(offset,offset+50);
  nextCursor=encode(offset+50<all.length?{phase:'daily',offset:offset+50}:{phase:'overflow'});
 }else{
  const result=await list({prefix:'activity/overflow/'+date+'/',limit:MAX_FILES,cursor:position.cursor});
  // Metadata preflight caps BOTH object count and total bytes before any download.
  if(result.blobs.reduce((sum,file)=>sum+file.size,0)>MAX_BYTES)throw new Error('Archive page exceeds safe read budget');
  for(const file of result.blobs)events.push(...await readBounded(file.pathname,file.size));
  events=Array.from(new Map(events.filter(event=>(event.site||'law')===site).map(event=>[event.id,event])).values());
  if(result.hasMore)nextCursor=encode({phase:'overflow',cursor:result.cursor});
 }
 events.sort((a,b)=>b.at.localeCompare(a.at));
 return {events,total:events.length,visits:events.filter(e=>e.action==='visit').length,queries:events.filter(e=>e.action==='query').length,
  views:events.filter(e=>e.action==='view_step').length,uniqueIps:new Set(events.map(e=>e.ip)).size,days:1,site,
  generatedAt:new Date().toISOString(),limited:!!nextCursor,nextCursor,source:'archive',statisticsScope:'page'};
}
