'use client';
import {useCallback,useEffect,useState} from 'react';
import {Activity,ArrowDown,ArrowUp,Clock3,Globe2,KeyRound,LoaderCircle,LogOut,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import {ACTIVITY_LABELS,type ActivityReport,type ActivityAction,type ActivityEvent} from '@/lib/activity-types';
import './console.css';
const dateTime=(value:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value));
const number=(value:number|undefined)=>value===undefined?'—':value.toLocaleString('ko-KR');
const districtLabel=(event:ActivityEvent)=>event.districtSource==='ip-coordinate'?'IP 대표좌표 기준 · 낮은 정확도':event.districtSource==='ip-postal'?'IP 우편번호 기준 추정':event.districtSource==='ip-city'?'IP 도시명 기준 추정':event.district?'구 단위 추정':event.country&&event.country!=='KR'?'해외 IP · 경유 서버일 수 있음':event.districtSource==='unavailable'?'구 판별 정보 없음':'이전 기록 · 세부 위치 없음';
const countryNames=new Intl.DisplayNames(['ko'],{type:'region'});
const locationLabel=(event:ActivityEvent)=>event.country&&event.country!=='KR'&&/^[A-Z]{2}$/.test(event.country)?`${countryNames.of(event.country)} · ${event.city||'도시 확인 불가'}`:event.location;
export function PrivateActivityConsole({initiallyAuthenticated}:{initiallyAuthenticated:boolean}){
 const [authenticated,setAuthenticated]=useState(initiallyAuthenticated),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [report,setReport]=useState<ActivityReport|null>(null),[days,setDays]=useState(1),[search,setSearch]=useState(''),[action,setAction]=useState('all'),[newest,setNewest]=useState(true),[locationFilter,setLocationFilter]=useState('all');
 const endpoint=(suffix:string)=>window.location.pathname.replace(/\/$/,'')+suffix;
 const load=useCallback(async()=>{
  setBusy(true);setError('');
  try{const response=await fetch(window.location.pathname.replace(/\/$/,'')+'/events?days='+days,{cache:'no-store'});const data=await response.json();if(response.status===401){setAuthenticated(false);setReport(null);return}if(!response.ok)throw new Error(data.error||'기록을 불러오지 못했습니다.');setReport(data)}
  catch(error){setError(error instanceof Error?error.message:'기록을 불러오지 못했습니다.')}
  finally{setBusy(false)}
 },[days]);
 useEffect(()=>{if(authenticated)void load()},[authenticated,load]);
 const login=async(event:React.FormEvent)=>{
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{const response=await fetch(endpoint('/access'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const data=await response.json();if(!response.ok)throw new Error(data.error||'로그인하지 못했습니다.');setPassword('');setAuthenticated(true)}
  catch(error){setError(error instanceof Error?error.message:'로그인하지 못했습니다.')}
  finally{setBusy(false)}
 };
 const logout=async()=>{setBusy(true);try{const response=await fetch(endpoint('/access'),{method:'DELETE'});if(!response.ok)throw new Error();setAuthenticated(false);setReport(null);setError('')}catch{setError('로그아웃하지 못했습니다. 다시 시도해주세요.')}finally{setBusy(false)}};
 if(!authenticated)return <main className="private-activity private-login"><form className="private-login-card" onSubmit={login}>
  <div className="private-emblem"><ShieldCheck size={24}/></div><span className="private-kicker">PRIVATE ACCESS</span><h1>활동 기록</h1><p>관리자 비밀번호로 접속합니다.</p>
  <label htmlFor="private-password">비밀번호</label><div className="private-password"><KeyRound size={17}/><input id="private-password" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required maxLength={256} autoFocus/></div>
  {error&&<p className="private-error" role="alert">{error}</p>}<button className="private-primary" disabled={busy||!password}>{busy?<LoaderCircle className="private-spin" size={18}/>:null}접속하기</button><small>관리자 전용 · 아이디 입력 없음</small>
 </form></main>;
 const query=search.trim().toLowerCase();
 const filtered=(report?.events||[]).filter(event=>(action==='all'||event.action===action)&&(locationFilter==='all'||locationFilter==='district'&&Boolean(event.district)||locationFilter==='missing'&&!event.district||event.districtSource===locationFilter)&&[event.ip,locationLabel(event),event.city,event.district,event.detail,ACTIVITY_LABELS[event.action]].join(' ').toLowerCase().includes(query));
 const rows=newest?filtered:[...filtered].reverse();
 return <main className="private-activity"><div className="private-wrap">
  <header className="private-header"><div><div className="private-kicker"><span/>PRIVATE WORKSPACE</div><h1>서비스 활동 기록</h1><p>접속 위치와 질문, 서비스 이용 흐름을 한곳에서 확인합니다.</p></div><button className="private-button" onClick={logout} disabled={busy}><LogOut size={16}/>로그아웃</button></header>
  <div className="private-summary">{[{label:'서비스 접속',value:report?.visits,icon:Globe2},{label:'입력한 질문',value:report?.queries,icon:Search},{label:'고유 IP',value:report?.uniqueIps,icon:ShieldCheck},{label:'전체 활동',value:report?.total,icon:Activity}].map(({label,value,icon:Icon})=><section key={label}><span>{label}<Icon size={17}/></span><strong>{number(value)}</strong><small>{days===1?'오늘':`최근 ${days}일`} 기준</small></section>)}</div>
  <section className="private-records"><div className="private-toolbar"><div className="private-search"><Search size={17}/><input aria-label="활동 기록 검색" placeholder="IP, 지역, 질문 내용 검색" value={search} onChange={event=>setSearch(event.target.value)}/></div><div className="private-filters"><select aria-label="조회 기간" value={days} onChange={event=>setDays(Number(event.target.value))}><option value={1}>오늘</option><option value={7}>최근 7일</option><option value={30}>최근 30일</option></select><select aria-label="활동 종류" value={action} onChange={event=>setAction(event.target.value)}><option value="all">전체 활동</option>{Object.entries(ACTIVITY_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><select aria-label="위치 판별 방식" value={locationFilter} onChange={event=>setLocationFilter(event.target.value)}><option value="all">전체 위치</option><option value="district">구 추정 있음</option><option value="ip-postal">IP 우편번호 기준</option><option value="ip-coordinate">IP 대표좌표 기준</option><option value="missing">구 정보 없음</option></select><button className="private-button" onClick={load} disabled={busy}><RefreshCw size={16} className={busy?'private-spin':''}/>새로고침</button></div></div>
   {error&&<p className="private-error" role="alert">{error}</p>}
   <div className="private-table-scroll"><table><thead><tr><th><button onClick={()=>setNewest(value=>!value)} aria-label="시간 순서 바꾸기">접속·활동 시각 {newest?<ArrowDown size={13}/>:<ArrowUp size={13}/>}</button></th><th>IP 주소</th><th>추정 지역</th><th>활동</th><th>내용</th></tr></thead><tbody>
    {rows.map(event=><tr key={event.id}><td className="private-time"><Clock3 size={13}/><time dateTime={event.at}>{dateTime(event.at)}</time></td><td><button className="private-ip" onClick={()=>setSearch(event.ip)}>{event.ip}</button></td><td><strong className="private-location">{locationLabel(event)}</strong><small className="private-district">{districtLabel(event)}</small>{event.locationNote&&<small className="private-location-note">{event.locationNote}</small>}</td><td><span className={'private-tag private-tag-'+event.action}>{ACTIVITY_LABELS[event.action as ActivityAction]}</span></td><td className="private-detail">{event.detail?<details><summary>{event.detail.slice(0,80)}{event.detail.length>80?'…':''}</summary><p>{event.detail}</p></details>:<span className="private-muted">—</span>}</td></tr>)}
   </tbody></table>{!rows.length&&<div className="private-empty"><Activity size={26}/><strong>{busy?'기록을 불러오고 있습니다.':report?.total?'검색 결과가 없습니다.':'아직 기록된 활동이 없습니다.'}</strong><span>{busy?'잠시만 기다려주세요.':'서비스에서 발생한 활동이 여기에 표시됩니다.'}</span></div>}</div>
   <footer className="private-table-footer"><span>{number(rows.length)}건 표시{report?.limited?' · 최근 기록 중심으로 표시':''}</span><span>{report?'업데이트 '+dateTime(report.generatedAt):'기록 불러오는 중'} · 한국 시간</span></footer>
  </section><p className="private-footnote">구는 IP 도시명 → IP 우편번호 → IP 대표좌표 순서로 판별합니다. 모든 결과는 네트워크 위치의 추정이며 실제 접속자의 구를 보장하지 않습니다. 특히 대표좌표는 통신사·VPN·도시 중심점일 수 있습니다. 보강 전 기록은 당시 세부 정보가 없어 소급 판별하지 않습니다.</p>
 </div></main>;
}
