import 'server-only';
import type {LegalSource} from './types';

const now=()=>new Date().toISOString();
function arrayish(o:any,key:string):any[]{
  const raw=o?.[key];
  if(Array.isArray(raw))return raw;
  if(raw && typeof raw==='object')return [raw];
  return [];
}
function safe(v:unknown):string{return typeof v==='string'?v.trim():v==null?'':String(v).trim()}
export async function fetchLegalSources(keywords:{laws:string[];precedents:string[]}):Promise<{sources:LegalSource[];texts:string[];checked:boolean;error?:string}>{
 const oc=process.env.LAW_API_OC?.trim();
 if(!oc)return {sources:[],texts:[],checked:false,error:'국가법령정보센터 인증값(LAW_API_OC)이 없어 실시간 공식 법령·판례 조회가 아직 연결되지 않았습니다.'};
 const queries=[...keywords.laws.slice(0,3).map(q=>({q,target:'eflaw' as const})),...keywords.precedents.slice(0,2).map(q=>({q,target:'prec' as const}))].filter(x=>x.q&&x.q.length<70);
 if(!queries.length)return {sources:[],texts:[],checked:false,error:'검색할 법령과 판례 키워드를 추출하지 못했습니다.'};
 const collected:LegalSource[]=[]; const texts:string[]=[];let success=0;let errors=0;
 await Promise.all(queries.map(async ({q,target})=>{
   const u=new URL('https://www.law.go.kr/DRF/lawSearch.do');
   u.searchParams.set('OC',oc);u.searchParams.set('target',target);u.searchParams.set('type','JSON');
   u.searchParams.set('query',q);u.searchParams.set('display','5');u.searchParams.set('search','1');
   if(target==='eflaw')u.searchParams.set('nw','3');
   try{
     const response=await fetch(u,{signal:AbortSignal.timeout(12000),cache:'no-store'});
     if(!response.ok)throw Error('HTTP '+response.status);
     const raw=await response.text();
     const json=JSON.parse(raw);
     const root=json?.LawSearch||json?.PrecSearch||json;
     const entries=target==='prec'?arrayish(root,'prec'):arrayish(root,'law').concat(arrayish(root,'eflaw'));
     if(!entries.length&&(/인증|오류|error/i.test(raw.slice(0,500))))throw Error('API 인증 또는 결과 처리 실패');
     success++;
     for(const x of entries.slice(0,3)){
       const id=safe(x?.['판례일련번호']||x?.['판례정보일련번호']||x?.['법령일련번호']||x?.['법령ID']);
       const title=safe(target==='prec'?(x?.['사건명']||x?.['판례명']):(x?.['법령명한글']||x?.['법령명']));
       if(!id||!title)continue;
       const url=target==='prec'?'https://www.law.go.kr/LSW/precInfoP.do?precSeq='+encodeURIComponent(id)
         :'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq='+encodeURIComponent(id);
       const source:LegalSource={id:(target==='prec'?'prec-':'law-')+id,title,url,kind:target==='prec'?'판례':'법령',
         date:safe(target==='prec'?x?.['선고일자']:x?.['공포일자']),
         effectiveDate:safe(x?.['시행일자']),verifiedAt:now()};
       collected.push(source);
       texts.push(source.id+' | '+source.title+' | '+source.kind+' | '+(source.effectiveDate||source.date||'날짜 확인 필요'));
     }
   }catch{errors++}
 }));
 const unique=Array.from(new Map(collected.map(s=>[s.id,s])).values()).slice(0,12);
 return {sources:unique,texts,checked:success>0,error:errors>0?'일부 공식 자료 조회가 실패했습니다.':''};
}