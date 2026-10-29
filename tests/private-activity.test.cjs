const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const secret='test-only-private-activity-encryption-secret';
const adminPath='inspect-test-route-with-32-random-characters';
const testPassword='test-password-valid-only';
const salt='test-salt',hash='s1:'+salt+':'+crypto.scryptSync(testPassword,salt,64).toString('hex');
const env={VERCEL:'1',LEGAL_CONNECTION_SECRET:secret,LEGAL_ADMIN_PATH:adminPath,LEGAL_ADMIN_PASSWORD_HASH:hash};
function load(name,overrides={},extra={},globals={}){
 const source=fs.readFileSync(path.join(__dirname,'../src/lib',name+'.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};vm.runInNewContext(compiled,{exports,require:id=>id==='server-only'?{}:overrides[id]||(id.startsWith('@/geo/')?require(path.join(__dirname,'../src/geo',id.slice(6))):require(id)),process:{env:{...env,...extra},cwd:()=>'/test-workspace'},Buffer,Headers,Response,URL,Date,setTimeout,clearTimeout,console,...globals});return exports;
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
test('IP geolocation uses supplied city data and never invents a Seoul district',async()=>{
 const {activityLocation}=load('activity-location');
 const header=new Headers({'x-vercel-forwarded-for':'203.0.113.1','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul'});
 let value=await activityLocation(header);assert.equal(value.city,'서울특별시');assert.equal(value.district,'');assert.equal(value.locationNote,'이 IP에는 서울 구를 판별할 위치 정보가 없습니다.');
 header.set('x-vercel-ip-city','Gangnam-gu');value=await activityLocation(header);assert.equal(value.location,'서울특별시 강남구');
 header.set('x-vercel-ip-city',encodeURIComponent('성동구'));assert.equal((await activityLocation(header)).district,'성동구');
 header.set('x-vercel-ip-country-region','26');header.set('x-vercel-ip-city','Jung-gu');assert.equal((await activityLocation(header)).district,'');
 assert.equal((await activityLocation(new Headers())).location,'지역 확인 불가');
});

test('Seoul postcode evidence wins over approximate IP coordinates and is confirmed against a district database',async()=>{
 const {activityLocation,seoulPostalDistrict,seoulPostalPrefixDistrict}=load('activity-location');
 assert.equal(seoulPostalDistrict('06090'),'강남구');assert.equal(seoulPostalDistrict('04524'),'중구');
 for(const value of ['6090','99999','00000','06400','04524evil',''])assert.equal(seoulPostalDistrict(value),'');
 assert.equal(seoulPostalPrefixDistrict('018'),'노원구');assert.equal(seoulPostalPrefixDistrict('055'),'송파구');assert.equal(seoulPostalPrefixDistrict('043'),'용산구');
 for(const value of ['18','1800','1','','88x'])assert.equal(seoulPostalPrefixDistrict(value),'');
 const header=new Headers({'x-vercel-forwarded-for':'203.0.113.1','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-postal-code':'06090','x-vercel-ip-latitude':'37.5638','x-vercel-ip-longitude':'126.9976'});
 const alone=await activityLocation(header);
 assert.equal(alone.district,'강남구');assert.equal(alone.districtSource,'ip-postal');assert.equal(alone.districtConfidence,'medium');
 assert(alone.districtEvidence.includes('우편번호 060xx 강남구'));assert(alone.districtEvidence.includes('대표좌표 중구'));
 assert.equal('latitude' in alone,false);assert.equal('longitude' in alone,false);assert.equal('postalCode' in alone,false);
 const agreeing=async url=>({ok:true,json:async()=>({status:'success',countryCode:'KR',region:'11',regionName:'Seoul',city:'Gangnam-gu',zip:'06090',lat:37.5172,lon:127.0473,isp:'Korea Telecom',org:'Kornet',as:'AS4766',mobile:false,proxy:false,hosting:false})});
 const confirmed=await load('activity-location',{},{},{fetch:agreeing}).activityLocation(header);
 assert.equal(confirmed.district,'강남구');assert.equal(confirmed.districtConfidence,'high');
 header.set('x-vercel-ip-country','US');assert.equal((await activityLocation(header)).district,'');
 header.set('x-vercel-ip-country','KR');header.set('x-vercel-ip-country-region','26');header.set('x-vercel-ip-city','Busan');assert.equal((await activityLocation(header)).district,'');
});

test('a city-centre postcode never overrules a district-aware database',async()=>{
 const header=new Headers({'x-vercel-forwarded-for':'112.187.136.60','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-postal-code':'03141','x-vercel-ip-latitude':'37.5665','x-vercel-ip-longitude':'126.9780'});
 const api=load('activity-location',{},{},{fetch:async()=>({ok:true,json:async()=>({status:'success',countryCode:'KR',region:'11',regionName:'Seoul',city:'Seongdong-gu',zip:'047',lat:37.5511,lon:127.0387,isp:'Korea Telecom',org:'Kornet',as:'AS4766',mobile:false,proxy:false,hosting:false})})});
 const value=await api.activityLocation(header);
 assert.equal(value.district,'성동구',"Vercel's Seoul registration postcode must not beat three agreeing database signals");
 assert.equal(value.districtConfidence,'medium');
 assert(value.locationNote.includes('중심 기본값'),value.locationNote);
});

test('a browser-verified district always wins over every IP signal',async()=>{
 const {activityLocation}=load('activity-location');
 const header=new Headers({'x-vercel-forwarded-for':'112.187.136.60','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-postal-code':'03141'});
 const value=await activityLocation(header,'광진구');
 assert.equal(value.location,'서울특별시 광진구');
 assert.equal(value.districtSource,'verified');
 assert.equal(value.districtConfidence,'high');
 assert(value.districtEvidence.includes('브라우저 위치 확인'));
 assert.equal(value.locationNote,'');
});
test('published postcode data covers all 25 Seoul districts without filling gaps or overlapping ranges',()=>{
 const ranges=require('../src/geo/seoul-postal-districts.json');
 assert.equal(new Set(ranges.map(row=>row[2])).size,25);
 assert.equal(ranges.reduce((count,[start,end])=>count+end-start+1,0),5634);
 for(let i=0;i<ranges.length;i++){assert(ranges[i][0]<=ranges[i][1]);if(i)assert(ranges[i-1][1]<ranges[i][0])}
});

test('IP points are classified against district polygons; missing, invalid and out-of-city points stay unknown',async()=>{
 const {seoulDistrictAt,isCityCentrePoint,activityLocation}=load('activity-location');
 assert.equal(seoulDistrictAt(37.5172,127.0473),'강남구');
 assert.equal(seoulDistrictAt(37.4836,127.0327),'서초구');
 assert.equal(seoulDistrictAt(37.5663,126.9019),'마포구');
 assert.equal(seoulDistrictAt(37.5638,126.9976),'중구');
 assert.equal(seoulDistrictAt(35.1796,129.0756),'');assert.equal(seoulDistrictAt(NaN,127),'');
 assert.equal(isCityCentrePoint(37.5665,126.978),true);assert.equal(isCityCentrePoint(37.5172,127.0473),false);
 const header=new Headers({'x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-latitude':'37.5172','x-vercel-ip-longitude':'127.0473'});
 assert.equal((await activityLocation(header)).district,'강남구');assert.equal((await activityLocation(header)).districtSource,'ip-coordinate');
 const centre=new Headers({'x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-latitude':'37.5665','x-vercel-ip-longitude':'126.978'});
 const centreValue=await activityLocation(centre);
 assert.equal(centreValue.district,'',"a shared city-centre point must never be reported as a district");
 assert(centreValue.locationNote.includes('서울 중심점'));
 for(const latitude of ['', '0', 'NaN', '37.5junk']){header.set('x-vercel-ip-latitude',latitude);assert.equal((await activityLocation(header)).district,'')}
 header.delete('x-vercel-ip-latitude');assert.equal((await activityLocation(header)).district,'');
});

test('three databases vote, so a single outlier cannot name the district',async()=>{
 const header=new Headers({'x-vercel-forwarded-for':'112.187.136.60','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-postal-code':'03141','x-vercel-ip-latitude':'37.5665','x-vercel-ip-longitude':'126.9780'});
 const fakeFetch=async url=>{
  const href=String(url);
  if(href.includes('ip-api.com'))return {ok:true,json:async()=>({status:'success',countryCode:'KR',region:'11',regionName:'Seoul',city:'Seongdong-gu',zip:'047',lat:37.5511,lon:127.0387,isp:'Korea Telecom',as:'AS4766',mobile:false,proxy:false,hosting:false})};
  if(href.includes('ip.sb'))return {ok:true,json:async()=>({country_code:'KR',region:'Seoul',region_code:'11',city:'Gwangjin-gu',postal_code:'051',latitude:37.547,longitude:127.0958,isp:'KT',asn:4766})};
  return {ok:true,json:async()=>({countryCode:'KR',regionName:'Seoul',regionCode:'11',cityName:'Jayang-dong',zipCode:'13118',latitude:37.5317,longitude:127.075})};
 };
 const value=await load('activity-location',{},{},{fetch:fakeFetch}).activityLocation(header);
 assert.equal(value.location,'서울특별시 광진구',"two databases must outvote one outlier");
 assert.equal(value.districtConfidence,'medium');
 assert(value.districtEvidence.includes('ip.sb 광진구'),value.districtEvidence);
 assert(value.districtEvidence.includes('ip-api 성동구'),value.districtEvidence);
 assert(!value.districtEvidence.includes('종로구'),'the Seoul registration postcode must stay out of the evidence chain');
 assert(value.locationNote.includes('중심 기본값'),value.locationNote);
 assert.equal(value.isp,'Korea Telecom');
});
test('a provider that fails once is retried, so a tie cannot flip the district between visits',async()=>{
 const header=new Headers({'x-vercel-forwarded-for':'112.187.136.60','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-postal-code':'03141'});
 const body=value=>async()=>value;
 const ipapi={ok:true,json:body({status:'success',countryCode:'KR',region:'11',regionName:'Seoul',city:'Seongdong-gu',zip:'047',lat:37.5511,lon:127.0387,isp:'Korea Telecom',as:'AS4766',mobile:false,proxy:false,hosting:false})};
 const ipsb={ok:true,json:body({country_code:'KR',region:'Seoul',region_code:'11',city:'Gwangjin-gu',postal_code:'051',latitude:37.547,longitude:127.0958,isp:'KT'})};
 const free={ok:true,json:body({countryCode:'KR',regionName:'Seoul',regionCode:'11',cityName:'Jayang-dong',zipCode:'13118',latitude:37.5317,longitude:127.075})};
 let freeCalls=0;
 const api=load('activity-location',{},{},{fetch:async url=>{
  const href=String(url);
  if(href.includes('ip-api.com'))return ipapi;
  if(href.includes('ip.sb'))return ipsb;
  freeCalls++;
  if(freeCalls===1)throw new Error('rate limited');
  return free;
 }});
 const value=await api.activityLocation(header);
 assert.equal(freeCalls,2,'the failed provider is asked once more');
 assert.equal(value.district,'광진구');
});
test('a remembered location is reused without asking the databases again',async()=>{
 const looked=[];const api=load('activity-location',{},{},{fetch:async url=>{looked.push(String(url));throw new Error('offline')}});
 const remembered={country:'KR',city:'서울특별시',district:'광진구',location:'서울특별시 광진구',districtSource:'geo-city',districtConfidence:'medium',districtEvidence:'IP DB ip.sb 광진구',locationNote:'',isp:'Korea Telecom',asn:'AS4766',networkType:'일반 회선',networkRisk:''};
 const value=await api.activityLocation(new Headers({'x-vercel-forwarded-for':'112.187.136.60'}),'',remembered);
 assert.equal(value.location,'서울특별시 광진구');
 assert.equal(value.districtConfidence,'medium');
 assert.equal(value.ip,'112.187.136.60');
 assert.equal(value.ipVersion,'IPv4');
 assert.equal(looked.length,0,'the stored answer is used instead of a fresh lookup');
});
test('an independent district-aware database supplies the district when Vercel reports only the city',async()=>{
 const {activityLocation,requestAddress}=load('activity-location');
 const header=new Headers({'x-vercel-forwarded-for':'121.130.10.20','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul','x-vercel-ip-latitude':'37.5665','x-vercel-ip-longitude':'126.978'});
 const looked=[];const fakeFetch=async url=>{looked.push(String(url));return {ok:true,json:async()=>({status:'success',country:'South Korea',countryCode:'KR',region:'11',regionName:'Seoul',city:'Nowon-gu',district:'',zip:'018',lat:37.6289,lon:127.0648,isp:'Korea Telecom',org:'Kornet',as:'AS4766 Korea Telecom',mobile:false,proxy:false,hosting:false})}};
 const api=load('activity-location',{},{},{fetch:fakeFetch});
 const value=await api.activityLocation(header);
 assert.equal(requestAddress(header).ip,'121.130.10.20');
 assert.equal(value.district,'노원구');
 assert.equal(value.districtSource,'geo-city');
 assert.equal(value.districtConfidence,'medium');
 assert(value.districtEvidence.includes('ip-api 노원구'),value.districtEvidence);
 assert.equal(value.isp,'Korea Telecom');
 assert.equal(value.ipVersion,'IPv4');
 assert.equal(looked.length,3);assert(looked.some(url=>url.includes('ip-api.com/json/121.130.10.20')));assert(looked.some(url=>url.includes('api.ip.sb/geoip/121.130.10.20')));assert(looked.some(url=>url.includes('freeipapi.com/api/json/121.130.10.20')));
 await api.activityLocation(header);assert.equal(looked.length,3,'repeated events reuse the cached lookup');
 const privateHeader=new Headers({'x-forwarded-for':'10.0.0.4'});
 assert.equal(requestAddress(privateHeader).public,false);
 assert.equal((await api.activityLocation(privateHeader)).isp,'');
});

test('a failing or disabled district lookup still records the visitor',async()=>{
 const header=new Headers({'x-vercel-forwarded-for':'121.130.10.20','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Seoul'});
 const off=load('activity-location',{},{LEGAL_IP_LOOKUP:'off'});
 const offValue=await off.activityLocation(header);
 assert.equal(offValue.district,'');assert.equal(offValue.isp,'');assert.equal(offValue.location,'서울특별시');
 const broken=load('activity-location',{},{},{fetch:async()=>{throw new Error('offline')}});
 const brokenValue=await broken.activityLocation(header);
 assert.equal(brokenValue.ip,'121.130.10.20');assert.equal(brokenValue.district,'');
 const erroring=load('activity-location',{},{},{fetch:async()=>({ok:false,json:async()=>null})});
 assert.equal((await erroring.activityLocation(header)).district,'');
});
test('only the tracked sites own origins may post their records',()=>{
 const {portfolioOriginAllowed,mapforyouOriginAllowed}=load('site-origin');
 for(const origin of ['https://leopark-portfolio.vercel.app','https://leopark-portfolio-cpr3hd10a-flow4works-projects.vercel.app','http://localhost:3200','http://127.0.0.1:3200'])assert.equal(portfolioOriginAllowed(origin),true,origin);
 for(const origin of [null,'','https://law-lake-theta.vercel.app','https://leopark-portfolio.vercel.app.evil.test','https://evil-leopark-portfolio.vercel.app','http://localhost.evil.test:3200','null','javascript:alert(1)'])assert.equal(portfolioOriginAllowed(origin),false,String(origin));
 for(const origin of ['https://mapforyou.vercel.app','https://mapforyou-9sk2ld-flow4works-projects.vercel.app','http://localhost:3000','http://127.0.0.1:3000'])assert.equal(mapforyouOriginAllowed(origin),true,origin);
 for(const origin of [null,'','https://law-lake-theta.vercel.app','https://leopark-portfolio.vercel.app','https://mapforyou.vercel.app.evil.test','https://evil-mapforyou.vercel.app','https://mapforyou-vercel-app.attacker.test','http://localhost.evil.test:3000'])assert.equal(mapforyouOriginAllowed(origin),false,String(origin));
 assert.equal(portfolioOriginAllowed('https://mapforyou.vercel.app'),false,'one site cannot write another site tab');
});
test('the map relay endpoint only accepts its own origin and forwards the visitor address untouched',async()=>{
 const seen=[];
 const ingest={ingestActivity:async(request,site)=>{seen.push({site,headers:new Headers(request.headers),body:await request.text()});return new Response(null,{status:204})}};
 const source=fs.readFileSync(path.join(__dirname,'../src/app/api/mapforyou-activity/route.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const route={exports:{}};
 vm.runInNewContext(compiled,{exports:route.exports,require:id=>id==='@/lib/activity-ingest'?ingest:load('site-origin'),process,Request,Headers,Response,URL,console});
 const send=async(headers)=>route.exports.POST(new Request('https://law-lake-theta.vercel.app/api/mapforyou-activity',{method:'POST',headers,body:JSON.stringify({action:'visit',detail:'/'})}));
 assert.equal((await send({origin:'https://evil-mapforyou.vercel.app'})).status,403);
 assert.equal((await send({})).status,403);
 assert.equal(seen.length,0,'a refused origin never reaches the store');
 const accepted=await send({origin:'https://mapforyou.vercel.app','x-visitor-ip':'203.0.113.7','x-visitor-city':'Seoul','x-visitor-country':'KR','x-visitor-region':'11','x-forwarded-for':'198.51.100.9','x-vercel-ip-city':'Busan'});
 assert.equal(accepted.status,204);
 assert.equal(seen.length,1);assert.equal(seen[0].site,'mapforyou');
 assert.equal(seen[0].headers.get('x-vercel-forwarded-for'),'203.0.113.7');
 assert.equal(seen[0].headers.get('x-vercel-ip-city'),'Seoul');
 assert.equal(seen[0].headers.has('x-visitor-ip'),false,'relayed fields are renamed before the store sees them');
 assert.equal(seen[0].body,JSON.stringify({action:'visit',detail:'/'}));
});

test('only the scout own origins may post scout records',()=>{
 const {scoutOriginAllowed,portfolioOriginAllowed,mapforyouOriginAllowed}=load('site-origin');
 for(const origin of ['https://influencer-scout-ten.vercel.app','https://influencer-scout-7z82hxlyd-flow4works-projects.vercel.app','http://localhost:3500','http://127.0.0.1:3500'])assert.equal(scoutOriginAllowed(origin),true,origin);
 for(const origin of [null,'','https://law-lake-theta.vercel.app','https://leopark-portfolio.vercel.app','https://influencer-scout-ten.vercel.app.evil.test','https://evil-influencer-scout-ten.vercel.app','https://influencer-scout-ten-vercel-app.attacker.test','http://localhost.evil.test:3500','javascript:alert(1)'])assert.equal(scoutOriginAllowed(origin),false,String(origin));
 assert.equal(scoutOriginAllowed('https://mapforyou.vercel.app'),false,'one site cannot write another site tab');
 assert.equal(portfolioOriginAllowed('https://influencer-scout-ten.vercel.app'),false);
 assert.equal(mapforyouOriginAllowed('https://influencer-scout-ten.vercel.app'),false);
});

test('the scout relay endpoint only accepts its own origin and forwards the visitor address untouched',async()=>{
 const seen=[];
 const ingest={ingestActivity:async(request,site)=>{seen.push({site,headers:new Headers(request.headers),body:await request.text()});return new Response(null,{status:204})}};
 const source=fs.readFileSync(path.join(__dirname,'../src/app/api/scout-activity/route.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const route={exports:{}};
 vm.runInNewContext(compiled,{exports:route.exports,require:id=>id==='@/lib/activity-ingest'?ingest:load('site-origin'),process,Request,Headers,Response,URL,console});
 const send=async(headers)=>route.exports.POST(new Request('https://law-lake-theta.vercel.app/api/scout-activity',{method:'POST',headers,body:JSON.stringify({action:'visit',detail:'/'})}));
 assert.equal((await send({origin:'https://evil-influencer-scout-ten.vercel.app'})).status,403);
 assert.equal((await send({})).status,403);
 assert.equal(seen.length,0,'a refused origin never reaches the store');
 const accepted=await send({origin:'https://influencer-scout-ten.vercel.app','x-visitor-ip':'203.0.113.8','x-visitor-city':'Seoul','x-visitor-country':'KR','x-visitor-region':'11','x-forwarded-for':'198.51.100.9','x-vercel-ip-city':'Busan'});
 assert.equal(accepted.status,204);
 assert.equal(seen.length,1);assert.equal(seen[0].site,'scout');
 assert.equal(seen[0].headers.get('x-vercel-forwarded-for'),'203.0.113.8');
 assert.equal(seen[0].headers.get('x-vercel-ip-city'),'Seoul');
 assert.equal(seen[0].headers.has('x-visitor-ip'),false,'relayed fields are renamed before the store sees them');
 assert.equal(seen[0].body,JSON.stringify({action:'visit',detail:'/'}));
});
