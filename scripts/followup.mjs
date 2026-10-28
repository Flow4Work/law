const host='http://127.0.0.1:3700';
const node=(id,title,status,next)=>({id,title,status,description:title,conditions:[],actions:[],documents:[],cost:'확인 필요',duration:'확인 필요',risks:[],sourceIds:[],next});
const prev={id:'test-case',name:'임금 판결 후 집행',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
 messages:[{id:'1',role:'user',content:'승소 판결이 확정됐습니다. 채권회수 절차를 알려주세요.',createdAt:new Date().toISOString()}],
 nodes:[node('confirmed-judgment','판결 확정','done',['bank-attachment']),node('bank-attachment','예금 압류','done',[])],
 edges:[{source:'confirmed-judgment',target:'bank-attachment'}],facts:['금전 판결 확정','예금 압류 완료'],sources:[],evidenceStatus:'unverified'};
const started=Date.now();
try{
 const r=await fetch(host+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'예금 압류까지 했지만 잔액이 없어 회수하지 못했습니다. 다른 방법은 무엇인가요?',previous:prev}),signal:AbortSignal.timeout(95000)});
 const x=await r.json();
 console.log(JSON.stringify({http:r.status,elapsedSeconds:((Date.now()-started)/1000).toFixed(1),error:x.error,hasAnswer:!!x.result?.answer,
 preservedDone:['confirmed-judgment','bank-attachment'].every(id=>x.result?.nodes?.some(n=>n.id===id&&n.status==='done')),
 nodes:x.result?.nodes?.map(n=>({id:n.id,title:n.title,status:n.status})),edges:x.result?.edges?.length,status:x.evidenceStatus},null,2));
}catch(e){console.log('ERROR',e.message);process.exitCode=1}