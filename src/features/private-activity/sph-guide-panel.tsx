'use client';

import {useEffect,useState} from 'react';
import {ArrowUpRight,RefreshCw} from 'lucide-react';
import {GUIDE_ACTIVITY_LABELS,type GuideAction,type GuideActivityDay} from '@/lib/activity-types';

const actions=Object.keys(GUIDE_ACTIVITY_LABELS) as GuideAction[];
const number=new Intl.NumberFormat('ko-KR');
type Report={rows:GuideActivityDay[];generatedAt:string};

export function SphGuidePanel({days,onDays,onSessionExpired}:{days:number;onDays:(days:number)=>void;onSessionExpired:()=>void}){
 const [report,setReport]=useState<Report|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();
  setLoading(true);setError('');setReport(null);
  const location=window.location.pathname.replace(/\/$/,'');
  fetch(location+'/guide-events?days='+days,{cache:'no-store',signal:controller.signal})
   .then(async response=>{
    if(response.status===401){onSessionExpired();return;}
    if(!response.ok)throw new Error();
    const result=await response.json() as Report;
    if(!controller.signal.aborted)setReport(result);
   })
   .catch(()=>{if(!controller.signal.aborted)setError('가이드 활동을 불러오지 못했습니다. 다시 시도해 주세요.');})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[days,refresh,onSessionExpired]);

 const rows=report?.rows||[];
 return <div className="sph-simple">
  <div className="sph-simple-title">
   <div><h2>SPH 서비스 가이드 활동 기록</h2>
    <a className="private-site-link" href="https://sph-field-guide-six.vercel.app/" target="_blank" rel="noopener noreferrer">가이드 열기 <ArrowUpRight size={12} aria-hidden="true"/></a>
   </div>
   <div className="private-filters">
    <select aria-label="가이드 조회 기간" value={days} onChange={event=>onDays(Number(event.target.value))}>
     <option value={1}>오늘</option><option value={7}>최근 7일</option><option value={30}>최근 30일</option>
    </select>
    <button type="button" className="private-button" disabled={loading} onClick={()=>setRefresh(value=>value+1)}>
     <RefreshCw size={15} className={loading?'private-spin':''}/>새로고침
    </button>
   </div>
  </div>
  <div className="private-summary sph-metrics">
   {actions.map(action=><section key={action}><span>{GUIDE_ACTIVITY_LABELS[action]}</span>
    <strong>{report?number.format(rows.reduce((sum,row)=>sum+row[action],0)):'—'}</strong>
   </section>)}
  </div>
  <section className="private-records sph-activity-records" aria-label="가이드 일별 활동 집계" aria-busy={loading}>
   {error?<p className="private-error" role="alert">{error}</p>:rows.length?
    <div className="private-table-scroll"><table className="sph-guide-table">
     <thead><tr><th scope="col">날짜 (한국 시간)</th>{actions.map(action=><th scope="col" key={action}>{GUIDE_ACTIVITY_LABELS[action]}</th>)}</tr></thead>
     <tbody>{rows.map(row=><tr key={row.date}><td>{row.date}</td>{actions.map(action=><td key={action}>{number.format(row[action])}</td>)}</tr>)}</tbody>
    </table></div>:
    <div className="private-empty" role="status"><strong>{loading?'가이드 활동을 불러오는 중입니다.':'선택한 기간의 가이드 활동이 없습니다.'}</strong></div>}
  </section>
 </div>;
}
