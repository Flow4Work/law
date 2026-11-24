'use client';

import {useEffect,useState} from 'react';
import {ArrowUpRight,RefreshCw,Search} from 'lucide-react';
import {GUIDE_ACTIVITY_LABELS,type GuideAction,type GuideActivityDay,type GuideActivityRecord} from '@/lib/activity-types';
import {activityDeviceLabel} from '@/lib/activity-view';
import {watchActivityRefresh} from '@/lib/activity-refresh';

const actions=Object.keys(GUIDE_ACTIVITY_LABELS) as GuideAction[];
const number=new Intl.NumberFormat('ko-KR');
const clock=new Intl.DateTimeFormat('ko-KR',{
 timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
 hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
});
type Report={rows:GuideActivityDay[];events:GuideActivityRecord[];generatedAt:string};

export function SphGuidePanel({days,onDays,onSessionExpired}:{days:number;onDays:(days:number)=>void;onSessionExpired:()=>void}){
 const [result,setResult]=useState<{days:number;report:Report}|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [refresh,setRefresh]=useState(0);
 const [keyword,setKeyword]=useState('');
 const [actionFilter,setActionFilter]=useState('all');
 useEffect(()=>{
  const location=window.location.pathname.replace(/\/$/,'');
  let active:AbortController|null=null;
  let lastRead=0;
  let disposed=false;
  async function load(interactive=false){
   if(active)return;
   const controller=new AbortController();
   active=controller;
   lastRead=Date.now();
   if(interactive)setLoading(true);
   setError('');
   const timeout=window.setTimeout(()=>controller.abort(),15000);
   try{
    const response=await fetch(location+'/guide-events?days='+days,{cache:'no-store',signal:controller.signal});
    if(disposed)return;
    if(response.status===401){onSessionExpired();return;}
    if(!response.ok)throw new Error();
    const report=await response.json() as Report;
    if(!disposed)setResult({days,report});
   }catch{
    if(!disposed)setError('가이드 활동을 불러오지 못했습니다. 다시 시도해 주세요.');
   }finally{
    window.clearTimeout(timeout);
    active=null;
    if(!disposed)setLoading(false);
   }
  }
  void load(true);
  const stop=watchActivityRefresh(()=>{if(Date.now()-lastRead>=60000)void load();},()=>{});
  return()=>{disposed=true;stop();active?.abort();};
 },[days,refresh,onSessionExpired]);

 const report=result?.days===days?result.report:null;
 const rows=report?.rows||[];
 const events=report?.events||[];
 const find=keyword.trim().toLocaleLowerCase('ko-KR');
 const visible=events.filter(event=>(actionFilter==='all'||event.action===actionFilter)&&
  (!find||[event.ip,activityDeviceLabel(event.ip),event.detail,GUIDE_ACTIVITY_LABELS[event.action],event.city,event.country].join(' ').toLocaleLowerCase('ko-KR').includes(find)));
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
  <div className="private-summary sph-metrics sph-guide-metrics">
   {actions.map(action=><section key={action}><span>{GUIDE_ACTIVITY_LABELS[action]}</span>
    <strong>{report?number.format(rows.reduce((sum,row)=>sum+(Number(row[action])||0),0)):'—'}</strong>
   </section>)}
  </div>
  <section className="private-records sph-guide-events" aria-label="가이드 상세 활동 기록" aria-busy={loading}>
   <div className="sph-activity-toolbar">
    <div className="sph-activity-toolbar-heading"><strong>최근 상세 활동</strong><span>최신 100건</span></div>
    <div className="sph-guide-filter">
     <label className="sph-guide-search"><Search size={14}/><input aria-label="가이드 IP 및 내용 검색" placeholder="IP · 클릭 항목 · 질문 검색" value={keyword} maxLength={100} onChange={event=>setKeyword(event.target.value)}/></label>
     <select aria-label="가이드 활동 종류" value={actionFilter} onChange={event=>setActionFilter(event.target.value)}>
      <option value="all">전체 활동</option>
      {actions.map(action=><option value={action} key={action}>{GUIDE_ACTIVITY_LABELS[action]}</option>)}
     </select>
    </div>
   </div>
   {error&&<p className="private-error" role="alert">{error}</p>}
   <div className="private-table-scroll"><table className="sph-guide-events-table">
    <thead><tr><th scope="col">발생 시간 (KST)</th><th scope="col">IP 주소</th><th scope="col">활동</th><th scope="col">클릭 항목 · 입력 내용</th></tr></thead>
    <tbody>{visible.map(event=><tr key={event.id}>
     <td className="private-time"><time dateTime={event.at}>{clock.format(new Date(event.at))}</time></td>
     <td className="sph-guide-ip"><div className="sph-guide-ip-line"><code>{event.anonymous?'익명':event.ip||'확인 불가'}</code>{activityDeviceLabel(event.ip)&&<span className="private-self-tag" title="등록된 관리자 IP">{activityDeviceLabel(event.ip)}</span>}{(event.city||event.country)&&<small title="접속 지역">{[event.country,event.city].filter(Boolean).join(' · ')}</small>}</div></td>
     <td><span className="sph-guide-action">{GUIDE_ACTIVITY_LABELS[event.action]||event.action}</span></td>
     <td className="sph-guide-detail">{event.detail?<span className="sph-guide-detail-text" title={event.detail}>{event.detail}</span>:<span className="sph-guide-missing">—</span>}</td>
    </tr>)}</tbody>
   </table>{!visible.length&&<div className="private-empty" role="status"><strong>{loading&&!report?'활동 기록을 불러오는 중입니다.':error?'조회에 실패했습니다.':find||actionFilter!=='all'?'검색 조건에 맞는 기록이 없습니다.':'아직 상세 활동 기록이 없습니다.'}</strong><span>상세 내역은 기록 기능 업데이트 이후부터 표시됩니다.</span></div>}</div>
   <div className="sph-records-footer"><span>{number.format(visible.length)}건 표시 · 최대 100건 조회</span><span>{report?'마지막 조회 '+clock.format(new Date(report.generatedAt)):'—'} · 한국 시간</span></div>
  </section>
  <p className="sph-simple-footnote">접속, 서비스 선택, 예시 선택, 질문 전송, 주요 버튼 클릭을 집계합니다. 익명 기록에는 수신 시각과 활동 종류가 표시됩니다.</p>
  <section className="private-records sph-guide-daily" aria-label="가이드 일별 활동 집계" aria-busy={loading}>
   <div className="sph-activity-toolbar"><div className="sph-activity-toolbar-heading"><strong>일별 활동 집계</strong><span>{days===1?'오늘':days+'일'}</span></div></div>
   <div className="private-table-scroll"><table className="sph-guide-table">
    <thead><tr><th scope="col">날짜 (한국 시간)</th>{actions.map(action=><th scope="col" key={action}>{GUIDE_ACTIVITY_LABELS[action]}</th>)}</tr></thead>
    <tbody>{rows.map(row=><tr key={row.date}><td>{row.date}</td>{actions.map(action=><td key={action}>{number.format(Number(row[action])||0)}</td>)}</tr>)}</tbody>
   </table>{!rows.length&&<div className="private-empty" role="status"><strong>{loading?'집계를 불러오는 중입니다.':'선택한 기간의 활동이 없습니다.'}</strong></div>}</div>
  </section>
 </div>;
}
