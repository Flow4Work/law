const base='https://www.law.go.kr/DRF/';
for(const [target,query] of [['eflaw','근로기준법'],['prec','퇴직금']]){
 const u=new URL(base+'lawSearch.do');for(const [k,v] of Object.entries({OC:'test',target,type:'JSON',query,display:'3',nw:'3'}))u.searchParams.set(k,v);
 try{
  const r=await fetch(u,{signal:AbortSignal.timeout(15000)});const t=await r.text();const json=JSON.parse(t);const root=json.LawSearch||json.PrecSearch||json;console.log('QUERY',target,query,'STATUS',r.status,'ROOT_KEYS',Object.keys(root||{}),'RESULT_COUNT',root?.totalCnt||root?.['검색결과개수']);
  const item=(root.law||root.prec||root.eflaw||[])[0];console.log('FIRST_KEYS',Object.keys(item||{}),'FIRST_NAME',item?.['법령명한글']||item?.['사건명'], 'DATE',item?.['시행일자']||item?.['선고일자']);
  if(target==='eflaw'&&item){
   const s=new URL(base+'lawService.do');for(const [k,v] of Object.entries({OC:'test',target:'eflaw',type:'JSON',ID:item['법령일련번호']}))s.searchParams.set(k,String(v));
   const p=await fetch(s,{signal:AbortSignal.timeout(15000)});const z=await p.text();console.log('SERVICE',p.status,'LENGTH',z.length,'FIRST',z.slice(0,130));
  }
 }catch(e){console.log('ERROR',target,e.message)}
}