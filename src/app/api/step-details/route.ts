import {NextResponse} from 'next/server';
import {requestObject,withAIContext} from '@/lib/provider';
import {ANALYSIS_VERSION,findAnalysisIssues,normalizeAnalysis,text} from '@/lib/analysis';
import {detailPrompt} from '@/lib/analysis-prompts';
import {getProcedureGuidance} from '@/lib/legal-guidance';
import type {LegalCase,RoadmapNode} from '@/lib/types';
import {procedureStepIssues} from '@/lib/legal-procedure-terms';
export const runtime='nodejs';
export const maxDuration=150;
const procedurePrompt=`대한민국 법률 로드맵에서 선택한 방법의 후속 절차만 정리해요. 제목이 신청·청구·제출로 끝나는 방법 카드를 사용자가 선택했다면 그 행동을 이미 시작한 것으로 취급하고, 후속 steps에는 신청 전 집행 근거·관할 확인, 신청서 작성·제출을 다시 넣지 마세요. 그 내용은 신청 준비 체크리스트에만 속합니다. 이미 신청한 것을 다른 이름의 신청·요구로 다시 단계화하지 마세요. 법원 결정·명령 송달·기일·상대방 대응은 각각 실제로 존재하는 경우만 순서대로 작성하고, 결과에 따라 별도로 신청해야 하는 내용은 outcomes/transition으로 분리하세요. 정식 절차명인지 확인되지 않는 합성어·약칭은 쓰지 마세요. 단계 제목에 괄호를 쓰지 마세요. 제공된 사용자 사실과 공식 안내를 따르고, 사실·기한·결과를 만들어내지 않아요. 절차 공개는 실제 완료를 뜻하지 않아요. 서류 분석이나 주의사항 분석은 하지 않아요. 실제 필요한 절차를 3~5단계, 조건별 가능한 결과와 기존 다른 방법으로 이어지는 선택지를 작성해요. title과 description은 쉬운 해요체로 적어요. JSON만 출력: {"scenario":{"suitableWhen":"","steps":[{"title":"","description":"","condition":""}],"outcomes":[{"title":"","description":"","condition":""}],"transitions":[{"targetId":"기존 방법 ID","condition":""}]}}`;
export async function POST(request:Request){
 let body:any={};try{body=await request.json()}catch{return NextResponse.json({error:'선택한 단계를 읽지 못했어요.'},{status:400})}
 const value=body.case as LegalCase;const id=text(body.id,70);const node=value?.nodes?.find(n=>n.id===id);
 if(!node)return NextResponse.json({error:'이 단계를 다시 선택해 주세요.'},{status:400});
 const procedureOnly=body.purpose==='procedure';
 if(procedureOnly&&node.scenario?.steps.length)return NextResponse.json({node,sources:[]});
 try{return await withAIContext({modelId:value.modelId,signal:request.signal},async()=>{
  const userText=(value.messages||[]).filter(m=>m.role==='user').slice(-10).map(m=>m.content).join('\n');
  const parent=node.scenarioParentId?value.nodes.find(item=>item.id===node.scenarioParentId):undefined;
  const guidance=getProcedureGuidance([userText,parent?.title,parent?.description,node.title,node.description].filter(Boolean).join(' '));
  const sources=Array.from(new Map([...(value.sources||[]),...guidance.sources].map(s=>[s.id,s])).values());
  const context={userText,userFacts:value.facts,selectedStep:node,parentProcedure:parent?{title:parent.title,description:parent.description}:undefined,otherSteps:value.nodes.map(n=>({id:n.id,title:n.title,status:n.status})),officialProcedureNotes:guidance.notes,sources:sources.map(s=>({id:s.id,title:s.title,kind:s.kind,requiredDocuments:s.requiredDocuments,snippet:s.snippet||''}))};
  const normalize=(raw:Record<string,any>):RoadmapNode=>{
   const detail=normalizeAnalysis({nodes:value.nodes.map(n=>n.id===node.id?{...node,...raw,id:node.id,status:node.status}:n),edges:value.edges},undefined,sources).nodes.find(n=>n.id===node.id)!;
   return {...detail,id:node.id,status:node.status,next:node.next,userConfirmed:node.userConfirmed,detailVersion:ANALYSIS_VERSION};
  };
  const prompt=procedureOnly?procedurePrompt:detailPrompt+'\n이번 요청은 하단 준비 영역에서 요청한 서류·비용·주의사항 보완이에요. scenario, title, description은 생성하거나 수정하지 말고 생략해요.';
  let detail=normalize(await requestObject(prompt,JSON.stringify(context),procedureOnly?2200:4000));
  if(procedureOnly){
   let issues=procedureStepIssues(detail.scenario?.steps||[],node.title);
   if(issues.length){
    detail=normalize(await requestObject(prompt,JSON.stringify({...context,previousDraft:detail.scenario,correctionsRequired:issues}),2600));
    issues=procedureStepIssues(detail.scenario?.steps||[],node.title);
   }
   if(!detail.scenario?.steps.length||detail.scenario.steps.some(step=>!step.title.trim()||!step.description?.trim())||issues.length)throw new Error('실제 절차와 중복 여부를 확인하지 못했어요. 다시 시도해 주세요.');
   return NextResponse.json({node:{...node,scenario:detail.scenario},sources});
  }
  const issueInput={answer:'',options:[],nextAction:'',question:'',facts:[],nodes:[detail],edges:[]};
  const issues=findAnalysisIssues(issueInput,userText);
  if(issues.length)detail=normalize(await requestObject(prompt,JSON.stringify({...context,correctionsRequired:issues}),4000));
  if(findAnalysisIssues({...issueInput,nodes:[detail]},userText).length)throw new Error('이 단계의 조건을 더 확인해야 해요. 지도를 다시 정리해 주세요.');
  return NextResponse.json({node:detail,sources});
 })}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'상세 내용을 불러오지 못했어요.'},{status:502})}
}
