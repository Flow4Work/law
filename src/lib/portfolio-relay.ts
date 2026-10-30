import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
const GEO_HEADERS=['x-vercel-forwarded-for','x-vercel-ip-country','x-vercel-ip-country-region','x-vercel-ip-city','x-vercel-ip-postal-code','x-vercel-ip-latitude','x-vercel-ip-longitude'];
/** Signed first-party relay; never trust a public caller's forwarded visitor IP. */
export async function decodePortfolioRelay(request:Request):Promise<Request|null>{
 const secret=process.env.LEGAL_PORTFOLIO_RELAY_SECRET,time=request.headers.get('x-law-relay-time')||'',signature=request.headers.get('x-law-relay-signature')||'';
 if(!secret||secret.length<32||!/^\d{13}$/.test(time)||Math.abs(Date.now()-Number(time))>60000||!/^[a-f0-9]{64}$/.test(signature))return null;
 const raw=await request.text();if(raw.length>4000)return null;
 const expected=createHmac('sha256',secret).update(time+'\n'+raw).digest();
 const supplied=Buffer.from(signature,'hex');if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return null;
 try{
  const {event,visitor}=JSON.parse(raw);if(!visitor||typeof visitor['x-vercel-forwarded-for']!=='string')return null;
  const headers=new Headers({'content-type':'application/json'});
  for(const key of GEO_HEADERS){const value=visitor[key];if(typeof value==='string'&&value.length<=200)headers.set(key,value)}
  return new Request(request.url,{method:'POST',headers,body:JSON.stringify(event)});
 }catch{return null}
}
