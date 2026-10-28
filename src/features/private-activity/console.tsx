'use client';
import {useCallback,useEffect,useState} from 'react';
import {Activity,ArrowDown,ArrowUp,Clock3,Globe2,KeyRound,LoaderCircle,LogOut,MapPin,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import {ACTIVITY_LABELS,type ActivityReport,type ActivityAction,type ActivityConfidence,type ActivityEvent} from '@/lib/activity-types';
import './console.css';
const dateTime=(value:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(value));
const number=(value:number|undefined)=>value===undefined?'—':value.toLocaleString('ko-KR');
const confidenceLabels:Record<ActivityConfidence,string>={high:'정확도 높음',medium:'정확도 보통',low:'정확도 낮음'};
const confidenceOf=(event:ActivityEvent):ActivityConfidence|''=>!event.district?'':event.districtConfidence||(event.districtSource==='ip-postal'?'high':event.districtSource==='ip-coordinate'?'low':'medium');
const methodLabel=(event:ActivityEvent)=>{
 switch(event.districtSource){
  case 'verified':return '브라우저 위치 확인';
  case 'ip-postal':return '서울시 우편번호';
  case 'geo-postal':return 'IP DB 우편번호';
  case 'ip-city':return 'IP 도시명';
  case 'geo-city':return 'IP DB 도시명';
  case 'ip-coordinate':return '서울시 대표좌표';
  case 'geo-coordinate':return 'IP DB 대표좌표';
  default:return event.country&&event.country!=='KR'?'해외 IP':event.districtSource==='unavailable'?'구 판별 정보 없음':'이전 기록';
 }
};
const countryNames=new Intl.DisplayNames(['ko'],{type:'region'});
const locationLabel=(event:ActivityEvent)=>event.country&&event.country!=='KR'&&/^[A-Z]{2}$/.test(event.country)?`${countryNames.of(event.country)} · ${event.city||'도시 확인 불가'}`:event.location;
/** One compact line: how many signals agreed, then who the network belongs to. */
const locationSummary=(event:ActivityEvent)=>{
 const parts=(event.districtEvidence||'').split(' · ').filter(Boolean);
 const agreed=parts.filter(part=>part.endsWith(' '+event.district)).length;
 const others=[...new Set(parts.filter(part=>!part.endsWith(' '+event.district)).map(part=>part.split(' ').pop()||'').filter(Boolean))];
 const evidence=event.district?[`근거 ${agreed}/${parts.length}`,others.length?`불일치 ${others.join('·')}`:''].filter(Boolean).join(' · '):methodLabel(event);
 return [evidence,event.isp?`${event.isp} ${event.networkType||''}`.trim():'',event.networkRisk?`${event.networkRisk} IP`:''].filter(Boolean).join(' · ');
};
const locationDetail=(event:ActivityEvent)=>[event.districtEvidence&&'근거: '+event.districtEvidence,event.locationNote].filter(Boolean).join('\n');
export function PrivateActivityConsole({initiallyAuthenticated}:{initiallyAuthenticated:boolean}){
 const [authenticated,setAuthenticated]=useState(initiallyAuthenticated),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [report,setReport]=useState<ActivityReport|null>(null),[days,setDays]=useState(1),[search,setSearch]=useState(''),[action,setAction]=useState('all'),[newest,setNewest]=useState(true),[locationFilter,setLocationFilter]=useState('all');
 const [verifying,setVerifying]=useState(false),[verified,setVerified]=useState('');
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
 const verify=async()=>{
  if(verifying)return;setVerifying(true);setError('');setVerified('');
  try{
   const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:15000,maximumAge:0,enableHighAccuracy:true}));
   const response=await fetch(endpoint('/verify-location'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({latitude:position.coords.latitude,longitude:position.coords.longitude})});
   const data=await response.json();
   if(!response.ok)throw new Error(data.error||'위치를 확인하지 못했습니다.');
   setVerified(data.location||data.district);await load();
  }catch(cause){setError(cause instanceof GeolocationPositionError?'브라우저가 위치 제공을 허용하지 않았습니다. 주소창의 위치 권한을 확인해주세요.':cause instanceof Error?cause.message:'위치를 확인하지 못했습니다.')}
  finally{setVerifying(false)}
 };
 if(!authenticated)return <main className="private-activity private-login"><form className="private-login-card" onSubmit={login}>
  <div className="private-emblem"><ShieldCheck size={24}/></div><span className="private-kicker">PRIVATE ACCESS</span><h1>활동 기록</h1><p>관리자 비밀번호로 접속합니다.</p>
  <label htmlFor="private-password">비밀번호</label><div className="private-password"><KeyRound size={17}/><input id="private-password" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required maxLength={256} autoFocus/></div>
  {error&&<p className="private-error" role="alert">{error}</p>}<button className="private-primary" disabled={busy||!password}>{busy?<LoaderCircle className="private-spin" size={18}/>:null}접속하기</button><small>관리자 전용 · 아이디 입력 없음</small>
 </form></main>;
 const query=search.trim().toLowerCase();
 const filtered=(report?.events||[]).filter(event=>{
  const level=confidenceOf(event);
  return (action==='all'||event.action===action)&&(locationFilter==='all'||locationFilter==='district'&&Boolean(event.district)||locationFilter==='missing'&&!event.district||locationFilter==='high'&&level==='high'||locationFilter==='medium'&&level==='medium'||locationFilter==='low'&&level==='low')&&[event.ip,event.ipVersion,locationLabel(event),event.city,event.district,event.isp,event.districtEvidence,event.detail,ACTIVITY_LABELS[event.action]].join(' ').toLowerCase().includes(query);
 });
 const rows=newest?filtered:[...filtered].reverse();
 const matched=filtered.filter(event=>event.district).length;
 return <main className="private-activity"><div className="private-wrap">
  <header className="private-header"><div><div className="private-kicker"><span/>PRIVATE WORKSPACE</div><h1>서비스 활동 기록</h1><p>접속 위치와 질문, 서비스 이용 흐름을 한곳에서 확인합니다.</p></div><div className="private-actions"><button className="private-button" onClick={verify} disabled={verifying||busy} title="이 브라우저의 실제 위치로 구를 한 번 확인하면, 이 IP의 기록이 정확해집니다.">{verifying?<LoaderCircle className="private-spin" size={16}/>:<MapPin size={16}/>}내 위치로 구 확인</button><button className="private-button" onClick={logout} disabled={busy}><LogOut size={16}/>로그아웃</button></div></header>
  {verified&&<p className="private-verified" role="status"><MapPin size={15}/>이 브라우저 위치를 {verified}(으)로 확인했습니다. 이 IP의 기록은 정확도 높음으로 표시됩니다.</p>}
  <div className="private-summary">{[{label:'서비스 접속',value:report?.visits,icon:Globe2},{label:'입력한 질문',value:report?.queries,icon:Search},{label:'고유 IP',value:report?.uniqueIps,icon:ShieldCheck},{label:'전체 활동',value:report?.total,icon:Activity}].map(({label,value,icon:Icon})=><section key={label}><span>{label}<Icon size={17}/></span><strong>{number(value)}</strong><small>{days===1?'오늘':`최근 ${days}일`} 기준</small></section>)}</div>
  <section className="private-records"><div className="private-toolbar"><div className="private-search"><Search size={17}/><input aria-label="활동 기록 검색" placeholder="IP, 지역, 질문 내용 검색" value={search} onChange={event=>setSearch(event.target.value)}/></div><div className="private-filters"><select aria-label="조회 기간" value={days} onChange={event=>setDays(Number(event.target.value))}><option value={1}>오늘</option><option value={7}>최근 7일</option><option value={30}>최근 30일</option></select><select aria-label="활동 종류" value={action} onChange={event=>setAction(event.target.value)}><option value="all">전체 활동</option>{Object.entries(ACTIVITY_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><select aria-label="구 판별 정확도" value={locationFilter} onChange={event=>setLocationFilter(event.target.value)}><option value="all">전체 위치</option><option value="district">구 판별됨</option><option value="high">정확도 높음</option><option value="medium">정확도 보통</option><option value="low">정확도 낮음</option><option value="missing">구 정보 없음</option></select><button className="private-button" onClick={load} disabled={busy}><RefreshCw size={16} className={busy?'private-spin':''}/>새로고침</button></div></div>
   {error&&<p className="private-error" role="alert">{error}</p>}
   <div className="private-table-scroll"><table><thead><tr><th><button onClick={()=>setNewest(value=>!value)} aria-label="시간 순서 바꾸기">접속·활동 시각 {newest?<ArrowDown size={13}/>:<ArrowUp size={13}/>}</button></th><th>IP 주소</th><th>추정 지역 (시·구)</th><th>활동</th><th>내용</th></tr></thead><tbody>
    {rows.map(event=>{const level=confidenceOf(event);return <tr key={event.id}><td className="private-time"><Clock3 size={13}/><time dateTime={event.at}>{dateTime(event.at)}</time></td><td className="private-ip-cell"><button className="private-ip" onClick={()=>setSearch(event.ip)}>{event.ip}</button>{event.ipVersion&&<small className="private-ip-version">{event.ipVersion}</small>}</td><td className="private-location-cell"><div className="private-location-line"><strong className="private-location">{locationLabel(event)}</strong>{level&&<span className={'private-confidence private-confidence-'+level}>{confidenceLabels[level]}</span>}</div><small className={'private-summary-line'+(event.locationNote?' private-summary-warn':'')} title={locationDetail(event)}>{locationSummary(event)}</small></td><td><span className={'private-tag private-tag-'+event.action}>{ACTIVITY_LABELS[event.action as ActivityAction]}</span></td><td className="private-detail">{event.detail?<details><summary>{event.detail.slice(0,80)}{event.detail.length>80?'…':''}</summary><p>{event.detail}</p></details>:<span className="private-muted">—</span>}</td></tr>})}
   </tbody></table>{!rows.length&&<div className="private-empty"><Activity size={26}/><strong>{busy?'기록을 불러오고 있습니다.':report?.total?'검색 결과가 없습니다.':'아직 기록된 활동이 없습니다.'}</strong><span>{busy?'잠시만 기다려주세요.':'서비스에서 발생한 활동이 여기에 표시됩니다.'}</span></div>}</div>
   <footer className="private-table-footer"><span>{number(rows.length)}건 표시 · 구 판별 {number(matched)}건{report?.limited?' · 최근 기록 중심으로 표시':''}</span><span>{report?'업데이트 '+dateTime(report.generatedAt):'기록 불러오는 중'} · 한국 시간</span></footer>
  </section><p className="private-footnote">구는 ① 브라우저 위치 확인 ② 서울시 우편번호 ③ IP 데이터베이스의 도시명·우편번호·좌표 순서로 판단합니다. Vercel이 주는 한국 우편번호는 서울시 중심 기본값인 경우가 많아, IP 데이터베이스가 다른 구를 가리키면 그쪽을 채택합니다. 회선 상세는 줄에 마우스를 올리면 전체 근거가 보입니다. IP만으로는 VPN·모바일 회선에서 실제 위치와 다를 수 있으니, 정확한 구는 “내 위치로 구 확인”을 한 번 눌러 확정하세요.</p>
 </div></main>;
}
