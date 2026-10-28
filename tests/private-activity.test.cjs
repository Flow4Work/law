const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const secret='test-only-private-activity-encryption-secret';
const adminPath='inspect-test-route-with-32-random-characters';
const testPassword='test-password-valid-only';
const salt='test-salt',hash='s1:'+salt+':'+crypto.scryptSync(testPassword,salt,64).toString('hex');
const env={VERCEL:'1',LEGAL_CONNECTION_SECRET:secret,LEGAL_ADMIN_PATH:adminPath,LEGAL_ADMIN_PASSWORD_HASH:hash};
function load(name,overrides={},extra={}){
 const source=fs.readFileSync(path.join(__dirname,'../src/lib',name+'.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};vm.runInNewContext(compiled,{exports,require:id=>id==='server-only'?{}:overrides[id]||(id.startsWith('@/geo/')?require(path.join(__dirname,'../src/geo',id.slice(6))):require(id)),process:{env:{...env,...extra},cwd:()=>'/test-workspace'},Buffer,Headers,Response,Date,setTimeout,console});return exports;
}
test('password-only admin authentication checks the hash and expires signed sessions',()=>{
 const api=load('activity-crypto');
 assert.equal(api.checkAdminPassword(testPassword),true);assert.equal(api.checkAdminPassword('bad'),false);assert.equal(api.checkAdminPassword(null),false);
 assert.equal(api.adminPathMatches(adminPath),true);assert.equal(api.adminPathMatches('admin'),false);
 const now=Date.now(),token=api.createAdminSession(now);
 assert.equal(api.verifyAdminSession(token,now+1000),true);assert.equal(api.verifyAdminSession(token,now+9*3600000),false);
 assert.equal(api.verifyAdminSession(token.slice(0,-6)+'forged',now),false);
 assert.equal(load('activity-crypto',{}, {LEGAL_CONNECTION_SECRET:'a-different-test-secret-at-least-32-characters'}).verifyAdminSession(token),false);
});
test('activity records are authenticated ciphertext and cannot be read with another key',()=>{
 const api=load('activity-crypto'),value={query:'test-only question',ip:'203.0.113.1'};
 const encrypted=api.encryptActivity(value);assert(!encrypted.includes(value.query));assert(!encrypted.includes(value.ip));
 assert.equal(api.decryptActivity(encrypted).query,value.query);
 assert.throws(()=>api.decryptActivity(encrypted.slice(0,-8)+'tampered'));
 assert.throws(()=>load('activity-crypto',{}, {LEGAL_CONNECTION_SECRET:'a-different-test-secret-at-least-32-characters'}).decryptActivity(encrypted));
});
test('IP geolocation uses supplied city data and never invents a Seoul district',()=>{
 const {activityLocation}=load('activity-location');
 const header=new Headers({'x-vercel-forwarded-for':'203.0.113.1','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul'});
 let value=activityLocation(header);assert.equal(value.city,'서울특별시');assert.equal(value.district,'');
 header.set('x-vercel-ip-city','Gangnam-gu');value=activityLocation(header);assert.equal(value.location,'서울특별시 강남구');
 header.set('x-vercel-ip-city',encodeURIComponent('성동구'));assert.equal(activityLocation(header).district,'성동구');
 header.set('x-vercel-ip-country-region','26');header.set('x-vercel-ip-city','Jung-gu');assert.equal(activityLocation(header).district,'');
 assert.equal(activityLocation(new Headers()).location,'지역 확인 불가');
});

test('Seoul postcode evidence takes priority over approximate IP coordinates and marks disagreement',()=>{
 const {activityLocation,seoulPostalDistrict}=load('activity-location');
 assert.equal(seoulPostalDistrict('06090'),'강남구');assert.equal(seoulPostalDistrict('04524'),'중구');
 for(const value of ['6090','99999','00000','06400','04524evil',''])assert.equal(seoulPostalDistrict(value),'');
 const header=new Headers({'x-vercel-forwarded-for':'203.0.113.1','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-postal-code':'06090','x-vercel-ip-latitude':'37.5638','x-vercel-ip-longitude':'126.9976'});
 const value=activityLocation(header);assert.equal(value.district,'강남구');assert.equal(value.districtSource,'ip-postal');assert(value.locationNote.includes('서로 다릅니다'));
 assert.equal('latitude' in value,false);assert.equal('longitude' in value,false);assert.equal('postalCode' in value,false);
 header.set('x-vercel-ip-country','US');assert.equal(activityLocation(header).district,'');
 header.set('x-vercel-ip-country','KR');header.set('x-vercel-ip-country-region','26');header.set('x-vercel-ip-city','Busan');assert.equal(activityLocation(header).district,'');
});

test('published postcode data covers all 25 Seoul districts without filling gaps or overlapping ranges',()=>{
 const ranges=require('../src/geo/seoul-postal-districts.json');
 assert.equal(new Set(ranges.map(row=>row[2])).size,25);
 assert.equal(ranges.reduce((count,[start,end])=>count+end-start+1,0),5634);
 for(let i=0;i<ranges.length;i++){assert(ranges[i][0]<=ranges[i][1]);if(i)assert(ranges[i-1][1]<ranges[i][0])}
});

test('IP points are classified against district polygons; missing, invalid and out-of-city points stay unknown',()=>{
 const {seoulDistrictAt,activityLocation}=load('activity-location');
 assert.equal(seoulDistrictAt(37.5172,127.0473),'강남구');
 assert.equal(seoulDistrictAt(37.4836,127.0327),'서초구');
 assert.equal(seoulDistrictAt(37.5663,126.9019),'마포구');
 assert.equal(seoulDistrictAt(37.5638,126.9976),'중구');
 assert.equal(seoulDistrictAt(35.1796,129.0756),'');assert.equal(seoulDistrictAt(NaN,127),'');
 const header=new Headers({'x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-latitude':'37.5172','x-vercel-ip-longitude':'127.0473'});
 assert.equal(activityLocation(header).district,'강남구');assert.equal(activityLocation(header).districtSource,'ip-coordinate');
 for(const latitude of ['', '0', 'NaN', '37.5junk']){header.set('x-vercel-ip-latitude',latitude);assert.equal(activityLocation(header).district,'')}
 header.delete('x-vercel-ip-latitude');assert.equal(activityLocation(header).district,'');
});
function fakeStore(){
 const entries=new Map();let revision=0;
 class Conflict extends Error{}
 return {entries,api:{BlobPreconditionFailedError:Conflict,BlobNotFoundError:class extends Error{},list:async({prefix})=>({blobs:[...entries.keys()].filter(pathname=>pathname.startsWith(prefix)).map(pathname=>({pathname,uploadedAt:new Date()})),hasMore:false}),get:async key=>{
  const entry=entries.get(key);if(!entry)return null;
  return {statusCode:200,blob:{etag:entry.etag},stream:new Response(entry.body).body};
 },put:async(key,body,options)=>{
  assert.equal(options.access,'private');const old=entries.get(key);
  if(options.ifMatch&&options.ifMatch!==old?.etag)throw new Conflict('precondition');
  if(!options.ifMatch&&options.allowOverwrite===false&&old)throw new Error('already exists');
  entries.set(key,{body,etag:String(++revision)});return {};
 }}};
}
test('parallel serverless writers preserve all events; reports and rate limits share durable storage',async()=>{
 const store=fakeStore(),cipher=load('activity-crypto');
 const modules={'@vercel/blob':store.api,'./activity-crypto':cipher,'node:fs/promises':new Proxy({}, {get:()=>()=>{throw Error('Unexpected filesystem access')}})};
 const first=load('activity-store',modules),second=load('activity-store',modules);
 await Promise.all(Array.from({length:20},(_,i)=>(i%2?first:second).appendActivity({id:String(i),at:new Date().toISOString(),ip:'203.0.113.'+(i%2+1),action:i%2?'query':'visit',detail:'safe test question',city:'',district:'',country:'',location:'지역 확인 불가'})));
 const report=await first.readActivityReport(1);assert.equal(report.total,20);assert.equal(report.visits,10);assert.equal(report.queries,10);assert.equal(report.uniqueIps,2);
 assert(![...store.entries.values()].some(value=>value.body.includes('safe test question')));
 for(let i=0;i<5;i++)assert.equal(await (i%2?first:second).claimAdminAttempt('203.0.113.99'),true);
 assert.equal(await first.claimAdminAttempt('203.0.113.99'),false);
});
test('cloud ingestion never depends on overwriting a shared journal',async()=>{
 const store=fakeStore(),cipher=load('activity-crypto'),original=store.api.put;
 let journalWrites=0;
 store.api.put=async(key,body,options)=>{if(key.startsWith('activity/days/')){journalWrites++;throw Error('temporary shared journal failure')}return original(key,body,options)};
 const api=load('activity-store',{'@vercel/blob':store.api,'./activity-crypto':cipher});
 const event={id:'immutable-fallback-test',at:new Date().toISOString(),ip:'203.0.113.5',action:'query',detail:'test-only preserved question',city:'',district:'',country:'',location:'지역 확인 불가'};
 await api.appendActivity(event);
 assert.equal(journalWrites,0);
 assert.equal(store.entries.size,1);
 assert([...store.entries.keys()][0].startsWith('activity/overflow/'));
 const report=await api.readActivityReport(1);assert.equal(report.total,1);assert.equal(report.events[0].detail,event.detail);
});
