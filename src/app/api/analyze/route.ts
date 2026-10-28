import {NextResponse} from 'next/server';
import {requestObject,getProvider,withAIContext,type AIProgress} from '@/lib/provider';
import {fetchLegalSources} from '@/lib/sources';
import {ANALYSIS_VERSION,applyReview,findAnalysisIssues,normalizeAnalysis,strings,text} from '@/lib/analysis';
import {reviewPrompt} from '@/lib/analysis-prompts';
import {fastMapPrompt} from '@/lib/fast-map-prompt';
import {getProcedureGuidance} from '@/lib/legal-guidance';
import type {LegalCase} from '@/lib/types';
export const runtime='nodejs';
export const maxDuration=600;
function preliminaryLawQueries(input:string){
 const queries:string[]=[];
 if(/보증금|임대차|전세|월세|집주인/.test(input))queries.push('주택임대차보호법','민법 임대차 보증금 반환');
 if(/임금|월급|퇴직금|급여|체불/.test(input))queries.push('근로기준법 임금체불','근로자퇴직급여 보장법');
 if(/폭행|스토킹|경찰|고소|수사|불송치/.test(input))queries.push('형법 폭행','스토킹범죄의 처벌 등에 관한 법률');
 if(/빌려|대여금|돈을 못 받|돈을 돌려|지급명령/.test(input))queries.push('민법 대여금 반환','민사소송법 지급명령');
 if(/해고|부당해고/.test(input))queries.push('근로기준법 해고','노동위원회 부당해고 구제');
 return Array.from(new Set(queries)).slice(0,3);
}
export async function GET(){const cfg=await getProvider({preferConfiguredModel:true});return NextResponse.json({aiConnected:!!cfg,model:cfg?.model||null,modelSource:cfg?.source||null,lawApiConnected:!!process.env.LAW_API_OC,analysisVersion:ANALYSIS_VERSION})}
export async function POST(request:Request){
 let body:any={};try{body=await request.json()}catch{return NextResponse.json({error:'입력한 내용을 읽지 못했어요.'},{status:400})}
 const message=text(body.message,7000);if(!message)return NextResponse.json({error:'상황을 입력해 주세요.'},{status:400});
 const previous=body.previous&&typeof body.previous==='object'?body.previous as LegalCase:undefined;
 const controller=new AbortController();
 const signal=AbortSignal.any([request.signal,controller.signal]);
 const run=async(notify:(event:AIProgress)=>void)=>withAIContext({modelId:typeof body.modelId==='string'?body.modelId:undefined,signal,onProgress:notify},async()=>{
  notify({phase:'analyzing',message:'이야기를 읽고 가능한 방법과 갈라지는 상황을 정리하고 있어요.'});
  const history=(previous?.messages||[]).filter(m=>!m.error).slice(-14).map(m=>({role:m.role,content:m.content}));
  const lastUserMessage=history.filter(m=>m.role==='user').at(-1)?.content;
  const refreshingExisting=body.refresh===true&&lastUserMessage===message;
  const userText=[...history.filter(m=>m.role==='user').map(m=>m.content),...(refreshingExisting?[]:[message])].join('\n');
  const guidance=getProcedureGuidance(userText);
  let sources=guidance.sources;
  const context={newMessage:refreshingExisting?'기존 상황과 진행 내용을 다시 점검해 주세요.':message,history,userFacts:previous?.facts||[],existingNodes:previous?.nodes||[],existingEdges:previous?.edges||[],userProgress:previous?.progress||{},
   officialProcedureNotes:guidance.notes,sources:sources.map(s=>({id:s.id,title:s.title,kind:s.kind,requiredDocuments:s.requiredDocuments,effectiveDate:s.effectiveDate,snippet:s.snippet||'',isFullText:false})),
   today:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),refresh:body.refresh===true};
  const preliminaryQueries=preliminaryLawQueries(userText);
  const preliminarySearch=preliminaryQueries.length?fetchLegalSources({laws:preliminaryQueries,precedents:[]}):null;
  const rawDraft=await requestObject(fastMapPrompt,JSON.stringify(context),2500);
  notify({phase:'sources',message:'관련 법령과 연결된 공식 안내를 확인하고 있어요.'});
  const preliminary=preliminarySearch?await preliminarySearch:{sources:[],texts:[],checked:false};
  const modelLaws=strings(rawDraft.sourceQueries?.laws,4,80);
  const modelPrecedents=strings(rawDraft.sourceQueries?.precedents,2,80);
  const additionalLaws=modelLaws.filter(query=>!preliminaryQueries.some(base=>base.toLowerCase()===query.toLowerCase()||base.toLowerCase().includes(query.toLowerCase())||query.toLowerCase().includes(base.toLowerCase())));
  const sourceTask=(async()=>{
   const needsTailoredSearch=!preliminaryQueries.length||!preliminary.sources.length||additionalLaws.length>0||modelPrecedents.length>0;
   if(!needsTailoredSearch)return preliminary;
   const tailored=await fetchLegalSources({laws:preliminary.sources.length?additionalLaws.slice(0,1):modelLaws.slice(0,3),precedents:modelPrecedents.slice(0,1)});
   return {sources:Array.from(new Map([...preliminary.sources,...tailored.sources].map(s=>[s.id,s])).values()),texts:[...preliminary.texts,...tailored.texts],checked:preliminary.checked||tailored.checked,error:tailored.error||preliminary.error};
  })();
  const provisionalSources=[...guidance.sources,...preliminary.sources];
  const draft=normalizeAnalysis(rawDraft,previous,provisionalSources);
  const structuralIssues=findAnalysisIssues(draft,userText);
  // 일반 사건은 빠르게 반환하고, 처분·강제집행·기한처럼 위험한 사건이나 구조 오류만 AI 재검토한다.
  const reviewNeeded=structuralIssues.length>0
   ||/불송치|불기소|약식명령|기소|고소|수사|폭행|스토킹|형사|강제집행|압류|경매|소멸시효|제소기간|법정기한/.test(userText)
   ||draft.nodes.some(n=>n.kind==='route'&&(!n.scenario?.steps.length||!n.scenario?.outcomes.length));
  const reviewContext={userText,officialProcedureNotes:guidance.notes,sources:provisionalSources.map(s=>({id:s.id,title:s.title,kind:s.kind,requiredDocuments:s.requiredDocuments,snippet:s.snippet||''})),draft};
  if(reviewNeeded)notify({phase:'reviewing',message:'처분과 절차상 중요한 부분을 한 번 더 검토하고 있어요.'});
  const [retrieved,review]=await Promise.all([sourceTask,reviewNeeded?requestObject(reviewPrompt,JSON.stringify(reviewContext),1600):Promise.resolve({} as Record<string,any>)]);
  sources=Array.from(new Map([...retrieved.sources,...guidance.sources].map(s=>[s.id,s])).values());
  let generated=normalizeAnalysis(rawDraft,previous,sources);
  const issues=[...structuralIssues,...strings(review.issues,6,600)];
  generated=normalizeAnalysis(applyReview(rawDraft,review),previous,sources);
  const reviewHasChanges=review.nodeUpdates?.length||review.removeNodeIds?.length||review.addNodes?.length||Array.isArray(review.edges)||typeof review.answer==='string'||Array.isArray(review.options)||typeof review.question==='string'||Array.isArray(review.openQuestions)||Array.isArray(review.followUpQuestions);
  if(findAnalysisIssues(generated,userText).length||(issues.length&&!reviewHasChanges)){generated=normalizeAnalysis(await requestObject(fastMapPrompt,JSON.stringify({...context,draft:generated,correctionsRequired:issues}),2500),previous,sources)}
  const remaining=findAnalysisIssues(generated,userText);
  if(remaining.length)throw new Error('안내할 기관이나 절차에 확인할 내용이 남아 있어요. 통지서 종류나 사건 진행 상황을 더 알려주거나 다시 정리해 주세요.');
  if(!generated.nodes.length||!generated.answer)throw new Error('선택지를 완성하지 못했어요. 다시 정리해 주세요.');
  return {result:generated,sources,evidenceStatus:sources.length?'partial':'unverified',checkedAt:new Date().toISOString(),analysisVersion:ANALYSIS_VERSION,reviewed:reviewNeeded,corrected:issues.length>0,modelUsed:(await getProvider())?.id};
 });
 if(body.stream===true){
  const encoder=new TextEncoder();
  const stream=new ReadableStream({start(output){
   let closed=false;
   const send=(event:unknown)=>{if(!closed&&!signal.aborted)try{output.enqueue(encoder.encode('data: '+JSON.stringify(event)+'\n\n'))}catch{closed=true}};
   const heartbeat=setInterval(()=>{if(!closed&&!signal.aborted)try{output.enqueue(encoder.encode(': keepalive\n\n'))}catch{closed=true}},15000);
   run(event=>send({type:'status',...event})).then(data=>send({type:'result',...data})).catch(error=>send({type:'error',error:error instanceof Error?error.message:'정리하는 중 문제가 생겼어요.'})).finally(()=>{clearInterval(heartbeat);if(!closed){closed=true;try{output.close()}catch{}}});
  },cancel(){controller.abort()}});
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
 }
 try{return NextResponse.json(await run(()=>{}))}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'정리하는 중 문제가 생겼어요.'},{status:502})}
}
