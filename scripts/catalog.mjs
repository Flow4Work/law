const root='http://127.0.0.1:3400';
try{
 const r=await fetch(root+'/api/bootstrap');const x=await r.json();const ms=x.models||[];
 console.log('CONFIGS',ms.map(m=>({id:m.id,provider:m.provider,model:m.model,isDefault:m.isDefault,hasKey:m.hasKey})));
 for(const m of ms.filter(m=>m.hasKey||m.provider==='opencode')){
  const p=await fetch(root+'/api/models',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'catalog',id:m.id,provider:m.provider,baseUrl:m.baseUrl}),signal:AbortSignal.timeout(18000)});
  const j=await p.json();
  console.log('CATALOG',m.provider,'HTTP',p.status,'COUNT',j.models?.length,'CANDIDATES',j.models?.filter(x=>/glm|deepseek|qwen/i.test(x.id)).map(x=>x.id).slice(0,30),'ERROR',String(j.error||'').slice(0,120));
 }
}catch(e){console.log('CATALOG_ERROR',e.message)}
