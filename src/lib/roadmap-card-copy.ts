import type {RoadmapNode} from './types';
import {conciseSummary,procedureName} from './concise-copy';

/** A compact action label, never a generic "possible method" badge. */
export function routeKeyword(node:RoadmapNode):string{
 const title=procedureName(node.title,node.description).replace(/\s+/g,' ').trim();
 if(/재산명시/.test(title)&&/재산조회/.test(title))return '재산명시·조회 신청';
 if(/재산명시/.test(title))return '재산명시 신청';
 if(/재산조회/.test(title))return '재산조회 신청';
 if(/노동청|체불임금 진정|임금체불 진정/.test(title))return '노동청 진정';
 if(/지급명령/.test(title))return '지급명령 신청';
 if(/가압류/.test(title))return '가압류 신청';
 if(/압류|추심/.test(title))return /계좌|은행/.test(title)?'계좌 압류 신청':'재산 압류 신청';
 if(/재산.*(찾|조사|확인)/.test(title))return '재산 확인';
 if(/조정|합의점/.test(title))return '법원 조정';
 if(/민사소송|소송으로|소송.*다투/.test(title))return '민사소송';
 if(/형사.*고소|고소장/.test(title))return '형사 고소';
 if(/고발/.test(title))return '고발 신청';
 if(/집행.*(정리|비교|수단)/.test(title))return '집행 방법 정리';
 if(/배당요구/.test(title))return '배당요구 신청';
 if(/내용증명/.test(title))return '내용증명 발송';
 if(/지급.*합의|합의.*지급/.test(title))return '지급 합의';
 if(/이의신청/.test(title))return '이의신청';
 if(/항소/.test(title))return '항소';
 if(/신청|진정|청구|조정|소송/.test(title)&&title.length<=13)return title;
 const short=title.replace(/(으로|해|하기|살펴보기|검토하기|진행하기|요청하기)$/,'').trim();
 return short||'대응 방법';
}

/** Explain what the card does before its eligibility details. */
export function roadmapCardSummary(node:RoadmapNode,branchCondition?:string):string{
 if(!node.description&&!node.summaryLines?.length&&branchCondition)return branchCondition;
 return conciseSummary(node).join(' ');
}

/** 지도 카드에서 짧은 후속 문장은 줄을 나누고, 긴 후속 문장은 자연스럽게 이어 씁니다. */
export function roadmapCardDisplaySummary(node:RoadmapNode,branchCondition?:string):string{
 const sentences=roadmapCardSummary(node,branchCondition).replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s+/);
 // 카드 본문 너비를 한글 약 22자 기준으로 환산합니다. 긴 문장을 강제로 다음 줄에
 // 놓으면 두세 줄을 더 차지하므로 브라우저의 자연스러운 줄바꿈을 사용합니다.
 const visualWidth=(sentence:string)=>Array.from(sentence).reduce((width,char)=>width+(/[가-힣ㄱ-ㅎㅏ-ㅣ一-龯]/.test(char)?1:0.55),0);
 return sentences.reduce((copy,sentence,index)=>copy+(index===0?'':visualWidth(sentence)>22?' ':'\n')+sentence,'');
}

/** 법적으로 독립적인 병행 절차만 지도에 표시합니다. 선행요건이 있는 재산조회는 병행 절차로 분류하지 않습니다. */
export function roadmapParallelNote(node:RoadmapNode,peers:RoadmapNode[]):string|null{
 if(node.kind!=='route'||node.scenarioParentId||node.status==='unavailable')return null;
 const title=procedureName(node.title);
 const siblingTitles=peers.filter(peer=>peer.id!==node.id&&peer.kind==='route'&&!peer.scenarioParentId&&peer.status!=='unavailable').map(peer=>procedureName(peer.title));
 const has=(pattern:RegExp)=>siblingTitles.some(title=>pattern.test(title));
 const disclosure=/재산\s*명시/;
 const inquiry=/재산\s*조회/;
 const seizure=/(?:채권|계좌|예금|급여|부동산|재산).*?(?:압류|추심)|(?:압류|추심).*?(?:신청|명령|진행)/;
 const mainClaim=/(?:민사)?소송|지급명령/;
 // 민사집행법 70조: 확정 등 후 미이행 6개월 경과 또는 명시절차상 불응·거짓목록 등 별도 사유.
 // 재산조회(74조)는 명시절차 관련 요건이 필요하며 무조건 동시신청이 가능한 것은 아닙니다.
 if(/채무불이행자\s*명부|명부\s*등재/.test(title)){
  if(has(disclosure)&&has(inquiry))return '요건 충족 시 재산명시·조회와 병행해요.';
  if(has(disclosure))return '요건 충족 시 재산명시와 병행해요.';
  if(has(inquiry))return '요건 충족 시 재산조회와 병행해요.';
 }
 // 집행 가능한 채권과 압류 대상이 확인된 경우, 재산명시와 압류는 다른 목적의 절차입니다.
 if(!/가압류/.test(title)&&seizure.test(title)&&has(disclosure))return '집행 요건 충족 시 재산명시와 병행해요.';
 if(disclosure.test(title)&&siblingTitles.some(peer=>!/가압류/.test(peer)&&seizure.test(peer)))return '압류할 재산이 있으면 병행 가능해요.';
 // 민사집행법 276·278·311조: 가압류는 본안 제기 전 또는 계속 중 별도로 신청 가능.
 if(/가압류/.test(title)&&has(mainClaim))return has(/소송/)?'요건 충족 시 소송과 병행 가능해요.':'요건 충족 시 지급명령과 병행해요.';
 if(mainClaim.test(title)&&has(/가압류/))return '요건 충족 시 가압류와 병행 가능해요.';
 return null;
}

export function roadmapCardFooter(node:RoadmapNode):string{
 if(node.kind==='situation')return '어떤 방법이 있을까요?';
 if(node.kind==='outcome')return '그다음엔 어떻게 하나요?';
 if(node.kind==='step')return '무엇을 준비하면 되나요?';
 return '어떻게 진행되나요?';
}
