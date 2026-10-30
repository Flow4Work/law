import {ingestActivity} from '@/lib/activity-ingest';
import {portfolioOriginAllowed} from '@/lib/site-origin';
import {decodePortfolioRelay} from '@/lib/portfolio-relay';
export const runtime='nodejs';
export const maxDuration=30;
const corsHeaders=(request:Request):Record<string,string>=>{
 const origin=request.headers.get('origin');
 if(!origin||!portfolioOriginAllowed(origin))return {};
 return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'86400','Vary':'Origin'};
};
export async function OPTIONS(request:Request){
 const headers=corsHeaders(request);
 if(!headers['Access-Control-Allow-Origin'])return new Response(null,{status:403});
 return new Response(null,{status:204,headers});
}
export async function POST(request:Request){
 const headers=corsHeaders(request);
 if(!headers['Access-Control-Allow-Origin'])return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});
 let input=request;
 if(request.headers.has('x-law-relay-signature')||request.headers.has('x-law-relay-time')){
  const relayed=await decodePortfolioRelay(request);if(!relayed)return new Response(null,{status:403,headers:{...headers,'Cache-Control':'no-store'}});input=relayed;
 }
 const response=await ingestActivity(input,'portfolio');
 return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...headers,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
