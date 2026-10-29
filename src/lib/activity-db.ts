import 'server-only';
import {neon} from '@neondatabase/serverless';
import {decryptActivity,encryptActivity,privateIpKey} from './activity-crypto';
import type {ActivityEvent,ActivityReport,ActivitySite,ActivityLocationSnapshot} from './activity-types';

export const activityDatabaseConfigured=()=>!!process.env.LEGAL_ACTIVITY_DATABASE_URL;
// A LAW-specific variable prevents accidentally using another application's database.
function database(){
 const url=process.env.LEGAL_ACTIVITY_DATABASE_URL;
 if(!url)throw new Error('LAW activity database is not configured');
 return neon(url);
}
export async function appendDatabaseActivity(event:ActivityEvent){
 await database().query(`INSERT INTO law_activity.events(id,at,site,action,ip_key,visitor_key,country,district,payload)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,[
  event.id,event.at,event.site||'law',event.action,privateIpKey(event.ip),
  privateIpKey('visitor|'+(event.visitorId||event.ip)),event.country,event.district,encryptActivity(event)
 ]);
}
export type ActivityPage={at:string;id:string};
export function decodeActivityCursor(value:string|null):ActivityPage|null{
 if(!value)return null;
 if(value.length>500)throw new Error('Invalid cursor');
 try{const parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
  if(typeof parsed.at!=='string'||!Number.isFinite(Date.parse(parsed.at))||typeof parsed.id!=='string'||parsed.id.length>100)throw new Error();
  return {at:parsed.at,id:parsed.id};
 }catch{throw new Error('Invalid cursor')}
}
export async function readDatabaseReport(days:number,site:ActivitySite,cursor:ActivityPage|null=null):Promise<ActivityReport>{
 const start=new Date();start.setUTCHours(15,0,0,0);
 if(start.getTime()>Date.now())start.setUTCDate(start.getUTCDate()-1);
 start.setUTCDate(start.getUTCDate()-(days-1));
 // Aggregates scan indexed metadata in Postgres; only 51 encrypted records leave the DB.
 const rows=await database().query(`WITH selected AS (
 SELECT * FROM law_activity.events WHERE site=$1 AND at>=$2 AND at<=$3
 ), stats AS (SELECT count(*)::int total,count(*) FILTER(WHERE action='visit')::int visits,
 count(*) FILTER(WHERE action='query')::int queries,count(*) FILTER(WHERE action='view_step')::int views,
 count(DISTINCT ip_key) FILTER(WHERE ip_key<>$6)::int "uniqueIps",count(DISTINCT visitor_key)::int visitors FROM selected),
 regions AS (SELECT country,district,count(*)::int total FROM selected GROUP BY country,district),
 owner AS (SELECT (array_agg(payload ORDER BY at DESC))[1] payload FROM law_activity.events
 WHERE at>=$2 AND at<=$3 AND district='광진구' AND ip_key NOT IN ($6,$7) GROUP BY ip_key ORDER BY count(*) DESC,max(at) DESC LIMIT 1),
 page AS (SELECT at,id,payload FROM selected WHERE $4::timestamptz IS NULL OR (at,id)<($4::timestamptz,$5::text)
 ORDER BY at DESC,id DESC LIMIT 51)
 SELECT row_to_json(stats) stats,(SELECT payload FROM owner) owner,COALESCE((SELECT json_agg(regions) FROM regions),'[]'::json) regions,
 COALESCE((SELECT json_agg(page ORDER BY at DESC,id DESC) FROM page),'[]'::json) records FROM stats`,
 [site,start.toISOString(),new Date().toISOString(),cursor?.at||null,cursor?.id||null,privateIpKey('확인 불가'),privateIpKey('127.0.0.1')]);
 const result=rows[0],records=result.records as {at:string;id:string;payload:string}[];
 const hasMore=records.length>50,page=records.slice(0,50),last=page.at(-1);
 return {...result.stats,regions:result.regions,selfIp:result.owner?decryptActivity<ActivityEvent>(result.owner).ip:'',events:page.map(row=>decryptActivity<ActivityEvent>(row.payload)),
  days,site,generatedAt:new Date().toISOString(),limited:hasMore,source:'database',statisticsScope:'period',
  nextCursor:hasMore&&last?Buffer.from(JSON.stringify({at:last.at,id:last.id})).toString('base64url'):null};
}
export async function readDatabaseLocation<T>(ip:string,kind:'verified'|'location'):Promise<T|null>{
 const rows=await database().query('SELECT payload FROM law_activity.locations WHERE key=$1 AND kind=$2 AND (expires IS NULL OR expires>now())',[privateIpKey(ip),kind]);
 return rows[0]?decryptActivity<T>(rows[0].payload):null;
}
export async function saveDatabaseLocation(ip:string,kind:'verified'|'location',value:string|ActivityLocationSnapshot){
 await database().query(`INSERT INTO law_activity.locations(key,kind,payload,expires) VALUES($1,$2,$3,$4)
 ON CONFLICT(key,kind) DO UPDATE SET payload=EXCLUDED.payload,expires=EXCLUDED.expires`,
 [privateIpKey(ip),kind,encryptActivity(value),kind==='location'?new Date(Date.now()+86400000).toISOString():null]);
}
export async function claimDatabaseAttempt(ip:string,kind:'login'|'event'|'report',maximum:number){
 const seconds=kind==='login'?600:60;
 const rows=await database().query('SELECT law_activity.allow_request($1,$2,$3) allowed',[kind+'|'+privateIpKey(ip),Math.floor(Date.now()/(seconds*1000))*seconds,maximum]);
 return rows[0]?.allowed===true;
}
