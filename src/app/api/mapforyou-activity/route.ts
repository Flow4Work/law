import {ingestActivity} from '@/lib/activity-ingest';
import {mapforyouOriginAllowed} from '@/lib/site-origin';
export const runtime='nodejs';
export const maxDuration=30;
/**
 * The MapForYou server relays its own analytics events, so the visitor address and the
 * region Vercel saw travel with them. Only the relayed fields are copied, so nothing a
 * caller sends directly can pretend to be another address.
 */
const VISITOR_HEADERS=[['x-visitor-ip','x-vercel-forwarded-for'],['x-visitor-country','x-vercel-ip-country'],['x-visitor-region','x-vercel-ip-country-region'],['x-visitor-city','x-vercel-ip-city'],['x-visitor-postal','x-vercel-ip-postal-code'],['x-visitor-latitude','x-vercel-ip-latitude'],['x-visitor-longitude','x-vercel-ip-longitude']] as const;
export async function POST(request:Request){
 if(!mapforyouOriginAllowed(request.headers.get('origin')))return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});
 const text=await request.text(),headers=new Headers();
 for(const [from,to] of VISITOR_HEADERS){const value=request.headers.get(from);if(value)headers.set(to,value)}
 return ingestActivity(new Request(request.url,{method:'POST',headers,body:text}),'mapforyou');
}
