import type {RoadmapNode} from '@/lib/types';
import {nodeDuration} from '@/lib/legal-copy';
import {procedureGroupTitle} from '@/lib/legal-procedure-terms';

/**
 * 지도 카드와 우측 상세의 단일 기간 산정 경로.
 * 법정 대응 기한 / 기관의 처리기한 / 통계·실무상 예상 기간을 구별한다.
 * 세부 단계에 독립된 통계가 없으면 상위 절차의 '전체' 기간임을 명시한다.
 * 자료가 없는 사건에는 임의의 주·개월 수를 만들어 넣지 않는다.
 */
export type CardPeriod={
 label:string;
 category:'estimate'|'deadline'|'variable';
 note:string;
 sourceUrl?:string;
 sourceName?:string;
};

const COURT_PAYMENT='https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=1&cciNo=2&cnpClsNo=1&csmSeq=239';
const PAYMENT_PRACTICE='https://www.lawfirmkb.com/bbs/board.php?bo_table=QnA&wr_id=1102';
const PAYMENT_STEPS='https://www.lawfirmkb-school.com/bbs/board.php?bo_table=QnA&page=61&wr_id=1088';
const MEDIATION_COURT='https://busan.scourt.go.kr/bsgodung/intro/intro_12/intro_12_02/index.html';
const MEDIATION_PRACTICE='https://frontierlaw.co.kr/yongin/expertise/civil-litigation/loan-recovery-litigation/';
const CIVIL_STATS='https://www.scourt.go.kr/portal/news/NewsViewAction.work?gubun=719&pageIndex=1&searchOption=&searchWord=&seqnum=12';
const CIVIL_TIMING='https://www.law.go.kr/LSW/lsInfoP.do?ancNo=21993&ancYd=20260929&efYd=20261002&lsiSeq=290113';
const LABOR='https://labor.moel.go.kr/minwonSysInfo/wagesolway.do';
const LABOR_CALL='https://www.easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=6&cciNo=2&cnpClsNo=3&csmSeq=514&menuType=qna&popMenu=ov';
const DISCLOSURE='https://www.lawtalk.co.kr/qna/588595';
const DISCLOSURE_STAGE='https://www.ikhoss.com/property-disclosure-order-application/';
const DISCLOSURE_COURT='https://www.scourt.go.kr/nm/minwon/faq/FaqViewAction.work?gubun=13&mode=A&pageIndex=1&pageIndexB=1&search_gubun=13&seqnum=1822';
const INQUIRY_COURT='https://www.scourt.go.kr/nm/minwon/faq/FaqViewAction.work?bulletinid=4682&functioncode=2450&mode=B';
const INQUIRY_PRACTICE='https://blog.ehyun.co.kr/debtors-asset-inquiry-application-guide';
const ATTACHMENT='https://albup.co.kr/page/column_detail.php?content_id=872';
const COLLECTION_LAW='https://korea.legal/wiki/%EC%B1%84%EA%B6%8C%EC%95%95%EB%A5%98-%EB%B0%8F-%EC%B6%94%EC%8B%AC%EB%AA%85%EB%A0%B9/';
const PROVISIONAL='https://www.a-ha.io/questions/403b8e1b9f9b0accad196db4c1fd39ec';
const WAGE_CONFIRM='https://labor.moel.go.kr/minwonApply/minwonFormat.do?searchGubun=1&searchVal=AD027&urlAddr=%2FminwonRqst%2FAD027.do';
const REGISTRY_CASE='https://seo5rimom.tistory.com/entry/%EC%B1%84%EB%AC%B4%EB%B6%88%EC%9D%B4%ED%96%89%EC%9E%90%EB%AA%85%EB%B6%80-%EB%93%B1%EC%9E%AC-%ED%9B%84%EA%B8%B0%EC%8B%A4%EC%A0%9C-%EA%B2%BD%ED%97%98';

const estimate=(label:string,note:string,sourceUrl:string,sourceName?:string):CardPeriod=>({label,category:'estimate',note,sourceUrl,sourceName});
const deadline=(label:string,note:string,sourceUrl:string):CardPeriod=>({label,category:'deadline',note,sourceUrl});
const status=(label:string,note:string):CardPeriod=>({label,category:'variable',note});

const PAYMENT=estimate('전체 약 4~8주','송달이 정상적으로 되고 상대가 이의하지 않는 경우의 실무상 참고 범위입니다. 실제 회수기간은 제외합니다.',PAYMENT_PRACTICE);
const MEDIATION=estimate('전체 약 1~4개월','민사조정 전체의 실무 참고 범위입니다. 법정 보장기간이 아닙니다.',MEDIATION_PRACTICE);
const SUIT=estimate('1심 평균 약 5~13개월','2026 사법연감의 2025년 민사 1심 소액·단독·합의 사건별 평균(약 4.7·7.6·13개월)을 반올림한 참고 범위입니다. 항소심과 강제집행은 제외합니다.',CIVIL_STATS,'법원 2026 사법연감');
const WAGE=deadline('진정 처리 25근무일','고용노동부가 안내한 원칙적인 진정 처리기간(토·공휴일 제외)입니다. 최대 2회 연장될 수 있으며 실제 입금 시점은 별도입니다.',LABOR);
const DISCLOSE=estimate('전체 약 2~4개월','실무 사례의 신청→명령 약 1일~3주와 명령→기일 약 7주~3개월을 합쳐 반올림한 단순 참고 범위입니다. 사건 통계가 아니며 송달 실패·이의·기일 변경 시 더 걸릴 수 있습니다.',DISCLOSURE_STAGE,'재산명시 단계별 실무 참고');
const DISCLOSE_ORDER=estimate('신청 후 명령 약 1일~3주','재산명시신청 접수부터 법원 명령이 나오기까지의 실무 사례 범위로, 확정된 법정 처리기한이 아닙니다.',DISCLOSURE_STAGE);
const DISCLOSE_HEARING=estimate('명령 후 기일까지 약 7주~3개월','재산명시명령 이후 명시기일까지 걸리는 실무상 참고 범위입니다. 이의·송달 실패·기일 변경은 별도입니다.',DISCLOSURE_STAGE);
const INQUIRY=estimate('약 1~3개월','법원 안내는 약 1개월, 실무 안내는 약 1~3개월을 제시합니다. 신청 요건 충족 후 기관 회신까지이며 재산명시 선행기간은 제외합니다.',INQUIRY_PRACTICE,'재산조회 실무 안내');
const ATTACH=estimate('예금·급여 압류 약 2~4주','예금·급여 등 금전채권에서 결정·송달 후 추심을 시도하는 실무 참고기간입니다. 잔고 부족·다른 압류·지급거절 시 회수 시점은 달라집니다.',ATTACHMENT);
const PROTECT=estimate('담보명령 약 1~2주','가압류 신청 후 담보제공명령까지의 실무 참고기간입니다. 결정·집행 완료까지의 전체 기간을 뜻하지 않습니다.',PROVISIONAL);
// 공개된 실제 사건은 2025-05-13 신청, 2025-06-25 결정(43일) 한 건뿐입니다.
// 한 건을 여러 사건의 평균이나 법원의 보장 처리기간으로 표현하지 않습니다.
const REGISTRY=estimate('전체 사례 약 6주','공개된 실제 사건 1건의 신청부터 등재결정까지 43일이 걸렸습니다. 법원 전체 평균은 공개 자료로 검증되지 않았습니다. 송달·보정·심문 일정과 불응사유에 따라 달라질 수 있습니다.',REGISTRY_CASE,'실제 처리사례 1건');
// 당사자 간 사적 합의에는 일률적인 법정 처리기간이 없습니다.
 // 해외 초기 협의 일정 예시(2~4주)를 계획 참고치로만 사용하며 국내 사건 평균으로 표현하지 않습니다.
const SETTLEMENT=estimate('협의 참고 약 2~4주','처음 조건을 제안해 협의하는 기간의 계획 참고치입니다. 법정 기한이나 국내 사건의 평균이 아니며, 상대방 답변·쟁점·협의 횟수에 따라 며칠 만에 끝나거나 오래 걸릴 수 있습니다. 실제 지급일은 합의 내용에 따릅니다.','https://brownfirm.law/glossary/resolution-timelines-in-dispute-management/');
const SETTLEMENT_DRAFT=estimate('작성 목표 약 1~3일','금액·지급일·합의 범위가 이미 정해진 간단한 합의서의 작성·검토 계획일입니다. 통계상 평균이나 법정기한이 아니며, 문구 이견이나 서명 지연 시 더 걸릴 수 있습니다.','');
const SETTLEMENT_REPLY=estimate('첫 회신 목표 약 3~7일','합의 제안 뒤 상대방 회신 여부를 점검할 권장 일정입니다. 상대방에게 법적으로 정해진 회신기한이나 평균 처리기간이 아닙니다.','');

/** 수치화할 수 없는 기간에도 현재 절차에 맞는 사유를 표시합니다. */
function contextualPeriod(node:RoadmapNode,parent?:RoadmapNode):CardPeriod{
 const text=[node.title,node.description,...node.conditions].join(' ');
 const variable=[...(node.scenario?.timing||[]),...(parent?.scenario?.timing||[])].find(item=>item.kind==='variable'&&item.label.trim()&&!/미확인|근거|확인 필요|상황에 따라 다름|사건별/.test(item.label));
 if(/합의|협의|협상|화해/.test(text))return status('합의 결과에 따라 달라짐','당사자의 제안·답변·조건 조율에 따라 일정이 달라집니다. 합의하면 서명 시점과 약속한 이행일을 구분해 확인합니다.');
 if(/지급|입금|변제|상환|돈을 받/.test(text))return status('약속한 지급일에 따라 달라짐','실제 입금일은 상대방의 이행 여부와 약정한 지급일에 따릅니다. 협의나 판결이 끝났다고 자동으로 지급되는 것은 아닙니다.');
 if(variable)return status(variable.label.trim(),variable.description.trim()||'해당 절차에 예정된 기일과 상대방 대응에 따라 달라집니다.');
 if(/수사|조사|진정|신고|기관|담당자/.test(text))return status('기관의 조사 일정에 따라 달라짐','접수 이후 담당 기관이 통지하는 조사·처리 일정에 따라 진행됩니다. 통지가 있으면 그 날짜를 기준으로 다음 단계를 확인합니다.');
 if(/기일|심리|재판|판결|법원/.test(text))return status('법원 지정 일정에 따라 달라짐','법원이 실제로 정하는 기일과 송달 상황에 따라 다음 단계가 달라집니다. 법정 불복기한은 별도로 확인해야 합니다.');
 if(/서류|증거|자료|작성|준비/.test(text))return status('자료 준비 속도에 따라 달라짐','필요한 자료를 언제 확보하고 검토하는지에 달렸습니다. 법원·기관 접수 이후의 처리기간과는 별도입니다.');
 if(node.kind==='outcome')return status('후속 조치에 따라 달라짐','이 결과 자체에는 별도의 대기기간이 없습니다. 이후 신청·이행이 필요하면 그 절차의 일정을 확인합니다.');
 return status('다음 절차 일정에 따라 달라짐','이 단계는 일률적인 소요기간이 정해진 기관 처리단계가 아닙니다. 다음 행동의 시작일과 상대방 또는 기관의 대응 여부를 기준으로 확인합니다.');
}

type Procedure='payment'|'mediation'|'suit'|'wage'|'disclosure'|'inquiry'|'attachment'|'provisional'|'wage-confirm'|'registry'|'settlement'|'other';
function procedureOf(node:RoadmapNode):Procedure{
 const title=node.title;
 // 다른 제도의 선행조건으로 재산명시가 언급되어도 명부등재를 먼저 분류합니다.
 if(/채무불이행자\s*명부|불이행자\s*명부|명부\s*등재/.test(title))return 'registry';
 // 이름이 비슷한 절차를 같은 경로로 처리하지 않도록 구체적인 제도부터 검사합니다.
 if(/재산조회|재산 조회/.test(title))return 'inquiry';
 if(/재산명시|재산 명시/.test(title))return 'disclosure';
 if(/가압류/.test(title))return 'provisional';
 if(/채권압류|추심명령|강제집행|다른 재산.*압류|재산 압류|압류 진행|급여.*압류|예금.*압류/.test(title))return 'attachment';
 if(/대지급금.*확인|체불.*확인서|사업주.*확인서/.test(title))return 'wage-confirm';
 if(/노동청|임금체불.*진정|체불.*진정|퇴직금.*진정|근로감독관/.test(title))return 'wage';
 if(/지급명령/.test(title))return 'payment';
 if(/법원.*조정|민사조정|조정.*신청|합의점/.test(title))return 'mediation';
 if(/민사소송|소장.*제출|바로 소송|소송으로 다투|소액.*소송|소액재판/.test(title))return 'suit';
 // 법원의 조정이 아닌 당사자 간 직접 협의·형사합의 등은 별도로 분류합니다.
 if(/합의|협의|협상|화해|원만한 해결/.test(title))return 'settlement';
 return 'other';
}
const PROCEDURE_PERIOD:Record<Exclude<Procedure,'other'>,CardPeriod>={
 payment:PAYMENT,mediation:MEDIATION,suit:SUIT,wage:WAGE,disclosure:DISCLOSE,
 inquiry:INQUIRY,attachment:ATTACH,provisional:PROTECT,registry:REGISTRY,settlement:SETTLEMENT,
 'wage-confirm':deadline('처리기한 14일','대지급금 등 확인신청의 고용노동부 안내 처리기간입니다. 근로복지공단의 지급 청구 처리기간과 다릅니다.',WAGE_CONFIRM)
};
function overallStep(period:CardPeriod):CardPeriod{
 if(period.category==='deadline')return {...period,label:period.label,note:'개별 단계가 아니라 관련 민원의 전체 처리기한입니다. '+period.note};
 return {...period,label:period.label.startsWith('전체')?period.label:period.label.startsWith('1심')?period.label:'전체 '+period.label,
  note:'이 단계 단독 소요가 아니라 상위 절차의 전체 참고기간입니다. '+period.note};
}

function outcomePeriod(node:RoadmapNode,procedure:Procedure,base:CardPeriod):CardPeriod{
 const text=[node.title,node.description,...node.conditions].join(' ');
 const positive=/이의\s*없이|이의(?:신청)?(?:가|를|을)?\s*(?:없|하지\s*않|않|안)|확정/.test(text);
 const contested=/소송으로|소송절차|다투|적법하게 이의|이의신청을 하|불성립|항소|불복/.test(text);
 const paid=/실제.*(?:받|지급)|입금|돈을.*받|지급.*완료|전액.*지급/.test(text);
 if(procedure==='settlement'){
  if(/결렬|거절|불성립|합의.*(?:안|못)|협의.*(?:안|못)/.test(text))
   return status('협의 결렬 후 다음 방법 선택','상대가 거절하거나 협의가 끝났다면 합의에 필요한 대기기간은 더 이상 없습니다. 수사·소송 등 이어지는 절차의 기간은 별도로 확인합니다.');
  if(paid)return status('합의한 지급일에 따라 달라짐','합의서에 정한 지급일과 실제 이행 여부에 따라 달라집니다. 합의 성립일이 자동 입금일은 아닙니다.');
  if(/서명|합의.*(?:성립|완료)|합의서.*(?:작성|제출)/.test(text))
   return status('합의서 서명·제출 시점 기준','당사자의 서명 또는 기관 제출이 필요한 결과입니다. 이미 합의가 성립한 경우 추가 협의기간을 다시 계산하지 않습니다.');
  return status('합의 결과에 따라 달라짐','조건이 맞으면 합의서를 작성하거나 이행하고, 맞지 않으면 다른 절차를 선택합니다. 상대의 답변과 최종 조건에 따라 다음 일정이 달라집니다.');
 }
 if(procedure==='payment'){
  if(positive&&!contested)return deadline('송달 후 법정 2주','지급명령 정본을 송달받은 후 이의 없이 확정되는 기한입니다. 접수부터 확정까지의 전체 소요는 아닙니다.',COURT_PAYMENT);
  if(contested||/이의/.test(text))return {...SUIT,note:'지급명령에 대한 적법한 이의로 소송에 이행하는 경우의 1심 평균 참고 범위입니다.'};
 }
 if(procedure==='mediation'){
  if(/이의|소송|불성립/.test(text))return {...SUIT,note:'조정 결과 소송으로 넘어갈 때의 1심 평균 참고 범위입니다. 조정을 갈음하는 결정에 대한 이의신청은 결정 송달 후 법정 2주로 별도 계산합니다.'};
  if(/성립|합의|조서/.test(text))return status('성립 시 효력 발생','조정이 성립하면 조정조서에 확정판결과 같은 효력이 생깁니다. 실제 지급일은 조정조항에 따릅니다.');
 }
 if(procedure==='wage'){
  if(/미이행|지급.*않|형사|송치|고소/.test(text))return estimate('수사 약 2개월','시정지시 미이행으로 형사절차에 들어가는 경우 고용노동부의 안내기간이며 검사지휘로 연장될 수 있습니다.',LABOR);
  if(paid)return status('실제 입금 시 종료','시정지시나 합의 자체가 실제 입금을 보장하지 않습니다. 입금일을 확인하는 단계입니다.');
 }
 if(procedure==='suit'){
  if(/항소|불복/.test(text))return deadline('판결 송달 후 법정 2주','항소할 수 있는 1심 판결의 원칙적인 항소기한이며 항소심 소요기간과 다릅니다.',CIVIL_TIMING);
  if(/집행|미지급|지급하지/.test(text))return {...ATTACH,label:'예금 등 집행 약 2~4주',note:'금전채권을 특정해 압류·추심하는 경우에 한한 참고 범위입니다. 다른 집행수단이나 회수 성공까지의 총기간은 아닙니다.'};
  if(paid)return status('입금 확인 즉시 종료','실제 지급받은 시점을 기록하는 결과입니다. 법원 처리기간이 추가로 정해지는 것은 아닙니다.');
 }
 if(procedure==='disclosure'&&/불출석|거부|감치|불응/.test(text))
  return status('불응 시 후속 심리 별도','명시기일 불출석·재산목록 거부 등의 경우 후속 절차가 추가됩니다. 감치기간을 사건 처리기간으로 표시하지 않습니다.');
 if(procedure==='disclosure'&&/이의|불복/.test(text))return status('이의심리 일정 별도','명시명령에 대한 이의는 송달일부터 1주 안에 신청할 수 있습니다. 신청 이후 심리·재판의 소요기간은 따로 정해져 있지 않습니다.');
 if(procedure==='inquiry'&&/발견|조회.*결과|확인/.test(text))return status('조회 결과 확인 시','조회 결과를 확인한 시점의 후속 결과입니다. 신청부터 회신까지의 전체 기간을 다시 표시하지 않습니다.');
 if(procedure==='attachment'&&/진술|회신/.test(text))
  return deadline('송달 후 법정 1주','진술최고를 신청한 경우 제3채무자가 압류명령을 송달받은 날부터 진술할 법정 기한입니다.',COLLECTION_LAW);
 if(paid)return status('입금 확인 즉시 종료','실제 수령이 확인된 결과이므로 추가 법원 처리기간과 구분합니다.');
 return status('결과 확인 후 진행','해당 결과의 독립된 처리기간이 확인되지 않았으므로 상위 절차의 전체 기간을 중복 표시하지 않습니다.');
}

function stepPeriod(node:RoadmapNode,procedure:Procedure,base:CardPeriod):CardPeriod{
 const text=[node.title,node.description].join(' ');
 if(procedure==='settlement'){
  if(/합의서|처벌불원서|탄원서|서명|문서.*(?:작성|제출)/.test(text))return SETTLEMENT_DRAFT;
  if(/협의|조건|금액.*조율|합의.*협상/.test(text))
   return {...SETTLEMENT,label:'조건 조율 참고 약 2~4주',note:'협의 시작부터 조건을 조율하는 계획 참고 범위로, 전체 합의 시도 기간과 겹칩니다. 별도의 2~4주를 추가하는 뜻이 아닙니다. '+SETTLEMENT.note};
  if(/제안|연락|의사.*확인|요청|의견.*전달/.test(text))return SETTLEMENT_REPLY;
  if(/지급|입금|이행/.test(text))return status('합의한 지급일에 따라 달라짐','실제 이행일은 당사자가 정한 지급·이행 조건을 확인해야 합니다. 협의나 문서 작성에 걸리는 기간과 합산하지 않습니다.');
  return contextualPeriod(node);
 }
 if(procedure==='registry'){
  if(/불응.*(?:확인|사실)|명시기일.*(?:불출석|확인)|거짓.*목록/.test(text))
   return status('명시기일 기록 확인','이 단계는 앞선 재산명시기일의 불출석·제출거부 등 사건기록을 확인하는 작업입니다. 별도의 평균 대기기간이 집계되는 법원 처리단계가 아니며, 확인 후 등재신청을 검토합니다.');
  if(/신청|접수|심문|결정|송달|등재/.test(text))
   return {...REGISTRY,label:'접수→결정 사례 약 6주',note:'신청서 작성·제출에 6주가 필요한 것은 아닙니다. 공개된 실제 사건 1건의 접수부터 결정까지 43일을 참고로 표시합니다. 법원 전체 평균이 아닙니다.'};
  return status('단계별 통계 미확인','채무불이행자명부 등재의 신청→결정 사례는 확인했지만 이 세부 단계만의 독립된 평균 소요기간 자료는 없습니다.');
 }
 if(procedure==='disclosure'){
  // The route owns the overall timeline; each expanded step owns only its next transition.
  if(/이의|불복/.test(text))return deadline('송달 후 법정 1주','채무자가 재산명시명령을 송달받은 날부터 이의신청할 수 있는 법정 기한입니다.',DISCLOSURE_COURT);
  if(/재산목록|선서|명시기일.*출석|기일.*출석/.test(text))return status('지정된 기일 당일','재산목록 제출과 선서는 법원이 지정한 명시기일에 진행합니다. 신청부터 걸리는 전체 기간이 아닙니다.');
  if(/명시기일.*(?:지정|통지|예정)|기일.*(?:지정|통지|잡)|출석.*요구/.test(text))return DISCLOSE_HEARING;
  if(/명령.*(?:송달|전달)|송달.*(?:확인|진행)/.test(text))return status('송달 완료일 기준','명령 송달까지의 고정 일수는 확인되지 않습니다. 이의신청 기한은 실제 송달일로부터 1주입니다.');
  if(/법원.*(?:심사|검토|명령)|신청.*(?:심사|검토)|명령.*(?:발령|결정)/.test(text))return DISCLOSE_ORDER;
  if(/신청서.*(?:작성|제출|접수)|(?:재산명시|재산 명시).*신청/.test(text))return {...DISCLOSE_ORDER,note:'신청서 제출 자체의 기간이 아니라, 접수된 뒤 법원의 재산명시명령이 나오기까지의 실무 참고 범위입니다.'};
  return status('다음 법원 절차 기준','이 단계의 독립된 수치가 없어 전체 기일까지의 기간을 중복 표시하지 않습니다. 법원 통지로 다음 일정을 확인합니다.');
 }
 if(procedure==='payment'){
  if(/이의.*(?:여부|확인|기간)|이의신청|확정.*확인/.test(text)||node.scenarioStep===2)
   return deadline('송달 후 법정 2주','지급명령 정본 송달일부터 상대가 이의신청할 수 있는 기간입니다. 해당 단계가 법원에서 2주 걸린다는 뜻은 아닙니다.',COURT_PAYMENT);
  if(/심사|발령|전달|송달|신청/.test(text))
   return estimate('발령·송달 약 1~2주','신청부터 발령·송달에 이르는 복수 단계를 합친 실무 참고기간입니다. 특정 단계만의 기간은 아닙니다.',PAYMENT_STEPS);
 }
 if(procedure==='mediation'){
  if(/조정.*기일|의견.*조율|조건.*조율|출석|기일.*지정/.test(text))
   return estimate('첫 기일까지 약 1~2개월','법원 조정센터에서 안내하는 신청부터 첫 조정기일까지의 통상 기간입니다. 이후 추가 기일이 잡힐 수 있습니다.',MEDIATION_COURT);
  if(/결정.*이의/.test(text))return deadline('결정 송달 후 법정 2주','조정을 갈음하는 결정에 대한 이의기간입니다.',MEDIATION_COURT);
 }
 if(procedure==='suit'){
  if(/답변서|상대.*답변/.test(text))
   return deadline('소장 송달 후 법정 30일','피고가 청구를 다투는 경우 소장 부본 송달일부터 답변서를 제출할 원칙적인 법정기한입니다(공시송달 예외).',CIVIL_TIMING);
  if(/판결.*선고|선고.*판결|변론.*종결/.test(text))
   return deadline('변론종결 후 원칙 2주','민사소송법 제207조의 판결 선고 원칙 기한입니다. 실제 기일은 법원의 통지를 확인해야 합니다.',CIVIL_TIMING);
 }
 if(procedure==='wage'){
  if(/출석.*요구|출석.*통지|조사.*안내/.test(text))
   return estimate('출석 요청 약 7~10일','고용노동부 상담사례의 진정 접수 후 출석요구까지 참고기간입니다. 사례별로 달라질 수 있습니다.',LABOR_CALL);
  if(/검찰|송치|형사.*수사/.test(text))
   return estimate('수사 약 2개월','진정에서 형사절차로 이행한 뒤의 고용노동부 안내기간입니다. 검사의 지휘에 따라 연장될 수 있습니다.',LABOR);
 }
 if(procedure==='inquiry'&&/회신|기관.*조회|결과/.test(text))
  return estimate('조회 회신 약 1개월','재산조회 신청일부터 결과 회신까지 법원 민원안내의 기준입니다. 실제 기관과 회신 상태에 따라 차이가 납니다.',INQUIRY_COURT);
 if(procedure==='attachment'&&/진술최고|제3채무자.*진술|진술.*회신/.test(text))
  return deadline('송달 후 법정 1주','제3채무자가 압류명령을 송달받은 날부터 진술최고에 답할 원칙적인 기한입니다.',COLLECTION_LAW);
 if(procedure==='provisional'&&/담보/.test(text))return PROTECT;
 const factual=nodeDuration(node);
 if(factual&&factual.label!==base.label)return estimate(factual.label,'이 단계 자체의 근거가 확인된 경우에만 적용하는 기간입니다. 신청부터 완료까지의 총기간과 혼동하지 않습니다.','');
 return status('다음 단계 일정 확인','독립된 소요기간이 확인되지 않아 전체 절차의 기간을 이 단계에 중복 표시하지 않습니다.');
}

export function mapCardPeriod(node:RoadmapNode,parent?:RoadmapNode):CardPeriod{
 if(node.kind==='situation')return status('','');
 if(node.kind==='completion')return status('종료 조건 충족 시','결과의 종료 조건을 만족했을 때만 종료됩니다. 이행·회수는 별개일 수 있습니다.');
 if(node.kind==='followup'&&node.linkedRouteId)return status('이후 절차로 이어짐','연결된 다른 방법을 열어 해당 절차의 예상 기간을 확인하세요.');
 const procedure=procedureOf(parent||node);
 if(procedure==='other'){
  // 새로 생성된 경로라도 검증된 기간 출처가 있으면 미분류라는 이유로 버리지 않습니다.
  const sourceBacked=nodeDuration(node);
  if(sourceBacked)return estimate(sourceBacked.label,'생성된 절차의 연결 출처로 확인한 참고기간입니다. 해당 절차의 별도 법정 처리기한은 아닙니다.','');
  return contextualPeriod(node,parent);
 }
 const base=PROCEDURE_PERIOD[procedure];
 // Never let a route-wide AI estimate override a particular step or result.
 if(node.kind==='step')return stepPeriod(node,procedure,base);
 if(node.kind==='outcome')return outcomePeriod(node,procedure,base);
 const factual=nodeDuration(node);
 if(factual)return estimate(factual.label,'이 경로에 연결된 예상 기간입니다. 개별 단계의 기간으로 재사용하지 않습니다.','');
 // '합의서 작성', '합의금 지급'만 독립 방법인 경우 협의 전체 기간을 붙이지 않습니다.
 if(procedure==='settlement'&&/합의서|처벌불원서|탄원서|서명/.test(node.title)&&!/협의|협상/.test(node.title))return SETTLEMENT_DRAFT;
 if(procedure==='settlement'&&/지급|입금|이행|약정.*날/.test(node.title))return status('합의한 지급일에 따라 달라짐','협의 완료 뒤의 지급·이행은 합의한 날짜와 상대방의 이행 여부에 달려 있습니다. 협의기간을 다시 적용하지 않습니다.');
 return base;
}

/**
 * 점선으로 묶인 경로 전체의 기간 표기.
 * 개별 카드들의 기간은 독립된 법정 기한·중첩 처리 단계가 섞여 있으므로 더하지 않는다.
 * 해당 경로 카드에서 이미 산정한 전체 기간만 재사용하고, 부분 기간뿐인 경우
 * 임의로 전체 소요로 확대하지 않는다.
 */
export function groupProcedurePeriod(node:RoadmapNode):{label:string;note:string;estimated:boolean}{
 const period=mapCardPeriod(node);
 const procedure=procedureOf(node);
 const isPartial=procedure==='provisional'&&!nodeDuration(node);
 const scopedDeadline=procedure==='wage'||procedure==='wage-confirm';
 if(isPartial)return {label:'전체 완료는 법원 결정·집행 일정에 따라 달라짐',note:'담보명령 약 1~2주는 일부 절차에 관한 참고기간입니다. 가압류 결정·집행까지의 전체 기간으로 더하지 않습니다.',estimated:false};
 if(period.category==='variable')return {label:period.label,note:period.note,estimated:false};
 if(period.category==='deadline'&&!scopedDeadline)return {label:'전체 소요는 후속 절차에 따라 달라짐',note:'표시된 법정기한은 후속 절차 전체의 처리기간이 아닙니다.',estimated:false};
 const prefix=/^(?:전체|1심|조회 결과|진정 처리|처리기한|예금·급여 압류)/.test(period.label)?'':'전체 ';
 return {label:prefix+period.label,note:period.note,estimated:true};
}

export function groupProcedureTitle(node:RoadmapNode):string {
 return procedureGroupTitle(node.title);
}
