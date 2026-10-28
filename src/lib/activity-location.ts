import 'server-only';
import {isIP} from 'node:net';
const districts:Record<string,string>={gangnam:'강남구',gangdong:'강동구',gangbuk:'강북구',gangseo:'강서구',gwanak:'관악구',gwangjin:'광진구',guro:'구로구',geumcheon:'금천구',nowon:'노원구',dobong:'도봉구',dongdaemun:'동대문구',dongjak:'동작구',mapo:'마포구',seodaemun:'서대문구',seocho:'서초구',seongdong:'성동구',seongbuk:'성북구',songpa:'송파구',yangcheon:'양천구',yeongdeungpo:'영등포구',yongsan:'용산구',eunpyeong:'은평구',jongno:'종로구',jung:'중구',jungnang:'중랑구'};
const decode=(text:string|null)=>{try{return decodeURIComponent(text||'').slice(0,100)}catch{return ''}};
export function activityLocation(headers:Headers){
 const raw=(headers.get('x-vercel-forwarded-for')||headers.get('x-real-ip')||headers.get('x-forwarded-for')||'').split(',')[0].trim();
 const ip=isIP(raw)?raw:process.env.VERCEL==='1'?'확인 불가':'127.0.0.1';
 const country=decode(headers.get('x-vercel-ip-country'));
 const region=decode(headers.get('x-vercel-ip-country-region'));
 const sourceCity=decode(headers.get('x-vercel-ip-city'));
 const seoul=country==='KR'&&(region==='11'||/seoul|서울/i.test(sourceCity));
 let district='';
 if(seoul){district=Object.values(districts).find(name=>sourceCity.includes(name))||districts[sourceCity.toLowerCase().replace(/(?:[-\s]?gu)$/,'').trim()]||''}
 const city=seoul?'서울특별시':sourceCity;
 const location=city?[city,district].filter(Boolean).join(' '):country||'지역 확인 불가';
 return {ip,country,city,district,location};
}
