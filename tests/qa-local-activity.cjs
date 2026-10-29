// Manual integration check. Refuses non-loopback targets and uses QA credentials only.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const base=process.env.LAW_QA_URL||'http://127.0.0.1:3817';
assert(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const admin='/qa-only-law-admin-route-32-characters';
const send=(url,body,headers={})=>fetch(base+url,{method:'POST',headers:{'content-type':'application/json',origin:base,...headers},body:typeof body==='string'?body:JSON.stringify(body)});
(async()=>{
 assert.equal((await fetch(base+admin+'/events')).status,401);
 assert.equal((await fetch(base+'/invalid-private-path/events')).status,404);
 assert.equal((await send('/api/activity',{action:'visit'},{origin:'https://untrusted.example'})).status,403);
 assert.equal((await send('/api/activity','{bad')).status,400);
 assert.equal((await send('/api/activity','x'.repeat(2001))).status,413);
 assert.equal((await send('/api/activity',{action:'visit',id:'invalid'})).status,400);
 assert.equal((await send(admin+'/access',{password:'wrong-qa-password'})).status,401);
 const login=await send(admin+'/access',{password:'qa-only-password'});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Strict/i);
 const headers={cookie:cookie.split(';')[0]},report=async(query='')=>{
  const response=await fetch(base+admin+'/events?site=law&days=7'+query,{headers});assert.equal(response.status,200);return response.json();
 };
 const before=await report(),id=crypto.randomUUID();
 const payload={action:'query',id,visitorId:crypto.randomUUID(),page:'/qa',detail:'isolated QA query'};
 const geo={'x-vercel-forwarded-for':'203.0.113.99','x-vercel-ip-country':'KR','x-vercel-ip-country-region':'11','x-vercel-ip-city':'Gangnam-gu'};
 assert.equal((await send('/api/activity',payload,geo)).status,204);assert.equal((await send('/api/activity',payload,geo)).status,204);
 const after=await report();assert.equal(after.total,before.total+1);assert.equal(after.queries,before.queries+1);
 assert.equal(after.events.find(event=>event.id===id).district,'강남구');
 const refresh=await report();assert.equal(refresh.total,after.total);
 const other=await fetch(base+admin+'/events?site=portfolio&days=30',{headers});assert.equal(other.status,200);assert.equal((await other.json()).total,0);
 assert.equal((await fetch(base+admin+'/events?site=law&days=999',{headers})).status,400);
 assert.equal((await fetch(base+admin+'/events?cursor=invalid',{headers})).status,400);
 assert.equal((await fetch(base+admin+'/events',{headers:{cookie:'legal-private-admin-v1=forged'}})).status,401);
 console.log(JSON.stringify({result:'PASS',checks:19,total:after.total,queries:after.queries,region:'강남구',deduplicated:true}));
})().catch(error=>{console.error(error);process.exitCode=1});
