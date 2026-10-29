export const ACTIVITY_LABELS={visit:'서비스 접속',query:'질문 입력',answer:'확인 질문 응답',new_case:'새 대화',example:'예시 선택',view_step:'상세 보기',model:'모델 선택',settings:'설정 열기',sources:'공식 자료 보기',map_update:'지도 업데이트',map_start:'절차 펼치기',location:'위치 확인'} as const;
export type ActivityAction=keyof typeof ACTIVITY_LABELS;
export type ActivityDistrictSource='verified'|'ip-city'|'ip-postal'|'ip-coordinate'|'geo-city'|'geo-postal'|'geo-coordinate'|'unavailable';
export type ActivityConfidence='high'|'medium'|'low';
/** Which tracked site produced a record. Records saved before multi-site tracking are Law. */
export const ACTIVITY_SITES={law:{label:'Law',host:'law-lake-theta.vercel.app',url:'https://law-lake-theta.vercel.app/'},portfolio:{label:'Portfolio',host:'leopark-portfolio.vercel.app',url:'https://leopark-portfolio.vercel.app/'}} as const;
export type ActivitySite=keyof typeof ACTIVITY_SITES;
export const isActivitySite=(value:unknown):value is ActivitySite=>value==='law'||value==='portfolio';
export type ActivityEvent={id:string;at:string;ip:string;ipVersion?:string;country:string;city:string;district:string;location:string;districtSource?:ActivityDistrictSource;districtConfidence?:ActivityConfidence;districtEvidence?:string;locationNote?:string;isp?:string;asn?:string;networkType?:string;networkRisk?:string;site?:ActivitySite;action:ActivityAction;detail:string};
/** Everything one IP resolves to, without the per-request address fields. */
export type ActivityLocationSnapshot={country:string;city:string;district:string;location:string;districtSource:ActivityDistrictSource;districtConfidence:ActivityConfidence;districtEvidence:string;locationNote:string;isp:string;asn:string;networkType:string;networkRisk:string};
export type ActivityReport={events:ActivityEvent[];total:number;visits:number;queries:number;views:number;uniqueIps:number;days:number;site:ActivitySite;generatedAt:string;limited:boolean};
