'use client';
import {Activity,ArrowDown,Clock3,Globe2,MousePointerClick,RefreshCw,Search} from 'lucide-react';
import type {ActivityReport,ActivityEvent} from '@/lib/activity-types';
import './sph-panel.css';

type Props={
 report:ActivityReport|null;busy:boolean;error:string;days:number;action:string;
 page:number;canPrevious:boolean;canNext:boolean;
 onDays:(days:number)=>void;onAction:(action:string)=>void;onRefresh:()=>void;
 onPrevious:()=>void;onNext:()=>void;
};
const koTime=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',
 year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
const fmt=(value:string)=>koTime.format(new Date(value));
const num=(n:number|undefined)=>n===undefined?'—':n.toLocaleString('ko-KR');
const actions:Record<string,string>={
 visit:'서비스 접속',click:'버튼 클릭',query:'검색 적용',view_step:'상세 보기'
};
export function SphActivityPanel({report,busy,error,days,action,page,canPrevious,canNext,
 onDays,onAction,onRefresh,onPrevious,onNext}:Props){
 const rows:ActivityEvent[]=report?.events||[];
 return <div className="sph-simple">
  <p className="sph-simple-intro">기본 접속과 주요 버튼만 기록합니다. 검색어, 입력 내용, 고객 정보는 수집하지 않습니다.</p>
  <div className="private-summary">
   {[
    {label:'서비스 접속',value:report?.visits,icon:Globe2},
    {label:'버튼 클릭',value:report?.clicks,icon:MousePointerClick},
    {label:'검색 적용',value:report?.queries,icon:Search},
    {label:'전체 활동',value:report?.total,icon:Activity}
   ].map(({label,value,icon:Icon})=><section key={label}><span>{label}<Icon size={17}/></span><strong>{num(value)}</strong><small>{days===1?'오늘':`최근 ${days}일`} 전체 기준</small></section>)}
  </div>
  <section className="private-records" id="private-panel" role="tabpanel" aria-labelledby="private-tab-sph">
   <div className="sph-simple-bar">
    <div className="private-filters">
     <label className="sph-simple-label">기간
      <select aria-label="SPH 조회 기간" value={days} onChange={e=>onDays(Number(e.target.value))}>
       <option value={1}>오늘</option><option value={7}>최근 7일</option><option value={30}>최근 30일</option>
      </select>
     </label>
     <label className="sph-simple-label">활동
      <select aria-label="SPH 활동 종류" value={action} onChange={e=>onAction(e.target.value)}>
       <option value="all">전체 활동</option>
       {Object.entries(actions).map(([key,label])=><option key={key} value={key}>{label}</option>)}
      </select>
     </label>
     <button className="private-button" type="button" disabled={busy} onClick={onRefresh}>
      <RefreshCw size={15} className={busy?'private-spin':''}/>새로고침
     </button>
    </div>
    <span className="sph-simple-updated">{report?'조회 '+fmt(report.generatedAt)+' (한국 시간)':'한국 시간'}</span>
   </div>
   {error&&<p className="private-error" role="alert">{error}</p>}
   <div className="private-table-scroll"><table className="sph-simple-table">
    <thead><tr><th>날짜와 시간 <ArrowDown size={13}/></th><th>활동</th><th>누른 버튼</th></tr></thead>
    <tbody>{rows.map(event=><tr key={event.id}>
     <td className="private-time"><Clock3 size={13}/><time dateTime={event.at}>{fmt(event.at)}</time></td>
     <td><span className={'private-tag private-tag-'+event.action}>{actions[event.action]||'기타 활동'}</span></td>
     <td className="private-detail">{event.action==='visit'?'—':event.detail||'—'}</td>
    </tr>)}</tbody>
   </table>
   {!rows.length&&<div className="private-empty"><Activity size={25}/><strong>{busy?'기록 확인 중':error?'조회 실패':report?.total?'선택한 조건에 해당하는 기록이 없습니다.':'아직 기록이 없습니다.'}</strong></div>}
   </div>
   <div className="private-actions sph-simple-pages">
    <button className="private-button" type="button" disabled={busy||!canPrevious} onClick={onPrevious}>이전</button>
    <span>{page}페이지</span>
    <button className="private-button" type="button" disabled={busy||!canNext} onClick={onNext}>다음</button>
   </div>
  </section>
 </div>;
}
