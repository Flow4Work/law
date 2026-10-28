/** 대화 제목은 요약을 우선하고, 공간이 모자랄 때만 12자 뒤에 말줄임표를 붙입니다. */
export function limitCaseTitle(value:string):string {
  const title=(value||'새 대화').replace(/\s+/g,' ').trim()||'새 대화';
  const chars=Array.from(title);
  return chars.length>12?chars.slice(0,12).join('')+'…':title;
}
export function summarizeCaseTitle(value:string):string {
  const text=(value||'').replace(/\s+/g,' ').trim();
  if(!text)return '새 대화';
  const includes=(pattern:RegExp)=>pattern.test(text);
  if(includes(/보증금|전세금/)&&includes(/계약.{0,9}(끝|종료|만료|해지)|반환|돌려|못.?받|안.?주/))return '보증금 반환 문제';
  if(includes(/퇴직금|퇴직.?위로금/)&&includes(/미지급|체불|못.?받|안.?주|지급/))return '퇴직금 미지급';
  if(includes(/임금|월급|급여/)&&includes(/체불|미지급|못.?받|안.?주|밀렸|안.?들어/))return '임금체불 대응';
  if(includes(/해고|권고사직|부당해고/))return '해고 대응';
  if(includes(/전세|월세|임대차/)&&includes(/계약|집주인|보증금/))return '임대차 계약 문제';
  if(includes(/사기|보이스피싱/)&&includes(/신고|피해|고소|돈|계좌/))return '사기 피해 대응';
  if(includes(/경찰|검찰/)&&includes(/출석|조사|연락|소환/))return '경찰 조사 대응';
  if(includes(/고소/)&&includes(/당했|받았|피고소/))return '고소 대응';
  if(includes(/교통사고|접촉사고/))return '교통사고 대응';
  if(includes(/양육비/))return '양육비 문제';
  if(includes(/상속|유류분/))return '상속 문제';
  if(includes(/이혼/))return '이혼 절차';
  if(includes(/폭행|상해/))return '폭행 사건 대응';
  // 핵심을 찾지 못했다면 문장 첫머리의 군더더기를 줄인 후 단어 경계에서 자릅니다.
  const reduced=text.replace(/^(안녕하세요[.,!\s]*|제가?\s*|저는\s*|나는\s*|지금\s*|혹시\s*|궁금한데\s*)+/g,'')
    .replace(/(인데요|입니다|이에요|예요|거든요|할까요|하나요|합니다)[?.!\s]*$/g,'')
    .replace(/[?!。]+/g,'').trim();
  if(Array.from(reduced).length<=12)return reduced||'새 대화';
  const prefix=Array.from(reduced).slice(0,12).join('');
  const boundary=prefix.lastIndexOf(' ');
  return limitCaseTitle(boundary>=6?prefix.slice(0,boundary):reduced);
}
