import type {ActivitySite} from './activity-types';
const loopback=(hostname:string)=>hostname==='localhost'||hostname==='127.0.0.1'||hostname==='[::1]';
/** The production host each tracked site writes from, plus its Vercel preview hosts. */
const TRACKED_HOSTS:Record<Exclude<ActivitySite,'law'>,{project:string;production?:string;preview:RegExp}>={portfolio:{project:'leopark-portfolio',preview:/^leopark-portfolio-[a-z0-9-]+\.vercel\.app$/},mapforyou:{project:'mapforyou',preview:/^mapforyou-[a-z0-9-]+\.vercel\.app$/},scout:{project:'influencer-scout',production:'influencer-scout-ten.vercel.app',preview:/^influencer-scout-[a-z0-9-]+\.vercel\.app$/}};
/**
 * Every tracked site lives on another origin, so only its own production and preview
 * hosts (plus local preview servers) may write records for that site's tab.
 */
export function siteOriginAllowed(origin:string|null,site:Exclude<ActivitySite,'law'>){
 if(!origin)return false;
 try{
  const {protocol,hostname}=new URL(origin),hosts=TRACKED_HOSTS[site];
  if(protocol==='https:'&&(hostname===(hosts.production||hosts.project+'.vercel.app')||hosts.preview.test(hostname)))return true;
  return protocol==='http:'&&loopback(hostname);
 }catch{return false}
}
export const portfolioOriginAllowed=(origin:string|null)=>siteOriginAllowed(origin,'portfolio');
export const mapforyouOriginAllowed=(origin:string|null)=>siteOriginAllowed(origin,'mapforyou');
export const scoutOriginAllowed=(origin:string|null)=>siteOriginAllowed(origin,'scout');
