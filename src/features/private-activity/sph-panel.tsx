'use client';
import {Activity,ArrowDown,Clock3,Globe2,MousePointerClick,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import {PC_IP,MOBILE_IP,OWNER_IP} from '@/lib/activity-view';
import {ACTIVITY_SITES} from '@/lib/activity-types';
import type {ActivityReport,ActivityEvent} from '@/lib/activity-types';
import './sph-panel.css';

type Props={
 report:ActivityReport|null;busy:boolean;error:string;days:number;action:string;
 page:number;canPrevious:boolean;canNext:boolean;
 onDays:(days:number)=>void;onAction:(action:string)=>void;onRefresh:()=>void;
 onPrevious:()=>void;onNext:()=>void;
};
const koreanDate=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',
 month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const displayTime=(value:string)=>koreanDate.format(new Date(value));
const number=(value:number|undefined)=>value===undefined?'—':value.toLocaleString('ko-KR');
const labels:Record<string,string>={visit:'서비스 접속',click:'버튼 클릭',query:'검색 적용',view_step:'상세 보기'};
const knownIp=(value:string)=>Boolean(value&&value!=='확인 불가'&&value!=='127.0.0.1');
function ownerLabel(ip:string,viewerIp:string|undefined){
 if(!ip)return {text:'이전 기록',kind:'unknown',explain:'이 기록은 IP 수집을 시작하기 전에 저장됐습니다.'};
 if(!knownIp(ip))return {text:'IP 확인 불가',kind:'unknown',explain:'이 요청의 방문자 IP를 확인하지 못했습니다.'};
 if(ip===OWNER_IP)return {text:'내 IP',kind:'mine',explain:'관리자가 직접 지정한 본인 IP입니다.'};
 if(ip===viewerIp)return {text:'현재 내 IP',kind:'mine',explain:'지금 이 관리자 화면에 접속한 IP와 같습니다.'};
 if(ip===PC_IP)return {text:'내 PC',kind:'mine',explain:'기존 관리자에 등록한 PC IP와 같습니다.'};
 if(ip===MOBILE_IP)return {text:'내 휴대폰',kind:'mine',explain:'기존 관리자에 등록한 휴대폰 IP와 같습니다.'};
 return {text:'기타 IP',kind:'other',explain:'등록된 IP와 다릅니다. 다른 사람의 접속으로 확정할 수는 없습니다.'};
}
export function SphActivityPanel({report,busy,error,days,action,page,canPrevious,canNext,
 onDays,onAction,onRefresh,onPrevious,onNext}:Props){
 const rows:ActivityEvent[]=report?.events||[];
 const viewerIp=knownIp(report?.viewerIp||'')?report!.viewerIp:'';
 const metrics=[
  {label:'서비스 접속',value:report?.visits,icon:Globe2},
  {label:'고유 IP',value:report?.uniqueIps,icon:ShieldCheck},
  {label:'버튼 클릭',value:report?.clicks,icon:MousePointerClick},
  {label:'검색 적용',value:report?.queries,icon:Search}
 ];
 return <div className="sph-simple">
  <div className="sph-simple-title"><div><h2>영업 발굴 활동 기록</h2><a className="private-site-link" href={ACTIVITY_SITES.sph.url} target="_blank" rel="noopener noreferrer">영업 발굴 열기 ↗</a></div><span>{days===1?'오늘':`최근 ${days}일`} 기준</span></div>
  <div className="private-summary sph-metrics">
   {metrics.map(({label,value,icon:Icon})=><section key={label}>
     <span>{label}<Icon size={17}/></span>
     <strong>{number(value)}</strong>
   </section>)}
  </div>
  <section className="private-records sph-activity-records" aria-label="영업 발굴 활동 목록">
   <div className="sph-activity-toolbar">
    <div className="sph-activity-toolbar-heading"><strong>활동 기록</strong><span>{number(report?.total)}건</span></div>
    <div className="private-filters sph-activity-filters">
     <label className="sph-simple-label"><span>기간</span>
      <select aria-label="SPH 조회 기간" value={days} onChange={event=>onDays(Number(event.target.value))}>
       <option value={1}>오늘</option><option value={7}>최근 7일</option><option value={30}>최근 30일</option>
      </select>
     </label>
     <label className="sph-simple-label"><span>활동</span>
      <select aria-label="SPH 활동 종류" value={action} onChange={event=>onAction(event.target.value)}>
       <option value="all">전체 활동</option>
       {Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select>
     </label>
     <button className="private-button" type="button" disabled={busy} onClick={onRefresh}>
      <RefreshCw size={15} className={busy?'private-spin':''}/>새로고침
     </button>
    </div>
   </div>
   <div className="sph-ip-context">
    <span className="sph-ip-context-main"><ShieldCheck size={15}/>현재 관리자 IP <code>{viewerIp||'확인 불가'}</code></span>
    <span>현재 IP 또는 기존 등록된 PC와 휴대폰 IP를 '내 IP'로 표시합니다.</span>
   </div>
   {error&&<p className="private-error" role="alert">{error}</p>}
   <div className="private-table-scroll">
    <table className="sph-simple-table">
     <thead><tr><th>날짜와 시간 <ArrowDown size={13}/></th><th>접속 IP</th><th>활동</th><th>선택 항목</th></tr></thead>
     <tbody>{rows.map(event=>{
      const owner=ownerLabel(event.ip,viewerIp);
      return <tr key={event.id}>
       <td className="private-time"><Clock3 size={13}/><time dateTime={event.at}>{displayTime(event.at)}</time></td>
       <td><div className="sph-ip-cell">
        <code>{knownIp(event.ip)?event.ip:event.ip?'확인 불가':'IP 미수집'}</code>
        <span className={'sph-owner-pill sph-owner-'+owner.kind} title={owner.explain}>{owner.text}</span>
       </div></td>
       <td><span className={'private-tag private-tag-'+event.action}>{labels[event.action]||'기타 활동'}</span></td>
       <td className="private-detail">{event.action==='visit'?'—':event.detail||'—'}</td>
      </tr>;
     })}</tbody>
    </table>
    {!rows.length&&<div className="private-empty"><Activity size={24}/>
     <strong>{busy?'기록을 불러오는 중':error?'기록을 불러오지 못했습니다.':report?.total?'이 조건에 해당하는 기록이 없습니다.':'아직 접속 기록이 없습니다.'}</strong>
    </div>}
   </div>
   <footer className="sph-records-footer">
    <span>{rows.length}건 표시{report?.limited?' / 다음 페이지 있음':''} <span className="sph-footer-time">{report?'최근 조회 '+displayTime(report.generatedAt):'조회 대기'} (한국 시간)</span></span>
    <div className="sph-simple-pages">
     <button className="private-button" type="button" disabled={busy||!canPrevious} onClick={onPrevious}>이전</button>
     <span>{page}페이지</span>
     <button className="private-button" type="button" disabled={busy||!canNext} onClick={onNext}>다음</button>
    </div>
   </footer>
  </section>
  <p className="sph-simple-footnote">IP는 관리자 화면에서만 확인하며 암호화 저장합니다. 이전에 IP를 수집하지 않은 기록은 복원할 수 없습니다. 동일한 IP라도 동일인이라는 뜻은 아닙니다. 검색어나 입력 내용은 기록하지 않습니다.</p>
 </div>;
}
