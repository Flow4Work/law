import 'server-only';
import {isIP} from 'node:net';
import boundaries from '@/geo/seoul-districts.json';
import postalRanges from '@/geo/seoul-postal-districts.json';
import type {ActivityDistrictSource} from './activity-types';

const districts:Record<string,string>={gangnam:'강남구',gangdong:'강동구',gangbuk:'강북구',gangseo:'강서구',gwanak:'관악구',gwangjin:'광진구',guro:'구로구',geumcheon:'금천구',nowon:'노원구',dobong:'도봉구',dongdaemun:'동대문구',dongjak:'동작구',mapo:'마포구',seodaemun:'서대문구',seocho:'서초구',seongdong:'성동구',seongbuk:'성북구',songpa:'송파구',yangcheon:'양천구',yeongdeungpo:'영등포구',yongsan:'용산구',eunpyeong:'은평구',jongno:'종로구',jung:'중구',jungnang:'중랑구'};
const decode=(text:string|null)=>{try{return decodeURIComponent(text||'').slice(0,100)}catch{return ''}};
type Ring=number[][];
type Polygon=Ring[];
type DistrictFeature={properties:{SIG_KOR_NM:string};geometry:{type:string;coordinates:Polygon|Polygon[]}};

function insideRing(x:number,y:number,ring:Ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
function insidePolygon(x:number,y:number,polygon:Polygon){
 return Boolean(polygon[0]&&insideRing(x,y,polygon[0])&&!polygon.slice(1).some(hole=>insideRing(x,y,hole)));
}

/** Classify a provider's approximate IP point locally, without retaining the coordinates. */
export function seoulDistrictAt(latitude:number,longitude:number){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<37.4||latitude>37.72||longitude<126.75||longitude>127.2)return '';
 for(const feature of boundaries.features as DistrictFeature[]){
  const polygons=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates as Polygon[]:[feature.geometry.coordinates as Polygon];
  if(polygons.some(polygon=>insidePolygon(longitude,latitude,polygon)))return feature.properties.SIG_KOR_NM;
 }
 return '';
}
export function seoulPostalDistrict(postal:string){
 if(!/^0\d{4}$/.test(postal))return '';
 const code=Number(postal);
 return (postalRanges as [number,number,string][]).find(([start,end])=>code>=start&&code<=end)?.[2]||'';
}
function cityDistrict(city:string){
 const korean=city.match(/(?:서울(?:특별시)?[\s,]*)?([가-힣]+구)(?:\s|$)/)?.[1];
 if(korean&&Object.values(districts).includes(korean))return korean;
 for(const token of city.toLowerCase().split(/[,\s]+/)){
  const match=districts[token.replace(/-?gu$/,'')];if(match)return match;
 }
 return '';
}
function coordinate(headers:Headers,name:string){
 const text=headers.get(name)?.trim();
 return text&&/^-?\d+(?:\.\d+)?$/.test(text)?Number(text):NaN;
}

export function activityLocation(headers:Headers){
 const raw=(headers.get('x-vercel-forwarded-for')||headers.get('x-real-ip')||headers.get('x-forwarded-for')||'').split(',')[0].trim();
 const ip=isIP(raw)?raw:process.env.VERCEL==='1'?'확인 불가':'127.0.0.1';
 const country=decode(headers.get('x-vercel-ip-country'));
 const region=decode(headers.get('x-vercel-ip-country-region'));
 const sourceCity=decode(headers.get('x-vercel-ip-city'));
 const postalDistrict=country==='KR'?seoulPostalDistrict(decode(headers.get('x-vercel-ip-postal-code'))):'';
 const seoul=country==='KR'&&(region==='11'||/seoul|서울/i.test(sourceCity)||Boolean(postalDistrict)&&!region);
 let district='',districtSource:ActivityDistrictSource='unavailable',locationNote='';
 if(seoul){
  const named=cityDistrict(sourceCity);
  const pointDistrict=seoulDistrictAt(coordinate(headers,'x-vercel-ip-latitude'),coordinate(headers,'x-vercel-ip-longitude'));
  if(named){district=named;districtSource='ip-city'}
  else if(postalDistrict){district=postalDistrict;districtSource='ip-postal'}
  else if(pointDistrict){district=pointDistrict;districtSource='ip-coordinate'}
  if(new Set([named,postalDistrict,pointDistrict].filter(Boolean)).size>1)locationNote='IP 위치 근거의 구가 서로 다릅니다. 실제 위치 확인이 필요합니다.';
  if(!district)locationNote='이 IP에는 구를 판별할 세부 위치 정보가 없습니다.';
 }
 const city=seoul?'서울특별시':sourceCity;
 const location=city?[city,district].filter(Boolean).join(' '):country||'지역 확인 불가';
 return {ip,country,city,district,location,districtSource,locationNote};
}
