const host='http://127.0.0.1:3700';
const body={message:'전세 보증금을 돌려받지 못하고 있습니다. 계약 만료는 다음 달입니다.'};
const started=Date.now();
try{
  const r=await fetch(host+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(95000)});
  const json=await r.json();
  console.log(JSON.stringify({http:r.status,elapsedSeconds:((Date.now()-started)/1000).toFixed(1),ok:r.ok,hasAnswer:!!json.result?.answer,nodes:json.result?.nodes?.length,edges:json.result?.edges?.length,status:json.evidenceStatus,error:json.error?.slice(0,200),headlines:json.result?.nodes?.map(n=>n.title).slice(0,8)},null,2));
}catch(e){console.error('TEST_FAILED: '+e.message);process.exitCode=1}