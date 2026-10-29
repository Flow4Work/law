import {ingestActivity} from '@/lib/activity-ingest';
import {modelRequestAllowed} from '@/lib/model-request-origin';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request){
 if(!modelRequestAllowed(request))return new Response(null,{status:403});
 return ingestActivity(request,'law');
}
