import 'server-only';
import {isIP} from 'node:net';
import boundaries from '@/geo/seoul-districts.json';
import postalRanges from '@/geo/seoul-postal-districts.json';
import type {ActivityConfidence,ActivityDistrictSource} from './activity-types';

const districts:Record<string,string>={gangnam:'강남구',gangdong:'강동구',gangbuk:'강북구',gangseo:'강서구',gwanak:'관악구',gwangjin:'광진구',guro:'구로구',geumcheon:'금천구',nowon:'노원구',dobong:'도봉구',dongdaemun:'동대문구',dongjak:'동작구',mapo:'마포구',seodaemun:'서대문구',seocho:'서초구',seongdong:'성동구',seongbuk:'성북구',songpa:'송파구',yangcheon:'양천구',yeongdeungpo:'영등포구',yongsan:'용산구',eunpyeong:'은평구',jongno:'종로구',jung:'중구',jungnang:'중랑구'};
const districtNames=new Set(Object.values(districts));
/** Vercel and most IP databases publish one shared point for the whole city. */
const SEOUL_CENTRE={latitude:37.5665,longitude:126.978};
const CENTRE_RADIUS_METERS=1200;
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
/** True when an IP database reused the city centre instead of a real neighbourhood point. */
export function isCityCentrePoint(latitude:number,longitude:number){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return false;
 const radians=(value:number)=>value*Math.PI/180;
 const dLat=radians(latitude-SEOUL_CENTRE.latitude),dLon=radians(longitude-SEOUL_CENTRE.longitude);
 const a=Math.sin(dLat/2)**2+Math.cos(radians(SEOUL_CENTRE.latitude))*Math.cos(radians(latitude))*Math.sin(dLon/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))<=CENTRE_RADIUS_METERS;
}
export function seoulPostalDistrict(postal:string){
 if(!/^0\d{4}$/.test(postal))return '';
 const code=Number(postal);
 return (postalRanges as [number,number,string][]).find(([start,end])=>code>=start&&code<=end)?.[2]||'';
}
/** Resolve the district shared by (almost) every postcode under a coarse three-digit prefix. */
export function seoulPostalPrefixDistrict(prefix:string){
 if(!/^0\d{2}$/.test(prefix))return '';
 const start=Number(prefix)*100,end=start+99,counts=new Map<string,number>();
 let total=0;
 for(const [from,to,district] of postalRanges as [number,number,string][]){
  const low=Math.max(from,start),high=Math.min(to,end);
  if(high>=low){const size=high-low+1;total+=size;counts.set(district,(counts.get(district)||0)+size)}
 }
 let best='',bestSize=0;
 for(const [district,size] of counts)if(size>bestSize){best=district;bestSize=size}
 return best&&bestSize/total>=0.8?best:'';
}
function cityDistrict(city:string){
 if(!city)return '';
 const korean=city.match(/(?:서울(?:특별시)?[\s,]*)?([가-힣]+구)(?:\s|$)/)?.[1];
 if(korean&&districtNames.has(korean))return korean;
 for(const token of city.toLowerCase().split(/[,\s]+/)){
  const match=districts[token.replace(/-?gu$/,'')];if(match)return match;
 }
 return '';
}
function coordinate(value:number|string|undefined|null){
 if(typeof value==='number')return Number.isFinite(value)?value:NaN;
 const text=String(value??'').trim();
 return /^-?\d+(?:\.\d+)?$/.test(text)?Number(text):NaN;
}
function headerCoordinate(headers:Headers,name:string){
 return coordinate(headers.get(name));
}
function isSeoulText(...values:string[]){
 return values.some(value=>/^(?:11)$/.test(value)||/seoul|서울/i.test(value));
}

export type RequestAddress={ip:string;ipVersion:'IPv4'|'IPv6'|'';public:boolean};
/** Read the visitor address without any network call (safe for rate limiting). */
export function requestAddress(headers:Headers):RequestAddress{
 const raw=(headers.get('x-vercel-forwarded-for')||headers.get('x-real-ip')||headers.get('x-forwarded-for')||'').split(',')[0].trim();
 let candidate=raw;
 if(candidate.startsWith('['))candidate=candidate.slice(1,candidate.indexOf(']'));
 candidate=candidate.replace(/^::ffff:/i,'');
 const version=isIP(candidate);
 if(!version)return {ip:process.env.VERCEL==='1'?'확인 불가':'127.0.0.1',ipVersion:'',public:false};
 return {ip:candidate,ipVersion:version===6?'IPv6':'IPv4',public:isPublicIp(candidate)};
}
function isPublicIp(ip:string){
 if(isIP(ip)===4)return !/^(?:10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(ip)&&!/^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip);
 if(isIP(ip)===6)return !/^(?:f[cd]|fe[89ab]|ff|::1$|::)/i.test(ip);
 return false;
}

/** One independent database's opinion. Each provider gets exactly one vote. */
type Dataset={name:string;region:string;regionCode:string;city:string;zip:string;latitude:number;longitude:number};
type GeoLookup={country:string;region:string;regionCode:string;city:string;zip:string;latitude:number;longitude:number;isp:string;asn:string;mobile:boolean;proxy:boolean;hosting:boolean;datasets:Dataset[]};
const lookupCache=new Map<string,{at:number;value:GeoLookup|null}>();
const LOOKUP_TTL=6*60*60*1000,LOOKUP_LIMIT=400;
const LOOKUP_TIMEOUT=2500;
async function fetchJson(url:string){
 if(typeof fetch!=='function')return null;
 const controller=typeof AbortController==='function'?new AbortController():null;
 const timer=controller?setTimeout(()=>controller.abort(),LOOKUP_TIMEOUT):null;
 try{
  const response=await fetch(url,{signal:controller?.signal,headers:{Accept:'application/json'},cache:'no-store'});
  return response.ok?await response.json() as Record<string,unknown>:null;
 }catch{return null}finally{if(timer)clearTimeout(timer)}
}
/**
 * Ask several independent databases at once. They disagree by kilometres inside Seoul,
 * so one provider is never trusted on its own: the district needs corroboration.
 * Disabled with LEGAL_IP_LOOKUP=off.
 */
async function lookupAddress(ip:string,address:RequestAddress):Promise<GeoLookup|null>{
 if(!address.public||process.env.LEGAL_IP_LOOKUP==='off')return null;
 const cached=lookupCache.get(ip);
 if(cached&&Date.now()-cached.at<LOOKUP_TTL)return cached.value;
 if(lookupCache.size>LOOKUP_LIMIT)for(const [key,entry] of lookupCache)if(Date.now()-entry.at>=LOOKUP_TTL)lookupCache.delete(key);
 const fields='status,message,country,countryCode,region,regionName,city,zip,lat,lon,isp,org,as,mobile,proxy,hosting';
 const [primary,second,third]=await Promise.all([
  fetchJson(`http://ip-api.com/json/${ip}?fields=${fields}&lang=en`),
  fetchJson(`https://api.ip.sb/geoip/${ip}`),
  fetchJson(`https://freeipapi.com/api/json/${ip}`)
 ]);
 const datasets:Dataset[]=[];
 let value:GeoLookup|null=null;
 if(primary&&primary.status==='success'&&String(primary.countryCode||'').toUpperCase()==='KR'){
  const dataset:Dataset={name:'ip-api',region:String(primary.regionName||''),regionCode:String(primary.region||''),city:String(primary.city||''),zip:String(primary.zip||''),latitude:coordinate(primary.lat as number),longitude:coordinate(primary.lon as number)};
  datasets.push(dataset);
  value={country:'KR',...dataset,isp:String(primary.isp||primary.org||'').slice(0,60),asn:String(primary.as||'').slice(0,40),mobile:primary.mobile===true,proxy:primary.proxy===true,hosting:primary.hosting===true,datasets};
 }
 const secondOk=Boolean(second&&String(second.country_code||'').toUpperCase()==='KR');
 if(secondOk)datasets.push({name:'ip.sb',region:String(second?.region||''),regionCode:String(second?.region_code||''),city:String(second?.city||''),zip:String(second?.postal_code||''),latitude:coordinate(second?.latitude as number),longitude:coordinate(second?.longitude as number)});
 const thirdOk=Boolean(third&&String(third.countryCode||'').toUpperCase()==='KR'&&typeof third.cityName==='string');
 if(thirdOk)datasets.push({name:'freeipapi',region:String(third?.regionName||''),regionCode:String(third?.regionCode||''),city:String(third?.cityName||''),zip:String(third?.zipCode||''),latitude:coordinate(third?.latitude as number),longitude:coordinate(third?.longitude as number)});
 if(!value&&datasets.length){
  value={country:'KR',...datasets[0],isp:String((secondOk?second?.isp:'')||(thirdOk?third?.asnOrganization:'')||'').slice(0,60),asn:String((secondOk?second?.asn:'')||(thirdOk?third?.asn:'')||'').slice(0,40),mobile:false,proxy:thirdOk&&third?.isProxy===true,hosting:false,datasets};
 }
 if(value)value.datasets=datasets;
 lookupCache.set(ip,{at:Date.now(),value});
 return value;
}

type Evidence={source:ActivityDistrictSource;group:string;district:string;weight:number;label:string;multi?:boolean;quiet?:boolean};
const maskPostcode=(postal:string)=>postal.length===5?`${postal.slice(0,3)}xx`:`${postal}xx`;
const datasetIsSeoul=(dataset:Dataset)=>/^11$/.test(dataset.regionCode)||/seoul|서울/i.test(dataset.region)||Boolean(cityDistrict(dataset.city));
/** The district one database names, plus how many of its own signals agree on it. */
function datasetDistrict(dataset:Dataset){
 const named=cityDistrict(dataset.city);
 const point=seoulDistrictAt(dataset.latitude,dataset.longitude);
 const pointOk=point&&!isCityCentrePoint(dataset.latitude,dataset.longitude)?point:'';
 const postal=seoulPostalDistrict(dataset.zip)||seoulPostalPrefixDistrict(dataset.zip);
 const district=named||pointOk||postal;
 if(!district)return {district:'',source:'unavailable' as ActivityDistrictSource,signals:0};
 const signals=(named===district?1:0)+(pointOk===district?1:0)+(postal===district?1:0);
 const source:ActivityDistrictSource=named===district?'geo-city':pointOk===district?'geo-coordinate':'geo-postal';
 return {district,source,signals};
}

function resolveDistrict(evidence:Evidence[]){
 const scores=new Map<string,number>();
 for(const item of evidence)scores.set(item.district,(scores.get(item.district)||0)+item.weight);
 let district='',score=0;
 for(const [name,value] of scores)if(value>score){district=name;score=value}
 const winning=evidence.filter(item=>item.district===district).sort((a,b)=>b.weight-a.weight);
 const competing=evidence.some(item=>item.district!==district&&item.weight>=3);
 const groups=new Set(winning.map(item=>item.group));
 const full=winning.filter(item=>(item.source==='ip-postal'||item.source==='geo-postal')&&item.weight>=6);
 const named=winning.some(item=>item.weight>=2&&(item.source==='ip-city'||item.source==='geo-city'||item.source==='ip-postal'||item.source==='geo-postal'));
 const multi=winning.some(item=>item.multi);
 let confidence:ActivityConfidence='low';
 if(groups.size>=3||(full.length&&groups.size>=2))confidence='high';
 else if(groups.size>=2||full.length||multi||named)confidence='medium';
 if(competing)confidence=confidence==='high'?'medium':confidence;
 return {
  district,
  source:winning[0]?.source||'unavailable' as ActivityDistrictSource,
  confidence,
  evidence:evidence.filter(item=>!item.quiet).map(item=>`${item.label} ${item.district}`).join(' · ')
 };
}

/** Estimate the visitor's network location from every signal the request exposes. */
export async function activityLocation(headers:Headers,verifiedDistrict=''){
 const address=requestAddress(headers);
 const ip=address.ip;
 const geo=await lookupAddress(ip,address);
 const country=(decode(headers.get('x-vercel-ip-country'))||geo?.country||'').toUpperCase();
 const vercelRegion=decode(headers.get('x-vercel-ip-country-region'));
 const vercelCity=decode(headers.get('x-vercel-ip-city'));
 const vercelPostal=decode(headers.get('x-vercel-ip-postal-code'));
 const datasets=geo?.datasets||[];
 const seoulVotes=datasets.filter(datasetIsSeoul).length;
 const seoul=country==='KR'&&(datasets.length?seoulVotes*2>=datasets.length:isSeoulText(vercelRegion,vercelCity));
 const evidence:Evidence[]=[];
 let locationNote='',centreOnly=false;
 if(seoul){
  const votes:Evidence[]=[];
  for(const dataset of datasets){
   if(!datasetIsSeoul(dataset))continue;
   const found=datasetDistrict(dataset);
   if(found.district)votes.push({source:found.source,group:dataset.name,district:found.district,weight:3,label:`IP DB ${dataset.name}`,multi:found.signals>=2});
  }
  const named=cityDistrict(vercelCity);
  if(named)evidence.push({source:'ip-city',group:'vercel',district:named,weight:3,label:'도시명'});
  const postal=seoulPostalDistrict(vercelPostal);
  if(postal){
   // Vercel's Korean postcode is usually the capital's registration postcode (031xx), so it
   // only counts strongly when a district-aware database names the same district.
   const corroborated=votes.some(item=>item.district===postal);
   evidence.push({source:'ip-postal',group:'vercel',district:postal,weight:corroborated?6:2,label:`우편번호 ${maskPostcode(vercelPostal)}`,quiet:!corroborated&&votes.length>0});
  }
  const pointLat=headerCoordinate(headers,'x-vercel-ip-latitude'),pointLon=headerCoordinate(headers,'x-vercel-ip-longitude');
  const point=seoulDistrictAt(pointLat,pointLon);
  if(point&&!isCityCentrePoint(pointLat,pointLon))evidence.push({source:'ip-coordinate',group:'vercel',district:point,weight:1,label:'대표좌표'});
  else if(point)centreOnly=true;
  evidence.push(...votes);
 }
 const resolved=seoul?resolveDistrict(evidence):{district:'',source:'unavailable' as ActivityDistrictSource,confidence:'low' as ActivityConfidence,evidence:''};
 if(seoul&&resolved.district){
  const dissent=[...new Set(evidence.filter(item=>item.group!=='vercel'&&item.district!==resolved.district).map(item=>`${item.label.replace('IP DB ','')} ${item.district}`))];
  const quietPostal=evidence.find(item=>item.source==='ip-postal'&&item.weight<6&&item.district!==resolved.district);
  const supporters=new Set(evidence.filter(item=>item.district===resolved.district).map(item=>item.group)).size;
  const notes:string[]=[];
  if(dissent.length)notes.push(supporters>=2?`IP 데이터베이스가 갈립니다(${dissent.join(' · ')}). ${supporters}곳이 일치한 ${resolved.district}로 표시합니다.`:`IP 데이터베이스가 갈립니다(${dissent.join(' · ')}). 다수가 없어 대표값 ${resolved.district}로 표시합니다.`);
  if(quietPostal)notes.push(`Vercel 우편번호(${quietPostal.label.replace('우편번호 ','')})는 서울시 중심 기본값일 수 있습니다.`);
  locationNote=notes.join(' ');
 }else if(seoul&&!resolved.district){
  const elsewhere=geo&&geo.city&&geo.regionCode!=='11'&&!/seoul|서울/i.test(geo.city)&&!cityDistrict(geo.city)?`IP 데이터베이스는 ${geo.region||'해외'} ${geo.city}(으)로 보고합니다. `:'';
  locationNote=elsewhere?`${elsewhere}서울 구 판별 정보가 부족합니다.`:centreOnly?'IP 데이터가 서울 중심점 좌표만 제공해 구를 표시하지 않습니다.':'이 IP에는 서울 구를 판별할 위치 정보가 없습니다.';
 }
 const district=verifiedDistrict||resolved.district;
 const city=seoul||verifiedDistrict?'서울특별시':vercelCity||geo?.city||'';
 const location=city?(district?`${city} ${district}`:city):(country||'지역 확인 불가');
 const networkType=geo?(geo.hosting?'데이터센터·VPN 의심':geo.proxy?'프록시·VPN 의심':geo.mobile?'모바일 회선':'일반 회선'):'';
 const networkRisk=geo?(geo.proxy||geo.hosting?'의심':''):'';
 if(verifiedDistrict)return {ip,ipVersion:address.ipVersion,country,city,district,location,districtSource:'verified' as ActivityDistrictSource,districtConfidence:'high' as ActivityConfidence,districtEvidence:`브라우저 위치 확인 ${verifiedDistrict}`,locationNote:'',isp:geo?.isp||'',asn:geo?.asn||'',networkType,networkRisk};
 return {ip,ipVersion:address.ipVersion,country,city,district,location,districtSource:resolved.source,districtConfidence:resolved.confidence,districtEvidence:resolved.evidence,locationNote,isp:geo?.isp||'',asn:geo?.asn||'',networkType,networkRisk};
}
